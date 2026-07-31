'use strict';

/*
  Legacy badge renderer — extraído bit-a-bit de index.js (Fase 1/2).
  - Size: 50mm x 80mm. px = (mm / 25.4) * dpi
  - Layout uses a virtual ruler 500 x 800, scaled to actual canvas
  - Fonts: bold, black text; background white
  - Name split into up to 2 lines, balanced by word lengths
  - QR generated locally with 'qrcode' and drawn onto canvas

  Este módulo não pode alterar o comportamento pixel a pixel validado no
  baseline em golden/. Qualquer mudança aqui precisa provar que os golden
  tests continuam idênticos (ver docs/plano-motor-dinamico-etiquetas.md).
*/

const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const {
  PROJECT_ROOT,
  MIN_DPI,
  MAX_DPI,
  VIRTUAL_W,
  VIRTUAL_H,
  LEGACY_LAYOUT_BASE,
  EXTRA_KEY_AREA,
  EXTRA_KEY_UNIDADE,
  DEFAULT_MAX_CHARS_LINE1,
  DEFAULT_MAX_CHARS_LINE2,
} = require('../config/constants');

let CanvasLib;
let useNapi = false;
let registeredFontFamily = null;

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

function registerBundledFont() {
  try {
    const fontDir = path.join(PROJECT_ROOT, 'fonts');
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

    const searchPaths = [fontDir, PROJECT_ROOT];
    for (const searchDir of searchPaths) {
      for (const file of candidates) {
        const fontPath = path.join(searchDir, file);
        if (!fs.existsSync(fontPath)) continue;
        const familyName = file.toLowerCase().includes('arial') ? 'Arial' : 'BadgeBold';
        try {
          if (useNapi && CanvasLib.GlobalFonts && typeof CanvasLib.GlobalFonts.registerFromPath === 'function') {
            CanvasLib.GlobalFonts.registerFromPath(fontPath, familyName);
            return familyName;
          }
          if (!useNapi && typeof CanvasLib.registerFont === 'function') {
            CanvasLib.registerFont(fontPath, { family: familyName, weight: 'bold' });
            return familyName;
          }
        } catch (fontErr) {
          console.error('Error registering font:', fontErr);
        }
      }
    }
  } catch (err) {
    console.error('Error during font registration:', err);
  }
  return null;
}

registeredFontFamily = registerBundledFont();
console.log('Canvas library being used:', useNapi ? '@napi-rs/canvas' : 'canvas');
console.log('Final registered font family:', registeredFontFamily);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mmToPx(mm, dpi) {
  return (mm / 25.4) * dpi;
}

function truncateToMaxChars(text, maxChars) {
  const max = Math.max(0, Number(maxChars) || 0);
  if (max === 0) return '';
  if (!text) return '';
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  cut = cut.replace(/\s+$/g, '');
  return cut + '.';
}

function splitNameIntoTwoLines(name, maxLine1, maxLine2, defaults) {
  if (!name) return { line1: '', line2: '' };

  const max1 = Math.max(1, Number(maxLine1) || defaults.line1);
  const max2 = Math.max(1, Number(maxLine2) || defaults.line2);

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return { line1: truncateToMaxChars(words[0], max1), line2: '' };
  }

  const candidates = [];
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ');
    const l2 = words.slice(i).join(' ');
    candidates.push({ l1, l2, diff: Math.abs(l1.length - l2.length) });
  }
  const valid = candidates.filter((c) => c.l1.length <= max1 && c.l2.length <= max2);
  if (valid.length > 0) {
    valid.sort((a, b) => a.diff - b.diff);
    return { line1: valid[0].l1, line2: valid[0].l2 };
  }

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

  return { line1, line2 };
}

function parseExtraAnswers(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch (e) {
      console.error('parseExtraAnswers: invalid JSON', e && e.message);
      return null;
    }
  }
  return null;
}

/** Uma linha abaixo do nome a partir de extra_answers (regras de negócio). */
function displayLineFromExtraAnswers(obj) {
  if (!obj) return '';
  const area = String(obj[EXTRA_KEY_AREA] ?? '').trim();
  const unidade = String(obj[EXTRA_KEY_UNIDADE] ?? '').trim();
  if (area === 'Adm. Central/ Polos Regionais') return 'Adm. Central';
  if (area === 'Pós-Graduação') return 'Pós-Graduação';
  const a = area.toLowerCase();
  if (a === 'etec' || a === 'fatec') {
    return (unidade || area).trim();
  }
  return '';
}

function wrapSubtitleLines(ctx, text, maxWidth, fontSizePx, fontFamily) {
  ctx.font = `bold ${fontSizePx}px ${fontFamily}`;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : text ? [String(text)] : [];
}

function createCanvas(width, height) {
  return CanvasLib.createCanvas(width, height);
}

function getContext2d(canvas) {
  return canvas.getContext('2d');
}

async function renderBadgePng({
  name,
  qrText,
  subtitleLine,
  dpi,
  mmWidth,
  mmHeight,
  rotation,
  maxCharsLine1,
  maxCharsLine2,
}) {
  const layoutBase = LEGACY_LAYOUT_BASE;
  const clampedDpi = clamp(Number(dpi) || 300, MIN_DPI, MAX_DPI);
  const canvasWidthPx = Math.round(mmToPx(mmWidth, clampedDpi));
  const canvasHeightPx = Math.round(mmToPx(mmHeight, clampedDpi));

  const allowed = [0, 90, 180, 270];
  const rot = allowed.includes(rotation) ? rotation : 0;

  const contentWidth = canvasWidthPx;
  const contentHeight = canvasHeightPx;
  const contentCanvas = createCanvas(contentWidth, contentHeight);
  const ctx = getContext2d(contentCanvas);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, contentWidth, contentHeight);

  const scaleX = contentWidth / VIRTUAL_W;
  const scaleY = contentHeight / VIRTUAL_H;

  const topPaddingPx = 30;
  const bottomPaddingPx = 30;
  const sidePaddingPx = 0;
  const innerWidth = Math.max(0, contentWidth - sidePaddingPx * 2);
  const centerX = sidePaddingPx + innerWidth / 2;
  const lineGap = layoutBase.lineGap * scaleY;
  let afterTextGap = layoutBase.afterTextGap * scaleY;
  if (afterTextGap < 40) afterTextGap = 40;

  const uniformScale = Math.min(scaleX, scaleY);
  const qrRenderSize = Math.round((layoutBase.qrSize - 40) * uniformScale);
  const qrRenderClamped = Math.min(qrRenderSize, Math.floor(innerWidth));

  const { line1, line2 } = splitNameIntoTwoLines(name, maxCharsLine1, maxCharsLine2, {
    line1: DEFAULT_MAX_CHARS_LINE1,
    line2: DEFAULT_MAX_CHARS_LINE2,
  });

  const fontFamily = registeredFontFamily || 'Arial, Helvetica, DejaVuSans, sans-serif';
  const titleFontSize = Math.round(layoutBase.titleFont * uniformScale);
  const secondFontSize = Math.round(layoutBase.secondFont * uniformScale);
  const subRaw = typeof subtitleLine === 'string' ? subtitleLine.trim() : '';
  const hasSubtitle = subRaw.length > 0;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';

  const nameStartY = topPaddingPx + layoutBase.nameBlockTopOffset * scaleY;
  let y = nameStartY;

  if (line1) {
    ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillText(line1, centerX, y);
  }

  if (line2) {
    y += titleFontSize + lineGap;
    ctx.font = `bold ${secondFontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillText(line2, centerX, y);
    y += secondFontSize;
  } else if (line1) {
    y += titleFontSize + (lineGap + 30 * scaleY);
  }

  y += layoutBase.gapNameToSubtitle * scaleY;
  if (hasSubtitle) {
    const subFont = Math.max(8, Math.round(layoutBase.subtitleFont * uniformScale));
    const maxSubW = innerWidth * 0.92;
    const lines = wrapSubtitleLines(ctx, subRaw, maxSubW, subFont, fontFamily);
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    const lineStep = subFont * 1.2;
    for (const ln of lines) {
      ctx.font = `bold ${subFont}px ${fontFamily}`;
      ctx.fillText(ln, centerX, y);
      y += lineStep;
    }
  }

  y += afterTextGap;

  if (qrText) {
    const qrPngBuffer = await QRCode.toBuffer(qrText, {
      errorCorrectionLevel: 'M',
      margin: 0,
      color: { dark: '#000000', light: '#FFFFFF' },
      width: qrRenderSize,
      type: 'png',
    });

    const qrX = Math.round(sidePaddingPx + (innerWidth - qrRenderClamped) / 2);
    let qrY = Math.round(y);
    const reserveBelowQr = 0;
    const maxQrY = Math.max(
      topPaddingPx,
      Math.round(contentHeight - bottomPaddingPx - qrRenderClamped - reserveBelowQr)
    );
    if (qrY > maxQrY) qrY = maxQrY;

    const img = useNapi ? await CanvasLib.loadImage(qrPngBuffer) : new CanvasLib.Image();
    if (!useNapi) img.src = qrPngBuffer;
    ctx.drawImage(img, qrX, qrY, qrRenderClamped, qrRenderClamped);
  }

  const finalWidth = rot === 90 || rot === 270 ? contentHeight : contentWidth;
  const finalHeight = rot === 90 || rot === 270 ? contentWidth : contentHeight;
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
    finalCtx.rotate((3 * Math.PI) / 2);
  }
  finalCtx.drawImage(contentCanvas, 0, 0);
  finalCtx.restore();

  if (useNapi && typeof finalCanvas.encode === 'function') {
    return await finalCanvas.encode('png');
  }
  return finalCanvas.toBuffer('image/png');
}

module.exports = {
  renderBadgePng,
  parseExtraAnswers,
  displayLineFromExtraAnswers,
  splitNameIntoTwoLines,
  truncateToMaxChars,
  clamp,
  mmToPx,
};
