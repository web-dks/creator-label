'use strict';

/**
 * Motor dinâmico de etiquetas (docs/plano-motor-dinamico-etiquetas.md §11).
 * Recebe o layout já validado por layoutContractValidator e os dados já
 * resolvidos por resolve_participant_label_data, e desenha cada elemento
 * na ordem do array `elements`. Falha de logo nunca vira fallback total.
 */

const { DYNAMIC_VIRTUAL_WIDTH, DYNAMIC_VIRTUAL_HEIGHT } = require('../config/constants');
const { createCanvas, getContext2d, encodePng, registeredFontFamily } = require('./canvasRuntime');
const { resolveTextValue, resolveQrValue, resolveImageUrl } = require('../services/dataResolver');
const { renderTextElement } = require('./textRenderer');
const { renderQrElement } = require('./qrRenderer');
const { renderImageElement } = require('./imageRenderer');
const { fetchLogoImage } = require('../services/imageService');
const logger = require('../utils/logger');

function mmToPx(mm, dpi) {
  return Math.round((mm / 25.4) * dpi);
}

/** Conversão física do canvas virtual 800x500 (docs §11). */
function computeScale(printProfile) {
  const widthPx = mmToPx(printProfile.width_mm, printProfile.dpi);
  const heightPx = mmToPx(printProfile.height_mm, printProfile.dpi);
  const scaleX = widthPx / DYNAMIC_VIRTUAL_WIDTH;
  const scaleY = heightPx / DYNAMIC_VIRTUAL_HEIGHT;
  return { widthPx, heightPx, scaleX, scaleY, uniformScale: Math.min(scaleX, scaleY) };
}

async function renderElement(ctx, element, labelData, scale, requestId) {
  if (element.isVisible === false) return;

  if (element.type === 'text') {
    const text = resolveTextValue(element, labelData);
    renderTextElement(ctx, element, text, scale, registeredFontFamily);
    return;
  }

  if (element.type === 'qr_code') {
    const qrValue = resolveQrValue(element, labelData);
    await renderQrElement(ctx, element, qrValue, scale);
    return;
  }

  if (element.type === 'image') {
    const url = resolveImageUrl(element, labelData);
    if (!url) return;
    try {
      const { image } = await fetchLogoImage(url);
      renderImageElement(ctx, element, image, scale);
    } catch (e) {
      // Falha isolada de logo: omite o elemento e segue (docs §15).
      logger.warn('dynamic-label:image-element-skipped', {
        requestId,
        elementId: element.id,
        reason: e && e.message,
      });
    }
  }
}

function applyRotation(canvas, widthPx, heightPx, rotation) {
  if (rotation === 0) return canvas;

  const finalWidth = rotation === 90 || rotation === 270 ? heightPx : widthPx;
  const finalHeight = rotation === 90 || rotation === 270 ? widthPx : heightPx;
  const finalCanvas = createCanvas(finalWidth, finalHeight);
  const finalCtx = getContext2d(finalCanvas);
  finalCtx.fillStyle = '#FFFFFF';
  finalCtx.fillRect(0, 0, finalWidth, finalHeight);

  finalCtx.save();
  if (rotation === 90) {
    finalCtx.translate(finalWidth, 0);
    finalCtx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    finalCtx.translate(finalWidth, finalHeight);
    finalCtx.rotate(Math.PI);
  } else if (rotation === 270) {
    finalCtx.translate(0, finalHeight);
    finalCtx.rotate((3 * Math.PI) / 2);
  }
  finalCtx.drawImage(canvas, 0, 0);
  finalCtx.restore();
  return finalCanvas;
}

/**
 * Renderiza a etiqueta dinâmica em PNG. `layoutResponse` deve já ter
 * passado por `validateLayoutResponse`. Retorna o buffer PNG final.
 */
async function renderDynamicLabelPng(layoutResponse, labelData, options = {}) {
  const layoutConfig = layoutResponse.layout_config;
  const printProfile = layoutResponse.print_profile;
  const scale = computeScale(printProfile);

  const canvas = createCanvas(scale.widthPx, scale.heightPx);
  const ctx = getContext2d(canvas);
  ctx.fillStyle = layoutConfig.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, scale.widthPx, scale.heightPx);

  for (const element of layoutConfig.elements) {
    await renderElement(ctx, element, labelData, scale, options.requestId);
  }

  const allowedRotations = [0, 90, 180, 270];
  // options.outputRotation: override só para /badge (contrato impressora).
  // Sem override, usa print_profile.default_rotation (orientação de design).
  const fromOptions = options.outputRotation;
  const fromProfile = printProfile.default_rotation;
  const rotation = allowedRotations.includes(fromOptions)
    ? fromOptions
    : allowedRotations.includes(fromProfile)
      ? fromProfile
      : 0;
  const finalCanvas = applyRotation(canvas, scale.widthPx, scale.heightPx, rotation);
  return encodePng(finalCanvas);
}

module.exports = { renderDynamicLabelPng, computeScale, applyRotation };
