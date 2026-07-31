'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDynamicSupabaseServer } = require('./fakes/fakeDynamicSupabaseServer');
const contextParticipants = require('./fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

test('dynamic repositories (participant context + label RPCs)', async (t) => {
  const fake = await createFakeDynamicSupabaseServer({
    participants: contextParticipants,
    layoutsByEventId,
    labelDataByParticipantId,
  });
  t.after(() => fake.close());

  process.env.SUPABASE_URL = fake.url;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key';
  process.env.SUPABASE_KEY = '';
  process.env.LABEL_CONTEXT_CACHE_TTL_SECONDS = '60';
  process.env.LABEL_LAYOUT_CACHE_TTL_SECONDS = '60';

  // Este arquivo de teste roda em processo isolado (node --test spawna um
  // processo por arquivo), então é seguro exigir os módulos aqui, depois
  // de já termos configurado o process.env acima.
  const participantRepository = require('../src/repositories/participantRepository');
  const labelRpcRepository = require('../src/repositories/labelRpcRepository');
  const {
    ParticipantContextNotFoundError,
    EventIdMissingError,
    LayoutNotPublishedError,
    LabelDataUnavailableError,
    SupabaseTimeoutError,
    SupabaseUnavailableError,
  } = require('../src/utils/errors');

  await t.test('fetchParticipantContext resolves id -> event_id only', async () => {
    const ctx = await participantRepository.fetchParticipantContext('aaaaaaaa-0000-0000-0000-000000000001');
    assert.deepEqual(ctx, { id: 'aaaaaaaa-0000-0000-0000-000000000001', event_id: 6 });
    assert.deepEqual(Object.keys(ctx).sort(), ['event_id', 'id']);
  });

  await t.test('fetchParticipantContext caches subsequent calls', async () => {
    const first = await participantRepository.fetchParticipantContext('aaaaaaaa-0000-0000-0000-000000000002');
    const second = await participantRepository.fetchParticipantContext('aaaaaaaa-0000-0000-0000-000000000002');
    assert.deepEqual(first, second);
    assert.equal(first.event_id, 33);
  });

  await t.test('fetchParticipantContext throws ParticipantContextNotFoundError for unknown id', async () => {
    await assert.rejects(
      () => participantRepository.fetchParticipantContext('00000000-0000-0000-0000-000000000000'),
      ParticipantContextNotFoundError
    );
  });

  await t.test('fetchParticipantContext throws EventIdMissingError when event_id is null', async () => {
    await assert.rejects(
      () => participantRepository.fetchParticipantContext('aaaaaaaa-0000-0000-0000-000000000004'),
      EventIdMissingError
    );
  });

  await t.test('fetchParticipantContext throws SupabaseUnavailableError on a generic (non-timeout) Supabase error', async () => {
    await assert.rejects(() => participantRepository.fetchParticipantContext('SERVER_ERROR'), SupabaseUnavailableError);
  });

  await t.test('fetchParticipantContext throws SupabaseTimeoutError after ~2s when Supabase hangs', async () => {
    const startedAt = Date.now();
    await assert.rejects(
      () => participantRepository.fetchParticipantContext('HANG_FOREVER'),
      SupabaseTimeoutError
    );
    const elapsedMs = Date.now() - startedAt;
    assert.ok(elapsedMs < 2500, `expected timeout around 2000ms, took ${elapsedMs}ms`);
  });

  await t.test('getPublishedLayout returns version_id, layout_config and print_profile', async () => {
    const layout = await labelRpcRepository.getPublishedLayout(6);
    assert.equal(layout.version_id, 16);
    assert.equal(layout.layout_config.schemaVersion, 1);
    assert.equal(layout.print_profile.code, 'dks_80x50_300_landscape');
  });

  await t.test('getPublishedLayout throws LayoutNotPublishedError when RPC returns null', async () => {
    await assert.rejects(() => labelRpcRepository.getPublishedLayout(999), LayoutNotPublishedError);
  });

  await t.test('resolveParticipantLabelData returns event/participant/customFields', async () => {
    const data = await labelRpcRepository.resolveParticipantLabelData(
      'aaaaaaaa-0000-0000-0000-000000000001',
      6
    );
    assert.equal(data.participant.id, 'aaaaaaaa-0000-0000-0000-000000000001');
    assert.equal(data.event.id, 6);
    assert.deepEqual(Object.keys(data).sort(), ['customFields', 'event', 'participant']);
  });

  await t.test('resolveParticipantLabelData throws LabelDataUnavailableError when RPC returns null', async () => {
    await assert.rejects(
      () => labelRpcRepository.resolveParticipantLabelData('00000000-0000-0000-0000-000000000000', 6),
      LabelDataUnavailableError
    );
  });
});
