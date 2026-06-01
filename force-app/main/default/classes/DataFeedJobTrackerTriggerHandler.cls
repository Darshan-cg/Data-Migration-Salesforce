public class DataFeedJobTrackerTriggerHandler {

    public static void startBatchProcessor(List<CgInfinity__Data_Feed_Job_Tracker__c> newRecords) {
        // We only care about the file name and parameters from the first record.
        // The batch will query for all the others.
        CgInfinity__Data_Feed_Job_Tracker__c trackerRacord = newRecords[0];

        if(trackerRacord.CgInfinity__Status__c == 'Upload Complete') {
            CSVUploaderController.invokeProcessDataFeedBatch(trackerRacord.CgInfinity__File_Name__c, trackerRacord.CgInfinity__Operation_Type__c, trackerRacord.CgInfinity__Target_Object__c);
        }
    }
}