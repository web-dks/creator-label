'use strict';

const { env } = require('../config/env');
const { getDynamicClient } = require('./supabaseClients');
const { withTimeout } = require('../utils/withTimeout');
const { TtlCache } = require('../utils/cache');
const { SUPABASE_OPERATION_TIMEOUT_MS } = require('../config/constants');
const { LayoutNotPublishedError, LabelDataUnavailableError, SupabaseUnavailableError } = require('../utils/errors');

const layoutCache = new TtlCache();

function requireDynamicClient() {
  const client = getDynamicClient();
  if (!client) {
    throw new SupabaseUnavailableError('dynamic Supabase client (service role) is not configured');
  }
  return client;
}

async function callRpc(client, fnName, args, timeoutMessage) {
  try {
    return await withTimeout(
      (signal) => client.rpc(fnName, args).abortSignal(signal),
      SUPABASE_OPERATION_TIMEOUT_MS,
      timeoutMessage
    );
  } catch (e) {
    if (e && e.fallbackEligible) throw e;
    throw new SupabaseUnavailableError(`${fnName} failed: ${e && e.message}`);
  }
}

/**
 * Layout publicado do evento, incluindo `version_id` e `print_profile`
 * dentro da mesma entrada de cache (docs/plano-motor-dinamico-etiquetas.md
 * §2.2 e §3.6). Não cacheia dado pessoal — só metadados de layout.
 */
async function getPublishedLayout(eventId) {
  const cached = layoutCache.get(eventId);
  if (cached) return cached;

  const client = requireDynamicClient();
  const { data, error } = await callRpc(
    client,
    'get_published_event_label_layout',
    { p_event_id: eventId },
    'get_published_event_label_layout timed out'
  );

  if (error) {
    throw new SupabaseUnavailableError(`get_published_event_label_layout failed: ${error.message}`);
  }
  if (!data) {
    throw new LayoutNotPublishedError(`no published layout for event_id=${eventId}`);
  }

  layoutCache.set(eventId, data, env.LABEL_LAYOUT_CACHE_TTL_SECONDS);
  return data;
}

/**
 * Dados resolvidos do participante para o layout (nome, categoria, evento,
 * customFields). NUNCA cacheado — contém dado pessoal.
 */
async function resolveParticipantLabelData(participantId, eventId) {
  const client = requireDynamicClient();
  const { data, error } = await callRpc(
    client,
    'resolve_participant_label_data',
    { p_participant_id: participantId, p_event_id: eventId },
    'resolve_participant_label_data timed out'
  );

  if (error) {
    throw new SupabaseUnavailableError(`resolve_participant_label_data failed: ${error.message}`);
  }
  if (!data) {
    throw new LabelDataUnavailableError(`no label data for participant_id=${participantId}`);
  }

  return data;
}

function clearLayoutCache() {
  layoutCache.clear();
}

module.exports = { getPublishedLayout, resolveParticipantLabelData, clearLayoutCache };
