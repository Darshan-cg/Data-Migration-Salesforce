 import { api, LightningElement, track } from 'lwc';
import getFields from '@salesforce/apex/CSVDataController.getFields';
import getLookupFields from '@salesforce/apex/LookupUtility.getLookupFieldsWithObjectName';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createConfiguration from '@salesforce/apex/CSVConfigurationMapping.createConfiguration';
export default class CsvFieldMapper extends LightningElement {
    // Unique Key Section State
    @track selectedUniqueKeyColumns = [];
    @track createdUniqueKeyColumns = [];
    @track _uniqueKeyCreated = false;
    @track showCompositeMappingUI = false;
    @track uniqueIdentifierWhereClause = '';
    @api selectedObject = 'Opportunity'; // Default selected object
    @api selectedOperation = 'Insert'; // Default operation type
    @api fileName = 'migration.csv'; // Default operation type
    @track fieldOptions = [];
    @track selectedFields = [];
    @track lookupFields = [];
    @track selectedLookupField = '';
    @api csvHeaders = ['Id', 'Name', 'Email', 'Phone', 'Description']; // Example CSV fields
    @track selectedDropdownValues = [];
    @track csvHeaderOptions = []; // For composite mapping checkboxes
    @track uniqueKeyHeaderOptions = []; // For unique key selection checkboxes
    @track compositeHeaderOptions = []; // Separate tracking for composite column headers
    @track createdCompositeMappings = [];
    @track compositeMappingIdCounter = 0;
    @track compositeSections = [];
    @track activeCompositeSection = 0;
    @track configuration = {
        objectName: '',
        operationType: '',
        fileName: this.fileName,
        mapping: []
    };
    @api uniqueKeyType = '';
    
    @api
    resetToHeaders(headers) {
        this.createdCompositeMappings = [];
        this.compositeMappingIdCounter = 0;
        this.compositeSections = [];
        this.compositeHeaderOptions = [];
        this.csvHeaders = headers;
        this.lookupFields = [];
        this.selectedFields = [];
        this.selectedDropdownValues = [];
        this.uniqueIdentifierWhereClause = '';
        this.csvHeaderOptions = this.csvHeaders.map(item => ({
            label: item,
            value: item,
            isSelected: false
            }));
            this.createInitialCsvMapping();
        }
   
        // Descriptive information for UI
    compositeKeyDescription = 'A composite key combines multiple fields to uniquely identify records. For example: Name + Phone creates a unique identifier using both fields together.';
    mappingStepDescription = 'Match each CSV column to the corresponding Salesforce field. For lookup fields, select the fields that will identify related records.';
    
    columns = [
        { label: 'Csv Column', fieldName: 'csvFieldName' },
        { label: 'SF Field', fieldName: 'selectedField' },
        { label: 'Lookup Object', fieldName: 'lookupObjectName' },
        { label: 'Selected Lookup Mapping', fieldName: 'lookupField1' }
    ];
 
    get showUniqueKeySection() {
        return  this.selectedOperation === 'Upsert';
    }
    get showUniqueKeyCombobox() {
        return this.selectedOperation === 'Upsert' && (this.csvHeaderOptions.length > 0 || this.compositeHeaderOptions.length > 0);
    }
    
    // --- Unique Key Section Logic ---
    get uniqueKeyCreated() {
        return this.createdUniqueKeyColumns.length > 0;
    }
 
    get isCreateUniqueKeyDisabled() {
        return !this.selectedUniqueKeyColumns || this.selectedUniqueKeyColumns.length === 0;
    }
    
    // Helper to build dropdown configs for composite columns
    buildCompositeDropdowns(column) {
        if (!column || !column.value || !column.isComposite) return [];
        const parts = column.value.split(',').map(s => s.trim());
        return parts.map(part => ({
            label: part,
            valueProp: 'lookupField_' + part,
            value: column['lookupField_' + part] || '',
            options: column.lookupObjectOptions,
            name: part
        }));
    }
    // Returns array of parts for a composite key (split by ',')
    getCompositeParts(columnValue) {
        if (!columnValue) return [];
        return columnValue.split(',').map(s => s.trim());
    }
    handleUniqueKeyCheckboxChange(event) {
        const value = event.target.dataset.value;
        const checked = event.target.checked;
        if (checked) {
            if (!this.selectedUniqueKeyColumns.includes(value)) {
                this.selectedUniqueKeyColumns = [...this.selectedUniqueKeyColumns, value];
            }
        } else {
            this.selectedUniqueKeyColumns = this.selectedUniqueKeyColumns.filter(col => col !== value);
        }
        // Sync UI for unique key checkboxes only
        this.uniqueKeyHeaderOptions = this.uniqueKeyHeaderOptions.map(opt => ({
            ...opt,
            isSelected: this.selectedUniqueKeyColumns.includes(opt.value)
        }));
        // Update dropdowns for unique key section
        this.updateUniqueKeyDropdowns();
    }
 
    handleCreateUniqueKey() {
        if (this.selectedUniqueKeyColumns.length === 0) {
            this.showToast('Error', 'Select at least one column.', 'error');
            return;
        }
        this.createdUniqueKeyColumns = [...this.selectedUniqueKeyColumns];
        this._uniqueKeyCreated = true;
        this.showToast('Success', 'Unique key defined.', 'success');
    }
 
    handleRemoveUniqueKey() {
        this.createdUniqueKeyColumns = [];
        this.selectedUniqueKeyColumns = [];
        this._uniqueKeyCreated = false;
        this.uniqueKeyHeaderOptions = this.uniqueKeyHeaderOptions.map(opt => ({
            ...opt,
            isSelected: false
        }));
    }
 
    // --- For Unique Key Section Dropdowns ---
    @track selectedCsvColumns = [];
    @track selectedSfFields = [];
    @track sfFieldOptions = [];
 
    // Sync selectedCsvColumns and sfFieldOptions when unique key columns change
    getSelectedKeyColumns() {
        // Use selectedUniqueKeyColumns for unique key section
        return this.selectedUniqueKeyColumns && this.selectedUniqueKeyColumns.length > 0
            ? this.selectedUniqueKeyColumns
            : this.csvHeaders;
    }
 
    // Called in connectedCallback and when unique key changes
    updateUniqueKeyDropdowns() {
        this.selectedCsvColumns = this.getSelectedKeyColumns();
        // Ensure selectedSfFields has same length
        if (!this.selectedSfFields || this.selectedSfFields.length !== this.selectedCsvColumns.length) {
            this.selectedSfFields = Array(this.selectedCsvColumns.length).fill('');
        }
        // Use fieldOptions for dropdown options
        this.sfFieldOptions = this.fieldOptions;
    }
 
    // Handler for dropdown change in unique key section
    handleSfFieldChange(event) {
        const idx = event.target.dataset.index;
        const value = event.detail.value;
        if (idx !== undefined) {
            this.selectedSfFields[idx] = value;
        }
    }
 
    connectedCallback() {
        // Initialize any data or state here if needed
        this.createInitialCsvMapping();  
        // Initialize composite mapping options from csvHeaders
        this.csvHeaderOptions = this.csvHeaders.map(item => ({
            label: item,
            value: item,
            isSelected: false
        }));
        this.uniqueKeyHeaderOptions = this.csvHeaders.map(item => ({
            label: item,
            value: item,
            isSelected: false
        }));
        // Get lookup fields for the selected object
        getFields({ objectName: this.selectedObject }).then(data => {
            this.fieldsWithLookupList = data.filter(field => field.isLookup).map(field => ({ label: field.label, apiName: field.apiName, isLookup: field.isLookup }));
            this.fieldOptions = data.map(field => ({ label: field.label, value: field.apiName }));    
            // Update dropdowns for unique key section
            this.updateUniqueKeyDropdowns();
        });
        // Initial update for unique key section
        this.updateUniqueKeyDropdowns();
    }
   
    handleShowCompositeMappingUI() {
        // Only add a new section if there are no sections, or the last one is mapped
        if (
            this.compositeSections.length === 0 ||
            this.compositeSections[this.compositeSections.length - 1].isMapped
        ) {
            this.compositeSections.push({
                id: this.compositeSections.length,
                selectedColumns: [],
                isMapped: false,
                isButtonDisabled: false,
                // For composite columns, add static property names for dropdowns
                name1: 'composite1',
                name2: 'composite2',
                lookupField1: '',
                lookupField2: '',
            });
        } else {
            this.showToast('Error', 'Please complete the current composite mapping before adding a new one.', 'error');
        }
    }
   
    handleFieldChange(event) {
        let keyField;
        let selectedValue;
        let isLookup = false;
 
        // Case A: structured child event
        // if (event && event.detail && event.detail.keyField) {
        //     const fieldDetails = event.detail;
        //     console.log('Received structured field change event:', fieldDetails);
        //     keyField = fieldDetails.keyField;
        //     console.log('keyField:', keyField);
        //     selectedValue = fieldDetails.selectedValue || fieldDetails.value || '';
        //     console.log('selectedValue:', selectedValue);
        //     isLookup = !!fieldDetails.isLookup;
        //     console.log('isLookup:', isLookup);
 
        //     const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
        //     if (index !== -1) {
        //         if (isLookup) {
        //             this.selectedDropdownValues[index] = { ...this.selectedDropdownValues[index],
        //                 selectedField: selectedValue,
        //                 lookupObject: fieldDetails.lookupObjectName || '',
        //                 whereClause: fieldDetails.whereClause || '',
        //                 isLookup: true,
        //                 selectedLookupFields: fieldDetails.selectedLookupFieldValues || [],
        //                 extraCsvField: fieldDetails.extraCsvField || ''
        //             };
        //         } else {
        //             this.selectedDropdownValues[index] = { ...this.selectedDropdownValues[index],
        //                 selectedField: selectedValue,
        //                 isLookup: false,
        //                 lookupObject: "",
        //                 whereClause: "",
        //                 selectedLookupFields: [],
        //                 extraCsvField: ""
        //             };
        //         }
        //     }
        //     return;
        // }
 
        // if (event && event.detail && event.detail.value && event.target && event.target.name) {
        //     keyField = event.target.name;
        //     selectedValue = event.detail.value;
        //     // determine if value is a lookup field
        //     isLookup = !!(this.fieldsWithLookupList && this.fieldsWithLookupList.some(f => f.apiName === selectedValue));
        //     const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
        //     if (index !== -1) {
        //         this.selectedDropdownValues[index] = {
        //             ...this.selectedDropdownValues[index],
        //             selectedField: selectedValue,
        //             isLookup: isLookup,
        //             lookupObject: isLookup ? (this.selectedDropdownValues[index].lookupObject || '') : '',
        //             selectedLookupFields: isLookup ? (this.selectedDropdownValues[index].selectedLookupFields || []) : [],
        //             extraCsvField: isLookup ? (this.selectedDropdownValues[index].extraCsvField || '') : ''
        //         };
        //     }
        //     return;
        // }
        // Case B: simple event from dropdown
        console.log('Received simple field change event:', event.detail, event.target);
        if (event && event.target && event.target.name) {
 
            keyField = event.target.name;
            selectedValue = event.target.value;
            const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
 
                if (index !== -1) {
 
                isLookup = !!(this.fieldsWithLookupList && this.fieldsWithLookupList.some(f => f.apiName === selectedValue));
                console.log("whereClause"+this.uniqueIdentifierWhereClause);
                this.selectedDropdownValues[index] = {
                    ...this.selectedDropdownValues[index],
                    selectedField: selectedValue,
                    isLookup: isLookup,
                    whereClause: this.uniqueIdentifierWhereClause || '',
                    selectedLookupFields: isLookup ? (this.selectedDropdownValues[index].selectedLookupFields || []) : [],
                };
               
                if(selectedValue === 'Id') {
                    // For Id field, set lookup object to selected object
                    this.selectedDropdownValues[index] = {
                        ...this.selectedDropdownValues[index],
                        lookupObjectApiName: this.selectedObject,
                        lookupObjectName: this.selectedObject,
                        lookupObjectOptions: this.fieldOptions,
                    };
                    this.selectedDropdownValues = [...this.selectedDropdownValues];
                    console.log('Set lookup object to selected object for Id field:', this.selectedObject);
                }
                else if (isLookup ) {
                    // Get the lookup field details
                    const lookupFieldObj = this.fieldsWithLookupList.find(f => f.apiName === selectedValue);
                   
                    if (lookupFieldObj) {
                        // Fetch the lookup fields and object information
                        getLookupFields({ parentObjectName: this.selectedObject, lookupFieldName: selectedValue })
                        .then(data => {
                            const lookupFieldOptions = data.fieldList.map(field => ({ label: field.label, value: field.apiName, isLookup: field.isLookup }));
                            console.log('Fetched lookup fields for', selectedValue, ':', lookupFieldOptions);
                            console.log('Lookup Object Name:', data.lookUpObjectName);
                           
                            // Get fields of the lookup object to populate lookup object options
                            return getFields({ objectName: data.lookUpObjectName }).then(lookupObjFields => {
                                const lookupObjFieldOptions = lookupObjFields.map(field => ({
                                    label: field.label,
                                    value: field.apiName
                                }));
                               
                                // Convert API name to display name (e.g., "OperatingHour" -> "Operating Hour")
                                const displayName = this.convertApiNameToDisplayName(data.lookUpObjectName);
                               
                                this.selectedDropdownValues[index] = {
                                    ...this.selectedDropdownValues[index],
                                    lookupObjectOptions: lookupObjFieldOptions,
                                    lookupObjectApiName: data.lookUpObjectName,
                                    lookupObjectName: displayName,
                                };
                                // force reactive update
                                this.selectedDropdownValues = [...this.selectedDropdownValues];
                                console.log('Updated lookup object:', displayName);
                                console.log('Updated lookup object options:', lookupObjFieldOptions);
                            });
                        })
                        .catch(error => {
                            console.error('Error fetching lookup object fields:', error);
                        });
                    }
                } else {
                    // clear any lookup-specific options when not a lookup
                    this.selectedDropdownValues[index] = {
                        ...this.selectedDropdownValues[index],
                        lookupObjectOptions: [],
                        lookupObjectApiName: '',
                        lookupObjectName: '',
                        whereClause: '',
                    };
                    this.selectedDropdownValues = [...this.selectedDropdownValues];
                }
            }
        }
    }
 
    handleLookupObjectChange(event) {
        const keyField = event.target.name;
        const value = event.detail && event.detail.value ? event.detail.value : event.target.value;
        const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
        if (index !== -1) {
            this.selectedDropdownValues[index] = {
                ...this.selectedDropdownValues[index],
                lookupObjectApiName: value,
                lookupObjectName: this.convertApiNameToDisplayName(value) || value
            };
            this.selectedDropdownValues = [...this.selectedDropdownValues];
        }
    }
 
    handleLookupFieldSelection(event) {
        const partName = event.target.name; // Composite part name or field name
        const keyField = event.target.dataset.keyfield || event.target.name; // Get from data attribute or name
        const value = event.detail.value; // Selected value from combobox
       
        console.log('handleLookupFieldSelection - partName:', partName, 'keyField:', keyField, 'value:', value);
       
        // Find the selectedDropdownValues entry
        const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
        console.log('Found index:', index, 'Total items:', this.selectedDropdownValues.length);
       
        if (index !== -1) {
            const currentItem = this.selectedDropdownValues[index];
            console.log('Current item isComposite:', currentItem.isComposite, 'value contains comma:', currentItem.value && currentItem.value.includes(','));
           
            // Check if this is a composite field (has multiple parts)
            if (currentItem.isComposite && currentItem.value && currentItem.value.includes(',')) {
                // Store value with dynamic property name for each composite part
                const propName = 'lookupField_' + partName;
                this.selectedDropdownValues[index] = {
                    ...this.selectedDropdownValues[index],
                    [propName]: value
                };
                console.log('Updated composite field:', propName, '=', value);
            } else {
                // For non-composite lookups, store in lookupField1
                this.selectedDropdownValues[index] = {
                    ...this.selectedDropdownValues[index],
                    lookupField1: value,
                    selectedLookupFields: value
                };
                console.log('Updated non-composite lookupField1:', value);
            }
            this.selectedDropdownValues = [...this.selectedDropdownValues];
            console.log('Updated item:', this.selectedDropdownValues[index]);
        } else {
            console.log('WARNING: Could not find item with keyField:', keyField);
            console.log('Available keyFields:', this.selectedDropdownValues.map(item => item.keyField));
        }
    }
 
    handleWhereClauseChange(event) {
        const keyField = event.target.name;
        const value = event.target.value;
        const index = this.selectedDropdownValues.findIndex(obj => obj.keyField === keyField);
        if (index !== -1) {
            this.selectedDropdownValues[index] = {
                ...this.selectedDropdownValues[index],
                whereClause: value
            };
            this.selectedDropdownValues = [...this.selectedDropdownValues];
        }
    }
 
    // Helper method to convert API name to display name
    // Example: "OperatingHour" -> "Operating Hour", "Account" -> "Account"
    convertApiNameToDisplayName(apiName) {
        if (!apiName) return '';
        // Insert space before uppercase letters (except the first one)
        return apiName.replace(/([A-Z])/g, ' $1').trim();
    }
 
    // Getter function to retrieve selected value for a specific header
    getSelectedValue(header) {
        return this.selectedValues[header] || '';
    }
   
        handleDeleteCompositeSection(event) {
        const sectionId = parseInt(event.currentTarget.dataset.sectionid, 10);
        // Remove the section
        this.compositeSections = this.compositeSections.filter(sec => sec.id !== sectionId);
        // Remove the mapping and composite header if it was mapped
        const mapping = this.createdCompositeMappings.find(m => m.id === sectionId);
        if (mapping) {
            const compositeKey = mapping.compositeKey;
            const uniqueKeyField = `${compositeKey}__COMPOSITE_${sectionId}`;
            this.selectedDropdownValues = this.selectedDropdownValues.filter(row => row.keyField !== uniqueKeyField);
            this.compositeHeaderOptions = this.compositeHeaderOptions.filter(opt => opt.value !== uniqueKeyField);
            this.csvHeaders = this.csvHeaders.filter(h => h !== compositeKey);
            this.createdCompositeMappings = this.createdCompositeMappings.filter(m => m.id !== sectionId);
        }
            // Re-index section ids to be sequential
            this.compositeSections = this.compositeSections.map((sec, idx) => ({ ...sec, id: idx }));
    }
    createMapping() {
        this.configuration.objectName = this.selectedObject;
        this.configuration.operationType = this.selectedOperation;
        // Only send fields expected by Apex
        this.configuration.mapping = this.selectedDropdownValues.map(item => {
            let selectedLookupFields = '';
            let lookupObjectName = '';
            if (item.isComposite && item.value && item.value.includes(',')) {
                const parts = item.value.split(',').map(s => s.trim());
                const lookupValues = parts
                    .map(part => {
                        const val = item['lookupField_' + part];
                        return val ? String(val).toLowerCase() : null;
                    })
                    .filter(val => val !== null && val !== undefined && val.trim && val.trim() !== '');
                if (lookupValues.length > 0) {
                    selectedLookupFields = lookupValues.join(',');
                }
                lookupObjectName = item.lookupObjectApiName || '';
            } else if (item.isLookup && item.lookupField1) {
                // For non-composite lookups
                selectedLookupFields = String(item.lookupField1).toLowerCase();
                lookupObjectName = item.lookupObjectApiName || '';
            }
            return {
                csvFieldName: item.csvFieldName,
                selectedField: item.selectedField,
                isLookup: item.isLookup,
                selectedLookupFields: selectedLookupFields,
                lookupObject: lookupObjectName,
                whereClause: item.whereClause || '',
                isUniqueKey: item.isUniqueKey || false
            };
        });
        this.configuration.fileName = this.fileName;
        console.log('Creating mapping with configuration:', JSON.stringify(this.configuration));
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
                  keyField: this.csvHeaders[i],
                  lookupObjectName: '',
                  lookupObjectApiName: '',
                  whereClause: '',
                  lookupObjectOptions: [],
                  lookupField1: ''
                 });
        }
    }
    handleDeleteMapping(event)
    {
        const keyField = event.detail.keyField;
        this.selectedDropdownValues = this.selectedDropdownValues.filter(
        mapping => mapping.keyField !== keyField
    );
    }
   
    get tableData(){
        return this.selectedDropdownValues.map(item => {
            let lookupMapping = '';
           
            // For composite mappings, collect all lookupField_* values
            if (item.isComposite && item.value) {
                // Split the composite key to get all parts
                const parts = item.value.split(',').map(s => s.trim());
                // Collect all lookupField_* values for these parts
                const lookupValues = parts
                    .map(part => {
                        const fieldValue = item['lookupField_' + part];
                        return fieldValue ? fieldValue : null;
                    })
                    .filter(val => val !== null && val !== undefined && val.trim && val.trim() !== '');
               
                if (lookupValues.length > 0) {
                    lookupMapping = lookupValues.join(',').toLowerCase();
                }
            } else if (item.isLookup && item.lookupField1) {
                // For non-composite lookups, just display the lookupField1 value
                lookupMapping = item.lookupField1.toLowerCase();
            }
           
            return {
                ...item,
                lookupField1: lookupMapping
            };
        });
    }
 
    // Composite Mapping Handlers
    handleColumnCheckboxChange(event) {
        const sectionId = parseInt(event.target.dataset.sectionid, 10);
        const columnValue = event.target.dataset.column;
        const isChecked = event.target.checked;
        const sectionIdx = this.compositeSections.findIndex(sec => sec.id === sectionId);
        if (sectionIdx === -1) return;
        let section = this.compositeSections[sectionIdx];
        if (isChecked) {
            if (!section.selectedColumns.includes(columnValue)) {
                section.selectedColumns = [...section.selectedColumns, columnValue];
            }
        } else {
            section.selectedColumns = section.selectedColumns.filter(col => col !== columnValue);
        }
        // Update the section in the array
        this.compositeSections = [
            ...this.compositeSections.slice(0, sectionIdx),
            { ...section },
            ...this.compositeSections.slice(sectionIdx + 1)
        ];
    }
 
    handleRemoveSelectedColumn(event) {
        const sectionId = parseInt(event.currentTarget.dataset.sectionid, 10);
        const columnValue = event.currentTarget.dataset.column;
        const sectionIdx = this.compositeSections.findIndex(sec => sec.id === sectionId);
        if (sectionIdx === -1) return;
        let section = this.compositeSections[sectionIdx];
        section.selectedColumns = section.selectedColumns.filter(col => col !== columnValue);
        this.compositeSections = [
            ...this.compositeSections.slice(0, sectionIdx),
            { ...section },
            ...this.compositeSections.slice(sectionIdx + 1)
        ];
    }
 
    handleCreateCompositeMapping(event) {
        const sectionId = parseInt(event.currentTarget.dataset.sectionid, 10);
        const sectionIdx = this.compositeSections.findIndex(sec => sec.id === sectionId);
        if (sectionIdx === -1) return;
        let section = this.compositeSections[sectionIdx];
        // Prevent duplicate mapping creation for this section
        if (section.isMapped || section.isButtonDisabled) {
            return;
        }
        if (section.selectedColumns.length > 1) {
            const compositeKey = section.selectedColumns.join(',');
            const existingCount = this.csvHeaders.filter(h => h === compositeKey).length;
            const occurrence = existingCount + 1;
                // Use sectionIdx as mapping id for consistency after re-indexing
                const mappingId = sectionIdx;
            const newMapping = {
                id: mappingId,
                compositeKey: compositeKey,
                occurrence: occurrence,
            };
            this.createdCompositeMappings = [...this.createdCompositeMappings, newMapping];
            this.csvHeaders = [...this.csvHeaders, compositeKey];
            const uniqueKeyField = `${compositeKey}__COMPOSITE_${mappingId}`;
            this.compositeHeaderOptions = [
                ...this.compositeHeaderOptions,
                { label: compositeKey, value: uniqueKeyField, isSelected: false, isComposite: true }
            ];
            this.selectedDropdownValues = [...this.selectedDropdownValues, {
                csvFieldName: compositeKey,
                selectedField: compositeKey,
                isLookup: false,
                keyField: uniqueKeyField,
                value: compositeKey, // Store the composite key value for splitting in allHeaderOptions
                lookupObjectName: '',
                lookupObjectApiName: '',
                whereClause: '',
                lookupObjectOptions: [],
                lookupField1: '',
                selectedLookupFields: '',
                extraCsvField: '',
                isComposite: true
            }];
            // Mark this section as mapped and disable button only for this section
            section.isMapped = true;
            section.isButtonDisabled = true;
            this.compositeSections = [
                ...this.compositeSections.slice(0, sectionIdx),
                { ...section },
                ...this.compositeSections.slice(sectionIdx + 1)
            ];
        } else {
            this.showToast('Error', 'Please select at least two columns to create a composite mapping.', 'error');
        }
    }
 
    handleDeleteCompositeMapping(event) {
        const mappingId = parseInt(event.currentTarget.dataset.id, 10);
        const mapping = this.createdCompositeMappings.find(m => m.id === mappingId);
       
        if (mapping) {
            const compositeKey = mapping.compositeKey;
            const uniqueKeyField = `${compositeKey}__COMPOSITE_${mappingId}`;
 
            const rowIndexToRemove = this.selectedDropdownValues.findIndex(
                row => row.keyField === uniqueKeyField
            );
            if (rowIndexToRemove !== -1) {
                this.csvHeaders.splice(rowIndexToRemove, 1);
            }
 
            this.selectedDropdownValues = this.selectedDropdownValues.filter(
                row => row.keyField !== uniqueKeyField
            );
 
            this.compositeHeaderOptions = this.compositeHeaderOptions.filter(opt => opt.value !== uniqueKeyField);
        }
       
        this.createdCompositeMappings = this.createdCompositeMappings.filter(
            mapping => mapping.id !== mappingId
        );
        console.log('Mapping deleted, remaining:', this.createdCompositeMappings);
        console.log('Updated csvHeaders:', this.csvHeaders);
    }
 
    get hasCompositeMappings() {
        return this.createdCompositeMappings && this.createdCompositeMappings.length > 0;
    }
 
    // Get all header options for rendering (original + composite columns)
    get allHeaderOptions() {
        console.log('=== allHeaderOptions getter called ===');
        const base = [...this.csvHeaderOptions, ...this.compositeHeaderOptions];
        // Merge in mapping state for each header so template can show lookup sub-fields
        return base.map(col => {
            const sd = this.selectedDropdownValues.find(s => s.keyField === col.value);
            let compositeDropdowns = [];
           
            // Use sd.value if composite, otherwise use col.value
            const keyToSplit = sd && sd.value ? sd.value : col.value;
            if (col.isComposite && keyToSplit) {
                const parts = keyToSplit.split(',').map(s => s.trim());
                compositeDropdowns = parts.map(part => {
                    const propName = 'lookupField_' + part;
                    console.log("wsf",part,propName, sd ? sd[propName] : '' , sd && sd.lookupObjectOptions ? sd.lookupObjectOptions : []);
                    return {
                        label: part,
                        value: sd && sd[propName] ? sd[propName] : '',
                        options: sd && sd.lookupObjectOptions ? sd.lookupObjectOptions : [],
                        name: part,
                        compositeLabel: 'Field: ' + part + ' - Corresponding SF Field'
                    };
                }
            );
            }
            return {
                ...col,
                mappedField: sd ? sd.selectedField : '',
                isLookupSelected: sd ? !!sd.isLookup : false,
                lookupObjectName: sd ? sd.lookupObjectName : '',
                lookupObjectApiName: sd ? sd.lookupObjectApiName : '',
                lookupObjectOptions: sd ? (sd.lookupObjectOptions || []) : [],
                lookupField1: sd ? sd.lookupField1 : '',
                whereClause: sd ? sd.whereClause : '',
                compositeDropdowns
            };
        });
    }
 
    // Options for lookup object combobox (derived from lookup fields list)
    get lookupObjectOptions() {
        if (!this.fieldsWithLookupList) return [];
        return this.fieldsWithLookupList.map(f => ({ label: f.label, value: f.apiName }));
    }
 
    // Options for CSV header selection used in extra CSV comboboxes
    get csvHeaderComboboxOptions() {
        return this.csvHeaders.map(h => ({ label: h, value: h }));
    }
 
    // Separate getters for each section to avoid shared state
    get uniqueKeyColumnsForCheckbox() {
        return this.uniqueKeyHeaderOptions;
    }
    get compositeColumnsForCheckbox() {
        return this.csvHeaderOptions;
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
 