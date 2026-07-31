'use strict';

const { validateBadgeV2Payload } = require('../validators/requestValidator');
const { renderDynamicLabel, isDynamicEngineConfigured } = require('../services/badgeService');
const {
  ParticipantContextNotFoundError,
  EventIdMissingError,
  EventNotAllowlistedError,
  LayoutNotPublishedError,
  LayoutInvalidError,
  LabelDataUnavailableError,
  SupabaseTimeoutError,
  SupabaseUnavailableError,
  DynamicFlowBudgetExceededError,
  NonFallbackError,
} = require('../utils/errors');
const logger = require('../utils/logger');

// `/v2/badges/render` renderiza somente a versão publicada (docs
// /plano-motor-dinamico-etiquetas.md §8) e nunca cai em legado: cada
// FallbackEligibleError vira uma resposta HTTP própria e explícita.
const NOT_FOUND_ERRORS = [
  ParticipantContextNotFoundError,
  EventIdMissingError,
  EventNotAllowlistedError,
  LayoutNotPublishedError,
  LabelDataUnavailableError,
];
const UNAVAILABLE_ERRORS = [SupabaseTimeoutError, SupabaseUnavailableError, DynamicFlowBudgetExceededError];

function mapFallbackEligibleErrorToResponse(err) {
  if (err instanceof LayoutInvalidError) {
    return { status: 502, body: { error: 'published layout is invalid', code: err.code } };
  }
  if (NOT_FOUND_ERRORS.some((ErrClass) => err instanceof ErrClass)) {
    return { status: 404, body: { error: err.message, code: err.code } };
  }
  if (UNAVAILABLE_ERRORS.some((ErrClass) => err instanceof ErrClass)) {
    return { status: 503, body: { error: 'temporarily unavailable, please retry', code: err.code } };
  }
  return { status: 502, body: { error: 'dynamic rendering failed', code: err.code || err.name } };
}

async function handleBadgeV2Render(req, res) {
  try {
    if (!isDynamicEngineConfigured()) {
      return res.status(503).json({ error: 'dynamic label engine is not enabled on this deployment' });
    }

    const { participantId, outputFormat } = validateBadgeV2Payload(req.body);
    const { pngBuffer } = await renderDynamicLabel(participantId, req.requestId);

    if (outputFormat === 'base64') {
      const base64String = pngBuffer.toString('base64');
      return res.status(200).json({
        success: true,
        format: 'base64',
        data: base64String,
        dataUri: `data:image/png;base64,${base64String}`,
        mimeType: 'image/png',
      });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'inline; filename="badge.png"');
    return res.send(pngBuffer);
  } catch (err) {
    if (err instanceof NonFallbackError) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    if (err && err.fallbackEligible) {
      const { status, body } = mapFallbackEligibleErrorToResponse(err);
      return res.status(status).json(body);
    }
    logger.error('badge-v2:unexpected-error', { requestId: req.requestId, message: err && err.message });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { handleBadgeV2Render };
