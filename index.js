/*
  Badge PNG API
  - Size: 50mm x 80mm. px = (mm / 25.4) * dpi
  - Layout uses a virtual ruler 500 x 800, scaled to actual canvas
  - Fonts: bold, black text; background white
  - Name split into up to 2 lines, balanced by word lengths
  - QR generated locally with 'qrcode' and drawn onto canvas

  Note about fonts:
  - The code uses generic fonts: Arial, Helvetica, DejaVuSans, sans-serif.
  - If you want to ensure bold weight, you can register a TTF using registerFont (when using node-canvas fallback):
    const { registerFont } = require('canvas');
    registerFont(path.join(__dirname, 'fonts', 'YourBoldFont.ttf'), { family: 'YourFont', weight: 'bold' });
    And then use ctx.font = `bold 90px YourFont`;
  - With @napi-rs/canvas, system fonts are used if available.
*/

const express = require('express');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Prefer @napi-rs/canvas; fallback to canvas
let CanvasLib;
let useNapi = false;
let registeredFontFamily = null; // will be set if we successfully register a bundled TTF
try {
  CanvasLib = require('@napi-rs/canvas');
  useNapi = true;
} catch (err) {
  try {
    CanvasLib = require('canvas');
  } catch (e) {
    console.error('Failed to load canvas libraries. Install "@napi-rs/canvas" (preferred) or "canvas" as a fallback.');
    process.exit(1);
  }
}

// Try to register a bundled bold font (optional). Place a TTF in ./fonts
// Priority: arial_black.ttf (as requested), then DejaVuSans-Bold.ttf.
// This ensures consistent rendering on Render or any Linux host.
console.log('Looking for bundled fonts in:', __dirname);
try {
  const fontDir = path.join(__dirname, 'fonts');
  console.log('Font directory:', fontDir);
  if (fs.existsSync(fontDir)) {
    console.log('Font directory contents:', fs.readdirSync(fontDir));
  } else {
    console.log('Font directory does not exist, checking root directory for font files...');
    const rootFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.ttf'));
    console.log('TTF files in root:', rootFiles);
  }
  
  const candidates = [
    'arial.ttf',
    'Arial.ttf',
    'ARIAL.TTF',
    'arial_black.ttf',
    'ArialBlack.ttf',
    'Arial-Black.ttf',
    'DejaVuSans-Bold.ttf',
    'DejaVuSansCondensed-Bold.ttf',
    'Arial-Bold.ttf',
    'ArialBold.ttf',
  ];
  
  // Check both fonts/ directory and root directory
  const searchPaths = [fontDir, __dirname];
  let foundFont = false;
  
  for (const searchDir of searchPaths) {
    if (foundFont) break;
    for (const file of candidates) {
      const fontPath = path.join(searchDir, file);
      console.log('Checking font path:', fontPath);
      if (fs.existsSync(fontPath)) {
        console.log('Found font file:', fontPath);
        const familyName = file.toLowerCase().includes('arial') ? 'Arial' : 'BadgeBold';
        try {
          if (useNapi && CanvasLib.GlobalFonts && typeof CanvasLib.GlobalFonts.registerFromPath === 'function') {
            CanvasLib.GlobalFonts.registerFromPath(fontPath, familyName);
            registeredFontFamily = familyName;
            console.log('Successfully registered font with @napi-rs/canvas:', familyName);
            foundFont = true;
            break;
          }
          if (!useNapi && typeof CanvasLib.registerFont === 'function') {
            CanvasLib.registerFont(fontPath, { family: familyName, weight: 'bold' });
            registeredFontFamily = familyName;
            console.log('Successfully registered font with node-canvas:', familyName);
            foundFont = true;
            break;
          }
        } catch (fontErr) {
          console.error('Error registering font:', fontErr);
        }
      }
    }
  }
  
  if (!foundFont) {
    console.log('No custom font found, will use system fonts');
  }
} catch (err) {
  console.error('Error during font registration:', err);
}

console.log('Final registered font family:', registeredFontFamily);
console.log('Canvas library being used:', useNapi ? '@napi-rs/canvas' : 'canvas');

const app = express();
app.use(express.json());

// Constants (portrait defaults)
const MM_WIDTH = 50; // mm
const MM_HEIGHT = 80; // mm
const DEFAULT_DPI = 300;
const MIN_DPI = 72;
const MAX_DPI = 1200;
const DEFAULT_MAX_CHARS_LINE1 = 15
const DEFAULT_MAX_CHARS_LINE2 = 15

// Virtual layout ruler (width x height)
const VIRTUAL_W = 500;
const VIRTUAL_H = 800;

// Base layout values on the virtual ruler
const layoutBase = {
  marginTop: 40,
  // Larger fonts so the name occupies roughly half of the short side (50mm)
  titleFont: 140, // line 1 font size on virtual ruler
  secondFont: 140, // line 2 font size
  // Smaller gap between lines
  lineGap: 40,
  // Slightly larger gap between the last text line and the QR
  afterTextGap: 220,
  qrSize: 330,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mmToPx(mm, dpi) {
  return (mm / 25.4) * dpi;
}

// Split a full name into up to two lines, balanced by character length.
function truncateToMaxChars(text, maxChars) {
  const max = Math.max(0, Number(maxChars) || 0);
  if (max === 0) return '';
  if (!text) return '';
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  cut = cut.replace(/\s+$/g, '');
  return cut + '.'
}

function splitNameIntoTwoLines(name, maxLine1, maxLine2) {
  if (!name) return { line1: '', line2: '' };
  
  const max1 = Math.max(1, Number(maxLine1) || DEFAULT_MAX_CHARS_LINE1);
  const max2 = Math.max(1, Number(maxLine2) || DEFAULT_MAX_CHARS_LINE2);
  
  console.log(`splitNameIntoTwoLines: name="${name}", max1=${max1}, max2=${max2}`);
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    const result = { line1: truncateToMaxChars(words[0], max1), line2: '' };
    console.log('Single word result:', result);
    return result;
  }

  // Try balanced split that also respects character caps
  const candidates = [];
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    candidates.push({ l1, l2, diff: Math.abs(l1.length - l2.length) });
  }
  const valid = candidates.filter(c => c.l1.length <= max1 && c.l2.length <= max2);
  if (valid.length > 0) {
    valid.sort((a, b) => a.diff - b.diff);
    const result = { line1: valid[0].l1, line2: valid[0].l2 };
    console.log('Balanced split result:', result);
    return result;
  }

  // Fallback: greedy fill line1, rest to line2, then truncate to caps
  let line1 = '';
  let line2 = '';
  for (const w of words) {
    const try1 = line1 ? `${line1} ${w}` : w;
    if (try1.length <= max1) {
      line1 = try1;
    } else {
      line2 = line2 ? `${line2} ${w}` : w;
    }
  }
  line1 = truncateToMaxChars(line1 || words[0], max1);
  line2 = truncateToMaxChars(line2, max2);
  
  const result = { line1, line2 };
  console.log('Fallback split result:', result);
  return result;
}

function createCanvas(width, height) {
  if (useNapi) {
    return CanvasLib.createCanvas(width, height);
  }
  return CanvasLib.createCanvas(width, height);
}

function getContext2d(canvas) {
  if (useNapi) {
    return canvas.getContext('2d');
  }
  return canvas.getContext('2d');
}

async function renderBadgePng({ name, qrText, dpi, mmWidth, mmHeight, rotation, maxCharsLine1, maxCharsLine2 }) {
  const clampedDpi = clamp(Number(dpi) || DEFAULT_DPI, MIN_DPI, MAX_DPI);
  const canvasWidthPx = Math.round(mmToPx(mmWidth, clampedDpi));
  const canvasHeightPx = Math.round(mmToPx(mmHeight, clampedDpi));

  // Normalize rotation to one of [0, 90, 180, 270]
  const allowed = [0, 90, 180, 270];
  const rot = allowed.includes(rotation) ? rotation : 0;

  // Always draw content in LANDSCAPE (80x50mm) first.
  const contentWidth = canvasWidthPx;
  const contentHeight = canvasHeightPx;
  const contentCanvas = createCanvas(contentWidth, contentHeight);
  const ctx = getContext2d(contentCanvas);

  // White background on content
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, contentWidth, contentHeight);

  // Scaling from virtual ruler to real canvas
  const scaleX = contentWidth / VIRTUAL_W;
  const scaleY = contentHeight / VIRTUAL_H;

  // Padding-only spacing (use padding instead of margins)
  const topPaddingPx = 40
  const bottomPaddingPx = 40
  const sidePaddingPx = 0;
  const innerWidth = Math.max(0, contentWidth - sidePaddingPx * 2);
  const centerX = sidePaddingPx + innerWidth / 2;
  const lineGap = layoutBase.lineGap * scaleY;
  let afterTextGap = layoutBase.afterTextGap * scaleY;
  // Enforce a minimum absolute pixel gap above the QR (e.g., 40px)
  if (afterTextGap < 40) afterTextGap = 40;

  // Use minimum scale for sizes that should keep square proportions (like QR)
  const uniformScale = Math.min(scaleX, scaleY);
  // Slightly smaller QR so it sits further down after increased gaps
  const qrRenderSize = Math.round((layoutBase.qrSize - 40) * uniformScale);
  const qrRenderClamped = Math.min(qrRenderSize, Math.floor(innerWidth));

  // Split name into up to 2 lines
  const { line1, line2 } = splitNameIntoTwoLines(name, maxCharsLine1, maxCharsLine2);

  // Fonts: prefer a registered bundled font if available, else system fonts
  const fontFamily = registeredFontFamily || 'Arial, Helvetica, DejaVuSans, sans-serif';
  const titleFontSize = Math.round(layoutBase.titleFont * uniformScale);
  const secondFontSize = Math.round(layoutBase.secondFont * uniformScale);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';

  // Measure baseline Y start
  let y = topPaddingPx;

  // Draw first line if exists
  if (line1) {
    ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
    // Canvas text baseline: we can use top for simpler Y handling
    ctx.textBaseline = 'top';
    ctx.fillText(line1, centerX, y);
  }

  // Draw second line or adjust spacing if single line
  if (line2) {
    y += titleFontSize + lineGap;
    ctx.font = `bold ${secondFontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillText(line2, centerX, y);
  } else {
    // If only one line, add a bit more space as requested (+30 on virtual)
    y += titleFontSize + (lineGap + 30 * scaleY);
  }

  // After text gap before QR
  y += afterTextGap;

  // Generate QR as PNG buffer
  const qrPngBuffer = await QRCode.toBuffer(qrText || name, {
    errorCorrectionLevel: 'M',
    margin: 0,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    // width is applied by qrcode lib to output image; we'll fit it anyway
    width: qrRenderSize,
    type: 'png',
  });

  // Draw QR centered
  const qrX = Math.round(sidePaddingPx + (innerWidth - qrRenderClamped) / 2);
  let qrY = Math.round(y);
  // Ensure bottom padding of 20px is preserved
  const maxQrY = Math.max(topPaddingPx, Math.round(contentHeight - bottomPaddingPx - qrRenderClamped));
  if (qrY > maxQrY) qrY = maxQrY;

  if (useNapi) {
    // @napi-rs/canvas accepts ImageData-like; loadImage from buffer
    const img = await CanvasLib.loadImage(qrPngBuffer);
    ctx.drawImage(img, qrX, qrY, qrRenderClamped, qrRenderClamped);
  } else {
    // node-canvas
    const img = new CanvasLib.Image();
    img.src = qrPngBuffer;
    ctx.drawImage(img, qrX, qrY, qrRenderClamped, qrRenderClamped);
  }

  // Compose onto final canvas with rotation if needed.
  // For 90/270 we swap final dimensions.
  const finalWidth = (rot === 90 || rot === 270) ? contentHeight : contentWidth;
  const finalHeight = (rot === 90 || rot === 270) ? contentWidth : contentHeight;
  const finalCanvas = createCanvas(finalWidth, finalHeight);
  const finalCtx = getContext2d(finalCanvas);
  finalCtx.fillStyle = '#FFFFFF';
  finalCtx.fillRect(0, 0, finalWidth, finalHeight);

  finalCtx.save();
  if (rot === 90) {
    finalCtx.translate(finalWidth, 0);
    finalCtx.rotate(Math.PI / 2);
  } else if (rot === 180) {
    finalCtx.translate(finalWidth, finalHeight);
    finalCtx.rotate(Math.PI);
  } else if (rot === 270) {
    finalCtx.translate(0, finalHeight);
    finalCtx.rotate(3 * Math.PI / 2);
  }
  finalCtx.drawImage(contentCanvas, 0, 0);
  finalCtx.restore();

  // Output PNG buffer
  if (useNapi && typeof finalCanvas.encode === 'function') {
    return await finalCanvas.encode('png');
  }
  return finalCanvas.toBuffer('image/png');
}

function parseParams(req) {
  const method = req.method.toUpperCase();
  const source = method === 'GET' ? req.query : req.body || {};
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  const qr = typeof source.qr === 'string' ? source.qr : undefined;
  let dpi = source.dpi !== undefined ? Number(source.dpi) : DEFAULT_DPI;
  if (!Number.isFinite(dpi)) dpi = DEFAULT_DPI;
  dpi = clamp(dpi, MIN_DPI, MAX_DPI);
  // Always render base content in LANDSCAPE (80 x 50 mm)
  const mmWidth = MM_HEIGHT;  // 80mm
  const mmHeight = MM_WIDTH;  // 50mm
  // rotation degrees (0, 90, 180, 270). Accept strings or numbers.
  let rotation = 0;
  if (source.rotation !== undefined) {
    const r = Number(source.rotation);
    rotation = [0, 90, 180, 270].includes(r) ? r : 0;
  } else if (source.rotate !== undefined) {
    const r = Number(source.rotate);
    rotation = [0, 90, 180, 270].includes(r) ? r : 0;
  }
  // optional caps for line lengths
  // Accept alternate param names and strings; coerce to finite numbers
  function toNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  const maxCharsLine1 = source.maxLine1 !== undefined ? toNum(source.maxLine1, DEFAULT_MAX_CHARS_LINE1)
                        : source.max_line1 !== undefined ? toNum(source.max_line1, DEFAULT_MAX_CHARS_LINE1)
                        : source.maxcharsline1 !== undefined ? toNum(source.maxcharsline1, DEFAULT_MAX_CHARS_LINE1)
                        : DEFAULT_MAX_CHARS_LINE1;
  const maxCharsLine2 = source.maxLine2 !== undefined ? toNum(source.maxLine2, DEFAULT_MAX_CHARS_LINE2)
                        : source.max_line2 !== undefined ? toNum(source.max_line2, DEFAULT_MAX_CHARS_LINE2)
                        : source.maxcharsline2 !== undefined ? toNum(source.maxcharsline2, DEFAULT_MAX_CHARS_LINE2)
                        : DEFAULT_MAX_CHARS_LINE2;
  return { name, qr, dpi, mmWidth, mmHeight, rotation, maxCharsLine1, maxCharsLine2 };
}

async function handleBadgeRequest(req, res) {
  try {
    const { name, qr, dpi, mmWidth, mmHeight, rotation, maxCharsLine1, maxCharsLine2 } = parseParams(req);
    console.log('Request params:', { name, qr, dpi, mmWidth, mmHeight, rotation, maxCharsLine1, maxCharsLine2 });
    
    if (!name) {
      return res.status(400).json({ error: 'Missing required parameter: name' });
    }

    const pngBuffer = await renderBadgePng({ name, qrText: qr, dpi, mmWidth, mmHeight, rotation, maxCharsLine1, maxCharsLine2 });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="badge.png"');
    res.send(pngBuffer);
  } catch (err) {
    console.error('Error generating badge:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

app.get('/badge', handleBadgeRequest);
app.post('/badge', handleBadgeRequest);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Badge API listening on http://localhost:${PORT}`);
});

