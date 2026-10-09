/**
 * The poisoning sequence. Six phases, each adds a distinct layer instead of
 * switching everything on at once:
 *   1 normal · 2 slight discomfort · 3 auditory distortion ·
 *   4 visual distortion · 5 loss of control · 6 collapse
 * Values are interpolated, so phase changes are gradual.
 */
const PHASES = {
  1: { render: {}, cam: 0, muffle: 0, warp: 0, npc: 1, unreal: 0, impair: 0, heart: 0, vn: {} },
  2: {
    render: { vignette: 0.15, blur: 0.12, exposure: 0.04, saturation: 0.05 },
    cam: 0.08, muffle: 0.12, warp: 0.1, npc: 1, unreal: 0.1, impair: 0, heart: 0.35,
    vn: { blur: 0.3, red: 0.12 },
  },
  3: {
    render: { vignette: 0.28, blur: 0.25, saturation: 0.1 },
    cam: 0.15, muffle: 0.65, warp: 0.45, npc: 0.8, unreal: 0.25, impair: 0, heart: 0.7, ring: true,
    vn: { blur: 0.6, red: 0.22, wobble: 0.2 },
  },
  4: {
    render: { vignette: 0.38, blur: 0.45, ca: 1.0, distort: 0.25, wave: 0.6, saturation: 0.25, redPulse: 0.12, ghost: 0.3 },
    cam: 0.32, muffle: 0.72, warp: 0.65, npc: 0.35, unreal: 0.6, impair: 0, heart: 0.9, ring: true, drone: true,
    vn: { blur: 1.2, hue: -14, red: 0.4, wobble: 0.6, ghost: 0.4 },
  },
  5: {
    render: { vignette: 0.55, blur: 0.75, ca: 1.7, distort: 0.4, wave: 1.0, saturation: 0.35, redPulse: 0.3, ghost: 0.85 },
    cam: 0.7, muffle: 0.85, warp: 0.9, npc: 0.12, unreal: 1, impair: 0.8, heart: 1.25, ring: true, drone: true,
    vn: { blur: 2, hue: -24, red: 0.6, wobble: 1, ghost: 0.7 },
  },
  6: {
    render: { vignette: 0.8, blur: 1.2, ca: 2.2, distort: 0.6, wave: 1.2, saturation: -0.4, redPulse: 0.2, ghost: 1 },
    cam: 1.0, muffle: 1, warp: 1, npc: 0.05, unreal: 1, impair: 1, heart: 0.6, ring: true, drone: true,
    vn: { blur: 3, red: 0.8 },
  },
};

const KEYS = ['vignette', 'blur', 'ca', 'distort', 'wave', 'saturation', 'redPulse', 'ghost', 'exposure'];

export class Hallucination {
  constructor({ renderer, audio, cameraSys, scene, characters, player, view, settings }) {
    Object.assign(this, { renderer, audio, cameraSys, scene, characters, player, view, settings });
    this.phase = 1;
    this.cur = { render: Object.fromEntries(KEYS.map((k) => [k, 0])), cam: 0, muffle: 0, warp: 0, npc: 1, unreal: 0, impair: 0, heart: 0 };
    this.heartT = 0;
    this.time = 0;
  }

  setPhase(n) {
    if (n === this.phase) return;
    this.phase = n;
    const p = PHASES[n];
    if (n >= 3 && !this.ring) this.ring = this.audio.loop('inner.ring', { fade: 4 });
    if (n < 3 && this.ring) { this.ring.stop(2); this.ring = null; }
    if (n >= 4 && !this.drone) this.drone = this.audio.loop('inner.drone', { fade: 5 });
    if (n < 4 && this.drone) { this.drone.stop(2); this.drone = null; }
    if (n === 2) this.audio.music('tense', 6);
    if (n >= 3) this.audio.music('hallucination', 6);
    if (n === 1) this.audio.music('lounge', 3);
    this.view?.setFx(p.vn);
    if (n >= 4) this.cameraSys.shake = 0.6;
  }

  reset() {
    this.setPhase(1);
    this.phase = 1;
    for (const k of KEYS) this.cur.render[k] = 0;
    Object.assign(this.cur, { cam: 0, muffle: 0, warp: 0, npc: 1, unreal: 0, impair: 0, heart: 0 });
    this.apply(0);
    this.view?.setFx({});
  }

  update(dt) {
    this.time += dt;
    const p = PHASES[this.phase];
    const k = Math.min(1, dt * 0.45);
    for (const key of KEYS) this.cur.render[key] += ((p.render[key] || 0) - this.cur.render[key]) * k;
    for (const key of ['cam', 'muffle', 'warp', 'npc', 'unreal', 'impair', 'heart']) this.cur[key] += ((p[key] ?? 0) - this.cur[key]) * k;
    this.apply(dt);
  }

  apply(dt) {
    const c = this.cur;
    const t = this.time;
    const r = { ...c.render };
    // breathing exposure fluctuation and pulsing redness tied to the heartbeat
    if (this.phase >= 4) r.exposure = (r.exposure || 0) + Math.sin(t * 1.7) * 0.08 * c.unreal + Math.sin(t * 5.3) * 0.03 * c.unreal;
    r.redPulse = (r.redPulse || 0) * (0.6 + 0.4 * Math.max(0, Math.sin(this.heartPhase || 0)));
    this.renderer.setLayer('hallucination', r);
    this.cameraSys.sway = c.cam;
    this.audio.setMuffle(c.muffle, 1, 'hallucination');
    this.audio.setWarp(c.warp);
    this.scene.setUnreality?.(c.unreal);
    if (this.player) this.player.impair = c.impair;
    for (const ch of this.characters.values()) if (ch.id !== 'julian') ch.timeScale = c.npc;
    if (this.scene.dust) this.scene.dust.speed = c.npc;
    // heartbeat
    if (c.heart > 0.05 && dt > 0) {
      const bpm = 60 + c.heart * 50;
      this.heartT -= dt;
      this.heartPhase = (this.heartPhase || 0) + dt * (bpm / 60) * Math.PI * 2;
      if (this.heartT <= 0) {
        this.heartT = 60 / bpm;
        this.audio.play('inner.heartbeat', { volume: Math.min(1, c.heart) });
      }
    }
  }
}
