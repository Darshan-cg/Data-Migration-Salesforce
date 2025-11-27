public class DataFeedJobTrackerTriggerHandler {

    public static void startBatchProcessor(List<Data_Feed_Job_Tracker__c> newRecords) {
        // We only care about the file name and parameters from the first record.
        // The batch will query for all the others.
        Data_Feed_Job_Tracker__c trackerRacord = newRecords[0];

        if(trackerRacord.Status__c == 'Upload Complete') {
            CSVUploaderController.invokeProcessDataFeedBatch(trackerRacord.File_Name__c, trackerRacord.Operation_Type__c, trackerRacord.Target_Object__c);
        }
    }
}