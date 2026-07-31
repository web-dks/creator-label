'use strict';

const express = require('express');
const { handleLegacyBadgeRequest } = require('../controllers/legacyBadgeController');

const router = express.Router();

router.get('/badge', handleLegacyBadgeRequest);
router.post('/badge', handleLegacyBadgeRequest);

module.exports = router;
