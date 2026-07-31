'use strict';

const crypto = require('node:crypto');

/**
 * Logger estruturado e sanitizado. Nunca deve receber name, extra_answers,
 * customFields, body completo, API key, service role ou Base64 — ver
 * docs/plano-motor-dinamico-etiquetas.md §"Observabilidade".
 */

function generateRequestId() {
  return crypto.randomUUID();
}

/** Mostra só os 8 primeiros caracteres do UUID, nunca o valor completo. */
function maskId(id) {
  if (!id) return null;
  const s = String(id);
  return s.length <= 8 ? `${s}…` : `${s.slice(0, 8)}…`;
}

function log(level, event, fields = {}) {
  const entry = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  generateRequestId,
  maskId,
  info: (event, fields) => log('info', event, fields),
  warn: (event, fields) => log('warn', event, fields),
  error: (event, fields) => log('error', event, fields),
};
