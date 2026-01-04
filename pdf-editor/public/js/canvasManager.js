export const state = {
    canvases: {},
    pdfDoc: null,
    scale: 1.5,
    activeTool: null,
    tempImage: null,
    isDrawing: false,
    activePage: 1
};

export function setCanvasCursor(cursorType) {
    Object.values(state.canvases).forEach(canvas => {
        canvas.defaultCursor = cursorType;
        canvas.hoverCursor = cursorType;
        canvas.requestRenderAll();
    });
}

export function setupFabricForPage(pageIndex, canvasElement, width, height) {
    if (state.canvases[pageIndex]) state.canvases[pageIndex].dispose();

    const canvas = new fabric.Canvas(canvasElement, { 
        width, height, uniformScaling: false 
    });

    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: '#ffffff',
        cornerStrokeColor: '#2563eb',
        borderColor: '#2563eb',
        cornerSize: 8,
        padding: 2, 
        cornerStyle: 'circle',
        hasMiddleMarkers: true,
        hasBorders: true
    });

    // --- POSISI & INDIKATOR TOOLBAR (FINAL UI FIX) ---
    const updateToolbarPosition = () => {
        const obj = canvas.getActiveObject();
        const toolbar = document.getElementById('text-toolbar');
        
        if (obj && obj.type === 'textbox') {
            toolbar.classList.remove('hidden');
            
            // 1. Sync Text Values
            document.getElementById('font-family').value = obj.fontFamily;
            document.getElementById('text-color').value = obj.fill;
            const realFontSize = Math.round(obj.fontSize / state.scale);
            document.getElementById('font-size-val').innerText = realFontSize;
            
            // 2. DETEKSI STYLE (Termasuk Coretan)
            const isBold = (String(obj.fontWeight).toLowerCase() === 'bold' || parseInt(obj.fontWeight) >= 700);
            const isItalic = (String(obj.fontStyle).toLowerCase() === 'italic');
            const isStrike = (obj.linethrough === true); // Cek properti linethrough
            
            // 3. UPDATE WARNA TOMBOL
            const activeClass = "bg-blue-600 text-white shadow-inner";
            const inactiveClass = "hover:bg-slate-100 text-slate-700";

            document.getElementById('btn-bold').className = `w-7 h-7 rounded font-bold transition ${isBold ? activeClass : inactiveClass}`;
            document.getElementById('btn-italic').className = `w-7 h-7 rounded italic font-serif transition ${isItalic ? activeClass : inactiveClass}`;
            // Tombol Strike jadi Biru jika isStrike true
            document.getElementById('btn-strike').className = `w-7 h-7 rounded line-through transition ${isStrike ? activeClass : inactiveClass}`;

            // 4. POSISI FIXED
            const canvasRect = canvas.getElement().getBoundingClientRect();
            const bound = obj.getBoundingRect(); 
            
            let topPos = canvasRect.top + bound.top - 60; 
            let leftPos = canvasRect.left + bound.left;

            if (topPos < 10) topPos = canvasRect.top + bound.top + bound.height + 10;

            toolbar.style.top = `${topPos}px`;
            toolbar.style.left = `${leftPos}px`;
            
        } else {
            toolbar.classList.add('hidden');
        }
    };

    canvas.on('selection:created', updateToolbarPosition);
    canvas.on('selection:updated', updateToolbarPosition);
    canvas.on('object:modified', updateToolbarPosition); 
    canvas.on('object:moving', updateToolbarPosition); 
    canvas.on('object:scaling', updateToolbarPosition);
    
    canvas.on('selection:cleared', () => document.getElementById('text-toolbar').classList.add('hidden'));
    
    window.addEventListener('scroll', () => {
        if(!document.getElementById('text-toolbar').classList.contains('hidden')) updateToolbarPosition();
    }, true);
    window.addEventListener('wheel', () => {
        if(!document.getElementById('text-toolbar').classList.contains('hidden')) updateToolbarPosition();
    }, { capture: true, passive: false });

    canvas.on('mouse:down', (opt) => {
        state.activePage = pageIndex;
        handleMouseDown(canvas, opt);
    });
    canvas.on('mouse:move', (opt) => handleMouseMove(canvas, opt));
    canvas.on('mouse:up', (opt) => handleMouseUp(canvas, opt));

    state.canvases[pageIndex] = canvas;
    return canvas;
}

import { handleTextClick } from './tools/textTool.js';
import { handleWhiteoutDown, handleWhiteoutMove, handleWhiteoutUp } from './tools/whiteoutTool.js';
import { handleImagePlace } from './tools/imageSignTool.js';

function handleMouseDown(canvas, opt) {
    if (!state.activeTool) return;
    const pointer = canvas.getPointer(opt.e);

    if (state.activeTool === 'text') {
        handleTextClick(canvas, pointer.x, pointer.y);
        state.activeTool = null;
        setCanvasCursor('default');
    } else if (state.activeTool === 'whiteout') {
        state.isDrawing = true;
        handleWhiteoutDown(canvas, pointer);
    } else if (state.activeTool === 'image_placement') {
        handleImagePlace(canvas, state.tempImage, pointer.x, pointer.y);
        state.activeTool = null;
        state.tempImage = null;
        setCanvasCursor('default');
    }
}

function handleMouseMove(canvas, opt) {
    if (state.activeTool === 'whiteout' && state.isDrawing) {
        handleWhiteoutMove(canvas, opt);
    }
}

function handleMouseUp(canvas, opt) {
    if (state.activeTool === 'whiteout' && state.isDrawing) {
        handleWhiteoutUp(canvas);
        state.isDrawing = false;
        state.activeTool = null;
        setCanvasCursor('default');
    }
}