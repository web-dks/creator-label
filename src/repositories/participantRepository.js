'use strict';

const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config/env');

let legacySupabase = null;
if (env.SUPABASE_URL && env.SUPABASE_KEY) {
  try {
    legacySupabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      db: { schema: env.SUPABASE_SCHEMA },
    });
    console.log('Supabase (legacy) client initialized for schema:', env.SUPABASE_SCHEMA);
  } catch (e) {
    console.error('Failed to initialize legacy Supabase client:', e);
  }
} else {
  console.log('Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY to enable DB lookup.');
}

function isLegacySupabaseConfigured() {
  return legacySupabase !== null;
}

/**
 * Lookup legado preservado bit-a-bit: somente id,name,extra_answers, sem
 * filtro de event_id. Usado apenas quando o fluxo realmente cai no
 * renderer legado (flag desligada, ou fallback do motor dinâmico).
 */
async function fetchLegacyParticipant(participantId) {
  if (!legacySupabase) return null;
  try {
    const { data, error } = await legacySupabase
      .from(env.SUPABASE_PARTICIPANTS_TABLE)
      .select('id,name,extra_answers')
      .eq('id', participantId)
      .maybeSingle();
    if (error) {
      console.error('Supabase query error:', error);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error('Supabase fetch exception:', e);
    return null;
  }
}

module.exports = { fetchLegacyParticipant, isLegacySupabaseConfigured };
