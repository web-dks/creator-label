'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateLayoutResponse } = require('../src/validators/layoutContractValidator');
const { LayoutInvalidError } = require('../src/utils/errors');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

test('layoutContractValidator', async (t) => {
  await t.test('accepts the real published layouts captured from credenciamento', () => {
    assert.doesNotThrow(() => validateLayoutResponse(layoutsByEventId['6']));
    assert.doesNotThrow(() => validateLayoutResponse(layoutsByEventId['33']));
  });

  await t.test('rejects wrong schemaVersion', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.schemaVersion = 2;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects wrong virtual canvas size', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.virtualWidth = 1000;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects more than 12 elements', () => {
    const layout = clone(layoutsByEventId['6']);
    const template = layout.layout_config.elements[0];
    layout.layout_config.elements = Array.from({ length: 13 }, (_, i) => ({
      ...template,
      id: `el-${i}`,
    }));
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects unsupported element type', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.elements[0].type = 'video';
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects text fontSize out of range', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.elements[0].fontSize = 500;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects text maxCharacters out of range', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.elements[0].maxCharacters = 1000;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects unsupported overflowStrategy', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.elements[0].overflowStrategy = 'marquee';
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects QR size outside 100-360', () => {
    const layout = clone(layoutsByEventId['6']);
    const qrElement = layout.layout_config.elements.find((e) => e.type === 'qr_code');
    qrElement.width = 50;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects unsupported QR errorCorrectionLevel', () => {
    const layout = clone(layoutsByEventId['6']);
    const qrElement = layout.layout_config.elements.find((e) => e.type === 'qr_code');
    qrElement.errorCorrectionLevel = 'X';
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects non-zero element rotation', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.layout_config.elements[0].rotation = 90;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects print_profile outside the homologated 80x50/300dpi profile', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.print_profile.dpi = 600;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects print_profile that does not support rotation 0', () => {
    const layout = clone(layoutsByEventId['6']);
    layout.print_profile.default_rotation = 90;
    layout.print_profile.supported_rotations = [90];
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });

  await t.test('rejects missing version_id', () => {
    const layout = clone(layoutsByEventId['6']);
    delete layout.version_id;
    assert.throws(() => validateLayoutResponse(layout), LayoutInvalidError);
  });
});
