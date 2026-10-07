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

const FLOOR = 0.29;   // top of the cabin floor
const FAR = -1.45;    // far side wall (inside face)
const WIN_Y0 = 0.9, WIN_Y1 = 1.62;   // beltline at the seated shoulders, tall glass
const ROAD = -0.28;   // road surface
// the cabin is modelled large and scaled to sedan proportions (x: length, y: height)
const CAR_SX = 0.65, CAR_SY = 0.86;
// sedan profile, modelled coords: roof span, rear deck and cowl (where the glass meets the body)
const ROOF_X0 = -1.55, ROOF_X1 = 1.7;
const DECK_X = -2.4, DECK_Y = 1.2;
const COWL_X = 2.62, COWL_Y = 1.15;
// side windows: rear door (sloped rear edge under the C pillar), front door (raked A pillar)
const WINDOWS = [
  [[-2.0, WIN_Y0], [-0.15, WIN_Y0], [-0.15, WIN_Y1], [-1.5, WIN_Y1]],
  [[0.25, WIN_Y0], [2.38, WIN_Y0], [1.88, WIN_Y1], [0.25, WIN_Y1]],
];

// ------------------------------------------------------------------ pixel textures

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
  ctx.fillStyle = '#c4ccd4'; ctx.fillRect(0, h - 6, w, 6);
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
    ctx.fillStyle = '#f2f5f8'; ctx.fillRect(x - 1, y + wh + 1, ww + 2, 1);
  };
  const snowRoof = (x0, x1, y) => {
    ctx.fillStyle = '#f0f3f6'; ctx.fillRect(x0 - 1, y - 2, x1 - x0 + 2, 3);
    for (let x = x0; x < x1; x += 2 + Math.floor(r() * 3)) { ctx.fillStyle = 'rgba(230,240,250,0.9)'; ctx.fillRect(x, y + 1, 1, 1 + Math.floor(r() * 3)); }
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
      ctx.fillStyle = k < 3 ? '#eef2f6' : '#3c3e44'; ctx.fillRect(x + bw / 2 - half, y - peak + k, half * 2, 1);
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
  // sidewalk snow, plowed lumps
  ctx.fillStyle = '#e6ebf0'; ctx.fillRect(0, G, w, h - G);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = '#f4f7fa'; ctx.fillRect(r() * w, G - 1 - r() * 2, 3 + r() * 6, 2); }
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
      let v = 238 - k * 40 + (r() - 0.5) * 10;
      let c = rgb(v, v + 4, v + 12);
      if (k > 0.65 && r() < 0.5) c = rgb(120 + r() * 30, 116 + r() * 26, 110 + r() * 20); // plow spray, grit
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
    this.camera = { distance: 2.85, height: 1.05, lookHeight: 0.95, lookZ: -0.6, fov: 34, minWidth: 3.35 };
    this.bounds = { walk: { minX: -1.3, maxX: 1.5, minZ: 0.2, maxZ: 0.2 }, camera: { minX: 0.08, maxX: 0.08 } };
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
    // The cabin is modelled at a generous size, then the whole body is scaled to a
    // real police sedan (~4.2 m of cabin-and-hood, headliner ~1.2 m over the floor).
    // Everything outside the body is black: the city only shows through the glass.
    const SX = CAR_SX, SY = CAR_SY;
    const real = this.root;
    this.car = new THREE.Group(); this.car.name = 'car-body';
    real.add(this.car);
    this.root = this.car;
    this.buildShell();
    this.buildRear();
    this.buildPartition();
    this.buildFront();
    this.buildForeground();
    this.root = real;
    this.car.scale.set(SX, SY, 1);
    this.buildOutside();
    this.buildMatte();
    this.buildLighting();

    const P = (x, y, z) => new THREE.Vector3(x * SX, y * SY, z);
    // seated sprites sit a little into the footwell: the near door sill hides the feet
    this.anchors.julianSeat = new THREE.Vector3(-0.98, 0.1, -0.35);
    this.anchors.driverSeat = new THREE.Vector3(0.66, 0.11, -0.1);
    this.anchors.window = P(-1.1, 1.25, -1.4);
    this.anchors.cuffs = P(-0.95, 0.95, -0.2);
    this.anchors.outsideFront = P(1.2, 1.25, -1.4);
    // painted VN backdrop: from the back seat, past the cage to the dash and the road
    this.shots = { car: { pos: [-1.6 * SX, 1.25 * SY, 0.15], look: [0.9 * SX, 1.1 * SY, -0.9], fov: 62 } };
    this.vnHide = [];
    this.anchors.cage = P(0.52, 1.25, -0.2);
    this.anchors.radio = P(2.05, 1.1, -0.95);
    this.anchors.driverHead = P(1.2, 1.6, -0.1);
    return this.root;
  }

  /** Flat wall from a polygon outline with polygon holes (x/y in the wall plane). */
  polyWall(outline, holes, z, mat) {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
    const geo = new THREE.ShapeGeometry(shape);
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getY(i) / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.z = z;
    m.receiveShadow = true;
    this.root.add(m);
    return m;
  }

  /** Cabin x (as modelled) → world x. */
  cx(x) { return x * CAR_SX; }

  /** Black all around the body, open only where the side windows are. */
  buildMatte() {
    const black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
    black.userData.noLightingState = true;
    // the same window shapes as the far wall, in world units
    this.polyWall([[-30, -10], [30, -10], [30, 20], [-30, 20]],
      WINDOWS.map((w) => w.map(([x, y]) => [x * CAR_SX, y * CAR_SY])), -1.58, black);
    // and in front: the floor of the frame under the body (no road, no wheels)
    const under = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), black);
    under.position.set(0, 0.25 * CAR_SY - 10.0, 0.4); this.root.add(under);
  }

  // ---------------------------------------------------------------- body shell

  buildShell() {
    const root = this.root;
    const body = this.mat('carInterior', { color: 0x2e3238, roughness: 0.8 });
    // the cut body edges stay black: only the cabin is lit, not the shell
    const paint = new THREE.MeshBasicMaterial({ color: 0x08090b }); paint.userData.noLightingState = true;
    const trim = this.pmat('carTrim', trimTex());
    const head = this.pmat('carHead', headTex(), { roughness: 0.95 });
    const rubber = this.mat('carSeal', { color: 0x111214, roughness: 0.7 });
    const mat = this.pmat('carFloorMat', floorTex(), { roughness: 0.9 });

    // floor pan + mats
    this.B(5.2, 0.08, 1.8, body, 0.2, 0.25, -0.6);
    this.B(2.5, 0.012, 1.7, mat, -1.05, FLOOR + 0.006, -0.6);
    this.B(1.9, 0.012, 1.7, mat, 1.45, FLOOR + 0.006, -0.6);
    this.B(0.3, 0.04, 1.2, this.mat('carDark', { color: 0x141518, roughness: 0.7 }), 0.32, FLOOR + 0.02, -0.8); // partition footing
    // roof: headliner + steel + paint, cut face toward the camera
    // sedan profile (modelled coords): roof from the rear glass to the windscreen,
    // rear deck at the back, cowl/hood line at the front
    const RX0 = ROOF_X0, RX1 = ROOF_X1, RL = RX1 - RX0, RC = (RX0 + RX1) / 2;
    this.B(RL, 0.04, 1.8, head, RC, 1.71, -0.6);
    this.B(RL, 0.03, 1.82, body, RC, 1.745, -0.6);
    this.B(RL + 0.1, 0.05, 1.86, paint, RC, 1.785, -0.6);
    this.B(RL + 0.1, 0.012, 0.012, rubber, RC, 1.73, 0.31); // seal line on the cut
    // rear glass and windscreen as sloped slabs at the roof ends
    const slab = (x0, y0, x1, y1, th, mat, z = -0.6, d = 1.8) => {
      const L = Math.hypot(x1 - x0, y1 - y0);
      const m = this.B(th, L, d, mat, (x0 + x1) / 2, (y0 + y1) / 2, z);
      m.rotation.z = Math.atan2(x0 - x1, y1 - y0);
      return m;
    };
    this.slab = slab;
    slab(DECK_X, DECK_Y, RX0, 1.75, 0.05, paint);
    slab(DECK_X + 0.06, DECK_Y - 0.02, RX0 + 0.04, 1.7, 0.03, this.mat('carGlassRear', { color: 0x10161c, roughness: 0.1, metalness: 0.3 }));
    slab(COWL_X, COWL_Y, RX1, 1.75, 0.05, paint);
    // roof light bar (seen end-on) + antenna
    const lb = new THREE.Group();
    this.B(0.34, 0.06, 1.5, this.mat('lbBase', { color: 0x1a1c20, roughness: 0.5 }), 0, 0.03, 0, lb);
    this.B(0.3, 0.08, 0.74, this.mat('lbBlue', { color: 0x203a90, emissive: 0x0a1a5a, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.9 }), 0, 0.1, 0.37, lb);
    this.B(0.3, 0.08, 0.74, this.mat('lbRed', { color: 0x902020, emissive: 0x4a0808, emissiveIntensity: 0.6, roughness: 0.15, transparent: true, opacity: 0.9 }), 0, 0.1, -0.37, lb);
    lb.position.set(0.3, 1.81, -0.6);
    root.add(lb);
    this.lightBar = lb;
    lb.visible = false; // above the roof = outside the frame (black)

    // far side wall with window openings (trim-plastic texture)
    const wallTex = trimTex().clone(); wallTex.needsUpdate = true; wallTex.repeat.set(6, 6);
    const far = this.polyWall([[-2.4, 0.25], [2.8, 0.25], [2.8, COWL_Y], [COWL_X, COWL_Y], [ROOF_X1, 1.73], [ROOF_X0, 1.73], [DECK_X, DECK_Y]],
      WINDOWS, FAR, this.mat('carWall', { map: wallTex, color: 0xb8bcc4, roughness: 0.8 }));
    void far;
    // rear bulkhead (behind the bench) and window seals
    this.B(0.08, DECK_Y - 0.25, 1.8, body, -2.4, (DECK_Y + 0.25) / 2, -0.6);
    for (const win of WINDOWS) {
      const xs = win.map((p) => p[0]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const cx = (x0 + x1) / 2, w = x1 - x0;
      // seals along each edge of the (sloped) opening
      for (let k = 0; k < win.length; k++) {
        const [ax, ay] = win[k], [bx, by] = win[(k + 1) % win.length];
        slab(ax, ay, bx, by, 0.035, rubber, FAR + 0.02, 0.05);
      }
      // tinted glass, frost and condensation
      const glass = this.plane(w, WIN_Y1 - WIN_Y0, this.mat('carGlassSide', { color: 0x9ab0c4, transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false }), cx, (WIN_Y0 + WIN_Y1) / 2, FAR - 0.01);
      glass.renderOrder = 3;
      const frost = this.plane(w, WIN_Y1 - WIN_Y0, new THREE.MeshBasicMaterial({ map: frostTex(x0 < 0 ? 31 : 32), transparent: true, depthWrite: false, color: 0xdfe8f2 }), cx, (WIN_Y0 + WIN_Y1) / 2, FAR + 0.005);
      frost.renderOrder = 4;
      // a soft diagonal sheen on the glass
      const sheen = this.plane(0.25, 0.9, new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x8a98a8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }), cx + w * 0.22, (WIN_Y0 + WIN_Y1) / 2, FAR + 0.01);
      sheen.rotation.z = -0.6; sheen.renderOrder = 4;
    }
    // headliner side strip above the windows + grab handles
    this.B(ROOF_X1 - ROOF_X0 - 0.2, 0.12, 0.04, head, (ROOF_X0 + ROOF_X1) / 2, 1.63, FAR + 0.02);
    for (const x of [-1.1, 1.25]) {
      const h = this.mat('grab', { color: 0x3a3e44, roughness: 0.6 });
      this.B(0.26, 0.03, 0.035, h, x, 1.585, FAR + 0.07);
      this.B(0.03, 0.05, 0.05, h, x - 0.12, 1.61, FAR + 0.05);
      this.B(0.03, 0.05, 0.05, h, x + 0.12, 1.61, FAR + 0.05);
    }
    // dome light + overhead console
    this.B(0.24, 0.025, 0.14, this.mat('dome', { color: 0x6a665e, emissive: 0x1a1610, roughness: 0.4 }), 0.25, 1.68, -0.6);
    // pillars (B and C trim on the far wall, A pillar sloping at the front)
    this.B(0.24, 0.8, 0.06, trim, 0.05, 1.29, FAR + 0.03);
    slab(DECK_X + 0.1, DECK_Y - 0.05, ROOF_X0 + 0.12, 1.7, 0.3, trim, FAR + 0.03, 0.06); // C pillar
    this.B(0.3, DECK_Y - 0.3, 0.06, trim, -2.25, (DECK_Y + 0.3) / 2, FAR + 0.03);
    slab(COWL_X - 0.06, COWL_Y, ROOF_X1 - 0.04, 1.7, 0.14, trim, FAR + 0.04, 0.08); // A pillar
    // windscreen (raked back toward the roof)
    slab(COWL_X + 0.03, COWL_Y + 0.02, ROOF_X1 + 0.03, 1.74, 0.04, this.mat('carGlass', { color: 0x22303c, transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false }));
  }

  // ---------------------------------------------------------------- rear compartment

  buildRear() {
    const bench = this.pmat('carBench', benchTex(), { roughness: 0.45, metalness: 0.05 });
    const trim = this.pmat('carTrim', trimTex());
    const dark = this.mat('carDark', { color: 0x141518, roughness: 0.7 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });

    // one-piece molded plastic bench: pan, lip, pedestal, backrest, side wings
    this.B(1.35, 0.1, 1.0, bench, -1.25, 0.54, -0.92);
    this.B(0.07, 0.14, 1.0, bench, -0.56, 0.52, -0.92).rotation.z = -0.2;
    this.B(1.2, 0.22, 0.95, dark, -1.3, 0.4, -0.94);
    const back = this.B(0.1, 0.8, 1.5, bench, -1.93, 0.98, -0.62);
    back.rotation.z = 0.12;
    this.B(0.14, 0.06, 1.5, bench, -1.98, 1.4, -0.62).rotation.z = 0.12;
    // molded seat divider ridge (seen as a hump at the far seat)
    this.B(1.1, 0.04, 0.08, bench, -1.25, 0.6, -0.9);
    // seat-belt buckles + limp belt on the far side, hanging from the C pillar
    const belt = this.mat('belt', { color: 0x1c1e22, roughness: 0.9 });
    for (const z of [-1.1, -0.5]) { this.B(0.05, 0.04, 0.03, dark, -1.55, 0.61, z); this.B(0.02, 0.012, 0.03, steel, -1.52, 0.633, z); }
    const sb = this.B(0.045, 0.85, 0.008, belt, -1.82, 1.15, FAR + 0.08);
    sb.rotation.z = -0.32;
    this.B(0.05, 0.03, 0.02, steel, -1.68, 0.76, FAR + 0.09);

    // rear door card: no handles, no switches — blanked off with screwed plates
    this.B(1.9, WIN_Y0 - 0.35, 0.05, trim, -1.05, (WIN_Y0 + 0.31) / 2, FAR + 0.025);
    this.B(1.7, 0.05, 0.08, trim, -1.05, 0.87, FAR + 0.05); // armrest ridge
    const plate = this.mat('blankPlate', { color: 0x202226, roughness: 0.5, metalness: 0.4 });
    for (const [x, y, w] of [[-0.42, 0.79, 0.15], [-1.5, 0.93, 0.1]]) {
      this.B(w, 0.06, 0.012, plate, x, y, FAR + 0.06);
      for (const s of [-1, 1]) this.B(0.01, 0.01, 0.01, steel, x + s * (w / 2 - 0.015), y, FAR + 0.068);
    }
    // bars on the inside of the rear window
    // (no bars on the rear side glass: a sedan, not a prisoner bus — the cage is the partition)
    // sticker
    const st = this.textSign('NO SMOKING', { w: 0.16, h: 0.05, bg: '#c8b030', fg: '#1a1a1a' });
    st.position.set(-0.32, 0.72, FAR + 0.056); this.root.add(st);

    // floor: wet off the boots, grit, a crumpled receipt
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10), this.mat('slush', { color: 0x30363c, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.7 }));
    wet.rotation.x = -Math.PI / 2; wet.scale.set(1.6, 0.8, 1); wet.position.set(-0.6, FLOOR + 0.014, -0.45); this.root.add(wet);
    // late autumn: a wet leaf and mud off the boots, not snow
    const leafMat = this.mat('wetLeaf', { color: 0x6a3a14, roughness: 0.4 });
    const mudMat = this.mat('mud', { color: 0x2a2620, roughness: 0.6 });
    this.B(0.05, 0.004, 0.035, leafMat, -0.48, FLOOR + 0.016, -0.36).rotation.y = 0.6;
    for (const [x, z, s] of [[-0.7, -0.6, 0.035], [-0.55, -0.52, 0.025]]) this.B(s * 1.4, s * 0.3, s, mudMat, x, FLOOR + 0.016, z);
    const paper = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), this.mat('crumple', { color: 0x8a867c, roughness: 0.95, flatShading: true }));
    paper.position.set(-0.25, FLOOR + 0.03, -1.1); paper.scale.set(1, 0.7, 1.2); this.root.add(paper);
  }

  // ---------------------------------------------------------------- partition cage

  buildPartition() {
    const cage = new THREE.Group();
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const panel = this.pmat('cagePanel', steelTex(), { roughness: 0.5, metalness: 0.5 });
    const frameM = this.mat('cageFrame', { color: 0x3a3e44, roughness: 0.5, metalness: 0.5 });
    // lower kick panel (steel), upper polycarbonate with a sliding window, mesh header
    this.B(0.03, 0.42, 1.6, panel, 0, 0.21, 0, cage);
    this.box(0.05, 0.62, 1.6, this.mat('cagePlex', { color: 0x9ab0c0, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }), 0, 0.73, 0, cage);
    const scratches = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.62), new THREE.MeshBasicMaterial({ map: plexiTex(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    scratches.rotation.y = -Math.PI / 2; scratches.position.set(-0.03, 0.73, 0); scratches.renderOrder = 4;
    cage.add(scratches);
    const meshT = meshTex().clone(); meshT.needsUpdate = true; meshT.repeat.set(5, 0.7);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.22), new THREE.MeshStandardMaterial({ map: meshT, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }));
    mesh.rotation.y = -Math.PI / 2; mesh.position.set(0, 1.15, 0);
    cage.add(mesh);
    // frame: posts, rails, sliding-window track, bolts
    for (const z of [-0.79, 0.79]) this.B(0.05, 1.27, 0.04, frameM, 0, 0.62, z, cage);
    for (const y of [0.42, 1.04, 1.26]) this.B(0.05, 0.035, 1.62, frameM, 0, y, 0, cage);
    this.B(0.04, 0.6, 0.03, frameM, -0.01, 0.73, -0.1, cage);
    this.B(0.035, 0.03, 0.8, steel, -0.03, 0.47, -0.4, cage);
    for (let i = 0; i < 9; i++) this.B(0.014, 0.014, 0.014, steel, -0.03, 0.04 + (i % 3) * 0.17, -0.7 + Math.floor(i / 3) * 0.7, cage);
    // keep the old vertical bars as a sparse grille on the near half (thin)
    for (let i = 0; i < 5; i++) this.B(0.015, 0.6, 0.015, steel, -0.035, 0.73, 0.1 + i * 0.15, cage);
    cage.position.set(0.5, 0.42, -0.6);
    this.root.add(cage);
    this.cage = cage;
  }

  // ---------------------------------------------------------------- front cabin

  buildFront() {
    const root = this.root;
    const seat = this.pmat('carSeat', seatTex(), { roughness: 0.6 });
    const plastic = this.mat('carPlastic', { color: 0x26282c, roughness: 0.6 });
    const trim = this.pmat('carTrim', trimTex());
    const dark = this.mat('carDark', { color: 0x141518, roughness: 0.7 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const chrome = this.mat('chromeDull', { color: 0xb0b6bc, metalness: 0.8, roughness: 0.35 });

    // seats: driver (near) and passenger (far)
    for (const [z, near] of [[-0.44, true], [-1.08, false]]) {
      this.B(0.62, 0.14, 0.55, seat, 1.15, 0.55, z);
      this.B(0.62, 0.05, 0.08, seat, 1.15, 0.64, z - 0.24); // far bolster
      this.B(0.5, 0.18, 0.5, dark, 1.15, 0.39, z);
      const bk = this.B(0.14, 0.58, 0.52, seat, 0.82, 0.9, z); bk.rotation.z = 0.12;
      this.B(0.15, 0.46, 0.06, seat, 0.84, 0.88, z - 0.24).rotation.z = 0.12;
      this.B(0.13, 0.17, 0.26, seat, 0.76, 1.33, z);
      for (const dz of [-0.07, 0.07]) this.B(0.012, 0.07, 0.012, chrome, 0.77, 1.22, z + dz);
      this.B(0.18, 0.05, 0.03, plastic, 1.3, 0.46, z + (near ? 0.27 : -0.27)); // recline lever / side trim
    }
    // passenger seat clutter: clipboard with forms, flashlight, ticket book
    const clip = new THREE.Group();
    this.B(0.32, 0.012, 0.24, this.mat('clipboard', { color: 0x6a4a2a, roughness: 0.7 }), 0, 0, 0, clip);
    this.B(0.28, 0.006, 0.21, this.mat('paperWhite', { color: 0xe8e6de, roughness: 0.95 }), 0.01, 0.009, 0, clip);
    this.B(0.26, 0.004, 0.2, this.mat('paperYellow', { color: 0xe8d890, roughness: 0.95 }), 0.03, 0.004, 0.01, clip).rotation.y = 0.08;
    this.B(0.04, 0.02, 0.1, chrome, -0.13, 0.015, 0, clip);
    for (let i = 0; i < 5; i++) this.B(0.18, 0.002, 0.008, dark, 0.03, 0.013, -0.07 + i * 0.03, clip);
    clip.position.set(1.15, 0.635, -1.08); clip.rotation.set(0, 0.25, 0.04);
    root.add(clip);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.3, 8), this.mat('maglite', { color: 0x16181c, roughness: 0.4, metalness: 0.6 }));
    fl.rotation.z = Math.PI / 2; fl.rotation.y = 0.5; fl.position.set(1.3, 0.645, -1.26); root.add(fl);

    // front door card: armrest, chrome handle, switch pack, map pocket with papers, speaker
    this.B(1.95, WIN_Y0 - 0.35, 0.05, trim, 1.25, (WIN_Y0 + 0.31) / 2, FAR + 0.025);
    this.B(0.7, 0.06, 0.12, trim, 1.15, WIN_Y0 - 0.06, FAR + 0.07);
    this.B(0.12, 0.03, 0.02, chrome, 0.7, 1.0, FAR + 0.06);
    this.B(0.14, 0.02, 0.06, dark, 1.4, 0.935, FAR + 0.08);
    for (let i = 0; i < 2; i++) this.B(0.02, 0.012, 0.025, plastic, 1.36 + i * 0.05, 0.95, FAR + 0.08);
    this.B(1.1, 0.2, 0.07, dark, 1.45, 0.47, FAR + 0.06);
    this.B(0.24, 0.12, 0.01, this.mat('paperWhite', { color: 0xe8e6de, roughness: 0.95 }), 1.7, 0.6, FAR + 0.05).rotation.z = 0.1;
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), this.mat('speaker', { color: 0x1a1b1e, roughness: 0.9 }));
    spk.position.set(0.7, 0.55, FAR + 0.052); root.add(spk);

    // center console: cup holders + coffee, siren controller, laptop mount
    this.B(0.95, 0.32, 0.3, plastic, 1.55, 0.6, -0.62);
    this.B(0.95, 0.02, 0.3, trim, 1.55, 0.77, -0.62);
    const cup = new THREE.Group();
    const cupM = this.mat('coffeeCup', { color: 0x9a1c1c, roughness: 0.7 });
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.032, 0.15, 10), cupM);
    cupBody.position.y = 0.075; cup.add(cupBody);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.044, 0.015, 10), this.mat('cupLid', { color: 0xe8e6e0, roughness: 0.5 }));
    lid.position.y = 0.155; cup.add(lid);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.037, 0.05, 10), this.mat('cupSleeve', { color: 0x8a6a44, roughness: 0.9 }));
    sleeve.position.y = 0.07; cup.add(sleeve);
    cup.position.set(1.3, 0.72, -0.72); root.add(cup);
    this.steam = [];
    if (!this.low) for (let i = 0; i < 3; i++) { const s = glow(0xdfe6ee, 0.08, 0.25); s.position.set(1.3, 0.9, -0.72); root.add(s); this.steam.push(s); }
    const siren = this.B(0.18, 0.05, 0.12, dark, 1.75, 0.81, -0.62);
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.09), new THREE.MeshBasicMaterial({ map: sirenTex() }));
    sf.rotation.x = -Math.PI / 2 + 0.25; sf.position.set(1.75, 0.837, -0.62); root.add(sf);
    this.sirenLed = glow(0xff2a1a, 0.04, 0.8); this.sirenLed.material = this.sirenLed.material.clone(); this.sirenLed.position.set(1.83, 0.85, -0.57); root.add(this.sirenLed);
    void siren;
    // laptop mount (pole + swivel) and the terminal
    this.B(0.04, 0.5, 0.04, steel, 1.95, 1.0, -0.62);
    this.B(0.22, 0.03, 0.04, steel, 1.88, 1.24, -0.6).rotation.y = -0.6;
    const laptop = new THREE.Group();
    this.B(0.32, 0.025, 0.24, this.mat('laptopBody', { color: 0x2a2c30, roughness: 0.5, metalness: 0.3 }), 0, 0, 0, laptop);
    this.B(0.32, 0.22, 0.02, this.mat('laptopBody', { color: 0x2a2c30, roughness: 0.5, metalness: 0.3 }), 0, 0.11, -0.12, laptop).rotation.x = -0.25;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ map: terminalTex(), color: 0x7a8aa0 }));
    scr.position.set(0, 0.112, -0.107); scr.rotation.x = -0.25; laptop.add(scr);
    laptop.position.set(1.84, 1.26, -0.58); laptop.rotation.y = -1.0;
    root.add(laptop);
    this.screen = scr;
    const dashGlow = glow(0x5a9ac8, 0.7, 0.22); dashGlow.material = dashGlow.material.clone(); dashGlow.position.set(1.8, 1.38, -0.5); root.add(dashGlow);
    this.screenGlow = dashGlow;

    // dashboard: body, sloped top pad, instrument binnacle, glovebox, vents
    this.B(0.75, 0.36, 1.75, plastic, 2.42, 0.98, -0.6);
    this.B(0.6, 0.06, 1.75, plastic, 2.5, 1.19, -0.6).rotation.z = -0.22;
    this.B(0.4, 0.4, 1.75, dark, 2.32, 0.6, -0.6);
    this.B(0.16, 0.14, 0.42, plastic, 2.14, 1.22, -0.28);
    const gauges = this.plane(0.3, 0.07, new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x6aa8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 2.06, 1.2, -0.06);
    gauges.renderOrder = 5;
    this.B(0.03, 0.18, 0.4, trim, 2.06, 0.93, -1.05); // glovebox face
    for (const z of [-0.12, -0.5, -0.72, -1.2]) this.B(0.02, 0.05, 0.12, dark, 2.06, 1.1, z);
    // clipboard of tickets + papers on the dash top
    this.B(0.18, 0.01, 0.12, this.mat('paperWhite', { color: 0xe8e6de, roughness: 0.95 }), 2.48, 1.235, -1.1).rotation.z = -0.22;
    // steering wheel, hub, column
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), plastic);
    wheel.position.set(1.85, 1.1, -0.3); wheel.rotation.order = 'ZYX'; wheel.rotation.y = Math.PI / 2; wheel.rotation.z = -0.6; // raked ~35°
    root.add(wheel);
    this.wheel = wheel;
    const hub = this.B(0.08, 0.12, 0.12, dark, 1.88, 1.12, -0.3);
    hub.rotation.z = 0.4;
    const col = this.B(0.36, 0.07, 0.08, plastic, 2.05, 1.02, -0.3);
    col.rotation.z = 0.45;
    // radio head unit + LED, handset on a clip with its coiled cord
    const radio = this.B(0.16, 0.1, 0.24, this.mat('radio', { color: 0x101214, roughness: 0.4 }), 2.05, 1.05, -0.95);
    void radio;
    const disp = this.plane(0.12, 0.03, new THREE.MeshBasicMaterial({ color: 0x5aff9a }), 1.969, 1.07, -0.95, -Math.PI / 2);
    disp.rotation.y = -Math.PI / 2;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), this.mat('radioLed', { color: 0, emissive: 0x40ff60, emissiveIntensity: 3 }));
    led.position.set(2.0, 1.06, -0.82); led.rotation.y = Math.PI / 2;
    root.add(led);
    this.radioLed = led;
    const ledGlow = glow(0x40ff60, 0.08, 0.6); ledGlow.position.set(1.99, 1.06, -0.82); root.add(ledGlow);
    const hs = new THREE.Group();
    this.B(0.05, 0.12, 0.035, this.mat('handset', { color: 0x16171a, roughness: 0.5 }), 0, 0, 0, hs);
    this.B(0.02, 0.03, 0.03, dark, 0, -0.07, 0, hs);
    hs.position.set(1.98, 0.98, -0.78); hs.rotation.z = 0.15;
    root.add(hs);
    const start = new THREE.Vector3(1.98, 0.9, -0.78), end = new THREE.Vector3(2.02, 1.0, -0.98);
    const pts = [];
    const N = this.low ? 40 : 160, turns = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const base = new THREE.Vector3().lerpVectors(start, end, t);
      base.y -= Math.sin(t * Math.PI) * 0.16;
      base.x -= Math.sin(t * Math.PI) * 0.04;
      const a = t * turns * Math.PI * 2;
      if (!this.low) { base.x += Math.cos(a) * 0.01; base.z += Math.sin(a) * 0.01; }
      pts.push(base);
    }
    const cordMat = this.mat('cord', { color: 0x0e0f11, roughness: 0.5 });
    if (this.low) root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x0e0f11 })));
    else root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.004, 3), cordMat));

    // rear-view mirror, sun visors (papers tucked in)
    this.B(0.02, 0.1, 0.02, dark, 2.4, 1.64, -0.6);
    this.B(0.04, 0.07, 0.25, dark, 2.36, 1.57, -0.6);
    this.B(0.005, 0.055, 0.23, this.mat('mirror', { color: 0x8a96a4, metalness: 0.9, roughness: 0.1 }), 2.338, 1.57, -0.6);
    for (const z of [-0.28, -0.98]) {
      const v = this.B(0.34, 0.025, 0.42, trim, 2.25, 1.655, z); v.rotation.z = 0.28;
      if (z > -0.5) { const p = this.B(0.2, 0.004, 0.1, this.mat('paperWhite', { color: 0xe8e6de, roughness: 0.95 }), 2.17, 1.64, z + 0.08); p.rotation.z = 0.28; }
    }
    // the hidden water bottle in the door pocket (shown by the story)
    const bottle = new THREE.Group();
    const bmat = new THREE.MeshStandardMaterial({ color: 0xcfe6f6, transparent: true, opacity: 0.55, roughness: 0.05 });
    this.box(0.07, 0.24, 0.07, bmat, 0, 0.12, 0, bottle);
    this.box(0.04, 0.03, 0.04, this.mat('cap', { color: 0x2060c0 }), 0, 0.26, 0, bottle);
    this.box(0.072, 0.07, 0.072, this.mat('label', { color: 0x3a8ad0, roughness: 0.6 }), 0, 0.11, 0, bottle);
    bottle.position.set(1.0, 0.95, -1.2);
    bottle.visible = false;
    root.add(bottle);
    this.bottle = bottle;
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
          const s = new THREE.Mesh(new THREE.ConeGeometry(0.75 - k * 0.17, 0.45, 7), snowy); s.position.set(tx, ROAD + 1.95 + k * 0.9, tz); g.add(s);
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

  // ---------------------------------------------------------------- foreground (near side cut)

  buildForeground() {
    const paint = new THREE.MeshBasicMaterial({ color: 0x08090b }); paint.userData.noLightingState = true;
    const navy = this.mat('carStripe', { color: 0x1a2a5a, roughness: 0.4, metalness: 0.2 });
    const gold = this.mat('carStripeGold', { color: 0xc8a040, roughness: 0.4, metalness: 0.4 });
    const tire = this.mat('tire', { color: 0x141416, roughness: 0.9 });
    const dark = this.mat('carDark', { color: 0x141518, roughness: 0.7 });

    // the near door's lower trim, seen from the cut: covers the footwells (the
    // seated sprites sit a little into them) — no wheels, no paint, no road
    const sill = new THREE.Group(); sill.name = 'fg-sill';
    const doorTrim = this.mat('carDoorTrim', { color: 0x1c1e22, roughness: 0.75 });
    this.B(4.7, 0.36, 0.06, doorTrim, 0.15, 0.2, 0.3, sill);
    this.B(4.7, 0.025, 0.065, this.mat('carTrimEdge', { color: 0x34383e, roughness: 0.5 }), 0.15, 0.38, 0.302, sill);
    for (const x of [-1.2, 1.25]) this.B(0.5, 0.1, 0.02, this.mat('carDoorPocket', { color: 0x101114, roughness: 0.8 }), x, 0.27, 0.335, sill);
    this.wheels = [];
    this.root.add(sill);
    this.foregroundGroups.push(sill);

    // near pillars framing the shot (A at the right edge, C at the left edge)
    const pil = new THREE.Group(); pil.name = 'fg-pillars';
    const pslab = (x0, y0, x1, y1, th, mat) => {
      const L = Math.hypot(x1 - x0, y1 - y0);
      const m = this.B(th, L, 0.07, mat, (x0 + x1) / 2, (y0 + y1) / 2, 0.32, pil);
      m.rotation.z = Math.atan2(x0 - x1, y1 - y0);
    };
    pslab(COWL_X + 0.02, COWL_Y, ROOF_X1 + 0.02, 1.78, 0.12, paint);           // A pillar
    pslab(DECK_X, DECK_Y, ROOF_X0, 1.78, 0.3, paint);                          // C pillar
    this.B(0.3, DECK_Y - 0.3, 0.07, paint, -2.25, (DECK_Y + 0.3) / 2, 0.32, pil); // rear quarter
    this.B(0.06, DECK_Y - 0.3, 0.075, dark, -2.09, (DECK_Y + 0.3) / 2, 0.32, pil);
    this.root.add(pil);
    this.foregroundGroups.push(pil);
  }

  // ---------------------------------------------------------------- lighting

  buildLighting() {
    const root = this.root;
    const hemi = new THREE.HemisphereLight(0x8a9ab2, 0x141618, 0.8);
    const day = new THREE.DirectionalLight(0xd0dcef, 0.9);
    day.position.set(-1, 4, 3);
    // window light spilling onto the rear bench (Julian) and the driver
    const fill = new THREE.PointLight(0xc4d2e8, 2.6, 3.0, 1.4); // cool window light on Julian, low
    fill.position.set(-0.7, 1.2, 0.8);
    const front = new THREE.PointLight(0xffe2c0, 3.0, 2.6, 1.5); // a small warm pool over the front seats
    front.position.set(1.15, 1.3, -0.5);
    const dash = new THREE.PointLight(0x5a9ac8, 3, 2.2, 1.6);
    dash.position.set(1.85, 1.3, -0.45);
    root.add(hemi, day, fill, front, dash);
    this.lights = { hemi, day, fill, front, dash };

    // window light patches on seats/floor (fake bounce) + a travelling sweep
    const p1 = lightPool(0xc8d6ea, 1.6, 0.9, 0.08); p1.rotation.x = -Math.PI / 2; p1.position.set(-1.15, 0.6, -0.8); root.add(p1);
    const p2 = lightPool(0xc8d6ea, 1.6, 0.9, 0.06); p2.rotation.x = -Math.PI / 2; p2.position.set(1.2, FLOOR + 0.02, -0.9); root.add(p2);
    const sweep = lightPool(0xfff2dc, 0.8, 1.2, 0.0);
    sweep.position.set(4, 1.0, FAR + 0.09); root.add(sweep);
    this.sweep = sweep; this.sweepT = 3; this.sweepRun = -1;
    // cabin dust in the window light
    // (no floating cabin dust: in this small space it read as snow inside the car)
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
      this.sweep.position.x = 3.0 - k * 6.0;
      this.sweep.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.22;
      this.lights.fill.intensity = 4.5 + Math.sin(Math.min(1, k) * Math.PI) * 2.5 * Math.max(0, 1 - Math.abs(this.sweep.position.x + 1.1));
      if (k >= 1) { this.sweepRun = -1; this.sweep.material.opacity = 0; this.lights.fill.intensity = 4.5; }
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
      s.position.set(1.3 + Math.sin(t * 1.3 + i) * 0.015, 0.9 + ph * 0.22, -0.72);
      s.scale.setScalar(0.06 + ph * 0.1);
    }
  }
}
