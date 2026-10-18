import * as THREE from 'three';
import { bevelBox } from '../nature.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng } from '../../render/textures.js';
import { glow, lightCone, lightPool } from '../props.js';

/**
 * Interrogation room 2 — small, cold, a one-way mirror on the back wall with
 * an observation room behind it (people watching, barely visible).
 *
 * Painted cinder block (two-tone institutional paint, chipped at chair
 * height), quarry-tile floor with a drain, steel door with wired glass,
 * conduit, a vent with a turning fan, a bolted table with a cuff bar and the
 * small debris of a long night. One hard lamp; everything else is cold.
 */
const BACK = -3.0;
const H = 2.8;
const SIDE = 3.6;
const TOP = 0.785; // table surface height

// ------------------------------------------------------------------ local helpers

const PIX = { nearest: true, aniso: 1 };
const clamp255 = (v) => Math.max(0, Math.min(255, v | 0));

/** Pixel texture: nearest-filtered small canvas (same register as the sprites). */
function ptex(key, w, h, draw, opts = {}) {
  return canvasTexture(`ir-${key}`, w, h, (ctx, W, Hh) => draw(ctx, W, Hh, rng(key.length * 7919 + w * 31 + h)), { ...PIX, ...opts });
}

/** Big surfaces: crisp when magnified, mip-mapped when seen at a grazing angle. */
function surfaceTex(key, w, h, draw) {
  const t = ptex(key, w, h, draw);
  if (!t.userData.irMip) {
    t.userData.irMip = true;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  }
  return t;
}

/** Fill a canvas per pixel. fn(x, y) → [r, g, b, a?]. */
function paint(ctx, W, Hh, fn) {
  const img = ctx.createImageData(W, Hh);
  const d = img.data;
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const c = fn(x, y);
      const i = (y * W + x) * 4;
      d[i] = clamp255(c[0]); d[i + 1] = clamp255(c[1]); d[i + 2] = clamp255(c[2]); d[i + 3] = c[3] === undefined ? 255 : clamp255(c[3]);
    }
  }
  ctx.putImageData(img, 0, 0);
}

const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Merge indexed geometries (position/normal/uv) into one — one draw call per material. */
function mergeGeos(geos) {
  let vc = 0, ic = 0;
  for (const g of geos) { vc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const src = g.index ? g.index.array : Array.from({ length: g.attributes.position.count }, (_, k) => k);
    for (let k = 0; k < src.length; k++) idx[io + k] = src[k] + vo;
    vo += g.attributes.position.count; io += src.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

class Batch {
  constructor() { this.geos = []; }
  add(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    this.geos.push(geo);
    return this;
  }
  box(w, h, d, x, y, z, rx, ry, rz) { return this.add(bevelBox(w, h, d).clone(), x, y, z, rx, ry, rz); }
  cyl(r, h, x, y, z, rx, ry, rz, seg = 8) { return this.add(new THREE.CylinderGeometry(r, r, h, seg), x, y, z, rx, ry, rz); }
  /** Tube between two points. */
  rod(r, a, b, seg = 6) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B);
    const geo = new THREE.CylinderGeometry(r, r, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    geo.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
    this.geos.push(geo);
    return this;
  }
  mesh(mat, parent) {
    const m = new THREE.Mesh(mergeGeos(this.geos), mat);
    if (parent) parent.add(m);
    return m;
  }
}

/** Dust motes that only glow while they drift inside the lamp's cone. */
class BeamDust {
  constructor(apex, height, r0, r1, count, color = 0xf2f4ff) {
    Object.assign(this, { apex, height, r0, r1, count });
    this.col = new THREE.Color(color);
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.spawn(i, true);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.rgb, 3));
    this.material = new THREE.PointsMaterial({ size: 0.016, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.gain = 1;
  }
  spawn(i, anywhere) {
    const t = Math.random();
    const y = this.apex.y - (anywhere ? t : (Math.random() < 0.5 ? 0.02 : 0.98)) * this.height;
    const rr = this.r1 * 1.15 * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    this.pos[i * 3] = this.apex.x + Math.cos(a) * rr;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = this.apex.z + Math.sin(a) * rr;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.05;
    this.vel[i * 3 + 1] = (Math.random() - 0.6) * 0.035;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }
  update(dt, t) {
    const p = this.pos, v = this.vel, c = this.rgb;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      p[k] += (v[k] + Math.sin(t * 0.4 + i * 1.7) * 0.012) * dt;
      p[k + 1] += (v[k + 1] + Math.cos(t * 0.3 + i) * 0.008) * dt;
      p[k + 2] += (v[k + 2] + Math.sin(t * 0.35 + i * 0.9) * 0.01) * dt;
      const dy = this.apex.y - p[k + 1];
      const dx = p[k] - this.apex.x, dz = p[k + 2] - this.apex.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (dy < 0 || dy > this.height || d > this.r1 * 1.2) { this.spawn(i, true); continue; }
      const rad = this.r0 + (this.r1 - this.r0) * (dy / this.height);
      const inside = Math.max(0, 1 - Math.pow(d / rad, 4));
      const fade = Math.min(1, dy / 0.25) * Math.min(1, (this.height - dy) / 0.3);
      const tw = 0.6 + 0.4 * Math.sin(t * 2.3 + i * 3.1);
      const b = inside * fade * tw * this.gain;
      c[k] = this.col.r * b; c[k + 1] = this.col.g * b; c[k + 2] = this.col.b * b;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

/** Fine dust breathing out of the vent and sinking into the room. */
class VentStream {
  constructor(origin, count = 60) {
    this.origin = origin; this.count = count;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count);
    this.life = new Float32Array(count);
    this.rgb = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { this.spawn(i); this.age[i] = Math.random() * this.life[i]; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.rgb, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.014, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.points.frustumCulled = false;
  }
  spawn(i) {
    const o = this.origin, k = i * 3;
    this.pos[k] = o.x + (Math.random() - 0.5) * 0.38;
    this.pos[k + 1] = o.y + (Math.random() - 0.5) * 0.2;
    this.pos[k + 2] = o.z;
    this.vel[k] = (Math.random() - 0.5) * 0.06;
    this.vel[k + 1] = -0.02 - Math.random() * 0.05;
    this.vel[k + 2] = 0.1 + Math.random() * 0.16;
    this.age[i] = 0;
    this.life[i] = 5 + Math.random() * 5;
  }
  update(dt, t) {
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      this.age[i] += dt;
      if (this.age[i] > this.life[i]) this.spawn(i);
      this.vel[k + 2] *= 1 - dt * 0.12;
      this.pos[k] += (this.vel[k] + Math.sin(t * 0.7 + i) * 0.02) * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const a = this.age[i] / this.life[i];
      const b = Math.sin(a * Math.PI) * 0.55;
      this.rgb[k] = 0.62 * b; this.rgb[k + 1] = 0.7 * b; this.rgb[k + 2] = 0.8 * b;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ textures

function wallTexture() {
  // 3.2 m × 2.8 m at 80 px/m: 40×20 cm blocks = 32×16 px. Two-tone institutional paint.
  return surfaceTex('wall', 256, 224, (ctx, W, Hh, r) => {
    const LOW = 140; // canvas row where the dark lower paint starts (1.05 m)
    paint(ctx, W, Hh, (x, y) => {
      const row = Math.floor(y / 16), yy = y % 16;
      const off = row % 2 ? 16 : 0;
      const col = Math.floor((x + off) / 32), xx = (x + off) % 32;
      let c = y >= LOW ? [66, 84, 84] : [132, 146, 140];
      if (y >= LOW - 4 && y < LOW) c = [40, 54, 56];
      const tone = (hash2(row, col) - 0.5) * 10;
      let v = tone + (r() - 0.5) * 7;
      if (yy === 15) v -= 26; else if (yy === 0) v += 7; else if (yy === 14) v -= 6;
      if (xx === 31) v -= 20; else if (xx === 0) v += 4;
      if (r() < 0.012) v -= 22;
      return [c[0] + v, c[1] + v, c[2] + v];
    });
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
    // ceiling soot + floor grime
    for (let y = 0; y < 16; y++) { ctx.fillStyle = `rgba(14,16,16,${0.32 * (1 - y / 16)})`; ctx.fillRect(0, y, W, 1); }
    for (let y = 196; y < Hh; y++) { ctx.fillStyle = `rgba(10,12,10,${0.5 * ((y - 196) / 28) ** 1.4})`; ctx.fillRect(0, y, W, 1); }
    // rust-brown water stains crawling down from the ceiling
    for (const sx of [34, 148, 214]) {
      let x = sx; const len = 40 + r() * 90; const w = 3 + (r() * 6) | 0;
      for (let y = 10; y < len; y++) {
        x += (r() - 0.5) * 0.9;
        const ww = w * (1 - (y / len) * 0.6);
        ctx.fillStyle = `rgba(92,72,40,${0.1 + 0.08 * (y / len)})`;
        ctx.fillRect(x | 0, y, Math.max(1, ww | 0), 1);
      }
      ctx.fillStyle = 'rgba(70,52,26,0.32)';
      ctx.fillRect(x | 0, len | 0, Math.max(2, (w * 0.5) | 0), 1);
    }
    // chipped paint at chair height and along the stripe: raw grey block shows through
    const chip = (cx, cy, n) => {
      for (let k = 0; k < n; k++) {
        const x = cx + ((r() - 0.5) * n * 0.9) | 0, y = cy + ((r() - 0.5) * n * 0.5) | 0;
        px(x, y, '#a29f93'); px(x + 1, y, '#a29f93');
        px(x, y + 1, '#2c3434');
      }
    };
    for (let i = 0; i < 46; i++) chip(r() * W, 132 + r() * 58, 2 + (r() * 6) | 0);
    for (let i = 0; i < 10; i++) chip(r() * W, 30 + r() * 100, 2 + (r() * 3) | 0);
    // black scuffs where chairs and shoes hit the wall
    for (let i = 0; i < 44; i++) {
      const y = 148 + r() * 64, x = r() * W, len = 3 + r() * 16;
      ctx.fillStyle = `rgba(14,16,18,${0.22 + r() * 0.3})`;
      ctx.fillRect(x | 0, y | 0, len | 0, r() < 0.3 ? 2 : 1);
    }
    // rubbed, shinier patches on the lower paint
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(160,175,170,0.06)'; ctx.fillRect(r() * W, 150 + r() * 40, 10 + r() * 20, 4 + r() * 8); }
  });
}

function floorTexture() {
  // 2.4 m square: 30 cm quarry tiles = 32 px.
  return surfaceTex('floor', 256, 256, (ctx, W, Hh, r) => {
    paint(ctx, W, Hh, (x, y) => {
      const tx = x >> 5, ty = y >> 5, lx = x & 31, ly = y & 31;
      const h = hash2(tx + 3, ty + 7);
      let base = h < 0.08 ? [88, 98, 98] : h > 0.93 ? [122, 128, 120] : [104, 114, 112];
      let v = (h - 0.5) * 10 + (r() - 0.5) * 8;
      if (r() < 0.07) v += (r() < 0.5 ? -18 : 16);
      if (lx === 0 || ly === 0) return [44, 50, 50];
      if (lx === 1 || ly === 1) v -= 12;
      if (lx === 31 || ly === 31) v += 6;
      // grime collects near the grout
      if (lx < 4 || ly < 4 || lx > 28 || ly > 28) v -= 4;
      return [base[0] + v, base[1] + v, base[2] + v];
    });
    // heel marks
    for (let i = 0; i < 70; i++) {
      let x = r() * W, y = r() * Hh; const dx = (r() - 0.5) * 2, dy = (r() - 0.5) * 0.8;
      ctx.fillStyle = `rgba(10,10,12,${0.3 + r() * 0.35})`;
      for (let k = 0, n = 2 + r() * 7; k < n; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += dx; y += dy; }
    }
    // cracked tiles
    for (let i = 0; i < 5; i++) {
      let x = ((r() * 8) | 0) * 32 + 4 + r() * 24, y = ((r() * 8) | 0) * 32 + 2;
      ctx.fillStyle = 'rgba(20,24,24,0.7)';
      for (let k = 0; k < 28; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += (r() - 0.5) * 2.2; y += 1; }
    }
    // old stains
    for (let i = 0; i < 7; i++) {
      const cx = r() * W, cy = r() * Hh, rad = 6 + r() * 14;
      for (let k = 0; k < rad * rad * 1.5; k++) {
        const a = r() * 6.28, d = Math.sqrt(r()) * rad;
        ctx.fillStyle = 'rgba(52,46,32,0.05)';
        ctx.fillRect((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d * 0.7) | 0, 2, 2);
      }
    }
  });
}

function ceilingTexture() {
  return surfaceTex('ceil', 64, 64, (ctx, W, Hh, r) => {
    paint(ctx, W, Hh, (x, y) => {
      if ((x & 31) === 0 || (y & 31) === 0) return [74, 78, 76];
      let v = 132 + (r() - 0.5) * 10;
      if (r() < 0.08) v -= 30;
      return [v, v + 2, v - 2];
    });
    // a water-stained tile
    ctx.strokeStyle = 'rgba(110,84,40,0.45)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(46, 16, 9, 0, 6.3); ctx.stroke();
    ctx.fillStyle = 'rgba(120,96,50,0.18)'; ctx.beginPath(); ctx.arc(46, 16, 8, 0, 6.3); ctx.fill();
  });
}

const steelTex = () => ptex('steel', 32, 32, (ctx, W, Hh, r) => {
  const rows = Array.from({ length: Hh }, () => (r() - 0.5) * 14);
  paint(ctx, W, Hh, (x, y) => { const v = 150 + rows[y] + (r() - 0.5) * 10; return [v, v + 2, v + 5]; });
  for (let i = 0; i < 14; i++) {
    let x = r() * W, y = r() * Hh; const dx = (r() - 0.5) * 2, dy = (r() - 0.5);
    ctx.fillStyle = r() < 0.5 ? 'rgba(230,236,240,0.5)' : 'rgba(40,44,48,0.5)';
    for (let k = 0; k < 6 + r() * 10; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += dx; y += dy; }
  }
});

const tableTex = () => ptex('table', 64, 36, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, (x, y) => {
    let v = 112 + (r() - 0.5) * 9 + Math.sin(y * 0.9) * 2;
    const edge = Math.min(x, y, W - 1 - x, Hh - 1 - y);
    if (edge < 2) v += 16 - edge * 5; // worn bright edges
    return [v, v + 3, v + 6];
  });
  // scratches
  for (let i = 0; i < 40; i++) {
    let x = r() * W, y = r() * Hh; const a = r() * Math.PI, dx = Math.cos(a), dy = Math.sin(a) * 0.6;
    ctx.fillStyle = r() < 0.6 ? 'rgba(200,206,210,0.45)' : 'rgba(40,44,46,0.45)';
    for (let k = 0, n = 3 + r() * 12; k < n; k++) { ctx.fillRect(x | 0, y | 0, 1, 1); x += dx; y += dy; }
  }
  // coffee rings
  for (const [cx, cy, rad] of [[44, 9, 3.5], [48, 12, 3.2], [20, 26, 3.6]]) {
    for (let a = 0; a < 6.28; a += 0.3) { ctx.fillStyle = 'rgba(80,52,24,0.45)'; ctx.fillRect((cx + Math.cos(a) * rad) | 0, (cy + Math.sin(a) * rad) | 0, 1, 1); }
  }
  // cigarette burns and a scratched tally
  for (const [x, y] of [[12, 7], [53, 27], [33, 30]]) { ctx.fillStyle = '#2a2420'; ctx.fillRect(x, y, 2, 1); ctx.fillStyle = 'rgba(60,40,20,0.5)'; ctx.fillRect(x - 1, y - 1, 4, 3); }
  ctx.fillStyle = 'rgba(210,214,216,0.7)';
  for (let k = 0; k < 4; k++) ctx.fillRect(6 + k * 2, 28, 1, 4);
  for (let k = 0; k < 6; k++) ctx.fillRect(5 + k, 32 - k * 0.7, 1, 1);
});

const doorTex = () => ptex('door', 40, 88, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, (x, y) => {
    let v = (r() - 0.5) * 6 + Math.sin(y * 0.35) * 1.5;
    const e = Math.min(x, W - 1 - x);
    if (e === 2 || y === 3 || y === Hh - 4) v -= 14; // pressed panel edge
    if (e === 3) v += 6;
    if (y > 70) v -= (y - 70) * 0.9; // grime at the bottom
    return [70 + v, 86 + v, 98 + v];
  });
  // chipped paint near the handle (right side) and at kick height
  for (let i = 0; i < 70; i++) {
    const x = r() < 0.6 ? 26 + r() * 12 : r() * W;
    const y = r() < 0.6 ? 36 + r() * 16 : 62 + r() * 24;
    ctx.fillStyle = r() < 0.5 ? '#9ea4a8' : '#3a3c36';
    ctx.fillRect(x | 0, y | 0, 1 + (r() < 0.3), 1);
  }
  // dents
  for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(10,14,18,0.35)'; ctx.fillRect(4 + r() * 32, 50 + r() * 30, 3, 2); }
});

const paintTex = (key, base, chip) => ptex(key, 16, 16, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, () => { const v = (r() - 0.5) * 12; return [base[0] + v, base[1] + v, base[2] + v]; });
  for (let i = 0; i < 9; i++) { ctx.fillStyle = chip; ctx.fillRect(r() * W, r() * Hh, 1 + (r() < 0.4), 1); }
});

const woolTex = () => ptex('wool', 16, 32, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, (x, y) => { const v = ((x + y) % 3 === 0 ? -6 : 0) + ((x - y + 64) % 5 === 0 ? 5 : 0) + (r() - 0.5) * 8; return [72 + v, 62 + v, 58 + v]; });
});

const manilaTex = () => ptex('manila', 16, 16, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, (x, y) => { const e = Math.min(x, y, W - 1 - x, Hh - 1 - y); const v = (r() - 0.5) * 10 - (e === 0 ? 30 : 0); return [196 + v, 162 + v, 96 + v]; });
});

const photoBackTex = () => ptex('photoback', 16, 24, (ctx, W, Hh, r) => {
  paint(ctx, W, Hh, (x, y) => { const v = 214 + (r() - 0.5) * 8 - ((x + y * 3) % 9 === 0 ? 10 : 0); return [v, v - 2, v - 8]; });
  ctx.fillStyle = 'rgba(40,40,60,0.6)'; ctx.fillRect(3, 4, 7, 1); ctx.fillRect(3, 6, 4, 1);
  ctx.fillStyle = 'rgba(160,30,30,0.7)'; ctx.fillRect(10, 18, 3, 1); // case number in red pen
});

function textTex(key, w, h, bg, lines) {
  return ptex(key, w, h, (ctx, W, Hh, r) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    for (let i = 0; i < W * Hh * 0.08; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.15})`; ctx.fillRect(r() * W, r() * Hh, 1, 1); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of lines) { ctx.fillStyle = l.c; ctx.font = l.f; ctx.fillText(l.t, W / 2, l.y); }
  });
}

// ------------------------------------------------------------------ scene

export class InterrogationScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'interrogation';
    this.title = 'Допросная';
    this.background = 0x050607;
    this.camera = { distance: 6.2, height: 2.0, lookHeight: 1.15, lookZ: -1.0, fov: 34, minWidth: 6.4 };
    this.bounds = { walk: { minX: -3.1, maxX: 3.1, minZ: -2.3, maxZ: 1.0 }, camera: { minX: 0, maxX: 0 } };
    this.spin = [];
  }

  /** Lit, transparent decal (floor or wall). */
  decal(key, tex, w, h, x, y, z, { floor = false, ry = 0, rz = 0, opacity = 1, color = 0xffffff, parent = this.root } = {}) {
    const m = this.mat(`decal-${key}`, { map: tex, color, transparent: true, opacity, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    if (floor) p.rotation.x = -Math.PI / 2;
    p.rotation.z = rz;
    if (!floor) p.rotation.y = ry;
    p.position.set(x, y, z);
    p.renderOrder = 1;
    parent.add(p);
    return p;
  }

  build() {
    const root = this.root;
    this.steelMat = this.mat('irSteel', { map: steelTex(), color: 0xb4bcc4, metalness: 0.75, roughness: 0.38 });
    this.darkSteel = this.mat('irSteelDark', { map: steelTex(), color: 0x50585e, metalness: 0.7, roughness: 0.45 });
    this.buildShell();
    this.buildMirror();
    this.buildObservation();
    this.buildDoor();
    this.buildWallDressing();
    this.buildTable();
    this.buildLamp();
    this.buildForeground();
    this.buildLights();
    // painted VN backdrop: across the table to the one-way mirror
    this.shots = { interrogation: { pos: [-1.4, 1.45, 1.6], look: [0.8, 1.25, -2.8], fov: 52 } };
    this.vnHide = [];
    return root;
  }

  // ---------------------------------------------------------------- room shell

  buildShell() {
    const root = this.root;
    const wallTex = wallTexture();
    const wallMat = this.mat('irWall', { map: wallTex, color: 0xb8c2bc, roughness: 0.92 });
    // back wall with world-mapped UVs (u: 3.2 m per repeat, v: full height)
    const shape = new THREE.Shape();
    shape.moveTo(-SIDE, 0); shape.lineTo(SIDE, 0); shape.lineTo(SIDE, H); shape.lineTo(-SIDE, H); shape.lineTo(-SIDE, 0);
    for (const h of [
      { x0: -1.2, x1: 2.0, y0: 0.95, y1: 2.15 },     // mirror
      { x0: -3.2, x1: -2.2, y0: 0, y1: 2.15 },       // door
      { x0: -1.94, x1: -1.5, y0: 2.28, y1: 2.56 },   // vent
    ]) {
      const p = new THREE.Path();
      p.moveTo(h.x0, h.y0); p.lineTo(h.x0, h.y1); p.lineTo(h.x1, h.y1); p.lineTo(h.x1, h.y0); p.lineTo(h.x0, h.y0);
      shape.holes.push(p);
    }
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.08) / 3.2, pos.getY(i) / H);
    const back = new THREE.Mesh(geo, wallMat);
    back.position.z = BACK;
    root.add(back);
    // side walls
    const sideTex = wallTex.clone(); sideTex.needsUpdate = true; sideTex.repeat.set(8 / 3.2, 1);
    const sideMat = this.mat('irWallSide', { map: sideTex, color: 0x98a29c, roughness: 0.92 });
    for (const x of [-SIDE, SIDE]) this.plane(8, H, sideMat, x, H / 2, 1, x < 0 ? Math.PI / 2 : -Math.PI / 2);

    // floor: quarry tiles, the observation room gets a dark carpet
    const fTex = floorTexture().clone(); fTex.needsUpdate = true; fTex.repeat.set(10 / 2.4, 10 / 2.4);
    this.floor(-5, 5, -6, 4, this.mat('irFloor', { map: fTex, color: 0xa4aca8, roughness: 0.55, metalness: 0.05 }));
    const carpet = this.box(4.2, 0.01, 2.3, this.mat('obsCarpet', { color: 0x15181c, roughness: 1 }), 0.4, 0.005, BACK - 1.15);
    carpet.renderOrder = 0;

    // ceiling: stained acoustic tiles
    const cTex = ceilingTexture().clone(); cTex.needsUpdate = true; cTex.repeat.set(8 / 1.2, 8 / 1.2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), this.mat('irCeil', { map: cTex, color: 0x7c807e, roughness: 0.95 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 0); root.add(ceil);

    // rubber cove base
    const base = this.mat('irCove', { color: 0x1e2426, roughness: 0.7 });
    this.box(1.0, 0.1, 0.03, base, -3.4 + 0.0, 0.05, BACK + 0.015).scale.x = 0.36;
    this.box(5.8, 0.1, 0.03, base, 0.7, 0.05, BACK + 0.015);
    for (const x of [-SIDE + 0.015, SIDE - 0.015]) this.box(0.03, 0.1, 8, base, x, 0.05, 1);

    // panic strip (black channel, red pressure bar) — back wall and both sides
    const chan = new Batch(), red = new Batch();
    const strip = (x0, x1) => { chan.box(x1 - x0, 0.07, 0.03, (x0 + x1) / 2, 0.81, BACK + 0.016); red.box(x1 - x0 - 0.02, 0.025, 0.012, (x0 + x1) / 2, 0.81, BACK + 0.034); };
    strip(-SIDE, -3.27); strip(-2.13, SIDE);
    for (const s of [-1, 1]) {
      chan.box(0.03, 0.07, 6.8, s * (SIDE - 0.016), 0.81, 0.4);
      red.box(0.012, 0.025, 6.8, s * (SIDE - 0.034), 0.81, 0.4);
    }
    chan.mesh(this.mat('panicChan', { color: 0x15181a, roughness: 0.6 }), root);
    red.mesh(this.mat('panicRed', { color: 0x5a1010, roughness: 0.5, emissive: 0x080000 }), root);

    // acoustic panels on the side walls (perforated, stained)
    const acTex = ptex('acoustic', 32, 32, (ctx, W, Hh, r) => {
      paint(ctx, W, Hh, (x, y) => {
        if (x % 4 === 1 && y % 4 === 1) return [60, 60, 54];
        const e = Math.min(x, y, W - 1 - x, Hh - 1 - y);
        const v = 150 + (r() - 0.5) * 10 - (e === 0 ? 40 : 0) - (y > 22 ? (y - 22) * 2 : 0);
        return [v, v - 4, v - 14];
      });
      ctx.fillStyle = 'rgba(90,70,40,0.25)'; ctx.fillRect(18, 0, 6, 14);
    });
    const acMat = this.mat('irAcoustic', { map: acTex, color: 0x9a9a8e, roughness: 1 });
    for (const s of [-1, 1]) for (const z of [-1.9, -0.3, 1.3]) {
      this.box(0.04, 1.15, 1.4, acMat, s * (SIDE - 0.02), 1.65, z);
    }

    // conduit: one horizontal run high on the back wall + drops to the devices
    const cond = new Batch();
    const CY = 2.62, CZ = BACK + 0.04;
    cond.rod(0.012, [-SIDE, CY, CZ], [SIDE, CY, CZ]);
    cond.rod(0.012, [-SIDE + 0.02, CY + 0.04, CZ + 0.03], [-SIDE + 0.02, CY + 0.04, 3.5]); // along the left wall
    cond.rod(0.012, [-1.72, CY, CZ], [-1.72, 1.38, CZ]);   // switch / intercom
    cond.rod(0.012, [2.32, CY, CZ], [2.32, 1.53, CZ]);     // thermostat
    cond.rod(0.012, [3.3, CY, CZ], [3.3, CY, CZ + 0.18]);  // camera feed
    for (let x = -3.3; x < SIDE; x += 0.7) cond.box(0.03, 0.04, 0.02, x, CY, CZ - 0.01); // straps
    for (const [x, y] of [[-1.72, 2.1], [2.32, 2.0]]) cond.box(0.035, 0.04, 0.02, x, y, CZ - 0.01);
    cond.box(0.1, 0.1, 0.05, -0.6, CY, CZ - 0.005); // junction boxes
    cond.box(0.1, 0.1, 0.05, 2.32, CY, CZ - 0.005);
    cond.mesh(this.mat('irConduit', { map: steelTex(), color: 0x8a9298, metalness: 0.6, roughness: 0.45 }), root);

    // vent: frame, louvres, a slow fan behind, a dim draught of light from the duct
    const vx = -1.72, vy = 2.42;
    const vent = new Batch();
    vent.box(0.5, 0.03, 0.03, vx, vy + 0.155, BACK + 0.015);
    vent.box(0.5, 0.03, 0.03, vx, vy - 0.155, BACK + 0.015);
    vent.box(0.03, 0.31, 0.03, vx - 0.235, vy, BACK + 0.015);
    vent.box(0.03, 0.31, 0.03, vx + 0.235, vy, BACK + 0.015);
    for (let i = 0; i < 6; i++) vent.box(0.44, 0.012, 0.035, vx, vy - 0.12 + i * 0.048, BACK + 0.01, -0.6);
    vent.mesh(this.mat('irVent', { color: 0x6c7276, metalness: 0.5, roughness: 0.6 }), root);
    // duct box behind the wall
    const ductMat = this.mat('irDuct', { color: 0x15191c, roughness: 0.8, side: THREE.BackSide });
    this.box(0.44, 0.28, 0.4, ductMat, vx, vy, BACK - 0.2);
    const draught = this.plane(0.42, 0.26, new THREE.MeshBasicMaterial({ color: 0x1c2833 }), vx, vy, BACK - 0.38);
    draught.renderOrder = 0;
    const fan = new THREE.Group();
    const bladeMat = this.mat('irFan', { color: 0x0c0e10, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const b = this.box(0.2, 0.05, 0.006, bladeMat, 0.1, 0, 0, fan);
      const piv = new THREE.Group(); piv.rotation.z = i * Math.PI / 2; piv.add(b); fan.add(piv);
      b.rotation.x = 0.4;
    }
    this.box(0.04, 0.04, 0.03, bladeMat, 0, 0, 0, fan);
    fan.position.set(vx, vy, BACK - 0.14);
    root.add(fan);
    this.spin.push({ obj: fan, speed: -0.9 });
    // grime streaking down from the vent
    const ventStain = ptex('ventstain', 24, 40, (ctx, W, Hh, r) => {
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const a = (1 - y / Hh) ** 1.6 * 0.4 * (0.5 + 0.5 * Math.sin(x * 1.3 + r())) * (1 - Math.abs(x - W / 2) / (W / 2));
        if (a > 0.02) { ctx.fillStyle = `rgba(20,22,22,${a})`; ctx.fillRect(x, y, 1, 1); }
      }
    });
    this.decal('ventstain', ventStain, 0.5, 0.8, vx, vy - 0.55, BACK + 0.004);
    if (!this.low) {
      this.ventDust = new VentStream(new THREE.Vector3(vx, vy, BACK + 0.04), 50);
      root.add(this.ventDust.points);
      this.animated.push(this.ventDust);
    }

    // floor decals: table shadow, chair scuff arcs, drain with a wet stain
    const shadowTex = canvasTexture('ir-shadow', 64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.7, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(0.5, 0.006, -1.0); sh.renderOrder = 1;
    root.add(sh);
    const scuffTex = ptex('scuffs', 64, 64, (ctx, W, Hh, r) => {
      for (let i = 0; i < 26; i++) {
        const rad = 14 + r() * 16, a0 = r() * 6.28, len = 0.3 + r() * 0.9;
        ctx.fillStyle = `rgba(12,12,14,${0.25 + r() * 0.35})`;
        for (let a = a0; a < a0 + len; a += 0.05) ctx.fillRect((32 + Math.cos(a) * rad) | 0, (32 + Math.sin(a) * rad) | 0, 1, 1);
      }
          });
    this.decal('scuffs', scuffTex, 1.1, 1.1, -0.62, 0.007, -1.0, { floor: true });
    this.decal('scuffs', scuffTex, 1.1, 1.1, 1.66, 0.007, -1.0, { floor: true, rz: 2.1 });
    const drainTex = ptex('drain', 32, 32, (ctx, W, Hh, r) => {
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        let c = null;
        if (d < 7) c = (y % 3 === 0) ? 'rgb(14,14,14)' : (x % 3 === 0 ? 'rgb(20,20,20)' : 'rgb(96,100,98)');
        else if (d < 8.2) c = 'rgb(130,134,130)';
        else if (d < 9.5) c = `rgba(92,58,30,${0.7 - (d - 8.2) * 0.4})`;
        else if (d < 16) c = `rgba(18,22,22,${0.35 * (1 - (d - 9.5) / 6.5) + r() * 0.05})`;
        if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
      }
    });
    this.decal('drain', drainTex, 0.62, 0.62, -1.45, 0.008, 0.15, { floor: true });
    // a wet streak running towards it
    const wetTex = canvasTexture('ir-wet', 32, 64, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(10,14,16,0)'); g.addColorStop(1, 'rgba(10,14,16,0.45)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 1, 0, 0, 6.3); ctx.fill();
    });
    this.decal('wet', wetTex, 0.35, 0.9, -1.25, 0.0075, -0.35, { floor: true, rz: 0.4, opacity: 0.8, color: 0x8899aa });
    // tally scratched into the paint next to the mirror
    const tally = ptex('tally', 24, 12, (ctx) => {
      ctx.fillStyle = 'rgba(200,204,196,0.85)';
      for (let g = 0; g < 3; g++) { for (let k = 0; k < 4; k++) ctx.fillRect(1 + g * 8 + k * 1.5, 2, 1, 7); for (let k = 0; k < 6; k++) ctx.fillRect(g * 8 + k, 8 - k, 1, 1); }
    });
    this.decal('tally', tally, 0.18, 0.09, -1.52, 1.02, BACK + 0.004);
  }

  // ---------------------------------------------------------------- one-way mirror

  buildMirror() {
    const root = this.root;
    const MX = 0.4, MY = 1.55;
    // one-way mirror: dark reflective glass, the observation room faintly behind it
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.86, envMapIntensity: 1 });
    this.mirror = this.plane(3.2, 1.2, glass, MX, MY, BACK);
    this.mirrorMat = glass;
    // heavy gunmetal frame, a deep sill, bolt heads
    const fr = new Batch();
    fr.box(3.44, 0.12, 0.12, MX, 2.21, BACK + 0.03);
    fr.box(3.44, 0.1, 0.12, MX, 0.9, BACK + 0.03);
    fr.box(0.12, 1.42, 0.12, -1.26, MY, BACK + 0.03);
    fr.box(0.12, 1.42, 0.12, 2.06, MY, BACK + 0.03);
    fr.box(3.5, 0.03, 0.2, MX, 0.86, BACK + 0.08); // sill ledge
    // inner stop bead
    fr.box(3.2, 0.025, 0.03, MX, 2.14, BACK + 0.02);
    fr.box(3.2, 0.025, 0.03, MX, 0.96, BACK + 0.02);
    fr.box(0.025, 1.2, 0.03, -1.19, MY, BACK + 0.02);
    fr.box(0.025, 1.2, 0.03, 1.99, MY, BACK + 0.02);
    fr.mesh(this.mat('mirrorFrame', { map: steelTex(), color: 0x3a4046, metalness: 0.7, roughness: 0.42 }), root);
    const bolts = new Batch();
    for (let x = -1.1; x <= 1.95; x += 0.38) { bolts.cyl(0.012, 0.012, x, 2.21, BACK + 0.095, Math.PI / 2, 0, 0, 6); bolts.cyl(0.012, 0.012, x, 0.9, BACK + 0.095, Math.PI / 2, 0, 0, 6); }
    for (let y = 1.1; y < 2.1; y += 0.32) { bolts.cyl(0.012, 0.012, -1.26, y, BACK + 0.095, Math.PI / 2, 0, 0, 6); bolts.cyl(0.012, 0.012, 2.06, y, BACK + 0.095, Math.PI / 2, 0, 0, 6); }
    bolts.mesh(this.mat('irBolt', { color: 0x9aa2a8, metalness: 0.8, roughness: 0.3 }), root);

    // grime and handprints on the glass (lit, so it only shows where the light reaches)
    const smudge = ptex('smudge', 96, 36, (ctx, W, Hh, r) => {
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const e = Math.min(x, y, W - 1 - x, Hh - 1 - y);
        let a = e < 4 ? (4 - e) * 0.09 : 0;
        a += r() < 0.04 ? 0.08 : 0;
        if (a > 0) { ctx.fillStyle = `rgba(150,160,160,${a})`; ctx.fillRect(x, y, 1, 1); }
      }
      // wiped arcs
      for (let k = 0; k < 3; k++) {
        const cx = 15 + r() * 66, cy = 10 + r() * 16, rad = 8 + r() * 10;
        for (let a = 3.6; a < 5.6; a += 0.09) { if (r() < 0.5) continue; ctx.fillStyle = 'rgba(190,200,200,0.05)'; ctx.fillRect((cx + Math.cos(a) * rad) | 0, (cy + Math.sin(a) * rad * 0.6 + 6) | 0, 1, 1); }
      }
      // palm and finger prints low on the glass
      for (const [cx, cy] of [[30, 28], [58, 30], [64, 24]]) {
        ctx.fillStyle = 'rgba(200,205,205,0.16)'; ctx.fillRect(cx - 2, cy - 2, 5, 5);
        for (let f = 0; f < 4; f++) ctx.fillRect(cx - 3 + f * 2, cy - 6 - (f === 1 || f === 2 ? 1 : 0), 1, 3);
      }
      // a dried drip from the sill cleaner
      ctx.fillStyle = 'rgba(170,175,170,0.18)'; ctx.fillRect(80, 4, 1, 22);
    });
    const sm = this.plane(3.2, 1.2, this.mat('irSmudge', { map: smudge, transparent: true, depthWrite: false, roughness: 1, color: 0xffffff }), MX, MY, BACK + 0.004);
    sm.renderOrder = 3;

    // fake reflection: the lit table along the bottom, the lamp cone, a hot spot at the top
    const reflTex = canvasTexture('ir-refl', 128, 48, (ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const tx = (0.5 - (MX - 1.6)) / 3.2 * w; // table centre in mirror px
      let g = ctx.createRadialGradient(tx, h - 6, 2, tx, h - 6, 34);
      g.addColorStop(0, 'rgba(170,180,190,0.5)'); g.addColorStop(1, 'rgba(170,180,190,0)');
      ctx.save(); ctx.scale(1, 0.3); ctx.fillStyle = g; ctx.fillRect(0, (h - 40) / 0.3, w, 120 / 0.3); ctx.restore();
      g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(200,210,230,0.22)'); g.addColorStop(0.8, 'rgba(200,210,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(tx - 4, 0); ctx.lineTo(tx + 4, 0); ctx.lineTo(tx + 22, h); ctx.lineTo(tx - 22, h); ctx.fill();
      g = ctx.createRadialGradient(tx, 2, 0, tx, 2, 10); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, 14);
      // two diagonal sheen bands
      ctx.fillStyle = 'rgba(140,160,180,0.07)';
      for (const x0 of [14, 96]) { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 8, 0); ctx.lineTo(x0 - 10, h); ctx.lineTo(x0 - 18, h); ctx.fill(); }
    });
    this.reflMat = new THREE.MeshBasicMaterial({ map: reflTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    const refl = this.plane(3.2, 1.2, this.reflMat, MX, MY, BACK + 0.006);
    refl.renderOrder = 4;

    this.anchors.mirror = new THREE.Vector3(MX, MY, BACK + 0.1);
  }

  // ---------------------------------------------------------------- observation room

  buildObservation() {
    const root = this.root;
    const OB = BACK - 2.2;
    const obsWall = this.mat('obsWall', { color: 0x1c2024, roughness: 0.95 });
    this.box(4.4, H, 0.05, obsWall, 0.4, H / 2, OB);
    for (const x of [-1.7, 2.5]) this.box(0.05, H, 2.2, obsWall, x, H / 2, BACK - 1.1);
    // desk with the clutter of people who watch for a living
    const deskMat = this.mat('obsDesk', { color: 0x24282a, roughness: 0.6 });
    this.box(3.4, 0.04, 0.55, deskMat, 0.4, 0.88, BACK - 0.9);
    this.box(3.4, 0.84, 0.04, deskMat, 0.4, 0.44, BACK - 0.64);
    // CCTV monitor showing this room
    const cctv = ptex('cctv', 48, 32, (ctx, W, Hh, r) => {
      paint(ctx, W, Hh, (x, y) => { const v = 30 + (y % 2 ? 0 : 8) + (r() - 0.5) * 16; return [v * 0.7, v * 0.95, v * 1.2]; });
      ctx.fillStyle = 'rgb(110,130,150)'; ctx.fillRect(14, 18, 20, 2); ctx.fillRect(15, 20, 1, 7); ctx.fillRect(32, 20, 1, 7);
      ctx.fillStyle = 'rgb(70,84,100)'; ctx.fillRect(9, 12, 4, 10); ctx.fillRect(35, 12, 4, 10);
      ctx.fillStyle = 'rgb(200,40,40)'; ctx.fillRect(2, 2, 2, 2);
      ctx.fillStyle = 'rgb(170,190,200)'; ctx.font = '6px monospace'; ctx.fillText('CAM2', 6, 7);
    });
    const mon = new THREE.Group();
    this.box(0.46, 0.32, 0.05, this.mat('obsMonitor', { color: 0x0c0d0e, roughness: 0.5 }), 0, 0, 0, mon);
    this.plane(0.4, 0.27, new THREE.MeshBasicMaterial({ map: cctv, color: 0x9ab0c8 }), 0, 0, 0.027, 0, mon);
    this.box(0.06, 0.12, 0.06, this.mat('obsMonitor', {}), 0, -0.2, -0.02, mon);
    const mGlow = glow(0x6a90c0, 0.9, 0.18); mGlow.position.set(0, 0, 0.1); mon.add(mGlow);
    mon.position.set(-0.95, 1.16, BACK - 0.85); mon.rotation.y = 0.25;
    root.add(mon);
    // articulated desk lamp — warm, the only warm thing in the building
    const lampG = new THREE.Group();
    const lb = this.mat('obsLampBody', { color: 0x141414, roughness: 0.4, metalness: 0.4 });
    this.box(0.14, 0.02, 0.12, lb, 0, 0.01, 0, lampG);
    this.box(0.02, 0.32, 0.02, lb, 0, 0.17, 0, lampG).rotation.z = -0.35;
    this.box(0.02, 0.26, 0.02, lb, 0.12, 0.38, 0, lampG).rotation.z = 0.9;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 10, 1, true), this.mat('obsLampHead', { color: 0x141414, side: THREE.DoubleSide }));
    head.position.set(0.24, 0.42, 0); head.rotation.z = 0.5; lampG.add(head);
    this.deskGlow = glow(0xffb060, 0.5, 0.75); this.deskGlow.position.set(0.25, 0.38, 0.02); lampG.add(this.deskGlow);
    lampG.position.set(1.7, 0.9, BACK - 0.95); lampG.rotation.y = Math.PI;
    root.add(lampG);
    this.deskPool = lightPool(0xffa050, 0.9, 0.5, 0.25);
    this.deskPool.rotation.x = -Math.PI / 2; this.deskPool.position.set(1.5, 0.905, BACK - 0.9);
    root.add(this.deskPool);
    // mug, papers, a phone
    this.box(0.07, 0.09, 0.07, this.mat('obsMug', { color: 0x6a2420, roughness: 0.5 }), 1.25, 0.945, BACK - 0.8);
    this.box(0.3, 0.01, 0.22, this.mat('obsPaper', { color: 0xb8b8ae, roughness: 1 }), 0.3, 0.905, BACK - 0.85).rotation.y = 0.2;
    this.box(0.2, 0.06, 0.16, this.mat('obsPhone', { color: 0x1a1c1e, roughness: 0.5 }), -0.3, 0.93, BACK - 0.85);
    // corkboard with pinned case notes on the back wall
    const cork = ptex('cork', 48, 32, (ctx, W, Hh, r) => {
      paint(ctx, W, Hh, (x, y) => { const e = Math.min(x, y, W - 1 - x, Hh - 1 - y); if (e < 2) return [40, 30, 22]; const v = (r() - 0.5) * 24; return [120 + v, 84 + v, 50 + v]; });
      const note = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(40,40,50,0.5)'; for (let k = 2; k < h - 1; k += 2) ctx.fillRect(x + 1, y + k, w - 2 - (k % 4), 1); ctx.fillStyle = '#b02020'; ctx.fillRect(x + (w >> 1), y, 1, 1); };
      note(4, 4, 9, 11, '#d8d6cc'); note(16, 6, 8, 10, '#e0d890'); note(28, 3, 11, 13, '#d8d6cc'); note(8, 18, 10, 10, '#c8c8c0'); note(33, 18, 9, 9, '#a8b0b8');
      ctx.strokeStyle = 'rgba(170,20,20,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, 4); ctx.lineTo(33, 3); ctx.lineTo(37, 18); ctx.stroke();
    });
    this.plane(1.2, 0.8, this.mat('obsCork', { map: cork, color: 0x6a6a6a, roughness: 1 }), 0.45, 1.6, OB + 0.03);
    this.anchors.observers = [{ x: -0.3, z: BACK - 1.4 }, { x: 1.2, z: BACK - 1.5 }];
  }

  // ---------------------------------------------------------------- door

  buildDoor() {
    const root = this.root;
    const DX = -2.7, DZ = BACK - 0.02;
    const frameMat = this.mat('irDoorFrame', { map: steelTex(), color: 0x2c3236, metalness: 0.6, roughness: 0.5 });
    const fr = new Batch();
    fr.box(1.16, 0.08, 0.14, DX, 2.19, BACK);
    fr.box(0.08, 2.2, 0.14, DX - 0.54, 1.1, BACK);
    fr.box(0.08, 2.2, 0.14, DX + 0.54, 1.1, BACK);
    fr.mesh(frameMat, root);
    // leaf
    this.box(1.0, 2.15, 0.05, this.mat('irDoor', { map: doorTex(), color: 0xcfd6dc, metalness: 0.25, roughness: 0.55 }), DX, 1.075, DZ);
    // wired-glass window lit from the corridor
    const wired = ptex('wired', 16, 32, (ctx, W, Hh, r) => {
      paint(ctx, W, Hh, (x, y) => {
        if ((x + y) % 6 === 0 || (x - y + 60) % 6 === 0) return [52, 62, 60];
        const v = 150 - y * 1.6 + (r() - 0.5) * 10;
        return [v * 0.85, v, v * 0.95];
      });
      ctx.fillStyle = 'rgba(40,40,30,0.35)'; ctx.fillRect(0, 26, W, 6);
    });
    this.plane(0.24, 0.48, new THREE.MeshBasicMaterial({ map: wired, color: 0x9ab4ac }), DX + 0.16, 1.62, DZ + 0.027);
    const wf = new Batch();
    wf.box(0.3, 0.03, 0.03, DX + 0.16, 1.875, DZ + 0.03); wf.box(0.3, 0.03, 0.03, DX + 0.16, 1.365, DZ + 0.03);
    wf.box(0.03, 0.54, 0.03, DX + 0.01, 1.62, DZ + 0.03); wf.box(0.03, 0.54, 0.03, DX + 0.31, 1.62, DZ + 0.03);
    // hardware: kick plate, lever, lock, hinges, closer
    const hw = new Batch();
    hw.box(0.94, 0.26, 0.008, DX, 0.15, DZ + 0.029);
    hw.box(0.04, 0.16, 0.012, DX + 0.4, 1.02, DZ + 0.03);
    hw.box(0.14, 0.022, 0.022, DX + 0.34, 1.05, DZ + 0.06);
    hw.cyl(0.012, 0.04, DX + 0.4, 1.05, DZ + 0.045, Math.PI / 2, 0, 0);
    hw.cyl(0.016, 0.02, DX + 0.4, 1.2, DZ + 0.035, Math.PI / 2, 0, 0, 10);
    for (const y of [0.25, 1.05, 1.9]) hw.cyl(0.014, 0.12, DX - 0.5, y, DZ + 0.03);
    hw.box(0.32, 0.06, 0.06, DX - 0.22, 2.06, DZ + 0.05);
    hw.box(0.3, 0.015, 0.02, DX - 0.12, 2.1, DZ + 0.09, 0, 0.35, 0);
    hw.mesh(this.steelMat, root);
    wf.mesh(this.darkSteel, root);
    // corridor glow spilling under the door
    const spill = lightPool(0x9ec4b8, 1.0, 0.5, 0.18);
    spill.rotation.x = -Math.PI / 2; spill.position.set(DX, 0.011, BACK + 0.2);
    root.add(spill);
    const winGlow = glow(0x9ec4b8, 0.7, 0.12); winGlow.position.set(DX + 0.16, 1.62, DZ + 0.08); root.add(winGlow);
    // ROOM 2 sign over the door
    const sign = textTex('room2', 64, 24, '#1c2a34', [
      { t: 'ROOM 2', f: 'bold 10px monospace', c: '#e4e8e6', y: 9 },
      { t: 'SALLE 2', f: '6px monospace', c: '#9ab0bc', y: 18 },
    ]);
    this.plane(0.42, 0.16, this.mat('irSignRoom', { map: sign, roughness: 0.6 }), DX, 2.4, BACK + 0.01);
    this.anchors.door = new THREE.Vector3(DX, 1.9, BACK + 0.1);
  }

  // ---------------------------------------------------------------- wall dressing

  buildWallDressing() {
    const root = this.root;
    const W = BACK + 0.01;
    // light switch + intercom on the conduit drop
    const plate = this.mat('irPlate', { color: 0xb0aca0, roughness: 0.7 });
    this.box(0.08, 0.12, 0.015, plate, -1.72, 1.32, W);
    this.box(0.02, 0.035, 0.02, this.mat('irToggle', { color: 0xd8d4c8 }), -1.72, 1.32, W + 0.015);
    this.box(0.12, 0.16, 0.03, this.mat('irIntercom', { color: 0x30363a, roughness: 0.5 }), -1.72, 1.55, W + 0.008);
    const icLed = glow(0x40ff70, 0.05, 0.9); icLed.position.set(-1.69, 1.6, W + 0.03); root.add(icLed);

    // thermostat
    const thermo = textTex('thermo', 16, 20, '#c8c4b4', [{ t: '19°', f: 'bold 6px monospace', c: '#2a3a2a', y: 8 }]);
    this.box(0.085, 0.11, 0.025, this.mat('irThermo', { map: thermo, color: 0xffffff, roughness: 0.6 }), 2.32, 1.47, W + 0.004);

    // NO SMOKING / NON-FUMEURS — under the irony of the ashtray on the table
    const noSmoke = ptex('nosmoke', 32, 40, (ctx, Wd, Hh) => {
      ctx.fillStyle = '#e6e4da'; ctx.fillRect(0, 0, Wd, Hh);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(9, 15, 13, 3); ctx.fillStyle = '#c8501a'; ctx.fillRect(22, 15, 2, 3);
      ctx.strokeStyle = '#c01818'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(16, 16, 11, 0, 6.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(24, 24); ctx.stroke();
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 5px monospace'; ctx.textAlign = 'center'; ctx.fillText('NO SMOKING', 16, 33); ctx.fillText('NON-FUMEURS', 16, 38);
      ctx.fillStyle = 'rgba(120,100,60,0.25)'; ctx.fillRect(0, 0, 32, 3);
    });
    this.plane(0.2, 0.25, this.mat('irNoSmoke', { map: noSmoke, roughness: 0.7 }), 2.74, 1.58, W);

    // wall clock in a wire guard; minute hand moves, hour hand stuck past three
    const clockTex = ptex('clock', 48, 48, (ctx, Wd, Hh, r) => {
      ctx.fillStyle = '#d8d6ca'; ctx.beginPath(); ctx.arc(24, 24, 22, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#181818'; ctx.lineWidth = 3; ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
        ctx.fillStyle = '#151515';
        ctx.fillRect((24 + Math.cos(a) * (big ? 17 : 19)) | 0, (24 + Math.sin(a) * (big ? 17 : 19)) | 0, big ? 2 : 1, big ? 2 : 1);
      }
      ctx.fillStyle = '#111'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center';
      ctx.fillText('12', 24, 12); ctx.fillText('6', 24, 41); ctx.fillText('3', 38, 26); ctx.fillText('9', 10, 26);
      ctx.fillStyle = 'rgba(110,90,50,0.25)'; ctx.beginPath(); ctx.arc(24, 30, 18, 0.2, 2.9); ctx.fill();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(60,50,30,${r() * 0.2})`; ctx.fillRect(4 + r() * 40, 4 + r() * 40, 1, 1); }
    });
    const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), this.mat('irClockRim', { color: 0x1a1c1e, roughness: 0.5 }));
    clockBody.rotation.x = Math.PI / 2; clockBody.position.set(2.7, 2.25, BACK + 0.0);
    root.add(clockBody);
    this.plane(0.36, 0.36, this.mat('irclockMat', { map: clockTex }), 2.7, 2.25, BACK + 0.027);
    this.clockHand = new THREE.Mesh(bevelBox(0.01, 0.15, 0.005).clone(), this.mat('hand', { color: 0x111111 }));
    this.clockHand.geometry.translate(0, 0.075, 0);
    this.clockHand.position.set(2.7, 2.25, BACK + 0.04);
    root.add(this.clockHand);
    const hour = new THREE.Mesh(bevelBox(0.016, 0.1, 0.005).clone(), this.mat('hand', {}));
    hour.geometry.translate(0, 0.05, 0); hour.rotation.z = -1.95; hour.position.set(2.7, 2.25, BACK + 0.036);
    root.add(hour);
    const guard = new Batch();
    guard.add(new THREE.TorusGeometry(0.205, 0.006, 4, 24), 2.7, 2.25, BACK + 0.07);
    for (const gx of [-0.1, 0, 0.1]) guard.box(0.006, 0.4 - Math.abs(gx) * 1.2, 0.006, 2.7 + gx, 2.25, BACK + 0.075);
    guard.mesh(this.darkSteel, root);
    this.anchors.clock = new THREE.Vector3(2.7, 2.25, BACK + 0.1);

    // ceiling camera on an arm, red LED
    const cam = new THREE.Group();
    const camMat = this.mat('camBody', { color: 0x202224, roughness: 0.5 });
    this.box(0.2, 0.1, 0.11, camMat, 0, 0, 0, cam);
    this.box(0.24, 0.015, 0.14, camMat, 0.01, 0.06, 0, cam); // sunhood
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), this.mat('camLens', { color: 0x05070a, roughness: 0.1, metalness: 0.6 }));
    lens.rotation.z = Math.PI / 2; lens.position.set(-0.105, 0, 0); cam.add(lens);
    const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), this.mat('recLed', { color: 0, emissive: 0xff2020, emissiveIntensity: 4 }));
    camLed.position.set(-0.1, 0.035, 0.04); cam.add(camLed);
    const camGlow = glow(0xff2020, 0.14, 0.7); camGlow.position.copy(camLed.position); cam.add(camGlow);
    this.camGlow = camGlow;
    cam.position.set(3.3, 2.55, BACK + 0.3); cam.rotation.set(0, -0.6, 0.35);
    root.add(cam);
    this.box(0.03, 0.03, 0.26, this.darkSteel, 3.3, 2.62, BACK + 0.15);
    this.anchors.camera = new THREE.Vector3(3.3, 2.55, BACK + 0.3);

    // cast-iron radiator, chipped cream paint
    const rad = new Batch();
    for (let i = 0; i < 12; i++) rad.box(0.055, 0.56, 0.12, 2.42 + i * 0.07, 0.42, BACK + 0.12);
    rad.box(0.86, 0.04, 0.08, 2.805, 0.68, BACK + 0.12);
    rad.box(0.86, 0.04, 0.08, 2.805, 0.16, BACK + 0.12);
    for (const x of [2.44, 3.18]) rad.box(0.04, 0.12, 0.04, x, 0.06, BACK + 0.12);
    rad.mesh(this.mat('irRadiator', { map: paintTex('radpaint', [176, 168, 146], '#6e4a2a'), color: 0x8c887c, roughness: 0.75 }), root);
    const pipe = new Batch();
    pipe.rod(0.016, [3.3, 0.0, BACK + 0.12], [3.3, 0.22, BACK + 0.12]).rod(0.016, [3.3, 0.22, BACK + 0.12], [3.22, 0.22, BACK + 0.12]);
    pipe.cyl(0.03, 0.05, 2.36, 0.62, BACK + 0.12, 0, 0, Math.PI / 2, 8);
    pipe.mesh(this.mat('irPipe', { color: 0x5a4a3c, metalness: 0.5, roughness: 0.6 }), root);

    // a dark wool coat left on the hook by the door-side corner
    const coat = new THREE.Group();
    const woolMat = this.mat('irWool', { map: woolTex(), color: 0xffffff, roughness: 1 });
    const body = new THREE.BoxGeometry(0.42, 0.86, 0.08, 1, 2, 1);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.4) p.setX(i, p.getX(i) * 0.5); else if (y > 0) p.setX(i, p.getX(i) * 0.95); }
    body.computeVertexNormals();
    const bm = new THREE.Mesh(body, woolMat); bm.position.y = -0.43; coat.add(bm);
    this.box(0.1, 0.62, 0.07, woolMat, 0.2, -0.38, 0.03, coat).rotation.z = -0.06;
    this.box(0.22, 0.08, 0.1, woolMat, 0, -0.04, 0.02, coat); // collar
    this.box(0.012, 0.6, 0.005, this.mat('irCoatSeam', { color: 0x1a181c }), 0.02, -0.5, 0.043, coat);
    coat.position.set(3.3, 1.82, BACK + 0.07); coat.rotation.z = 0.03;
    root.add(coat);
    this.box(0.03, 0.03, 0.06, this.steelMat, 3.3, 1.83, BACK + 0.03);

    // wall stain halo where hands lean next to the door
    const hands = ptex('handgrime', 32, 32, (ctx, Wd, Hh, r) => {
      for (let i = 0; i < 260; i++) { const a = r() * 6.3, d = Math.sqrt(r()) * 15; ctx.fillStyle = 'rgba(16,18,18,0.07)'; ctx.fillRect((16 + Math.cos(a) * d) | 0, (16 + Math.sin(a) * d) | 0, 2, 2); }
    });
    this.decal('handgrime', hands, 0.45, 0.45, -2.0, 1.15, BACK + 0.003);
  }

  // ---------------------------------------------------------------- table, chairs, evidence

  buildTable() {
    const root = this.root;
    const steel = this.steelMat;
    // table: scuffed steel top, rolled edge, apron, legs bolted to the floor
    const top = this.mat('irTable', { map: tableTex(), color: 0x9a9ea4, roughness: 0.5, metalness: 0.35 });
    this.box(1.6, 0.05, 0.9, top, 0.5, 0.76, -1.0);
    const fr = new Batch();
    fr.box(1.62, 0.03, 0.02, 0.5, 0.765, -0.55); fr.box(1.62, 0.03, 0.02, 0.5, 0.765, -1.45);
    fr.box(0.02, 0.03, 0.9, -0.3, 0.765, -1.0); fr.box(0.02, 0.03, 0.9, 1.3, 0.765, -1.0);
    fr.box(1.44, 0.08, 0.02, 0.5, 0.69, -0.6); fr.box(1.44, 0.08, 0.02, 0.5, 0.69, -1.4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      fr.box(0.05, 0.74, 0.05, 0.5 + sx * 0.72, 0.37, -1.0 + sz * 0.38);
      fr.box(0.14, 0.01, 0.14, 0.5 + sx * 0.72, 0.005, -1.0 + sz * 0.38);
    }
    fr.box(1.4, 0.03, 0.03, 0.5, 0.14, -1.0); // foot rail
    // the cuff bar on the suspect's end
    fr.rod(0.009, [0.02, TOP, -1.16], [0.02, TOP + 0.06, -1.16]).rod(0.009, [0.02, TOP, -0.84], [0.02, TOP + 0.06, -0.84]);
    fr.rod(0.009, [0.02, TOP + 0.06, -1.16], [0.02, TOP + 0.06, -0.84]);
    fr.mesh(steel, root);
    const bolts = new Batch();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const [bx, bz] of [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]]) {
      bolts.cyl(0.009, 0.014, 0.5 + sx * 0.72 + bx, 0.012, -1.0 + sz * 0.38 + bz, 0, 0, 0, 6);
    }
    bolts.mesh(this.mat('irBolt', {}), root);
    this.colliders.push({ box: { minX: -0.35, maxX: 1.35, minZ: -1.5, maxZ: -0.5 } });

    // chairs (Julian's is bolted down and has an ankle ring)
    const seatMat = this.mat('irSeat', { map: paintTex('seat', [64, 70, 74], '#30363a'), roughness: 0.6, metalness: 0.2 });
    const chair = (x, ry, bolted) => {
      const g = new THREE.Group();
      const b = new Batch();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.rod(0.012, [sx * 0.2, 0, sz * 0.19], [sx * 0.19, 0.45, sz * 0.18]);
      for (const sz of [-1, 1]) b.rod(0.012, [-0.2, 0.45, sz * 0.18], [-0.24, 1.0, sz * 0.17]);
      b.rod(0.009, [-0.19, 0.18, -0.18], [-0.19, 0.18, 0.18]).rod(0.009, [0.19, 0.18, -0.18], [0.19, 0.18, 0.18]);
      b.rod(0.009, [-0.19, 0.18, 0.18], [0.19, 0.18, 0.18]);
      if (bolted) { b.box(0.5, 0.01, 0.46, 0, 0.005, 0); b.add(new THREE.TorusGeometry(0.035, 0.007, 5, 10), 0.21, 0.08, 0.19, 0, Math.PI / 2, 0); }
      b.mesh(steel, g);
      this.box(0.44, 0.04, 0.42, seatMat, 0, 0.47, 0, g);
      const back = this.box(0.03, 0.3, 0.4, seatMat, -0.225, 0.83, 0, g);
      back.rotation.z = 0.08;
      g.position.set(x, 0, -1.0); g.rotation.y = ry; root.add(g);
      return g;
    };
    chair(-0.55, 0, true);
    chair(1.6, Math.PI, false);
    this.anchors.julianSeat = { x: -0.5, z: -1.0 };
    this.anchors.officerSeat = { x: 1.55, z: -1.0 };
    this.anchors.table = new THREE.Vector3(0.5, 1.0, -1.0);
    this.anchors.julianChair = new THREE.Vector3(-0.55, 1.1, -1.0);

    // the paper cup the story fills later
    const cupGeo = new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.04, 0.11], [0.043, 0.112], [0.0, 0.112]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
    const cupMat = this.mat('cup', { color: 0xf0f0ec, roughness: 0.8 });
    this.cup = new THREE.Mesh(cupGeo, cupMat);
    this.cup.position.set(0.15, TOP, -0.8);
    root.add(this.cup);
    this.cup.visible = false;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.037, 12), this.mat('cupWater', { color: 0x9ab0c0, roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.095; this.cup.add(water);

    // case folders, an open file, photos face-down, notepad and pen
    const manila = this.mat('irManila', { map: manilaTex(), color: 0xffffff, roughness: 0.9 });
    const paper = this.mat('irPaper', { color: 0xa8a8a0, roughness: 1 });
    const stack = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const f = this.box(0.33, 0.012, 0.24, manila, (i - 1) * 0.008, 0.006 + i * 0.014, (i % 2) * 0.01, stack);
      f.rotation.y = (i - 1) * 0.06;
      this.box(0.31, 0.004, 0.22, paper, 0.012, 0.012 + i * 0.014, 0.004, stack).rotation.y = (i - 1) * 0.07 + 0.03;
    }
    this.box(0.08, 0.006, 0.03, manila, 0.1, 0.044, -0.13, stack); // tab
    stack.position.set(0.98, TOP, -1.18); stack.rotation.y = -0.12;
    root.add(stack);
    const openFile = new THREE.Group();
    this.box(0.5, 0.004, 0.27, manila, 0, 0.002, 0, openFile);
    const sheetTex = ptex('sheet', 16, 20, (ctx, Wd, Hh, r) => {
      ctx.fillStyle = '#dedcd2'; ctx.fillRect(0, 0, Wd, Hh);
      ctx.fillStyle = 'rgba(30,30,40,0.55)';
      for (let y = 3; y < Hh - 2; y += 2) ctx.fillRect(2, y, 5 + r() * 9, 1);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(10, 3, 4, 5); // mugshot box
    });
    const sheetMat = this.mat('irSheet', { map: sheetTex, color: 0xb0b0a8, roughness: 1 });
    this.plane(0.21, 0.26, sheetMat, -0.12, 0.006, 0, 0, openFile).rotation.set(-Math.PI / 2, 0, 0.04);
    this.plane(0.21, 0.26, sheetMat, 0.12, 0.007, 0, 0, openFile).rotation.set(-Math.PI / 2, 0, -0.05);
    openFile.position.set(1.0, TOP, -0.78); openFile.rotation.y = 0.18;
    root.add(openFile);
    const photoMat = this.mat('irPhoto', { map: photoBackTex(), color: 0xa8a8a0, roughness: 0.6 });
    [[0.38, -0.8, 0.25], [0.47, -0.77, -0.1], [0.56, -0.82, -0.42]].forEach(([x, z, r], i) => {
      const ph = this.plane(0.1, 0.15, photoMat, x, TOP + 0.002 + i * 0.001, z);
      ph.rotation.set(-Math.PI / 2, 0, r);
    });
    this.box(0.21, 0.008, 0.29, this.mat('irLegal', { color: 0xe0d070, roughness: 1 }), 1.16, TOP + 0.004, -0.95).rotation.y = -0.3;
    const pen = new Batch();
    pen.rod(0.005, [0, 0, 0], [0.14, 0, 0], 6);
    const penMesh = pen.mesh(this.mat('irPen', { color: 0x14284a, roughness: 0.4 }), root);
    penMesh.position.set(1.08, TOP + 0.014, -0.9); penMesh.rotation.y = 0.6;

    // digital recorder with a blinking REC LED
    const recTex = ptex('recorder', 24, 12, (ctx, Wd, Hh) => {
      ctx.fillStyle = '#18191b'; ctx.fillRect(0, 0, Wd, Hh);
      ctx.fillStyle = '#2c2e30'; for (let y = 2; y < 10; y += 2) for (let x = 2; x < 9; x += 2) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#5a7a5a'; ctx.fillRect(12, 3, 9, 4);
      ctx.fillStyle = '#c0e0b0'; ctx.fillRect(13, 4, 2, 2); ctx.fillRect(16, 4, 4, 1);
    });
    this.box(0.14, 0.04, 0.08, this.mat('recorder', { map: recTex, color: 0xffffff, roughness: 0.4 }), 0.5, 0.8, -1.25);
    const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 14, 10), this.mat('recLed', { color: 0, emissive: 0xff2020, emissiveIntensity: 4 }));
    recLed.position.set(0.55, 0.83, -1.21); root.add(recLed);
    const recGlow = glow(0xff2020, 0.08, 0.8); recLed.add(recGlow);
    this.recLed = recLed;

    // tin ashtray with butts, crushed cup, coffee, tissues, unlocked cuffs
    const tin = this.mat('irTin', { map: steelTex(), color: 0x7a8288, metalness: 0.7, roughness: 0.4 });
    const ash = new THREE.Group();
    ash.add(new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.065, 0.022], [0.058, 0.022], [0.052, 0.006], [0, 0.006]].map(([a, b]) => new THREE.Vector2(a, b)), 14), tin));
    const ashBed = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), this.mat('irAsh', { color: 0x4a4a48, roughness: 1 }));
    ashBed.rotation.x = -Math.PI / 2; ashBed.position.y = 0.012; ash.add(ashBed);
    const butts = new Batch();
    [[0.0, 0.3], [0.02, -0.9], [-0.02, 2.2]].forEach(([o, a]) => butts.box(0.045, 0.01, 0.01, Math.cos(a) * 0.025 + o, 0.018, Math.sin(a) * 0.025, 0, a, 0.15));
    butts.mesh(this.mat('irButt', { color: 0xc89058, roughness: 0.9 }), ash);
    ash.position.set(0.3, TOP, -1.3);
    root.add(ash);
    const crushed = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 16), cupMat);
    const cp = crushed.geometry.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setX(i, cp.getX(i) * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))));
    crushed.geometry.computeVertexNormals();
    crushed.rotation.set(0.2, 0.6, Math.PI / 2); crushed.position.set(0.76, TOP + 0.025, -1.33);
    root.add(crushed);
    const coffee = new THREE.Mesh(cupGeo, cupMat); coffee.position.set(1.2, TOP, -1.25); root.add(coffee);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.044, 0.012, 14), this.mat('irLid', { color: 0x1c1c1c, roughness: 0.5 }));
    lid.position.y = 0.116; coffee.add(lid);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.036, 0.045, 14, 1, true), this.mat('irSleeve', { color: 0x8a6a44, roughness: 1 }));
    sleeve.position.y = 0.06; coffee.add(sleeve);
    const tissues = new THREE.Group();
    this.box(0.2, 0.09, 0.11, this.mat('irTissueBox', { map: paintTex('tissuebox', [120, 150, 170], '#d0d8e0'), roughness: 0.8 }), 0, 0.045, 0, tissues);
    const tissue = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 5), this.mat('irTissue', { color: 0xeeeeea, roughness: 1 }));
    tissue.position.set(0.01, 0.12, 0); tissue.rotation.z = 0.2; tissues.add(tissue);
    tissues.position.set(0.09, TOP, -1.33); tissues.rotation.y = 0.15;
    root.add(tissues);
    const cuffs = new Batch();
    cuffs.add(new THREE.TorusGeometry(0.03, 0.006, 4, 12, Math.PI * 1.6), 0.0, 0.004, 0, Math.PI / 2, 0, 0);
    cuffs.add(new THREE.TorusGeometry(0.03, 0.006, 4, 12, Math.PI * 1.6), 0.09, 0.004, 0.02, Math.PI / 2, 0, 1.2);
    cuffs.box(0.04, 0.006, 0.008, 0.045, 0.006, 0.01, 0, 0.2, 0);
    const cm = cuffs.mesh(steel, root); cm.position.set(0.1, TOP, -1.05);
  }

  // ---------------------------------------------------------------- the lamp

  buildLamp() {
    const root = this.root;
    const pivot = new THREE.Group();
    pivot.position.set(0.5, H, -1.0);
    root.add(pivot);
    this.lampPivot = pivot;
    // canopy, cord, enamel shade (dark outside, white inside), cage, bulb
    this.box(0.12, 0.03, 0.12, this.darkSteel, 0, -0.015, 0, pivot);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.42, 16), this.mat('irCord', { color: 0x0c0c0c }));
    cord.position.y = -0.24; pivot.add(cord);
    const prof = [[0.035, 0.12], [0.06, 0.1], [0.12, 0.06], [0.22, -0.02], [0.28, -0.08], [0.3, -0.1]].map(([a, b]) => new THREE.Vector2(a, b));
    const shadeGeo = new THREE.LatheGeometry(prof, 20);
    const out = new THREE.Mesh(shadeGeo, this.mat('irShadeOut', { color: 0x2c3a36, metalness: 0.5, roughness: 0.45, side: THREE.FrontSide }));
    const inn = new THREE.Mesh(shadeGeo, this.mat('irShadeIn', { color: 0xe8eadf, emissive: 0x8a8c86, emissiveIntensity: 0.8, side: THREE.BackSide }));
    out.position.y = -0.5; inn.position.y = -0.5;
    pivot.add(out, inn);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.008, 4, 24), this.darkSteel);
    rim.rotation.x = Math.PI / 2; rim.position.y = -0.6; pivot.add(rim);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), this.mat('irBulb', { color: 0, emissive: 0xf4f6ff, emissiveIntensity: 5 }));
    bulb.position.y = -0.58; pivot.add(bulb);
    this.bulbGlow = glow(0xeef2ff, 0.6, 0.55); this.bulbGlow.material = this.bulbGlow.material.clone(); this.bulbGlow.position.y = -0.62; pivot.add(this.bulbGlow);
    this.lamp = new THREE.SpotLight(0xf0f4ff, 30, 6, 0.75, 0.6, 1.4);
    this.lamp.position.set(0, -0.6, 0); this.lamp.target.position.set(0, -H, 0);
    pivot.add(this.lamp, this.lamp.target);
    this.cone = lightCone(0xe8eeff, 2.1, 1.3, 0.18);
    this.cone.position.set(0, -0.6 - 1.05, 0); pivot.add(this.cone);
    // a hard pool on the table and floor
    const pool = lightPool(0xe8eeff, 2.8, 2.2, 0.12);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0.5, 0.013, -1.0); root.add(pool);
    // dust turning slowly in the beam
    this.beamDust = new BeamDust(new THREE.Vector3(0.5, 2.15, -1.0), 1.3, 0.25, 0.9, this.low ? 70 : 170);
    root.add(this.beamDust.points);
    this.animated.push(this.beamDust);
    // cold haze hanging in the room
    const haze = lightPool(0x8aa0c0, 4.5, 2.6, 0.05);
    haze.position.set(0.4, 1.5, -2.2); haze.renderOrder = 3;
    root.add(haze);
  }

  // ---------------------------------------------------------------- foreground

  buildForeground() {
    const root = this.root;
    const steel = this.steelMat;
    // water cart with a jug — fades if it would cover the table
    const fg = new THREE.Group();
    fg.name = 'fg-cart';
    const c = new Batch();
    c.box(0.6, 0.03, 0.4, 0, 0.8, 0); c.box(0.6, 0.03, 0.4, 0, 0.3, 0);
    for (const y of [0.83, 0.33]) { c.box(0.6, 0.03, 0.01, 0, y, 0.2); c.box(0.6, 0.03, 0.01, 0, y, -0.2); c.box(0.01, 0.03, 0.4, -0.3, y, 0); c.box(0.01, 0.03, 0.4, 0.3, y, 0); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { c.box(0.025, 0.76, 0.025, sx * 0.29, 0.44, sz * 0.19); c.cyl(0.03, 0.02, sx * 0.29, 0.03, sz * 0.19, Math.PI / 2, 0, 0, 8); }
    c.rod(0.012, [-0.32, 0.8, -0.16], [-0.32, 0.98, -0.16]).rod(0.012, [-0.32, 0.8, 0.16], [-0.32, 0.98, 0.16]).rod(0.012, [-0.32, 0.98, -0.16], [-0.32, 0.98, 0.16]);
    c.mesh(steel, fg);
    // the jug: plastic shell, water inside, blue cap
    const jugShell = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.09, 0.02], [0.09, 0.22], [0.06, 0.28], [0.03, 0.3], [0.03, 0.33], [0, 0.33]].map(([a, b]) => new THREE.Vector2(a, b)), 16),
      new THREE.MeshStandardMaterial({ color: 0xcfe6f6, transparent: true, opacity: 0.35, roughness: 0.15, depthWrite: false }));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 14), new THREE.MeshStandardMaterial({ color: 0x6c90a8, transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false }));
    water.position.y = 0.09;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 16), this.mat('irJugCap', { color: 0x1a4a8a, roughness: 0.5 }));
    cap.position.y = 0.335;
    const jug = new THREE.Group(); jug.add(water, jugShell, cap); jug.position.set(0.1, 0.815, 0);
    fg.add(jug);
    // stacked paper cups, a box of files below, a roll of paper towels
    const cupStack = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.032, 0.24, 16), this.mat('cup', {}));
    cupStack.position.set(-0.16, 0.935, 0.06); fg.add(cupStack);
    const ring = new Batch(); for (let i = 0; i < 6; i++) ring.add(new THREE.TorusGeometry(0.041 - i * 0.001, 0.003, 3, 12), -0.16, 0.84 + i * 0.035, 0.06, Math.PI / 2, 0, 0);
    ring.mesh(this.mat('cupRim', { color: 0xc8c8c0, roughness: 0.8 }), fg);
    const boxLabel = textTex('evbox', 32, 16, '#8a6a44', [{ t: 'CASE 24-117', f: 'bold 5px monospace', c: '#1a1410', y: 6 }, { t: 'R.C.M.P.', f: '4px monospace', c: '#2a2010', y: 12 }]);
    this.box(0.4, 0.22, 0.3, this.mat('irEvBox', { map: boxLabel, color: 0xffffff, roughness: 0.95 }), -0.05, 0.43, 0, fg);
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16), this.mat('irTowel', { color: 0xe0ded4, roughness: 1 }));
    roll.position.set(0.21, 0.43, 0.02); fg.add(roll);
    fg.position.set(-2.4, 0, 1.9);
    fg.rotation.y = 0.12;
    root.add(fg);
    this.foregroundGroups.push(fg);
    this.anchors.jug = new THREE.Vector3(-2.3, 1.1, 1.9);

    // right foreground: a dented bin of paper cups and a stacked spare chair
    const fg2 = new THREE.Group();
    fg2.name = 'fg-bin';
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 16, 1, true), this.mat('irBin', { map: steelTex(), color: 0x4a5056, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide }));
    bin.position.set(0, 0.21, 0); fg2.add(bin);
    const trash = new Batch();
    for (let i = 0; i < 6; i++) trash.box(0.07, 0.05, 0.07, Math.cos(i * 2.1) * 0.08, 0.39 + (i % 3) * 0.02, Math.sin(i * 2.1) * 0.08, i, i * 0.7, i * 0.3);
    trash.mesh(this.mat('irPaper', {}), fg2);
    const spare = new Batch();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) spare.rod(0.012, [0.45 + sx * 0.2, 0, sz * 0.19], [0.45 + sx * 0.19, 0.45, sz * 0.18]);
    for (const sz of [-1, 1]) spare.rod(0.012, [0.65, 0.45, sz * 0.18], [0.69, 1.0, sz * 0.17]);
    spare.mesh(steel, fg2);
    this.box(0.44, 0.04, 0.42, this.mat('irSeat', {}), 0.45, 0.47, 0, fg2);
    this.box(0.03, 0.3, 0.4, this.mat('irSeat', {}), 0.675, 0.83, 0, fg2).rotation.z = -0.08;
    fg2.position.set(1.62, 0, 2.35);
    fg2.rotation.y = -0.3;
    root.add(fg2);
    this.foregroundGroups.push(fg2);
  }

  // ---------------------------------------------------------------- light rig

  buildLights() {
    const root = this.root;
    // one hard overhead lamp above the table (built in buildLamp), a cold fill
    const hemi = new THREE.HemisphereLight(0x9aa8b8, 0x1a1c1e, 0.7);
    root.add(hemi);
    // cold wash on the back wall, as if from a corridor fluorescent somewhere behind us
    const fill = new THREE.SpotLight(0x8ea6c8, 9, 14, 0.62, 0.95, 1.2);
    fill.position.set(0.2, 2.7, 3.6); fill.target.position.set(0.3, 1.2, BACK);
    root.add(fill, fill.target);
    // observation room: cold ceiling light + warm desk lamp
    const obsLight = new THREE.PointLight(0x7090b0, 0.6, 3, 1.6);
    obsLight.position.set(0.4, 2.2, BACK - 1.2);
    root.add(obsLight);
    this.obsLight = obsLight;
    if (!this.low) {
      this.deskLight = new THREE.PointLight(0xffa860, 0.25, 2.6, 1.6);
      this.deskLight.position.set(1.45, 1.25, BACK - 1.1);
      root.add(this.deskLight);
      // greenish corridor light leaking through the wired glass
      const door = new THREE.PointLight(0x9ec4b8, 0.9, 2.4, 1.6);
      door.position.set(-2.55, 1.6, BACK + 0.35);
      root.add(door);
    }
    this.lights = { hemi, lamp: this.lamp, fill };
  }

  /** Light behind the mirror up → the watchers become visible through the glass. */
  setObserved(v) {
    this.obsLight.intensity = v ? 3.5 : 0.6;
    this.mirrorMat.opacity = v ? 0.6 : 0.86;
    if (this.reflMat) this.reflMat.opacity = v ? 0.22 : 0.5;
    if (this.deskLight) this.deskLight.intensity = v ? 2.2 : 0.25;
    if (this.deskPool) this.deskPool.material.opacity = v ? 0.45 : 0.15;
  }

  update(dt) {
    super.update(dt);
    this.clockHand.rotation.z = -this.time * 0.105;
    this.recLed.visible = Math.floor(this.time * 1.2) % 2 === 0;
    for (const s of this.spin) s.obj.rotation.z += s.speed * dt;
    // the buzzing lamp, swaying a hair on its cord
    const dip = Math.random() < 0.004 ? 0.4 : 1;
    const k = (0.97 + Math.random() * 0.03) * dip;
    this.lamp.intensity = 30 * k;
    this.cone.material.uniforms.uOpacity.value = 0.18 * k;
    this.bulbGlow.material.opacity = 0.55 * k;
    this.beamDust.gain = k;
    this.lampPivot.rotation.z = Math.sin(this.time * 0.55) * 0.012;
    this.lampPivot.rotation.x = Math.sin(this.time * 0.41 + 1) * 0.008;
  }
}
