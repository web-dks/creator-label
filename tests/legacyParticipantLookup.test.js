'use strict';

/**
 * Resiliência do lookup legado: withTimeout + abortSignal em
 * fetchLegacyParticipant. Em timeout/erro, retorna null (nunca propaga)
 * para que /badge continue com o `name` do request.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakePostgrestServer } = require('./fakes/fakePostgrestServer');
const { SUPABASE_OPERATION_TIMEOUT_MS } = require('../src/config/constants');

test('fetchLegacyParticipant timeout + abort resilience', async (t) => {
  const fake = await createFakePostgrestServer([]);
  t.after(() => fake.close());

  process.env.SUPABASE_URL = fake.url;
  process.env.SUPABASE_KEY = 'local-fake-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = '';
  process.env.SUPABASE_PARTICIPANTS_TABLE = 'participants';
  process.env.SUPABASE_SCHEMA = 'public';

  // Processo isolado por arquivo (node --test): env/clientes ainda não
  // carregados — configurar process.env antes do require.
  const { fetchLegacyParticipant } = require('../src/repositories/participantRepository');

  await t.test('lookup legado que excede o timeout retorna null (não lança)', async () => {
    const startedAt = Date.now();
    const result = await fetchLegacyParticipant('HANG_FOREVER');
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result, null);
    assert.ok(
      elapsedMs >= SUPABASE_OPERATION_TIMEOUT_MS - 100,
      `expected ~${SUPABASE_OPERATION_TIMEOUT_MS}ms timeout, took ${elapsedMs}ms`
    );
    assert.ok(
      elapsedMs < SUPABASE_OPERATION_TIMEOUT_MS + 500,
      `expected timeout around ${SUPABASE_OPERATION_TIMEOUT_MS}ms, took ${elapsedMs}ms`
    );
  });

  await t.test('a consulta pendente é cancelada via abortSignal', async () => {
    // O caso anterior já disparou HANG_FOREVER; aguarda o close da conexão.
    const deadline = Date.now() + 1000;
    while (!fake.hangState.aborted && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(fake.hangState.received, true);
    assert.equal(fake.hangState.aborted, true);
  });

  await t.test('erro Supabase (500) também retorna null sem lançar', async () => {
    const result = await fetchLegacyParticipant('SERVER_ERROR');
    assert.equal(result, null);
  });
});
