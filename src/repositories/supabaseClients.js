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
let dynamicClient = null;

function initLegacyClient() {
  legacyClient = null;
  if (!env.SUPABASE_URL || !env.SUPABASE_KEY) return;
  try {
    legacyClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      db: { schema: env.SUPABASE_SCHEMA },
      auth: { persistSession: false },
    });
  } catch (e) {
    console.error('Failed to initialize legacy Supabase client:', e && e.message);
  }
}

function initDynamicClient() {
  dynamicClient = null;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    dynamicClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      db: { schema: env.SUPABASE_SCHEMA },
      auth: { persistSession: false },
    });
  } catch (e) {
    console.error('Failed to initialize dynamic Supabase client:', e && e.message);
  }
}

initLegacyClient();
initDynamicClient();

/**
 * Reconstrói os dois clientes a partir do `env` atual. Usado apenas em
 * testes que precisam simular a ausência/presença da service role em
 * tempo de execução (`env` é lido uma única vez na inicialização normal).
 */
function reinitClientsForTests() {
  initLegacyClient();
  initDynamicClient();
}

module.exports = {
  getLegacyClient: () => legacyClient,
  getDynamicClient: () => dynamicClient,
  isLegacySupabaseConfigured: () => legacyClient !== null,
  isDynamicSupabaseConfigured: () => dynamicClient !== null,
  reinitClientsForTests,
};
