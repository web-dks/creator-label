'use strict';

/**
 * Bootstrap único do canvas nativo e da fonte bundlada, compartilhado
 * pelo renderer legado e pelo motor dinâmico. Extraído de index.js
 * (Fase 1/2) sem alterar o comportamento de registro de fonte.
 */

const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../config/constants');

let CanvasLib;
let useNapi = false;

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

const registeredFontFamily = registerBundledFont();
console.log('Canvas library being used:', useNapi ? '@napi-rs/canvas' : 'canvas');
console.log('Final registered font family:', registeredFontFamily);

function createCanvas(width, height) {
  return CanvasLib.createCanvas(width, height);
}

function getContext2d(canvas) {
  return canvas.getContext('2d');
}

async function loadImage(buffer) {
  if (useNapi) return CanvasLib.loadImage(buffer);
  const img = new CanvasLib.Image();
  img.src = buffer;
  return img;
}

async function encodePng(canvas) {
  if (useNapi && typeof canvas.encode === 'function') {
    return canvas.encode('png');
  }
  return canvas.toBuffer('image/png');
}

module.exports = {
  CanvasLib,
  useNapi,
  registeredFontFamily,
  createCanvas,
  getContext2d,
  loadImage,
  encodePng,
};
