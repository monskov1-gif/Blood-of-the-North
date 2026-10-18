import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { fbm3, noise3, mergeGeos, rockGeometry, rockMaterial, rockDetailTexture, roundedBox, reliefSheet } from '../nature.js';

export const sat = (v) => Math.max(0, Math.min(1, v));

/**
 * The pack's cave above the Takhini (Lizzie's captivity, L3–L5): not one corridor but a system of
 * chambers, each its own location joined by dark passages in the rock (Places.js doors):
 *
 *            cave_den ── cave (the hall) ── cave_store ── cave_tunnel ── the mouth (moon)
 *                             │                                │
 *                         cave_deep                         cave_rift (dead end, Puriel)
 *                             │
 *                         cave_altar (the slab)
 *
 * Every chamber shares the same construction (CaveBase): a continuous weathered sandstone wall
 * baked from one height field (scalloped hollows, cross-bedded layers), a vault that hangs towards
 * the viewer, end walls that close the chamber, smooth boulders on a sandy floor, real colliders
 * for everything that stands in the way, and foreground rocks near the camera (SafeZones fade
 * them off Lizzie). Passages are true recesses in the height field, so they read as holes into
 * the dark, not as painted arches.
 * States: 'L3' (day of the first chapter) | 'L3N' (its night) | 'L4' | 'L5'.
 */

export const BACK = -3.6;
const PX = (key, w, h, draw) => canvasTexture(`cave-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** Packed earth, grit, straw and old dark stains. */
const floorTex = () => PX('floor', 64, 64, (ctx, w, h) => {
  const r = rng(701);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 22 + Math.sin(x * 0.3 + y * 0.17) * 4; ctx.fillStyle = rgb(132 + n, 120 + n, 106 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 90; i++) { ctx.fillStyle = rgb(60, 52, 44, 0.6); ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = rgb(150, 132, 84, 0.55); ctx.fillRect(r() * w, r() * h, 3 + r() * 4, 1); } // straw
  for (let i = 0; i < 3; i++) { ctx.fillStyle = rgb(70, 30, 22, 0.25); ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 4, 0, 7); ctx.fill(); }
  for (let i = 0; i < 60; i++) { ctx.fillStyle = rgb(110, 96, 80, 0.8); ctx.fillRect(r() * w, r() * h, 1, 1); }   // grit
  for (let y = 2; y < h; y += 5) for (let x = 0; x < w; x++) {                       // wind ripples in the sand
    const yy = Math.round(y + Math.sin(x * 0.25 + y) * 1.5);
    ctx.fillStyle = rgb(156, 144, 126, 0.3); ctx.fillRect(x, yy, 1, 1); ctx.fillStyle = rgb(80, 72, 62, 0.35); ctx.fillRect(x, yy + 1, 1, 1);
  }
});

/** A red splash (decal) — the ritual chamber, Olivia's clothes. */
export const bloodTex = (seed) => PX(`blood${seed}`, 32, 32, (ctx, w, h) => {
  const r = rng(720 + seed);
  ctx.clearRect(0, 0, w, h);
  const blob = (x, y, rr, c) => { ctx.fillStyle = c; for (let k = 0; k < rr * rr * 3; k++) { const a = r() * 7, d = r() * rr; ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 1, 1); } };
  blob(16, 16, 9, '#5a0808'); blob(15, 15, 6, '#7a0c0c'); blob(17, 14, 3, '#9a1414');
  for (let i = 0; i < 9; i++) { const a = r() * 7, d = 9 + r() * 6; blob(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, 1 + r() * 1.5, '#6a0a0a'); }
});

/** Drag marks: two dark furrows in the sand, smeared with old blood here and there. */
export const dragTex = () => PX('drag', 64, 16, (ctx, w, h) => {
  const r = rng(781);
  ctx.clearRect(0, 0, w, h);
  for (const y0 of [5, 10]) for (let x = 0; x < w; x++) {
    const fade = Math.min(1, x / 12, (w - 1 - x) / 12) * (0.55 + 0.45 * Math.sin(x * 0.13 + y0));   // the furrows come and go
    if (r() > fade + 0.15) continue;
    const y = Math.round(y0 + Math.sin(x * 0.2 + y0) * 1.2 + Math.sin(x * 0.05) * 1.5);
    ctx.fillStyle = rgb(50, 40, 32, 0.7 * fade); ctx.fillRect(x, y, 1, 2);
    ctx.fillStyle = rgb(150, 136, 116, 0.35 * fade); ctx.fillRect(x, y - 1, 1, 1);
    if (r() < 0.1) { ctx.fillStyle = rgb(70, 14, 10, 0.6 * fade); ctx.fillRect(x, y, 2, 2); }
  }
});

/** Claw furrows / tally scratches cut into the soft sandstone (decal for the wall). */
export const scratchTex = (kind) => PX(`scratch-${kind}`, 48, 48, (ctx, w, h) => {
  const r = rng(790 + (kind === 'tally' ? 1 : 0));
  ctx.clearRect(0, 0, w, h);
  const cut = (x0, y0, x1, y1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      ctx.fillStyle = rgb(46, 30, 20, 0.75); ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = rgb(150, 120, 90, 0.3); ctx.fillRect(x + 1, y, 1, 1);
    }
  };
  if (kind === 'tally') {
    for (let g = 0; g < 6; g++) {
      const gx = 3 + (g % 3) * 15, gy = 6 + Math.floor(g / 3) * 20;
      for (let i = 0; i < 4; i++) cut(gx + i * 3, gy, gx + i * 3 + r(), gy + 12);
      if (g < 5) cut(gx - 1, gy + 9, gx + 11, gy + 2);
    }
  } else {
    for (let s = 0; s < 3; s++) {
      const ox = s * 15 + 4;
      for (let i = 0; i < 4; i++) cut(ox + i * 3, 4 + r() * 4, ox + i * 3 + 6 + r() * 3, 40 + r() * 6);
    }
  }
});

/** The night outside the mouth: sky, a hill of spruce, a pale ground. */
export const outsideTex = () => canvasTexture('cave-outside2', 128, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1e2a46'); g.addColorStop(0.55, '#4e5e84'); g.addColorStop(1, '#7484a2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(733);
  for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(r() * w, r() * h * 0.35, 1, 1); }
  ctx.filter = 'blur(2px)';
  for (const [y0, col] of [[0.58, 'rgba(40,52,78,0.8)'], [0.68, 'rgba(26,34,52,0.9)']]) {          // misty layered tree lines, soft
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 2) ctx.lineTo(x, h * y0 - Math.abs(Math.sin(x * 0.37 + y0 * 9)) * 9 - r() * 4);
    ctx.lineTo(w, h); ctx.fill();
  }
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(150,164,190,0.9)'; ctx.fillRect(0, h * 0.8, w, h * 0.2);
  const m = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.8); m.addColorStop(0, 'rgba(160,176,204,0)'); m.addColorStop(1, 'rgba(160,176,204,0.6)');
  ctx.fillStyle = m; ctx.fillRect(0, h * 0.55, w, h * 0.25);
});

/** Rock grain for the vault and end walls: oblique laminae, mottling and hairline cracks (grey). */
const sandGrainTex = () => canvasTexture('cave-rockgrain', 256, 128, (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (y + x * 0.45) / 5 + fbm3(x / 30, y / 30, 1, 73, 2) * 3;
    let v = 150 + (fbm3(x / 40, y / 12, 1, 71, 4) - 0.5) * 110 + (fbm3(x / 4, y / 3, 2, 72, 2) - 0.5) * 40 + Math.abs((u % 1) - 0.5) * 30;
    const cr = 1 - Math.abs(noise3(x / 22, y / 9, 4, 74) - 0.5) * 2;
    if (cr > 0.96) v *= 0.35;
    const i = (y * w + x) * 4; img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.97; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}, { aniso: 4 });
const flameTex = () => canvasTexture('cave-flame', 32, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h * 0.72, 1, w / 2, h * 0.6, h * 0.55);
  g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,190,90,0.9)'); g.addColorStop(0.7, 'rgba(230,90,30,0.4)'); g.addColorStop(1, 'rgba(200,40,10,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h, w / 2, h); ctx.bezierCurveTo(w * 0.1, h, w * 0.05, h * 0.5, w / 2, 0); ctx.fill();
}, { color: false });
/** A ragged arch: the mouth seen from inside. */
export const archMask = () => canvasTexture('cave-arch', 64, 64, (ctx, w, h) => {
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
function strata(x, y, ox = 0) {
  const dip = Math.max(-0.55, Math.min(0.55, (fbm3(x * 0.07, 0, 1, 81, 2) - 0.5) * 1.6));   // the dip changes from bed to bed (never steep: no 'zebra')
  const thick = 0.8 + fbm3(x * 0.05, y * 0.1, 2, 82, 2) * 1.4;                         // thin and thick layers
  const v = (y * Math.cos(dip) + (x - ox) * Math.sin(dip) * 0.35) * thick + fbm3(x * 0.15, y * 0.25, 4, 22, 3) * 3.0;
  return ((v % 1) + 1) % 1;
}

/** `ox`: the chamber's own origin in the rock field (keeps the bedding planes gentle far from 0). */
export function wallHeight(x, y, fine = false, ox = 0) {
  let d = (fbm3(x * 0.32, y * 0.32, 0, 23, 4) - 0.5) * 1.5;
  d -= Math.max(0, fbm3(x * 0.7, y * 0.7, 5, 25, 3) - 0.5) * 2.2;                   // scallops
  d -= Math.pow(Math.max(0, fbm3(x * 1.1, y * 1.4, 6, 29, 3) - 0.52), 1.5) * 2.4;      // smaller cups
  const fr = strata(x, y, ox);                                                       // cross-bedded layers
  const lay = fr < 0.75 ? fr / 0.75 : (1 - fr) / 0.25;
  d += lay * lay * (3 - 2 * lay) * 0.06;
  if (fine) d += (fbm3(x * 4, y * 4, 2, 35, 3) - 0.5) * 0.1;
  d += Math.max(0, 0.9 - y) * 0.7;
  d += Math.pow(Math.max(0, y - 3.0), 1.4) * 0.6;                                    // leans gently over into the vault
  return d;
}

/**
 * Each chamber cuts its own rock: tone (lit / shadowed albedo, 0–255), the dip of its beds (rad,
 * never horizontal), a seed for its cracks, an optional rust (iron seeping down) or wet sheen.
 * Cold, dark rock; the warmth comes only from the fire light baked round torches and fires.
 */
const ROCK = {
  cave: { a: [92, 84, 76], b: [54, 50, 48], dip: 0.42, seed: 3, rust: 0.5 },
  cave_den: { a: [96, 82, 68], b: [56, 48, 42], dip: -0.52, seed: 11, rust: 0.7 },
  cave_deep: { a: [80, 82, 82], b: [42, 46, 48], dip: 0.66, seed: 23, wet: 1, amb: 0.34 },
  cave_altar: { a: [92, 70, 62], b: [48, 34, 32], dip: -0.34, seed: 37, rust: 1 },
  cave_store: { a: [86, 82, 76], b: [50, 48, 46], dip: 0.3, seed: 41, rust: 0.3 },
  cave_tunnel: { a: [74, 78, 84], b: [42, 44, 50], dip: -0.62, seed: 53, cold: 12.5 },
  cave_rift: { a: [70, 74, 82], b: [36, 38, 46], dip: 0.82, seed: 67, wet: 1, coldX: [-1.2], amb: 0.26 },
};
const hash1 = (n, s) => { const v = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * The rock's own fracture pattern (texture only): long bedding planes at the chamber's dip, broken
 * here and there; cross joints in some beds, leaning; every block between them a broken facet of
 * its own tilt and tone; rough grain on top. Fills RD with slope, crack, edge, block and bed tone.
 */
const RD = { gx: 0, gy: 0, crack: 0, tone: 0, row: 0, edge: 0 };
function rockDetail(x, y, st) {
  const cd = Math.cos(st.dip), sd = Math.sin(st.dip);
  const wu = (fbm3(x * 0.3, y * 0.3, 9, st.seed, 2) - 0.5) * 1.2;
  const u = x * cd + y * sd + wu;
  const v0 = -x * sd + y * cd + (fbm3(x * 0.16, y * 0.3, 4, st.seed + 1, 3) - 0.5) * 1.3 + (noise3(x * 1.4, y * 1.4, 1, st.seed + 16) - 0.5) * 0.09;
  const bt = st.bed || 0.42;
  // beds of uneven thickness
  const V = v0 / bt + (fbm3(v0 * 0.7, 0.5, 1, st.seed + 14, 2) - 0.5) * 5;
  const row = Math.floor(V), fv = V - row;
  const hr = hash1(row, st.seed + 5);
  // cross joints: per bed their own spacing, offset and lean
  const bl = (st.block || 1.1) * (0.6 + hr * 0.9);
  const U = (u + (fv - 0.5) * bt * (hr - 0.5) * 2.2) / bl + hr * 7;
  const seg = Math.floor(U), fu = U - seg;
  const id = row * 131 + seg;
  const hb = hash1(id, st.seed + 2);
  // bedding-plane crack: long, but it closes up in places
  const bedOpen = sat((noise3(u * 0.3, row * 1.7, 2, st.seed + 9) - 0.52) * 14) * (hr > 0.5 ? 0.028 + hr * 0.04 : 0);
  const dv = Math.min(fv, 1 - fv) * bt;
  const cBed = bedOpen > 0 ? 1 - sat(dv / bedOpen) : 0;
  const jointOn = hb > 0.62 ? (0.024 + hash1(id, st.seed + 3) * 0.03) : 0;
  const fw = fu + (noise3(x * 3, y * 3, 5, st.seed + 15) - 0.5) * 0.25;
  const du = Math.min(Math.abs(fw), Math.abs(1 - fw)) * bl;
  const cJoint = jointOn ? 1 - sat(du / jointOn) : 0;
  // hairline fractures
  const hl = 1 - Math.abs(noise3(x * 2.2, y * 0.8, 3, st.seed + 11) - 0.5) * 2;
  const cHair = sat((hl - 0.975) / 0.02) * sat((noise3(x * 0.7, y * 0.7, 6, st.seed + 12) - 0.55) * 6) * 0.7;
  RD.crack = Math.max(cBed, cJoint, cHair);
  RD.edge = Math.max(bedOpen > 0 ? 1 - sat(dv / (bedOpen + 0.08)) : 0, jointOn ? 1 - sat(du / (jointOn + 0.06)) : 0);
  // facet of the block + rough grain
  const e = 0.03, g0 = fbm3(x * 2.4, y * 2.4, 7, st.seed + 13, 2);
  const gxN = (fbm3((x + e) * 2.4, y * 2.4, 7, st.seed + 13, 2) - g0) / e, gyN = (fbm3(x * 2.4, (y + e) * 2.4, 7, st.seed + 13, 2) - g0) / e;
  RD.gx = (hb - 0.5) * 0.9 + gxN * 0.14 + (fv - 0.5) * sd * 0.25;
  RD.gy = (hash1(id, st.seed + 4) - 0.4) * 0.8 + gyN * 0.14 - (fv - 0.5) * cd * 0.25;   // each bed bulges a little
  RD.tone = hb;
  RD.row = hr;
  return RD;
}

/**
 * The wall texture: the room's height field + the rock's fracture facets, shaded per pixel by the
 * light of its own torches and fires (warm, falling off into black a few metres away).
 * `hf(x, y)` is the height, `mf(x, y)` the passage mask (0…1, passages go black),
 * `lights` [[x, y, k]] the fire light.
 */
const wallBakedTex = (key, w, h, xmin, width, hf, mf, st, lights) => canvasTexture(`cave-wallbake3-${key}-${w}`, w, h, (ctx) => {
  const img = ctx.createImageData(w, h);
  const sx = width / w, sy = 6.4 / h;
  const A = st.a, B = st.b, S = [st.a[0] * 0.95, st.a[1] * 0.92, st.a[2] * 0.88];
  const rowH = new Float32Array(w + 1), prevH = new Float32Array(w + 1);
  for (let i = 0; i <= w; i++) prevH[i] = hf(xmin + i * sx, 6.4 + sy, false);
  for (let j = 0; j < h; j++) {
    const y = 6.4 - j * sy;
    for (let i = 0; i <= w; i++) rowH[i] = hf(xmin + i * sx, y, false);
    for (let i = 0; i < w; i++) {
      const x = xmin + i * sx;
      const hc = rowH[i];
      const d = rockDetail(x, y, st);
      let nx = -(rowH[i + 1] - hc) / sx * 0.8 - d.gx, ny = -(prevH[i] - hc) / sy * 0.8 - d.gy, nz = 1;
      nx = Math.max(-1.6, Math.min(1.6, nx)); ny = Math.max(-1.6, Math.min(1.6, ny));
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // light: the sum of the fires, with the direction it comes from
      let L = st.amb ?? 0.11, lx = 0.25, ly = 0.45, lz = 0.6, warm = 0, cold = L * 0.7;
      for (const [px, py, k] of lights) {
        const dx = px - x, dy = py - y, d2 = dx * dx + dy * dy * 1.3;
        const e = k * Math.exp(-d2 / 5.2);
        if (e < 0.004) continue;
        L += e; const dl = Math.hypot(dx, dy, 1.2); lx += dx / dl * e * 3; ly += dy / dl * e * 3; lz += 1.2 / dl * e * 3;
        if ((st.cold != null && px > st.cold) || st.coldX?.some((cx) => Math.abs(cx - px) < 0.05)) cold += e; else warm += e;
      }
      const ll = Math.hypot(lx, ly, lz);
      const dif = Math.max(0, (nx * lx + ny * ly + nz * lz) / ll);
      const t = fbm3(x * 0.6, y * 0.6, 3, 21 + st.seed, 2);
      const k = sat(t * 1.6 - 0.3 + (d.tone - 0.5) * 0.7);
      const m = mf(x, y);
      const hollow = Math.max(0, Math.min(0.55, -hc * 0.3 - 0.15)) * Math.min(1, y * 1.5);
      const shade = Math.min(1.25, L) * (0.08 + 1.3 * Math.pow(dif, 1.5)) * (1 - d.crack * 0.92) * (1 - d.edge * 0.35) * (1 - hollow) * (1 - m);
      const o = (j * w + i) * 4;
      const sand = sat((0.45 - y + (fbm3(x * 0.8, 0, 5, 83, 2) - 0.5) * 0.5) * 2.2) * (1 - m);   // grit drifted up the wall
      const rust = st.rust ? sat((fbm3(x * 5, y * 0.25, 4, st.seed + 6, 3) - 0.62) * 4) * sat(fbm3(x * 0.3, y * 0.3, 2, st.seed + 7, 2) * 2 - 0.6) * st.rust : 0;
      const wet = st.wet ? sat((fbm3(x * 3, y * 0.4, 6, st.seed + 8, 3) - 0.58) * 5) : 0;
      const cw = L > 0 ? warm / L : 0, cc = L > 0 ? cold / L : 0;
      const tint = [0.92 + 0.32 * cw - 0.1 * cc, 0.94 + 0.06 * cw, 0.98 - 0.26 * cw + 0.2 * cc];
      const spec = wet ? wet * Math.pow(dif, 8) * Math.min(1, L) * 90 : 0;
      for (let c = 0; c < 3; c++) {
        let v = A[c] + (B[c] - A[c]) * k;
        v *= 0.84 + d.row * 0.3;                                   // beds differ a little in tone
        if (rust) v = v + ([112, 72, 46][c] - v) * rust * 0.5;
        if (wet) v *= 1 - wet * 0.35;
        v = v * shade * tint[c] + spec;
        img.data[o + c] = v * (1 - sand) + S[c] * (0.4 + 0.7 * Math.min(1, L)) * tint[c] * Math.min(1.1, L * 1.6) * sand;
      }
      img.data[o + 3] = 255;
    }
    prevH.set(rowH);
  }
  ctx.putImageData(img, 0, 0);
}, { aniso: 4 });

/** Fur: matted strands in clumps, lighter tips, darker hide showing through. */
const furTex = () => canvasTexture('cave-fur', 128, 128, (ctx, w, h) => {
  const r = rng(431);
  ctx.fillStyle = '#8a8076'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = r() * w, y = r() * h, a = Math.sin(x * 0.05) * 0.8 + Math.cos(y * 0.07) * 0.6 + (r() - 0.5) * 0.5, L = 3 + r() * 7;
    const v = 110 + r() * 145;
    ctx.strokeStyle = `rgba(${v | 0},${(v * 0.92) | 0},${(v * 0.82) | 0},0.55)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
});

/** Dirty old bone: yellow-grey, stained in the pores, darker where it lay in the dirt. */
const boneTex = () => canvasTexture('cave-bone', 64, 64, (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm3(x / 9, y / 9, 1, 401, 4), f = fbm3(x / 2.5, y / 2.5, 2, 402, 2);
    const v = 150 + (n - 0.5) * 120 + (f - 0.5) * 40;
    const stain = sat((fbm3(x / 14, y / 14, 3, 403, 3) - 0.55) * 4);
    const o = (y * w + x) * 4;
    img.data[o] = v * (1 - stain * 0.45); img.data[o + 1] = v * 0.93 * (1 - stain * 0.5); img.data[o + 2] = v * 0.8 * (1 - stain * 0.6); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
});

/** Woven fabric for tents, packs, bags: weave, seams, grime, worn patches (grey; tinted by the material). */
export const fabricTex = (kind = 'nylon') => canvasTexture(`cave-fabric-${kind}`, 128, 128, (ctx, w, h) => {
  const img = ctx.createImageData(w, h);
  const quilt = kind === 'quilt';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 190 + ((x + y) % 2 ? 10 : -10) + (fbm3(x / 3, y / 3, 1, 411, 2) - 0.5) * 30;
    v *= 1 - sat((fbm3(x / 18, y / 18, 2, 412, 3) - 0.5) * 2.5) * 0.45;      // grime
    if (quilt) { const q = Math.abs(((y / 16) % 1) - 0.5); v *= 0.62 + 0.38 * Math.sqrt(sat(q * 2.2)); }   // quilted channels
    if (!quilt && (x % 64 < 2 || y % 43 < 1)) v *= 0.62;                  // seams
    v *= 0.85 + 0.15 * sat(fbm3(x / 6, y / 30, 3, 413, 2) * 2);             // creases
    const o = (y * w + x) * 4;
    img.data[o] = v; img.data[o + 1] = v * 0.97; img.data[o + 2] = v * 0.93; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}, { aniso: 4 });

/**
 * Collapse a little prop built from many parts into one mesh per material (draw calls): the
 * parts keep their place; the group stays where it was.
 */
export function collapse(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), m = new THREE.Matrix4();
  const by = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o === group) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (o.material.vertexColors && !geo.attributes.color) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
    if (!o.material.vertexColors && geo.attributes.color) geo.deleteAttribute('color');
    geo.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(geo);
  });
  for (const ch of [...group.children]) group.remove(ch);
  for (const [mat, geos] of by) group.add(new THREE.Mesh(mergeGeos(geos), mat));
  return group;
}

/** A tube that tapers from r0 to r1 along a curve (antler tines, ribs): reads as bone, not pipe. */
export function taperTube(pts, r0, r1, seg = 10, rad = 6) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false);
  const p = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    const t = i / seg, r = r0 + (r1 - r0) * Math.pow(t, 0.8);
    for (let j = 0; j <= rad; j++) {
      const k = i * (rad + 1) + j;
      v.set(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r * (1 + (hash1(k, 5) - 0.5) * 0.25)).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * One chamber of the cave. `cfg`:
 *   id, title, x0, x1        — the chamber spans x0…x1 (end walls there)
 *   nx                       — where in the endless rock field this chamber's wall is cut from
 *   openings [{ x, w, h, door: { id, label, to, spawn }, tint }] — passages in the back wall
 *   minZ, maxZ, walk         — the walkable floor (main strip + passage notches + extra areas)
 *   cam {minX, maxX}, distance, vault (height), lean (y where a corridor wall starts closing over)
 *   torches [x…], lights [[x, y, k]] (extra light baked into the wall's vertex colours)
 *   fg [[x, w, h]], lips [[x, w]] — foreground boulders / rock lips hanging from the vault
 *   openRight / openLeft     — no end wall on that side (the mouth)
 */
export class CaveBase extends LocationBase {
  constructor(opts, cfg) {
    super(opts);
    this.cfg = cfg;
    this.id = cfg.id;
    this.title = cfg.title;
    this.background = 0x050404;
    this.camera = { distance: cfg.distance ?? 7.6, height: cfg.camHeight ?? 2.0, lookHeight: 1.25, lookZ: -0.8 };
    const minZ = cfg.minZ ?? -2.0, maxZ = cfg.maxZ ?? 0.9;
    const areas = [{ minX: cfg.walkX?.[0] ?? cfg.x0 + 0.9, maxX: cfg.walkX?.[1] ?? cfg.x1 - 0.9, minZ, maxZ }];
    for (const o of cfg.openings || []) if (o.walkIn !== false) areas.push({ minX: o.x - 0.55, maxX: o.x + 0.55, minZ: minZ - 0.32, maxZ: minZ + 0.2 });   // a shallow step into the passage (deep notches trap the player)
    areas.push(...(cfg.walk || []));
    this.bounds = { walk: { areas }, camera: { ...cfg.cam } };
    this.fires = [];
    this.flames = [];
    this.torches = [];
    this.groups = {};
    this.doors = [];
    this.ox = (cfg.x0 + cfg.x1) / 2 + (cfg.nx || 0);
    this.rockStyle = ROCK[cfg.id] || ROCK.cave;
    const c3 = (v, k) => (hex(v[0] * k) << 16) | (hex(v[1] * k) << 8) | hex(v[2] * k);   // sRGB, like the wall texture
    this.stoneA = c3(this.rockStyle.a, 1.4); this.stoneB = c3(this.rockStyle.b, 1.3);
  }

  // ------------------------------------------------------------------ the rock

  /**
   * 1 inside a passage cut into the back wall, 0 on solid rock (soft rim). Also leaves the depth
   * and darkness of the opening it found in `_depth` / `_dark` (a shallow alcove stays lit).
   */
  openMask(x, y) {
    let m = 0;
    this._depth = 2.8; this._dark = 0.94;
    for (const o of this.cfg.openings || []) {
      const dx = Math.abs(x - o.x) / (o.w / 2);
      if (dx > 1.4) continue;
      const ry = Math.max(0, (y / o.h - 0.5) / 0.5);
      const mm = sat((1.1 - Math.hypot(dx, ry)) / 0.28);
      if (mm > m) { m = mm; this._depth = o.depth ?? 2.8; this._dark = o.dark ?? 0.94; }
    }
    return m;
  }

  /** How dark the wall goes at (x, y): 0 rock … ~1 inside a passage. */
  darkMask(x, y) { const m = this.openMask(x, y); return m * this._dark; }

  wallH(x, y, fine = false) {
    const c = this.cfg;
    let d = wallHeight(x + (c.nx || 0), y, fine, this.ox);
    if (c.lean != null) d += Math.pow(Math.max(0, y - c.lean), 1.3) * 0.55;       // a corridor: the wall closes over
    const m = this.openMask(x, y);
    return m > 0 ? d * (1 - m) - this._depth * m : d;
  }

  /** The z of the wall's surface at (x, y) — for decals cut into the rock. */
  wallZ(x, y) { return BACK - 0.5 + this.wallH(x, y); }

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
    const b = new THREE.Mesh(rockGeometry(seed, { detail: this.low ? 3 : 4, rough: 0.46, sharp: 0.45 + (seed % 5) * 0.08, strata: 1.2, flat: -0.1, colA: this.stoneA, colB: this.stoneB, dark: 0.6, ...o }), this.sandMat);
    b.position.set(x, -0.3 * sy, z); b.scale.set(sx, sy * 0.85, sz); b.rotation.y = seed * 1.3;
    if (!o.keepLight) { const ca = b.geometry.attributes.color, k = this.lightAt(x); for (let i = 0; i < ca.array.length; i++) ca.array[i] *= k; }
    parent.add(b);
    return b;
  }

  /** How much fire light reaches x (0.3 in the dark … 1 by a torch): baked into rock colours. */
  lightAt(x) {
    let l = 0.32;
    for (const [lx, , k] of this.lightsAt || []) l += k * 0.8 * Math.exp(-((x - lx) ** 2) / 8);
    return Math.min(1, l);
  }

  /** A boulder that blocks the way: geometry + colliders covering its footprint. */
  solidBoulder(seed, x, z, sx, sy, sz, parent = this.root, o = {}) {
    const b = this.boulder(seed, x, z, sx, sy, sz, parent, o);
    this.solid(x, z, sx, sz);
    return b;
  }

  /** Colliders for an elliptical footprint (one circle, or a row of them for a long rock). */
  solid(x, z, rx, rz = rx, k = 0.82) {
    const r = Math.min(rx, rz) * k;
    const n = Math.max(1, Math.round(rx / Math.max(0.2, rz)));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2;
      this.colliders.push({ x: x + t * (rx * k - r), z, r });
    }
  }

  /**
   * A standing rock: a weathered sandstone block with a smaller one leaning on it (sandstone caves
   * have no dripstone cones); blocks the way.
   */
  stalagmite(seed, x, z, h = 1.4, r = 0.32, parent = this.root) {
    const w = Math.max(0.42, r * 1.7);
    const a = this.boulder(seed, x, z, w, h * 1.05, w * 0.8, parent);
    const b = this.boulder(seed + 50, x + w * 0.55, z + 0.12, w * 0.55, h * 0.55, w * 0.5, parent);
    void b;
    this.colliders.push({ x: x + w * 0.15, z, r: w * 0.85 });
    return a;
  }

  /** A stalactite / rock lip hanging from the vault. */
  stalactite(seed, x, z, len = 1.0, r = 0.3, parent = this.root, top = this.cfg.vault ?? 3.95) {
    const b = this.boulder(seed, x, z, r, len * 1.6, r * 0.9, parent, { rough: 0.4, strata: 1.4, colA: this.stoneB, colB: 0x2a2624 });
    b.position.y = top - len * 0.2;
    b.rotation.z = Math.PI;
    return b;
  }

  build() {
    const root = this.root;
    const c = this.cfg;
    const r = rng(730 + Math.round((c.nx || 0) * 3));
    this.sandMat = rockMaterial(this.low, { roughness: 0.95 });
    const W = c.x1 - c.x0 + 6, cx = (c.x0 + c.x1) / 2;
    this.cx = cx;
    const lightsAt = this.lightsAt = [...(c.torches || []).map((x) => [x, 2.1, 1.0]), ...(c.lights || [])];
    // floor: packed sand and grit, darker towards the walls; it runs on into the passages
    const ft = floorTex().clone(); ft.needsUpdate = true; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W / 1.28, 9 / 1.28);
    const fgeo = new THREE.PlaneGeometry(W, 9, Math.round(W * 4), 36); fgeo.rotateX(-Math.PI / 2);
    { const p = fgeo.attributes.position; const col = new Float32Array(p.count * 3); const cc = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + cx, z = p.getZ(i) - 1;
        const open = this.openMask(x, 0.4), dk = open * this._dark;
        const edge = sat((-z - 2.3) / 1.3) * (1 - open);                      // rises into the foot of the wall
        p.setY(i, edge * edge * 0.35 + (fbm3(x * 0.6, 0, z * 0.6, 11, 3) - 0.5) * 0.12 * (0.3 + edge));
        cc.setHex(0xa4968a).lerp(new THREE.Color(0x5a524a), sat(edge * 0.8 + (fbm3(x * 0.25, 1, z * 0.25, 12, 2) - 0.4)));
        let fl = 0.3;
        for (const [lx, , k] of lightsAt) fl += k * 0.8 * Math.exp(-((x - lx) ** 2) / 10);
        cc.multiplyScalar(Math.min(1.05, fl) * (1 - edge * 0.25));
        if (dk > 0 && z < -2.4) cc.multiplyScalar(1 - dk * sat((-z - 2.4) / 1.4));   // the passage floor goes into the dark
        col.set([cc.r, cc.g, cc.b], i * 3);
      }
      fgeo.setAttribute('color', new THREE.BufferAttribute(col, 3)); fgeo.computeVertexNormals(); }
    const floor = new THREE.Mesh(fgeo, this.mat('caveFloor', { map: ft, color: 0xffffff, roughness: 1, vertexColors: true }));
    floor.position.set(cx, 0, -1); root.add(floor);
    const black = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, 12), new THREE.MeshBasicMaterial({ color: 0x020202 }));
    black.position.set(cx, 4, BACK - 3.6); root.add(black);
    // the back wall: one continuous weathered sheet; passages are deep recesses in it
    const segX = Math.round(W * (this.low ? 3.2 : 4.4)), segY = this.low ? 30 : 44;
    const wgeo = reliefSheet(W, 6.4, segX, segY, (x, y) => this.wallH(x + cx, y + 3.2), (col, x, y, d) => {
      const wx = x + cx, wy = y + 3.2;
      col.setScalar(1.15 * (1 - sat(-d * 0.5 - 0.2) * 0.4) * (1 - 0.98 * this.darkMask(wx, wy)));
    });
    const wallMat = rockMaterial(this.low, { roughness: 0.95 });
    const texW = Math.round(W * (this.low ? 36 : 48));
    wallMat.map = wallBakedTex(this.id, texW, this.low ? 240 : 310, cx - W / 2, W, (x, y, f) => this.wallH(x, y, f), (x, y) => this.darkMask(x, y), this.rockStyle, lightsAt);
    wallMat.map.wrapS = wallMat.map.wrapT = THREE.ClampToEdgeWrapping;
    // the bake is the fire light itself: let it show even where the moving lights are weak
    wallMat.emissive = new THREE.Color(0xffffff); wallMat.emissiveMap = wallMat.map; wallMat.emissiveIntensity = 0.2;
    // fine grain over the baked rock (its own tiling, 1.3 m): keeps the wall crisp up close
    const det = rockDetailTexture();
    if (!this.low) wallMat.onBeforeCompile = (sh) => {
      sh.uniforms.uDetail = { value: det };
      sh.uniforms.uDetRep = { value: new THREE.Vector2(W / 1.3, 6.4 / 1.3) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; uniform vec2 uDetRep;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  { vec3 dt = texture2D(uDetail, vMapUv * uDetRep).rgb; vec3 dt2 = texture2D(uDetail, vMapUv * uDetRep * 3.7 + 0.31).rgb; diffuseColor.rgb *= (dt * 0.75 + dt2 * 0.55) * 0.95; }');
    };
    if (!this.low) wallMat.customProgramCacheKey = () => 'caveWallDetail';
    this.wallMat = wallMat;
    const wall = new THREE.Mesh(wgeo, wallMat);
    wall.position.set(cx, 3.2, BACK - 0.5); root.add(wall);
    // the vault overhead: hangs lower towards the camera, a dark lip framing the top of the view
    const vaultMat = rockMaterial(this.low, { roughness: 0.95 });
    vaultMat.map = sandGrainTex(); vaultMat.map.repeat.set(W / 3, 3);
    const vY = c.vault ?? 3.95;
    const cgeo = reliefSheet(W, 6.4, Math.round(W * 3), this.low ? 18 : 26, (x, y) => {
      const zz = -y, xx = x + cx + (c.nx || 0);
      let d = (fbm3(xx * 0.4, zz * 0.4, 7, 31, 4) - 0.5) * 1.1 - Math.max(0, fbm3(xx * 0.8, zz * 0.8, 2, 33, 3) - 0.55) * 2;
      d -= Math.max(0, zz - 0.2) * 0.55;               // the lip hangs towards the viewer
      return d;
    }, (col, x, y, d) => {
      const xx = x + cx;
      let lit = 0.08;
      for (const [lx, , k] of lightsAt) lit += k * 0.7 * Math.exp(-((xx - lx) ** 2) / 6);
      const [ra, ga, ba] = this.rockStyle.a;
      col.setRGB(ra / 160, ga / 160, ba / 160).multiplyScalar(Math.min(1, lit) * (0.6 + 0.4 * sat(d + 1)));
    });
    cgeo.rotateX(Math.PI / 2);
    const vault = new THREE.Mesh(cgeo, vaultMat);
    vault.position.set(cx, vY, -0.6); root.add(vault);
    // end walls: the chamber is closed left and right (except the mouth)
    const capMat = rockMaterial(this.low, { roughness: 0.95 });
    capMat.map = sandGrainTex().clone(); capMat.map.needsUpdate = true; capMat.map.wrapS = capMat.map.wrapT = THREE.RepeatWrapping; capMat.map.repeat.set(2.5, 2.5);
    for (const side of [-1, 1]) {
      if ((side < 0 && c.openLeft) || (side > 0 && c.openRight)) continue;
      const ex = side < 0 ? c.x0 : c.x1;
      const geo = reliefSheet(8, 7, 40, 40, (u, y) => {
        const z = -u * side;                     // sheet u runs along the world z
        return wallHeight(z * 1.1 + 300 + ex, y + 3.5, false, 300 + ex) * 0.7 + Math.max(0, z - 1.5) * 0.25;
      }, (col, u, y, d) => { const [ra, ga, ba] = this.rockStyle.b; col.setRGB(ra / 110, ga / 110, ba / 110).multiplyScalar(0.25 + 0.25 * sat(d + 0.8) - Math.max(0, y) * 0.03); });
      const cap = new THREE.Mesh(geo, capMat);
      cap.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      cap.position.set(ex + side * 0.4, 3.0, -0.4);
      root.add(cap);
      // a heap of fallen rock where the end wall meets the floor
      for (let i = 0; i < 4; i++) this.boulder(840 + i + Math.round(ex * 2), ex - side * (0.2 + r() * 0.5), -2.6 + i * 1.3, 0.6 + r() * 0.5, 0.5 + r() * 0.5, 0.6, root, { colA: this.stoneB, colB: 0x2e2a28 });
    }
    // boulders along the foot of the wall (not in front of a passage)
    const nearOpening = (x, pad = 0.4) => (c.openings || []).some((o) => Math.abs(x - o.x) < o.w / 2 + pad);
    const minZ = c.minZ ?? -2.0;
    for (let x = c.x0 + 0.3; x < c.x1; x += 1.4 + r() * 2.2) {
      if (nearOpening(x, 0.6) || (c.clear || []).some(([a, b]) => x > a && x < b)) continue;
      const sx = 0.6 + r() * 0.9, sy = 0.45 + r() * 0.7, sz = 0.5 + r() * 0.5, z = BACK + 0.5 + r() * 0.5;
      this.boulder(800 + Math.round(x * 3 + (c.nx || 0)), x, z, sx, sy, sz);
      if (z + sz * 0.8 > minZ - 0.25) this.solid(x, z, sx, sz);
    }
    // grit drifted against the foot of the wall (no hard seam)
    const nD = Math.round(W);
    const drift = new THREE.InstancedMesh(rockGeometry(880 + (c.nx || 0) % 7, { detail: 3, rough: 0.45, sharp: 0.6, flat: -0.05, colA: this.stoneA, colB: this.stoneB, dark: 0.35 }), this.sandMat, nD);
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < nD; i++) { let x = cx - W / 2 + i * 0.95 + r() * 0.5; if (nearOpening(x, 0.1)) x = cx - W / 2 - 4; q.setFromEuler(e.set(0, r() * 6, 0)); m.compose(V3(x, -0.04, BACK + 0.15 + r() * 0.5), q, V3(1.0 + r() * 0.9, 0.18 + r() * 0.3, 0.6 + r() * 0.4)); drift.setMatrixAt(i, m); drift.setColorAt(i, new THREE.Color().setScalar(this.lightAt(x))); } }
    root.add(drift);
    // broken rock: angular slabs and chips fallen from the beds, round cobbles, flat flakes —
    // three shapes, every piece its own size, squash, tilt and tone; clustered at the wall, sparse on the floor
    const kinds = [
      rockGeometry(885 + (c.nx || 0) % 5, { detail: 1, rough: 0.5, sharp: 1.0, flat: -0.35, strata: 1, colA: this.stoneA, colB: this.stoneB, dark: 0.5 }),
      rockGeometry(870 + (c.nx || 0) % 3, { detail: 2, rough: 0.3, sharp: 0.3, flat: -0.4, colA: this.stoneA, colB: this.stoneB, dark: 0.45 }),
      rockGeometry(890 + (c.nx || 0) % 4, { detail: 1, rough: 0.7, sharp: 0.7, flat: -0.2, colA: this.stoneB, colB: 0x34302c, dark: 0.4 }),
    ];
    const nT = Math.round(W * (this.low ? 5 : 7));
    const counts = [Math.round(nT * 0.5), Math.round(nT * 0.2), Math.round(nT * 0.3)];
    const col = new THREE.Color();
    kinds.forEach((geo, kI) => {
      const im = new THREE.InstancedMesh(geo, this.sandMat, counts[kI]);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < counts[kI]; i++) {
        const atWall = r() < 0.72;
        const x = cx - W / 2 + r() * W, z = atWall ? BACK + 0.35 + Math.pow(r(), 1.6) * 1.3 : -2 + r() * 3.4;
        const big = r() < (atWall ? 0.22 : 0.06);
        const sc = big ? 0.12 + r() * 0.22 : 0.025 + r() * r() * 0.09;
        const flatK = kI === 2 ? 0.25 + r() * 0.2 : kI === 0 ? 0.4 + r() * 0.5 : 0.55 + r() * 0.35;
        q.setFromEuler(e.set((r() - 0.5) * (kI === 1 ? 0.3 : 1.2), r() * 6.3, (r() - 0.5) * (kI === 1 ? 0.3 : 1.2)));
        m.compose(V3(x, sc * flatK * 0.25, z), q, V3(sc * (0.8 + r() * 0.9), sc * flatK, sc * (0.7 + r() * 0.6)));
        im.setMatrixAt(i, m);
        const v = (0.6 + r() * 0.55) * this.lightAt(x); im.setColorAt(i, col.setRGB(v * (0.96 + r() * 0.1), v, v * (0.9 + r() * 0.12)));
      }
      root.add(im);
    });
    // the passages: darkness inside, a faint breath of light from where they lead
    for (const o of c.openings || []) {
      if (o.tint) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: o.tint, transparent: true, opacity: o.tintOpacity ?? 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.scale.set(o.w * 1.1, o.h * 0.9, 1); s.position.set(o.x, o.h * 0.42, BACK - 2.0); root.add(s);
        o.glowSprite = s;
      }
      if (o.door) this.doors.push({ id: o.door.id, label: o.door.label, x: o.x, z: -2.3, radius: 1.05, anchor: V3(o.x, Math.min(1.9, o.h * 0.7), BACK + 0.2), to: o.door.to, spawn: o.door.spawn });
    }
    // decals added by the story (blood)
    this.decals = new THREE.Group(); root.add(this.decals);
    // light
    const hemi = new THREE.HemisphereLight(0x9c9a98, 0x2a2420, 0.95);
    root.add(hemi);
    // light raking along the wall from the right: it is what makes the eroded relief read
    const rake = new THREE.DirectionalLight(0xf0d0a8, 2.0);
    rake.position.set(cx + 24, 9, -1.5); rake.target.position.set(cx, 1, BACK);
    root.add(rake, rake.target);
    const fill = new THREE.PointLight(0xd0a884, 5, 12, 1.1); fill.position.set(cx, 1.8, 3.5); root.add(fill);
    this.fill = fill;
    this.lights = { hemi, rake };
    for (const x of c.torches || []) this.torch(x);
    this.buildRoom(r);
    this.buildForeground();
    this.setState('L3');
    return root;
  }

  /** The chamber's own things (overridden). */
  buildRoom() {}

  /**
   * A torch wedged in a crack of the rock: a crooked stick, a head of tarred rags, soot on the
   * rock above. Every one is different (length, lean, height, flame).
   */
  torch(x, y = 2.12) {
    const root = this.root;
    const n = this.torches.length, hs = hash1(x * 3.7 + n, 9);
    y += (hs - 0.5) * 0.4;
    const len = [0.62, 0.42, 0.55, 0.36][n % 4] + hash1(x, 11) * 0.1, rx = -0.2 - hash1(x, 12) * 0.4, rz = [0.32, -0.42, 0.08, -0.2][n % 4] + (hash1(x, 13) - 0.5) * 0.2;
    const zw = Math.max(BACK + 0.55, Math.min(BACK + 1.3, this.wallZ(x, y) + 0.12));
    const g = new THREE.Group(); g.position.set(x, y - len, zw); g.rotation.set(rx, 0, rz); root.add(g);
    const stickGeo = new THREE.CylinderGeometry(0.022, 0.034, len, 7, 3); stickGeo.translate(0, len / 2, 0);
    { const p = stickGeo.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setX(i, p.getX(i) + Math.sin(t * 3 + x) * 0.02); } stickGeo.computeVertexNormals(); }
    g.add(new THREE.Mesh(stickGeo, this.mat('torchStick', { color: 0x3a2c20, roughness: 1 })));
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.042, 0.16, 8, 2), this.mat('torchHead', { color: 0x1a1410, roughness: 1, flatShading: true }));
    head.position.y = len + 0.03; head.rotation.y = hs * 3; g.add(head);
    for (let k = 0; k < 2; k++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.01, 4, 10), this.mat('torchWrap', { color: 0x4a3a2a, roughness: 1 })); w.rotation.x = Math.PI / 2 + (k - 0.5) * 0.3; w.position.y = len - 0.02 + k * 0.07; g.add(w); }
    if (n % 2 === 0) {                                         // an iron ring hammered into the rock
      const iron = this.mat('torchIron', { color: 0x2a2826, metalness: 0.6, roughness: 0.6 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 5, 12), iron); ring.rotation.x = Math.PI / 2; ring.position.y = len * 0.55; g.add(ring);
      const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.2, 5), iron); spike.rotation.x = Math.PI / 2; spike.position.set(0, len * 0.55, -0.1); g.add(spike);
    } else {                                                   // or wedged with stones in a crack
      for (let k = 0; k < 3; k++) this.rock((k - 1) * 0.05, 0.03 + k * 0.02, -0.02, 0.05, 0.035, 0.04, this.mat('torchWedge', { color: 0x4a4440, roughness: 1 }), g, k + n);
    }
    g.updateMatrixWorld(true);
    const top = V3(0, len + 0.1, 0).applyMatrix4(g.matrixWorld);
    collapse(g);
    // soot licked up the rock above the flame
    const soot = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    soot.position.set(top.x + rz * -0.2, top.y + 0.45, Math.max(this.wallZ(top.x, top.y + 0.45) + 0.06, zw - 0.05)); root.add(soot);
    const fs = [1.4, 1.05, 1.25, 0.9][n % 4] + hash1(x, 14) * 0.25;
    const t = glow(0xff9a48, 0.4 * fs, 0.28); t.position.set(top.x, top.y + 0.02, top.z + 0.08); root.add(t);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fl.scale.set(0.16 * fs, 0.3 * fs, 1); fl.position.set(top.x, top.y + 0.1 * fs, top.z + 0.06); root.add(fl);
    this.flames.push({ s: fl, ph: x * 5.3, k: fs });
    const l = new THREE.PointLight(0xffaa70, 5, 7, 1.4); l.position.set(x, y - 0.12, -1.4); root.add(l);
    this.torches.push(l);
    return l;
  }

  buildForeground() {
    const fg = (name) => { const g = new THREE.Group(); g.name = name; this.root.add(g); this.foregroundGroups.push(g); return g; };
    const dark = { colA: 0x3e3a36, colB: 0x1e1c1a, dark: 0.6 };
    // big rocks between the camera and the floor: the chamber closes in around the player.
    // Each one is its own kind: a mound with fallen pieces, a leaning slab, a flat shelf, a heap of blocks.
    for (const [x, w, h, z = 2.6] of this.cfg.fg || []) {
      const g = fg(`fg-rock-${this.id}-${x}`);
      const W = w * 1.35, Hh = h * 1.9;
      const sd = 970 + Math.round(x * 5 + (this.cfg.nx || 0));
      const kind = Math.floor(hash1(sd, 21) * 4), r2 = (k) => hash1(sd + k, 22);
      if (kind === 0) {
        this.boulder(sd, x, z, W, Hh, 0.9, g, dark);
        this.boulder(sd + 5, x + W * 0.75, z + 0.35, W * 0.55, Hh * 0.6, 0.6, g, { ...dark, sharp: 0.9 });
        this.boulder(sd + 8, x - W * 0.8, z + 0.5, W * 0.45, Hh * 0.4, 0.5, g, dark);
      } else if (kind === 1) {
        const s1 = this.boulder(sd, x, z, W * 0.6, Hh * 1.5, 0.45, g, { ...dark, rough: 0.3, sharp: 1.1, strata: 2 });
        s1.rotation.z = (r2(1) - 0.5) * 0.8; s1.position.y = -0.1;
        this.boulder(sd + 3, x + W * 0.6, z + 0.2, W * 0.5, Hh * 0.45, 0.55, g, { ...dark, sharp: 0.8 });
      } else if (kind === 2) {
        this.boulder(sd, x, z, W * 1.3, Hh * 0.75, 0.8, g, { ...dark, top: 0.35, rough: 0.35, sharp: 1.0, strata: 2.2 });
        for (let k = 0; k < 3; k++) this.boulder(sd + 10 + k, x + (r2(k) - 0.5) * W * 2, z + 0.4 + r2(k + 4) * 0.4, 0.15 + r2(k + 7) * 0.2, 0.12 + r2(k + 9) * 0.15, 0.15, g, dark);
      } else {
        for (let k = 0; k < 4; k++) this.boulder(sd + k * 3, x + (k - 1.5) * W * 0.55, z + r2(k) * 0.5, W * (0.35 + r2(k + 3) * 0.35), Hh * (0.45 + r2(k + 5) * 0.75), 0.5, g, { ...dark, sharp: 1.0, rough: 0.55 });
      }
    }
    // the vault hangs down near the camera: lips, broken teeth of rock, a heavy overhang
    for (const [x, w, len = 1.0] of this.cfg.lips || []) {
      const g = fg(`fg-lip-${this.id}-${x}`);
      const top = (this.cfg.vault ?? 3.95) + 0.4;
      const sd = 985 + Math.round(x * 3);
      const kind = Math.floor(hash1(sd, 31) * 3);
      this.stalactite(sd, x, 2.0, len * (kind === 1 ? 1.3 : 1), w * (kind === 2 ? 1.8 : 1), g, top);
      this.stalactite(sd + 1, x + w * 1.3, 2.3, len * 0.6, w * 0.6, g, top);
      if (kind === 1) this.stalactite(sd + 2, x - w * 1.1, 2.15, len * 0.45, w * 0.4, g, top);
      if (kind === 2) { const o = this.boulder(sd + 3, x - w * 0.6, 1.6, w * 2.6, 0.5, 0.9, g, { colA: this.stoneB, colB: 0x1e1c1a, sharp: 1, strata: 2 }); o.position.y = top - 0.15; }
    }
  }

  // ------------------------------------------------------------------ props

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
    const light = new THREE.PointLight(0xffa060, 7 * s, 7 * s, 1.4); light.position.y = 0.7; g.add(light);
    // the cold ring of stones stays when the fire is out
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.36 * s, 18), this.mat('ash', { color: 0x2a2420, roughness: 1 }));
    ash.rotation.x = -Math.PI / 2; ash.position.set(x, 0.01, z); parent.add(ash);
    g.position.set(x, 0, z);
    parent.add(g);
    const f = { g, flame, core, light, base: 7 * s, baseH: 0.9 * s, ph: Math.random() * 6 };
    this.fires.push(f);
    this.colliders.push({ x, z, r: 0.42 * s });
    return f;
  }

  /** Fire on / off (the stone ring and the ash stay). */
  setFire(f, on, k = 1) {
    f.flame.visible = f.core.visible = on;
    f.base = (f.base0 ?? (f.base0 = f.base)) * k;
    f.light.intensity = on ? f.base : 0;
    for (const ch of f.g.children) if (ch.isMesh && ch.geometry.type === 'CylinderGeometry') ch.material = on ? this.mat('fireLog', { color: 0x2a1c12, roughness: 1 }) : this.mat('fireLogCold', { color: 0x1a1612, roughness: 1 });
  }

  /** A human skull: cranium, brow, cheekbones, sockets, the nose hole, teeth; sometimes no jaw. */
  skull(x, y, z, m = this.boneMat()) {
    const g = new THREE.Group();
    const sd = Math.round(x * 31 + z * 17 + y * 7);
    g.scale.setScalar(1.15 + hash1(sd, 41) * 0.35);
    const cGeo = new THREE.SphereGeometry(0.1, 14, 10);
    { const p = cGeo.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i), zz = p.getZ(i); p.setXYZ(i, p.getX(i) * (yy < -0.03 ? 0.85 : 0.92), yy, zz + (zz < 0 && yy > -0.02 ? -0.02 : 0)); } cGeo.computeVertexNormals(); }
    const cr = new THREE.Mesh(cGeo, m); cr.scale.set(1, 0.92, 1.12); g.add(cr);
    const face = new THREE.Mesh(roundedBox(0.105, 0.075, 0.07, 0.025, 2), m); face.position.set(0, -0.06, 0.07); g.add(face);
    for (const s of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), m); ck.position.set(s * 0.05, -0.05, 0.075); ck.scale.set(1, 0.7, 1); g.add(ck); }
    const hole = this.mat('skullHole', { color: 0x120e0a, roughness: 1 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), hole); e.position.set(s * 0.032, -0.022, 0.1); e.scale.set(1.05, 0.9, 0.45); g.add(e); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 4), hole); nose.position.set(0, -0.06, 0.106); nose.rotation.x = Math.PI; g.add(nose);
    const teeth = new THREE.Mesh(roundedBox(0.06, 0.016, 0.02, 0.006, 1), this.mat('teeth', { color: 0x9a8a6a, roughness: 0.7 })); teeth.position.set(0, -0.1, 0.092); g.add(teeth);
    if (hash1(sd, 42) > 0.45) { const jaw = new THREE.Mesh(roundedBox(0.09, 0.03, 0.07, 0.012, 1), m); jaw.position.set(0, -0.125, 0.07); jaw.rotation.x = 0.15; g.add(jaw); }
    collapse(g);
    g.rotation.set((hash1(sd, 43) - 0.5) * 0.5, (hash1(sd, 44) - 0.5) * 1.6, (hash1(sd, 45) - 0.5) * 0.6);
    g.position.set(x, y, z);
    return g;
  }

  boneMat() { return this.mat('caveBone2', { color: 0xb8ad94, map: boneTex(), roughness: 0.85 }); }

  /** A deer skull seen from the front: narrow cranium, long face tapering down to the muzzle. */
  deerSkull(m) {
    const g = new THREE.Group();
    const cr = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 9), m); cr.scale.set(1.15, 0.85, 0.9); g.add(cr);
    const fgeo = new THREE.CylinderGeometry(0.075, 0.026, 0.34, 10, 4); fgeo.translate(0, -0.15, 0);
    { const p = fgeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.55 + Math.abs(p.getY(i)) * 0.15); fgeo.computeVertexNormals(); }
    const face = new THREE.Mesh(fgeo, m); face.position.set(0, -0.02, 0.03); g.add(face);
    const hole = this.mat('skullHole', { color: 0x120e0a, roughness: 1 });
    for (const s of [-1, 1]) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m); orb.position.set(s * 0.07, -0.05, 0.03); g.add(orb);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), hole); e.position.set(s * 0.078, -0.05, 0.05); e.scale.set(0.9, 1, 0.5); g.add(e);
    }
    const nas = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), hole); nas.position.set(0, -0.28, 0.06); nas.scale.set(1.2, 1.6, 0.5); g.add(nas);
    return g;
  }

  /** Antlers on a deer skull: tapering beams and tines, every pair its own spread and points. */
  antlers(x, y, z, m = this.boneMat()) {
    const g = new THREE.Group();
    const sd = Math.round(x * 13 + y * 7 + 50);
    const spread = 0.8 + hash1(sd, 51) * 0.45, tall = 0.8 + hash1(sd, 52) * 0.4, tines = 2 + Math.floor(hash1(sd, 53) * 3);
    for (const s of [-1, 1]) {
      const asym = 1 + (hash1(sd + s, 54) - 0.5) * 0.18;
      const beam = [[s * 0.05, 0.02, 0], [s * 0.2 * spread, 0.1, 0.05], [s * 0.34 * spread, 0.34 * tall, 0.07], [s * 0.36 * spread, 0.64 * tall * asym, 0.02], [s * 0.27 * spread, 0.86 * tall * asym, -0.04]].map(([a, b, c]) => V3(a, b, c));
      g.add(new THREE.Mesh(taperTube(beam, 0.04, 0.009, 14, 7), m));
      const curve = new THREE.CatmullRomCurve3(beam);
      for (let k = 0; k < tines; k++) {
        const t0 = 0.12 + k * (0.65 / tines) + hash1(sd + k * 3 + s, 55) * 0.06;
        const b0 = curve.getPointAt(t0), len = (0.16 + hash1(sd + k + s, 56) * 0.14) * tall;
        const lean = (k === 0 ? 0.6 : 0.15) * s;
        g.add(new THREE.Mesh(taperTube([b0, V3(b0.x + lean * len * 0.3, b0.y + len * 0.5, b0.z + 0.05), V3(b0.x - s * len * 0.12 + lean * len * 0.2, b0.y + len, b0.z + 0.07)], 0.022, 0.004, 7, 5), m));
      }
      const burr = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.012, 5, 9), m); burr.position.set(s * 0.06, 0.02, 0); burr.rotation.set(Math.PI / 2, 0, s * 0.6); g.add(burr);
    }
    const skull = this.deerSkull(m); skull.position.set(0, 0.0, 0.04); g.add(skull);
    collapse(g);
    // lashed to a peg driven into a crack (these two stay last: the den hides them on the floor)
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 12), this.mat('rawhide', { color: 0x3a2a1c, roughness: 1 })); strap.position.set(0, 0.07, -0.02); strap.rotation.x = 0.4; g.add(strap);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12), this.mat('peg', { color: 0x2a1a10 })); peg.rotation.x = Math.PI / 2; peg.position.set(0, 0.1, -0.08); g.add(peg);
    g.rotation.z = (hash1(sd, 57) - 0.5) * 0.25;
    g.scale.setScalar(0.85 + hash1(sd, 58) * 0.3);
    g.position.set(x, y, z);
    return g;
  }

  /** Antlers hung on the rock at x (set against the relief, with a soft shadow). */
  wallAntlers(x, y, parent = this.root) {
    const az = this.wallZ(x, y + 0.15) + 0.1;
    parent.add(this.antlers(x, y, az));
    const shd = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
    shd.position.set(x + 0.08, y - 0.05, az - 0.06); parent.add(shd);
  }

  /** A decal cut into the wall (claw furrows, tally marks). */
  wallMark(kind, x, y, s = 0.6, parent = this.root) {
    const z = Math.max(this.wallZ(x - s / 2, y), this.wallZ(x + s / 2, y), this.wallZ(x, y + s / 2), this.wallZ(x, y - s / 2)) + 0.04;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshLambertMaterial({ map: scratchTex(kind), transparent: true, alphaTest: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); parent.add(m);
    return m;
  }

  /** A long bone: a slightly bent, tapering shaft with knobbly ends; length varies. */
  longBone(m = this.boneMat(), k = 1) {
    const g = new THREE.Group();
    const L = 0.36 * k, bend = (k - 1) * 0.05 + 0.012;
    g.add(new THREE.Mesh(taperTube([V3(0, -L / 2, 0), V3(bend, 0, 0), V3(0, L / 2, 0)], 0.02 * Math.sqrt(k), 0.015 * Math.sqrt(k), 6, 6), m));
    for (const s of [-1, 1]) {
      for (const dx of [-0.012, 0.014]) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.022 * Math.sqrt(k), 8, 6), m); kn.position.set(dx, s * L / 2, 0); kn.scale.set(1, 0.8, 0.9); g.add(kn); }
    }
    return g;
  }

  /** A heap of bones with a skull or two on top. */
  bonePile(x, z, n = 9, parent = this.root, skulls = 1) {
    const bone = this.boneMat();
    const top = parent; parent = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const b = this.longBone(bone, 0.6 + hash1(i + x * 3, 61) * 0.8);
      b.position.set(x + Math.sin(i * 1.7) * 0.32, 0.04 + (i % 4) * 0.025, z + Math.cos(i * 2.3) * 0.22);
      b.rotation.set(Math.PI / 2 + (hash1(i, 62) - 0.5) * 0.4, 0, i * 0.9); parent.add(b);
    }
    for (let i = 0; i < Math.round(n / 3); i++) {           // ribs and shards among them
      const a = i * 2.1 + x, rb = new THREE.Mesh(taperTube([V3(0, 0, 0), V3(0.08, 0.04, 0.02), V3(0.16, 0.0, 0.04)], 0.008, 0.004, 6, 4), bone);
      rb.position.set(x + Math.cos(a) * 0.3, 0.02, z + Math.sin(a) * 0.2); rb.rotation.y = a; parent.add(rb);
    }
    for (let k = 0; k < skulls; k++) parent.add(this.skull(x + 0.2 * k - 0.1, 0.14, z + 0.1 * k, bone));
    top.add(collapse(parent));
  }

  /** A crate knocked together from boards: gaps, corner posts, every board its own tone. */
  plankCrate(w, h, d) {
    const g = new THREE.Group();
    const n = Math.max(3, Math.round(h / 0.11)), bh = h / n;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Color(0x6a5034).multiplyScalar(0.75 + hash1(i + w * 10, 71) * 0.45);
      const mm = this.mat(`crateBoard${i % 3}`, { color: c, roughness: 1 });
      for (const [bw, bd, rot] of [[w, d, 0], [d, w, Math.PI / 2]]) {
        for (const s of [-1, 1]) { const b = new THREE.Mesh(roundedBox(bw, bh - 0.012, 0.018, 0.005, 1), mm); b.position.set(rot ? s * (w / 2 - 0.009) : 0, bh * (i + 0.5), rot ? 0 : s * (d / 2 - 0.009)); b.rotation.y = rot; g.add(b); }
      }
    }
    const post = this.mat('cratePost', { color: 0x4a3622, roughness: 1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(roundedBox(0.04, h, 0.04, 0.008, 1), post); p.position.set(sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)); g.add(p); }
    const lid = new THREE.Mesh(roundedBox(w - 0.03, 0.015, d - 0.03, 0.005, 1), this.mat('crateIn', { color: 0x1a140e, roughness: 1 })); lid.position.y = h * 0.75; g.add(lid);
    return collapse(g);
  }

  /** A pelt / blanket thrown on the floor: soft, lumpy, uneven edge. */
  pelt(x, z, rot, parent = this.root, color = 0x4a3a2c, scale = 0.12, sx = 0.65, sz = 0.42) {
    const m = new THREE.Mesh(rockGeometry(990 + Math.round(x * 3), { detail: 3, rough: 0.55, sharp: 0.4, flat: -0.05, colA: 0xffffff, colB: 0x9a9088, dark: 0.45 }), this.mat(`pelt${color}`, { color: new THREE.Color(color).multiplyScalar(2.6), map: furTex(), roughness: 1, vertexColors: true }));
    m.position.set(x, 0.0, z); m.scale.set(sx, scale, sz); m.rotation.y = rot;
    parent.add(m);
    return m;
  }

  /** Loose heaps of straw stalks (beds). */
  straw(beds, parent = this.root, n = 540, seed = 744) {
    const stalk = new THREE.PlaneGeometry(0.018, 0.34); stalk.translate(0, 0.17, 0);
    const stM = this.mat('strawStalk', { color: 0xc8a45a, roughness: 1, side: THREE.DoubleSide });
    const sr = rng(seed);
    const st = new THREE.InstancedMesh(stalk, stM, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const [bx, bz] = beds[i % beds.length], a = sr() * 6.28, d = Math.sqrt(sr());
      q.setFromEuler(e.set(Math.PI / 2 - 0.15 - sr() * 0.5, sr() * 6.28, (sr() - 0.5) * 0.6));
      m4.compose(V3(bx + Math.cos(a) * d * 0.75, 0.02 + (1 - d) * 0.1 * sr(), bz + Math.sin(a) * d * 0.42), q, V3(1, 0.6 + sr() * 0.8, 1));
      st.setMatrixAt(i, m4); st.setColorAt(i, col.setScalar(0.65 + sr() * 0.5));
    }
    parent.add(st);
    const lumpM = this.mat('straw', { color: 0xa88a4a, roughness: 1, flatShading: true });
    for (const [x, z] of beds) { const lump = this.rock(x, 0.0, z, 0.7, 0.07, 0.4, lumpM, parent, x); lump.position.y = 0.02; }
  }

  /** A floor decal (drag marks, stains) lying on the sand. */
  floorDecal(tex, x, z, w, d, rot = 0, parent = this.root, opacity = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity, alphaTest: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.02, z);
    parent.add(m);
    return m;
  }

  /** A blood decal on the floor (the story adds them). */
  addBlood(x, z, s = 1, seed = 3) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * s, 0.9 * s), new THREE.MeshLambertMaterial({ map: bloodTex(seed), transparent: true, alphaTest: 0.3, depthWrite: false }));
    d.rotation.x = -Math.PI / 2; d.rotation.z = Math.random() * 6; d.position.set(x, 0.015 + this.decals.children.length * 0.0005, z);
    this.decals.add(d);
    return d;
  }

  clearBlood() { this.decals?.clear(); }

  // ------------------------------------------------------------------ states

  setState(name) {
    if (this.state !== name) this.clearBlood();
    this.state = name;
    const L5 = name === 'L5', N = name === 'L3N';
    const k = this.cfg.ambient ?? 1;
    this.lights.hemi.intensity = (L5 ? 0.62 : N ? 0.36 : 0.95) * k;
    this.lights.rake.intensity = (L5 ? 0.6 : N ? 0.5 : name === 'L4' ? 0.85 : 1.1) * k;
    this.lights.rake.color.set(L5 || N ? 0x9ab0d0 : 0xe8c8a0);
    for (const t of this.torches) t.intensity = L5 ? 2.6 : N ? 2.4 : 5;
    if (this.wallMat) this.wallMat.emissiveIntensity = (L5 || N ? 0.26 : 0.16) * (this.rockStyle.amb ? 1.2 : 1);
    this.roomState(name);
  }

  /** The chamber's own reaction to the state (overridden). */
  roomState() {}

  update(dt) {
    super.update(dt);
    const t = this.time;
    if (this.followTarget) this.fill.position.x = this.followTarget().position.x;
    for (const f of this.flames) { const k = 0.85 + Math.sin(t * 11 + f.ph) * 0.1 + Math.sin(t * 27 + f.ph * 3) * 0.06; f.s.scale.set(0.16 * (2 - k) * (f.k ?? 1), 0.3 * k * (f.k ?? 1), 1); f.s.material.opacity = 0.75 + 0.25 * k; }
    for (const f of this.fires) {
      const k = 0.82 + Math.sin(t * 9 + f.ph) * 0.08 + Math.sin(t * 23 + f.ph * 2) * 0.06;
      if (f.g.visible && f.light.intensity > 0) { f.light.intensity = f.base * k; f.flame.scale.y = f.baseH * (0.8 + 0.3 * k); f.flame.material.opacity = 0.75 + 0.2 * k; }
    }
  }
}

// ==================================================================== the hall

/**
 * `cave` — the hall, the heart of the system. Left: the pack's fires, a carcass on the spit,
 * furs, a crate of stolen beer. Right: the girls' niche — straw beds, a small fire, a heap of
 * food that is far too much food. Passages: the den (far left), the deep (the dark hole in the
 * middle of the back wall), the store (far right).
 */
export class CaveScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave', title: 'Пещера · зал', x0: -12.5, x1: 12.5, nx: 0,
      openings: [
        { x: -10.4, w: 1.9, h: 2.4, tint: 0x6a4a30, door: { id: 'hall_den', label: 'В логово', to: 'cave_den', spawn: { x: 6.6, z: -1.5, facing: -1 } } },
        { x: -0.6, w: 1.6, h: 2.2, tint: 0x401010, tintOpacity: 0.12, door: { id: 'hall_deep', label: 'Вглубь', to: 'cave_deep', spawn: { x: 7.0, z: -0.7, facing: -1 } } },
        { x: 10.4, w: 2.0, h: 2.5, tint: 0x8a6040, door: { id: 'hall_store', label: 'В кладовую', to: 'cave_store', spawn: { x: -4.9, z: -1.4, facing: 1 } } },
      ],
      cam: { minX: -7.8, maxX: 7.8 },
      torches: [-6.0, 2.2, 8.4],
      lights: [[-7.2, 0.6, 1.05], [-3.4, 0.6, 0.95], [5.2, 0.6, 0.95]],
      fg: [[-10.8, 1.4, 0.75], [-4.4, 1.0, 0.5], [2.8, 0.9, 0.45], [9.6, 1.3, 0.65]],
      lips: [[-8.2, 0.42, 1.1], [0.8, 0.34, 0.8], [6.4, 0.4, 1.0]],
    });
  }

  buildRoom() {
    // the pack's side of the hall
    const g = this.groups.hall = new THREE.Group(); this.root.add(g);
    this.hallFires = [this.fire(-7.2, -1.5, 1.1, g), this.fire(-3.4, -2.0, 0.9, g)];
    for (const [x, z, rot] of [[-8.9, -2.5, 0.3], [-5.4, -2.7, -0.4], [-2.2, -2.5, 0.8]]) this.pelt(x, z, rot, g);
    const spit = this.mat('spit', { color: 0x3a2a1c, roughness: 1 });
    const stick = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, L, 16), spit); c.position.set((x0 + x1) / 2, (y0 + y1) / 2, -1.5); c.rotation.z = Math.atan2(x0 - x1, y1 - y0); g.add(c); };
    stick(-8.1, 0, -7.75, 1.05); stick(-7.45, 0, -7.8, 1.05); stick(-6.95, 0, -6.6, 1.05); stick(-6.3, 0, -6.65, 1.05); stick(-8.0, 1.0, -6.4, 1.0);
    this.meat = new THREE.Mesh(rockGeometry(905, { detail: 3, rough: 0.5, sharp: 0.5, flat: -2, colA: 0x6a3a22, colB: 0x24120a, dark: 0.7 }), this.mat('meatV', { vertexColors: true, color: 0xffffff, roughness: 0.6 }));
    this.meat.scale.set(0.45, 0.22, 0.22); this.meat.position.set(-7.2, 0.92, -1.5); g.add(this.meat);
    const crate = this.plankCrate(0.6, 0.4, 0.4); crate.position.set(-4.9, 0, -2.6); crate.rotation.y = 0.3; g.add(crate);
    const can = this.mat('can', { color: 0xa8b0b8, metalness: 0.7, roughness: 0.3 });
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), can); c.position.set(-4.4 + i * 0.16, 0.05, -2.2 + (i % 2) * 0.14); c.rotation.z = i % 2 ? Math.PI / 2 : 0; if (!(i % 2)) c.position.y = 0.06; g.add(c); }
    this.colliders.push({ x: -4.9, z: -2.6, r: 0.38 });
    // sitting stones round the big fire
    this.solidBoulder(1101, -8.9, -0.6, 0.55, 0.42, 0.42, g);
    this.solidBoulder(1102, -5.6, -0.5, 0.5, 0.36, 0.4, g);
    // the middle of the hall: a fallen block and a stalagmite split it into two halves
    this.solidBoulder(1103, 1.4, -2.2, 0.95, 1.25, 0.7);
    this.stalagmite(1104, -1.9, 0.35, 1.3, 0.3);
    this.solidBoulder(1105, -11.4, 0.4, 0.8, 0.8, 0.6);
    this.solidBoulder(1106, 11.6, 0.1, 0.7, 0.9, 0.6);
    this.anchors.hallSeats = [{ x: -8.6, z: -1.0 }, { x: -6.0, z: -0.9 }, { x: -4.2, z: -1.2 }, { x: -2.6, z: -1.4 }];
    this.anchors.ashes = V3(-7.2, 0.5, -1.5);
    this.anchors.spit = V3(-7.2, 1.1, -1.5);
    // the girls' niche: straw beds, a blanket, a small fire, a heap of food (too much food)
    const n = this.groups.niche = new THREE.Group(); this.root.add(n);
    const beds = [[3.6, -2.2], [5.0, -2.5], [6.4, -2.2]];
    this.straw(beds, n);
    this.pelt(5.0, -2.5, 0.2, n, 0x5a2a2a, 0.15);
    const meat = this.mat('rawMeat', { color: 0x3e1610, roughness: 0.5 });
    const berry = this.mat('berries', { color: 0x3a2a5a, roughness: 0.6 });
    for (let i = 0; i < 6; i++) this.rock(7.7 + (i % 3) * 0.35, 0.1 + Math.floor(i / 3) * 0.14, -2.7 + (i % 2) * 0.2, 0.2, 0.1, 0.14, meat, n, i);
    for (let i = 0; i < 4; i++) { const b = this.longBone(); b.position.set(7.7 + i * 0.28, 0.24, -2.6 + (i % 2) * 0.15); b.rotation.set(0.3, i, 1.2); n.add(b); }
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), berry); b.position.set(7.2 + (i % 4) * 0.08, 0.05, -2.2 + Math.floor(i / 4) * 0.08); n.add(b); }
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), can); c.position.set(8.6 + i * 0.13, 0.06, -2.1 + (i % 2) * 0.1); if (i === 3) { c.rotation.z = Math.PI / 2; c.position.y = 0.05; } n.add(c); }
    this.colliders.push({ x: 8.0, z: -2.55, r: 0.4 });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 20, 1, true), this.mat('bucket', { color: 0x5a6068, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide })); bucket.position.set(2.6, 0.15, -1.6); n.add(bucket);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.15, 18), this.mat('bucketWater', { color: 0x1a1e22, metalness: 0.2, roughness: 0.1 })); water.rotation.x = -Math.PI / 2; water.position.set(2.6, 0.24, -1.6); n.add(water);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.008, 6, 20, Math.PI), this.mats.cache.get('bucket')); handle.position.set(2.6, 0.3, -1.6); handle.rotation.z = 0.3; n.add(handle);
    this.colliders.push({ x: 2.6, z: -1.6, r: 0.2 });
    this.nicheFire = this.fire(5.2, -0.9, 0.7, n);
    // drag marks from the niche into the deep (L4/L5)
    this.drag = new THREE.Group(); this.root.add(this.drag);
    this.floorDecal(dragTex(), 1.6, -1.5, 3.8, 0.7, -0.15, this.drag, 0.9);
    this.floorDecal(dragTex(), -0.3, -2.3, 1.6, 0.6, -0.9, this.drag, 0.9);
    this.anchors.niche = { x: 5.0, z: -0.8 };
    this.anchors.bedL = { x: 4.4, z: -1.6 };
    this.anchors.food = V3(8.0, 0.5, -2.5);
    this.anchors.beds = V3(5.0, 0.4, -2.4);
    this.anchors.bucket = V3(2.6, 0.6, -1.6);
    this.anchors.deep = { x: -0.6, z: -2.4 };
  }

  roomState(name) {
    const lit = name === 'L4';
    for (const f of this.hallFires) this.setFire(f, lit);
    this.meat.visible = lit;
    this.setFire(this.nicheFire, name !== 'L5', name === 'L3N' ? 0.35 : 1);
    this.drag.visible = name === 'L5';
  }
}
