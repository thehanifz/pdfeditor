const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Setup Folder
const dirs = ['uploads', 'public', 'sign'];
const initFolders = () => {
    dirs.forEach(d => {
        const p = path.join(__dirname, '../', d);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    });
};

// Config Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // PERBAIKAN: Cek berdasarkan nama field input
        if (file.fieldname === 'signature') {
            cb(null, 'sign/');
        } else {
            cb(null, 'uploads/');
        }
    },
    filename: (req, file, cb) => {
        // Timestamp + Nama Asli (Sanitized)
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ storage: storage });

module.exports = {
    initFolders,
    // Middleware khusus PDF
    uploadPdf: (req, res) => {
        const handler = upload.single('pdf');
        handler(req, res, (err) => {
            if (err || !req.file) return res.status(400).json({ error: 'Upload PDF gagal' });
            res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
        });
    },
    // Middleware khusus Signature
    uploadSignature: (req, res) => {
        const handler = upload.single('signature');
        handler(req, res, (err) => {
            if (err || !req.file) return res.status(400).json({ error: 'Upload Tanda Tangan gagal' });
            res.json({ filename: req.file.filename, url: `/sign/${req.file.filename}` });
        });
    },
    getListSignatures: (req, res) => {
        const signDir = path.join(__dirname, '../sign');
        if (!fs.existsSync(signDir)) return res.json([]);
        // Filter hanya file gambar
        const files = fs.readdirSync(signDir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        res.json(files.map(f => `/sign/${f}`));
    }
};