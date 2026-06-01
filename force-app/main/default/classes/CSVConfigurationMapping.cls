public without sharing class CSVConfigurationMapping {
    @AuraEnabled
    public static void createConfiguration(String wrapperJson) {
        try {
            system.debug('Received JSON: ' + wrapperJson);
            ConfigurationWrapper wrapper = (ConfigurationWrapper) JSON.deserialize(wrapperJson, ConfigurationWrapper.class);
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
            
            List<CgInfinity__Data_Feed_Mapping__c> mappings = new List<CgInfinity__Data_Feed_Mapping__c>();
            for (ConfigurationMapping mp : wrapper.mapping) {
                system.debug('Processing mapping: ' + mp);
                
                if (String.isEmpty(mp.csvFieldName)) {
                    throw new AuraHandledException('CSV Field Name is required in mapping');
                }
                
                if (String.isEmpty(mp.selectedField)) {
                    throw new AuraHandledException('Selected Field is required for CSV column: ' + mp.csvFieldName);
                }
                
                CgInfinity__Data_Feed_Mapping__c mapping = new CgInfinity__Data_Feed_Mapping__c();
                mapping.CgInfinity__Operation__c = wrapper.operationType;
                mapping.CgInfinity__File_Name__c = wrapper.fileName;
                mapping.CgInfinity__Field_to_update__c = mp.selectedField;
                mapping.CgInfinity__File_Column_Name__c = mp.csvFieldName;
                mapping.CgInfinity__SObject_API_Name__c = wrapper.objectName;
                if (mp.isLookup == true) {
                    mapping.CgInfinity__Lookup_Object_Name__c = String.isNotBlank(mp.targetObject) ? mp.targetObject : mp.lookupObject;
                    mapping.CgInfinity__Lookup_Field__c = String.isNotBlank(mp.matchField) ? mp.matchField : mp.selectedLookupFields;
                    mapping.CgInfinity__Lookup_Return_Field__c = String.isNotBlank(mp.returnField) ? mp.returnField : 'Id';
                }
                mapping.CgInfinity__Is_Lookup__c = (mp.isLookup == true);
                mapping.CgInfinity__Lookup_Filter_Criteria__c = String.isNotBlank(mp.whereClause) ? mp.whereClause : '';
                // Set the unique key flag for Upsert operations
                if (wrapper.operationType == 'Upsert' && mp.isUniqueKey == true) {
                    mapping.CgInfinity__Is_Unique_Key__c = true;
                }
                mappings.add(mapping);
                system.debug('mapping created: ' + mapping);
            }

            if(mappings.size() == 0) {
                throw new AuraHandledException('No valid mappings to insert');
            }
            
            insert mappings;
            system.debug('Successfully inserted ' + mappings.size() + ' mappings');
        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (DmlException dmlEx) {
            system.debug('DML Error: ' + dmlEx.getMessage());
            throw new AuraHandledException('DML Error: ' + dmlEx.getDmlMessage(0));
        } catch (Exception e) {
            system.debug('Error in createConfiguration: ' + e.getMessage() + ' Line: ' + e.getLineNumber());
            throw new AuraHandledException('Error: ' + e.getTypeName() + ' - ' + e.getMessage());
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