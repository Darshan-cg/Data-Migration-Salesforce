public with sharing class CSVConfigurationMapping {
    @AuraEnabled(cacheable=false)
    public static void createConfiguration(ConfigurationWrapper wrapper) {
        try {
            system.debug('Hello');
            // Validate input
            if (wrapper == null) {
                throw new AuraHandledException('Configuration wrapper is null');
            }
            
            if (String.isEmpty(wrapper.objectName)) {
                throw new AuraHandledException('Object name is required');
            }
            
            if (String.isEmpty(wrapper.operationType)) {
                throw new AuraHandledException('Operation type is required');
            }
            
            if (wrapper.mapping == null || wrapper.mapping.isEmpty()) {
                throw new AuraHandledException('No mappings provided');
            }
            
            System.debug('Creating configuration mappings...');
            system.debug('wrapper: ' + wrapper);
            system.debug('wrapper.objectName: ' + wrapper.objectName);
            system.debug('wrapper.operationType: ' + wrapper.operationType);
            system.debug('wrapper.fileName: ' + wrapper.fileName);
            system.debug('wrapper.mapping size: ' + wrapper.mapping.size());
            
            List<Data_Feed_Mapping__c> mappings = new List<Data_Feed_Mapping__c>();
            for (ConfigurationMapping mp : wrapper.mapping) {
                system.debug('Processing mapping: ' + mp);
                
                if (String.isEmpty(mp.csvFieldName)) {
                    throw new AuraHandledException('CSV Field Name is required in mapping');
                }
                
                if (String.isEmpty(mp.selectedField)) {
                    throw new AuraHandledException('Selected Field is required for CSV column: ' + mp.csvFieldName);
                }
                
                Data_Feed_Mapping__c mapping = new Data_Feed_Mapping__c();
                mapping.Operation__c = wrapper.operationType;
                mapping.File_Name__c = wrapper.fileName;
                mapping.Field_to_update__c = mp.selectedField;
                mapping.File_Column_Name__c = mp.csvFieldName;
                mapping.SObject_API_Name__c = wrapper.objectName;
                if (mp.isLookup) {
                    mapping.Lookup_Object_Name__c = mp.targetObject != null ? mp.targetObject : mp.lookupObject;
                    mapping.Lookup_Field__c = mp.matchField != null ? mp.matchField : mp.selectedLookupFields;
                } 
                mapping.Is_Lookup__c = mp.isLookup;
                mapping.Lookup_Filter_Criteria__c = mp.whereClause;
                mapping.Lookup_Return_Field__c = mp.returnField != null ? mp.returnField : '';
                // Set the unique key flag for Update operations
                if (wrapper.operationType == 'Upsert' && mp.isUniqueKey != null) {
                    mapping.put('Is_Unique_Key__c', mp.isUniqueKey);
                }
                mappings.add(mapping);
                system.debug('mapping created: ' + mapping);
            }

            if(mappings.size() == 0) {
                throw new AuraHandledException('No valid mappings to insert');
            }
            
            insert mappings;
            system.debug('Successfully inserted ' + mappings.size() + ' mappings');
        } catch (Exception e) {
            system.debug('Error in createConfiguration: ' + e.getMessage());
            throw new AuraHandledException('Error creating configuration: ' + e.getMessage());
        }
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
        @AuraEnabled public String selectedLookupFields {get; set;}
        @AuraEnabled public String lookupObject {get; set;}
        @AuraEnabled public String whereClause {get; set;}
        @AuraEnabled public Boolean isUniqueKey {get; set;}
        @AuraEnabled public String targetObject {get; set;}
        @AuraEnabled public String matchField {get; set;}
        @AuraEnabled public String returnField {get; set;}
    }
}