import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { Snow } from '../Particles.js';
import { mountainTex } from './PoliceCarScene.js';

/**
 * The Takhini river valley, 40 km north of Whitehorse: where Lizzie vanished and the
 * carcasses were found. Late autumn, the first thin snow. Side-on like every location.
 *   x -14 … -6   trailhead: a pull-off, the trail sign
 *   x  -5 … 11   the cordoned site: police tape, evidence markers, the clawed aspen,
 *                marker 11 (Lizzie's phone); the river behind (z −6 … −9)
 *   x  12 … 30   deeper forest, a clearing above the river (the wolf, at dusk)
 *   x  31 … 46   rock slope and the cave mouth (x ≈ 42)
 * States: 'day' (overcast, the walk ends past the tape) / 'night' (blue dusk, whole valley).
 */

const PX = (key, w, h, draw) => canvasTexture(`forest-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;

/** Smooth value noise on a wrapping grid (for tileable textures). */
function vnoise(r, n) {
  const g = Array.from({ length: n * n }, () => r());
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Forest floor: thin first snow, broken by patches of dead grass, needles and earth. */
const groundTex = () => PX('ground', 128, 128, (ctx, w, h) => {
  const r = rng(301);
  const n1 = vnoise(r, 8), n2 = vnoise(r, 16), n3 = vnoise(r, 32);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = n1(x / 16, y / 16) * 0.55 + n2(x / 8, y / 8) * 0.3 + n3(x / 4, y / 4) * 0.15;
    const d = (r() - 0.5) * 8;
    if (v > 0.6) {            // bare: dead grass / earth
      const k = (v - 0.6) * 2.5;
      ctx.fillStyle = rgb(128 - k * 30 + d, 112 - k * 28 + d, 84 - k * 22 + d);
    } else if (v > 0.53) {    // slush edge
      ctx.fillStyle = rgb(176 + d, 178 + d, 176 + d);
    } else {                  // snow, slightly blue in the hollows
      const k = v / 0.53;
      ctx.fillStyle = rgb(206 + k * 18 + d, 214 + k * 14 + d, 226 + k * 8 + d);
    }
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 70; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(84,72,54,0.45)' : 'rgba(150,132,90,0.5)'; ctx.fillRect(r() * w, r() * h, 1, 1 + (r() < 0.4 ? 1 : 0)); }
  const leaf = ['#b88a2a', '#a8582a', '#8a3a1c'];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = leaf[i % 3]; ctx.fillRect(r() * w, r() * h, 1, 1); }
});

/** The trodden path: packed snow, boot prints, a tyre rut at the trailhead. */
const pathTex = () => PX('path', 64, 32, (ctx, w, h) => {
  const r = rng(302);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 12; ctx.fillStyle = rgb(176 + n, 180 + n, 186 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h; ctx.fillStyle = 'rgba(110,104,96,0.55)'; ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 1, y + 2, 2, 1); }
  for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(96,84,66,0.5)'; ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 1); }
});

/** Spruce bark, aspen bark (pale with dark eyes), birch bark. */
const barkTex = (kind) => PX(`bark${kind}`, 16, 64, (ctx, w, h) => {
  const r = rng(310 + kind);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (r() - 0.5) * 14 + Math.sin(x * 1.3) * 6;
    ctx.fillStyle = kind === 0 ? rgb(70 + n, 54 + n, 42 + n) : kind === 1 ? rgb(184 + n, 186 + n, 170 + n) : rgb(222 + n * 0.5, 220 + n * 0.5, 210 + n * 0.5);
    ctx.fillRect(x, y, 1, 1);
  }
  if (kind) for (let i = 0; i < 14; i++) { ctx.fillStyle = kind === 1 ? 'rgba(40,40,36,0.75)' : 'rgba(30,28,26,0.85)'; ctx.fillRect(r() * w, r() * h, 2 + r() * (kind === 2 ? 6 : 3), 1 + (r() < 0.3 ? 1 : 0)); }
});

/** Four claw grooves, 2.1 m up the aspen: torn bark, pale wood underneath. */
const clawTex = () => PX('claws', 32, 48, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    for (let y = 2; y < h - 2; y++) {
      const x = 6 + i * 6 + Math.round(y * 0.08 + Math.sin(y * 0.3 + i) * 0.6);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = '#3a2618'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
    }
  }
});

/** A far wall of spruce: jagged tips, solid (tinted by the material for day / dusk). */
const ridgeTex = (seed) => PX(`ridge${seed}`, 512, 48, (ctx, w, h) => {
  const r = rng(500 + seed);
  ctx.clearRect(0, 0, w, h);
  const base = new Array(w).fill(0).map((_, x) => Math.round(h * 0.62 + Math.sin(x / w * Math.PI * 6 + seed) * 3 + Math.sin(x / w * Math.PI * 22) * 1.5));
  for (let x = 0; x < w; x++) { ctx.fillStyle = '#fff'; ctx.fillRect(x, base[x], 1, h - base[x]); }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(r() * w), H = 8 + Math.floor(r() * 16), b = base[x] + 2;
    for (let y = 0; y < H; y++) {
      const half = Math.floor((y / H) * 6.5) + (y % 3 === 0 ? 1 : 0);
      ctx.fillStyle = (y % 3 === 0 && r() < 0.5) ? '#dde' : '#fff';
      ctx.fillRect((x - half + w) % w, b - H + y, half * 2 + 1, 1);
    }
  }
});

/** Police tape: yellow, black lettering in pixels. */
const tapeTex = () => PX('tape', 128, 8, (ctx, w, h) => {
  ctx.fillStyle = '#e8c41c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1814';
  for (let x = 2; x < w; x += 4) { if ((x / 4) % 9 > 6) continue; ctx.fillRect(x, 2, 2, 4); if ((x / 4) % 3 === 0) ctx.fillRect(x + 2, 2, 1, 1); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 7, w, 1);
});

/** Yellow evidence tent with a black number. */
const markerTex = (n) => PX(`marker${n}`, 16, 12, (ctx, w, h) => {
  ctx.fillStyle = '#e4b81c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b08a10'; ctx.fillRect(0, h - 2, w, 2);
  ctx.fillStyle = '#141210'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), w / 2, h / 2);
});

/** Rock: grey-brown, lichen, frost in the cracks. */
const rockTex = () => PX('rock', 64, 64, (ctx, w, h) => {
  const r = rng(320);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 18 + Math.sin(x * 0.2 + y * 0.35) * 8; ctx.fillStyle = rgb(138 + n, 132 + n, 122 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 18; i++) { const x = r() * w, y = r() * h, L = 6 + r() * 14; ctx.fillStyle = 'rgba(30,28,26,0.6)'; for (let k = 0; k < L; k++) ctx.fillRect(x + k * 0.7, y + Math.sin(k) * 1.5, 1, 1); }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(150,160,110,0.45)' : 'rgba(220,226,232,0.6)'; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2); }
});

/** River ice and black water. */
const riverTex = () => PX('river', 64, 32, (ctx, w, h) => {
  const r = rng(330);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const water = Math.abs(y - h / 2 + Math.sin(x * 0.15) * 3) < 6;
    const n = (r() - 0.5) * 10;
    ctx.fillStyle = water ? rgb(34 + n, 44 + n, 52 + n) : rgb(176 + n, 190 + n, 200 + n);
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(230,240,248,0.6)'; ctx.fillRect(r() * w, r() * h, 3 + r() * 6, 1); }
});

/** A dead hare (small pixel sprite), torn open. */
const hareTex = (kind) => PX(`hare${kind}`, 24, 12, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const fur = kind ? '#8a7a64' : '#d8d6d0', dark = kind ? '#5a4a3a' : '#9a9690';
  ctx.fillStyle = fur; ctx.fillRect(4, 6, 13, 4); ctx.fillRect(15, 4, 5, 4); ctx.fillRect(18, 1, 2, 4); ctx.fillRect(20, 2, 1, 3);
  ctx.fillStyle = dark; ctx.fillRect(4, 9, 13, 1); ctx.fillRect(2, 8, 3, 2);
  ctx.fillStyle = '#6a1210'; ctx.fillRect(7, 7, 6, 2); ctx.fillStyle = '#9a1c16'; ctx.fillRect(9, 7, 2, 1);
  ctx.fillStyle = '#1a1010'; ctx.fillRect(18, 5, 1, 1);
});

export class ForestScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'forest';
    this.title = 'Долина Такхини';
    this.background = 0xa8b2bc;
    this.camera = { distance: 8.6, height: 2.2, lookHeight: 1.35, lookZ: -0.9 };
    this.areasDay = [{ minX: -12, maxX: 12.5, minZ: -2.3, maxZ: 1.5 }];
    this.areasNight = [{ minX: -12, maxX: 43.2, minZ: -2.3, maxZ: 1.5 }];
    this.bounds = { walk: { areas: this.areasDay }, camera: { minX: -8, maxX: 9 } };
    this.dayNight = [];
  }

  B(w, h, d, mat, x, y, z, parent = this.root) { return this.box(w, h, d, mat, x, y, z, parent); }

  build() {
    this.buildBackdrop();
    this.buildGround();
    this.buildRiver();
    this.buildTrees();
    this.buildSite();
    this.buildClearing();
    this.buildCave();
    this.buildForeground();
    this.buildAtmosphere();
    this.anchors.start = { x: -10.5, z: 0.2 };
    this.anchors.siteIn = { x: -3.0, z: 0.0 };
    this.anchors.wolf = { x: 23.5, z: -8.4 };
    this.anchors.hide = { x: 17.2, z: 0.6 };
    this.anchors.cave = { x: 42.2, z: -2.6 };
    this.shots = {
      forest: { pos: [3, 2.2, 7.2], look: [3, 1.4, -2], fov: 36 },
    };
    this.setState('day');
    return this.root;
  }

  // ---------------------------------------------------------------- backdrop

  buildBackdrop() {
    const root = this.root;
    const skyC = document.createElement('canvas');
    skyC.width = 8; skyC.height = 128;
    this.skyCanvas = skyC;
    this.skyTexture = new THREE.CanvasTexture(skyC);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 80), new THREE.MeshBasicMaterial({ map: this.skyTexture, depthWrite: false }));
    sky.position.set(16, 20, -100); root.add(sky);
    const layer = (tex, w, h, x, y, z, rep) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); t.wrapS = THREE.RepeatWrapping;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5 }));
      m.position.set(x, y, z); root.add(m); return m;
    };
    this.mtn = layer(mountainTex(), 220, 34, 16, 12, -88, 2);
    this.far = layer(ridgeTex(1), 180, 12, 16, 4.6, -46, 3);
    this.far2 = layer(ridgeTex(2), 130, 8, 16, 2.9, -26, 4);
    const hz = (y, z, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(240, 16), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xdfe6ee, transparent: true, opacity: op, depthWrite: false }));
      m.position.set(16, y, z); root.add(m); return m;
    };
    this.hazes = [hz(4, -34, 0.4), hz(2.5, -19, 0.3), hz(1.6, -12, 0.18)];
    // moon (dusk only)
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0xf2f0e4, transparent: true, depthWrite: false }));
    this.moon.position.set(30, 22, -95); root.add(this.moon);
    this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xb8c8e0, transparent: true, opacity: 0.5, depthWrite: false }));
    this.moonGlow.scale.set(22, 22, 1); this.moonGlow.position.set(30, 22, -96); root.add(this.moonGlow);
  }

  paintSky(top, mid, low) {
    const ctx = this.skyCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128);
    this.skyTexture.needsUpdate = true;
  }

  // ---------------------------------------------------------------- ground

  buildGround() {
    const gt = groundTex().clone(); gt.needsUpdate = true; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(90 / 2.56, 40 / 2.56);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), this.mat('forestGround', { map: gt, color: 0xffffff, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(16, 0, -10); this.root.add(ground);
    // the trail: a packed strip along the walk lane
    const pt = pathTex().clone(); pt.needsUpdate = true; pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(60 / 1.28, 1);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.5), this.mat('forestPath', { map: pt, color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.85 }));
    path.rotation.x = -Math.PI / 2; path.position.set(16, 0.008, 0.2); this.root.add(path);
    // low snow mounds and dead grass tufts along the path edges
    const r = rng(340);
    const lumpGeo = new THREE.IcosahedronGeometry(1, 1);
    const lumps = [];
    for (let x = -14; x < 46; x += 0.8) {
      lumps.push([x + r() * 0.5, 0, -2.75 - r() * 0.4, 0.5 + r() * 0.5, 0.08 + r() * 0.08, 0.35]);
      if (r() < 0.6) lumps.push([x + r() * 0.5, 0, 1.95 + r() * 0.3, 0.45 + r() * 0.4, 0.07 + r() * 0.07, 0.3]);
    }
    const im = new THREE.InstancedMesh(lumpGeo, this.mat('forestLump', { color: 0xd2d8de, roughness: 1, flatShading: true }), lumps.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    lumps.forEach(([x, y, z, sx, sy, sz], i) => { m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m); });
    this.root.add(im);
    const grass = this.mat('deadGrass', { color: 0x8a7650, roughness: 1, side: THREE.DoubleSide });
    const tuftGeo = new THREE.PlaneGeometry(0.04, 0.32);
    const tufts = [];
    for (let i = 0; i < 150; i++) {
      const x = -14 + r() * 60, z = r() < 0.7 ? -2.5 - r() * 3 : 1.75 + r() * 0.5;
      for (let k = 0; k < 4; k++) tufts.push([x + (r() - 0.5) * 0.2, z + (r() - 0.5) * 0.2, (r() - 0.5) * 0.7, 0.6 + r() * 0.7]);
    }
    const tim = new THREE.InstancedMesh(tuftGeo, grass, tufts.length);
    const e = new THREE.Euler();
    tufts.forEach(([x, z, lean, s], i) => { q.setFromEuler(e.set(0, r() * 3, lean)); m.compose(new THREE.Vector3(x, 0.14 * s, z), q, new THREE.Vector3(1, s, 1)); tim.setMatrixAt(i, m); });
    this.root.add(tim);
  }

  buildRiver() {
    const rt = riverTex().clone(); rt.needsUpdate = true; rt.wrapS = THREE.RepeatWrapping; rt.repeat.set(70 / 2.56, 1);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(70, 4.2), this.mat('river', { map: rt, color: 0xffffff, roughness: 0.25, metalness: 0.2 }));
    river.rotation.x = -Math.PI / 2; river.position.set(16, 0.01, -7.6); this.root.add(river);
    // banks: snowy lips either side
    const bank = this.mat('bank', { color: 0xc8d0d8, roughness: 1 });
    this.B(70, 0.18, 0.5, bank, 16, 0.02, -5.8);
    this.B(70, 0.3, 0.7, bank, 16, 0.05, -9.5);
    // far bank: rising ground
    const st = groundTex().clone(); st.needsUpdate = true; st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(90 / 2.56, 8 / 2.56);
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(90, 8), this.mat('farSlope', { map: st, color: 0xd8dde2, roughness: 1 }));
    slope.position.set(16, 1.0, -13.6); slope.rotation.x = -1.32; this.root.add(slope);
  }

  // ---------------------------------------------------------------- trees

  spruce(x, z, s, parent = this.root) {
    const g = new THREE.Group();
    const needles = this.mat('spruceF', { color: 0x223228, roughness: 0.95, flatShading: true });
    const frost = this.mat('spruceFrost', { color: 0xb8c4cc, roughness: 1, flatShading: true });
    const trunk = this.mat('spruceTrunk', { map: barkTex(0), color: 0xffffff, roughness: 1 });
    this.B(0.18, 1.0, 0.18, trunk, 0, 0.5, 0, g);
    const tiers = 8;
    for (let k = 0; k < tiers; k++) {
      const rr = 0.95 - k * 0.105, y = 0.9 + k * 0.62;
      const c = new THREE.Mesh(new THREE.ConeGeometry(rr, 1.05, 7), needles); c.position.y = y; c.rotation.y = k * 0.9; g.add(c);
      if (k % 2 === 0) { const f = new THREE.Mesh(new THREE.ConeGeometry(rr * 0.7, 0.12, 7), frost); f.position.y = y + 0.32; f.rotation.y = k * 0.9; g.add(f); }
    }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 5), needles); tip.position.y = 0.9 + tiers * 0.62; g.add(tip);
    g.position.set(x, 0, z); g.scale.setScalar(s);
    parent.add(g);
    return g;
  }

  /** Bare aspen / birch: pale trunk, a few twigs, last leaves. */
  bare(x, z, s, kind = 1, parent = this.root) {
    const g = new THREE.Group();
    const trunk = this.mat(`bareTrunk${kind}`, { map: barkTex(kind), color: 0xffffff, roughness: 0.9 });
    const twig = this.mat('twigF', { color: 0x3e342c, roughness: 1 });
    this.B(0.16, 4.6, 0.16, trunk, 0, 2.3, 0, g);
    const r = rng(Math.round(x * 13 + z * 7 + 400));
    for (let k = 0; k < 7; k++) {
      const y = 2.4 + k * 0.32, side = k % 2 ? 1 : -1, L = 1.0 - k * 0.09;
      const b = this.B(0.04, L, 0.04, twig, side * L * 0.3, y + L * 0.35, (r() - 0.5) * 0.4, g);
      b.rotation.z = -side * (0.6 + r() * 0.3);
    }
    g.position.set(x, 0, z); g.scale.setScalar(s);
    parent.add(g);
    return g;
  }

  buildTrees() {
    const r = rng(350);
    const open = (x) => (x > -3.5 && x < 10.5) || (x > 19 && x < 28.5); // the site, the clearing: river in view
    // first row behind the lane: sparse, pale trunks and a few spruces
    for (let x = -16; x < 48; x += 2.4 + r() * 2.2) {
      if (open(x)) continue;
      const z = -3.9 - r() * 1.6;
      if (r() < 0.45) this.spruce(x, z, 0.75 + r() * 0.3); else this.bare(x, z, 0.95 + r() * 0.3, r() < 0.5 ? 1 : 2);
    }
    // second row, deeper and hazier
    for (let x = -16; x < 48; x += 1.6 + r() * 1.6) {
      if (open(x) && r() < 0.7) continue;
      this.spruce(x, -6.6 - r() * 2.4 - (open(x) ? 3 : 0), 0.8 + r() * 0.45);
    }
    // the far bank: a dark wall of spruce, birches between
    for (let x = -20; x < 52; x += 0.8 + r() * 0.9) {
      if (r() < 0.8) this.spruce(x, -12.5 - r() * 4.5, 0.9 + r() * 0.6); else this.bare(x, -12.5 - r() * 3, 1.1, 2);
    }
  }

  // ---------------------------------------------------------------- the cordoned site

  buildSite() {
    const root = this.root;
    // trailhead sign
    const wood = this.mat('signWood', { color: 0x5a4430, roughness: 0.9 });
    this.B(0.1, 1.5, 0.1, wood, -9.0, 0.75, -2.6); this.B(0.1, 1.5, 0.1, wood, -7.8, 0.75, -2.6);
    const sign = this.textSign('TAKHINI RIVER TRAIL', { w: 1.5, h: 0.42, bg: '#4a3626', fg: '#e8dcc0', font: 'bold 30px serif' });
    sign.position.set(-8.4, 1.3, -2.55); root.add(sign);
    // stakes + tape around the site (x −4 … 10.5, z −5.6 … −2.5), a loose end on the path
    const stake = this.mat('stake', { color: 0x6a5a44, roughness: 0.9 });
    const tape = this.mat('tape', { map: tapeTex(), color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x2a2400 });
    const posts = [[-4.2, -2.6], [-1.0, -2.65], [2.5, -2.55], [6.0, -2.7], [10.4, -2.6], [10.6, -5.4], [-4.4, -5.3]];
    for (const [x, z] of posts) this.B(0.06, 1.0, 0.06, stake, x, 0.5, z);
    const span = (a, b, y = 0.88, sag = 0.12) => {
      const [x1, z1] = a, [x2, z2] = b, L = Math.hypot(x2 - x1, z2 - z1);
      const geo = new THREE.PlaneGeometry(L, 0.07, 16, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = p.getX(i) / L + 0.5; p.setY(i, p.getY(i) - Math.sin(t * Math.PI) * sag); }
      const m = new THREE.Mesh(geo, tape);
      m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      root.add(m);
      return m;
    };
    for (let i = 0; i < posts.length - 1; i++) span(posts[i], posts[i + 1]);
    span(posts[posts.length - 1], posts[0]);
    // the front run is torn: one end hangs down onto the snow
    const loose = span([-4.2, -2.6], [-5.3, -1.6], 0.5, 0.35); loose.rotation.z = -0.5;
    // evidence markers
    const tents = [[1, -0.9, -3.6], [4, 1.6, -4.4], [7, 4.4, -3.4], [11, 3.0, -2.95], [14, 6.6, -4.8], [19, 8.4, -3.9], [23, -2.2, -4.6]];
    for (const [n, x, z] of tents) {
      const geo = new THREE.PlaneGeometry(0.16, 0.12);
      const mm = this.mat(`marker${n}`, { map: markerTex(n), color: 0xffffff, roughness: 0.6, emissive: 0x1a1400 });
      const a = new THREE.Mesh(geo, mm); a.position.set(x - 0.04, 0.06, z); a.rotation.set(-0.45, 0.3, 0); root.add(a);
      const b = new THREE.Mesh(geo, mm); b.position.set(x + 0.04, 0.06, z - 0.03); b.rotation.set(0.45, 0.3, 0); root.add(b);
    }
    this.anchors.marker11 = new THREE.Vector3(3.0, 0.25, -2.95);
    // old dark stains under the snow, a few bones
    const stain = this.mat('stain', { color: 0x4a1a14, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const sr = rng(360);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.3 + sr() * 0.5, 9), stain);
      s.rotation.x = -Math.PI / 2; s.position.set(-3 + sr() * 12, 0.012, -3.2 - sr() * 2.4); s.scale.set(1 + sr(), 0.5 + sr() * 0.5, 1); root.add(s);
    }
    const bone = this.mat('bone', { color: 0xd8d0c0, roughness: 0.8 });
    for (let i = 0; i < 6; i++) { const b = this.B(0.5 + sr() * 0.4, 0.05, 0.05, bone, -1 + sr() * 9, 0.03, -3.4 - sr() * 1.8); b.rotation.y = sr() * 3; }
    // a ribcage, half under snow
    for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 4, 10, Math.PI), bone); rib.position.set(5.2 + k * 0.1, 0.02, -4.2); rib.rotation.set(0, Math.PI / 2, 0); root.add(rib); }
    // the clawed aspen: thicker, right by the tape
    const aspen = this.mat('aspenBig', { map: barkTex(1), color: 0xffffff, roughness: 0.9 });
    this.B(0.34, 6.0, 0.34, aspen, 7.4, 3.0, -3.0);
    const claws = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.48), this.mat('claws', { map: clawTex(), transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.9 }));
    claws.position.set(7.4, 2.1, -2.82); root.add(claws);
    this.anchors.claws = new THREE.Vector3(7.4, 2.2, -2.8);
    // a weathered "MISSING" flyer stapled to a spruce at the trailhead
    const flyer = this.textSign('ПРОПАЛА', { w: 0.32, h: 0.42, bg: '#e8e2d4', fg: '#1a1a1a', font: 'bold 34px sans-serif' });
    flyer.position.set(-6.2, 1.55, -3.5); root.add(flyer);
    this.spruce(-6.2, -3.75, 1.05);
    this.anchors.flyer = new THREE.Vector3(-6.2, 1.6, -3.4);
    this.anchors.river = new THREE.Vector3(2.0, 0.6, -6.0);
    this.anchors.tape = new THREE.Vector3(-4.6, 1.0, -2.2);
  }

  // ---------------------------------------------------------------- the clearing (dusk)

  buildClearing() {
    // a fallen spruce Julian can crouch behind, small dead animals in the clearing
    const trunk = this.mat('fallen', { map: barkTex(0), color: 0xffffff, roughness: 1 });
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.2, 8), trunk);
    log.rotation.z = Math.PI / 2; log.rotation.y = 0.15; log.position.set(17.8, 0.22, -0.7); this.root.add(log);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.06, 0.26), this.mat('logSnow', { color: 0xdfe6ee, roughness: 1 }));
    cap.rotation.y = 0.15; cap.position.set(17.8, 0.47, -0.7); this.root.add(cap);
    for (const [dx, a] of [[-1.2, 0.6], [0.4, -0.5], [1.5, 0.9]]) { const br = this.B(0.05, 0.7, 0.05, this.mat('twigF', { color: 0x3e342c, roughness: 1 }), 17.8 + dx, 0.6, -0.6); br.rotation.z = a; }
    this.colliders.push({ x: 17.0, z: -0.8, r: 0.35 }, { x: 18.6, z: -0.9, r: 0.35 });
    this.hares = new THREE.Group();
    const hr = rng(370);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshLambertMaterial({ map: hareTex(i % 2), transparent: true, alphaTest: 0.5 }));
      m.position.set(22.4 + hr() * 2.6, 0.1, -7.9 - hr() * 0.8); m.scale.x = hr() < 0.5 ? -1 : 1;
      this.hares.add(m);
    }
    const blood = this.mat('freshBlood', { color: 0x6a0a0a, roughness: 0.6, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.2 + hr() * 0.3, 8), blood); s.rotation.x = -Math.PI / 2; s.position.set(22.4 + hr() * 3, 0.03, -7.8 - hr()); this.hares.add(s); }
    this.root.add(this.hares);
  }

  // ---------------------------------------------------------------- the cave

  buildCave() {
    const rock = this.mat('rockF', { map: rockTex(), color: 0xffffff, roughness: 1, flatShading: true });
    const g = new THREE.Group();
    const r = rng(380);
    // the slope: big jumbled boulders rising to the right, a cliff behind
    const snowCap = this.mat('rockSnow', { color: 0xdfe6ee, roughness: 1, flatShading: true });
    for (let i = 0; i < 22; i++) {
      const x = 31 + r() * 16, z = -4.4 - r() * 2.6, s = 0.45 + r() * 0.9 + (x - 31) * 0.05;
      if (x > 40.4 && x < 44.0) continue; // keep the mouth clear
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock);
      b.position.set(x, s * 0.4, z); b.rotation.set(r() * 3, r() * 3, r() * 3); b.scale.y = 0.65 + r() * 0.4; g.add(b);
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.72, 0), snowCap);
      c.position.set(x, s * 0.4 + s * 0.42, z + 0.05); c.scale.set(1, 0.28, 1); c.rotation.y = r() * 3; g.add(c);
    }
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 2), rock);
    cliff.position.set(42, 4.5, -6.8); g.add(cliff);
    // snow ledges on the cliff, a spruce growing out of it
    for (const [x, y, w] of [[36, 3.2, 3], [39.5, 5.6, 2.2], [46, 4.4, 3.4], [42.2, 3.65, 4.6]]) this.B(w, 0.12, 0.5, snowCap, x, y, -5.7, g);
    this.spruce(35.2, -6.2, 0.7, g); this.spruce(47.0, -6.0, 0.8, g);
    // the mouth: a black arch with a lintel of rock
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.5, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    mouth.scale.set(1, 1.55, 1); mouth.position.set(42.2, 0.0, -5.78); g.add(mouth);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshBasicMaterial({ color: 0x050506 }));
    inner.position.set(42.2, 1.0, -5.79); inner.visible = false; g.add(inner);
    for (const [dx, s] of [[-1.9, 1.1], [1.9, 1.2], [-1.2, 0.8], [1.3, 0.9]]) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock); b.position.set(42.2 + dx, s * 0.5 + (Math.abs(dx) < 1.5 ? 2.1 : 0), -5.2); g.add(b);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 1.6), rock); lintel.position.set(42.2, 2.9, -5.4); lintel.rotation.z = 0.06; g.add(lintel);
    // cold breath from the dark: faint mist at the mouth
    this.caveMist = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8a96a8, transparent: true, opacity: 0.18, depthWrite: false }));
    this.caveMist.scale.set(4, 2, 1); this.caveMist.position.set(42.2, 0.7, -5.0); g.add(this.caveMist);
    // a cold moonlit wash on the rock face, so the dark mouth reads against it
    this.caveLight = new THREE.PointLight(0x9ab0d8, 0, 12, 1.2);
    this.caveLight.position.set(40.5, 4.5, -1.5); g.add(this.caveLight);
    // trampled snow at the threshold
    const sill = new THREE.Mesh(new THREE.CircleGeometry(1.6, 12), snowCap); sill.rotation.x = -Math.PI / 2; sill.scale.set(1.3, 0.8, 1); sill.position.set(42.2, 0.015, -4.4); g.add(sill);
    // the path climbs to the mouth: walkable strip
    this.root.add(g);
    this.anchors.caveMouth = new THREE.Vector3(42.2, 1.8, -5.0);
  }

  // ---------------------------------------------------------------- foreground

  buildForeground() {
    const fgGroup = (name) => { const g = new THREE.Group(); g.name = name; this.root.add(g); this.foregroundGroups.push(g); return g; };
    const r = rng(390);
    for (const x of [-12.6, -5.2, 9.6, 14.6, 21.2, 30.4, 35.8, 45.5]) {
      const g = fgGroup(`fg-birch-${x}`);
      this.bare(x + r() * 0.4, 3.4 + r() * 0.5, 1.2, 2, g);
    }
    const brush = fgGroup('fg-brush');
    const twig = this.mat('twigF', { color: 0x3e342c, roughness: 1 });
    for (let i = 0; i < 26; i++) {
      const x = -14 + r() * 62, z = 2.6 + r() * 0.5, h = 0.25 + r() * 0.4;
      const b = this.B(0.02, h, 0.02, twig, x, h / 2, z, brush); b.rotation.z = (r() - 0.5) * 0.9;
    }
  }

  // ---------------------------------------------------------------- light

  buildAtmosphere() {
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-14, 0, -6), new THREE.Vector3(46, 7, 4)), this.low ? 160 : 380);
    this.snow.speed = 0.5;
    this.root.add(this.snow.points);
    this.animated.push(this.snow);
    const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x6a7078, 1.5);
    const sun = new THREE.DirectionalLight(0xf0ece4, 0.9);
    sun.position.set(-8, 10, 6);
    // a cold key that stays with Julian at dusk (he must stay readable)
    const key = new THREE.PointLight(0x9ab0d8, 0, 7, 1.4);
    this.root.add(hemi, sun, key);
    this.lights = { hemi, sun, key };
  }

  setState(name) {
    this.state = name;
    const night = name === 'night';
    this.bounds.walk.areas = night ? this.areasNight : this.areasDay;
    this.bounds.camera = night ? { minX: -8, maxX: 40 } : { minX: -8, maxX: 9 };
    const L = this.lights;
    L.hemi.color.set(night ? 0x5a6a8a : 0xdfe6ee); L.hemi.groundColor.set(night ? 0x1a1e28 : 0x6a7078);
    L.hemi.intensity = night ? 0.85 : 1.5;
    L.sun.color.set(night ? 0x8aa4d4 : 0xf0ece4); L.sun.intensity = night ? 0.7 : 0.9;
    L.sun.position.set(night ? 14 : -8, 10, night ? -4 : 6);
    L.key.intensity = night ? 3.2 : 0;
    if (this.caveLight) this.caveLight.intensity = night ? 14 : 4;
    this.background = night ? 0x1a2232 : 0xa8b2bc;
    if (night) this.paintSky('#0e1424', '#2a3654', '#5a6a8a'); else this.paintSky('#7a8696', '#aab4c0', '#cdd2d8');
    this.mtn.material.color.set(night ? 0x5a6884 : 0xd8e0ea);
    this.far.material.color.set(night ? 0x283246 : 0x8e9aa4);
    this.far2.material.color.set(night ? 0x1c2432 : 0x6a7680);
    this.hazes.forEach((h, i) => { h.material.color.set(night ? 0x3a4a68 : 0xdfe6ee); h.material.opacity = (night ? [0.35, 0.25, 0.16] : [0.4, 0.3, 0.18])[i]; });
    this.moon.visible = this.moonGlow.visible = night;
    this.hares.visible = night;
    this.caveMist.material.color.set(night ? 0x6a7a98 : 0x8a96a8);
  }

  update(dt) {
    super.update(dt);
    if (this.lights.key.intensity > 0 && this.followTarget) {
      const p = this.followTarget().position;
      this.lights.key.position.set(p.x + 0.8, 2.4, p.z + 2.0);
    }
    if (this.caveMist) this.caveMist.material.opacity = 0.14 + Math.sin(this.time * 0.7) * 0.05;
  }
}
