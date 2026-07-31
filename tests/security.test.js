'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startLegacyServer } = require('./fakes/legacyServerHarness');

function requestRaw(port, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, ...options }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('security middleware on the legacy route', async (t) => {
  const server = await startLegacyServer();
  t.after(() => server.close());

  await t.test('helmet sets defensive headers', async () => {
    const res = await server.requestGet({ name: 'Ana', format: 'png' });
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-dns-prefetch-control'], 'off');
  });

  await t.test('CORS reflects the request origin explicitly', async () => {
    const res = await requestRaw(server.port, {
      path: '/badge?name=Ana&format=png',
      method: 'GET',
      headers: { Origin: 'https://example.com' },
    });
    assert.equal(res.headers['access-control-allow-origin'], 'https://example.com');
  });

  await t.test('every response carries a request id', async () => {
    const res = await server.requestGet({ name: 'Ana', format: 'png' });
    assert.ok(res.headers['x-request-id']);
  });

  await t.test('rate limit headers are present', async () => {
    const res = await server.requestGet({ name: 'Ana', format: 'png' });
    assert.ok(res.headers['ratelimit-limit']);
  });

  await t.test('oversized JSON payload is rejected with 413 as JSON, not HTML', async () => {
    const bigValue = 'a'.repeat(200 * 1024);
    const payload = Buffer.from(JSON.stringify({ name: 'Ana', format: 'png', junk: bigValue }));
    const res = await requestRaw(
      server.port,
      {
        path: '/badge',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length },
      },
      payload
    );
    assert.equal(res.status, 413);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.equal(json.error, 'Payload too large');
  });

  await t.test('malformed JSON payload is rejected with 400 as JSON, not HTML', async () => {
    const payload = Buffer.from('{ not valid json');
    const res = await requestRaw(
      server.port,
      {
        path: '/badge',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length },
      },
      payload
    );
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.equal(json.error, 'Invalid JSON payload');
  });
});
