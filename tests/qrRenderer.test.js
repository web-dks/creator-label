'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderQrElement } = require('../src/renderers/qrRenderer');
const { createCanvas, getContext2d } = require('../src/renderers/canvasRuntime');

const IDENTITY_SCALE = { scaleX: 1, scaleY: 1, uniformScale: 1 };

function countNonWhitePixels(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) count += 1;
  }
  return count;
}

for (const level of ['L', 'M', 'Q', 'H']) {
  test(`renderQrElement draws a square QR for errorCorrectionLevel=${level}`, async () => {
    const size = 60;
    const canvas = createCanvas(size, size);
    const ctx = getContext2d(canvas);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const element = { x: 0, y: 0, width: size, height: size, margin: 1, errorCorrectionLevel: level };
    await renderQrElement(ctx, element, 'aaaaaaaa-0000-0000-0000-000000000001', IDENTITY_SCALE);

    const darkPixels = countNonWhitePixels(ctx, size, size);
    assert.ok(darkPixels > 0, `expected level ${level} to draw some dark pixels`);
  });
}

test('renderQrElement draws nothing when qrValue is empty', async () => {
  const size = 40;
  const canvas = createCanvas(size, size);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  await renderQrElement(ctx, { x: 0, y: 0, width: size, height: size }, '', IDENTITY_SCALE);

  assert.equal(countNonWhitePixels(ctx, size, size), 0);
});

test('renderQrElement centers a square QR within a non-square box', async () => {
  const width = 100;
  const height = 60;
  const canvas = createCanvas(width, height);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  await renderQrElement(
    ctx,
    { x: 0, y: 0, width, height, margin: 0 },
    'aaaaaaaa-0000-0000-0000-000000000001',
    IDENTITY_SCALE
  );

  // A régua deve caber no menor lado (height=60) e ficar centralizada em x.
  const { data } = ctx.getImageData(0, 0, width, height);
  const isDarkAt = (x, y) => {
    const idx = (y * width + x) * 4;
    return data[idx] !== 255 || data[idx + 1] !== 255 || data[idx + 2] !== 255;
  };
  let hasDarkOutsideSquare = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 20; x += 1) {
      if (isDarkAt(x, y)) hasDarkOutsideSquare = true;
    }
    for (let x = width - 20; x < width; x += 1) {
      if (isDarkAt(x, y)) hasDarkOutsideSquare = true;
    }
  }
  assert.equal(hasDarkOutsideSquare, false, 'expected the side margins to remain blank (QR centered)');
});
