import { LightningElement, api, track } from 'lwc';
import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFieldsWithObjectName';

export default class CsvHeaderDropdown extends LightningElement {
    @api header;
    @api componentName;
    @api options;
    @api lookupFieldList = [];
    @api csvHeaderOptions = [];
    @track isLookupField = false;
    @track uniqueIdentifierFieldOptions = [];
    @track selectedUniqueIdentifierFields = [];
    @api selectedObject;
    value = '';
    @track uniqueIdentifierWhereClause = '';
    @track lookupObjectName = '';
    @track selectedCsvFields = [];
    components = [];
    @track extraCsvFieldList = [];
    @track configuration = {};

    handleChange(event) {
        this.isLookupField = false;
        this.value = event.detail.value;
        this.selectedLookupField = this.lookupFieldList.filter(item2 =>
            item2.isLookup && this.value == item2.apiName
        );

        if(this.selectedLookupField.length > 0) {
            this.isLookupField = true;
            if(this.value == 'Id') {
                this.uniqueIdentifierFieldOptions = this.options;
                this.lookupObjectName = this.selectedObject;
            }
            else{
                this.fetchLookupFields();
            }
        }
        else{
                this.configuration = { csvFieldName: this.header, selectedValue: this.value, isLookup: false, keyField: this.componentName };
                this.sendDataToParent(this.configuration);
            } 
    }

    connectedCallback() {
        this.value = this.header;
        this.configuration = { csvFieldName: this.header, selectedValue: this.value, isLookup: false };
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

    // Handle field selection
    handleUniqueIdentifierFieldChange(event) {
        const selectedLookupMultiSelectValues = event.detail.value;
        const currentLength = selectedLookupMultiSelectValues.length;
        const previousLength = this.selectedUniqueIdentifierFields.length;

        if(currentLength > previousLength && currentLength > 1) {
            this.AddCsvHeaderDropdown(selectedLookupMultiSelectValues);
        }
        else if(currentLength < previousLength) {
            console.log('event.detail.value:', event.detail.value);
            const removedItems = this.selectedUniqueIdentifierFields.filter(item => !selectedLookupMultiSelectValues.includes(item));
            removedItems.forEach(item => {
                this.removeCsvHeaderDropdown(item);
            });            
        }

        this.selectedUniqueIdentifierFields = event.detail.value;
        const selectedfieldAsString = this.selectedUniqueIdentifierFields.join(',');
        this.configuration = { 
            csvFieldName: this.header, 
            selectedValue: this.value, 
            isLookup: this.isLookupField, 
            whereClause: this.uniqueIdentifierWhereClause,
            lookupObjectName: this.lookupObjectName,
            selectedLookupFieldValues: selectedfieldAsString,
            keyField: this.componentName,
         };

         this.sendDataToParent(this.configuration);
    }

    AddCsvHeaderDropdown(selectedLookupMultiSelectValues) {
        const recentItem = selectedLookupMultiSelectValues[selectedLookupMultiSelectValues.length - 1]; // Access the last item
        const recentItemDisplayLabel = this.uniqueIdentifierFieldOptions.find(item => item.value === recentItem)?.label || recentItem;
        const newDropdown = { id: `dropdown-${Date.now()} - ${recentItem}`, label: `${recentItemDisplayLabel}`, placeholder: `Select Csv field for ${recentItemDisplayLabel}` };
        this.components = [...this.components, newDropdown];
    }
    removeCsvHeaderDropdown(removedItem) {        
        const removedItemDisplayLabel = this.uniqueIdentifierFieldOptions.find(item => item.value === removedItem)?.label;
        console.log('Removed item:', removedItemDisplayLabel);
        // Filter out the removed item from the components array
        this.components = this.components.filter(dropdown => dropdown.label !== removedItemDisplayLabel);
    }

    handleAdditionalCsvFieldChange(event) {
        const selectedField = event.detail.value;
        if (!this.extraCsvFieldList.includes(selectedField)) {
            // Push the item if it doesn't exist
            this.extraCsvFieldList.push(selectedField);
        }
        const selectedfieldAsString = this.selectedUniqueIdentifierFields.join(',');
        const selectedExtracCsvFieldAsString = this.extraCsvFieldList.join(',');
        this.configuration = { 
            csvFieldName: this.header, 
            selectedValue: this.value, 
            isLookup: this.isLookupField, 
            whereClause: this.uniqueIdentifierWhereClause,
            lookupObjectName: this.lookupObjectName,
            selectedLookupFieldValues: selectedfieldAsString,
            extraCsvField: selectedExtracCsvFieldAsString,
            keyField: this.componentName,
         }
         this.sendDataToParent(this.configuration);
    }

    sendDataToParent(config) {
        const event = new CustomEvent('handlelookupselection', {
            detail: config
        });
        this.dispatchEvent(event);
    }

    get isMultipleMappingSelected() {
        return this.selectedUniqueIdentifierFields.length > 1;
    }

    get configData() {
        let configDataString = '';
 
        if(!this.configuration.isLookup) {
            configDataString = this.configuration.csvFieldName + '-->' + this.selectedObject + '.' + this.configuration.selectedValue;
        }
        
        if(this.configuration.isLookup) {
            configDataString = this.configuration.csvFieldName + '(lookup) --> ' + this.selectedObject + '.' + this.configuration.selectedValue;
        }
        return configDataString;
    }
}