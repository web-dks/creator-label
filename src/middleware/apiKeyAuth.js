'use strict';

const { env } = require('../config/env');
const { timingSafeEqualStrings } = require('../utils/timingSafeEqual');
const { UnauthorizedError } = require('../utils/errors');

const BEARER_PREFIX = 'Bearer ';

/**
 * Autenticação Bearer de `/v2/badges/render` (docs/plano-motor-dinamico-
 * etiquetas.md §8). Comparação do segredo em tempo constante. Se
 * `LABEL_API_KEY` não estiver configurada no ambiente, a rota fica
 * bloqueada por padrão (fail closed) — nunca aberta por omissão.
 */
function apiKeyAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length).trim() : '';
  const configuredKey = env.LABEL_API_KEY;

  const isValid = Boolean(configuredKey) && timingSafeEqualStrings(token, configuredKey);
  if (!isValid) {
    const err = new UnauthorizedError('missing or invalid Authorization: Bearer token');
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  next();
}

module.exports = { apiKeyAuthMiddleware };
