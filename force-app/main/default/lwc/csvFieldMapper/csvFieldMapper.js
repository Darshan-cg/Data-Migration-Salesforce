import { api, LightningElement, track } from 'lwc';
import getFields from '@salesforce/apex/CSVDataController.getFields';
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
    @track csvHeaderOptions = [];
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
    
    columns = [
        { label: 'Csv Column', fieldName: 'csvFieldName' },
        { label: 'SF Field', fieldName: 'selectedField' },
        { label: 'Lookup Object', fieldName: 'lookupObject' },
        { label: 'Selected Lookup Mapping', fieldName: 'selectedLookupFields' }
    ];

    connectedCallback() {
        // Initialize any data or state here if needed
        this.createInitialCsvMapping();  
        // Initialize composite mapping options from csvHeaders
        this.csvHeaderOptions = this.csvHeaders.map(item => ({ 
            label: item, 
            value: item,
            isSelected: false 
        }));
        // Get lookup fields for the selected object
        getFields({objectName: this.selectedObject}).then(data => {
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

        if (isChecked) {
            if (!this.selectedColumns.includes(columnValue)) {
                this.selectedColumns = [...this.selectedColumns, columnValue];
            }
        } else {
            this.selectedColumns = this.selectedColumns.filter(col => col !== columnValue);
        }

        console.log('Selected columns:', this.selectedColumns);
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
        if (this.selectedColumns.length > 1) {
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

            console.log('Composite mapping created:', newMapping);
            console.log('All mappings:', this.createdCompositeMappings);
            console.log('Updated csvHeaders:', this.csvHeaders);
        }
        else{
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

    // Show only original columns for checkbox selection (not composites)
    get availableColumnsForComposite() {
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