/**
 * Command registry used by dialogue nodes (`cmd: 'name:arg1:arg2'`) and
 * cutscenes. Scenes register their own commands; generic ones live here.
 */
export class Director {
  constructor() { this.cmds = new Map(); }

  register(name, fn) { this.cmds.set(name, fn); }

  registerAll(map) { for (const [k, v] of Object.entries(map)) this.register(k, v); }

  async run(command, ctx = {}) {
    if (typeof command === 'function') return command(ctx);
    const [name, ...args] = String(command).split(':');
    const fn = this.cmds.get(name);
    if (!fn) { console.warn('[director] unknown command', command); return; }
    return fn(...args, ctx);
  }
}

export const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000 * (globalThis.__ts || 1)));   // __ts: QA speed-up
