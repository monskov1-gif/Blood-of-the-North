/**
 * Procedural placeholder score. Each "mood" is a tiny generative piece
 * (chords, bass, brushes, pads). A real soundtrack can replace this by
 * mapping moods to files in AudioManager.music().
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
    if (inBar === 0 || (inBar === 5 && Math.random() < 0.5)) {
      chord.forEach((n, i) => this.piano(NOTE(n), t + i * 0.012, m.piano * (inBar ? 0.6 : 1), detune, m.reverse));
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

  bass(freq, t, vol, detune) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(f).connect(g).connect(this.voiceGain);
    o.start(t); o.stop(t + 1);
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
