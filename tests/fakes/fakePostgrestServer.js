'use strict';

/**
 * Minimal local PostgREST-compatible HTTP server used to exercise the
 * legacy `index.js` Supabase lookup code path without ever touching a real
 * Supabase project. It understands the single query shape used by
 * `fetchParticipantById`:
 *
 *   GET /rest/v1/<table>?select=id,name,extra_answers&id=eq.<uuid>
 *
 * and replies the way real PostgREST does for `.maybeSingle()`:
 * - Accept: application/vnd.pgrst.object+json + exactly one row  -> 200, single object
 * - Accept: application/vnd.pgrst.object+json + zero rows        -> 406, PGRST116 body
 * - otherwise                                                    -> 200, JSON array
 */

const http = require('node:http');
const { URL } = require('node:url');

function createFakePostgrestServer(rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const idParam = url.searchParams.get('id') || '';
    const id = idParam.startsWith('eq.') ? idParam.slice(3) : undefined;
    const match = id ? byId.get(id) : undefined;
    const wantsSingle = String(req.headers['accept'] || '').includes('vnd.pgrst.object+json');

    res.setHeader('Content-Type', 'application/json');

    if (wantsSingle) {
      if (match) {
        res.statusCode = 200;
        res.end(JSON.stringify(match));
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
    res.end(JSON.stringify(match ? [match] : []));
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

module.exports = { createFakePostgrestServer };
