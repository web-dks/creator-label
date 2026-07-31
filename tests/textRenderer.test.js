'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyMaxCharacters, wrapWithEllipsis, resolveFontFamily, renderTextElement } = require('../src/renderers/textRenderer');

// ctx fake determinístico: cada caractere "pesa" 10px, independente da fonte.
function makeFakeCtx() {
  return { measureText: (text) => ({ width: text.length * 10 }) };
}

// ctx fake que registra fillText e mede largura proporcional ao tamanho de
// fonte atual (extraído de `ctx.font`), para exercitar shrink/truncate/hide.
function makeRecordingCtx() {
  const calls = { fillText: [] };
  const ctx = {
    _font: '16px Arial',
    fillStyle: null,
    textAlign: null,
    textBaseline: null,
    get font() {
      return this._font;
    },
    set font(value) {
      this._font = value;
    },
    measureText(text) {
      const match = /([\d.]+)px/.exec(this._font);
      const size = match ? parseFloat(match[1]) : 16;
      return { width: text.length * size * 0.6 };
    },
    fillText(text, x, y) {
      calls.fillText.push({ text, x, y, font: this._font });
    },
  };
  return { ctx, calls };
}

const IDENTITY_SCALE = { scaleX: 1, scaleY: 1, uniformScale: 1 };

test('applyMaxCharacters keeps short text untouched', () => {
  assert.equal(applyMaxCharacters('abc', 10), 'abc');
});

test('applyMaxCharacters truncates and appends ellipsis, never exceeding the limit', () => {
  const result = applyMaxCharacters('abcdefghij', 5);
  assert.equal(result, 'abcd…');
  assert.ok(result.length <= 5);
});

test('applyMaxCharacters is a no-op for invalid limits', () => {
  assert.equal(applyMaxCharacters('abcdef', 0), 'abcdef');
  assert.equal(applyMaxCharacters('abcdef', undefined), 'abcdef');
});

test('wrapWithEllipsis breaks on word boundaries respecting maxWidth', () => {
  const ctx = makeFakeCtx();
  // Cada palavra tem 3 letras; "aaa bbb" mede exatamente 70px (7 chars * 10px).
  const lines = wrapWithEllipsis(ctx, 'aaa bbb ccc ddd', 70, 4);
  assert.deepEqual(lines, ['aaa bbb', 'ccc ddd']);
});

test('wrapWithEllipsis truncates the last line with ellipsis when exceeding maxLines', () => {
  const ctx = makeFakeCtx();
  const lines = wrapWithEllipsis(ctx, 'aaa bbb ccc ddd eee', 40, 1);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].endsWith('…'));
});

test('wrapWithEllipsis returns an empty array for blank text', () => {
  const ctx = makeFakeCtx();
  assert.deepEqual(wrapWithEllipsis(ctx, '', 100, 2), []);
});

test('resolveFontFamily falls back to Arial for unsupported font families', () => {
  assert.equal(resolveFontFamily('ComicSans', 'Arial'), 'Arial');
  assert.equal(resolveFontFamily('Arial', 'Arial'), 'Arial');
  assert.equal(resolveFontFamily(undefined, null), 'Arial');
});

test('renderTextElement (shrink) reduces the font size until the text fits within maxLines', () => {
  const { ctx, calls } = makeRecordingCtx();
  const element = {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    fontSize: 40,
    minFontSize: 10,
    maxLines: 1,
    maxCharacters: 100,
    overflowStrategy: 'shrink',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'left',
  };
  renderTextElement(ctx, element, 'Hello World', IDENTITY_SCALE, 'Arial');

  assert.equal(calls.fillText.length, 1);
  assert.equal(calls.fillText[0].text, 'Hello World');
  assert.equal(calls.fillText[0].font, '15px Arial');
});

test('renderTextElement (hide) draws nothing when the text does not fit', () => {
  const { ctx, calls } = makeRecordingCtx();
  const element = {
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    fontSize: 40,
    minFontSize: 40,
    maxLines: 1,
    maxCharacters: 100,
    overflowStrategy: 'hide',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'left',
  };
  renderTextElement(ctx, element, 'Hello World', IDENTITY_SCALE, 'Arial');
  assert.equal(calls.fillText.length, 0);
});

test('renderTextElement (truncate) keeps the fixed font size and ellipsizes what does not fit', () => {
  const { ctx, calls } = makeRecordingCtx();
  const element = {
    x: 0,
    y: 0,
    width: 60,
    height: 50,
    fontSize: 20,
    minFontSize: 20,
    maxLines: 1,
    maxCharacters: 100,
    overflowStrategy: 'truncate',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'left',
  };
  renderTextElement(ctx, element, 'Hello World', IDENTITY_SCALE, 'Arial');

  assert.equal(calls.fillText.length, 1);
  assert.equal(calls.fillText[0].font, '20px Arial');
  assert.ok(calls.fillText[0].text.endsWith('…'));
  assert.ok(calls.fillText[0].text.length < 'Hello World'.length);
});
