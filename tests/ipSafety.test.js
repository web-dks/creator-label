'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateOrReservedIp } = require('../src/utils/ipSafety');

test('ipSafety blocks private/reserved/loopback ranges (SSRF hardening)', () => {
  const blocked = [
    '127.0.0.1',
    '10.0.0.5',
    '172.16.5.4',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.1.1',
    '0.0.0.0',
    '100.64.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
  ];
  for (const ip of blocked) {
    assert.equal(isPrivateOrReservedIp(ip), true, `expected ${ip} to be blocked`);
  }
});

test('ipSafety allows public IPs', () => {
  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'];
  for (const ip of allowed) {
    assert.equal(isPrivateOrReservedIp(ip), false, `expected ${ip} to be allowed`);
  }
});

test('ipSafety denies unrecognized address formats by default', () => {
  assert.equal(isPrivateOrReservedIp('not-an-ip'), true);
});
