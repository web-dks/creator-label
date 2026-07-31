'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBadgeV2Payload } = require('../src/validators/requestValidator');
const { InvalidRequestError } = require('../src/utils/errors');

const VALID_UUID = 'aaaaaaaa-0000-0000-0000-000000000001';

test('validateBadgeV2Payload accepts a valid payload and defaults format to base64', () => {
  const result = validateBadgeV2Payload({ participant_id: VALID_UUID });
  assert.deepEqual(result, { participantId: VALID_UUID, outputFormat: 'base64' });
});

test('validateBadgeV2Payload accepts an explicit format of png', () => {
  const result = validateBadgeV2Payload({ participant_id: VALID_UUID, format: 'png' });
  assert.equal(result.outputFormat, 'png');
});

test('validateBadgeV2Payload trims and lowercases format', () => {
  const result = validateBadgeV2Payload({ participant_id: VALID_UUID, format: 'PNG' });
  assert.equal(result.outputFormat, 'png');
});

test('validateBadgeV2Payload rejects a missing or empty body', () => {
  assert.throws(() => validateBadgeV2Payload(undefined), InvalidRequestError);
  assert.throws(() => validateBadgeV2Payload(null), InvalidRequestError);
  assert.throws(() => validateBadgeV2Payload([]), InvalidRequestError);
});

test('validateBadgeV2Payload rejects a non-UUID participant_id', () => {
  assert.throws(() => validateBadgeV2Payload({ participant_id: 'not-a-uuid' }), InvalidRequestError);
  assert.throws(() => validateBadgeV2Payload({}), InvalidRequestError);
});

test('validateBadgeV2Payload rejects an unsupported format', () => {
  assert.throws(() => validateBadgeV2Payload({ participant_id: VALID_UUID, format: 'svg' }), InvalidRequestError);
});
