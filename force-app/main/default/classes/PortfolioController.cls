public with sharing class PortfolioController
{
    @AuraEnabled(cacheable=true)
    public static List<Portfolio__c> fetchPortfolios()
    {
        try 
        {
            return [SELECT Name,About__c,Current_Role__c,Email__c,Phone__c,
                    (SELECT Id,Name, Company__c, Start_Date__c, End_Date__c, Domain__c FROM Experiences__r),
                    (SELECT Id,Name, Description__c, Github__c FROM Projects__r)
                    FROM Portfolio__c];    
        } 
        catch (Exception e) 
        {
            return new List<Portfolio__c>();
        }
    }
}