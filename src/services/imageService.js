'use strict';

const dns = require('node:dns').promises;
const { URL } = require('node:url');
const { env } = require('../config/env');
const { LogoFetchError } = require('../utils/errors');
const { isPrivateOrReservedIp } = require('../utils/ipSafety');
const { loadImage } = require('../renderers/canvasRuntime');
const { LOGO_FETCH_TIMEOUT_MS, LOGO_MAX_BYTES, LOGO_MAX_DIMENSION_PX } = require('../config/constants');

const MAX_REDIRECTS = 1;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Busca segura da logo do evento (docs/plano-motor-dinamico-etiquetas.md
 * §3.8). Falha aqui NUNCA aciona o fallback total: o chamador
 * (dynamicLabelRenderer) captura `LogoFetchError`, omite o elemento e
 * segue renderizando o resto da etiqueta.
 *
 * `deps` permite injetar `dnsLookup`/`fetch` fake nos testes, sem abrir
 * mão da checagem real de allowlist/IP privado em produção.
 */
function getAllowedHosts() {
  if (env.LABEL_LOGO_ALLOWED_HOSTS.length > 0) return env.LABEL_LOGO_ALLOWED_HOSTS;
  if (env.SUPABASE_URL) {
    try {
      return [new URL(env.SUPABASE_URL).hostname.toLowerCase()];
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function assertHostIsSafe(hostname, dnsLookup) {
  const allowed = getAllowedHosts();
  if (allowed.length === 0 || !allowed.includes(hostname.toLowerCase())) {
    throw new LogoFetchError(`host "${hostname}" is not in the logo allowlist`);
  }

  let addresses;
  try {
    addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  } catch (e) {
    throw new LogoFetchError(`DNS lookup failed for host "${hostname}": ${e.message}`);
  }
  if (!addresses || addresses.length === 0) {
    throw new LogoFetchError(`DNS lookup returned no addresses for "${hostname}"`);
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new LogoFetchError(`host "${hostname}" resolves to a private/reserved IP (${address})`);
    }
  }
}

function detectImageMime(buffer) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

async function fetchOnce(url, dnsLookup, fetchImpl) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new LogoFetchError(`logo URL must use https (got "${parsed.protocol}")`);
  }
  await assertHostIsSafe(parsed.hostname, dnsLookup);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { redirect: 'manual', signal: controller.signal });
  } catch (e) {
    throw new LogoFetchError(`failed to fetch logo: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readBodyWithLimit(response) {
  const reader = response.body && typeof response.body.getReader === 'function' ? response.body.getReader() : null;
  if (!reader) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > LOGO_MAX_BYTES) throw new LogoFetchError('logo exceeds the maximum allowed size');
    return buf;
  }

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > LOGO_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new LogoFetchError('logo exceeds the maximum allowed size');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchLogoImage(url, deps = {}) {
  const dnsLookup = deps.dnsLookup || dns.lookup;
  const fetchImpl = deps.fetch || fetch;

  if (typeof url !== 'string' || !url) throw new LogoFetchError('logo URL is empty');

  let response = await fetchOnce(url, dnsLookup, fetchImpl);
  let redirects = 0;
  while (REDIRECT_STATUSES.has(response.status)) {
    if (redirects >= MAX_REDIRECTS) throw new LogoFetchError('too many redirects while fetching logo');
    const location = response.headers.get('location');
    if (!location) throw new LogoFetchError('redirect response missing Location header');
    const nextUrl = new URL(location, url).toString();
    response = await fetchOnce(nextUrl, dnsLookup, fetchImpl);
    redirects += 1;
  }

  if (!response.ok) throw new LogoFetchError(`logo fetch failed with status ${response.status}`);

  const buffer = await readBodyWithLimit(response);
  if (buffer.length === 0) throw new LogoFetchError('logo response body is empty');

  const detectedMime = detectImageMime(buffer);
  if (!detectedMime) throw new LogoFetchError('logo content is not a recognized PNG/JPEG/WebP image');

  const declaredContentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (declaredContentType && declaredContentType !== detectedMime) {
    throw new LogoFetchError(`declared Content-Type "${declaredContentType}" does not match actual image data`);
  }

  let image;
  try {
    image = await loadImage(buffer);
  } catch (e) {
    throw new LogoFetchError(`failed to decode logo image: ${e.message}`);
  }
  if (image.width > LOGO_MAX_DIMENSION_PX || image.height > LOGO_MAX_DIMENSION_PX) {
    throw new LogoFetchError(
      `logo dimensions ${image.width}x${image.height} exceed the maximum of ${LOGO_MAX_DIMENSION_PX}px`
    );
  }

  return { buffer, image, mimeType: detectedMime, width: image.width, height: image.height };
}

module.exports = { fetchLogoImage, detectImageMime, getAllowedHosts, assertHostIsSafe };
