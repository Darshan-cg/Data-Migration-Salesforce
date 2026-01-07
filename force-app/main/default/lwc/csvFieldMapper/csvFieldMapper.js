import { api, LightningElement, track } from 'lwc';
import getFields from '@salesforce/apex/CSVDataController.getFields';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createConfiguration from '@salesforce/apex/CSVConfigurationMapping.createConfiguration';
export default class CsvFieldMapper extends LightningElement {
    // Unique Key Section State
    @track selectedUniqueKeyColumns = [];
    @track createdUniqueKeyColumns = [];
    @track _uniqueKeyCreated = false;
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
    @track selectedColumns = [];
    @track createdCompositeMappings = [];
    @track compositeMappingIdCounter = 0;
    @track configuration = {
        objectName: '',
        operationType: '',
        fileName: this.fileName,
        mapping: []
    };
    @api uniqueKeyType = '';


    
    // Descriptive information for UI
    compositeKeyDescription = 'A composite key combines multiple fields to uniquely identify records. For example: Name + Phone creates a unique identifier using both fields together.';
    mappingStepDescription = 'Match each CSV column to the corresponding Salesforce field. For lookup fields, select the fields that will identify related records.';
    
    columns = [
        { label: 'Csv Column', fieldName: 'csvFieldName' },
        { label: 'SF Field', fieldName: 'selectedField' },
        { label: 'Lookup Object', fieldName: 'lookupObject' },
        { label: 'Selected Lookup Mapping', fieldName: 'selectedLookupFields' }
    ];

    get showUniqueKeySection() {
    return this.selectedOperation === 'Update' || this.selectedOperation === 'Upsert';
}
    get showUniqueKeyCombobox() {
        // Show if Update and there are any columns (single or composite) to choose from
        return this.selectedOperation === 'Update' && (this.csvHeaderOptions.length > 0 || this.compositeHeaderOptions.length > 0);
    }


    // --- Unique Key Section Logic ---
    get uniqueKeyCreated() {
        return this.createdUniqueKeyColumns.length > 0;
    }

    get isCreateUniqueKeyDisabled() {
        return !this.selectedUniqueKeyColumns || this.selectedUniqueKeyColumns.length === 0;
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

    connectedCallback() {
        // Initialize any data or state here if needed
        this.createInitialCsvMapping();
        // Separate header options for unique key and composite mapping
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
        });
    }

    

    handleFieldChange(event) {
        const fieldDetails = event.detail;
        console.log('Event.isAdditionalFieldMapping:', event.detail.isAdditionalFieldMapping);
        console.log('fieldDetails.keyField:', fieldDetails.keyField);

        // Exact match on keyField (child now sends the unique key for composites)
        let index = this.selectedDropdownValues.findIndex(obj => obj.keyField === fieldDetails.keyField);
        
        console.log('Index found:', index);
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
                    isLookup: fieldDetails.isLookup,
                    lookupObject: "",
                    whereClause: "",
                    selectedLookupFields: "",
                    extraCsvField: ""
                };
            }
        }        
        else if(event.detail.isAdditionalFieldMapping) {
            console.log('keyField:', fieldDetails.keyField);
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
                    fileName: this.fileName,
                    selectedField: fieldDetails.selectedValue, 
                    isLookup: fieldDetails.isLookup,
                    csvFieldName: fieldDetails.csvFieldName,
                    keyField: fieldDetails.keyField,
                    whereClause: "",
                    selectedLookupFields: "",
                    extraCsvField: "",
                    lookupObject: "",
                });
            }
        }
    }

    // Getter function to retrieve selected value for a specific header
    getSelectedValue(header) {
        return this.selectedValues[header] || '';
    }

   createMapping() {
    // Validation: Don't allow save if Update is selected but no key is defined
    if (this.selectedOperation === 'Update' && !this.uniqueKeyCreated) {
        this.showToast('Error', 'Unique Key is required for Update.', 'error');
        return;
    }

    const finalConfig = {
        objectName: this.selectedObject,
        operationType: this.selectedOperation,
        fileName: this.fileName,
        mapping: this.selectedDropdownValues,
        uniqueKeyColumns: this.createdUniqueKeyColumns // Added this line
    };

    createConfiguration({ wrapper: finalConfig })
        .then(() => this.showToast('Success', 'Mapping Saved!', 'success'))
        .catch(error => console.error(error));
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
    handleDeleteMapping(event)
    {
        const keyField = event.detail.keyField;
        this.selectedDropdownValues = this.selectedDropdownValues.filter(
        mapping => mapping.keyField !== keyField
    );
    }
    handleResetMapping()
    {
        this.lookupFields = [];
        this.selectedFields = [];
        this.selectedDropdownValues = [];
        this.createInitialCsvMapping();
        const dropdowns = this.template.querySelectorAll('c-csv-header-dropdown');
            dropdowns.forEach(dropdown => {
            dropdown.resetDropdown();
        });
        const dynamicComponent = this.template.querySelector('c-csv-dynamic-component');
        if (dynamicComponent) 
        {
            dynamicComponent.resetAllAdditionalMappings();
        }
    }
    get tableData(){
        return this.selectedDropdownValues.map(item => item);
    }

    // Composite Mapping Handlers
    handleColumnCheckboxChange(event) {
        const columnValue = event.target.dataset.column;
        const isChecked = event.target.checked;
        const columnOption = this.csvHeaderOptions.find(col => col.value === columnValue);
        if (columnOption) {
            columnOption.isSelected = isChecked;
        }

        if (this.uniqueKeyType === 'single') {
            // Only allow one selection
            if (isChecked) {
                // Uncheck all others
                this.csvHeaderOptions.forEach(col => {
                    if (col.value !== columnValue) {
                        col.isSelected = false;
                    }
                });
                this.selectedColumns = [columnValue];
            } else {
                this.selectedColumns = [];
            }
        } else {
            // Composite: allow multiple
            if (isChecked) {
                if (!this.selectedColumns.includes(columnValue)) {
                    this.selectedColumns = [...this.selectedColumns, columnValue];
                }
            } else {
                this.selectedColumns = this.selectedColumns.filter(col => col !== columnValue);
            }
        }
        //console.log('Selected columns:', this.selectedColumns);
    }

    handleRemoveSelectedColumn(event) {
        const columnValue = event.currentTarget.dataset.column;
        
        this.selectedColumns = this.selectedColumns.filter(col => col !== columnValue);

        const columnOption = this.csvHeaderOptions.find(col => col.value === columnValue);
        if (columnOption) {
            columnOption.isSelected = false;
        }

        console.log('Column removed:', columnValue);
    }

    handleCreateCompositeMapping() {
        if (this.uniqueKeyType === 'single') {
            if (this.selectedColumns.length !== 1) {
                this.showToast('Error', 'Please select exactly one column for a single column unique key.', 'error');
                return;
            }
            // For single, treat as a composite with one column for consistency
            const singleKey = this.selectedColumns[0];
            // Remove previous single key mapping if any
            this.selectedDropdownValues = this.selectedDropdownValues.filter(row => row.keyField !== singleKey);
            this.selectedDropdownValues = [...this.selectedDropdownValues, {
                csvFieldName: singleKey,
                selectedField: singleKey,
                isLookup: false,
                keyField: singleKey,
                lookupObject: '',
                whereClause: '',
                selectedLookupFields: '',
                extraCsvField: ''
            }];
            this.showToast('Success', 'Single column unique key selected.', 'success');
            // Optionally, you can lock further changes or proceed to next step
        } else {
            if (this.selectedColumns.length < 2) {
                this.showToast('Error', 'Please select at least two columns to create a composite mapping.', 'error');
                return;
            }
            const compositeKey = this.selectedColumns.join(',');
            // Determine occurrence number for this compositeKey (handles duplicates)
            const existingCount = this.csvHeaders.filter(h => h === compositeKey).length;
            const occurrence = existingCount + 1; // 1-based

            const mappingId = this.compositeMappingIdCounter++;
            const newMapping = {
                id: mappingId,
                compositeKey: compositeKey,
                occurrence: occurrence
            };

            this.createdCompositeMappings = [...this.createdCompositeMappings, newMapping];

            // Add composite mapping to csvHeaders
            this.csvHeaders = [...this.csvHeaders, compositeKey];

            // Create unique keyField: combine compositeKey with mapping ID to distinguish identical composites
            const uniqueKeyField = `${compositeKey}__COMPOSITE_${mappingId}`;

            // Add to compositeHeaderOptions (separate from original csvHeaderOptions) for rendering
            this.compositeHeaderOptions = [
                ...this.compositeHeaderOptions,
                { label: compositeKey, value: uniqueKeyField, isSelected: false }
            ];

            // Add composite mapping to table data (selectedDropdownValues)
            this.selectedDropdownValues = [...this.selectedDropdownValues, {
                csvFieldName: compositeKey,
                selectedField: compositeKey,
                isLookup: false,
                keyField: uniqueKeyField,
                lookupObject: '',
                whereClause: '',
                selectedLookupFields: '',
                extraCsvField: ''
            }];
            
            // Reset selected columns
            this.selectedColumns = [];
            this.csvHeaderOptions.forEach(col => {
                col.isSelected = false;
            });

            this.showToast('Success', 'Composite unique key created.', 'success');
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

    get hasSelectedColumns() {
        return this.selectedColumns && this.selectedColumns.length > 0;
    }

    get hasCompositeMappings() {
        return this.createdCompositeMappings && this.createdCompositeMappings.length > 0;
    }

    get isCreateMappingDisabled() {
        return !this.selectedColumns || this.selectedColumns.length === 0;
    }

    // Get all header options for rendering (original + composite columns)
    get allHeaderOptions() {
        return [...this.csvHeaderOptions, ...this.compositeHeaderOptions];
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