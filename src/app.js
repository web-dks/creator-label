'use strict';

const express = require('express');
const { buildHelmetMiddleware, buildCorsMiddleware } = require('./middleware/security');
const { buildRateLimitMiddleware } = require('./middleware/rateLimit');
const { concurrencyLimitMiddleware } = require('./middleware/concurrencyLimit');
const { requestLoggerMiddleware } = require('./middleware/requestLogger');
const { requestTimeoutMiddleware } = require('./middleware/requestTimeout');
const { errorHandlerMiddleware } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const legacyBadgeRoutes = require('./routes/legacyBadgeRoutes');

const REQUEST_TIMEOUT_MS = 10000;
const JSON_BODY_LIMIT = '100kb';

const app = express();

app.use(buildHelmetMiddleware());
app.use(buildCorsMiddleware());
app.use(requestLoggerMiddleware);

// /health fica fora de rate limit/concorrência para não afetar monitoramento.
app.use(healthRoutes);

app.use(
  express.json({
    limit: JSON_BODY_LIMIT,
  })
);
app.use(requestTimeoutMiddleware(REQUEST_TIMEOUT_MS));
app.use(buildRateLimitMiddleware());
app.use(concurrencyLimitMiddleware);

app.use(legacyBadgeRoutes);

app.use(errorHandlerMiddleware);

module.exports = app;
