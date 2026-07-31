'use strict';

const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config/env');

/**
 * Dois clientes deliberadamente separados (docs/plano-motor-dinamico-etiquetas.md §3):
 * - legacyClient (SUPABASE_KEY): só o lookup legado (id,name,extra_answers).
 * - dynamicClient (SUPABASE_SERVICE_ROLE_KEY): consulta mínima de contexto
 *   e as RPCs allowlisted. Nunca exposto ao cliente/resposta da API.
 */
let legacyClient = null;
if (env.SUPABASE_URL && env.SUPABASE_KEY) {
  try {
    legacyClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      db: { schema: env.SUPABASE_SCHEMA },
      auth: { persistSession: false },
    });
  } catch (e) {
    console.error('Failed to initialize legacy Supabase client:', e && e.message);
  }
}

let dynamicClient = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    dynamicClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: env.SUPABASE_SCHEMA },
      auth: { persistSession: false },
    });
  } catch (e) {
    console.error('Failed to initialize dynamic Supabase client:', e && e.message);
  }
}

module.exports = {
  getLegacyClient: () => legacyClient,
  getDynamicClient: () => dynamicClient,
  isLegacySupabaseConfigured: () => legacyClient !== null,
  isDynamicSupabaseConfigured: () => dynamicClient !== null,
};
