/**
 * Procedural placeholder score. Each "mood" is a tiny generative piece
 * (chords, bass, brushes, pads, bells, plucked arpeggios, drones, pulses,
 * a clock tick, a heartbeat). A real soundtrack can replace this by mapping
 * moods to files in AudioManager.music().
 *
 * Every location has its own mood, some several (time of day, story state):
 *   bar        lounge / jukebox → tense → hallucination; morning → police
 *   car        car            station   station        interrogation  interrogation
 *   medical    clinic         hospital  hospital_day / hospital_evening / hospital_night / thirst
 *   recovery   recovery       street    street
 */
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const MOODS = {
  // slow noir lounge: Am9 – Dm9 – Bm7b5 – E7b9
  lounge: {
    bpm: 66, swing: 0.62,
    chords: [[57, 64, 67, 71, 72], [50, 57, 60, 64, 65], [47, 57, 59, 62, 64], [52, 56, 59, 62, 65]],
    bass: [45, 38, 47, 40], piano: 0.11, bassVol: 0.22, brush: 0.035, pad: 0.0, melody: 0.05,
  },
  jukebox: {
    bpm: 92, swing: 0.66,
    chords: [[58, 62, 65, 69], [55, 58, 62, 65], [60, 63, 67, 70], [53, 57, 60, 63]],
    bass: [46, 43, 48, 41], piano: 0.1, bassVol: 0.24, brush: 0.05, pad: 0.0, melody: 0.06, walking: true,
  },
  title: {
    bpm: 48, swing: 0.5,
    chords: [[45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [40, 56, 59, 64]],
    bass: [33, 29, 31, 28], piano: 0.09, bassVol: 0.1, brush: 0, pad: 0.05, melody: 0.045,
  },
  tense: {
    bpm: 54, swing: 0.5,
    chords: [[45, 56, 60, 63], [44, 55, 58, 62], [45, 56, 60, 63], [41, 56, 59, 63]],
    bass: [33, 32, 33, 29], piano: 0.08, bassVol: 0.16, brush: 0.0, pad: 0.06, melody: 0.0,
  },
  hallucination: {
    bpm: 38, swing: 0.5,
    chords: [[45, 51, 56, 61], [44, 50, 57, 62], [46, 51, 55, 60], [43, 49, 56, 62]],
    bass: [33, 32, 34, 31], piano: 0.06, bassVol: 0.12, brush: 0, pad: 0.1, melody: 0.0, reverse: true,
  },
  // the bar the morning after: cold, almost nothing — a held low note, a few bells
  morning: {
    bpm: 46, swing: 0.5,
    chords: [[50, 57, 62, 64], [46, 53, 58, 62], [41, 48, 57, 60], [48, 55, 60, 62]],
    bass: [38, 34, 41, 36], piano: 0.05, pianoEvery: 2, bassVol: 0, pad: 0.025, drone: 0.05, bell: 0.022, bellChance: 0.12,
  },
  // sirens outside: a low pulse, a ticking hat, no air
  police: {
    bpm: 88, swing: 0.5,
    chords: [[40, 47, 52, 55], [41, 48, 52, 55], [40, 47, 52, 55], [38, 45, 50, 53]],
    bass: [28, 29, 28, 26], piano: 0, bassVol: 0, pad: 0.045, drone: 0.05, pulse: 0.11, tick: 0.018,
  },
  // the back of the cruiser: the road under the wheels, a plucked figure over it
  car: {
    bpm: 74, swing: 0.5,
    chords: [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]],
    bass: [36, 32, 34, 31], piano: 0, bassVol: 0, pad: 0.035, pulse: 0.085,
    arp: { voice: 'pluck', vol: 0.034, pattern: [0, 2, 3, 1, 2, 3, 1, 3] },
  },
  // RCMP station: fluorescent tedium — soft electric piano and the wall clock
  station: {
    bpm: 60, swing: 0.55,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    bass: [41, 40, 38, 36], piano: 0, epiano: 0.07, bassVol: 0.11, brush: 0.012, tick: 0.022, melody: 0,
  },
  // the box: a drone, a heartbeat, a high cluster that never resolves
  interrogation: {
    bpm: 46, swing: 0.5,
    chords: [[57, 58, 64, 69], [56, 57, 63, 68], [57, 58, 64, 69], [55, 56, 62, 67]],
    bass: [33, 32, 33, 31], piano: 0, bassVol: 0, pad: 0.04, drone: 0.07, heart: 0.12, tick: 0.02,
  },
  // the exam room: clean, glassy, a slow bell arpeggio
  clinic: {
    bpm: 56, swing: 0.5,
    chords: [[57, 64, 69, 71], [53, 60, 65, 69], [55, 62, 67, 71], [52, 59, 64, 68]],
    bass: [45, 41, 43, 40], piano: 0, bassVol: 0, pad: 0.035, drone: 0.025,
    arp: { voice: 'bell', vol: 0.022, pattern: [0, 2, 3, 2, -1, 1, 3, -1] },
  },
  // ward by day: a music-box line over soft piano
  hospital_day: {
    bpm: 62, swing: 0.5,
    chords: [[55, 62, 66, 71], [52, 59, 62, 66], [48, 55, 59, 64], [50, 57, 62, 66]],
    bass: [43, 40, 36, 38], piano: 0.05, bassVol: 0.08, pad: 0.025, bell: 0.026, bellChance: 0.3,
  },
  // evening visit: warmer, slower, a little hope
  hospital_evening: {
    bpm: 52, swing: 0.55,
    chords: [[51, 58, 62, 67], [48, 55, 58, 62, 63], [44, 51, 55, 60], [46, 53, 56, 60, 62]],
    bass: [39, 36, 32, 34], piano: 0.08, bassVol: 0.1, pad: 0.045, melody: 0.035,
  },
  // 03:12 — a drone, bells that do not quite agree, reversed piano
  hospital_night: {
    bpm: 40, swing: 0.5,
    chords: [[45, 52, 58, 63], [44, 51, 57, 62], [46, 53, 58, 61], [43, 50, 56, 61]],
    bass: [33, 32, 34, 31], piano: 0.035, reverse: true, bassVol: 0, pad: 0.035, drone: 0.06, bell: 0.02, bellChance: 0.14, bellDetune: 18,
  },
  // the thirst: pulse in the ears, everything else smeared
  thirst: {
    bpm: 66, swing: 0.5,
    chords: [[45, 46, 52, 56], [44, 45, 51, 55], [45, 46, 52, 56], [43, 44, 50, 54]],
    bass: [33, 32, 33, 31], piano: 0, bassVol: 0, pad: 0.07, drone: 0.09, heart: 0.16, reverse: true,
  },
  // days after: gentle major, sparse
  recovery: {
    bpm: 58, swing: 0.55,
    chords: [[48, 55, 60, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60], [43, 50, 55, 59, 62]],
    bass: [36, 33, 29, 31], piano: 0.07, bassVol: 0.09, pad: 0.03, bell: 0.018, bellChance: 0.15,
  },
  // out on the street: open fifths, a plucked line, the cold
  street: {
    bpm: 56, swing: 0.5,
    chords: [[38, 45, 50, 57, 62], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64], [41, 48, 53, 57, 62]],
    bass: [26, 31, 33, 29], piano: 0, bassVol: 0.08, pad: 0.04, drone: 0.03,
    arp: { voice: 'pluck', vol: 0.04, pattern: [0, 2, 4, 2, 3, -1, 4, -1] },
  },
  none: null,
};

export class MusicEngine {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    // simple "room": feedback delay as cheap reverb
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2200;
    this.out.connect(out);
    this.out.connect(delay); delay.connect(damp).connect(fb).connect(delay); fb.connect(out);
    this.voiceGain = ctx.createGain();
    this.voiceGain.connect(this.out);
    this.mood = null;
    this.warp = 0;
    this.step = 0;
    this.nextTime = 0;
    this.timer = setInterval(() => this.schedule(), 90);
  }

  setMood(name, fade = 3) {
    if (this.moodName === name) return;
    const t = this.ctx.currentTime;
    this.voiceGain.gain.cancelScheduledValues(t);
    this.voiceGain.gain.setTargetAtTime(0, t, fade / 4);
    setTimeout(() => {
      this.moodName = name;
      this.mood = MOODS[name] || null;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.voiceGain.gain.setTargetAtTime(1, this.ctx.currentTime, fade / 4);
    }, this.mood ? fade * 400 : 0);
  }

  setWarp(a) { this.warp = a; }

  schedule() {
    const m = this.mood;
    if (!m) return;
    const ahead = this.ctx.currentTime + 0.4;
    const beat = 60 / (m.bpm * (1 - this.warp * 0.35));
    while (this.nextTime < ahead) {
      this.playStep(m, this.step, this.nextTime, beat);
      const eighth = this.step % 2 === 0 ? beat * m.swing : beat * (1 - m.swing);
      this.nextTime += eighth;
      this.step++;
    }
  }

  playStep(m, step, t, beat) {
    const bar = Math.floor(step / 8) % m.chords.length;
    const inBar = step % 8;
    const chord = m.chords[bar];
    const detune = this.warp * (Math.sin(t * 0.7) * 60 + (Math.random() - 0.5) * 40);
    const barNo = Math.floor(step / 8);
    if (m.piano && (inBar === 0 || (inBar === 5 && Math.random() < 0.5)) && barNo % (m.pianoEvery || 1) === 0) {
      chord.forEach((n, i) => this.piano(NOTE(n), t + i * 0.012, m.piano * (inBar ? 0.6 : 1), detune, m.reverse));
    }
    if (m.epiano && (inBar === 0 || inBar === 3 || (inBar === 6 && Math.random() < 0.4))) {
      chord.forEach((n, i) => this.epiano(NOTE(n), t + i * 0.008, m.epiano * (inBar ? 0.55 : 1), detune));
    }
    if (m.drone && inBar === 0) this.drone(NOTE(m.bass[bar] + 12), t, beat * 8.4, m.drone, detune);
    if (m.pulse) this.bass(NOTE(m.bass[bar] + 12), t, m.pulse * (inBar % 2 ? 0.6 : 1), detune, 0.22);
    if (m.tick && inBar % 2 === 0) this.tick(t, m.tick * (inBar === 0 ? 1.3 : 1));
    if (m.heart && (inBar === 0 || inBar === 4)) { this.thump(t, m.heart); this.thump(t + beat * 0.32, m.heart * 0.7); }
    if (m.arp) {
      const k = m.arp.pattern[inBar];
      if (k >= 0) {
        const n = chord[k % chord.length] + 12 * (k >= chord.length ? 1 : 0) + 12;
        if (m.arp.voice === 'bell') this.bell(NOTE(n), t, m.arp.vol, detune);
        else this.pluck(NOTE(n), t, m.arp.vol, detune);
      }
    }
    if (m.bell && inBar !== 0 && Math.random() < (m.bellChance ?? 0.2)) {
      const n = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 24;
      this.bell(NOTE(n), t, m.bell, detune + (m.bellDetune ? (Math.random() - 0.5) * m.bellDetune * 2 : 0));
    }
    if (m.bassVol) {
      if (m.walking) {
        if (inBar % 2 === 0) this.bass(NOTE(m.bass[bar] + [0, 7, 9, 10][inBar / 2]), t, m.bassVol, detune);
      } else if (inBar === 0 || inBar === 6) {
        this.bass(NOTE(m.bass[bar] + (inBar === 6 ? 7 : 0)), t, m.bassVol, detune);
      }
    }
    if (m.brush && inBar % 2 === 1) this.brush(t, m.brush * (inBar === 3 || inBar === 7 ? 1.4 : 0.8));
    if (m.pad && inBar === 0) chord.forEach((n) => this.pad(NOTE(n), t, beat * 8, m.pad, detune));
    if (m.melody && Math.random() < 0.22 && inBar !== 0) {
      const n = chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 12;
      this.piano(NOTE(n), t, m.melody, detune);
    }
  }

  piano(freq, t, vol, detune = 0, reverse = false) {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800 + freq;
    g.connect(f).connect(this.voiceGain);
    [1, 2, 3, 4.01].forEach((p, i) => {
      const o = c.createOscillator();
      o.type = i ? 'sine' : 'triangle';
      o.frequency.value = freq * p;
      o.detune.value = detune + (Math.random() - 0.5) * 6;
      const og = c.createGain(); og.gain.value = 1 / (1 + i * 1.8);
      o.connect(og).connect(g);
      o.start(t); o.stop(t + 3.2);
    });
    g.gain.setValueAtTime(0, t);
    if (reverse) {
      g.gain.linearRampToValueAtTime(vol, t + 1.6);
      g.gain.linearRampToValueAtTime(0, t + 1.75);
    } else {
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    }
  }

  bass(freq, t, vol, detune, len = 0.9) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(f).connect(g).connect(this.voiceGain);
    o.start(t); o.stop(t + len + 0.1);
  }

  /** Soft electric piano: sine pair with a slow tremolo. */
  epiano(freq, t, vol, detune = 0) {
    const c = this.ctx;
    const g = c.createGain();
    const trem = c.createGain(); trem.gain.value = 1;
    const lfo = c.createOscillator(); lfo.frequency.value = 4.2;
    const lg = c.createGain(); lg.gain.value = 0.25;
    lfo.connect(lg).connect(trem.gain);
    g.connect(trem).connect(this.voiceGain);
    [[1, 1], [2.0, 0.25], [7.0, 0.02]].forEach(([p, a]) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p; o.detune.value = detune;
      const og = c.createGain(); og.gain.value = a;
      o.connect(og).connect(g); o.start(t); o.stop(t + 2.6);
    });
    lfo.start(t); lfo.stop(t + 2.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
  }

  /** Glassy bell / music box: inharmonic sine partials, long ring. */
  bell(freq, t, vol, detune = 0) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.voiceGain);
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([p, a], i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p; o.detune.value = detune;
      const og = c.createGain();
      og.gain.setValueAtTime(a, t); og.gain.exponentialRampToValueAtTime(0.0001, t + (i ? 1.2 : 3.6));
      o.connect(og).connect(g); o.start(t); o.stop(t + 3.8);
    });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
  }

  /** Plucked string: bright triangle into a closing lowpass. */
  pluck(freq, t, vol, detune = 0) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
    const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = freq; o2.detune.value = detune + 4;
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.5);
    const g = c.createGain();
    const g2 = c.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(f); o2.connect(g2).connect(f);
    f.connect(g).connect(this.voiceGain);
    o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
  }

  /** A held low note (root + fifth), slow swell, overlapping the next bar. */
  drone(freq, t, dur, vol, detune = 0) {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g).connect(this.voiceGain);
    [[1, 'sawtooth', -5], [1, 'sawtooth', 5], [1.5, 'sine', 0], [0.5, 'sine', 0]].forEach(([p, type, d]) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq * p; o.detune.value = detune + d;
      o.connect(f); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  /** Clock tick / closed hat. */
  tick(t, vol) {
    const c = this.ctx;
    if (!this.tickBuf) {
      const len = Math.floor(c.sampleRate * 0.03);
      this.tickBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.tickBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const s = c.createBufferSource(); s.buffer = this.tickBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.voiceGain);
    s.start(t);
  }

  /** Low heartbeat thump: a sine dropping in pitch. */
  thump(t, vol) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(this.voiceGain);
    o.start(t); o.stop(t + 0.4);
  }

  brush(t, vol) {
    const c = this.ctx;
    const len = c.sampleRate * 0.2;
    if (!this.brushBuf) {
      this.brushBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.brushBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const s = c.createBufferSource(); s.buffer = this.brushBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(this.voiceGain);
    s.start(t);
  }

  pad(freq, t, dur, vol, detune) {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol / 3, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    f.connect(g).connect(this.voiceGain);
    [-7, 7].forEach((d) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d + detune;
      o.connect(f); o.start(t); o.stop(t + dur + 0.1);
    });
  }
}
