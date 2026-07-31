'use strict';

const {
  DYNAMIC_VIRTUAL_WIDTH,
  DYNAMIC_VIRTUAL_HEIGHT,
  DYNAMIC_LAYOUT_SCHEMA_VERSION,
  DYNAMIC_LAYOUT_MAX_ELEMENTS,
} = require('../config/constants');
const { LayoutInvalidError } = require('../utils/errors');

const ELEMENT_TYPES = ['text', 'qr_code', 'image'];
const TEXT_ALIGNMENTS = ['left', 'center', 'right'];
const OVERFLOW_STRATEGIES = ['wrap', 'shrink', 'truncate', 'hide'];
const QR_ERROR_CORRECTION_LEVELS = ['L', 'M', 'Q', 'H'];
const IMAGE_FIT_MODES = ['contain', 'cover'];

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 140;
const MAX_LINES_MIN = 1;
const MAX_LINES_MAX = 4;
const MAX_CHARACTERS_MIN = 1;
const MAX_CHARACTERS_MAX = 250;
const QR_SIZE_MIN = 100;
const QR_SIZE_MAX = 360;

// Perfil físico homologado (docs/plano-motor-dinamico-etiquetas.md §2.2).
// Qualquer print_profile fora disto é tratado como layout inválido.
const HOMOLOGATED_PRINT_PROFILE = {
  width_mm: 80,
  height_mm: 50,
  dpi: 300,
  default_rotation: 0,
};

function fail(reason) {
  throw new LayoutInvalidError(`invalid label layout: ${reason}`);
}

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateCommonElementFields(el, index) {
  if (!el || typeof el !== 'object') fail(`elements[${index}] is not an object`);
  if (typeof el.id !== 'string' || el.id.length === 0) fail(`elements[${index}].id must be a non-empty string`);
  if (!ELEMENT_TYPES.includes(el.type)) fail(`elements[${index}].type "${el.type}" is not supported`);
  if (el.isVisible !== undefined && typeof el.isVisible !== 'boolean') {
    fail(`elements[${index}].isVisible must be boolean`);
  }
  if (el.rotation !== undefined && el.rotation !== 0) {
    fail(`elements[${index}].rotation must be 0 (rotation is not supported in the MVP)`);
  }
  if (!isFiniteNumber(el.x) || !isFiniteNumber(el.y) || !isFiniteNumber(el.width) || !isFiniteNumber(el.height)) {
    fail(`elements[${index}] must have finite numeric x, y, width and height`);
  }
  if (el.x < 0 || el.y < 0 || el.width <= 0 || el.height <= 0) {
    fail(`elements[${index}] has non-positive width/height or negative position`);
  }
  if (el.x > DYNAMIC_VIRTUAL_WIDTH || el.y > DYNAMIC_VIRTUAL_HEIGHT) {
    fail(`elements[${index}] is positioned outside the ${DYNAMIC_VIRTUAL_WIDTH}x${DYNAMIC_VIRTUAL_HEIGHT} canvas`);
  }
}

function validateTextElement(el, index) {
  if (!isFiniteNumber(el.fontSize) || el.fontSize < FONT_SIZE_MIN || el.fontSize > FONT_SIZE_MAX) {
    fail(`elements[${index}].fontSize must be between ${FONT_SIZE_MIN} and ${FONT_SIZE_MAX}`);
  }
  if (
    !isFiniteNumber(el.minFontSize) ||
    el.minFontSize < FONT_SIZE_MIN ||
    el.minFontSize > FONT_SIZE_MAX ||
    el.minFontSize > el.fontSize
  ) {
    fail(`elements[${index}].minFontSize must be between ${FONT_SIZE_MIN} and fontSize`);
  }
  if (!Number.isInteger(el.maxLines) || el.maxLines < MAX_LINES_MIN || el.maxLines > MAX_LINES_MAX) {
    fail(`elements[${index}].maxLines must be an integer between ${MAX_LINES_MIN} and ${MAX_LINES_MAX}`);
  }
  if (
    !Number.isInteger(el.maxCharacters) ||
    el.maxCharacters < MAX_CHARACTERS_MIN ||
    el.maxCharacters > MAX_CHARACTERS_MAX
  ) {
    fail(`elements[${index}].maxCharacters must be an integer between ${MAX_CHARACTERS_MIN} and ${MAX_CHARACTERS_MAX}`);
  }
  if (!OVERFLOW_STRATEGIES.includes(el.overflowStrategy)) {
    fail(`elements[${index}].overflowStrategy "${el.overflowStrategy}" is not supported`);
  }
  if (el.textAlign !== undefined && !TEXT_ALIGNMENTS.includes(el.textAlign)) {
    fail(`elements[${index}].textAlign "${el.textAlign}" is not supported`);
  }
  if (typeof el.dataSource !== 'string' || el.dataSource.length === 0) {
    fail(`elements[${index}].dataSource must be a non-empty string`);
  }
}

function validateQrElement(el, index) {
  if (el.width < QR_SIZE_MIN || el.width > QR_SIZE_MAX || el.height < QR_SIZE_MIN || el.height > QR_SIZE_MAX) {
    fail(`elements[${index}] QR width/height must be between ${QR_SIZE_MIN} and ${QR_SIZE_MAX}`);
  }
  if (el.errorCorrectionLevel !== undefined && !QR_ERROR_CORRECTION_LEVELS.includes(el.errorCorrectionLevel)) {
    fail(`elements[${index}].errorCorrectionLevel "${el.errorCorrectionLevel}" is not supported`);
  }
  if (el.margin !== undefined && (!Number.isInteger(el.margin) || el.margin < 0)) {
    fail(`elements[${index}].margin must be a non-negative integer`);
  }
  if (typeof el.dataSource !== 'string' || el.dataSource.length === 0) {
    fail(`elements[${index}].dataSource must be a non-empty string`);
  }
}

function validateImageElement(el, index) {
  if (el.fit !== undefined && !IMAGE_FIT_MODES.includes(el.fit)) {
    fail(`elements[${index}].fit "${el.fit}" is not supported`);
  }
  if (typeof el.dataSource !== 'string' || el.dataSource.length === 0) {
    fail(`elements[${index}].dataSource must be a non-empty string`);
  }
}

function validateLayoutConfig(layoutConfig) {
  if (!layoutConfig || typeof layoutConfig !== 'object') fail('layout_config missing or not an object');
  if (layoutConfig.schemaVersion !== DYNAMIC_LAYOUT_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${DYNAMIC_LAYOUT_SCHEMA_VERSION}`);
  }
  if (layoutConfig.orientation !== 'landscape') fail('orientation must be "landscape"');
  if (layoutConfig.virtualWidth !== DYNAMIC_VIRTUAL_WIDTH) fail(`virtualWidth must be ${DYNAMIC_VIRTUAL_WIDTH}`);
  if (layoutConfig.virtualHeight !== DYNAMIC_VIRTUAL_HEIGHT) fail(`virtualHeight must be ${DYNAMIC_VIRTUAL_HEIGHT}`);
  if (!Array.isArray(layoutConfig.elements)) fail('elements must be an array');
  if (layoutConfig.elements.length > DYNAMIC_LAYOUT_MAX_ELEMENTS) {
    fail(`elements exceeds the limit of ${DYNAMIC_LAYOUT_MAX_ELEMENTS}`);
  }

  layoutConfig.elements.forEach((el, index) => {
    validateCommonElementFields(el, index);
    if (el.type === 'text') validateTextElement(el, index);
    else if (el.type === 'qr_code') validateQrElement(el, index);
    else if (el.type === 'image') validateImageElement(el, index);
  });
}

function validatePrintProfile(printProfile) {
  if (!printProfile || typeof printProfile !== 'object') fail('print_profile missing or not an object');
  if (printProfile.width_mm !== HOMOLOGATED_PRINT_PROFILE.width_mm) {
    fail(`print_profile.width_mm must be ${HOMOLOGATED_PRINT_PROFILE.width_mm}`);
  }
  if (printProfile.height_mm !== HOMOLOGATED_PRINT_PROFILE.height_mm) {
    fail(`print_profile.height_mm must be ${HOMOLOGATED_PRINT_PROFILE.height_mm}`);
  }
  if (printProfile.dpi !== HOMOLOGATED_PRINT_PROFILE.dpi) {
    fail(`print_profile.dpi must be ${HOMOLOGATED_PRINT_PROFILE.dpi}`);
  }
  const supportsDefaultRotation =
    printProfile.default_rotation === HOMOLOGATED_PRINT_PROFILE.default_rotation &&
    (!Array.isArray(printProfile.supported_rotations) ||
      printProfile.supported_rotations.includes(HOMOLOGATED_PRINT_PROFILE.default_rotation));
  if (!supportsDefaultRotation) {
    fail('print_profile.default_rotation must be 0 and supported_rotations (if present) must include 0');
  }
}

/**
 * Valida o envelope inteiro devolvido por `get_published_event_label_layout`
 * (version_id, layout_config, print_profile). Lança `LayoutInvalidError`
 * (fallback elegível) em qualquer violação — nunca 500 na rota legada.
 */
function validateLayoutResponse(layoutResponse) {
  if (!layoutResponse || typeof layoutResponse !== 'object') {
    fail('layout response missing or not an object');
  }
  if (!Number.isFinite(layoutResponse.version_id)) fail('version_id must be a number');

  validateLayoutConfig(layoutResponse.layout_config);
  validatePrintProfile(layoutResponse.print_profile);

  return layoutResponse;
}

module.exports = {
  validateLayoutResponse,
  HOMOLOGATED_PRINT_PROFILE,
};
