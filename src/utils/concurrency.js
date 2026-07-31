'use strict';

/**
 * Semáforo simples para limitar a concorrência global de renders ativos.
 * Protege CPU (canvas/QR são caros) sem depender de nenhuma lib externa.
 */
class ConcurrencyLimiter {
  constructor(limit) {
    this.limit = Math.max(1, Number(limit) || 1);
    this.active = 0;
  }

  tryAcquire() {
    if (this.active >= this.limit) return false;
    this.active += 1;
    return true;
  }

  release() {
    this.active = Math.max(0, this.active - 1);
  }
}

module.exports = { ConcurrencyLimiter };
