import { storage } from './storage.js';

export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;

/**
 * Slot based save/load. A save is assembled from "providers" — every system
 * that owns persistent state registers a { key, save(), load(data) } pair, so
 * new scenes/systems extend saves without touching this file.
 */
export class SaveSystem {
  constructor(bus) {
    this.bus = bus;
    this.providers = new Map();
    this.blockers = new Set();
  }

  register(key, provider) { this.providers.set(key, provider); }

  /** Systems can temporarily forbid saving (e.g. during a cutscene). */
  block(reason) { this.blockers.add(reason); }
  unblock(reason) { this.blockers.delete(reason); }
  get canSave() { return this.blockers.size === 0; }

  snapshot(label = '') {
    const data = { version: SAVE_VERSION, time: Date.now(), label };
    for (const [key, p] of this.providers) data[key] = p.save();
    return data;
  }

  save(slot, label) {
    if (!this.canSave && slot !== 'auto') return false;
    const data = this.snapshot(label);
    storage.set(`save.${slot}`, data);
    this.bus.emit('saved', { slot, data });
    return true;
  }

  autosave(label) { if (this.canSave) this.save('auto', label); }

  read(slot) {
    const data = storage.get(`save.${slot}`);
    return data && data.version === SAVE_VERSION ? data : null;
  }

  list() {
    const slots = ['auto', ...Array.from({ length: SLOT_COUNT }, (_, i) => String(i + 1))];
    return slots.map((slot) => ({ slot, data: this.read(slot) }));
  }

  latest() {
    return this.list().filter((s) => s.data).sort((a, b) => b.data.time - a.data.time)[0] || null;
  }

  /** Applies a save to all providers in registration order. */
  apply(data) {
    for (const [key, p] of this.providers) if (key in data) p.load(data[key], data);
    this.bus.emit('loaded', { data });
  }

  clear(slot) { storage.remove(`save.${slot}`); }
}
