'use strict';

/**
 * Defaults de rate limit/concorrência por ambiente
 * (docs/plano-motor-dinamico-etiquetas.md §3.9).
 *
 * O default de produção é deliberadamente generoso por IP: em eventos
 * presenciais, vários totens/impressoras costumam sair do mesmo IP/NAT.
 * A proteção real contra abuso é o limite de CONCORRÊNCIA GLOBAL.
 */
const DEFAULTS_BY_ENV = {
  development: { rateLimitMax: 300, concurrencyLimit: 20 },
  staging: { rateLimitMax: 300, concurrencyLimit: 20 },
  production: { rateLimitMax: 600, concurrencyLimit: 40 },
};

function getRateLimitDefaults(nodeEnv) {
  return DEFAULTS_BY_ENV[nodeEnv] || DEFAULTS_BY_ENV.development;
}

module.exports = { getRateLimitDefaults, DEFAULTS_BY_ENV };
