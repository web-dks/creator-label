'use strict';

const path = require('node:path');

// src/config -> project root
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Legacy renderer (régua virtual 500x800), preservado bit-a-bit da Fase 1/2.
const MM_WIDTH = 50; // mm
const MM_HEIGHT = 80; // mm
const DEFAULT_DPI = 300;
const MIN_DPI = 72;
const MAX_DPI = 1200;
const DEFAULT_MAX_CHARS_LINE1 = 15;
const DEFAULT_MAX_CHARS_LINE2 = 15;

const VIRTUAL_W = 500;
const VIRTUAL_H = 800;

const LEGACY_LAYOUT_BASE = {
  marginTop: 40,
  titleFont: 118,
  secondFont: 118,
  lineGap: 40,
  afterTextGap: 180,
  qrSize: 300,
  subtitleFont: 72,
  gapNameToSubtitle: 36,
  nameBlockTopOffset: 22,
};

const EXTRA_KEY_AREA = 'Área de atuação CPS';
const EXTRA_KEY_UNIDADE = 'Unidade';

// Motor dinâmico (Fase 3) — canvas lógico do layout publicado.
const DYNAMIC_VIRTUAL_WIDTH = 800;
const DYNAMIC_VIRTUAL_HEIGHT = 500;
const DYNAMIC_LAYOUT_SCHEMA_VERSION = 1;
const DYNAMIC_LAYOUT_MAX_ELEMENTS = 12;

// Timeouts (docs/plano-motor-dinamico-etiquetas.md §3.7)
const SUPABASE_OPERATION_TIMEOUT_MS = 2000;
const DYNAMIC_FLOW_TOTAL_BUDGET_MS = 5000;
const LOGO_FETCH_TIMEOUT_MS = 2000;

// imageService (docs/plano-motor-dinamico-etiquetas.md §3.8)
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_DIMENSION_PX = 4000;

module.exports = {
  PROJECT_ROOT,
  MM_WIDTH,
  MM_HEIGHT,
  DEFAULT_DPI,
  MIN_DPI,
  MAX_DPI,
  DEFAULT_MAX_CHARS_LINE1,
  DEFAULT_MAX_CHARS_LINE2,
  VIRTUAL_W,
  VIRTUAL_H,
  LEGACY_LAYOUT_BASE,
  EXTRA_KEY_AREA,
  EXTRA_KEY_UNIDADE,
  DYNAMIC_VIRTUAL_WIDTH,
  DYNAMIC_VIRTUAL_HEIGHT,
  DYNAMIC_LAYOUT_SCHEMA_VERSION,
  DYNAMIC_LAYOUT_MAX_ELEMENTS,
  SUPABASE_OPERATION_TIMEOUT_MS,
  DYNAMIC_FLOW_TOTAL_BUDGET_MS,
  LOGO_FETCH_TIMEOUT_MS,
  LOGO_MAX_BYTES,
  LOGO_MAX_DIMENSION_PX,
};
