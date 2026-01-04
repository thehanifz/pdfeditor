import { setCanvasCursor } from '../canvasManager.js';

export function activateImageTool() {
    // Cursor penempatan gambar
    setCanvasCursor('copy'); 
    return 'image_placement';
}

export function handleImagePlace(canvas, imageUrl, x, y) {
    if (!imageUrl) return;

    fabric.Image.fromURL(imageUrl, (img) => {
        img.set({
            left: x,
            top: y,
            originX: 'left',
            originY: 'top',
        });
        
        // Ukuran default
        if (img.width > 200) img.scaleToWidth(200);

        // Kunci Rasio
        img.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false
        });
        img.lockUniScaling = true;

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
    });
}

// Remove Background Putih
export function removeWhitePixels(imgObj) {
    const canvas = document.createElement('canvas');
    canvas.width = imgObj.width;
    canvas.height = imgObj.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgObj, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
        if (r > 210 && g > 210 && b > 210) {
            imgData.data[i+3] = 0;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
}