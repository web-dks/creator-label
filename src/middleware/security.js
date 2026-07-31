'use strict';

const helmet = require('helmet');
const cors = require('cors');

/**
 * Segurança transversal para a rota legada (docs/plano-motor-dinamico-etiquetas.md).
 * Não exige nenhum header novo do aplicativo FlutterFlow.
 */
function buildHelmetMiddleware() {
  return helmet({
    // API pura (PNG/JSON), sem HTML servido — CSP não se aplica aqui.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

function buildCorsMiddleware() {
  return cors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
  });
}

module.exports = { buildHelmetMiddleware, buildCorsMiddleware };
