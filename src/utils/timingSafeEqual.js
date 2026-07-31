'use strict';

const crypto = require('node:crypto');

/**
 * Compara dois segredos em tempo constante (docs/plano-motor-dinamico-
 * etiquetas.md §8 — Bearer LABEL_API_KEY). Evita `===`/`localeCompare`,
 * que vazam timing pelo tamanho e pelo prefixo em comum. Ambas as
 * strings são primeiro reduzidas a um hash de tamanho fixo, então
 * `crypto.timingSafeEqual` nunca lança por tamanhos diferentes.
 */
function timingSafeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) return false;
  const bufA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bufB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { timingSafeEqualStrings };
