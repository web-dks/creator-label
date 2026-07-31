'use strict';

/**
 * Medição de performance do fluxo dinâmico (docs/03-spec-creator-label-
 * motor-dinamico-atualizada.md §23 "Performance"). Sobe a aplicação real em
 * processo (mesmo `src/app.js` usado em produção) contra um Supabase
 * dinâmico fake local — as mesmas fixtures usadas em tests/ — e mede os 4
 * cenários pedidos: 1 request, 10 sequenciais, 10 simultâneas e 50
 * controladas (concorrência limitada). Não faz parte de `npm test`; é um
 * script manual de diagnóstico usado apenas para o gate de validação.
 *
 * Uso:
 *   node scripts/perf-check.js [--out docs/perf-results.json]
 *
 * Os números são indicativos do ambiente local onde rodam (não são um SLA
 * de produção), mas servem para detectar regressões grosseiras e documentar
 * o comportamento de cache/fallback exigido pelo plano.
 */

process.env.LABEL_DYNAMIC_LAYOUT_ENABLED = 'true';
process.env.LABEL_DYNAMIC_EVENT_IDS = '';
process.env.LABEL_LOGO_ALLOWED_HOSTS = '';
process.env.SUPABASE_KEY = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'perf-fake-service-role-key';
process.env.SUPABASE_PARTICIPANTS_TABLE = 'participants';
process.env.SUPABASE_SCHEMA = 'public';
process.env.LABEL_RATE_LIMIT_MAX = '100000';
process.env.LABEL_CONCURRENCY_LIMIT = '50';
process.env.NODE_ENV = 'production';

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { createFakeDynamicSupabaseServer } = require('../tests/fakes/fakeDynamicSupabaseServer');
const contextParticipants = require('../tests/fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('../tests/fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('../tests/fixtures/dynamic/label-data.json');

const PARTICIPANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NO_LAYOUT_PARTICIPANT_ID = 'aaaaaaaa-0000-0000-0000-000000000003';

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[idx];
}

function summarize(label, latenciesMs, sizesBytes) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const avg = latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length;
  const avgSize = sizesBytes.reduce((a, b) => a + b, 0) / sizesBytes.length;
  return {
    label,
    count: latenciesMs.length,
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    minMs: Number(sorted[0].toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
    avgResponseBytes: Math.round(avgSize),
  };
}

function timedRequest(port, requestPath) {
  const startedAt = process.hrtime.bigint();
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: requestPath }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
          resolve({ ms, bytes: Buffer.concat(chunks).length, status: res.statusCode });
        });
      })
      .on('error', reject);
  });
}

function runControlled(port, requestPath, total, concurrency) {
  const results = [];
  let inFlight = 0;
  let launched = 0;
  return new Promise((resolve, reject) => {
    function tryLaunch() {
      while (inFlight < concurrency && launched < total) {
        launched += 1;
        inFlight += 1;
        timedRequest(port, requestPath)
          .then((r) => {
            results.push(r);
            inFlight -= 1;
            if (results.length === total) return resolve(results);
            tryLaunch();
          })
          .catch(reject);
      }
    }
    tryLaunch();
  });
}

async function main() {
  const fakeDb = await createFakeDynamicSupabaseServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
  });
  process.env.SUPABASE_URL = fakeDb.url;

  // eslint-disable-next-line global-require
  const app = require('../src/app');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const dynamicPath = `/badge?qr=${PARTICIPANT_ID}`;
  const fallbackPath = `/badge?qr=${NO_LAYOUT_PARTICIPANT_ID}&name=Fallback+Perf`;

  const report = { generatedAt: new Date().toISOString(), nodeVersion: process.version, scenarios: [] };

  // Aquecimento não medido: garante cache de layout quente antes do "1
  // request", refletindo o caminho comum em produção (evento já visitado).
  await timedRequest(port, dynamicPath);

  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();

  const single = await timedRequest(port, dynamicPath);
  report.scenarios.push(summarize('1 request (cache quente)', [single.ms], [single.bytes]));

  const sequential = [];
  for (let i = 0; i < 10; i += 1) sequential.push(await timedRequest(port, dynamicPath));
  report.scenarios.push(summarize('10 sequenciais', sequential.map((r) => r.ms), sequential.map((r) => r.bytes)));

  const simultaneous = await Promise.all(Array.from({ length: 10 }, () => timedRequest(port, dynamicPath)));
  report.scenarios.push(
    summarize('10 simultâneas', simultaneous.map((r) => r.ms), simultaneous.map((r) => r.bytes))
  );

  const controlled = await runControlled(port, dynamicPath, 50, 8);
  report.scenarios.push(
    summarize('50 controladas (concorrência 8)', controlled.map((r) => r.ms), controlled.map((r) => r.bytes))
  );

  const memAfter = process.memoryUsage();
  const cpuAfter = process.cpuUsage(cpuBefore);

  report.resourceUsage = {
    note: 'medido no processo Node único que hospeda src/app.js diretamente (sem child process); indicativo, não é um SLA de produção',
    rssBeforeMB: Number((memBefore.rss / 1024 / 1024).toFixed(1)),
    rssAfterMB: Number((memAfter.rss / 1024 / 1024).toFixed(1)),
    heapUsedAfterMB: Number((memAfter.heapUsed / 1024 / 1024).toFixed(1)),
    cpuUserMs: Number((cpuAfter.user / 1000).toFixed(1)),
    cpuSystemMs: Number((cpuAfter.system / 1000).toFixed(1)),
  };

  // Cache: compara a 1ª chamada após limpar o cache de layout (fria, com
  // round-trip de RPC) contra uma chamada imediatamente seguinte (quente).
  // eslint-disable-next-line global-require
  const { clearLayoutCache } = require('../src/repositories/labelRpcRepository');
  clearLayoutCache();
  const cold = await timedRequest(port, dynamicPath);
  const warm = await timedRequest(port, dynamicPath);
  report.cacheEffect = { coldMs: Number(cold.ms.toFixed(2)), warmMs: Number(warm.ms.toFixed(2)) };

  // Fallback: evento sem layout publicado força dinâmico -> fallback ->
  // renderer legado; comparado ao caminho 100% dinâmico já medido acima.
  const fallback = await timedRequest(port, fallbackPath);
  report.fallbackEffect = {
    fallbackMs: Number(fallback.ms.toFixed(2)),
    fullyDynamicMs: report.scenarios[0].avgMs,
  };

  console.log(JSON.stringify(report, null, 2));

  const outArgIdx = process.argv.indexOf('--out');
  if (outArgIdx !== -1 && process.argv[outArgIdx + 1]) {
    const outPath = path.resolve(process.argv[outArgIdx + 1]);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.error(`\nRelatório salvo em ${outPath}`);
  }

  server.close();
  await fakeDb.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
