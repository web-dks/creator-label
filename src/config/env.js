'use strict';

require('dotenv').config();

const packageJson = require('../../package.json');
const { getRateLimitDefaults } = require('./rateLimitDefaults');

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function parseEventIdAllowlist(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n));
}

function parseHostAllowlist(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function parseIntOr(value, defaultValue) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/** Aceita apenas 0/90/180/270; valor inválido ou vazio → default. */
function parseRotationDegrees(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  return [0, 90, 180, 270].includes(n) ? n : defaultValue;
}

const NODE_ENV = process.env.NODE_ENV || 'development';

const env = {
  NODE_ENV,
  PORT: process.env.PORT || 3000,
  SERVICE_VERSION: packageJson.version,

  // Supabase — sistema de credenciamento
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_PARTICIPANTS_TABLE: process.env.SUPABASE_PARTICIPANTS_TABLE || 'participants',
  SUPABASE_SCHEMA: process.env.SUPABASE_SCHEMA || 'public',

  // Motor dinâmico (Fase 3)
  LABEL_DYNAMIC_LAYOUT_ENABLED: parseBoolean(process.env.LABEL_DYNAMIC_LAYOUT_ENABLED, false),
  LABEL_DYNAMIC_EVENT_IDS: parseEventIdAllowlist(process.env.LABEL_DYNAMIC_EVENT_IDS),
  LABEL_API_KEY: process.env.LABEL_API_KEY || '',
  LABEL_LOGO_ALLOWED_HOSTS: parseHostAllowlist(process.env.LABEL_LOGO_ALLOWED_HOSTS),
  // Rotação só na saída de /badge dinâmico (contrato app/TSPL). Layout do
  // editor e /v2 permanecem na orientação de design (80x50). Default 90 =
  // bobina atual tsc.size(width:50, height:80). Trocar impressora no futuro:
  // ajustar esta env (0/90/180/270) sem redesenhar layouts.
  LABEL_BADGE_OUTPUT_ROTATION: parseRotationDegrees(process.env.LABEL_BADGE_OUTPUT_ROTATION, 90),
  // Tamanho físico da bobina no app (tsc.size) + DPI da impressora térmica.
  // Após girar, o PNG é redimensionado para width_mm×height_mm @ printer_dpi
  // para não estourar várias etiquetas (300 DPI de design >> 203 DPI típico).
  // LABEL_BADGE_PRINTER_DPI=0 desliga o rescale (só rotação / design puro).
  LABEL_BADGE_OUTPUT_WIDTH_MM: parseIntOr(process.env.LABEL_BADGE_OUTPUT_WIDTH_MM, 50),
  LABEL_BADGE_OUTPUT_HEIGHT_MM: parseIntOr(process.env.LABEL_BADGE_OUTPUT_HEIGHT_MM, 80),
  LABEL_BADGE_PRINTER_DPI: parseIntOr(process.env.LABEL_BADGE_PRINTER_DPI, 203),
  LABEL_LAYOUT_CACHE_TTL_SECONDS: parseIntOr(process.env.LABEL_LAYOUT_CACHE_TTL_SECONDS, 60),
  LABEL_CONTEXT_CACHE_TTL_SECONDS: parseIntOr(process.env.LABEL_CONTEXT_CACHE_TTL_SECONDS, 60),
  LABEL_RATE_LIMIT_WINDOW_MS: parseIntOr(process.env.LABEL_RATE_LIMIT_WINDOW_MS, 60000),
};

/** Converte mm → dots da impressora térmica (TSPL). */
function mmToPrinterDots(mm, printerDpi) {
  if (!printerDpi || printerDpi <= 0 || !mm || mm <= 0) return 0;
  return Math.round((mm * printerDpi) / 25.4);
}

const envDefaults = getRateLimitDefaults(env.NODE_ENV);
env.LABEL_RATE_LIMIT_MAX = parseIntOr(process.env.LABEL_RATE_LIMIT_MAX, envDefaults.rateLimitMax);
env.LABEL_CONCURRENCY_LIMIT = parseIntOr(process.env.LABEL_CONCURRENCY_LIMIT, envDefaults.concurrencyLimit);

module.exports = {
  env,
  parseBoolean,
  parseEventIdAllowlist,
  parseHostAllowlist,
  parseIntOr,
  parseRotationDegrees,
  mmToPrinterDots,
};
