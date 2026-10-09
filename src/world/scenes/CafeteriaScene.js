import * as THREE from 'three';
import { flareSource } from '../../fx/WindowLight.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, pixelate, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { roundedBox, mergeGeos } from '../nature.js';

/**
 * F.H. Collins Secondary — the cafeteria («Mustangs Café»), late November, overcast noon.
 * Look (owner's reference): long mobile bench-tables with beige laminate tops and rounded ends,
 * benches hung on chrome frames with casters; a white Armstrong grid ceiling with long fluorescent
 * strips; red accent panels high on light block walls; cream terrazzo with flecks and wide dark
 * runner stripes. Side-on like every location: the player walks a front aisle along x; behind it
 * the dining hall opens and runs away from the camera (tables receding in perspective).
 *   x -11.8 … -5.3  entry wing: sorting bins (-10.2), double doors to the corridor (-8.6), vending (-7, -6.1)
 *   x  -5.3 …  4.4  the hall: two near rows of tables across, four columns running into the depth,
 *                   far wall with glass doors, windows onto the yard, the Mustangs banner
 *   x   4.4 … 11.8  serving wing: tray cart, the line (5.4 … 8.8) with sneeze guard and heat lamps,
 *                   menu board, the till (9.2), milk cooler (9.95)
 */

const BACK = -3.3, FAR = -13.6, H = 3.8;
const HX0 = -5.3, HX1 = 4.4;           // the hall opening between the two wings
const RX0 = -11.8, RX1 = 11.8;         // the wings' ends
const TOP = 0.742, SEAT = 0.452;       // table and bench heights
const T = (key, w, h, draw, o = {}) => canvasTexture(`cafe-${key}`, w, h, draw, { aniso: 8, ...o });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b) => `rgb(${hex(r)},${hex(g)},${hex(b)})`;
const tiled = (tex, rx, ry) => { const t = tex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
const V2 = (pts) => pts.map(([a, b]) => new THREE.Vector2(a, b));

// ------------------------------------------------------------------ textures

/** Cream terrazzo (light) or the dark runner stripes: mottled ground, chips, big tile joints. */
const terrazzoTex = (dark) => T(`terrazzo-${dark ? 'd' : 'l'}`, 256, 256, (ctx, w, h) => {
  const r = rng(dark ? 702 : 701);
  ctx.fillStyle = dark ? '#5c5856' : '#ddd5c6'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = dark ? `rgba(${r() < 0.5 ? '36,34,36' : '112,106,100'},0.1)` : `rgba(${r() < 0.5 ? '196,186,166' : '242,238,228'},0.22)`;
    const s = 10 + r() * 46; ctx.fillRect(r() * w, r() * h, s, s * 0.7);
  }
  const n = dark ? 3400 : 3000;
  for (let i = 0; i < n; i++) {
    const c = r();
    ctx.fillStyle = dark
      ? (c < 0.35 ? 'rgba(206,200,192,0.75)' : c < 0.6 ? 'rgba(28,26,28,0.7)' : c < 0.85 ? 'rgba(140,132,124,0.6)' : 'rgba(150,84,64,0.55)')
      : (c < 0.35 ? 'rgba(138,128,116,0.6)' : c < 0.6 ? 'rgba(84,78,74,0.55)' : c < 0.85 ? 'rgba(250,248,240,0.8)' : 'rgba(176,106,76,0.5)');
    const s = r() < 0.86 ? 1 : 2;
    ctx.fillRect((r() * w) | 0, (r() * h) | 0, s, s);
  }
  ctx.fillStyle = dark ? 'rgba(30,28,28,0.5)' : 'rgba(120,110,96,0.35)';
  ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, 0, 1, h);
});

/** Painted concrete block (40 × 20 cm, running bond), the texture covers 0.8 × 0.8 m. */
const blockTex = () => T('block', 128, 128, (ctx, w, h) => {
  const r = rng(711);
  for (let row = 0; row < 4; row++) for (let k = -1; k < 2; k++) {
    const x = k * 64 + (row % 2) * 32, y = row * 32, v = (r() - 0.5) * 7;
    ctx.fillStyle = rgb(222 + v, 214 + v, 200 + v); ctx.fillRect(x, y, 64, 32);
    for (let i = 0; i < 80; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,250' : '120,110,96'},${0.07 + r() * 0.12})`; ctx.fillRect(x + r() * 64, y + r() * 32, 1, 1); }
  }
  ctx.fillStyle = 'rgba(120,108,92,0.5)';
  for (let row = 0; row < 4; row++) { ctx.fillRect(0, row * 32, w, 2); for (let k = 0; k < 3; k++) ctx.fillRect(k * 64 + (row % 2) * 32 - 1, row * 32, 2, 32); }
  ctx.fillStyle = 'rgba(255,252,244,0.4)'; for (let row = 0; row < 4; row++) ctx.fillRect(0, row * 32 + 2, w, 1);
});

/** Armstrong lay-in tile (60 × 120 cm): fissured mineral fibre, white T-bar grid. */
const ceilTex = () => T('ceil', 64, 128, (ctx, w, h) => {
  const r = rng(715);
  ctx.fillStyle = '#efece5'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(150,146,136,${0.2 + r() * 0.25})`; ctx.fillRect(r() * w, r() * h, 1, 1 + (r() < 0.2 ? 1 : 0)); }
  ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, h);
  ctx.fillStyle = 'rgba(120,116,108,0.45)'; ctx.fillRect(0, 3, w, 1); ctx.fillRect(3, 0, 1, h);
});

/** Lens of a long fluorescent strip: bright core, frosted edges, tube shadows. */
const lensTex = () => T('lens', 128, 16, (ctx, w, h) => {
  ctx.fillStyle = '#d8d4cc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(2, 3, w - 4, h - 6);
  ctx.fillStyle = 'rgba(210,204,190,0.6)'; for (let x = 4; x < w - 4; x += 16) ctx.fillRect(x, 3, 1, h - 6);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(2, 6, w - 4, 3);
});

/** Beige "fawn" laminate with a faint linen speckle (1 texture = 1 m). */
const laminateTex = () => T('laminate', 128, 128, (ctx, w, h) => {
  const r = rng(721);
  ctx.fillStyle = '#d8ccb4'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '170,156,130' : '238,230,214'},${0.25 + r() * 0.3})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(150,140,120,0.08)'; ctx.fillRect(0, r() * h, w, 1); }   // fine linen grain
  for (let i = 0; i < 10; i++) { ctx.fillStyle = 'rgba(120,110,96,0.1)'; ctx.beginPath(); ctx.arc(r() * w, r() * h, 2 + r() * 4, 0, 7); ctx.fill(); }   // old rings and smudges
});

/** Brushed stainless. */
const steelTex = () => T('steel', 64, 64, (ctx, w, h) => {
  const r = rng(722);
  ctx.fillStyle = '#a8adb2'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '230,234,238' : '110,114,120'},${0.15 + r() * 0.2})`; ctx.fillRect(0, r() * h, w, 1); }
}, { color: true });

/** The yard through the windows: overcast late November, Grey Mountain, spruce, a bus in the lot, almost no snow. */
const yardTex = () => T('yard', 1024, 384, (ctx, w, h) => {
  const r = rng(733);
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55); sky.addColorStop(0, '#99a1aa'); sky.addColorStop(1, '#c6c9ca');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '214,212,206' : '140,146,154'},0.28)`; ctx.fillRect(r() * w, r() * h * 0.34, 60 + r() * 220, 3 + r() * 8); }
  const ridge = (x) => h * 0.31 + Math.sin(x * 0.004 + 1) * 22 + Math.sin(x * 0.017) * 6;
  ctx.fillStyle = '#727a84'; ctx.beginPath(); ctx.moveTo(0, h * 0.52); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, ridge(x)); ctx.lineTo(w, h * 0.52); ctx.fill();
  ctx.fillStyle = 'rgba(210,212,212,0.75)'; for (let x = 0; x <= w; x += 8) { const y = ridge(x); if (y < h * 0.3) ctx.fillRect(x, y, 8, 2 + r() * 4); }   // a dusting on the summit only
  ctx.fillStyle = '#5e6670'; ctx.beginPath(); ctx.moveTo(0, h * 0.52); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.42 + Math.sin(x * 0.007 + 3) * 10); ctx.lineTo(w, h * 0.52); ctx.fill();
  for (let i = 0; i < 260; i++) {
    const x = r() * w, s = 9 + r() * 15, y = h * 0.52 + r() * 4;
    ctx.fillStyle = r() < 0.5 ? '#29352e' : '#323e37';
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.7); ctx.lineTo(x + s * 0.34, y); ctx.lineTo(x - s * 0.34, y); ctx.fill();
  }
  // dead grass with a little hoar frost
  ctx.fillStyle = '#7c705a'; ctx.fillRect(0, h * 0.53, w, h * 0.1);
  for (let i = 0; i < 1100; i++) { ctx.fillStyle = `rgba(${r() < 0.25 ? '206,204,196' : r() < 0.6 ? '96,84,64' : '146,128,98'},0.55)`; ctx.fillRect(r() * w, h * 0.53 + r() * h * 0.1, 2, 1); }
  // bare aspens and birches along the fence
  for (let i = 0; i < 16; i++) {
    const x = r() * w, y = h * 0.62, th = 60 + r() * 50, birch = r() < 0.5;
    ctx.strokeStyle = birch ? '#cfcac0' : '#8a8478'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - th); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,62,56,0.8)'; ctx.lineWidth = 1;
    for (let k = 0; k < 10; k++) { const yy = y - th * (0.35 + r() * 0.6), d = (r() < 0.5 ? -1 : 1) * (8 + r() * 18); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + d, yy - 6 - r() * 14); ctx.stroke(); }
    if (r() < 0.4) { ctx.fillStyle = 'rgba(196,150,60,0.7)'; for (let k = 0; k < 5; k++) ctx.fillRect(x + (r() - 0.5) * 20, y - th * (0.5 + r() * 0.4), 2, 2); }   // the last yellow leaves
  }
  ctx.fillStyle = 'rgba(70,70,72,0.45)'; for (let x = 0; x < w; x += 40) ctx.fillRect(x, h * 0.57, 2, h * 0.07);   // fence posts
  ctx.fillStyle = 'rgba(90,92,96,0.25)'; ctx.fillRect(0, h * 0.57, w, h * 0.06);
  ctx.fillStyle = '#6c6c6c'; ctx.fillRect(0, h * 0.57, w, 2);
  // wet parking lot, painted bays, puddles mirroring the sky
  ctx.fillStyle = '#4a4c50'; ctx.fillRect(0, h * 0.64, w, h * 0.36);
  for (let i = 0; i < 800; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '90,92,96' : '40,42,44'},0.5)`; ctx.fillRect(r() * w, h * 0.64 + r() * h * 0.36, 3, 1); }
  ctx.fillStyle = 'rgba(210,206,190,0.6)'; for (let x = 30; x < w; x += 92) { ctx.fillRect(x, h * 0.8, 3, h * 0.2); }
  for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(176,184,192,0.35)'; ctx.fillRect(r() * w, h * (0.72 + r() * 0.25), 30 + r() * 50, 3); }
  // the yellow school bus
  const bx = 150, by = h * 0.57, bw = 260, bh = 62;
  ctx.fillStyle = '#d8a02a'; ctx.fillRect(bx, by, bw, bh); ctx.fillRect(bx + bw, by + 16, 34, bh - 16);
  ctx.fillStyle = '#2a2a28'; for (let k = 0; k < 9; k++) ctx.fillRect(bx + 10 + k * 27, by + 8, 21, 18);
  ctx.fillStyle = '#1e1e1c'; ctx.fillRect(bx, by + 34, bw + 34, 3); ctx.fillRect(bx, by + 44, bw + 34, 2); ctx.fillRect(bx, by + bh - 6, bw + 34, 6);
  ctx.fillStyle = '#141414'; for (const wx of [bx + 40, bx + 210]) { ctx.beginPath(); ctx.arc(wx, by + bh, 12, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e8d070'; ctx.fillRect(bx + bw + 26, by + 22, 6, 6);
  // parked cars
  for (const [x, c, k] of [[520, '#5a2a24', 0], [640, '#c8c8c4', 1], [770, '#2a3a5a', 0], [880, '#3a3e36', 1]]) {
    const y = h * 0.66, cw = 92, ch = 30;
    ctx.fillStyle = c; ctx.fillRect(x, y + 12, cw, ch - 12); ctx.fillRect(x + 16, y + (k ? 0 : 2), cw - 34, 14);
    ctx.fillStyle = '#20262c'; ctx.fillRect(x + 20, y + (k ? 3 : 5), cw - 42, 9);
    ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.arc(x + 18, y + ch, 7, 0, 7); ctx.arc(x + cw - 18, y + ch, 7, 0, 7); ctx.fill();
  }
  // light poles
  ctx.fillStyle = '#3a3c40'; for (const x of [90, 470, 990]) { ctx.fillRect(x, h * 0.38, 3, h * 0.3); ctx.fillRect(x - 10, h * 0.38, 16, 3); }
  pixelate(ctx, w, h, 3);
});

/** Glimpse of the school corridor through the entry doors' glass. */
const corridorTex = () => T('corridor', 96, 160, (ctx, w, h) => {
  ctx.fillStyle = '#e4d4ae'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ebe7dc'; ctx.fillRect(0, 0, w, 34);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(18, 10, 60, 6);
  ctx.fillStyle = '#a8977a'; for (let y = 40; y < 120; y += 12) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = '#b0844e'; ctx.fillRect(0, 70, w, 6);
  ctx.fillStyle = '#b81e1c'; ctx.fillRect(8, 80, 70, 54);
  ctx.fillStyle = '#5a0a0a'; for (let x = 8; x < 78; x += 14) ctx.fillRect(x, 80, 1, 54);
  ctx.fillStyle = '#d8d0c0'; ctx.fillRect(0, 134, w, h - 134);
  ctx.fillStyle = 'rgba(255,250,240,0.5)'; ctx.fillRect(10, 140, 40, 3);
  pixelate(ctx, w, h, 2);
});

/** The kitchen behind the pass-through: white tile, shelves of pans, the hood, warm light. */
const kitchenTex = () => T('kitchen', 384, 160, (ctx, w, h) => {
  const r = rng(741);
  ctx.fillStyle = '#e6e0d2'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(160,150,132,0.5)'; for (let x = 0; x < w; x += 12) ctx.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 12) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = '#9aa0a6'; ctx.fillRect(20, 0, 170, 36); ctx.fillStyle = '#6a7076'; ctx.fillRect(20, 34, 170, 4);   // the hood
  ctx.fillStyle = 'rgba(255,190,110,0.5)'; ctx.fillRect(30, 38, 150, 6);
  ctx.fillStyle = '#8a9096'; ctx.fillRect(10, 96, 200, 64);                                                            // range and steam kettles
  ctx.fillStyle = '#5a6066'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(40 + k * 48, 92, 18, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let k = 0; k < 4; k++) ctx.fillRect(28 + k * 48, 60 + r() * 10, 18, 20);
  for (const y of [40, 76]) {                                                                                          // wire shelves of pans and tubs
    ctx.fillStyle = '#7a8086'; ctx.fillRect(230, y, 140, 3);
    for (let k = 0; k < 7; k++) { ctx.fillStyle = ['#b8bec4', '#e8e4dc', '#c84a2a', '#b8bec4', '#e8c860', '#d8d4cc', '#9aa4ac'][k]; ctx.fillRect(234 + k * 19, y - 12 - r() * 6, 15, 12 + r() * 6); }
  }
  ctx.fillStyle = '#d8dce0'; ctx.fillRect(220, 110, 160, 50);                                                         // prep table
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(300, 20, 26, 26); ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(313, 33, 11, 0, 7); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(313, 33); ctx.lineTo(313, 25); ctx.moveTo(313, 33); ctx.lineTo(319, 35); ctx.stroke();
  const g = ctx.createRadialGradient(w * 0.3, 20, 10, w * 0.3, 40, 200); g.addColorStop(0, 'rgba(255,214,150,0.35)'); g.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  pixelate(ctx, w, h, 2);
});

/** Food in the steam-table wells: chili, mac & cheese, green beans, corn, rolls, salad. */
const foodTex = () => T('food', 384, 64, (ctx, w, h) => {
  const r = rng(742);
  const pans = [
    ['#6a2414', ['#8a3a1c', '#4a160c', '#b0603a', '#3a2a1a']],     // chili
    ['#e0a030', ['#f0c050', '#c88020', '#f8d870', '#b06a18']],     // mac & cheese
    ['#4a6a2a', ['#6a8a3a', '#3a5420', '#8aa850', '#2a3a18']],     // green beans
    ['#e8c040', ['#f8d860', '#d0a020', '#fff0a0', '#c89818']],     // corn
    ['#c89058', ['#e0b078', '#a06a38', '#f0c890', '#8a5a2a']],     // dinner rolls
    ['#5a8a3a', ['#8ab858', '#c83a2a', '#e8e0c0', '#3a6a28']],     // salad
  ];
  const pw = w / pans.length;
  ctx.fillStyle = '#9aa0a6'; ctx.fillRect(0, 0, w, h);
  pans.forEach(([base, flecks], i) => {
    const x = i * pw + 4, y = 5, ww = pw - 8, hh = h - 10;
    ctx.fillStyle = '#6a7076'; ctx.fillRect(x - 2, y - 2, ww + 4, hh + 4);
    ctx.fillStyle = base; ctx.fillRect(x, y, ww, hh);
    for (let k = 0; k < 340; k++) { ctx.fillStyle = flecks[(r() * 4) | 0]; const s = i === 4 ? 0 : 1 + (r() < 0.3 ? 1 : 0); ctx.fillRect(x + r() * ww, y + r() * hh, s + 1, s); }
    if (i === 4) for (let k = 0; k < 10; k++) { ctx.fillStyle = '#b07840'; ctx.beginPath(); ctx.arc(x + 8 + (k % 5) * 11, y + 12 + ((k / 5) | 0) * 26, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#e8c08a'; ctx.fillRect(x + 5 + (k % 5) * 11, y + 9 + ((k / 5) | 0) * 26, 4, 2); }
    ctx.fillStyle = '#c8ccd0'; ctx.fillRect(x + ww * 0.55, y + 2, 3, hh * 0.7); ctx.fillRect(x + ww * 0.5, y + hh * 0.7, 10, 5);   // a ladle / tongs
  });
});

/** Chalk menu board in a wood frame. */
const menuTex = () => T('menu', 384, 172, (ctx, w, h) => {
  const r = rng(743);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1e2a24'; ctx.fillRect(8, 8, w - 16, h - 16);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(220,230,220,${r() * 0.06})`; ctx.fillRect(8 + r() * (w - 16), 8 + r() * (h - 16), 2 + r() * 6, 1); }   // erased chalk haze
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f2d860'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MUSTANGS CAFÉ', w / 2, 16);
  ctx.fillStyle = '#e8eee8'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('TODAY', 22, 52);
  ctx.font = '14px monospace';
  const items = [['Chili con carne', '4.50'], ['Mac & cheese', '3.75'], ['Grilled cheese', '3.00'], ['Garden salad', '3.25'], ['Corn · beans · roll', '1.50']];
  items.forEach(([n, p], i) => { ctx.fillStyle = '#e8eee8'; ctx.fillText(n, 22, 72 + i * 16); ctx.fillStyle = '#9ad0e8'; ctx.textAlign = 'right'; ctx.fillText(p, 228, 72 + i * 16); ctx.textAlign = 'left'; });
  ctx.fillStyle = '#e8a0a0'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('DRINKS', 254, 52);
  ctx.font = '13px monospace'; ctx.fillStyle = '#e8eee8';
  [['Milk', '1.00'], ['Juice', '1.50'], ['Hot choc.', '1.25']].forEach(([n, p], i) => { ctx.fillText(n, 254, 72 + i * 16); ctx.textAlign = 'right'; ctx.fillText(p, 362, 72 + i * 16); ctx.textAlign = 'left'; });
  ctx.fillStyle = '#f2d860'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('FRI: PIZZA DAY!', 254, 128);
  ctx.strokeStyle = '#e8eee8'; ctx.lineWidth = 1.5;                                                                  // a chalk snowflake doodle
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(345 - Math.cos(a) * 9, 26 - Math.sin(a) * 9); ctx.lineTo(345 + Math.cos(a) * 9, 26 + Math.sin(a) * 9); ctx.stroke(); }
  ctx.fillStyle = 'rgba(232,238,232,0.8)'; ctx.font = 'italic 11px sans-serif'; ctx.fillText('have a great day, Mustangs :)', 22, 152);
  ctx.fillStyle = '#c8b090'; ctx.fillRect(40, h - 8, 26, 4); ctx.fillStyle = '#f2f2f2'; ctx.fillRect(74, h - 8, 12, 3);   // chalk on the ledge
});

/** Drink machine (glowing bottle panel, red body) and snack machine (spiral rows behind glass). */
const vendTex = (kind, glowOnly) => T(`vend-${kind}-${glowOnly ? 'e' : 'c'}`, 96, 192, (ctx, w, h) => {
  const r = rng(kind === 'drink' ? 751 : 752);
  ctx.fillStyle = glowOnly ? '#000' : (kind === 'drink' ? '#a81a1a' : '#1e2a44'); ctx.fillRect(0, 0, w, h);
  if (kind === 'drink') {
    // the lit front: a cold-drinks photo panel with bottle rows
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e8f2f8'); g.addColorStop(1, '#90b8d8');
    ctx.fillStyle = g; ctx.fillRect(6, 8, 62, 150);
    for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) {
      const x = 10 + k * 15, y = 36 + row * 30, c = ['#c81e1e', '#e8a020', '#2a6ac8', '#3aa04a'][(row + k) % 4];
      ctx.fillStyle = c; ctx.fillRect(x + 3, y, 7, 22); ctx.fillRect(x + 5, y - 5, 3, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 4, y + 2, 1, 16);
    }
    ctx.fillStyle = '#c81e1e'; ctx.fillRect(6, 8, 62, 22); ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ICE COLD', 37, 23);
    if (!glowOnly) {
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(72, 30, 18, 60);
      for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#d8d8d0' : '#e8c040'; ctx.fillRect(75, 34 + k * 7, 12, 4); }
      ctx.fillStyle = '#101010'; ctx.fillRect(74, 96, 14, 4); ctx.fillRect(76, 106, 10, 14);
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(10, 166, 54, 18);
    } else { ctx.fillStyle = '#40ff60'; ctx.fillRect(74, 22, 14, 5); }
  } else {
    ctx.fillStyle = glowOnly ? '#2a3038' : '#3a4250'; ctx.fillRect(6, 8, 64, 140);
    const cols = ['#e83a2a', '#f2c030', '#3a7ad8', '#2aa84a', '#e86a20', '#9a3ad0', '#f0e0c0'];
    for (let row = 0; row < 6; row++) {
      ctx.fillStyle = glowOnly ? '#20262c' : '#6a7280'; ctx.fillRect(6, 30 + row * 20, 64, 2);
      for (let k = 0; k < 5; k++) {
        if (r() < 0.12) continue;    // sold out
        ctx.fillStyle = cols[(r() * cols.length) | 0]; const x = 9 + k * 12.5, y = 13 + row * 20;
        ctx.fillRect(x, y, 10, 16); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 1, y + 2, 8, 2);
      }
    }
    if (!glowOnly) {
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(74, 30, 16, 60);
      ctx.fillStyle = '#40ff60'; ctx.fillRect(76, 34, 12, 6);
      for (let k = 0; k < 12; k++) { ctx.fillStyle = '#c8c8c0'; ctx.fillRect(76 + (k % 3) * 4, 44 + ((k / 3) | 0) * 6, 3, 4); }
      ctx.fillStyle = '#101010'; ctx.fillRect(10, 156, 56, 26);
      ctx.fillStyle = '#e8e8e0'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SNACKS', 48, 6 + 2);
    } else { ctx.fillStyle = '#40ff60'; ctx.fillRect(76, 34, 12, 6); }
  }
});

/** Glass-door milk cooler: shelves of cartons and juice bottles, lit from inside. */
const coolerTex = (glowOnly) => T(`cooler-${glowOnly ? 'e' : 'c'}`, 80, 192, (ctx, w, h) => {
  const r = rng(753);
  ctx.fillStyle = glowOnly ? '#202830' : '#cdd4da'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = glowOnly ? '#6a8aa8' : '#e8eef2'; ctx.fillRect(6, 24, w - 12, h - 36);
  for (let s = 0; s < 5; s++) {
    const y = 30 + s * 30;
    ctx.fillStyle = '#9aa4ac'; ctx.fillRect(6, y + 24, w - 12, 2);
    for (let k = 0; k < 6; k++) {
      const x = 9 + k * 11, milk = s < 3;
      ctx.fillStyle = milk ? ['#f4f2ec', '#e8d8b0', '#f0c8d0'][(k + s) % 3] : ['#f0a020', '#c83030', '#e8d040'][(k + s) % 3];
      ctx.fillRect(x, y + 6, 9, 18); if (milk) { ctx.fillStyle = '#3a6ac8'; ctx.fillRect(x, y + 12, 9, 3); ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x + 4.5, y + 1); ctx.lineTo(x + 9, y + 6); ctx.fill(); }
      void r;
    }
  }
  ctx.fillStyle = glowOnly ? '#4aa0ff' : '#1a4a9a'; ctx.fillRect(4, 4, w - 8, 16);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MILK · JUICE', w / 2, 16);
});

/** A cafeteria tray with compartments and lunch on it (3 variants) — or empty. */
const trayTex = (v) => T(`tray-${v}`, 96, 72, (ctx, w, h) => {
  const r = rng(760 + v);
  const col = ['#7a2420', '#3a6a72', '#c8b48a', '#7a2420'][v];
  ctx.fillStyle = col; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(6, 6, 50, 60); ctx.fillRect(60, 6, 30, 28); ctx.fillRect(60, 38, 30, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, 0, 2, h);
  if (v === 3) return;      // an empty tray
  const main = ['#6a2414', '#e0a030', '#d8a050'][v];
  ctx.fillStyle = main; ctx.beginPath(); ctx.ellipse(31, 36, 20, 24, 0, 0, 7); ctx.fill();
  for (let k = 0; k < 60; k++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,230,180' : '60,20,10'},0.4)`; ctx.fillRect(14 + r() * 34, 16 + r() * 40, 2, 2); }
  ctx.fillStyle = ['#4a6a2a', '#e8c040', '#5a8a3a'][v]; ctx.fillRect(63, 9, 24, 22);
  ctx.fillStyle = '#c89058'; ctx.beginPath(); ctx.arc(75, 52, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8e8e4'; ctx.fillRect(8, 60, 30, 2);       // a plastic fork
});

const cartonTex = () => T('carton', 32, 48, (ctx, w, h) => {
  ctx.fillStyle = '#f4f2ec'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3a6ac8'; ctx.fillRect(0, 16, w, 10);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MILK', w / 2, 24);
  ctx.fillStyle = '#c83030'; ctx.fillRect(0, 34, w, 3);
});

/** Cloth banner: navy, silver snowflakes, gold lettering, with folds. */
const formalTex = () => T('formal', 512, 128, (ctx, w, h) => {
  const r = rng(771);
  ctx.fillStyle = '#1c2a5c'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { ctx.fillStyle = `rgba(${(x / 32) % 2 ? '255,255,255' : '0,0,0'},0.05)`; ctx.fillRect(x, 0, 32, h); }   // folds
  ctx.strokeStyle = 'rgba(220,230,245,0.75)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const x = r() * w, y = r() * h, s = 4 + r() * 8;
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s); ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); ctx.stroke(); }
  }
  ctx.fillStyle = '#f2d060'; ctx.font = 'bold 54px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('WINTER FORMAL', w / 2, 52);
  ctx.fillStyle = '#e8eef8'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('DEC 18 · 7 PM · GYM · TICKETS $15', w / 2, 100);
  ctx.fillStyle = '#c8ccd4'; for (const x of [10, w - 18]) ctx.fillRect(x, 6, 8, 8);
});

/** Team banner: maroon, a gold horse head, «GO MUSTANGS!». */
const mustangTex = () => T('mustang', 512, 160, (ctx, w, h) => {
  ctx.fillStyle = '#7a1418'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f2c84a'; ctx.fillRect(0, 0, w, 8); ctx.fillRect(0, h - 8, w, 8);
  // a horse head in profile (simple silhouette with a flying mane)
  ctx.save(); ctx.translate(78, 86); ctx.fillStyle = '#f2c84a';
  ctx.beginPath(); ctx.moveTo(-30, 60); ctx.lineTo(-24, 10); ctx.quadraticCurveTo(-20, -30, 6, -50); ctx.lineTo(10, -66); ctx.lineTo(18, -48);
  ctx.quadraticCurveTo(40, -36, 52, -6); ctx.lineTo(56, 10); ctx.quadraticCurveTo(50, 18, 40, 12); ctx.lineTo(22, 0); ctx.quadraticCurveTo(14, 30, 20, 60); ctx.fill();
  ctx.fillStyle = '#7a1418'; ctx.beginPath(); ctx.arc(22, -26, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8b030'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(-22 + k * 4, -36 + k * 14); ctx.lineTo(-48 - k * 3, -30 + k * 16); ctx.lineTo(-24 + k * 4, -26 + k * 14); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#f2c84a'; ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GO MUSTANGS!', 300, 70);
  ctx.fillStyle = '#f4ece0'; ctx.font = 'bold 20px sans-serif'; ctx.fillText('F.H. COLLINS · YUKON TERRITORIAL CHAMPIONS', 300, 122);
});

/** Small posters and notices (text + a simple graphic). */
const posterTex = (kind) => T(`poster-${kind}`, 128, 176, (ctx, w, h) => {
  const r = rng(780 + kind.length);
  if (kind === 'rainbow') {
    ctx.fillStyle = '#f4f0e4'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a6a3a'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EAT A', w / 2, 24); ctx.fillText('RAINBOW!', w / 2, 44);
    ['#d83a2a', '#f08a20', '#f2d040', '#4aa040', '#3a6ac8', '#8a3ab0'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(24 + (i % 3) * 40, 80 + ((i / 3) | 0) * 40, 15, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#4a4a4a'; ctx.font = '10px sans-serif'; ctx.fillText('5 colours a day', w / 2, 160);
  } else if (kind === 'tryouts') {
    ctx.fillStyle = '#1e1e22'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e86a20'; ctx.beginPath(); ctx.arc(w / 2, 70, 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#1e1e22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2 - 34, 70); ctx.lineTo(w / 2 + 34, 70); ctx.moveTo(w / 2, 36); ctx.lineTo(w / 2, 104); ctx.stroke();
    ctx.fillStyle = '#f2c84a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BASKETBALL', w / 2, 128); ctx.fillText('TRYOUTS', w / 2, 146);
    ctx.fillStyle = '#e8e8e0'; ctx.font = '10px sans-serif'; ctx.fillText('MON · 3:30 · GYM B', w / 2, 164);
  } else if (kind === 'council') {
    ctx.fillStyle = '#9a6a3a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(80,50,24,${r() * 0.4})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
    const notes = ['#f2ead8', '#f2d860', '#e8a0a0', '#a8d0e8', '#c8e8a8'];
    for (let i = 0; i < 7; i++) {
      const x = 6 + (i % 3) * 40 + r() * 4, y = 30 + ((i / 3) | 0) * 46 + r() * 6;
      ctx.fillStyle = notes[i % notes.length]; ctx.fillRect(x, y, 32, 38);
      ctx.fillStyle = 'rgba(40,40,50,0.6)'; for (let k = 0; k < 5; k++) ctx.fillRect(x + 3, y + 6 + k * 6, 22 - r() * 8, 1);
      ctx.fillStyle = '#c02020'; ctx.fillRect(x + 15, y + 1, 3, 3);
    }
    ctx.fillStyle = '#1a2a4a'; ctx.fillRect(6, 4, w - 12, 20); ctx.fillStyle = '#f2d860'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('STUDENT COUNCIL', w / 2, 18);
  } else if (kind === 'hours') {
    ctx.fillStyle = '#f2ece0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a1418'; ctx.fillRect(0, 0, w, 34); ctx.fillStyle = '#f2c84a'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LUNCH', w / 2, 23);
    ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('A · 11:45', w / 2, 62); ctx.fillText('B · 12:25', w / 2, 84);
    ctx.font = '10px sans-serif'; ctx.fillText('Please return', w / 2, 120); ctx.fillText('your tray :)', w / 2, 134);
    ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(w / 2, 156, 9, 0, 7); ctx.fill();
  }
});

const binLabelTex = (txt, bg) => T(`bin-${txt}`, 64, 32, (ctx, w, h) => {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, w / 2, h / 2);
});

const clockTex = () => T('clock', 64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(32, 32, 31, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4f2ec'; ctx.beginPath(); ctx.arc(32, 32, 27, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a2a2a'; for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; ctx.fillRect(32 + Math.cos(a) * 22 - 1, 32 + Math.sin(a) * 22 - 1, 2, 2); }
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(-Math.PI / 2 + 0.4) * 13, 32 + Math.sin(-Math.PI / 2 + 0.4) * 13); ctx.stroke();   // 12:10
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(-Math.PI / 2 + 1.05) * 20, 32 + Math.sin(-Math.PI / 2 + 1.05) * 20); ctx.stroke();
  ctx.strokeStyle = '#c02020'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32, 10); ctx.stroke();
});

const wetTex = () => T('wet', 64, 96, (ctx, w, h) => {
  ctx.fillStyle = '#f2c820'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CAUTION', w / 2, 16);
  ctx.beginPath(); ctx.moveTo(w / 2, 26); ctx.lineTo(w / 2 + 16, 54); ctx.lineTo(w / 2 - 16, 54); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
  ctx.fillRect(w / 2 - 1, 34, 3, 10); ctx.fillRect(w / 2 - 1, 47, 3, 3);
  ctx.fillText('WET', w / 2, 72); ctx.fillText('FLOOR', w / 2, 84);
});

const smearTex = () => T('smear', 32, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const s = ctx.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.15, 'rgba(0,0,0,1)'); s.addColorStop(0.85, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
}, { color: false });
const shadowTex = () => T('cshadow', 64, 32, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.scale(1, h / w * 2); ctx.fillStyle = g; ctx.fillRect(0, 0, w, w); ctx.restore();
}, { color: false });

const ReflShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: 0.36 } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec4 vUv;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      vec3 c = vec3(0.0); float ws = 0.0;
      for (int i = -3; i <= 3; i++) { float fi = float(i); float w = 1.0 - abs(fi) / 4.0; c += texture2D(tDiffuse, uv + vec2(0.0, fi * 0.005)).rgb * w; ws += w; }
      gl_FragColor = vec4(c / ws * uStrength, 1.0);
    }`,
};

// ------------------------------------------------------------------ geometry helpers

/** Rounded rectangle in the plan (x, -z), corner radius r. */
function rrect(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
/** Non-indexed, position/normal/uv only — ready for mergeGeos. */
function prep(g) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  return n;
}

/**
 * One mobile bench-table, long axis x, centred on the origin: a laminate top with rounded ends on a
 * dark T-moulding, two attached benches, chrome frames with casters. `skirt` adds the folding
 * chassis panel under the top (the near rows: it hides the legs of anyone seated behind).
 * Returns merged geometry per material.
 */
function tableUnit(L, { skirt = false, low = false } = {}) {
  const parts = { lam: [], edge: [], chrome: [], rubber: [], skirt: [] };
  const cs = low ? 4 : 7;
  const slab = (w, d, r, depth, y, z = 0) => {
    const e = new THREE.ExtrudeGeometry(rrect(w, d, r), { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: cs });
    e.rotateX(-Math.PI / 2); e.translate(0, y, z); parts.edge.push(e);
    const s = new THREE.ShapeGeometry(rrect(w - 0.012, d - 0.012, r - 0.006), cs);
    s.rotateX(-Math.PI / 2); s.translate(0, y + depth + 0.0045, z); parts.lam.push(s);
  };
  slab(L, 0.76, 0.13, 0.026, TOP - 0.03);
  for (const s of [-1, 1]) slab(L - 0.6, 0.28, 0.07, 0.028, SEAT - 0.036, s * 0.6);
  const fx = L / 2 - 0.45, seg = low ? 18 : 30;
  for (const x of [-fx, fx]) {
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        [x, 0.715, s * 0.15], [x, 0.33, s * 0.15], [x, 0.225, s * 0.2], [x, 0.185, s * 0.32], [x, 0.185, s * 0.5], [x, 0.235, s * 0.585], [x, 0.42, s * 0.6],
      ].map(([a, b, c]) => new THREE.Vector3(a, b, c)), false, 'centripetal');
      parts.chrome.push(new THREE.TubeGeometry(curve, seg, 0.016, 10, false));
      const stub = new THREE.CylinderGeometry(0.013, 0.013, 0.11, 16); stub.translate(x, 0.13, s * 0.565); parts.chrome.push(stub);
      const fork = roundedBox(0.04, 0.05, 0.06, 0.008, 1).clone(); fork.translate(x, 0.072, s * 0.575); parts.chrome.push(fork);
      const wheel = new THREE.CylinderGeometry(0.042, 0.042, 0.03, 16); wheel.rotateZ(Math.PI / 2); wheel.translate(x, 0.043, s * 0.585); parts.rubber.push(wheel);
      const bb = roundedBox(0.045, 0.018, 0.22, 0.006, 1).clone(); bb.translate(x, SEAT - 0.045, s * 0.6); parts.chrome.push(bb);
    }
    const tb = roundedBox(0.05, 0.02, 0.42, 0.006, 1).clone(); tb.translate(x, TOP - 0.042, 0); parts.chrome.push(tb);
  }
  const rail = new THREE.CylinderGeometry(0.014, 0.014, fx * 2, 16); rail.rotateZ(Math.PI / 2); rail.translate(0, 0.64, 0); parts.chrome.push(rail);
  const rail2 = new THREE.CylinderGeometry(0.012, 0.012, fx * 2, 16); rail2.rotateZ(Math.PI / 2); rail2.translate(0, 0.2, 0); parts.chrome.push(rail2);
  if (skirt) { const p = roundedBox(L - 0.4, 0.58, 0.024, 0.01, 1).clone(); p.translate(0, 0.42, 0); parts.skirt.push(p); }
  const out = {};
  for (const [k, list] of Object.entries(parts)) if (list.length) out[k] = mergeGeos(list.map(prep));
  return out;
}

// ------------------------------------------------------------------ the scene

export class CafeteriaScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'cafeteria';
    this.title = 'Столовая';
    this.background = 0x1c1a18;
    this.fog = new THREE.Fog(0xd2ccc0, 18, 52);
    this.camera = { distance: 7.0, height: 1.45, lookHeight: 1.4, lookZ: -1.1 };
    this.bounds = { walk: { areas: [{ minX: -9.5, maxX: 9.5, minZ: -2.4, maxZ: 0.9 }] }, camera: { minX: -6, maxX: 6 } };
    this.doors = [];
    this.spots = {};
    this.steam = [];
  }

  build() {
    const root = this.root;
    this.buildFloor();
    this.buildShell();
    this.buildCeiling();
    this.buildFarWall();
    this.buildEntryWing();
    this.buildServing();
    this.buildTables();
    this.buildLife();
    this.buildLights();

    // ---- contracts for the story
    this.doors = [{ id: 'cafe_out', label: 'В коридор', x: -8.6, z: -2.0, radius: 0.9, anchor: new THREE.Vector3(-8.6, 1.7, BACK + 0.2), to: 'school', spawn: { x: 9.6, z: -1.4, facing: -1 } }];
    this.anchors.serving = new THREE.Vector3(6.3, 1.5, BACK + 0.45);
    this.anchors.menu = new THREE.Vector3(7.6, 2.3, BACK + 0.08);
    this.anchors.vending = new THREE.Vector3(-6.55, 1.6, BACK + 0.5);
    this.anchors.window = new THREE.Vector3(2.0, 1.8, FAR + 0.2);
    this.anchors.banner = new THREE.Vector3(-0.4, 2.4, BACK + 0.1);
    this.anchors.door = this.doors[0].anchor;
    const seats = [];
    for (const zc of [-3.35, -5.6]) for (const xc of [-3.4, 3.2]) for (const dx of [-0.85, 0, 0.85]) seats.push({ x: +(xc + dx).toFixed(2), z: +(zc - 0.62).toFixed(2), y: -0.45 });
    this.spots = {
      girlsTable: { x: 3.2, z: -2.3 },
      seatsBehind: seats,                                  // on the far bench; lower the sprite by 0.45 m, the table chassis hides the rest
      queue: [{ x: 8.5, z: -2.15 }, { x: 7.7, z: -2.12 }, { x: 6.9, z: -2.1 }, { x: 6.1, z: -2.08 }],   // [0] = at the till, facing +x
      walkLanes: [{ z: -0.9, minX: -9.5, maxX: 9.5 }, { z: -4.47, minX: -5.0, maxX: 4.2 }, { z: -6.6, minX: -5.0, maxX: 4.2 }],
    };
    return root;
  }

  // ------------------------------------------------------------------ floor

  buildFloor() {
    const root = this.root;
    const W = RX1 - RX0, D = 3.6 - FAR, cz = (3.6 + FAR) / 2;
    const ft = tiled(terrazzoTex(false), W / 1.2, D / 1.2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.mat('cafeFloor', { map: ft, color: 0xeee6d6, roughness: 0.16, metalness: 0.0, forceStandard: true }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, cz); root.add(floor);
    // the dark runner stripes: one down the hall's centre aisle, one along the front aisle; terracotta borders
    const dm = this.mat('cafeStripe', { map: tiled(terrazzoTex(true), 1, 1), color: 0xffffff, roughness: 0.2, forceStandard: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const bm = this.mat('cafeStripeB', { color: 0x8a4a32, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const stripe = (x0, x1, z0, z1, m, rep = true) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      if (rep) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 1.2, uv.getY(i) * (z1 - z0) / 1.2); }
      const s = new THREE.Mesh(g, m); s.rotation.x = -Math.PI / 2; s.position.set((x0 + x1) / 2, 0.001, (z0 + z1) / 2); root.add(s);
    };
    stripe(-0.75, 0.45, FAR, -1.85, dm);                       // down the hall
    stripe(RX0, RX1, -1.85, -0.65, dm);                        // the front walkway
    for (const z of [-1.95, -0.55]) stripe(RX0, RX1, z - 0.05, z + 0.05, bm, false);
    for (const x of [-0.85, 0.55]) stripe(x - 0.05, x + 0.05, FAR, -2.0, bm, false);
    if (!this.low) {
      const refl = new Reflector(new THREE.PlaneGeometry(W, D), {
        textureWidth: Math.floor(window.innerWidth * 0.5), textureHeight: Math.floor(window.innerHeight * 0.5), shader: ReflShader, clipBias: 0.003,
      });
      refl.material.transparent = true; refl.material.blending = THREE.AdditiveBlending; refl.material.depthWrite = false;
      refl.rotation.x = -Math.PI / 2; refl.position.set(0, 0.002, cz); refl.renderOrder = 1;
      root.add(refl);
    } else {
      // low quality: soft fake sheen of the light strips on the polish
      for (const [x, z, s] of [[-7, -1.2, 1.4], [-2, -1.2, 1.4], [3, -1.2, 1.4], [8, -1.2, 1.4], [-1, -6.5, 2.2], [-1, -10, 2.6]]) { const g = glow(0xfff8e8, 2.2, 0.14); g.position.set(x, 0.01, z); g.scale.set(s * 1.4, 0.45, 1); root.add(g); }
    }
    // painted reflections (vending glow, cooler, the counter) and contact shadows
    this.floorRefl = (x, w, depth, color, op, z0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), new THREE.MeshBasicMaterial({ map: smearTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z0 + depth / 2); root.add(m); return m;
    };
    this.shadow = (x, z, w, d, op = 0.45, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex(), color: 0x000000, transparent: true, opacity: op, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, 0.006, z); root.add(m); return m;
    };
  }

  // ------------------------------------------------------------------ walls

  buildShell() {
    const root = this.root;
    const wallM = this.mat('cafeWall', { map: tiled(blockTex(), 2.5, 2.5), color: 0xffffff, roughness: 0.85 });
    const coveM = this.mat('cafeCove', { color: 0x3a2e28, roughness: 0.6 });
    const redM = this.mat('cafeRed', { color: 0xb02a22, roughness: 0.5 });
    this.wallM = wallM; this.redM = redM;
    // entry wing (doors to the corridor) and serving wing (pass-through to the kitchen)
    this.wall(RX0, HX0, H, BACK, wallM, [{ x0: -9.5, x1: -7.7, y0: 0, y1: 2.38 }]);
    this.wall(HX1, RX1, H, BACK, wallM, [{ x0: 5.5, x1: 8.7, y0: 1.02, y1: 2.12 }]);
    // the hall's side walls (seen in perspective)
    const lw = this.wall(-BACK, -FAR, H, 0, wallM); lw.position.set(HX0, 0, 0); lw.rotation.y = Math.PI / 2;
    const rw = this.wall(FAR, BACK, H, 0, wallM, [{ x0: -8.5, x1: -6.9, y0: 0.95, y1: 2.5 }, { x0: -11.7, x1: -10.1, y0: 0.95, y1: 2.5 }]);
    rw.position.set(HX1, 0, 0); rw.rotation.y = -Math.PI / 2;
    // bulkhead over the hall opening with the red accent panels
    this.box(HX1 - HX0 + 0.1, 0.62, 0.36, wallM, (HX0 + HX1) / 2, H - 0.31, BACK - 0.1);
    for (const x of [-4.2, -1.6, 1.0, 3.4]) this.box(0.52, 0.42, 0.02, redM, x, H - 0.31, BACK + 0.09);
    // cove base along every wall
    for (const [a, b] of [[RX0, -9.5], [-7.7, HX0], [HX1, RX1]]) this.box(b - a, 0.1, 0.03, coveM, (a + b) / 2, 0.05, BACK + 0.016);
    for (const x of [HX0 + 0.016, HX1 - 0.016]) { const c = this.box(0.03, 0.1, BACK - FAR, coveM, x, 0.05, (BACK + FAR) / 2); void c; }
    // red accent panels high on the side walls
    for (const z of [-5.2, -8.4, -11.6]) {
      this.box(0.02, 0.62, 0.55, redM, HX0 + 0.012, 3.15, z);
      this.box(0.02, 0.62, 0.55, redM, HX1 - 0.012, 3.15, z + 0.9);
    }
    // the two big square pillars at the hall opening, black speakers on them (like the reference)
    const pillarM = this.mat('cafePillar', { map: tiled(blockTex(), 0.7, 4.75), color: 0xfaf6ee, roughness: 0.8 });
    const spkM = this.mat('cafeSpeaker', { color: 0x16171a, roughness: 0.6 });
    for (const x of [HX0, HX1]) {
      const p = new THREE.Mesh(roundedBox(0.56, H, 0.56, 0.03, 1), pillarM); p.position.set(x, H / 2, BACK + 0.05); root.add(p);
      const s = new THREE.Mesh(roundedBox(0.22, 0.32, 0.2, 0.03, 1), spkM); s.position.set(x, 2.95, BACK + 0.42); s.rotation.x = 0.25; root.add(s);
      this.box(0.58, 0.1, 0.58, coveM, x, 0.05, BACK + 0.05);
    }
    // windows on the hall's right wall: the yard behind, aluminium frames
    const yard = yardTex();
    const viewM = new THREE.MeshBasicMaterial({ map: yard, color: 0xd6d6d4, fog: false });
    const sideView = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.2), viewM); sideView.position.set(HX1 + 2.2, 1.9, -9.3); sideView.rotation.y = -Math.PI / 2; root.add(sideView);
    const frameM = this.mat('cafeFrame', { color: 0x8a8e92, roughness: 0.35, metalness: 0.6 });
    this.frameM = frameM;
    for (const zc of [-7.7, -10.9]) this.windowFrame(HX1, zc, 1.6, 0.95, 2.5, frameM, true);
  }

  /** Aluminium window frame (+ sill and a pale glass sheen). `side`: on the right hall wall, facing -x. */
  windowFrame(x, c, w, y0, y1, frameM, side = false) {
    const g = new THREE.Group();
    const bar = (bw, bh, px, py) => { const m = new THREE.Mesh(roundedBox(bw, bh, 0.1, 0.015, 1), frameM); m.position.set(px, py, 0); g.add(m); };
    bar(w, 0.06, 0, y0); bar(w, 0.06, 0, y1); bar(w, 0.05, 0, (y0 + y1) / 2 + 0.2);
    bar(0.06, y1 - y0, -w / 2, (y0 + y1) / 2); bar(0.06, y1 - y0, w / 2, (y0 + y1) / 2); bar(0.04, y1 - y0, 0, (y0 + y1) / 2);
    const sill = new THREE.Mesh(roundedBox(w + 0.14, 0.04, 0.2, 0.012, 1), this.mat('cafeSill', { color: 0xd8d0c0, roughness: 0.4 })); sill.position.set(0, y0 - 0.03, 0.08); g.add(sill);
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, y1 - y0 - 0.08), new THREE.MeshBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
    sheen.position.set(0, (y0 + y1) / 2, -0.01); g.add(sheen);
    if (side) { g.position.set(x, 0, c); g.rotation.y = -Math.PI / 2; } else g.position.set(c, 0, x);
    this.root.add(g);
    return g;
  }

  // ------------------------------------------------------------------ ceiling + light strips

  buildCeiling() {
    const root = this.root;
    const W = RX1 - RX0, D = 3.6 - FAR;
    const ct = tiled(ceilTex(), W / 0.6, D / 1.2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), this.mat('cafeCeil', { map: ct, color: 0xffffff, roughness: 1, emissive: 0x5e5c58 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (3.6 + FAR) / 2); root.add(ceil);
    // long suspended fluorescent strips (along x), instanced: housing + lens + two hanger rods
    const strips = [];
    for (const z of [1.6, -1.3]) for (const x of [-9.4, -5.6, -1.8, 2.0, 5.8, 9.6]) strips.push([x, z, 3.0]);
    for (const z of [-4.6, -7.0, -9.4, -11.8]) for (const x of [-2.75, 1.85]) strips.push([x, z, 3.0]);
    const flick = strips.findIndex(([x, z]) => x === 1.85 && z === -9.4);
    const housingGeo = roundedBox(1, 0.07, 0.17, 0.025, 2);
    const lensGeo = new THREE.PlaneGeometry(1, 0.11); lensGeo.rotateX(Math.PI / 2);
    const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 16);
    const housingM = this.mat('cafeStripBody', { color: 0xe8e6e0, roughness: 0.5, metalness: 0.2 });
    const lensM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff6e8, emissiveIntensity: 1.7, emissiveMap: lensTex() });
    const rodM = this.mat('cafeRod', { color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 });
    const n = strips.length;
    const hous = new THREE.InstancedMesh(housingGeo, housingM, n), lens = new THREE.InstancedMesh(lensGeo, lensM, n - 1), rods = new THREE.InstancedMesh(rodGeo, rodM, n * 2);
    const d = new THREE.Object3D(); let li = 0;
    strips.forEach(([x, z, len], i) => {
      const y = H - 0.42;
      d.position.set(x, y, z); d.scale.set(len, 1, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); hous.setMatrixAt(i, d.matrix);
      if (i !== flick) { d.position.set(x, y - 0.037, z); d.updateMatrix(); lens.setMatrixAt(li++, d.matrix); }
      for (const s of [-1, 1]) { d.position.set(x + s * len * 0.4, H - 0.19, z); d.scale.set(1, 0.38, 1); d.updateMatrix(); rods.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix); }
    });
    for (const m of [hous, lens, rods]) { m.computeBoundingSphere(); root.add(m); }
    // the one tired tube that flickers (update)
    const [fx, fz, fl] = strips[flick];
    this.flickM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf4f8ff, emissiveIntensity: 1.5, emissiveMap: lensTex() });
    const f = new THREE.Mesh(lensGeo, this.flickM); f.scale.set(fl, 1, 1); f.position.set(fx, H - 0.42 - 0.037, fz); root.add(f);
    // HVAC diffusers and sprinkler heads in the grid
    const diffM = this.mat('cafeDiff', { color: 0xd8d6d0, roughness: 0.6 });
    for (const [x, z] of [[-7.5, 0.2], [0.2, 0.2], [7.5, 0.2], [-0.4, -5.8], [-0.4, -10.6]]) {
      const df = new THREE.Mesh(roundedBox(0.58, 0.04, 0.58, 0.015, 1), diffM); df.position.set(x, H - 0.02, z); root.add(df);
      const inner = new THREE.Mesh(roundedBox(0.36, 0.05, 0.36, 0.012, 1), this.mat('cafeDiffIn', { color: 0x9a9890, roughness: 0.8 })); inner.position.set(x, H - 0.03, z); root.add(inner);
    }
  }

  // ------------------------------------------------------------------ far wall: doors, windows, banner

  buildFarWall() {
    const root = this.root;
    const holes = [{ x0: -3.95, x1: -2.05, y0: 0, y1: 2.35 }, { x0: 0.15, x1: 1.75, y0: 0.95, y1: 2.5 }, { x0: 2.25, x1: 3.85, y0: 0.95, y1: 2.5 }];
    this.wall(HX0, HX1, H, FAR, this.wallM, holes);
    this.box(HX1 - HX0, 0.1, 0.03, this.mats.cache.get('cafeCove'), (HX0 + HX1) / 2, 0.05, FAR + 0.016);
    // the yard behind the glass
    const viewM = new THREE.MeshBasicMaterial({ map: yardTex(), color: 0xd8d8d6, fog: false });
    const view = new THREE.Mesh(new THREE.PlaneGeometry(13, 5.0), viewM); view.position.set(-0.5, 2.0, FAR - 2.2); root.add(view);
    for (const xc of [0.95, 3.05]) this.windowFrame(FAR, xc, 1.6, 0.95, 2.5, this.frameM);
    // glass double doors to the yard: aluminium stiles, push bars, an EXIT sign
    const fm = this.frameM;
    const door = new THREE.Group();
    for (const [w, h, x, y] of [[1.96, 0.08, 0, 2.36], [0.08, 2.36, -0.95, 1.18], [0.08, 2.36, 0.95, 1.18], [0.06, 2.32, 0, 1.16], [1.9, 0.2, 0, 0.1]]) {
      const m = new THREE.Mesh(roundedBox(w, h, 0.1, 0.015, 1), fm); m.position.set(x, y, 0); door.add(m);
    }
    for (const s of [-1, 1]) { const pb = new THREE.Mesh(roundedBox(0.7, 0.05, 0.06, 0.02, 1), this.mat('cafeChrome', { color: 0xe0e4e8, metalness: 1.0, roughness: 0.15 })); pb.position.set(s * 0.48, 1.0, 0.07); door.add(pb); }
    door.position.set(-3.0, 0, FAR + 0.02); root.add(door);
    const exit = this.textSign('EXIT', { w: 0.42, h: 0.16, bg: '#1a0a0a', fg: '#ff3a2a', font: 'bold 80px sans-serif', emissive: 1.2 });
    exit.position.set(-3.0, 2.58, FAR + 0.04); root.add(exit);
    // the team banner above the windows, red accent panels, the clock above the doors
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), this.mat('cafeMustang', { map: mustangTex(), color: 0xffffff, roughness: 0.85 }));
    ban.position.set(2.0, 3.15, FAR + 0.03); root.add(ban);
    for (const x of [-4.6, -1.3]) this.box(0.55, 0.85, 0.02, this.redM, x, 3.15, FAR + 0.012);
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.2, 28), this.mat('cafeClock', { map: clockTex(), color: 0xffffff, roughness: 0.5 }));
    clock.position.set(-3.0, 3.0, FAR + 0.03); root.add(clock);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 32), this.mats.cache.get('cafeSpeaker')); rim.position.copy(clock.position); root.add(rim);
    // the student council board between doors and windows
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), this.mat('cafeCouncil', { map: posterTex('council'), color: 0xffffff, roughness: 0.9 }));
    board.position.set(-1.0, 1.55, FAR + 0.03); root.add(board);
    // posters on the left hall wall
    for (const [kind, z, y] of [['rainbow', -7.4, 1.55], ['tryouts', -10.3, 1.55], ['hours', -4.5, 1.5]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.85), this.mat(`cafePoster-${kind}`, { map: posterTex(kind), color: 0xffffff, roughness: 0.8 }));
      p.position.set(HX0 + 0.012, y, z); p.rotation.y = Math.PI / 2; root.add(p);
    }
    // a pennant string across the hall (maroon and gold)
    const pen = new THREE.Shape(); pen.moveTo(-0.12, 0); pen.lineTo(0.12, 0); pen.lineTo(0, -0.3); pen.lineTo(-0.12, 0);
    const penGeo = new THREE.ShapeGeometry(pen);
    for (const [zz, col] of [[-6.3, 0], [-9.8, 1]]) {
      const N = 18, mats = [this.mat('cafePenA', { color: 0x8a1a1c, roughness: 0.8, side: THREE.DoubleSide }), this.mat('cafePenB', { color: 0xe8b838, roughness: 0.8, side: THREE.DoubleSide })];
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, x = HX0 + (HX1 - HX0) * t, y = 3.42 - Math.sin(t * Math.PI) * 0.32;
        pts.push(new THREE.Vector3(x, y, zz));
        if (i > 0 && i < N) { const p = new THREE.Mesh(penGeo, mats[(i + col) % 2]); p.position.set(x, y, zz); p.rotation.y = 0.15 * Math.sin(i * 1.7); root.add(p); }
      }
      root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.005, 6), this.mats.cache.get('cafeRod')));
    }
  }

  // ------------------------------------------------------------------ entry wing: doors, vending, bins

  buildEntryWing() {
    const root = this.root;
    // double doors to the corridor: oak leaves, tall glass with the corridor behind, push bars, kick plates
    const fm = this.mat('cafeDoorFrame', { color: 0x6a6e74, roughness: 0.4, metalness: 0.5 });
    for (const [w, h, x, y] of [[1.96, 0.08, -8.6, 2.42], [0.08, 2.42, -9.54, 1.21], [0.08, 2.42, -7.66, 1.21]]) { const m = new THREE.Mesh(roundedBox(w, h, 0.16, 0.015, 1), fm); m.position.set(x, y, BACK + 0.02); root.add(m); }
    const oak = this.mat('cafeOak', { color: 0xb07e44, roughness: 0.4 });
    const glassView = this.mat('cafeDoorGlass', { map: corridorTex(), color: 0xe8e4dc, emissive: 0x3a3428, roughness: 0.1, metalness: 0.2 });
    const steel = this.mat('cafeKick', { color: 0xb8bcc0, metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const cx = -8.6 + s * 0.45;
      const leaf = new THREE.Mesh(roundedBox(0.88, 2.36, 0.05, 0.012, 1), oak); leaf.position.set(cx, 1.18, BACK - 0.01); root.add(leaf);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.05), glassView); gl.position.set(cx, 1.58, BACK + 0.018); root.add(gl);
      const gf = new THREE.Mesh(roundedBox(0.48, 1.11, 0.02, 0.008, 1), fm); gf.position.set(cx, 1.58, BACK + 0.008); root.add(gf);
      const kick = new THREE.Mesh(roundedBox(0.84, 0.22, 0.01, 0.004, 1), steel); kick.position.set(cx, 0.13, BACK + 0.02); root.add(kick);
      const bar = new THREE.Mesh(roundedBox(0.66, 0.05, 0.06, 0.02, 1), steel); bar.position.set(cx, 1.0, BACK + 0.06); root.add(bar);
    }
    const sign = this.textSign('КОРИДОР · HALLWAY', { w: 1.3, h: 0.2, bg: '#1a2026', fg: '#e8e8e0' }); sign.position.set(-8.6, 2.72, BACK + 0.02); root.add(sign);
    const exit = this.textSign('EXIT', { w: 0.42, h: 0.16, bg: '#1a0a0a', fg: '#ff3a2a', font: 'bold 80px sans-serif', emissive: 1.2 }); exit.position.set(-8.6, 3.05, BACK + 0.03); root.add(exit);
    const eg = glow(0xff4030, 0.5, 0.22); eg.position.set(-8.6, 3.05, BACK + 0.1); root.add(eg);
    this.shadow(-8.6, BACK + 0.15, 2.0, 0.3, 0.3);
    // vending: drinks and snacks, glowing fronts, glow pools on the floor
    for (const [kind, x, col] of [['drink', -6.98, 0xffb8b0], ['snack', -6.08, 0xd8e4ff]]) {
      const body = this.mat(`cafeVend-${kind}`, { color: kind === 'drink' ? 0xa81a1a : 0x1e2a44, roughness: 0.4, metalness: 0.3 });
      const v = new THREE.Mesh(roundedBox(0.86, 1.84, 0.8, 0.03, 2), body); v.position.set(x, 0.92 + 0.02, BACK + 0.42); root.add(v);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.64), new THREE.MeshStandardMaterial({ map: vendTex(kind, false), emissiveMap: vendTex(kind, true), emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.25, metalness: 0.1 }));
      front.position.set(x, 1.0, BACK + 0.825); root.add(front);
      const gla = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
      gla.position.set(x - 0.1, 1.08, BACK + 0.835); root.add(gla);
      const top = new THREE.Mesh(roundedBox(0.84, 0.16, 0.06, 0.02, 1), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: kind === 'drink' ? 0xff5a4a : 0x7ab0ff, emissiveIntensity: 0.6 })); top.position.set(x, 1.78, BACK + 0.82); root.add(top);
      const gw = glow(col, 1.3, 0.16); gw.position.set(x - 0.1, 1.1, BACK + 1.0); root.add(gw);
      this.floorRefl(x - 0.1, 0.6, 1.1, kind === 'drink' ? 0xff6a50 : 0x8ab8ff, this.low ? 0.32 : 0.18, BACK + 0.85);
      this.pool(kind === 'drink' ? 0xff7060 : 0x80a8ff, x - 0.1, BACK + 1.25, 1.2, 0.9, 0.12);
      this.shadow(x, BACK + 0.45, 1.0, 0.95, 0.4);
      this.colliders.push({ x, z: BACK + 0.42, r: 0.45 });
    }
    // sorting station: trash / recycling / compost, a sign above, a little spill of napkins
    const binDefs = [['TRASH', 0x4a4c50, '#2a2c30'], ['RECYCLE', 0x2a5aa8, '#1a3a7a'], ['COMPOST', 0x3a7a3a, '#245024']];
    binDefs.forEach(([txt, c, bg], i) => {
      const x = -10.62 + i * 0.4;
      const bm = this.mat(`cafeBin-${txt}`, { color: c, roughness: 0.55 });
      const b = new THREE.Mesh(roundedBox(0.36, 0.86, 0.42, 0.05, 2), bm); b.position.set(x, 0.43, BACK + 0.3); root.add(b);
      const lid = new THREE.Mesh(roundedBox(0.38, 0.05, 0.44, 0.02, 1), bm); lid.position.set(x, 0.885, BACK + 0.3); root.add(lid);
      const slot = new THREE.Mesh(roundedBox(0.2, 0.02, 0.12, 0.008, 1), this.mats.cache.get('cafeSpeaker')); slot.position.set(x, 0.905, BACK + 0.35); root.add(slot);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), this.mat(`cafeBinLab-${txt}`, { map: binLabelTex(txt, bg), color: 0xffffff, roughness: 0.6 })); lab.position.set(x, 0.66, BACK + 0.515); root.add(lab);
    });
    this.shadow(-10.22, BACK + 0.35, 1.5, 0.6, 0.4);
    const sort = this.textSign('SORT IT! ♻', { w: 1.1, h: 0.22, bg: '#2a6a3a', fg: '#f2f2e8' }); sort.position.set(-10.22, 1.55, BACK + 0.02); root.add(sort);
    const hours = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.68), this.mats.cache.get('cafePoster-hours')); hours.position.set(-10.22, 2.25, BACK + 0.02); root.add(hours);
  }

  // ------------------------------------------------------------------ serving line

  buildServing() {
    const root = this.root;
    const cz = BACK + 0.42;
    const steelM = this.mat('cafeSteel', { map: steelTex(), color: 0xffffff, metalness: 0.7, roughness: 0.32 });
    const chrome = this.mat('cafeChrome', { color: 0xe0e4e8, metalness: 1.0, roughness: 0.15 });
    const frontM = this.mat('cafeCounterFront', { color: 0x8a2a22, roughness: 0.45 });
    // the kitchen behind the pass-through, warm; steel jambs to give the wall a thickness
    const kit = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.6), new THREE.MeshBasicMaterial({ map: kitchenTex(), color: 0xe8dccb, fog: false }));
    kit.position.set(7.1, 1.6, BACK - 0.9); root.add(kit);
    for (const [w, h, d, x, y, z] of [[3.3, 0.04, 0.3, 7.1, 1.0, BACK - 0.1], [3.3, 0.04, 0.3, 7.1, 2.14, BACK - 0.1], [0.04, 1.14, 0.3, 5.48, 1.57, BACK - 0.1], [0.04, 1.14, 0.3, 8.72, 1.57, BACK - 0.1]]) {
      const m = new THREE.Mesh(roundedBox(w, h, d, 0.01, 1), steelM); m.position.set(x, y, z); root.add(m);
    }
    // counter: red laminate front with a steel band, steel top, food wells, tray slide
    const body = new THREE.Mesh(roundedBox(3.4, 0.84, 0.74, 0.02, 1), steelM); body.position.set(7.1, 0.44, cz); root.add(body);
    const front = new THREE.Mesh(roundedBox(3.36, 0.56, 0.02, 0.01, 1), frontM); front.position.set(7.1, 0.5, cz + 0.375); root.add(front);
    const band = new THREE.Mesh(roundedBox(3.38, 0.06, 0.025, 0.01, 1), steelM); band.position.set(7.1, 0.82, cz + 0.375); root.add(band);
    const kick = new THREE.Mesh(roundedBox(3.36, 0.14, 0.02, 0.01, 1), this.mats.cache.get('cafeCove')); kick.position.set(7.1, 0.08, cz + 0.36); root.add(kick);
    const top = new THREE.Mesh(roundedBox(3.5, 0.04, 0.82, 0.012, 1), steelM); top.position.set(7.1, 0.88, cz); root.add(top);
    const food = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.46), this.mat('cafeFood', { map: foodTex(), color: 0xffffff, roughness: 0.5, emissive: 0x2a1408 }));
    food.rotation.x = -Math.PI / 2; food.position.set(6.95, 0.902, cz - 0.04); root.add(food);
    for (const z of [cz + 0.5, cz + 0.58, cz + 0.66]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 3.4, 16), chrome); r.rotation.z = Math.PI / 2; r.position.set(7.1, 0.8, z); root.add(r);
    }
    for (const x of [5.6, 7.1, 8.6]) { const br = new THREE.Mesh(roundedBox(0.03, 0.03, 0.32, 0.01, 1), chrome); br.position.set(x, 0.79, cz + 0.52); root.add(br); }
    // sneeze guard: a leaning glass pane and a glass shelf on chrome posts
    const glass = this.mat('cafeGlass', { color: 0xd9e6f0, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.22, depthWrite: false, emissive: 0x101418 });
    const pane = new THREE.Mesh(roundedBox(3.0, 0.48, 0.012, 0.005, 1), glass); pane.position.set(6.95, 1.2, cz + 0.2); pane.rotation.x = -0.32; root.add(pane);
    const shelf = new THREE.Mesh(roundedBox(3.0, 0.014, 0.34, 0.005, 1), glass); shelf.position.set(6.95, 1.47, cz); root.add(shelf);
    for (const x of [5.47, 6.95, 8.43]) for (const z of [cz - 0.12, cz + 0.12]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.6, 16), chrome); p.position.set(x, 1.18, z); root.add(p);
    }
    // heat lamps under the shelf: warm strips, halos, a warm spot on the food
    const lampHouse = new THREE.Mesh(roundedBox(2.8, 0.05, 0.12, 0.015, 1), this.mats.cache.get('cafeSpeaker')); lampHouse.position.set(6.95, 1.43, cz - 0.02); root.add(lampHouse);
    this.heatM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffa040, emissiveIntensity: 1.6 });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.05), this.heatM); strip.rotation.x = Math.PI / 2; strip.position.set(6.95, 1.403, cz - 0.02); root.add(strip);
    this.heatGlows = [];
    for (const x of [5.85, 6.6, 7.35, 8.1]) { const g = glow(0xffa050, 0.75, 0.3); g.position.set(x, 1.32, cz + 0.05); root.add(g); this.heatGlows.push(g); }
    const warm = new THREE.SpotLight(0xffa860, 7, 3.2, 1.1, 0.7, 1.4); warm.position.set(6.95, 1.42, cz); warm.target.position.set(6.95, 0.6, cz + 0.5); root.add(warm, warm.target);
    this.pool(0xffa050, 6.95, cz + 0.95, 3.2, 1.1, 0.12);
    this.floorRefl(6.95, 3.0, 1.0, 0xff9a50, this.low ? 0.18 : 0.1, cz + 0.4);
    this.shadow(7.1, cz + 0.2, 3.7, 1.0, 0.4);
    // steam rising off the wells (animated in update)
    for (let i = 0; i < (this.low ? 5 : 9); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff4e8, transparent: true, opacity: 0, depthWrite: false }));
      s.userData = { x: 5.7 + Math.random() * 2.5, z: cz - 0.05 + Math.random() * 0.15, t: Math.random() * 3, dur: 2.4 + Math.random() * 1.4 };
      root.add(s); this.steam.push(s);
    }
    // menu board above the pass-through
    const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.9), this.mat('cafeMenu', { map: menuTex(), color: 0xffffff, roughness: 0.8, emissive: 0x141414 }));
    menu.position.set(7.1, 2.75, BACK + 0.03); root.add(menu);
    const menuLamp = glow(0xfff0d8, 1.6, 0.08); menuLamp.position.set(7.1, 2.9, BACK + 0.25); root.add(menuLamp);
    // tray cart at the start of the line: stacked trays, cutlery bins, napkins
    const cart = new THREE.Mesh(roundedBox(0.52, 0.8, 0.56, 0.02, 1), steelM); cart.position.set(5.0, 0.42, cz + 0.02); root.add(cart);
    const trayCols = [0x7a2420, 0x3a6a72, 0xc8b48a];
    for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(roundedBox(0.44, 0.02, 0.34, 0.008, 1), this.mat(`cafeTrayStack${i % 3}`, { color: trayCols[i % 3], roughness: 0.45 })); t.position.set(5.0 + Math.sin(i * 2.1) * 0.01, 0.83 + i * 0.021, cz - 0.03); root.add(t); }
    for (let i = 0; i < 3; i++) { const bin = new THREE.Mesh(roundedBox(0.1, 0.1, 0.16, 0.02, 1), this.mat('cafeCutBin', { color: 0x3a3c40, roughness: 0.5 })); bin.position.set(4.86 + i * 0.12, 0.87, cz + 0.2); root.add(bin);
      for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(roundedBox(0.012, 0.12, 0.012, 0.004, 1), chrome); f.position.set(4.83 + i * 0.12 + k * 0.02, 0.95, cz + 0.2); f.rotation.z = (k - 1.5) * 0.12; root.add(f); } }
    // the till at the end of the line: a stand, the register with a green screen, a card reader
    const stand = new THREE.Mesh(roundedBox(0.6, 0.86, 0.66, 0.02, 1), steelM); stand.position.set(9.2, 0.43, cz); root.add(stand);
    const sfront = new THREE.Mesh(roundedBox(0.56, 0.56, 0.02, 0.01, 1), frontM); sfront.position.set(9.2, 0.5, cz + 0.335); root.add(sfront);
    const reg = new THREE.Mesh(roundedBox(0.36, 0.12, 0.3, 0.02, 1), this.mats.cache.get('cafeSpeaker')); reg.position.set(9.2, 0.92, cz - 0.05); root.add(reg);
    const scr = new THREE.Mesh(roundedBox(0.26, 0.18, 0.03, 0.01, 1), this.mats.cache.get('cafeSpeaker')); scr.position.set(9.2, 1.08, cz - 0.08); scr.rotation.x = -0.35; root.add(scr);
    const scrL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0x5ad08a })); scrL.position.set(9.2, 1.083, cz - 0.063); scrL.rotation.x = -0.35; root.add(scrL);
    const pay = this.textSign('PAY HERE', { w: 0.5, h: 0.14, bg: '#7a1418', fg: '#f2c84a' }); pay.position.set(9.2, 2.35, BACK + 0.03); root.add(pay);
    // the milk cooler: glass door, lit shelves
    const cool = new THREE.Mesh(roundedBox(0.8, 1.9, 0.7, 0.03, 2), this.mat('cafeCooler', { color: 0xd8dce0, roughness: 0.4, metalness: 0.3 })); cool.position.set(9.95, 0.95, BACK + 0.37); root.add(cool);
    const cf = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.76), new THREE.MeshStandardMaterial({ map: coolerTex(false), emissiveMap: coolerTex(true), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.15 }));
    cf.position.set(9.95, 0.98, BACK + 0.725); root.add(cf);
    const cg = glow(0xd8ecff, 1.4, 0.14); cg.position.set(9.95, 1.0, BACK + 0.9); root.add(cg);
    this.floorRefl(9.95, 0.6, 1.0, 0xc8e0ff, this.low ? 0.28 : 0.15, BACK + 0.75);
    this.shadow(9.95, BACK + 0.4, 0.95, 0.85, 0.4);
    // caution: wet floor
    const wet = this.mat('cafeWet', { map: wetTex(), color: 0xffffff, roughness: 0.4 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(roundedBox(0.3, 0.62, 0.012, 0.006, 1), wet); p.position.set(10.55, 0.3, -2.62 + s * 0.08); p.rotation.x = s * 0.2; root.add(p); }
    this.shadow(10.55, -2.62, 0.4, 0.3, 0.3);
    for (const x of [5.8, 6.8, 7.8, 8.7]) this.colliders.push({ x, z: cz, r: 0.42 });
    this.colliders.push({ x: 9.95, z: BACK + 0.37, r: 0.42 }, { x: 5.0, z: cz, r: 0.35 });
  }

  // ------------------------------------------------------------------ tables (instanced)

  buildTables() {
    const root = this.root;
    const lamM = this.mat('cafeLam', { map: tiled(laminateTex(), 1, 1), color: 0xffffff, roughness: 0.32, metalness: 0.0 });
    const edgeM = this.mat('cafeEdge', { color: 0x8a7a64, roughness: 0.5 });
    const chromeM = this.mats.cache.get('cafeChrome');
    const rubberM = this.mat('cafeRubber', { color: 0x141414, roughness: 0.7 });
    const skirtM = this.mat('cafeSkirt', { color: 0xbcb09a, roughness: 0.45 });
    const mats = { lam: lamM, edge: edgeM, chrome: chromeM, rubber: rubberM, skirt: skirtM };
    // near rows across the hall (skirted chassis: whoever sits behind is hidden below the top)
    const near = [];
    for (const z of [-3.35, -5.6]) for (const x of [-3.4, 3.2]) near.push({ x, z, ry: 0 });
    // four columns running into the depth, two tables each (the reference's perspective)
    const deep = [];
    for (const x of [-3.95, -2.05, 1.75, 3.55]) for (const z of [-8.2, -11.4]) deep.push({ x, z, ry: Math.PI / 2 });
    const d = new THREE.Object3D();
    const place = (unit, list) => {
      for (const [k, geo] of Object.entries(unit)) {
        const m = new THREE.InstancedMesh(geo, mats[k], list.length);
        list.forEach((p, i) => { d.position.set(p.x, 0, p.z); d.rotation.set(0, p.ry, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
        m.computeBoundingSphere(); root.add(m);
      }
    };
    place(tableUnit(2.8, { skirt: true, low: this.low }), near);
    place(tableUnit(2.7, { low: this.low }), deep);
    for (const p of near) this.shadow(p.x, p.z, 3.0, 1.6, 0.35);
    for (const p of deep) this.shadow(p.x, p.z, 1.6, 2.9, 0.3);
    for (const p of near) this.colliders.push({ x: p.x - 0.8, z: p.z, r: 0.6 }, { x: p.x + 0.8, z: p.z, r: 0.6 });
    this.tablePlaces = { near, deep };
    // foreground: the end of a table right at the camera (fades when it covers someone)
    const fg = new THREE.Group(); fg.name = 'fg-table'; root.add(fg); this.foregroundGroups.push(fg);
    const u = tableUnit(2.8, { low: this.low });
    for (const [k, geo] of Object.entries(u)) fg.add(new THREE.Mesh(geo, mats[k]));
    fg.position.set(-3.1, 0, 2.55);
    const tray = new THREE.Mesh(roundedBox(0.44, 0.02, 0.34, 0.008, 1), this.mat('cafeTray-0', { map: trayTex(0), color: 0xffffff, roughness: 0.4 }));
    tray.position.set(0.9, TOP + 0.012, -0.05); tray.rotation.y = 0.2; fg.add(tray);
    const bottle = this.bottle(0x6ab0e0); bottle.position.set(1.25, TOP, 0.18); fg.add(bottle);
    this.fgTable = fg;
  }

  /** A plastic water / juice bottle (lathe, label band, cap). */
  bottle(color = 0x6ab0e0) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry(V2([[0.001, 0], [0.032, 0.002], [0.034, 0.02], [0.033, 0.15], [0.03, 0.17], [0.014, 0.2], [0.013, 0.215], [0.001, 0.216]]), 16),
      this.mat(`cafeBottle-${color}`, { color, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.75 }));
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0345, 0.0345, 0.06, 16, 1, true), this.mat(`cafeBLabel-${color}`, { color: color === 0x6ab0e0 ? 0x2a5aa8 : 0xe8e0d0, roughness: 0.5 }));
    label.position.y = 0.09;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 16), this.mat('cafeCap', { color: 0x2a6ac8, roughness: 0.4 })); cap.position.y = 0.225;
    g.add(body, label, cap);
    return g;
  }

  // ------------------------------------------------------------------ life: trays, cartons, bags, coats

  buildLife() {
    const root = this.root;
    const r = rng(907);
    const trayGeo = roundedBox(0.44, 0.02, 0.34, 0.008, 1);
    const trayMats = [0, 1, 2, 3].map((v) => this.mat(`cafeTray-${v}`, { map: trayTex(v), color: 0xffffff, roughness: 0.4 }));
    const trays = [[], [], [], []], cartons = [], bottles = [];
    const local = (p, lx, lz) => { const c = Math.cos(p.ry), s = Math.sin(p.ry); return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c }; };
    const all = [...this.tablePlaces.near.map((p) => ({ ...p, L: 2.8 })), ...this.tablePlaces.deep.map((p) => ({ ...p, L: 2.7 }))];
    all.forEach((p, ti) => {
      const n = ti === 1 ? 2 : 1 + ((r() * 3) | 0);       // the girls' table (x 3.2, front row) keeps room for them
      for (let k = 0; k < n; k++) {
        const lx = (r() - 0.5) * (p.L - 0.7), lz = (r() < 0.5 ? -1 : 1) * 0.18;
        const q = local(p, lx, lz), v = (r() * 4) | 0;
        trays[v].push({ x: q.x, z: q.z, ry: p.ry + (r() - 0.5) * 0.4 });
        if (r() < 0.7) { const c = local(p, lx + 0.28, lz * 0.5); cartons.push({ x: c.x, z: c.z, ry: r() * 3 }); }
        if (r() < 0.4) { const c = local(p, lx - 0.3, -lz * 0.6); bottles.push({ x: c.x, z: c.z, color: r() < 0.5 ? 0x6ab0e0 : 0xf0a020 }); }
      }
    });
    const d = new THREE.Object3D();
    trays.forEach((list, v) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(trayGeo, trayMats[v], list.length);
      list.forEach((p, i) => { d.position.set(p.x, TOP + 0.012, p.z); d.rotation.set(0, p.ry, 0); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
      m.computeBoundingSphere(); root.add(m);
    });
    const cartonM = this.mat('cafeCarton', { map: cartonTex(), color: 0xffffff, roughness: 0.6 });
    const cartonGeo = roundedBox(0.065, 0.1, 0.065, 0.006, 1);
    const cm = new THREE.InstancedMesh(cartonGeo, cartonM, cartons.length);
    cartons.forEach((p, i) => { d.position.set(p.x, TOP + 0.05, p.z); d.rotation.set(0, p.ry, 0); d.updateMatrix(); cm.setMatrixAt(i, d.matrix); });
    cm.computeBoundingSphere(); root.add(cm);
    for (const b of bottles) { const o = this.bottle(b.color); o.position.set(b.x, TOP, b.z); root.add(o); }
    // backpacks on benches and on the floor, a puffer jacket over a bench, a forgotten basketball
    const packGeo = roundedBox(0.32, 0.42, 0.2, 0.07), pocketGeo = roundedBox(0.24, 0.16, 0.07, 0.03);
    const strapM = this.mat('cafeStrap', { color: 0x1a1a1a, roughness: 0.8 });
    const pack = (x, y, z, c, ry, rx = -0.12) => {
      const m = this.mat(`cafePack${c}`, { color: c, roughness: 0.9 });
      const b = new THREE.Mesh(packGeo, m); b.position.set(x, y + 0.21, z); b.rotation.set(rx, ry, 0); root.add(b);
      const pk = new THREE.Mesh(pocketGeo, m); pk.position.set(0, -0.07, 0.11); b.add(pk);
      const st = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16, Math.PI), strapM); st.position.set(0, 0.2, 0); b.add(st);
      this.shadow(x, z, 0.5, 0.35, 0.35);
    };
    pack(-4.1, SEAT, -3.35 + 0.6, 0x2a4a6a, 0.3);          // near bench, front row left
    pack(-2.6, 0, -2.62, 0x7a2a2a, -0.5);                  // on the floor by the front row
    pack(2.2, SEAT, -5.6 + 0.6, 0x3a5a3a, -0.2);
    pack(4.15, 0, -2.62, 0x5a3a6a, 0.6);                   // by the girls' table
    pack(-3.95 + 0.6, SEAT, -8.4, 0x8a6a2a, Math.PI / 2 + 0.2);
    pack(1.75 - 0.6, SEAT, -11.0, 0x2a2a2e, -Math.PI / 2);
    pack(3.55 + 0.6, SEAT, -7.6, 0xa83a2a, Math.PI / 2);
    // a puffer jacket slung over the near bench
    const jm = this.mat('cafeJacket', { color: 0x3a4a5a, roughness: 0.85 });
    for (let i = 0; i < 4; i++) { const j = new THREE.Mesh(roundedBox(0.5, 0.07, 0.22, 0.03, 2), jm); j.position.set(-2.95 + i * 0.03, SEAT + 0.03 + i * 0.03, -2.75 - (i % 2) * 0.04); j.rotation.set(0.1 * i, 0.15 * i, (i - 1.5) * 0.06); root.add(j); }
    const ballM = this.mat('cafeBall', { color: 0xd86a2a, roughness: 0.7 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), ballM); ball.position.set(-1.6, 0.12, -7.3); root.add(ball);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.004, 6, 28), strapM); seam.position.copy(ball.position); seam.rotation.y = 0.5; root.add(seam);
    // the Winter Formal banner hung on the bulkhead, slightly sagging cloth
    const bg = new THREE.PlaneGeometry(3.4, 0.85, 24, 1);
    const pos = bg.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / 3.4 + 0.5) * Math.PI) * 0.03 + Math.sin(pos.getX(i) * 5) * 0.006);
    bg.computeVertexNormals();
    const banner = new THREE.Mesh(bg, this.mat('cafeFormal', { map: formalTex(), color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }));
    banner.position.set(-0.4, 2.98, BACK + 0.11); root.add(banner);
  }

  // ------------------------------------------------------------------ light

  buildLights() {
    const root = this.root;
    const hemi = new THREE.HemisphereLight(0xf6f4ee, 0xc8bca8, 1.0);
    const key = new THREE.DirectionalLight(0xfff0dc, 0.55); key.position.set(-3, 3, 7);
    const sky = new THREE.DirectionalLight(0xe4ecf8, 0.45); sky.position.set(2, 3.5, -16);
    root.add(hemi, key, sky);
    for (const [x, y, z, i, dist] of [[-6.5, 3.2, -0.6, 5, 9], [5.5, 3.2, -0.6, 5, 9], [-0.4, 3.3, -6.2, 6, 10], [-0.4, 3.3, -10.8, 6, 10]]) {
      const l = new THREE.PointLight(0xfff6ea, i, dist, 1.2); l.position.set(x, y, z); root.add(l);
    }
    // daylight pools under the windows
    this.pool(0xe8eef8, 2.0, FAR + 1.2, 4.2, 2.2, 0.1);
    this.pool(0xe8eef8, -3.0, FAR + 1.0, 2.2, 2.0, 0.1);
    this.lights = { hemi, key, sky };
    this.windowLights = [
      flareSource('PALE', new THREE.Vector3(2.0, 1.8, FAR + 0.1), { triggerDistance: 4.6, fadeDistance: 2.0, intensity: 0.4, flareSize: 0.6 }),
      flareSource('LAMP', new THREE.Vector3(6.95, 1.36, BACK + 0.5), { triggerDistance: 1.6, fadeDistance: 1.4, intensity: 0.45, flareSize: 0.5 }),
    ];
  }

  update(dt) {
    super.update(dt);
    const t = this.time;
    // the tired strip: mostly on, now and then a stutter
    if (this.flickM) {
      const ph = t % 7.3;
      this.flickM.emissiveIntensity = ph > 6.4 ? (Math.sin(t * 61) > 0.2 ? 1.5 : 0.25) : 1.5 + Math.sin(t * 120) * 0.04;
    }
    if (this.heatM) this.heatM.emissiveIntensity = 1.55 + Math.sin(t * 1.7) * 0.08;
    // steam over the wells
    for (const s of this.steam) {
      const u = s.userData; u.t += dt;
      if (u.t > u.dur) { u.t = 0; u.x = 5.7 + Math.random() * 2.5; }
      const k = u.t / u.dur;
      s.position.set(u.x + Math.sin(t * 0.8 + u.x * 3) * 0.04 * k, 0.95 + k * 0.42, u.z);
      s.scale.setScalar(0.12 + k * 0.28);
      s.material.opacity = Math.sin(k * Math.PI) * 0.16;
    }
  }
}
