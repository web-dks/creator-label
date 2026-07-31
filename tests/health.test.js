'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startLegacyServer } = require('./fakes/legacyServerHarness');

test('GET /health reports service status and dynamic flag', async (t) => {
  const server = await startLegacyServer();
  t.after(() => server.close());

  const res = await server.requestGetPath('/health');
  assert.equal(res.status, 200);
  const json = JSON.parse(res.body.toString('utf8'));
  assert.equal(json.status, 'ok');
  assert.equal(json.service, 'creator-label');
  assert.equal(typeof json.version, 'string');
  assert.equal(json.dynamic_layout_enabled, false);
});
