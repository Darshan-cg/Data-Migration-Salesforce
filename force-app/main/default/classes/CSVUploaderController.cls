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
    
}