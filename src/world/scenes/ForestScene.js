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
      const x = 3 + i * 5 + Math.round(y * 0.28 + Math.sin(y * 0.3 + i) * 0.5);
      if (x > w - 3) continue;
      ctx.fillStyle = '#efe2c4'; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
      if (y % 7 === 0) { ctx.fillStyle = '#5a3a24'; ctx.fillRect(x + 3, y, 1, 2); }
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
const markerTex = (n) => PX(`marker${n}`, 24, 16, (ctx, w, h) => {
  ctx.fillStyle = '#e4b81c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b08a10'; ctx.fillRect(0, h - 2, w, 2);
  ctx.fillStyle = '#141210'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
    const water = Math.abs(y - h / 2 + Math.sin(x * 0.15) * 3) < 9;
    const n = (r() - 0.5) * 10;
    ctx.fillStyle = water ? rgb(78 + n, 96 + n, 112 + n) : rgb(186 + n, 198 + n, 208 + n);
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(230,240,248,0.6)'; ctx.fillRect(r() * w, r() * h, 3 + r() * 6, 1); }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(150,175,195,0.75)'; ctx.fillRect(r() * w, h / 2 - 7 + r() * 14, 2 + r() * 5, 1); } // ripples
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
    this.anchors.wolf = { x: 24.2, z: -12.6 };
    this.anchors.hide = { x: 17.5, z: -1.8 };
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

  paintSky(stops) {
    const ctx = this.skyCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    for (const [k, c] of stops) g.addColorStop(k, c);
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
    // tracks on the trail: boots (the investigators, weeks ago) and, closer to the site, paws
    const prints = [];
    for (let x = -12; x < 13; x += 0.36) prints.push([x, 0.15 + ((x * 2.78) % 2 > 1 ? 0.12 : -0.12), 0.11, 0.05]);
    for (let x = -4; x < 30; x += 0.55) prints.push([x + r() * 0.1, 1.05 + Math.sin(x) * 0.15, 0.07, 0.07]);
    const pim = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 7), this.mat('trailPrint', { color: 0x8a96a6, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }), prints.length);
    const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    prints.forEach(([x, z, sx, sz], i) => { m.compose(new THREE.Vector3(x, 0.012, z), qq, new THREE.Vector3(sx, sz * 2, 1)); pim.setMatrixAt(i, m); });
    this.root.add(pim);
  }

  buildRiver() {
    const rt = riverTex().clone(); rt.needsUpdate = true; rt.wrapS = THREE.RepeatWrapping; rt.repeat.set(54 / 2.56, 1);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(54, 5.6), this.mat('river', { map: rt, color: 0xffffff, roughness: 0.2, metalness: 0.25, emissive: 0x0a1018 }));
    river.rotation.x = -Math.PI / 2; river.position.set(8, 0.01, -8.6); this.root.add(river);
    this.riverMat = river.material;
    // banks: snowy lips either side
    const bank = this.mat('bank', { color: 0xc8d0d8, roughness: 1 });
    this.B(54, 0.18, 0.5, bank, 8, 0.02, -5.8);
    this.B(54, 0.3, 0.9, bank, 8, 0.05, -11.6);
    // reeds on the far bank, a pale strip of frozen grass
    const reed = this.mat('reed', { color: 0xa89068, roughness: 1 });
    const rr = rng(345);
    for (let i = 0; i < 160; i++) { const h = 0.3 + rr() * 0.5; const b = this.B(0.025, h, 0.025, reed, -18 + rr() * 52, h / 2, -11.2 - rr() * 0.8); b.rotation.z = (rr() - 0.5) * 0.5; }
    // far bank: rising ground
    const st = groundTex().clone(); st.needsUpdate = true; st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(90 / 2.56, 8 / 2.56);
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(90, 8), this.mat('farSlope', { map: st, color: 0xd8dde2, roughness: 1 }));
    slope.position.set(16, 1.0, -15.2); slope.rotation.x = -1.32; this.root.add(slope);
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
    const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 4.6, 7), trunk); tm.position.y = 2.3; g.add(tm);
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
      if (open(x) || x > 31) continue;
      const z = -3.9 - r() * 1.6;
      if (r() < 0.45) this.spruce(x, z, 0.75 + r() * 0.3); else this.bare(x, z, 0.95 + r() * 0.3, r() < 0.5 ? 1 : 2);
    }
    // second row, deeper and hazier
    for (let x = -16; x < 48; x += 1.6 + r() * 1.6) {
      if ((x > 18 && x < 29.5) || x > 31 || (open(x) && r() < 0.7)) continue;
      this.spruce(x, -6.6 - r() * 2.4 - (open(x) ? 3 : 0), 0.8 + r() * 0.45);
    }
    // the far bank: a dark wall of spruce, birches between
    for (let x = -20; x < 52; x += 0.8 + r() * 0.9) {
      if (r() < 0.8) this.spruce(x, (x > 19 && x < 28.5 ? -13.8 : -12.5) - r() * 4.5, 0.9 + r() * 0.6); else this.bare(x, -12.5 - r() * 3, 1.1, 2);
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
    const tape = this.tapeMat = this.mat('tape', { map: tapeTex(), color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x2a2400 });
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
      const geo = new THREE.PlaneGeometry(0.3, 0.22);
      const mm = this.mat(`marker${n}`, { map: markerTex(n), color: 0xffffff, roughness: 0.6, emissive: 0x1a1400 });
      const a = new THREE.Mesh(geo, mm); a.position.set(x - 0.05, 0.1, z); a.rotation.set(-0.25, 0.3, 0); root.add(a);
      const b = new THREE.Mesh(geo, mm); b.position.set(x + 0.05, 0.1, z - 0.04); b.rotation.set(0.25, 0.3, 0); root.add(b);
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
    this.bare(7.4, -3.0, 1.12, 1);
    const claws = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.95), this.mat('claws', { map: clawTex(), transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.9 }));
    claws.position.set(7.4, 2.05, -2.86); root.add(claws);
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
    // a snow-covered rock outcrop Julian crouches behind (only his head and shoulders show)
    const rk = this.mat('hideRock', { color: 0x5e5e64, roughness: 1, flatShading: true });
    const cap = this.mat('hideSnow', { color: 0x707a8a, roughness: 1, flatShading: true });
    for (const [x, y, z, sx, sy, sz, ry] of [[16.75, 0.34, -0.85, 0.85, 0.5, 0.65, 0.4], [17.75, 0.42, -0.8, 0.95, 0.62, 0.7, 1.1], [18.7, 0.3, -0.9, 0.8, 0.44, 0.62, 2.0], [17.3, 0.14, -0.45, 0.55, 0.24, 0.42, 0.7], [18.3, 0.12, -0.5, 0.48, 0.2, 0.4, 2.6]]) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rk); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.y = ry; this.root.add(b);
      const c = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), cap); c.position.set(x + 0.05, y + sy * 0.62, z); c.scale.set(sx * 0.82, sy * 0.3, sz * 0.75); c.rotation.y = ry + 0.3; this.root.add(c);
    }
    this.colliders.push({ x: 16.7, z: -0.75, r: 0.6 }, { x: 17.75, z: -0.7, r: 0.6 }, { x: 18.75, z: -0.8, r: 0.6 });
    this.hares = new THREE.Group();
    const hr = rng(370);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshLambertMaterial({ map: hareTex(i % 2), transparent: true, alphaTest: 0.5 }));
      m.position.set(21.6 + hr() * 2.6, 0.1, -11.7 - hr() * 0.5); m.scale.x = hr() < 0.5 ? -1 : 1;
      this.hares.add(m);
    }
    const blood = this.mat('freshBlood', { color: 0x6a0a0a, roughness: 0.6, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.2 + hr() * 0.3, 8), blood); s.rotation.x = -Math.PI / 2; s.position.set(21.6 + hr() * 3, 0.03, -11.6 - hr() * 0.6); this.hares.add(s); }
    this.root.add(this.hares);
  }

  // ---------------------------------------------------------------- the cave

  buildCave() {
    const rock = this.mat('rockF', { color: 0x8e8a84, roughness: 1, flatShading: true });
    const g = new THREE.Group();
    const r = rng(380);
    // the slope: big jumbled boulders rising to the right, a cliff behind
    const snowCap = this.mat('rockSnow', { color: 0xdfe6ee, roughness: 1, flatShading: true });
    const slab = (x, y, z, w, h, d, rx, ry, rz, m = rock) => { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), m); b.position.set(x, y, z); b.scale.set(w, h, d); b.rotation.set(rx, ry, rz); g.add(b); return b; };
    for (let i = 0; i < 16; i++) {
      const x = 31.5 + r() * 15, z = -4.6 - r() * 2.4;
      if (x > 40.2 && x < 44.2) continue; // keep the mouth clear
      const w = 0.8 + r() * 2.2, h = 0.4 + r() * 1.4 + (x - 31) * 0.05, d = 0.8 + r() * 1.2;
      slab(x, h * 0.45, z, w, h, d, (r() - 0.5) * 0.3, (r() - 0.5) * 0.8, (r() - 0.5) * 0.35);
      if (r() < 0.6) slab(x + (r() - 0.5) * 0.3, h * 0.92, z + 0.1, w * 0.8, 0.07, d * 0.7, 0, (r() - 0.5) * 0.5, 0, snowCap);
    }
    // the cliff: a dark faceted slope (big low-poly blocks), spruces on top
    const cliffMat = this.mat('cliffF', { color: 0x5e5c5c, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const rad = 2.6 + r() * 1.2;
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), cliffMat);
      b.position.set(34 + i * 1.9, rad * 0.55 + r() * 0.6, -5.9 - rad - r() * 0.8); b.rotation.set(r() * 3, r() * 3, r() * 3); g.add(b);
    }
    for (let i = 0; i < 6; i++) this.spruce(33.5 + i * 2.6 + r(), -8.6 - r(), 0.6 + r() * 0.3, g);
    // footprints in the snow, leading inside: bare feet, and paws
    const fp = this.mat('caveFp', { color: 0x5a6678, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false });
    for (let k = 0; k < 12; k++) { const t = k / 11, f = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), fp); f.rotation.x = -Math.PI / 2; f.scale.y = 1.8; f.position.set(39.6 + t * 2.6 + (k % 2) * 0.18, 0.02, -2.2 - t * 3.3); f.scale.y = 2.4; f.rotation.z = -0.65; g.add(f); }
    // the mouth: a pitch-black arch framed by two leaning slabs and a lintel, frost on the rim
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    mouth.scale.set(1, 1.6, 1); mouth.position.set(42.2, 0.0, -5.74); g.add(mouth);
    const jamb = this.mat('jambF', { color: 0x7a7670, roughness: 1, flatShading: true });
    const rockAt = (x, y, z, sx, sy, sz, rx, ry, rz) => { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), jamb); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.set(rx, ry, rz); g.add(b); };
    rockAt(40.45, 1.2, -5.5, 0.75, 1.5, 0.8, 0.2, 0.4, -0.15);
    rockAt(43.95, 1.1, -5.5, 0.85, 1.4, 0.8, -0.3, 0.9, 0.2);
    rockAt(41.6, 2.75, -5.45, 1.3, 0.55, 0.85, 0.4, 0.2, 0.18);
    rockAt(42.9, 2.7, -5.45, 1.25, 0.6, 0.85, -0.2, 0.7, -0.2);
    rockAt(42.2, 3.3, -5.6, 1.6, 0.5, 0.9, 0.1, 1.2, 0.05);
    // frost in patches on the rocks around the mouth
    const frost = this.mat('frostRim', { color: 0xc8d4e2, roughness: 1, flatShading: true });
    for (let k = 0; k < 7; k++) { const x = 41.1 + k * 0.36, L = 0.18 + ((k * 7) % 3) * 0.1; const ic = new THREE.Mesh(new THREE.ConeGeometry(0.05, L, 4), frost); ic.position.set(x, 2.32 - L / 2 + Math.abs(x - 42.2) * -0.25, -4.95); ic.rotation.x = Math.PI; g.add(ic); }
    // cold breath from the dark: faint mist at the mouth
    this.caveMist = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8a96a8, transparent: true, opacity: 0.18, depthWrite: false }));
    this.caveMist.scale.set(4, 2, 1); this.caveMist.position.set(42.2, 0.7, -5.0); g.add(this.caveMist);
    // a cold moonlit wash on the rock face, so the dark mouth reads against it
    this.caveLight = new THREE.PointLight(0x9ab0d8, 0, 12, 1.2);
    this.caveLight.position.set(41.6, 6.0, -2.6); g.add(this.caveLight);
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
    const dry = this.mat('dryGrassFg', { color: 0x9a8258, roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const x = -14 + r() * 62, z = 2.6 + r() * 0.5;
      for (let k = 0; k < 5; k++) { const h = 0.14 + r() * 0.22; const b = this.B(0.018, h, 0.018, dry, x + (r() - 0.5) * 0.18, h / 2, z, brush); b.rotation.z = (r() - 0.5) * 0.8; }
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
    // dusk: the last warm light low behind the far bank — a rim on the wolf and on Julian
    const rim = new THREE.DirectionalLight(0xd89a6a, 0);
    rim.position.set(30, 3, -30);
    this.root.add(hemi, sun, key, rim);
    this.lights = { hemi, sun, key, rim };
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
    L.rim.intensity = night ? 2.6 : 0;
    if (this.caveLight) this.caveLight.intensity = night ? 11 : 3;
    this.background = night ? 0x1a2232 : 0xa8b2bc;
    if (night) this.paintSky([[0, '#0c1222'], [0.45, '#22304e'], [0.6, '#46507a'], [0.68, '#7a6278'], [0.74, '#b07c5e'], [0.8, '#8a6258'], [1, '#3a3446']]);
    else this.paintSky([[0, '#7a8696'], [0.55, '#aab4c0'], [1, '#cdd2d8']]);
    if (this.tapeMat) this.tapeMat.emissive.set(night ? 0x6a5600 : 0x2a2400);
    if (this.riverMat) this.riverMat.emissive.set(night ? 0x1a2638 : 0x0a1018);
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
