const express = require('express');
const multer = require('multer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { cleanupUploads } = require('./cleanup');

const app = express();

// 1. SETUP FOLDER (Pastikan folder ada)
const uploadDir = path.join(__dirname, 'uploads');
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

// 2. CONFIG UPLOAD
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Check if it's for signature or pdf upload
        if(req.url.includes('/sign')) {
            cb(null, 'sign/');
        } else {
            cb(null, 'uploads/');
        }
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname) // Hapus spasi aneh
});
const upload = multer({ storage: storage });

// SIGNATURE UPLOAD ENDPOINT
app.post('/upload-sign', upload.single('signature'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No signature uploaded' });
    console.log("Signature uploaded:", req.file.filename);
    res.json({
        filename: req.file.filename,
        url: `/sign/${req.file.filename}`
    });
});

// GET SAVED SIGNATURES
app.get('/signatures', (req, res) => {
    const signDir = path.join(__dirname, 'sign');
    if (!fs.existsSync(signDir)) {
        return res.json([]);
    }

    const files = fs.readdirSync(signDir);
    const signatureList = files.map(file => ({
        filename: file,
        url: `/sign/${file}`
    }));

    res.json(signatureList);
});

// DELETE SAVED SIGNATURE
app.delete('/sign/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'sign', filename);

    // Security check: prevent path traversal
    if (!filePath.startsWith(path.join(__dirname, 'sign'))) {
        return res.status(400).json({ error: 'Invalid file path' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error("Delete Signature Error:", err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`Deleted signature: ${filename}`);
            res.json({ message: 'Signature deleted successfully' });
        }
    });
});

// 3. MIDDLEWARE PENTING
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public')); // Untuk file index.html dkk
app.use('/uploads', express.static('uploads')); // AGAR PDF BISA DIBACA BROWSER
app.use('/sign', express.static('sign')); // AGAR SIGNATURE BISA DIAKSES

// Helper Warna
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

// Routes
app.post('/upload', upload.single('pdf'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    console.log("File uploaded:", req.file.filename);
    // Kembalikan URL lengkap agar frontend mudah membacanya
    res.json({ 
        filename: req.file.filename,
        url: `/uploads/${req.file.filename}` 
    });
});

app.post('/save', async (req, res) => {
    try {
        console.log("Processing Save...");
        const { filename, actions } = req.body;
        const inputPath = path.join(__dirname, 'uploads', filename);
        
        if (!fs.existsSync(inputPath)) throw new Error("File PDF asli hilang dari server");

        const pdfBytes = fs.readFileSync(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Load semua font standard
        const fonts = {
            Helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
            HelveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
            HelveticaOblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
            HelveticaBoldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
            Times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
            Courier: await pdfDoc.embedFont(StandardFonts.Courier),
        };

        const pages = pdfDoc.getPages();

        for (const action of actions) {
            const pageIndex = action.pageIndex || 0;
            if (pageIndex >= pages.length) continue;

            const page = pages[pageIndex];
            const { height } = page.getSize();

            if (action.type === 'text') {
                let fontToUse = fonts.Helvetica;
                if(action.fontFamily === 'Times') fontToUse = fonts.Times;
                if(action.fontFamily === 'Courier') fontToUse = fonts.Courier;
                if(action.fontFamily === 'Helvetica' && action.isBold) fontToUse = fonts.HelveticaBold;
                if(action.fontFamily === 'Helvetica' && action.isItalic) fontToUse = fonts.HelveticaOblique;
                if(action.fontFamily === 'Helvetica' && action.isBold && action.isItalic) fontToUse = fonts.HelveticaBoldOblique;

                const color = hexToRgb(action.fill || '#000000');

                // Calculate text Y position similar to whiteout but accounting for text baseline
                // The action.y from client represents the Y coordinate in canvas system
                const textY = height - action.y - (action.fontSize * 0.8); // Adjust for text baseline

                page.drawText(action.text, {
                    x: action.x,
                    y: textY,
                    size: action.fontSize,
                    font: fontToUse,
                    color: rgb(color.r, color.g, color.b),
                });
            }
            else if (action.type === 'whiteout') {
                // For whiteout, calculate proper Y position: height - top_position - height_of_element
                const whiteoutY = height - action.y - action.height;
                page.drawRectangle({
                    x: action.x, y: whiteoutY,
                    width: action.width, height: action.height,
                    color: rgb(1, 1, 1),
                });
            }
            else if (action.type === 'image' && action.dataUrl) {
                // Process the image data URL to embed in PDF
                try {
                    // Calculate proper Y position for images (signatures)
                    const imageY = height - action.y - action.height;
                    if (action.dataUrl.startsWith('data:image/png')) {
                        const pngImage = await pdfDoc.embedPng(action.dataUrl);
                        page.drawImage(pngImage, {
                            x: action.x, y: imageY,
                            width: action.width, height: action.height,
                        });
                    } else if (action.dataUrl.startsWith('data:image/jpeg') || action.dataUrl.startsWith('data:image/jpg')) {
                        const jpegImage = await pdfDoc.embedJpg(action.dataUrl);
                        page.drawImage(jpegImage, {
                            x: action.x, y: imageY,
                            width: action.width, height: action.height,
                        });
                    } else {
                        console.error("Unsupported image format:", action.dataUrl.substring(0, 30) + "...");
                    }
                } catch (err) {
                    console.error("Error embedding image:", err);
                    // Continue processing other actions even if image fails
                }
            }
        }

        const pdfData = await pdfDoc.save();
        const outputName = `Edited_${Date.now()}.pdf`;
        fs.writeFileSync(path.join(__dirname, 'public', outputName), pdfData);
        
        res.json({ url: outputName });
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Endpoint to delete edited PDF files after download
app.delete('/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public', filename);

    // Security check: prevent path traversal
    if (!filePath.startsWith(path.join(__dirname, 'public'))) {
        return res.status(400).json({ error: 'Invalid file path' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error("Delete Error:", err);
            res.status(500).json({ error: err.message });
        } else {
            console.log(`Deleted file: ${filename}`);
            res.json({ message: 'File deleted successfully' });
        }
    });
});

// Schedule cleanup at 00:00 WIB daily (07:00 UTC)
// Using node-cron: 0 7 * * * means "at 07:00 every day"
cron.schedule('0 7 * * *', () => {
    console.log('Running scheduled cleanup at 00:00 WIB (07:00 UTC)');
    cleanupUploads();
}, {
    timezone: "UTC"  // This ensures the schedule runs correctly
});

app.listen(3000, () => console.log('Server running on port 3000'));