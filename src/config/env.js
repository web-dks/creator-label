'use strict';

require('dotenv').config();

const packageJson = require('../../package.json');

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
  LABEL_LAYOUT_CACHE_TTL_SECONDS: parseIntOr(process.env.LABEL_LAYOUT_CACHE_TTL_SECONDS, 60),
  LABEL_CONTEXT_CACHE_TTL_SECONDS: parseIntOr(process.env.LABEL_CONTEXT_CACHE_TTL_SECONDS, 60),
  LABEL_RATE_LIMIT_WINDOW_MS: parseIntOr(process.env.LABEL_RATE_LIMIT_WINDOW_MS, 60000),
  LABEL_RATE_LIMIT_MAX: process.env.LABEL_RATE_LIMIT_MAX,
  LABEL_CONCURRENCY_LIMIT: process.env.LABEL_CONCURRENCY_LIMIT,
};

module.exports = { env, parseBoolean, parseEventIdAllowlist, parseHostAllowlist, parseIntOr };
