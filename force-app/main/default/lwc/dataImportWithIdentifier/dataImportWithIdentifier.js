import { LightningElement, track } from 'lwc';
import getObjects from '@salesforce/apex/CSVDataController.getObjects';
import getFields from '@salesforce/apex/CSVDataController.getFields';

import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFields';

import generateCSV from '@salesforce/apex/CSVDataController.generateCSV';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class DataImportWithIdentifier extends LightningElement {
    @track objectOptions = [];
    @track fieldOptions = [];
    @track selectedObject = '';
    @track selectedFields = [];
    @track csvData = null;

    @track uniqueIdentifierMapping = new Map();
    @track fieldsWithLookupList = [];
    @track filteredLookupFields = [];
    @track selectedLookupField = '';

    @track uniqueIdentifierFieldOptions = [];
    @track selectedUniqueIdentifierFields = [];

    zoomLevel = 10; // Default zoom level
    listView = 'visible'; // List view visibility

    // Fetch available objects on component load
    connectedCallback() {
        getObjects()
            .then(data => {
                this.objectOptions = data.map(obj => ({ label: obj.label, value: obj.apiName }));
            })
            .catch(error => {
                console.error('Error fetching objects:', error);
            });
    }

    // Handle object selection
    handleObjectChange(event) {
        this.selectedObject = event.detail.value;
        this.fetchFields();
    }

    // Fetch fields for the selected object
    fetchFields() {
        getFields({ objectName: this.selectedObject })
            .then(data => {
                console.log('Fields:', data);
                this.fieldsWithLookupList = data.filter(field => field.isLookup).map(field => ({ label: field.label, apiName: field.apiName, isLookup: field.isLookup }));
                this.fieldOptions = data.map(field => ({ label: field.label, value: field.apiName }));
            })
            .catch(error => {
                console.error('Error fetching fields:', error);
            });
    }

    // Handle field selection
    handleFieldChange(event) {
        this.selectedFields = event.detail.value;
        
        if (Array.isArray(this.fieldsWithLookupList) && Array.isArray(this.selectedFields)) {
        this.filteredLookupFields = this.fieldsWithLookupList.filter(item2 =>
            item2.isLookup && this.selectedFields.includes(item2.apiName)
        ).map(item2 => ({
            label: item2.label,
            value: item2.apiName
        }));
        } else {
            this.filteredLookupFields = []; // or handle the error as necessary
        }
    }

    // Handle field selection
    handleUniqueIdentifierFieldChange(event) {        
        this.selectedUniqueIdentifierFields = event.detail.value;
    }

    // Handle object selection
    handleLookupFieldChange(event) {
        console.log('Lookup Field value:', event.detail.value);
        this.selectedLookupField = event.detail.value;
        this.fetchLookupFields();
    }

    // Fetch fields for the selected object
    fetchLookupFields() {
        getLookupFields({ parentObjectName: this.selectedObject, lookupFieldName: this.selectedLookupField  })
            .then(data => {
                this.uniqueIdentifierFieldOptions = data.map(field => ({ label: field.label, value: field.apiName, isLookup: field.isLookup }));
            })
            .catch(error => {
                console.error('Error fetching fields:', error);
            });
    }
    

    exportToCSV() {
        try {
        console.log('Selected Object:', this.selectedObject);
        console.log('Selected Fields:', this.selectedFields);
        console.log('Selected Unique Identifier Fields:', this.selectedUniqueIdentifierFields);
        let allSelectedFields = (this.selectedUniqueIdentifierFields !== null && this.selectedUniqueIdentifierFields.length > 0) ?  this.selectedFields.concat(this.selectedUniqueIdentifierFields) : this.selectedFields;
        console.log('All Selected Fields:', allSelectedFields);
        generateCSV({ objectName: this.selectedObject, fieldNames: allSelectedFields })
            .then(csvString => {
                console.log('CSV String:', csvString);
                this.downloadCSV(csvString);
            })
            .catch(error => {
                this.showToast('Error', error.body.message, 'error');
            });
        }
        catch (error) {
            console.error('Error generating CSV:', error.message || error);
            this.showToast('Error', 'Failed to export CSV.', 'error');
        }
    }

    downloadCSV(csvString) {
        try {
            // Convert CSV string to binary data
            const csvData = new Blob([csvString], { type: 'application/octet-stream' }); // Use permitted MIME type
            const link = document.createElement('a');
            link.href = URL.createObjectURL(csvData);
            link.setAttribute('download', 'export.csv'); // Set filename
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
    
            // Show success toast if applicable
            this.showToast('Success', 'CSV has been exported!', 'success');
        } catch (error) {
            console.error('Error generating CSV:', error.message || error);
            this.showToast('Error', 'Failed to export CSV.', 'error');
        }
    }

    addUniqueIdentifierMapping() {
        try {
            console.log("addUniqueIdentifierMapping called");
            console.log("this.selectedLookupField:", this.selectedLookupField);
            console.log("this.selectedUniqueIdentifierFields:", this.selectedUniqueIdentifierFields);
            if (!this.selectedLookupField) {
                this.showToast('Error', 'Please select a lookup field.', 'error');
                return;
            }

            let selectedFieldString = this.selectedUniqueIdentifierFields.length > 1 ? this.selectedUniqueIdentifierFields.join(',') : this.selectedUniqueIdentifierFields[0];
            console.log('Selected Unique Identifier Fields:', selectedFieldString);
            // Check if the selected lookup field already exists in the map
            if (this.uniqueIdentifierMapping.has(this.selectedLookupField)) {
                this.showToast('Error', 'Unique Identifier Mapping already exists for this Lookup Field.', 'error');
                return;
            }
            this.uniqueIdentifierMapping.set(this.selectedLookupField, selectedFieldString);
            console.log('unique Identifier Mapping:', this.uniqueIdentifierMapping);
        } catch (error) {
            console.error('Error adding unique identifier mapping:', error);
        }
        
    }
    
    get mapEntries() {
        // Convert map to an array of key-value pairs for iteration in HTML
        return Array.from(this.uniqueIdentifierMapping.entries());
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
        });
        this.dispatchEvent(event);
    }

    // Reset component state
    resetComponent() {
        // this.objectOptions = [];
        // this.fieldOptions = [];
        this.selectedObject = '';
        this.selectedFields = [];
        this.csvData = null;

        this.lookupFieldList = [];
        this.fieldsWithLookupList = [];
        this.filteredLookupFields = [];
        this.selectedLookupField = '';

        this.uniqueIdentifierFieldOptions = [];
        this.selectedUniqueIdentifierFields = [];
    }
}