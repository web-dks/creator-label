'use strict';

const QRCode = require('qrcode');
const { loadImage } = require('./canvasRuntime');

/**
 * Desenha o QR do elemento (docs/plano-motor-dinamico-etiquetas.md §14):
 * conteúdo sempre participant.id, fundo branco, quadrado, centralizado na
 * caixa, sem distorção. `qrValue` já vem normalizado por dataResolver.
 */
async function renderQrElement(ctx, element, qrValue, scale) {
  if (!qrValue) return;

  const { scaleX, scaleY } = scale;
  const boxX = element.x * scaleX;
  const boxY = element.y * scaleY;
  const boxWidth = element.width * scaleX;
  const boxHeight = element.height * scaleY;
  const squareSize = Math.round(Math.min(boxWidth, boxHeight));
  if (squareSize <= 0) return;

  const margin = Number.isInteger(element.margin) ? element.margin : 2;
  const errorCorrectionLevel = element.errorCorrectionLevel || 'M';

  const qrPngBuffer = await QRCode.toBuffer(qrValue, {
    errorCorrectionLevel,
    margin,
    color: { dark: '#000000', light: '#FFFFFF' },
    width: squareSize,
    type: 'png',
  });

  const img = await loadImage(qrPngBuffer);
  const drawX = boxX + (boxWidth - squareSize) / 2;
  const drawY = boxY + (boxHeight - squareSize) / 2;
  ctx.drawImage(img, drawX, drawY, squareSize, squareSize);
}

module.exports = { renderQrElement };
