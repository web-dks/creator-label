'use strict';

const { InvalidRequestError } = require('../utils/errors');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPPORTED_FORMATS = ['png', 'base64'];

/**
 * Valida o payload de `POST /v2/badges/render` (docs
 * /plano-motor-dinamico-etiquetas.md §8): `{ participant_id, format? }`.
 * Qualquer violação é `InvalidRequestError` (400), nunca fallback.
 */
function validateBadgeV2Payload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidRequestError('request body must be a JSON object');
  }

  const { participant_id: participantId, format } = body;
  if (typeof participantId !== 'string' || !UUID_PATTERN.test(participantId.trim())) {
    throw new InvalidRequestError('participant_id must be a valid UUID string');
  }

  const outputFormat = format === undefined ? 'base64' : format;
  if (typeof outputFormat !== 'string' || !SUPPORTED_FORMATS.includes(outputFormat.toLowerCase())) {
    throw new InvalidRequestError('format must be "png" or "base64"');
  }

  return { participantId: participantId.trim(), outputFormat: outputFormat.toLowerCase() };
}

module.exports = { validateBadgeV2Payload };
