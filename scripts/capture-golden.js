'use strict';

/**
 * Manual, explicit script that (re)generates the legacy golden baseline.
 *
 * This is intentionally NOT part of `npm test`: golden diffs must never be
 * auto-approved (adjustment 4 of docs/plano-motor-dinamico-etiquetas.md).
 * Run it only when a baseline change was reviewed and accepted on purpose.
 *
 *   npm run golden:capture   # first capture (fails if golden/manifest.json already exists)
 *   npm run golden:update    # explicit, deliberate re-capture of the baseline
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { startLegacyServer } = require('../tests/fakes/legacyServerHarness');
const { CASES } = require('../tests/fixtures/golden-cases');

const GOLDEN_DIR = path.join(__dirname, '..', 'golden');
const MANIFEST_PATH = path.join(GOLDEN_DIR, 'manifest.json');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  const isUpdate = process.argv.includes('--update');

  if (fs.existsSync(MANIFEST_PATH) && !isUpdate) {
    console.error(
      `golden/manifest.json already exists. Use "npm run golden:update" if you deliberately ` +
        `reviewed and accept a baseline change.`
    );
    process.exit(1);
  }

  fs.mkdirSync(GOLDEN_DIR, { recursive: true });

  const server = await startLegacyServer();
  const manifest = { capturedAt: new Date().toISOString(), nodeVersion: process.version, cases: {} };

  try {
    for (const testCase of CASES) {
      const res = await server.requestGet(testCase.params);
      if (res.status !== 200) {
        throw new Error(
          `Case "${testCase.name}" returned status ${res.status}: ${res.body.toString('utf8')}`
        );
      }

      const isBase64 = testCase.params.format === 'base64';
      let pngBuffer;
      if (isBase64) {
        const json = JSON.parse(res.body.toString('utf8'));
        pngBuffer = Buffer.from(json.data, 'base64');
      } else {
        pngBuffer = res.body;
      }

      const pngPath = path.join(GOLDEN_DIR, `${testCase.name}.png`);
      fs.writeFileSync(pngPath, pngBuffer);

      manifest.cases[testCase.name] = {
        params: testCase.params,
        responseSha256: sha256(res.body),
        pngSha256: sha256(pngBuffer),
        pngBytes: pngBuffer.length,
        contentType: res.headers['content-type'],
      };

      console.log(`captured ${testCase.name} -> pngSha256=${manifest.cases[testCase.name].pngSha256}`);
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\nWrote ${MANIFEST_PATH}`);
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
