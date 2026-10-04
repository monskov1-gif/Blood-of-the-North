/**
 * Sound manifest. Each key is either { url } (recorded asset, preferred when
 * present) or { synth } / { loop } procedural placeholder. To plug in real
 * audio later, add `url: 'assets/audio/xxx.ogg'` — the synth stays as fallback.
 *
 * synth(am, out, when, opts) — schedules a one-shot into `out`
 * loop(am, out) → stop()     — starts a bed, returns a stop function
 */

const tone = (am, out, when, { freq, type = 'sine', dur = 0.3, vol = 0.3, attack = 0.002, decay, detune = 0, slide }) => {
  const c = am.ctx;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, when + dur);
  o.detune.value = detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (decay || dur));
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + (decay || dur) + 0.05);
};

const noise = (am, out, when, { dur = 0.2, vol = 0.3, type = 'bandpass', freq = 1000, q = 1, attack = 0.002, sweep }) => {
  const c = am.ctx;
  const src = c.createBufferSource();
  src.buffer = am.noise;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, when); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, when + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f).connect(g).connect(out);
  src.start(when, Math.random() * 3);
  src.stop(when + dur + 0.05);
};

const clink = (am, out, when, vol = 0.12) => {
  const base = 2200 + Math.random() * 1600;
  [1, 1.51, 2.37, 3.1].forEach((m, i) =>
    tone(am, out, when, { freq: base * m, vol: vol / (i + 1), dur: 0.5 + Math.random() * 0.4, attack: 0.001 }));
};

/** Looping filtered noise bed with slow random amplitude movement. */
const noiseBed = (am, out, { freq, q = 0.8, type = 'bandpass', vol = 0.5, wobble = 0.5, rate = 0.25 }) => {
  const c = am.ctx;
  const src = c.createBufferSource();
  src.buffer = am.noise; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = vol;
  const lfo = c.createOscillator(); lfo.frequency.value = rate * (0.7 + Math.random() * 0.6);
  const lg = c.createGain(); lg.gain.value = vol * wobble;
  lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(out);
  src.start(0, Math.random() * 3); lfo.start();
  return () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } };
};

export const SOUND_DEFS = {
  // ---------------------------------------------------------------- ambience
  'amb.crowd': {
    bus: 'ambience', volume: 0.55,
    loop(am, out) {
      const stops = [
        noiseBed(am, out, { freq: 420, q: 1.2, vol: 0.22, wobble: 0.6, rate: 0.6 }),
        noiseBed(am, out, { freq: 900, q: 2.5, vol: 0.12, wobble: 0.8, rate: 1.3 }),
        noiseBed(am, out, { freq: 1700, q: 3, vol: 0.05, wobble: 0.9, rate: 2.1 }),
      ];
      // murmur "syllables" + occasional glass and laughter-ish bursts
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.5) noise(am, out, t, { freq: 300 + Math.random() * 700, q: 6, vol: 0.05 + Math.random() * 0.05, dur: 0.12 + Math.random() * 0.2 });
        else if (r < 0.62) clink(am, out, t, 0.04 + Math.random() * 0.05);
        else if (r < 0.66) for (let i = 0; i < 4; i++) noise(am, out, t + i * 0.13, { freq: 900 + Math.random() * 300, q: 8, vol: 0.04, dur: 0.1 });
        setTimeout(tick, 120 + Math.random() * 600);
      };
      tick();
      return () => { alive = false; stops.forEach((s) => s()); };
    },
  },
  'amb.vent': {
    bus: 'ambience', volume: 0.35,
    loop: (am, out) => noiseBed(am, out, { type: 'lowpass', freq: 140, q: 0.5, vol: 0.6, wobble: 0.1, rate: 0.05 }),
  },
  'amb.wind': {
    bus: 'ambience', volume: 0.25,
    loop: (am, out) => noiseBed(am, out, { freq: 380, q: 0.6, vol: 0.5, wobble: 0.9, rate: 0.08 }),
  },

  // ---------------------------------------------------------------- sfx
  'sfx.step': {
    volume: 0.5,
    synth: (am, out, t) => {
      noise(am, out, t, { type: 'lowpass', freq: 500 + Math.random() * 200, dur: 0.09, vol: 0.5 });
      tone(am, out, t, { freq: 90, slide: 50, dur: 0.08, vol: 0.25 });
    },
  },
  'sfx.glass': { volume: 0.7, synth: (am, out, t) => clink(am, out, t, 0.18) },
  'sfx.glass_set': {
    volume: 0.7,
    synth: (am, out, t) => { tone(am, out, t, { freq: 180, slide: 90, dur: 0.07, vol: 0.4 }); clink(am, out, t + 0.01, 0.07); },
  },
  'sfx.pour': {
    volume: 0.5,
    synth: (am, out, t) => {
      for (let i = 0; i < 14; i++) noise(am, out, t + i * 0.07, { freq: 600 + Math.random() * 900, q: 10, vol: 0.12, dur: 0.09 });
    },
  },
  'sfx.chair': {
    volume: 0.45,
    synth: (am, out, t) => {
      noise(am, out, t, { freq: 260, sweep: 520, q: 4, dur: 0.35, vol: 0.35, attack: 0.03 });
      tone(am, out, t + 0.33, { freq: 110, slide: 60, dur: 0.1, vol: 0.3 });
    },
  },
  'sfx.door': {
    volume: 0.6,
    synth: (am, out, t) => {
      tone(am, out, t, { freq: 70, slide: 40, dur: 0.3, vol: 0.5 });
      tone(am, out, t + 0.05, { type: 'sawtooth', freq: 320, slide: 260, dur: 0.5, vol: 0.03 });
      noise(am, out, t, { type: 'lowpass', freq: 400, dur: 0.3, vol: 0.3 });
    },
  },
  'sfx.bottle': {
    volume: 0.5,
    synth: (am, out, t) => { tone(am, out, t, { freq: 520, dur: 0.25, vol: 0.12 }); clink(am, out, t, 0.06); },
  },
  'sfx.paper': {
    volume: 0.4,
    synth: (am, out, t) => {
      noise(am, out, t, { freq: 3500, q: 0.7, dur: 0.18, vol: 0.25, attack: 0.03 });
      noise(am, out, t + 0.16, { freq: 2800, q: 0.7, dur: 0.12, vol: 0.15, attack: 0.02 });
    },
  },
  'sfx.jukebox': {
    volume: 0.6,
    synth: (am, out, t) => {
      tone(am, out, t, { type: 'square', freq: 1200, dur: 0.02, vol: 0.05 });
      noise(am, out, t + 0.05, { freq: 900, q: 3, dur: 0.5, vol: 0.12, attack: 0.1 });
      tone(am, out, t + 0.5, { type: 'square', freq: 800, dur: 0.02, vol: 0.05 });
    },
  },
  'sfx.tv': { volume: 0.4, synth: (am, out, t) => noise(am, out, t, { freq: 4000, q: 0.3, dur: 0.4, vol: 0.2 }) },
  'sfx.phone': {
    volume: 0.5,
    synth: (am, out, t) => { tone(am, out, t, { freq: 1400, dur: 0.06, vol: 0.08 }); tone(am, out, t + 0.1, { freq: 1700, dur: 0.06, vol: 0.08 }); },
  },
  'sfx.thud': {
    volume: 0.9,
    synth: (am, out, t) => {
      tone(am, out, t, { freq: 80, slide: 32, dur: 0.6, vol: 0.8 });
      noise(am, out, t, { type: 'lowpass', freq: 300, dur: 0.4, vol: 0.6 });
    },
  },
  'sfx.shatter': {
    volume: 0.7,
    synth: (am, out, t) => {
      noise(am, out, t, { type: 'highpass', freq: 2500, dur: 0.5, vol: 0.4 });
      for (let i = 0; i < 9; i++) clink(am, out, t + Math.random() * 0.35, 0.08);
    },
  },
  'sfx.whoosh': {
    volume: 0.4,
    synth: (am, out, t) => noise(am, out, t, { freq: 300, sweep: 2400, q: 1.5, dur: 0.6, vol: 0.3, attack: 0.25 }),
  },

  // ---------------------------------------------------------------- inner (not muffled)
  'inner.heartbeat': {
    bus: 'inner', volume: 1,
    synth: (am, out, t) => {
      tone(am, out, t, { freq: 62, slide: 38, dur: 0.18, vol: 0.9 });
      tone(am, out, t + 0.22, { freq: 54, slide: 34, dur: 0.2, vol: 0.6 });
    },
  },
  'inner.ring': {
    bus: 'inner', volume: 0.05,
    loop(am, out) {
      const c = am.ctx;
      const o = c.createOscillator(); o.frequency.value = 6800;
      const o2 = c.createOscillator(); o2.frequency.value = 6830;
      const g = c.createGain(); g.gain.value = 0.5;
      o.connect(g); o2.connect(g); g.connect(out);
      o.start(); o2.start();
      return () => { o.stop(); o2.stop(); };
    },
  },
  'inner.drone': {
    bus: 'inner', volume: 0.12,
    loop(am, out) {
      const c = am.ctx;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      f.connect(out);
      const oscs = [55, 55.7, 82.4, 110.9].map((fr) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
        const g = c.createGain(); g.gain.value = 0.25; o.connect(g).connect(f); o.start(); return o;
      });
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
      const lg = c.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(f.frequency); lfo.start();
      return () => { oscs.forEach((o) => o.stop()); lfo.stop(); };
    },
  },
  'inner.whisper': {
    bus: 'inner', volume: 0.5,
    synth: (am, out, t) => {
      for (let i = 0; i < 7; i++) noise(am, out, t + i * 0.16 + Math.random() * 0.05, { freq: 2500 + Math.random() * 2500, q: 5, dur: 0.14, vol: 0.12, attack: 0.04 });
    },
  },

  // ---------------------------------------------------------------- ui
  'ui.hover': { bus: 'ui', volume: 0.25, synth: (am, out, t) => tone(am, out, t, { freq: 1800, dur: 0.05, vol: 0.1 }) },
  'ui.select': {
    bus: 'ui', volume: 0.4,
    synth: (am, out, t) => { tone(am, out, t, { freq: 660, dur: 0.12, vol: 0.12 }); tone(am, out, t + 0.05, { freq: 990, dur: 0.18, vol: 0.08 }); },
  },
  'ui.advance': { bus: 'ui', volume: 0.2, synth: (am, out, t) => tone(am, out, t, { freq: 1200, dur: 0.04, vol: 0.06, type: 'triangle' }) },
  'ui.open': { bus: 'ui', volume: 0.35, synth: (am, out, t) => noise(am, out, t, { freq: 1500, q: 1, dur: 0.25, vol: 0.15, attack: 0.05 }) },
  'ui.type': { bus: 'ui', volume: 0.12, synth: (am, out, t) => tone(am, out, t, { freq: 1900 + Math.random() * 300, dur: 0.02, vol: 0.05, type: 'triangle' }) },
};
