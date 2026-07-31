'use strict';

/**
 * Resolução de dados do motor dinâmico (docs/plano-motor-dinamico-etiquetas.md
 * §12). `labelData` é o objeto devolvido por `resolve_participant_label_data`
 * (event, participant, customFields) — nunca cacheado, contém dado pessoal.
 */

const CUSTOM_FIELD_PATTERN = /^custom_field\.(.+)$/;

function resolveDataSource(dataSource, labelData) {
  if (!labelData || typeof dataSource !== 'string') return undefined;

  switch (dataSource) {
    case 'participant.name':
      return labelData.participant && labelData.participant.name;
    case 'participant.category':
      return labelData.participant && labelData.participant.category;
    case 'participant.id':
    case 'qr_code': // normalizado para participant.id (docs §12)
      return labelData.participant && labelData.participant.id;
    case 'event.name':
      return labelData.event && labelData.event.name;
    case 'event.venue':
      return labelData.event && labelData.event.venue;
    case 'event.city':
      return labelData.event && labelData.event.city;
    case 'event.state':
      return labelData.event && labelData.event.state;
    case 'event.label_logo':
      return labelData.event && labelData.event.label_logo;
    case 'static_text':
      return undefined; // usa staticValue diretamente, ver resolveTextValue
    default: {
      const match = CUSTOM_FIELD_PATTERN.exec(dataSource);
      if (!match) return undefined;
      return labelData.customFields ? labelData.customFields[match[1]] : undefined;
    }
  }
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/**
 * Valor final de um elemento de texto: dataSource -> fallbackValue ->
 * normalização de espaços (docs §12–13, passos 1–3). Campo personalizado
 * indisponível não derruba a etiqueta; cai no fallback.
 */
function resolveTextValue(element, labelData) {
  const raw = element.dataSource === 'static_text' ? element.staticValue : resolveDataSource(element.dataSource, labelData);
  const value = isBlank(raw) ? element.fallbackValue : raw;
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Conteúdo do QR é sempre participant.id, nunca URL ou texto arbitrário. */
function resolveQrValue(element, labelData) {
  const participantId = labelData && labelData.participant && labelData.participant.id;
  return isBlank(participantId) ? '' : String(participantId);
}

function resolveImageUrl(element, labelData) {
  const value = resolveDataSource(element.dataSource, labelData);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = { resolveDataSource, resolveTextValue, resolveQrValue, resolveImageUrl };
