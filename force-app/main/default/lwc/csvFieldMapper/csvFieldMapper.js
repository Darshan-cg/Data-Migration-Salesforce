import { api, LightningElement, track } from 'lwc';
import getFields from '@salesforce/apex/CSVDataController.getFields';
import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFields';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createConfiguration from '@salesforce/apex/CSVConfigurationMapping.createConfiguration';
export default class CsvFieldMapper extends LightningElement {
    @api selectedObject = 'Opportunity'; // Default selected object
    @api selectedOperation = 'Insert'; // Default operation type
    @api fileName = 'migration.csv'; // Default operation type
    @track fieldOptions = [];
    @track selectedFields = [];
    @track lookupFields = [];
    @track selectedLookupField = '';
    @api csvHeaders = ['Id', 'Name', 'Email', 'Phone', 'Description']; // Example CSV fields
    @track selectedDropdownValues = [];
    @track configuration = {
        objectName: '',
        operationType: '',
        fileName: this.fileName,
        mapping: []
    };
    @track csvHeaderOptions = [];
    
    columns = [
        { label: 'Csv Column', fieldName: 'csvFieldName' },
        { label: 'SF Field', fieldName: 'selectedField' },
        { label: 'Lookup Object', fieldName: 'lookupObject' },
        { label: 'Selected Lookup Mapping', fieldName: 'selectedLookupFields' }
    ];

    connectedCallback() {
        // Initialize any data or state here if needed
        this.createInitialCsvMapping();  
        // Get lookup fields for the selected object
        getFields({objectName: this.selectedObject}).then(data => {
            this.fieldsWithLookupList = data.filter(field => field.isLookup).map(field => ({ label: field.label, apiName: field.apiName, isLookup: field.isLookup }));
            this.fieldOptions = data.map(field => ({ label: field.label, value: field.apiName }));
            
        });
        
        this.csvHeaderOptions = this.csvHeaders.map(item => ({ label: item, value: item }));
    }

    handleFieldChange(event) {
        const fieldDetails = event.detail;
        // console.log('Event.isAdditionalFieldMapping:', event.detail.isAdditionalFieldMapping);
        const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === fieldDetails.keyField);
         console.log('Index:', index);
         console.log('Selected dropdown values:', this.selectedDropdownValues);
        if (index !== -1) {
            if(fieldDetails.isLookup) {
                this.selectedDropdownValues[index] = { ...this.selectedDropdownValues[index], 
                    selectedField: fieldDetails.selectedValue, 
                    lookupObject: fieldDetails.lookupObjectName , 
                    whereClause: fieldDetails.whereClause, 
                    isLookup: fieldDetails.isLookup,
                    selectedLookupFields: fieldDetails.selectedLookupFieldValues,
                    extraCsvField: fieldDetails.extraCsvField
                };
            } else {
                console.log('else  field details:', fieldDetails);
                this.selectedDropdownValues[index] = { ...this.selectedDropdownValues[index], 
                    selectedField: fieldDetails.selectedValue, 
                    isLookup: fieldDetails.isLookup

                };
            }
        }
        else if(event.detail.isAdditionalFieldMapping) {
            // console.log('Else condition');
            // console.log('Adding new field details:', fieldDetails);
            if(fieldDetails.isLookup) {
                this.selectedDropdownValues.push({ 
                    fileName: this.fileName, 
                    csvFieldName: fieldDetails.csvFieldName,
                    selectedField: fieldDetails.selectedValue, 
                    lookupObject: fieldDetails.lookupObjectName , 
                    whereClause: fieldDetails.whereClause, 
                    isLookup: fieldDetails.isLookup,
                    selectedLookupFields: fieldDetails.selectedLookupFieldValues,
                    extraCsvField: fieldDetails.extraCsvField,
                    keyField: fieldDetails.keyField
                });
            } else {
                this.selectedDropdownValues.push({
                    selectedField: fieldDetails.selectedValue, 
                    isLookup: fieldDetails.isLookup,
                    csvFieldName: fieldDetails.csvFieldName,
                    keyField: fieldDetails.keyField
                });
            }
        }
    }

    // Getter function to retrieve selected value for a specific header
    getSelectedValue(header) {
        return this.selectedValues[header] || '';
    }

    createMapping() {
        this.configuration.objectName = this.selectedObject;
        this.configuration.operationType = this.selectedOperation;
        this.configuration.mapping = this.selectedDropdownValues;
        this.configuration.fileName = this.fileName;
        // console.log('Creating mapping with configuration:', JSON.stringify(this.configuration));
        createConfiguration({ 
            wrapper: this.configuration
        })
            .then(() => {
                this.showToast('Success', 'CSV mapping created successfully!', 'success');
            })
            .catch(error => {
                console.error('Error creating mapping:', error);
                this.showToast('Error', 'Failed to create CSV mapping.', 'error');
            });
    }
    
    createInitialCsvMapping() {
        for (let i = 0; i < this.csvHeaders.length; i++) {
            this.selectedDropdownValues.push(
                { csvFieldName: this.csvHeaders[i], 
                  selectedField: this.csvHeaders[i],
                  isLookup: false,
                  keyField: this.csvHeaders[i]
                 });
            // this.configuration.mapping.push({ csvFieldName: this.csvHeaders[i], selectedField: this.csvHeaders[i] });
        }
    }

    get tableData(){
        return this.selectedDropdownValues.map(item => item);
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }
}