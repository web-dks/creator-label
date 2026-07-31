'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startDynamicEnabledServer } = require('./fakes/dynamicServerHarness');
const contextParticipants = require('./fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

function readPngDimensions(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('GET /badge end-to-end with LABEL_DYNAMIC_LAYOUT_ENABLED=true', async (t) => {
  const server = await startDynamicEnabledServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
  });
  t.after(() => server.close());

  await t.test('renders the dynamic layout (945x591) for a participant with a published layout', async () => {
    const res = await server.requestGet({ qr: 'aaaaaaaa-0000-0000-0000-000000000001' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    const dims = readPngDimensions(res.body);
    assert.equal(dims.width, 945);
    assert.equal(dims.height, 591);
  });

  await t.test('honors format=base64 using the exact legacy envelope shape', async () => {
    const res = await server.requestGet({ qr: 'aaaaaaaa-0000-0000-0000-000000000002', format: 'base64' });
    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.deepEqual(Object.keys(payload).sort(), ['data', 'dataUri', 'format', 'mimeType', 'success']);
    assert.equal(payload.success, true);
    assert.equal(payload.format, 'base64');
    assert.equal(payload.mimeType, 'image/png');
    const dims = readPngDimensions(Buffer.from(payload.data, 'base64'));
    assert.equal(dims.width, 945);
    assert.equal(dims.height, 591);
  });

  await t.test('falls back to the legacy 400 contract when the participant is unknown and no name is given', async () => {
    const res = await server.requestGet({ qr: '00000000-0000-0000-0000-000000000000' });
    assert.equal(res.status, 400);
    const payload = JSON.parse(res.body.toString('utf8'));
    assert.deepEqual(payload, { error: 'Missing required parameter: name' });
  });

  await t.test('falls back to the legacy renderer when event_id has no published layout', async () => {
    const res = await server.requestGet({ qr: 'aaaaaaaa-0000-0000-0000-000000000003', name: 'Fallback Legado' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');

    // Ambos os renderers produzem o mesmo tamanho físico final (80x50mm/
    // 300dpi), então a evidência do fallback vem do log estruturado, não
    // das dimensões do PNG.
    let stderr = '';
    for (let attempt = 0; attempt < 20 && !stderr.includes('badge-service:dynamic-fallback'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      stderr = server.getStderr();
    }
    assert.ok(stderr.includes('badge-service:dynamic-fallback'), 'expected a dynamic-fallback log line');
    assert.ok(stderr.includes('LayoutNotPublishedError'), 'expected LayoutNotPublishedError as the fallback reason');
  });
});
