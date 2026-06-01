trigger DataFeedJobTrigger on CgInfinity__Data_Feed_Job_Tracker__c (after insert, after update) {
    if (Trigger.isAfter && (Trigger.isInsert || Trigger.isUpdate)) {
        DataFeedJobTrackerTriggerHandler.startBatchProcessor(Trigger.new);
    }
}
