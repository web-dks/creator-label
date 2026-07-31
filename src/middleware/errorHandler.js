'use strict';

const { NonFallbackError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Handler de erro final. Converte erros de parsing do Express
 * (payload grande, JSON malformado) e a nossa taxonomia de
 * `NonFallbackError` em respostas JSON consistentes, nunca em HTML/stack.
 */
// eslint-disable-next-line no-unused-vars
function errorHandlerMiddleware(err, req, res, next) {
  if (res.headersSent) return;

  if (err instanceof NonFallbackError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err && err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }

  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  logger.error('unhandled_error', { request_id: req.requestId, message: err && err.message });
  res.status(500).json({ error: 'Internal Server Error' });
}

module.exports = { errorHandlerMiddleware };
