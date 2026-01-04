import { setCanvasCursor } from '../canvasManager.js';

let isDragging = false;
let rect = null;
let origX = 0;
let origY = 0;

export function activateWhiteoutTool() {
    setCanvasCursor('crosshair');
    return 'whiteout';
}

export function handleWhiteoutDown(canvas, pointer) {
    isDragging = true;
    origX = pointer.x;
    origY = pointer.y;

    rect = new fabric.Rect({
        left: origX,
        top: origY,
        originX: 'left',
        originY: 'top',
        width: 0,
        height: 0,
        fill: 'white',
        stroke: '#cbd5e1', 
        strokeWidth: 1, 
        selectable: false,
        evented: false,
        transparentCorners: false,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#2563eb',
        borderColor: '#2563eb',
        cornerSize: 8,
        padding: 5,
        cornerStyle: 'circle'
    });

    canvas.add(rect);
}

export function handleWhiteoutMove(canvas, opt) {
    if (!isDragging || !rect) return;
    const pointer = canvas.getPointer(opt.e);
    
    // Logika Drag Bebas (Kiri/Kanan/Atas/Bawah)
    const startX = Math.min(origX, pointer.x);
    const startY = Math.min(origY, pointer.y);
    const w = Math.abs(origX - pointer.x);
    const h = Math.abs(origY - pointer.y);

    rect.set({ left: startX, top: startY, width: w, height: h });
    canvas.renderAll();
}

export function handleWhiteoutUp(canvas) {
    if (!isDragging || !rect) return;
    isDragging = false;
    
    rect.set({ 
        strokeWidth: 0, // Hilangkan border setelah jadi
        selectable: true, 
        evented: true,
        lockRotation: true,
    });

    rect.setCoords(); 

    // Kontrol hanya di pojok (Sesuai request Anda sebelumnya)
    rect.setControlsVisibility({
        mt: false, mb: false, ml: false, mr: false, 
        bl: true, br: true, tl: true, tr: true, 
        mtr: false 
    });

    canvas.setActiveObject(rect);
    canvas.renderAll();
    rect = null;
}