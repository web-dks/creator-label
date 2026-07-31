'use strict';

/**
 * Golden case matrix requested for the legacy baseline (Task 1):
 * short/medium/long name, two lines, CPS subtitle rule, no QR,
 * Base64, PNG, rotation=0, dpi=300.
 *
 * Each case is a single `/badge` request. `params` are sent both as
 * GET query string and as POST JSON body by the capture/compare
 * scripts, so the baseline also proves GET/POST parity.
 */
const CASES = [
  {
    name: 'nome-curto-png',
    params: { qr: '11111111-1111-1111-1111-111111111111', dpi: 300, rotation: 0, format: 'png' },
  },
  {
    name: 'nome-medio-duas-linhas-png',
    params: { qr: '22222222-2222-2222-2222-222222222222', dpi: 300, rotation: 0, format: 'png' },
  },
  {
    name: 'nome-longo-png',
    params: { qr: '33333333-3333-3333-3333-333333333333', dpi: 300, rotation: 0, format: 'png' },
  },
  {
    name: 'regra-cps-com-subtitulo-png',
    params: { qr: '44444444-4444-4444-4444-444444444444', dpi: 300, rotation: 0, format: 'png' },
  },
  {
    name: 'duas-linhas-sem-qr-base64',
    params: { name: 'Beatriz Nogueira Lima Santos', dpi: 300, rotation: 0, format: 'base64' },
  },
  {
    name: 'sem-qr-nome-literal-png',
    params: { name: 'Visitante Avulso', dpi: 300, rotation: 0, format: 'png' },
  },
  {
    name: 'base64-nome-curto',
    params: { qr: '11111111-1111-1111-1111-111111111111', dpi: 300, rotation: 0, format: 'base64' },
  },
  {
    name: 'aliases-max-line-rotate',
    params: {
      qr: '33333333-3333-3333-3333-333333333333',
      dpi: 300,
      rotate: 0,
      format: 'png',
      max_line1: 12,
      max_line2: 12,
    },
  },
];

module.exports = { CASES };
