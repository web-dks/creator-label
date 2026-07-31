'use strict';

const express = require('express');
const { apiKeyAuthMiddleware } = require('../middleware/apiKeyAuth');
const { handleBadgeV2Render } = require('../controllers/badgeV2Controller');

const router = express.Router();

router.post('/v2/badges/render', apiKeyAuthMiddleware, handleBadgeV2Render);

module.exports = router;
