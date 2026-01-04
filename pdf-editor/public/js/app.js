import { state, setupFabricForPage } from './canvasManager.js';
import { activateTextTool, updateActiveText, toggleTextStyle, changeActiveFontSize } from './tools/textTool.js';
import { activateWhiteoutTool } from './tools/whiteoutTool.js';
import { activateImageTool, removeWhitePixels } from './tools/imageSignTool.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentFilename = '';
let savedEdits = {}; 

// --- GLOBAL UI FUNCTIONS ---
window.updateTextProp = (prop, val) => {
    if (state.canvases[state.activePage]) {
        updateActiveText(state.canvases[state.activePage], prop, val);
        state.canvases[state.activePage].fire('selection:updated'); 
    }
};
window.changeFontSize = (delta) => {
    if (state.canvases[state.activePage]) {
        const newSize = changeActiveFontSize(state.canvases[state.activePage], delta);
        if(newSize) document.getElementById('font-size-val').innerText = newSize;
        state.canvases[state.activePage].fire('selection:updated');
    }
};
window.toggleBold = () => {
    if(state.canvases[state.activePage]) {
        toggleTextStyle(state.canvases[state.activePage], 'bold');
        state.canvases[state.activePage].fire('selection:updated');
    }
};
window.toggleItalic = () => {
    if(state.canvases[state.activePage]) {
        toggleTextStyle(state.canvases[state.activePage], 'italic');
        state.canvases[state.activePage].fire('selection:updated');
    }
};
// Trigger UI Update setelah klik tombol Strikethrough
window.toggleLinethrough = () => {
    if(state.canvases[state.activePage]) {
        toggleTextStyle(state.canvases[state.activePage], 'linethrough');
        state.canvases[state.activePage].fire('selection:updated'); // PENTING: Agar tombol jadi biru
    }
};

// --- UPLOAD ---
document.getElementById('pdf-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    const formData = new FormData();
    formData.append('pdf', file);
    
    savedEdits = {};
    state.canvases = {};
    state.scale = 1.5; 
    updateZoomDisplay();

    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    currentFilename = data.filename;

    const pdfDoc = await pdfjsLib.getDocument(data.url).promise;
    state.pdfDoc = pdfDoc;
    
    document.getElementById('zoom-controls').classList.remove('hidden');
    await renderAllPages();
});

// --- RENDER ---
async function renderAllPages() {
    const container = document.getElementById('pages-container');
    
    Object.keys(state.canvases).forEach(pgIndex => {
        const canvas = state.canvases[pgIndex];
        savedEdits[pgIndex] = {
            json: canvas.toJSON(['id', 'selectable', 'lockScalingY', 'lockScalingFlip', 'splitByGrapheme', 'linethrough', 'fontWeight', 'fontStyle', 'fill', 'fontFamily', 'fontSize', 'textAlign', 'textDecoration', 'backgroundColor', 'stroke', 'strokeWidth']),
            width: canvas.width
        };
    });

    container.innerHTML = '';
    state.canvases = {}; 

    for (let i = 1; i <= state.pdfDoc.numPages; i++) {
        await renderOnePage(i, container);
    }
}

async function renderOnePage(num, container) {
    const page = await state.pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: state.scale });

    const wrapper = document.createElement('div');
    wrapper.className = 'relative bg-white page-container mb-8'; 
    wrapper.style.width = viewport.width + 'px';
    wrapper.style.height = viewport.height + 'px';

    const pdfCanvas = document.createElement('canvas');
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfCanvas.className = 'absolute top-0 left-0 z-0 pointer-events-none';
    
    const fabricCanvasEl = document.createElement('canvas');
    fabricCanvasEl.className = 'absolute top-0 left-0 z-10';
    
    wrapper.appendChild(pdfCanvas);
    wrapper.appendChild(fabricCanvasEl);
    container.appendChild(wrapper);

    const ctx = pdfCanvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const fCanvas = setupFabricForPage(num, fabricCanvasEl, viewport.width, viewport.height);

    if (savedEdits[num]) {
        const savedData = savedEdits[num];
        const ratio = viewport.width / savedData.width;

        fCanvas.loadFromJSON(savedData.json, () => {
            fCanvas.getObjects().forEach(obj => {
                obj.left *= ratio;
                obj.top *= ratio;
                obj.width *= ratio; 
                obj.scaleX = 1;     
                obj.scaleY = 1;
                obj.fontSize *= ratio; 
                obj.setCoords();
            });
            fCanvas.renderAll();
        });
    }
}

// --- ZOOM ---
window.zoomIn = async () => { state.scale += 0.25; await renderAllPages(); updateZoomDisplay(); };
window.zoomOut = async () => { if(state.scale > 0.5) { state.scale -= 0.25; await renderAllPages(); updateZoomDisplay(); }};
function updateZoomDisplay() { document.getElementById('zoom-level').innerText = `${Math.round((state.scale / 1.5) * 100)}%`; }

let zoomTimeout;
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const step = 0.1;
        let newScale = state.scale + (e.deltaY < 0 ? step : -step);
        if (newScale < 0.5) newScale = 0.5;
        if (newScale > 3.0) newScale = 3.0;
        if (newScale !== state.scale) {
            state.scale = newScale;
            updateZoomDisplay();
            const btnSave = document.getElementById('btn-save');
            if (btnSave) btnSave.innerText = "⏳ Rendering...";
            clearTimeout(zoomTimeout);
            zoomTimeout = setTimeout(async () => {
                await renderAllPages();
                if (btnSave) btnSave.innerHTML = "<span>💾</span> Simpan PDF";
            }, 200); 
        }
    }
}, { passive: false });

// --- SAVE PDF (Kirim Boolean Style yang Benar) ---
window.savePDF = async () => {
    if (!currentFilename) return alert("Upload PDF dulu!");

    const actions = [];
    const SCALE = state.scale; 

    Object.keys(state.canvases).forEach(pgIndex => {
        const canvas = state.canvases[pgIndex];
        const objects = canvas.getObjects();

        objects.forEach(obj => {
            let type = 'image';
            if (obj.type === 'textbox') type = 'text'; 
            else if (obj.type === 'rect' && (obj.fill === 'white' || obj.fill === '#ffffff')) type = 'whiteout';

            let finalX = obj.left / SCALE;
            let finalY = obj.top / SCALE;
            const finalWidth = (obj.width * obj.scaleX) / SCALE;
            const finalHeight = (obj.height * obj.scaleY) / SCALE;
            const finalFontSize = (obj.fontSize * obj.scaleY) / SCALE;

            if (type === 'text') {
                finalY += 1.0; 
                finalX += 1.0; 
            }

            let safeFont = obj.fontFamily || 'Helvetica';
            if (safeFont.includes('Times')) safeFont = 'Times';
            else if (safeFont.includes('Courier')) safeFont = 'Courier';
            else safeFont = 'Helvetica';

            // --- NORMALISASI BOOLEAN STYLE ---
            const isBold = (String(obj.fontWeight).toLowerCase() === 'bold' || parseInt(obj.fontWeight) >= 700);
            const isItalic = (String(obj.fontStyle).toLowerCase() === 'italic');
            const isStrikethrough = (obj.linethrough === true); // Pastikan ini terkirim

            actions.push({
                type: type,
                pageIndex: parseInt(pgIndex) - 1,
                x: finalX,
                y: finalY,
                width: finalWidth,
                height: finalHeight,
                text: obj.text,
                fontSize: finalFontSize,
                fontFamily: safeFont,
                fill: obj.fill,
                
                // Kirim ke backend
                isBold: isBold,
                isItalic: isItalic,
                isStrikethrough: isStrikethrough,
                
                dataUrl: type === 'image' ? obj.src : null
            });
        });
    });

    const btn = document.getElementById('btn-save');
    btn.innerText = "⏳ Menyimpan...";

    try {
        const res = await fetch('/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: currentFilename, actions })
        });
        const result = await res.json();
        if(result.url) window.open(result.url, '_blank');
        else alert("Gagal: " + result.error);
    } catch (e) {
        console.error(e);
        alert("Server Error");
    } finally {
        btn.innerHTML = "<span>💾</span> Simpan PDF";
    }
};

window.toolText = () => state.activeTool = activateTextTool();
window.toolWhiteout = () => state.activeTool = activateWhiteoutTool();
window.toolImage = () => { const i = document.getElementById('image-input'); if(i) i.click(); };
window.handleImageSelect = (input) => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { state.tempImage = e.target.result; state.activeTool = activateImageTool(); };
    reader.readAsDataURL(file);
    input.value = '';
};
window.toolSign = async () => {
    const res = await fetch(`/signatures?t=${Date.now()}`);
    const files = await res.json();
    const grid = document.getElementById('sign-grid');
    grid.innerHTML = '';
    const uploadBtn = document.createElement('label');
    uploadBtn.className = "flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50";
    uploadBtn.innerHTML = `<span class="text-2xl text-slate-400">+</span><input type="file" hidden accept="image/*" onchange="handleSignUpload(this)">`;
    grid.appendChild(uploadBtn);
    files.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = "h-24 w-full object-contain border border-slate-200 rounded p-1 hover:border-blue-500 cursor-pointer bg-white";
        img.onclick = () => { state.tempImage = url; state.activeTool = activateImageTool(); document.getElementById('sign-modal').classList.add('hidden'); };
        grid.appendChild(img);
    });
    document.getElementById('sign-modal').classList.remove('hidden');
};
window.closeModal = () => document.getElementById('sign-modal').classList.add('hidden');
window.handleSignUpload = (input) => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = async () => {
            const cleanDataUrl = removeWhitePixels(img); 
            const res = await fetch(cleanDataUrl);
            const blob = await res.blob();
            const formData = new FormData();
            formData.append('signature', blob, 'sign-' + Date.now() + '.png');
            await fetch('/upload-sign', { method: 'POST', body: formData });
            window.toolSign();
        };
    };
    reader.readAsDataURL(file);
    input.value = '';
};