'use strict';

/**
 * Cache TTL simples em memória do processo (sem Redis nesta fase).
 * Nunca deve guardar dado pessoal — apenas metadados de contexto/layout
 * (ver docs/plano-motor-dinamico-etiquetas.md §3.6).
 */
class TtlCache {
  constructor() {
    this.store = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlSeconds) {
    this.store.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlSeconds) * 1000 });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }
}

module.exports = { TtlCache };
