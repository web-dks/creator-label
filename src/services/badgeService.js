'use strict';

/**
 * Orquestra dinâmico vs. legado para a rota `/badge` (docs
 * /plano-motor-dinamico-etiquetas.md §4), e expõe o núcleo do fluxo
 * dinâmico para a rota `/v2/badges/render` (§8), que renderiza somente a
 * versão publicada e não cai em legado — qualquer falha vira resposta de
 * erro própria decidida pelo `badgeV2Controller`.
 */

const { env, mmToPrinterDots } = require('../config/env');
const { fetchParticipantContext, isDynamicSupabaseConfigured } = require('../repositories/participantRepository');
const { getPublishedLayout, resolveParticipantLabelData } = require('../repositories/labelRpcRepository');
const { validateLayoutResponse } = require('../validators/layoutContractValidator');
const { renderDynamicLabelPng } = require('../renderers/dynamicLabelRenderer');
const { EventNotAllowlistedError, DynamicFlowBudgetExceededError } = require('../utils/errors');
const { DYNAMIC_FLOW_TOTAL_BUDGET_MS } = require('../config/constants');
const logger = require('../utils/logger');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

function isEventAllowlisted(eventId) {
  const allowlist = env.LABEL_DYNAMIC_EVENT_IDS;
  return allowlist.length === 0 || allowlist.includes(eventId);
}

/** Flag ligada + service role configurada, independente de `qr`. */
function isDynamicEngineConfigured() {
  return Boolean(env.LABEL_DYNAMIC_LAYOUT_ENABLED) && isDynamicSupabaseConfigured();
}

/**
 * Elegibilidade "de entrada" para sequer tentar o dinâmico a partir de
 * `/badge` (docs §4, pseudocódigo `badgeService.orchestrate`): motor
 * configurado e `qr` sendo um UUID válido (mesma condição usada pelo
 * legado para tratar `qr` como participant_id).
 */
function isDynamicEligible(params) {
  return isDynamicEngineConfigured() && isUuid(params.qr);
}

/**
 * Núcleo do fluxo dinâmico (docs §4 e §3.7): resolve contexto, valida
 * allowlist, busca e valida o layout publicado, resolve os dados do
 * participante e renderiza — tudo dentro do orçamento total de ~5s.
 * NUNCA engole `FallbackEligibleError`: cada chamador decide o que fazer
 * (badge legado faz fallback silencioso; `/v2/badges/render` responde
 * com um erro HTTP específico).
 */
async function renderDynamicLabel(participantId, requestId, options = {}) {
  const startedAt = Date.now();
  const remainingBudgetMs = () => DYNAMIC_FLOW_TOTAL_BUDGET_MS - (Date.now() - startedAt);
  const assertWithinBudget = (step) => {
    if (remainingBudgetMs() <= 0) {
      throw new DynamicFlowBudgetExceededError(`dynamic flow exceeded its ~5s total budget before ${step}`);
    }
  };

  const ctx = await fetchParticipantContext(participantId);
  if (!isEventAllowlisted(ctx.event_id)) {
    throw new EventNotAllowlistedError(`event_id=${ctx.event_id} is not in LABEL_DYNAMIC_EVENT_IDS`);
  }
  assertWithinBudget('fetching the published layout');

  const layoutResponse = await getPublishedLayout(ctx.event_id);
  validateLayoutResponse(layoutResponse);
  assertWithinBudget('resolving participant label data');

  const labelData = await resolveParticipantLabelData(participantId, ctx.event_id);
  assertWithinBudget('rendering the dynamic label');

  const pngBuffer = await renderDynamicLabelPng(layoutResponse, labelData, {
    requestId,
    outputRotation: options.outputRotation,
    outputWidthPx: options.outputWidthPx,
    outputHeightPx: options.outputHeightPx,
  });

  logger.info('badge-service:dynamic-render-success', {
    requestId,
    eventId: ctx.event_id,
    versionId: layoutResponse.version_id,
    durationMs: Date.now() - startedAt,
  });

  return { pngBuffer, eventId: ctx.event_id, versionId: layoutResponse.version_id };
}

/**
 * Usado por `/badge`: tenta o fluxo dinâmico e retorna o PNG em caso de
 * sucesso, ou `null` quando qualquer condição elegível de fallback
 * ocorre — o chamador deve então seguir com o `legacyLabelRenderer`
 * normalmente. Erros que NÃO são `FallbackEligibleError` propagam para o
 * chamador decidir a resposta HTTP (nunca viram fallback silencioso).
 *
 * Aplica `LABEL_BADGE_OUTPUT_ROTATION` (default 90) e redimensiona para
 * `LABEL_BADGE_OUTPUT_*_MM` @ `LABEL_BADGE_PRINTER_DPI` (default 50×80 @
 * 203 DPI), alinhando ao `tsc.size(width:50, height:80)` do app sem
 * alterar o layout de design nem a rota `/v2`.
 */
async function tryRenderDynamic(params, requestId) {
  if (!isDynamicEligible(params)) return null;

  const startedAt = Date.now();
  try {
    const printerDpi = env.LABEL_BADGE_PRINTER_DPI;
    const outputWidthPx = mmToPrinterDots(env.LABEL_BADGE_OUTPUT_WIDTH_MM, printerDpi);
    const outputHeightPx = mmToPrinterDots(env.LABEL_BADGE_OUTPUT_HEIGHT_MM, printerDpi);
    const result = await renderDynamicLabel(params.qr, requestId, {
      outputRotation: env.LABEL_BADGE_OUTPUT_ROTATION,
      outputWidthPx,
      outputHeightPx,
    });
    return result.pngBuffer;
  } catch (err) {
    if (err && err.fallbackEligible) {
      logger.warn('badge-service:dynamic-fallback', {
        requestId,
        reason: (err && err.code) || (err && err.name),
        message: err && err.message,
        durationMs: Date.now() - startedAt,
      });
      return null;
    }
    throw err;
  }
}

module.exports = {
  tryRenderDynamic,
  renderDynamicLabel,
  isUuid,
  isDynamicEligible,
  isDynamicEngineConfigured,
  isEventAllowlisted,
};
