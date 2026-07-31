'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startDynamicEnabledServer } = require('./fakes/dynamicServerHarness');
const contextParticipants = require('./fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

const API_KEY = 'test-v2-api-key';

function readPngDimensions(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('POST /v2/badges/render', async (t) => {
  const server = await startDynamicEnabledServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
    apiKey: API_KEY,
  });
  t.after(() => server.close());

  await t.test('rejects requests without a Bearer token', async () => {
    const res = await server.requestPostPath('/v2/badges/render', {
      participant_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    });
    assert.equal(res.status, 401);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.equal(payload.code, 'UnauthorizedError');
  });

  await t.test('rejects requests with a wrong Bearer token', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
      { Authorization: 'Bearer wrong-key' }
    );
    assert.equal(res.status, 401);
  });

  await t.test('rejects a malformed payload (non-UUID participant_id) with 400', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: 'not-a-uuid' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 400);
  });

  await t.test('renders the published layout as base64 by default', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.equal(payload.success, true);
    assert.equal(payload.format, 'base64');
    const dims = readPngDimensions(Buffer.from(payload.data, 'base64'));
    assert.equal(dims.width, 945);
    assert.equal(dims.height, 591);
  });

  await t.test('renders raw PNG bytes when format=png', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: 'aaaaaaaa-0000-0000-0000-000000000002', format: 'png' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    const dims = readPngDimensions(res.body);
    assert.equal(dims.width, 945);
    assert.equal(dims.height, 591);
  });

  await t.test('returns 404 for a participant with no context (never falls back to legacy)', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: '00000000-0000-0000-0000-000000000000' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 404);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.equal(payload.code, 'ParticipantContextNotFoundError');
  });

  await t.test('returns 404 when the event has no published layout', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: 'aaaaaaaa-0000-0000-0000-000000000003' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 404);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.equal(payload.code, 'LayoutNotPublishedError');
  });
});

test('POST /v2/badges/render returns 503 when the dynamic engine is disabled', async (t) => {
  const server = await startDynamicEnabledServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
    apiKey: API_KEY,
    dynamicEnabled: false,
  });
  t.after(() => server.close());

  const res = await server.requestPostPath(
    '/v2/badges/render',
    { participant_id: 'aaaaaaaa-0000-0000-0000-000000000001' },
    { Authorization: `Bearer ${API_KEY}` }
  );
  assert.equal(res.status, 503);
});
