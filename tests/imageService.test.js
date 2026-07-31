'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { URL } = require('node:url');

// Este arquivo roda em processo isolado (um processo por arquivo de teste),
// então é seguro configurar process.env antes de exigir o serviço.
process.env.LABEL_LOGO_ALLOWED_HOSTS = 'cdn.example.com';
process.env.SUPABASE_URL = '';

const { fetchLogoImage } = require('../src/services/imageService');
const { LogoFetchError } = require('../src/utils/errors');
const { createCanvas, getContext2d, encodePng, useNapi } = require('../src/renderers/canvasRuntime');
const { LOGO_MAX_BYTES, LOGO_MAX_DIMENSION_PX } = require('../src/config/constants');

async function buildPngBuffer(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = '#3366FF';
  ctx.fillRect(0, 0, width, height);
  return encodePng(canvas);
}

async function buildJpegBuffer(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = '#3366FF';
  ctx.fillRect(0, 0, width, height);
  return useNapi ? canvas.encode('jpeg') : encodePng(canvas);
}

async function buildWebpBuffer(width, height) {
  const canvas = createCanvas(width, height);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = '#3366FF';
  ctx.fillRect(0, 0, width, height);
  return useNapi ? canvas.encode('webp') : encodePng(canvas);
}

async function startFakeOriginServer() {
  const goodPng = await buildPngBuffer(20, 10);
  const goodJpeg = await buildJpegBuffer(20, 10);
  const goodWebp = await buildWebpBuffer(20, 10);
  const oversizedBody = Buffer.concat([goodPng, Buffer.alloc(LOGO_MAX_BYTES)]);
  const hugeDimensionsPng = await buildPngBuffer(LOGO_MAX_DIMENSION_PX + 1, 4);

  const server = http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/good.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(goodPng);
    }
    if (pathname === '/good.jpg') {
      res.writeHead(200, { 'content-type': useNapi ? 'image/jpeg' : 'image/png' });
      return res.end(goodJpeg);
    }
    if (pathname === '/good.webp') {
      res.writeHead(200, { 'content-type': useNapi ? 'image/webp' : 'image/png' });
      return res.end(goodWebp);
    }
    if (pathname === '/mime-mismatch.png') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(goodPng);
    }
    if (pathname === '/fake-mime.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(Buffer.from('not actually an image'));
    }
    if (pathname === '/too-large') {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(oversizedBody.length) });
      return res.end(oversizedBody);
    }
    if (pathname === '/too-big-dimensions') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end(hugeDimensionsPng);
    }
    if (pathname === '/redirect-once') {
      res.writeHead(302, { location: '/good.png' });
      return res.end();
    }
    if (pathname === '/redirect-loop-1') {
      res.writeHead(302, { location: '/redirect-loop-2' });
      return res.end();
    }
    if (pathname === '/redirect-loop-2') {
      res.writeHead(302, { location: '/good.png' });
      return res.end();
    }
    if (pathname === '/redirect-to-disallowed') {
      res.writeHead(302, { location: 'https://evil.example.com/good.png' });
      return res.end();
    }
    if (pathname === '/empty') {
      res.writeHead(200, { 'content-type': 'image/png' });
      return res.end();
    }
    if (pathname === '/hang') {
      // nunca responde: exercita o timeout de LOGO_FETCH_TIMEOUT_MS
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, port, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Redireciona a URL "https://<host>/<path>" fake para o servidor local em http. */
function makeRewritingFetch(port) {
  return (url, options) => {
    const target = new URL(url);
    const rewritten = new URL(`${target.pathname}${target.search}`, `http://127.0.0.1:${port}`);
    return fetch(rewritten, options);
  };
}

function makePublicDnsLookup() {
  return async () => [{ address: '93.184.216.34', family: 4 }];
}

function makePrivateDnsLookup() {
  return async () => [{ address: '127.0.0.1', family: 4 }];
}

test('imageService.fetchLogoImage', async (t) => {
  const origin = await startFakeOriginServer();
  t.after(() => origin.close());

  const deps = { fetch: makeRewritingFetch(origin.port), dnsLookup: makePublicDnsLookup() };

  await t.test('accepts a valid PNG and reports real dimensions', async () => {
    const result = await fetchLogoImage('https://cdn.example.com/good.png', deps);
    assert.equal(result.mimeType, 'image/png');
    assert.equal(result.width, 20);
    assert.equal(result.height, 10);
  });

  if (useNapi) {
    await t.test('accepts a valid JPEG', async () => {
      const result = await fetchLogoImage('https://cdn.example.com/good.jpg', deps);
      assert.equal(result.mimeType, 'image/jpeg');
    });

    await t.test('accepts a valid WebP', async () => {
      const result = await fetchLogoImage('https://cdn.example.com/good.webp', deps);
      assert.equal(result.mimeType, 'image/webp');
    });
  }

  await t.test('rejects http:// (non-https) URLs', async () => {
    await assert.rejects(() => fetchLogoImage('http://cdn.example.com/good.png', deps), LogoFetchError);
  });

  await t.test('rejects hosts outside the allowlist', async () => {
    await assert.rejects(() => fetchLogoImage('https://not-allowed.example.com/good.png', deps), LogoFetchError);
  });

  await t.test('rejects when DNS resolves to a private/reserved IP (SSRF)', async () => {
    const privateDeps = { fetch: makeRewritingFetch(origin.port), dnsLookup: makePrivateDnsLookup() };
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/good.png', privateDeps), LogoFetchError);
  });

  await t.test('rejects a declared Content-Type that does not match the real bytes', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/mime-mismatch.png', deps), LogoFetchError);
  });

  await t.test('rejects a fake image (wrong magic bytes) regardless of declared MIME', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/fake-mime.png', deps), LogoFetchError);
  });

  await t.test('rejects bodies larger than the 2MB limit', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/too-large', deps), LogoFetchError);
  });

  await t.test('rejects images with excessive dimensions', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/too-big-dimensions', deps), LogoFetchError);
  });

  await t.test('rejects an empty response body', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/empty', deps), LogoFetchError);
  });

  await t.test('follows a single same-host redirect', async () => {
    const result = await fetchLogoImage('https://cdn.example.com/redirect-once', deps);
    assert.equal(result.mimeType, 'image/png');
  });

  await t.test('rejects more than one redirect hop', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/redirect-loop-1', deps), LogoFetchError);
  });

  await t.test('rejects a redirect to a host outside the allowlist', async () => {
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/redirect-to-disallowed', deps), LogoFetchError);
  });

  await t.test('times out around LOGO_FETCH_TIMEOUT_MS when the origin never responds', async () => {
    const startedAt = Date.now();
    await assert.rejects(() => fetchLogoImage('https://cdn.example.com/hang', deps), LogoFetchError);
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs < 2500, `expected timeout around 2000ms, took ${elapsedMs}ms`);
  });
});
