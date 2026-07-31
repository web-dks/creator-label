'use strict';

/**
 * Orquestra dinâmico vs. legado para a rota `/badge` (docs
 * /plano-motor-dinamico-etiquetas.md §4). O contrato HTTP não muda: este
 * serviço só decide, internamente, qual renderer produz o PNG.
 */

const { env } = require('../config/env');
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

/**
 * Elegibilidade "de entrada" para sequer tentar o dinâmico (docs §4,
 * pseudocódigo `badgeService.orchestrate`): flag ligada, service role
 * configurada e `qr` sendo um UUID válido (mesma condição usada pelo
 * legado para tratar `qr` como participant_id).
 */
function isDynamicEligible(params) {
  return Boolean(env.LABEL_DYNAMIC_LAYOUT_ENABLED) && isDynamicSupabaseConfigured() && isUuid(params.qr);
}

/**
 * Tenta o fluxo dinâmico completo dentro do orçamento total de ~5s
 * (docs §3.7). Retorna o PNG em caso de sucesso, ou `null` quando
 * qualquer condição elegível de fallback ocorre — o chamador deve então
 * seguir com o `legacyLabelRenderer` normalmente. Erros que NÃO são
 * `FallbackEligibleError` propagam para o chamador decidir a resposta
 * HTTP (nunca viram fallback silencioso).
 */
async function tryRenderDynamic(params, requestId) {
  if (!isDynamicEligible(params)) return null;

  const startedAt = Date.now();
  const remainingBudgetMs = () => DYNAMIC_FLOW_TOTAL_BUDGET_MS - (Date.now() - startedAt);
  const assertWithinBudget = (step) => {
    if (remainingBudgetMs() <= 0) {
      throw new DynamicFlowBudgetExceededError(`dynamic flow exceeded its ~5s total budget before ${step}`);
    }
  };

  try {
    const ctx = await fetchParticipantContext(params.qr);
    if (!isEventAllowlisted(ctx.event_id)) {
      throw new EventNotAllowlistedError(`event_id=${ctx.event_id} is not in LABEL_DYNAMIC_EVENT_IDS`);
    }
    assertWithinBudget('fetching the published layout');

    const layoutResponse = await getPublishedLayout(ctx.event_id);
    validateLayoutResponse(layoutResponse);
    assertWithinBudget('resolving participant label data');

    const labelData = await resolveParticipantLabelData(params.qr, ctx.event_id);
    assertWithinBudget('rendering the dynamic label');

    const pngBuffer = await renderDynamicLabelPng(layoutResponse, labelData, { requestId });

    logger.info('badge-service:dynamic-render-success', {
      requestId,
      eventId: ctx.event_id,
      versionId: layoutResponse.version_id,
      durationMs: Date.now() - startedAt,
    });

    return pngBuffer;
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

module.exports = { tryRenderDynamic, isUuid, isDynamicEligible, isEventAllowlisted };
