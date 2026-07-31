'use strict';

const rateLimit = require('express-rate-limit');
const { env } = require('../config/env');
const { RateLimitedError } = require('../utils/errors');

/**
 * Rate limit por IP, com defaults tolerantes a IP compartilhado
 * (docs/plano-motor-dinamico-etiquetas.md §3.9). A proteção real contra
 * abuso fica a cargo do limite de concorrência global, não deste limite.
 */
function buildRateLimitMiddleware() {
  return rateLimit({
    windowMs: env.LABEL_RATE_LIMIT_WINDOW_MS,
    limit: env.LABEL_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const err = new RateLimitedError('Too many requests, please try again later.');
      res.status(err.statusCode).json({ error: err.message });
    },
  });
}

module.exports = { buildRateLimitMiddleware };
