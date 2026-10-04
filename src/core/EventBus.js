/** Minimal pub/sub used to decouple systems (UI, audio, story, save). */
export class EventBus {
  constructor() { this.map = new Map(); }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  once(type, fn) {
    const off = this.on(type, (...a) => { off(); fn(...a); });
    return off;
  }

  off(type, fn) { this.map.get(type)?.delete(fn); }

  emit(type, payload) {
    const set = this.map.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }

  /** Resolves on the next event of `type` (optionally filtered). */
  wait(type, filter) {
    return new Promise((resolve) => {
      const off = this.on(type, (p) => { if (!filter || filter(p)) { off(); resolve(p); } });
    });
  }
}
