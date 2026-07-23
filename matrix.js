// ==UserScript==
// @name         Twitch Matrix Controller (64x16) - v2.9
// @namespace    http://tampermonkey.net/
// @version      2.9
// @description  LED Matrix Controller - Added "Copy All" button
// @author       Gemini
// @match        https://www.twitch.tv/daverdavid
// @match        https://www.twitch.tv/popout/daverdavid/chat
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // - CONFIGURATION -
    const MATRIX_WIDTH = 64;
    const MATRIX_HEIGHT = 16;
    const SCALE = 10;
    const MAX_CHARS = 400;
    const MAX_PIXELS_PER_MSG = 64;

    const CMD_TEMPLATE = "!Pixel {coords} {color}";
    const CMD_CLEAR = "!clear";

    const EMOJI_API_KEY = "88be36ba323efa25dd6a9472392e1d4497203496";

    // - COLOR PALETTES -
    const PALETTE_16 = [
        {r: 0, g: 0, b: 0},       // Black
        {r: 0, g: 0, b: 170},     // Blue
        {r: 0, g: 170, b: 0},     // Green
        {r: 0, g: 170, b: 170},   // Cyan
        {r: 170, g: 0, b: 0},     // Red
        {r: 170, g: 0, b: 170},   // Magenta
        {r: 170, g: 85, b: 0},    // Brown
        {r: 170, g: 170, b: 170}, // Light Gray
        {r: 85, g: 85, b: 85},    // Dark Gray
        {r: 85, g: 85, b: 255},   // Light Blue
        {r: 85, g: 255, b: 85},   // Light Green
        {r: 85, g: 255, b: 255},  // Light Cyan
        {r: 255, g: 85, b: 85},   // Light Red
        {r: 255, g: 85, b: 255},  // Light Magenta
        {r: 255, g: 255, b: 85},  // Yellow
        {r: 255, g: 255, b: 255}  // White
    ];

    const PALETTE_32 = [
        {r:0,g:0,b:0}, {r:34,g:32,b:52}, {r:69,g:40,b:60}, {r:102,g:57,b:49},
        {r:143,g:86,b:59}, {r:223,g:113,b:38}, {r:217,g:160,b:102}, {r:238,g:195,b:154},
        {r:251,g:242,b:54}, {r:153,g:229,b:80}, {r:106,g:190,b:48}, {r:55,g:148,b:110},
        {r:75,g:105,b:47}, {r:82,g:75,b:36}, {r:50,g:60,b:57}, {r:63,g:63,b:116},
        {r:48,g:96,b:130}, {r:91,g:110,b:225}, {r:99,g:155,b:255}, {r:95,g:205,b:228},
        {r:203,g:219,b:252}, {r:255,g:255,b:255}, {r:155,g:173,b:183}, {r:132,g:126,b:135},
        {r:105,g:106,b:106}, {r:89,g:86,b:82}, {r:118,g:66,b:138}, {r:172,g:50,b:50},
        {r:217,g:87,b:99}, {r:215,g:123,b:186}, {r:143,g:151,b:74}, {r:138,g:111,b:48}
    ];

    const PALETTE_64 = [];
    const levels = [0, 85, 170, 255];
    for (let r of levels) {
        for (let g of levels) {
            for (let b of levels) {
                PALETTE_64.push({r, g, b});
            }
        }
    }

    // - STATE VARIABLES -
    let messageQueue = [];
    let currentQueueIndex = 0;
    let minimized = false;

    // - CSS STYLES -
    const style = document.createElement('style');
    style.innerHTML = `
        #tm-matrix-panel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: ${MATRIX_WIDTH * SCALE + 20}px;
            background: #18181b;
            border: 2px solid #9147ff;
            border-radius: 8px;
            padding: 10px;
            z-index: 9999;
            color: white;
            font-family: Inter, sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5);
            font-size: 13px;
        }
        #tm-matrix-header {
            font-weight: bold;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            cursor: move;
            user-select: none;
            padding: 5px;
            background: #222;
            border-radius: 4px;
        }
        #tm-canvas-container {
            background: #000;
            border: 1px solid #333;
            margin-bottom: 10px;
            display: flex;
            justify-content: center;
        }
        .tm-control-group {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #333;
        }
        .tm-input {
            background: #333;
            border: 1px solid #555;
            color: white;
            padding: 4px;
            border-radius: 4px;
            width: 100%;
            margin-bottom: 4px;
            box-sizing: border-box;
        }
        .tm-checkbox-label {
            display: flex;
            align-items: center;
            font-size: 12px;
            cursor: pointer;
            margin-bottom: 5px;
        }
        .tm-checkbox-label input {
            margin-right: 6px;
        }
        .tm-slider-container {
            margin-bottom: 8px;
        }
        .tm-slider-label {
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            color: #ccc;
            margin-bottom: 2px;
        }
        input[type=range] {
            width: 100%;
            cursor: pointer;
        }
        .tm-btn {
            background: #9147ff;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
            margin-top: 2px;
        }
        .tm-btn:hover { background: #772ce8; }
        .tm-btn-red { background: #e91916; }
        .tm-btn-red:hover { background: #c20e0c; }
        .tm-btn-blue { background: #007bff; }
        .tm-btn-blue:hover { background: #0056b3; }

        /* Emoji Search Style */
        #tm-emoji-panel {
            display: none;
            margin-top: 5px;
            background: #222;
            padding: 5px;
            border-radius: 4px;
            border: 1px solid #555;
        }
        #tm-emoji-results {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 2px;
            max-height: 100px;
            overflow-y: auto;
            margin-top: 5px;
        }
        .tm-emoji-item {
            cursor: pointer;
            text-align: center;
            padding: 2px;
            font-size: 18px;
            border-radius: 2px;
        }
        .tm-emoji-item:hover { background: #444; }

        #tm-queue-panel {
            margin-top: 10px;
            border-top: 1px solid #555;
            padding-top: 10px;
            display: none;
        }
        .tm-btn-copy {
            background: #00e676;
            color: #000;
            font-size: 14px;
            padding: 8px;
        }
        .tm-btn-copy:hover { background: #00c853; }

        .tm-row { display: flex; gap: 5px; }
        .tm-col { flex: 1; }
        .tm-col-small { flex: 0.5; }
        #tm-status {
            font-size: 11px;
            color: #aaa;
            margin-top: 5px;
            text-align: right;
            white-space: pre-wrap;
            line-height: 1.4;
        }

        /* - PASTE MODAL STYLE - */
        #tm-paste-modal {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.85);
            z-index: 10000;
            justify-content: center;
            align-items: center;
            flex-direction: column;
        }
        #tm-paste-content {
            background: #222;
            padding: 15px;
            border: 1px solid #9147ff;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            max-width: 90vw;
            max-height: 90vh;
        }
        #tm-crop-container {
            overflow: auto;
            position: relative;
            border: 1px solid #555;
            background: #111;
            cursor: crosshair;
            margin-top: 10px;
            max-height: 70vh;
        }
        #tm-selection-box {
            position: absolute;
            border: 2px dashed #00ff00;
            background: rgba(0, 255, 0, 0.2);
            pointer-events: none;
            display: none;
        }
    `;
    document.head.appendChild(style);

    // - HTML UI -
    const panelHTML = `
        <div id="tm-matrix-header">Matrix 64x16 <span id="tm-minimize">_</span></div>
        <div id="tm-canvas-container">
            <canvas id="tm-canvas" width="${MATRIX_WIDTH}" height="${MATRIX_HEIGHT}" style="width: 100%; image-rendering: pixelated;"></canvas>
        </div>

        <div id="tm-controls">
            <!-- Text Section -->
            <div class="tm-control-group">
                <label>Text (Crisp) & Emoji:</label>
                <div class="tm-row">
                    <input type="text" id="tm-text-input" class="tm-input" placeholder="Enter text..." style="flex:2">
                    <input type="color" id="tm-text-color" class="tm-input" value="#FFFFFF" style="height: 30px; width: 40px;">
                    <button id="tm-btn-emoji-toggle" class="tm-btn" style="width: 40px; padding: 0; font-size: 16px;">😀</button>
                    <input type="number" id="tm-text-x" class="tm-input" placeholder="X" value="0" style="width: 50px;">
                </div>

                <!-- Hidden Emoji Search Panel -->
                <div id="tm-emoji-panel">
                    <div class="tm-row">
                        <input type="text" id="tm-emoji-search" class="tm-input" placeholder="Search (e.g., computer)...">
                        <button id="tm-btn-emoji-search" class="tm-btn" style="width: auto;">🔍</button>
                    </div>
                    <div id="tm-emoji-results"></div>
                </div>

                <button id="tm-btn-add-text" class="tm-btn" style="margin-top: 5px;">Add Text</button>
            </div>

            <!-- Image / Rectangle Section -->
            <div class="tm-control-group">
                <label>Tools:</label>
                <div class="tm-row">
                    <button id="tm-btn-paste" class="tm-btn tm-btn-blue">Paste Image (Clipboard)</button>
                </div>
                <div style="margin-top:5px; font-size:10px; color:#888;">Rectangle (Fill):</div>
                <div class="tm-row">
                    <input type="color" id="tm-rect-color" class="tm-input" value="#FF0000" style="height: 30px; width: 40px;">
                    <input type="number" id="tm-rect-x" class="tm-input" placeholder="X" value="0">
                    <input type="number" id="tm-rect-y" class="tm-input" placeholder="Y" value="0">
                    <input type="number" id="tm-rect-w" class="tm-input" placeholder="W" value="64">
                    <input type="number" id="tm-rect-h" class="tm-input" placeholder="H" value="16">
                    <button id="tm-btn-rect" class="tm-btn" style="width: auto;">Fill</button>
                </div>
            </div>

            <!-- Options -->
            <div class="tm-control-group" style="border:none; padding:0;">
                <label class="tm-checkbox-label">
                    <input type="checkbox" id="tm-ignore-black" checked> Ignore black (background)
                </label>

                <!-- QUALITY SLIDER -->
                <div class="tm-slider-container">
                    <div class="tm-slider-label">
                        <span>Color Quality (Compression)</span>
                        <span id="tm-quality-val">100%</span>
                    </div>
                    <input type="range" id="tm-color-quality" min="1" max="100" value="100">
                </div>

                <div style="font-size:10px; color:#888; margin-bottom:4px;">Palettes (optional):</div>
                <label class="tm-checkbox-label">
                    <input type="checkbox" id="tm-16-colors"> 16 colors (CGA)
                </label>
                <label class="tm-checkbox-label">
                    <input type="checkbox" id="tm-32-colors"> 32 colors (DB32)
                </label>
                <label class="tm-checkbox-label">
                    <input type="checkbox" id="tm-64-colors"> 64 colors (RGB 2-bit)
                </label>
                <button id="tm-btn-preview" class="tm-btn tm-btn-blue" style="margin-bottom: 5px;">Preview (Quantization)</button>

                <hr style="border: 0; border-top: 1px solid #444; margin: 8px 0;">

                <label class="tm-checkbox-label">
                    <input type="checkbox" id="tm-auto-copy" checked> Auto Copy (Clipboard on Enter)
                </label>
            </div>

            <!-- Actions -->
            <div class="tm-row">
                <button id="tm-btn-clear" class="tm-btn tm-btn-red tm-col">Reset</button>
                <button id="tm-btn-generate" class="tm-btn tm-col">Generate</button>
            </div>

            <!-- Queue Panel -->
            <div id="tm-queue-panel">
                <div style="font-size:12px; margin-bottom:5px; color:#aaa; display:flex; justify-content:space-between;">
                    <span>Queue:</span>
                    <span id="tm-queue-counter">0/0</span>
                </div>
                <div class="tm-row">
                    <button id="tm-btn-copy" class="tm-btn tm-btn-copy">COPY (1)</button>
                    <button id="tm-btn-copy-all" class="tm-btn" style="background: #00bcd4; color: black; width: 40%;">COPY ALL</button>
                </div>
                <div style="font-size:10px; color:#888; margin-top:5px; text-align:center;">
                    Enter = Copy Next
                </div>
            </div>

            <div id="tm-status">Ready</div>
        </div>

        <!-- PASTE MODAL -->
        <div id="tm-paste-modal">
            <div id="tm-paste-content">
                <h3 style="margin:0 0 10px 0; color:white;">Select area to insert</h3>
                <div style="font-size:12px; color:#aaa; margin-bottom:5px;">Select the fragment with your mouse to scale to the matrix (64x16).</div>
                <div id="tm-crop-container">
                    <canvas id="tm-paste-canvas"></canvas>
                    <div id="tm-selection-box"></div>
                </div>
                <div class="tm-row" style="margin-top:10px; justify-content: flex-end;">
                    <button id="tm-modal-cancel" class="tm-btn tm-btn-red" style="width:auto; margin-right:10px;">Cancel</button>
                    <button id="tm-modal-ok" class="tm-btn" style="width:auto;">Insert & Scale</button>
                </div>
            </div>
        </div>
    `;

    const panel = document.createElement('div');
    panel.id = 'tm-matrix-panel';
    panel.innerHTML = panelHTML;
    document.body.appendChild(panel);

    // - SLIDER LOGIC -
    const qualitySlider = document.getElementById('tm-color-quality');
    const qualityVal = document.getElementById('tm-quality-val');
    qualitySlider.addEventListener('input', () => {
        qualityVal.innerText = qualitySlider.value + '%';
    });

    // - UI LOGIC (MUTUALLY EXCLUSIVE PALETTES) -
    const check16 = document.getElementById('tm-16-colors');
    const check32 = document.getElementById('tm-32-colors');
    const check64 = document.getElementById('tm-64-colors');

    function updateCheckboxes(selected) {
        if (selected === check16 && check16.checked) {
            check32.checked = false;
            check64.checked = false;
        } else if (selected === check32 && check32.checked) {
            check16.checked = false;
            check64.checked = false;
        } else if (selected === check64 && check64.checked) {
            check16.checked = false;
            check32.checked = false;
        }
    }

    check16.addEventListener('change', () => updateCheckboxes(check16));
    check32.addEventListener('change', () => updateCheckboxes(check32));
    check64.addEventListener('change', () => updateCheckboxes(check64));

    // - DRAG & DROP LOGIC -
    const header = document.getElementById('tm-matrix-header');

    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener('mousedown', (e) => {
        if(e.target.id === 'tm-minimize') return;
        isDragging = true;
        dragOffsetX = e.clientX - panel.offsetLeft;
        dragOffsetY = e.clientY - panel.offsetTop;
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        panel.style.left = (e.clientX - dragOffsetX) + 'px';
        panel.style.top = (e.clientY - dragOffsetY) + 'px';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if(isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
        }
    });

    // - CANVAS -
    const canvas = document.getElementById('tm-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, MATRIX_WIDTH, MATRIX_HEIGHT);

    function clearCanvas() {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, MATRIX_WIDTH, MATRIX_HEIGHT);
        updateStatus("Preview cleared.");
        hideQueuePanel();
    }

    // - HELPER FUNCTIONS -
    function findNearestColor(r, g, b, palette) {
        let minDist = Infinity;
        let nearest = palette[0];
        for (const c of palette) {
            const dist = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
            if (dist < minDist) {
                minDist = dist;
                nearest = c;
            }
        }
        return nearest;
    }

    // Function to compress (round) colors based on the slider
    function quantizeColor(r, g, b, quality) {
        if (quality >= 100) return {r, g, b};

        // Mapping quality 1-100 to number of levels (2-255)
        const levels = Math.max(2, Math.floor(2.55 * quality));
        const step = 255 / (levels - 1);

        r = Math.round(r / step) * step;
        g = Math.round(g / step) * step;
        b = Math.round(b / step) * step;

        // Clamp
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        return {r: Math.round(r), g: Math.round(g), b: Math.round(b)};
    }

    function applyProcessingToCanvas() {
        const imageData = ctx.getImageData(0, 0, MATRIX_WIDTH, MATRIX_HEIGHT);
        const data = imageData.data;
        const quality = parseInt(qualitySlider.value);

        let palette = null;
        if (check16.checked) palette = PALETTE_16;
        else if (check32.checked) palette = PALETTE_32;
        else if (check64.checked) palette = PALETTE_64;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue;

            // 1. Slider compression
            const q = quantizeColor(r, g, b, quality);
            r = q.r; g = q.g; b = q.b;

            // 2. Palette (if selected)
            if (palette) {
                const nearest = findNearestColor(r, g, b, palette);
                r = nearest.r;
                g = nearest.g;
                b = nearest.b;
            }

            data[i] = r;
            data[i+1] = g;
            data[i+2] = b;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    function updateStatus(text) {
        const el = document.getElementById('tm-status');
        if(el) el.innerText = text;
    }

    function toggleMinimize() {
        const controls = document.getElementById('tm-controls');
        const canvasCont = document.getElementById('tm-canvas-container');
        if (minimized) {
            controls.style.display = 'block';
            canvasCont.style.display = 'flex';
            document.getElementById('tm-minimize').innerText = '_';
            minimized = false;
        } else {
            controls.style.display = 'none';
            canvasCont.style.display = 'none';
            document.getElementById('tm-minimize').innerText = '□';
            minimized = true;
        }
    }

    // - EMOJI HANDLERS (SEARCH) -
    const emojiPanel = document.getElementById('tm-emoji-panel');
    const emojiSearchInput = document.getElementById('tm-emoji-search');
    const emojiResultsDiv = document.getElementById('tm-emoji-results');

    document.getElementById('tm-btn-emoji-toggle').addEventListener('click', () => {
        const isHidden = emojiPanel.style.display === 'none' || emojiPanel.style.display === '';
        emojiPanel.style.display = isHidden ? 'block' : 'none';
        if (isHidden) emojiSearchInput.focus();
    });

    async function searchEmojis() {
        const query = emojiSearchInput.value.trim();
        if(!query) return;

        updateStatus("Searching for emoji...");
        const url = `https://emoji-api.com/emojis?search=${query}&access_key=${EMOJI_API_KEY}`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            emojiResultsDiv.innerHTML = '';

            if (data && data.length > 0 && !data.status) {
                data.forEach(item => {
                    const span = document.createElement('span');
                    span.className = 'tm-emoji-item';
                    span.innerText = item.character;
                    span.title = item.unicodeName;

                    span.addEventListener('click', () => {
                        const input = document.getElementById('tm-text-input');
                        input.value += item.character;
                        emojiPanel.style.display = 'none';
                        updateStatus(`Added to text: ${item.character}`);
                    });

                    emojiResultsDiv.appendChild(span);
                });
                updateStatus(`Found: ${data.length}`);
            } else {
                updateStatus("No results.");
                emojiResultsDiv.innerHTML = '<div style="grid-column: span 6; text-align: center; color: #888;">None</div>';
            }
        } catch (e) {
            console.error(e);
            updateStatus("Emoji API error.");
        }
    }

    document.getElementById('tm-btn-emoji-search').addEventListener('click', searchEmojis);
    emojiSearchInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') searchEmojis();
    });

    // - PASTE IMAGE HANDLER -
    const pasteModal = document.getElementById('tm-paste-modal');
    const pasteCanvas = document.getElementById('tm-paste-canvas');
    const pasteCtx = pasteCanvas.getContext('2d');
    const selectionBox = document.getElementById('tm-selection-box');

    let selStartX = 0, selStartY = 0;
    let isSelecting = false;
    let selectionRect = { x: 0, y: 0, w: 0, h: 0 };

    document.getElementById('tm-btn-paste').addEventListener('click', async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                    const blob = await item.getType(item.types.includes('image/png') ? 'image/png' : 'image/jpeg');
                    const img = new Image();
                    img.onload = () => {
                        pasteCanvas.width = img.width;
                        pasteCanvas.height = img.height;
                        pasteCtx.drawImage(img, 0, 0);

                        selectionBox.style.display = 'none';
                        selectionRect = { x: 0, y: 0, w: img.width, h: img.height };

                        pasteModal.style.display = 'flex';
                        updateStatus("Image loaded. Select an area.");
                    };
                    img.src = URL.createObjectURL(blob);
                    return;
                }
            }
            updateStatus("No image in clipboard!");
        } catch (err) {
            console.error(err);
            updateStatus("Clipboard read error (check permissions).");
        }
    });

    pasteCanvas.addEventListener('mousedown', (e) => {
        isSelecting = true;
        const rect = pasteCanvas.getBoundingClientRect();
        selStartX = e.clientX - rect.left;
        selStartY = e.clientY - rect.top;

        selectionBox.style.left = selStartX + 'px';
        selectionBox.style.top = selStartY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';
        selectionBox.style.display = 'block';
    });

    pasteCanvas.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        const rect = pasteCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - selStartX;
        const height = currentY - selStartY;

        selectionBox.style.width = Math.abs(width) + 'px';
        selectionBox.style.height = Math.abs(height) + 'px';

        if (width < 0) selectionBox.style.left = currentX + 'px';
        if (height < 0) selectionBox.style.top = currentY + 'px';
    });

    pasteCanvas.addEventListener('mouseup', (e) => {
        isSelecting = false;
        const sb = selectionBox;
        selectionRect = {
            x: parseInt(sb.style.left) || 0,
            y: parseInt(sb.style.top) || 0,
            w: parseInt(sb.style.width) || 0,
            h: parseInt(sb.style.height) || 0
        };
        if (selectionRect.w < 2 || selectionRect.h < 2) {
             selectionRect = { x: 0, y: 0, w: pasteCanvas.width, h: pasteCanvas.height };
             selectionBox.style.display = 'none';
        }
    });

    document.getElementById('tm-modal-cancel').addEventListener('click', () => {
        pasteModal.style.display = 'none';
    });

    document.getElementById('tm-modal-ok').addEventListener('click', () => {
        if (selectionRect.w > 0 && selectionRect.h > 0) {
            ctx.drawImage(
                pasteCanvas,
                selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h,
                0, 0, MATRIX_WIDTH, MATRIX_HEIGHT
            );
            updateStatus("Image inserted into matrix.");
            hideQueuePanel();
        }
        pasteModal.style.display = 'none';
    });

    // - TOOL HANDLERS -

    document.getElementById('tm-btn-add-text').addEventListener('click', () => {
        const text = document.getElementById('tm-text-input').value;
        const color = document.getElementById('tm-text-color').value;
        const x = parseInt(document.getElementById('tm-text-x').value) || 0;
        if (!text) return;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = MATRIX_WIDTH;
        offCanvas.height = MATRIX_HEIGHT;
        const offCtx = offCanvas.getContext('2d');
        offCtx.imageSmoothingEnabled = false;

        offCtx.font = '12px "Courier New", monospace';
        offCtx.textBaseline = 'middle';
        offCtx.fillStyle = color;
        offCtx.fillText(text, x, MATRIX_HEIGHT / 2 + 1);

        const imgData = offCtx.getImageData(0, 0, MATRIX_WIDTH, MATRIX_HEIGHT);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
            const alpha = d[i + 3];
            d[i + 3] = (alpha > 100) ? 255 : 0;
        }
        offCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(offCanvas, 0, 0);
        updateStatus(`Added text: "${text}"`);
        hideQueuePanel();
    });

    document.getElementById('tm-btn-rect').addEventListener('click', () => {
        const color = document.getElementById('tm-rect-color').value;
        const x = parseInt(document.getElementById('tm-rect-x').value) || 0;
        const y = parseInt(document.getElementById('tm-rect-y').value) || 0;
        const w = parseInt(document.getElementById('tm-rect-w').value) || 0;
        const h = parseInt(document.getElementById('tm-rect-h').value) || 0;

        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        updateStatus(`Drew rectangle ${w}x${h} at (${x},${y})`);
        hideQueuePanel();
    });

    // 3. Preview
    document.getElementById('tm-btn-preview').addEventListener('click', () => {
        applyProcessingToCanvas();
        updateStatus("Applied preview (compression + palette).");
    });

    // 4. Reset
    document.getElementById('tm-btn-clear').addEventListener('click', () => {
        clearCanvas();
        messageQueue = [CMD_CLEAR];
        currentQueueIndex = 0;
        showQueuePanel();
        if (document.getElementById('tm-auto-copy').checked) {
            copyNextMessage();
        } else {
            updateStatus("Ready to reset. Use the copy button.");
        }
    });

    // 5. Generation
    document.getElementById('tm-btn-generate').addEventListener('click', () => {
        updateStatus("Processing...");

        const imageData = ctx.getImageData(0, 0, MATRIX_WIDTH, MATRIX_HEIGHT);
        const data = imageData.data;
        const pixelsByColor = {};
        const ignoreBlack = document.getElementById('tm-ignore-black').checked;
        const quality = parseInt(qualitySlider.value);

        let palette = null;
        if (check16.checked) palette = PALETTE_16;
        else if (check32.checked) palette = PALETTE_32;
        else if (check64.checked) palette = PALETTE_64;

        function rgbToHex(r, g, b) {
            return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }

        for (let y = 0; y < MATRIX_HEIGHT; y++) {
            for (let x = 0; x < MATRIX_WIDTH; x++) {
                const i = (y * MATRIX_WIDTH + x) * 4;
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                const a = data[i + 3];

                if (a < 128) continue;

                // 1. Slider compression
                const q = quantizeColor(r, g, b, quality);
                r = q.r; g = q.g; b = q.b;

                // 2. Palette (if selected)
                if (palette) {
                    const nearest = findNearestColor(r, g, b, palette);
                    r = nearest.r;
                    g = nearest.g;
                    b = nearest.b;
                }

                // Black tolerance
                if (ignoreBlack) {
                    if (r < 20 && g < 20 && b < 20) continue;
                }

                const hex = rgbToHex(r, g, b);
                if (!pixelsByColor[hex]) pixelsByColor[hex] = [];

                const matrixY = MATRIX_HEIGHT - y;
                pixelsByColor[hex].push(`${x + 1},${matrixY}`);
            }
        }

        let newQueue = [];
        for (const [color, coordsArray] of Object.entries(pixelsByColor)) {
            let currentCoordsChunk = [];
            let currentLength = CMD_TEMPLATE.replace('{color}', color).replace('{coords}', '').length;

            for (const coord of coordsArray) {
                if ((currentLength + coord.length + 1 > MAX_CHARS) || (currentCoordsChunk.length >= MAX_PIXELS_PER_MSG)) {
                    const msg = CMD_TEMPLATE.replace('{color}', color).replace('{coords}', currentCoordsChunk.join(' '));
                    newQueue.push(msg);
                    currentCoordsChunk = [];
                    currentLength = CMD_TEMPLATE.replace('{color}', color).replace('{coords}', '').length;
                }
                currentCoordsChunk.push(coord);
                currentLength += coord.length + 1;
            }
            if (currentCoordsChunk.length > 0) {
                const msg = CMD_TEMPLATE.replace('{color}', color).replace('{coords}', currentCoordsChunk.join(' '));
                newQueue.push(msg);
            }
        }

        if (newQueue.length > 0) {
            messageQueue = newQueue;
            currentQueueIndex = 0;
            showQueuePanel();
            updateStatus(`Generated ${newQueue.length} commands.`);
            if (document.getElementById('tm-auto-copy').checked) {
                copyNextMessage();
            }
        } else {
            updateStatus("Empty. No pixels to send.");
            hideQueuePanel();
        }
    });

    // - QUEUE LOGIC -
    function showQueuePanel() {
        document.getElementById('tm-queue-panel').style.display = 'block';
        updateQueueUI();
    }
    function hideQueuePanel() {
        document.getElementById('tm-queue-panel').style.display = 'none';
        messageQueue = [];
        currentQueueIndex = 0;
    }
    function updateQueueUI() {
        const btn = document.getElementById('tm-btn-copy');
        const counter = document.getElementById('tm-queue-counter');
        if (currentQueueIndex < messageQueue.length) {
            counter.innerText = `${currentQueueIndex + 1}/${messageQueue.length}`;
            btn.innerText = `COPY (${currentQueueIndex + 1}/${messageQueue.length})`;
            btn.disabled = false;
            btn.style.background = '#00e676';
            btn.style.cursor = 'pointer';
        } else {
            counter.innerText = "END";
            btn.innerText = "FINISHED";
            btn.disabled = true;
            btn.style.background = '#555';
            btn.style.cursor = 'default';
            updateStatus("End of queue.");
        }
    }
    function copyNextMessage() {
        if (currentQueueIndex >= messageQueue.length) return;
        const msg = messageQueue[currentQueueIndex];
        navigator.clipboard.writeText(msg).then(() => {
            currentQueueIndex++;
            updateQueueUI();
            const statusMsg = currentQueueIndex < messageQueue.length
                ? `Copied! Paste (Ctrl+V) and hit Enter. Next: ${currentQueueIndex + 1}`
                : `Copied the last one! Send it.`;
            updateStatus(statusMsg);
        }).catch(err => {
            console.error('Copy error:', err);
            updateStatus("Copy error! Click the button.");
        });
    }

    // - COPY ALL LOGIC -
    document.getElementById('tm-btn-copy-all').addEventListener('click', () => {
        if (messageQueue.length === 0) return;
        const allText = messageQueue.join('\n');
        navigator.clipboard.writeText(allText).then(() => {
            updateStatus(`Copied all (${messageQueue.length}) commands!`);
        }).catch(err => {
            console.error('Copy all failed', err);
            updateStatus("Copy all error.");
        });
    });

    document.getElementById('tm-btn-copy').addEventListener('click', () => {
        copyNextMessage();
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' && messageQueue.length > 0 && document.getElementById('tm-auto-copy').checked) {
            if (currentQueueIndex < messageQueue.length) {
                copyNextMessage();
            }
            if (!minimized && currentQueueIndex > 0) {
                toggleMinimize();
            }
        }
    });

    document.getElementById('tm-minimize').addEventListener('click', toggleMinimize);

})();
