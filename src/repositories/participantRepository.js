'use strict';

const { env } = require('../config/env');
const { getLegacyClient, getDynamicClient, isLegacySupabaseConfigured, isDynamicSupabaseConfigured } = require('./supabaseClients');
const { withTimeout } = require('../utils/withTimeout');
const { TtlCache } = require('../utils/cache');
const { SUPABASE_OPERATION_TIMEOUT_MS } = require('../config/constants');
const {
  ParticipantContextNotFoundError,
  EventIdMissingError,
  SupabaseUnavailableError,
} = require('../utils/errors');

if (!isLegacySupabaseConfigured()) {
  console.log('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY to enable DB lookup.');
}

/**
 * Lookup legado preservado bit-a-bit: somente id,name,extra_answers, sem
 * filtro de event_id. Usado apenas quando o fluxo realmente cai no
 * renderer legado (flag desligada, ou fallback do motor dinâmico).
 */
async function fetchLegacyParticipant(participantId) {
  const client = getLegacyClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(env.SUPABASE_PARTICIPANTS_TABLE)
      .select('id,name,extra_answers')
      .eq('id', participantId)
      .maybeSingle();
    if (error) {
      console.error('Supabase query error:', error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error('Supabase fetch exception:', e && e.message);
    return null;
  }
}

const contextCache = new TtlCache();

/**
 * Consulta mínima participant_id -> event_id, usada exclusivamente pelo
 * motor dinâmico. Nunca seleciona nome, e-mail, telefone, documento ou
 * extra_answers (docs/plano-motor-dinamico-etiquetas.md §2, restrições).
 */
async function fetchParticipantContext(participantId) {
  const cached = contextCache.get(participantId);
  if (cached) return cached;

  const client = getDynamicClient();
  if (!client) {
    throw new SupabaseUnavailableError('dynamic Supabase client (service role) is not configured');
  }

  let data;
  let error;
  try {
    ({ data, error } = await withTimeout(
      (signal) =>
        client
          .from(env.SUPABASE_PARTICIPANTS_TABLE)
          .select('id,event_id')
          .eq('id', participantId)
          .abortSignal(signal)
          .maybeSingle(),
      SUPABASE_OPERATION_TIMEOUT_MS,
      'fetchParticipantContext timed out'
    ));
  } catch (e) {
    if (e && e.fallbackEligible) throw e;
    throw new SupabaseUnavailableError(`fetchParticipantContext failed: ${e && e.message}`);
  }

  if (error) {
    throw new SupabaseUnavailableError(`fetchParticipantContext failed: ${error.message}`);
  }
  if (!data) {
    throw new ParticipantContextNotFoundError('participant not found for context lookup');
  }
  if (data.event_id === null || data.event_id === undefined) {
    throw new EventIdMissingError('participant has no event_id');
  }

  const context = { id: data.id, event_id: data.event_id };
  contextCache.set(participantId, context, env.LABEL_CONTEXT_CACHE_TTL_SECONDS);
  return context;
}

function clearParticipantContextCache() {
  contextCache.clear();
}

module.exports = {
  fetchLegacyParticipant,
  fetchParticipantContext,
  isLegacySupabaseConfigured,
  isDynamicSupabaseConfigured,
  clearParticipantContextCache,
};
