'use strict';

/**
 * Renderização de texto do motor dinâmico (docs/plano-motor-dinamico-etiquetas.md
 * §13). Recebe o valor textual já resolvido (dataSource/fallback aplicados
 * por dataResolver) e cuida de maxCharacters, overflowStrategy e desenho.
 */

const SUPPORTED_FONT_FAMILIES = new Set(['Arial']);
const ELLIPSIS = '…';

function resolveFontFamily(fontFamily, registeredFontFamily) {
  if (fontFamily && SUPPORTED_FONT_FAMILIES.has(fontFamily)) {
    return registeredFontFamily || fontFamily;
  }
  // Fonte desconhecida cai para Arial (docs §13 "Fonte").
  return registeredFontFamily || 'Arial';
}

function buildFontString(fontSizePx, fontWeight, fontFamily) {
  const weight = fontWeight === 'bold' ? 'bold ' : '';
  return `${weight}${Math.max(1, Math.round(fontSizePx))}px ${fontFamily}`;
}

function applyMaxCharacters(text, maxCharacters) {
  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) return text;
  if (text.length <= maxCharacters) return text;
  if (maxCharacters === 1) return ELLIPSIS;
  return `${text.slice(0, maxCharacters - 1)}${ELLIPSIS}`;
}

function wrapWords(ctx, words, maxWidthPx, maxLines) {
  const lines = [];
  let idx = 0;
  while (idx < words.length && lines.length < maxLines) {
    let line = words[idx];
    idx += 1;
    while (idx < words.length) {
      const trial = `${line} ${words[idx]}`;
      if (ctx.measureText(trial).width <= maxWidthPx) {
        line = trial;
        idx += 1;
      } else {
        break;
      }
    }
    lines.push(line);
  }
  return { lines, overflow: idx < words.length };
}

function truncateLineWithEllipsis(ctx, line, maxWidthPx) {
  if (ctx.measureText(line).width <= maxWidthPx) return line;
  let text = line;
  while (text.length > 0 && ctx.measureText(`${text}${ELLIPSIS}`).width > maxWidthPx) {
    text = text.slice(0, -1);
  }
  return text.length > 0 ? `${text}${ELLIPSIS}` : ELLIPSIS;
}

function appendEllipsisIfRoom(ctx, line, maxWidthPx) {
  if (ctx.measureText(`${line}${ELLIPSIS}`).width <= maxWidthPx) return `${line}${ELLIPSIS}`;
  return truncateLineWithEllipsis(ctx, line, maxWidthPx);
}

/**
 * Quebra em linhas respeitando maxWidth/maxLines e aplica reticências na
 * última linha "quando necessário" (docs §13): tanto quando sobra texto
 * (overflow por maxLines) quanto quando uma palavra isolada excede a
 * largura disponível.
 */
function wrapWithEllipsis(ctx, text, maxWidthPx, maxLines) {
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const { lines, overflow } = wrapWords(ctx, words, maxWidthPx, maxLines);
  if (lines.length === 0) return [];

  const lastIdx = lines.length - 1;
  lines[lastIdx] = overflow
    ? appendEllipsisIfRoom(ctx, lines[lastIdx], maxWidthPx)
    : truncateLineWithEllipsis(ctx, lines[lastIdx], maxWidthPx);
  return lines;
}

function fitsWithoutOverflow(ctx, text, maxWidthPx, maxLines) {
  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const { lines, overflow } = wrapWords(ctx, words, maxWidthPx, maxLines);
  return overflow ? null : lines;
}

function shrinkToFit(ctx, text, { fontSize, minFontSize, fontWeight, fontFamily, maxWidthPx, maxLines }) {
  for (let size = fontSize; size >= minFontSize; size -= 1) {
    ctx.font = buildFontString(size, fontWeight, fontFamily);
    const lines = fitsWithoutOverflow(ctx, text, maxWidthPx, maxLines);
    if (lines) return { fontSize: size, lines };
  }
  ctx.font = buildFontString(minFontSize, fontWeight, fontFamily);
  return { fontSize: minFontSize, lines: wrapWithEllipsis(ctx, text, maxWidthPx, maxLines) };
}

/**
 * Desenha um elemento de texto já resolvido dentro da sua caixa
 * (coordenadas do layout virtual, escaladas por `scale`).
 */
function renderTextElement(ctx, element, text, scale, registeredFontFamily) {
  const { scaleX, scaleY, uniformScale } = scale;
  const boxX = element.x * scaleX;
  const boxY = element.y * scaleY;
  const boxWidth = element.width * scaleX;
  const boxHeight = element.height * scaleY;

  const capped = applyMaxCharacters(text, element.maxCharacters);
  if (!capped) return;

  const fontFamily = resolveFontFamily(element.fontFamily, registeredFontFamily);
  const fontWeight = element.fontWeight === 'bold' ? 'bold' : 'normal';
  const maxLines = Math.max(1, element.maxLines || 1);
  const strategy = element.overflowStrategy || 'truncate';

  const baseFontSizePx = element.fontSize * uniformScale;
  const minFontSizePx = (element.minFontSize || element.fontSize) * uniformScale;

  let fontSizePx = baseFontSizePx;
  let lines;

  if (strategy === 'shrink') {
    const result = shrinkToFit(ctx, capped, {
      fontSize: baseFontSizePx,
      minFontSize: minFontSizePx,
      fontWeight,
      fontFamily,
      maxWidthPx: boxWidth,
      maxLines,
    });
    fontSizePx = result.fontSize;
    lines = result.lines;
  } else if (strategy === 'hide') {
    ctx.font = buildFontString(fontSizePx, fontWeight, fontFamily);
    lines = fitsWithoutOverflow(ctx, capped, boxWidth, maxLines);
    if (!lines) return; // não coube: não desenha (docs §13 "hide")
  } else {
    // 'wrap' e 'truncate' seguem o mesmo algoritmo de quebra + reticências
    // (docs §13 descreve as duas estratégias de forma equivalente no MVP).
    ctx.font = buildFontString(fontSizePx, fontWeight, fontFamily);
    lines = wrapWithEllipsis(ctx, capped, boxWidth, maxLines);
  }

  if (!lines || lines.length === 0) return;

  ctx.font = buildFontString(fontSizePx, fontWeight, fontFamily);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  const align = element.textAlign || 'left';
  ctx.textAlign = align;
  let drawX = boxX;
  if (align === 'center') drawX = boxX + boxWidth / 2;
  else if (align === 'right') drawX = boxX + boxWidth;

  const lineHeight = fontSizePx * 1.2;
  const blockHeight = lineHeight * lines.length;
  let drawY = boxY + Math.max(0, (boxHeight - blockHeight) / 2) + fontSizePx * 0.85;

  for (const line of lines) {
    ctx.fillText(line, drawX, drawY);
    drawY += lineHeight;
  }
}

module.exports = {
  renderTextElement,
  applyMaxCharacters,
  wrapWithEllipsis,
  resolveFontFamily,
};
