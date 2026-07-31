'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { timingSafeEqualStrings } = require('../src/utils/timingSafeEqual');

test('timingSafeEqualStrings returns true only for identical strings', () => {
  assert.equal(timingSafeEqualStrings('super-secret-key', 'super-secret-key'), true);
});

test('timingSafeEqualStrings returns false for different strings, including different lengths', () => {
  assert.equal(timingSafeEqualStrings('super-secret-key', 'super-secret-keyX'), false);
  assert.equal(timingSafeEqualStrings('abc', 'abd'), false);
  assert.equal(timingSafeEqualStrings('short', 'a-much-longer-secret-value'), false);
});

test('timingSafeEqualStrings rejects empty or non-string inputs without throwing', () => {
  assert.equal(timingSafeEqualStrings('', ''), false);
  assert.equal(timingSafeEqualStrings('', 'abc'), false);
  assert.equal(timingSafeEqualStrings('abc', ''), false);
  assert.equal(timingSafeEqualStrings(undefined, 'abc'), false);
  assert.equal(timingSafeEqualStrings('abc', null), false);
});
