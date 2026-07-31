'use strict';

/**
 * Taxonomia de erros (docs/plano-motor-dinamico-etiquetas.md §3.5).
 *
 * FallbackEligibleError: só esta família pode acionar o renderer legado
 * a partir do fluxo dinâmico. NonFallbackError sempre vira uma resposta
 * HTTP própria (nunca cai em silêncio no legado).
 */

class FallbackEligibleError extends Error {
  constructor(message, code) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || this.constructor.name;
    this.fallbackEligible = true;
  }
}

class ParticipantContextNotFoundError extends FallbackEligibleError {}
class EventIdMissingError extends FallbackEligibleError {}
class EventNotAllowlistedError extends FallbackEligibleError {}
class LayoutNotPublishedError extends FallbackEligibleError {}
class LayoutInvalidError extends FallbackEligibleError {}
class LabelDataUnavailableError extends FallbackEligibleError {}
class SupabaseTimeoutError extends FallbackEligibleError {}
class SupabaseUnavailableError extends FallbackEligibleError {}
class DynamicFlowBudgetExceededError extends FallbackEligibleError {}

class NonFallbackError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    this.code = code || this.constructor.name;
    this.fallbackEligible = false;
  }
}

class InvalidRequestError extends NonFallbackError {
  constructor(message, code) {
    super(message, 400, code);
  }
}

class PayloadTooLargeError extends NonFallbackError {
  constructor(message, code) {
    super(message, 413, code);
  }
}

class UnauthorizedError extends NonFallbackError {
  constructor(message, code) {
    super(message, 401, code);
  }
}

class ForbiddenError extends NonFallbackError {
  constructor(message, code) {
    super(message, 403, code);
  }
}

class RateLimitedError extends NonFallbackError {
  constructor(message, code) {
    super(message, 429, code);
  }
}

class ConcurrencyLimitExceededError extends NonFallbackError {
  constructor(message, code) {
    super(message, 503, code);
  }
}

/**
 * Falha isolada de logo: NUNCA aciona fallback total. É tratada dentro do
 * próprio renderer dinâmico, que apenas omite o elemento de imagem.
 */
class LogoFetchError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'LogoFetchError';
    this.code = code || 'LOGO_FETCH_ERROR';
    this.fallbackEligible = false;
  }
}

module.exports = {
  FallbackEligibleError,
  ParticipantContextNotFoundError,
  EventIdMissingError,
  EventNotAllowlistedError,
  LayoutNotPublishedError,
  LayoutInvalidError,
  LabelDataUnavailableError,
  SupabaseTimeoutError,
  SupabaseUnavailableError,
  DynamicFlowBudgetExceededError,
  NonFallbackError,
  InvalidRequestError,
  PayloadTooLargeError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitedError,
  ConcurrencyLimitExceededError,
  LogoFetchError,
};
