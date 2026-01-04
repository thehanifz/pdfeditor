const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Tuning kalibrasi posisi Y
const FONT_Y_CORRECTION = 0.78; 

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
};

module.exports = {
    savePdf: async (req, res) => {
        try {
            const { filename, actions } = req.body;
            const filePath = path.join(__dirname, '../uploads', filename);
            
            if (!fs.existsSync(filePath)) throw new Error("File PDF asli hilang.");
            
            const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath));
            const pages = pdfDoc.getPages();

            // 1. EMBED SEMUA VARIASI FONT STANDAR
            const fontKit = {
                // Helvetica (Sans Serif)
                'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
                'HelveticaBold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
                'HelveticaItalic': await pdfDoc.embedFont(StandardFonts.HelveticaOblique), // Map Oblique ke Italic key
                'HelveticaBoldItalic': await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
                
                // Times New Roman (Serif)
                'Times': await pdfDoc.embedFont(StandardFonts.TimesRoman),
                'TimesBold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
                'TimesItalic': await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
                'TimesBoldItalic': await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
                
                // Courier (Monospace)
                'Courier': await pdfDoc.embedFont(StandardFonts.Courier),
                'CourierBold': await pdfDoc.embedFont(StandardFonts.CourierBold),
                'CourierItalic': await pdfDoc.embedFont(StandardFonts.CourierOblique),
                'CourierBoldItalic': await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
            };

            for (const action of actions) {
                if (action.pageIndex >= pages.length) continue;
                const page = pages[action.pageIndex];
                const { height } = page.getSize();

                if (action.type === 'text') {
                    // 2. LOGIKA PEMILIHAN FONT (EXPLICIT MAPPING)
                    let familyPrefix = 'Helvetica';
                    if (action.fontFamily.includes('Times')) familyPrefix = 'Times';
                    else if (action.fontFamily.includes('Courier')) familyPrefix = 'Courier';

                    // Tentukan Suffix berdasarkan kombinasi boolean
                    let styleSuffix = '';
                    if (action.isBold && action.isItalic) {
                        styleSuffix = 'BoldItalic';
                    } else if (action.isBold) {
                        styleSuffix = 'Bold';
                    } else if (action.isItalic) {
                        styleSuffix = 'Italic';
                    }

                    // Gabungkan Prefix + Suffix (Contoh: "Times" + "BoldItalic")
                    const fontKey = familyPrefix + styleSuffix;
                    const selectedFont = fontKit[fontKey] || fontKit['Helvetica'];

                    const color = hexToRgb(action.fill || '#000000');
                    const textY = height - action.y - (action.fontSize * FONT_Y_CORRECTION);
                    
                    // Render Text
                    page.drawText(action.text, {
                        x: action.x,
                        y: textY,
                        size: action.fontSize,
                        font: selectedFont,
                        color: rgb(color.r, color.g, color.b),
                        maxWidth: action.width, 
                        lineHeight: action.fontSize * 1.15
                    });
                    
                    // Render Coretan (Strikethrough) Manual
                    if (action.isStrikethrough) {
                        const textWidth = selectedFont.widthOfTextAtSize(action.text, action.fontSize);
                        page.drawRectangle({
                            x: action.x,
                            y: textY + (action.fontSize / 3.5),
                            width: textWidth,
                            height: action.fontSize / 15,
                            color: rgb(color.r, color.g, color.b),
                        });
                    }

                } else if (action.type === 'whiteout') {
                    page.drawRectangle({
                        x: action.x, y: height - action.y - action.height,
                        width: action.width, height: action.height, color: rgb(1,1,1)
                    });
                } else if (action.type === 'image' && action.dataUrl) {
                    const imgBytes = Buffer.from(action.dataUrl.split(',')[1], 'base64');
                    const img = action.dataUrl.startsWith('data:image/png') ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
                    page.drawImage(img, {
                        x: action.x, y: height - action.y - action.height,
                        width: action.width, height: action.height
                    });
                }
            }

            const outputName = `Edited-${Date.now()}.pdf`;
            fs.writeFileSync(path.join(__dirname, '../public', outputName), await pdfDoc.save());
            res.json({ url: `/${outputName}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
};