'use strict';

const { env } = require('../config/env');
const { ConcurrencyLimiter } = require('../utils/concurrency');
const { ConcurrencyLimitExceededError } = require('../utils/errors');

const limiter = new ConcurrencyLimiter(env.LABEL_CONCURRENCY_LIMIT);

/**
 * Protege CPU limitando quantos renders (canvas/QR) podem rodar ao mesmo
 * tempo, independentemente de quantos IPs distintos estejam chamando.
 */
function concurrencyLimitMiddleware(req, res, next) {
  if (!limiter.tryAcquire()) {
    const err = new ConcurrencyLimitExceededError('Server is busy rendering, please retry shortly.');
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    limiter.release();
  };
  res.on('finish', releaseOnce);
  res.on('close', releaseOnce);
  next();
}

module.exports = { concurrencyLimitMiddleware, limiter };
