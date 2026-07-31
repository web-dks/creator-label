'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startLegacyServer } = require('./fakes/legacyServerHarness');

test('exceeding LABEL_RATE_LIMIT_MAX returns 429 as JSON (docs §23 "excesso de chamadas")', async (t) => {
  const server = await startLegacyServer({
    LABEL_RATE_LIMIT_WINDOW_MS: '60000',
    LABEL_RATE_LIMIT_MAX: '2',
  });
  t.after(() => server.close());

  const first = await server.requestGet({ name: 'Ana', format: 'png' });
  const second = await server.requestGet({ name: 'Ana', format: 'png' });
  const third = await server.requestGet({ name: 'Ana', format: 'png' });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  const payload = JSON.parse(third.body.toString('utf8'));
  assert.equal(payload.error, 'Too many requests, please try again later.');
});
