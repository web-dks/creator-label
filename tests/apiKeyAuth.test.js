'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Processo isolado por arquivo de teste: seguro configurar env antes de exigir.
process.env.LABEL_API_KEY = 'correct-horse-battery-staple';
const { env } = require('../src/config/env');
const { apiKeyAuthMiddleware } = require('../src/middleware/apiKeyAuth');

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('apiKeyAuthMiddleware calls next() for a correct Bearer token', () => {
  env.LABEL_API_KEY = 'correct-horse-battery-staple';
  const req = { headers: { authorization: 'Bearer correct-horse-battery-staple' } };
  const res = makeRes();
  let nextCalled = false;
  apiKeyAuthMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('apiKeyAuthMiddleware returns 401 for a wrong token', () => {
  env.LABEL_API_KEY = 'correct-horse-battery-staple';
  const req = { headers: { authorization: 'Bearer wrong-token' } };
  const res = makeRes();
  let nextCalled = false;
  apiKeyAuthMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'UnauthorizedError');
});

test('apiKeyAuthMiddleware returns 401 when the Authorization header is missing', () => {
  env.LABEL_API_KEY = 'correct-horse-battery-staple';
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;
  apiKeyAuthMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test('apiKeyAuthMiddleware returns 401 when the header is missing the Bearer prefix', () => {
  env.LABEL_API_KEY = 'correct-horse-battery-staple';
  const req = { headers: { authorization: 'correct-horse-battery-staple' } };
  const res = makeRes();
  apiKeyAuthMiddleware(req, res, () => {});
  assert.equal(res.statusCode, 401);
});

test('apiKeyAuthMiddleware fails closed when LABEL_API_KEY is not configured', () => {
  env.LABEL_API_KEY = '';
  const req = { headers: { authorization: 'Bearer anything' } };
  const res = makeRes();
  let nextCalled = false;
  apiKeyAuthMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  env.LABEL_API_KEY = 'correct-horse-battery-staple';
});
