'use strict';

const logger = require('../utils/logger');

/**
 * Log estruturado por requisição, sem PII (nome, extra_answers,
 * customFields, body completo, API key, service role ou Base64 nunca
 * são logados aqui — só metadados de rota/participante mascarado).
 */
function requestLoggerMiddleware(req, res, next) {
  const requestId = logger.generateRequestId();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  const source = req.method === 'GET' ? req.query : req.body || {};
  const participantIdMasked = logger.maskId(source.qr || source.participant_id);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('http_request', {
      request_id: requestId,
      route: req.path,
      method: req.method,
      participant_id_masked: participantIdMasked,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}

module.exports = { requestLoggerMiddleware };
