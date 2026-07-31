'use strict';

const {
  clamp,
  parseExtraAnswers,
  displayLineFromExtraAnswers,
  renderBadgePng,
} = require('../renderers/legacyLabelRenderer');
const { fetchLegacyParticipant, isLegacySupabaseConfigured } = require('../repositories/participantRepository');
const {
  MIN_DPI,
  MAX_DPI,
  DEFAULT_DPI,
  MM_WIDTH,
  MM_HEIGHT,
  DEFAULT_MAX_CHARS_LINE1,
  DEFAULT_MAX_CHARS_LINE2,
} = require('../config/constants');

function toNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseParams(req) {
  const method = req.method.toUpperCase();
  const source = method === 'GET' ? req.query : req.body || {};

  let qr;
  if (source.qr !== undefined && source.qr !== null) {
    const s = String(source.qr).trim();
    qr = s.length > 0 ? s : undefined;
  }

  const name = typeof source.name === 'string' ? source.name.trim() : '';

  let dpi = source.dpi !== undefined ? Number(source.dpi) : DEFAULT_DPI;
  if (!Number.isFinite(dpi)) dpi = DEFAULT_DPI;
  dpi = clamp(dpi, MIN_DPI, MAX_DPI);

  // Conteúdo sempre desenhado em LANDSCAPE (80 x 50 mm).
  const mmWidth = MM_HEIGHT; // 80mm
  const mmHeight = MM_WIDTH; // 50mm

  let rotation = 0;
  if (source.rotation !== undefined) {
    const r = Number(source.rotation);
    rotation = [0, 90, 180, 270].includes(r) ? r : 0;
  } else if (source.rotate !== undefined) {
    const r = Number(source.rotate);
    rotation = [0, 90, 180, 270].includes(r) ? r : 0;
  }

  const format = typeof source.format === 'string' ? source.format.toLowerCase() : 'png';
  const outputFormat = ['png', 'base64'].includes(format) ? format : 'png';

  const maxCharsLine1 =
    source.maxLine1 !== undefined
      ? toNum(source.maxLine1, DEFAULT_MAX_CHARS_LINE1)
      : source.max_line1 !== undefined
        ? toNum(source.max_line1, DEFAULT_MAX_CHARS_LINE1)
        : source.maxcharsline1 !== undefined
          ? toNum(source.maxcharsline1, DEFAULT_MAX_CHARS_LINE1)
          : DEFAULT_MAX_CHARS_LINE1;
  const maxCharsLine2 =
    source.maxLine2 !== undefined
      ? toNum(source.maxLine2, DEFAULT_MAX_CHARS_LINE2)
      : source.max_line2 !== undefined
        ? toNum(source.max_line2, DEFAULT_MAX_CHARS_LINE2)
        : source.maxcharsline2 !== undefined
          ? toNum(source.maxcharsline2, DEFAULT_MAX_CHARS_LINE2)
          : DEFAULT_MAX_CHARS_LINE2;

  return { name, qr, dpi, mmWidth, mmHeight, rotation, outputFormat, maxCharsLine1, maxCharsLine2 };
}

async function handleLegacyBadgeRequest(req, res) {
  try {
    const { name, qr, dpi, mmWidth, mmHeight, rotation, outputFormat, maxCharsLine1, maxCharsLine2 } =
      parseParams(req);

    let resolvedName = name;
    let resolvedQr = qr;
    let subtitleLine = '';

    if (qr) {
      if (isLegacySupabaseConfigured()) {
        const participant = await fetchLegacyParticipant(qr);
        if (participant) {
          if (typeof participant.name === 'string' && participant.name.trim().length > 0) {
            resolvedName = participant.name.trim();
          }
          const extra = parseExtraAnswers(participant.extra_answers);
          subtitleLine = displayLineFromExtraAnswers(extra);
          resolvedQr = String(qr).trim();
        } else {
          resolvedQr = undefined;
        }
      } else {
        resolvedQr = String(qr).trim();
      }
    }

    if (!resolvedName) {
      return res.status(400).json({ error: 'Missing required parameter: name' });
    }

    const pngBuffer = await renderBadgePng({
      name: resolvedName,
      qrText: resolvedQr,
      subtitleLine,
      dpi,
      mmWidth,
      mmHeight,
      rotation,
      maxCharsLine1,
      maxCharsLine2,
    });

    if (outputFormat === 'base64') {
      const base64String = pngBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64String}`;
      res.setHeader('Content-Type', 'application/json');
      res.json({
        success: true,
        format: 'base64',
        data: base64String,
        dataUri,
        mimeType: 'image/png',
      });
    } else {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline; filename="badge.png"');
      res.send(pngBuffer);
    }
  } catch (err) {
    console.error('Error generating badge:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { handleLegacyBadgeRequest, parseParams };
