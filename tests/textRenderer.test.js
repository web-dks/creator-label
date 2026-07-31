'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { applyMaxCharacters, wrapWithEllipsis, resolveFontFamily } = require('../src/renderers/textRenderer');

// ctx fake determinístico: cada caractere "pesa" 10px, independente da fonte.
function makeFakeCtx() {
  return { measureText: (text) => ({ width: text.length * 10 }) };
}

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
