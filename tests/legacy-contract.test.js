'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { startLegacyServer } = require('./fakes/legacyServerHarness');
const { CASES } = require('./fixtures/golden-cases');
const { compareGoldenPng, sha256 } = require('../scripts/compare-golden');

const GOLDEN_DIR = path.join(__dirname, '..', 'golden');
const MANIFEST_PATH = path.join(GOLDEN_DIR, 'manifest.json');

function loadManifest() {
  assert.ok(
    fs.existsSync(MANIFEST_PATH),
    'golden/manifest.json not found - run "npm run golden:capture" once before testing'
  );
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function extractPngBuffer(res, isBase64) {
  if (!isBase64) return res.body;
  const json = JSON.parse(res.body.toString('utf8'));
  return Buffer.from(json.data, 'base64');
}

test('legacy /badge contract and golden baseline', async (t) => {
  const manifest = loadManifest();
  const server = await startLegacyServer();

  t.after(() => server.close());

  for (const testCase of CASES) {
    await t.test(`GET /badge — ${testCase.name} matches golden baseline`, async () => {
      const res = await server.requestGet(testCase.params);
      assert.equal(res.status, 200, `unexpected status; stderr=${server.getStderr()}`);

      const isBase64 = testCase.params.format === 'base64';
      const expectedPng = fs.readFileSync(path.join(GOLDEN_DIR, `${testCase.name}.png`));
      const actualPng = extractPngBuffer(res, isBase64);

      const report = await compareGoldenPng(expectedPng, actualPng);
      assert.equal(
        report.pass,
        true,
        `golden mismatch for "${testCase.name}": ${JSON.stringify(report)}`
      );
      assert.equal(
        sha256(actualPng),
        manifest.cases[testCase.name].pngSha256,
        `pngSha256 in manifest no longer matches for "${testCase.name}"`
      );
    });

    await t.test(`POST /badge — ${testCase.name} is pixel-identical to GET`, async () => {
      const getRes = await server.requestGet(testCase.params);
      const postRes = await server.requestPost(testCase.params);
      assert.equal(postRes.status, 200);

      const isBase64 = testCase.params.format === 'base64';
      const getPng = extractPngBuffer(getRes, isBase64);
      const postPng = extractPngBuffer(postRes, isBase64);
      assert.equal(sha256(postPng), sha256(getPng), 'GET and POST produced different images');
    });
  }

  await t.test('PNG response has the exact legacy headers', async () => {
    const res = await server.requestGet({
      qr: '11111111-1111-1111-1111-111111111111',
      dpi: 300,
      rotation: 0,
      format: 'png',
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    assert.equal(res.headers['content-disposition'], 'inline; filename="badge.png"');
  });

  await t.test('Base64 response has the exact legacy envelope shape', async () => {
    const res = await server.requestGet({
      qr: '11111111-1111-1111-1111-111111111111',
      dpi: 300,
      rotation: 0,
      format: 'base64',
    });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.deepEqual(Object.keys(json).sort(), ['data', 'dataUri', 'format', 'mimeType', 'success']);
    assert.equal(json.success, true);
    assert.equal(json.format, 'base64');
    assert.equal(json.mimeType, 'image/png');
    assert.equal(json.dataUri, `data:image/png;base64,${json.data}`);
    assert.match(json.data, /^[A-Za-z0-9+/]+=*$/);
  });

  await t.test('missing name without resolvable participant returns 400 with the exact legacy message', async () => {
    const res = await server.requestGet({ dpi: 300 });
    assert.equal(res.status, 400);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.deepEqual(json, { error: 'Missing required parameter: name' });
  });

  await t.test('invalid/out-of-range dpi is clamped instead of crashing (docs §23 "DPI inválido")', async () => {
    const tooHigh = await server.requestGet({ name: 'DPI Alto', dpi: 999999 });
    assert.equal(tooHigh.status, 200, `unexpected status; stderr=${server.getStderr()}`);
    assert.equal(tooHigh.headers['content-type'], 'image/png');

    const negative = await server.requestGet({ name: 'DPI Negativo', dpi: -50 });
    assert.equal(negative.status, 200);
    assert.equal(negative.headers['content-type'], 'image/png');

    const notANumber = await server.requestGet({ name: 'DPI Inválido', dpi: 'not-a-number' });
    assert.equal(notANumber.status, 200);
    assert.equal(notANumber.headers['content-type'], 'image/png');
  });

  await t.test('Supabase indisponível: /badge segue funcionando com o name recebido (docs §23 "Supabase indisponível")', async () => {
    const res = await server.requestGet({
      name: 'Nome Enviado Direto',
      qr: 'SERVER_ERROR',
      dpi: 300,
      format: 'base64',
    });
    assert.equal(res.status, 200, `unexpected status; stderr=${server.getStderr()}`);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.equal(json.success, true);
  });

  await t.test('unknown participant omits the QR but still renders the requested name', async () => {
    const res = await server.requestGet({
      name: 'Nome Enviado',
      qr: '99999999-9999-9999-9999-999999999999',
      dpi: 300,
      format: 'base64',
    });
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body.toString('utf8'));
    assert.equal(json.success, true);
  });
});
