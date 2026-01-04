const express = require('express');
const path = require('path');
const fileController = require('./backend/fileController');
const pdfController = require('./backend/pdfController');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/sign', express.static('sign'));

// Setup Routes
app.post('/upload', fileController.uploadPdf);
app.post('/upload-sign', fileController.uploadSignature);
app.get('/signatures', fileController.getListSignatures);
app.post('/save', pdfController.savePdf);

// Init Folders
fileController.initFolders();

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));