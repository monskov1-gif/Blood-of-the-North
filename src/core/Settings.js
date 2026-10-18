import { storage } from './storage.js';

const DEFAULTS = {
  textSpeed: 0.6,       // 0..1 typewriter speed
  autoDelay: 0.5,       // 0..1 delay before auto-advance
  musicVolume: 0.7,
  sfxVolume: 0.8,
  ambienceVolume: 0.7,
  effects: 1.0,         // post-processing / hallucination intensity (accessibility)
  quality: 'auto',      // auto | high | low
  touchControls: 'auto' // auto | on | off
};

export class Settings {
  constructor(bus) {
    this.bus = bus;
    this.values = { ...DEFAULTS, ...(storage.get('settings') || {}) };
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    this.values[key] = value;
    storage.set('settings', this.values);
    this.bus.emit('settings', { key, value });
  }
}
