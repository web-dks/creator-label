'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startDynamicEnabledServer } = require('./fakes/dynamicServerHarness');
const contextParticipants = require('./fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

const PARTICIPANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PARTICIPANT_NAME = 'Fulano de Tal Sintético';
const CUSTOM_FIELD_VALUE = 'Unidade Teste';
const API_KEY = 'super-secret-label-api-key';

async function waitForLogLine(server, needle, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    const combined = server.getStdout() + server.getStderr();
    if (combined.includes(needle)) return combined;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return server.getStdout() + server.getStderr();
}

test('logs sem PII (docs §23 "Segurança")', async (t) => {
  const server = await startDynamicEnabledServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
    apiKey: API_KEY,
  });
  t.after(() => server.close());

  await t.test('GET /badge dinâmico não vaza nome, custom field ou UUID completo nos logs', async () => {
    const res = await server.requestGet({ qr: PARTICIPANT_ID });
    assert.equal(res.status, 200);

    // "http_request" já aparece nos logs de prontidão do harness (GET
    // /health) antes desta requisição — esperamos por um trecho exclusivo
    // desta chamada (o id mascarado do participante) para evitar falso
    // positivo por corrida com o log antigo.
    const combined = await waitForLogLine(server, '"participant_id_masked":"aaaaaaaa');

    assert.ok(!combined.includes(PARTICIPANT_NAME), 'expected the participant name to never be logged');
    assert.ok(!combined.includes(CUSTOM_FIELD_VALUE), 'expected custom field values to never be logged');
    assert.ok(!combined.includes(PARTICIPANT_ID), 'expected the full participant UUID to never be logged unmasked');
    assert.ok(!combined.includes(API_KEY), 'expected LABEL_API_KEY to never be logged');
    assert.ok(!combined.includes(res.body.toString('base64')), 'expected the PNG bytes to never be logged as base64');

    // A versão mascarada (8 primeiros caracteres do UUID) é o único traço
    // esperado do participante nos logs.
    assert.ok(combined.includes('aaaaaaaa'), 'expected the masked participant id prefix to be present');
  });

  await t.test('POST /v2/badges/render não vaza Bearer, nome, custom field ou UUID completo', async () => {
    const res = await server.requestPostPath(
      '/v2/badges/render',
      { participant_id: PARTICIPANT_ID, format: 'base64' },
      { Authorization: `Bearer ${API_KEY}` }
    );
    assert.equal(res.status, 200);

    await waitForLogLine(server, 'badge-service:dynamic-render-success');
    const combined = server.getStdout() + server.getStderr();

    assert.ok(!combined.includes(PARTICIPANT_NAME), 'expected the participant name to never be logged');
    assert.ok(!combined.includes(CUSTOM_FIELD_VALUE), 'expected custom field values to never be logged');
    assert.ok(!combined.includes(PARTICIPANT_ID), 'expected the full participant UUID to never be logged unmasked');
    assert.ok(!combined.includes(API_KEY), 'expected LABEL_API_KEY to never be logged, not even echoed back');
  });
});
