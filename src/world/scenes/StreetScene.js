import * as THREE from 'three';
import { spruceStand, bareTree } from '../nature.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow, lightPool } from '../props.js';
import { Snow } from '../Particles.js';
import { skyTex, mountainTex, treeTex, townTex, roadTex } from './PoliceCarScene.js';

/**
 * Outside Whitehorse General: the hospital's main entrance on a grey winter
 * late-October day with the first thin snow. Side-on, like every other location.
 *   x -20 … -9.5  neighbouring lot: houses, spruce, a power pole, the hills
 *   x  -9 …  4.5  main block (2 storeys): canopy, sliding doors, lit lobby
 *   x  4.5 … 22   one-storey wing: ramp to a staff door, bike rack, ER bay
 * Depth: facade z = -3, sidewalk/plaza to z = 2.6 (curb), road beyond.
 * Foreground (z ≈ 2.1 … 4): curb snowbank, fence, lamp posts, parked cars.
 */

const FZ = -3;           // facade plane
const WING_Z = -3.4;     // wing facade
const MAIN_H = 7.4, WING_H = 4.1;

const PX = (key, w, h, draw) => canvasTexture(`street-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;

/** Precast concrete panels: warm grey, panel joints, rust/water streaks. */
const concreteTex = () => PX('concrete', 32, 32, (ctx, w, h) => {
  const r = rng(41);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 10; ctx.fillStyle = rgb(178 + n, 174 + n, 166 + n); ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = 'rgba(70,68,64,0.55)'; ctx.fillRect(0, 31, w, 1); ctx.fillRect(31, 0, 1, h);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, w, 1);
  for (let i = 0; i < 3; i++) { const x = Math.floor(r() * w); ctx.fillStyle = 'rgba(90,84,74,0.14)'; ctx.fillRect(x, 1, 1, 10 + r() * 20); }
  for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(80,76,70,0.15)'; ctx.fillRect(r() * w, r() * h, 1, 1); }
});

/** Cedar cladding: vertical boards, weathered. */
const cedarTex = () => PX('cedar', 32, 32, (ctx, w, h) => {
  const r = rng(42);
  for (let x = 0; x < w; x++) {
    const board = Math.floor(x / 4), base = 112 + ((board * 37) % 5) * 6;
    for (let y = 0; y < h; y++) {
      const n = (r() - 0.5) * 12 + Math.sin(y * 0.7 + board) * 4;
      ctx.fillStyle = x % 4 === 3 ? 'rgb(52,32,22)' : rgb(base + n + 18, (base + n) * 0.66, (base + n) * 0.44);
      ctx.fillRect(x, y, 1, 1);
    }
  }
});

/** Cleared, wet concrete pavers with salt and slush. */
const paverTex = () => PX('pavers', 32, 32, (ctx, w, h) => {
  const r = rng(43);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 12; ctx.fillStyle = rgb(118 + n, 122 + n, 128 + n); ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = 'rgba(60,62,66,0.7)'; for (let k = 0; k < 32; k += 16) { ctx.fillRect(0, k, w, 1); ctx.fillRect(k, 0, 1, h); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(230,234,238,${0.2 + r() * 0.4})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(220,226,234,0.5)'; ctx.fillRect(r() * w, r() * h, 3 + r() * 5, 2 + r() * 3); }
});

/** Late autumn ground: dead grass and earth, the first snow in thin patches, leaves. */
const snowTex = () => PX('snow', 64, 64, (ctx, w, h) => {
  const r = rng(44);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (r() - 0.5) * 14 + Math.sin(x * 0.2 + y * 0.13) * 4;
    ctx.fillStyle = rgb(120 + n, 106 + n, 80 + n * 0.8); ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 90; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(160,140,96,0.8)' : 'rgba(84,74,56,0.7)'; ctx.fillRect(r() * w, r() * h, 1, 2 + r() * 2); }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = `rgba(236,240,244,${0.55 + r() * 0.4})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 2); }
  const leaf = ['#d8a020', '#c86a1c', '#b8401c', '#e0b830'];
  for (let i = 0; i < 22; i++) { ctx.fillStyle = leaf[i % 4]; ctx.fillRect(r() * w, r() * h, 2, 1); }
});

/** Window interiors: 0 dark glass reflecting sky, 1 lit ward with blinds, 2 lit office, 3 warm curtains. */
const windowTex = (kind) => PX(`win${kind}`, 48, 40, (ctx, w, h) => {
  const r = rng(50 + kind);
  if (kind === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8a98a8'); g.addColorStop(0.5, '#4a5664'); g.addColorStop(1, '#2a323c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(220,230,240,0.25)'; for (let k = 0; k < 10; k++) ctx.fillRect(12 + k, 0 + k * 4, 6, 4);
    ctx.fillStyle = 'rgba(40,48,56,0.6)'; ctx.fillRect(0, h * 0.62, w, 2);
  } else {
    ctx.fillStyle = kind === 3 ? '#c88a48' : '#c8d2d4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = kind === 3 ? '#e8b878' : '#eef4f2'; ctx.fillRect(4, 2, w - 8, 3); // ceiling light
    ctx.fillStyle = kind === 3 ? 'rgba(90,40,20,0.5)' : 'rgba(110,126,130,0.5)'; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    if (kind === 1) {
      for (let y = 0; y < h * 0.45; y += 3) { ctx.fillStyle = 'rgba(200,204,196,0.95)'; ctx.fillRect(0, y, w, 2); }
      ctx.fillStyle = '#7a8a90'; ctx.fillRect(6, h * 0.62, 18, 6); // bed foot
      ctx.fillStyle = '#a8b4b8'; ctx.fillRect(30, h * 0.48, 2, 14); ctx.fillRect(26, h * 0.46, 8, 4); // IV pole + monitor
    } else if (kind === 2) {
      ctx.fillStyle = '#5a6670'; ctx.fillRect(8, h * 0.55, 30, 3);
      ctx.fillStyle = '#2a3036'; ctx.fillRect(14, h * 0.42, 10, 8); ctx.fillStyle = '#7ab0d0'; ctx.fillRect(15, h * 0.43, 8, 6);
      ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(34, h * 0.45, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(30, h * 0.5, 8, 10);
    } else {
      ctx.fillStyle = 'rgba(120,40,30,0.85)'; ctx.fillRect(0, 0, 10, h); ctx.fillRect(w - 10, 0, 10, h);
    }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(r() * w, r() * h, 2, 2); }
  }
  // reflection band on the pane
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(w * 0.55, 0); ctx.lineTo(w * 0.75, 0); ctx.lineTo(w * 0.35, h); ctx.lineTo(w * 0.15, h); ctx.fill();
});

/** Lobby back wall: wayfinding, notice board, art. */
const lobbyTex = () => canvasTexture('street-lobby', 192, 96, (ctx, w, h) => {
  ctx.fillStyle = '#d8d4c8'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#6a8a7a'; ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = '#204a6a'; ctx.fillRect(10, 8, 80, 18);
  ctx.fillStyle = '#f0f4f8'; ctx.font = 'bold 9px sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillText('← EMERGENCY', 14, 13); ctx.fillText('REGISTRATION →', 14, 21);
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(110, 10, 60, 36);
  ctx.fillStyle = '#c8d0a0'; ctx.fillRect(114, 14, 52, 28);
  ctx.fillStyle = '#4a6a5a'; ctx.beginPath(); ctx.moveTo(114, 42); ctx.lineTo(132, 22); ctx.lineTo(146, 34); ctx.lineTo(166, 18); ctx.lineTo(166, 42); ctx.fill();
  ctx.fillStyle = '#a07a4a'; ctx.fillRect(14, 36, 40, 26);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#f0f0e8', '#f0e090', '#e0a0a0'][i % 3]; ctx.fillRect(17 + (i % 3) * 12, 39 + Math.floor(i / 3) * 11, 9, 8); }
}, { nearest: true, aniso: 1 });

export class StreetScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'street';
    this.title = 'Уайтхорс';
    this.background = 0xb8c4d0;
    this.camera = { distance: 8.4, height: 2.2, lookHeight: 1.4, lookZ: -1.0 };
    this.bounds = { walk: { minX: -9, maxX: 12, minZ: -1.8, maxZ: 1.6 }, camera: { minX: -5, maxX: 8 } };
  }

  B(w, h, d, mat, x, y, z, parent = this.root, tile = 0.64) {
    const m = this.box(w, h, d, mat, x, y, z, parent);
    const uv = m.geometry.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
    return m;
  }

  build() {
    this.lumps = [];
    this.buildBackdrop();
    this.buildGround();
    this.buildFacade();
    this.buildEntrance();
    this.buildWing();
    this.buildProps();
    this.buildForeground();
    this.flushLumps();
    this.buildAutumn();
    this.buildAtmosphere();
    this.anchors.door = { x: -1.0, z: -2.4 };
    return this.root;
  }

  /**
   * Late October: the snow boxes (sills, rails, roofs, cars) become a thin
   * dusting, and half-bare birches and aspens with the last yellow/orange
   * leaves stand among the spruces; leaves on the ground.
   */
  buildAutumn() {
    const thin = new Set(['sillSnow', 'snowGround2'].map((k) => this.mats.cache.get(k)).filter(Boolean));
    this.root.traverse((o) => {
      if (!o.isMesh || !thin.has(o.material) || !o.geometry.parameters?.height) return;
      const h = o.geometry.parameters.height * o.scale.y;
      o.scale.y *= 0.3;
      o.position.y -= h * 0.35; // keep it sitting on what it lay on
    });
    const r = rng(81);
    const bark = this.mat('birchBark', { color: 0xe2ded4, roughness: 0.8 });
    const twig = this.mat('birchTwig', { color: 0x4a3c34, roughness: 0.9 });
    const leafCols = [0xd8a020, 0xe0b830, 0xc86a1c, 0xb8401c];
    const leafGeo = new THREE.PlaneGeometry(0.13, 0.1);
    const leafMats = leafCols.map((c, i) => this.mat(`leaf${i}`, { color: c, roughness: 0.8, side: THREE.DoubleSide }));
    const leaves = leafMats.map(() => []);
    const tree = (x, z, s) => {
      const g = bareTree(Math.round(x * 31 + z * 7 + 300), { low: this.low, height: 3.6, kind: 'birch' });
      g.position.set(x, 0, z); g.scale.setScalar(s);
      this.root.add(g);
      // branch tips (the highest twig vertices) carry the last leaves
      const tw = g.children[1].geometry.attributes.position;
      const tips = [];
      for (let i = 0; i < tw.count; i += 23) if (tw.getY(i) > 2.0) tips.push([tw.getX(i), tw.getY(i), tw.getZ(i)]);
      void bark; void twig;
      // the last leaves: small clusters on about half the branch tips
      for (const [tx, ty, tz] of tips) {
        if (r() < 0.45) continue;
        for (let k = 0; k < 6; k++) leaves[r() < 0.8 ? (r() < 0.5 ? 0 : 1) : (r() < 0.7 ? 2 : 3)].push([x + (tx + (r() - 0.5) * 0.25) * s, (ty + (r() - 0.5) * 0.2) * s, z + (tz + (r() - 0.5) * 0.25) * s]);
      }
      for (let k = 0; k < 18; k++) leaves[Math.floor(r() * 4)].push([x + (r() - 0.5) * 2.4, 0.02, z + (r() - 0.5) * 1.6, true]);
    };
    // two in the frame by the entrance (one before the brick wing, one by the bench), the rest behind
    for (const [x, z, s] of [[6.6, -2.35, 1.05], [-5.6, -2.4, 0.95], [12.6, -4.2, 1.0], [17.4, -6.2, 1.3], [-19.0, -5.2, 1.2], [-9.5, -4.8, 1.1]]) tree(x, z, s);
    // leaves blown onto the sidewalk and the plaza
    for (let k = 0; k < 140; k++) leaves[k % 4].push([-14 + r() * 30, 0.012, -2.4 + r() * 4.6, true]);
    // piled against the bins, the bench legs and the curb
    for (const [px, pz] of [[2.9, -2.7], [4.0, -2.5], [1.0, 2.3], [-2.0, 2.3], [5.6, 2.0]]) for (let k = 0; k < 14; k++) leaves[k % 4].push([px + (r() - 0.5) * 0.7, 0.014, pz + (r() - 0.5) * 0.3, true]);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    leaves.forEach((list, i) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(leafGeo, leafMats[i], list.length);
      list.forEach(([x, y, z, flat], j) => {
        q.setFromEuler(e.set(flat ? -Math.PI / 2 : r() * 6, r() * 6, r() * 6));
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(j, m4);
      });
      this.root.add(im);
    });
  }

  /** Queue a low-poly snow lump (all merged into one InstancedMesh). */
  lump(x, y, z, sx, sy, sz, ry = 0) { this.lumps.push([x, y, z, sx, sy, sz, ry]); }

  flushLumps(list = this.lumps, parent = this.root, name) {
    if (!list.length) return null;
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const p = geo.attributes.position;
    const r = rng(list.length + 7);
    for (let i = 0; i < p.count; i++) { const k = 1 + (r() - 0.5) * 0.08; p.setXYZ(i, p.getX(i) * k, Math.max(-0.3, p.getY(i)) * k, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, this.mat('snowLump', { color: 0xc4c8cc, roughness: 0.5 }), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    // late autumn: what was a plowed bank is a low line of slush
    list.forEach(([x, y, z, sx, sy, sz, ry], i) => { q.setFromEuler(e.set(0, ry, 0)); m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx * 0.7, sy * 0.25, sz * 0.7)); im.setMatrixAt(i, m); });
    if (name) im.name = name;
    parent.add(im);
    return im;
  }

  // ---------------------------------------------------------------- backdrop

  buildBackdrop() {
    const root = this.root;
    const layer = (tex, w, h, x, y, z, rep, color) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, color }));
      m.position.set(x, y, z); root.add(m); return m;
    };
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(220, 70), new THREE.MeshBasicMaterial({ map: skyTex(), depthWrite: false, color: 0xe8eef4 }));
    sky.position.set(0, 18, -90); root.add(sky);
    layer(mountainTex(), 180, 30, 10, 11, -80, 2, 0xd8e0ea);
    layer(treeTex(), 90, 13, 0, 4.4, -36, 4, 0xc4ccd6);
    layer(townTex(), 40, 20, -16, 9.7, -18, 2, 0xd8dce2);
    // haze between the layers
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(200, 14), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xdfe6ee, transparent: true, opacity: 0.35, depthWrite: false }));
    haze.position.set(0, 3, -30); haze.scale.set(1, 1, 1); root.add(haze);
    // a power pole + wires and spruce in the gap left of the hospital
    const wood = this.mat('pole', { color: 0x3a3028, roughness: 0.9 });
    this.B(0.24, 9, 0.24, wood, -13, 4.5, -6);
    this.B(1.8, 0.12, 0.12, wood, -13, 8.4, -6);
    const wire = new THREE.LineBasicMaterial({ color: 0x2a2e34 });
    const wpts = [];
    for (const dx of [-0.8, 0, 0.8]) for (let i = 0; i < 20; i++) {
      const a = i / 20, b = (i + 1) / 20, f = (t) => 8.5 - Math.sin(t * Math.PI) * 0.8;
      wpts.push(new THREE.Vector3(-13 + dx * 0.2, f(a), -6 + dx + a * 0), new THREE.Vector3(-13 + dx * 0.2, f(b), -6 + dx));
    }
    for (const dz of [-0.3, 0.3]) for (let i = 0; i < 24; i++) {
      const a = i / 24, b = (i + 1) / 24, f = (t) => 8.45 - Math.sin(t * Math.PI) * 0.9;
      wpts.push(new THREE.Vector3(-25 + a * 12, f(a), -6 + dz), new THREE.Vector3(-25 + b * 12, f(b), -6 + dz));
      wpts.push(new THREE.Vector3(-13 + a * 3.8, f(a) - a * 1.6, -6 + dz + a * 2.6), new THREE.Vector3(-13 + b * 3.8, f(b) - b * 1.6, -6 + dz + b * 2.6));
    }
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wpts), wire));
    for (const [x, z, s] of [[-11.2, -5, 1.2], [-15.5, -7, 1.5], [-17.5, -4.5, 1.0], [6.0, -3.0, 0.9], [21, -5, 1.3], [-10.2, -3.6, 0.7]]) this.spruce(x, z, s);
  }

  /** A spruce built from branch cards (thin first snow on the branches). */
  spruce(x, z, s, parent = this.root) {
    const g = spruceStand([{ x: 0, z: 0, s: s * 0.75, kind: 'young' }], { low: this.low, snow: 0.3, variant: Math.abs(Math.round(x)) % 3 });
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  // ---------------------------------------------------------------- ground

  buildGround() {
    const st = snowTex().clone(); st.needsUpdate = true; st.repeat.set(70 / 1.28, 30 / 1.28);
    const snow = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), this.mat('snowGround', { map: st, color: 0xffffff, roughness: 0.95 }));
    snow.rotation.x = -Math.PI / 2; snow.position.set(0, 0, -8); this.root.add(snow);
    // cleared plaza in front of the entrance and the sidewalk strip
    const pv = paverTex().clone(); pv.needsUpdate = true;
    const plazaMat = (w, d) => { const t = pv.clone(); t.needsUpdate = true; t.repeat.set(w / 0.64, d / 0.64); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35, metalness: 0.1, color: 0xffffff }); };
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(8.7, 5.0), plazaMat(8.7, 5));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0.25, 0.006, -0.5); this.root.add(plaza);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.6), plazaMat(40, 1.6));
    walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.005, 1.4); this.root.add(walk);
    // edges of the cleared areas: shoveled snow ridges
    const r = rng(61);
    for (let x = -20; x < 20; x += 0.7) {
      if (x > -4.2 && x < 4.7) continue;
      this.lump(x + r() * 0.3, 0.02, 0.55 + r() * 0.1, 0.5 + r() * 0.3, 0.16 + r() * 0.1, 0.3, r() * 3);
    }
    for (let z = -2.8; z < 0.5; z += 0.6) { this.lump(-4.2 + r() * 0.1, 0.02, z, 0.3, 0.18 + r() * 0.08, 0.45, r() * 3); this.lump(4.65 + r() * 0.1, 0.02, z, 0.3, 0.16 + r() * 0.08, 0.45, r() * 3); }
    // road + curb
    const rt = roadTex().clone(); rt.needsUpdate = true; rt.repeat.set(60 / 2.4, 1);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 6.0), new THREE.MeshStandardMaterial({ map: rt, color: 0xd4d8de, roughness: 0.8 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -0.12, 5.6); this.root.add(road);
    this.B(60, 0.14, 0.22, this.mat('curb', { color: 0x9aa0a8, roughness: 0.8 }), 0, -0.05, 2.62);
    this.B(60, 0.12, 0.4, this.mat('snowGround2', { color: 0xe6ecf2, roughness: 0.95 }), 0, -0.06, 2.95);
    // footprints: Julian's path, a nurse's shortcut, a dog
    const fp = [];
    const trail = (pts, step = 0.34, w = 0.11) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / step), ang = Math.atan2(bz - az, bx - ax);
        for (let k = 0; k < n; k++) { const t = k / n, side = (k % 2 ? 1 : -1) * w; fp.push([ax + (bx - ax) * t - Math.sin(ang) * side, az + (bz - az) * t + Math.cos(ang) * side, ang]); }
      }
    };
    trail([[4.8, 0.6], [7.5, 1.0], [12, 1.4]]);
    trail([[-4.6, -1.2], [-9, 0.3], [-14, 0.9]]);
    trail([[5.2, -0.4], [8.5, -1.6], [10.5, -2.0]], 0.4);
    trail([[-6, 1.9], [-12, 2.2]], 0.22, 0.05);
    const fgeo = new THREE.CircleGeometry(1, 7);
    const fim = new THREE.InstancedMesh(fgeo, new THREE.MeshLambertMaterial({ color: 0xa8b6c6 }), fp.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    fp.forEach(([x, z, a], i) => { q.setFromEuler(e.set(-Math.PI / 2, 0, -a)); m.compose(new THREE.Vector3(x, 0.012, z), q, new THREE.Vector3(0.13, 0.055, 1)); fim.setMatrixAt(i, m); });
    this.root.add(fim);
  }

  // ---------------------------------------------------------------- facade (main block)

  windowAt(x, y, w, h, z, kind, sill = true) {
    const frame = this.mat('winFrame', { color: 0x2a2e34, roughness: 0.5, metalness: 0.4 });
    const glassMat = kind === 0
      ? this.mat('winGlass0', { map: windowTex(0), color: 0xffffff, roughness: 0.15, metalness: 0.3 })
      : this.mat(`winLit${kind}`, { map: windowTex(kind), color: 0x000000, emissive: 0xffffff, emissiveMap: windowTex(kind), emissiveIntensity: 0.9, roughness: 0.3 });
    this.plane(w, h, glassMat, x, y, z - 0.18);
    // reveals (the wall is thick: 0.18 m)
    const rev = this.mat('reveal', { color: 0x8e8a82, roughness: 0.9 });
    this.B(w, 0.02, 0.18, rev, x, y + h / 2, z - 0.09);
    this.B(0.02, h, 0.18, rev, x - w / 2, y, z - 0.09);
    this.B(0.02, h, 0.18, rev, x + w / 2, y, z - 0.09);
    // frame + mullion
    this.B(w, 0.05, 0.05, frame, x, y + h / 2 - 0.025, z - 0.16);
    this.B(w, 0.05, 0.05, frame, x, y - h / 2 + 0.025, z - 0.16);
    this.B(0.05, h, 0.05, frame, x - w / 2 + 0.025, y, z - 0.16);
    this.B(0.05, h, 0.05, frame, x + w / 2 - 0.025, y, z - 0.16);
    this.B(0.04, h, 0.04, frame, x + w * 0.1, y, z - 0.16);
    if (sill) {
      this.B(w + 0.14, 0.05, 0.16, this.mat('sill', { color: 0x8a8e94, roughness: 0.5, metalness: 0.3 }), x, y - h / 2 - 0.025, z + 0.02);
      this.B(w + 0.1, 0.07, 0.15, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), x, y - h / 2 + 0.03, z + 0.02);
    }
  }

  buildFacade() {
    const root = this.root;
    const cTex = concreteTex().clone(); cTex.needsUpdate = true; cTex.repeat.set(2 / 0.64, 2 / 0.64);
    const concrete = this.mat('facade', { map: cTex, color: 0xffffff, roughness: 0.9 });
    const wd = cedarTex().clone(); wd.needsUpdate = true; wd.repeat.set(2 / 0.64, 2 / 0.64);
    const cedar = this.mat('cedar', { map: wd, color: 0xffffff, roughness: 0.8 });
    const cols = [-7.6, -5.0, 2.6];
    const holes = [];
    for (const x of cols) for (const y of [1.55, 4.9]) holes.push({ x0: x - 0.8, x1: x + 0.8, y0: y - 0.65, y1: y + 0.65 });
    for (const x of [-2.5, -0.9, 0.7]) holes.push({ x0: x - 0.65, x1: x + 0.65, y0: 4.25, y1: 5.55 });
    holes.push({ x0: -2.6, x1: 0.6, y0: 0, y1: 2.7 }); // entrance
    const wall = this.wall(-9.2, 4.6, MAIN_H, FZ, concrete, holes);
    void wall;
    // cedar feature cladding around the entrance bay, proud of the wall
    for (const [x0, x1] of [[-3.4, -2.6], [0.6, 1.4]]) this.B(x1 - x0, 2.9, 0.12, cedar, (x0 + x1) / 2, 1.45, FZ + 0.06);
    this.B(4.8, 0.12, 0.3, this.mat('parapet', { color: 0x6a6e74, roughness: 0.6, metalness: 0.3 }), -1.0, MAIN_H + 0.06, FZ + 0.05);
    // floor bands, plinth, parapet coping, downpipe
    const band = this.mat('band', { color: 0x8a8880, roughness: 0.8 });
    this.B(13.8, 0.22, 0.14, band, -2.3, 3.3, FZ + 0.07);
    this.B(13.8, 0.5, 0.1, this.mat('plinth', { color: 0x6c6a66, roughness: 0.95 }), -2.3, 0.25, FZ + 0.05);
    this.B(14.0, 0.14, 0.3, this.mat('coping', { color: 0x4a4e54, roughness: 0.5, metalness: 0.4 }), -2.3, MAIN_H + 0.07, FZ + 0.08);
    this.B(14.0, 0.12, 0.34, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), -2.3, MAIN_H + 0.2, FZ + 0.08);
    this.B(0.1, MAIN_H, 0.1, this.mat('pipe', { color: 0x3a3e44, roughness: 0.5, metalness: 0.5 }), 4.3, MAIN_H / 2, FZ + 0.08);
    // windows (a few lit wards, offices, dark glass)
    const kinds = { '-7.6,1.55': 2, '-5,1.55': 0, '2.6,1.55': 2, '-7.6,4.9': 1, '-5,4.9': 0, '2.6,4.9': 1 };
    for (const x of cols) for (const y of [1.55, 4.9]) this.windowAt(x, y, 1.6, 1.3, FZ, kinds[`${x},${y}`] ?? 0);
    [-2.5, -0.9, 0.7].forEach((x, i) => this.windowAt(x, 4.9, 1.3, 1.3, FZ, [3, 0, 1][i], false));
    // icicles along the coping
    const ice = this.mat('ice', { color: 0xdfeefa, roughness: 0.1, transparent: true, opacity: 0.85 });
    const r = rng(62);
    const icicles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.03, 1, 4), ice, 40);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const L = 0.1 + r() * 0.35, x = -9 + r() * 13.4;
      m.makeScale(1, L, 1); m.setPosition(x, MAIN_H - L / 2, FZ + 0.2); m.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
      icicles.setMatrixAt(i, m);
    }
    icicles.visible = false; // late October: too early for icicles (kept for a winter state)
    root.add(icicles);
    // main sign: raised letters on a dark band, backlit halo
    const sign = this.textSign('WHITEHORSE GENERAL HOSPITAL', { w: 4.8, h: 0.42, bg: '#123048', fg: '#f4f8fa', emissive: 0.35 });
    sign.position.set(-1.0, 3.98, FZ + 0.14); root.add(sign);
    const sg = lightPool(0xcfe4ff, 5.4, 0.9, 0.12); sg.position.set(-1.0, 3.98, FZ + 0.12); root.add(sg);
    // projecting blue "H" sign, lit
    const hs = new THREE.Group();
    this.B(0.12, 0.8, 0.6, this.mat('hBox', { color: 0x1c4a8a, emissive: 0x0a2a6a, emissiveIntensity: 0.8, roughness: 0.4 }), 0, 0, 0, hs);
    const hTex = canvasTexture('street-H', 32, 32, (ctx) => { ctx.fillStyle = '#1c4a8a'; ctx.fillRect(0, 0, 32, 32); ctx.fillStyle = '#f4f8ff'; ctx.fillRect(9, 6, 4, 20); ctx.fillRect(19, 6, 4, 20); ctx.fillRect(9, 14, 14, 4); }, { nearest: true, aniso: 1 });
    const hf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: hTex }));
    hf.position.set(0, 0, 0.301); hs.add(hf);
    this.B(0.05, 0.05, 0.5, this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 }), 0, 0.42, -0.3, hs);
    hs.position.set(-8.4, 5.8, FZ + 0.6); root.add(hs);
    const hg = glow(0x6aa8ff, 1.2, 0.35); hg.position.set(-8.4, 5.8, FZ + 0.95); root.add(hg);
    // rooftop: mechanical box + vent with steam
    this.B(2.2, 1.0, 1.6, this.mat('mech', { color: 0x7a7e84, roughness: 0.7 }), -6.5, MAIN_H + 0.5, FZ - 1.2);
    this.B(2.3, 0.14, 1.7, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), -6.5, MAIN_H + 1.05, FZ - 1.2);
    this.steamSources = [[-6.0, MAIN_H + 1.3, FZ - 1.2, 1.2], [9.5, WING_H + 0.7, WING_Z - 1.0, 1.0], [-8.6, 0.6, FZ + 0.2, 0.5]];
    this.B(0.3, 0.5, 0.3, this.mat('pipe', { color: 0x3a3e44, roughness: 0.5, metalness: 0.5 }), 9.5, WING_H + 0.25, WING_Z - 1.0);
    this.B(0.5, 0.35, 0.08, this.mat('grille', { color: 0x4a4e54, roughness: 0.5, metalness: 0.5 }), -8.6, 0.6, FZ + 0.05);
    // side wall return of the main block (seen at the left end)
    this.B(0.2, MAIN_H, 6, concrete, -9.2, MAIN_H / 2, FZ - 3);
  }

  // ---------------------------------------------------------------- entrance: canopy, doors, lobby

  buildEntrance() {
    const root = this.root;
    const steel = this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 });
    const alu = this.mat('alu', { color: 0x8a9098, metalness: 0.7, roughness: 0.35 });
    // lobby (seen through the doors): floor, walls, ceiling lights, desk, chairs, plant
    const lz0 = FZ - 0.18, lz1 = FZ - 4.2;
    const lobbyLit = (key, color) => this.mat(key, { color, roughness: 0.6 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), this.mat('lobbyFloor', { color: 0xb8b4a8, roughness: 0.2, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(-1.0, 0.003, (lz0 + lz1) / 2); root.add(floor);
    const back = this.plane(5, 2.8, new THREE.MeshBasicMaterial({ map: lobbyTex(), color: 0xe8e4da }), -1.0, 1.4, lz1);
    void back;
    this.plane(4, 2.8, lobbyLit('lobbyWall', 0xcac6ba), -3.4, 1.4, (lz0 + lz1) / 2, Math.PI / 2);
    this.plane(4, 2.8, lobbyLit('lobbyWall', 0xcac6ba), 1.4, 1.4, (lz0 + lz1) / 2, -Math.PI / 2);
    const ceil = this.plane(5, 4, lobbyLit('lobbyCeil', 0xd8d8d4), -1.0, 2.75, (lz0 + lz1) / 2);
    ceil.rotation.x = Math.PI / 2;
    for (const z of [FZ - 1.0, FZ - 2.6]) for (const x of [-2.0, 0.0]) {
      const p = this.plane(0.9, 0.3, new THREE.MeshBasicMaterial({ color: 0xf4f8ff }), x, 2.73, z);
      p.rotation.x = Math.PI / 2;
    }
    const desk = new THREE.Group();
    this.B(1.8, 1.05, 0.6, this.mat('deskFront', { color: 0x7a5a40, roughness: 0.6 }), 0, 0.52, 0, desk);
    this.B(1.9, 0.05, 0.7, this.mat('deskTop', { color: 0xd8d4cc, roughness: 0.4 }), 0, 1.07, 0, desk);
    this.B(0.3, 0.22, 0.04, this.mat('monitorBack', { color: 0x1a1c20 }), -0.4, 1.22, -0.1, desk);
    desk.position.set(-1.8, 0, FZ - 3.0); root.add(desk);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      this.B(0.45, 0.06, 0.45, this.mat('chairBlue', { color: 0x2a5a7a, roughness: 0.7 }), 0, 0.45, 0, c);
      this.B(0.45, 0.42, 0.06, this.mat('chairBlue', { color: 0x2a5a7a, roughness: 0.7 }), 0, 0.7, -0.2, c);
      this.B(0.04, 0.42, 0.04, steel, 0, 0.22, 0, c);
      c.position.set(-0.2 + i * 0.5, 0, FZ - 3.7); root.add(c);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.45, 16), this.mat('pot', { color: 0x3a3430, roughness: 0.7 }));
    pot.position.set(1.05, 0.22, FZ - 1.0); root.add(pot);
    for (let k = 0; k < 6; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 4), this.mat('leaf', { color: 0x2a5a32, roughness: 0.8 }));
      leaf.position.set(1.05 + Math.cos(k) * 0.1, 0.8, FZ - 1.0 + Math.sin(k) * 0.1); leaf.rotation.set(Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4); root.add(leaf);
    }
    // vestibule frame + sliding doors (one leaf part open), mat, decals
    this.B(3.3, 0.18, 0.2, alu, -1.0, 2.66, FZ - 0.05);
    for (const x of [-2.62, 0.62]) this.B(0.08, 2.7, 0.2, alu, x, 1.35, FZ - 0.05);
    this.B(3.2, 0.25, 0.25, this.mat('doorHeader', { color: 0x2a2e34, roughness: 0.5, metalness: 0.4 }), -1.0, 2.45, FZ - 0.02);
    const glassM = this.mat('doorGlass2', { color: 0xa8c0d0, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false });
    this.doors = [];
    for (const [x, open] of [[-1.82, -0.35], [-0.18, 0.0]]) {
      const leaf = new THREE.Group();
      const gl = this.B(1.56, 2.25, 0.03, glassM, 0, 1.15, 0, leaf); gl.renderOrder = 3;
      this.B(1.6, 0.06, 0.05, alu, 0, 2.25, 0, leaf); this.B(1.6, 0.1, 0.05, alu, 0, 0.05, 0, leaf);
      this.B(0.05, 2.3, 0.05, alu, -0.78, 1.15, 0, leaf); this.B(0.05, 2.3, 0.05, alu, 0.78, 1.15, 0, leaf);
      const dec = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), this.mat('decal', { color: 0xd8dce0, roughness: 0.6 })); dec.position.set(0, 1.4, 0.02); leaf.add(dec);
      leaf.position.set(x + open, 0, FZ - 0.08 - (open ? 0.06 : 0));
      root.add(leaf); this.doors.push(leaf);
    }
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), this.mat('doorMat', { color: 0x26282a, roughness: 0.95 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(-1.0, 0.01, FZ + 0.6); root.add(mat);
    // canopy: steel columns, thick slab, fascia sign, snow load, downlights, icicles
    const canopy = new THREE.Group();
    this.B(5.2, 0.28, 2.6, this.mat('canopy', { color: 0x2a3a4a, roughness: 0.5, metalness: 0.3 }), 0, 0, 0, canopy);
    this.B(5.25, 0.18, 0.06, this.mat('canopyFascia', { color: 0x1c4a6a, roughness: 0.4, metalness: 0.3 }), 0, 0.02, 1.31, canopy);
    this.B(5.1, 0.24, 2.5, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), 0, 0.26, 0, canopy);
    canopy.position.set(-1.0, 2.95, FZ + 1.3); root.add(canopy);
    for (let i = 0; i < 9; i++) this.lump(-3.4 + i * 0.6, 3.3, FZ + 1.3 + (i % 3 - 1) * 0.5, 0.45, 0.09, 0.5, i);
    const fs = this.textSign('MAIN ENTRANCE', { w: 1.6, h: 0.16, bg: '#1c4a6a', fg: '#f4f8fa', emissive: 0.5 });
    fs.position.set(-1.0, 2.97, FZ + 2.64); root.add(fs);
    for (const x of [-3.3, 1.3]) {
      this.B(0.14, 2.82, 0.14, steel, x, 1.41, FZ + 2.4);
      this.B(0.3, 0.12, 0.3, this.mat('plinth', { color: 0x6c6a66, roughness: 0.95 }), x, 0.06, FZ + 2.4);
      this.lump(x, 0.02, FZ + 2.4, 0.3, 0.12, 0.3);
    }
    const dl = this.mat('downlight', { color: 0x000000, emissive: 0xfff0d8, emissiveIntensity: 2.5 });
    for (const x of [-2.8, -1.0, 0.8]) for (const z of [FZ + 0.8, FZ + 1.9]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), dl); d.rotation.x = Math.PI / 2; d.position.set(x, 2.8, z); root.add(d);
    }
    const ice = this.mat('ice', { color: 0xdfeefa, roughness: 0.1, transparent: true, opacity: 0.85 });
    const r = rng(63);
    // (no icicles under the canopy in late October)
    // warm pool on the plaza under the canopy + lobby spill
    this.pool(0xffe4c0, -1.0, FZ + 1.5, 5.0, 3.0, 0.22);
    this.pool(0xe8f0ff, -1.0, FZ + 0.6, 3.2, 1.6, 0.25);
  }

  // ---------------------------------------------------------------- one-storey wing

  buildWing() {
    const root = this.root;
    const brickTex = canvasTexture('street-brick', 32, 32, (ctx, w, h) => {
      const r = rng(64);
      ctx.fillStyle = '#6a6460'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) for (let x = ((y / 4) % 2) * 4 - 4; x < w; x += 8) {
        const v = 120 + r() * 30; ctx.fillStyle = rgb(v + 30, v * 0.62, v * 0.5); ctx.fillRect(x + 1, y + 1, 7, 3);
      }
    }, { nearest: true, aniso: 1 });
    const bt = brickTex.clone(); bt.needsUpdate = true; bt.repeat.set(2 / 0.64, 2 / 0.64);
    const brick = this.mat('brickWing', { map: bt, color: 0xb8aaa4, roughness: 0.9 });
    const holes = [];
    for (const x of [6.2, 13.5, 16.4, 19.3]) holes.push({ x0: x - 0.8, x1: x + 0.8, y0: 0.95, y1: 2.25 });
    holes.push({ x0: 8.6, x1: 9.7, y0: 0.45, y1: 2.6 }); // staff door (raised landing)
    holes.push({ x0: 10.6, x1: 12.8, y0: 0, y1: 2.9 }); // ambulance bay
    this.wall(4.6, 23, WING_H, WING_Z, brick, holes);
    this.B(18.6, 0.16, 0.36, this.mat('coping', { color: 0x4a4e54, roughness: 0.5, metalness: 0.4 }), 13.8, WING_H + 0.08, WING_Z + 0.1);
    this.B(18.6, 0.2, 0.4, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), 13.8, WING_H + 0.24, WING_Z + 0.1);
    this.B(0.4, WING_H, 0.4, this.mat('facadeJoint', { color: 0x8a8880 }), 4.6, WING_H / 2, FZ - 0.2);
    for (const [x, k] of [[6.2, 2], [13.5, 0], [16.4, 1], [19.3, 0]]) this.windowAt(x, 1.6, 1.6, 1.3, WING_Z, k);
    // staff door on a landing, ramp + handrails, steps
    this.door(9.15, WING_Z - 0.05, { w: 1.0, h: 2.1, color: 0x5a6a78, glass: true, sign: 'STAFF ONLY', signColor: '#f0f0e0' }).position.y = 0.45;
    const conc = this.mat('rampConc', { color: 0x9a9890, roughness: 0.9 });
    this.B(1.8, 0.45, 1.3, conc, 9.15, 0.225, WING_Z + 0.65);
    this.B(1.7, 0.08, 1.2, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), 9.15, 0.47, WING_Z + 0.65).scale.set(0.9, 1, 0.9);
    const ramp = this.B(3.6, 0.1, 1.2, conc, 6.45, 0.22, WING_Z + 0.65); ramp.rotation.z = Math.atan2(0.45, 3.6);
    const rail = this.mat('rail', { color: 0xb8a040, roughness: 0.4, metalness: 0.6 });
    for (const z of [WING_Z + 0.08, WING_Z + 1.25]) {
      const tr = this.B(3.7, 0.04, 0.04, rail, 6.45, 1.15, z); tr.rotation.z = Math.atan2(0.45, 3.6);
      this.B(1.8, 0.04, 0.04, rail, 9.15, 1.4, z);
      for (const x of [4.8, 6.4, 8.1, 9.9]) this.B(0.04, 0.95, 0.04, rail, x, (x < 8.2 ? (x - 4.65) / 3.6 * 0.45 : 0.45) + 0.48, z);
    }
    for (let i = 0; i < 6; i++) this.lump(4.8 + i * 0.6, 0.05 + i * 0.075, WING_Z + 1.25, 0.32, 0.1, 0.12, i);
    // ambulance bay: roller door half up, red light, the ambulance
    this.B(2.2, 1.4, 0.08, this.mat('roller', { color: 0x9aa0a6, roughness: 0.5, metalness: 0.5 }), 11.7, 2.2, WING_Z - 0.1);
    this.plane(2.2, 1.5, new THREE.MeshBasicMaterial({ color: 0x2a3036 }), 11.7, 0.75, WING_Z - 0.5);
    const amb = this.textSign('AMBULANCE', { w: 1.4, h: 0.22, bg: '#a01818', fg: '#ffffff', emissive: 0.4 });
    amb.position.set(11.7, 3.25, WING_Z + 0.05); root.add(amb);
    const ambulance = this.vehicle({ body: 0xf0f0ec, stripe: 0xc01818, box: true });
    ambulance.position.set(16.5, 0, -1.4); ambulance.rotation.y = Math.PI; root.add(ambulance);
    this.beacon = glow(0xff3020, 0.5, 0.0); this.beacon.material = this.beacon.material.clone();
    this.beacon.position.set(14.6, 2.75, -1.4); root.add(this.beacon);
  }

  /** Simple low-poly vehicle (faces +x), snow on the roof and hood. */
  vehicle({ body = 0x5a1e1c, stripe = null, box = false, truck = false } = {}) {
    const g = new THREE.Group();
    const bm = this.mat(`veh-${body}`, { color: body, roughness: 0.35, metalness: 0.4 });
    const glass = this.mat('vehGlass', { color: 0x1a2028, roughness: 0.1, metalness: 0.6 });
    const dark = this.mat('vehDark', { color: 0x101114, roughness: 0.8 });
    const snow = this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 });
    const L = box ? 5.6 : 4.6;
    this.B(L, 0.62, 1.8, bm, 0, 0.62, 0, g);
    this.B(L + 0.06, 0.16, 1.84, dark, 0, 0.36, 0, g);
    if (box) {
      this.B(3.4, 1.7, 1.95, bm, -1.0, 1.75, 0, g);
      this.B(1.4, 0.6, 1.7, glass, 1.6, 1.25, 0, g);
      this.B(3.42, 0.12, 1.97, snow, -1.0, 2.66, 0, g);
      if (stripe) { this.B(L + 0.02, 0.14, 1.82, this.mat(`veh-${stripe}`, { color: stripe, roughness: 0.4 }), 0, 0.82, 0, g); this.B(3.42, 0.2, 1.97, this.mat(`veh-${stripe}`, { color: stripe, roughness: 0.4 }), -1.0, 1.4, 0, g); }
      this.B(0.25, 0.1, 1.2, this.mat('lbRed2', { color: 0xa01818, emissive: 0x400808 }), 0.55, 2.66, 0, g);
    } else if (truck) {
      this.B(1.8, 0.62, 1.7, glass, 0.6, 1.24, 0, g);
      this.B(1.84, 0.1, 1.74, bm, 0.6, 1.58, 0, g);
      this.B(1.84, 0.14, 1.74, snow, 0.6, 1.68, 0, g);
      this.B(2.0, 0.34, 1.8, bm, -1.2, 1.1, 0, g); // bed walls
      this.B(1.9, 0.3, 1.7, snow, -1.2, 1.1, 0, g);
    } else {
      const cab = this.B(2.4, 0.56, 1.66, glass, -0.2, 1.2, 0, g); void cab;
      this.B(2.2, 0.08, 1.62, bm, -0.2, 1.5, 0, g);
      this.B(2.2, 0.16, 1.6, snow, -0.2, 1.6, 0, g);
      this.B(1.2, 0.08, 1.7, snow, 1.6, 0.97, 0, g);
      this.B(1.0, 0.07, 1.7, snow, -1.85, 0.96, 0, g);
    }
    for (const x of [-L / 2 + 0.9, L / 2 - 0.9]) for (const z of [-0.85, 0.85]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w);
    }
    this.B(0.04, 0.12, 0.3, this.mat('headlamp', { color: 0xe8e8e0, emissive: 0x3a3a30 }), L / 2 + 0.01, 0.75, 0.6, g);
    this.B(0.04, 0.12, 0.3, this.mat('taillamp', { color: 0x8a1010, emissive: 0x300404 }), -L / 2 - 0.01, 0.75, 0.6, g);
    return g;
  }

  // ---------------------------------------------------------------- street furniture

  buildProps() {
    const root = this.root;
    const steel = this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 });
    const snow = this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 });
    // bench under snow
    this.bench(4.0, -2.55, 1.8, 0x4a3a2a);
    this.B(1.85, 0.12, 0.45, snow, 4.0, 0.53, -2.55);
    this.B(1.85, 0.06, 0.08, snow, 4.0, 0.96, -2.78);
    // bins: garbage + recycling, with snow caps
    for (const [x, c, label] of [[2.0, 0x2a3a2a, 'WASTE'], [2.55, 0x1c4a8a, 'RECYCLE']]) {
      this.B(0.5, 0.95, 0.5, this.mat(`bin-${c}`, { color: c, roughness: 0.6, metalness: 0.2 }), x, 0.475, -2.6);
      this.B(0.54, 0.06, 0.54, steel, x, 0.98, -2.6);
      this.lump(x, 1.0, -2.6, 0.26, 0.08, 0.26);
      const s = this.textSign(label, { w: 0.4, h: 0.1, bg: '#e8e8e0', fg: '#1a1a1a' }); s.position.set(x, 0.75, -2.345); root.add(s);
    }
    // smoking post + sign
    this.B(0.12, 1.0, 0.12, steel, -4.0, 0.5, -2.6);
    this.B(0.18, 0.12, 0.18, steel, -4.0, 1.04, -2.6);
    const ns = this.textSign('NO SMOKING WITHIN 9 M', { w: 0.6, h: 0.16, bg: '#f0f0ea', fg: '#a01818' });
    ns.position.set(-3.85, 1.6, FZ + 0.03); root.add(ns);
    // bike rack (hoops) with one bike frozen to it
    const hoop = new THREE.TorusGeometry(0.35, 0.025, 6, 12, Math.PI);
    for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(hoop, steel); h.position.set(5.8 + i * 0.45, 0, -2.1); root.add(h); this.lump(5.8 + i * 0.45, 0.02, -2.1, 0.2, 0.12, 0.2, i); }
    const bike = new THREE.Group();
    const bm = this.mat('bikeRed', { color: 0x8a2020, roughness: 0.5, metalness: 0.4 });
    for (const x of [-0.5, 0.5]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 5, 14), this.mat('vehDark', { color: 0x101114, roughness: 0.8 })); w.position.set(x, 0.33, 0); bike.add(w); }
    this.B(0.9, 0.035, 0.035, bm, 0, 0.6, 0, bike).rotation.z = 0.1;
    this.B(0.5, 0.035, 0.035, bm, -0.25, 0.45, 0, bike).rotation.z = -0.9;
    this.B(0.5, 0.035, 0.035, bm, 0.25, 0.45, 0, bike).rotation.z = 0.9;
    this.B(0.2, 0.04, 0.08, this.mat('vehDark', { color: 0x101114, roughness: 0.8 }), -0.35, 0.78, 0, bike);
    this.B(0.25, 0.06, 0.1, snow, -0.35, 0.82, 0, bike);
    bike.position.set(6.5, 0, -1.95); root.add(bike);
    this.lump(6.5, 0.02, -1.95, 0.6, 0.2, 0.3);
    // newspaper box + parking pay station near the curb (not in the walking path)
    this.B(0.45, 0.9, 0.4, this.mat('newsbox', { color: 0x1c3a6a, roughness: 0.5, metalness: 0.3 }), 7.4, 0.45, 2.0);
    this.B(0.47, 0.08, 0.42, snow, 7.4, 0.94, 2.0);
    // snow piled against the facade + the wing
    const r = rng(65);
    for (let x = -9; x < 22; x += 0.8) {
      if (x > -3.6 && x < 3.2) continue;
      if (x > 4.6 && x < 10.0) continue;
      if (x > 10.5 && x < 13.0) continue;
      this.lump(x + r() * 0.3, 0.02, (x > 4.6 ? WING_Z : FZ) + 0.25, 0.6 + r() * 0.4, 0.25 + r() * 0.15, 0.4, r() * 3);
    }
  }

  // ---------------------------------------------------------------- foreground

  buildForeground() {
    const root = this.root;
    const steel = this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 });
    const fgGroup = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); this.foregroundGroups.push(g); return g; };
    // curb snowbank (plowed), with a cleared crossing in front of the entrance
    const bank = fgGroup('fg-snowbank');
    const r = rng(66);
    const lumps = [];
    for (let x = -20; x < 22; x += 0.55) {
      if (x > -0.4 && x < 4.6) continue;
      const hgt = 0.35 + r() * 0.3;
      lumps.push([x + r() * 0.3, 0.02, 2.25 + r() * 0.2, 0.55 + r() * 0.35, hgt, 0.45 + r() * 0.2, r() * 3]);
      if (r() < 0.4) lumps.push([x + r() * 0.3, hgt * 0.6, 2.3, 0.35, hgt * 0.6, 0.3, r() * 3]);
    }
    // low dirty ridges either side of the crossing
    lumps.push([-0.2, 0.0, 2.3, 0.4, 0.18, 0.35, 0], [4.4, 0.0, 2.3, 0.4, 0.15, 0.35, 1]);
    this.flushLumps(lumps, bank);
    const grit = new THREE.Mesh(new THREE.PlaneGeometry(42, 0.5), new THREE.MeshBasicMaterial({ color: 0x8a8478, transparent: true, opacity: 0.35, depthWrite: false }));
    grit.rotation.x = -Math.PI / 2; grit.position.set(1, 0.015, 2.5); bank.add(grit);
    // black steel fence segment (left), snow on the rails
    const fence = fgGroup('fg-fence');
    for (let x = -8.4; x <= -3.0; x += 0.18) this.B(0.025, 1.0, 0.025, steel, x, 0.5, 2.05, fence);
    for (const y of [0.18, 0.88]) { this.B(5.5, 0.04, 0.04, steel, -5.7, y, 2.05, fence); this.B(5.5, 0.04, 0.07, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), -5.7, y + 0.04, 2.05, fence); }
    for (const x of [-8.5, -5.7, -2.9]) this.B(0.08, 1.15, 0.08, steel, x, 0.57, 2.05, fence);
    // lamp posts at the sidewalk edge
    for (const x of [-3.0, 8.5, -13.0, 15.5]) {
      const lp = fgGroup(`fg-lamp-${x}`);
      this.B(0.14, 5.4, 0.14, steel, x, 2.7, 2.35, lp);
      this.B(0.28, 0.4, 0.28, steel, x, 0.2, 2.35, lp);
      this.B(0.9, 0.08, 0.08, steel, x - 0.4, 5.35, 2.35, lp);
      this.B(0.45, 0.14, 0.26, steel, x - 0.8, 5.3, 2.35, lp);
      this.B(0.46, 0.06, 0.28, this.mat('sillSnow', { color: 0xf4f8fa, roughness: 0.95 }), x - 0.8, 5.4, 2.35, lp);
      const g = glow(0xffe0b0, 0.7, 0.4); g.position.set(x - 0.8, 5.2, 2.4); lp.add(g);
      this.B(0.4, 0.5, 0.02, this.mat('banner', { color: 0x1c4a6a, roughness: 0.7 }), x + 0.25, 3.9, 2.35, lp);
    }
    // parked cars along the curb (seen at the edges of the frame)
    const c1 = fgGroup('fg-car-sedan');
    const sedan = this.vehicle({ body: 0x5a1e1c }); sedan.position.set(-9.6, -0.12, 3.6); c1.add(sedan);
    const c2 = fgGroup('fg-car-pickup');
    const truck = this.vehicle({ body: 0x2a3a4a, truck: true }); truck.position.set(10.8, -0.12, 3.7); truck.rotation.y = Math.PI; c2.add(truck);
    // hydrant
    const hy = fgGroup('fg-hydrant');
    const hm = this.mat('hydrant', { color: 0xc8a020, roughness: 0.5, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 16), hm); body.position.set(5.6, 0.35, 2.1); hy.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat('hydrantCap', { color: 0xb02020, roughness: 0.5 })); cap.position.set(5.6, 0.7, 2.1); hy.add(cap);
    this.B(0.42, 0.07, 0.07, hm, 5.6, 0.45, 2.1, hy);
    const flag = this.B(0.02, 1.4, 0.02, this.mat('hydrantFlag', { color: 0xd04020 }), 5.75, 0.9, 2.1, hy); void flag;
  }

  // ---------------------------------------------------------------- light + air

  buildAtmosphere() {
    const root = this.root;
    // a light first snowfall, not a winter storm
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-14, 0, -3), new THREE.Vector3(14, 7, 4.5)), this.low ? 120 : 260);
    root.add(this.snow.points);
    this.animated.push(this.snow);
    // steam plumes (normal-blended soft sprites; additive would vanish against the sky)
    this.puffs = [];
    if (!this.low) {
      const pm = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xf4f6f8, transparent: true, opacity: 0.4, depthWrite: false });
      for (const src of this.steamSources) for (let i = 0; i < 6; i++) {
        const s = new THREE.Sprite(pm.clone());
        root.add(s);
        this.puffs.push({ s, src, ph: i / 6 });
      }
    }
    const hemi = new THREE.HemisphereLight(0xdfe8f4, 0x8a96a4, 1.7);
    const sun = new THREE.DirectionalLight(0xffe6cc, 1.25);
    sun.position.set(-6, 5, 8);
    const canopyL = new THREE.PointLight(0xffe2c0, 6, 6, 1.5);
    canopyL.position.set(-1.0, 2.6, FZ + 1.6);
    const lobbyL = new THREE.PointLight(0xe8f0ff, 8, 6, 1.4);
    lobbyL.position.set(-1.0, 2.4, FZ - 2.0);
    root.add(hemi, sun, canopyL, lobbyL);
    this.lights = { hemi, sun, canopy: canopyL, lobby: lobbyL };
  }

  update(dt) {
    super.update(dt);
    const t = this.time;
    for (const p of this.puffs) {
      const k = (t * 0.22 * (1 / p.src[3]) + p.ph) % 1;
      p.s.position.set(p.src[0] + k * 0.9 * p.src[3] + Math.sin(t + p.ph * 6) * 0.1, p.src[1] + k * 2.2 * p.src[3], p.src[2]);
      p.s.scale.setScalar((0.4 + k * 1.6) * p.src[3]);
      p.s.material.opacity = Math.sin(k * Math.PI) * 0.38;
    }
    if (this.beacon) this.beacon.material.opacity = (Math.sin(t * 5) > 0.6) ? 0.5 : 0.0;
  }
}
