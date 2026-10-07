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

  /**
   * A new pass past the window: lay the ghost chain out again with a little
   * jitter (positions on the axis, sizes, which hexes show, ray rotation), so
   * it never repeats exactly. Layout after a real anamorphic-free zoom lens:
   * big faint hexes near the source, a chromatic spot, small hexes and dots
   * along the axis, and past the centre a sparkle, a blue spot and a rainbow arc.
   */
  reseed(z, s) {
    const R = Math.random, j = (v, k = 0.12) => v * (1 + (R() - 0.5) * 2 * k);
    const T = z.ghostTints;
    const tint = (i) => T[i % T.length];
    s.rot = R() * Math.PI;
    s.spin = (R() - 0.5) * 0.6;
    const all = [
      { type: 'hex', t: j(0.5), r: j(0.115), tint: [1.0, 0.62, 0.35], a: 0.32 },
      { type: 'hex', t: j(0.6), r: j(0.07), tint: tint(0), a: 0.42 },
      { type: 'hex', t: j(0.36), r: j(0.045), tint: tint(1), a: 0.4 },
      { type: 'hex', t: j(0.62), r: j(0.16), tint: [0.9, 0.55, 0.4], a: 0.12 },
      { type: 'chroma', t: j(0.6), off: -j(0.2), r: j(0.045), a: 0.5 },
      { type: 'dot', t: j(0.88, 0.05), r: 0.006, tint: [1, 0.8, 0.5], a: 0.7 },
      { type: 'dot', t: j(0.98, 0.05), r: 0.005, tint: [1, 0.7, 0.4], a: 0.6 },
      { type: 'hex', t: j(1.3), r: j(0.022), tint: tint(0), a: 0.55 },
      { type: 'hex', t: j(1.6), r: j(0.024), tint: tint(2), a: 0.5 },
      { type: 'spot', t: j(1.85, 0.06), off: -0.03, r: j(0.03), tint: [0.45, 0.4, 1.0], a: 0.75 },
      { type: 'sparkle', t: j(2.0, 0.05), r: j(0.075), tint: [0.55, 1.0, 0.55], a: 0.9 },
      { type: 'glow', t: j(2.15, 0.06), r: j(0.2), tint: [0.3, 0.9, 0.45], a: 0.32 },
      { type: 'ring', t: j(2.15, 0.06), r: j(0.24, 0.08), a: 1 },
      { type: 'sparkle', t: j(2.45, 0.05), off: 0.06, r: j(0.05), tint: [0.6, 1.0, 0.5], a: 0.55 },
    ];
    // fewer elements for the soft profiles / low quality: keep the strongest ones
    const n = Math.max(3, Math.round(all.length * Math.min(1, z.ghostCount / 8) * (this.low ? 0.7 : 1)));
    // priority: what makes it read as a lens flare goes first
    const order = [0, 12, 10, 11, 1, 4, 9, 2, 7, 8, 3, 5, 13, 6];
    const pick = new Set(order.slice(0, n));
    s.ghosts = all.filter((g, i) => pick.has(i));
  }

  /** Pre-rendered flare elements (built once per colour, drawn scaled each frame). */
  sprite(key, size, draw) {
    this.sprites ??= new Map();
    let c = this.sprites.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.globalCompositeOperation = 'lighter';
      draw(g, size);
      this.sprites.set(key, c);
    }
    return c;
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
    const sc = this.low ? 0.5 : 0.75;
    const W = Math.max(2, Math.round((c.clientWidth || innerWidth) * sc)), Hh = Math.max(2, Math.round((c.clientHeight || innerHeight) * sc));
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
      const a = toScreen(new THREE.Vector3(julian.position.x, 0, julian.position.z));
      const b = toScreen(new THREE.Vector3(julian.position.x, 1.85, julian.position.z));
      const hw = Math.abs(a.y - b.y) * 0.24;
      jb = { x0: a.x - hw, x1: a.x + hw, y0: b.y, y1: a.y };
    }
    const overJ = (x, y, r) => jb && x + r > jb.x0 && x - r < jb.x1 && y + r > jb.y0 && y - r < jb.y1;
    const camPos = camera.position;
    for (const [z, s] of draws) {
      const S = toScreen(z.position);
      if (S.z > 1 || S.z < -1) continue;
      const facing = z.dir.x * (camPos.x - z.position.x) + z.dir.z * (camPos.z - z.position.z);
      if (facing <= 0) continue;
      const edge = 1 - smooth(1.0, 1.45, Math.max(Math.abs(S.nx), Math.abs(S.ny)));
      // Julian standing in front of the window shadows the source
      const occl = overJ(S.x, S.y, 0) ? 0.3 : 1;
      const A = Math.min(z.maxScreenOpacity, s.w * z.intensity * edge * occl * gain);
      if (A < 0.01) continue;
      const U = Hh; // unit: screen height
      const put = (img, x, y, r, a, rot = 0) => {
        if (a < 0.004) return;
        g.globalAlpha = Math.min(1, a);
        if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(img, -r, -r, r * 2, r * 2); g.restore(); }
        else g.drawImage(img, x - r, y - r, r * 2, r * 2);
      };
      // --- source: halo + core + starburst
      const ct = z.colorTint;
      put(this.halo(ct), S.x, S.y, U * 0.36 * z.flareSize, A * 0.5);
      if (z.starburstIntensity > 0) put(this.burst(z.id, ct), S.x, S.y, U * 0.4 * z.flareSize, A * Math.min(1, 0.6 * z.starburstIntensity), s.rot + S.nx * s.spin);
      put(this.core(ct), S.x, S.y, U * 0.1 * z.flareSize, A * 0.8);
      // --- streaks through blinds: thin horizontal lines
      if (z.streaks) for (let i = -2; i <= 2; i++) {
        const lw = U * (0.55 - Math.abs(i) * 0.09) * z.flareSize;
        g.globalAlpha = Math.min(1, A * 0.5 * (1 - Math.abs(i) * 0.25));
        g.drawImage(this.streak(ct), S.x - lw, S.y + i * U * 0.02 - U * 0.006, lw * 2, U * 0.012);
      }
      // --- the ghost chain along source → centre (and past it)
      const vx = W / 2 - S.x, vy = Hh / 2 - S.y;
      const len = Math.hypot(vx, vy) || 1, px = -vy / len, py = vx / len;
      const gi = z.ghostIntensity * 1.6; // ghosts sit over a lit room, not over black
      for (const gh of s.ghosts) {
        const x = S.x + vx * gh.t + px * (gh.off || 0) * U, y = S.y + vy * gh.t + py * (gh.off || 0) * U;
        const r = U * gh.r * z.flareSize;
        let a = A * gi * gh.a;
        if (overJ(x, y, r)) a *= 0.3;
        switch (gh.type) {
          case 'hex': put(this.hex(gh.tint), x, y, r, a * 0.8, s.rot * 0.2); break;
          case 'dot': put(this.core(gh.tint), x, y, Math.max(1.5, r), a); break;
          case 'chroma': put(this.chroma(), x, y, r, a, Math.atan2(vy, vx)); break;
          case 'spot': put(this.halo(gh.tint), x, y, r, a); put(this.core(gh.tint), x, y, r * 0.35, a * 0.6); break;
          case 'sparkle': put(this.sparkle(gh.tint), x, y, r, a, s.rot * 0.5 + 0.4); break;
          case 'glow': put(this.halo(gh.tint), x, y, r, a); break;
          case 'ring': if (z.ringIntensity > 0) put(this.ring(), x, y, r, a * z.ringIntensity * 0.75, Math.atan2(vy, vx)); break;
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- sprites

  /** Wide soft halo. */
  halo(t) {
    return this.sprite(`halo-${t}`, 128, (g, n) => {
      const h = n / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, rgba(t, 0.6)); gr.addColorStop(0.2, rgba(t, 0.3)); gr.addColorStop(0.5, rgba(t, 0.08)); gr.addColorStop(1, rgba(t, 0));
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
  }

  /** Hot core: white middle, tinted rim. */
  core(t) {
    return this.sprite(`core-${t}`, 64, (g, n) => {
      const h = n / 2, gr = g.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, 'rgba(255,252,246,1)'); gr.addColorStop(0.35, 'rgba(255,246,230,0.95)'); gr.addColorStop(0.6, rgba(t, 0.45)); gr.addColorStop(1, rgba(t, 0));
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
  }

  /** Starburst: a dozen long thin rays and many short fine ones, a few tinted green/yellow. */
  burst(id, t) {
    return this.sprite(`burst-${id}`, 512, (g, n) => {
      const h = n / 2;
      let seed = id.charCodeAt(0) * 97;
      const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const ray = (ang, len, wid, col) => {
        const dx = Math.cos(ang), dy = Math.sin(ang);
        const gr = g.createLinearGradient(h, h, h + dx * len, h + dy * len);
        gr.addColorStop(0, col(0.8)); gr.addColorStop(0.15, col(0.42)); gr.addColorStop(0.5, col(0.12)); gr.addColorStop(1, col(0));
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(h - dy * wid, h + dx * wid); g.lineTo(h + dx * len, h + dy * len); g.lineTo(h + dy * wid, h - dx * wid);
        g.closePath(); g.fill();
      };
      g.filter = 'blur(2px)';
      const main = 12;
      for (let i = 0; i < main; i++) {
        const ang = (i / main) * Math.PI * 2 + (R() - 0.5) * 0.12;
        const len = h * (0.45 + R() * 0.55);
        const green = R() < 0.2;
        ray(ang, len, 3 + R() * 2, (a) => (green ? rgba([0.75, 1.0, 0.45], a * 0.8) : rgba(t, a)));
      }
      for (let i = 0; i < 40; i++) ray(R() * Math.PI * 2, h * (0.15 + R() * 0.35), 0.8 + R() * 0.8, (a) => rgba(t, a * 0.45));
      g.filter = 'none';
    });
  }

  /** A ghost of the aperture: a hexagon with a brighter rim and soft edges. */
  hex(t) {
    return this.sprite(`hex-${t}`, 128, (g, n) => {
      const h = n / 2, r = h * 0.82;
      const path = () => {
        g.beginPath();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; const x = h + Math.cos(a) * r, y = h + Math.sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.closePath();
      };
      g.filter = 'blur(2px)';
      const gr = g.createRadialGradient(h, h, 0, h, h, r);
      gr.addColorStop(0, rgba(t, 0.35)); gr.addColorStop(0.75, rgba(t, 0.5)); gr.addColorStop(1, rgba(t, 0.8));
      g.fillStyle = gr; path(); g.fill();
      g.strokeStyle = rgba(t, 0.5); g.lineWidth = 2.5; path(); g.stroke();
      g.filter = 'none';
    });
  }

  /** Chromatic spot: red on one side, a cyan fringe on the other. */
  chroma() {
    return this.sprite('chroma', 128, (g, n) => {
      const h = n / 2;
      g.filter = 'blur(3px)';
      g.fillStyle = 'rgba(255,70,90,0.85)'; g.beginPath(); g.ellipse(h - 6, h, h * 0.42, h * 0.62, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(120,255,200,0.35)'; g.beginPath(); g.ellipse(h + 16, h, h * 0.3, h * 0.58, 0, 0, Math.PI * 2); g.fill();
      g.filter = 'none';
    });
  }

  /** The far sparkle: a small hot point with a thin four-point star. */
  sparkle(t) {
    return this.sprite(`sparkle-${t}`, 256, (g, n) => {
      const h = n / 2;
      const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.4);
      gr.addColorStop(0, 'rgba(255,255,240,0.95)'); gr.addColorStop(0.2, rgba(t, 0.8)); gr.addColorStop(1, rgba(t, 0));
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      g.filter = 'blur(1px)';
      for (const [ang, len] of [[0, 1], [Math.PI / 2, 0.55], [Math.PI, 1], [Math.PI * 1.5, 0.55], [Math.PI / 4, 0.3], [Math.PI * 1.25, 0.3]]) {
        const dx = Math.cos(ang), dy = Math.sin(ang), L = h * 0.98 * len;
        const lg = g.createLinearGradient(h, h, h + dx * L, h + dy * L);
        lg.addColorStop(0, rgba(t, 0.95)); lg.addColorStop(1, rgba(t, 0));
        g.fillStyle = lg; g.beginPath(); g.moveTo(h - dy * 2.5, h + dx * 2.5); g.lineTo(h + dx * L, h + dy * L); g.lineTo(h + dy * 2.5, h - dx * 2.5); g.closePath(); g.fill();
      }
      g.filter = 'none';
    });
  }

  /** Rainbow arc (part of a ring), brightest on the side away from the source. */
  ring() {
    return this.sprite('ring', 512, (g, n) => {
      const h = n / 2;
      g.filter = 'blur(7px)';
      const bands = [[255, 60, 40], [255, 160, 40], [200, 255, 80], [60, 255, 140], [60, 180, 255], [120, 80, 255]];
      bands.forEach((c, i) => {
        g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.42)`;
        g.lineWidth = 11;
        g.beginPath(); g.arc(h, h, h * 0.86 - i * 8, -1.25, 1.35); g.stroke();
      });
      // a second, fainter inner arc
      g.strokeStyle = 'rgba(80,255,160,0.3)'; g.lineWidth = 16;
      g.beginPath(); g.arc(h - 18, h + 10, h * 0.62, -0.6, 1.9); g.stroke();
      g.filter = 'none';
      // fade the arc ends
      g.globalCompositeOperation = 'destination-in';
      const cg = g.createConicGradient(0, h, h);
      cg.addColorStop(0, 'rgba(0,0,0,1)'); cg.addColorStop(0.2, 'rgba(0,0,0,0.6)'); cg.addColorStop(0.32, 'rgba(0,0,0,0)');
      cg.addColorStop(0.68, 'rgba(0,0,0,0)'); cg.addColorStop(0.8, 'rgba(0,0,0,0.6)'); cg.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = cg; g.fillRect(0, 0, n, n);
    });
  }

  /** Horizontal streak for light through blinds. */
  streak(t) {
    return this.sprite(`streak-${t}`, 256, (g, n) => {
      const gr = g.createLinearGradient(0, 0, n, 0);
      gr.addColorStop(0, rgba(t, 0)); gr.addColorStop(0.5, rgba(t, 0.9)); gr.addColorStop(1, rgba(t, 0));
      g.fillStyle = gr; g.fillRect(0, n * 0.35, n, n * 0.3);
    });
  }

  dispose() { this.canvas.remove(); this.renderer.clearLayer('windowLight'); }
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

function rgba(t, a) { return `rgba(${(t[0] * 255) | 0},${(t[1] * 255) | 0},${(t[2] * 255) | 0},${a})`; }
