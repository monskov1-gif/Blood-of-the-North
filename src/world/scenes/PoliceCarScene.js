import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow, lightPool } from '../props.js';
import { Snow } from '../Particles.js';

/**
 * Police car — a side-on cut-away of a police interceptor cabin (the near side
 * is open, like a dollhouse). Julian sits on the hard rear bench behind the
 * partition, the officer drives. Whitehorse scrolls past in parallax layers:
 * sky → mountains → spruce hills → town → poles/lamps → oncoming lane → road.
 * x: rear (-) → front (+). Camera looks in from +z.
 *
 * Surfaces use small nearest-filtered canvas textures (1 texel ≈ 1 cm) so the
 * cabin sits in the same pixel-art register as the character sprites.
 */

const FAR = -1.45;    // far side wall (inside face)
const ROAD = -0.28;   // road surface (behind the matte; only the scenery layers use it)
// sedan profile in world metres (x to the front): floor, headliner, roof span
const FL = 0.22;
const ROOF_IN = 1.58, ROOF_X0 = -1.12, ROOF_X1 = 0.44;
// cabin opening (the near cut), going round from the rear floor
const CABIN = [[-1.4, 0.17], [-1.4, 1.02], [ROOF_X0, ROOF_IN], [ROOF_X1, ROOF_IN], [1.02, 1.0], [1.02, 0.17]];
// far wall of the cabin (same outline, a little larger, behind everything)
const CABIN_WALL = [[-1.48, 0.15], [1.1, 0.15], [1.1, 0.98], [ROOF_X1 + 0.02, ROOF_IN + 0.04], [ROOF_X0 - 0.02, ROOF_IN + 0.04], [-1.48, 1.0]];
// outer body: trunk, rear glass, roof, windscreen, hood
const BODY_OUTER = [
  [-1.98, 0.08], [-2.04, 0.5], [-2.0, 0.88], [-1.86, 0.98], [-1.56, 1.04], [-1.4, 1.3], [-1.28, 1.52],
  [-1.14, 1.65], [-0.82, 1.69], [0.3, 1.68], [0.55, 1.62], [0.85, 1.32], [1.12, 1.03], [1.5, 0.98],
  [1.82, 0.93], [1.95, 0.82], [1.98, 0.45], [1.92, 0.08],
];
// side windows: rear door (sloped rear edge under the C pillar), front door (raked A pillar)
const WIN_Y0 = 0.92;
const WINDOWS = [
  [[-1.28, WIN_Y0], [-0.37, WIN_Y0], [-0.37, 1.5], [-1.1, 1.5], [-1.28, 1.16]],
  [[-0.21, WIN_Y0], [0.96, WIN_Y0], [0.52, 1.5], [-0.21, 1.5]],
];

const PX = (key, w, h, draw) => canvasTexture(`car-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;

function noiseFill(ctx, w, h, [R, G, B], amt, r) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (r() - 0.5) * amt;
    ctx.fillStyle = rgb(R + n, G + n, B + n);
    ctx.fillRect(x, y, 1, 1);
  }
}

/** Worn charcoal seat vinyl with stitched channels and shiny wear. */
const seatTex = () => PX('seat', 32, 32, (ctx, w, h) => {
  const r = rng(11);
  noiseFill(ctx, w, h, [52, 56, 62], 10, r);
  for (const sy of [9, 21]) {
    ctx.fillStyle = 'rgba(16,18,22,0.8)'; ctx.fillRect(0, sy, w, 1);
    for (let x = 0; x < w; x += 2) { ctx.fillStyle = 'rgba(120,124,130,0.7)'; ctx.fillRect(x, sy + 1, 1, 1); }
  }
  for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(150,156,166,0.18)'; ctx.fillRect(r() * w, r() * h, 3 + r() * 6, 1 + r() * 2); }
  for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(10,10,12,0.5)'; ctx.fillRect(r() * w, r() * h, 1, 2 + r() * 4); }
});

/** Hard molded rear bench plastic: black, ridged, scuffed by a thousand jeans. */
const benchTex = () => PX('bench', 32, 32, (ctx, w, h) => {
  const r = rng(12);
  noiseFill(ctx, w, h, [30, 32, 35], 7, r);
  for (const sy of [7, 23]) { ctx.fillStyle = 'rgba(80,84,90,0.6)'; ctx.fillRect(0, sy, w, 1); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, sy + 1, w, 1); }
  for (let i = 0; i < 14; i++) { ctx.fillStyle = `rgba(150,150,150,${0.1 + r() * 0.2})`; ctx.fillRect(r() * w, r() * h, 2 + r() * 7, 1); }
});

/** Door card / trim plastic: dark grey with a fine grain and scuffs low down. */
const trimTex = () => PX('trim', 32, 32, (ctx, w, h) => {
  const r = rng(13);
  noiseFill(ctx, w, h, [58, 62, 68], 9, r);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(20,20,22,${0.2 + r() * 0.3})`; ctx.fillRect(r() * w, h * 0.6 + r() * h * 0.4, 2 + r() * 5, 1); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(140,140,140,0.15)'; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1); }
});

/** Headliner fabric: pale grey with a dotted weave and a few stains. */
const headTex = () => PX('head', 32, 32, (ctx, w, h) => {
  const r = rng(14);
  noiseFill(ctx, w, h, [128, 130, 134], 8, r);
  for (let y = 0; y < h; y += 2) for (let x = (y / 2) % 2; x < w; x += 2) { ctx.fillStyle = 'rgba(90,92,96,0.35)'; ctx.fillRect(x, y, 1, 1); }
  ctx.fillStyle = 'rgba(110,96,70,0.25)'; ctx.beginPath(); ctx.ellipse(20, 12, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
});

/** Ribbed rubber floor mat with white road-salt bloom. */
const floorTex = () => PX('floor', 32, 32, (ctx, w, h) => {
  const r = rng(15);
  noiseFill(ctx, w, h, [24, 26, 28], 6, r);
  for (let y = 1; y < h; y += 4) { ctx.fillStyle = 'rgba(60,64,70,0.8)'; ctx.fillRect(0, y, w, 1); }
  for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(200,204,206,${0.08 + r() * 0.22})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
});

/** Scratched dark steel (partition lower panel). */
const steelTex = () => PX('steel', 32, 32, (ctx, w, h) => {
  const r = rng(16);
  noiseFill(ctx, w, h, [70, 74, 80], 12, r);
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(190,196,204,${0.15 + r() * 0.3})`; ctx.lineWidth = 1;
    const x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 14, y + (r() - 0.5) * 6); ctx.stroke();
  }
  for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) { ctx.fillStyle = '#b8bec6'; ctx.fillRect(x, y, 1, 1); ctx.fillStyle = '#202226'; ctx.fillRect(x + 1, y + 1, 1, 1); }
});

/** Expanded steel mesh (alpha). */
const meshTex = () => PX('mesh', 32, 32, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x + y) % 8 === 0 || (x - y + 64) % 8 === 0) { ctx.fillStyle = (x + y) % 16 === 0 ? '#c4cad2' : '#7a8088'; ctx.fillRect(x, y, 1, 1); }
  }
});

/** Polycarbonate scratches (alpha). */
const plexiTex = () => PX('plexi', 64, 64, (ctx, w, h) => {
  const r = rng(17);
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(230,236,244,${0.2 + r() * 0.5})`; ctx.lineWidth = 1;
    const x = r() * w, y = r() * h, a = r() * Math.PI, L = 3 + r() * 16;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
  }
  // a smeared hand print and a scratched tag
  ctx.fillStyle = 'rgba(220,226,232,0.18)'; ctx.fillRect(24, 30, 9, 11); for (let k = 0; k < 4; k++) ctx.fillRect(24 + k * 2, 24 + (k % 2), 1, 6);
  ctx.strokeStyle = 'rgba(240,244,250,0.6)'; ctx.beginPath(); ctx.moveTo(10, 50); ctx.lineTo(13, 44); ctx.lineTo(16, 50); ctx.moveTo(18, 44); ctx.lineTo(18, 50); ctx.lineTo(22, 50); ctx.stroke();
});

/** Frost creeping in from the window edges + condensation beads (alpha). */
const frostTex = (seed) => PX(`frost${seed}`, 96, 32, (ctx, w, h) => {
  const r = rng(seed);
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.min(x / w * 3.0, (w - 1 - x) / w * 3.0, y / h * 1.2 + 0.25, (h - 1 - y) / h);
    const p = Math.exp(-d * 9) * 1.6 + (r() < 0.012 ? 0.6 : 0);
    if (r() < p) { const a = 0.35 + r() * 0.5; ctx.fillStyle = r() < 0.3 ? `rgba(255,255,255,${a})` : `rgba(206,222,238,${a})`; ctx.fillRect(x, y, 1, 1); }
  }
  // fern-like crystals from the lower corners
  ctx.strokeStyle = 'rgba(236,244,252,0.55)'; ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    let x = r() < 0.5 ? r() * 14 : w - r() * 14, y = h - 1 - r() * 6;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (x < w / 2 ? 1 : -1) * (1 + r() * 2); y -= 1 + r() * 2; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // condensation beads and two drips
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(220,230,240,${0.2 + r() * 0.25})`; ctx.fillRect(r() * w, h * 0.45 + r() * h * 0.55, 1, 1); }
  for (let k = 0; k < 2; k++) { const x = 20 + r() * (w - 40); ctx.fillStyle = 'rgba(220,232,244,0.35)'; ctx.fillRect(x, h * 0.4 + r() * 4, 1, h * 0.5); }
});

/** Mobile data terminal: query screen about the arrested man. */
const terminalTex = () => canvasTexture('car-terminal', 128, 80, (ctx, w, h) => {
  ctx.fillStyle = '#06111c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1d4c7c'; ctx.fillRect(0, 0, w, 10);
  ctx.fillStyle = '#e8f2ff'; ctx.font = 'bold 8px monospace'; ctx.textBaseline = 'top';
  ctx.fillText('MDT  QUERY  08:42', 3, 1);
  ctx.fillStyle = '#3a4a5a'; ctx.fillRect(4, 14, 24, 30);
  ctx.fillStyle = '#1a222c'; ctx.beginPath(); ctx.arc(16, 25, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(7, 33, 18, 11);
  ctx.font = '7px monospace';
  const lines = [['#8fd0ff', 'SUBJ: JULIAN'], ['#8fd0ff', 'INC 24-0417'], ['#8fd0ff', 'NORTHERN ROSE'], ['#ff6a5a', 'MULT. FATAL'], ['#9affb0', 'IN CUSTODY']];
  lines.forEach(([c, t], i) => { ctx.fillStyle = c; ctx.fillText(t, 32, 14 + i * 8); });
  for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(143,208,255,0.35)'; ctx.fillRect(4, 50 + i * 6, 40 + (i * 23) % 70, 2); }
  ctx.fillStyle = '#1d4c7c'; ctx.fillRect(0, h - 9, w, 9);
  ctx.fillStyle = '#e8f2ff'; ctx.fillText('F1 RUN  F2 CPIC  F5 DISP', 3, h - 8);
  for (let y = 0; y < h; y += 2) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, y, w, 1); }
}, { nearest: true, aniso: 1 });

/** Siren / light controller face. */
const sirenTex = () => PX('siren', 32, 16, (ctx, w, h) => {
  ctx.fillStyle = '#121416'; ctx.fillRect(0, 0, w, h);
  const cols = ['#5a1010', '#10204a', '#3a3c40', '#3a3c40', '#5a4a10', '#3a3c40'];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = cols[(i + j * 3) % 6]; ctx.fillRect(2 + i * 5, 3 + j * 6, 4, 4); }
  ctx.fillStyle = '#ff3020'; ctx.fillRect(30, 2, 1, 1);
  ctx.fillStyle = '#d8dce0'; ctx.fillRect(2, 14, 12, 1);
});

// ---- outside layers (transparent tops, scrolled with texture offsets)

export const skyTex = () => canvasTexture('car-sky', 8, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3c4858'); g.addColorStop(0.45, '#7a8798'); g.addColorStop(0.8, '#b8c0ca'); g.addColorStop(0.9, '#d4ccc4'); g.addColorStop(1, '#c8ccd2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

export const mountainTex = () => PX('mtn', 256, 64, (ctx, w, h) => {
  const r = rng(21);
  ctx.clearRect(0, 0, w, h);
  const ridge = (k) => (x) => h * (0.25 + k * 0.18) + Math.sin(x / w * Math.PI * 2 * (2 + k) + k * 1.7) * 9 + Math.sin(x / w * Math.PI * 2 * (7 + k)) * 4 + Math.sin(x / w * Math.PI * 2 * 13) * 1.5;
  [['#8a96a6', '#d6dee8'], ['#6e7a8a', '#bcc6d2']].forEach(([rock, snow], k) => {
    const f = ridge(k);
    for (let x = 0; x < w; x++) {
      const top = Math.round(f(x));
      for (let y = top; y < h; y++) {
        const snowy = y - top < 5 + Math.sin(x * 0.7) * 2 + (r() < 0.2 ? 2 : 0);
        ctx.fillStyle = snowy ? snow : rock; ctx.fillRect(x, y, 1, 1);
      }
      if (r() < 0.2) { ctx.fillStyle = 'rgba(40,50,60,0.15)'; ctx.fillRect(x, top + 6, 1, 6 + r() * 10); }
    }
  });
});

export const treeTex = () => PX('trees', 256, 64, (ctx, w, h) => {
  const r = rng(22);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#4c5864';
  for (let x = 0; x < w; x++) { const top = Math.round(h * 0.55 + Math.sin(x / w * Math.PI * 4) * 5); ctx.fillRect(x, top, 1, h - top); }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * w), base = Math.round(h * 0.62 + r() * 8), H = 10 + Math.floor(r() * 18);
    for (let y = 0; y < H; y++) {
      const half = Math.floor((y / H) * 4) + ((y % 3 === 0) ? 1 : 0);
      for (let dx = -half; dx <= half; dx++) {
        const xx = (x + dx + w) % w;
        ctx.fillStyle = (y % 3 === 0 && Math.abs(dx) === half) ? '#a8b4c0' : '#2e3842';
        ctx.fillRect(xx, base - H + y, 1, 1);
      }
    }
  }
  // late autumn: birches and aspens, half bare, the last yellow/orange leaves
  const leaf = ['#d8a020', '#e0b830', '#c86a1c', '#b8401c'];
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * w), base = Math.round(h * 0.66 + r() * 6), H = 12 + Math.floor(r() * 14);
    ctx.fillStyle = i % 2 ? '#d8d4ca' : '#8a8478'; ctx.fillRect(x, base - H, 1, H);
    for (let k = 0; k < 8; k++) { ctx.fillStyle = '#4a4038'; ctx.fillRect(x + Math.round((r() - 0.5) * 6), base - H + Math.floor(r() * H * 0.6), 1, 1); }
    for (let k = 0; k < 6 + r() * 8; k++) { ctx.fillStyle = leaf[Math.floor(r() * 4)]; ctx.fillRect((x + Math.round((r() - 0.5) * 7) + w) % w, base - H + Math.floor(r() * H * 0.55), 1, 1); }
  }
  // the verge: dead grass with the first snow in patches
  for (let x = 0; x < w; x++) for (let y = h - 6; y < h; y++) {
    const snowy = r() < 0.35;
    const v = snowy ? 220 + r() * 25 : 0;
    ctx.fillStyle = snowy ? rgb(v, v + 3, v + 8) : rgb(122 + r() * 20, 108 + r() * 16, 80 + r() * 12); ctx.fillRect(x, y, 1, 1);
  }
});

/** Whitehorse: clapboard houses, shops with lit windows, a log "skyscraper". */
export const townTex = () => PX('town', 256, 128, (ctx, w, h) => {
  const r = rng(23);
  ctx.clearRect(0, 0, w, h);
  const G = h - 4;
  const lit = () => (r() < 0.5 ? ['#ffcf84', '#e89a48'][Math.floor(r() * 2)] : null);
  const window4 = (x, y, ww = 4, wh = 5) => {
    const l = lit();
    ctx.fillStyle = '#d8dde2'; ctx.fillRect(x - 1, y - 1, ww + 2, wh + 2);
    ctx.fillStyle = l || '#2a3440'; ctx.fillRect(x, y, ww, wh);
    if (l) { ctx.fillStyle = 'rgba(120,50,30,0.6)'; ctx.fillRect(x, y, 1, wh); ctx.fillStyle = 'rgba(255,200,120,0.18)'; ctx.fillRect(x - 3, y - 3, ww + 6, wh + 6); }
  };
  const snowRoof = (x0, x1, y) => {
    // first snow: a thin broken line on the eaves
    for (let x = x0 - 1; x < x1 + 1; x++) if (r() < 0.6) { ctx.fillStyle = 'rgba(236,240,244,0.85)'; ctx.fillRect(x, y - 1, 1, 1); }
  };
  const smoke = (x, y) => { for (let k = 0; k < 6; k++) { ctx.fillStyle = `rgba(226,230,236,${0.38 - k * 0.05})`; ctx.beginPath(); ctx.arc(x + k * 2 + Math.sin(k) * 2, y - k * 5, 2 + k, 0, Math.PI * 2); ctx.fill(); } };
  const house = (x, bw, bh, wall) => {
    const y = G - bh;
    ctx.fillStyle = wall; ctx.fillRect(x, y, bw, bh);
    for (let yy = y + 2; yy < G; yy += 3) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, yy, bw, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, 1, bh); ctx.fillRect(x + bw - 1, y, 1, bh);
    const peak = Math.round(bw * 0.38);
    for (let k = 0; k <= peak; k++) {
      const half = Math.round((bw / 2 + 3) * (k / peak));
      ctx.fillStyle = k < 1 ? '#d8dde2' : '#3c3e44'; ctx.fillRect(x + bw / 2 - half, y - peak + k, half * 2, 1);
    }
    snowRoof(x - 3, x + bw + 3, y);
    const cols = Math.max(1, Math.floor((bw - 6) / 10));
    for (let c = 0; c < cols; c++) window4(x + 5 + c * ((bw - 10) / Math.max(1, cols - 1 || 1)), y + 6, 4, 5);
    if (bh > 26) for (let c = 0; c < cols; c++) if (c !== 1) window4(x + 5 + c * ((bw - 10) / Math.max(1, cols - 1 || 1)), y + 20, 4, 5);
    ctx.fillStyle = '#3a2620'; ctx.fillRect(x + Math.round(bw * 0.55), G - 10, 5, 10);
    const cx = x + Math.round(bw * 0.7);
    ctx.fillStyle = '#5a3a30'; ctx.fillRect(cx, y - peak * 0.6 - 6, 3, 8); smoke(cx + 1, y - peak * 0.6 - 9);
  };
  const shop = (x, bw, bh, wall, sign, signCol) => {
    const y = G - bh;
    ctx.fillStyle = wall; ctx.fillRect(x, y, bw, bh);
    for (let i = 0; i < bw * bh * 0.08; i++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + r() * bw, y + r() * bh, 1, 1); }
    ctx.fillStyle = '#2a2c30'; ctx.fillRect(x - 1, y - 2, bw + 2, 2);
    snowRoof(x - 1, x + bw + 1, y - 1);
    ctx.fillStyle = '#1c1e22'; ctx.fillRect(x + 3, y + 5, bw - 6, 8);
    ctx.fillStyle = signCol; ctx.font = 'bold 7px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
    ctx.fillText(sign, x + bw / 2, y + 5);
    // shop windows, lit
    const sy = G - 16;
    for (let sx = x + 3; sx < x + bw - 10; sx += 13) {
      ctx.fillStyle = '#e0a860'; ctx.fillRect(sx, sy, 10, 10);
      ctx.fillStyle = 'rgba(255,230,180,0.6)'; ctx.fillRect(sx + 1, sy + 1, 3, 9);
      ctx.fillStyle = 'rgba(60,30,20,0.5)'; ctx.fillRect(sx + 6, sy + 4, 2, 6);
      ctx.fillStyle = 'rgba(255,200,120,0.15)'; ctx.fillRect(sx - 2, sy - 2, 14, 14);
    }
    ctx.fillStyle = '#2a1c16'; ctx.fillRect(x + bw - 9, G - 13, 6, 13);
    if (bh > 30) for (let c = x + 4; c < x + bw - 5; c += 8) window4(c, y + 16, 4, 5);
  };
  const logTower = (x) => {
    for (let k = 0; k < 3; k++) {
      const bw = 18 - k * 2, y0 = G - (k + 1) * 14, x0 = x + k;
      for (let yy = 0; yy < 14; yy++) { ctx.fillStyle = yy % 2 ? '#5a3a24' : '#7a5232'; ctx.fillRect(x0, y0 + yy, bw, 1); ctx.fillStyle = '#9a7048'; ctx.fillRect(x0 - 1, y0 + yy, 1, 1); ctx.fillRect(x0 + bw, y0 + yy, 1, 1); }
      window4(x0 + 3, y0 + 4, 3, 4); window4(x0 + bw - 6, y0 + 4, 3, 4);
      snowRoof(x0 - 1, x0 + bw + 1, y0);
    }
  };
  let x = 2;
  const plan = [
    () => house(x, 34, 30, '#7a3e34'), () => shop(x, 46, 34, '#6c665c', 'CAFE', '#ff7a5a'),
    () => house(x, 30, 24, '#4e6068'), () => logTower(x), () => shop(x, 44, 26, '#5a5048', 'HARDWARE', '#e8d090'),
    () => house(x, 36, 34, '#8a7c62'), () => shop(x, 40, 30, '#4a5a66', 'MOTEL', '#ff4a6a'),
  ];
  const widths = [34, 46, 30, 18, 44, 36, 40];
  plan.forEach((f, i) => { f(); x += widths[i] + 4 + Math.floor(r() * 3); });
  // wet sidewalk, slush at the edges, fallen leaves
  ctx.fillStyle = '#6a6e74'; ctx.fillRect(0, G, w, h - G);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(220,226,232,0.7)'; ctx.fillRect(r() * w, G + (r() < 0.5 ? 0 : h - G - 1), 2 + r() * 4, 1); }
  for (let i = 0; i < 30; i++) { ctx.fillStyle = ['#c88a20', '#b8501c', '#d8b030'][i % 3]; ctx.fillRect(r() * w, G + r() * (h - G), 1, 1); }
});

export const roadTex = () => PX('road', 64, 64, (ctx, w, h) => {
  const r = rng(24);
  noiseFill(ctx, w, h, [92, 98, 106], 14, r);
  // packed snow between and beside the ruts
  for (let y = 0; y < h; y++) {
    const rut = (y > 14 && y < 22) || (y > 40 && y < 48);
    if (rut) continue;
    for (let x = 0; x < w; x++) if (r() < 0.55) { const v = 180 + r() * 40; ctx.fillStyle = rgb(v, v + 4, v + 10, 0.85); ctx.fillRect(x, y, 1, 1); }
  }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(110,90,70,0.35)'; ctx.fillRect(r() * w, r() * h, 2, 1); }
  for (let x = 0; x < w; x += 1) { ctx.fillStyle = 'rgba(40,44,50,0.25)'; ctx.fillRect(x, 18, 1, 1); ctx.fillRect(x, 44, 1, 1); }
});

export const bankTex = () => PX('bank', 256, 32, (ctx, w, h) => {
  const r = rng(25);
  ctx.clearRect(0, 0, w, h);
  for (let x = 0; x < w; x++) {
    const top = Math.round(8 + Math.sin(x * 0.09) * 3 + Math.sin(x * 0.31) * 2 + (r() < 0.1 ? -1 : 0));
    for (let y = top; y < h; y++) {
      const k = (y - top) / (h - top);
      // the verge in late autumn: dead grass and earth, first snow in thin patches
      const snowy = r() < 0.3 * (1 - k);
      let v = 230 - k * 30 + (r() - 0.5) * 10;
      let c = snowy ? rgb(v, v + 4, v + 10) : rgb(110 + r() * 26 - k * 30, 98 + r() * 20 - k * 26, 72 + r() * 14 - k * 20);
      if (!snowy && r() < 0.04) c = ['#c88a20', '#b8501c', '#d8b030'][Math.floor(r() * 3)];
      ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1);
    }
  }
});

const hubTex = () => PX('hub', 32, 32, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#16181a'; ctx.beginPath(); ctx.arc(16, 16, 15.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c2f33'; ctx.beginPath(); ctx.arc(16, 16, 10, 0, Math.PI * 2); ctx.fill();
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.fillStyle = '#8a9098'; ctx.fillRect(16 + Math.cos(a) * 6 - 1, 16 + Math.sin(a) * 6 - 1, 2, 2); }
  ctx.fillStyle = '#b0b6bc'; ctx.fillRect(14, 14, 4, 4);
  ctx.fillStyle = '#4a4e54'; ctx.fillRect(15, 4, 2, 4);
});

// ------------------------------------------------------------------ scene

export class PoliceCarScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'car';
    this.title = 'Полицейская машина';
    this.background = 0x000000;
    this.camera = { distance: 2.8, height: 1.02, lookHeight: 0.92, lookZ: -0.6, fov: 34, minWidth: 3.62 };
    this.bounds = { walk: { minX: -1.15, maxX: 0.95, minZ: 0.2, maxZ: 0.2 }, camera: { minX: 0.0, maxX: 0.0 } };
    this.speed = 9; // m/s of the outside layers
  }

  /** Box with UVs scaled to its size, so pixel textures keep ~1 cm texels. */
  B(w, h, d, mat, x, y, z, parent = this.root, tile = 0.32) {
    const m = this.box(w, h, d, mat, x, y, z, parent);
    const uv = m.geometry.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
    return m;
  }

  pmat(key, tex, opts = {}) { return this.mat(key, { map: tex, color: 0xffffff, roughness: 0.75, ...opts }); }

  build() {
    this.buildSedan();
    this.buildOutside();
    this.buildMatte();
    this.buildBodySection();
    this.buildLighting();
    const A = this.anchors;
    // seated sprites: the anchor is the torso line; Julian's back sits on the bench
    // back, his knees ~15 cm short of the cage; the driver right in front of it
    A.julianSeat = new THREE.Vector3(-0.95, FL, -0.35);
    A.driverSeat = new THREE.Vector3(0.09, FL, -0.12);
    A.window = new THREE.Vector3(-0.72, 1.22, -1.4);
    A.cuffs = new THREE.Vector3(-0.66, 0.86, -0.25);
    A.cage = new THREE.Vector3(-0.33, 1.22, -0.25);
    A.driverHead = new THREE.Vector3(0.0, 1.45, -0.12);
    A.radio = new THREE.Vector3(0.82, 0.86, -0.8);
    A.outsideFront = new THREE.Vector3(0.4, 1.2, -1.4);
    this.gazeRange = { minX: -1.15, maxX: 0.95 };
    // painted VN backdrop: from the back seat, past the cage to the dash and the road
    this.shots = { car: { pos: [-1.05, 1.32, 0.05], look: [0.7, 1.05, -0.9], fov: 64 } };
    this.vnHide = [];
    return this.root;
  }

  /** Flat wall from a polygon outline with polygon holes (x/y in the wall plane). */
  polyWall(outline, holes, z, mat, parent = this.root) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / 2, pos.getY(k) / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    parent.add(m);
    return m;
  }

  /** A box laid along a segment in the x/y plane (pillars, glass, seals). */
  slab(x0, y0, x1, y1, th, mat, z, d, parent = this.root) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const m = this.B(th, L, d, mat, (x0 + x1) / 2, (y0 + y1) / 2, z, parent);
    m.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    return m;
  }

  /**
   * The near-side cut of the body as one dark sedan section (roof falling to the
   * rear glass and the raked windscreen, short trunk and hood). Only the cabin
   * opening is cut out, so nothing of the set shows outside the car.
   */
  buildBodySection() {
    const shape = new THREE.Shape(BODY_OUTER.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes.push(new THREE.Path(CABIN.map(([x, y]) => new THREE.Vector2(x, y))));
    const mat = new THREE.MeshBasicMaterial({ color: 0x131417 }); mat.userData.noLightingState = true;
    const sec = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), mat);
    sec.position.z = 0.36; sec.renderOrder = 2;
    this.root.add(sec);
    // the paint edge catches a little street light: a faint line on the roof and hood
    const rim = new THREE.Line(new THREE.BufferGeometry().setFromPoints(BODY_OUTER.slice(3, 15).map(([x, y]) => new THREE.Vector3(x, y, 0.37))),
      new THREE.LineBasicMaterial({ color: 0x2a323c }));
    this.root.add(rim);
  }

  /** Black all around the body, open only where the side windows are. */
  buildMatte() {
    const black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
    black.userData.noLightingState = true;
    this.polyWall([[-30, -10], [30, -10], [30, 20], [-30, 20]], WINDOWS, FAR - 0.12, black);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), black);
    under.position.set(0, FL - 10.02, 0.4); this.root.add(under);
  }

  // ---------------------------------------------------------------- the sedan

  /**
   * Cabin of a police sedan, sized around the seated sprites (1 px = 1 cm):
   * rear molded bench, partition cage on the B pillar, driver's seat right in
   * front of it, a sloped dash with the wheel on its column, a raked windscreen
   * and rear glass, the beltline under the shoulders. Everything is in world
   * metres; x runs to the front of the car.
   */
  buildSedan() {
    const root = this.root;
    const pm = (key, tex, o = {}) => this.mat(key, { map: tex, color: 0xffffff, roughness: 0.75, ...o });
    const trim = pm('carTrim', trimTex());
    const head = pm('carHead', headTex(), { roughness: 0.95, color: 0xa8acb2 });
    const bench = pm('carBench', benchTex(), { roughness: 0.45, color: 0xb8bcc4 });
    const seat = pm('carSeat', seatTex(), { roughness: 0.6 });
    const floorM = pm('carFloorMat', floorTex(), { roughness: 0.9 });
    const dark = this.mat('carDark', { color: 0x141518, roughness: 0.7 });
    const plastic = this.mat('carPlastic', { color: 0x26282c, roughness: 0.6 });
    const rubber = this.mat('carSeal', { color: 0x0e0f11, roughness: 0.7 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const glassBlack = this.mat('carGlassDark', { color: 0x0c1218, roughness: 0.1, metalness: 0.3 });
    const Z0 = FAR, Z1 = 0.3, ZC = (Z0 + Z1) / 2, D = Z1 - Z0;

    // far side: door panels below the beltline, B pillar, glass openings
    const wallTex = trimTex().clone(); wallTex.needsUpdate = true; wallTex.repeat.set(4, 4);
    this.polyWall(CABIN_WALL, WINDOWS, FAR, this.mat('carWall', { map: wallTex, color: 0x9ca0a8, roughness: 0.8 }));
    for (const win of WINDOWS) for (let k = 0; k < win.length; k++) {
      const [ax, ay] = win[k], [bx, by] = win[(k + 1) % win.length];
      this.slab(ax, ay, bx, by, 0.03, rubber, FAR + 0.02, 0.05);
    }
    for (const win of WINDOWS) {
      const xs = win.map((q) => q[0]), ys = win.map((q) => q[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      const glass = this.plane(w, h, this.mat('carGlassSide', { color: 0x9ab0c4, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }), cx, cy, FAR - 0.01);
      glass.renderOrder = 3;
      const frost = this.plane(w, h * 0.35, new THREE.MeshBasicMaterial({ map: frostTex(cx < 0 ? 31 : 32), transparent: true, depthWrite: false, color: 0xc8d2dc }), cx, Math.min(...ys) + h * 0.17, FAR + 0.005);
      frost.renderOrder = 4;
    }
    // door panels: armrest, pull, speaker, map pocket (rear) / switches (front)
    for (const [x0, x1] of [[-1.28, -0.38], [-0.2, 0.96]]) {
      const cx = (x0 + x1) / 2, w = x1 - x0;
      this.B(w, 0.06, 0.08, trim, cx, 0.66, FAR + 0.05);
      this.B(w * 0.6, 0.12, 0.03, dark, cx + w * 0.1, 0.44, FAR + 0.03);
      this.B(0.12, 0.025, 0.04, steel, cx - w * 0.15, 0.76, FAR + 0.05);
    }
    this.B(0.14, 1.36, 0.06, trim, -0.29, 0.9, FAR + 0.03); // B pillar trim
    // floor pan + mats, rear footwell hump
    this.B(2.34, 0.06, D, dark, -0.16, FL - 0.03, ZC);
    this.B(0.9, 0.01, D - 0.2, floorM, -0.83, FL + 0.005, ZC);
    this.B(1.05, 0.01, D - 0.2, floorM, 0.38, FL + 0.005, ZC);
    // headliner: flat over the seats, the glass falls away at both ends
    this.B(ROOF_X1 - ROOF_X0, 0.04, D, head, (ROOF_X0 + ROOF_X1) / 2, ROOF_IN + 0.02, ZC);
    // rear glass and windscreen only in the far half: in the cut their near part
    // would fall across the heads in perspective
    const ZG0 = FAR, ZG1 = -0.7;
    this.slab(CABIN[1][0], CABIN[1][1], ROOF_X0, ROOF_IN, 0.04, glassBlack, (ZG0 + ZG1) / 2, ZG1 - ZG0);  // rear glass
    this.slab(CABIN[4][0], CABIN[4][1], ROOF_X1, ROOF_IN, 0.04, glassBlack, (ZG0 + ZG1) / 2, ZG1 - ZG0);  // windscreen
    this.B(0.26, 0.02, 0.14, this.mat('dome', { color: 0x6a665e, emissive: 0x1a1610, roughness: 0.4 }), -0.3, ROOF_IN, -0.6);
    for (const x of [-0.72, 0.3]) this.B(0.22, 0.025, 0.03, plastic, x, 1.48, FAR + 0.06); // grab handles
    // rear: one-piece molded plastic bench, low; backrest against the rear bulkhead
    this.B(0.56, 0.12, 1.12, bench, -0.98, 0.56, -0.8);
    this.B(0.06, 0.1, 1.12, bench, -0.69, 0.53, -0.8).rotation.z = -0.25;           // front lip
    this.B(0.5, 0.28, 1.0, dark, -1.02, 0.36, -0.82);                                // pedestal
    this.slab(-1.15, 0.6, -1.26, 1.12, 0.07, bench, -0.75, 1.2);                     // backrest
    this.B(0.12, 0.42, D, dark, -1.4, 0.4, ZC);                                      // bulkhead under the deck
    // partition cage on the B pillar: steel lower panel, plexi + mesh upper
    this.B(0.035, 0.7, D - 0.1, this.mat('cageSteel', { color: 0x2c3034, metalness: 0.5, roughness: 0.5 }), -0.33, FL + 0.35, ZC);
    const plexi = this.plane(D - 0.1, ROOF_IN - 0.95, new THREE.MeshBasicMaterial({ map: plexiTex(), transparent: true, opacity: 0.55, depthWrite: false, color: 0x9aa8b4 }), -0.33, (ROOF_IN + 0.95) / 2, ZC, Math.PI / 2);
    plexi.renderOrder = 4;
    const mesh = this.plane(D - 0.1, ROOF_IN - 0.95, new THREE.MeshBasicMaterial({ map: meshTex(), transparent: true, alphaTest: 0.3, color: 0x8a9096 }), -0.325, (ROOF_IN + 0.95) / 2, ZC, Math.PI / 2);
    void mesh;
    for (const y of [FL + 0.7, ROOF_IN - 0.02]) this.B(0.05, 0.03, D - 0.1, steel, -0.33, y, ZC);
    this.B(0.05, ROOF_IN - FL, 0.04, steel, -0.33, (ROOF_IN + FL) / 2, 0.18);
    // front seats (driver near, passenger far): low cushions, raked backs, headrests
    for (const z of [-0.36, -1.0]) {
      this.B(0.46, 0.1, 0.5, seat, 0.06, 0.66, z);
      this.B(0.4, 0.3, 0.44, dark, 0.06, 0.46, z);
      this.slab(-0.15, 0.68, -0.24, 1.2, 0.11, seat, z, 0.5);
      this.B(0.1, 0.16, 0.26, seat, -0.25, 1.32, z);
      for (const dz of [-0.06, 0.06]) this.B(0.012, 0.07, 0.012, steel, -0.245, 1.22, z + dz);
    }
    // center console between the front seats: cup holder (coffee), the bottle, radio head
    this.B(0.6, 0.3, 0.2, plastic, 0.3, FL + 0.15, -0.68);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.11, 10), this.mat('cupRed', { color: 0x9a1c1c, roughness: 0.6 }));
    cup.position.set(0.18, FL + 0.36, -0.62); root.add(cup);
    this.bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), this.mat('bottle', { color: 0xb8d0e0, transparent: true, opacity: 0.7, roughness: 0.1 }));
    this.bottle.position.set(0.42, FL + 0.4, -0.72); root.add(this.bottle);
    this.steam = [];
    if (!this.low) for (let k = 0; k < 3; k++) { const st = glow(0xdfe6ee, 0.07, 0.22); st.position.set(0.18, FL + 0.45, -0.62); root.add(st); this.steam.push(st); }
    // dash: sloped top, instrument hood, center stack (radio + siren controller)
    this.slab(0.66, 0.98, 1.02, 1.04, 0.05, plastic, ZC, D);                        // dash top, sloping to the screen
    this.B(0.08, 0.42, D, plastic, 0.68, 0.76, ZC);                                  // dash face
    this.B(0.3, 0.32, D, dark, 0.86, 0.72, ZC);
    this.B(0.12, 0.08, 0.32, plastic, 0.66, 1.03, -0.35);                            // instrument hood
    const stack = this.B(0.04, 0.24, 0.22, this.mat('carStack', { color: 0x1a1c20, roughness: 0.5 }), 0.71, 0.8, -0.8);
    void stack;
    this.radioLed = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.012), this.mat('radioLed', { color: 0, emissive: 0x40ff60, emissiveIntensity: 3 }));
    this.radioLed.position.set(0.688, 0.88, -0.75); this.radioLed.rotation.y = -Math.PI / 2; root.add(this.radioLed);
    this.B(0.03, 0.06, 0.16, this.mat('siren', { map: sirenTex(), color: 0xffffff, roughness: 0.5 }), 0.69, 0.72, -0.82);
    this.sirenLed = glow(0xff2a1a, 0.035, 0.8); this.sirenLed.material = this.sirenLed.material.clone(); this.sirenLed.position.set(0.66, 0.74, -0.76); root.add(this.sirenLed);
    // steering column + wheel, raked toward the driver
    this.slab(0.86, 0.92, 0.6, 1.08, 0.06, plastic, -0.36, 0.08);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 24), plastic);
    wheel.position.set(0.58, 1.1, -0.36); wheel.rotation.order = 'ZYX'; wheel.rotation.y = Math.PI / 2; wheel.rotation.z = -0.55;
    root.add(wheel); this.wheel = wheel;
    // mobile data terminal on its console arm
    this.slab(0.4, FL + 0.32, 0.46, 0.92, 0.03, steel, -0.72, 0.03);
    const term = new THREE.Group();
    this.B(0.02, 0.2, 0.28, plastic, 0, 0, 0, term);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.16), new THREE.MeshBasicMaterial({ map: terminalTex(), color: 0x6a7a90 }));
    scr.rotation.y = -Math.PI / 2; scr.position.x = -0.012; term.add(scr);
    term.position.set(0.47, 1.0, -0.72); term.rotation.z = 0.25; root.add(term);
    this.screenGlow = glow(0x6a9ad8, 0.3, 0.2); this.screenGlow.material = this.screenGlow.material.clone(); this.screenGlow.position.set(0.42, 1.0, -0.7); root.add(this.screenGlow);
    // floor: wet off the boots, a leaf, a crumpled receipt
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), this.mat('slush', { color: 0x30363c, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.7 }));
    wet.rotation.x = -Math.PI / 2; wet.scale.set(1.5, 0.8, 1); wet.position.set(-0.6, FL + 0.012, -0.5); root.add(wet);
    this.B(0.05, 0.004, 0.035, this.mat('wetLeaf', { color: 0x8a5214, roughness: 0.4 }), -0.52, FL + 0.014, -0.4).rotation.y = 0.6;
    // the near door's lower edge on the cut: the floor line, feet stay visible
    const sill = new THREE.Group(); sill.name = 'fg-sill';
    this.B(3.6, 0.1, 0.06, this.mat('carDoorTrim', { color: 0x16181c, roughness: 0.75 }), -0.2, FL - 0.03, 0.31, sill);
    root.add(sill);
    this.foregroundGroups.push(sill);
    this.wheels = [];
  }

  // ---------------------------------------------------------------- outside, parallax

  buildOutside() {
    const root = this.root;
    const basic = (map, opts = {}) => new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.5, ...opts });
    this.layers = [];
    const layer = (tex, w, h, x, y, z, rep, speed, color) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(t, { color }));
      m.position.set(x, y, z);
      root.add(m);
      this.layers.push({ tex: t, speed: speed / (w / rep) });
      return m;
    };
    // sky + the low winter sun behind cloud
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 60), new THREE.MeshBasicMaterial({ map: skyTex(), depthWrite: false }));
    sky.position.set(0, 14, -70); root.add(sky);
    const sun = glow(0xffd8b0, 16, 0.28); sun.position.set(14, 10, -66); root.add(sun);
    layer(mountainTex(), 140, 22, 0, 6.5, -55, 2, 0.25, 0xc8d0dc);
    layer(treeTex(), 60, 9, 0, 3.4, -24, 4, 1.8, 0xb8c2cc);
    const town = layer(townTex(), 26, 13, 0, 6.2, -10, 2, 3.6, 0xd4d8de);
    town.position.y = ROAD + 13 / 2 - 0.1;
    const bank = layer(bankTex(), 18, 1.4, 0, ROAD + 0.55, -5.0, 2.2, 6.5, 0xe8eef4);
    void bank;
    // (no road plane under the car: outside the glass everything is black)

    // near parallax units: power pole + wires to the next pole, a street lamp, spruce
    const S = 7.0, UNITS = 4;
    this.loop = S * UNITS;
    const wood = new THREE.MeshLambertMaterial({ color: 0x3a3028 });
    const lampM = new THREE.MeshLambertMaterial({ color: 0x2a2e34 });
    const spruce = new THREE.MeshLambertMaterial({ color: 0x1e2a28 });
    const snowy = new THREE.MeshLambertMaterial({ color: 0xdce4ec });
    const wireM = new THREE.LineBasicMaterial({ color: 0x23272c });
    this.units = [];
    for (let u = 0; u < UNITS; u++) {
      const g = new THREE.Group();
      const z = -5.8;
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 8.2, 0.2), wood); pole.position.set(0, ROAD + 4.1, z); g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), wood); arm.position.set(0, ROAD + 7.6, z); g.add(arm);
      const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), wood); arm2.position.set(0, ROAD + 7.1, z); g.add(arm2);
      if (u % 2 === 0) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8), lampM); tr.position.set(0.25, ROAD + 6.4, z); g.add(tr); }
      const wpts = [];
      for (const [wy, wz] of [[7.65, -0.7], [7.65, 0.7], [7.15, 0.0], [7.15, -0.6]]) {
        for (let i = 0; i < 12; i++) {
          const t0 = i / 12, t1 = (i + 1) / 12;
          const sag = (t) => -Math.sin(t * Math.PI) * 0.45;
          wpts.push(new THREE.Vector3(t0 * S, ROAD + wy + sag(t0), z + wz), new THREE.Vector3(t1 * S, ROAD + wy + sag(t1), z + wz));
        }
      }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wpts), wireM));
      // street lamp (cobra head over the road), still burning in the late dawn
      const lx = S * 0.5, lz = -4.5;
      const lp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 6.0, 0.1), lampM); lp.position.set(lx, ROAD + 3.0, lz); g.add(lp);
      const la = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.4), lampM); la.position.set(lx, ROAD + 5.95, lz + 0.7); g.add(la);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.45), lampM); head.position.set(lx, ROAD + 5.9, lz + 1.4); g.add(head);
      const lg = glow(0xffc890, 1.2, 0.55); lg.position.set(lx, ROAD + 5.8, lz + 1.4); g.add(lg);
      // spruce (stacked cones, snow-laden) on every other unit
      if (u % 2 === 1) {
        const tx = S * 0.25, tz = -6.8;
        for (let k = 0; k < 4; k++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(1.0 - k * 0.2, 1.6, 7), spruce); c.position.set(tx, ROAD + 1.3 + k * 0.9, tz); g.add(c);
          if (k === 3) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 7), snowy); s.position.set(tx, ROAD + 2.15 + k * 0.9, tz); g.add(s); } // a little first snow on the tip
        }
      } else {
        // a road sign
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), lampM); sp.position.set(S * 0.8, ROAD + 1.1, -4.4); g.add(sp);
        const sign = this.textSign(u === 0 ? 'MAXIMUM 50' : 'MAIN ST', { w: 0.6, h: u === 0 ? 0.7 : 0.22, bg: u === 0 ? '#e8ecee' : '#1e5a3a', fg: u === 0 ? '#111' : '#e8f0e8' });
        sign.position.set(S * 0.8, ROAD + 2.0, -4.36); g.add(sign);
      }
      g.position.x = -10 + u * S;
      root.add(g);
      this.units.push(g);
    }

    // occasional oncoming car (headlights sweep the cabin)
    if (!this.low) {
      const oc = new THREE.Group();
      const bodyM = new THREE.MeshLambertMaterial({ color: 0x5a1e1c });
      const glassM = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.62, 1.8), bodyM); b1.position.y = 0.6; oc.add(b1);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.7), glassM); b2.position.set(0.5, 1.15, 0); oc.add(b2);
      const sn = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.6), snowy); sn.position.set(0.5, 1.43, 0); oc.add(sn);
      for (const x of [-1.5, 1.5]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.82, 12), new THREE.MeshLambertMaterial({ color: 0x0c0c0e })); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.34, 0); oc.add(wh); }
      const hl = glow(0xfff0d0, 1.2, 0.8); hl.position.set(-2.35, 0.65, 0.6); oc.add(hl);
      const tl = glow(0xff2a1a, 0.4, 0.6); tl.position.set(2.35, 0.7, 0.6); oc.add(tl);
      oc.position.set(40, ROAD, -3.3);
      root.add(oc);
      this.oncoming = oc;
      this.nextCar = 4 + Math.random() * 6;
    }

    // snow streaks outside (wind + motion) and some flakes above the roof
    const n = this.low ? 90 : 220;
    const pos = new Float32Array(n * 6);
    this.streakBoxes = [];
    for (let i = 0; i < n; i++) {
      const above = false; // only what passes the windows
      const box = above ? [-4, 4, 1.95, 3.2, -1.4, 0.6] : [-6, 6, ROAD, 3.4, -4.8, -1.6];
      this.streakBoxes.push(box);
      const x = box[0] + Math.random() * (box[1] - box[0]), y = box[2] + Math.random() * (box[3] - box[2]), z = box[4] + Math.random() * (box[5] - box[4]);
      const L = 0.1 + Math.random() * 0.22;
      pos.set([x, y, z, x + L, y + L * 0.25, z], i * 6);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xf0f6ff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.streaks.frustumCulled = false;
    root.add(this.streaks);
    // a few slow, big flakes close to the glass
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-3, 0.5, -2.4), new THREE.Vector3(3, 2.6, -1.6)), this.low ? 40 : 90);
    root.add(this.snow.points);
    this.animated.push(this.snow);
  }

  // ---------------------------------------------------------------- lighting

  buildLighting() {
    const root = this.root;
    const hemi = new THREE.HemisphereLight(0x8a9ab2, 0x141618, 0.75);
    const day = new THREE.DirectionalLight(0xd0dcef, 0.6);
    day.position.set(-1, 4, 3);
    // cool window light on Julian, a small warm pool over the front, the dash
    // glow, and a cool rim on the driver from her window
    const fill = new THREE.PointLight(0xc4d2e8, 2.4, 2.4, 1.4); fill.position.set(-0.7, 1.25, 0.4);
    const front = new THREE.PointLight(0xffe2c0, 2.2, 2.0, 1.5); front.position.set(0.1, 1.4, -0.3);
    const dash = new THREE.PointLight(0x5a9ac8, 1.8, 1.4, 1.6); dash.position.set(0.6, 1.05, -0.5);
    const rimL = new THREE.PointLight(0xa8c0e0, 2.2, 1.4, 1.6); rimL.position.set(0.25, 1.35, -1.25);
    root.add(hemi, day, fill, front, dash, rimL);
    this.lights = { hemi, day, fill, front, dash };
    this.fillBase = 2.4;
    const p1 = lightPool(0xc8d6ea, 1.0, 0.7, 0.07); p1.rotation.x = -Math.PI / 2; p1.position.set(-0.95, 0.63, -0.8); root.add(p1);
    const sweep = lightPool(0xfff2dc, 0.6, 0.9, 0.0);
    sweep.position.set(3, 1.1, FAR + 0.09); root.add(sweep);
    this.sweep = sweep; this.sweepT = 3; this.sweepRun = -1;
  }

  // ---------------------------------------------------------------- per frame

  startSweep() { this.sweepRun = 0; }

  update(dt) {
    super.update(dt);
    const t = this.time;
    const v = this.speed;
    for (const L of this.layers) L.tex.offset.x += dt * L.speed * (v / 9);
    for (const u of this.units) {
      u.position.x -= dt * v * 0.75;
      if (u.position.x < -12) u.position.x += this.loop;
    }
    // snow streaks
    const p = this.streaks.geometry.attributes.position.array;
    for (let i = 0, k = 0; i < p.length; i += 6, k++) {
      const b = this.streakBoxes[k];
      const dx = dt * v * (b[2] > 1.9 ? 0.5 : 0.8), dy = dt * 0.9;
      p[i] -= dx; p[i + 3] -= dx; p[i + 1] -= dy; p[i + 4] -= dy;
      if (p[i + 3] < b[0] || p[i + 1] < b[2]) {
        const x = b[0] + (b[1] - b[0]) * (p[i + 3] < b[0] ? 1 : Math.random()), y = p[i + 1] < b[2] ? b[3] : p[i + 1];
        const L = p[i + 3] - p[i];
        p[i] = x - L; p[i + 3] = x; p[i + 1] = y; p[i + 4] = y + L * 0.25;
      }
    }
    this.streaks.geometry.attributes.position.needsUpdate = true;
    // oncoming traffic
    if (this.oncoming) {
      this.nextCar -= dt;
      const oc = this.oncoming;
      if (this.nextCar <= 0 && oc.position.x > 30) { oc.position.x = 16; this.nextCar = 9 + Math.random() * 9; this.carSwept = false; }
      if (oc.position.x < 30) {
        oc.position.x -= dt * v * 1.9;
        if (!this.carSwept && oc.position.x < 4) { this.carSwept = true; this.startSweep(); }
        if (oc.position.x < -18) oc.position.x = 40;
      }
    }
    // light sweep across the far side (sun between buildings / headlights)
    this.sweepT -= dt;
    if (this.sweepT <= 0 && this.sweepRun < 0) { this.startSweep(); this.sweepT = 7 + Math.random() * 6; }
    if (this.sweepRun >= 0) {
      this.sweepRun += dt;
      const k = this.sweepRun / 1.4;
      this.sweep.position.x = 1.2 - k * 2.6;
      this.sweep.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.22;
      this.lights.fill.intensity = this.fillBase + Math.sin(Math.min(1, k) * Math.PI) * 1.6 * Math.max(0, 1 - Math.abs(this.sweep.position.x + 0.7));
      if (k >= 1) { this.sweepRun = -1; this.sweep.material.opacity = 0; this.lights.fill.intensity = this.fillBase; }
    }
    // wheels, engine/road vibration, steering corrections
    for (const w of this.wheels) w.rotation.z -= dt * v / 0.34;
    this.root.position.y = Math.sin(t * 23) * 0.004 + Math.sin(t * 3.1) * 0.006;
    this.wheel.rotation.x = Math.sin(t * 0.7) * 0.06; // small steering corrections
    this.radioLed.material.emissiveIntensity = Math.random() < 0.02 ? 6 : 3;
    this.sirenLed.material.opacity = (Math.floor(t * 1.2) % 2) ? 0.8 : 0.25;
    this.screenGlow.material.opacity = 0.2 + Math.sin(t * 7.3) * 0.015;
    for (let i = 0; i < this.steam.length; i++) {
      const s = this.steam[i];
      const ph = (t * 0.35 + i / this.steam.length) % 1;
      s.position.set(0.18 + Math.sin(t * 1.3 + i) * 0.015, FL + 0.44 + ph * 0.2, -0.62);
      s.scale.setScalar(0.06 + ph * 0.1);
    }
  }
}
