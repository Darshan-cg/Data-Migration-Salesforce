import { LightningElement, track } from 'lwc';
import uploadToApex from '@salesforce/apex/CSVUploaderController.uploadToApex';
import updateDataFeedJobTrackerStatus from '@salesforce/apex/CSVUploaderController.updateDataFeedJobTrackerStatus';
import getPresignedUrl from '@salesforce/apex/CSVUploaderController.getPresignedUrl';
import invokeProcessDataFeedBatch from '@salesforce/apex/CSVUploaderController.invokeProcessDataFeedBatch';
import getObjects from '@salesforce/apex/CSVDataController.getObjects';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class csvUploader extends LightningElement {
    chunkSize = 200; // Number of rows to send in each chunk
    @track showMappingChoiceModal = false;
    @track csvFileContent = null;
    @track objectOptions = [];
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
 
    fileName = '';
    ObjectIsSelected=false;
    OperationIsSelected=false;
 

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
    // Fetch available objects on component load
    connectedCallback() {
        this.operationOptions = [
            { label: 'Insert', value: 'Insert' },
            { label: 'Update', value: 'Update' }
        ];
        getObjects()
            .then(data => {
                this.objectOptions = data.map(obj => ({ label: obj.label, value: obj.apiName }));
            })
            .catch(error => {
                console.error('Error fetching objects:', error);
            });
    }
 
    handleFileUpload(event) {
        const file = event.target.files[0];
        console.log('File uploaded:', file);
        this.fileName = file.name;
        if (file) {
            const reader = new FileReader();
 
            // Read the file asynchronously
            reader.onload = async () => {
                this.csvFileContent = reader.result;
                const lines = this.csvFileContent.split('\n').filter(line => line.trim() !== ''); // Filter out blank rows
                const headers = lines[0].split(',');// Use proper CSV parsing
                this.headersArray = headers;
                this.totalRecords = lines.length - 1; // Exclude the header row
                console.log('Parsed headers:', this.headersArray);
            };
            reader.readAsText(file);
        }
    }
   
    // Handle object selection
    handleObjectChange(event) {
        this.ObjectIsSelected=true;
        this.selectedObject = event.detail.value;
    }
 
    // Handle operation selection
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
 
    // Handle navigation to next page
    handleNextClick() {
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
 
    // Convert CSV to JSON with validation for missing data
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

    // Process CSV file
    async processCSV() {
        this.showProgressBar = true;
        this.showHeaderBlocks = false;
        if (this.csvFileContent) {
            // console.log('Attempting to upload file to S3:', this.fileName);
            // try {
            //     // Get pre-signed URL from Apex
            //     const presignedUrl = await getPresignedUrl({ fileName: this.fileName });
            //     // Upload file to S3 using fetch
            //     //console.log('Presigned URL:', presignedUrl);
            //     const uploadResponse = await fetch(presignedUrl, {
            //         method: 'PUT',
            //         headers: { 'Content-Type': 'text/csv' },
            //         body: new Blob([this.csvFileContent], { type: 'text/csv' })
            //     });
            //     if (uploadResponse.ok) {
            //         console.log('File sent to S3 successfully:', this.fileName);
            //         uploadSuccess = true;
            //     } else {
            //         console.error('Error uploading file to S3:', uploadResponse.statusText);
            //     }
            // } catch (error) {
            //     console.error('Error uploading file to S3:', error);
            // }
            // if (!uploadSuccess) {
            //     this.showProgressBar = false;
            //     return;
            // }
            const jsonData = this.parseCSV(this.csvFileContent); // Parse CSV to JSON
            if (!jsonData) {
                // Error already shown, stop processing
                console.log('CSV parsing failed. Stopping process.');
                this.showProgressBar = false;
                return;
            }
            try {
                await this.sendDataInChunks(jsonData, this.fileName); // Wait for all chunks to be sent
                // Invoke the ProcessDataFeed batch class
                await this.invokeBatchClass();
            } catch (error) {
                console.error('Error during processing:', error);
            }
        } else {
            console.error('No file uploaded. Please upload a CSV file before clicking Next.');
        }
    }

    previousPage() {
                this.showHeaderBlocks = false;
                this.showImportCard = true;
                this.showProgressBar = false;
                // Optionally reset mapping state if needed
    }

    // Go to Upload Page from Progress Page
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
    }
 
    // parseCSVRow(row, expectedFieldCount) {
    //     const fields = [];
    //     let current = '';
    //     let insideQuotes = false;
 
    //     for (let i = 0; i < row.length; i++) {
    //         const char = row[i];
 
    //         if (char === '"') {
    //             // Toggle quote state
    //             insideQuotes = !insideQuotes;
    //         } else if (char === ',' && !insideQuotes) {
    //             // Comma outside quotes = field separator
    //             fields.push(current.trim());
    //             current = '';
    //         } else {
    //             current += char;
    //         }
    //     }
 
    //     // Add the last field
    //     if (current.length > 0) {
    //         fields.push(current.trim());
    //     }
 
    //     return fields;
    // }

    // Send data to Apex in chunks
    async sendDataInChunks(jsonData, fileName) {
        for (let i = 0; i < jsonData.length; i += this.chunkSize) {
            const chunk = jsonData.slice(i, i + this.chunkSize);
 
            // if(i === 0) {
            //     await updateDataFeedJobTrackerStatus({status:'Ready for Processing', fileName:this.fileName, operationType:this.selectedOperation,targetObject:this.selectedObject});
            // }
 
            // Convert each JSON object in the chunk to a JSON string
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
 