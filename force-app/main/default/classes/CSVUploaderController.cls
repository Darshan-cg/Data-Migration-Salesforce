public without sharing class CSVUploaderController {
    @AuraEnabled
    public static void uploadToApex(List<String> jsonDataList, String fileName) {

        System.debug('jsonDataList'+jsonDataList);
        
        List<CgInfinity__Data_Feed_Record__c> records = new List<CgInfinity__Data_Feed_Record__c>();
    
        for (String jsonString : jsonDataList) {
            CgInfinity__Data_Feed_Record__c obj = new CgInfinity__Data_Feed_Record__c();
            obj.CgInfinity__Data_Feed_Record_JSON__c = jsonString;
            obj.CgInfinity__File_Name__c = fileName;
            records.add(obj);
        }
    
        Database.insert(records);
    } 

    @AuraEnabled
    public static void updateDataFeedJobTrackerStatus(String status, String fileName, string operationType, String targetObject) {
        try {
            List<CgInfinity__Data_Feed_Job_Tracker__c> jobTrackers = [SELECT Id, CgInfinity__Status__c FROM CgInfinity__Data_Feed_Job_Tracker__c WHERE CgInfinity__File_Name__c = :fileName AND CgInfinity__Operation_Type__c =:operationType order by createddate desc LIMIT 1];
            
            if (jobTrackers.isEmpty()) {
                CgInfinity__Data_Feed_Job_Tracker__c newJobTracker = new CgInfinity__Data_Feed_Job_Tracker__c();
                newJobTracker.CgInfinity__File_Name__c = fileName;
                newJobTracker.CgInfinity__Status__c = status;
                newJobTracker.CgInfinity__Operation_Type__c = operationType;
                newJobTracker.CgInfinity__Target_Object__c = targetObject;
                System.debug('newJobTracker: ' + newJobTracker);
                insert newJobTracker;
            }
            else{
                CgInfinity__Data_Feed_Job_Tracker__c jobTracker = jobTrackers[0];
                jobTracker.CgInfinity__Status__c = status;
                update jobTracker;
            }
        } catch (Exception e) {
            System.debug('Error updating Data_Feed_Job_Tracker__c: ' + e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void invokeProcessDataFeedBatch(String fileName, String operationType, String targetObject) {
        Database.executeBatch(new ProcessDataFeed(fileName, operationType, targetObject), 200);
    }

    @AuraEnabled
    public static String getPresignedUrl(String fileName) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:AWS_API/getPresignedUrl');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(JSON.serialize(new Map<String, Object>{'fileName' => fileName}));
            HttpResponse res = (new Http()).send(req);
            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            System.debug(result);
            if (result.containsKey('presignedUrl')) 
            {
                String url = (String) result.get('presignedUrl');
                System.debug(url);
                return url;
            }
            throw new AuraHandledException('Presigned URL not found in response');
        } catch(Exception e) {
            throw new AuraHandledException('Error getting presigned URL: ' + e.getMessage());
        }
    }
    
}