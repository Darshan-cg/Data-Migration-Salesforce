import { api, LightningElement, track } from 'lwc';
import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFieldsWithObjectName';


export default class CsvDynamicComponent extends LightningElement {
    @api csvHeaderOptions;
    @api fieldOptions;
    @api selectedObject;
    @track components = [];
    @track uniqueIdentifierFieldOptions = [];
    @track selectedUniqueIdentifierFields = [];
    @track csvHeaderValue = '';
    @api lookupFieldList;
    @track keyValue = '';

    // connectedCallback() {
    //     console.log('');
    // }

    handleAddComponents() {
        // console.log('Adding components');
        const newDropdown = { id: `dropdown-${Date.now()}`, isTextbox: false, isDropdown: true };
        
        this.components = [...this.components, newDropdown];
    }

    handleCsvHeaderChange(event) {
        // console.log('csv dynamic Header changed:', event.detail);
        this.csvHeaderValue = event.detail.value;
        this.keyValue = 'extraMapping' + this.csvHeaderValue  + Math.floor(Math.random() * 1000);
    }   

    handleFieldChange(event){
        event.detail.isAdditionalFieldMapping = true;
        const event1 = new CustomEvent('handlelookupselection', {
            detail: event.detail
        });
        this.dispatchEvent(event1);
    }

    // Fetch fields for the selected object
    fetchLookupFields() {
        getLookupFields({ parentObjectName: this.selectedObject, lookupFieldName: this.value  })
            .then(data => {
                this.uniqueIdentifierFieldOptions = data.fieldList.map(field => ({ label: field.label, value: field.apiName, isLookup: field.isLookup }));
                this.lookupObjectName = data.lookUpObjectName;
            })
            .catch(error => {
                console.error('Error fetching fields:', error);
            });
    }

}