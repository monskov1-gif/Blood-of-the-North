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

  // ---------------------------------------------------------------- morning
  'amb.room': {
    bus: 'ambience', volume: 0.5,
    loop(am, out) {
      const c = am.ctx;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 58;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 117;
      const g = c.createGain(); g.gain.value = 0.05;
      o.connect(g); o2.connect(g); g.connect(out);
      o.start(); o2.start();
      const bed = noiseBed(am, out, { type: 'lowpass', freq: 220, q: 0.4, vol: 0.25, wobble: 0.2, rate: 0.04 });
      return () => { o.stop(); o2.stop(); bed(); };
    },
  },
  'amb.morning': {
    bus: 'ambience', volume: 0.8,
    loop(am, out) {
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.3) { // creak
          const o = am.ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(140 + Math.random() * 80, t); o.frequency.linearRampToValueAtTime(110 + Math.random() * 60, t + 0.6);
          const f = am.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 8;
          const g = am.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 0.7);
          o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + 0.75);
        } else if (r < 0.65) { // water drop
          tone(am, out, t, { freq: 1400 + Math.random() * 500, slide: 700, dur: 0.12, vol: 0.06 });
        } else if (r < 0.75) { // a shard of glass settling
          clink(am, out, t, 0.03);
        }
        setTimeout(tick, 1800 + Math.random() * 4500);
      };
      tick();
      return () => { alive = false; };
    },
  },
  'inner.breath': {
    bus: 'inner', volume: 0.55,
    loop(am, out) {
      let alive = true;
      const cycle = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.02;
        noise(am, out, t, { freq: 700, q: 0.8, dur: 1.1, vol: 0.18, attack: 0.5 });
        noise(am, out, t + 1.4, { freq: 520, q: 0.8, dur: 1.4, vol: 0.13, attack: 0.25 });
        setTimeout(cycle, 3300 + Math.random() * 600);
      };
      cycle();
      return () => { alive = false; };
    },
  },
  'amb.siren': {
    bus: 'ambience', volume: 0.6,
    loop(am, out) {
      const c = am.ctx;
      const o = c.createOscillator(); o.type = 'sawtooth';
      const lfo = c.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55;
      const lg = c.createGain(); lg.gain.value = 260;
      o.frequency.value = 900;
      lfo.connect(lg).connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
      const g = c.createGain(); g.gain.value = 0.18;
      o.connect(f).connect(g).connect(out);
      o.start(); lfo.start();
      return () => { o.stop(); lfo.stop(); };
    },
  },

  // ---------------------------------------------------------------- custody / hospital ambience
  'amb.car': {
    bus: 'ambience', volume: 0.8,
    loop(am, out) {
      const c = am.ctx;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 42;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
      const g = c.createGain(); g.gain.value = 0.12;
      o.connect(f).connect(g).connect(out); o.start();
      const road = noiseBed(am, out, { type: 'lowpass', freq: 380, q: 0.4, vol: 0.45, wobble: 0.15, rate: 0.3 });
      const hiss = noiseBed(am, out, { type: 'highpass', freq: 2500, q: 0.5, vol: 0.05, wobble: 0.4, rate: 0.2 });
      let alive = true;
      const wipers = () => {
        if (!alive) return;
        const t = c.currentTime + 0.05;
        noise(am, out, t, { freq: 1400, sweep: 700, q: 2, dur: 0.45, vol: 0.06, attack: 0.1 });
        noise(am, out, t + 0.6, { freq: 700, sweep: 1400, q: 2, dur: 0.45, vol: 0.06, attack: 0.1 });
        tone(am, out, t + 0.5, { freq: 160, dur: 0.05, vol: 0.05 });
        setTimeout(wipers, 3200 + Math.random() * 600);
      };
      const radio = () => {
        if (!alive) return;
        const t = c.currentTime + 0.05;
        noise(am, out, t, { freq: 1800, q: 1.5, dur: 0.12, vol: 0.12 });
        for (let i = 0; i < 6; i++) noise(am, out, t + 0.15 + i * 0.12, { freq: 900 + Math.random() * 900, q: 8, dur: 0.1, vol: 0.06 });
        noise(am, out, t + 0.95, { freq: 1800, q: 1.5, dur: 0.1, vol: 0.1 });
        setTimeout(radio, 9000 + Math.random() * 9000);
      };
      wipers(); setTimeout(radio, 4000);
      return () => { alive = false; o.stop(); road(); hiss(); };
    },
  },
  'amb.station': {
    bus: 'ambience', volume: 0.7,
    loop(am, out) {
      const c = am.ctx;
      const hum = noiseBed(am, out, { type: 'lowpass', freq: 160, q: 0.4, vol: 0.3, wobble: 0.1, rate: 0.05 });
      const buzz = c.createOscillator(); buzz.frequency.value = 120;
      const bg = c.createGain(); bg.gain.value = 0.012; buzz.connect(bg).connect(out); buzz.start();
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = c.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.35) for (let i = 0; i < 6 + Math.random() * 10; i++) tone(am, out, t + i * (0.08 + Math.random() * 0.06), { freq: 2200 + Math.random() * 400, dur: 0.02, vol: 0.03, type: 'square' }); // keyboard
        else if (r < 0.5) { noise(am, out, t, { freq: 1800, q: 1.5, dur: 0.1, vol: 0.08 }); for (let i = 0; i < 5; i++) noise(am, out, t + 0.12 + i * 0.11, { freq: 900 + Math.random() * 800, q: 7, dur: 0.09, vol: 0.05 }); } // radio
        else if (r < 0.62) for (let i = 0; i < 2; i++) { tone(am, out, t + i * 0.5, { freq: 900, dur: 0.18, vol: 0.04 }); tone(am, out, t + i * 0.5, { freq: 1100, dur: 0.18, vol: 0.03 }); } // phone
        else if (r < 0.8) for (let i = 0; i < 4; i++) noise(am, out, t + i * 0.45, { type: 'lowpass', freq: 500, dur: 0.08, vol: 0.12 }); // steps
        else for (let i = 0; i < 4; i++) noise(am, out, t + i * 0.2 + Math.random() * 0.1, { freq: 400 + Math.random() * 400, q: 5, dur: 0.16, vol: 0.05, attack: 0.03 }); // talk
        setTimeout(tick, 900 + Math.random() * 2600);
      };
      tick();
      return () => { alive = false; hum(); buzz.stop(); };
    },
  },
  'amb.interrogation': {
    bus: 'ambience', volume: 0.7,
    loop(am, out) {
      const vent = noiseBed(am, out, { type: 'lowpass', freq: 240, q: 0.5, vol: 0.4, wobble: 0.05, rate: 0.03 });
      const c = am.ctx;
      const buzz = c.createOscillator(); buzz.frequency.value = 100; buzz.type = 'triangle';
      const bg = c.createGain(); bg.gain.value = 0.015; buzz.connect(bg).connect(out); buzz.start();
      let alive = true;
      const clock = () => { if (!alive) return; tone(am, out, c.currentTime + 0.02, { freq: 3200, dur: 0.012, vol: 0.05, type: 'square' }); setTimeout(clock, 1000); };
      clock();
      return () => { alive = false; vent(); buzz.stop(); };
    },
  },
  'amb.hospital_day': {
    bus: 'ambience', volume: 0.7,
    loop(am, out) {
      const vent = noiseBed(am, out, { type: 'lowpass', freq: 300, q: 0.4, vol: 0.3, wobble: 0.1, rate: 0.05 });
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.3) tone(am, out, t, { freq: 960, dur: 0.12, vol: 0.03 }); // distant monitor
        else if (r < 0.5) for (let i = 0; i < 8; i++) noise(am, out, t + i * 0.1, { freq: 1200, q: 6, dur: 0.06, vol: 0.03 }); // trolley
        else if (r < 0.7) for (let i = 0; i < 4; i++) noise(am, out, t + i * 0.42, { type: 'lowpass', freq: 600, dur: 0.07, vol: 0.1 }); // steps
        else if (r < 0.85) for (let i = 0; i < 4; i++) noise(am, out, t + i * 0.2, { freq: 500 + Math.random() * 300, q: 5, dur: 0.15, vol: 0.04, attack: 0.03 }); // voices
        else { tone(am, out, t, { freq: 660, dur: 0.3, vol: 0.04 }); tone(am, out, t + 0.35, { freq: 880, dur: 0.4, vol: 0.04 }); } // pager chime
        setTimeout(tick, 1200 + Math.random() * 3000);
      };
      tick();
      return () => { alive = false; vent(); };
    },
  },
  'amb.hospital_night': {
    bus: 'ambience', volume: 0.6,
    loop(am, out) {
      const vent = noiseBed(am, out, { type: 'lowpass', freq: 200, q: 0.4, vol: 0.35, wobble: 0.08, rate: 0.03 });
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.5) tone(am, out, t, { freq: 960, dur: 0.1, vol: 0.02 });
        else if (r < 0.65) for (let i = 0; i < 3; i++) noise(am, out, t + i * 0.6, { type: 'lowpass', freq: 500, dur: 0.07, vol: 0.06 });
        setTimeout(tick, 3000 + Math.random() * 6000);
      };
      tick();
      return () => { alive = false; vent(); };
    },
  },
  /** The old wing: a hollow high room — low tone, the building settling, a far drip with its echo. */
  'amb.oldwing': {
    bus: 'ambience', volume: 0.6,
    loop(am, out) {
      const room = noiseBed(am, out, { type: 'lowpass', freq: 140, q: 0.5, vol: 0.45, wobble: 0.25, rate: 0.04 });
      let alive = true;
      const tick = () => {
        if (!alive) return;
        const t = am.ctx.currentTime + 0.05;
        const r = Math.random();
        if (r < 0.35) { // drip, answered by the tiles
          const f = 1300 + Math.random() * 500;
          [0, 0.23, 0.47].forEach((d, i) => tone(am, out, t + d, { freq: f, dur: 0.05, vol: 0.035 / (i * 1.8 + 1), attack: 0.001 }));
        } else if (r < 0.6) { // a long creak of old wood / a radiator ticking
          tone(am, out, t, { freq: 95 + Math.random() * 40, slide: 70, type: 'sawtooth', dur: 0.9, vol: 0.012, attack: 0.25 });
          noise(am, out, t, { type: 'bandpass', freq: 380, q: 9, dur: 0.8, vol: 0.02, attack: 0.3 });
        } else if (r < 0.75) {
          for (let i = 0; i < 5; i++) tone(am, out, t + i * (0.3 + Math.random() * 0.4), { freq: 2400, type: 'square', dur: 0.01, vol: 0.012 });
        }
        setTimeout(tick, 2500 + Math.random() * 5000);
      };
      tick();
      return () => { alive = false; room(); };
    },
  },
  /** Public address: chime, then a muffled voice through a ceiling speaker. */
  'sfx.announce': {
    bus: 'ambience', volume: 0.55,
    synth: (am, out, t) => {
      [784, 659, 523].forEach((f, i) => tone(am, out, t + i * 0.42, { freq: f, dur: 0.6, vol: 0.05, attack: 0.01 }));
      let x = t + 1.6;
      for (let w = 0; w < 14; w++) {
        const d = 0.08 + Math.random() * 0.16;
        noise(am, out, x, { type: 'bandpass', freq: 600 + Math.random() * 600, q: 5, dur: d, vol: 0.05, attack: 0.02 });
        x += d + (Math.random() < 0.2 ? 0.25 : 0.04);
      }
    },
  },
  'sfx.flatline': {
    bus: 'inner', volume: 0.25,
    loop(am, out) {
      const o = am.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 960;
      const g = am.ctx.createGain(); g.gain.value = 0.5;
      o.connect(g).connect(out); o.start();
      return () => o.stop();
    },
  },

  // ---------------------------------------------------------------- sfx
  'sfx.beep': { bus: 'inner', volume: 0.35, synth: (am, out, t) => tone(am, out, t, { freq: 960, dur: 0.11, vol: 0.4, attack: 0.002 }) },
  'sfx.cuffs': {
    volume: 0.7,
    synth: (am, out, t) => { for (let i = 0; i < 7; i++) tone(am, out, t + i * 0.035, { type: 'square', freq: 2600 + Math.random() * 600, dur: 0.02, vol: 0.06 }); clink(am, out, t + 0.3, 0.06); },
  },
  'sfx.spit': {
    volume: 0.7,
    synth: (am, out, t) => { noise(am, out, t, { freq: 1600, sweep: 600, q: 1, dur: 0.35, vol: 0.4, attack: 0.01 }); noise(am, out, t + 0.05, { type: 'lowpass', freq: 400, dur: 0.2, vol: 0.3 }); },
  },
  'sfx.gulp': {
    volume: 0.6,
    synth: (am, out, t) => { for (let i = 0; i < 4; i++) { tone(am, out, t + i * 0.42, { freq: 180, slide: 90, dur: 0.12, vol: 0.35 }); noise(am, out, t + i * 0.42, { type: 'lowpass', freq: 500, dur: 0.12, vol: 0.2 }); } },
  },
  'sfx.water': {
    volume: 0.5,
    synth: (am, out, t) => { for (let i = 0; i < 18; i++) noise(am, out, t + i * 0.05, { freq: 700 + Math.random() * 1200, q: 10, dur: 0.07, vol: 0.12 }); },
  },
  'sfx.tear': {
    volume: 0.8,
    synth: (am, out, t) => { noise(am, out, t, { freq: 2600, q: 0.8, dur: 0.25, vol: 0.4, attack: 0.005 }); tone(am, out, t + 0.05, { freq: 300, slide: 120, dur: 0.15, vol: 0.2 }); clink(am, out, t + 0.2, 0.05); },
  },
  // the blood bag torn from the drip: a wet rip, a cluster of dissonant low hits (a horror "sting"),
  // a rising scream-like whine of feedback and a heartbeat thump underneath
  'sfx.bloodrip': {
    volume: 1.0,
    synth: (am, out, t) => {
      noise(am, out, t, { freq: 1800, q: 0.7, dur: 0.35, vol: 0.55, attack: 0.003, sweep: 600 });
      noise(am, out, t + 0.05, { freq: 420, q: 1.2, dur: 0.5, vol: 0.4, attack: 0.01 });
      for (const [f, d] of [[49, 1.6], [52, 1.5], [73.4, 1.3], [103.8, 1.1]]) tone(am, out, t + 0.02, { freq: f, slide: f * 0.7, dur: d, vol: 0.32, type: 'sawtooth' });
      tone(am, out, t + 0.1, { freq: 1200, slide: 2600, dur: 1.4, vol: 0.08, type: 'sawtooth' });
      tone(am, out, t + 0.14, { freq: 1270, slide: 2500, dur: 1.3, vol: 0.06, type: 'square' });
      tone(am, out, t + 0.0, { freq: 70, slide: 35, dur: 0.35, vol: 0.7 });
      tone(am, out, t + 0.45, { freq: 62, slide: 30, dur: 0.3, vol: 0.55 });
    },
  },
  'sfx.cell': {
    volume: 0.8,
    synth: (am, out, t) => { noise(am, out, t, { freq: 900, sweep: 300, q: 2, dur: 0.9, vol: 0.25, attack: 0.05 }); tone(am, out, t + 0.85, { freq: 110, slide: 60, dur: 0.3, vol: 0.5 }); clink(am, out, t + 0.86, 0.1); },
  },
  'sfx.lighter': {
    volume: 0.4,
    synth: (am, out, t) => { noise(am, out, t, { freq: 3000, q: 1, dur: 0.05, vol: 0.3 }); noise(am, out, t + 0.06, { freq: 800, q: 0.6, dur: 0.4, vol: 0.12, attack: 0.05 }); },
  },

  'sfx.cardoor': {
    volume: 0.7,
    synth: (am, out, t) => {
      tone(am, out, t, { freq: 90, slide: 50, dur: 0.18, vol: 0.6 });
      noise(am, out, t, { type: 'lowpass', freq: 900, dur: 0.15, vol: 0.5 });
      tone(am, out, t + 0.02, { type: 'square', freq: 2200, dur: 0.02, vol: 0.05 });
    },
  },
  'sfx.shouts': {
    volume: 0.6,
    synth: (am, out, t) => {
      for (let i = 0; i < 6; i++) noise(am, out, t + i * 0.22 + Math.random() * 0.1, { freq: 500 + Math.random() * 400, q: 5, dur: 0.18, vol: 0.25, attack: 0.02 });
    },
  },
  'sfx.door_bang': {
    volume: 0.9,
    synth: (am, out, t) => {
      tone(am, out, t, { freq: 70, slide: 35, dur: 0.5, vol: 0.8 });
      noise(am, out, t, { type: 'lowpass', freq: 600, dur: 0.35, vol: 0.6 });
      noise(am, out, t + 0.05, { freq: 300, sweep: 1400, q: 0.8, dur: 1.4, vol: 0.25, attack: 0.3 });
    },
  },
  'sfx.wind_gust': {
    volume: 0.6,
    synth: (am, out, t) => noise(am, out, t, { freq: 260, sweep: 900, q: 0.6, dur: 2.6, vol: 0.35, attack: 0.8 }),
  },

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
  // clock hand being wound to a new item: ratchet ticks + a soft clunk (opts.rate = tick count)
  'ui.clock': {
    bus: 'ui', volume: 0.5,
    synth: (am, out, t, opts = {}) => {
      const n = opts.rate || 4;
      for (let i = 0; i < n; i++) {
        const tt = t + i * (0.36 / n) + Math.random() * 0.008;
        noise(am, out, tt, { type: 'highpass', freq: 3200, dur: 0.018, vol: 0.32, attack: 0.001 });
        tone(am, out, tt, { freq: 2600 + (i % 2) * 400, dur: 0.03, vol: 0.05, type: 'square' });
      }
      tone(am, out, t + 0.42, { freq: 180, slide: 120, dur: 0.09, vol: 0.18 });
      noise(am, out, t + 0.42, { type: 'bandpass', freq: 1200, q: 2, dur: 0.06, vol: 0.2 });
    },
  },
  'ui.advance': { bus: 'ui', volume: 0.2, synth: (am, out, t) => tone(am, out, t, { freq: 1200, dur: 0.04, vol: 0.06, type: 'triangle' }) },
  'ui.open': { bus: 'ui', volume: 0.35, synth: (am, out, t) => noise(am, out, t, { freq: 1500, q: 1, dur: 0.25, vol: 0.15, attack: 0.05 }) },
  'ui.type': { bus: 'ui', volume: 0.12, synth: (am, out, t) => tone(am, out, t, { freq: 1900 + Math.random() * 300, dur: 0.02, vol: 0.05, type: 'triangle' }) },
};
