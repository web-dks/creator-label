'use strict';

const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createFakeDynamicSupabaseServer } = require('./fakeDynamicSupabaseServer');

const REPO_ROOT = path.join(__dirname, '..', '..');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(port, attempts = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (left <= 0) return reject(new Error('dynamic server did not start in time'));
        setTimeout(() => tryOnce(left - 1), 200);
      });
      req.on('timeout', () => {
        req.destroy();
        if (left <= 0) return reject(new Error('dynamic server did not start in time'));
        setTimeout(() => tryOnce(left - 1), 200);
      });
    };
    tryOnce(attempts);
  });
}

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Sobe `index.js` de verdade (sem SUPABASE_KEY legado configurado) com a
 * flag do motor dinâmico ligada e apontando para um fakeDynamicSupabaseServer
 * local — exercita a rota `/badge` ponta a ponta com o roteamento
 * dinâmico/legado real, sem tocar em nenhum Supabase de verdade.
 */
async function startDynamicEnabledServer({
  participants = [],
  layoutsByEventId = {},
  labelDataByParticipantId = {},
  eventIdAllowlist = '',
} = {}) {
  const fakeDb = await createFakeDynamicSupabaseServer({ participants, layoutsByEventId, labelDataByParticipantId });
  const port = await getFreePort();

  const child = spawn(process.execPath, ['index.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      SUPABASE_URL: fakeDb.url,
      SUPABASE_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: 'local-fake-service-role-key',
      SUPABASE_PARTICIPANTS_TABLE: 'participants',
      SUPABASE_SCHEMA: 'public',
      LABEL_DYNAMIC_LAYOUT_ENABLED: 'true',
      LABEL_DYNAMIC_EVENT_IDS: eventIdAllowlist,
      LABEL_LOGO_ALLOWED_HOSTS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stderrChunks = [];
  child.stderr.on('data', (d) => stderrChunks.push(d));

  await waitForServer(port);

  return {
    port,
    async requestGet(params) {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString();
      return requestJson({ host: '127.0.0.1', port, path: `/badge?${qs}`, method: 'GET' });
    },
    async close() {
      child.kill();
      await fakeDb.close();
    },
    getStderr() {
      return Buffer.concat(stderrChunks).toString('utf8');
    },
  };
}

module.exports = { startDynamicEnabledServer };
