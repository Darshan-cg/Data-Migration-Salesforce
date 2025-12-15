import { api, LightningElement, track } from 'lwc';
import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFieldsWithObjectName';


export default class CsvDynamicComponent extends LightningElement {
    @api
    resetAllAdditionalMappings() 
    {
        this.components = [];
    }
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
        const newDropdown = { id: `dropdown-${Date.now()}`, isTextbox: false, isDropdown: true, keyValue:'', csvHeaderValue:'' };
        
        this.components = [...this.components, newDropdown];
    }

    handleCsvHeaderChange(event) {
        let index = event.target.dataset.index;
        if (typeof index === 'string') {
            index = parseInt(index, 10);
        }
        const value = event.detail.value;
        // Save previous keyField before changing
        const previousKeyField = this.components[index].keyValue;
        this.components[index].csvHeaderValue = value;
        this.components[index].keyValue = 'extraMapping' + value + Math.floor(Math.random() * 1000);
        this.components = [...this.components];
        // Dispatch event to parent to remove previous mapping from table
        this.dispatchEvent(new CustomEvent('deletemapping', {
            detail: { keyField: previousKeyField }
        }));
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
    DeleteComponent(event) 
    {
        let index = event.target.dataset.index;
        if (typeof index === 'string') {
            index = parseInt(index, 10);
        }
        const keyField = this.components[index].keyValue;
        this.components.splice(index, 1);
        this.components = [...this.components];
        this.dispatchEvent(new CustomEvent('deletemapping', {
            detail: { keyField }
        }));
    }
}