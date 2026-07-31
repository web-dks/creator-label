'use strict';

/**
 * Golden comparison: SHA-256 first, RGBA pixel diff only when the hash
 * differs, and NEVER an automatic pass on visual differences (adjustment 4).
 */

const crypto = require('node:crypto');
const { loadImage, createCanvas } = require('@napi-rs/canvas');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function decodeToRgba(pngBuffer) {
  const img = await loadImage(pngBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, data };
}

async function diffPixels(expectedPng, actualPng) {
  const [expected, actual] = await Promise.all([decodeToRgba(expectedPng), decodeToRgba(actualPng)]);

  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      identical: false,
      reason: `dimension mismatch: expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`,
    };
  }

  let diffPixelCount = 0;
  let maxChannelDiff = 0;
  let sumChannelDiff = 0;
  const totalChannels = expected.data.length;

  for (let i = 0; i < totalChannels; i += 4) {
    const dr = Math.abs(expected.data[i] - actual.data[i]);
    const dg = Math.abs(expected.data[i + 1] - actual.data[i + 1]);
    const db = Math.abs(expected.data[i + 2] - actual.data[i + 2]);
    const da = Math.abs(expected.data[i + 3] - actual.data[i + 3]);
    const pixelMax = Math.max(dr, dg, db, da);
    if (pixelMax > 0) diffPixelCount += 1;
    if (pixelMax > maxChannelDiff) maxChannelDiff = pixelMax;
    sumChannelDiff += dr + dg + db + da;
  }

  return {
    identical: diffPixelCount === 0,
    diffPixelCount,
    totalPixels: totalChannels / 4,
    maxChannelDiff,
    meanChannelDiff: sumChannelDiff / totalChannels,
  };
}

/**
 * Compares one captured golden case against a freshly rendered PNG buffer.
 * Returns a report object; never mutates the golden manifest.
 */
async function compareGoldenPng(expectedPngBuffer, actualPngBuffer) {
  const expectedHash = sha256(expectedPngBuffer);
  const actualHash = sha256(actualPngBuffer);

  if (expectedHash === actualHash) {
    return { pass: true, method: 'sha256', expectedHash, actualHash };
  }

  const pixelReport = await diffPixels(expectedPngBuffer, actualPngBuffer);
  return {
    pass: false,
    method: 'rgba',
    expectedHash,
    actualHash,
    pixelReport,
  };
}

module.exports = { compareGoldenPng, sha256 };
