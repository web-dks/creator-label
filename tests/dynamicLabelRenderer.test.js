'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Roda em processo isolado; sem allowlist configurada, event.label_logo
// aponta para um host inexistente na allowlist — a imagem deve ser
// simplesmente omitida (nunca aciona fallback total).
process.env.LABEL_LOGO_ALLOWED_HOSTS = '';
process.env.SUPABASE_URL = '';

const { renderDynamicLabelPng, computeScale } = require('../src/renderers/dynamicLabelRenderer');
const { validateLayoutResponse } = require('../src/validators/layoutContractValidator');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

function readPngDimensions(buffer) {
  // IHDR chunk: width/height são os 8 bytes logo após a assinatura PNG + "IHDR".
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('computeScale converts the homologated 80x50mm/300dpi profile to px', () => {
  const scale = computeScale({ width_mm: 80, height_mm: 50, dpi: 300 });
  assert.equal(scale.widthPx, 945);
  assert.equal(scale.heightPx, 591);
});

test('renderDynamicLabelPng renders a full layout (text + qr + image) to a valid PNG', async () => {
  const layoutResponse = validateLayoutResponse(layoutsByEventId['6']);
  const labelData = labelDataByParticipantId['aaaaaaaa-0000-0000-0000-000000000001'];

  const png = await renderDynamicLabelPng(layoutResponse, labelData, { requestId: 'test-req-1' });

  assert.ok(Buffer.isBuffer(png));
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.subarray(0, 8).equals(pngSignature), 'expected a valid PNG signature');
  const dims = readPngDimensions(png);
  assert.equal(dims.width, 945);
  assert.equal(dims.height, 591);
});

test('renderDynamicLabelPng renders layout without a logo element', async () => {
  const layoutResponse = validateLayoutResponse(layoutsByEventId['33']);
  const labelData = labelDataByParticipantId['aaaaaaaa-0000-0000-0000-000000000002'];

  const png = await renderDynamicLabelPng(layoutResponse, labelData);
  const dims = readPngDimensions(png);
  assert.equal(dims.width, 945);
  assert.equal(dims.height, 591);
});

test('renderDynamicLabelPng uses fallbackValue when a custom field is missing', async () => {
  const layoutResponse = validateLayoutResponse(layoutsByEventId['33']);
  const labelData = {
    event: { id: 33, label_logo: null },
    participant: { id: 'zzzz', name: 'Sem Campo' },
    customFields: {},
  };

  const png = await renderDynamicLabelPng(layoutResponse, labelData);
  assert.ok(png.length > 0);
});

test('renderDynamicLabelPng skips isVisible:false elements without failing', async () => {
  const base = validateLayoutResponse(layoutsByEventId['6']);
  const layoutResponse = {
    ...base,
    layout_config: {
      ...base.layout_config,
      elements: base.layout_config.elements.map((el) => ({ ...el, isVisible: false })),
    },
  };
  const labelData = labelDataByParticipantId['aaaaaaaa-0000-0000-0000-000000000001'];

  const png = await renderDynamicLabelPng(layoutResponse, labelData);
  const dims = readPngDimensions(png);
  assert.equal(dims.width, 945);
  assert.equal(dims.height, 591);
});
