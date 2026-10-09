import * as THREE from 'three';
import { roundedBox } from './nature.js';

const boxCache = new Map();
import { MaterialLib, glow, lightPool } from './props.js';
import { canvasTexture, rng } from '../render/textures.js';
import { SafeZones } from './SafeZones.js';
import { Dust } from './Particles.js';

/**
 * Shared base for side-on locations (police car, station, interrogation room,
 * hospital, street). Same contract as BarScene: build() → root, update(dt),
 * bounds { walk, camera }, colliders, anchors, safeZones, foregroundGroups,
 * plus `camera` framing and an optional `setState(name)` (Scene State System).
 */
export class LocationBase {
  constructor({ renderer, quality }) {
    this.renderer = renderer;
    this.low = quality === 'low';
    this.mats = new MaterialLib(this.low);
    this.root = new THREE.Group();
    this.colliders = [];
    this.anchors = {};
    this.lights = {};
    this.animated = [];
    this.foregroundGroups = [];
    this.time = 0;
    this.state = 'default';
    this.background = 0x05060a;
    this.camera = { distance: 8.4, height: 2.4, lookHeight: 1.28, lookZ: -0.6 };
  }

  // ------------------------------------------------------------------ builders

  mat(key, params) { return this.mats.get(key, params); }

  /** A box with softly bevelled edges (no razor-sharp primitive corners anywhere). */
  box(w, h, d, mat, x, y, z, parent = this.root) {
    const key = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
    let geo = boxCache.get(key);
    if (!geo) {
      const r = Math.min(0.02, 0.18 * Math.min(w, h, d));
      geo = r > 0.002 ? roundedBox(w, h, d, r, 1) : new THREE.BoxGeometry(w, h, d);
      geo.parameters = { width: w, height: h, depth: d };
      boxCache.set(key, geo);
    }
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  plane(w, h, mat, x, y, z, ry = 0, parent = this.root) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  floor(minX, maxX, minZ, maxZ, mat) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), mat);
    f.rotation.x = -Math.PI / 2;
    f.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.root.add(f);
    return f;
  }

  /** Wall along x at depth z, with rectangular holes [{x0,x1,y0,y1}]. */
  wall(minX, maxX, height, z, mat, holes = []) {
    const shape = new THREE.Shape();
    shape.moveTo(minX, 0); shape.lineTo(maxX, 0); shape.lineTo(maxX, height); shape.lineTo(minX, height); shape.lineTo(minX, 0);
    for (const h of holes) {
      const p = new THREE.Path();
      p.moveTo(h.x0, h.y0); p.lineTo(h.x0, h.y1); p.lineTo(h.x1, h.y1); p.lineTo(h.x1, h.y0); p.lineTo(h.x0, h.y0);
      shape.holes.push(p);
    }
    const geo = new THREE.ShapeGeometry(shape);
    // world-space UVs (1 unit = 1 m) so textures tile evenly
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getY(i) / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    this.root.add(m);
    return m;
  }

  /** Fluorescent ceiling panel: emissive quad + (optionally) a real light under it. */
  fluorescent(x, y, z, { light = true, intensity = 9, color = 0xdfeaff, w = 1.2, d = 0.3, range = 7 } = {}) {
    const g = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, d + 0.08), this.mat('fluoHousing', { color: 0xb0b4b8, roughness: 0.6 }));
    const tube = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: 2.2, side: THREE.DoubleSide }));
    tube.rotation.x = Math.PI / 2;
    tube.position.y = -0.035;
    g.add(housing, tube);
    g.position.set(x, y, z);
    this.root.add(g);
    let l = null;
    if (light) {
      l = new THREE.SpotLight(color, intensity, range, 1.2, 0.9, 1.4);
      l.position.set(x, y - 0.1, z);
      l.target.position.set(x, 0, z + 0.4);
      this.root.add(l, l.target);
    }
    return { group: g, tube, light: l, base: intensity };
  }

  door(x, z, { w = 1.0, h = 2.15, color = 0x6a7480, glass = true, sign, signColor = '#e8e8e0', frameColor = 0x2a2e34 } = {}) {
    const g = new THREE.Group();
    const frameMat = this.mat(`doorFrame-${frameColor}`, { color: frameColor, roughness: 0.5, metalness: 0.3 });
    this.box(w + 0.12, 0.08, 0.12, frameMat, 0, h + 0.04, 0, g);
    this.box(0.06, h, 0.12, frameMat, -w / 2 - 0.03, h / 2, 0, g);
    this.box(0.06, h, 0.12, frameMat, w / 2 + 0.03, h / 2, 0, g);
    const leaf = this.box(w, h, 0.05, this.mat(`doorLeaf-${color}`, { color, roughness: 0.55, metalness: 0.15 }), 0, h / 2, -0.02, g);
    if (glass) this.box(w * 0.35, h * 0.28, 0.06, this.mat('doorGlass', { color: 0x1c2630, roughness: 0.1, metalness: 0.4, emissive: 0x0a1018 }), 0, h * 0.7, -0.01, g);
    this.box(0.12, 0.03, 0.06, this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), w * 0.36, h * 0.47, 0.04, g);
    if (sign) {
      const s = this.textSign(sign, { w: Math.max(0.6, sign.length * 0.07), h: 0.18, bg: '#1a2026', fg: signColor });
      s.position.set(0, h + 0.28, 0.02);
      g.add(s);
    }
    g.position.set(x, 0, z);
    g.userData.leaf = leaf;
    this.root.add(g);
    return g;
  }

  textSign(text, { w = 1, h = 0.2, bg = '#1a2026', fg = '#e8e8e0', font = 'bold 44px sans-serif', emissive = 0 } = {}) {
    const tex = canvasTexture(`sign-${text}-${bg}-${fg}`, 512, Math.round(512 * h / w), (ctx, cw, ch) => {
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = 44;
      while (ctx.measureText(text).width > cw * 0.9 && size > 12) { size -= 2; ctx.font = font.replace(/\d+px/, `${size}px`); }
      ctx.fillText(text, cw / 2, ch / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive }));
    return m;
  }

  bench(x, z, len = 2.0, color = 0x3a4a5a) {
    const g = new THREE.Group();
    const seat = this.mat(`bench-${color}`, { color, roughness: 0.6 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const n = Math.max(2, Math.round(len / 0.55));
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + (i + 0.5) * (len / n);
      this.box(len / n - 0.05, 0.06, 0.45, seat, cx, 0.45, 0, g);
      this.box(len / n - 0.05, 0.42, 0.05, seat, cx, 0.72, -0.21, g).rotation.x = -0.12;
    }
    this.box(len, 0.04, 0.04, steel, 0, 0.4, 0, g);
    for (const s of [-1, 1]) this.box(0.04, 0.42, 0.4, steel, s * (len / 2 - 0.1), 0.2, 0, g);
    g.position.set(x, 0, z);
    this.root.add(g);
    return g;
  }

  desk(x, z, w = 1.6, d = 0.75, color = 0x6a5a48) {
    const g = new THREE.Group();
    const top = this.mat(`desk-${color}`, { color, roughness: 0.5 });
    const steel = this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 });
    this.box(w, 0.04, d, top, 0, 0.76, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.04, 0.74, 0.04, steel, sx * (w / 2 - 0.05), 0.37, sz * (d / 2 - 0.05), g);
    g.position.set(x, 0, z);
    this.root.add(g);
    return g;
  }

  officeChair(x, z, ry = 0) {
    const g = new THREE.Group();
    const fab = this.mat('chairFabric', { color: 0x23262c, roughness: 0.9 });
    const steel = this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 });
    this.box(0.46, 0.08, 0.44, fab, 0, 0.48, 0, g);
    this.box(0.44, 0.5, 0.06, fab, 0, 0.8, -0.2, g);
    this.box(0.04, 0.44, 0.04, steel, 0, 0.24, 0, g);
    this.box(0.5, 0.03, 0.04, steel, 0, 0.03, 0, g);
    this.box(0.04, 0.03, 0.5, steel, 0, 0.03, 0, g);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.root.add(g);
    return g;
  }

  /** Hospital bed (head towards -x). */
  bed(x, z, { flip = false } = {}) {
    const g = new THREE.Group();
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const sheet = this.mat('sheet', { color: 0xd8dce2, roughness: 0.95 });
    const blanket = this.mat('blanket', { color: 0x7a8ea0, roughness: 0.95 });
    this.box(2.05, 0.16, 0.92, steel, 0, 0.5, 0, g);
    this.box(2.0, 0.14, 0.88, sheet, 0, 0.64, 0, g);
    const pillow = this.box(0.42, 0.12, 0.6, sheet, -0.75, 0.76, 0, g);
    pillow.rotation.z = 0.15;
    for (const s of [-1, 1]) {
      this.box(0.05, 0.6, 0.9, steel, s * 1.02, 0.6, 0, g);
      for (const sz of [-1, 1]) this.box(0.04, 0.42, 0.04, steel, s * 0.95, 0.21, sz * 0.4, g);
    }
    this.box(1.0, 0.04, 0.03, steel, 0.2, 0.86, 0.46, g); // side rail
    const cover = this.box(1.25, 0.1, 0.94, blanket, 0.32, 0.72, 0, g);
    g.userData.cover = cover;
    if (flip) g.rotation.y = Math.PI;
    g.position.set(x, 0, z);
    this.root.add(g);
    return g;
  }

  /** IV stand with a bag (color: saline or blood). */
  ivStand(x, z, bagColor = 0xdde8f0) {
    const g = new THREE.Group();
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    this.box(0.025, 1.9, 0.025, steel, 0, 0.95, 0, g);
    this.box(0.5, 0.02, 0.02, steel, 0, 1.88, 0, g);
    for (let i = 0; i < 5; i++) { const leg = this.box(0.3, 0.02, 0.02, steel, 0.12, 0.05, 0, g); leg.rotation.y = (i / 5) * Math.PI * 2; leg.position.set(Math.cos(leg.rotation.y) * 0.12, 0.05, -Math.sin(leg.rotation.y) * 0.12); }
    const bagMat = new THREE.MeshStandardMaterial({ color: bagColor, roughness: 0.2, transparent: true, opacity: 0.8, emissive: bagColor === 0xdde8f0 ? 0x000000 : 0x300004 });
    const bag = this.box(0.16, 0.26, 0.05, bagMat, 0.2, 1.68, 0, g);
    const tubeGeo = (x, y, z) => {
      // from the drip chamber under the bag, sagging, into the arm at (x, y, z)
      const sx = 0.2, sy = 1.55;
      const mx = sx + (x - sx) * 0.45, my = Math.min(y, sy) - 0.18 - Math.abs(x - sx) * 0.12;
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, sy, 0), new THREE.Vector3(sx + (x - sx) * 0.08, sy - 0.4, z * 0.4),
        new THREE.Vector3(mx, my, z * 0.8), new THREE.Vector3(x, y, z)]), 20, 0.006, 5);
    };
    const tube = new THREE.Mesh(tubeGeo(0.7, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ color: bagColor === 0xdde8f0 ? 0xe8eef2 : 0x7a0010, transparent: true, opacity: 0.8 }));
    g.add(tube);
    g.userData.bag = bag;
    g.userData.tube = tube;
    /** Re-route the tube to end at a point given in the stand's local space (null = back to the bed). */
    g.userData.aimTube = (x, y, z) => {
      const key = x == null ? 'home' : `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (tube.userData.key === key) return;
      tube.userData.key = key;
      tube.geometry.dispose();
      tube.geometry = x == null ? tubeGeo(0.7, 0.8, 0.05) : tubeGeo(x, y, z);
    };
    g.position.set(x, 0, z);
    this.root.add(g);
    return g;
  }

  /** Bedside patient monitor with a live ECG canvas. */
  monitor(x, y, z) {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.box(0.5, 0.36, 0.16, this.mat('monitorBody', { color: 0x2a2e32, roughness: 0.5 }), 0, 0, -0.06, g);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.28), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.z = 0.025;
    g.add(screen);
    const halo = glow(0x40ff90, 0.9, 0.22);
    halo.position.z = 0.1;
    g.add(halo);
    g.position.set(x, y, z);
    this.root.add(g);
    const mon = { canvas: c, ctx: c.getContext('2d'), tex, bpm: 72, t: 0, trace: new Float32Array(256), head: 0, flat: false, fault: false, off: false, halo, beat: 0 };
    this.monitors = this.monitors || [];
    this.monitors.push(mon);
    return mon;
  }

  updateMonitors(dt, onBeat) {
    for (const m of this.monitors || []) {
      m.t += dt;
      const period = m.bpm > 0 ? 60 / m.bpm : Infinity;
      m.beat += dt;
      let v = 0;
      if (!m.flat && m.beat >= period) { m.beat = 0; onBeat?.(m); }
      const ph = m.beat / Math.min(period, 1.2);
      if (!m.flat && m.bpm > 0) {
        if (ph < 0.06) v = Math.sin(ph / 0.06 * Math.PI) * 0.15;
        else if (ph > 0.12 && ph < 0.15) v = -0.2;
        else if (ph >= 0.15 && ph < 0.19) v = 1;
        else if (ph >= 0.19 && ph < 0.23) v = -0.35;
        else if (ph > 0.35 && ph < 0.5) v = Math.sin((ph - 0.35) / 0.15 * Math.PI) * 0.25;
      }
      const steps = Math.max(1, Math.round(dt * 110));
      for (let i = 0; i < steps; i++) { m.trace[m.head] = v; m.head = (m.head + 1) % m.trace.length; }
      if ((m.f = (m.f || 0) + 1) % 2) continue;
      const { ctx, canvas } = m;
      if (m.off) {
        // switched off for the night: a dead grey screen, no glow
        if (!m.offDrawn) {
          ctx.fillStyle = '#0a0c0c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(120,130,130,0.06)'; ctx.fillRect(8, 8, canvas.width - 16, 30);
          m.tex.needsUpdate = true; m.offDrawn = true;
          m.halo.visible = false;
        }
        continue;
      }
      if (m.offDrawn) { m.offDrawn = false; m.halo.visible = true; }
      ctx.fillStyle = '#031208'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(40,120,60,0.25)'; ctx.lineWidth = 1;
      for (let gx = 0; gx < canvas.width; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
      // fault: the leads are on but the machine reads nothing — amber, "no signal"
      const col = m.fault ? '#ffb040' : m.flat ? '#ff5050' : '#4dff8a';
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < m.trace.length; i++) {
        const idx = (m.head + i) % m.trace.length;
        const yy = 92 - m.trace[idx] * 52;
        i ? ctx.lineTo(i, yy) : ctx.moveTo(i, yy);
      }
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = 'bold 26px monospace';
      ctx.fillText(m.fault || m.flat || m.bpm <= 0 ? '---' : String(Math.round(m.bpm)), 180, 34);
      ctx.font = '12px monospace'; ctx.fillText('HR', 160, 18);
      if (m.fault && (m.t % 1.2) < 0.8) { ctx.font = 'bold 14px monospace'; ctx.fillText('NO SIGNAL', 12, 140); }
      m.tex.needsUpdate = true;
      m.halo.material.color.set(m.fault ? 0xffa030 : m.flat ? 0xff3030 : 0x40ff90);
    }
  }

  dust(box, count, color = 0xdfe8ff) {
    const d = new Dust(box, this.low ? Math.round(count / 2) : count, color, 0.03);
    d.material.opacity = 0.25;
    this.root.add(d.points);
    this.animated.push(d);
    return d;
  }

  pool(color, x, z, w, h, opacity) {
    const p = lightPool(color, w, h, opacity);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.012, z);
    this.root.add(p);
    return p;
  }

  setState(name) { this.state = name; }

  /** Builds the Narrative Safe Zones registry for this location (call after build()). */
  initSafeZones() {
    this.safeZones = new SafeZones(this.constructor.name);
    for (const g of this.foregroundGroups) this.safeZones.addForeground(g);
    return this.safeZones;
  }

  update(dt) {
    this.time += dt;
    for (const a of this.animated) a.update(dt, this.time);
  }
}

// ------------------------------------------------------------------ shared textures

export function tileTexture(kind = 'lino') {
  return canvasTexture(`tile-${kind}`, 256, 256, (ctx, w, h) => {
    const r = rng(kind.length * 13);
    if (kind === 'lino') {
      ctx.fillStyle = '#8a9290'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '40,50,50' : '210,220,215'},${0.12 + r() * 0.2})`; ctx.fillRect(r() * w, r() * h, 2, 2); }
      ctx.strokeStyle = 'rgba(30,40,40,0.35)'; ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (kind === 'checker') {
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3a4040' : '#b8bcb6';
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
      for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.12})`; ctx.fillRect(r() * w, r() * h, 3, 3); }
    } else if (kind === 'wall') {
      ctx.fillStyle = '#9aa69e'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2400; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '60,70,66' : '220,228,224'},${r() * 0.08})`; ctx.fillRect(r() * w, r() * h, 3, 3); }
    } else if (kind === 'wallLower') {
      ctx.fillStyle = '#4a5a58'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.1})`; ctx.fillRect(r() * w, r() * h, 3, 3); }
    } else if (kind === 'block') {
      ctx.fillStyle = '#a8aca4'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,64,60,0.5)'; ctx.lineWidth = 3;
      for (let y = 0; y < h; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        for (let x = (y / 32) % 2 ? 0 : 64; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 32); ctx.stroke(); }
      }
      for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.08})`; ctx.fillRect(r() * w, r() * h, 3, 3); }
    } else if (kind === 'ceiling') {
      ctx.fillStyle = '#c8ccc8'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(90,96,96,0.6)'; ctx.lineWidth = 3;
      for (let x = 0; x <= w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(w, x); ctx.stroke(); }
      for (let i = 0; i < 2000; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.1})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
    }
  }, { repeat: [1, 1] });
}

/** A tiled texture clone with its own repeat (shared canvas). */
export function tiled(tex, rx, ry) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return t;
}
