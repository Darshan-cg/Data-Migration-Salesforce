public with sharing class CSVDataController {
    
    @AuraEnabled(cacheable=true)
    public static List<SObjectDescribe> getObjects() {
        List<SObjectDescribe> result = new List<SObjectDescribe>();
        try{
    	Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
    
    	for (Schema.SObjectType objType : gd.values()) {
        	Schema.SObjectField field = objType.getDescribe().fields.getMap().values().iterator().next();
        	if(objType.getDescribe().getName() == 'Account' 
            || objType.getDescribe().getName() == 'Contact' 
            || objType.getDescribe().getName() == 'Lead' 
            || objType.getDescribe().getName() == 'Opportunity' 
            || objType.getDescribe().getName() == 'User' 
            || objType.getDescribe().getName() == 'Task' 
            || objType.getDescribe().getName() == 'Event' 
            || objType.getDescribe().getName() == 'Case'){
            	result.add(new SObjectDescribe(objType.getDescribe().getLabel(), objType.getDescribe().getName()));
    	}
        }
    }
        catch(exception ex){
            system.debug('exception: ' + ex.getMessage());
        }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldDescribe> getFields(String objectName) {
        List<FieldDescribe> result = new List<FieldDescribe>();
        Schema.SObjectType objType = Schema.getGlobalDescribe().get(objectName);
        
        if (objType != null) {
            Map<String, Schema.SObjectField> fieldsMap = objType.getDescribe().fields.getMap();
            
            for (Schema.SObjectField field : fieldsMap.values()) {
                if (field.getDescribe().isCreateable() || field.getDescribe().getName() == 'Id') {
                    result.add(new FieldDescribe(field.getDescribe().getLabel(), field.getDescribe().getName(), isLookupField(field)));
                }
            }
        }
        
        return result;
	}

    public static Boolean isLookupField(Schema.SObjectField field) {
        // Get field description
        Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
        
        // Check if the field is a reference type
        if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
            // Check if it is a lookup by verifying relationship order is null
            if (fieldDescribe.getRelationshipOrder() == null) {
                return true; // It's a lookup field
            }
        }
        else if (field.getDescribe().getName() == 'Id') {
            return true; // Not a lookup field
        }
        return false; // Not a lookup field
    }
    

    @AuraEnabled
    public static List<Map<String, Object>> fetchData(String objectName, List<String> fields) {
        String query = 'SELECT ' + String.join(fields, ',') + ' FROM ' + objectName;
        List<SObject> records = Database.query(query);

        List<Map<String, Object>> results = new List<Map<String, Object>>();
        for (SObject record : records) {
            Map<String, Object> row = new Map<String, Object>();
            for (String field : fields) {
                row.put(field, record.get(field));
            }
            results.add(row);
        }
        return results;
    }

    @AuraEnabled
    public static String generateCSV(String objectName, List<String> fieldNames) {
        system.debug('Object Name: ' + objectName);
        system.debug('Field Names: ' + fieldNames);
        try {
            // Validate input
            if (String.isBlank(objectName) || fieldNames == null || fieldNames.isEmpty()) {
                throw new IllegalArgumentException('Object name and field names cannot be empty.');
            }

            // Build dynamic SOQL query
        String fields = String.join(fieldNames, ',');
        String query = 'SELECT ' + fields + ' FROM ' + objectName;
        
        List<SObject> records = Database.query(query);
        system.debug('Query: ' + query);
        system.debug('Records: ' + records);
        

        // Generate CSV string
        String csvString = String.join(fieldNames, ',') + '\n';
        for (SObject record : records) {
            List<String> row = new List<String>();
            for (String field : fieldNames) {

        // Handle relationship fields (e.g., "Account.Name")
        if (field.contains('.')) {
            SObject temp = record;
            List<String> fieldParts = field.split('\\.');
            
            // Traverse relationships (all parts except last)
            for (Integer i = 0; i < fieldParts.size() - 1; i++) {
                temp = temp.getSObject(fieldParts[i]);
                if (temp == null) break; // Handle missing relationships
            }
            
            // Get final field value
            Object value = (temp != null) 
                ? temp.get(fieldParts[fieldParts.size()-1]) 
                : null;
            row.add(String.valueOf(value));
        } 
        // Handle regular fields
        else {
            row.add(String.valueOf(record.get(field)));
        }
            }
            csvString += String.join(row,',' ) + '\n';
        }
        
        return csvString;
        } catch (IllegalArgumentException e) {
            System.debug('Error: ' + e.getMessage());
            return null;
        }
        
    }

    public class SObjectDescribe {
        @AuraEnabled public String label;
        @AuraEnabled public String apiName;

        public SObjectDescribe(String label, String apiName) {
            this.label = label;
            this.apiName = apiName;
        }
    }
    
    public class FieldDescribe {
        @AuraEnabled public String label;
        @AuraEnabled public String apiName;
        @AuraEnabled public Boolean isLookup;

        public FieldDescribe(String label, String apiName, Boolean isLookup) {
            this.label = label;
            this.apiName = apiName;
            this.isLookup = isLookup;
        }
    }
}