'use strict';

const net = require('node:net');

/**
 * Faixas privadas/reservadas bloqueadas para o fetch de logo
 * (docs/plano-motor-dinamico-etiquetas.md §3.8 — proteção contra SSRF).
 */
function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inIpv4Range(ip, base, maskBits) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

const IPV4_BLOCKED_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function isPrivateOrReservedIpv4(ip) {
  return IPV4_BLOCKED_RANGES.some(([base, bits]) => inIpv4Range(ip, base, bits));
}

function isPrivateOrReservedIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7 (ULA)
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — valida a faixa IPv4 embutida.
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) return isPrivateOrReservedIpv4(mapped);
  }
  return false;
}

/** Bloqueia SSRF via IP privado, loopback, link-local ou reservado (v4/v6). */
function isPrivateOrReservedIp(ip) {
  if (net.isIPv4(ip)) return isPrivateOrReservedIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateOrReservedIpv6(ip);
  return true; // formato desconhecido: nega por padrão.
}

module.exports = { isPrivateOrReservedIp };
