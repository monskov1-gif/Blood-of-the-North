import * as THREE from 'three';
import { flareSource } from '../../fx/WindowLight.js';
import { bevelBox, smoothNormals, roundedBox } from '../nature.js';
import { LocationBase } from '../LocationBase.js';
import { streetTexture, canvasTexture, rng, beamTexture } from '../../render/textures.js';
import { glow, lightCone, pixTex } from '../props.js';

/**
 * Whitehorse RCMP detachment — side-on cut-away of the ground floor, the
 * morning after the massacre.
 *   x -14 … -11  vestibule: glass doors, boot tray, coat rack, wet prints
 *   x -11 …  -8  reception counter behind bullet-proof glass, flags, crest
 *   x  -8 …  -1  waiting area: seat rows, notice board, map, TV, vending
 *   x  -1 …  4.4 detectives' offices behind glass + blinds (lamp-lit)
 *   x 4.4 …  7.8 holding cell (alcove behind the back wall, barred front)
 *   x 7.8 … 14   coffee corner, med post, evidence, interrogation door, lockers
 * Foreground (z 2.4 … 4): chairs, pillars, ficus, bin, desk — fade via SafeZones.
 *
 * Static geometry is merged per material (Batch) to keep draw calls low;
 * textures are tiny nearest-filtered canvases (pixel-art register, ~1–2 cm/px).
 */
const BACK = -4;
const H = 3.0;

// ------------------------------------------------------------------ geometry batching

const UNIT = { box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1) };
const cylCache = new Map();
function unitCyl(seg, taper) {
  const k = `${seg}-${taper}`;
  if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(taper, 1, 1, seg));
  return cylCache.get(k);
}

function mergeList(list) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const [g, m] of list) {
    nm.getNormalMatrix(m);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z;
      if (U) { uv[(vo + i) * 2] = U.getX(i); uv[(vo + i) * 2 + 1] = U.getY(i); }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < P.count; i++) idx[io++] = vo + i;
    vo += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/** Collects static pieces and merges them into one mesh per material. */
class Batch {
  constructor() { this.map = new Map(); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ'); }
  add(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(sx, sy, sz));
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push([geo, m]);
  }
  /** Box with a real chamfered edge (radius r, ~1/5 of the thinnest side, ≤ 1.4 cm). */
  box(w, h, d, mat, x, y, z, ry = 0, rx = 0, rz = 0, r) { this.add(chamferBox(w, h, d, r), mat, x, y, z, 1, 1, 1, rx, ry, rz); }
  plane(w, h, mat, x, y, z, ry = 0, rx = 0, rz = 0) { this.add(UNIT.plane, mat, x, y, z, w, h, 1, rx, ry, rz); }
  cyl(r, h, mat, x, y, z, { seg = 8, taper = 1, rx = 0, rz = 0, ry = 0 } = {}) { this.add(unitCyl(Math.max(16, seg), taper), mat, x, y, z, r, h, r, rx, ry, rz); }
  flush(parent) {
    for (const [mat, list] of this.map) parent.add(new THREE.Mesh(mergeList(list), mat));
    this.map.clear();
  }
}

/** Box with world-scaled UVs (u = x/uS, v = y/vS) so wall textures continue across it. */
function uvBox(w, h, d, ox, oz, uS = 4, vS = H) {
  const g = bevelBox(w, h, d).clone();
  g.translate(0, h / 2, 0);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i), z = p.getZ(i) + oz;
    if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, x / uS, z / uS);
    else if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, z / uS, y / vS);
    else uv.setXY(i, x / uS, y / vS);
  }
  return g;
}

// ------------------------------------------------------------------ detailed geometry

const chamCache = new Map();
/**
 * A box whose edges are rounded inside a narrow band (radius r) — flat faces stay flat,
 * only the edges catch the light. Indexed, cached, never mutate.
 */
export function chamferBox(w, h, d, r) {
  if (r == null) r = Math.min(0.014, 0.2 * Math.min(w, h, d));
  const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${r.toFixed(4)}`;
  let g = chamCache.get(key);
  if (g) return g;
  if (r < 0.0025) { g = new THREE.BoxGeometry(w, h, d); chamCache.set(key, g); return g; }
  g = new THREE.BoxGeometry(w, h, d, 3, 3, 3);
  const p = g.attributes.position, uv = g.attributes.uv;
  const half = [w / 2, h / 2, d / 2], inner = half.map((v) => v - r);
  const v = [0, 0, 0];
  for (let i = 0; i < p.count; i++) {
    v[0] = p.getX(i); v[1] = p.getY(i); v[2] = p.getZ(i);
    for (let a = 0; a < 3; a++) if (Math.abs(Math.abs(v[a]) - half[a] / 3) < 1e-5) v[a] = Math.sign(v[a]) * inner[a];
    const c = v.map((t, a) => Math.max(-inner[a], Math.min(inner[a], t)));
    const o = v.map((t, a) => t - c[a]);
    const L = Math.hypot(o[0], o[1], o[2]);
    if (L > 1e-9) for (let a = 0; a < 3; a++) v[a] = c[a] + o[a] / L * r;
    p.setXYZ(i, v[0], v[1], v[2]);
  }
  // keep the texture spread over the whole face (grid lines moved from 1/3 to the bevel)
  const su = [d, d, w, w, w, w], sv = [h, h, d, d, h, h];
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 16), m = (t, s) => (Math.abs(t - 1 / 3) < 1e-4 ? r / s : Math.abs(t - 2 / 3) < 1e-4 ? 1 - r / s : t);
    uv.setXY(i, m(uv.getX(i), su[f]), m(uv.getY(i), sv[f]));
  }
  smoothNormals(g);
  chamCache.set(key, g);
  return g;
}

/** Closed outline from a centre-line (2-D points) offset by ±t/2 — for moulded shells, brackets. */
export function thickPath(pts, t) {
  const out = [], inn = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    out.push(new THREE.Vector2(pts[i][0] - ty * t / 2, pts[i][1] + tx * t / 2));
    inn.push(new THREE.Vector2(pts[i][0] + ty * t / 2, pts[i][1] - tx * t / 2));
  }
  return new THREE.Shape([...out, ...inn.reverse()]);
}

/** Extrude a (z, y) side profile across x (width w, centred), soft rounded edges. */
export function profileX(shape, w, bevel = 0.006) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, w - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);
  g.translate(w / 2 - bevel, 0, 0);
  smoothNormals(g);
  return g;
}

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };

/**
 * Moulded polypropylene seat shell (one piece: lip, dished pan, curved back), back towards +z.
 * Centre-line sampled from a spline, 2.2 cm wall, rounded side edges.
 */
function shellGeo(w) {
  return cached(`shell-${w.toFixed(3)}`, () => {
    const ctrl = [[-0.24, 0.425], [-0.222, 0.458], [-0.16, 0.468], [-0.03, 0.458], [0.09, 0.462], [0.165, 0.488], [0.2, 0.56], [0.214, 0.68], [0.232, 0.8], [0.244, 0.872], [0.236, 0.9]];
    const curve = new THREE.CatmullRomCurve3(ctrl.map(([z, y]) => new THREE.Vector3(z, y, 0)));
    const pts = curve.getSpacedPoints(36).map((v) => [v.x, v.y]);
    const g = profileX(thickPath(pts, 0.012), w, 0.007);
    // sculpt the outline: pinched waist at the bend, arched back top, rounded front corners
    const p = g.attributes.position, hw = w / 2;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = Math.min(1, Math.abs(x) / hw);
      let f = 1 - 0.1 * Math.exp(-(((y - 0.6) / 0.07) ** 2));
      if (y > 0.7) f *= 1 - 0.07 * (y - 0.7) / 0.2;
      if (z < -0.12) f *= 1 - 0.12 * ((-0.12 - z) / 0.12) ** 2;
      const ny = y > 0.68 ? y - (y - 0.68) * 0.4 * u ** 3 : y;
      p.setXYZ(i, x * f, ny, z);
    }
    return smoothNormals(g);
  });
}

/** Lathe from [r, y] pairs. */
export function lathe(key, pts, seg = 24) {
  return cached(`lathe-${key}`, () => {
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    smoothNormals(g);
    return g;
  });
}

/** Open-top bin with a rolled rim: [rBottom, rTop, height]. */
function binGeo(rb, rt, h) {
  return lathe(`bin-${rb}-${rt}-${h}`, [[0, 0.004], [rb - 0.012, 0], [rb, 0.012], [rb + (rt - rb) * 0.5, h * 0.5], [rt, h - 0.02], [rt + 0.012, h - 0.012], [rt + 0.014, h], [rt + 0.004, h + 0.008], [rt - 0.01, h - 0.004], [rt - 0.014, h - 0.03], [rb - 0.012, 0.03], [0, 0.03]], 28);
}

/** A sheet-like leaf (pointed oval, folded along the midrib), 1 m long along +x. */
function leafGeo() {
  return cached('leaf', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.25, 0.26, 0.7, 0.24, 1, 0);
    s.bezierCurveTo(0.7, -0.24, 0.25, -0.26, 0, 0);
    const g = new THREE.ShapeGeometry(s, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.abs(z) * 0.35 - x * x * 0.18); }
    g.computeVertexNormals();
    return g;
  });
}

// ------------------------------------------------------------------ pixel textures

function hashStr(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function ptex(key, w, h, draw, { repeat = [1, 1], nearest = true, color = true } = {}) {
  return canvasTexture(`st2-${key}`, w, h, (ctx, W, Hh) => draw(ctx, W, Hh, rng(hashStr(key))), { nearest, aniso: 1, color, repeat });
}
function noise(ctx, w, h, amt, r) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const n = (r() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}
const rgb = (c, k = 0) => `rgb(${Math.max(0, c[0] + k) | 0},${Math.max(0, c[1] + k) | 0},${Math.max(0, c[2] + k) | 0})`;
function text(ctx, s, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px monospace`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(s, x, y);
}
function lines(ctx, x, y, w, n, color, step = 3, r = Math.random) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) ctx.fillRect(x, y + i * step, Math.max(2, Math.round(w * (0.55 + r() * 0.45))), 1);
}

function floorTex() {
  return ptex('floor', 128, 128, (ctx, w, h, r) => {
    const img = ctx.createImageData(w, h), d = img.data;
    const tones = [];
    for (let i = 0; i < 64; i++) {
      const t = (r() - 0.5) * 8;
      tones.push(r() < 0.12 ? [92 + t, 98 + t, 94 + t] : [118 + t, 120 + t, 108 + t]);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = tones[(y >> 4) * 8 + (x >> 4)];
      let k = (r() - 0.5) * 12;
      if (r() < 0.05) k += r() < 0.5 ? -22 : 18;
      if ((x & 15) === 0 || (y & 15) === 0) k -= 30;
      const i = (y * w + x) * 4;
      d[i] = c[0] + k; d[i + 1] = c[1] + k; d[i + 2] = c[2] + k; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(16,14,12,${0.15 + r() * 0.3})`;
      const x = r() * w, y = r() * h;
      ctx.fillRect(x, y, 3 + r() * 9, 1);
    }
  });
}

function wallTex() {
  return ptex('wall', 256, 192, (ctx, w, h, r) => {
    const PX = 64;
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const ym = (h - y) / PX;
      const course = Math.floor((h - y) / 13);
      for (let x = 0; x < w; x++) {
        let c;
        let k = (r() - 0.5) * 8;
        if (ym < 0.11) { c = ym > 0.095 ? [58, 54, 50] : [30, 28, 27]; }
        else if (ym < 1.07) {
          c = [66, 92, 96];
          if ((h - y) % 13 === 0 || (x + (course % 2) * 16) % 32 === 0) k -= 14;
          if (ym < 0.25) k -= 10 * (1 - (ym - 0.11) / 0.14);
        } else if (ym < 1.14) { c = ym > 1.125 ? [64, 74, 76] : [30, 38, 40]; }
        else {
          c = [176, 170, 148];
          if ((h - y) % 13 === 0 || (x + (course % 2) * 16) % 32 === 0) k -= 16;
          else if ((h - y) % 13 === 12) k += 6;
          k -= 38 * Math.max(0, (ym - 2.1) / 0.9) ** 1.5;
        }
        const i = (y * w + x) * 4;
        d[i] = c[0] + k; d[i + 1] = c[1] + k; d[i + 2] = c[2] + k; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // water stains from the ceiling
    for (let i = 0; i < 9; i++) {
      const x = r() * w, len = 20 + r() * 60;
      for (let y = 0; y < len; y++) { ctx.fillStyle = `rgba(110,80,40,${0.16 * (1 - y / len)})`; ctx.fillRect(x + Math.sin(y * 0.2) * 1.5, y, 2, 1); }
    }
    // chipped paint on the wainscot (grey block shows through)
    for (let i = 0; i < 60; i++) {
      const x = r() * w, y = h - (0.2 + r() * 0.85) * PX, s = 1 + r() * 3;
      ctx.fillStyle = 'rgba(20,26,28,0.6)'; ctx.fillRect(x - 1, y - 1, s + 2, s + 1);
      ctx.fillStyle = '#8e8c84'; ctx.fillRect(x, y, s, s * 0.7);
    }
    // scuffs where chairs and boots hit the wall
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(10,12,12,${0.2 + r() * 0.3})`;
      ctx.fillRect(r() * w, h - (0.15 + r() * 0.75) * PX, 2 + r() * 10, 1);
    }
    noise(ctx, w, h, 6, r);
  });
}

function ceilTex() {
  return ptex('ceil', 128, 128, (ctx, w, h, r) => {
    const img = ctx.createImageData(w, h), d = img.data;
    const tt = []; for (let i = 0; i < 16; i++) tt.push(r() < 0.12 ? 10 : (r() - 0.5) * 6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = 186 + tt[(y >> 5) * 4 + (x >> 5)] + (r() < 0.2 ? -20 : 0) + (r() - 0.5) * 6;
      if ((x & 31) === 0 || (y & 31) === 0) c = 120;
      else if ((x & 31) === 1 || (y & 31) === 1) c -= 18;
      const i = (y * w + x) * 4;
      d[i] = c; d[i + 1] = c - 2; d[i + 2] = c - 12; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    // water stains
    for (const [tx, ty, rr] of [[1, 2, 11], [3, 0, 8], [2, 3, 13]]) {
      const cx = tx * 32 + 16 + (r() - 0.5) * 8, cy = ty * 32 + 16 + (r() - 0.5) * 8;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(130,96,50,${0.35 - k * 0.08})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, rr - k * 3, (rr - k * 3) * 0.8, r(), 0, 7); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(140,110,60,0.18)'; ctx.beginPath(); ctx.ellipse(cx, cy, rr * 0.8, rr * 0.6, 0, 0, 7); ctx.fill();
    }
  });
}

function cellWallTex(kind) {
  return ptex(`cellwall-${kind}`, 128, 128, (ctx, w, h, r) => {
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      const course = Math.floor(y / 10);
      for (let x = 0; x < w; x++) {
        let k = (r() - 0.5) * 10 - (y / h) ** 2 * 26;
        if (y % 10 === 0 || (x + (course % 2) * 12) % 24 === 0) k -= 16;
        const i = (y * w + x) * 4;
        d[i] = 112 + k; d[i + 1] = 120 + k; d[i + 2] = 108 + k; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // scratched tallies
    ctx.fillStyle = 'rgba(225,225,210,0.55)';
    for (let g = 0; g < (kind === 'back' ? 4 : 6); g++) {
      const x0 = 8 + r() * 100, y0 = 50 + r() * 50;
      for (let i = 0; i < 4; i++) ctx.fillRect(x0 + i * 3, y0, 1, 8);
      for (let i = 0; i < 9; i++) ctx.fillRect(x0 - 1 + i * 1.6, y0 + 6 - i * 0.6, 1, 1);
    }
    if (kind === 'back') {
      text(ctx, 'NO GOD', 14, 34, 9, 'rgba(230,228,215,0.6)');
      text(ctx, 'NORTH OF 60', 10, 44, 8, 'rgba(230,228,215,0.5)');
      text(ctx, 'J.T. 09', 84, 98, 8, 'rgba(20,20,20,0.6)');
      // a scratched eye / spiral — someone saw something
      ctx.strokeStyle = 'rgba(232,226,210,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(96, 46, 12, 6, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); for (let a = 0; a < 14; a += 0.3) { const rr = a * 0.42; ctx.lineTo(96 + Math.cos(a) * rr, 46 + Math.sin(a) * rr * 0.6); } ctx.stroke();
      ctx.fillStyle = 'rgba(120,20,16,0.5)'; ctx.fillRect(95, 45, 3, 2);
    } else {
      text(ctx, 'KYLE WOZ', 20, 70, 8, 'rgba(20,20,20,0.55)');
      text(ctx, 'HERE', 26, 80, 8, 'rgba(20,20,20,0.55)');
    }
    // grime at the floor
    for (let x = 0; x < w; x++) { const hh = 4 + r() * 8; ctx.fillStyle = 'rgba(30,30,24,0.35)'; ctx.fillRect(x, h - hh, 1, hh); }
  });
}

function concreteTex() {
  return ptex('concrete', 64, 64, (ctx, w, h, r) => {
    ctx.fillStyle = '#6a6c66'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(30,30,26,${0.1 + r() * 0.15})`; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 4 + r() * 10, 3 + r() * 6, r() * 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(20,20,18,0.5)'; ctx.fillRect(0, 31, w, 1);
    noise(ctx, w, h, 22, r);
  });
}

function boardTex() {
  return ptex('board', 160, 100, (ctx, w, h, r) => {
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 30, r);
    const sheets = [
      [4, 6, 30, 38, '#e8e2cc'], [36, 4, 26, 34, '#f0e6a0'], [124, 6, 32, 40, '#dfe6ee'], [128, 50, 28, 36, '#f2d0d8'],
      [6, 50, 28, 40, '#e6e0d0'], [38, 56, 24, 30, '#cfe2c8'], [98, 62, 26, 34, '#ece8dc'], [100, 8, 22, 28, '#f0f0e8'],
    ];
    for (const [x, y, sw, sh, c] of sheets) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + 1, sw, sh);
      ctx.fillStyle = c; ctx.fillRect(x, y, sw, sh);
      lines(ctx, x + 3, y + 8, sw - 6, Math.floor((sh - 10) / 3), 'rgba(60,60,60,0.55)', 3, r);
      ctx.fillStyle = 'rgba(30,30,30,0.85)'; ctx.fillRect(x + 3, y + 3, sw - 6, 3);
      ctx.fillStyle = ['#c02020', '#2050c0', '#e0c020', '#20a040'][Math.floor(r() * 4)]; ctx.fillRect(x + sw / 2 - 1, y + 1, 2, 2);
    }
    // a lost-dog flyer with tear-off tabs, a BOLO with a photo
    ctx.fillStyle = '#f4f0e4'; ctx.fillRect(66, 6, 26, 40);
    ctx.fillStyle = '#5a4a3a'; ctx.fillRect(70, 14, 18, 12);
    text(ctx, 'LOST', 79, 7, 6, '#222', 'center');
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#dcd8cc'; ctx.fillRect(67 + i * 4, 40, 3, 6); }
    ctx.fillStyle = '#d8e0ea'; ctx.fillRect(66, 52, 28, 40);
    ctx.fillStyle = '#1a3a7a'; ctx.fillRect(66, 52, 28, 6);
    text(ctx, 'BOLO', 80, 52, 6, '#fff', 'center');
    ctx.fillStyle = '#7a7a80'; ctx.fillRect(70, 61, 12, 14);
    lines(ctx, 70, 78, 20, 4, 'rgba(40,40,60,0.6)', 3, r);
    // string connecting two notes
    ctx.strokeStyle = 'rgba(200,30,30,0.8)'; ctx.beginPath(); ctx.moveTo(19, 7); ctx.lineTo(80, 62); ctx.stroke();
  });
}

function missingTex() {
  // her school photo is the painted portrait itself (assets/portraits/lizzy_0.webp), printed on
  // the poster: head and shoulders, a little faded, like an inkjet print
  const t = ptex('missing2', 128, 160, (ctx, w, h, r) => {
    ctx.fillStyle = '#f2eedc'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { ctx.fillStyle = `rgba(120,100,70,${r() * 0.05})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
    ctx.fillStyle = '#b01010'; ctx.fillRect(0, 0, w, 22);
    text(ctx, 'MISSING', w / 2, 4, 15, '#fff', 'center');
    ctx.fillStyle = '#2a2420'; ctx.fillRect(26, 28, 76, 82);       // photo frame (filled when it loads)
    text(ctx, 'ELIZABETH "LIZZIE" REED', w / 2, 114, 8, '#111', 'center');
    text(ctx, 'AGE 17 · 5\'6" · BROWN HAIR', w / 2, 125, 6, '#333', 'center');
    text(ctx, 'LAST SEEN NOV 11 · TAKHINI', w / 2, 134, 6, '#333', 'center');
    ctx.fillStyle = '#b01010'; ctx.fillRect(14, 144, 100, 10);
    text(ctx, 'RCMP 867-667-5555', w / 2, 145, 7, '#fff', 'center');
  });
  const im = new Image();
  im.onload = () => {
    const c = t.image, ctx = c.getContext('2d');
    // head and shoulders of the standing portrait
    const sx = im.width * 0.28, sy = im.height * 0.035, sw = im.width * 0.68, sh = sw * (82 / 76);
    ctx.save();
    ctx.filter = 'saturate(0.75) contrast(1.05) brightness(1.08)';
    ctx.drawImage(im, sx, sy, sw, sh, 27, 29, 74, 80);
    ctx.restore();
    ctx.fillStyle = 'rgba(242,238,220,0.12)'; ctx.fillRect(27, 29, 74, 80);
    t.needsUpdate = true;
  };
  im.src = 'assets/portraits/lizzy_0.webp';
  return t;
}

function wantedTex(i) {
  return ptex(`wanted-${i}`, 32, 40, (ctx, w, h, r) => {
    ctx.fillStyle = i % 2 ? '#e6dcc0' : '#ece6d4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(0, 0, w, 7);
    text(ctx, i === 2 ? 'ALERT' : 'WANTED', w / 2, 1, 6, '#f0e0c0', 'center');
    ctx.fillStyle = '#8a8a8a'; ctx.fillRect(8, 10, 16, 16);
    ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.ellipse(16, 18, 5, 6, 0, 0, 7); ctx.fill(); ctx.fillRect(8, 23, 16, 3);
    lines(ctx, 4, 29, 24, 3, 'rgba(40,40,40,0.7)', 3, r);
  });
}

function mapTex() {
  return ptex('map', 128, 88, (ctx, w, h, r) => {
    ctx.fillStyle = '#d6d2b8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(120,150,100,0.35)'; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 6 + r() * 14, 4 + r() * 8, r() * 3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#a8a294'; ctx.lineWidth = 1;
    for (let x = 52; x < 96; x += 5) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x + 6, 70); ctx.stroke(); }
    for (let y = 30; y < 72; y += 5) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(98, y + 2); ctx.stroke(); }
    ctx.strokeStyle = '#4a7ab0'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(30, 88); ctx.bezierCurveTo(40, 60, 46, 40, 44, 24); ctx.bezierCurveTo(42, 12, 60, 4, 70, 0); ctx.stroke();
    ctx.strokeStyle = '#d07a20'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 54); ctx.bezierCurveTo(30, 50, 60, 20, 128, 16); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, 9);
    text(ctx, 'WHITEHORSE  YT', 4, 1, 7, '#f0ead0');
    // pins, a red circle around the outskirts — the bar
    for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; const x = 50 + r() * 50, y = 28 + r() * 44; ctx.fillRect(x + 1, y + 1, 3, 3); ctx.fillStyle = i < 6 ? '#d02020' : '#2040d0'; ctx.fillRect(x, y, 3, 3); }
    ctx.strokeStyle = '#c01010'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(18, 64, 10, 7, 0, 0, 7); ctx.stroke();
    text(ctx, '?', 30, 54, 9, '#c01010');
    ctx.fillStyle = '#f0e070'; ctx.fillRect(104, 60, 18, 16);
    lines(ctx, 106, 63, 13, 4, 'rgba(60,60,40,0.7)', 3, r);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
  });
}

function tvTex() {
  return ptex('tv', 64, 36, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#16304a'); g.addColorStop(1, '#0a1626');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c8d0d8'; ctx.fillRect(36, 4, 24, 16);
    ctx.fillStyle = '#e8eef4'; ctx.fillRect(36, 14, 24, 6);
    ctx.fillStyle = '#5a3a2a'; ctx.fillRect(42, 7, 12, 8);
    ctx.fillStyle = '#f0d020'; ctx.fillRect(36, 12, 24, 1);
    ctx.fillStyle = '#d02020'; ctx.fillRect(56, 6, 2, 2);
    ctx.fillStyle = '#c89878'; ctx.beginPath(); ctx.ellipse(16, 13, 4, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(9, 18, 15, 8); ctx.fillStyle = '#3a2418'; ctx.fillRect(12, 7, 8, 4);
    ctx.fillStyle = '#c01818'; ctx.fillRect(0, 24, 22, 6);
    text(ctx, 'LIVE', 2, 24, 6, '#fff');
    ctx.fillStyle = '#f0f0f0'; ctx.fillRect(22, 24, 42, 6);
    ctx.fillStyle = '#333'; ctx.fillRect(24, 26, 34, 2);
    ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 30, w, 6);
    ctx.fillStyle = '#aab'; for (let x = 2; x < w; x += 4) ctx.fillRect(x, 32, 3, 1);
  });
}

function cctvTex() {
  return ptex('cctv', 64, 48, (ctx, w, h, r) => {
    ctx.fillStyle = '#060806'; ctx.fillRect(0, 0, w, h);
    for (let q = 0; q < 4; q++) {
      const x0 = (q % 2) * 32 + 1, y0 = Math.floor(q / 2) * 24 + 1;
      ctx.fillStyle = '#5a6a5c'; ctx.fillRect(x0, y0, 30, 22);
      ctx.strokeStyle = '#34403a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0 + 22); ctx.lineTo(x0 + 12, y0 + 9); ctx.lineTo(x0 + 18, y0 + 9); ctx.lineTo(x0 + 30, y0 + 22); ctx.stroke();
      ctx.fillStyle = '#80907e'; ctx.fillRect(x0 + 12, y0 + 3, 6, 6);
      if (q === 1) { ctx.fillStyle = '#2a302a'; ctx.fillRect(x0 + 6, y0 + 12, 3, 8); }
      if (q === 3) { ctx.fillStyle = '#d0d8d0'; ctx.fillRect(x0 + 4, y0 + 14, 22, 4); }
      ctx.fillStyle = '#e0f0e0'; ctx.fillRect(x0 + 1, y0 + 1, 10, 1);
      ctx.fillStyle = '#e02020'; ctx.fillRect(x0 + 26, y0 + 1, 2, 2);
    }
    noise(ctx, w, h, 30, r);
  });
}

function screenTex(kind) {
  return ptex(`screen-${kind}`, 32, 24, (ctx, w, h, r) => {
    ctx.fillStyle = kind === 'dark' ? '#0e1a24' : '#1d4060'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8e4ee'; ctx.fillRect(2, 2, 18, 18);
    ctx.fillStyle = '#3070a0'; ctx.fillRect(2, 2, 18, 2);
    lines(ctx, 4, 6, 14, 5, '#4a5a68', 3, r);
    ctx.fillStyle = '#9ab8d0'; ctx.fillRect(22, 4, 8, 14);
    if (kind === 'mug') { ctx.fillStyle = '#d8b8a0'; ctx.fillRect(23, 6, 6, 7); ctx.fillStyle = '#3a2a20'; ctx.fillRect(23, 5, 6, 2); }
  });
}

function spinesTex() {
  return ptex('spines', 64, 32, (ctx, w, h, r) => {
    let x = 0;
    const cols = ['#1a2a4a', '#5a1a1a', '#1a1a1a', '#4a4a48', '#8a7a2a', '#2a4a2a', '#d8d4c8', '#3a2a5a'];
    while (x < w) {
      const bw = 3 + Math.floor(r() * 4), c = cols[Math.floor(r() * cols.length)], top = Math.floor(r() * 6);
      ctx.fillStyle = c; ctx.fillRect(x, top, bw, h - top);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, top, 1, h - top);
      ctx.fillStyle = '#e8e4d8'; ctx.fillRect(x + 1, 12, bw - 2, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + bw - 1, top, 1, h - top);
      x += bw;
    }
  });
}

function paperTex() {
  return ptex('paper', 16, 16, (ctx, w, h, r) => {
    for (let y = 0; y < h; y++) { const v = 210 + (r() - 0.5) * 30 - (r() < 0.2 ? 40 : 0); ctx.fillStyle = `rgb(${v},${v - 2},${v - 10})`; ctx.fillRect(0, y, w, 1); }
  });
}

function crestTex() {
  return ptex('crest', 48, 48, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#b08a30'; ctx.beginPath(); ctx.arc(24, 26, 20, 0, 7); ctx.fill();
    ctx.fillStyle = '#14284a'; ctx.beginPath(); ctx.arc(24, 26, 17, 0, 7); ctx.fill();
    ctx.fillStyle = '#b08a30'; ctx.beginPath(); ctx.arc(24, 26, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.ellipse(24, 26, 7, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(18, 21, 2, 3); ctx.fillRect(28, 21, 2, 3);
    for (let a = 0; a < 16; a++) { const t = Math.PI * 0.6 + a / 16 * Math.PI * 1.8; ctx.fillStyle = '#c8a040'; ctx.fillRect(24 + Math.cos(t) * 15 - 1, 26 + Math.sin(t) * 15 - 1, 2, 2); }
    ctx.fillStyle = '#c8a040'; ctx.fillRect(18, 2, 12, 5); ctx.fillRect(17, 0, 2, 3); ctx.fillRect(23, 0, 2, 3); ctx.fillRect(29, 0, 2, 3);
    ctx.fillStyle = '#c01818'; ctx.fillRect(22, 3, 4, 3);
    ctx.fillStyle = '#d8c890'; ctx.fillRect(6, 40, 36, 6);
    ctx.fillStyle = '#5a4a20'; ctx.fillRect(9, 42, 30, 1); ctx.fillRect(12, 44, 24, 1);
  }, { nearest: true });
}

function flagTex(kind) {
  return ptex(`flag-${kind}`, 32, 64, (ctx, w, h) => {
    if (kind === 'ca') {
      ctx.fillStyle = '#c8261c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 16, w, 32);
      ctx.fillStyle = '#c8261c';
      ctx.beginPath();
      const L = [[16, 20], [18, 25], [21, 24], [20, 30], [25, 27], [24, 31], [27, 32], [22, 36], [23, 39], [17, 38], [17, 44], [15, 44], [15, 38], [9, 39], [10, 36], [5, 32], [8, 31], [7, 27], [12, 30], [11, 24], [14, 25]];
      L.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
    } else {
      ctx.fillStyle = '#1f6a34'; ctx.fillRect(0, 0, w, 20);
      ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 20, w, 24);
      ctx.fillStyle = '#1e4a9a'; ctx.fillRect(0, 44, w, 20);
      ctx.fillStyle = '#c03020'; ctx.fillRect(12, 26, 8, 8);
      ctx.fillStyle = '#2a6aa0'; ctx.fillRect(12, 34, 8, 3);
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(14, 23, 4, 3);
      ctx.fillStyle = '#5a9a40'; ctx.fillRect(10, 38, 12, 2);
    }
    for (let x = 0; x < w; x += 6) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 3, 0, 2, h); }
  });
}

function clockTex() {
  return ptex('clock', 48, 48, (ctx) => {
    ctx.clearRect(0, 0, 48, 48);
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(24, 24, 23, 0, 7); ctx.fill();
    ctx.fillStyle = '#ece8dc'; ctx.beginPath(); ctx.arc(24, 24, 20, 0, 7); ctx.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = '#222'; ctx.fillRect(24 + Math.cos(a) * 17 - 1, 24 + Math.sin(a) * 17 - 1, 2, 2); }
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(24 + 9 * Math.cos(Math.PI * 0.5 + 0.35 * 2), 24 + 9 * Math.sin(Math.PI * 0.5 + 0.35 * 2)); ctx.stroke(); // ~7:40
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(24 + 15 * Math.cos(Math.PI * 1.17), 24 + 15 * Math.sin(Math.PI * 1.17)); ctx.stroke();
    ctx.strokeStyle = '#c01010'; ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(24 + 16 * Math.cos(-0.3), 24 + 16 * Math.sin(-0.3)); ctx.stroke();
  });
}

function blindsTex(kind) {
  return ptex(`blinds-${kind}`, 32, 64, (ctx, w, h, r) => {
    ctx.clearRect(0, 0, w, h);
    const step = kind === 'tilt' ? 4 : 5, slat = kind === 'tilt' ? 2 : 4;
    for (let y = 0; y < h; y += step) {
      ctx.fillStyle = '#d4d6d0'; ctx.fillRect(0, y, w, slat);
      ctx.fillStyle = '#9a9e98'; ctx.fillRect(0, y + slat - 1, w, 1);
      if (kind === 'tilt' && r() < 0.15) { ctx.clearRect(10, y, 8, slat); }
    }
    ctx.fillStyle = '#7a7e78'; ctx.fillRect(8, 0, 1, h); ctx.fillRect(24, 0, 1, h);
  });
}

function vendTex() {
  return ptex('vend', 32, 64, (ctx, w, h, r) => {
    ctx.fillStyle = '#0c1620'; ctx.fillRect(0, 0, w, h);
    const cols = ['#e03030', '#30a0e0', '#f0c020', '#40c060', '#f07020', '#e0e0e0', '#8040c0'];
    for (let row = 0; row < 6; row++) {
      ctx.fillStyle = '#4a5866'; ctx.fillRect(0, 8 + row * 9 + 7, w, 1);
      for (let c = 0; c < 5; c++) {
        if (r() < 0.18) continue;
        ctx.fillStyle = cols[(row * 3 + c) % cols.length]; ctx.fillRect(2 + c * 6, 8 + row * 9 + 1, 4, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(2 + c * 6, 8 + row * 9 + 1, 1, 6);
      }
    }
    ctx.fillStyle = '#d8e8f0'; ctx.fillRect(0, 0, w, 6);
    text(ctx, 'COLD', w / 2, 0, 6, '#0a3a6a', 'center');
  });
}

function lockerTex() {
  return ptex('locker', 16, 48, (ctx, w, h, r) => {
    ctx.fillStyle = '#5a6a62'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a4640'; ctx.fillRect(0, 0, 1, h); ctx.fillRect(w - 1, 0, 1, h);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#2a322e'; ctx.fillRect(4, 3 + i * 2, 8, 1); ctx.fillRect(4, 38 + i * 2, 8, 1); }
    ctx.fillStyle = '#a8aca8'; ctx.fillRect(11, 20, 2, 6);
    ctx.fillStyle = '#d8d4c0'; ctx.fillRect(4, 13, 6, 3);
    noise(ctx, w, h, 14, r);
  });
}

function cardboardTex() {
  return ptex('cardboard', 32, 24, (ctx, w, h, r) => {
    ctx.fillStyle = '#9a7a4a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a5a30'; ctx.fillRect(0, 0, w, 2);
    ctx.fillStyle = '#c8b890'; ctx.fillRect(0, 9, w, 5);
    text(ctx, 'EVIDENCE', w / 2, 9, 5, '#b01010', 'center');
    ctx.fillStyle = '#f0ece0'; ctx.fillRect(4, 16, 12, 6);
    lines(ctx, 5, 17, 10, 2, '#333', 2, r);
    noise(ctx, w, h, 14, r);
  });
}

function caseBoardTex() {
  return ptex('caseboard', 128, 72, (ctx, w, h, r) => {
    ctx.fillStyle = '#e4e6e2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a9c98'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 3, w, 3);
    const pts = [];
    for (let i = 0; i < 11; i++) {
      const x = 6 + (i % 6) * 20 + (r() - 0.5) * 6, y = 8 + Math.floor(i / 6) * 30 + (r() - 0.5) * 6;
      pts.push([x + 7, y + 8]);
      ctx.fillStyle = '#f4f2ea'; ctx.fillRect(x, y, 14, 17);
      ctx.fillStyle = ['#5a5a5e', '#6a5048', '#3a3a40', '#7a6a5a'][i % 4]; ctx.fillRect(x + 1, y + 1, 12, 11);
      if (i === 4) { ctx.fillStyle = '#7a1010'; ctx.fillRect(x + 3, y + 5, 7, 4); }
      ctx.fillStyle = '#c02020'; ctx.fillRect(x + 6, y - 1, 2, 2);
    }
    ctx.strokeStyle = 'rgba(200,20,20,0.85)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const a = pts[Math.floor(r() * pts.length)], b = pts[Math.floor(r() * pts.length)]; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
    text(ctx, 'NORTHERN ROSE', 6, 62, 6, '#1a2a6a');
    text(ctx, '7 DOA', 92, 62, 6, '#b01010');
    ctx.strokeStyle = '#1a2a6a'; ctx.beginPath(); ctx.arc(110, 44, 6, 0, 7); ctx.stroke();
    text(ctx, '?', 108, 40, 7, '#1a2a6a');
  });
}

function bootsTex() {
  return ptex('boots', 256, 112, (ctx, w, h, r) => {
    ctx.clearRect(0, 0, w, h);
    // salt rims and melt-water blotches near the door (left-top = door)
    for (let i = 0; i < 26; i++) {
      const x = 10 + r() * 90, y = r() * 60, rx = 4 + r() * 14, ry = 2 + r() * 6;
      ctx.fillStyle = 'rgba(8,10,12,0.32)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, r(), 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,206,208,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, rx + 1, ry + 1, r(), 0, 5 + r() * 2); ctx.stroke();
    }
    // trails from the door: one to reception, one to the waiting area
    const trail = (pts, n) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
      for (let i = 0; i < n; i++) {
        const t = i / n, p = curve.getPoint(t), tg = curve.getTangent(t);
        const side = i % 2 ? 1 : -1, a = Math.atan2(tg.y, tg.x);
        const x = p.x - tg.y * side * 3, y = p.y + tg.x * side * 3;
        const alpha = 0.55 * (1 - t * 0.75);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.fillStyle = `rgba(16,18,20,${alpha})`; ctx.fillRect(-4, -2, 7, 4); ctx.fillRect(4, -1.5, 3, 3);
        ctx.fillStyle = `rgba(200,206,210,${alpha * 0.2})`; ctx.fillRect(-4, -2, 7, 1);
        ctx.restore();
      }
    };
    trail([[44, 2], [50, 40], [80, 80], [130, 96], [180, 92]], 30);
    trail([[56, 4], [70, 36], [120, 60], [190, 70], [252, 74]], 40);
    trail([[36, 6], [30, 40], [40, 70], [90, 88]], 18);
  });
}

function wearTex() {
  return ptex('wear', 64, 32, (ctx, w, h, r) => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const a = Math.exp(-(((y - h * 0.55) / (h * 0.22)) ** 2)) * 0.32;
      for (let x = 0; x < w; x++) { ctx.fillStyle = `rgba(30,26,20,${a * (0.6 + r() * 0.6)})`; ctx.fillRect(x, y, 1, 1); }
    }
    for (let x = 0; x < w; x++) { ctx.fillStyle = 'rgba(18,16,12,0.5)'; ctx.fillRect(x, 0, 1, 2 + r() * 2); }
  }, { nearest: false });
}

function matTex() {
  return ptex('doormat', 64, 48, (ctx, w, h, r) => {
    ctx.fillStyle = '#26282a'; ctx.fillRect(0, 0, w, h);
    for (let y = 3; y < h - 3; y += 3) { ctx.fillStyle = '#3a3c3e'; ctx.fillRect(3, y, w - 6, 1); }
    ctx.fillStyle = '#1a1c1e'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2);
    text(ctx, 'RCMP · GRC', w / 2, 19, 8, 'rgba(200,180,90,0.75)', 'center');
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(220,228,232,${0.2 + r() * 0.4})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    noise(ctx, w, h, 14, r);
  });
}

function frostTex() {
  return ptex('frost', 32, 32, (ctx, w, h, r) => {
    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      const a = Math.max(0, 0.75 - e * 0.09) * (0.6 + r() * 0.5) + (y > h * 0.7 ? 0.15 : 0);
      ctx.fillStyle = `rgba(235,242,248,${Math.min(0.9, a)})`; ctx.fillRect(x, y, 1, 1);
    }
  });
}

function rosterTex() {
  return ptex('roster', 48, 32, (ctx, w, h, r) => {
    ctx.fillStyle = '#eceee8'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a9aa8'; ctx.lineWidth = 1;
    for (let x = 12; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x + 0.5, 6); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    for (let y = 6; y < h; y += 5) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    text(ctx, 'ON DUTY', 2, 0, 5, '#1a2a6a');
    for (let i = 0; i < 18; i++) { ctx.fillStyle = r() < 0.3 ? '#c02020' : '#1a3a8a'; ctx.fillRect(13 + Math.floor(r() * 4) * 9 + 1, 8 + Math.floor(r() * 5) * 5, 4 + r() * 3, 1); }
    ctx.fillStyle = '#c02020'; ctx.fillRect(1, 18, 10, 1);
    ctx.strokeStyle = '#555'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  });
}

function photoTex() {
  return ptex('groupphoto', 32, 22, (ctx, w, h) => {
    ctx.fillStyle = '#8a9aa8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8dce0'; ctx.fillRect(0, 14, w, 8);
    for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 3 ? '#2a2a3a' : '#7a1a14'; ctx.fillRect(2 + i * 4, 8, 3, 7); ctx.fillStyle = '#c8a088'; ctx.fillRect(2 + i * 4, 5, 3, 3); }
  });
}

function eyeChartTex() {
  return ptex('eyechart', 24, 36, (ctx, w, h) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, w, h);
    const rows = [[8, 1], [6, 2], [4, 3], [3, 4], [2, 5], [2, 6]];
    let y = 3;
    for (const [s, n] of rows) { for (let i = 0; i < n; i++) { ctx.fillStyle = '#111'; ctx.fillRect(w / 2 - (n * (s + 1)) / 2 + i * (s + 1), y, s, s); } y += s + 2; }
    ctx.fillStyle = '#c01010'; ctx.fillRect(2, h - 4, w - 4, 1);
  });
}

function signTex(label, w, h, bg, fg, border) {
  const cw = Math.min(256, Math.round(w * 110)), ch = Math.max(10, Math.round(cw * h / w));
  return ptex(`sign-${label}-${bg}-${fg}`, cw, ch, (ctx, W, Hh) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(1.5, 1.5, W - 3, Hh - 3); }
    let size = Math.floor(Hh * 0.62);
    ctx.font = `bold ${size}px sans-serif`;
    while (ctx.measureText(label).width > W * 0.9 && size > 6) { size--; ctx.font = `bold ${size}px sans-serif`; }
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, W / 2, Hh / 2 + 1);
  });
}

// ------------------------------------------------------------------ scene

export class StationScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'station';
    this.title = 'Полицейский участок';
    this.background = 0x080a0c;
    this.camera = { distance: 8.0, height: 2.3, lookHeight: 1.3, lookZ: -0.8 };
    const corridor = { minX: -12.6, maxX: 12.6, minZ: -2.6, maxZ: 1.8, enabled: () => !this.lockedIn };
    this.cell = { minX: 4.65, maxX: 7.55, minZ: -6.0, maxZ: -4.3, enabled: () => this.cellOpen || this.lockedIn };
    this.cellDoorway = { minX: 5.7, maxX: 6.5, minZ: -4.4, maxZ: -2.5, enabled: () => this.cellOpen };
    this.bounds = { walk: { areas: [corridor, this.cell, this.cellDoorway] }, camera: { minX: -8.6, maxX: 8.6 } };
    this.cellOpen = false;
    this.shots = { station: { pos: [-4.6, 1.5, 2.6], look: [-4.8, 1.4, -4.0], fov: 52 } };
    this.vnHide = [];
  }

  /** Material with a pixel texture. */
  pm(key, tex, opts = {}) { return this.mat(`st-${key}`, { map: tex, roughness: 0.8, ...opts }); }
  /** Plain colour material. */
  cm(hex, rough = 0.7, metal = 0, extra = {}) { return this.mat(`stc-${hex}-${rough}-${metal}-${JSON.stringify(extra)}`, { color: hex, roughness: rough, metalness: metal, ...extra }); }
  em(hex, k = 1.5) { return this.mat(`ste-${hex}-${k}`, { color: 0x000000, emissive: hex, emissiveIntensity: k }); }
  signMat(label, w, h, bg, fg, { border, emissive = 0 } = {}) {
    const tex = signTex(label, w, h, bg, fg, border);
    return this.mat(`sgn-${label}-${bg}-${emissive}`, { map: tex, roughness: 0.7, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? tex : null, emissiveIntensity: emissive || 1 });
  }

  fg(x, z, name, build) {
    const g = new THREE.Group();
    g.name = name;
    const b = new Batch();
    build(b, g);
    b.flush(g);
    g.position.set(x, 0, z);
    this.root.add(g);
    this.foregroundGroups.push(g);
    return g;
  }

  build() {
    const root = this.root;
    const S = this.S = new Batch();
    this.mStee = this.cm(0x9aa0a6, 0.35, 0.8);
    this.mDark = this.cm(0x2a2e34, 0.5, 0.5);
    this.mPaper = this.pm('paper', paperTex(), { roughness: 0.95 });

    this.buildShell();
    this.buildEntrance();
    this.buildReception();
    this.buildWaiting();
    this.buildOffices();
    this.buildCell();
    this.buildRight();
    this.buildCeiling();
    this.buildLighting();
    this.buildForeground();

    S.flush(root);
    this.dust(new THREE.Box3(new THREE.Vector3(-13, 0.3, -3.6), new THREE.Vector3(13, 2.8, 2)), 300);
    this.anchors.spawn = { x: 6.1, z: -5.2 };
    this.windowLights = [flareSource('PALE', new THREE.Vector3(-6.4, 2.0, BACK - 0.1), { triggerDistance: 2.4 })];
    return root;
  }

  // ---------------------------------------------------------------- shell

  buildShell() {
    const S = this.S;
    const ft = floorTex().clone();
    ft.needsUpdate = true;
    ft.repeat.set(28 / 2.4, 12 / 2.4);
    this.floor(-14, 14, -7, 5, this.mat('stFloor', { map: ft, roughness: 0.42, metalness: 0.0, color: 0xa8aca4 }));
    // worn traffic lane + grime along the wall base
    const wear = new THREE.Mesh(new THREE.PlaneGeometry(27, 6.4), new THREE.MeshBasicMaterial({ map: wearTex(), transparent: true, depthWrite: false }));
    wear.rotation.x = -Math.PI / 2; wear.position.set(0, 0.004, -0.8);
    wear.material.map.repeat.set(1, 1);
    this.root.add(wear);

    const wallMat = this.wallMat = this.mat('stWall2', { map: wallTex(), roughness: 0.88 });
    const wall = this.wall(-14, 14, H, BACK, wallMat, [
      { x0: -12.9, x1: -11.1, y0: 0, y1: 2.25 }, // entrance doors (glass)
      { x0: 4.5, x1: 7.7, y0: 0, y1: 2.6 }, // holding cell
      { x0: 9.0, x1: 10.6, y0: 0, y1: 2.3 }, // med post
      { x0: -7.2, x1: -5.6, y0: 1.55, y1: 2.45 }, // high window over the waiting seats
      { x0: 0.15, x1: 2.1, y0: 1.15, y1: 2.2 }, // office glass 1
      { x0: 2.3, x1: 4.3, y0: 1.15, y1: 2.2 }, // office glass 2
    ]);
    const uv = wall.geometry.attributes.uv, pos = wall.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getY(i) / H);
    // side walls
    for (const x of [-14, 14]) S.add(uvBox(0.1, H, 12, x, -1), wallMat, x, 0, -1);
    // 3-D chair rail + skirting for depth
    const rail = this.cm(0x26303a, 0.45, 0.2);
    const skirt = this.cm(0x1a1816, 0.6);
    for (const [a, b] of [[-14, -12.9], [-11.1, -0.92], [0.12, 4.5], [7.7, 9.0], [10.6, 11.62], [12.78, 14]]) {
      S.box(b - a, 0.05, 0.05, rail, (a + b) / 2, 1.1, BACK + 0.025);
      S.box(b - a, 0.1, 0.025, skirt, (a + b) / 2, 0.05, BACK + 0.012);
    }
    // conduit + pipes along the top of the back wall
    const pipe = this.cm(0x6a6e6a, 0.5, 0.4);
    S.cyl(0.03, 28, pipe, 0, 2.86, BACK + 0.08, { rz: Math.PI / 2, seg: 6 });
    S.cyl(0.018, 28, this.cm(0x8a5a3a, 0.4, 0.6), 0, 2.78, BACK + 0.05, { rz: Math.PI / 2, seg: 6 });
    for (let x = -13; x < 14; x += 3.7) S.box(0.14, 0.14, 0.08, pipe, x, 2.86, BACK + 0.08);
    for (let x = -13.6; x < 14; x += 1.5) S.box(0.03, 0.1, 0.1, this.mDark, x, 2.84, BACK + 0.05);
  }

  // ---------------------------------------------------------------- entrance

  buildEntrance() {
    const S = this.S, root = this.root;
    const outside = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'station'), color: 0xd6dee8 });
    this.plane(6, 3.4, outside, -11.5, 1.6, BACK - 1.4);
    // door frame, transom, two glass leaves with push bars and frost
    const alu = this.cm(0x5a6068, 0.4, 0.6);
    S.box(1.9, 0.08, 0.14, alu, -12, 2.25, BACK);
    S.box(0.07, 2.25, 0.14, alu, -12.93, 1.125, BACK); S.box(0.07, 2.25, 0.14, alu, -11.07, 1.125, BACK);
    S.box(0.06, 2.25, 0.1, alu, -12.0, 1.125, BACK);
    const glassMat = this.mat('stGlass', { color: 0xbfd2e0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const frost = new THREE.MeshBasicMaterial({ map: frostTex(), transparent: true, depthWrite: false, color: 0xdfe8f0 });
    for (const x of [-12.46, -11.54]) {
      S.box(0.86, 2.2, 0.03, glassMat, x, 1.12, BACK);
      this.plane(0.86, 2.2, frost, x, 1.12, BACK + 0.02);
      S.box(0.86, 0.05, 0.06, this.mDark, x, 1.05, BACK + 0.05);
      S.box(0.86, 0.12, 0.035, alu, x, 0.06, BACK + 0.01);
    }
    S.plane(0.3, 0.12, this.signMat('PUSH · POUSSEZ', 0.3, 0.12, '#e8e4d0', '#202020'), -12.46, 1.3, BACK + 0.025);
    S.plane(0.26, 0.34, this.pm('hours', ptex('hours', 26, 34, (ctx, w, h, r) => { ctx.fillStyle = '#f0ece0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1a2a4a'; ctx.fillRect(0, 0, w, 6); lines(ctx, 3, 9, 20, 8, '#333', 3, r); })), -11.54, 1.5, BACK + 0.025);
    const ent = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.3), this.signMat('RCMP · GRC  WHITEHORSE', 2.2, 0.3, '#14324a', '#f0e6c8', { border: '#c8a850' }));
    ent.position.set(-12, 2.52, BACK + 0.03); root.add(ent);
    // EXIT sign (lit)
    S.box(0.44, 0.17, 0.06, this.cm(0xd8dcd8), -10.6, 2.6, BACK + 0.05);
    S.plane(0.4, 0.13, this.signMat('◄ EXIT · SORTIE', 0.4, 0.13, '#0a6a2a', '#e8ffe8', { emissive: 1.4 }), -10.6, 2.6, BACK + 0.085);
    const eg = glow(0x40ff80, 0.7, 0.25); eg.position.set(-10.6, 2.6, BACK + 0.2); root.add(eg);
    this.anchors.entrance = new THREE.Vector3(-12, 1.4, BACK + 0.2);
    // cold daylight spilling in
    const dg = glow(0xbcd4ff, 2.6, 0.22); dg.position.set(-12, 1.4, BACK + 0.3); root.add(dg);
    this.pool(0xa8c4ff, -12, -2.6, 3.0, 3.2, 0.12);
    // doormat, salt, wet prints, a melt-water puddle
    S.plane(1.9, 1.4, this.pm('doormat', matTex(), { roughness: 1 }), -12, 0.008, -3.25, 0, -Math.PI / 2);
    const boots = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.15), new THREE.MeshBasicMaterial({ map: bootsTex(), transparent: true, depthWrite: false }));
    boots.rotation.x = -Math.PI / 2; boots.position.set(-9.4, 0.01, -2.35); boots.renderOrder = 1;
    this.root.add(boots);
    if (!this.low) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), this.mat('stPuddle', { color: 0x0c1014, roughness: 0.04, metalness: 0.6, transparent: true, opacity: 0.55, depthWrite: false }));
      puddle.rotation.x = -Math.PI / 2; puddle.scale.set(1.4, 0.7, 1); puddle.position.set(-11.3, 0.012, -2.2);
      this.root.add(puddle);
    }
    // boot tray with snow-caked boots, umbrella stand, coat rack with parkas
    S.box(0.9, 0.03, 0.42, this.cm(0x1a1a1a, 0.9), -13.45, 0.015, -2.9);
    const boot = this.cm(0x2a2018, 0.8), snowM = this.cm(0xe8eef2, 0.9);
    for (const [x, z, ry] of [[-13.7, -2.95, 0.2], [-13.55, -2.85, 0.1], [-13.25, -2.95, -0.2], [-13.1, -2.85, -0.3]]) {
      S.box(0.12, 0.22, 0.12, boot, x, 0.14, z - 0.06, ry);
      S.box(0.12, 0.08, 0.28, boot, x, 0.06, z, ry);
      S.box(0.13, 0.025, 0.2, snowM, x, 0.11, z + 0.02, ry);
    }
    S.cyl(0.14, 0.5, this.cm(0x3a3e44, 0.5, 0.5), -13.75, 0.25, -3.55, { seg: 10 });
    S.cyl(0.015, 0.85, this.cm(0x1a1a20), -13.72, 0.6, -3.55, { rz: 0.08, seg: 5 });
    S.cyl(0.05, 0.7, this.cm(0x2a1a3a, 0.9), -13.78, 0.6, -3.53, { rz: -0.05, taper: 0.4, seg: 6 });
    const rackX = -13.35;
    S.cyl(0.025, 1.85, this.mDark, rackX, 0.93, -3.7, { seg: 6 });
    S.cyl(0.22, 0.03, this.mDark, rackX, 0.02, -3.7, { seg: 10 });
    const cloth = (hex) => this.mat(`stParka-${hex}`, { map: pixTex('cloth'), color: hex, roughness: 0.95 });
    const fur = this.mat('stFur', { map: pixTex('cloth'), color: 0x9a8a70, roughness: 1 });
    [[0x1c2638, -0.18], [0x6a1a14, 0.16]].forEach(([hex, dx]) => {
      S.cyl(0.19, 0.95, cloth(hex), rackX + dx, 1.2, -3.62, { taper: 0.7, seg: 7 });
      S.cyl(0.13, 0.12, fur, rackX + dx, 1.72, -3.62, { seg: 7 });
      S.cyl(0.05, 0.62, cloth(hex), rackX + dx + Math.sign(dx) * 0.17, 1.28, -3.58, { rz: Math.sign(dx) * 0.12, seg: 5 });
    });
    S.box(0.06, 0.7, 0.03, cloth(0xb8a070), rackX, 1.4, -3.48);
    S.cyl(0.11, 0.1, fur, rackX + 0.02, 1.92, -3.7, { seg: 8 });
  }

  // ---------------------------------------------------------------- reception

  buildReception() {
    const S = this.S, root = this.root;
    const wood = this.mat('stLam', { map: pixTex('wood'), color: 0x9a8a7a, roughness: 0.5 });
    const panel = this.cm(0x3a4a58, 0.55);
    // high counter: laminate front, kick plate, top
    S.box(3.0, 1.06, 0.6, panel, -9.5, 0.55, -2.55);
    // laminate panels in an aluminium grid, recessed kick plate, a ledge with a rounded nosing on brackets
    const trim = this.cm(0x5a6068, 0.35, 0.6);
    for (let i = 0; i < 5; i++) S.box(0.56, 0.82, 0.02, wood, -10.7 + i * 0.6, 0.6, -2.24, 0, 0, 0, 0.006);
    for (let i = 0; i <= 5; i++) S.box(0.035, 0.9, 0.03, trim, -11.0 + i * 0.6, 0.6, -2.235, 0, 0, 0, 0.008);
    for (const y of [0.17, 1.03]) S.box(3.04, 0.035, 0.03, trim, -9.5, y, -2.235, 0, 0, 0, 0.008);
    S.box(3.0, 0.12, 0.03, this.cm(0x16181a, 0.8), -9.5, 0.06, -2.28);
    S.box(3.15, 0.045, 0.4, this.cm(0x7a7064, 0.4), -9.5, 1.112, -2.29, 0, 0, 0, 0.01);
    S.cyl(0.026, 3.15, this.cm(0x6a6258, 0.4), -9.5, 1.112, -2.085, { rz: Math.PI / 2, seg: 16 });
    const gus = cached('gusset', () => profileX(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.16, 0), new THREE.Vector2(0, -0.14)]), 0.014, 0.003));
    for (const x of [-10.7, -9.5, -8.3]) S.add(gus, this.mStee, x, 1.088, -2.245);
    S.box(3.05, 0.04, 0.5, this.cm(0x5a5a58, 0.6), -9.5, 0.9, -2.95);
    // flyers taped to the counter front
    S.plane(0.21, 0.28, this.pm('wanted0', wantedTex(0)), -10.1, 0.72, -2.222, 0, 0, 0.03);
    S.plane(0.21, 0.28, this.pm('wanted2', wantedTex(2)), -8.9, 0.68, -2.222, 0, 0, -0.04);
    // bullet-proof glass with frames, speak grille and a pass tray
    const glassMat = this.mat('stGlass', { color: 0xbfd2e0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    S.box(3.0, 1.0, 0.025, glassMat, -9.5, 1.64, -2.45);
    for (const x of [-11.0, -10.0, -9.0, -8.0]) S.box(0.05, 1.04, 0.06, this.mDark, x, 1.64, -2.45);
    S.box(3.04, 0.06, 0.07, this.mDark, -9.5, 2.17, -2.45);
    S.cyl(0.07, 0.01, this.cm(0x8a9098, 0.4, 0.7), -9.5, 1.5, -2.43, { rx: Math.PI / 2, seg: 12 });
    S.box(0.5, 0.06, 0.25, this.cm(0x6a7078, 0.4, 0.6), -9.5, 1.15, -2.4);
    // on the ledge: logbook, pen on a chain, bell, brochure rack
    S.box(0.42, 0.02, 0.28, this.cm(0x2a1a14), -10.3, 1.145, -2.22);
    S.box(0.4, 0.012, 0.26, this.mPaper, -10.3, 1.16, -2.22);
    S.box(0.14, 0.01, 0.01, this.cm(0x1a1a1a), -10.25, 1.17, -2.18, 0.4);
    S.cyl(0.05, 0.035, this.cm(0xb8a050, 0.3, 0.8), -9.0, 1.155, -2.2, { taper: 0.6, seg: 10 });
    S.cyl(0.06, 0.012, this.cm(0x1a1a1a), -9.0, 1.14, -2.2, { seg: 10 });
    S.box(0.3, 0.26, 0.08, this.cm(0x2a2e34, 0.5), -8.35, 1.26, -2.18, 0, -0.2);
    for (let i = 0; i < 3; i++) S.box(0.08, 0.2, 0.01, this.mat(`stBro${i}`, { color: [0xd8c8a0, 0xa8c0d8, 0xe0a8a0][i], roughness: 0.8 }), -8.45 + i * 0.1, 1.33, -2.13, 0, -0.2);
    // behind the glass: monitors, phone, radio, files, mug
    const monBody = this.cm(0x1a1c20, 0.5);
    const monA = this.pm('scrA', screenTex('a'), { emissive: 0xffffff, emissiveMap: screenTex('a'), emissiveIntensity: 0.9 });
    S.box(0.46, 0.32, 0.04, monBody, -10.25, 1.48, -2.82, 0.35);
    S.plane(0.42, 0.28, monA, -10.243, 1.48, -2.80, 0.35);
    S.box(0.06, 0.2, 0.06, monBody, -10.25, 1.22, -2.85);
    S.box(0.44, 0.3, 0.04, monBody, -8.75, 1.46, -2.82, -0.3);
    S.box(0.25, 0.08, 0.18, this.cm(0x202224), -9.95, 1.17, -2.7);
    S.box(0.22, 0.1, 0.16, this.cm(0x2a2c30), -8.45, 1.18, -2.78);
    S.cyl(0.006, 0.3, this.mDark, -8.38, 1.38, -2.78, { seg: 4 });
    const em = glow(0x60a8e0, 0.9, 0.35); em.position.set(-10.2, 1.48, -2.7); root.add(em);
    const folders = [0xc8a860, 0xa8b8c8, 0xd0c8b0, 0x8a4a40, 0xc8a860];
    folders.forEach((c, i) => S.box(0.34, 0.035, 0.25, this.mat(`stFold-${c}`, { color: c, roughness: 0.85 }), -9.2 + (i % 2) * 0.03, 1.16 + i * 0.035, -2.75, (i - 2) * 0.05));
    S.cyl(0.04, 0.1, this.cm(0xe8e4dc, 0.4), -10.65, 1.18, -2.72, { seg: 10 });
    S.cyl(0.04, 0.1, this.cm(0x7a1a1a, 0.4), -8.95, 1.18, -2.66, { seg: 10 });
    this.colliders.push({ box: { minX: -11, maxX: -8, minZ: -3.6, maxZ: -2.3 } });
    this.anchors.desk = new THREE.Vector3(-9.5, 1.6, -2.6);
    this.anchors.deskOfficer = new THREE.Vector3(-9.4, 0, -3.3);

    // back wall: shelves of binders, crest, CCTV bank, key box, flags on poles
    const spines = this.pm('spines', spinesTex(), { roughness: 0.8 });
    for (const y of [1.5, 1.88, 2.26]) {
      S.box(0.66, 0.025, 0.28, this.mStee, -10.15, y, BACK + 0.15);
      if (y < 2.2) S.box(0.6, 0.3, 0.24, spines, -10.15, y + 0.165, BACK + 0.14);
    }
    S.box(0.62, 0.02, 0.02, this.mDark, -10.15, 1.36, BACK + 0.29);
    const crest = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), this.mat('stCrest', { map: crestTex(), transparent: true, alphaTest: 0.5, roughness: 0.4, metalness: 0.3 }));
    crest.position.set(-9.35, 2.45, BACK + 0.03); root.add(crest);
    S.box(0.68, 0.5, 0.08, this.cm(0x1a1c1e, 0.5), -8.75, 1.9, BACK + 0.06);
    S.plane(0.62, 0.44, this.pm('cctv', cctvTex(), { emissive: 0xffffff, emissiveMap: cctvTex(), emissiveIntensity: 0.7 }), -8.75, 1.9, BACK + 0.105);
    const cg = glow(0x90c0a0, 0.9, 0.18); cg.position.set(-8.75, 1.9, BACK + 0.3); root.add(cg);
    S.box(0.3, 0.36, 0.06, this.cm(0x4a5048, 0.6, 0.3), -8.65, 1.32, BACK + 0.04);
    S.box(0.13, 0.22, 0.06, this.cm(0xd8d4c8, 0.5), -9.95, 1.0 + 0.3, BACK + 0.04);
    const flag = (x, kind) => {
      S.cyl(0.018, 2.35, this.cm(0xb8a050, 0.3, 0.8), x, 1.18, -3.75, { seg: 6 });
      S.cyl(0.16, 0.05, this.cm(0x2a2a2a, 0.5, 0.5), x, 0.025, -3.75, { seg: 10 });
      S.cyl(0.035, 0.1, this.cm(0xd0b050, 0.25, 0.9), x, 2.4, -3.75, { taper: 0.1, seg: 6 });
      S.box(0.5, 0.02, 0.02, this.cm(0xb8a050, 0.3, 0.8), x + 0.24, 2.3, -3.75);
      const g = new THREE.PlaneGeometry(0.46, 0.92, 6, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 30) * 0.025 * (0.4 + (0.46 - p.getY(i)) * 0.7));
      g.computeVertexNormals();
      S.add(g, this.mat(`stFlag-${kind}`, { map: flagTex(kind), roughness: 0.95, side: THREE.DoubleSide }), x + 0.24, 1.83, -3.74);
    };
    flag(-11.0, 'ca'); flag(-8.2, 'yt');
    // hanging RECEPTION sign
    S.plane(1.5, 0.24, this.signMat('FRONT DESK · RECEPTION', 1.5, 0.24, '#1a2a36', '#e8e4d8', { border: '#6a7a88' }), -9.5, 2.78, -2.3);
    S.box(1.54, 0.28, 0.02, this.mDark, -9.5, 2.78, -2.315);
    for (const x of [-10.1, -8.9]) S.cyl(0.004, 0.1, this.mDark, x, 2.95, -2.3, { seg: 3 });
    // CCTV dome on the ceiling
    S.cyl(0.08, 0.06, this.cm(0x101214, 0.2, 0.3), -10.8, 2.97, -2.6, { taper: 0.8, seg: 10 });
  }

  // ---------------------------------------------------------------- waiting area

  buildWaiting() {
    const S = this.S, root = this.root;
    // high grimy window with snow outside
    const outside = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'station'), color: 0xc8d4e2 });
    this.plane(3.2, 2.2, outside, -6.4, 2.0, BACK - 1.2);
    const alu = this.cm(0x5a6068, 0.4, 0.6);
    S.box(1.66, 0.06, 0.16, alu, -6.4, 2.45, BACK); S.box(1.66, 0.08, 0.22, this.cm(0xb8b4a8, 0.6), -6.4, 1.53, BACK + 0.04);
    for (const x of [-7.2, -6.4, -5.6]) S.box(0.05, 0.92, 0.12, alu, x, 2.0, BACK);
    S.box(1.6, 0.06, 0.2, this.cm(0xf0f4f8, 0.9), -6.4, 1.58, BACK - 0.16);
    const frost = new THREE.MeshBasicMaterial({ map: frostTex(), transparent: true, depthWrite: false, color: 0xd8e2ea });
    for (const x of [-6.8, -6.0]) this.plane(0.78, 0.88, frost, x, 2.0, BACK + 0.01);
    const wg = glow(0xc0d8ff, 2.2, 0.2); wg.position.set(-6.4, 2.0, BACK + 0.25); root.add(wg);
    if (!this.low) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.0), new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0x9ab8e8, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(-6.2, 1.15, -2.9); beam.rotation.x = -0.75; beam.renderOrder = 4;
      root.add(beam);
    }
    // radiator under the window, behind the seats
    const radTex = ptex('radiator', 32, 16, (ctx, w, h) => { ctx.fillStyle = '#c8c4b4'; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 3) { ctx.fillStyle = '#7a7668'; ctx.fillRect(x + 2, 1, 1, h - 2); } ctx.fillStyle = '#8a8676'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, h - 1, w, 1); });
    S.box(1.2, 0.55, 0.1, this.pm('rad', radTex, { roughness: 0.6, metalness: 0.2 }), -6.4, 0.42, BACK + 0.08);
    S.cyl(0.02, 0.3, this.cm(0x8a8676, 0.5, 0.4), -5.75, 0.15, BACK + 0.08, { seg: 5 });

    // seat rows (benchA/B/C anchors on them): moulded shells with a fabric pad on a steel beam
    const seatRow = (x, len) => this.beamSeats(S, x, -3.3, len, Math.max(2, Math.round(len / 0.58)), { facing: 1, pad: true });
    seatRow(-6.4, 2.4);
    seatRow(-3.2, 2.0);
    this.colliders.push({ box: { minX: -7.7, maxX: -2.1, minZ: -3.7, maxZ: -2.95 } });
    this.anchors.benchA = { x: -7.1, z: -3.2 };
    this.anchors.benchB = { x: -5.7, z: -3.2 };
    this.anchors.benchC = { x: -3.6, z: -3.2 };
    // left-behind stuff: a folded newspaper, a paper cup, a backpack under the seat
    S.box(0.3, 0.02, 0.22, this.mPaper, -6.75, 0.49, -3.22, 0.3);
    S.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), -4.5, 0.05, -3.0, { taper: 1.25, seg: 8 });
    S.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), -2.5, 0.53, -3.25, { taper: 1.25, seg: 8 });
    S.box(0.34, 0.3, 0.2, this.cm(0x4a4a2a, 0.9), -2.7, 0.15, -3.45, 0.2);

    // water cooler
    const cx = -7.95;
    S.box(0.32, 0.95, 0.32, this.cm(0xd8dad6, 0.5), cx, 0.475, -3.75);
    S.box(0.34, 0.03, 0.34, this.cm(0xb8bab6, 0.5), cx, 0.96, -3.75);
    S.cyl(0.15, 0.4, this.mat('stBottle', { color: 0x6aa8e0, roughness: 0.1, transparent: true, opacity: 0.6, emissive: 0x0a2a4a }), cx, 1.18, -3.75, { seg: 12 });
    S.box(0.04, 0.05, 0.04, this.cm(0x2050c0), cx - 0.07, 0.75, -3.58);
    S.box(0.04, 0.05, 0.04, this.cm(0xc02020), cx + 0.07, 0.75, -3.58);
    S.cyl(0.035, 0.3, this.cm(0xeeeeee, 0.6), cx + 0.21, 0.85, -3.8, { seg: 8 });

    // dead plant between the rows
    S.cyl(0.16, 0.36, this.cm(0x5a4030, 0.8), -4.7, 0.18, -3.75, { taper: 1.2, seg: 10 });
    S.cyl(0.17, 0.02, this.cm(0x2a2018, 1), -4.7, 0.355, -3.75, { seg: 10 });
    const dry = this.mat('stDry2', { color: 0x6a5a30, roughness: 1, side: THREE.DoubleSide });
    const live = this.mat('stLive2', { color: 0x3a4a28, roughness: 0.9, side: THREE.DoubleSide });
    const r = rng(41);
    S.cyl(0.012, 0.9, this.cm(0x4a3a24), -4.7, 0.8, -3.75, { seg: 16, rz: 0.06 });
    for (let i = 0; i < 9; i++) { const s = 0.09 + r() * 0.05; S.add(leafGeo(), i < 3 ? live : dry, -4.7 + (r() - 0.5) * 0.06, 0.75 + r() * 0.55, -3.75 + (r() - 0.5) * 0.06, s, s, s, 0, r() * 6.3, -0.6 - r() * 0.6); }
    for (let i = 0; i < 3; i++) S.add(leafGeo(), dry, -4.6 + r() * 0.3, 0.012, -3.5 + r() * 0.2, 0.08, 0.08, 0.08, 0, r() * 3, 0);

    // notice board with flyers + the MISSING poster of Elizabeth Reed
    const board = new THREE.Group();
    const fb = new Batch();
    fb.box(1.68, 1.08, 0.03, this.cm(0x3a2a1a, 0.6), 0, 0, -0.01);
    fb.plane(1.6, 1.0, this.pm('board', boardTex(), { roughness: 1 }), 0, 0, 0.012);
    fb.plane(0.4, 0.5, this.pm('missing2', missingTex(), { roughness: 0.9 }), -0.04, 0.02, 0.02, 0, 0, 0.02);
    fb.plane(0.24, 0.3, this.pm('wanted1', wantedTex(1)), 0.36, -0.22, 0.018, 0, 0.1, -0.05);
    fb.plane(0.2, 0.26, this.pm('wanted3', wantedTex(3)), -0.42, -0.25, 0.018, 0, -0.1, 0.06);
    fb.box(0.012, 0.012, 0.02, this.cm(0xd02020), -0.04, 0.23, 0.03);
    fb.flush(board);
    board.position.set(-4.4, 1.85, BACK + 0.03);
    root.add(board);
    this.anchors.board = new THREE.Vector3(-4.4, 1.9, BACK + 0.2);
    S.plane(0.9, 0.12, this.signMat('NOTICE BOARD', 0.9, 0.12, '#1a2026', '#e8e0c8'), -4.4, 2.48, BACK + 0.03);

    // map of Whitehorse with pins
    S.box(1.2, 0.84, 0.03, this.cm(0x1a1a1a, 0.5), -2.6, 1.82, BACK + 0.02);
    S.plane(1.14, 0.78, this.pm('map', mapTex(), { roughness: 0.85 }), -2.6, 1.82, BACK + 0.037);
    const rp = rng(9);
    for (let i = 0; i < 7; i++) S.box(0.018, 0.018, 0.04, this.cm(i < 5 ? 0xd02020 : 0x2040d0, 0.3), -2.5 + (rp() - 0.3) * 0.5, 1.75 + (rp() - 0.5) * 0.4, BACK + 0.055);

    // wall TV with muted news
    S.box(0.06, 0.06, 0.24, this.mDark, -1.95, 2.55, BACK + 0.12);
    S.box(0.74, 0.44, 0.05, this.cm(0x0c0c0e, 0.4), -1.95, 2.55, BACK + 0.25, 0, 0.12);
    const tvTx = tvTex();
    this.tvMat = this.mat('stTV', { map: tvTx, emissive: 0xffffff, emissiveMap: tvTx, emissiveIntensity: 1.0, roughness: 0.3 });
    S.plane(0.68, 0.38, this.tvMat, -1.95, 2.553, BACK + 0.278, 0, 0.12);
    this.tvGlow = glow(0x6a9ad8, 1.3, 0.22); this.tvGlow.position.set(-1.95, 2.5, BACK + 0.45); root.add(this.tvGlow);

    // vending machine
    const vend = new THREE.Group();
    const vb = new Batch();
    vb.box(0.9, 1.9, 0.7, this.cm(0x1a3050, 0.45, 0.2), 0, 0.95, 0);
    vb.box(0.06, 1.9, 0.72, this.cm(0xc02030, 0.5), -0.42, 0.95, 0);
    const vtx = vendTex();
    vb.plane(0.6, 1.24, this.mat('stVendGlass', { map: vtx, emissive: 0xffffff, emissiveMap: vtx, emissiveIntensity: 0.8, roughness: 0.2 }), -0.07, 1.18, 0.352);
    vb.box(0.18, 0.5, 0.02, this.cm(0x2a2e34, 0.4, 0.6), 0.32, 1.25, 0.355);
    vb.box(0.08, 0.04, 0.02, this.em(0x40ff60, 1.5), 0.32, 1.42, 0.37);
    vb.box(0.6, 0.18, 0.04, this.cm(0x080a0c, 0.5), -0.07, 0.3, 0.36);
    vb.plane(0.86, 0.1, this.signMat('ICE COLD DRINKS', 0.86, 0.1, '#d02030', '#ffffff', { emissive: 0.9 }), 0, 1.86, 0.352);
    vb.flush(vend);
    vend.position.set(-1.2, 0, BACK + 0.4);
    root.add(vend);
    const vg = glow(0x8ac0e8, 1.6, 0.22); vg.position.set(-1.2, 1.2, BACK + 0.9); root.add(vg);
    this.pool(0x6aa0e0, -1.2, -2.9, 1.6, 1.4, 0.12);
    this.colliders.push({ x: -1.2, z: BACK + 0.4, r: 0.5 });
    this.anchors.vending = new THREE.Vector3(-1.2, 1.4, BACK + 0.8);
    S.cyl(0.15, 0.4, this.cm(0x3a3e44, 0.6, 0.3), -1.85, 0.2, -3.7, { seg: 10, taper: 1.1 });
    S.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), -1.85, 0.44, -3.7, { seg: 8 });
  }

  // ---------------------------------------------------------------- offices

  buildOffices() {
    const S = this.S, root = this.root;
    this.door(-0.4, BACK + 0.02, { sign: 'DETECTIVES', w: 0.9 });
    // window frames, glass, blinds
    const alu = this.cm(0x4a5058, 0.4, 0.6);
    for (const [a, b] of [[0.15, 2.1], [2.3, 4.3]]) {
      S.box(b - a + 0.08, 0.05, 0.12, alu, (a + b) / 2, 2.2, BACK);
      S.box(b - a + 0.08, 0.06, 0.18, alu, (a + b) / 2, 1.15, BACK + 0.02);
      S.box(0.04, 1.05, 0.12, alu, a, 1.67, BACK); S.box(0.04, 1.05, 0.12, alu, b, 1.67, BACK);
      S.box(b - a, 1.05, 0.02, this.mat('stGlass', { color: 0xbfd2e0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }), (a + b) / 2, 1.67, BACK + 0.01);
    }
    const bl = (kind, rx) => {
      const t = blindsTex(kind).clone(); t.needsUpdate = true; t.repeat.set(rx, 1);
      return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.8, side: THREE.DoubleSide });
    };
    // left: blinds pulled half up, a bent slat; right: closed but tilted open
    const b1 = this.plane(1.95, 0.42, bl('closed', 4), 1.125, 1.98, BACK + 0.04); b1.userData.blinds = true;
    S.box(1.95, 0.03, 0.04, this.cm(0xb8bab4, 0.6), 1.125, 1.76, BACK + 0.04);
    const b2 = this.plane(1.98, 1.02, bl('tilt', 4), 3.3, 1.67, BACK + 0.04); b2.userData.blinds = true;
    S.box(1.98, 0.03, 0.04, this.cm(0xb8bab4, 0.6), 3.3, 1.17, BACK + 0.04);
    for (const x of [1.6, 4.0]) S.cyl(0.003, 0.5, this.cm(0xd8d8d0), x, 1.5, BACK + 0.05, { seg: 3 });

    // inside: walls, desks with lamps, case board, cabinets
    const ow = this.cm(0x6a706c, 0.9);
    S.box(4.4, 2.6, 0.08, ow, 2.2, 1.3, -6.5);
    S.box(0.08, 2.6, 2.5, ow, 0.05, 1.3, -5.25);
    S.box(0.08, 2.4, 2.5, ow, 2.2, 1.2, -5.25);
    const top = this.mat('stDeskTop', { map: pixTex('wood'), color: 0x8a7a68, roughness: 0.5 });
    const deskAt = (x) => {
      S.box(1.4, 0.04, 0.75, top, x, 0.76, -5.6);
      S.box(0.4, 0.72, 0.7, this.cm(0x4a4e52, 0.6, 0.3), x + 0.45, 0.37, -5.6);
      S.box(0.04, 0.72, 0.7, this.cm(0x4a4e52, 0.6, 0.3), x - 0.66, 0.37, -5.6);
      S.box(0.46, 0.08, 0.44, this.cm(0x23262c, 0.9), x, 0.48, -6.1);
      S.box(0.44, 0.5, 0.06, this.cm(0x23262c, 0.9), x, 0.78, -6.32);
    };
    deskAt(1.1); deskAt(3.4);
    const monScr = this.pm('scrB', screenTex('mug'), { emissive: 0xffffff, emissiveMap: screenTex('mug'), emissiveIntensity: 0.85 });
    for (const x of [1.45, 3.0]) {
      S.box(0.5, 0.34, 0.04, this.cm(0x1a1c20, 0.5), x, 1.05, -5.85);
      S.plane(0.46, 0.3, monScr, x, 1.05, -5.828);
      S.box(0.06, 0.12, 0.06, this.cm(0x1a1c20), x, 0.84, -5.88);
      const g = glow(0x6aa8e0, 0.8, 0.25); g.position.set(x, 1.05, -5.7); root.add(g);
    }
    // banker's lamp (green) and a gooseneck desk lamp — warm pools
    S.cyl(0.07, 0.03, this.cm(0xb8a050, 0.3, 0.8), 0.65, 0.795, -5.5, { seg: 8 });
    S.cyl(0.012, 0.28, this.cm(0xb8a050, 0.3, 0.8), 0.65, 0.92, -5.5, { seg: 5 });
    S.cyl(0.1, 0.07, this.mat('stBanker', { color: 0x1a5a30, emissive: 0x0a3a1a, roughness: 0.2 }), 0.65, 1.08, -5.5, { rz: Math.PI / 2, seg: 10, taper: 0.9 });
    S.cyl(0.05, 0.04, this.cm(0x1a1a1a, 0.5), 3.95, 0.8, -5.45, { seg: 8 });
    S.cyl(0.01, 0.38, this.cm(0x1a1a1a), 3.95, 0.98, -5.45, { seg: 4, rz: 0.3 });
    S.cyl(0.09, 0.12, this.cm(0x2a2a2a, 0.4, 0.4), 3.86, 1.16, -5.45, { taper: 0.4, seg: 8 });
    for (const [x, y, s] of [[0.65, 1.02, 0.9], [3.86, 1.08, 0.8]]) {
      const g = glow(0xffb060, s, 0.55); g.position.set(x, y, -5.35); root.add(g);
      this.pool(0xffa050, x, -5.45, 1.2, 0.8, 0.18);
    }
    // papers, folders, mugs on desks
    for (let i = 0; i < 4; i++) S.box(0.32, 0.04 + i * 0.01, 0.24, i % 2 ? this.mPaper : this.mat('stFold-12888160', { color: 0xc8a860, roughness: 0.85 }), 1.0 + i * 0.05, 0.8 + i * 0.03, -5.45, i * 0.15);
    S.box(0.3, 0.18, 0.24, this.mPaper, 3.35, 0.87, -5.4, 0.1);
    S.cyl(0.04, 0.1, this.cm(0xe8e4dc, 0.4), 1.75, 0.83, -5.35, { seg: 8 });
    // case board with red string — the bar killings
    S.box(1.5, 0.86, 0.03, this.cm(0x9a9c98, 0.5, 0.4), 1.1, 1.62, -6.44);
    S.plane(1.44, 0.8, this.pm('caseboard', caseBoardTex(), { roughness: 0.6 }), 1.1, 1.62, -6.42);
    // filing cabinet + bookshelf + calendar
    const cab = this.cm(0x6a7068, 0.5, 0.4);
    S.box(0.46, 1.32, 0.6, cab, 0.35, 0.66, -6.15);
    for (let i = 0; i < 4; i++) { S.box(0.4, 0.02, 0.01, this.mDark, 0.35, 0.33 + i * 0.32, -5.84); S.box(0.08, 0.02, 0.02, this.mStee, 0.35, 0.28 + i * 0.32, -5.84); }
    S.box(0.36, 0.14, 0.28, this.cm(0x9a7a4a, 0.9), 0.35, 1.39, -6.15, 0.2);
    const spines = this.pm('spines', spinesTex(), { roughness: 0.8 });
    S.box(0.8, 1.9, 0.3, this.cm(0x3a3430, 0.7), 3.95, 0.95, -6.3);
    for (const y of [0.55, 1.0, 1.45, 1.85]) S.box(0.72, 0.3, 0.26, spines, 3.95, y - 0.2 + 0.15, -6.28);
    S.plane(0.3, 0.42, this.pm('calendar', ptex('calendar', 30, 42, (ctx, w, h, r) => { ctx.fillStyle = '#f0f0ea'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a5a8a'; ctx.fillRect(0, 0, w, 16); ctx.fillStyle = '#e0e8f0'; ctx.fillRect(4, 3, 22, 10); for (let y = 19; y < h - 2; y += 4) for (let x = 2; x < w - 2; x += 4) { ctx.fillStyle = r() < 0.15 ? '#c02020' : '#9aa0a4'; ctx.fillRect(x, y, 3, 3); } })), 2.85, 1.62, -6.45);
    // a parka thrown over the chair in office 2
    S.box(0.5, 0.42, 0.12, this.mat('stParka-1844024', { map: pixTex('cloth'), color: 0x1c2638, roughness: 0.95 }), 3.4, 0.82, -6.27, 0, -0.1);
    const offLight = new THREE.PointLight(0xffc890, 4.5, 5.5, 1.6); offLight.position.set(2.2, 1.8, -5.2); root.add(offLight);
    this.lights.office = offLight;
    this.anchors.offices = new THREE.Vector3(2.2, 1.7, BACK + 0.1);

    // corridor-side: copier with an "out of order" note, recycling bin
    {
      const cx = 3.5, cz = -3.62, fz = cz + 0.3; // front face
      const body = this.cm(0xb4b6b0, 0.45), panel = this.cm(0x8e918c, 0.5), dk = this.cm(0x2a2e34, 0.5), gap = this.cm(0x141618, 0.8);
      {
        const S2 = S;
        S2.box(0.74, 0.07, 0.54, gap, cx, 0.035, cz, 0, 0, 0, 0.01);
        for (const [ox, oz] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]]) S2.cyl(0.025, 0.04, dk, cx + ox, 0.03, cz + oz, { rx: Math.PI / 2, seg: 16 });
        // paper cabinet with two cassettes
        S2.box(0.8, 0.5, 0.58, body, cx, 0.33, cz - 0.01);
        for (const [y, h] of [[0.2, 0.2], [0.44, 0.2]]) {
          S2.box(0.76, h, 0.025, panel, cx, y, fz, 0, 0, 0, 0.008);
          S2.box(0.28, 0.03, 0.02, gap, cx, y + h / 2 - 0.035, fz + 0.012, 0, 0, 0, 0.008);
          S2.box(0.04, 0.05, 0.004, this.cm(0x6a8aa0, 0.3), cx + 0.3, y, fz + 0.014);
          S2.box(0.022, 0.03, 0.004, this.cm(0xd8d4c8, 0.6), cx + 0.3, y - 0.004, fz + 0.016);
        }
        // print engine with a front door, a side output tray, the scanner and document feeder
        S2.box(0.78, 0.3, 0.58, body, cx, 0.73, cz - 0.01);
        S2.box(0.7, 0.24, 0.02, panel, cx - 0.02, 0.73, fz - 0.001, 0, 0, 0, 0.008);
        S2.box(0.12, 0.018, 0.02, gap, cx - 0.02, 0.83, fz + 0.012, 0, 0, 0, 0.007);
        S2.box(0.3, 0.012, 0.36, this.cm(0x9a9c98, 0.5), cx - 0.52, 0.72, cz, 0, 0, -0.12, 0.004);
        this.paperStack(S2, cx - 0.52, 0.728, cz, 3, 0, 21);
        S2.box(0.76, 0.07, 0.56, this.cm(0x3e4246, 0.5), cx, 0.915, cz - 0.01, 0, 0, 0, 0.012);
        S2.box(0.62, 0.025, 0.4, this.cm(0x34383c, 0.5), cx - 0.04, 0.962, cz - 0.03, 0, 0, 0, 0.008);
        S2.box(0.3, 0.008, 0.26, this.cm(0x2a2e32, 0.5), cx - 0.1, 0.99, cz - 0.03, 0, 0, -0.14);
        S2.box(0.3, 0.002, 0.22, this.mPaper, cx - 0.06, 1.0, cz - 0.02, 0.05, 0, -0.14);
        // control panel, tilted towards the user: display, keypad, start button
        S2.box(0.3, 0.035, 0.14, this.cm(0x5a5e62, 0.45), cx + 0.2, 0.93, fz + 0.03, 0, 0.45, 0, 0.01);
        S2.box(0.11, 0.004, 0.06, this.em(0x6ab0d8, 0.6), cx + 0.13, 0.95, fz + 0.025, 0, 0.45, 0);
        for (let i = 0; i < 9; i++) S2.box(0.016, 0.006, 0.014, this.cm(0xd8d8d0, 0.6), cx + 0.23 + (i % 3) * 0.024, 0.95 - Math.floor(i / 3) * 0.008, fz + 0.01 + Math.floor(i / 3) * 0.02, 0, 0.45, 0);
        S2.cyl(0.013, 0.008, this.cm(0x30a050, 0.4), cx + 0.32, 0.944, fz + 0.035, { seg: 16, rx: 0.45 });
        S2.box(0.05, 0.012, 0.008, this.em(0xffa020, 2), cx + 0.32, 0.918, fz + 0.1, 0, 0.45, 0);
      }
      // the "out of order" sticky, a curl at the corner
      S.plane(0.12, 0.12, this.pm('sticky', ptex('sticky', 12, 12, (ctx, w, h) => { ctx.fillStyle = '#f0e060'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#d8c840'; ctx.fillRect(0, 0, w, 2); ctx.fillStyle = '#3a3020'; ctx.fillRect(2, 4, 8, 1); ctx.fillRect(2, 6, 6, 1); ctx.fillRect(2, 8, 7, 1); }), { roughness: 0.9 }), cx - 0.1, 0.76, fz + 0.012, 0, 0, 0.1);
    }
    // blue recycling bin with a slotted lid
    S.add(binGeo(0.15, 0.18, 0.5), this.cm(0x1a4a8a, 0.45), 0.9, 0, -3.78);
    S.add(lathe('recLid', [[0, 0], [0.184, -0.005], [0.184, -0.03], [0.196, -0.03], [0.196, 0], [0.18, 0.012], [0.12, 0.03], [0, 0.03]], 28), this.cm(0x16407a, 0.45), 0.9, 0.51, -3.78);
    S.box(0.2, 0.006, 0.03, this.cm(0x081a30, 0.8), 0.9, 0.541, -3.78);
    S.plane(0.16, 0.06, this.signMat('RECYCLE', 0.16, 0.06, '#e8ecf0', '#1a4a8a'), 0.9, 0.32, -3.78 + 0.17, 0, 0.06);
    this.paperStack(S, 0.92, 0.545, -3.8, 3, 0.25, 22);
    // wall sign pointing to the cells
    S.plane(0.62, 0.14, this.signMat('CELLS ►', 0.62, 0.14, '#2a2a20', '#e8d890'), 4.08, 2.5, BACK + 0.03);
  }

  // ---------------------------------------------------------------- holding cell

  buildCell() {
    const S = this.S, root = this.root;
    const back = this.mat('stCellBack', { map: cellWallTex('back'), roughness: 0.9 });
    const side = this.mat('stCellSide', { map: cellWallTex('side'), roughness: 0.9 });
    // back wall with a small high window (x 6.45..7.05, y 2.2..2.5)
    S.box(1.95, H, 0.1, back, 5.45, H / 2, -6.5);
    S.box(0.7, H, 0.1, back, 7.4, H / 2, -6.5);
    S.box(0.6, 2.2, 0.1, back, 6.75, 1.1, -6.5);
    S.box(0.6, 0.5, 0.1, back, 6.75, 2.75, -6.5);
    S.box(0.1, H, 2.6, side, 4.45, H / 2, -5.2);
    S.box(0.1, H, 2.6, side, 7.75, H / 2, -5.2);
    S.box(3.2, 0.06, 2.6, this.cm(0x8a8c84, 0.9), 6.1, H - 0.03, -5.2);
    const cf = this.pm('concrete', concreteTex(), { roughness: 0.9 });
    S.box(3.2, 0.02, 2.6, cf, 6.1, 0.005, -5.2);
    S.cyl(0.07, 0.01, this.cm(0x1a1a18, 0.6, 0.5), 6.1, 0.018, -5.0, { seg: 10 });
    // window: snow light, bars, frost
    const sky = new THREE.MeshBasicMaterial({ color: 0xdce8f4 });
    this.plane(0.8, 0.5, sky, 6.75, 2.35, -6.62);
    S.box(0.62, 0.04, 0.14, this.cm(0xe8eef2, 0.9), 6.75, 2.2, -6.52);
    for (let i = 0; i < 4; i++) S.cyl(0.012, 0.3, this.mDark, 6.5 + i * 0.165, 2.35, -6.47, { seg: 5 });
    this.plane(0.6, 0.3, new THREE.MeshBasicMaterial({ map: frostTex(), transparent: true, depthWrite: false, color: 0xc8d4dc }), 6.75, 2.35, -6.46);
    const cw = glow(0xd0e4ff, 1.4, 0.35); cw.position.set(6.75, 2.35, -6.3); root.add(cw);
    if (!this.low) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.6), new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xa8c8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      shaft.position.set(6.5, 1.3, -5.7); shaft.rotation.set(-0.55, 0, 0.18); shaft.renderOrder = 4;
      root.add(shaft);
      this.pool(0xb8d0ff, 6.2, -4.9, 1.0, 0.7, 0.14);
    }
    // steel bunk: a folded plate cantilevered off the back wall on welded gussets, bolt plates,
    // a thin vinyl mattress, a folded blanket, a paperback
    const bx = 5.65, bw = 2.0;
    S.box(bw, 0.035, 0.56, this.mStee, bx, 0.43, -6.17, 0, 0, 0, 0.01);
    S.box(bw, 0.075, 0.02, this.cm(0x8a9096, 0.4, 0.75), bx, 0.405, -5.9, 0, 0, 0, 0.008);
    S.box(bw, 0.02, 0.035, this.cm(0x8a9096, 0.4, 0.75), bx, 0.372, -5.92, 0, 0, 0, 0.008);
    const gusset = cached('bunkGusset', () => profileX(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, -0.03), new THREE.Vector2(0, -0.3)]), 0.012, 0.003));
    for (const gx of [bx - 0.8, bx, bx + 0.8]) {
      S.add(gusset, this.cm(0x7a7e80, 0.5, 0.6), gx, 0.412, -6.44);
      S.box(0.12, 0.34, 0.012, this.cm(0x6a6e70, 0.5, 0.6), gx, 0.27, -6.444, 0, 0, 0, 0.004);
      for (const by of [0.15, 0.39]) S.cyl(0.012, 0.012, this.mDark, gx + 0.035, by, -6.436, { rx: Math.PI / 2, seg: 16 }), S.cyl(0.012, 0.012, this.mDark, gx - 0.035, by, -6.436, { rx: Math.PI / 2, seg: 16 });
    }
    S.add(cached('mattress', () => roundedBox(1.8, 0.06, 0.5, 0.028, 3)), this.cm(0x2a3a5a, 0.45), bx - 0.05, 0.477, -6.17);
    S.box(1.75, 0.006, 0.006, this.cm(0x1a2840, 0.6), bx - 0.05, 0.477, -5.92);
    const blanket = this.mat('stBlanket', { map: pixTex('cloth'), color: 0x6a6a5a, roughness: 1 });
    for (let i = 0; i < 3; i++) S.add(cached(`blanket${i}`, () => roundedBox(0.46 - i * 0.02, 0.035, 0.36 - i * 0.01, 0.016, 2)), blanket, bx + 0.62 + i * 0.006, 0.525 + i * 0.033, -6.18, 1, 1, 1, 0, i * 0.04, 0);
    S.box(0.13, 0.025, 0.2, this.cm(0x8a2a20, 0.7), bx - 0.7, 0.522, -6.12, 0.3, 0, 0, 0.005);
    S.box(0.12, 0.02, 0.19, this.cm(0xe8e0c8, 0.9), bx - 0.695, 0.522, -6.12, 0.3, 0, 0, 0.003);
    // stainless toilet/sink combo: rear chase with rounded corners, a basin in the deck, a
    // bubbler and push-buttons, a seatless bowl with a rolled rim
    const st = this.mStee, stD = this.cm(0x6a7078, 0.3, 0.8);
    const tx = 7.3;
    S.box(0.5, 0.96, 0.22, st, tx, 0.48, -6.33, 0, 0, 0, 0.03);
    const deck = cached('sinkDeck', () => {
      const sh = new THREE.Shape();
      const W = 0.25, D = 0.17, R = 0.04;
      sh.moveTo(-W + R, -D); sh.lineTo(W - R, -D); sh.quadraticCurveTo(W, -D, W, -D + R); sh.lineTo(W, D - R); sh.quadraticCurveTo(W, D, W - R, D); sh.lineTo(-W + R, D); sh.quadraticCurveTo(-W, D, -W, D - R); sh.lineTo(-W, -D + R); sh.quadraticCurveTo(-W, -D, -W + R, -D);
      const hole = new THREE.Path(); hole.absellipse(0, -0.02, 0.15, 0.1, 0, Math.PI * 2, true);
      sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 20 });
      g.rotateX(-Math.PI / 2);
      return g;
    });
    S.add(deck, st, tx, 0.95, -6.27);
    S.add(lathe('basin', [[0.15, 0.0], [0.145, -0.03], [0.12, -0.07], [0.06, -0.09], [0, -0.092]], 24), stD, tx, 0.98, -6.25, 1, 1, 0.68);
    S.add(lathe('bubbler', [[0, 0], [0.022, 0], [0.018, 0.04], [0.012, 0.06], [0.016, 0.075], [0, 0.08]], 16), st, tx + 0.15, 0.995, -6.38);
    for (const ox of [-0.12, 0.12]) S.cyl(0.018, 0.012, this.cm(0x9aa0a8, 0.3, 0.8), tx + ox, 0.8, -6.217, { rx: Math.PI / 2, seg: 16 });
    S.box(0.36, 0.1, 0.006, this.cm(0x8a9096, 0.4, 0.7), tx, 0.62, -6.218, 0, 0, 0, 0.002);
    const bowl = new THREE.Mesh(lathe('wcBowl', [[0.13, 0], [0.13, 0.05], [0.15, 0.18], [0.18, 0.33], [0.195, 0.39], [0.19, 0.41], [0.17, 0.418], [0.15, 0.4], [0.14, 0.37], [0.1, 0.28], [0.05, 0.215], [0, 0.21]], 28), st);
    bowl.scale.set(0.95, 1, 1.25);
    bowl.position.set(tx, 0, -6.05);
    bowl.name = 'toilet';
    root.add(bowl);
    // stains below the bunk
    S.plane(0.8, 0.5, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }), 6.4, 0.017, -5.75, 0, -Math.PI / 2);
    // caged light on the cell ceiling + camera
    S.box(0.3, 0.06, 0.18, this.cm(0x3a3e40, 0.5, 0.4), 6.1, 2.93, -5.4);
    S.box(0.24, 0.04, 0.12, this.em(0xe0ecff, 2.0), 6.1, 2.9, -5.4);
    for (let i = 0; i < 4; i++) S.box(0.01, 0.06, 0.16, this.mDark, 6.0 + i * 0.065, 2.88, -5.4);
    S.cyl(0.06, 0.05, this.cm(0x101214, 0.2, 0.3), 4.6, 2.95, -6.35, { taper: 0.8, seg: 8 });
    const cellLight = new THREE.PointLight(0xc8d8ec, 2.0, 4, 1.6); cellLight.position.set(6.1, 2.6, -5.2); root.add(cellLight);
    this.lights.cell = cellLight;

    // barred front (fixed part skips the sliding door opening)
    const barMat = this.mat('bars', { color: 0x262a30, metalness: 0.8, roughness: 0.4 });
    const bars = new THREE.Group();
    const bb = new Batch();
    for (let i = 0; i < 17; i++) {
      const x = 4.55 + i * 0.19;
      if (x > 5.55 && x < 6.6) continue;
      bb.cyl(0.018, 2.6, barMat, x, 1.3, 0, { seg: 6 });
    }
    for (const [a, b] of [[4.5, 5.6], [6.6, 7.7]]) { bb.box(b - a, 0.06, 0.05, barMat, (a + b) / 2, 1.1, 0); bb.box(b - a, 0.06, 0.05, barMat, (a + b) / 2, 0.1, 0); }
    bb.box(3.2, 0.1, 0.08, barMat, 6.1, 2.6, 0);
    bb.box(0.08, 2.6, 0.1, barMat, 4.5, 1.3, 0); bb.box(0.08, 2.6, 0.1, barMat, 7.7, 1.3, 0);
    bb.flush(bars);
    bars.position.z = BACK + 0.02;
    root.add(bars);
    const cellDoor = new THREE.Group();
    const db = new Batch();
    for (let i = 0; i < 6; i++) db.cyl(0.018, 2.5, barMat, i * 0.19, 1.25, 0, { seg: 6 });
    for (const y of [0.1, 1.1, 2.48]) db.box(1.05, 0.06, 0.05, barMat, 0.48, y, 0);
    db.box(0.14, 0.24, 0.08, this.cm(0x3a3e44, 0.4, 0.7), 0.02, 1.1, 0.02);
    db.box(0.32, 0.12, 0.04, barMat, 0.48, 0.9, 0.0);
    db.flush(cellDoor);
    cellDoor.position.set(5.6, 0, BACK + 0.12);
    root.add(cellDoor);
    this.cellDoor = cellDoor;
    this.cellDoorX = 5.6;
    const cellSign = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.2), this.signMat('HOLDING CELL · 1', 2.1, 0.2, '#2a2a20', '#e8d890', { border: '#8a7a40', emissive: 0.35 }));
    cellSign.position.set(6.1, 2.8, BACK + 0.05); root.add(cellSign);
    this.anchors.cellInside = { x: 6.1, z: -5.4 };
    this.anchors.cellBench = { x: 5.6, z: -6.0 };
    this.anchors.cellDoor = new THREE.Vector3(6.1, 2.0, BACK + 0.2);
    // red "in custody" lamp
    S.box(0.14, 0.14, 0.06, this.mDark, 7.95, 2.6, BACK + 0.04);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), this.mat('custodyLamp', { color: 0, emissive: 0xff3a20, emissiveIntensity: 3 }));
    lamp.position.set(7.95, 2.6, BACK + 0.1); root.add(lamp);
    const lg = glow(0xff3020, 0.8, 0.45); lg.position.set(7.95, 2.6, BACK + 0.16); root.add(lg);
  }

  // ---------------------------------------------------------------- right side

  buildRight() {
    const S = this.S, root = this.root;
    // coffee corner: base cabinet with two doors, laminate top, drip machine, cups, doughnuts
    {
      const cx = 8.45, cz = -3.75, fz = cz + 0.225;
      const carc = this.cm(0x5a4a3c, 0.6), door = this.mat('stCabDoor', { map: pixTex('wood'), color: 0x6a5644, roughness: 0.55 });
      S.box(0.8, 0.08, 0.4, this.cm(0x16181a, 0.8), cx, 0.04, cz - 0.02, 0, 0, 0, 0.01);
      S.box(0.86, 0.78, 0.45, carc, cx, 0.47, cz, 0, 0, 0, 0.01);
      for (const s of [-1, 1]) {
        S.box(0.415, 0.74, 0.02, door, cx + s * 0.215, 0.47, fz + 0.005, 0, 0, 0, 0.007);
        S.box(0.016, 0.14, 0.016, this.mStee, cx + s * 0.03, 0.72, fz + 0.035, 0, 0, 0, 0.007);
        for (const dy of [-0.06, 0.06]) S.box(0.01, 0.01, 0.02, this.mStee, cx + s * 0.03, 0.72 + dy, fz + 0.022);
      }
      S.box(0.9, 0.035, 0.48, this.cm(0x9a9488, 0.45), cx, 0.878, cz + 0.01, 0, 0, 0, 0.008);
      S.box(0.9, 0.012, 0.012, this.cm(0x5a5650, 0.5), cx, 0.866, cz + 0.252, 0, 0, 0, 0.005);
      // drip machine: foot plate, tower, brew head, glass carafe with a handle
      const blk = this.cm(0x16181a, 0.4);
      S.box(0.24, 0.025, 0.26, blk, 8.2, 0.908, -3.76, 0, 0, 0, 0.01);
      S.box(0.2, 0.36, 0.1, blk, 8.2, 1.075, -3.85, 0, 0, 0, 0.02);
      S.box(0.24, 0.08, 0.22, blk, 8.2, 1.215, -3.78, 0, 0, 0, 0.02);
      S.box(0.12, 0.14, 0.002, this.mat('stTank', { color: 0x8aa0b0, roughness: 0.1, transparent: true, opacity: 0.4 }), 8.2, 1.1, -3.799);
      S.add(lathe('carafe', [[0, 0], [0.06, 0], [0.075, 0.03], [0.078, 0.07], [0.06, 0.12], [0.055, 0.15], [0.05, 0.15], [0.052, 0.12], [0.07, 0.07], [0, 0.01]], 24), this.mat('stPot', { color: 0x3a1a08, roughness: 0.1, transparent: true, opacity: 0.85 }), 8.2, 0.92, -3.72);
      S.box(0.12, 0.012, 0.12, blk, 8.2, 1.075, -3.72, 0, 0, 0, 0.004);
      S.add(cached('carafeH', () => new THREE.TorusGeometry(0.04, 0.008, 8, 16, Math.PI)), blk, 8.27, 1.0, -3.72, 1, 1, 1, 0, 0, -Math.PI / 2);
      S.box(0.02, 0.02, 0.01, this.em(0xff2010, 3), 8.28, 0.94, -3.635);
      for (let i = 0; i < 4; i++) S.add(lathe('cup', [[0, 0], [0.028, 0], [0.04, 0.1], [0.036, 0.1], [0.025, 0.006], [0, 0.006]], 20), this.cm(0xece8e0, 0.6), 8.42, 0.896 + i * 0.012, -3.82);
      this.mug(S, 8.55, 0.896, -3.62, 0x1a3a6a, 0.4);
      this.mug(S, 8.66, 0.896, -3.76, 0x8a1a1a, -1.2);
      S.box(0.36, 0.07, 0.3, this.cm(0xe8a0b0, 0.8), 8.72, 0.932, -3.8, -0.1, 0, 0, 0.006);
      S.box(0.36, 0.006, 0.3, this.cm(0xf0d8e0, 0.8), 8.72, 0.99, -3.67, -0.1, -0.9);
      const rd = rng(17);
      for (let i = 0; i < 4; i++) S.add(cached('donut', () => new THREE.TorusGeometry(0.035, 0.018, 10, 18)), this.cm([0xc89050, 0x6a3a20, 0xe8b0c0, 0xc89050][i], 0.7), 8.62 + (i % 2) * 0.12 + (rd() - 0.5) * 0.02, 0.958, -3.85 + Math.floor(i / 2) * 0.11, 1, 1, 1, Math.PI / 2, rd(), 0);
    }
    S.plane(0.56, 0.38, this.pm('roster', rosterTex()), 8.45, 1.62, BACK + 0.02);
    const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), this.mat('stClock', { map: clockTex(), transparent: true, alphaTest: 0.5, roughness: 0.4 }));
    clock.position.set(8.4, 2.4, BACK + 0.04); clock.name = 'clock'; root.add(clock);
    // fire extinguisher
    S.cyl(0.075, 0.5, this.cm(0xb01010, 0.35, 0.2), 7.92, 0.55, BACK + 0.1, { seg: 10 });
    S.cyl(0.03, 0.08, this.cm(0x1a1a1a), 7.92, 0.84, BACK + 0.1, { seg: 6 });
    S.plane(0.18, 0.18, this.signMat('FIRE', 0.18, 0.18, '#c01010', '#ffffff'), 7.92, 1.2, BACK + 0.02);

    // med post alcove
    const mpTex = ptex('medwall', 64, 96, (ctx, w, h, r) => {
      ctx.fillStyle = '#b4c0be'; ctx.fillRect(0, 0, w, h);
      for (let y = h - 56; y < h; y++) for (let x = 0; x < w; x++) { const v = (x % 8 === 0 || (h - y) % 8 === 0) ? 150 : 200 + (r() - 0.5) * 10; ctx.fillStyle = `rgb(${v},${v + 2},${v + 2})`; ctx.fillRect(x, y, 1, 1); }
      ctx.fillStyle = '#4a8a9a'; ctx.fillRect(0, h - 58, w, 2);
      noise(ctx, w, h, 6, r);
    });
    const mpMat = this.pm('medwall', mpTex, { roughness: 0.7 });
    S.box(1.6, 2.3, 0.08, mpMat, 9.8, 1.15, -6.0);
    S.box(0.08, 2.3, 2.0, mpMat, 9.0, 1.15, -5.0);
    S.box(0.08, 2.3, 2.0, mpMat, 10.6, 1.15, -5.0);
    S.box(1.6, 0.06, 2.0, this.cm(0xc8ccc8, 0.9), 9.8, 2.33, -5.0);
    S.box(0.8, 0.03, 0.22, this.em(0xe8f2ff, 1.2), 9.8, 2.295, -5.0);
    this.medOpen = false;
    this.medArea = { minX: 9.2, maxX: 10.4, minZ: -5.6, maxZ: -2.5, enabled: () => this.medOpen };
    this.bounds.walk.areas.push(this.medArea);
    // roll-up shutter over the opening: down (closed) until the sergeant sends him for the blood test
    const shTex = ptex('medshutter', 32, 64, (ctx, w, h, r) => {
      for (let y = 0; y < h; y++) { const v = (y % 4 === 0) ? 96 : (y % 4 === 1 ? 168 : 142) + (r() - 0.5) * 8; ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`; ctx.fillRect(0, y, w, 1); }
      noise(ctx, w, h, 8, r);
    });
    const shGeo = bevelBox(1.62, 2.3, 0.04).clone();
    shGeo.translate(0, -1.15, 0); // pivot at the top: rolling up = scaling towards it
    const shutter = new THREE.Mesh(shGeo, this.pm('medshutter', shTex, { roughness: 0.5, metalness: 0.5 }));
    shutter.position.set(9.8, 2.3, BACK + 0.045);
    root.add(shutter);
    const closed = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), this.signMat('CLOSED · FERMÉ', 0.5, 0.16, '#a01010', '#ffffff'));
    closed.position.set(0, -1.1, 0.025);
    shutter.add(closed);
    S.box(1.72, 0.2, 0.16, this.cm(0x6a7278, 0.5, 0.4), 9.8, 2.42, BACK + 0.06);
    this.medShutter = shutter;
    this.medShutterTarget = 1;
    S.plane(1.2, 0.22, this.signMat('FIRST AID ✚', 1.2, 0.22, '#f0f4f6', '#b01818', { border: '#b01818' }), 9.8, 2.5, BACK + 0.04);
    // wall cabinet with glass doors and bottles
    S.box(0.7, 0.6, 0.24, this.cm(0x8a9a98, 0.4, 0.3), 9.55, 1.75, -5.84);
    S.box(0.64, 0.54, 0.02, this.cm(0x2a3236, 0.6), 9.55, 1.75, -5.73);
    S.box(0.64, 0.54, 0.01, this.mat('stGlass2', { color: 0xbfd2e0, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }), 9.55, 1.75, -5.715);
    S.box(0.66, 0.015, 0.2, this.cm(0xc8cccc), 9.55, 1.74, -5.8);
    const rb = rng(3);
    for (let i = 0; i < 9; i++) S.cyl(0.025, 0.08 + rb() * 0.06, this.cm([0xe8e8e0, 0x8a5a20, 0x4a8ab0, 0xf0f0f0][i % 4], 0.3), 9.3 + (i % 5) * 0.12, i < 5 ? 1.8 : 1.55, -5.75, { seg: 6 });
    S.plane(0.26, 0.26, this.signMat('✚', 0.26, 0.26, '#ffffff', '#c01010'), 10.25, 1.95, -5.955);
    S.plane(0.24, 0.36, this.pm('eyechart', eyeChartTex()), 10.58 - 0.045, 1.55, -4.6, -Math.PI / 2);
    S.box(0.18, 0.24, 0.12, this.cm(0xf0d020, 0.6), 9.06 + 0.06, 1.2, -4.8);
    S.box(0.19, 0.04, 0.13, this.cm(0xc01010, 0.6), 9.06 + 0.06, 1.34, -4.8);
    S.box(0.25, 0.12, 0.1, this.cm(0xe0e4e8, 0.5), 10.25, 1.35, -5.92);
    S.cyl(0.13, 0.36, this.cm(0xd8d8d0, 0.5), 10.4, 0.18, -4.6, { seg: 10 });
    S.cyl(0.135, 0.04, this.cm(0xe0c020, 0.5), 10.4, 0.38, -4.6, { seg: 10 });
    S.plane(0.3, 0.4, this.pm('handwash', ptex('handwash', 30, 40, (ctx, w, h, r) => { ctx.fillStyle = '#e8f0f4'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a7a9a'; ctx.fillRect(0, 0, w, 7); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#d8b8a0'; ctx.fillRect(3 + (i % 2) * 14, 10 + Math.floor(i / 2) * 10, 10, 7); ctx.fillStyle = '#6ab0d0'; ctx.fillRect(5 + (i % 2) * 14, 12 + Math.floor(i / 2) * 10, 3, 2); } })), 10.15, 1.6, -5.955);
    S.box(0.22, 0.28, 0.1, this.cm(0x3a4044, 0.5), 9.12, 1.6, -5.4);
    S.box(0.16, 0.12, 0.01, this.em(0x40c080, 0.8), 9.172 + 0.0, 1.64, -5.4, Math.PI / 2);
    S.box(0.08, 0.3, 0.3, this.cm(0xe8e8e8, 0.6), 10.54, 1.25, -5.3);
    S.box(0.3, 0.12, 0.14, this.cm(0x4a7ab0, 0.6), 10.5, 1.0, -4.6, Math.PI / 2);
    this.officeChair(9.5, -5.2, 0.4);
    const kit = this.box(0.5, 0.35, 0.3, this.mat('medKit', { color: 0xe8e8e8 }), 10.2, 0.95, -5.6);
    kit.name = 'kit';
    S.box(0.12, 0.12, 0.012, this.cm(0xc01010), 10.2, 0.95, -5.444);
    this.desk(10.2, -5.6, 0.7, 0.5, 0xd8dce0);
    S.box(0.2, 0.08, 0.14, this.cm(0x2a2e34, 0.5), 9.95, 0.82, -5.5);
    S.box(0.1, 0.06, 0.12, this.cm(0x3a6aa0, 0.6), 10.45, 0.81, -5.45);
    const mpLight = new THREE.PointLight(0xe0ecf8, 1.8, 4, 1.6); mpLight.position.set(9.8, 2.1, -5); root.add(mpLight);
    this.lights.med = mpLight;
    this.anchors.medpost = new THREE.Vector3(9.8, 1.6, BACK + 0.1);
    this.anchors.medChair = { x: 9.5, z: -5.2 };

    // evidence boxes + staff photo
    const card = this.pm('cardboard', cardboardTex(), { roughness: 0.95 });
    S.box(0.5, 0.36, 0.4, card, 11.1, 0.18, -3.75, 0.05);
    S.box(0.5, 0.36, 0.4, card, 11.12, 0.54, -3.76, -0.08);
    S.box(0.44, 0.3, 0.36, card, 11.06, 0.87, -3.78, 0.12);
    S.box(0.4, 0.3, 0.03, this.cm(0x2a1a10, 0.5), 11.1, 1.8, BACK + 0.02);
    S.plane(0.34, 0.24, this.pm('groupphoto', photoTex()), 11.1, 1.8, BACK + 0.037);
    S.plane(0.42, 0.1, this.signMat('QUIET · INTERVIEW', 0.42, 0.1, '#7a1010', '#ffffff'), 11.1, 1.48, BACK + 0.02);

    // interrogation door at the far right + recording lamp
    this.interDoor = this.door(12.2, BACK + 0.02, { sign: 'INTERVIEW 2', w: 1.0, color: 0x4a5560 });
    this.anchors.interrogationDoor = new THREE.Vector3(12.2, 2.0, BACK + 0.2);
    S.box(0.1, 0.1, 0.05, this.mDark, 12.95, 2.25, BACK + 0.03);
    S.box(0.06, 0.06, 0.02, this.em(0xffa020, 2.4), 12.95, 2.25, BACK + 0.065);
    const ig = glow(0xffa030, 0.5, 0.35); ig.position.set(12.95, 2.25, BACK + 0.12); root.add(ig);
    S.box(0.1, 0.14, 0.04, this.cm(0x2a2e34, 0.5), 11.5, 1.2, BACK + 0.02);
    S.box(0.06, 0.03, 0.01, this.em(0x40ff60, 1.5), 11.5, 1.24, BACK + 0.045);

    // lockers
    const lk = this.pm('locker', lockerTex(), { roughness: 0.55, metalness: 0.3 });
    for (let i = 0; i < 3; i++) S.box(0.32, 1.85, 0.45, lk, 13.12 + i * 0.33, 0.925, -3.75);
    S.box(0.28, 0.14, 0.3, this.cm(0x3a2a20, 0.8), 13.2, 1.92, -3.78, 0.1);
    S.box(0.34, 0.18, 0.3, this.cm(0x6a7a8a, 0.8), 13.6, 1.94, -3.76, -0.1);
    S.box(0.1, 0.05, 0.02, this.cm(0xf0e060), 13.45, 1.4, -3.52);
  }

  // ---------------------------------------------------------------- ceiling

  buildCeiling() {
    const S = this.S, root = this.root;
    const ct = ceilTex().clone(); ct.needsUpdate = true; ct.repeat.set(28.8 / 2.4, 12 / 2.4);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(28.8, 12), this.mat('stCeil2', { map: ct, roughness: 0.95, color: 0xb8bab4, emissive: 0xffffff, emissiveMap: ct, emissiveIntensity: 0.07 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -1.1);
    root.add(ceil);
    // ceiling cornice shadow along the wall
    S.box(28, 0.06, 0.08, this.cm(0x4a4c48, 0.8), 0, H - 0.03, BACK + 0.04);
    const grilleTex = ptex('grille', 16, 16, (ctx, w, h) => { ctx.fillStyle = '#b8b8b0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#2a2c2a'; for (let y = 2; y < h - 2; y += 2) ctx.fillRect(2, y, w - 4, 1); ctx.fillStyle = '#8a8a84'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, 0, 1, h); });
    const grille = this.pm('grille', grilleTex, { roughness: 0.7 });
    for (const [x, z] of [[-7.8, -2.3], [1.2, -2.3], [10.2, -2.3], [-3.0, 0.7], [4.8, 0.7]]) S.plane(0.56, 0.56, grille, x, H - 0.005, z, 0, Math.PI / 2);
    for (let x = -13.2; x < 14; x += 2.4) for (const z of [-2.0, 0.4]) S.cyl(0.015, 0.03, this.cm(0xd0c8b0, 0.4, 0.6), x, H - 0.02, z, { seg: 5 });
    for (const x of [-4.8, 4.2]) S.cyl(0.07, 0.035, this.cm(0xece8e0, 0.6), x, H - 0.02, -0.2, { seg: 10 });
    S.cyl(0.08, 0.06, this.cm(0x101214, 0.2, 0.3), 3.6, 2.97, -2.6, { taper: 0.8, seg: 10 });
  }

  // ---------------------------------------------------------------- lighting

  buildLighting() {
    const root = this.root;
    const S = this.S;
    const diffTex = ptex('diffuser', 16, 8, (ctx, w, h) => { ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#a8b4c8'; for (let x = 0; x < w; x += 2) ctx.fillRect(x, 0, 1, h); ctx.fillRect(0, 3, w, 1); ctx.fillStyle = '#7a8496'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, h - 1, w, 1); }, { repeat: [4, 1] });
    const lit = this.mat('stTube', { color: 0x000000, emissive: 0xdfeaff, emissiveMap: diffTex, emissiveIntensity: 2.0, side: THREE.DoubleSide });
    const dead = this.cm(0x3a3e44, 0.6);
    // fixtures every 3 m; only some carry real lights (mobile budget), one is dead, one flickers
    const plan = { '-12': 'glow', '-9': 'light', '-6': 'glow', '-3': 'light', 0: 'dead', 3: 'light', 6: 'light', 9: 'glow', 12: 'light' };
    this.fluos = [];
    for (let x = -12; x <= 12; x += 3) {
      const kind = plan[x];
      S.box(1.3, 0.05, 0.68, this.cm(0x9a9e9c, 0.6), x, H - 0.02, -0.8);
      const tubeMat = x === 6 ? lit.clone() : kind === 'dead' ? dead : lit;
      const tube = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.58), tubeMat);
      tube.rotation.x = Math.PI / 2; tube.position.set(x, H - 0.05, -0.8);
      root.add(tube);
      let l = null;
      if (kind === 'light') {
        l = new THREE.SpotLight(0xdfeaff, x === -9 ? 12 : 10, 7, 1.2, 0.9, 1.4);
        l.position.set(x, H - 0.1, -0.8);
        l.target.position.set(x, 0, -0.4);
        root.add(l, l.target);
      }
      if (kind !== 'dead') {
        const hg = glow(0xdfeaff, 1.6, kind === 'light' ? 0.22 : 0.14); hg.position.set(x, H - 0.12, -0.8); root.add(hg);
        this.pool(0xc8d8ff, x, -0.6, 3.2, 2.6, kind === 'light' ? 0.09 : 0.05);
        if (!this.low && kind === 'light') {
          const cone = lightCone(0xcfe0ff, 2.7, 1.5, 0.05);
          cone.position.set(x, H - 1.4, -0.8); root.add(cone);
        }
      }
      this.fluos.push({ group: tube, tube, light: l, base: l ? l.intensity : 0 });
    }
    this.flicker = this.fluos[6];
    const hemi = new THREE.HemisphereLight(0xb8c8dc, 0x26282c, 0.85);
    root.add(hemi);
    this.lights.hemi = hemi;
  }

  // ---------------------------------------------------------------- foreground

  /**
   * Beam seating: an oval-section steel beam on two T-legs with glides, one-piece moulded
   * shells on brackets, arm-rests between the seats. facing 1 = the seats face +z (camera),
   * -1 = backs to the camera. Origin = beam centre on the floor.
   */
  beamSeats(b, cx, cz, len, n, { facing = 1, pad = false, shellCol = 0x3e5c78 } = {}) {
    const steel = this.mStee, dark = this.mDark;
    const shellM = this.cm(shellCol, 0.3, 0.05);
    const padM = this.mat('stSeatPad', { map: pixTex('cloth'), color: 0x4a6a80, roughness: 0.9 });
    const pitch = len / n, sw = Math.min(0.5, pitch - 0.1);
    const ry = facing > 0 ? Math.PI : 0; // shellGeo has its back towards +z
    b.box(len - 0.06, 0.06, 0.08, steel, cx, 0.37, cz, 0, 0, 0, 0.022);
    for (const s of [-1, 1]) {
      const lx = cx + s * (len / 2 - 0.22);
      b.cyl(0.024, 0.33, steel, lx, 0.185, cz, { seg: 16 });
      b.box(0.06, 0.035, 0.56, steel, lx, 0.02, cz, 0, 0, 0, 0.012);
      for (const gz of [-0.25, 0.25]) b.cyl(0.022, 0.012, dark, lx, 0.006, cz + gz, { seg: 16 });
      b.box(0.09, 0.03, 0.1, steel, lx, 0.33, cz, 0, 0, 0, 0.008);
    }
    for (let i = 0; i < n; i++) {
      const x = cx - len / 2 + (i + 0.5) * pitch;
      b.add(shellGeo(sw), shellM, x, 0, cz - facing * 0.02, 1, 1, 1, 0, ry, 0);
      b.box(0.05, 0.05, 0.3, steel, x, 0.425, cz, 0, 0, 0, 0.01);
      if (pad) b.box(sw - 0.06, 0.035, 0.36, padM, x, 0.485, cz + facing * 0.03, 0, 0, 0, 0.016);
      if (i < n - 1) {
        const ax = x + pitch / 2;
        b.box(0.028, 0.24, 0.04, steel, ax, 0.52, cz - facing * 0.06, 0, 0, 0, 0.01);
        b.box(0.05, 0.03, 0.34, dark, ax, 0.645, cz + facing * 0.0, 0, 0, 0, 0.013);
      }
    }
  }

  /** A stack of loose sheets (individually offset) — x, y = bottom, z. */
  paperStack(b, x, y, z, n, ry = 0, seed = 1, w = 0.21, d = 0.297) {
    const r = rng(seed), cols = [0xe8e6de, 0xdcdad0, 0xf0eee6, 0xe4e0d0];
    for (let i = 0; i < n; i++) {
      const m = this.cm(cols[Math.floor(r() * cols.length)], 0.95);
      b.box(w, 0.0035, d, m, x + (r() - 0.5) * 0.012, y + 0.002 + i * 0.0042, z + (r() - 0.5) * 0.012, ry + (r() - 0.5) * 0.06);
    }
    return y + n * 0.0042;
  }

  /** Manila/coloured file folders with papers sticking out, stacked. Returns the top y. */
  folderStack(b, x, y, z, n, ry = 0, seed = 2) {
    const r = rng(seed), cols = [0xc8a860, 0xa8b8c8, 0xc8a860, 0x8a4a40, 0xb8a070, 0x6a8a5a];
    for (let i = 0; i < n; i++) {
      const fm = this.mat(`stFold-${cols[i % cols.length]}`, { color: cols[i % cols.length], roughness: 0.85 });
      const a = ry + (r() - 0.5) * 0.18, ox = (r() - 0.5) * 0.03, oz = (r() - 0.5) * 0.03;
      b.box(0.245, 0.003, 0.315, fm, x + ox, y + 0.0015, z + oz, a);
      const k = 2 + Math.floor(r() * 3);
      for (let j = 0; j < k; j++) b.box(0.21, 0.0025, 0.297, this.mPaper, x + ox + (r() - 0.5) * 0.03, y + 0.004 + j * 0.003, z + oz + (r() - 0.5) * 0.02 + 0.01, a + (r() - 0.5) * 0.08);
      y += 0.004 + k * 0.003;
      b.box(0.245, 0.003, 0.315, fm, x + ox, y + 0.0015, z + oz, a + (r() - 0.5) * 0.03);
      b.box(0.07, 0.003, 0.02, fm, x + ox - 0.06 + r() * 0.12, y + 0.0015, z + oz - 0.165, a);
      y += 0.003;
    }
    return y;
  }

  /** Mug with a handle. */
  mug(b, x, y, z, color, ry = 0) {
    const m = this.cm(color, 0.35);
    b.add(lathe('mug', [[0, 0], [0.036, 0], [0.04, 0.008], [0.041, 0.1], [0.036, 0.1], [0.035, 0.012], [0, 0.012]], 24), m, x, y, z);
    b.add(cached('mugH', () => new THREE.TorusGeometry(0.026, 0.006, 8, 16, Math.PI)), m, x + Math.cos(ry) * 0.04, y + 0.05, z - Math.sin(ry) * 0.04, 1, 1, 1, 0, ry, -Math.PI / 2);
  }


  buildForeground() {
    const steel = this.mStee;
    const chairs = (b, n, extra) => {
      this.beamSeats(b, (n - 1) * 0.29, 0, n * 0.58, n, { facing: -1, shellCol: 0x5a7c9e });
      extra?.(b);
    };
    this.fg(-9.6, 3.0, 'fg-chairs-1', (b) => chairs(b, 3, (bb) => {
      // a parka thrown over the middle back (folded over the top, a sleeve hanging), a newspaper
      const parka = this.mat('stParka-8a2418', { map: pixTex('cloth'), color: 0x8a2418, roughness: 0.95 });
      bb.add(cached('parkaBody', () => roundedBox(0.44, 0.34, 0.06, 0.028, 3)), parka, 0.58, 0.7, 0.29, 1, 1, 1, -0.1, 0.03, 0.03);
      bb.add(cached('parkaFold', () => roundedBox(0.46, 0.06, 0.14, 0.028, 3)), parka, 0.58, 0.885, 0.24, 1, 1, 1, 0, 0.03, 0.02);
      bb.add(cached('parkaSleeve', () => roundedBox(0.09, 0.4, 0.08, 0.038, 3)), parka, 0.82, 0.62, 0.3, 1, 1, 1, -0.12, 0, -0.12);
      bb.add(cached('parkaFur', () => roundedBox(0.36, 0.045, 0.07, 0.02, 2)), this.mat('stFur', { map: pixTex('cloth'), color: 0x9a8a70, roughness: 1 }), 0.56, 0.915, 0.2, 1, 1, 1, 0.2, 0.03, 0.02);
      this.paperStack(bb, 1.16, 0.47, 0, 4, 0.4, 31, 0.3, 0.22);
    }));
    this.fg(3.0, 3.0, 'fg-chairs-2', (b) => chairs(b, 3, (bb) => {
      bb.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), 0.0, 0.53, 0.0, { taper: 1.25, seg: 16 });
      bb.cyl(0.039, 0.008, this.cm(0x2a2a2a, 0.5), 0.0, 0.584, 0.0, { seg: 16 });
      // a duffel bag under the end seat
      bb.add(cached('duffel', () => roundedBox(0.46, 0.24, 0.26, 0.1, 3)), this.cm(0x2a2a2a, 0.9), 1.25, 0.12, -0.3, 1, 1, 1, 0, 0.3, 0);
      bb.cyl(0.012, 0.3, this.cm(0x1a1a1a, 0.6), 1.25, 0.25, -0.3, { rz: Math.PI / 2, ry: 0.3, seg: 16 });
    }));
    // square concrete pillars, painted like the walls
    for (const [x, name] of [[-6.6, 'fg-pillar-1'], [10.9, 'fg-pillar-2']]) {
      this.fg(x, 3.9, name, (b) => {
        b.add(uvBox(0.36, H, 0.36, x, 3.9), this.wallMat, 0, 0, 0);
        b.box(0.38, 0.1, 0.38, this.cm(0x1a1816, 0.6), 0, 0.05, 0);
        b.box(0.38, 0.05, 0.38, this.cm(0x26303a, 0.45, 0.2), 0, 1.1, 0);
        if (x < 0) { b.box(0.1, 0.14, 0.04, this.cm(0xc01010, 0.5), 0, 1.4, 0.2); b.plane(0.22, 0.3, this.pm('wanted2', wantedTex(2)), 0, 1.75, 0.181, 0, 0, 0.04); }
        else b.plane(0.2, 0.2, this.signMat('✚ AED', 0.2, 0.2, '#1a8a3a', '#ffffff'), 0, 1.7, 0.181);
      });
    }
    // rubber plant in a pot (a few leaves going brown)
    this.fg(-4.2, 3.4, 'fg-ficus', (b) => {
      b.cyl(0.22, 0.46, this.cm(0x3a3430, 0.8), 0, 0.23, 0, { taper: 1.15, seg: 10 });
      b.cyl(0.24, 0.03, this.cm(0x1a1410, 1), 0, 0.45, 0, { seg: 10 });
      b.cyl(0.025, 1.3, this.cm(0x4a3a2a), 0, 1.0, 0, { seg: 5 });
      const green = this.mat('stLeaf2', { color: 0x2a4a2a, roughness: 0.45, side: THREE.DoubleSide });
      const brown = this.mat('stLeafB2', { color: 0x6a5a2a, roughness: 0.9, side: THREE.DoubleSide });
      const r = rng(5);
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, rr = 0.04 + r() * 0.12, y = 0.75 + r() * 1.15, s = 0.2 + r() * 0.09;
        b.add(leafGeo(), i % 9 === 0 ? brown : green, Math.cos(a) * rr, y, Math.sin(a) * rr * 0.6, s, s, s * 1.1, 0, -a, 0.15 + r() * 0.5);
      }
    });
    // overflowing bin: spun-steel body with a rolled rim, crumpled paper and cups on top
    this.fg(-1.4, 2.7, 'fg-bin', (b) => {
      b.add(binGeo(0.19, 0.225, 0.62), this.cm(0x3a3e44, 0.45, 0.6), 0, 0, 0);
      b.add(lathe('binBand', [[0.2, 0], [0.212, 0.0], [0.214, 0.04], [0.202, 0.04]], 28), this.cm(0x22262a, 0.5, 0.5), 0, 0.08, 0);
      const r = rng(11);
      const crumple = cached('crumple', () => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; const rr = rng(4); for (let i = 0; i < p.count; i++) { const k = 0.75 + rr() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; });
      for (let i = 0; i < 7; i++) b.add(crumple, this.mPaper, (r() - 0.5) * 0.26, 0.6 + r() * 0.05, (r() - 0.5) * 0.22, 0.06 + r() * 0.03, 0.05 + r() * 0.02, 0.06 + r() * 0.03, r() * 3, r() * 3, r() * 3);
      for (let i = 0; i < 4; i++) b.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), (r() - 0.5) * 0.24, 0.68 + r() * 0.05, (r() - 0.5) * 0.2, { taper: 1.25, seg: 16, rz: (r() - 0.5) * 1.4 });
      b.box(0.2, 0.002, 0.15, this.mPaper, 0.05, 0.7, 0.02, 0.5, 0.3);
      b.cyl(0.035, 0.1, this.cm(0xece8e0, 0.6), 0.32, 0.035, 0.1, { taper: 1.25, seg: 16, rz: Math.PI / 2 });
    });
    // wet-floor sign
    this.fg(-11.6, 2.5, 'fg-wetsign', (b) => {
      const y = this.cm(0xf0c010, 0.5);
      b.box(0.32, 0.62, 0.02, y, 0, 0.31, 0.09, 0, 0.28);
      b.box(0.32, 0.62, 0.02, y, 0, 0.31, -0.09, 0, -0.28);
      b.plane(0.26, 0.26, this.signMat('⚠ WET FLOOR', 0.26, 0.26, '#f0c010', '#1a1a1a'), 0, 0.36, 0.103, 0, 0.28);
    });
    // a detective's desk at the right edge: laminate top with a rubber edge band, tubular
    // C-leg on the left, a three-drawer pedestal on the right, folders, a ream, a mug, a lamp
    this.fg(8.2, 3.2, 'fg-desk', (b) => {
      const top = this.mat('stDeskTop', { map: pixTex('wood'), color: 0x8a7a68, roughness: 0.5 });
      const edge = this.cm(0x2a2622, 0.6);
      const grey = this.cm(0x4a4e52, 0.55, 0.35), seam = this.cm(0x16181a, 0.8);
      b.box(1.6, 0.03, 0.8, top, 0, 0.765, 0, 0, 0, 0, 0.006);
      b.box(1.612, 0.034, 0.012, edge, 0, 0.765, 0.401, 0, 0, 0, 0.005);
      b.box(1.612, 0.034, 0.012, edge, 0, 0.765, -0.401, 0, 0, 0, 0.005);
      for (const sx of [-1, 1]) b.box(0.012, 0.034, 0.8, edge, sx * 0.801, 0.765, 0, 0, 0, 0, 0.005);
      b.box(1.5, 0.05, 0.04, steel, 0, 0.725, -0.33, 0, 0, 0, 0.01);
      b.box(1.0, 0.36, 0.012, this.cm(0x3a3e42, 0.6, 0.3), -0.2, 0.52, -0.34);
      // C-leg: two round uprights, a top rail and a foot with glides
      for (const sz of [-0.3, 0.3]) b.cyl(0.022, 0.7, steel, -0.72, 0.385, sz, { seg: 16 });
      b.box(0.05, 0.04, 0.7, steel, -0.72, 0.725, 0, 0, 0, 0, 0.012);
      b.box(0.06, 0.035, 0.74, steel, -0.72, 0.03, 0, 0, 0, 0, 0.013);
      for (const sz of [-0.34, 0.34]) b.cyl(0.02, 0.012, this.mDark, -0.72, 0.006, sz, { seg: 16 });
      // pedestal: carcass, plinth, three drawer fronts with pulls and a lock
      b.box(0.42, 0.66, 0.7, grey, 0.52, 0.4, 0, 0, 0, 0, 0.01);
      b.box(0.4, 0.06, 0.66, seam, 0.52, 0.03, -0.01, 0, 0, 0, 0.008);
      let y = 0.72;
      for (const hh of [0.13, 0.2, 0.3]) {
        y -= hh + 0.008;
        b.box(0.4, hh, 0.02, grey, 0.52, y + hh / 2, 0.356, 0, 0, 0, 0.006);
        b.box(0.16, 0.016, 0.022, this.mStee, 0.52, y + hh - 0.035, 0.372, 0, 0, 0, 0.007);
        for (const px of [-0.075, 0.075]) b.box(0.012, 0.012, 0.02, this.mStee, 0.52 + px, y + hh - 0.035, 0.364);
        b.plane(0.06, 0.03, this.cm(0xe8e4d4, 0.9), 0.52, y + hh - 0.075, 0.367);
      }
      b.cyl(0.011, 0.012, this.mStee, 0.68, 0.69, 0.368, { rx: Math.PI / 2, seg: 16 });
      // on the top
      const y0 = 0.78;
      this.folderStack(b, -0.48, y0, 0.06, 5, -0.12, 7);
      this.paperStack(b, -0.14, y0, 0.12, 14, 0.22, 8);
      this.mug(b, 0.12, y0, 0.26, 0x1a3a6a, -0.6);
      b.box(0.42, 0.02, 0.14, this.cm(0x202224, 0.5), 0.26, y0 + 0.012, 0.04, -0.05, 0.06, 0, 0.007);
      b.plane(0.4, 0.12, this.pm('keys', ptex('keys', 40, 12, (ctx, w, h) => { ctx.fillStyle = '#1c1e20'; ctx.fillRect(0, 0, w, h); for (let yy = 1; yy < h - 1; yy += 3) for (let xx = 1; xx < w - 1; xx += 3) { ctx.fillStyle = '#3a3e42'; ctx.fillRect(xx, yy, 2, 2); } })), 0.26, y0 + 0.0225, 0.04, -0.05, -Math.PI / 2 + 0.06);
      // monitor: bezel, panel, neck and an oval foot
      b.box(0.4, 0.27, 0.035, this.cm(0x1a1c20, 0.45), 0.35, 1.0, -0.2, 0, 0, 0, 0.01);
      b.box(0.37, 0.24, 0.01, this.pm('scrA', screenTex('a'), { emissive: 0xffffff, emissiveMap: screenTex('a'), emissiveIntensity: 0.9 }), 0.35, 1.005, -0.222);
      b.box(0.05, 0.16, 0.025, this.cm(0x1a1c20, 0.45), 0.35, 0.86, -0.17, 0, 0, 0, 0.008);
      b.cyl(0.09, 0.012, this.cm(0x1a1c20, 0.45), 0.35, y0 + 0.006, -0.16, { seg: 24 });
      // gooseneck lamp
      b.add(lathe('lampBase', [[0, 0], [0.055, 0], [0.058, 0.01], [0.04, 0.03], [0, 0.034]], 24), this.cm(0x1a1a1a, 0.4, 0.4), 0.7, y0, 0.1);
      const neck = cached('lampNeck', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.02, 0.18, 0), new THREE.Vector3(-0.08, 0.3, 0), new THREE.Vector3(-0.12, 0.31, 0)]), 16, 0.008, 8));
      b.add(neck, this.cm(0x1a1a1a, 0.4, 0.4), 0.7, y0 + 0.03, 0.1);
      b.add(lathe('lampShade', [[0.008, 0.085], [0.026, 0.075], [0.072, 0], [0.078, 0], [0.07, 0.02], [0.03, 0.085], [0.012, 0.09]], 24), this.cm(0x2a2a2a, 0.4, 0.4), 0.58, y0 + 0.25, 0.1);
      b.cyl(0.062, 0.005, this.em(0xffd090, 3), 0.58, y0 + 0.255, 0.1, { seg: 24 });
    });
  }

  setMedOpen(open) {
    this.medOpen = open;
    this.medShutterTarget = open ? 0.04 : 1;
  }

  setCellOpen(open) {
    this.cellOpen = open;
    this.cellDoorTarget = open ? this.cellDoorX + 1.1 : this.cellDoorX;
  }

  update(dt) {
    super.update(dt);
    if (this.medShutter) {
      const sh = this.medShutter;
      sh.scale.y += (this.medShutterTarget - sh.scale.y) * Math.min(1, dt * 1.8);
      sh.children[0].visible = sh.scale.y > 0.6;
    }
    if (this.cellDoorTarget != null) {
      this.cellDoor.position.x += (this.cellDoorTarget - this.cellDoor.position.x) * Math.min(1, dt * 3);
    }
    // the tube over the cell front: mostly steady, sometimes a stuttering burst
    const f = this.flicker;
    if (f) {
      if (this.burst > 0) this.burst -= dt;
      else if (Math.random() < dt * 0.25) this.burst = 0.25 + Math.random() * 0.6;
      const on = this.burst > 0 ? Math.random() > 0.45 : Math.random() > 0.004;
      if (f.light) f.light.intensity = on ? f.base : 0.8;
      f.tube.material.emissiveIntensity = on ? 2.0 : 0.25;
    }
    // muted TV: cuts and brightness shifts
    if (this.tvMat) {
      const k = 0.85 + Math.sin(this.time * 7.3) * 0.06 + Math.sin(this.time * 2.1) * 0.08 + (Math.random() < 0.02 ? 0.3 : 0);
      this.tvMat.emissiveIntensity = k;
      this.tvGlow.material.opacity = 0.18 + (k - 0.85) * 0.3;
    }
  }
}
