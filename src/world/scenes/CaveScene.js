import * as THREE from 'three';
import { flareSource } from '../../fx/WindowLight.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { fbm3, rockGeometry, rockMaterial, roundedBox, reliefSheet, shaftTexture, mistTexture, smoothNormals } from '../nature.js';

const sat = (v) => Math.max(0, Math.min(1, v));

/**
 * The pack's cave above the Takhini (Lizzie's captivity, L3–L5). Side-on; walls and vault are one
 * continuous weathered sandstone relief (scalloped hollows, layers), smooth boulders on a sandy floor;
 * warm dirty firelight, cold moonlight only at the exit.
 *   x -18 … -10  the ritual chamber (L5): a stone slab, red light
 *   x -10 …  -2  the pack's hall (L4): fires, the pack in human form
 *   x  -2 …   6  the girls' niche: straw, a heap of food
 *   x   6 …  11  the store: backpacks, torn tents, bones — the other victims
 *   x  11 …  15  the side passage; Puriel's alcove at x ≈ 13
 *   x  15 …  22  the tunnel to the exit (guards), moonlight at the mouth
 * States: 'L3' | 'L4' | 'L5' (walkable part, lights, who is where).
 */

const BACK = -3.6, H = 3.6;
const PX = (key, w, h, draw) => canvasTexture(`cave-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;

/** Packed earth, grit, straw and old dark stains. */
const floorTex = () => PX('floor', 64, 64, (ctx, w, h) => {
  const r = rng(701);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 22 + Math.sin(x * 0.3 + y * 0.17) * 4; ctx.fillStyle = rgb(150 + n, 128 + n, 100 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 90; i++) { ctx.fillStyle = rgb(60, 52, 44, 0.6); ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = rgb(170, 146, 84, 0.7); ctx.fillRect(r() * w, r() * h, 3 + r() * 4, 1); } // straw
  for (let i = 0; i < 3; i++) { ctx.fillStyle = rgb(70, 30, 22, 0.25); ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 4, 0, 7); ctx.fill(); }
  for (let i = 0; i < 60; i++) { ctx.fillStyle = rgb(110, 96, 80, 0.8); ctx.fillRect(r() * w, r() * h, 1, 1); }   // grit
});

/** A red splash (decal) — the ritual chamber, Olivia's clothes. */
const bloodTex = (seed) => PX(`blood${seed}`, 32, 32, (ctx, w, h) => {
  const r = rng(720 + seed);
  ctx.clearRect(0, 0, w, h);
  const blob = (x, y, rr, c) => { ctx.fillStyle = c; for (let k = 0; k < rr * rr * 3; k++) { const a = r() * 7, d = r() * rr; ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1); } };
  blob(16, 16, 9, '#5a0808'); blob(15, 15, 6, '#7a0c0c'); blob(17, 14, 3, '#9a1414');
  for (let i = 0; i < 9; i++) { const a = r() * 7, d = 9 + r() * 6; blob(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, 1 + r() * 1.5, '#6a0a0a'); }
});

/** The night outside the mouth: sky, a hill of spruce, a pale ground. */
const outsideTex = () => canvasTexture('cave-outside', 128, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a2440'); g.addColorStop(0.6, '#4a5a80'); g.addColorStop(1, '#6a7898');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(733);
  ctx.fillStyle = '#141c2a';
  for (let i = 0; i < 26; i++) { const x = r() * w, hh = 30 + r() * 50, b = h * 0.78; ctx.beginPath(); ctx.moveTo(x, b - hh); ctx.lineTo(x - 7 - r() * 5, b); ctx.lineTo(x + 7 + r() * 5, b); ctx.fill(); }
  ctx.fillStyle = '#8a96b0'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(r() * w, r() * h * 0.4, 1, 1); }
});

/** Sandstone grain for the walls: fine streaks along the layers, no crack lines. */
const sandGrainTex = () => canvasTexture('cave-sandgrain', 256, 128, (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = 170 + (fbm3(x / 40, y / 6, 1, 71, 4) - 0.5) * 90 + (fbm3(x / 4, y / 3, 2, 72, 2) - 0.5) * 40;
    const i = (y * w + x) * 4; img.data[i] = v; img.data[i + 1] = v * 0.97; img.data[i + 2] = v * 0.93; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}, { aniso: 4 });
const flameTex = () => canvasTexture('cave-flame', 32, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h * 0.72, 1, w / 2, h * 0.6, h * 0.55);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,90,0.9)'); g.addColorStop(0.7, 'rgba(230,90,30,0.4)'); g.addColorStop(1, 'rgba(200,40,10,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h, w / 2, h); ctx.bezierCurveTo(w * 0.1, h, w * 0.05, h * 0.5, w / 2, 0); ctx.fill();
}, { color: false });
const glowTex = () => glowTexture();
/** A ragged arch: the mouth seen from inside. */
const archMask = () => canvasTexture('cave-arch', 64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 0.12, h);
  for (let i = 0; i <= 20; i++) { const a = Math.PI - (i / 20) * Math.PI; const rr = 0.42 + Math.sin(i * 2.3) * 0.04; ctx.lineTo(w / 2 + Math.cos(a) * w * rr, h * 0.62 - Math.sin(a) * h * 0.5); }
  ctx.lineTo(w * 0.88, h); ctx.closePath(); ctx.fill();
}, { color: false });

/**
 * The sandstone wall as a height field (metres, + towards the viewer): broad bulges, scalloped
 * pockets, stepped layers that overhang the next one, and fine grain. Used twice: coarse for the
 * geometry, per pixel for the baked wall texture (so the relief stays crisp).
 */
function wallHeight(x, y, fine = false) {
  let d = (fbm3(x * 0.32, y * 0.32, 0, 23, 4) - 0.5) * 1.5;
  d -= Math.max(0, fbm3(x * 0.7, y * 0.7, 5, 25, 3) - 0.5) * 3.6;                   // scallops
  d -= Math.pow(Math.max(0, fbm3(x * 1.1, y * 1.4, 6, 29, 3) - 0.52), 1.5) * 4.0;      // smaller wind-carved cups
  const fr = (y * 1.25 + fbm3(x * 0.22, y * 0.3, 4, 22, 3) * 2.6) % 1;              // layers: a long slope, then a softer drop
  const lay = fr < 0.75 ? fr / 0.75 : (1 - fr) / 0.25;
  d += lay * lay * (3 - 2 * lay) * 0.15;
  if (fine) {
    d += (fbm3(x * 4, y * 4, 2, 35, 3) - 0.5) * 0.1;
  }
  d += Math.max(0, 0.9 - y) * 0.7;
  d += Math.pow(Math.max(0, y - 2.6), 1.6) * 1.15;                                   // leans over into the vault
  return d;
}

/** The wall texture: the same height field, shaded by light raking in from the mouth. */
const wallBakedTex = (W, Hh) => canvasTexture(`cave-wallbake-${W}`, W, Hh, (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  const sx = 46 / w, sy = 6.4 / h;
  const A = [0xc4, 0x9e, 0x76], B = [0x84, 0x62, 0x48], D = [0x30, 0x22, 0x18];
  const L = [0.62, 0.55, 0.56];
  const row = new Float32Array((w + 1) * 2);
  for (let j = 0; j < h; j++) {
    const y = 6.4 - j * sy;
    for (let i = 0; i < w; i++) {
      const x = -21 + i * sx;
      const hc = wallHeight(x, y, true), hx = wallHeight(x + sx, y, true), hy = wallHeight(x, y + sy, true);
      let nx = -(hx - hc) / sx * 0.6, ny = -(hy - hc) / sy * 0.6, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const lit = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const t = fbm3(x * 0.5, y * 0.5, 3, 21, 3);
      const band = (y * 1.25 + fbm3(x * 0.22, y * 0.3, 4, 22, 3) * 2.6) % 1;
      const k = Math.max(0, Math.min(1, t * 1.8 - 0.4));
      const shade = (0.3 + 1.0 * lit) * (0.8 + 0.28 * band);
      const hollow = Math.max(0, Math.min(0.8, -hc * 0.55 - 0.2));
      const o = (j * w + i) * 4;
      for (let c = 0; c < 3; c++) img.data[o + c] = ((A[c] + (B[c] - A[c]) * k) * shade) * (1 - hollow) + D[c] * hollow;
      img.data[o + 3] = 255;
    }
  }
  void row;
  ctx.putImageData(img, 0, 0);
}, { aniso: 4 });

export class CaveScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'cave';
    this.title = 'Пещера';
    this.background = 0x050404;
    this.camera = { distance: 7.6, height: 2.0, lookHeight: 1.25, lookZ: -0.8 };
    this.zones = {
      L3: { walk: [{ minX: -1.6, maxX: 20.6, minZ: -2.0, maxZ: 0.7 }], cam: { minX: 2.0, maxX: 18 } },
      L4: { walk: [{ minX: -9.6, maxX: 10.5, minZ: -2.0, maxZ: 0.7 }], cam: { minX: -6.5, maxX: 8 } },
      L5: { walk: [{ minX: -17.4, maxX: 21.6, minZ: -2.0, maxZ: 0.7 }], cam: { minX: -14, maxX: 18.5 } },
    };
    this.bounds = { walk: { areas: this.zones.L3.walk }, camera: { ...this.zones.L3.cam } };
    this.fires = [];
    this.groups = {};
  }

  B(w, h, d, m, x, y, z, parent = this.root) { return this.box(w, h, d, m, x, y, z, parent); }

  rock(x, y, z, sx, sy, sz, m, parent = this.root, rot = 0) {
    this.rockGeos = this.rockGeos || Array.from({ length: 8 }, (_, i) => rockGeometry(760 + i, { detail: 3, rough: 0.28, strata: 0.6, flat: -0.6, colA: 0xffffff, colB: 0xd0c8c0, dark: 0.4 }));
    if (!m.vertexColors) { m.vertexColors = true; m.flatShading = false; m.needsUpdate = true; }
    const b = new THREE.Mesh(this.rockGeos[Math.abs(Math.round(rot * 13 + x * 7)) % 8], m);
    b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.set(0, rot * 1.7, 0);
    parent.add(b);
    return b;
  }

  /** A weathered sandstone boulder (reference: smooth, layered, warm). */
  boulder(seed, x, z, sx, sy, sz, parent = this.root, o = {}) {
    const b = new THREE.Mesh(rockGeometry(seed, { detail: 4, rough: 0.3, strata: 1, flat: -0.35, colA: 0x9a7654, colB: 0x6e5038, dark: 0.55, ...o }), this.sandMat);
    b.position.set(x, -0.12 * sy, z); b.scale.set(sx, sy, sz); b.rotation.y = seed * 1.3;
    parent.add(b);
    return b;
  }

  build() {
    const root = this.root;
    const r = rng(730);
    this.sandMat = rockMaterial(this.low, { roughness: 0.95 });
    const rockDark = this.mat('caveRockDark', { color: 0x6a5444, roughness: 1 });
    // floor: packed sand and grit, darker towards the walls
    const ft = floorTex().clone(); ft.needsUpdate = true; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(46 / 1.28, 9 / 1.28);
    const fgeo = new THREE.PlaneGeometry(46, 9, 184, 36); fgeo.rotateX(-Math.PI / 2);
    { const p = fgeo.attributes.position; const col = new Float32Array(p.count * 3); const c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + 2, z = p.getZ(i) - 1;
        const edge = sat((-z - 2.3) / 1.3);                      // rises into the foot of the wall
        p.setY(i, edge * edge * 0.35 + (fbm3(x * 0.6, 0, z * 0.6, 11, 3) - 0.5) * 0.12 * (0.3 + edge));
        c.setHex(0xc8a47c).lerp(new THREE.Color(0x7a5c46), sat(edge * 0.8 + (fbm3(x * 0.25, 1, z * 0.25, 12, 2) - 0.4)));
        col.set([c.r, c.g, c.b], i * 3);
      }
      fgeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); fgeo.computeVertexNormals(); }
    const floor = new THREE.Mesh(fgeo, this.mat('caveFloor', { map: ft, color: 0xffffff, roughness: 1, vertexColors: true }));
    floor.position.set(2, 0, -1); root.add(floor);
    // the back wall: one continuous weathered sheet — scalloped hollows, flowing layers
    const black = new THREE.Mesh(new THREE.PlaneGeometry(50, 12), new THREE.MeshBasicMaterial({ color: 0x020202 }));
    black.position.set(2, 4, BACK - 3.4); root.add(black);
    const sandA = new THREE.Color(0xc09a72), sandB = new THREE.Color(0x86644a), deep = new THREE.Color(0x3a281c);
    // light baked into the rock: it rakes in from the mouth (upper right), so every ledge and pocket reads
    const LX = 0.62, LY = 0.55, LZ = 0.56;
    const wallCol = (c, x, y, d, nx = 0, ny = 0, nz = 1) => {
      const t = fbm3(x * 0.5, y * 0.5, 3, 21, 3);
      c.copy(sandA).lerp(sandB, sat(t * 1.8 - 0.4));
      const band = (y * 1.9 + fbm3(x * 0.3, y * 0.3, 4, 22, 2) * 2.2) % 1;
      c.multiplyScalar(0.78 + 0.3 * band);                                         // alternating ochre / brown layers
      const lit = Math.max(0, nx * LX + ny * LY + nz * LZ);
      c.multiplyScalar(0.38 + 0.95 * lit);
      c.lerp(deep, sat(-d * 1.1 - 0.1));                                         // hollows go dark
    };
    const wallOff = (x, y) => wallHeight(x, y);
    // where the light comes from: torches, fires, the moonlit mouth (x, y, strength)
    const LIGHTS = [[-6.2, 2.1, 1.0], [5.0, 2.1, 1.0], [11.4, 2.1, 0.9], [16.6, 2.1, 0.9], [-7.6, 0.6, 1.05], [-3.6, 0.6, 0.95], [1.8, 0.6, 0.95], [-11.6, 0.6, 0.9], [-14, 1.5, 0.85], [8.0, 2.2, 0.85], [21.0, 1.5, 1.0]];
    const wallOffOld = (x, y) => {
      let d = (fbm3(x * 0.32, y * 0.32, 0, 23, 4) - 0.5) * 1.5;
      d -= Math.max(0, fbm3(x * 0.7, y * 0.7, 5, 25, 3) - 0.5) * 3.6;            // scallops
      const cell = Math.abs(fbm3(x * 1.3, y * 1.6, 6, 29, 3) - 0.5);            // sharp-rimmed pockets (ridged)
      d -= Math.max(0, 0.16 - cell) * 3.2;
      d -= Math.max(0, fbm3(x * 2.6, y * 2.2, 8, 37, 2) - 0.58) * 0.8;
      d += Math.sin(y * 5.2 + fbm3(x * 0.4, y * 0.4, 9, 27, 2) * 6) * 0.08;       // eroded layers
      const sl = (y * 1.9 + fbm3(x * 0.3, y * 0.3, 4, 22, 2) * 2.2) % 1;          // stepped ledges: each layer overhangs the next
      d += sl * 0.32 - 0.16;
      d += (fbm3(x * 3, y * 3, 2, 35, 2) - 0.5) * 0.08;                           // grain
      d += Math.max(0, 0.9 - y) * 0.7;                                            // flares into the floor
      d += Math.max(0, y - 3.4) * 0.9;                                            // leans over into the vault
      return d;
    };
    void wallOffOld;
    // geometry gives the silhouette and parallax; the baked texture carries the crisp relief
    const wgeo = reliefSheet(46, 6.4, this.low ? 140 : 200, this.low ? 30 : 44, (x, y) => wallOff(x + 2, y + 3.2), (c, x, y, d) => {
      const wx = x + 2, wy = y + 3.2;
      let lit = 0.32;
      for (const [lx, ly, k] of LIGHTS) lit = Math.max(lit, k * Math.exp(-((wx - lx) ** 2) / 18 - ((wy - ly) ** 2) / 10));
      c.setScalar(Math.min(1.1, lit) * (1 - sat(-d * 0.5 - 0.2) * 0.5));
    });
    const wallMat = rockMaterial(this.low, { roughness: 0.95 });
    wallMat.map = wallBakedTex(this.low ? 1024 : 1536, this.low ? 144 : 214); wallMat.map.repeat.set(1, 1); wallMat.map.wrapS = wallMat.map.wrapT = THREE.ClampToEdgeWrapping;
    const vaultMat = rockMaterial(this.low, { roughness: 0.95 });
    vaultMat.map = sandGrainTex(); vaultMat.map.repeat.set(16, 3);
    this.wallMat = wallMat;
    const wall = new THREE.Mesh(wgeo, wallMat);
    wall.position.set(2, 3.2, BACK - 0.5); root.add(wall);
    // the vault overhead: hangs lower towards the camera, a dark lip framing the top of the view
    const cgeo = reliefSheet(46, 5.6, this.low ? 140 : 200, this.low ? 18 : 26, (x, y) => {
      const zz = -y;                                   // sheet y → world z after the rotation
      let d = (fbm3(x * 0.4, zz * 0.4, 7, 31, 4) - 0.5) * 1.1 - Math.max(0, fbm3(x * 0.8, zz * 0.8, 2, 33, 3) - 0.55) * 2;
      d -= Math.max(0, zz - 0.2) * 0.55;               // the lip hangs towards the viewer
      return d;
    }, (c, x, y, d, nx, ny, nz) => { wallCol(c, x + 2, 4 + d, d - 0.2, nx, -nz, ny); c.multiplyScalar(0.7); });
    cgeo.rotateX(Math.PI / 2);
    const vault = new THREE.Mesh(cgeo, vaultMat);
    vault.position.set(2, 3.95, -0.4); root.add(vault);
    // boulders along the foot of the wall
    for (let x = -19; x < 23; x += 1.6 + r() * 2.4) {
      if (x > -15.4 && x < -12.6) continue;             // the slab stands free
      this.boulder(800 + Math.round(x * 3), x, BACK + 0.5 + r() * 0.5, 0.6 + r() * 0.9, 0.45 + r() * 0.7, 0.5 + r() * 0.5);
    }
    // sand drifted against the foot of the wall (no hard seam)
    const drift = new THREE.InstancedMesh(rockGeometry(880, { detail: 3, rough: 0.2, flat: -0.05, colA: 0xb89470, colB: 0x9a7a5a, dark: 0.25 }), this.sandMat, 46);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < 46; i++) { const x = -20 + i * 0.95 + r() * 0.5; q.setFromEuler(e.set(0, r() * 6, 0)); m.compose(new THREE.Vector3(x, -0.02, BACK + 0.3 + r() * 0.5), q, new THREE.Vector3(0.9 + r() * 0.8, 0.12 + r() * 0.14, 0.5 + r() * 0.3)); drift.setMatrixAt(i, m); } }
    root.add(drift);
    // a few flat, half-buried slabs and clustered small boulders between the big ones
    for (let i = 0; i < 9; i++) {
      const x = -18 + i * 4.6 + r() * 1.5;
      if (x > -15.4 && x < -12.6) continue;
      this.boulder(890 + i, x, BACK + 1.1 + r() * 0.4, 0.5 + r() * 0.4, 0.14 + r() * 0.1, 0.4 + r() * 0.3);
      this.boulder(895 + i, x + 0.6, BACK + 1.3, 0.22 + r() * 0.15, 0.2 + r() * 0.12, 0.2);
    }
    // grit and pebbles along the foot of the wall and across the floor
    const peb = new THREE.InstancedMesh(rockGeometry(870, { detail: 2, rough: 0.35, flat: -0.3, strata: 0.5, colA: 0x9a7a5a, colB: 0x5a4434, dark: 0.4 }), this.sandMat, 160);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < 160; i++) {
        const x = -19 + r() * 42, z = r() < 0.6 ? BACK + 0.9 + r() * 0.8 : -2 + r() * 3.4, sc = r() < 0.6 ? 0.04 + r() * 0.06 : 0.1 + r() * 0.12;
        q.setFromEuler(e.set(0, r() * 6, 0)); m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(sc * (1 + r()), sc, sc)); peb.setMatrixAt(i, m);
      } }
    root.add(peb);
    this.buildRitual();
    this.buildHall();
    this.buildNiche();
    this.buildStore();
    this.buildExit();
    this.buildForeground();
    // decals added by the story (blood)
    this.decals = new THREE.Group(); root.add(this.decals);
    // light
    const hemi = new THREE.HemisphereLight(0xb4a08a, 0x3a2a1e, 0.95);
    root.add(hemi);
    // light raking along the wall from the mouth's side: it is what makes the eroded relief read
    const rake = new THREE.DirectionalLight(0xf0d0a8, 2.0);
    rake.position.set(26, 9, -1.5); rake.target.position.set(0, 1, BACK);
    root.add(rake, rake.target);
    const fill = new THREE.PointLight(0xd0a884, 5, 12, 1.1); fill.position.set(0, 1.8, 3.5); root.add(fill);
    this.fill = fill;
    // torches wedged in the rock along the passage: warm, dirty pools of light
    this.torches = [];
    for (const x of [-6.2, 5.0, 11.4, 16.6]) {
      const t = glow(0xff9a48, 0.55, 0.4); t.position.set(x, 2.12, BACK + 0.75); root.add(t);
      const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      fl.scale.set(0.16, 0.3, 1); fl.position.set(x, 2.16, BACK + 0.8); root.add(fl);
      this.flames = this.flames || []; this.flames.push({ s: fl, ph: x });
      const l = new THREE.PointLight(0xff8a40, 5, 7, 1.4); l.position.set(x, 2.0, -1.4); root.add(l);
      this.torches.push(l);
      const tst = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.5, 16), this.mat('torchStick', { color: 0x2a1c12 })); tst.position.set(x, 1.8, BACK + 0.65); tst.rotation.x = -0.3; root.add(tst);
    }
    this.lights = { hemi, rake };
    this.anchors.niche = { x: 1.6, z: -0.6 };
    this.anchors.bedL = { x: 0.2, z: -1.6 };
    this.anchors.puriel = { x: 13.2, z: -2.3 };
    this.anchors.guards = [{ x: 18.6, z: -1.2 }, { x: 19.8, z: -0.2 }];
    this.anchors.exit = { x: 21.4, z: -0.6 };
    this.anchors.slab = { x: -14.0, z: -1.0 };
    this.anchors.peek = { x: -9.2, z: 0.4 };
    this.windowLights = [flareSource('MOON', new THREE.Vector3(22.0, 1.5, -1.0), { triggerDistance: 4.0, fadeDistance: 3.0, dir: new THREE.Vector3(-0.6, 0, 0.8) })];
    this.setState('L3');
    return root;
  }

  fire(x, z, s = 1, parent = this.root) {
    const g = new THREE.Group();
    const log = this.mat('fireLog', { color: 0x2a1c12, roughness: 1 });
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.6 * s, 16), log); b.rotation.set(Math.PI / 2 - 0.25, k * 0.8, 0, 'YXZ'); b.position.y = 0.08 * s; g.add(b); }
    const stones = this.mat('fireStone', { color: 0x4a4440, roughness: 1, flatShading: true });
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; this.rock(Math.cos(a) * 0.42 * s, 0.06, Math.sin(a) * 0.42 * s, 0.1 * s, 0.08 * s, 0.1 * s, stones, g, k); }
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.scale.set(0.7 * s, 0.9 * s, 1); flame.position.y = 0.35 * s; g.add(flame);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffe0a0, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.scale.set(0.3 * s, 0.45 * s, 1); core.position.y = 0.22 * s; g.add(core);
    const light = new THREE.PointLight(0xff8a40, 7 * s, 7 * s, 1.4); light.position.y = 0.7; g.add(light);
    g.position.set(x, 0, z);
    parent.add(g);
    const f = { g, flame, core, light, base: 7 * s, baseH: 0.9 * s, ph: Math.random() * 6 };
    this.fires.push(f);
    return f;
  }

  buildRitual() {
    const g = this.groups.ritual = new THREE.Group(); this.root.add(g);
    const sgeo = roundedBox(2.6, 0.55, 1.3, 0.07, 4);
    { const p = sgeo.attributes.position; const col = new Float32Array(p.count * 3); const c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = (fbm3(x * 2, y * 2, z * 2, 61, 3) - 0.5) * 0.06;
        p.setXYZ(i, x * (1 + k), y + (y > 0.2 ? k * 0.3 : 0), z * (1 + k));
        c.setHex(0x8a7868).lerp(new THREE.Color(0x5a4a40), sat(fbm3(x, y, z, 62, 3) * 1.5 - 0.3));
        if (y > 0.25 && fbm3(x * 1.5, 0, z * 1.5, 63, 3) > 0.52) c.lerp(new THREE.Color(0x3a1410), 0.7);   // old blood soaked into the stone
        col.set([c.r, c.g, c.b], i * 3);
      }
      sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); smoothNormals(sgeo); }
    const slab = new THREE.Mesh(sgeo, this.sandMat);
    slab.position.set(-14.0, 0.275, -1.3); slab.rotation.y = 0.04; g.add(slab);
    for (const [dx, dz] of [[-1.1, -0.5], [1.15, 0.45]]) g.add(this.skull(-14.0 + dx, 0.62, -1.3 + dz, this.mat('caveBone', { color: 0xcfc4b0, roughness: 0.8 })));
    // old stains on the stone, antlers and skulls along the wall
    const stain = this.mat('oldStain', { map: bloodTex(1), transparent: true, alphaTest: 0.3, color: 0x6a4a40, depthWrite: false });
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), stain); d.rotation.x = -Math.PI / 2; d.position.set(-15 + i * 0.7, 0.012, -0.4 + (i % 2) * 0.5); g.add(d); }
    const bone = this.mat('caveBone', { color: 0xcfc4b0, roughness: 0.8 });
    // skulls piled at the foot of the wall, antlers hung on the rock (set against the relief, not in the air)
    for (const [x, y, z] of [[-17.2, 0.14, BACK + 1.25], [-16.9, 0.14, BACK + 1.45], [-17.05, 0.32, BACK + 1.33], [-12.0, 0.14, BACK + 1.3], [-11.7, 0.14, BACK + 1.5], [-15.6, 0.14, BACK + 1.4]]) g.add(this.skull(x, y, z, bone));
    for (let i = 0; i < 3; i++) {
      const ax = -16.4 + i * 2.4;
      g.add(this.antlers(ax, 1.9, BACK - 0.5 + wallHeight(ax, 2.2) + 0.08, bone));
    }
    // the red light of the chamber (L5)
    this.ritualLight = new THREE.PointLight(0xc03a20, 0, 9, 1.3); this.ritualLight.position.set(-14, 2.6, 0.4); g.add(this.ritualLight);
    this.ritualFire = this.fire(-11.6, -2.4, 0.9, g);
  }

  buildHall() {
    const g = this.groups.hall = new THREE.Group(); this.root.add(g);
    this.hallFires = [this.fire(-7.6, -1.9, 1.1, g), this.fire(-3.6, -2.2, 0.9, g)];
    // furs, a carcass on a spit, a stolen crate of beer cans
    const fur = this.mat('fur', { color: 0x4a3a2c, roughness: 1 });
    for (const [x, z] of [[-9, -2.6], [-5.6, -2.8], [-2.6, -2.6]]) this.pelt(x, z, x, g);
    const spit = this.mat('spit', { color: 0x3a2a1c, roughness: 1 });
    const stick = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, L, 16), spit); c.position.set((x0 + x1) / 2, (y0 + y1) / 2, -1.9); c.rotation.z = Math.atan2(x0 - x1, y1 - y0); g.add(c); };
    stick(-8.5, 0, -8.15, 1.05); stick(-7.85, 0, -8.2, 1.05); stick(-7.35, 0, -7.0, 1.05); stick(-6.7, 0, -7.05, 1.05); stick(-8.4, 1.0, -6.8, 1.0);
    const meat = new THREE.Mesh(rockGeometry(905, { detail: 3, rough: 0.35, flat: -2, colA: 0x7a3420, colB: 0x4a1a10, dark: 0.5 }), this.mat('meatV', { vertexColors: true, color: 0xffffff, roughness: 0.6 }));
    meat.scale.set(0.45, 0.22, 0.22); meat.position.set(-7.6, 0.92, -1.9); g.add(meat);
    const crate = new THREE.Mesh(roundedBox(0.6, 0.4, 0.4, 0.03), this.mat('crate', { color: 0x7a5a34, roughness: 1 })); crate.position.set(-4.6, 0.2, -3.0); crate.rotation.y = 0.3; g.add(crate);
    this.anchors.hallSeats = [{ x: -8.6, z: -1.2 }, { x: -6.4, z: -1.5 }, { x: -4.4, z: -1.1 }, { x: -2.8, z: -1.6 }];
  }

  buildNiche() {
    const g = this.groups.niche = new THREE.Group(); this.root.add(g);
    // straw beds, a blanket, a heap of food (too much food)
    const straw = this.mat('straw', { color: 0xa88a4a, roughness: 1, flatShading: true });
    // straw beds: loose heaps of stalks, not pillows; a fur thrown over one
    const stalk = new THREE.PlaneGeometry(0.018, 0.34); stalk.translate(0, 0.17, 0);
    const stM = this.mat('strawStalk', { color: 0xc8a45a, roughness: 1, side: THREE.DoubleSide });
    const sr = rng(744), N = 540;
    const st = new THREE.InstancedMesh(stalk, stM, N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const beds = [[-0.6, -2.2], [0.8, -2.5], [2.2, -2.2]];
    for (let i = 0; i < N; i++) {
      const [bx, bz] = beds[i % 3], a = sr() * 6.28, d = Math.sqrt(sr());
      q.setFromEuler(e.set(Math.PI / 2 - 0.15 - sr() * 0.5, sr() * 6.28, (sr() - 0.5) * 0.6));
      m4.compose(new THREE.Vector3(bx + Math.cos(a) * d * 0.75, 0.02 + (1 - d) * 0.1 * sr(), bz + Math.sin(a) * d * 0.42), q, new THREE.Vector3(1, 0.6 + sr() * 0.8, 1));
      st.setMatrixAt(i, m4); st.setColorAt(i, col.setScalar(0.65 + sr() * 0.5));
    }
    g.add(st);
    for (const [x, z] of beds) { const lump = this.rock(x, 0.0, z, 0.7, 0.07, 0.4, straw, g, x); lump.position.y = 0.02; }
    this.pelt(0.8, -2.5, 0.2, g, 0x5a2a2a, 0.15);
    const meat = this.mat('rawMeat', { color: 0x7a2a22, roughness: 0.7, flatShading: true });
    const berry = this.mat('berries', { color: 0x3a2a5a, roughness: 0.6 });
    const can = this.mat('can', { color: 0xa8b0b8, metalness: 0.7, roughness: 0.3 });
    meat.color.set(0x5a1c14);
    for (let i = 0; i < 6; i++) this.rock(4.0 + (i % 3) * 0.35, 0.1 + Math.floor(i / 3) * 0.14, -2.7 + (i % 2) * 0.2, 0.2, 0.1, 0.14, meat, g, i);
    for (let i = 0; i < 4; i++) { const b = this.longBone(this.mat('caveBone', { color: 0xcfc4b0, roughness: 0.8 })); b.position.set(4.0 + i * 0.28, 0.24, -2.6 + (i % 2) * 0.15); b.rotation.set(0.3, i, 1.2); g.add(b); }
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), berry); b.position.set(3.4 + (i % 4) * 0.08, 0.05, -2.2 + Math.floor(i / 4) * 0.08); g.add(b); }
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), can); c.position.set(4.9 + i * 0.13, 0.06, -2.1 + (i % 2) * 0.1); if (i === 3) { c.rotation.z = Math.PI / 2; c.position.y = 0.05; } g.add(c); }
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 20, 1, true), this.mat('bucket', { color: 0x5a6068, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide })); bucket.position.set(2.9, 0.15, -2.9); g.add(bucket);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 20, Math.PI), this.mats.cache.get('bucket')); handle.position.set(2.9, 0.3, -2.9); handle.rotation.z = 0.3; g.add(handle);
    this.nicheFire = this.fire(1.8, -1.2, 0.7, g);
    this.anchors.food = new THREE.Vector3(4.2, 0.5, -2.4);
    this.anchors.beds = new THREE.Vector3(0.8, 0.4, -2.4);
  }

  buildStore() {
    const g = this.groups.store = new THREE.Group(); this.root.add(g);
    const packs = [0x2a4a6a, 0x7a2a2a, 0x3a5a2a, 0xb07a20, 0x4a3a5a];
    const packGeo = roundedBox(0.36, 0.5, 0.22, 0.08), pocketGeo = roundedBox(0.26, 0.18, 0.08, 0.04);
    packs.forEach((c, i) => {
      const pm = this.mat(`hpack${i}`, { color: c, roughness: 0.9 });
      const b = new THREE.Mesh(packGeo, pm); b.position.set(6.4 + i * 0.7, 0.25, -2.8 + (i % 2) * 0.25); b.rotation.set(0, i, i % 2 ? 0.3 : -0.2); g.add(b);
      const pk = new THREE.Mesh(pocketGeo, pm); pk.position.set(0, -0.08, 0.12); b.add(pk);
    });
    // a torn orange tent, a boot, a hat, a pile of bones
    const tentGeo = new THREE.ConeGeometry(0.9, 0.9, 16, 6, true);
    { const tp = tentGeo.attributes.position; for (let i = 0; i < tp.count; i++) { const k = 1 + (fbm3(tp.getX(i) * 3, tp.getY(i) * 3, tp.getZ(i) * 3, 41, 2) - 0.5) * 0.5; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } tentGeo.computeVertexNormals(); }
    const tent = new THREE.Mesh(tentGeo, this.mat('torntent', { color: 0xc86a1c, roughness: 0.9, side: THREE.DoubleSide }));
    tent.position.set(9.6, 0.4, -2.6); tent.rotation.set(0.2, 0.5, 0.35); g.add(tent);
    const boot = new THREE.Mesh(roundedBox(0.3, 0.12, 0.12, 0.05), this.mat('boot', { color: 0x3a2a1c, roughness: 0.9 })); boot.position.set(8.4, 0.06, -1.9); boot.rotation.y = 0.6; g.add(boot);
    const shaft = new THREE.Mesh(roundedBox(0.11, 0.18, 0.12, 0.04), this.mats.cache.get('boot')); shaft.position.set(-0.08, 0.12, 0); boot.add(shaft);
    const bone = this.mat('caveBone', { color: 0xcfc4b0, roughness: 0.8 });
    for (let i = 0; i < 9; i++) { const b = this.longBone(bone); b.position.set(10.4 + Math.sin(i) * 0.3, 0.04 + i * 0.02, -2.6 + Math.cos(i) * 0.25); b.rotation.set(Math.PI / 2, 0, i); g.add(b); }
    g.add(this.skull(10.6, 0.14, -2.5, bone));
    this.anchors.store = new THREE.Vector3(8.2, 0.7, -2.5);
    this.anchors.bones = new THREE.Vector3(10.4, 0.4, -2.4);
    const torch = glow(0xff9040, 1.2, 0.5); torch.position.set(8.0, 2.2, BACK + 0.6); g.add(torch);
    const tl = new THREE.PointLight(0xff8a40, 4, 6, 1.5); tl.position.set(8.0, 2.0, -1.8); g.add(tl);
    this.storeLight = tl;
  }

  buildExit() {
    const g = this.groups.exit = new THREE.Group(); this.root.add(g);
    // the side alcove where Puriel lies (L3)
    const al = this.mat('alcove', { color: 0x2a2420, roughness: 1, flatShading: true });
    this.boulder(940, 12.2, -3.0, 0.8, 1.6, 0.6, g, { colA: 0x5a4434, colB: 0x3a2a20 });
    this.boulder(941, 14.3, -3.0, 0.7, 1.4, 0.6, g, { colA: 0x5a4434, colB: 0x3a2a20 });
    this.purielGroup = new THREE.Group(); g.add(this.purielGroup);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshLambertMaterial({ map: bloodTex(2), transparent: true, alphaTest: 0.3, depthWrite: false }));
    st.rotation.x = -Math.PI / 2; st.position.set(13.2, 0.013, -2.2); this.purielGroup.add(st);
    // the tunnel narrows; moonlight at the mouth
    for (let i = 0; i < 5; i++) this.boulder(950 + i, 16 + i * 1.3, 1.1 + (i % 2) * 0.3, 0.5, 0.45, 0.35, g);
    const mouthOpen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.4), new THREE.MeshBasicMaterial({ map: outsideTex(), alphaMap: archMask(), transparent: true, depthWrite: false }));
    mouthOpen.position.set(21.0, 1.2, BACK + 0.55); g.add(mouthOpen);
    this.boulder(960, 19.8, BACK + 0.9, 0.7, 2.2, 0.6, g, { colA: 0x4a3828, colB: 0x2a1e16 });
    this.boulder(961, 22.3, BACK + 0.9, 0.8, 2.4, 0.6, g, { colA: 0x4a3828, colB: 0x2a1e16 });
    const lintel = this.boulder(962, 21.0, BACK + 0.8, 1.6, 0.5, 0.6, g, { colA: 0x4a3828, colB: 0x2a1e16 }); lintel.position.y = 2.35;
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0x6a88c0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(20.6, 0.03, -1.4); g.add(pool);
    const moon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), new THREE.MeshBasicMaterial({ map: outsideTex() }));
    moon.position.set(22.6, 1.3, -1.4); moon.rotation.y = -Math.PI / 2; g.add(moon);
    const mg = glow(0xa8b8d8, 4.0, 0.35); mg.position.set(22.0, 1.3, -0.8); g.add(mg);
    // cold light falling in from the mouth: soft shafts in the dust
    const shT = shaftTexture();
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.7 + i * 0.15, 6), new THREE.MeshBasicMaterial({ map: shT, color: 0x9ab0d4, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
      sh.position.set(20.4 - i * 0.55, 1.6, -1.4 + i * 0.2); sh.rotation.z = 1.05 + i * 0.04; g.add(sh);
    }
    this.moonLight = new THREE.PointLight(0x8aa0c8, 6, 9, 1.2); this.moonLight.position.set(21.4, 2.2, -0.6); g.add(this.moonLight);
    const snowM = this.mat('caveSnowIn', { color: 0xc8d0dc, roughness: 1 });
    const sn = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), new THREE.MeshLambertMaterial({ map: glowTexture(), color: 0xc8d0dc, transparent: true, opacity: 0.8, depthWrite: false })); sn.rotation.x = -Math.PI / 2; sn.position.set(21.4, 0.012, -0.6); g.add(sn); void snowM;
    this.anchors.mouth = new THREE.Vector3(21.6, 1.4, -0.8);
  }

  buildForeground() {
    const fg = (name) => { const g = new THREE.Group(); g.name = name; this.root.add(g); this.foregroundGroups.push(g); return g; };
    for (const [x, w, h] of [[-17.6, 1.3, 0.55], [-3.2, 1.1, 0.4], [9.0, 1.0, 0.4]]) {
      const g = fg(`fg-rock-${x}`);
      this.boulder(970 + Math.round(x * 5), x, 2.5, w, h, 0.6, g, { colA: 0x4a3828, colB: 0x2a1e16, dark: 0.6 });
    }
  }

  skull(x, y, z, m) {
    const g = new THREE.Group();
    g.scale.setScalar(1.5);
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), m); cr.scale.set(1, 0.85, 1.15); g.add(cr);
    const sn = new THREE.Mesh(roundedBox(0.09, 0.07, 0.1, 0.025), m); sn.position.set(0, -0.05, 0.09); g.add(sn);
    const eye = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
    for (const sx of [-0.035, 0.035]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), eye); e.position.set(sx, 0.0, 0.112); g.add(e); }
    g.position.set(x, y, z);
    return g;
  }

  antlers(x, y, z, m) {
    const g = new THREE.Group();
    const tube = (pts, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([a, b, c]) => new THREE.Vector3(a, b, c))), 16, r, 8), m);
    for (const s of [-1, 1]) {
      g.add(tube([[s * 0.05, 0, 0], [s * 0.22, 0.12, 0.04], [s * 0.34, 0.36, 0.06], [s * 0.36, 0.66, 0.02], [s * 0.3, 0.86, -0.02]], 0.034));
      for (const [t0, len, lean] of [[0.12, 0.22, 0.4], [0.36, 0.26, 0.2], [0.6, 0.2, 0.1]]) {
        const bx = s * (0.22 + t0 * 0.2), by = 0.12 + t0 * 0.9;
        g.add(tube([[bx, by, 0.03], [bx + s * 0.04, by + len * 0.5, 0.05], [bx - s * lean * 0.2, by + len, 0.04]], 0.02));
      }
    }
    const skull = this.skull(0, -0.04, 0.04, m); skull.scale.setScalar(1.5); g.add(skull);
    const plaque = new THREE.Mesh(roundedBox(0.42, 0.55, 0.05, 0.02), this.mat('plaque', { color: 0x4a3020, roughness: 0.8 })); plaque.position.set(0, 0.0, -0.05); g.add(plaque);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12), this.mat('peg', { color: 0x2a1a10 })); peg.rotation.x = Math.PI / 2; peg.position.set(0, 0.22, -0.08); g.add(peg);
    g.position.set(x, y, z);
    return g;
  }

  longBone(m) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 16), m));
    for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), m); k.position.y = s * 0.18; k.scale.set(1.2, 0.8, 1); g.add(k); }
    return g;
  }

  /** A pelt / blanket thrown on the floor: soft, lumpy, uneven edge. */
  pelt(x, z, rot, parent, color = 0x4a3a2c, scale = 0.12) {
    const m = new THREE.Mesh(rockGeometry(990 + Math.round(x * 3), { detail: 3, rough: 0.4, flat: -0.05, colA: 0xffffff, colB: 0xb8b0a8, dark: 0.3 }), this.mat(`pelt${color}`, { color, roughness: 1, vertexColors: true }));
    m.position.set(x, 0.0, z); m.scale.set(0.65, scale, 0.42); m.rotation.y = rot;
    parent.add(m);
    return m;
  }

  /** A blood decal on the floor (the story adds them during L5). */
  addBlood(x, z, s = 1, seed = 3) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * s, 0.9 * s), new THREE.MeshLambertMaterial({ map: bloodTex(seed), transparent: true, alphaTest: 0.3, depthWrite: false }));
    d.rotation.x = -Math.PI / 2; d.rotation.z = Math.random() * 6; d.position.set(x, 0.015 + this.decals.children.length * 0.0005, z);
    this.decals.add(d);
    return d;
  }

  clearBlood() { this.decals.clear(); }

  setState(name) {
    this.state = name;
    const z = this.zones[name] || this.zones.L3;
    this.bounds.walk.areas = z.walk;
    this.bounds.camera = { ...z.cam };
    const L5 = name === 'L5';
    this.ritualLight.intensity = L5 ? 12 : 0;
    this.ritualFire.g.visible = L5;
    this.ritualFire.light.intensity = L5 ? this.ritualFire.base : 0;
    for (const f of this.hallFires) { f.g.visible = name !== 'L3'; f.light.intensity = name !== 'L3' ? f.base : 0; }
    this.nicheFire.g.visible = true;
    this.purielGroup.visible = name === 'L3';
    this.lights.hemi.intensity = L5 ? 0.7 : 0.95;
    this.lights.rake.intensity = L5 ? 0.9 : name === 'L4' ? 1.5 : 2.0;
    this.lights.rake.color.set(L5 ? 0x9ab0d0 : 0xe8c8a0);
    for (const t of this.torches) t.intensity = L5 ? 2.5 : 5;
    this.clearBlood();
  }

  update(dt) {
    super.update(dt);
    const t = this.time;
    if (this.followTarget) this.fill.position.x = this.followTarget().position.x;
    for (const f of this.flames || []) { const k = 0.85 + Math.sin(t * 11 + f.ph) * 0.1 + Math.sin(t * 27 + f.ph * 3) * 0.06; f.s.scale.set(0.16 * (2 - k), 0.3 * k, 1); f.s.material.opacity = 0.75 + 0.25 * k; }
    for (const f of this.fires) {
      const k = 0.82 + Math.sin(t * 9 + f.ph) * 0.08 + Math.sin(t * 23 + f.ph * 2) * 0.06;
      if (f.g.visible && f.light.intensity > 0) { f.light.intensity = f.base * k; f.flame.scale.y = f.baseH * (0.8 + 0.3 * k); f.flame.material.opacity = 0.75 + 0.2 * k; }
    }
  }
}
