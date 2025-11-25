public class ProcessDataFeed implements Database.Batchable<SObject>
{
    	private String fileToBeProcessed = '';
    	private String operationType = '';
    	private String targetObj = '';
    	Map<String,String> fieldColumnMapping=new Map<String,String>();
    	Map<String,String> lookupColumnMapping=new Map<String,String>();
    	List<String> lookupQueries=new List<String>();
    	List<Data_Feed_Mapping__c> lookupMappings=new List<Data_Feed_Mapping__c>();
    	//Map<String,String> lookupFieldColumnMapping=new Map<String,String>();
    	//Map<String,String> lookupFieldQueryMapping=new Map<String,String>();

    
	    public ProcessDataFeed(String fileName, String operation, String targetObject) 
        {
            fileToBeProcessed = fileName;
            operationType = operation;
            targetObj=targetObject;
        	List<Data_Feed_Mapping__c> mappings = [SELECT File_Name__c, File_Column_Name__c, SObject_API_Name__c, Field_to_update__c, Lookup_Filter_Criteria__c, 
                                               	  Lookup_Object_Name__c, Lookup_Field__c, Lookup_Return_Field__c, Operation__c, Id, Name 
                                               	  FROM Data_Feed_Mapping__c WHERE File_Name__c = :fileName and Operation__c=:operation and SObject_API_Name__c=:targetObject and is_lookup__c=false]; 
            
            lookupMappings = [SELECT File_Name__c, File_Column_Name__c, SObject_API_Name__c, Field_to_update__c, Lookup_Filter_Criteria__c, 
                                               	  Lookup_Object_Name__c, Lookup_Field__c, Lookup_Return_Field__c, Operation__c, Id, Name 
                                               	  FROM Data_Feed_Mapping__c WHERE File_Name__c = :fileName and Operation__c=:operation and SObject_API_Name__c=:targetObject and is_lookup__c=true]; 
            
            for(Data_Feed_Mapping__c mapping:mappings)
            {
                fieldColumnMapping.put(mapping.File_Column_Name__c,mapping.Field_to_update__c);
            }
            for(Data_Feed_Mapping__c mapping:lookupMappings)
            {
                lookupColumnMapping.put(mapping.File_Column_Name__c,mapping.Field_to_update__c);
            }            
            /*for(Data_Feed_Mapping__c mapping:lookupMappings)
            {
                String lookupQuery = 'SELECT ' + mapping.Lookup_Return_Field__c + ' FROM ' + mapping.Lookup_Object_Name__c +
                                    ' WHERE ' + mapping.Lookup_Field__c + ' IN: \'' +mapping.File_Column_Name__c + '\'';
                                if (mapping.Lookup_Filter_Criteria__c != null && mapping.Lookup_Filter_Criteria__c != '') {
                                    lookupQuery += ' AND ' + mapping.Lookup_Filter_Criteria__c;
                                }
                lookupQueries.add(lookupQuery);
                //lookupFieldColumnMapping.put(mapping.File_column_Name__c,mapping.Field_to_update__c);
                //lookupFieldQueryMapping.put(mapping.File_column_Name__c,lookupQuery);
            }*/
    	}
        
    	public Database.QueryLocator start(Database.BatchableContext context)
        {
            return Database.getQueryLocator([SELECT Id, File_Name__c, Error_Message__c,Data_Feed_Record_JSON__c,Is_Failed__c,Is_Processed__c FROM Data_Feed_Record__c 
            WHERE Is_Processed__c = false AND File_Name__c = :fileToBeProcessed 
            Order by createddate desc
            ]);
        }

    	public void execute(Database.BatchableContext context, List<Data_Feed_Record__c> scope)
        {
            /*Map<String,List<SObject>> lookupRecordsMap=new Map<String,List<Sobject>>();
            for(String lookupQuery:lookupQueries)
            {
                List<SObject> lookupRecords = Database.query(lookupQuery);       
                lookupRecordsMap.put((lookupRecords[0].getSObjectType().getDescribe().getName()),lookupRecords);
            }*/
            
            
            
            List<SObject> records = new List<SObject>();
            List<Map<String,Object>> dataFeedRecords= new List<Map<String,Object>>();
            Map<String,Set<Object>> lookupRecordsMap= new Map<String,Set<Object>>(); // contains csv data for lookup fields along with header names
           	
            for (Data_Feed_Record__c d:scope)
            {
                Map<String,Object> dataFeedRecord=(Map<String,Object>)JSON.deserializeuntyped(d.Data_Feed_Record_JSON__c);
                dataFeedRecords.add(dataFeedRecord);   
            }
            
            for(Map<String,Object> mp: dataFeedRecords)
            {
                for(Data_Feed_Mapping__c dfm:lookupMappings)
                {

                    
                	if((dfm.file_column_name__c).contains(','))
                    {
                        List<String> multipleLookups=(dfm.file_column_name__c).split(',');
                        for(String s:multipleLookups)
                        {
	                        if(mp.get(s)!=null)
                        	{	
                                System.debug('lookupRecordsMap'+lookupRecordsMap);
                                if(!(lookupRecordsMap.containsKey(s)) || (lookupRecordsMap.get(s)).isEmpty())
                                {
                                    Set<Object> lookupValues=new Set<Object>();
                                    //List<String> lookupValues=new List<String>();
                                    //String tempString=(String.valueOf(mp.get(dfm.file_column_name__c))).replaceAll('[\\n\\r\\s]+', '');
                                    lookupValues.add('\''+mp.get(s)+'\'');
                                    lookupRecordsMap.put(s,lookupValues);
                                }
                                else if(!(lookupRecordsMap.get(s)).isEmpty())
                                {
                                    Set<Object> lookupValues=lookupRecordsMap.get(s);
                                    //String tempString=(String.valueOf(mp.get(dfm.file_column_name__c))).replaceAll('[\\n\\r\\s]+', '');
                                    lookupValues.add('\''+mp.get(s)+'\'');
                                    lookupRecordsMap.put(s,lookupValues);
                                }
                        	}                               
                        }
                    }


                    else
                    {
                        if(mp.get(dfm.file_column_name__c)!=null)
                        {	
                            System.debug('lookupRecordsMap'+lookupRecordsMap);
                            if(!(lookupRecordsMap.containsKey(dfm.file_column_name__c)) || (lookupRecordsMap.get(dfm.file_column_name__c)).isEmpty())
                            {
                                Set<Object> lookupValues=new Set<Object>();
                                //List<String> lookupValues=new List<String>();
                                //String tempString=(String.valueOf(mp.get(dfm.file_column_name__c))).replaceAll('[\\n\\r\\s]+', '');
                                lookupValues.add('\''+mp.get(dfm.file_column_name__c)+'\'');
                                lookupRecordsMap.put(dfm.file_column_name__c,lookupValues);
                            }
                            else if(!(lookupRecordsMap.get(dfm.file_column_name__c)).isEmpty())
                            {
                                Set<Object> lookupValues=lookupRecordsMap.get(dfm.file_column_name__c);
                                //String tempString=(String.valueOf(mp.get(dfm.file_column_name__c))).replaceAll('[\\n\\r\\s]+', '');
                                lookupValues.add('\''+mp.get(dfm.file_column_name__c)+'\'');
                                lookupRecordsMap.put(dfm.file_column_name__c,lookupValues);
                            }
                        }                        
                    }
                }               
            }



            Map<String,Map<String,String>> lookupResultsMap=new Map<String,Map<String,String>>();          
            for(Data_Feed_Mapping__c mapping:lookupMappings)
            {
                String lookupQuery;
   				if((mapping.file_column_name__c).contains(','))
                {
                    List<String> multipleLookups=(mapping.file_column_name__c).split(',');
                    List<String> multipleLookupFields=(mapping.Lookup_field__c).split(',');
                    lookupQuery = 'SELECT ' + mapping.Lookup_Field__c+','+mapping.Lookup_Return_Field__c + ' FROM ' + mapping.Lookup_Object_Name__c +
                        ' WHERE ';
                
                    for(integer k = 0; k < multipleLookups.size(); k++)
                    {
                        String s = multipleLookups[k];
                        //int arraySize=multipleLookups.size();
                        Set<Object> tempObject=lookupRecordsMap.get(s);
                        List<String> tempList = new List<String>();
                        for(Object o:tempObject)
                        {
                            tempList.add(String.valueOf(o));
                        }    
                        String inClause = '';
                        for (integer i = 0; i < tempList.size(); i++) {
                            inClause += String.escapeSingleQuotes(tempList[i]);
                            if (i < tempList.size() - 1) {
                                inClause += ',';
                            }
                            inClause=inClause.replace('\\', '');
                        }
                        if(k < multipleLookups.size() - 1)
                        {
                         	lookupQuery += multipleLookupFields[k] + ' IN (' + inClause + ')'+' AND ';                           
                        }
                        else
                        {
                         	lookupQuery += multipleLookupFields[k] + ' IN (' + inClause + ')';                                                    
                        }
                    }
                    if (mapping.Lookup_Filter_Criteria__c != null && mapping.Lookup_Filter_Criteria__c != '') 
                    {
                        lookupQuery += ' AND ' + mapping.Lookup_Filter_Criteria__c;
                    }                        
                }
                else
                {
                    Set<Object> tempObject=lookupRecordsMap.get(mapping.file_column_name__c);
                    List<String> tempList = new List<String>();
                    for(Object o:tempObject)
                    {
                        tempList.add(String.valueOf(o));
                    }
                    // Properly quote and comma-separate the values
                    String inClause = '';
                    for (Integer i = 0; i < tempList.size(); i++) {
                        inClause += String.escapeSingleQuotes(tempList[i]);
                        if (i < tempList.size() - 1) {
                            inClause += ',';
                        }
                        inClause=inClause.replace('\\', '');
                    }
                    lookupQuery = 'SELECT ' + mapping.Lookup_Field__c+','+mapping.Lookup_Return_Field__c + ' FROM ' + mapping.Lookup_Object_Name__c +
                        ' WHERE ' + mapping.Lookup_Field__c + ' IN (' + inClause + ')';
                    if (mapping.Lookup_Filter_Criteria__c != null && mapping.Lookup_Filter_Criteria__c != '') {
                        lookupQuery += ' AND ' + mapping.Lookup_Filter_Criteria__c;
                    }
                    System.debug('lookupQuery'+lookupQuery);
                }
                List<SObject> lookupRecords = Database.query(lookupQuery);                    
                for(Sobject s:lookupRecords)
                {
                   	if((mapping.file_column_name__c).contains(','))
                    {
                        List<String> fileColumns=(mapping.file_column_name__c).split(',');
                        List<String> fields = (mapping.Lookup_Field__c).split(',');
                        String tempFileColumnName='';
                        String tempValues='';
                        for(Integer i=0;i<fileColumns.size();i++)
                        {
							tempValues+=(String)s.get(fields[i]);
                            if(i<fileColumns.size()-1)
                            {
                           		 tempFileColumnName+=fileColumns[i]+',';	                                
                            }
                            else
                            {
                                tempFileColumnName+=fileColumns[i];
                            }
                        }
                        if(lookupResultsMap.get(String.valueOf(tempFileColumnName))==null)
                        {
                            Map<String,String> tempMap=new Map<String,String>();
                            tempMap.put(tempValues,(String)s.get(mapping.Lookup_Return_Field__c));
                            lookupResultsMap.put(tempFileColumnName,tempMap);                  
                        }
                        else if(lookupResultsMap.get(tempFileColumnName)!=null)
                        {
                            Map<String,String> tempMap=new Map<String,String>();    
                            tempMap=lookupResultsMap.get(tempFileColumnName);
                            tempMap.put(tempValues,(String)s.get(mapping.Lookup_Return_Field__c));
                            lookupResultsMap.put(tempFileColumnName,tempMap); 
                        }                        
                    }
                    else
                    {
                        if(lookupResultsMap.get(String.valueOf(mapping.file_column_name__c))==null)
                        {
                            Map<String,String> tempMap=new Map<String,String>();
                            tempMap.put((String)s.get(mapping.Lookup_Field__c),(String)s.get(mapping.Lookup_Return_Field__c));
                            lookupResultsMap.put(String.valueOf(mapping.file_column_name__c),tempMap);                  
                        }
                        else if(lookupResultsMap.get(mapping.file_column_name__c)!=null)
                        {
                            Map<String,String> tempMap=new Map<String,String>();    
                            tempMap=lookupResultsMap.get(mapping.file_column_name__c);
                            tempMap.put((String)s.get(mapping.Lookup_Field__c),(String)s.get(mapping.Lookup_Return_Field__c));
                            lookupResultsMap.put(String.valueOf(mapping.file_column_name__c),tempMap); 
                        }
                    }
                }
            }
            for (Data_Feed_Record__c d:scope)
            {
                try
                {
                    System.debug('lookupResultsMap'+lookupResultsMap);
                    Map<String,Object> dataFeedRecord=(Map<String,Object>)JSON.deserializeuntyped(d.Data_Feed_Record_JSON__c);
                    SObject targetRecord = Schema.getGlobalDescribe().get(targetObj).newSObject();
                    for(String key: dataFeedRecord.keySet())
                    {
                        if(fieldColumnMapping.get(key)!=NULL)
                        {
                            targetRecord.put(fieldColumnMapping.get(key),dataFeedRecord.get(key));
                            System.debug('targetRecord'+targetRecord);
                        }    
                        if(lookupColumnMapping.get(key)!=NULL)
                        {
                            System.debug('lookupColumnMapping.get(key)'+lookupColumnMapping.get(key));
                            System.debug('(lookupResultsMap.get(key)).get(String.valueof(dataFeedRecord.get(key)))'+(lookupResultsMap.get(key)).get(String.valueof(dataFeedRecord.get(key))));
                            targetRecord.put(lookupColumnMapping.get(key),(lookupResultsMap.get(key)).get(String.valueof(dataFeedRecord.get(key))));   
                            
                        }
                        for(String compositeKey:lookupColumnMapping.keyset())
                        {
                            if(compositeKey.contains(key) && compositeKey.contains(','))
                            {
                                List<String> fileColumns=compositeKey.split(',');
                                String tempStr='';
                                for(String temp:fileColumns)
                                {
                                    tempStr+=dataFeedRecord.get(temp);
                                }
                            System.debug('lookupColumnMapping'+lookupColumnMapping);
                            System.debug('compositeKey'+compositeKey);
                            System.debug('tempStr'+tempStr);
                            System.debug('lookupColumnMapping.get(compositeKey'+lookupColumnMapping.get(compositeKey));
                            System.debug('(lookupResultsMap.get(compositeKey))'+(lookupResultsMap.get(compositeKey)));
                            System.debug('(lookupResultsMap.get(compositeKey)).get(tempStr)'+(lookupResultsMap.get(compositeKey)).get(tempStr));
                            targetRecord.put(lookupColumnMapping.get(compositeKey),(lookupResultsMap.get(compositeKey)).get(tempStr));   
                            }
                        }
                    }
                    records.add(targetRecord);
               	 }
                catch(Exception e)
                {
                    d.Is_Processed__c = true;
                    d.Error_Message__c = 'Error preparing record for insert: ' + e.getMessage() + ' at line ' + e.getLineNumber();
                    records.add(null); 
                }
            }
            
            System.debug('records'+records);
            
            Map<Id, String> errorMap = new Map<Id, String>();
            List<SObject> recordsToInsert = new List<SObject>();
            Map<Integer, Integer> originalIndexMap = new Map<Integer, Integer>();
            
            // Filter out any nulls that were added from preparation errors
            for(Integer i = 0; i < records.size(); i++){
                if(records[i] != null){
                    originalIndexMap.put(recordsToInsert.size(), i); // Map new list index to original scope index
                    recordsToInsert.add(records[i]);
                }
            }
            if(!recordsToInsert.isEmpty()) 
            {
                // Use allOrNone = false to allow partial success
                List<Database.SaveResult> saveResults = Database.insert(recordsToInsert, false);
    
                // Iterate over the results to check for successes and failures
                for (Integer i = 0; i < saveResults.size(); i++) {
                    Database.SaveResult sr = saveResults[i];
                    
                    if (!sr.isSuccess()) {
                        // An error occurred, get the corresponding original Data_Feed_Record__c
                        Integer originalScopeIndex = originalIndexMap.get(i);
                        Id failedRecordId = scope[originalScopeIndex].Id;
                        String errorMessage = '';
    
                        // Concatenate all errors for this single record
                        for (Database.Error err : sr.getErrors()) {
                            errorMessage += 'Error: ' + err.getStatusCode() + ' - ' + err.getMessage();
                            // Also include fields that caused the error, if available
                            if (err.getFields() != null && !err.getFields().isEmpty()) {
                                errorMessage += ' (Fields: ' + String.join(err.getFields(), ', ') + '). ';
                            } else {
                                errorMessage += '. ';
                            }
                        }
                        errorMap.put(failedRecordId, errorMessage.trim());
                    }
                }
        	}
        // Now, update the original Data_Feed_Record__c records with status and any errors
        for (Data_Feed_Record__c dfr : scope) {
            dfr.Is_Processed__c = true; // Mark as processed regardless of outcome
            if (errorMap.containsKey(dfr.Id)) {
                // This record had a DML error, so log it
                dfr.Error_Message__c = errorMap.get(dfr.Id);
            } else if (dfr.Error_Message__c == null) {
                // If it wasn't a DML error and no preparation error was caught, it was successful.
                // Clear any previous error messages.
                 dfr.Error_Message__c = null;
            }
        }       
        update scope;
           
        }

        public void finish(Database.BatchableContext context)
        {
            Data_Feed_Job_Tracker__c jobTracker = [SELECT Id, File_Name__c, Operation_Type__c, Target_Object__c, Status__c FROM Data_Feed_Job_Tracker__c WHERE File_Name__c = :fileToBeProcessed order by createddate desc LIMIT 1][0];
            if(jobTracker.Status__c == 'Upload Complete') {
                jobTracker.Status__c = 'Completed';
                update jobTracker;
                CSVUploaderController.invokeProcessDataFeedBatch(jobTracker.File_Name__c, jobTracker.Operation_Type__c, jobTracker.Target_Object__c);
            }
            else {
                jobTracker.Status__c = 'Ready for Processing';
                update jobTracker;
            }
        }
}