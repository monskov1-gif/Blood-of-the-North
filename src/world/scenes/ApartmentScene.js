import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, pixelate } from '../../render/textures.js';
import { glow, lightPool } from '../props.js';
import { roundedBox, bevelBox, noise3, smoothNormals } from '../nature.js';
import { flareSource } from '../../fx/WindowLight.js';

/**
 * Julian and Lizzie Reid's flat in Whitehorse, November — two floors and an attic.
 * Three locations share one kit (AptBase): batched static dressing, switchable lamps and
 * window views, and the Scene State System: 'evening' (default, the cosy one), 'night'
 * (empty flat, one warm lamp, cold street/moon light) and 'day' (overcast, soft grey).
 *
 *   ApartmentScene        living room (left) + hall, bedroom door, stairs up + kitchen (right)
 *   ApartmentBedroomScene Julian's bedroom: striped bed, dresser + mirror, desk + case board
 *   ApartmentAtticScene   Lizzie's attic room: sloped ceiling, desk with hutch, posters, dormer
 */

const TX = (key, w, h, draw, o = {}) => canvasTexture(`apt-${key}`, w, h, draw, { nearest: true, aniso: 1, ...o });
const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => (a >= 1 ? `rgb(${cl(r)},${cl(g)},${cl(b)})` : `rgba(${cl(r)},${cl(g)},${cl(b)},${a})`);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ textures (1 texel ≈ 1 cm)

/** Floor boards running along x, staggered butt joints, a little grain. */
const planksTex = (tone = 0) => TX(`planks-${tone}`, 128, 128, (ctx, w, h) => {
  const r = rng(901 + tone);
  const base = [[170, 118, 72], [150, 102, 64], [178, 140, 98]][tone];
  const bh = 14;
  for (let y = 0; y < h; y += bh) {
    let x = -Math.floor(r() * 90);
    while (x < w) {
      const len = 50 + r() * 70, v = (r() - 0.5) * 30, warm = (r() - 0.5) * 10;
      for (const ox of [0, w]) {
        ctx.fillStyle = rgb(base[0] + v + warm, base[1] + v, base[2] + v - warm); ctx.fillRect(x - ox, y, len, bh);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = rgb(base[0] + v - 28, base[1] + v - 24, base[2] + v - 20, 0.35);
          const gy = y + 1 + Math.floor(r() * (bh - 2));
          ctx.fillRect(x - ox + r() * 8, gy, len * (0.3 + r() * 0.7), 1);
        }
        if (r() < 0.25) { ctx.fillStyle = rgb(base[0] - 60, base[1] - 50, base[2] - 40, 0.6); ctx.fillRect(x - ox + len * r(), y + 4 + r() * 6, 3, 2); }
        ctx.fillStyle = rgb(base[0] - 80, base[1] - 66, base[2] - 50, 0.9); ctx.fillRect(x - ox, y, 1, bh);
      }
      x += len;
    }
    ctx.fillStyle = rgb(base[0] - 90, base[1] - 72, base[2] - 56, 0.85); ctx.fillRect(0, y + bh - 1, w, 1);
    ctx.fillStyle = rgb(base[0] + 30, base[1] + 26, base[2] + 20, 0.25); ctx.fillRect(0, y, w, 1);
  }
});

/** Plain painted plaster with a faint mottle. */
const paintTex = (key, c) => TX(`paint-${key}`, 64, 64, (ctx, w, h) => {
  const r = rng(key.length * 7 + 3);
  ctx.fillStyle = rgb(...c); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) { const v = (r() - 0.5) * 12; ctx.fillStyle = rgb(c[0] + v, c[1] + v, c[2] + v, 0.5); ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
});

/** Square terracotta floor tiles (kitchen). */
const terracottaTex = () => TX('terracotta', 64, 64, (ctx, w, h) => {
  const r = rng(77);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const v = (r() - 0.5) * 24;
    ctx.fillStyle = rgb(150 + v, 86 + v * 0.7, 58 + v * 0.5); ctx.fillRect(i * 32, j * 32, 32, 32);
    for (let k = 0; k < 90; k++) { const q = (r() - 0.5) * 30; ctx.fillStyle = rgb(150 + v + q, 86 + v + q * 0.6, 58 + v + q * 0.4, 0.5); ctx.fillRect(i * 32 + r() * 32, j * 32 + r() * 32, 2, 2); }
  }
  ctx.fillStyle = '#6e5444'; for (let k = 0; k < 2; k++) { ctx.fillRect(k * 32, 0, 1, h); ctx.fillRect(0, k * 32, w, 1); }
});

/** Dark red glazed tiles, light grout, glaze highlights (kitchen splashback + worktop). */
const redTileTex = () => TX('redtile', 64, 64, (ctx, w, h) => {
  const r = rng(51);
  const s = 16;
  ctx.fillStyle = '#c8bcb0'; ctx.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const v = (r() - 0.5) * 26, x = i * s + 1, y = j * s + 1;
    ctx.fillStyle = rgb(112 + v, 18 + v * 0.3, 28 + v * 0.3); ctx.fillRect(x, y, s - 1, s - 1);
    ctx.fillStyle = rgb(80 + v, 10, 20, 0.6); ctx.fillRect(x, y + s - 3, s - 1, 2);
    ctx.fillStyle = 'rgba(255,200,200,0.45)'; ctx.fillRect(x + 2 + r() * 3, y + 2, 4 + r() * 4, 1); ctx.fillRect(x + 2, y + 3, 2, 2);
    for (let k = 0; k < 6; k++) { ctx.fillStyle = rgb(150 + v, 40, 50, 0.4); ctx.fillRect(x + r() * s, y + r() * s, 2, 1); }
  }
});

/** Grey-brown oak (kitchen cabinets, desk, attic bed). */
const oakTex = (k = 0) => TX(`oak-${k}`, 32, 128, (ctx, w, h) => {
  const r = rng(61 + k);
  const b = [[132, 100, 68], [168, 122, 74], [118, 82, 52]][k];
  ctx.fillStyle = rgb(...b); ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = r() * w, v = (r() - 0.5) * 40;
    ctx.fillStyle = rgb(b[0] + v, b[1] + v * 0.8, b[2] + v * 0.6, 0.35);
    for (let y = 0; y < h; y += 2) ctx.fillRect(x + Math.sin(y * 0.05 + i) * 1.5, y, 1, 2);
  }
  for (let i = 0; i < 3; i++) { ctx.fillStyle = rgb(b[0] - 50, b[1] - 40, b[2] - 30, 0.5); ctx.fillRect(r() * w, r() * h, 2, 4); }
});

/** Espresso-stained wood (Julian's bed, dresser). */
const darkWoodTex = () => TX('darkwood', 32, 64, (ctx, w, h) => {
  const r = rng(71);
  ctx.fillStyle = '#3a2219'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { const x = r() * w; ctx.fillStyle = r() < 0.5 ? 'rgba(20,10,6,0.4)' : 'rgba(90,56,40,0.25)'; ctx.fillRect(x, 0, 1, h); }
});

/** Leaded stained glass: rippled panes, a wheat sheaf in gold and green (kitchen uppers). */
const stainedTex = () => TX('stained', 48, 96, (ctx, w, h) => {
  const r = rng(81);
  ctx.fillStyle = '#7d8a88'; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(${r() < 0.5 ? '210,220,214' : '60,70,70'},${0.15 + r() * 0.2})`; ctx.fillRect(0, y, w, 1); }
  const wheat = (cx, cy, s) => {
    ctx.fillStyle = '#4a7a3a'; ctx.fillRect(cx, cy, 1, s); ctx.fillRect(cx - 4, cy + 6, 1, s - 6); ctx.fillRect(cx + 4, cy + 6, 1, s - 6);
    for (const dx of [-4, 0, 4]) for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? '#e0b040' : '#c88a20'; ctx.fillRect(cx + dx - 1, cy - 8 + k * 3 + Math.abs(dx) / 2, 3, 2); }
    ctx.fillStyle = '#78a848'; ctx.fillRect(cx - 3, cy + s - 8, 2, 4); ctx.fillRect(cx + 2, cy + s - 10, 2, 4);
  };
  wheat(24, 14, 22); wheat(24, 64, 22);
  ctx.fillStyle = '#2a2a24';
  ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2); ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h);
  ctx.fillRect(0, 44, w, 2); ctx.fillRect(0, 50, w, 2); ctx.fillRect(w / 2 - 1, 44, 2, 8);
});

/** White slatted blinds: 2.5 cm slats with see-through gaps and two ladder cords. */
const blindsTex = () => TX('blinds', 32, 32, (ctx, w, h) => {
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = '#efeee8'; ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = '#c8c6be'; ctx.fillRect(0, y + 2, w, 1);
  }
  ctx.fillStyle = 'rgba(220,214,200,0.9)'; ctx.fillRect(7, 0, 1, h); ctx.fillRect(24, 0, 1, h);
});

/** Cream duvet with navy stripes (stripes run across the bed). */
const stripeTex = () => TX('stripes', 64, 32, (ctx, w, h) => {
  const r = rng(91);
  ctx.fillStyle = '#e9e2d0'; ctx.fillRect(0, 0, w, h);
  for (let x = 4; x < w; x += 16) {
    ctx.fillStyle = '#3a3e52'; ctx.fillRect(x, 0, 2, h); ctx.fillRect(x + 4, 0, 1, h);
    for (let y = 0; y < h; y += 4) { ctx.fillStyle = '#2a2e40'; ctx.fillRect(x + 8, y, 1, 2); }
  }
  for (let i = 0; i < 120; i++) { ctx.fillStyle = 'rgba(120,110,90,0.12)'; ctx.fillRect(r() * w, r() * h, 2, 1); }
});

/** Grey-blue ticking (Lizzie's duvet). */
const tickingTex = () => TX('ticking', 32, 32, (ctx, w, h) => {
  ctx.fillStyle = '#9aa6b4'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) { ctx.fillStyle = '#7e8a9a'; ctx.fillRect(x, 0, 1, h); }
  for (let y = 0; y < h; y += 2) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, y, w, 1); }
});

/** Shaggy grey-beige rug. */
const shagTex = () => TX('shag', 64, 64, (ctx, w, h) => {
  const r = rng(101);
  ctx.fillStyle = '#8c8578'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { const v = (r() - 0.5) * 50; ctx.fillStyle = rgb(140 + v, 133 + v, 120 + v, 0.7); ctx.fillRect(r() * w, r() * h, 1, 2 + r() * 2); }
});

/** Grey loop carpet (bedroom). */
const carpetTex = () => TX('carpet', 32, 32, (ctx, w, h) => {
  const r = rng(111);
  ctx.fillStyle = '#7e7c7a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { const v = (r() - 0.5) * 30; ctx.fillStyle = rgb(126 + v, 124 + v, 122 + v); ctx.fillRect(r() * w, r() * h, 1, 1); }
});

/** Jute weave (attic rug). */
const juteTex = () => TX('jute', 32, 32, (ctx, w, h) => {
  const r = rng(121);
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const v = (r() - 0.5) * 24 + (((x + y) / 2) % 2 ? 10 : -10);
    ctx.fillStyle = rgb(176 + v, 150 + v, 104 + v); ctx.fillRect(x, y, 2, 2);
  }
});

/** Wool tartan throw. */
const plaidTex = (k = 0) => TX(`plaid-${k}`, 32, 32, (ctx, w, h) => {
  const base = k ? '#4a5a48' : '#c8b89a', band = k ? '#2a3428' : '#8a3a2a', thin = k ? '#c8b070' : '#3a2e28';
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.7; ctx.fillStyle = band; ctx.fillRect(0, 10, w, 6); ctx.fillRect(10, 0, 6, h);
  ctx.globalAlpha = 0.8; ctx.fillStyle = thin; ctx.fillRect(0, 24, w, 1); ctx.fillRect(24, 0, 1, h);
  ctx.globalAlpha = 1;
});

/** Patchwork quilt. */
const quiltTex = () => TX('quilt', 32, 32, (ctx, w, h) => {
  const r = rng(131);
  const cols = ['#b85a3a', '#e0c070', '#4a6a8a', '#7a9a5a', '#d8d0c0', '#8a3a4a', '#5a8a8a'];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.fillRect(i * 8, j * 8, 8, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(i * 8 + 2, j * 8 + 2, 2, 2);
  }
  ctx.fillStyle = 'rgba(40,30,20,0.35)'; for (let k = 0; k < 4; k++) { ctx.fillRect(k * 8, 0, 1, h); ctx.fillRect(0, k * 8, w, 1); }
});

/** Coir doormat. */
const coirTex = () => TX('coir', 32, 16, (ctx, w, h) => {
  const r = rng(141);
  for (let i = 0; i < 400; i++) { const v = (r() - 0.5) * 40; ctx.fillStyle = rgb(150 + v, 110 + v, 60 + v); ctx.fillRect(r() * w, r() * h, 1, 1); }
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, h - 1, w, 1); ctx.fillRect(0, 0, 1, h); ctx.fillRect(w - 1, 0, 1, h);
});

/** Pressed sheet of paper with typed lines. */
const paperTex = (k = 0) => TX(`paper-${k}`, 24, 32, (ctx, w, h) => {
  const r = rng(151 + k);
  ctx.fillStyle = k === 2 ? '#e8e0c8' : '#eeece6'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(40,40,50,0.55)';
  for (let y = 4; y < h - 3; y += 2) ctx.fillRect(3, y, 6 + r() * 14, 1);
  if (k === 1) { ctx.fillStyle = '#8a2a2a'; ctx.fillRect(3, 2, 10, 1); }
});

/** Small case photos (crime scene prints): forest, paw print in mud, a face, river, car, tape. */
const casePhotoTex = (k) => TX(`casephoto-${k}`, 24, 18, (ctx, w, h) => {
  const r = rng(161 + k);
  ctx.fillStyle = '#f2f0e8'; ctx.fillRect(0, 0, w, h);
  const x0 = 1, y0 = 1, iw = w - 2, ih = h - 2;
  const fill = (c, x, y, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(x0 + x, y0 + y, ww, hh); };
  if (k === 0) { fill('#8a949c', 0, 0, iw, ih); for (let i = 0; i < 9; i++) { const x = r() * iw; fill('#1e2a22', x, 3 + r() * 3, 2, ih - 4); fill('#2a3a2e', x - 2, 6 + r() * 3, 6, 4); } fill('#5a4a38', 0, ih - 3, iw, 3); }
  else if (k === 1) { fill('#5a4632', 0, 0, iw, ih); for (let i = 0; i < 30; i++) fill('#4a3a28', r() * iw, r() * ih, 2, 1); fill('#2a2016', 9, 7, 5, 6); for (const [a, b] of [[7, 3], [10, 2], [13, 3], [15, 5]]) fill('#2a2016', a, b, 2, 3); fill('#e8d84a', 1, ih - 3, 5, 2); }
  else if (k === 2) { fill('#6a6e74', 0, 0, iw, ih); fill('#c89a7a', 8, 3, 6, 7); fill('#2a2018', 7, 2, 8, 3); fill('#3a4a5a', 5, 10, 12, 6); }
  else if (k === 3) { fill('#9aa4ac', 0, 0, iw, 6); fill('#2a3a34', 0, 5, iw, 3); fill('#4a5a66', 0, 8, iw, 5); fill('#d8dee4', 0, 11, iw, 2); fill('#5a5040', 0, 13, iw, 3); }
  else if (k === 4) { fill('#3a3e44', 0, 0, iw, ih); fill('#6a2a24', 3, 7, 16, 5); fill('#8a9aa8', 6, 5, 9, 3); fill('#101010', 5, 11, 3, 3); fill('#101010', 14, 11, 3, 3); }
  else { fill('#4a5a4a', 0, 0, iw, ih); fill('#e8c820', 0, 6, iw, 2); for (let x = 0; x < iw; x += 4) fill('#202020', x, 6, 2, 2); fill('#8a7a6a', 6, 10, 8, 4); }
});

/** Julian and Lizzie: a snapshot by a lake, mountains behind, his arm round her shoulder. */
const familyPhotoTex = () => TX('family', 48, 36, (ctx, w, h) => {
  const f = (c, x, y, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  f('#9ab4c8', 0, 0, w, 14); f('#c8d4dc', 0, 8, w, 6);
  ctx.fillStyle = '#6a7a8a'; ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(10, 7); ctx.lineTo(18, 12); ctx.lineTo(28, 5); ctx.lineTo(40, 13); ctx.lineTo(48, 9); ctx.lineTo(48, 18); ctx.lineTo(0, 18); ctx.fill();
  f('#e8eef2', 27, 5, 3, 2); f('#e8eef2', 9, 7, 3, 2);
  f('#4a6a80', 0, 17, w, 5); f('#7a9ab0', 0, 18, w, 1);
  f('#8a7a4a', 0, 22, w, 14); f('#6a5a38', 0, 30, w, 6);
  // Julian: dark coat, red scarf, dark hair
  f('#2a2420', 15, 23, 8, 13); f('#1a1614', 16, 31, 2, 5); f('#1a1614', 20, 31, 2, 5);
  f('#c8962a', 0, 0, 0, 0);
  f('#d8a888', 17, 14, 5, 6); f('#2a1c14', 16, 13, 7, 3); f('#2a1c14', 16, 14, 1, 3);
  f('#b81c1c', 16, 20, 7, 3); f('#b81c1c', 21, 22, 2, 6);
  f('#5a2a1a', 18, 17, 1, 1); f('#5a2a1a', 20, 17, 1, 1); f('#8a4a3a', 19, 19, 2, 1);
  // Lizzie: teal parka, auburn hair, smaller
  f('#2a6a6a', 25, 26, 7, 10); f('#2a3a5a', 26, 33, 2, 3); f('#2a3a5a', 29, 33, 2, 3);
  f('#e0b498', 26, 19, 5, 6); f('#8a3e1e', 25, 18, 7, 3); f('#8a3e1e', 25, 20, 2, 7); f('#8a3e1e', 30, 20, 2, 6);
  f('#5a2a1a', 27, 22, 1, 1); f('#5a2a1a', 29, 22, 1, 1); f('#a85a4a', 28, 24, 2, 1);
  f('#2a2420', 22, 24, 5, 2);   // his arm round her shoulder
  ctx.fillStyle = 'rgba(255,240,200,0.12)'; ctx.fillRect(0, 0, w, h);
});

/** A pale print with a bare tree branch (living room). */
const treeArtTex = () => TX('treeart', 96, 56, (ctx, w, h) => {
  const r = rng(171);
  ctx.fillStyle = '#e4ddd0'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#4a4038'; ctx.lineCap = 'round';
  const br = (x, y, a, len, wd) => {
    if (len < 3) return;
    const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
    ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    br(x2, y2, a + 0.4 + (r() - 0.5) * 0.4, len * 0.7, wd * 0.65);
    br(x2, y2, a - 0.45 + (r() - 0.5) * 0.4, len * 0.68, wd * 0.65);
  };
  br(48, h, Math.PI / 2, 16, 4);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(200,190,170,0.4)'; ctx.fillRect(r() * w, r() * h, 2, 2); }
});

/** Kid's crayon drawings for the fridge (old ones, kept): house + sun, wolf + moon, two figures. */
const drawingTex = (k) => TX(`drawing-${k}`, 24, 30, (ctx, w, h) => {
  ctx.fillStyle = '#f4f0e4'; ctx.fillRect(0, 0, w, h);
  const f = (c, x, y, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  if (k === 0) { f('#f0c020', 16, 2, 5, 5); f('#c83a2a', 4, 12, 12, 2); f('#c83a2a', 6, 10, 8, 2); f('#3a6ac8', 5, 14, 10, 9); f('#f4f0e4', 8, 17, 3, 6); f('#3a9a3a', 0, 23, w, 3); }
  else if (k === 1) { f('#1a2a5a', 0, 0, w, 18); f('#f0f0c0', 16, 3, 4, 4); f('#4a4a4a', 4, 12, 10, 4); f('#4a4a4a', 12, 9, 4, 4); f('#4a4a4a', 4, 16, 2, 4); f('#4a4a4a', 11, 16, 2, 4); f('#3a9a3a', 0, 20, w, 4); }
  else { f('#2a2a2a', 5, 6, 4, 4); f('#2a2a2a', 6, 10, 2, 10); f('#c82a2a', 4, 10, 6, 2); f('#c87a3a', 14, 10, 4, 3); f('#2a8a8a', 15, 13, 2, 8); f('#e05a8a', 3, 24, 18, 2); f('#e05a8a', 9, 22, 6, 2); }
});

/** Cork board: photos, index cards, a map scrap, a clipping. Returns pin points in UV for the strings. */
const BOARD_ITEMS = [
  // [x, y, w, h, kind] in px on a 240×160 board
  [12, 12, 40, 30, 'p0'], [64, 8, 34, 26, 'p2'], [112, 14, 46, 34, 'map'], [172, 10, 52, 30, 'clip'],
  [16, 62, 36, 28, 'p1'], [70, 56, 30, 22, 'card'], [118, 66, 40, 30, 'p3'], [180, 58, 40, 30, 'p4'],
  [26, 110, 30, 22, 'card'], [80, 104, 36, 28, 'p5'], [140, 112, 28, 20, 'note'], [188, 108, 34, 26, 'p2'],
];
const boardTex = () => TX('caseboard', 240, 160, (ctx, w, h) => {
  const r = rng(181);
  ctx.fillStyle = '#b08458'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 3000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(90,60,30,0.5)' : 'rgba(210,170,120,0.4)'; ctx.fillRect(r() * w, r() * h, 1, 1); }
  for (const [x, y, iw, ih, kind] of BOARD_ITEMS) {
    ctx.save(); ctx.translate(x + iw / 2, y + ih / 2); ctx.rotate((r() - 0.5) * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-iw / 2 + 2, -ih / 2 + 2, iw, ih);
    if (kind[0] === 'p') { const img = casePhotoTex(+kind[1]).image; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih); }
    else if (kind === 'map') {
      ctx.fillStyle = '#d8d4b8'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
      ctx.strokeStyle = 'rgba(120,100,70,0.6)'; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(r() * 10 - 5, r() * 8 - 4, 6 + k * 4, 4 + k * 3, 0.3, 0, 7); ctx.stroke(); }
      ctx.strokeStyle = '#4a7aa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-iw / 2, 6); ctx.quadraticCurveTo(0, -8, iw / 2, -4); ctx.stroke(); ctx.lineWidth = 1;
      ctx.strokeStyle = '#c02020'; ctx.beginPath(); ctx.arc(6, 2, 5, 0, 7); ctx.stroke();
    } else if (kind === 'clip') {
      ctx.fillStyle = '#d8d2c0'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-iw / 2 + 3, -ih / 2 + 3, iw - 6, 4);
      ctx.fillStyle = 'rgba(40,40,40,0.5)'; for (let yy = -ih / 2 + 10; yy < ih / 2 - 2; yy += 2) ctx.fillRect(-iw / 2 + 3, yy, iw / 2 - 5, 1), ctx.fillRect(2, yy, iw / 2 - 5, 1);
    } else if (kind === 'card') {
      ctx.fillStyle = '#f2eee0'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih); ctx.fillStyle = '#c84a4a'; ctx.fillRect(-iw / 2, -ih / 2 + 4, iw, 1);
      ctx.fillStyle = 'rgba(30,40,90,0.7)'; for (let yy = -ih / 2 + 7; yy < ih / 2 - 2; yy += 3) ctx.fillRect(-iw / 2 + 2, yy, iw - 6 - r() * 8, 1);
    } else { ctx.fillStyle = '#f0d860'; ctx.fillRect(-iw / 2, -ih / 2, iw, ih); ctx.fillStyle = 'rgba(40,40,60,0.7)'; ctx.fillRect(-iw / 2 + 3, -4, iw - 6, 1); ctx.fillRect(-iw / 2 + 3, 0, iw - 10, 1); }
    ctx.restore();
  }
});

/** Butterfly chart (attic poster). */
const butterflyTex = () => TX('butterflies', 60, 84, (ctx, w, h) => {
  const r = rng(191);
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#4a3a2a'; ctx.fillRect(10, 4, 40, 2);
  const cols = [['#d8701a', '#1a1a1a'], ['#3a7ac8', '#1a2a4a'], ['#e8c830', '#2a2a2a'], ['#8a3a2a', '#e8d8a0'], ['#5a8a6a', '#2a3a2a'], ['#c84a6a', '#3a1a2a']];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) {
    const cx = 9 + i * 14, cy = 14 + j * 14, [a, b] = cols[Math.floor(r() * cols.length)], s = 4 + r() * 1.5;
    ctx.fillStyle = a;
    ctx.beginPath(); ctx.ellipse(cx - s * 0.7, cy - s * 0.4, s * 0.8, s * 0.6, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.7, cy - s * 0.4, s * 0.8, s * 0.6, 0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - s * 0.5, cy + s * 0.5, s * 0.5, s * 0.45, 0.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + s * 0.5, cy + s * 0.5, s * 0.5, s * 0.45, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = b; ctx.fillRect(cx - 0.5, cy - s * 0.6, 1, s * 1.4); ctx.fillRect(cx - s * 1.2, cy - s * 0.9, 2, 1); ctx.fillRect(cx + s * 0.9, cy - s * 0.9, 2, 1);
  }
});

/** Mushroom chart (attic poster, the reference's second print). */
const mushroomTex = () => TX('mushrooms', 56, 80, (ctx, w, h) => {
  const r = rng(201);
  ctx.fillStyle = '#ece4cc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#5a3a2a'; ctx.fillRect(8, 4, 40, 2);
  const caps = ['#b8502a', '#c89a5a', '#8a5a3a', '#d8c090', '#a83a2a', '#e8d8b8'];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) {
    const cx = 8 + i * 13, cy = 16 + j * 13;
    ctx.fillStyle = '#e8dcc4'; ctx.fillRect(cx - 1, cy, 3, 6);
    ctx.fillStyle = caps[Math.floor(r() * caps.length)];
    ctx.beginPath(); ctx.ellipse(cx, cy, 5, 3, 0, Math.PI, 0); ctx.fill();
    if (r() < 0.4) { ctx.fillStyle = '#f4eee0'; ctx.fillRect(cx - 2, cy - 2, 1, 1); ctx.fillRect(cx + 1, cy - 1, 1, 1); }
  }
});

/** A gig poster for an (invented) Whitehorse band. */
const bandTex = () => TX('band', 52, 72, (ctx, w, h) => {
  ctx.fillStyle = '#1a1e3a'; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(26, 30, 2, 26, 30, 18); g.addColorStop(0, '#f0a050'); g.addColorStop(1, 'rgba(200,60,90,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f0a050'; ctx.beginPath(); ctx.arc(26, 30, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#1a1e3a'; for (let y = 30; y < 40; y += 3) ctx.fillRect(14, y, 24, 1);
  ctx.fillStyle = '#2a3a2a'; ctx.beginPath(); ctx.moveTo(0, 46); for (let x = 0; x <= w; x += 4) ctx.lineTo(x, 40 + ((x * 7) % 9)); ctx.lineTo(w, 50); ctx.lineTo(0, 50); ctx.fill();
  ctx.fillStyle = '#f2e8d0'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('NORTHERN', 26, 10); ctx.fillText('STATIC', 26, 18);
  ctx.fillStyle = '#e06a8a'; ctx.font = '6px sans-serif'; ctx.fillText('LIVE · YUKON ARTS', 26, 60); ctx.fillText('NOV 22', 26, 67);
});

/** Map of the Yukon: territory outline, the river, lakes, Whitehorse, red marks. */
const YUKON_PINS = [[0.55, 0.78], [0.47, 0.7], [0.62, 0.66], [0.38, 0.52], [0.6, 0.84], [0.7, 0.74]];
const yukonTex = () => TX('yukon', 96, 72, (ctx, w, h) => {
  const r = rng(211);
  ctx.fillStyle = '#d8dccc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#a8c0c8'; ctx.fillRect(0, 0, 16, h);
  ctx.fillStyle = '#e8dcb0';
  ctx.beginPath(); ctx.moveTo(16, 4); ctx.lineTo(40, 2); ctx.lineTo(50, 8); ctx.lineTo(58, 16); ctx.lineTo(66, 26); ctx.lineTo(70, 36); ctx.lineTo(80, 44); ctx.lineTo(84, 56); ctx.lineTo(88, 66); ctx.lineTo(16, 66); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7a6a4a'; ctx.stroke();
  for (let i = 0; i < 160; i++) { ctx.fillStyle = 'rgba(120,130,90,0.3)'; ctx.fillRect(18 + r() * 60, 6 + r() * 58, 2, 1); }
  ctx.strokeStyle = '#3a6ab0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(56, 64); ctx.quadraticCurveTo(50, 48, 40, 40); ctx.quadraticCurveTo(30, 30, 18, 22); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(40, 40); ctx.lineTo(60, 30); ctx.stroke();
  ctx.fillStyle = '#5a8ac0'; ctx.fillRect(50, 58, 4, 6); ctx.fillRect(60, 60, 3, 5);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(52, 55, 2, 2);
  ctx.font = '5px sans-serif'; ctx.fillText('Whitehorse', 36, 54);
  ctx.font = 'bold 7px sans-serif'; ctx.fillText('YUKON', 34, 20);
  ctx.strokeStyle = '#c02020'; for (const [u, v] of YUKON_PINS) { ctx.beginPath(); ctx.arc(u * w, v * h, 3, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(YUKON_PINS[0][0] * w, YUKON_PINS[0][1] * h); for (const [u, v] of YUKON_PINS.slice(1, 4)) ctx.lineTo(u * w, v * h); ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#8a7a5a'; ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
});

/** Polaroids for the mirror frame. */
const polaroidTex = (k) => TX(`polaroid-${k}`, 12, 14, (ctx, w, h) => {
  const cols = [['#8ab0d0', '#3a5a3a'], ['#e0a070', '#5a3a2a'], ['#2a2a3a', '#e0c070'], ['#b0c8b0', '#c86a8a']][k % 4];
  ctx.fillStyle = '#f2f0ea'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = cols[0]; ctx.fillRect(1, 1, 10, 9);
  ctx.fillStyle = cols[1]; ctx.fillRect(1, 6, 10, 4); ctx.fillRect(4 + k, 3, 3, 4);
});

/** Laptop screen: a case file open, a thumbnail of the forest. */
const laptopTex = () => TX('laptop', 48, 30, (ctx, w, h) => {
  ctx.fillStyle = '#1a2230'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#2a3a50'; ctx.fillRect(0, 0, w, 3);
  ctx.fillStyle = '#d8dce4'; ctx.fillRect(3, 6, 24, 20);
  ctx.fillStyle = 'rgba(40,40,60,0.6)'; for (let y = 8; y < 25; y += 2) ctx.fillRect(5, y, 8 + ((y * 7) % 12), 1);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(casePhotoTex(0).image, 30, 6, 15, 11); ctx.drawImage(casePhotoTex(1).image, 30, 18, 15, 11);
});

/** Book spines (for shelves, batched per-colour boxes take care of the rest). */
const BOOK_COLS = [0x7a2a24, 0x2a4a5a, 0xc8a050, 0x3a5a3a, 0xd8d0c0, 0x5a3a5a, 0x2a2a30, 0x9a5a2a, 0x4a6a8a];

/** Palm frond / pothos leaves with alpha. */
const leafTex = (kind) => TX(`leaf-${kind}`, 64, 96, (ctx, w, h) => {
  const r = rng(kind === 'palm' ? 221 : 231);
  if (kind === 'palm') {
    ctx.strokeStyle = '#3a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, h); ctx.quadraticCurveTo(30, 40, 34, 2); ctx.stroke();
    for (let y = 8; y < h - 8; y += 3) {
      const t = y / h, len = 24 * Math.sin(Math.PI * Math.min(1, (1 - t) * 1.2)) + 4;
      for (const s of [-1, 1]) {
        ctx.strokeStyle = r() < 0.5 ? '#4a7a34' : '#5a8a3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(32 + (1 - t) * 2, y); ctx.lineTo(32 + s * len, y + 10 + len * 0.3); ctx.stroke();
      }
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const x = 10 + r() * 44, y = 8 + i * 9 + r() * 4, s = 7 + r() * 4;
      ctx.fillStyle = r() < 0.5 ? '#4a8a3a' : '#6a9a3a';
      ctx.beginPath(); ctx.moveTo(x, y + s); ctx.bezierCurveTo(x - s, y + s * 0.3, x - s * 0.6, y - s * 0.6, x, y - s * 0.2); ctx.bezierCurveTo(x + s * 0.6, y - s * 0.6, x + s, y + s * 0.3, x, y + s); ctx.fill();
      ctx.fillStyle = 'rgba(230,230,150,0.4)'; ctx.fillRect(x - 1, y, 2, s * 0.6);
    }
    ctx.strokeStyle = '#3a5a2a'; ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(20, 30, 44, 60, 30, h); ctx.stroke();
  }
}, { nearest: false });

/** Mirror: a soft painted reflection of a warm room (no env map in this renderer). */
const mirrorTex = () => TX('mirror', 32, 48, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#6a6460'); g.addColorStop(0.5, '#4a4440'); g.addColorStop(1, '#2a2624');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,220,170,0.25)'; ctx.fillRect(4, 8, 10, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = 0; i < 6; i++) ctx.fillRect(18 + i, 4 + i * 2, 2, 30);
}, { nearest: false });

// ------------------------------------------------------------------ the view out of the windows

/**
 * Whitehorse from a residential street in November: grey hills with snow on the tops, a spruce
 * belt, wood-sided houses with pitched roofs and a dusting of snow, street lamps, a pickup.
 * 'low' — the living room (across the street), 'high' — the attic (over the roofs).
 */
function aptView(time, variant = 'low') {
  return canvasTexture(`apt-view-${variant}-${time}`, 768, 512, (ctx, w, h) => {
    const r = rng(variant === 'high' ? 77 : 41);
    const day = time === 'day', eve = time === 'evening';
    const pick = (d, e, n) => (day ? d : eve ? e : n);
    const high = variant === 'high';
    const hz = h * (high ? 0.44 : 0.36);
    // sky
    const sk = ctx.createLinearGradient(0, 0, 0, hz + 40);
    if (day) { sk.addColorStop(0, '#7c8794'); sk.addColorStop(0.6, '#a6afb8'); sk.addColorStop(1, '#bcc3c8'); }
    else if (eve) { sk.addColorStop(0, '#0a1226'); sk.addColorStop(0.55, '#1c2b4c'); sk.addColorStop(1, '#3c4668'); }
    else { sk.addColorStop(0, '#02040a'); sk.addColorStop(0.6, '#070d1a'); sk.addColorStop(1, '#0e1628'); }
    ctx.fillStyle = sk; ctx.fillRect(0, 0, w, h);
    if (!day) for (let i = 0; i < (eve ? 12 : 40); i++) { ctx.fillStyle = `rgba(220,230,255,${0.3 + r() * 0.5})`; ctx.fillRect(r() * w, r() * hz * 0.6, 2, 2); }
    if (time === 'night') { const m = ctx.createRadialGradient(600, 70, 2, 600, 70, 60); m.addColorStop(0, 'rgba(230,236,255,0.9)'); m.addColorStop(0.2, 'rgba(160,180,220,0.3)'); m.addColorStop(1, 'rgba(60,80,120,0)'); ctx.fillStyle = m; ctx.fillRect(520, 0, 160, 150); ctx.fillStyle = '#e4e8f0'; ctx.beginPath(); ctx.arc(600, 70, 11, 0, 7); ctx.fill(); }
    if (eve) { const gl = ctx.createLinearGradient(0, hz - 40, 0, hz + 30); gl.addColorStop(0, 'rgba(140,110,120,0)'); gl.addColorStop(1, 'rgba(150,110,110,0.35)'); ctx.fillStyle = gl; ctx.fillRect(0, hz - 40, w, 70); }
    // hills: two ranges, snow on the higher tops only (November)
    for (let k = 0; k < 2; k++) {
      const ridge = [];
      for (let x = 0; x <= w; x += 4) ridge.push(hz - (k ? 50 : 110) + Math.sin(x * 0.006 + k * 2.1) * (k ? 22 : 46) + Math.sin(x * 0.019 + k) * 12 + Math.sin(x * 0.05) * 4);
      ctx.fillStyle = pick(['#8892a0', '#6c7682'][k], ['#1d2844', '#151e36'][k], ['#0b1220', '#080e1a'][k]);
      ctx.beginPath(); ctx.moveTo(0, h); ridge.forEach((y, i) => ctx.lineTo(i * 4, y)); ctx.lineTo(w, h); ctx.fill();
      if (k === 0) {
        const top = Math.min(...ridge);
        ctx.fillStyle = pick('#d4d9de', '#4a5878', '#24304a');
        ridge.forEach((y, i) => { const d = (top + 44 - y) * 0.7 + Math.sin(i * 1.7) * 6; if (d > 2) ctx.fillRect(i * 4, y, 4, d); });
      }
    }
    // spruce belt
    const spruce = (x, y, s, c) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y - s);
      for (let k = 1; k <= 6; k++) { const yy = y - s + (s * k) / 6, ww = s * (0.05 + 0.2 * k / 6); ctx.lineTo(x + ww, yy); ctx.lineTo(x + ww * 0.4, yy - s * 0.02); }
      for (let k = 6; k >= 1; k--) { const yy = y - s + (s * k) / 6, ww = s * (0.05 + 0.2 * k / 6); ctx.lineTo(x - ww * 0.4, yy - s * 0.02); ctx.lineTo(x - ww, yy); }
      ctx.fill();
    };
    const belt = hz + (high ? 20 : 10);
    ctx.fillStyle = pick('#4a5450', '#0e1420', '#05080e'); ctx.fillRect(0, belt - 8, w, h);
    for (let i = 0; i < 110; i++) spruce(r() * w, belt + r() * 10, 30 + r() * 30, pick(r() < 0.5 ? '#3a4640' : '#46524a', '#0a101a', '#04070c'));
    // houses across the street
    const groundY = high ? h * 0.78 : h * 0.72;
    ctx.fillStyle = pick('#6e6656', '#16181e', '#0a0c10'); ctx.fillRect(0, groundY - 40, w, h);
    const sidings = [[138, 74, 58], [90, 106, 120], [176, 150, 90], [95, 112, 90], [200, 192, 176], [120, 60, 50]];
    const k0 = pick(1, 0.28, 0.12);
    const lamps = [];
    let hx = -40 + r() * 30;
    while (hx < w) {
      const bw = 120 + r() * 70, wh = 70 + r() * 30, rh = 34 + r() * 20, y = groundY - 10 + r() * 8;
      const c = sidings[Math.floor(r() * sidings.length)];
      const tint = (v, i) => v * k0 + (day ? 0 : [10, 14, 28][i]);
      ctx.fillStyle = rgb(tint(c[0], 0), tint(c[1], 1), tint(c[2], 2)); ctx.fillRect(hx, y - wh, bw, wh);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let yy = y - wh; yy < y; yy += 5) ctx.fillRect(hx, yy, bw, 1);
      ctx.fillStyle = pick('#3a3a40', '#0e1018', '#06080c');
      ctx.beginPath(); ctx.moveTo(hx - 8, y - wh); ctx.lineTo(hx + bw / 2, y - wh - rh); ctx.lineTo(hx + bw + 8, y - wh); ctx.fill();
      ctx.fillStyle = pick('rgba(226,230,234,0.75)', 'rgba(90,104,140,0.6)', 'rgba(50,62,90,0.6)');
      for (let k = 0; k < 14; k++) { const t = r(), side = r() < 0.5 ? -1 : 1; const px = hx + bw / 2 + side * t * (bw / 2 + 6), py = y - wh - rh * (1 - t); ctx.fillRect(px - 6, py, 10 + r() * 8, 3); }
      ctx.fillStyle = pick('#4a3a34', '#120e10', '#08080a'); ctx.fillRect(hx + bw * 0.7, y - wh - rh * 0.8, 10, rh * 0.6);
      for (let k = 0; k < 3; k++) {
        const wx = hx + 14 + k * (bw - 40) / 2, wy = y - wh + 18;
        const lit = eve ? r() < 0.75 : time === 'night' ? r() < 0.22 : false;
        ctx.fillStyle = pick('#e4e6e2', '#2a2e38', '#1a1c22'); ctx.fillRect(wx - 2, wy - 2, 24, 26);
        ctx.fillStyle = lit ? (r() < 0.7 ? '#ffc878' : '#ffe2a8') : pick('#4a5868', '#141a28', '#0c1018');
        ctx.fillRect(wx, wy, 20, 22);
        if (lit) { const gg = ctx.createRadialGradient(wx + 10, wy + 11, 2, wx + 10, wy + 11, 30); gg.addColorStop(0, 'rgba(255,190,110,0.35)'); gg.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = gg; ctx.fillRect(wx - 20, wy - 20, 60, 62); }
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(wx + 9, wy, 2, 22);
      }
      ctx.fillStyle = pick('#5a4030', '#120c0a', '#080606'); ctx.fillRect(hx + bw - 34, y - 46, 18, 46);
      lamps.push(hx + bw + 12);
      hx += bw + 30 + r() * 30;
    }
    // bare birches, the street, sidewalk, a pickup, lamp posts
    for (let i = 0; i < 6; i++) {
      const tx = r() * w, ty = groundY + 4, s = 90 + r() * 50;
      ctx.strokeStyle = pick('#c8c4bc', '#2a2c34', '#14161c'); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - s); ctx.stroke();
      ctx.strokeStyle = pick('#5a4a40', '#181a20', '#0c0e12'); ctx.lineWidth = 1;
      for (let k = 0; k < 14; k++) { const by = ty - s * (0.4 + r() * 0.6), a = (r() - 0.5) * 1.6; ctx.beginPath(); ctx.moveTo(tx, by); ctx.lineTo(tx + Math.sin(a) * 30, by - Math.cos(a) * 26); ctx.stroke(); }
    }
    ctx.fillStyle = pick('#8a8a86', '#24262c', '#121418'); ctx.fillRect(0, groundY + 6, w, 8);
    ctx.fillStyle = pick('#4e5054', '#141820', '#0a0c10'); ctx.fillRect(0, groundY + 14, w, h);
    ctx.fillStyle = pick('rgba(220,224,228,0.6)', 'rgba(80,90,120,0.5)', 'rgba(50,60,80,0.5)'); for (let i = 0; i < 50; i++) ctx.fillRect(r() * w, groundY + 4 + r() * 6, 6 + r() * 14, 2);
    const px = 420, py = groundY + 40;
    ctx.fillStyle = pick('#6a2a22', '#1e1418', '#0e0a0c'); ctx.fillRect(px, py - 26, 130, 26); ctx.fillRect(px + 10, py - 46, 56, 22);
    ctx.fillStyle = pick('#8a9aa8', '#1a2230', '#0c1018'); ctx.fillRect(px + 16, py - 42, 44, 14);
    ctx.fillStyle = '#0a0a0c'; ctx.fillRect(px + 14, py - 6, 24, 14); ctx.fillRect(px + 94, py - 6, 24, 14);
    for (const lx of lamps.filter((_, i) => i % 2 === 0)) {
      ctx.fillStyle = pick('#3a3c40', '#0c0e12', '#06070a'); ctx.fillRect(lx, groundY - 120, 4, 134); ctx.fillRect(lx - 14, groundY - 120, 18, 4);
      if (!day) {
        const gg = ctx.createRadialGradient(lx - 10, groundY - 114, 1, lx - 10, groundY - 114, 60); gg.addColorStop(0, 'rgba(255,200,120,0.95)'); gg.addColorStop(0.15, 'rgba(255,160,80,0.4)'); gg.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = gg; ctx.fillRect(lx - 80, groundY - 180, 140, 140);
        const pool = ctx.createRadialGradient(lx - 10, groundY + 30, 2, lx - 10, groundY + 30, 70); pool.addColorStop(0, 'rgba(255,170,90,0.35)'); pool.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = pool; ctx.fillRect(lx - 90, groundY - 10, 160, 90);
      }
    }
    pixelate(ctx, w, h, 3);
  }, { nearest: true, aniso: 1 });
}

// ------------------------------------------------------------------ geometry helpers

const geoCache = new Map();
const cached = (key, make) => { let g = geoCache.get(key); if (!g) { g = make(); geoCache.set(key, g); } return g.clone(); };

/** A soft cushion: a rounded box whose faces bulge out, with a little lumpy noise. */
function cushionGeo(w, h, d, r, puff = 0.3, seed = 1, lump = 0.006) {
  return cached(`cush|${w}|${h}|${d}|${r}|${puff}|${seed}|${lump}`, () => {
    const g = roundedBox(w, h, d, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002), 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const nx = Math.min(1, Math.abs(x) / (w / 2)), ny = Math.min(1, Math.abs(y) / (h / 2)), nz = Math.min(1, Math.abs(z) / (d / 2));
      y += Math.sign(y) * h * puff * 0.5 * (1 - nx * nx) * (1 - nz * nz) * ny;
      z += Math.sign(z) * d * puff * 0.2 * (1 - nx * nx) * (1 - ny * ny) * nz;
      x += Math.sign(x) * w * puff * 0.1 * (1 - ny * ny) * (1 - nz * nz) * nx;
      const n = (noise3(x * 11, y * 11, z * 11, seed) - 0.5) * lump * 2;
      p.setXYZ(i, x + Math.sign(x) * n * nx, y + Math.sign(y) * n * ny, z + Math.sign(z) * n * nz);
    }
    return smoothNormals(g);
  });
}

/**
 * Fabric over a box top (L along x, W along z, top at y = 0), hanging `drop` down the sides
 * flagged in `sides` [-x, +x, -z, +z]: rounded fold over the edge, wrinkles on top, vertical
 * folds and a slight flare where it hangs.
 */
function drapeGeo(L, W, drop, o = {}) {
  const { sides = [1, 1, 1, 1], r = 0.04, seed = 1, wrinkle = 0.01, seg = [40, 24], uv = [0.5, 0.5], flare = 0.025, folds = 0.012 } = o;
  const S0 = -L / 2 - sides[0] * drop, S1 = L / 2 + sides[1] * drop, T0 = -W / 2 - sides[2] * drop, T1 = W / 2 + sides[3] * drop;
  const [nx, nz] = seg;
  const fold = (s, half) => {
    const a = Math.abs(s), sg = Math.sign(s) || 1;
    if (a <= half) return [s, 0, 0];
    const e = a - half, arc = (r * Math.PI) / 2;
    if (e < arc) { const ang = e / r; return [sg * (half + r * Math.sin(ang)), -r * (1 - Math.cos(ang)), 0]; }
    return [sg * (half + r), -r - (e - arc), e - arc];
  };
  const pos = [], uvs = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const s = S0 + ((S1 - S0) * i) / nx, t = T0 + ((T1 - T0) * j) / nz;
    const [x, hx, ex] = fold(s, L / 2), [z, hz, ez] = fold(t, W / 2);
    let X = x, Y = Math.max(hx + hz, -(drop + r + 0.04)), Z = z;
    const n = noise3(s * 5, t * 5, 0.5, seed) - 0.5;
    if (ex <= 0 && ez <= 0) Y += n * wrinkle * 2 + (noise3(s * 13, t * 13, 3.1, seed) - 0.5) * wrinkle;
    else {
      const hang = Math.max(ex, ez), k = Math.min(1, hang / 0.08);
      const f = Math.sin((ex > 0 ? t : s) * 24 + n * 5) * folds * k + flare * (hang / Math.max(drop, 0.01));
      if (ex > 0) X += Math.sign(x) * f;
      if (ez > 0) Z += Math.sign(z) * f;
    }
    pos.push(X, Y, Z);
    uvs.push(s / uv[0], t / uv[1]);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Wall panel (x from -w/2…w/2, y 0…h, z = 0) with rectangular holes, world-ish UVs (2 m). */
function holeWallGeo(w, h, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
  for (const o of holes) { const p = new THREE.Path(); p.moveTo(o.x0, o.y0); p.lineTo(o.x0, o.y1); p.lineTo(o.x1, o.y1); p.lineTo(o.x1, o.y0); p.lineTo(o.x0, o.y0); s.holes.push(p); }
  const g = new THREE.ShapeGeometry(s);
  return g;
}

function worldUV(geo, su, sv) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  if (!uv || !n) return;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / su, z / sv);
    else if (ax >= az) uv.setXY(i, z / su, y / sv);
    else uv.setXY(i, x / su, y / sv);
  }
}

function rodGeo(a, b, r, seg = 12, r2 = r) {
  const A = V3(...a), B = V3(...b);
  const geo = new THREE.CylinderGeometry(r2, r, A.distanceTo(B), seg, 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize()));
  const m = A.add(B).multiplyScalar(0.5);
  geo.translate(m.x, m.y, m.z);
  return geo;
}

function mergeGeos(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    pos.set(p.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.userData.normalsOk = false;
  return out;
}

// ------------------------------------------------------------------ shared kit

const AMBIENT = {
  evening: { sky: 0x58586c, ground: 0x2a2018, hemi: 0.62, fill: 0xffd2a0, fillI: 0.28, bg: 0x0a0a12 },
  night: { sky: 0x2a3654, ground: 0x0c0a0a, hemi: 0.38, fill: 0x8aa4d8, fillI: 0.3, bg: 0x04060a },
  day: { sky: 0xdce2ea, ground: 0x8a7a66, hemi: 1.0, fill: 0xe8eef4, fillI: 0.55, bg: 0x6a7078 },
};

/** Roman shade fabric: oatmeal linen weave with small sprigs in the shade's colour. */
function romanTex(color) {
  const c = new THREE.Color(color);
  const tint = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
  return canvasTexture(`apt-roman-${color}`, 128, 128, (ctx, w, h) => {
    const r = rng(733);
    ctx.fillStyle = '#e6dcc8'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { ctx.fillStyle = `rgba(150,130,100,${0.06 + r() * 0.06})`; ctx.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { ctx.fillStyle = `rgba(255,250,240,${0.04 + r() * 0.05})`; ctx.fillRect(x, 0, 1, h); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const x = i * 32 + (j % 2) * 16 + 8, y = j * 32 + 10;
      ctx.strokeStyle = tint; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.quadraticCurveTo(x + 1, y + 5, x + 2, y); ctx.stroke();
      ctx.fillStyle = tint;
      for (const [dx, dy, a] of [[-3, 4, -0.6], [4, 6, 0.6], [-2, 9, -0.5], [3, 1, 0.5]]) { ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 2.6, 1.2, a, 0, 7); ctx.fill(); }
    }
  }, { repeat: [2, 2] });
}

class AptBase extends LocationBase {
  constructor(opts) {
    super(opts);
    this._batches = new Map();
    this.T = null;
    this.lamps = [];
    this.views = [];
    this.stateFx = [];
    this.flames = [];
    this.doors = [];
    this.spots = {};
    this.windowLights = [];
    this.background = AMBIENT.evening.bg;
  }

  // ---------------------------------------------------------------- batching

  _add(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    if (o.sx || o.sy || o.sz) geo.scale(o.sx || 1, o.sy || 1, o.sz || 1);
    if (o.rx || o.ry || o.rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ')));
    geo.translate(x, y, z);
    if (this.T) geo.applyMatrix4(this.T);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (o.uv) worldUV(geo, o.uv[0], o.uv[1]);
    let list = this._batches.get(mat);
    if (!list) this._batches.set(mat, (list = []));
    list.push(geo);
    return geo;
  }
  /** Run `fn` with a local frame: origin (x, y, z), turned by ry. */
  withT(x, z, ry, fn, y = 0) {
    const prev = this.T;
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    this.T = prev ? prev.clone().multiply(m) : m;
    fn();
    this.T = prev;
  }
  /** Local → world point under the current frame. */
  P(x, y, z) { const v = V3(x, y, z); if (this.T) v.applyMatrix4(this.T); return v; }
  bx(w, h, d, mat, x, y, z, o) { return this._add(bevelBox(w, h, d), mat, x, y, z, o); }
  rb(w, h, d, r, mat, x, y, z, o = {}) { return this._add(cached(`rb|${w}|${h}|${d}|${r}|${o.seg || 2}`, () => roundedBox(w, h, d, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001), o.seg || 2)), mat, x, y, z, o); }
  cush(w, h, d, r, mat, x, y, z, o = {}) { return this._add(cushionGeo(w, h, d, r, o.puff ?? 0.3, o.seed ?? 1, o.lump ?? 0.006), mat, x, y, z, o); }
  pl(w, h, mat, x, y, z, o) { return this._add(new THREE.PlaneGeometry(w, h), mat, x, y, z, o); }
  cy(rt, rb, h, mat, x, y, z, o = {}) { return this._add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), mat, x, y, z, o); }
  sph(r, mat, x, y, z, o = {}) { return this._add(new THREE.SphereGeometry(r, o.ws || 16, o.hs || 12), mat, x, y, z, o); }
  lathe(pts, mat, x, y, z, o = {}) {
    const p = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts;
    return this._add(new THREE.LatheGeometry(p.map(([r, py]) => new THREE.Vector2(Math.max(0.0008, r), py)), o.seg || 24), mat, x, y, z, o);
  }
  rod(a, b, r, mat, o = {}) { return this._add(rodGeo(a, b, r, o.seg || (r < 0.012 ? 8 : 14), o.r2 ?? r), mat, 0, 0, 0, o); }
  tube(pts, r, mat, o = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), !!o.closed, 'catmullrom', o.tension ?? 0.4);
    return this._add(new THREE.TubeGeometry(curve, o.seg || Math.max(12, pts.length * 8), r, o.rs || 8, !!o.closed), mat, 0, 0, 0, o);
  }
  torus(R, r, mat, x, y, z, o = {}) { return this._add(new THREE.TorusGeometry(R, r, o.rs || 8, o.ts || 28, o.arc || Math.PI * 2), mat, x, y, z, o); }
  drape(L, W, drop, mat, x, y, z, o = {}) { return this._add(drapeGeo(L, W, drop, o), mat, x, y, z, o); }
  flushBatches() {
    for (const [mat, list] of this._batches) {
      const mesh = new THREE.Mesh(mergeGeos(list), mat);
      if (mat.transparent) mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.root.add(mesh);
    }
    this._batches.clear();
  }

  // ---------------------------------------------------------------- materials

  M(key, color, o = {}) { return this.mat(`apt-${key}`, { color, roughness: 0.75, metalness: 0, ...o }); }
  texM(key, map, o = {}) { return this.mat(`aptT-${key}`, { map, color: 0xffffff, roughness: 0.8, metalness: 0, ...o }); }
  /** A material that can glow (a lamp shade, a bulb) — its emissive is switched by a lamp. */
  glowM(key, color, emissive, o = {}) { return this.mat(`aptG-${key}`, { color, emissive, emissiveIntensity: 0, roughness: 0.8, ...o }); }
  glass() { return this.mat('apt-glass', { color: 0xc8d4dc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false }); }
  brass() { return this.M('brass', 0xb08840, { roughness: 0.32, metalness: 0.85, emissive: 0x1a1004 }); }
  white() { return this.M('trimWhite', 0xece8e0, { roughness: 0.55 }); }

  // ---------------------------------------------------------------- lights and states

  /**
   * A switchable lamp. `on` = level per state; `glows` = additive sprites; `mats` =
   * [material, emissiveIntensity when fully on]. Returns the lamp record.
   */
  lamp(id, { light = null, glows = [], mats = [], on = { evening: 1, night: 0, day: 0 }, flare = null } = {}) {
    if (light) this.root.add(light);
    for (const s of glows) if (!s.parent) this.root.add(s);
    const L = { id, light, base: light ? light.intensity : 0, glows: glows.map((s) => ({ s, sc: s.scale.clone() })), mats, on, level: 0, forced: null };
    this.lamps.push(L);
    if (flare) this.windowLights.push(flareSource('LAMP', flare.pos, { triggerDistance: 2.2, intensity: 0.5, flareSize: 0.55, ...flare.opts, enabled: () => L.level > 0.3 }));
    return L;
  }
  applyLamp(L, level) {
    L.level = level;
    if (L.light) L.light.intensity = L.base * level;
    for (const { s, sc } of L.glows) { s.visible = level > 0.01; s.scale.copy(sc).multiplyScalar(0.55 + 0.45 * Math.sqrt(level)); }
    for (const [m, k] of L.mats) m.emissiveIntensity = k * level;
  }
  /** Story hook: force a lamp on/off (level 0…1), null gives it back to the state. */
  setLamp(id, level) {
    const L = this.lamps.find((l) => l.id === id);
    if (!L) return;
    L.forced = level;
    this.applyLamp(L, level ?? L.on[this.state] ?? 0);
  }
  pointLight(color, intensity, distance, x, y, z, decay = 1.3) {
    const l = new THREE.PointLight(color, intensity, distance, decay);
    l.position.set(x, y, z);
    return l;
  }
  halo(color, size, op, x, y, z) { const s = glow(color, size, op); s.position.set(x, y, z); return s; }
  /** Soft additive pool on the floor (or rotated onto a wall), shown in the listed states. */
  statePool(color, x, y, z, w, d, op, states, rot = null) {
    const p = lightPool(color, w, d, op);
    if (rot) p.rotation.copy(rot); else p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    this.root.add(p);
    this.stateFx.push((s) => { p.visible = states.includes(s); });
    return p;
  }
  /** A window view plane at z, tinted per state (never brighter than #E4DCCC). */
  viewPlane(w, h, x, y, z, variant = 'low', ry = 0) {
    const mat = new THREE.MeshBasicMaterial({ map: aptView('evening', variant), color: 0xffffff });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    this.root.add(m);
    this.views.push({ mat, variant });
    return m;
  }
  setupLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.3);
    this.fill.position.set(-2, 4, 6);
    this.root.add(this.hemi, this.fill);
    this.lights = { hemi: this.hemi, fill: this.fill };
  }
  setState(name) {
    if (!AMBIENT[name]) name = 'evening';
    this.state = name;
    const A = { ...AMBIENT[name], ...(this.ambientOverride?.[name] || {}) };
    this.hemi.color.setHex(A.sky); this.hemi.groundColor.setHex(A.ground); this.hemi.intensity = A.hemi;
    this.fill.color.setHex(A.fill); this.fill.intensity = A.fillI;
    this.background = A.bg;
    for (const L of this.lamps) this.applyLamp(L, L.forced ?? L.on[name] ?? 0);
    const tint = { day: 0xd8d6d0, evening: 0xffffff, night: 0xd0d4dc }[name];
    for (const v of this.views) { v.mat.map = aptView(name, v.variant); v.mat.color.setHex(tint); v.mat.needsUpdate = true; }
    for (const f of this.stateFx) f(name);
  }

  update(dt) {
    super.update(dt);
    const t = this.time;
    for (const f of this.flames) {
      const k = 0.85 + Math.sin(t * 9 + f.ph) * 0.06 + Math.sin(t * 23 + f.ph * 2) * 0.05;
      f.flame.scale.set(1, k, 1);
      if (f.halo.visible) f.halo.scale.setScalar(f.size * k);
    }
  }

  // ---------------------------------------------------------------- room shell

  /** Floor rectangle with world UVs (texture covering `tile` metres). */
  floorRect(x0, x1, z0, z1, mat, tile = 1.28, y = 0) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    worldUV(g, tile, tile);
    const m = new THREE.Mesh(g, mat);
    this.root.add(m);
    return m;
  }
  /** Ceiling (facing down) from a polygon in xz, with optional holes. */
  ceilingPoly(pts, y, mat, holes = []) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
    const g = new THREE.ShapeGeometry(s);
    g.rotateX(Math.PI / 2);   // shape y → world z, facing down
    g.translate(0, y, 0);
    const m = new THREE.Mesh(g, mat);
    this.root.add(m);
    return m;
  }
  /** Side wall at x facing +x (dir 1) or -x (dir -1), from z0 to z1. */
  sideWall(x, z0, z1, h, mat, dir) {
    const g = new THREE.PlaneGeometry(z1 - z0, h);
    const m = new THREE.Mesh(g, mat);
    m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(x, h / 2, (z0 + z1) / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (z1 - z0) / 2, uv.getY(i) * h / 2);
    this.root.add(m);
    return m;
  }
  /** Skirting + crown moulding along the back wall between spans. */
  trims(spans, z, H, { skirt = true, crown = true } = {}) {
    const w = this.white();
    for (const [a, b] of spans) {
      if (b - a < 0.05) continue;
      if (skirt) this.rb(b - a, 0.11, 0.025, 0.008, w, (a + b) / 2, 0.055, z + 0.013);
      if (crown) { this.rb(b - a, 0.07, 0.05, 0.015, w, (a + b) / 2, H - 0.035, z + 0.025); this.rb(b - a, 0.025, 0.08, 0.01, w, (a + b) / 2, H - 0.075, z + 0.02); }
    }
  }

  /**
   * A window built in the local frame: opening x -w/2…w/2, y y0…y1 in a wall at z = 0 (room
   * on +z). White casing, deep reveals, sashes, glass, sill. kind: 'double' (sash window with
   * muntins), 'plain'. Blinds: { kind: 'slats' | 'roman' | 'cell', cover }.
   */
  windowUnit(w, y0, y1, { depth = 0.16, kind = 'double', blind = null, muntins = [2, 2], frameColor = null } = {}) {
    const wm = frameColor ? this.M(`frame-${frameColor}`, frameColor, { roughness: 0.5 }) : this.white();
    const h = y1 - y0, cy = (y0 + y1) / 2;
    // casing
    this.rb(w + 0.16, 0.08, 0.03, 0.01, wm, 0, y1 + 0.04, 0.015);
    for (const s of [-1, 1]) this.rb(0.08, h + 0.04, 0.03, 0.01, wm, s * (w / 2 + 0.04), cy, 0.015);
    // reveals
    const rev = this.M('reveal', 0xdcd6cc, { roughness: 0.8 });
    this.pl(w, depth, rev, 0, y1, -depth / 2, { rx: Math.PI / 2 });
    for (const s of [-1, 1]) this.pl(depth, h, rev, s * w / 2, cy, -depth / 2, { ry: -s * Math.PI / 2 });
    // sill + apron
    this.rb(w + 0.2, 0.035, depth + 0.1, 0.012, wm, 0, y0 - 0.017, -depth / 2 + 0.05);
    this.rb(w + 0.1, 0.06, 0.02, 0.008, wm, 0, y0 - 0.07, 0.012);
    // sashes
    const zS = -depth + 0.04, b = 0.045;
    this.rb(w, b, 0.05, 0.008, wm, 0, y1 - b / 2, zS); this.rb(w, b, 0.05, 0.008, wm, 0, y0 + b / 2, zS);
    for (const s of [-1, 1]) this.rb(b, h, 0.05, 0.008, wm, s * (w / 2 - b / 2), cy, zS);
    if (kind === 'double') {
      this.rb(w, 0.05, 0.07, 0.01, wm, 0, cy, zS);
      const [mx, my] = muntins;
      for (let i = 1; i < mx; i++) this.rb(0.018, h - 0.06, 0.03, 0.006, wm, -w / 2 + (w * i) / mx, cy, zS + 0.01);
      for (const half of [0, 1]) for (let j = 1; j < my; j++) this.rb(w - 0.06, 0.018, 0.03, 0.006, wm, 0, y0 + half * h / 2 + (h / 2 * j) / my, zS + 0.01);
    }
    this.pl(w - 0.04, h - 0.04, this.glass(), 0, cy, zS - 0.01);
    if (blind) {
      const cov = blind.cover ?? 0.4, bh = h * cov;
      if (blind.kind === 'slats') {
        const bt = blindsTex().clone(); bt.needsUpdate = true; bt.repeat.set(1, bh / 0.32 * 4);
        const bm = this.mat(`aptBlind-${bh.toFixed(2)}`, { map: bt, color: 0xffffff, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 });
        this.pl(w - 0.03, bh, bm, 0, y1 - bh / 2 - 0.02, -0.04);
        this.rb(w - 0.01, 0.045, 0.05, 0.01, wm, 0, y1 - 0.025, -0.04);
        this.rb(w - 0.03, 0.025, 0.04, 0.008, wm, 0, y1 - bh - 0.02, -0.04);
        this.rod([w * 0.35, y1 - 0.04, -0.02], [w * 0.35, y1 - bh - 0.25, -0.02], 0.003, this.M('cord', 0xd8d4c8));
      } else if (blind.kind === 'roman') {
        // a linen roman shade: a printed fabric (small botanical sprigs on oatmeal linen), the flat
        // drop, soft pleats gathered at the top, a wooden batten at the hem and a pull cord
        const ft = romanTex(blind.color);
        const fm = this.mat(`romanF-${blind.color}`, { map: ft, color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
        const drop = bh * 0.55, stack = bh - drop;
        this.rb(w + 0.08, 0.035, 0.05, 0.012, this.M('romanHead', 0xe8e0d0), 0, y1 + 0.01, 0.03);
        const folds = 4, fh = stack / folds;
        for (let i = 0; i < folds; i++) {
          const y = y1 - fh * (i + 0.5);
          this.cush(w + 0.05 - i * 0.004, fh * 1.08, 0.05 + i * 0.012, 0.024, fm, 0, y, 0.035 + i * 0.006, { puff: 0.35, seed: i + 3, lump: 0.004 });
        }
        this.pl(w + 0.04, drop, fm, 0, y1 - stack - drop / 2, 0.03);
        this.rb(w + 0.05, 0.02, 0.025, 0.008, this.M('romanBatten', 0xc9b48e, { roughness: 0.6 }), 0, y1 - bh, 0.035);
        this.rod([w / 2 + 0.01, y1 - 0.02, 0.05], [w / 2 + 0.01, y1 - bh - 0.3, 0.05], 0.003, this.M('cord', 0xd8d4c8));
        this.sph(0.012, this.M('romanBatten', 0xc9b48e), w / 2 + 0.01, y1 - bh - 0.31, 0.05);
      } else {
        const cm = this.M('cellShade', 0xd8d0c0, { roughness: 0.95, emissive: 0x100c08 });
        this.rb(w - 0.02, bh, 0.035, 0.008, cm, 0, y1 - bh / 2, -0.05);
        for (let k = 1; k < bh / 0.05; k++) this.rb(w - 0.025, 0.006, 0.04, 0.002, this.M('cellLine', 0xb8ae9c), 0, y1 - k * 0.05, -0.05);
        this.rb(w - 0.02, 0.025, 0.04, 0.008, wm, 0, y1 - bh, -0.05);
      }
    }
  }

  // ---------------------------------------------------------------- small props

  book(x, y, z, w, h, d, k, o = {}) {
    const m = this.M(`book-${k % BOOK_COLS.length}`, BOOK_COLS[k % BOOK_COLS.length], { roughness: 0.8 });
    this.rb(w, h, d, 0.006, m, x, y + h / 2, z, o);
    this.rb(Math.max(0.004, w - 0.008), h - 0.012, 0.004, 0.0015, this.M('pages', 0xe8e0cc), x, y + h / 2, z + d / 2 + 0.001, o.ry ? { ry: o.ry } : {});
  }
  /** A row of standing books from x0, returns end x. */
  bookRow(x0, y, z, n, seed, maxW = 1, d = 0.2) {
    const r = rng(seed);
    let x = x0;
    for (let i = 0; i < n; i++) {
      const w = 0.025 + r() * 0.03, h = 0.18 + r() * 0.08;
      if (x + w - x0 > maxW) break;
      const lean = i === n - 1 && r() < 0.5 ? -0.12 : 0;
      this.book(x + w / 2, y, z, w, h, d * (0.8 + r() * 0.2), Math.floor(r() * 99), lean ? { rz: lean } : {});
      x += w + 0.003;
    }
    return x;
  }
  bookStack(x, y, z, n, seed) {
    const r = rng(seed);
    let yy = y;
    for (let i = 0; i < n; i++) { const t = 0.03 + r() * 0.02; this.book(x + (r() - 0.5) * 0.03, yy, z, 0.16 + r() * 0.06, t, 0.22 + r() * 0.04, Math.floor(r() * 99), { ry: (r() - 0.5) * 0.3, rz: 0 }); yy += t; }
    return yy;
  }
  mug(x, y, z, color = 0xd8d0c0, ry = 0) {
    const m = this.M(`mug-${color}`, color, { roughness: 0.4 });
    this.lathe([[0.038, 0], [0.042, 0.005], [0.043, 0.095], [0.04, 0.095], [0.039, 0.012], [0.001, 0.012]], m, x, y, z);
    this.torus(0.025, 0.006, m, x + Math.cos(ry) * 0.045, y + 0.05, z - Math.sin(ry) * 0.045, { ry, ts: 16, rs: 6 });
    this.cy(0.037, 0.037, 0.004, this.M('coffee', 0x2a1408, { roughness: 0.2 }), x, y + 0.08, z, { seg: 16 });
  }
  /** Potted plant: lathe pot, crossed leaf cards (palm or pothos). */
  plant(x, y, z, s = 1, kind = 'palm', potColor = 0xd8d0c4) {
    const pm = this.M(`pot-${potColor}`, potColor, { roughness: 0.6 });
    this.lathe([[0.001, 0], [0.12 * s, 0], [0.14 * s, 0.03 * s], [0.16 * s, 0.24 * s], [0.17 * s, 0.26 * s], [0.155 * s, 0.26 * s], [0.001, 0.24 * s]], pm, x, y, z);
    this.cy(0.15 * s, 0.15 * s, 0.01, this.M('soil', 0x2a1e14), x, y + 0.235 * s, z);
    const lm = this.mat(`aptLeaf-${kind}`, { map: leafTex(kind), color: 0xffffff, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
    const r = rng(Math.round(x * 100 + z * 10));
    const n = kind === 'palm' ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4, tilt = kind === 'palm' ? 0.35 + r() * 0.5 : 0.1 + r() * 0.3;
      const L = (kind === 'palm' ? 0.9 : 0.4) * s * (0.7 + r() * 0.4);
      this.pl(L * 0.62, L, lm, x + Math.sin(a) * Math.sin(tilt) * L * 0.5, y + 0.24 * s + Math.cos(tilt) * L * 0.5, z + Math.cos(a) * Math.sin(tilt) * L * 0.5, { rx: tilt, ry: a, order: 'YXZ' });
    }
  }
  /** Framed picture on a wall (local frame: wall at z = 0). */
  framed(map, w, h, x, y, z, frameColor = 0x2a2420, mat = 0.03, key = null) {
    const fm = this.M(`pframe-${frameColor}`, frameColor, { roughness: 0.5 });
    const b = 0.03;
    this.rb(w + b * 2, b, 0.03, 0.008, fm, x, y + h / 2 + b / 2, z + 0.015);
    this.rb(w + b * 2, b, 0.03, 0.008, fm, x, y - h / 2 - b / 2, z + 0.015);
    this.rb(b, h, 0.03, 0.008, fm, x - w / 2 - b / 2, y, z + 0.015);
    this.rb(b, h, 0.03, 0.008, fm, x + w / 2 + b / 2, y, z + 0.015);
    if (mat) this.pl(w, h, this.M('passepartout', 0xece8de), x, y, z + 0.008);
    this.pl(w - mat * 2, h - mat * 2, this.texM(key || `pic-${map.uuid}`, map, { roughness: 0.5 }), x, y, z + 0.01);
  }
  /** A lit candle in a glass, with a flickering flame and halo (a lamp in the state system). */
  candle(id, x, y, z, { on = { evening: 1, night: 0, day: 0 }, h = 0.08, r = 0.035 } = {}) {
    this.lathe([[0.001, 0], [r, 0], [r + 0.004, h + 0.02], [r + 0.001, h + 0.02], [r - 0.003, 0.006], [0.001, 0.006]], this.mat('apt-candleGlass', { color: 0xe8c8a0, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }), x, y, z);
    this.cy(r - 0.004, r - 0.004, h - 0.01, this.M('wax', 0xf0e6d4, { roughness: 0.6, emissive: 0x2a1a08 }), x, y + h / 2, z);
    const fm = this.glowM(`flame-${id}`, 0x000000, 0xffb050);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), fm);
    flame.geometry.translate(0, 0.012, 0); flame.scale.set(1, 1.8, 1);
    flame.position.set(x, y + h + 0.004, z);
    this.root.add(flame);
    const halo = this.halo(0xffa050, 0.3, 0.55, x, y + h + 0.03, z + 0.02);
    this.flames.push({ flame, halo, size: 0.3, ph: x * 13 + z * 7 });
    this.stateFx.push(() => { flame.visible = fm.emissiveIntensity > 0.01; });
    return this.lamp(id, { glows: [halo], mats: [[fm, 3]], on });
  }
  /** Fairy lights along a curve: warm grains of light (one instanced mesh) + a couple of halos. */
  fairyLights(id, pts, count, { on = { evening: 1, night: 0, day: 0 }, halos = 3 } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), false, 'catmullrom', 0.3);
    this.tube(pts, 0.002, this.M('wire', 0x2a2a22));
    const bm = this.glowM(`fairy-${id}`, 0x6a5a40, 0xffc070, { roughness: 0.4 });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 12, 10), bm, count);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < count; i++) { const p = curve.getPoint((i + 0.5) / count); mtx.makeTranslation(p.x, p.y - 0.008, p.z); im.setMatrixAt(i, mtx); }
    this.root.add(im);
    const glows = [];
    for (let i = 0; i < halos; i++) { const p = curve.getPoint((i + 0.5) / halos); glows.push(this.halo(0xffb060, 0.7, 0.22, p.x, p.y, p.z + 0.03)); }
    return this.lamp(id, { glows, mats: [[bm, 2.4]], on });
  }
  /** Floor plank material. */
  plankMat(tone = 0) { return this.texM(`planks-${tone}`, planksTex(tone), { roughness: 0.6 }); }
}

// ------------------------------------------------------------------ shared furniture pieces

/** Six-panel interior door (white) or a painted entrance door, in the local frame (wall z = 0). */
function panelDoor(k, w, h, color, { glassTop = false } = {}) {
  const leafM = k.M(`door-${color}`, color, { roughness: 0.5 });
  const wm = k.white();
  k.rb(w + 0.18, 0.08, 0.03, 0.01, wm, 0, h + 0.04, 0.015);
  for (const s of [-1, 1]) k.rb(0.08, h + 0.04, 0.03, 0.01, wm, s * (w / 2 + 0.04), h / 2, 0.015);
  const rev = k.M('reveal', 0xdcd6cc, { roughness: 0.8 });
  for (const s of [-1, 1]) k.pl(0.14, h, rev, s * w / 2, h / 2, -0.07, { ry: -s * Math.PI / 2 });
  k.pl(w, 0.14, rev, 0, h, -0.07, { rx: Math.PI / 2 });
  k.rb(w - 0.01, h - 0.01, 0.045, 0.012, leafM, 0, h / 2, -0.05);
  const pw = (w - 0.24) / 2;
  const rows = [[0.12, 0.62], [0.86, 0.5], [1.48, 0.42]];
  for (const [y0, ph] of rows) for (const s of [-1, 1]) {
    if (glassTop && y0 > 1.4) continue;
    k.rb(pw, ph * (h / 2.1), 0.012, 0.01, leafM, s * (pw / 2 + 0.04), (y0 + ph / 2) * (h / 2.1), -0.022);
  }
  if (glassTop) k.pl(w - 0.24, 0.4, k.mat('apt-doorGlass', { color: 0xc8b890, roughness: 0.2, emissive: 0x2a1c0c }), 0, h * 0.82, -0.025);
  const br = k.brass();
  k.sph(0.03, br, w / 2 - 0.1, 1.0, -0.005);
  k.cy(0.035, 0.035, 0.01, br, w / 2 - 0.1, 1.0, -0.025, { rx: Math.PI / 2 });
}

/** Turned leg (lathe) from y0 up to y1. */
function turnedLeg(k, mat, x, y0, z, len, r = 0.03) {
  const L = len;
  k.lathe([[r * 0.7, 0], [r * 0.9, 0.04 * L], [r * 0.6, 0.12 * L], [r, 0.25 * L], [r * 0.7, 0.45 * L], [r * 0.9, 0.6 * L], [r * 1.1, 0.8 * L], [r * 1.1, L]], mat, x, y0, z, { seg: 16 });
}

// ------------------------------------------------------------------ living room + kitchen

/**
 * The ground floor, side-on (back wall at z −2.8, ceiling 2.7):
 *   x −6.2 … −1.9  living room: corner TV unit, torchiere, palm, bay window with blinds,
 *                  grey-brown sectional, dark coffee table on a shag rug, narrow bookcase
 *   x −1.2 …  1.6  hall: front door, coat rail (Julian's red scarf), shoe bench, bedroom door
 *   x  1.75 … 4.15 stairs up to the attic, family photos climbing the wall, fairy lights on the rail
 *   x  4.25 … 6.5  kitchen: oak with stained glass, red glazed tile, ceramic sink, fridge;
 *                  the island where Julian lays out the case photos, two bar stools
 */
export class ApartmentScene extends AptBase {
  constructor(opts) {
    super(opts);
    this.id = 'apartment';
    this.title = 'Квартира';
    this.camera = { distance: 6.4, height: 1.5, lookHeight: 1.35, lookZ: -1.0 };
    this.bounds = {
      walk: { areas: [
        { minX: -4.6, maxX: 6.1, minZ: -1.5, maxZ: 0.85 },
        { minX: -1.15, maxX: -0.25, minZ: -2.35, maxZ: -1.4 },
        { minX: -0.25, maxX: 1.65, minZ: -2.2, maxZ: -1.4 },
        { minX: 4.2, maxX: 5.75, minZ: -2.0, maxZ: -1.4 },
      ] },
      camera: { minX: -1.7, maxX: 2.4 },
    };
  }

  build() {
    const BACK = -2.8, H = 2.9, XL = -6.2, XR = 6.5;
    const root = this.root;
    this.setupLights();
    // ---- shell
    this.floorRect(XL, 3.95, BACK - 0.6, 3.0, this.plankMat(0));
    this.floorRect(3.95, XR, BACK - 0.6, 3.0, this.texM('terracotta', terracottaTex(), { roughness: 0.7 }), 0.64);
    this.rb(0.06, 0.012, 3.0, 0.004, this.brass(), 3.95, 0.003, -1.3);
    const wallM = this.texM('wallLiving', paintTex('living', [224, 212, 190]), { roughness: 0.95 });
    const holes = [
      { x0: -4.3, x1: -1.9, y0: 0, y1: 2.42 },   // bay
      { x0: -1.15, x1: -0.25, y0: 0, y1: 2.12 }, // front door
      { x0: 0.8, x1: 1.6, y0: 0, y1: 2.06 },     // bedroom door
    ];
    this.wall(XL, XR, H, BACK, wallM, holes);
    this.sideWall(XL, BACK, 2.5, H, wallM, 1);
    this.sideWall(XR, BACK, 2.5, H, wallM, -1);
    const ceilM = this.M('ceil', 0xe8e2d6, { roughness: 1, emissive: 0x16120c });
    this.ceilingPoly([[XL, BACK - 0.7], [XR, BACK - 0.7], [XR, 2.6], [XL, 2.6]], H, ceilM, [[[2.9, BACK + 0.02], [4.15, BACK + 0.02], [4.15, BACK + 0.9], [2.9, BACK + 0.9]]]);
    this.trims([[XL, -4.3], [-1.9, -1.15], [-0.25, 0.8], [1.6, XR]], BACK, H, { skirt: false });
    this.trims([[XL, -4.3], [-1.9, -1.15], [-0.25, 0.8]], BACK, H, { crown: false });
    this.trims([[-4.3, -1.9]], BACK, H, { skirt: false });

    this.buildBay(BACK, H, wallM, ceilM);
    this.buildLiving(BACK, H);
    this.buildHall(BACK, H);
    this.buildStairs(BACK, H, ceilM);
    this.buildKitchen(BACK, H, wallM);
    this.flushBatches();

    // ---- general light: a warm bounce over the living room in the evening
    this.lamp('livingFill', { light: this.pointLight(0xffb878, 2.2, 9, -2.4, 2.3, 0.2, 1.2), on: { evening: 1, night: 0, day: 0 } });
    this.lamp('kitchenFill', { light: this.pointLight(0xffc890, 1.2, 7, 4.6, 2.3, 0.0, 1.2), on: { evening: 1, night: 0, day: 0 } });
    this.lamp('dayFill', { light: this.pointLight(0xdfe6ee, 2.2, 10, -2.8, 2.0, -1.4, 1.0), on: { evening: 0, night: 0, day: 1 } });
    this.lamp('moon', { light: this.pointLight(0x7890c8, 1.6, 7, -3.0, 1.9, -2.2, 1.2), on: { evening: 0, night: 1, day: 0 } });
    this.lamp('moonK', { light: this.pointLight(0x6a80b8, 1.0, 6, 4.0, 2.0, 0.2, 1.2), on: { evening: 0, night: 1, day: 0 } });
    this.statePool(0x5a74b8, 4.8, 0.02, -0.2, 2.2, 1.2, 0.14, ['night']);
    // moonlight / daylight on the floor and the sofa in front of the bay
    for (const [st, c, op] of [['night', 0x5a74b8, 0.32], ['day', 0xc8d4e0, 0.18]]) {
      this.statePool(c, -1.75, 0.02, -1.0, 1.0, 1.6, op, [st]);
      this.statePool(c, -3.1, 0.5, -1.95, 2.4, 0.9, op * 0.8, [st]);
      this.statePool(c, -3.0, 0.03, -0.3, 2.6, 1.0, op * 0.6, [st]);
    }
    this.windowLights.push(
      flareSource('PALE', V3(-3.1, 1.6, BACK - 0.55), { triggerDistance: 2.4, intensity: 0.45, enabled: () => this.state === 'day' }),
      flareSource('MOON', V3(-3.1, 1.7, BACK - 0.55), { triggerDistance: 2.4, enabled: () => this.state === 'night' }),
    );

    // ---- contract
    this.colliders.push(
      { x: -3.7, z: -2.2, r: 0.5 }, { x: -2.7, z: -2.2, r: 0.5 }, { x: -1.9, z: -1.95, r: 0.5 }, { x: -1.9, z: -1.25, r: 0.42 },
      { x: -3.3, z: -0.85, r: 0.4 }, { x: -5.35, z: -2.3, r: 0.55 }, { x: -4.9, z: -1.55, r: 0.28 },
      { x: 4.75, z: -0.95, r: 0.42 }, { x: 5.35, z: -0.95, r: 0.42 }, { x: 4.12, z: -0.95, r: 0.18 }, { x: 5.98, z: -0.95, r: 0.18 },
      { x: 1.78, z: -1.95, r: 0.12 },
    );
    this.doors = [
      { id: 'front', label: 'Выход', x: -0.7, z: -2.1, radius: 0.8, anchor: V3(-0.7, 1.6, BACK + 0.15), to: null, spawn: { x: -0.7, z: -1.8, facing: 1 } },
      { id: 'to_bedroom', label: 'Спальня', x: 1.2, z: -2.0, radius: 0.75, anchor: V3(1.2, 1.7, BACK + 0.15), to: 'apt_bedroom', spawn: { x: 2.9, z: -1.95, facing: -1 } },
      { id: 'to_attic', label: 'Наверх', x: 2.0, z: -1.55, radius: 0.75, anchor: V3(2.4, 1.5, -2.1), to: 'apt_attic', spawn: { x: 1.85, z: -0.6, facing: -1 } },
    ];
    this.spots = {
      entry: { x: -0.7, z: -1.75, facing: 1 },
      kitchenStool: { x: 4.12, z: -0.95, facing: 1, seatY: 0.75 },
      kitchenStand: { x: 5.05, z: -0.3, facing: -1 },
      sofa: { x: -3.2, z: -2.05, facing: 1, seatY: 0.47 },
      window: { x: -2.75, z: -1.45, facing: -1 },
    };
    Object.assign(this.anchors, {
      table: V3(5.05, 1.2, -0.95), fridge: V3(6.1, 1.7, -2.3), photo: V3(2.2, 1.75, BACK + 0.1),
      window: V3(-3.1, 1.7, BACK - 0.3), sofa: V3(-3.0, 1.0, -2.1), coat: V3(0.25, 1.5, BACK + 0.2), tv: V3(-5.3, 1.2, -2.2),
    });
    this.setState('evening');
    return root;
  }

  buildBay(BACK, H, wallM, ceilM) {
    const d = 0.5, sideRy = Math.atan2(d, 0.6), sideLen = Math.hypot(0.6, d), top = 2.42;
    const face = (cx, cz, ry, w, ww) => this.withT(cx, cz, ry, () => {
      this._add(holeWallGeo(w, top, [{ x0: -ww / 2, x1: ww / 2, y0: 0.72, y1: 2.2 }]), wallM);
      this.windowUnit(ww, 0.72, 2.2, { kind: 'plain', depth: 0.12, blind: { kind: 'slats', cover: ww > 0.8 ? 0.34 : 0.42 } });
      this.rb(w, 0.11, 0.025, 0.008, this.white(), 0, 0.055, 0.013);
    });
    face(-3.1, BACK - d, 0, 1.2, 1.0);
    face(-4.0, BACK - d / 2, sideRy, sideLen, 0.5);
    face(-2.2, BACK - d / 2, -sideRy, sideLen, 0.5);
    this.ceilingPoly([[-4.3, BACK + 0.01], [-1.9, BACK + 0.01], [-2.5, BACK - d], [-3.7, BACK - d]], top, ceilM);
    this.rb(2.5, 0.06, 0.04, 0.01, this.white(), -3.1, top - 0.03, BACK + 0.02);
    this.viewPlane(8, 5, -3.1, 1.6, BACK - 3.0, 'low');
    // sill plants and a candle on the deep ledge
    this.plant(-3.55, 0.72, BACK - 0.42, 0.45, 'pothos', 0xb86a4a);
    this.plant(-2.55, 0.72, BACK - 0.42, 0.4, 'pothos', 0xe0d8c8);
    this.candle('sillCandle', -3.1, 0.72, BACK - 0.42, { on: { evening: 1, night: 0, day: 0 } });
    // fairy lights hung along the top of the bay
    const pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, x = -4.25 + t * 2.3; pts.push([x, 2.36 - Math.sin(t * Math.PI * 4) ** 2 * 0.07, BACK + 0.04]); }
    this.fairyLights('bayLights', pts, 40, { on: { evening: 1, night: 0, day: 0 } });
  }

  buildLiving(BACK) {
    const fab = this.M('sofa', 0x7d6e60, { roughness: 0.97 });
    const fab2 = this.M('sofaDark', 0x6a5c50, { roughness: 0.97 });
    const legM = this.M('sofaLeg', 0x2a1c14, { roughness: 0.5 });
    const dark = this.texM('darkwood', darkWoodTex(), { roughness: 0.45 });
    // ---- sectional: long part under the bay + a return toward the room on the right
    this.rb(2.0, 0.22, 0.9, 0.05, fab2, -3.25, 0.21, -2.22);
    this.rb(0.9, 0.22, 1.73, 0.05, fab2, -1.9, 0.21, -1.815);
    for (const [x, z] of [[-4.2, -2.6], [-4.2, -1.83], [-1.5, -2.6], [-1.5, -1.0], [-2.3, -1.0]]) this.cy(0.025, 0.02, 0.1, legM, x, 0.05, z);
    this.cush(0.9, 0.17, 0.72, 0.06, fab, -3.7, 0.4, -2.1, { seed: 1, puff: 0.35 });
    this.cush(0.9, 0.17, 0.72, 0.06, fab, -2.8, 0.4, -2.1, { seed: 2, puff: 0.35 });
    this.cush(0.88, 0.17, 0.72, 0.06, fab, -1.9, 0.4, -2.1, { seed: 3, puff: 0.35 });
    this.cush(0.88, 0.17, 0.82, 0.06, fab, -1.9, 0.4, -1.32, { seed: 4, puff: 0.35 });
    for (const [x, s] of [[-3.7, 5], [-2.8, 6], [-1.9, 7]]) this.cush(0.88, 0.5, 0.24, 0.1, fab, x, 0.7, -2.55, { seed: s, puff: 0.4, rx: -0.14 });
    this.cush(0.2, 0.5, 0.9, 0.08, fab2, -4.2, 0.42, -2.22, { seed: 8, puff: 0.2 });
    // throw pillows
    this.cush(0.42, 0.42, 0.14, 0.07, this.M('pillowA', 0xb8a890, { roughness: 0.95 }), -3.95, 0.68, -2.36, { seed: 9, puff: 0.6, rx: -0.3, rz: 0.15 });
    this.cush(0.4, 0.4, 0.14, 0.07, this.M('pillowB', 0x5a4038, { roughness: 0.95 }), -3.45, 0.66, -2.36, { seed: 10, puff: 0.6, rx: -0.28, rz: -0.1 });
    this.cush(0.4, 0.4, 0.14, 0.07, this.M('pillowC', 0x8a3a2a, { roughness: 0.95 }), -1.95, 0.66, -2.36, { seed: 11, puff: 0.6, rx: -0.3, rz: 0.05 });
    // a wool throw over the corner back and onto the seat
    const plaid = this.texM('plaid', plaidTex(0), { roughness: 0.95, side: THREE.DoubleSide });
    this.drape(0.62, 0.3, 0.42, plaid, -2.45, 0.95, -2.58, { sides: [0, 0, 1, 1], uv: [0.3, 0.3], seed: 4, r: 0.06, wrinkle: 0.015 });
    this.drape(0.7, 0.5, 0.1, plaid, -1.85, 0.5, -1.35, { sides: [1, 1, 0, 1], uv: [0.3, 0.3], seed: 6, ry: 0.4, r: 0.05 });
    // ---- shag rug + coffee table
    this.rb(3.6, 0.014, 2.1, 0.006, this.texM('shag', shagTex(), { roughness: 1 }), -2.9, 0.007, -1.0, { uv: [0.64, 0.64] });
    this.rb(1.05, 0.05, 0.56, 0.015, dark, -3.3, 0.44, -0.85);
    this.rb(0.95, 0.025, 0.46, 0.01, dark, -3.3, 0.13, -0.85);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(this, dark, -3.3 + sx * 0.46, 0.0, -0.85 + sz * 0.22, 0.42, 0.028);
    this.rb(0.36, 0.03, 0.26, 0.01, this.M('tray', 0x2a1e18, { roughness: 0.4 }), -3.5, 0.48, -0.9);
    this.candle('tableCandle', -3.56, 0.495, -0.92, { on: { evening: 1, night: 0, day: 0 } });
    this.candle('tableCandle2', -3.42, 0.495, -0.86, { h: 0.12, r: 0.03, on: { evening: 1, night: 0, day: 0 } });
    this.mug(-3.0, 0.465, -0.75, 0x3a5a6a, 0.6);
    this.bookStack(-3.05, 0.465, -0.98, 2, 33);
    this.rb(0.16, 0.02, 0.05, 0.008, this.M('remote', 0x1a1a1c, { roughness: 0.4 }), -3.75, 0.475, -0.72, { ry: 0.3 });
    // ---- corner TV unit, TV, soundbar, a small plant
    this.withT(-5.35, -2.3, 0.62, () => {
      this.rb(1.2, 0.5, 0.42, 0.02, dark, 0, 0.32, 0);
      for (const s of [-1, 1]) this.rb(0.56, 0.4, 0.015, 0.006, dark, s * 0.29, 0.32, 0.21);
      for (const s of [-1, 1]) this.rb(0.1, 0.012, 0.012, 0.005, this.brass(), s * 0.05, 0.38, 0.225);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cy(0.02, 0.016, 0.07, dark, sx * 0.55, 0.035, sz * 0.17);
      this.rb(0.3, 0.02, 0.18, 0.006, this.M('tvStand', 0x1a1a1c), 0, 0.58, 0);
      this.rb(0.05, 0.12, 0.03, 0.01, this.M('tvStand', 0x1a1a1c), 0, 0.64, 0);
      this.rb(1.0, 0.6, 0.045, 0.012, this.M('tvBody', 0x121214, { roughness: 0.4 }), 0, 0.99, -0.01);
      this.pl(0.96, 0.56, this.M('tvScreen', 0x0c0e12, { roughness: 0.12, metalness: 0.3, emissive: 0x05070a }), 0, 0.99, 0.0135);
      this.rb(0.6, 0.06, 0.08, 0.02, this.M('tvStand', 0x1a1a1c), 0, 0.6, 0.13);
      this.plant(0.48, 0.57, 0.05, 0.3, 'pothos', 0x3a3a3a);
    });
    // ---- torchiere in the corner
    const lampM = this.M('lampMetal', 0x8a8478, { roughness: 0.35, metalness: 0.7 });
    const bowlM = this.glowM('torchBowl', 0xf0e8dc, 0xffd8a0, { side: THREE.DoubleSide });
    this.lathe([[0.001, 0], [0.16, 0], [0.16, 0.025], [0.04, 0.04], [0.001, 0.045]], lampM, -4.65, 0, -2.55);
    this.rod([-4.65, 0.04, -2.55], [-4.65, 1.72, -2.55], 0.012, lampM);
    this.lathe([[0.02, 0], [0.1, 0.03], [0.18, 0.1], [0.2, 0.13]], bowlM, -4.65, 1.72, -2.55, { seg: 28 });
    const tl = this.lamp('torchiere', {
      light: this.pointLight(0xffc488, 4.2, 7, -4.6, 1.95, -2.3, 1.2),
      glows: [this.halo(0xffc890, 1.4, 0.32, -4.65, 1.9, -2.5), this.halo(0xffb070, 3.0, 0.12, -4.65, 2.55, -2.6)],
      mats: [[bowlM, 1.4]], on: { evening: 1, night: 0.7, day: 0 },
      flare: { pos: V3(-4.65, 1.88, -2.5) },
    });
    void tl;
    // palm in a big pot by the bay
    this.plant(-4.9, 0, -1.55, 1.15, 'palm', 0xd8d0c4);
    // art over the TV corner
    this.framed(treeArtTex(), 0.9, 0.55, -5.3, 1.85, BACK, 0x2a2420, 0.05);
    // narrow bookcase between the bay and the door
    const oak = this.texM('oakDark', oakTex(2), { roughness: 0.6 });
    this.withT(-1.55, BACK + 0.16, 0, () => {
      for (const s of [-1, 1]) this.rb(0.025, 1.85, 0.3, 0.006, oak, s * 0.2, 0.925, 0);
      this.rb(0.42, 0.02, 0.02, 0.005, oak, 0, 0.925, -0.14, { sy: 92 });
      for (let i = 0; i < 6; i++) this.rb(0.38, 0.022, 0.29, 0.006, oak, 0, 0.06 + i * 0.355, 0);
      for (let i = 0; i < 4; i++) this.bookRow(-0.18, 0.07 + i * 0.355 + 0.012, 0.0, 14, 40 + i, i === 2 ? 0.22 : 0.36, 0.2);
      this.plant(0.0, 1.85, 0.0, 0.3, 'pothos', 0xe0d8c8);
      this.mug(0.1, 0.785, 0.05, 0xd8c070);
    });
  }

  buildHall(BACK) {
    // front door: painted sage, brass, a doormat
    this.withT(-0.7, BACK, 0, () => panelDoor(this, 0.9, 2.1, 0x5a6a5a, { glassTop: false }));
    this.sph(0.008, this.brass(), -0.7, 1.55, BACK - 0.02);
    this.rb(0.06, 0.1, 0.02, 0.008, this.brass(), -0.32, 1.15, BACK - 0.02);
    this.rb(0.85, 0.016, 0.5, 0.006, this.texM('coir', coirTex()), -0.7, 0.008, BACK + 0.38);
    this.rb(0.08, 0.12, 0.015, 0.006, this.white(), -1.32, 1.2, BACK + 0.008);
    // coat rail: oak board, brass hooks, Julian's coat, Lizzie's parka, the red scarf, a beanie
    const oak = this.texM('oakMid', oakTex(1), { roughness: 0.6 });
    this.rb(0.85, 0.1, 0.025, 0.008, oak, 0.28, 1.72, BACK + 0.013);
    const hooks = [-0.05, 0.17, 0.39, 0.61];
    for (const x of hooks) this.tube([[x, 1.72, BACK + 0.02], [x, 1.7, BACK + 0.07], [x, 1.66, BACK + 0.09], [x, 1.68, BACK + 0.1]], 0.007, this.brass(), { seg: 10 });
    const coat = (x, color, len, puffy) => {
      const m = this.M(`coat-${color}`, color, { roughness: 0.95 });
      const prof = puffy
        ? [[0.03, 0], [0.13, -0.05], [0.18, -0.14], [0.2, -0.3], [0.21, -0.45], [0.2, -0.6], [0.2, -len + 0.03], [0.17, -len]]
        : [[0.03, 0], [0.12, -0.05], [0.17, -0.14], [0.18, -0.35], [0.19, -0.7], [0.21, -len + 0.03], [0.18, -len]];
      this.lathe(prof, m, x, 1.67, BACK + 0.13, { sz: 0.42, seg: 20 });
      if (puffy) for (let i = 0; i < 4; i++) this.torus(0.19, 0.022, m, x, 1.67 - 0.2 - i * 0.14, BACK + 0.13, { rx: Math.PI / 2, sy: 0.42, ts: 24 });
      this.lathe([[0.001, -0.05], [0.07, -0.06], [0.1, 0.02], [0.05, 0.06], [0.001, 0.06]], m, x, 1.6, BACK + 0.13, { sz: 0.6 });
    };
    coat(-0.05, 0x3a302a, 1.05, false);
    coat(0.39, 0x2a5a5a, 0.72, true);
    // Julian's red scarf: hung over the second hook, two tails with fringe
    const red = this.M('scarf', 0xa81c1c, { roughness: 0.95 });
    const sx = 0.17, sz = BACK + 0.1;
    this.tube([[sx - 0.06, 0.95, sz + 0.03], [sx - 0.07, 1.3, sz + 0.03], [sx - 0.04, 1.62, sz + 0.02], [sx, 1.69, sz], [sx + 0.04, 1.62, sz + 0.02], [sx + 0.06, 1.2, sz + 0.035], [sx + 0.07, 1.02, sz + 0.04]], 0.024, red, { seg: 40, rs: 10 });
    for (const [x, y, z] of [[sx - 0.06, 0.95, sz + 0.03], [sx + 0.07, 1.02, sz + 0.04]]) for (let k = -2; k <= 2; k++) this.rod([x + k * 0.008, y, z], [x + k * 0.009, y - 0.06, z + 0.005], 0.003, red, { seg: 5 });
    this.lathe([[0.001, 0.12], [0.06, 0.11], [0.09, 0.06], [0.1, 0.0], [0.09, -0.02]], this.M('beanie', 0xc8b89a, { roughness: 1 }), 0.61, 1.72, BACK + 0.12, { rx: 0.4 });
    // shoe bench and shoes
    this.rb(0.7, 0.04, 0.34, 0.01, oak, 0.28, 0.45, BACK + 0.2);
    this.rb(0.66, 0.025, 0.3, 0.008, oak, 0.28, 0.14, BACK + 0.2);
    for (const s of [-1, 1]) this.rb(0.035, 0.45, 0.32, 0.008, oak, 0.28 + s * 0.32, 0.225, BACK + 0.2);
    const boot = (x, z, color, ry, high = 0.28) => {
      const m = this.M(`boot-${color}`, color, { roughness: 0.6 });
      this.rb(0.11, 0.08, 0.28, 0.035, m, x, 0.04, z, { ry });
      this.rb(0.11, high, 0.13, 0.04, m, x - Math.sin(ry) * 0.07, high / 2 + 0.03, z - Math.cos(ry) * 0.07, { ry });
      this.rb(0.115, 0.02, 0.29, 0.008, this.M('sole', 0x1a1410), x, 0.01, z, { ry });
    };
    boot(0.0, BACK + 0.55, 0x4a3020, 0.15); boot(0.14, BACK + 0.55, 0x4a3020, 0.05);
    boot(0.42, BACK + 0.2, 0x5a4a3a, 0.0, 0.12); boot(0.56, BACK + 0.2, 0x5a4a3a, 0.1, 0.12);
    this.rb(0.1, 0.07, 0.26, 0.03, this.M('sneaker', 0xd8d4cc, { roughness: 0.7 }), 0.15, 0.5, BACK + 0.2);
    this.rb(0.1, 0.07, 0.26, 0.03, this.M('sneaker', 0xd8d4cc, { roughness: 0.7 }), 0.28, 0.5, BACK + 0.22, { ry: 0.2 });
    // bedroom door (white panels), a light switch, a small picture
    this.withT(1.2, BACK, 0, () => panelDoor(this, 0.8, 2.06, 0xeae6de));
    this.rb(0.08, 0.12, 0.015, 0.006, this.white(), 1.72, 1.2, BACK + 0.008);
    this.framed(drawingTex(0), 0.2, 0.25, 0.28, 2.15, BACK, 0x6a4a2a, 0.02);
  }

  buildStairs(BACK, H, ceilM) {
    const x0 = 1.75, run = 0.2, n = 12, rise = H / n, w = 0.88, zc = BACK + w / 2;
    const oak = this.texM('oakMid', oakTex(1), { roughness: 0.55 });
    const wm = this.white();
    for (let i = 0; i < n; i++) {
      const xa = x0 + i * run, y = (i + 1) * rise;
      this.rb(run + 0.035, 0.035, w, 0.01, oak, xa + run / 2 - 0.015, y - 0.0175, zc);
      this.rb(0.02, rise - 0.03, w - 0.02, 0.004, wm, xa, y - rise / 2 - 0.02, zc);
    }
    // closed panel under the flight, with a little cupboard door
    const s = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x0 + n * run, 0), new THREE.Vector2(x0 + n * run, H - 0.03), new THREE.Vector2(x0, rise - 0.03)]);
    const sg = new THREE.ShapeGeometry(s); const suv = sg.attributes.uv, sp = sg.attributes.position; for (let i = 0; i < suv.count; i++) suv.setXY(i, sp.getX(i) / 2, sp.getY(i) / 2);
    this._add(sg, this.mats.cache.get('aptT-wallLiving'), 0, 0, BACK + w + 0.005);
    // a low cupboard door under the flight: oak, two panels, a brass knob; a basket of logs beside it
    const cdoor = this.texM('oakMid', oakTex(1), { roughness: 0.55 });
    // a full-height storage door (the space under the flight is ≈2.2 m tall here)
    this.rb(0.8, 1.86, 0.03, 0.01, wm, 3.72, 0.93, BACK + w + 0.01);
    this.rb(0.7, 1.8, 0.03, 0.01, cdoor, 3.72, 0.9, BACK + w + 0.025);
    for (const [y, hh] of [[0.45, 0.6], [1.3, 0.72]]) this.rb(0.54, hh, 0.012, 0.008, cdoor, 3.72, y, BACK + w + 0.045);
    this.sph(0.022, this.brass(), 3.45, 0.98, BACK + w + 0.055);
    this.rb(0.05, 0.1, 0.01, 0.004, this.brass(), 3.45, 0.98, BACK + w + 0.042);
    this.rb(0.11, 0.11, 0.015, 0.006, this.white(), 2.55, 1.0, BACK + w + 0.01);
    this.lathe([[0.001, 0], [0.2, 0], [0.22, 0.3], [0.001, 0.3]], this.M('basket', 0x9a7a4a), 2.75, 0, BACK + w + 0.25, { sz: 0.7 });
    for (let k = 0; k < 5; k++) this.cy(0.045, 0.045, 0.36, this.M('log', 0x7a5a3a, { roughness: 1 }), 2.62 + (k % 3) * 0.12, 0.33 + Math.floor(k / 3) * 0.08, BACK + w + 0.25, { rz: Math.PI / 2 + (k - 2) * 0.1, seg: 12 });
    // stringer, balusters, rail, newel
    const L = Math.hypot(n * run, H), ang = Math.atan2(H, n * run);
    this.rb(L + 0.1, 0.2, 0.04, 0.01, wm, x0 + n * run / 2 + 0.02, H / 2 - 0.02, BACK + w + 0.02, { rz: ang });
    this.rb(L + 0.1, 0.16, 0.025, 0.008, wm, x0 + n * run / 2 + 0.02, H / 2 + 0.05, BACK + 0.013, { rz: ang });
    const railY = (x) => (x - x0) / run * rise + 0.92;
    for (let i = 0; i < n; i++) { const x = x0 + i * run + run / 2; this.rod([x, (i + 1) * rise, BACK + w - 0.04], [x, railY(x) - 0.02, BACK + w - 0.04], 0.012, wm); }
    this.rod([x0 + 0.02, railY(x0 + 0.02) + 0.05, BACK + w - 0.04], [x0 + n * run, railY(x0 + n * run), BACK + w - 0.04], 0.028, oak, { seg: 16 });
    this.rb(0.1, 1.2, 0.1, 0.02, oak, x0 + 0.03, 0.6, BACK + w - 0.04);
    this.lathe([[0.001, 0], [0.06, 0], [0.065, 0.04], [0.03, 0.07], [0.04, 0.1], [0.001, 0.12]], oak, x0 + 0.03, 1.2, BACK + w - 0.04);
    // the stairwell above (lit from the attic in the evening)
    const well = this.M('well', 0xb8ae9c, { roughness: 1 });
    for (const [x, ry] of [[2.9, Math.PI / 2], [4.15, -Math.PI / 2]]) this.pl(0.9, 1.0, well, x, H + 0.5, BACK + 0.45, { ry });
    this.pl(1.25, 1.0, well, 3.52, H + 0.5, BACK + 0.9, { ry: Math.PI });
    this.pl(1.25, 1.0, well, 3.52, H + 0.5, BACK + 0.02);
    this.pl(1.25, 0.9, well, 3.52, H + 1.0, BACK + 0.45, { rx: Math.PI / 2 });
    this.lamp('atticGlow', { glows: [this.halo(0xffb878, 1.8, 0.35, 3.5, H + 0.25, BACK + 0.5)], on: { evening: 1, night: 0, day: 0 } });
    // family photos climbing the wall; the one of the two of them first
    this.framed(familyPhotoTex(), 0.42, 0.32, 2.2, 1.78, BACK, 0x2a2018, 0.03);
    this.framed(polaroidTex(1), 0.2, 0.24, 2.72, 2.1, BACK, 0xe8e4dc, 0.02);
    this.framed(drawingTex(2), 0.22, 0.28, 3.15, 2.0, BACK, 0x6a4a2a, 0.02);
    this.framed(polaroidTex(3), 0.18, 0.22, 3.55, 2.38, BACK, 0x2a2018, 0.02);
    // fairy lights wound along the rail
    const pts = [];
    for (let i = 0; i <= 16; i++) { const x = x0 + 0.1 + i * (n * run - 0.2) / 16; pts.push([x, railY(x) - 0.04 - (i % 2 ? 0.06 : 0), BACK + w - 0.01]); }
    this.fairyLights('stairLights', pts, 44, { on: { evening: 1, night: 0, day: 0 } });
    void ceilM;
  }

  buildKitchen(BACK, H, wallM) {
    const oak = this.texM('oakGrey', oakTex(0), { roughness: 0.6 });
    const tileTop = this.texM('redTileTop', redTileTex(), { roughness: 0.18, metalness: 0.05 });
    const x0 = 4.25, x1 = 5.75, cx = (x0 + x1) / 2, cw = x1 - x0, zc = BACK + 0.31;
    // backsplash
    const bs = new THREE.PlaneGeometry(cw, 0.64); bs.translate(cx, 1.24, BACK + 0.006); worldUV(bs, 0.4, 0.4);
    this.root.add(new THREE.Mesh(bs, tileTop));
    // lower run: open oak frame, tiled top, shelves with white crates
    this.rb(cw + 0.04, 0.06, 0.64, 0.012, tileTop, cx, 0.89, zc, { uv: [0.4, 0.4] });
    this.rb(cw + 0.05, 0.05, 0.035, 0.012, oak, cx, 0.86, zc + 0.31);
    for (const x of [x0 + 0.03, 4.98, x1 - 0.03]) this.rb(0.06, 0.84, 0.6, 0.012, oak, x, 0.42, zc, { uv: [0.3, 1.2] });
    for (const y of [0.08, 0.46]) this.rb(cw - 0.04, 0.03, 0.58, 0.008, oak, cx, y, zc);
    const crateM = this.M('crate', 0xe2dccc, { roughness: 0.9 }), holeM = this.M('crateHole', 0x3a3028);
    for (const [x, y] of [[4.6, 0.1], [5.18, 0.1], [5.52, 0.1], [4.6, 0.48]]) {
      this.rb(0.32, 0.3, 0.44, 0.015, crateM, x, y + 0.165, zc + 0.04);
      for (let k = 0; k < 4; k++) this.rb(0.322, 0.008, 0.442, 0.002, this.M('crateLine', 0xb8b0a0), x, y + 0.06 + k * 0.07, zc + 0.04);
      this.rb(0.1, 0.03, 0.01, 0.008, holeM, x, y + 0.26, zc + 0.265);
    }
    const potM = this.M('pot', 0x6a6e72, { roughness: 0.3, metalness: 0.8 });
    this.lathe([[0.001, 0], [0.12, 0], [0.13, 0.12], [0.125, 0.12], [0.001, 0.01]], potM, 5.3, 0.495, zc);
    this.lathe([[0.001, 0], [0.08, 0], [0.14, 0.08], [0.13, 0.08], [0.001, 0.01]], this.M('bowl', 0xb8582a, { roughness: 0.4 }), 5.55, 0.495, zc);
    // white ceramic sink + brass mixer
    const cer = this.M('ceramic', 0xf0eee8, { roughness: 0.15 });
    this.rb(0.62, 0.1, 0.46, 0.04, cer, 4.75, 0.93, zc + 0.02);
    this.rb(0.3, 0.02, 0.36, 0.03, this.M('sinkIn', 0xcac8c2, { roughness: 0.2 }), 4.66, 0.975, zc + 0.04);
    for (let k = 0; k < 5; k++) this.rb(0.018, 0.012, 0.3, 0.005, cer, 4.9 + k * 0.035, 0.985, zc + 0.04);
    const br = this.brass();
    this.lathe([[0.001, 0], [0.03, 0], [0.025, 0.02], [0.015, 0.05], [0.015, 0.2], [0.001, 0.2]], br, 4.66, 0.98, BACK + 0.08);
    this.tube([[4.66, 1.17, BACK + 0.08], [4.66, 1.26, BACK + 0.12], [4.66, 1.24, BACK + 0.22], [4.66, 1.14, BACK + 0.26]], 0.012, br, { seg: 16 });
    this.rb(0.06, 0.012, 0.012, 0.005, this.M('porcelainLever', 0xf4f2ec), 4.72, 1.1, BACK + 0.08, { rz: 0.4 });
    // worktop clutter: utensil pots, an iron teapot, a bread board, a jar
    const steel = this.M('steelPot', 0xa0a4a8, { roughness: 0.3, metalness: 0.85 });
    for (const x of [5.32, 5.45]) {
      this.cy(0.045, 0.045, 0.15, steel, x, 0.995, BACK + 0.12, { open: true });
      for (let k = 0; k < 4; k++) this.rod([x, 0.95, BACK + 0.12], [x + (k - 1.5) * 0.02, 1.22 + k * 0.01, BACK + 0.1 + (k % 2) * 0.03], 0.006, this.M('spoon', 0xb88a50));
    }
    this.sph(0.08, this.M('ironPot', 0x2a2c2c, { roughness: 0.5, metalness: 0.4 }), 5.62, 0.98, BACK + 0.2, { sy: 0.8 });
    this.rb(0.3, 0.4, 0.025, 0.01, this.M('board', 0xc8a070, { roughness: 0.7 }), 4.38, 1.12, BACK + 0.06, { rx: -0.12 });
    this.lathe([[0.001, 0], [0.05, 0], [0.05, 0.14], [0.03, 0.16], [0.001, 0.16]], this.M('jar', 0xe8dcc0, { roughness: 0.4 }), 5.15, 0.92, BACK + 0.12);
    // upper cabinets: stained glass doors (lit from inside) + a long glazed cabinet with jars
    const up0 = 1.62, up1 = 2.32, uz = BACK + 0.17;
    this.rb(cw, up1 - up0, 0.34, 0.015, oak, cx, (up0 + up1) / 2, uz, { uv: [0.3, 1.2] });
    const stM = this.glowM('stained', 0xffffff, 0xffd8a0, { map: stainedTex(), emissiveMap: stainedTex(), roughness: 0.25 });
    for (const [x, ww] of [[4.43, 0.32], [4.77, 0.32]]) {
      this.rb(ww, up1 - up0 - 0.02, 0.025, 0.008, oak, x, (up0 + up1) / 2, uz + 0.17);
      this.pl(ww - 0.08, up1 - up0 - 0.12, stM, x, (up0 + up1) / 2, uz + 0.184);
      this.tube([[x + (x < 4.6 ? 0.12 : -0.12), 1.86, uz + 0.19], [x + (x < 4.6 ? 0.135 : -0.135), 1.9, uz + 0.22], [x + (x < 4.6 ? 0.135 : -0.135), 2.02, uz + 0.22], [x + (x < 4.6 ? 0.12 : -0.12), 2.06, uz + 0.19]], 0.008, br, { seg: 12 });
    }
    const glassBox = this.glowM('cabGlass', 0x8a7a60, 0x4a3218, { roughness: 0.1 });
    this.rb(0.76, 0.42, 0.025, 0.008, oak, 5.36, 2.08, uz + 0.17);
    this.pl(0.68, 0.34, glassBox, 5.36, 2.08, uz + 0.184);
    for (let k = 0; k < 4; k++) this.lathe([[0.001, 0], [0.045, 0], [0.05, 0.15], [0.03, 0.17], [0.001, 0.17]], this.M('jarGlass', 0xc8d4cc, { roughness: 0.1, transparent: true, opacity: 0.6 }), 5.1 + k * 0.17, 1.9, uz + 0.17 + 0.03);
    this.rb(0.76, 0.24, 0.3, 0.01, oak, 5.36, 1.74, uz);
    // copper kettle on top, the bare bulb under the cabinet
    const copper = this.M('copper', 0xb0603a, { roughness: 0.3, metalness: 0.8 });
    this.lathe([[0.001, 0], [0.11, 0], [0.13, 0.06], [0.12, 0.13], [0.06, 0.18], [0.02, 0.19], [0.001, 0.2]], copper, 5.45, up1, uz);
    this.tube([[5.35, up1 + 0.08, uz], [5.25, up1 + 0.16, uz], [5.22, up1 + 0.2, uz]], 0.014, copper);
    this.torus(0.08, 0.01, copper, 5.45, up1 + 0.2, uz, { arc: Math.PI });
    const bulbM = this.glowM('kBulb', 0xf0e8d8, 0xffd8a0);
    this.cy(0.02, 0.02, 0.03, this.white(), 5.0, up0 - 0.015, BACK + 0.08);
    this.sph(0.03, bulbM, 5.0, up0 - 0.06, BACK + 0.1);
    this.lamp('kitchenBulb', {
      light: this.pointLight(0xffc890, 2.0, 3.5, 5.0, up0 - 0.12, BACK + 0.35, 1.4),
      glows: [this.halo(0xffd0a0, 0.5, 0.5, 5.0, up0 - 0.06, BACK + 0.14), (() => { const p = lightPool(0xffb070, 1.6, 0.9, 0.3); p.position.set(5.0, 1.2, BACK + 0.012); return p; })()],
      mats: [[bulbM, 3], [stM, 0.6], [glassBox, 0.8]], on: { evening: 1, night: 0, day: 0 },
    });
    // the fridge: cream, rounded, magnets and drawings
    const fz = BACK + 0.36;
    this.rb(0.66, 1.78, 0.66, 0.07, this.M('fridge', 0xe8e2d2, { roughness: 0.35 }), 6.1, 0.89, fz, { seg: 3 });
    this.rb(0.64, 0.012, 0.01, 0.004, this.M('fridgeGap', 0x8a8478), 6.1, 1.3, fz + 0.332);
    const chrome = this.M('chrome', 0xd8dce0, { roughness: 0.15, metalness: 0.9 });
    this.rb(0.03, 0.3, 0.04, 0.012, chrome, 5.83, 1.0, fz + 0.35); this.rb(0.03, 0.18, 0.04, 0.012, chrome, 5.83, 1.48, fz + 0.35);
    const fr = rng(5);
    [[0, 6.02, 1.0], [1, 6.24, 0.82], [2, 6.18, 1.55]].forEach(([k, x, y]) => this.pl(0.17, 0.21, this.texM(`drawing-${k}`, drawingTex(k), { roughness: 0.9 }), x, y, fz + 0.333, { rz: (fr() - 0.5) * 0.15 }));
    this.pl(0.12, 0.09, this.texM('family', familyPhotoTex(), { roughness: 0.5 }), 6.0, 1.36, fz + 0.333, { rz: 0.06 });
    for (let k = 0; k < 7; k++) this.rb(0.03, 0.03, 0.015, 0.008, this.M(`magnet-${k % 4}`, [0xc83a2a, 0xe0b030, 0x3a6ac8, 0x3a9a5a][k % 4], { roughness: 0.4 }), 5.92 + fr() * 0.36, 0.7 + fr() * 1.0, fz + 0.338);
    this.lathe([[0.001, 0], [0.16, 0], [0.18, 0.12], [0.001, 0.12]], this.M('basket', 0x9a7a4a), 6.1, 1.78, fz, { sz: 0.7 });
    // the island: oak top on turned legs, a basket shelf; Julian's case laid out on it
    const top = this.texM('oakMid', oakTex(1), { roughness: 0.55 });
    const ix = 5.05, iz = -0.95;
    this.rb(1.32, 0.055, 0.78, 0.015, top, ix, 0.895, iz, { uv: [0.3, 1.2] });
    this.rb(1.2, 0.1, 0.66, 0.01, oak, ix, 0.82, iz);
    this.rb(1.16, 0.025, 0.62, 0.008, oak, ix, 0.2, iz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) turnedLeg(this, oak, ix + sx * 0.6, 0, iz + sz * 0.32, 0.87, 0.035);
    this.rb(0.36, 0.2, 0.3, 0.04, this.M('basket', 0x9a7a4a), ix - 0.3, 0.32, iz);
    this.rb(0.36, 0.2, 0.3, 0.04, this.M('basket', 0x9a7a4a), ix + 0.15, 0.32, iz);
    // the case: an open manila folder, papers, prints, a mug, the laptop
    const manila = this.M('manila', 0xd8bc80, { roughness: 0.9 });
    const tY = 0.925;
    this.rb(0.3, 0.006, 0.24, 0.002, manila, ix - 0.42, tY, iz + 0.02, { ry: 0.1 });
    this.rb(0.3, 0.006, 0.24, 0.002, manila, ix - 0.12, tY, iz + 0.03, { ry: 0.08 });
    this.pl(0.21, 0.28, this.texM('paper-0', paperTex(0)), ix - 0.12, tY + 0.005, iz + 0.03, { rx: -Math.PI / 2, rz: 0.08 });
    this.pl(0.21, 0.28, this.texM('paper-1', paperTex(1)), ix - 0.43, tY + 0.005, iz + 0.0, { rx: -Math.PI / 2, rz: -0.12 });
    const pr = rng(9);
    for (let k = 0; k < 6; k++) {
      const px = ix - 0.5 + (k % 3) * 0.2 + pr() * 0.05, pz = iz + 0.22 + Math.floor(k / 3) * 0.12 - 0.04;
      this.pl(0.15, 0.11, this.texM(`casephoto-${k}`, casePhotoTex(k), { roughness: 0.4 }), px, tY + 0.006 + k * 0.0006, pz, { rx: -Math.PI / 2, rz: (pr() - 0.5) * 0.5 });
    }
    this.mug(ix + 0.05, 0.922, iz - 0.25, 0xd8d0c0, 1.2);
    this.rod([ix - 0.26, 0.926, iz - 0.2], [ix - 0.12, 0.926, iz - 0.15], 0.004, this.M('pen', 0x1a2a6a));
    const lapM = this.M('laptop', 0x8a8e94, { roughness: 0.35, metalness: 0.6 });
    this.rb(0.34, 0.018, 0.24, 0.006, lapM, ix + 0.38, 0.93, iz + 0.02, { ry: -0.25 });
    const scrM = this.glowM('laptopScreen', 0x1a2230, 0xffffff, { map: laptopTex(), emissiveMap: laptopTex(), roughness: 0.3 });
    this.withT(ix + 0.38, iz + 0.02, -0.25, () => {
      this.rb(0.34, 0.22, 0.01, 0.005, lapM, 0, 0.93 + 0.11, -0.13, { rx: -0.25 });
      this.pl(0.31, 0.19, scrM, 0, 0.93 + 0.11, -0.122, { rx: -0.25 });
    });
    this.lamp('laptop', { mats: [[scrM, 0.55]], glows: [this.halo(0x8ab0ff, 0.5, 0.12, ix + 0.38, 1.05, iz - 0.05)], on: { evening: 1, night: 0, day: 0.6 } });
    // bar stools at both ends
    const stool = (x) => {
      const m = this.texM('oakDark', oakTex(2), { roughness: 0.6 });
      this.lathe([[0.001, 0], [0.17, 0], [0.18, 0.02], [0.17, 0.045], [0.001, 0.05]], m, x, 0.7, iz);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; this.rod([x + Math.cos(a) * 0.1, 0.7, iz + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.19, 0, iz + Math.sin(a) * 0.19], 0.016, m); }
      this.torus(0.15, 0.01, m, x, 0.28, iz, { rx: Math.PI / 2 });
    };
    stool(4.12); stool(5.98);
    // enamel pendants over the island
    const enamel = this.M('enamel', 0x2a4a3a, { roughness: 0.3 });
    const inner = this.glowM('pendantIn', 0xf0e8d8, 0xffd8a0, { side: THREE.DoubleSide });
    const halos = [];
    for (const x of [4.75, 5.35]) {
      this.rod([x, H, iz], [x, 1.98, iz], 0.004, this.M('cord', 0x1a1a1a));
      this.lathe([[0.02, 0.2], [0.04, 0.17], [0.09, 0.12], [0.16, 0.02], [0.17, 0]], enamel, x, 1.78, iz);
      this.lathe([[0.16, 0.005], [0.085, 0.11], [0.03, 0.16]], inner, x, 1.78, iz);
      halos.push(this.halo(0xffd0a0, 0.6, 0.45, x, 1.82, iz + 0.05));
    }
    this.lamp('pendants', { light: this.pointLight(0xffc890, 4.0, 6, 5.05, 1.6, -0.9, 1.3), glows: halos, mats: [[inner, 1.6]], on: { evening: 1, night: 0, day: 0 }, flare: { pos: V3(5.05, 1.8, iz) } });
    void wallM;
  }
}

// ------------------------------------------------------------------ Julian's bedroom

/**
 * Julian's bedroom (back wall z −3.0, ceiling 2.6), after the reference: greige walls, grey
 * carpet, a dark sleigh bed with a striped duvet (headboard on the left wall), the window with a
 * cellular shade, a dark dresser with a mirror, the desk under the case board (photos, red
 * string), a crystal flush light, the white panel door.
 */
export class ApartmentBedroomScene extends AptBase {
  constructor(opts) {
    super(opts);
    this.id = 'apt_bedroom';
    this.title = 'Спальня';
    this.camera = { distance: 6.2, height: 1.5, lookHeight: 1.35, lookZ: -1.0 };
    this.bounds = {
      walk: { areas: [{ minX: -1.2, maxX: 3.3, minZ: -2.3, maxZ: 0.8 }, { minX: -3.0, maxX: -1.2, minZ: -0.55, maxZ: 0.8 }] },
      camera: { minX: -0.6, maxX: 0.5 },
    };
  }

  build() {
    const BACK = -3.0, H = 2.8, XL = -3.7, XR = 3.7;
    this.setupLights();
    this.floorRect(XL, XR, BACK, 3, this.texM('carpet', carpetTex(), { roughness: 1 }), 0.32);
    const wallM = this.texM('wallBed', paintTex('bed', [168, 156, 142]), { roughness: 0.95 });
    this.wall(XL, XR, H, BACK, wallM, [{ x0: -2.55, x1: -1.65, y0: 0.95, y1: 2.25 }, { x0: 2.55, x1: 3.35, y0: 0, y1: 2.06 }]);
    this.sideWall(XL, BACK, 2.5, H, wallM, 1);
    this.sideWall(XR, BACK, 2.5, H, wallM, -1);
    this.ceilingPoly([[XL, BACK - 0.5], [XR, BACK - 0.5], [XR, 2.5], [XL, 2.5]], H, this.M('ceilB', 0xe8e4dc, { roughness: 1, emissive: 0x100e0a }));
    this.trims([[XL, 2.55], [3.35, XR]], BACK, H, { crown: false });
    this.trims([[XL, XR]], BACK, H, { skirt: false });
    // window + view
    this.withT(-2.1, BACK, 0, () => this.windowUnit(0.9, 0.95, 2.25, { kind: 'double', muntins: [2, 3], blind: { kind: 'cell', cover: 0.22 } }));
    this.viewPlane(5, 3.6, -2.1, 1.6, BACK - 2.4, 'low');
    // door
    this.withT(2.95, BACK, 0, () => panelDoor(this, 0.8, 2.06, 0xeae6de));
    this.rb(0.08, 0.12, 0.015, 0.006, this.white(), 2.38, 1.2, BACK + 0.008);

    const dark = this.texM('darkwood', darkWoodTex(), { roughness: 0.35 });
    // ---- the bed (head on the left wall)
    const bz = -1.95, bw = 1.62;
    this.rb(0.09, 1.35, bw + 0.14, 0.03, dark, -3.6, 0.675, bz);
    for (let k = 0; k < 4; k++) this.rb(0.02, 0.14, bw - 0.1, 0.006, dark, -3.55, 0.75 + k * 0.17, bz);
    this.rb(0.13, 0.08, bw + 0.2, 0.03, dark, -3.6, 1.38, bz);
    this.rb(0.1, 0.8, bw + 0.14, 0.03, dark, -1.45, 0.4, bz);
    this.rb(0.14, 0.07, bw + 0.2, 0.03, dark, -1.45, 0.82, bz, { rz: 0.15 });
    for (const s of [-1, 1]) this.rb(2.12, 0.24, 0.06, 0.02, dark, -2.52, 0.3, bz + s * (bw / 2 + 0.02));
    this.rb(2.04, 0.26, bw, 0.07, this.M('mattress', 0xe8e6e0, { roughness: 0.95 }), -2.52, 0.5, bz);
    const stripes = this.texM('stripes', stripeTex(), { roughness: 0.95, side: THREE.DoubleSide });
    this.drape(1.62, bw + 0.04, 0.3, stripes, -2.36, 0.64, bz, { sides: [0, 1, 1, 1], uv: [0.64, 0.32], seed: 3, wrinkle: 0.02, seg: [48, 30], r: 0.05 });
    // turned-back top edge
    this.cush(0.22, 0.07, bw, 0.03, stripes, -3.08, 0.66, bz, { puff: 0.2, seed: 12 });
    const sheet = this.M('sheet', 0xf0eee8, { roughness: 0.95 });
    for (const z of [bz - 0.4, bz + 0.4]) {
      this.cush(0.5, 0.17, 0.74, 0.08, sheet, -3.3, 0.78, z, { rz: 0.55, seed: 13, puff: 0.5 });
      this.cush(0.45, 0.15, 0.7, 0.07, stripes, -3.12, 0.76, z, { rz: 0.35, seed: 14, puff: 0.5 });
    }
    // front nightstand with a lamp (the one that stays on at night)
    this.rb(0.5, 0.6, 0.44, 0.02, dark, -3.35, 0.3, -0.72);
    this.rb(0.44, 0.2, 0.02, 0.006, dark, -3.35, 0.42, -0.49);
    this.torus(0.02, 0.004, this.brass(), -3.35, 0.4, -0.475, { ts: 16, rs: 6 });
    this.lathe([[0.001, 0], [0.06, 0], [0.09, 0.08], [0.08, 0.2], [0.03, 0.26], [0.012, 0.32], [0.001, 0.32]], this.M('lampBase', 0xc8c4bc, { roughness: 0.2, metalness: 0.3 }), -3.35, 0.6, -0.75);
    const shadeM = this.glowM('bedShade', 0xece4d4, 0xffc890, { side: THREE.DoubleSide });
    this.cy(0.13, 0.16, 0.22, shadeM, -3.35, 1.0, -0.75, { open: true, seg: 24 });
    this.lamp('bedLamp', { light: this.pointLight(0xffc488, 2.6, 5, -3.2, 1.0, -0.6, 1.3), glows: [this.halo(0xffc890, 0.9, 0.4, -3.35, 1.0, -0.7)], mats: [[shadeM, 1.2]], on: { evening: 1, night: 1, day: 0 }, flare: { pos: V3(-3.35, 1.0, -0.7) } });
    this.bookStack(-3.3, 0.6, -0.65, 2, 71);
    // ---- dresser + mirror
    const dx = -0.15, dz = BACK + 0.26;
    this.rb(1.3, 0.92, 0.5, 0.02, dark, dx, 0.5, dz);
    this.rb(1.36, 0.04, 0.54, 0.012, dark, dx, 0.975, dz);
    for (let j = 0; j < 4; j++) for (const s of [-1, 1]) {
      this.rb(0.6, 0.19, 0.02, 0.006, dark, dx + s * 0.31, 0.17 + j * 0.21, dz + 0.255);
      this.torus(0.025, 0.004, this.M('ringPull', 0xc8ccd0, { metalness: 0.9, roughness: 0.25 }), dx + s * 0.31, 0.2 + j * 0.21, dz + 0.27, { ts: 16, rs: 6 });
    }
    this.rb(0.82, 1.02, 0.04, 0.015, dark, dx, 1.62, BACK + 0.03);
    this.pl(0.72, 0.92, this.texM('mirror', mirrorTex(), { roughness: 0.1, metalness: 0.2 }), dx, 1.62, BACK + 0.052);
    this.framed(familyPhotoTex(), 0.16, 0.12, dx - 0.4, 1.08, dz - 0.05, 0x1a1410, 0.01);
    this.rb(0.24, 0.02, 0.14, 0.006, this.M('tray2', 0x2a2420, { roughness: 0.3 }), dx + 0.3, 1.005, dz);
    this.torus(0.03, 0.006, this.M('watch', 0x8a8e94, { metalness: 0.8, roughness: 0.3 }), dx + 0.28, 1.02, dz, { rx: Math.PI / 2, ts: 16 });
    this.rb(0.1, 0.02, 0.05, 0.008, this.M('keys', 0xb0b4b8, { metalness: 0.8 }), dx + 0.36, 1.02, dz + 0.02);
    // ---- desk + chair + banker's lamp
    const kx = 1.5, kz = BACK + 0.3;
    this.rb(1.2, 0.04, 0.6, 0.012, dark, kx, 0.76, kz);
    this.rb(0.42, 0.72, 0.56, 0.015, dark, kx + 0.38, 0.37, kz);
    for (let j = 0; j < 3; j++) { this.rb(0.38, 0.2, 0.02, 0.006, dark, kx + 0.38, 0.16 + j * 0.23, kz + 0.285); this.rb(0.08, 0.015, 0.015, 0.005, this.brass(), kx + 0.38, 0.2 + j * 0.23, kz + 0.3); }
    for (const sz of [-1, 1]) this.rb(0.04, 0.74, 0.04, 0.01, dark, kx - 0.56, 0.37, kz + sz * 0.26);
    this.withT(kx - 0.05, -2.12, 0.15, () => {
      this.rb(0.44, 0.05, 0.42, 0.015, dark, 0, 0.46, 0);
      this.cush(0.4, 0.04, 0.38, 0.015, this.M('chairPad', 0x4a2a24, { roughness: 0.9 }), 0, 0.5, 0, { seed: 20 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.rb(0.035, 0.45, 0.035, 0.01, dark, sx * 0.18, 0.225, sz * 0.17);
      for (const sx of [-1, 1]) this.rb(0.035, 0.45, 0.035, 0.01, dark, sx * 0.18, 0.7, 0.19);
      this.rb(0.42, 0.1, 0.025, 0.01, dark, 0, 0.88, 0.2);
      this.drape(0.38, 0.06, 0.3, this.M('jacket', 0x2c2a2c, { roughness: 0.95, side: THREE.DoubleSide }), 0, 0.94, 0.2, { sides: [0, 0, 1, 1], seed: 21, r: 0.03 });
    });
    this.lathe([[0.001, 0], [0.08, 0], [0.08, 0.02], [0.02, 0.04], [0.012, 0.3], [0.001, 0.3]], this.brass(), kx - 0.35, 0.78, kz - 0.1);
    const green = this.glowM('bankerShade', 0x1e5a3a, 0x60c080, { roughness: 0.15 });
    this.cy(0.06, 0.06, 0.32, green, kx - 0.35, 1.06, kz - 0.06, { rz: Math.PI / 2, seg: 20 });
    this.lamp('deskLamp', { light: this.pointLight(0xffd8a0, 2.2, 4, kx - 0.3, 1.0, kz + 0.15, 1.4), glows: [this.halo(0xffd8a0, 0.6, 0.35, kx - 0.35, 0.98, kz)], mats: [[green, 0.5]], on: { evening: 1, night: 0, day: 0 } });
    const manila = this.M('manila', 0xd8bc80, { roughness: 0.9 });
    for (let k = 0; k < 4; k++) this.rb(0.24, 0.012, 0.32, 0.003, manila, kx + 0.08, 0.786 + k * 0.013, kz - 0.02, { ry: (k - 1.5) * 0.08 });
    this.pl(0.21, 0.28, this.texM('paper-2', paperTex(2)), kx - 0.12, 0.787, kz + 0.12, { rx: -Math.PI / 2, rz: 0.3 });
    this.mug(kx + 0.42, 0.78, kz + 0.1, 0x2a2a30, 0.4);
    this.rb(0.34, 0.02, 0.24, 0.006, this.M('laptop', 0x8a8e94, { roughness: 0.35, metalness: 0.6 }), kx + 0.38, 0.79, kz - 0.08);
    // ---- the case board: cork, prints, cards, pins and red string
    const bx = kx, by = 1.75, bwid = 1.3, bh = 0.86;
    this.pl(bwid, bh, this.texM('caseboard', boardTex(), { roughness: 0.95 }), bx, by, BACK + 0.022);
    for (const [w, h, x, y] of [[bwid + 0.08, 0.04, bx, by + bh / 2 + 0.02], [bwid + 0.08, 0.04, bx, by - bh / 2 - 0.02], [0.04, bh, bx - bwid / 2 - 0.02, by], [0.04, bh, bx + bwid / 2 + 0.02, by]]) this.rb(w, h, 0.035, 0.01, this.texM('oakMid', oakTex(1), { roughness: 0.55 }), x, y, BACK + 0.02);
    const pins = BOARD_ITEMS.map(([x, y, iw]) => V3(bx - bwid / 2 + ((x + iw / 2) / 240) * bwid, by + bh / 2 - ((y + 3) / 160) * bh, BACK + 0.035));
    const pinCols = [0xc82020, 0xe0c020, 0x2050c0, 0xc82020];
    pins.forEach((p, i) => { this.sph(0.009, this.M(`pin-${i % 4}`, pinCols[i % 4], { roughness: 0.3 }), p.x, p.y, p.z + 0.006, { ws: 16, hs: 12 }); this.rod([p.x, p.y, p.z - 0.01], [p.x, p.y, p.z + 0.004], 0.0015, this.M('pinSteel', 0xc0c4c8, { metalness: 0.8 })); });
    const string = this.M('redString', 0xd01818, { roughness: 0.7, emissive: 0x200000 });
    for (const [a, b] of [[0, 2], [2, 6], [1, 5], [5, 6], [4, 5], [6, 7], [3, 7], [9, 10], [8, 9], [5, 9], [2, 3]]) this.rod([pins[a].x, pins[a].y, pins[a].z + 0.004], [pins[b].x, pins[b].y, pins[b].z + 0.004], 0.0025, string, { seg: 6 });
    // ---- crystal flush light
    const cx = -0.8, cz = -1.6;
    const brass = this.brass();
    this.lathe([[0.001, 0], [0.16, 0], [0.16, 0.03], [0.001, 0.05]], brass, cx, H - 0.05, cz);
    const crystal = this.glowM('crystal', 0xf8f0e4, 0xffe0b0, { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 });
    const cr = rng(41);
    for (let t = 0; t < 4; t++) {
      const R = 0.2 - t * 0.04, n = 14 - t * 2, y = H - 0.1 - t * 0.09;
      this.torus(R, 0.006, brass, cx, y, cz, { rx: Math.PI / 2 });
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + t * 0.2; this._add(new THREE.OctahedronGeometry(0.018, 0), crystal, cx + Math.cos(a) * R, y - 0.04 - cr() * 0.02, cz + Math.sin(a) * R, { sy: 2.2 }); }
    }
    this._add(new THREE.OctahedronGeometry(0.03, 0), crystal, cx, H - 0.5, cz, { sy: 1.8 });
    this.lamp('chandelier', { light: this.pointLight(0xffe0b4, 3.2, 7, cx, H - 0.45, cz, 1.2), glows: [this.halo(0xffe8c0, 1.1, 0.4, cx, H - 0.25, cz)], mats: [[crystal, 1.2]], on: { evening: 1, night: 0, day: 0 }, flare: { pos: V3(cx, H - 0.25, cz) } });
    // small prints over the bed head, a hamper by the dresser
    this.framed(treeArtTex(), 0.4, 0.26, -3.05, 1.85, BACK, 0x1a1410, 0.03);
    // white bifold closet on the right wall (the reference's white doors), a soft rug
    this.withT(XR - 0.06, -1.25, -Math.PI / 2, () => { for (const s of [-1, 1]) this.withT(s * 0.31, 0, 0, () => panelDoor(this, 0.6, 2.06, 0xeae6de)); });
    this.rb(1.9, 0.014, 1.25, 0.006, this.texM('shagB', shagTex(), { roughness: 1, color: 0xc0b4a4 }), 0.6, 0.007, -0.85, { uv: [0.64, 0.64] });
    this.lathe([[0.001, 0], [0.16, 0], [0.18, 0.5], [0.001, 0.5]], this.M('hamper', 0x8a7a5a, { roughness: 1 }), 0.85, 0, BACK + 0.3);
    this.flushBatches();
    // ---- light
    this.lamp('fillB', { light: this.pointLight(0xffc088, 1.6, 8, 0.2, 2.2, 0.3, 1.2), on: { evening: 1, night: 0, day: 0 } });
    this.lamp('dayFillB', { light: this.pointLight(0xdfe6ee, 2.0, 9, -1.5, 2.0, -1.4, 1.0), on: { evening: 0, night: 0, day: 1 } });
    this.lamp('moonB', { light: this.pointLight(0x7890c8, 1.4, 6, -2.1, 1.8, -2.4, 1.2), on: { evening: 0, night: 1, day: 0 } });
    this.statePool(0x5a74b8, -2.1, 0.665, -1.95, 1.2, 1.4, 0.3, ['night']);
    this.statePool(0x5a74b8, -0.8, 0.02, -1.0, 1.4, 1.2, 0.2, ['night']);
    this.statePool(0xc8d4e0, -2.1, 0.665, -1.95, 1.2, 1.4, 0.15, ['day']);
    this.windowLights.push(
      flareSource('PALE', V3(-2.1, 1.7, BACK), { triggerDistance: 2.2, intensity: 0.45, enabled: () => this.state === 'day' }),
      flareSource('MOON', V3(-2.1, 1.8, BACK), { triggerDistance: 2.2, enabled: () => this.state === 'night' }),
    );
    // ---- contract
    this.colliders.push({ x: -3.0, z: -1.95, r: 0.6 }, { x: -1.95, z: -1.95, r: 0.6 }, { x: -3.35, z: -0.72, r: 0.3 }, { x: 1.45, z: -2.12, r: 0.28 });
    this.doors = [{ id: 'bed_out', label: 'В гостиную', x: 2.95, z: -2.15, radius: 0.8, anchor: V3(2.95, 1.7, BACK + 0.15), to: 'apartment', spawn: { x: 1.2, z: -1.75, facing: 1 } }];
    this.spots = { entry: { x: 2.95, z: -1.9, facing: -1 }, bedSide: { x: -1.05, z: -1.5, facing: -1 }, desk: { x: 1.5, z: -1.6, facing: 1 } };
    Object.assign(this.anchors, { board: V3(bx, by, BACK + 0.1), mirror: V3(dx, 1.62, BACK + 0.1), bed: V3(-2.4, 0.9, bz), window: V3(-2.1, 1.6, BACK + 0.1) });
    this.setState('evening');
    return this.root;
  }
}

// ------------------------------------------------------------------ Lizzie's attic

/**
 * Lizzie's room under the roof (knee wall z −3.0 at 1.3 m, the roof slope rising to 2.55 m at
 * z −1.0, flat ceiling toward the camera), after the reference: oak desk with a hutch and an
 * anglepoise, a salt lamp, butterfly and mushroom prints on the slope, a gig poster and a pinned
 * map of the Yukon, a single oak bed with a ticking duvet and a patchwork quilt, a dormer with a
 * roman shade, a jute rug, fairy lights, polaroids round the mirror, her camera, her backpack.
 * The stairs come up through the floor on the right.
 */
const KW = 1.3, SLOPE = 0.625;   // knee wall height, rise per metre of z
const slopeY = (z) => KW + (z + 3) * SLOPE;
export class ApartmentAtticScene extends AptBase {
  constructor(opts) {
    super(opts);
    this.id = 'apt_attic';
    this.title = 'Комната Лиззи';
    this.camera = { distance: 6.2, height: 1.5, lookHeight: 1.35, lookZ: -1.0 };
    this.bounds = {
      walk: { areas: [{ minX: -2.9, maxX: 2.15, minZ: -1.85, maxZ: 0.8 }, { minX: 2.15, maxX: 3.2, minZ: -0.02, maxZ: 0.8 }] },
      camera: { minX: -0.4, maxX: 0.4 },
    };
  }

  /** A flat item lying on the roof slope at x, slope distance s from the knee wall. */
  onSlope(w, h, mat, x, s, lift = 0.006) {
    const L = Math.hypot(2, 2 * SLOPE), cs = 2 / L, sn = 2 * SLOPE / L;   // along-slope direction (0, sn, cs)
    const rx = Math.atan2(cs, sn);
    return this.pl(w, h, mat, x, KW + s * sn - lift * cs, -3 + s * cs + lift * sn, { rx });
  }
  slopePoint(x, s, lift = 0.01) {
    const L = Math.hypot(2, 2 * SLOPE), cs = 2 / L, sn = 2 * SLOPE / L;
    return V3(x, KW + s * sn - lift * cs, -3 + s * cs + lift * sn);
  }

  build() {
    const BACK = -3.0, H = 2.55, XL = -3.5, XR = 3.5;
    this.setupLights();
    const wallM = this.texM('wallAttic', paintTex('attic', [226, 218, 200]), { roughness: 0.95 });
    const slopeM = this.texM('wallAtticS', paintTex('attic', [226, 218, 200]), { roughness: 0.95, side: THREE.DoubleSide });
    // ---- floor with the stair hole (x 2.35…3.35, z −1.35…−0.25)
    const fl = this.plankMat(2);
    this.floorRect(XL, XR, BACK, -1.35, fl);
    this.floorRect(XL, 2.35, -1.35, -0.25, fl);
    this.floorRect(3.35, XR, -1.35, -0.25, fl);
    this.floorRect(XL, XR, -0.25, 3, fl);
    // ---- knee wall (two runs either side of the dormer), dormer front with the window
    this.wall(XL, 1.2, KW, BACK, wallM);
    this.wall(2.4, XR, KW, BACK, wallM);
    const dTop = 2.35, zD = -3 + (dTop - KW) / SLOPE;
    this.withT(1.8, BACK, 0, () => {
      this._add(holeWallGeo(1.2, dTop, [{ x0: -0.4, x1: 0.4, y0: 0.9, y1: 2.15 }]), wallM);
      this.windowUnit(0.8, 0.9, 2.15, { kind: 'double', muntins: [2, 2], frameColor: 0x5a4030, blind: { kind: 'roman', color: 0x34465a, cover: 0.32 } });
      this.rb(1.2, 0.11, 0.025, 0.008, this.white(), 0, 0.055, 0.013);
    });
    this.viewPlane(5, 4, 1.8, 1.7, BACK - 2.6, 'high');
    // dormer cheeks + ceiling
    for (const [x, dir] of [[1.2, 1], [2.4, -1]]) {
      const pts = dir > 0 ? [[3, KW], [3, dTop], [-zD, dTop]] : [[-3, KW], [zD, dTop], [-3, dTop]];
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))));
      this._add(g, slopeM, x, 0, 0, { ry: dir > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
    this.ceilingPoly([[1.2, BACK], [2.4, BACK], [2.4, zD], [1.2, zD]], dTop, slopeM);
    // ---- the roof slope (three pieces round the dormer) and the flat ceiling
    const L = Math.hypot(2, 2 * SLOPE), sD = (dTop - KW) / SLOPE * L / 2;
    const slopePiece = (x0, x1, s0, s1) => {
      const g = new THREE.PlaneGeometry(x1 - x0, s1 - s0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 2, uv.getY(i) * (s1 - s0) / 2);
      const m = new THREE.Mesh(g, slopeM);
      m.rotation.x = Math.atan2(2 / L, 2 * SLOPE / L);
      const sm = (s0 + s1) / 2;
      m.position.set((x0 + x1) / 2, KW + sm * (2 * SLOPE / L), -3 + sm * (2 / L));
      this.root.add(m);
    };
    slopePiece(XL, 1.2, 0, L); slopePiece(2.4, XR, 0, L); slopePiece(1.2, 2.4, sD, L);
    this.ceilingPoly([[XL, -1.0], [XR, -1.0], [XR, 2.6], [XL, 2.6]], H, this.M('ceilA', 0xe8e0d0, { roughness: 1, emissive: 0x100c08 }));
    const beamM = this.texM('oakMid', oakTex(1), { roughness: 0.6 });
    this.rb(XR - XL, 0.14, 0.16, 0.02, beamM, 0, H - 0.07, -1.0);
    for (const x of [-2.3, -0.7, 0.9, 3.0]) this.rb(0.1, 0.1, L, 0.015, beamM, x, KW + L / 2 * SLOPE * 2 / L * 1 + 0.0, -2.0, { rx: -Math.atan2(2 * SLOPE, 2), uv: [0.3, 1.2] });
    // gable walls
    for (const [x, dir] of [[XL, 1], [XR, -1]]) {
      const pts = [[-3, 0], [2.6, 0], [2.6, H], [-1, H], [-3, KW]];
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(dir > 0 ? -z : z, y))));
      const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 2, p.getY(i) / 2);
      const m = new THREE.Mesh(g, wallM); m.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; m.position.x = x; this.root.add(m);
    }
    this.rb(XR - XL, 0.1, 0.025, 0.008, this.white(), 0, 0.05, BACK + 0.013);

    // ---- desk with hutch, chair, anglepoise, salt lamp, camera
    const oak = this.texM('oakWarm', oakTex(1), { roughness: 0.55 });
    const dx = -2.55, dz = -2.68;
    this.rb(1.42, 0.04, 0.62, 0.012, oak, dx, 0.76, dz, { uv: [0.3, 1.2] });
    this.rb(0.42, 0.72, 0.58, 0.015, oak, dx + 0.48, 0.37, dz, { uv: [0.3, 1.2] });
    for (let j = 0; j < 3; j++) { this.rb(0.38, 0.21, 0.02, 0.006, oak, dx + 0.48, 0.14 + j * 0.23, dz + 0.29); this.rb(0.12, 0.018, 0.02, 0.006, this.M('pullDark', 0x3a2a1c), dx + 0.48, 0.2 + j * 0.23, dz + 0.305); }
    this.rb(0.03, 0.72, 0.56, 0.01, oak, dx - 0.69, 0.37, dz);
    this.rb(1.4, 0.48, 0.02, 0.006, oak, dx, 1.02, BACK + 0.02);
    for (const s of [-1, 1]) this.rb(0.025, 0.48, 0.3, 0.008, oak, dx + s * 0.69, 1.02, BACK + 0.16);
    this.rb(1.42, 0.025, 0.31, 0.008, oak, dx, 1.27, BACK + 0.16);
    this.bookRow(dx - 0.62, 0.78, BACK + 0.13, 9, 81, 0.32, 0.18);
    for (let k = 0; k < 3; k++) this.lathe([[0.001, 0], [0.035, 0], [0.035, 0.09], [0.025, 0.1], [0.001, 0.1]], this.M(`jar${k}`, [0xd8c8a0, 0x8a9aa8, 0xe8e0d0][k], { roughness: 0.4 }), dx + 0.15 + k * 0.1, 1.283, BACK + 0.15);
    this.rb(0.24, 0.12, 0.16, 0.02, this.M('wire', 0x3a3a34, { roughness: 0.5, metalness: 0.6 }), dx + 0.5, 1.343, BACK + 0.15);
    this.mug(dx + 0.5, 0.78, BACK + 0.12, 0xe8a040);
    for (let k = 0; k < 4; k++) this.rod([dx + 0.5, 0.82, BACK + 0.12], [dx + 0.48 + k * 0.012, 0.95, BACK + 0.11 + (k % 2) * 0.02], 0.004, this.M(`pencil${k % 2}`, [0xe0b030, 0x3a6ac8][k % 2]));
    // the camera: a black film SLR with a strap
    const cam = this.M('cameraBody', 0x1c1c1e, { roughness: 0.45 });
    this.rb(0.14, 0.085, 0.06, 0.012, cam, dx + 0.1, 0.823, dz + 0.12, { ry: 0.4 });
    this.cy(0.032, 0.032, 0.07, this.M('lens', 0x2a2a2c, { roughness: 0.3, metalness: 0.4 }), dx + 0.12, 0.82, dz + 0.17, { rx: Math.PI / 2, ry: 0.4 });
    this.rb(0.15, 0.012, 0.062, 0.004, this.M('chromeTop', 0xb8bcc0, { metalness: 0.8, roughness: 0.3 }), dx + 0.1, 0.868, dz + 0.12, { ry: 0.4 });
    this.tube([[dx + 0.03, 0.85, dz + 0.1], [dx - 0.05, 0.79, dz + 0.2], [dx + 0.1, 0.78, dz + 0.27], [dx + 0.18, 0.85, dz + 0.15]], 0.006, this.M('strap', 0x6a2a24), { seg: 20 });
    this.rb(0.2, 0.012, 0.26, 0.004, this.M('notebook', 0x3a6a5a, { roughness: 0.9 }), dx - 0.25, 0.786, dz + 0.1, { ry: -0.2 });
    // anglepoise
    const black = this.M('anglepoise', 0x1a1a1c, { roughness: 0.4, metalness: 0.3 });
    const a0 = [dx + 0.3, 0.78, dz - 0.1], a1 = [dx + 0.18, 1.18, dz - 0.05], a2 = [dx - 0.12, 1.25, dz + 0.1];
    this.cy(0.07, 0.08, 0.025, black, a0[0], 0.79, a0[2]);
    this.rod(a0, a1, 0.008, black); this.rod(a1, a2, 0.008, black);
    this.lathe([[0.012, 0.0], [0.03, -0.03], [0.07, -0.1], [0.075, -0.12]], black, a2[0], a2[1], a2[2], { rz: 0.5 });
    const bulbA = this.glowM('aBulb', 0xf0e8d8, 0xffd8a0);
    this.sph(0.025, bulbA, a2[0] - 0.04, a2[1] - 0.08, a2[2]);
    this.lamp('deskLamp', { light: this.pointLight(0xffd090, 1.6, 4, dx - 0.15, 1.05, dz + 0.25, 1.4), glows: [this.halo(0xffd8a0, 0.4, 0.35, a2[0] - 0.04, a2[1] - 0.09, a2[2] + 0.03), (() => { const p = lightPool(0xffc080, 0.9, 0.6, 0.3); p.rotation.x = -Math.PI / 2; p.position.set(dx - 0.15, 0.785, dz + 0.05); return p; })()], mats: [[bulbA, 3]], on: { evening: 1, night: 0, day: 0 }, flare: { pos: V3(a2[0] - 0.04, a2[1] - 0.09, a2[2]) } });
    // Himalayan salt lamp (stays on at night)
    const saltG = new THREE.IcosahedronGeometry(0.08, 2);
    const sp = saltG.attributes.position; for (let i = 0; i < sp.count; i++) { const v = V3(sp.getX(i), sp.getY(i), sp.getZ(i)); const n = 1 + (noise3(v.x * 30, v.y * 30, v.z * 30, 4) - 0.5) * 0.35; sp.setXYZ(i, v.x * n, v.y * n * 1.3, v.z * n); }
    saltG.computeVertexNormals();
    const saltM = this.glowM('salt', 0xe08a50, 0xff7a30, { roughness: 0.6 });
    this.cy(0.06, 0.07, 0.04, oak, dx - 0.52, 0.8, dz - 0.05);
    this._add(saltG, saltM, dx - 0.52, 0.9, dz - 0.05);
    this.lamp('saltLamp', { light: this.pointLight(0xff8a40, 1.6, 3.2, dx - 0.45, 1.0, dz + 0.2, 1.4), glows: [this.halo(0xff9a50, 0.9, 0.45, dx - 0.52, 0.92, dz)], mats: [[saltM, 1.4]], on: { evening: 1, night: 1, day: 0.3 } });
    // wooden chair pulled out
    this.withT(-2.45, -2.02, Math.PI + 0.2, () => {
      this.rb(0.42, 0.04, 0.42, 0.015, oak, 0, 0.45, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.rb(0.035, 0.45, 0.035, 0.01, oak, sx * 0.18, 0.225, sz * 0.18);
      for (const sx of [-1, 1]) this.rb(0.04, 0.5, 0.035, 0.01, oak, sx * 0.18, 0.72, -0.19);
      for (const y of [0.62, 0.78, 0.92]) this.rb(0.38, 0.06, 0.025, 0.01, oak, 0, y, -0.19);
    });
    // backpack and a stack of books on the floor
    this.cush(0.32, 0.42, 0.2, 0.07, this.M('pack', 0x8a6a2a, { roughness: 0.9 }), -1.62, 0.22, -2.2, { rx: -0.15, ry: 0.3, seed: 31, puff: 0.3 });
    this.cush(0.22, 0.14, 0.07, 0.03, this.M('pack', 0x8a6a2a, { roughness: 0.9 }), -1.6, 0.13, -2.08, { ry: 0.3, seed: 32 });
    this.bookStack(-1.25, 0, -1.65, 4, 91);
    // ---- posters on the slope (as in the reference), the band poster and the map
    this.onSlope(0.55, 0.76, this.texM('butterflies', butterflyTex(), { roughness: 0.8 }), -2.85, 1.15);
    this.onSlope(0.5, 0.72, this.texM('mushrooms', mushroomTex(), { roughness: 0.8 }), -1.85, 1.2);
    this.onSlope(0.45, 0.62, this.texM('band', bandTex(), { roughness: 0.6 }), -1.15, 1.25);
    const mapW = 0.92, mapH = 0.7, mapX = 0.1, mapS = 1.2;
    this.onSlope(mapW, mapH, this.texM('yukon', yukonTex(), { roughness: 0.85 }), mapX, mapS);
    for (const [u, v] of YUKON_PINS) { const p = this.slopePoint(mapX + (u - 0.5) * mapW, mapS + (0.5 - v) * mapH, 0.02); this.sph(0.012, this.M('pin-0', 0xc82020, { roughness: 0.3 }), p.x, p.y, p.z); }
    for (const [x, s] of [[-2.85, 1.52], [-1.85, 1.55], [-1.15, 1.55], [0.1, 1.54]]) { const p = this.slopePoint(x, s, 0.01); this.sph(0.008, this.M('tack', 0xd8d8d0), p.x, p.y, p.z); }
    const sd = this.slopePoint(-1.5, 1.9, 0.02); this.cy(0.06, 0.06, 0.03, this.M('smoke', 0xf0f0ec), sd.x, sd.y, sd.z, { rx: Math.atan2(2, 2 * SLOPE) });
    // ---- single oak bed along the knee wall
    const bx = -0.2, bz = -2.53;
    const bedOak = this.texM('oakWarm', oakTex(1), { roughness: 0.55 });
    for (const [x, hh] of [[-1.22, 1.0], [0.82, 0.86]]) {
      for (const sz of [-1, 1]) this.rb(0.06, hh, 0.06, 0.015, bedOak, x, hh / 2, bz + sz * 0.46);
      this.rb(0.05, 0.08, 0.96, 0.015, bedOak, x, hh - 0.08, bz); this.rb(0.05, 0.07, 0.96, 0.015, bedOak, x, 0.5, bz);
      for (let k = 0; k < 4; k++) this.rb(0.03, hh - 0.62, 0.05, 0.008, bedOak, x, 0.55 + (hh - 0.62) / 2, bz - 0.33 + k * 0.22);
    }
    for (const s of [-1, 1]) this.rb(2.0, 0.14, 0.04, 0.012, bedOak, bx, 0.32, bz + s * 0.47);
    this.rb(1.98, 0.2, 0.9, 0.06, this.M('mattress', 0xe8e6e0, { roughness: 0.95 }), bx, 0.47, bz);
    const tick = this.texM('ticking', tickingTex(), { roughness: 0.95, side: THREE.DoubleSide });
    this.drape(1.72, 0.92, 0.3, tick, bx + 0.1, 0.585, bz, { sides: [0, 0, 0, 1], uv: [0.32, 0.32], seed: 7, wrinkle: 0.02, seg: [44, 24], r: 0.05 });
    const pillowM = this.M('pillowGrey', 0x8a96a4, { roughness: 0.95 });
    this.cush(0.42, 0.15, 0.62, 0.07, pillowM, -0.98, 0.67, bz - 0.02, { rz: 0.5, seed: 33, puff: 0.5 });
    this.cush(0.38, 0.13, 0.58, 0.06, pillowM, -0.85, 0.65, bz + 0.05, { rz: 0.3, seed: 34, puff: 0.5 });
    this.drape(0.48, 0.94, 0.08, this.texM('quilt', quiltTex(), { roughness: 0.95, side: THREE.DoubleSide }), 0.5, 0.64, bz, { sides: [1, 1, 0, 1], uv: [0.24, 0.24], seed: 8, r: 0.03 });
    // fairy lights along the foot of the slope over the bed
    const fpts = []; for (let i = 0; i <= 12; i++) { const x = -1.35 + i * 0.2; const p = this.slopePoint(x, 0.12 + (i % 2) * 0.1, 0.03); fpts.push([p.x, p.y, p.z]); }
    this.fairyLights('atticLights', fpts, 36, { on: { evening: 1, night: 0, day: 0 } });
    // ---- low chest with the mirror and polaroids, sill things
    const paint = this.M('chestWhite', 0xe4ddd0, { roughness: 0.6 });
    this.rb(0.7, 0.75, 0.42, 0.02, paint, 2.95, 0.375, BACK + 0.23);
    for (let j = 0; j < 3; j++) { this.rb(0.64, 0.2, 0.02, 0.006, paint, 2.95, 0.15 + j * 0.23, BACK + 0.445); this.sph(0.015, this.M('knob', 0x8a6a4a), 2.95, 0.15 + j * 0.23, BACK + 0.46); }
    this.withT(2.95, BACK + 0.12, 0, () => {
      this.rb(0.46, 0.56, 0.03, 0.012, bedOak, 0, 1.04, 0, { rx: -0.12 });
      this.pl(0.38, 0.48, this.texM('mirror', mirrorTex(), { roughness: 0.1, metalness: 0.2 }), 0, 1.04, 0.02, { rx: -0.12 });
      [[-0.2, 1.22, 0.2], [0.19, 1.25, -0.15], [0.2, 0.9, 0.1], [-0.19, 0.95, -0.2]].forEach(([x, y, rz], i) => this.pl(0.07, 0.085, this.texM(`polaroid-${i}`, polaroidTex(i), { roughness: 0.6 }), x, y, 0.03 + (1.04 - y) * 0.12, { rx: -0.12, rz }));
    }, 0);
    this.candle('chestCandle', 2.7, 0.75, BACK + 0.3, { on: { evening: 1, night: 0, day: 0 } });
    this.lathe([[0.001, 0], [0.03, 0], [0.03, 0.16], [0.012, 0.2], [0.012, 0.23], [0.001, 0.23]], this.M('bottle', 0x8aa8b0, { roughness: 0.1, transparent: true, opacity: 0.7 }), 1.55, 0.9, BACK - 0.08);
    this.plant(2.05, 0.9, BACK - 0.08, 0.3, 'pothos', 0xe8e0d0);
    // ---- jute rug
    this.rb(2.6, 0.012, 1.7, 0.006, this.texM('jute', juteTex(), { roughness: 1 }), -0.5, 0.006, -1.0, { uv: [0.32, 0.32] });
    // ---- the stairwell: top steps going down, banister round the hole
    const run = 0.2, rise = 2.9 / 12;
    for (let i = 0; i < 5; i++) this.rb(run + 0.03, 0.035, 0.88, 0.01, bedOak, 2.35 + run / 2 + i * run, -(i + 1) * rise - 0.017, -0.8);
    const well = this.M('wellA', 0x9a907e, { roughness: 1 });
    this.pl(1.0, 2.7, well, 2.85, -1.35, -1.35);
    this.pl(1.1, 2.7, well, 2.35, -1.35, -0.8, { ry: Math.PI / 2 });
    this.pl(1.1, 2.7, well, 3.35, -1.35, -0.8, { ry: -Math.PI / 2 });
    this.lamp('stairUp', { glows: [this.halo(0xffb070, 1.6, 0.3, 2.85, -0.6, -0.8)], on: { evening: 1, night: 0, day: 0 } });
    const wm = this.white();
    for (const z of [-1.33, -0.27]) {
      for (let k = 0; k <= 5; k++) this.rod([2.4 + k * 0.18, 0, z], [2.4 + k * 0.18, 0.9, z], 0.012, wm);
      this.rod([2.35, 0.92, z], [3.4, 0.92, z], 0.025, bedOak, { seg: 14 });
      this.rb(0.08, 0.98, 0.08, 0.015, bedOak, 2.38, 0.49, z);
    }
    this.flushBatches();
    // ---- light
    this.ambientOverride = { evening: { hemi: 0.58 }, night: { hemi: 0.34 } };
    this.lamp('fillA', { light: this.pointLight(0xffc088, 1.5, 7, 0.0, 2.1, 0.0, 1.2), on: { evening: 1, night: 0, day: 0 } });
    this.lamp('fillA2', { light: this.pointLight(0xffb878, 1.2, 4.5, 2.7, 1.5, -1.7, 1.2), on: { evening: 1, night: 0, day: 0 } });
    this.lamp('dayFillA', { light: this.pointLight(0xdfe6ee, 2.2, 9, 1.6, 1.9, -1.6, 1.0), on: { evening: 0, night: 0, day: 1 } });
    this.lamp('moonA', { light: this.pointLight(0x7890c8, 1.5, 6, 1.8, 1.8, -2.2, 1.2), on: { evening: 0, night: 1, day: 0 } });
    this.statePool(0x5a74b8, 1.6, 0.02, -1.9, 1.0, 1.8, 0.32, ['night']);
    this.statePool(0xc8d4e0, 1.6, 0.02, -1.9, 1.0, 1.8, 0.16, ['day']);
    this.windowLights.push(
      flareSource('PALE', V3(1.8, 1.6, BACK), { triggerDistance: 2.2, intensity: 0.45, enabled: () => this.state === 'day' }),
      flareSource('MOON', V3(1.8, 1.7, BACK), { triggerDistance: 2.2, enabled: () => this.state === 'night' }),
    );
    // ---- contract
    this.colliders.push({ x: -2.45, z: -2.02, r: 0.3 }, { x: -1.62, z: -2.2, r: 0.2 }, { x: -1.25, z: -1.65, r: 0.15 });
    this.doors = [{ id: 'attic_out', label: 'Вниз', x: 2.15, z: -0.75, radius: 0.8, anchor: V3(2.85, 1.2, -0.8), to: 'apartment', spawn: { x: 2.0, z: -1.5, facing: -1 } }];
    this.spots = { entry: { x: 1.85, z: -0.6, facing: -1 }, bed: { x: -0.2, z: -2.2, facing: 1, seatY: 0.52 }, desk: { x: -1.95, z: -1.65, facing: -1 } };
    const mp = this.slopePoint(mapX, mapS, 0.1);
    Object.assign(this.anchors, {
      desk: V3(-2.5, 1.25, -2.6), map: mp, posters: this.slopePoint(-2.5, 1.2, 0.1), bed: V3(-0.2, 0.9, -2.5),
      window: V3(1.8, 1.6, BACK + 0.1), camera: V3(-2.45, 1.0, -2.55),
    });
    this.setState('evening');
    return this.root;
  }
}
