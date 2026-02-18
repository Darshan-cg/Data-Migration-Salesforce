import { LightningElement, track } from 'lwc';
import uploadToApex from '@salesforce/apex/CSVUploaderController.uploadToApex';
import updateDataFeedJobTrackerStatus from '@salesforce/apex/CSVUploaderController.updateDataFeedJobTrackerStatus';
import getObjects from '@salesforce/apex/CSVDataController.getObjects';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPresignedUrl from '@salesforce/apex/CSVUploaderController.getPresignedUrl';

export default class csvUploader extends LightningElement {
    chunkSize = 200; 
    @track showMappingChoiceModal = false;
    @track csvFileContent = null;
    @track objectOptions = [];
    @track filteredObjectOptions = [];
    @track objectSearchTerm = '';
    objectInputHasFocus = false;
    @track operationOptions = [];
    @track selectedOperation = '';
    @track selectedObject = '';
    @track headersArray = [];
    @track showImportCard = true;
    @track showHeaderBlocks = false;
    @track showProgressBar=false;
    @track totalRecords=0;
    @track progressValue=0;
    @track processedRecords = 0;
    @track message;
    @track showObjectRecommendations = false;
    
    
    @track selectedUniqueKey = '';
 
    fileName = '';
    ObjectIsSelected=false;
    OperationIsSelected=false;
   
    get showUniqueKeyCombobox() {
        return this.selectedOperation === 'Update' && this.headersArray && this.headersArray.length > 0;
    }
 
    get uniqueKeyColumnOptions() {
        return (this.headersArray || []).map(h => ({ label: h, value: h }));
    }
 
    handleUniqueKeyChange(event) {
        this.selectedUniqueKey = event.detail.value;
    }
   
     get currentStep() {
         if (this.showImportCard) {
             return '1';
        } else if (this.showHeaderBlocks) {
            return '2';
        } else if (this.showProgressBar) {
            return '3';
        }
        return '1';
    }
    

    connectedCallback() {
        this.operationOptions = [
            { label: 'Insert', value: 'Insert' },
            { label: 'Update', value: 'Update' },
            { label: 'Upsert', value: 'Upsert' }
        ];
        getObjects()
            .then(data => {
                console.log('Objects loaded:', data);
                this.objectOptions = data.map(obj => ({ label: obj.label, value: obj.apiName }));
                this.filteredObjectOptions = this.objectOptions;
                console.log('objectOptions after map:', this.objectOptions);
            })
            .catch(error => {
                console.error('Error fetching objects:', error);
            });
    }

    handleObjectSearch(event) {
        const inputValue = event.target.value || '';
        const searchTerm = inputValue.toLowerCase().trim();
        
        this.objectSearchTerm = inputValue;
        console.log('Search term:', searchTerm, 'objectOptions length:', this.objectOptions.length);
        
        if (!searchTerm) {
            this.filteredObjectOptions = [];
            this.showObjectRecommendations = false;
            console.log('Empty search - hiding dropdown');
        } else {
            // Filter objects that contain the search term (case-insensitive)
            const filtered = this.objectOptions.filter(opt => 
                opt.label.toLowerCase().includes(searchTerm)
            );
            console.log('Filtered count:', filtered.length);
            this.filteredObjectOptions = [...filtered];
            // Always show recommendations dropdown when typing
            this.showObjectRecommendations = true;
            console.log('showObjectRecommendations SET TO TRUE');
        }
    }

    handleObjectRecommendationClick(event) {
        const value = event.currentTarget.dataset.value;
        const label = event.currentTarget.dataset.label;
        this.selectedObject = value;
        this.ObjectIsSelected = true;
        this.objectSearchTerm = label;
        this.showObjectRecommendations = false;
    }
 
    handleFileUpload(event) {
        const file = event.target.files[0];
        console.log('File uploaded:', file);
        let name = file.name;
        let ext = '';
        if (name.includes('.')) {
            ext = name.substring(name.lastIndexOf('.'));
            name = name.substring(0, name.lastIndexOf('.'));
        }
        name = name.replace(/_/g, '');
        this.fileName = name + ext;
        if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
                this.csvFileContent = reader.result;
                const lines = this.csvFileContent.split('\n').filter(line => line.trim() !== ''); // Filter out blank rows
                let headers = lines[0].split(',');
                headers = headers.map(h => h.trim().replace(/\r|\n/g, ''));
                this.headersArray = headers;
                this.totalRecords = lines.length - 1; 
                console.log('Parsed headers:', this.headersArray);
            };
            reader.readAsText(file);
        }
    }
   
    handleObjectChange(event) {
        this.ObjectIsSelected=true;
        this.selectedObject = event.detail.value;
    }
        handleResetAll() {
        const mapper = this.template.querySelector('c-csv-field-mapper');
        if (mapper) {
            mapper.resetToHeaders(this.headersArray);
        }
    }
 
    handleOperationChange(event) {
        this.OperationIsSelected=true;
        this.selectedOperation = event.detail.value;
        if(this.selectedOperation === 'Insert')
            {
                this.message='The CSV Data has been read successfully, you will receive an Email notification once the Data is inserted.';
            }
            else
            {
                this.message='The CSV Data has been read successfully, you will receive an Email notification once the Data is updated.';
 
            }
    }
 
    get showNextButton() {
        return (
            this.ObjectIsSelected &&
            this.OperationIsSelected &&
            this.fileName && this.fileName.length > 0
        );
    }
 
    handleNextClick() {
        this.showImportCard = false;
        this.showHeaderBlocks = false;
        this.showMappingChoiceModal = true;
    }
 
    handleUniqueKeyTypeSelect(event) {
        this.uniqueKeyType = event.target.value;
    }
 
    handleUniqueKeyTypeNext() {
        if (!this.uniqueKeyType) {
            return;
        }
        this.showUniqueKeyTypeModal = false;
        this.showImportCard = false;
        this.showHeaderBlocks = false;
        this.showMappingChoiceModal = true;
    }
 
    handleCreateNewMapping() {
        this.showMappingChoiceModal = false;
        this.showHeaderBlocks = true;
        this.showProgressBar = false;
    }
 
    handleUseExistingMapping() {
        this.showMappingChoiceModal = false;
        this.showHeaderBlocks = false;
        this.showProgressBar = true;
        this.processCSV();
    }
 
    parseCSV(csv) {
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        this.headersArray = headers;
        const jsonData = [];
 
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length === headers.length) {
                const jsonLine = {};
                headers.forEach((header, index) => {
                    jsonLine[header.trim()] = values[index].trim();
                });
                jsonData.push(jsonLine);
            }
        }
        return jsonData;
    }
 
    async processCSV() {
        this.showProgressBar = true;
        this.showHeaderBlocks = false;
        if (this.csvFileContent) {
            let name = this.fileName;
            let ext = '';
            if (name.includes('.')) {
                ext = name.substring(name.lastIndexOf('.'));
                name = name.substring(0, name.lastIndexOf('.'));
            }
            name = name.replace(/_/g, '');
            this.fileName = name + ext;
            console.log('File name:', this.fileName);
            console.log('Attempting to upload file to S3:', this.fileName);
            let uploadSuccess = false;
            try {
                console.log('Selected Operation:', this.selectedOperation);
                console.log('Selected Object:', this.selectedObject);
                this.fileName = this.fileName + '_' + this.selectedOperation + '_' + this.selectedObject;
                console.log('Updated Name', this.fileName);
                const presignedUrl = await getPresignedUrl({ fileName: this.fileName });
                console.log('Presigned URL:', presignedUrl);
                const uploadResponse = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'text/csv' },
                    body: new Blob([this.csvFileContent], { type: 'text/csv' })
                });
                if (uploadResponse.ok) {
                    console.log('File sent to S3 successfully:', this.fileName);
                    uploadSuccess = true;
                } else {
                    console.error('Error uploading file to S3:', uploadResponse.statusText);
                }
            } catch (error) {
                console.error('Error uploading file to S3:', error);
            }
            if (!uploadSuccess) {
                this.showProgressBar = false;
                return;
            }
        //       const jsonData = this.parseCSV(this.csvFileContent); // Parse CSV to JSON
        //     if (!jsonData) {
        //         // Error already shown, stop processing
        //         console.log('CSV parsing failed. Stopping process.');
        //         this.showProgressBar = false;
        //         return;
        //     }
        //     try {
        //         await this.sendDataInChunks(jsonData, this.fileName); // Wait for all chunks to be sent
        //         // Invoke the ProcessDataFeed batch class
        //         await this.invokeBatchClass();
        //     } catch (error) {
        //         console.error('Error during processing:', error);
        //     }
        // } else {
        //     console.error('No file uploaded. Please upload a CSV file before clicking Next.');
        // }
        }
    }
 
    previousPage() {
        this.showHeaderBlocks = false;
        this.showImportCard = true;
        this.showProgressBar = false;
    }
 
    goToUploadPage() {
        this.showProgressBar = false;
        this.showImportCard = true;
        this.showHeaderBlocks = false;
        this.progressValue = 0;
        this.processedRecords = 0;
        this.fileName = '';
        this.csvFileContent = null;
        this.headersArray = [];
        this.selectedObject = '';
        this.selectedOperation = '';
        this.ObjectIsSelected = false;
        this.OperationIsSelected = false;
        this.selectedUniqueKey = '';
        this.objectSearchTerm = '';
    }
 
    async sendDataInChunks(jsonData, fileName) {
        for (let i = 0; i < jsonData.length; i += this.chunkSize) {
            const chunk = jsonData.slice(i, i + this.chunkSize);
            
            const jsonStringList = chunk.map(record => JSON.stringify(record));
            console.log('json:',jsonStringList);
            try {
                // Send the chunk to Apex
                await uploadToApex({ jsonDataList: jsonStringList, fileName: fileName });
                this.processedRecords += chunk.length; // Update processed records
                this.progressValue = Math.floor((this.processedRecords / this.totalRecords) * 100); // Update progress bar
            } catch (error) {
                console.error('Error sending data to Apex:', error);
            }
        }
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message:this.message,
                variant: 'success',
            })
        );
        console.log('All data sent successfully!');
    }
 
    async invokeBatchClass() {
        try {
           
            // Call an Apex method to invoke the batch class
            //await invokeProcessDataFeedBatch({fileName: this.fileName, operationType: this.selectedOperation, targetObject: this.selectedObject}); // Replace with the actual Apex method to invoke the batch
            await updateDataFeedJobTrackerStatus({status:'Upload Complete', fileName:this.fileName, operationType:this.selectedOperation,targetObject:this.selectedObject});
        } catch (error) {
            console.error('Error invoking batch class:', error);
            throw error;
        }
    }
 
    get showImportCard() {
        return !this.showHeaderBlocks && !this.showProgressBar;
    }
}
