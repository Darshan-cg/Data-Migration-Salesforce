import sys
import json
import urllib.parse
import logging
import boto3
import csv
import io
import os
import urllib.request
import requests
import pandas as pd
import time

from botocore.exceptions import ClientError
from awsglue.utils import getResolvedOptions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_salesforce_secrets():
    secret_name = "salesforce/dataMigration"
    region_name = "us-east-1"
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )
    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        raise e
    secret_dict = json.loads(get_secret_value_response['SecretString'])
    client_id = secret_dict['client_id']
    client_secret = secret_dict['client_secret']
    refresh_token = secret_dict['refresh_token']
    return client_id, client_secret, refresh_token

args = getResolvedOptions(sys.argv, ['bucket', 'key'])
bucket = args['bucket']
raw_key = args['key']

client_id, client_secret, refresh_token = get_salesforce_secrets()

def get_access_token(client_id, client_secret, refresh_token):
    url = 'https://login.salesforce.com/services/oauth2/token'
    data = {
        'grant_type': 'refresh_token',
        'client_id': client_id,
        'client_secret': client_secret,
        'refresh_token': refresh_token
    }
    response = requests.post(url, data=data)
    response.raise_for_status()
    return response.json()

response = get_access_token(client_id, client_secret, refresh_token)
instance_url = response['instance_url']
access_token = response['access_token']

key = urllib.parse.unquote_plus(raw_key).split('?', 1)[0]
print("key", key)
file_name = os.path.basename(key)
parts = file_name.split('_')
print(parts)
file_name = parts[0]
print(f"Derived file_name: {file_name}")
operation_type = parts[1]
print(f"Derived operation_type: {operation_type}")
target_object = parts[2] 
print(f"Derived target_object: {target_object}")

s3 = boto3.client('s3')
obj = s3.get_object(Bucket=bucket, Key=key)
csv_content = obj['Body'].read().decode('utf-8')

def create_job(instance_url, access_token, object_type='CgInfinity__Data_Feed_Record__c'):
    url = f"{instance_url}/services/data/v65.0/jobs/ingest"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "object": object_type,
        "contentType": "CSV",
        "operation": "insert"
    }
    response = requests.post(url, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()

def upload_data(instance_url, access_token, job_id, file_path):
    url = f"{instance_url}/services/data/v65.0/jobs/ingest/{job_id}/batches"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "text/csv"
    }
    with open(file_path, 'rb') as f:
        response = requests.put(url, headers=headers, data=f)
        response.raise_for_status()
    return response.status_code == 201

def close_job(instance_url, access_token, job_id):
    url = f"{instance_url}/services/data/v65.0/jobs/ingest/{job_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "state": "UploadComplete"
    }
    response = requests.patch(url, headers=headers, json=payload)
    response.raise_for_status()
    return response.json()

def wait_for_job_completion(instance_url, access_token, job_id, max_wait_seconds=300):
    """Wait for bulk job to complete with polling"""
    url = f"{instance_url}/services/data/v65.0/jobs/ingest/{job_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    elapsed = 0
    poll_interval = 5  # Start with 5 second polls
    
    while elapsed < max_wait_seconds:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        job_status = response.json()
        state = job_status.get('state')
        
        logger.info(f"Job {job_id} state: {state} (elapsed: {elapsed}s)")
        
        if state in ['JobComplete', 'Completed', 'Failed', 'Aborted']:
            if state == 'Failed' or state == 'Aborted':
                logger.error(f"Job {job_id} failed with state: {state}")
                raise Exception(f"Bulk API job {job_id} failed with state {state}")
            return job_status
        
        time.sleep(poll_interval)
        elapsed += poll_interval
        # Increase poll interval over time (up to 30 seconds)
        if poll_interval < 30:
            poll_interval = min(30, poll_interval + 5)
    
    raise Exception(f"Bulk API job {job_id} did not complete within {max_wait_seconds} seconds")

# Process CSV and upload in jobs of 150,000 records each
reader = csv.DictReader(io.StringIO(csv_content))
records = []
for row in reader:
    records.append({
        "CgInfinity__Data_Feed_Record_JSON__c": json.dumps(row, ensure_ascii=False),
        "CgInfinity__File_Name__c": file_name
    })
df = pd.DataFrame(records)

BULK_CHUNK_SIZE = 150000
total_records = len(df)
logger.info(f"Total records to upload: {total_records}")

job_ids = []
for i in range(0, total_records, BULK_CHUNK_SIZE):
    chunk_df = df.iloc[i:i+BULK_CHUNK_SIZE]
    chunk_file = f"/tmp/data_feed_bulk_{i//BULK_CHUNK_SIZE+1}.csv"
    chunk_df.to_csv(chunk_file, index=False)
    
    # Create job
    job = create_job(instance_url, access_token, object_type='CgInfinity__Data_Feed_Record__c')
    job_id = job['id']
    job_ids.append(job_id)
    logger.info(f"Created job {job_id} for records {i+1} to {min(i+BULK_CHUNK_SIZE, total_records)}")
    
    # Upload data
    upload_data(instance_url, access_token, job_id, chunk_file)
    logger.info(f"Uploaded chunk {i//BULK_CHUNK_SIZE+1}")
    
    # Close job
    close_job(instance_url, access_token, job_id)
    logger.info(f"Closed job {job_id}")

# Wait for ALL jobs to complete before proceeding
logger.info("Waiting for all Bulk API jobs to complete...")
for job_id in job_ids:
    try:
        final_status = wait_for_job_completion(instance_url, access_token, job_id, max_wait_seconds=600)
    except Exception as e:
        logger.error(f"Error waiting for job {job_id}: {str(e)}")
        raise

# Wait additional time to ensure all records are committed and searchable
logger.info("Waiting 15 seconds for Salesforce to fully commit records...")
time.sleep(15)

# Create Job Tracker record
endpoint_job_tracker = f"{instance_url}/services/data/v65.0/sobjects/CgInfinity__Data_Feed_Job_Tracker__c/"
job_tracker_record = {
    "CgInfinity__File_Name__c": file_name,
    "CgInfinity__Status__c": "Upload Complete",
    "CgInfinity__Operation_Type__c": operation_type.capitalize(),
    "CgInfinity__Target_Object__c": target_object
}
job_tracker_data = json.dumps(job_tracker_record).encode('utf-8')
job_tracker_headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json'
}
job_tracker_req = urllib.request.Request(endpoint_job_tracker, data=job_tracker_data, headers=job_tracker_headers, method='POST')

try:
    with urllib.request.urlopen(job_tracker_req) as response:
        result = response.read().decode()
        logger.info(f"Job Tracker Created: {response.status} - {result}")
except urllib.error.HTTPError as e:
    logger.error(f"Job Tracker Error: {e.code} - {e.read().decode()}")
    raise
