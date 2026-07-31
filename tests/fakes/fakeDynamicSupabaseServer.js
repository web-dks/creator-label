'use strict';

/**
 * Fake local do backend dinâmico (consulta mínima de contexto + as duas
 * RPCs allowlisted), usado nos testes do motor dinâmico sem tocar em
 * nenhum projeto Supabase real.
 */

const http = require('node:http');
const { URL } = require('node:url');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createFakeDynamicSupabaseServer({ participants = [], layoutsByEventId = {}, labelDataByParticipantId = {} }) {
  const participantsById = new Map(participants.map((p) => [p.id, p]));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && url.pathname === '/rest/v1/participants') {
      const idParam = url.searchParams.get('id') || '';
      const id = idParam.startsWith('eq.') ? idParam.slice(3) : undefined;

      if (id === 'HANG_FOREVER') {
        // Nunca responde — usado para testar o timeout de 2s (ajuste 7).
        return;
      }

      if (id === 'SERVER_ERROR') {
        // Erro genérico (não timeout) — deve virar SupabaseUnavailableError.
        res.statusCode = 500;
        res.end(JSON.stringify({ message: 'internal error', code: 'XX000' }));
        return;
      }

      const match = id ? participantsById.get(id) : undefined;
      const wantsSingle = String(req.headers['accept'] || '').includes('vnd.pgrst.object+json');

      if (wantsSingle) {
        if (match) {
          res.statusCode = 200;
          res.end(JSON.stringify({ id: match.id, event_id: match.event_id }));
        } else {
          res.statusCode = 406;
          res.end(
            JSON.stringify({
              code: 'PGRST116',
              details: 'Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row',
              hint: null,
              message: 'JSON object requested, multiple (or no) rows returned',
            })
          );
        }
        return;
      }

      res.statusCode = 200;
      res.end(JSON.stringify(match ? [{ id: match.id, event_id: match.event_id }] : []));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/get_published_event_label_layout') {
      const args = JSON.parse((await readBody(req)) || '{}');
      const layout = layoutsByEventId[String(args.p_event_id)];
      res.statusCode = 200;
      res.end(JSON.stringify(layout === undefined ? null : layout));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/resolve_participant_label_data') {
      const args = JSON.parse((await readBody(req)) || '{}');
      const data = labelDataByParticipantId[String(args.p_participant_id)];
      res.statusCode = 200;
      res.end(JSON.stringify(data === undefined ? null : data));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found in fake dynamic supabase server', path: url.pathname }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res2) => server.close(() => res2())),
      });
    });
  });
}

module.exports = { createFakeDynamicSupabaseServer };
