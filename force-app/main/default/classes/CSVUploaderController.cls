public without sharing class CSVUploaderController {
    @AuraEnabled
    public static void uploadToApex(List<String> jsonDataList, String fileName) {

        System.debug('jsonDataList'+jsonDataList);
        
        List<Data_Feed_Record__c> records = new List<Data_Feed_Record__c>();
    
        for (String jsonString : jsonDataList) {
            Data_Feed_Record__c obj = new Data_Feed_Record__c();
            obj.Data_Feed_Record_JSON__c = jsonString;
            obj.File_Name__c = fileName;
            records.add(obj);
        }
    
        Database.insert(records);
    } 

    @AuraEnabled
    public static void updateDataFeedJobTrackerStatus(String status, String fileName, string operationType, String targetObject) {
        try {
            List<Data_Feed_Job_Tracker__c> jobTrackers = [SELECT Id, Status__c FROM Data_Feed_Job_Tracker__c WHERE File_Name__c = :fileName order by createddate desc LIMIT 1];
            
            if (jobTrackers.isEmpty()) {
                Data_feed_Job_Tracker__c newJobTracker = new Data_Feed_Job_Tracker__c();
                newJobTracker.File_Name__c = fileName;
                newJobTracker.Status__c = status;
                newJobTracker.Operation_Type__c = operationType;
                newJobTracker.Target_Object__c = targetObject;
                System.debug('newJobTracker: ' + newJobTracker);
                insert newJobTracker;
            }
            else{
                Data_Feed_Job_Tracker__c jobTracker = jobTrackers[0];
                jobTracker.Status__c = status;
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
