'use strict';

const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const legacyBadgeRoutes = require('./routes/legacyBadgeRoutes');

const app = express();
app.use(express.json());

app.use(healthRoutes);
app.use(legacyBadgeRoutes);

module.exports = app;
