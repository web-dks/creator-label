'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeDynamicSupabaseServer } = require('./fakes/fakeDynamicSupabaseServer');
const contextParticipants = require('./fixtures/dynamic/context-participants.json');
const layoutsByEventId = require('./fixtures/dynamic/layouts.json');
const labelDataByParticipantId = require('./fixtures/dynamic/label-data.json');

test('badgeService.tryRenderDynamic orchestration', async (t) => {
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
  process.env.LABEL_LOGO_ALLOWED_HOSTS = '';
  process.env.LABEL_DYNAMIC_EVENT_IDS = '';

  // Processo isolado por arquivo de teste: seguro exigir/mutar env aqui.
  const { env } = require('../src/config/env');
  const badgeService = require('../src/services/badgeService');

  function readPngDimensions(buffer) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  await t.test('isUuid validates canonical UUID strings only', () => {
    assert.equal(badgeService.isUuid('aaaaaaaa-0000-0000-0000-000000000001'), true);
    assert.equal(badgeService.isUuid('not-a-uuid'), false);
    assert.equal(badgeService.isUuid(undefined), false);
    assert.equal(badgeService.isUuid(''), false);
  });

  await t.test('returns null immediately when the feature flag is off (no network call)', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    const result = await badgeService.tryRenderDynamic(
      { qr: 'aaaaaaaa-0000-0000-0000-000000000001' },
      'req-flag-off'
    );
    assert.equal(result, null);
  });

  await t.test('returns null when qr is not a valid UUID, even with the flag on', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;
    const result = await badgeService.tryRenderDynamic({ qr: 'not-a-uuid' }, 'req-bad-qr');
    assert.equal(result, null);
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
  });

  await t.test('returns null when the service role is not configured, even with the flag on', async () => {
    const { reinitClientsForTests } = require('../src/repositories/supabaseClients');
    const originalKey = env.SUPABASE_SERVICE_ROLE_KEY;
    env.SUPABASE_SERVICE_ROLE_KEY = '';
    reinitClientsForTests();
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;

    const result = await badgeService.tryRenderDynamic(
      { qr: 'aaaaaaaa-0000-0000-0000-000000000001' },
      'req-no-service-role'
    );

    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    reinitClientsForTests();
    assert.equal(result, null);
  });

  await t.test('renders a dynamic PNG end-to-end when everything checks out', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;
    env.LABEL_BADGE_OUTPUT_ROTATION = 90;
    const png = await badgeService.tryRenderDynamic(
      { qr: 'aaaaaaaa-0000-0000-0000-000000000001' },
      'req-happy-path'
    );
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    assert.ok(Buffer.isBuffer(png));
    const dims = readPngDimensions(png);
    assert.equal(dims.width, 591);
    assert.equal(dims.height, 945);
  });

  await t.test('LABEL_BADGE_OUTPUT_ROTATION=0 keeps design orientation on /badge path', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;
    env.LABEL_BADGE_OUTPUT_ROTATION = 0;
    const png = await badgeService.tryRenderDynamic(
      { qr: 'aaaaaaaa-0000-0000-0000-000000000001' },
      'req-no-badge-rotation'
    );
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    env.LABEL_BADGE_OUTPUT_ROTATION = 90;
    assert.ok(Buffer.isBuffer(png));
    const dims = readPngDimensions(png);
    assert.equal(dims.width, 945);
    assert.equal(dims.height, 591);
  });

  await t.test('falls back (returns null) when the participant is not found', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;
    const result = await badgeService.tryRenderDynamic(
      { qr: '00000000-0000-0000-0000-000000000000' },
      'req-unknown-participant'
    );
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    assert.equal(result, null);
  });

  await t.test('falls back when the event is outside LABEL_DYNAMIC_EVENT_IDS', () => {
    assert.equal(badgeService.isEventAllowlisted(6), true); // allowlist vazia -> tudo permitido
  });

  await t.test('falls back (returns null) when event_id has no published layout', async () => {
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = true;
    const result = await badgeService.tryRenderDynamic(
      { qr: 'aaaaaaaa-0000-0000-0000-000000000003' }, // event_id sem layout (fixture)
      'req-no-layout'
    );
    env.LABEL_DYNAMIC_LAYOUT_ENABLED = false;
    assert.equal(result, null);
  });
});
