'use strict';

const express = require('express');
const { env } = require('../config/env');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'creator-label',
    version: env.SERVICE_VERSION,
    dynamic_layout_enabled: env.LABEL_DYNAMIC_LAYOUT_ENABLED,
  });
});

module.exports = router;
