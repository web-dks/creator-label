'use strict';

/**
 * Desenha uma imagem já carregada e validada por imageService (docs
 * /plano-motor-dinamico-etiquetas.md §15), respeitando `fit`
 * (contain por padrão) dentro da caixa do elemento, sem distorcer a
 * proporção original.
 */
function renderImageElement(ctx, element, image, scale) {
  if (!image || !image.width || !image.height) return;

  const { scaleX, scaleY } = scale;
  const boxX = element.x * scaleX;
  const boxY = element.y * scaleY;
  const boxWidth = element.width * scaleX;
  const boxHeight = element.height * scaleY;
  if (boxWidth <= 0 || boxHeight <= 0) return;

  const fit = element.fit === 'cover' ? 'cover' : 'contain';
  const scaleContain = Math.min(boxWidth / image.width, boxHeight / image.height);
  const scaleCover = Math.max(boxWidth / image.width, boxHeight / image.height);
  const chosenScale = fit === 'cover' ? scaleCover : scaleContain;

  const drawWidth = image.width * chosenScale;
  const drawHeight = image.height * chosenScale;
  const drawX = boxX + (boxWidth - drawWidth) / 2;
  const drawY = boxY + (boxHeight - drawHeight) / 2;

  ctx.save();
  if (fit === 'cover') {
    ctx.beginPath();
    ctx.rect(boxX, boxY, boxWidth, boxHeight);
    ctx.clip();
  }
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

module.exports = { renderImageElement };
