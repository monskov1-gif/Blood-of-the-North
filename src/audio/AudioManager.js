import { SOUND_DEFS } from './sounds.js';
import { MusicEngine } from './MusicEngine.js';

/**
 * Central audio hub. Gameplay/story code only calls:
 *   audio.play('sfx.glass')            one-shot
 *   audio.loop('amb.crowd')            looping bed (returns handle)
 *   audio.music('lounge')              switch music mood (crossfade)
 *   audio.setMuffle(0..1)              world low-pass (hallucination)
 *
 * Every key resolves through SOUND_DEFS (src/audio/sounds.js). A def can be a
 * file url (real asset) or a synth function (placeholder) — replacing a
 * placeholder with a recorded file is a one-line change in the manifest.
 */
export class AudioManager {
  constructor(bus, settings) {
    this.bus = bus;
    this.settings = settings;
    this.ctx = null;
    this.buffers = new Map();
    this.loops = new Map();
    this.ready = false;
    bus.on('settings', () => this.applyVolumes());
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);

    // "world" chain: everything diegetic goes through a low-pass we can close
    this.worldFilter = ctx.createBiquadFilter();
    this.worldFilter.type = 'lowpass';
    this.worldFilter.frequency.value = 20000;
    this.worldFilter.Q.value = 0.7;
    this.worldFilter.connect(this.master);

    this.buses = {};
    for (const name of ['music', 'ambience', 'sfx']) {
      const g = ctx.createGain();
      g.connect(this.worldFilter);
      this.buses[name] = g;
    }
    // heartbeat / ringing / UI bypass the muffle — they are "inside the head"
    this.buses.inner = ctx.createGain();
    this.buses.inner.connect(this.master);
    this.buses.ui = ctx.createGain();
    this.buses.ui.connect(this.master);

    this.noise = makeNoiseBuffer(ctx);
    this.musicEngine = new MusicEngine(ctx, this.buses.music);
    this.applyVolumes();
    this.ready = true;
    this.bus.emit('audio-ready');
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(s.get('musicVolume'), t, 0.1);
    this.buses.ambience.gain.setTargetAtTime(s.get('ambienceVolume'), t, 0.1);
    this.buses.sfx.gain.setTargetAtTime(s.get('sfxVolume'), t, 0.1);
    this.buses.inner.gain.setTargetAtTime(s.get('sfxVolume'), t, 0.1);
    this.buses.ui.gain.setTargetAtTime(s.get('sfxVolume') * 0.8, t, 0.1);
  }

  def(key) {
    const d = SOUND_DEFS[key];
    if (!d) console.warn('[audio] unknown sound', key);
    return d;
  }

  async loadFile(url) {
    if (this.buffers.has(url)) return this.buffers.get(url);
    const p = fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b));
    this.buffers.set(url, p);
    return p;
  }

  /** One-shot. opts: { volume, rate, pan, delay } */
  play(key, opts = {}) {
    if (!this.ready) return;
    const d = this.def(key);
    if (!d) return;
    const bus = this.buses[d.bus || 'sfx'];
    const out = this.ctx.createGain();
    out.gain.value = (d.volume ?? 1) * (opts.volume ?? 1);
    let node = out;
    if (opts.pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = opts.pan;
      out.connect(p); node = p;
    }
    node.connect(bus);
    const when = this.ctx.currentTime + (opts.delay || 0);
    if (d.url) {
      this.loadFile(d.url).then((buf) => {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = opts.rate || 1;
        src.connect(out);
        src.start(when);
      }).catch(() => d.synth?.(this, out, when, opts));
    } else if (d.synth) {
      d.synth(this, out, when, opts);
    }
  }

  /** Looping bed. Returns a handle with setVolume(v, time) and stop(). */
  loop(key, opts = {}) {
    if (!this.ready) return null;
    if (this.loops.has(key)) return this.loops.get(key);
    const d = this.def(key);
    if (!d) return null;
    const out = this.ctx.createGain();
    out.gain.value = 0;
    out.connect(this.buses[d.bus || 'ambience']);
    const target = (d.volume ?? 1) * (opts.volume ?? 1);
    out.gain.setTargetAtTime(target, this.ctx.currentTime, opts.fade ?? 1.0);
    const stopper = d.loop(this, out);
    const handle = {
      key, out, base: d.volume ?? 1,
      setVolume: (v, time = 0.5) => out.gain.setTargetAtTime(v * (d.volume ?? 1), this.ctx.currentTime, time),
      stop: (fade = 1) => {
        out.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
        setTimeout(() => { stopper?.(); out.disconnect(); }, fade * 1000 + 200);
        this.loops.delete(key);
      },
      params: stopper?.params,
    };
    this.loops.set(key, handle);
    return handle;
  }

  stopAllLoops(fade = 1) { for (const h of [...this.loops.values()]) h.stop(fade); }

  music(mood, fade = 3) { if (this.ready) this.musicEngine.setMood(mood, fade); }

  /** 0 = clear, 1 = underwater. */
  /**
   * World low-pass. Each source (story scenes, the hallucination system) keeps
   * its own amount and the strongest wins, so the per-frame hallucination
   * update can't wipe out a muffle a scene asked for.
   */
  setMuffle(amount, time = 1.5, source = 'story') {
    if (!this.ready) return;
    this.muffles ??= {};
    this.muffles[source] = Math.min(1, Math.max(0, amount));
    const eff = Math.max(0, ...Object.values(this.muffles));
    if (this.muffleEff !== undefined && Math.abs(eff - this.muffleEff) < 0.002 && source !== 'story') return;
    this.muffleEff = eff;
    const f = 20000 * Math.pow(250 / 20000, eff);
    this.worldFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, time / 3);
  }

  /** Detunes/slows music for the hallucination. 0..1 */
  setWarp(amount) { if (this.ready) this.musicEngine.setWarp(amount); }

  setMasterVolume(v, time = 1) {
    if (this.ready) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, time / 3);
  }
}

function makeNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
