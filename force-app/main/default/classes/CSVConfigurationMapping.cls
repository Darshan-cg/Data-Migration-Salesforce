public with sharing class CSVConfigurationMapping {
    @AuraEnabled(cacheable=false)
    public static void createConfiguration(ConfigurationWrapper wrapper) {
        // Implement the logic to create configuration mappings
        // This is a placeholder for the actual implementation
        System.debug('Creating configuration mappings...');
        system.debug('wrapper: ' + wrapper);
        system.debug('wrapper.selectedObject: ' + wrapper.objectName);
        system.debug('wrapper.operationType: ' + wrapper.operationType);
        system.debug('wrapper.fileName: ' + wrapper.fileName);
        // system.debug('wrapper.mapping: ' + wrapper.mapping);
        List<Data_Feed_Mapping__c> mappings = new List<Data_Feed_Mapping__c>();
        for (ConfigurationMapping mp : wrapper.mapping) {
            system.debug('mp: ' + mp);
            Data_Feed_Mapping__c mapping = new Data_Feed_Mapping__c();
            mapping.Operation__c = wrapper.operationType;
            mapping.File_Name__c = wrapper.fileName;
            mapping.File_Column_Name__c = String.isEmpty(mp.extraCsvField) ?  mp.csvFieldName : mp.csvFieldName + ',' + mp.extraCsvField;
            mapping.Field_to_update__c = mp.selectedField;
            mapping.SObject_API_Name__c = wrapper.objectName;
            mapping.Lookup_Object_Name__c = mp.lookupObject;
            mapping.Is_Lookup__c = mp.isLookup;
            mapping.Lookup_Field__c = mp.selectedLookupFields;
            mapping.Lookup_Filter_Criteria__c = mp.whereClause;
            mapping.Lookup_Return_Field__c = 'Id';
            mappings.add(mapping);
            system.debug('mapping: ' + mapping);
        }

        if(mappings.size() == 0) {
            system.debug('No mappings to insert');
            return;
        }
        
        insert mappings;
        // Database.saveresult[] results = Database.insert(mappings, false);
    }


    public class ConfigurationWrapper{
        @AuraEnabled public String objectName {get; set;}
        @AuraEnabled public String operationType {get; set;}
        @AuraEnabled public String fileName {get; set;}
        @AuraEnabled public List<ConfigurationMapping> mapping {get; set;}
    }

    public class ConfigurationMapping {
        @AuraEnabled public String csvFieldName {get; set;}
        @AuraEnabled public String selectedField {get; set;}
        @AuraEnabled public Boolean isLookup {get; set;}
        @auraEnabled public String selectedLookupFields {get; set;}
        @AuraEnabled public String lookupObject {get; set;}
        @AuraEnabled public String whereClause {get; set;}
        @AuraEnabled public String extraCsvField {get; set;}
    }
}