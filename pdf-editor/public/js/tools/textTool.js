import { setCanvasCursor, state } from '../canvasManager.js';

export function activateTextTool() {
    setCanvasCursor('text');
    return 'text';
}

export function handleTextClick(canvas, x, y) {
    // VISUAL: Kalikan dengan scale agar terlihat proporsional di layar
    const baseFontSize = 16; 
    const visualFontSize = baseFontSize * state.scale;
    
    const baseWidth = 150;
    const visualWidth = baseWidth * state.scale;

    const text = new fabric.Textbox('Ketik disini', {
        left: x,
        top: y,
        width: visualWidth,
        fontSize: visualFontSize, // Visual di Canvas (Pixel)
        fontFamily: 'Helvetica',
        fontWeight: 'normal',  // Explicitly set default
        fontStyle: 'normal',   // Explicitly set default
        fill: '#000000',
        linethrough: false,    // Explicitly set default
        originX: 'left',
        originY: 'top',
        padding: 5,
        splitByGrapheme: true,
        lockScalingY: true,
        lockScalingFlip: true,
        transparentCorners: false,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#2563eb',
        borderColor: '#2563eb',
        cornerSize: 8,
        cornerStyle: 'circle'
    });

    // Kontrol hanya lebar (kiri-kanan)
    text.setControlsVisibility({
        mt: false, mb: false, 
        ml: true, mr: true, 
        bl: false, br: false, tl: false, tr: false, 
        mtr: false 
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
}

export function updateActiveText(canvas, prop, value) {
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'textbox') {
        obj.set(prop, value);
        canvas.renderAll();
    }
}

export function toggleTextStyle(canvas, style) {
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== 'textbox') return;

    if (style === 'bold') obj.set('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
    else if (style === 'italic') obj.set('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
    else if (style === 'linethrough') obj.set('linethrough', !obj.linethrough);
    
    canvas.renderAll();
    return obj;
}

// FUNGSI UBAH UKURAN (Logic Scale)
export function changeActiveFontSize(canvas, delta) {
    const obj = canvas.getActiveObject();
    if (obj && obj.type === 'textbox') {
        // 1. Hitung perubahan pixel berdasarkan zoom saat ini
        const pixelDelta = delta * state.scale; 
        
        // 2. Terapkan ke objek
        let newPixelSize = obj.fontSize + pixelDelta;
        
        // Batas min visual (8px * scale)
        const minPixelSize = 8 * state.scale;
        if (newPixelSize < minPixelSize) newPixelSize = minPixelSize;
        
        obj.set('fontSize', newPixelSize);
        canvas.renderAll();
        
        // 3. PENTING: Kembalikan nilai "Real" (Ukuran Asli Dokumen) ke UI
        // Contoh: Zoom 2x, Pixel 32px -> Return 16.
        return Math.round(newPixelSize / state.scale);
    }
    return null;
}