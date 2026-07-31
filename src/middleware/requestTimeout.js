'use strict';

/**
 * Timeout defensivo de borda para toda a API (independente do orçamento
 * interno de ~5s do fluxo dinâmico — ver src/services/badgeService.js).
 * Evita que uma requisição trave a conexão do cliente indefinidamente.
 */
function requestTimeoutMiddleware(timeoutMs) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (res.headersSent) return;
      res.status(503).json({ error: 'Request timed out' });
    }, timeoutMs);
    timer.unref();

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}

module.exports = { requestTimeoutMiddleware };
