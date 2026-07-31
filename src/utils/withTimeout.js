'use strict';

const { SupabaseTimeoutError } = require('./errors');

/**
 * Executa `fn(signal)` (uma query/RPC do supabase-js, que aceita
 * `.abortSignal(signal)`) e a cancela de verdade se ultrapassar `ms`
 * (docs/plano-motor-dinamico-etiquetas.md §3.7 — 2s por operação Supabase).
 */
async function withTimeout(fn, ms, timeoutMessage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new SupabaseTimeoutError(timeoutMessage || `Operation timed out after ${ms}ms`));
        });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { withTimeout };
