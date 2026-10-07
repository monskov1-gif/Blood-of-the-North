import * as THREE from 'three';

/**
 * Window light: the "walking past a bright window" response.
 *
 * Every scene may publish `world.windowLights`: a list of WindowLightZone +
 * WindowLensFlareSource descriptions (see PROFILES in HospitalExpansion.js):
 *   position, dir, triggerDistance, fadeDistance, exposure, bloom, color,
 *   flareSize, starburstIntensity, ghostIntensity, ghostCount, ghostSpacing,
 *   ringIntensity, colorTint, ghostTints, streaks, maxScreenOpacity, enabled().
 *
 * 1. Exposure / bloom: a smooth weight from Julian's distance to the window
 *    (never a flash — it eases in and out over ~1 s) is pushed into the
 *    renderer as an additive post layer.
 * 2. Lens flare: a 2D overlay canvas (screen blend) above the 3D view. The
 *    starburst sits on the window's screen position; ghosts, a ring and (for
 *    blinds) streaks lie on the line from the source through the screen
 *    centre, so they slide as the camera follows Julian. Each new pass past a
 *    window reseeds the ghost layout a little, so it never repeats exactly.
 *    Nothing is ever drawn full white, and whatever overlaps Julian is dimmed —
 *    when he stands in front of the window he shadows the flare itself.
 */
export class WindowLight {
  constructor({ renderer, settings, canvas }) {
    this.renderer = renderer;
    this.settings = settings;
    this.low = renderer.isLow;
    const c = this.canvas = document.createElement('canvas');
    c.className = 'flare-layer';
    Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'screen', display: 'none' });
    canvas.insertAdjacentElement('afterend', c);
    this.ctx = c.getContext('2d');
    this.state = new WeakMap(); // zone → { w, seed, rot, ghosts }
    this.v = new THREE.Vector3();
    this.shown = false;
  }

  zoneState(z) {
    let s = this.state.get(z);
    if (!s) { s = { w: 0, pass: false }; this.state.set(z, s); this.reseed(z, s); }
    return s;
  }

  /** A new pass past the window: jitter the ghost chain, the star rotation, the ring. */
  reseed(z, s) {
    const R = Math.random;
    const n = this.low ? Math.ceil(z.ghostCount * 0.6) : z.ghostCount;
    s.rot = R() * Math.PI;
    s.ring = 0.85 + R() * 0.3;
    s.ghosts = Array.from({ length: n }, (_, i) => ({
      t: 0.35 + i * z.ghostSpacing * (0.8 + R() * 0.4) + (R() - 0.5) * 0.08,
      r: (0.025 + R() * 0.06) * (i % 3 === 2 ? 2.2 : 1),
      a: 0.5 + R() * 0.5,
      hex: R() < 0.45,
      tint: z.ghostTints[(i + (R() * 2 | 0)) % z.ghostTints.length],
    }));
  }

  update(dt, { world, julian, camera, keyScene, active }) {
    const zones = (active && world?.windowLights) || [];
    let exposure = 0, bloom = 0;
    const tint = [0, 0, 0];
    const draws = [];
    const k = 1 - Math.exp(-dt * 1.4); // ~1 s ease
    for (const z of zones) {
      const s = this.zoneState(z);
      let target = 0;
      if (julian && (!z.enabled || z.enabled())) {
        const dx = julian.position.x - z.position.x, dz = julian.position.z - (z.position.z + z.dir.z * 2.0);
        const d = z.dir.x ? Math.abs(dx) * 0.7 + Math.abs(julian.position.z - z.position.z) * 0.15 : Math.hypot(dx, dz * 0.35);
        target = 1 - smooth(z.triggerDistance, z.triggerDistance + z.fadeDistance, d);
      }
      if (s.w < 0.02 && target > 0.02 && !s.pass) { this.reseed(z, s); s.pass = true; }
      if (s.w < 0.01 && target < 0.01) s.pass = false;
      s.w += (target - s.w) * k;
      if (s.w < 0.004) continue;
      exposure += s.w * z.exposure;
      bloom += s.w * z.bloom;
      const ct = z.colorTint;
      for (let i = 0; i < 3; i++) tint[i] += s.w * (ct[i] - 0.9) * 0.08;
      draws.push([z, s]);
    }
    const fx = this.settings?.get?.('effects') ?? 1;
    const calm = keyScene ? 0.35 : 1;
    if (exposure > 0.001) this.renderer.setLayer('windowLight', { exposure: Math.min(0.5, exposure) * (0.6 + 0.4 * calm), bloom: Math.min(0.8, bloom) * calm, tint });
    else this.renderer.clearLayer('windowLight');
    this.draw(draws, camera, julian, fx * calm);
  }

  draw(draws, camera, julian, gain) {
    const c = this.canvas;
    if (!draws.length || gain <= 0.01 || !camera) {
      if (this.shown) { this.ctx.clearRect(0, 0, c.width, c.height); c.style.display = 'none'; this.shown = false; }
      return;
    }
    // half resolution is plenty for soft shapes
    const W = Math.max(2, Math.round(c.clientWidth * 0.5 || innerWidth * 0.5)), Hh = Math.max(2, Math.round(c.clientHeight * 0.5 || innerHeight * 0.5));
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    if (!this.shown) { c.style.display = 'block'; this.shown = true; }
    const g = this.ctx;
    g.clearRect(0, 0, W, Hh);
    g.globalCompositeOperation = 'lighter';
    const toScreen = (p) => {
      this.v.copy(p).project(camera);
      return { x: (this.v.x * 0.5 + 0.5) * W, y: (-this.v.y * 0.5 + 0.5) * Hh, z: this.v.z, nx: this.v.x, ny: this.v.y };
    };
    // Julian's screen box (flare elements over him are dimmed)
    let jb = null;
    if (julian?.root?.visible !== false && julian?.position) {
      const a = toScreen(this.v.set(julian.position.x, 0, julian.position.z).clone());
      const b = toScreen(new THREE.Vector3(julian.position.x, 1.85, julian.position.z));
      const hw = Math.abs(a.y - b.y) * 0.24;
      jb = { x0: a.x - hw, x1: a.x + hw, y0: b.y, y1: a.y };
    }
    const overJ = (x, y, r) => jb && x + r > jb.x0 && x - r < jb.x1 && y + r > jb.y0 && y - r < jb.y1;
    const camPos = camera.position;
    for (const [z, s] of draws) {
      const S = toScreen(z.position);
      if (S.z > 1 || S.z < -1) continue;
      // facing: the window must look toward the camera
      const facing = z.dir.x * (camPos.x - z.position.x) + z.dir.z * (camPos.z - z.position.z);
      if (facing <= 0) continue;
      // on-screen fade (a source just off the frame edge still throws ghosts in)
      const edge = 1 - smooth(1.0, 1.45, Math.max(Math.abs(S.nx), Math.abs(S.ny)));
      // Julian standing in front of the window shadows the source
      const occl = overJ(S.x, S.y, 0) ? 0.3 : 1;
      const A = Math.min(z.maxScreenOpacity, s.w * z.intensity * edge * occl * gain);
      if (A < 0.01) continue;
      const base = Hh;
      const tintCss = (t, a) => `rgba(${(t[0] * 235) | 0},${(t[1] * 235) | 0},${(t[2] * 235) | 0},${a.toFixed(3)})`;
      // --- core glow
      const coreR = base * 0.2 * z.flareSize;
      soft(g, S.x, S.y, coreR, tintCss(z.colorTint, 0.42 * A), tintCss(z.colorTint, 0));
      // --- starburst: thin spikes, rotating slowly with the source's screen position
      if (z.starburstIntensity > 0) {
        const spikes = z.id === 'D' ? 8 : 6;
        const len = base * 0.42 * z.flareSize;
        const rot = s.rot + S.nx * 0.35;
        for (let i = 0; i < spikes; i++) {
          const ang = rot + (i / spikes) * Math.PI * 2;
          const l = len * (i % 2 ? 0.55 : 1) * (0.85 + 0.15 * Math.sin(i * 7.1 + s.rot));
          spike(g, S.x, S.y, ang, l, base * 0.006 * z.flareSize, tintCss(z.colorTint, 0.3 * A * z.starburstIntensity));
        }
      }
      // --- streaks through blinds: horizontal anamorphic lines
      if (z.streaks) {
        for (let i = -2; i <= 2; i++) {
          const y = S.y + i * base * 0.018;
          const lw = base * (0.5 - Math.abs(i) * 0.08);
          const gr = g.createLinearGradient(S.x - lw, y, S.x + lw, y);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, tintCss(z.colorTint, 0.22 * A * (1 - Math.abs(i) * 0.25))); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(S.x - lw, y - 0.6, lw * 2, 1.2);
        }
      }
      // --- ghosts along the source → centre line (and past it)
      const vx = W / 2 - S.x, vy = Hh / 2 - S.y;
      for (const gh of s.ghosts) {
        const x = S.x + vx * gh.t * 2, y = S.y + vy * gh.t * 2;
        const r = base * gh.r * z.flareSize;
        let a = A * z.ghostIntensity * gh.a * 0.16;
        if (overJ(x, y, r)) a *= 0.3;
        if (a < 0.004) continue;
        const col = tintCss(gh.tint, a), col0 = tintCss(gh.tint, 0);
        if (gh.hex) hexagon(g, x, y, r, s.rot, col);
        else soft(g, x, y, r, col, col0, 0.55);
      }
      // --- ring: a faint halo across the centre
      if (z.ringIntensity > 0) {
        const x = S.x + vx * 1.6, y = S.y + vy * 1.6;
        const r = base * 0.34 * z.flareSize * s.ring;
        let a = A * z.ringIntensity * 0.1;
        if (overJ(x, y, r * 0.2)) a *= 0.5;
        const gr = g.createRadialGradient(x, y, r * 0.86, x, y, r);
        const t = z.ghostTints[0];
        gr.addColorStop(0, tintCss(t, 0)); gr.addColorStop(0.55, tintCss(t, a)); gr.addColorStop(0.75, tintCss(z.colorTint, a * 0.7)); gr.addColorStop(1, tintCss(t, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }

  dispose() { this.canvas.remove(); this.renderer.clearLayer('windowLight'); }
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

function soft(g, x, y, r, c1, c0, hard = 0) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, c1);
  if (hard) gr.addColorStop(hard, c1);
  gr.addColorStop(1, c0);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

function spike(g, x, y, ang, len, wid, col) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const gr = g.createLinearGradient(x, y, x + dx * len, y + dy * len);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x - dy * wid, y + dx * wid);
  g.lineTo(x + dx * len, y + dy * len);
  g.lineTo(x + dy * wid, y - dx * wid);
  g.closePath(); g.fill();
}

function hexagon(g, x, y, r, rot, col) {
  g.fillStyle = col;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  g.closePath(); g.fill();
}
