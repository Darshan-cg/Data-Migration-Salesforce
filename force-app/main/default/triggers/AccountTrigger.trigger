trigger AccountTrigger on Account (before insert, after insert)
{   
    if(Trigger.isInsert && Trigger.isBefore)
    {
        AccountTriggerHandler.addSuffix(Trigger.new);
    }
    if(Trigger.isInsert && Trigger.isAfter)
    {
        AccountTriggerHandler.SendEmail(Trigger.new);
    }
}