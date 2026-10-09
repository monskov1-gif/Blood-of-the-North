import * as THREE from 'three';
import { bevelBox } from '../nature.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LocationBase, tiled } from '../LocationBase.js';
import { streetTexture, canvasTexture, rng } from '../../render/textures.js';
import { glow, lightPool } from '../props.js';
import { installExpansion, X_END } from './HospitalExpansion.js';

/**
 * Whitehorse General — ground floor, side-on cut-away. States: 'day' / 'night'.
 *   x -22 … -14  entrance hall: reception, waiting area
 *   x -14 …  -3  corridor A: elevator, stairs, water cooler, vending, procedure room
 *   x  -1 …   1  side corridor going back (surgery / service)
 *   x   3 …   7  nurse station
 *   x   9 …  13  ward 107 — empty, dark (the old woman is in 113, patient wing)
 *   x  14 …  15  staff door
 *   x  16 …  21  ward 109 — Julian (glass front)
 *
 * Look: a slightly dated northern regional hospital. Everything is painted on
 * small nearest-filtered canvases (the sprites' pixel register); static set
 * dressing is merged per material (see bx/cy/pl + flushBatches) so hundreds of
 * small props cost a handful of draw calls.
 */
const BACK = -4;
const H = 3.1;

// ------------------------------------------------------------------ pixel painting helpers

const T = (key, w, h, draw) => canvasTexture(`hosp-${key}`, w, h, (ctx, cw, ch) => { ctx.imageSmoothingEnabled = false; draw(ctx, cw, ch); }, { nearest: true, aniso: 1 });

const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ':': '000010000010000', '-': '000000111000000', '.': '000000000000010', '/': '001001010100100',
  '!': '010010010000010', '>': '100010001010100', '<': '001010100010001', '+': '000010111010000', "'": '010010000000000',
};
/** 3×5 pixel font. */
function ptext(ctx, s, x, y, color, sc = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const g = FONT[ch];
    if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * sc, y + Math.floor(i / 3) * sc, sc, sc);
    cx += 4 * sc;
  }
  return cx - x;
}
const ptw = (s, sc = 1) => String(s).length * 4 * sc - sc;
const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
/** Scribbled "handwriting / print" lines. */
function scribble(ctx, r, x, y, w, color, rows = 1, gap = 3) {
  ctx.fillStyle = color;
  for (let k = 0; k < rows; k++) {
    let cx = x;
    const end = x + w * (0.55 + r() * 0.45);
    while (cx < end) { const l = 1 + (r() * 4 | 0); ctx.fillRect(cx, y + k * gap, l, 1); cx += l + 1; }
  }
}
function pixels(ctx, w, h, fn) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255;
  }
  ctx.putImageData(img, 0, 0);
}

const TX = {
  floor: () => T('floor', 128, 128, (c, w, h) => {
    const r = rng(31);
    const tone = Array.from({ length: 16 }, () => (r() - 0.5) * 10);
    pixels(c, w, h, (x, y) => {
      const tx = x >> 5, ty = y >> 5;
      const v = ((tx + ty) & 1 ? 190 : 180) + tone[tx + ty * 4] + (r() - 0.5) * 7;
      let R = v - 4, G = v + 2, B = v - 7;
      const s = r();
      if (s < 0.06) {
        const k = r();
        if (k < 0.4) { R -= 62; G -= 58; B -= 56; } else if (k < 0.7) { R += 38; G += 38; B += 40; } else if (k < 0.86) { R -= 46; G -= 12; B -= 10; } else { R += 12; G -= 6; B -= 34; }
      }
      if ((x & 31) === 0 || (y & 31) === 0) { R -= 30; G -= 30; B -= 28; }
      return [R, G, B];
    });
    for (let i = 0; i < 18; i++) { c.fillStyle = `rgba(40,44,42,${0.12 + r() * 0.2})`; c.fillRect(r() * w | 0, r() * h | 0, 2 + (r() * 8 | 0), 1); }
  }),
  block: () => T('block', 128, 128, (c, w, h) => {
    const r = rng(5);
    pixels(c, w, h, (x, y) => {
      const row = y >> 4, off = row & 1 ? 16 : 0, bxi = (x + off) >> 5;
      const tone = Math.sin(row * 12.9898 + bxi * 78.233) * 43758.5453;
      let v = 214 + ((tone - Math.floor(tone)) - 0.5) * 8 + (r() - 0.5) * 5;
      if ((y & 15) === 0 || ((x + off) & 31) === 0) v -= 20;
      else if ((y & 15) === 1) v += 5;
      if (r() < 0.012) v -= 26;
      return [v - 6, v + 2, v - 9];
    });
  }),
  wainscot: () => T('wainscot', 64, 32, (c, w, h) => {
    const r = rng(9);
    pixels(c, w, h, (x, y) => {
      let v = (r() - 0.5) * 7 + Math.sin(x * 0.9) * 1.5;
      if (x % 32 === 0) v -= 22;
      if (y < 2) v += 26;
      if (y === 2) v -= 18;
      return [96 + v, 138 + v, 138 + v];
    });
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(30,40,40,${0.18 + r() * 0.3})`; c.fillRect(r() * w | 0, 18 + (r() * 9 | 0), 2 + (r() * 9 | 0), 1); }
    for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(220,240,236,${0.2 + r() * 0.2})`; c.fillRect(r() * w | 0, 6 + (r() * 22 | 0), 1 + (r() * 4 | 0), 1); }
  }),
  ceiling: () => T('ceil', 64, 64, (c, w, h) => {
    const r = rng(17);
    pixels(c, w, h, (x, y) => {
      let v = 204 + (r() - 0.5) * 8;
      if (r() < 0.08) v -= 22 + r() * 18;
      const gx = x & 31, gy = y & 31;
      if (gx === 0 || gy === 0) v = 232;
      else if (gx === 1 || gy === 1) v = 158;
      return [v, v + 1, v - 4];
    });
  }),
  lens: () => T('lens', 16, 32, (c, w, h) => {
    pixels(c, w, h, (x, y) => {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return [90, 92, 96];
      const v = (x + y) % 2 ? 236 : 210;
      return [v, v + 4, v + 10];
    });
  }),
  vent: () => T('vent', 16, 16, (c, w, h) => {
    pixels(c, w, h, (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [196, 198, 196];
      return y % 3 === 0 ? [120, 124, 124] : (y % 3 === 1 ? [60, 64, 66] : [176, 178, 176]);
    });
  }),
  steel: () => T('steel', 32, 32, (c, w, h) => {
    const r = rng(23);
    const cols = Array.from({ length: w }, () => (r() - 0.5) * 22);
    pixels(c, w, h, (x) => { const v = 178 + cols[x] + (r() - 0.5) * 8; return [v, v + 3, v + 7]; });
  }),
  laminate: () => T('laminate', 64, 32, (c, w, h) => {
    const r = rng(41);
    const cols = Array.from({ length: w }, (_, x) => Math.sin(x * 0.7 + Math.sin(x * 0.13) * 3) * 7);
    pixels(c, w, h, (x, y) => {
      let v = cols[x] + (r() - 0.5) * 6;
      if (x % 32 === 0) v -= 40;
      if (x % 32 === 1) v += 10;
      if (y > 28) v -= 26;
      return [198 + v, 168 + v, 126 + v * 0.8];
    });
  }),
  veneer: () => T('veneer', 16, 64, (c, w, h) => {
    const r = rng(43);
    pixels(c, w, h, (x, y) => {
      const v = Math.sin(x * 1.4 + Math.sin(y * 0.11) * 2.2) * 8 + (r() - 0.5) * 6;
      return [176 + v, 142 + v, 100 + v * 0.7];
    });
  }),
  tiles: () => T('tiles', 32, 32, (c, w, h) => {
    const r = rng(47);
    pixels(c, w, h, (x, y) => {
      if (x % 4 === 0 || y % 4 === 0) return [168, 176, 174];
      const t = Math.sin((x >> 2) * 3.1 + (y >> 2) * 7.7) * 4;
      const v = 232 + t + (r() - 0.5) * 3;
      return [v - 3, v, v + 1];
    });
  }),
  cork: () => T('cork', 96, 64, (c, w, h) => {
    const r = rng(53);
    pixels(c, w, h, (x, y) => {
      if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return [150, 116, 76];
      const v = (r() - 0.5) * 30;
      return [170 + v, 122 + v * 0.8, 74 + v * 0.5];
    });
    const sheets = [
      [5, 4, 30, 24, '#f4f0e4', 'FLU SHOTS', '#1a5a9a'], [38, 6, 22, 28, '#f8e890', null], [63, 4, 28, 20, '#e8f0f4', 'MEETING', '#a02020'],
      [6, 31, 22, 28, '#f2d0d8', null], [31, 37, 28, 22, '#ffffff', 'NO CELL', '#202020'], [62, 27, 28, 32, '#dde8d0', 'STAFF', '#2a6a2a'],
    ];
    for (const [x, y, sw, sh, bg, head, hc] of sheets) {
      rect(c, 'rgba(0,0,0,0.25)', x + 1, y + 1, sw, sh);
      rect(c, bg, x, y, sw, sh);
      let ty = y + 3;
      if (head) { ptext(c, head, x + Math.max(1, (sw - ptw(head)) >> 1), ty, hc); ty += 8; }
      scribble(c, r, x + 2, ty, sw - 4, 'rgba(40,40,50,0.7)', Math.floor((y + sh - ty - 2) / 3));
      rect(c, ['#d02020', '#2040c0', '#20a040'][(x + y) % 3], x + (sw >> 1), y, 2, 2);
    }
  }),
  poster: (kind) => T(`poster-${kind}`, 32, 44, (c, w, h) => {
    const r = rng(kind.length * 7);
    rect(c, '#f2f2ec', 0, 0, w, h);
    if (kind === 'flu') {
      rect(c, '#1c5c9c', 0, 0, w, 12); ptext(c, 'FLU', 10, 1, '#ffffff'); ptext(c, 'SEASON', 4, 6, '#ffe070');
      rect(c, '#9ab8d8', 8, 16, 16, 3); rect(c, '#e0e8f0', 6, 16, 2, 3); rect(c, '#606870', 24, 17, 6, 1); rect(c, '#d03030', 10, 17, 8, 1);
      ptext(c, 'GET', 4, 23, '#1c5c9c'); ptext(c, 'YOUR', 4, 29, '#1c5c9c'); ptext(c, 'SHOT', 4, 35, '#d03030');
    } else if (kind === 'hands') {
      rect(c, '#2a8a6a', 0, 0, w, 12); ptext(c, 'WASH', 8, 1, '#ffffff'); ptext(c, 'HANDS', 6, 6, '#ffffff');
      for (const [hx, hy] of [[7, 16], [17, 18]]) { rect(c, '#e8b890', hx, hy, 8, 10); rect(c, '#e8b890', hx + 1, hy - 3, 2, 3); rect(c, '#e8b890', hx + 4, hy - 4, 2, 4); }
      for (let i = 0; i < 10; i++) rect(c, '#9ad8f0', 4 + r() * 24 | 0, 15 + r() * 15 | 0, 2, 2);
      scribble(c, r, 4, 33, 24, '#406050', 3);
    } else if (kind === 'quiet') {
      rect(c, '#3a3a6a', 0, 0, w, h); rect(c, '#f0e8c0', 10, 8, 12, 14); rect(c, '#3a3a6a', 12, 10, 8, 2);
      ptext(c, 'QUIET', 6, 26, '#f0e8c0'); ptext(c, 'PLEASE', 4, 33, '#f0e8c0');
    }
  }),
  visiting: () => T('visiting', 48, 32, (c, w, h) => {
    const r = rng(61);
    rect(c, '#f4f2ea', 0, 0, w, h); rect(c, '#0e3a5a', 0, 0, w, 8);
    ptext(c, 'VISITING', 8, 2, '#ffffff');
    ptext(c, '11:00-20:00', 2, 11, '#0e3a5a');
    scribble(c, r, 3, 19, 42, '#505860', 3);
  }),
  print: (kind) => T(`print-${kind}`, 48, 32, (c, w, h) => {
    const r = rng(kind.length * 13 + 1);
    const sky = { aurora: [[10, 18, 40], [20, 50, 70]], river: [[150, 190, 220], [210, 225, 235]], lake: [[90, 60, 110], [230, 150, 120]] }[kind];
    pixels(c, w, h, (x, y) => { const t = y / 20; return sky[0].map((a, i) => a + (sky[1][i] - a) * Math.min(1, t)); });
    if (kind === 'aurora') {
      for (let i = 0; i < 26; i++) rect(c, '#e8f0ff', r() * w | 0, r() * 14 | 0, 1, 1);
      for (let x = 0; x < w; x++) {
        const y0 = 6 + Math.sin(x * 0.18) * 3 + Math.sin(x * 0.05) * 3;
        for (let k = 0; k < 9; k++) { c.fillStyle = `rgba(80,255,150,${(1 - k / 9) * 0.55 * (0.6 + 0.4 * Math.sin(x * 0.9))})`; c.fillRect(x, (y0 + k) | 0, 1, 1); }
      }
    }
    if (kind === 'lake') rect(c, '#f8d080', 30, 12, 4, 4);
    // mountains
    c.fillStyle = kind === 'aurora' ? '#0a1018' : kind === 'river' ? '#6a7a90' : '#3a2a4a';
    c.beginPath(); c.moveTo(0, 24); c.lineTo(8, 16); c.lineTo(14, 19); c.lineTo(24, 10); c.lineTo(32, 18); c.lineTo(40, 14); c.lineTo(48, 20); c.lineTo(48, 32); c.lineTo(0, 32); c.fill();
    if (kind !== 'aurora') { c.fillStyle = '#f4f6f8'; c.beginPath(); c.moveTo(21, 13); c.lineTo(24, 10); c.lineTo(27, 13); c.fill(); }
    // water / snow
    rect(c, kind === 'aurora' ? '#c8d4e8' : kind === 'river' ? '#4a7a9a' : '#5a4060', 0, 24, w, 8);
    if (kind === 'lake') for (let i = 0; i < 8; i++) rect(c, '#e8a070', 26 + (r() * 10 | 0), 25 + i, 3, 1);
    if (kind === 'river') { // the SS Klondike sternwheeler
      rect(c, '#f4f4ee', 12, 20, 18, 4); rect(c, '#f4f4ee', 15, 17, 11, 3); rect(c, '#202020', 21, 13, 2, 4); rect(c, '#a83020', 12, 23, 18, 1); rect(c, '#a83020', 29, 19, 3, 5);
    }
    // spruce
    c.fillStyle = kind === 'aurora' ? '#050a0c' : '#1a3020';
    for (let i = 0; i < 7; i++) { const x = (i * 7 + r() * 4) | 0, th = 5 + (r() * 5 | 0); c.beginPath(); c.moveTo(x, 25 - th); c.lineTo(x + 2, 25); c.lineTo(x - 2, 25); c.fill(); }
  }),
  emr: () => T('emr', 48, 32, (c, w, h) => {
    const r = rng(71);
    rect(c, '#dfe6ee', 0, 0, w, h); rect(c, '#2a5aa0', 0, 0, w, 4); ptext(c, 'MEDITECH', 1, -1 + 1, '#ffffff');
    rect(c, '#c4d0dc', 0, 4, 10, h - 4);
    for (let i = 0; i < 6; i++) rect(c, '#7a8a9a', 1, 6 + i * 4, 7, 1);
    for (let i = 0; i < 7; i++) { rect(c, i === 2 ? '#f8e070' : (i % 2 ? '#eef2f6' : '#ffffff'), 11, 6 + i * 3.5 | 0, 36, 3); scribble(c, r, 12, 7 + (i * 3.5 | 0), 30, '#405060'); }
  }),
  status: () => T('status', 64, 36, (c, w, h) => {
    const r = rng(73);
    rect(c, '#081828', 0, 0, w, h); rect(c, '#1a3a5a', 0, 0, w, 6); ptext(c, 'WARD 2 - CENSUS', 2, 1, '#9ad0ff');
    const rooms = ['101', '103', '105', '107', '109', '111'];
    rooms.forEach((n, i) => {
      const y = 8 + i * 4.6 | 0;
      ptext(c, n, 2, y, '#d0e0f0');
      scribble(c, r, 16, y + 2, 28, '#6a8aa8');
      rect(c, ['#40e070', '#40e070', '#f0d040', '#f05040', '#f0d040', '#40e070'][i], 56, y + 1, 4, 3);
    });
  }),
  vending: () => T('vending', 40, 80, (c, w, h) => {
    const r = rng(79);
    rect(c, '#1a1e24', 0, 0, w, h);
    rect(c, '#c02828', 0, 0, w, 9); ptext(c, 'SNACKS', 4, 2, '#ffffff');
    rect(c, '#0c1418', 2, 11, 27, 52);
    const prods = ['#e83030', '#f0c020', '#3070e0', '#30b050', '#f08020', '#e0e0e0', '#a040c0', '#40c0d0'];
    for (let s = 0; s < 5; s++) {
      for (let i = 0; i < 5; i++) { const col = prods[(r() * prods.length) | 0]; rect(c, col, 3 + i * 5, 13 + s * 10, 4, 6); rect(c, 'rgba(255,255,255,0.35)', 3 + i * 5, 13 + s * 10, 1, 6); }
      rect(c, '#606a70', 2, 20 + s * 10, 27, 1);
    }
    rect(c, '#2a3038', 31, 12, 7, 26); for (let i = 0; i < 12; i++) rect(c, '#9aa8b0', 32 + (i % 3) * 2, 20 + (i / 3 | 0) * 3, 1, 2);
    rect(c, '#40ff80', 32, 14, 5, 3);
    rect(c, '#05070a', 4, 66, 24, 8);
    rect(c, '#40464e', 31, 42, 7, 4);
  }),
  annunciator: () => T('annun', 80, 20, (c, w, h) => {
    rect(c, '#22262c', 0, 0, w, h); rect(c, '#3a4048', 0, 0, w, 1);
    ['101', '103', '105', '107', '109', '111'].forEach((n, i) => { ptext(c, n, 2 + i * 13, 13, '#c8ccd0'); rect(c, '#0e1012', 3 + i * 13, 3, 9, 8); });
  }),
  whiteboard: () => T('whiteboard', 80, 48, (c, w, h) => {
    const r = rng(83);
    rect(c, '#f6f8f8', 0, 0, w, h);
    ptext(c, 'RM', 2, 2, '#1a2a6a'); ptext(c, 'PATIENT', 16, 2, '#1a2a6a'); ptext(c, 'RN', 50, 2, '#1a2a6a'); ptext(c, 'MD', 64, 2, '#1a2a6a');
    rect(c, '#202830', 0, 8, w, 1); rect(c, '#202830', 14, 0, 1, h); rect(c, '#202830', 48, 0, 1, h); rect(c, '#202830', 62, 0, 1, h);
    ['101', '103', '105', '107', '109', '111'].forEach((n, i) => {
      const y = 11 + i * 6;
      ptext(c, n, 2, y, '#202020');
      scribble(c, r, 17, y + 2, 28, i === 4 ? '#c02020' : '#2a3aa0');
      scribble(c, r, 51, y + 2, 9, '#202020');
      scribble(c, r, 65, y + 2, 12, '#2a7a3a');
      rect(c, '#b8c0c4', 0, y + 5, w, 1);
    });
  }),
  wardBoard: (n) => T(`wardBoard-${n}`, 48, 32, (c, w, h) => {
    const r = rng(n * 3);
    rect(c, '#f6f8f8', 0, 0, w, h); rect(c, '#2a6a9a', 0, 0, w, 7);
    ptext(c, `ROOM ${n}`, 2, 1, '#ffffff');
    ptext(c, 'RN:', 2, 10, '#2a3a5a'); scribble(c, r, 14, 12, 26, '#2a3aa0');
    ptext(c, 'MD:', 2, 17, '#2a3a5a'); scribble(c, r, 14, 19, 26, '#2a3aa0');
    ptext(c, 'GOAL', 2, 24, '#c03030'); scribble(c, r, 20, 26, 22, '#c03030');
  }),
  eyeChart: () => T('eyechart', 24, 40, (c, w, h) => {
    rect(c, '#fbfbf6', 0, 0, w, h);
    ptext(c, 'E', 8, 2, '#101010', 3);
    ptext(c, 'FP', 7, 19, '#101010'); ptext(c, 'TOZ', 6, 26, '#101010'); ptext(c, 'LPED', 4, 33, '#101010');
  }),
  curtain: () => T('curtain', 32, 32, (c, w, h) => {
    const r = rng(89);
    pixels(c, w, h, (x, y) => {
      const d = Math.abs(((x + 8) % 16) - 8) + Math.abs(((y + 8) % 16) - 8);
      let col = [176, 202, 210];
      if (d === 6) col = [130, 110, 170];
      else if (d < 3) col = [90, 160, 170];
      const v = (r() - 0.5) * 6;
      return [col[0] + v, col[1] + v, col[2] + v];
    });
  }),
  blinds: () => T('blinds', 16, 32, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { rect(c, '#e2e6e6', 0, y, w, 2); rect(c, '#a8b0b4', 0, y + 2, w, 1); }
    rect(c, '#9aa2a6', w >> 1, 0, 1, h);
  }),
  blanket: () => T('blanket', 32, 32, (c, w, h) => {
    const r = rng(97);
    pixels(c, w, h, (x, y) => {
      let v = (r() - 0.5) * 8;
      if (x % 4 === 0 || y % 4 === 0) v -= 16;
      if (y >= 3 && y <= 6) return [236 + v, 238 + v, 240 + v];
      return [148 + v, 176 + v, 200 + v];
    });
  }),
  sheet: () => T('sheet', 16, 16, (c, w, h) => {
    const r = rng(101);
    pixels(c, w, h, (x, y) => { const v = 232 + (r() - 0.5) * 8 - ((x + y) % 5 === 0 ? 6 : 0); return [v - 2, v, v + 4]; });
  }),
  knit: () => T('knit', 16, 16, (c, w, h) => {
    const r = rng(103);
    pixels(c, w, h, (x, y) => {
      const band = (y >> 2) % 3;
      const base = [[170, 50, 50], [210, 170, 90], [70, 110, 80]][band];
      const v = ((x + (y & 1)) % 2 ? 12 : -8) + (r() - 0.5) * 8;
      return base.map((b) => b + v);
    });
  }),
  snowflake: () => T('snowflake', 16, 16, (c) => {
    c.clearRect(0, 0, 16, 16);
    c.fillStyle = '#ffffff';
    for (let i = 1; i < 15; i++) { c.fillRect(i, 7, 1, 1); c.fillRect(7, i, 1, 1); c.fillRect(i, i, 1, 1); c.fillRect(14 - i, i, 1, 1); }
    for (const [x, y] of [[3, 5], [5, 3], [11, 5], [9, 3], [3, 9], [5, 11], [11, 9], [9, 11], [2, 7], [12, 7], [7, 2], [7, 12]]) c.fillRect(x, y, 1, 1);
  }),
  wetFloor: () => T('wetfloor', 32, 40, (c, w, h) => {
    rect(c, '#f0c818', 0, 0, w, h);
    c.fillStyle = '#101010'; c.beginPath(); c.moveTo(16, 4); c.lineTo(28, 24); c.lineTo(4, 24); c.closePath(); c.fill();
    c.fillStyle = '#f0c818'; c.beginPath(); c.moveTo(16, 8); c.lineTo(25, 22); c.lineTo(7, 22); c.closePath(); c.fill();
    rect(c, '#101010', 15, 11, 2, 6); rect(c, '#101010', 13, 16, 5, 1); rect(c, '#101010', 12, 19, 3, 1); rect(c, '#101010', 16, 18, 4, 1); rect(c, '#101010', 14, 9, 2, 2);
    ptext(c, 'CAUTION', 2, 27, '#101010'); ptext(c, 'WET', 10, 33, '#101010');
  }),
  stain: () => T('stain', 32, 32, (c, w, h) => {
    const r = rng(107);
    c.clearRect(0, 0, w, h);
    pixels(c, w, h, (x, y) => {
      const d = Math.hypot(x - 15 + Math.sin(y * 0.4) * 2, y - 16) / 13;
      const ring = Math.abs(d - 0.85) < 0.08 ? 0.5 : 0;
      const a = d < 1 ? 0.2 + ring + r() * 0.06 : 0;
      return [140, 110, 70, a * 255];
    });
  }),
  frost: () => canvasTexture('hosp-frost', 128, 96, (c, w, h) => {
    const r = rng(109);
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, y * 1.4, w - 1 - x, (h - 1 - y) * 0.6);
      const a = Math.max(0, 1 - e / (6 + Math.sin(x * 0.7) * 3 + Math.sin(y * 1.3) * 3 + r() * 4)) * (0.55 + r() * 0.45);
      const i = (y * w + x) * 4;
      img.data[i] = 235; img.data[i + 1] = 245; img.data[i + 2] = 255; img.data[i + 3] = a * 200;
    }
    c.putImageData(img, 0, 0);
  }),
  led: (text, color) => T(`led-${text}-${color}`, ptw(text) + 4, 9, (c, w, h) => {
    rect(c, '#060404', 0, 0, w, h); ptext(c, text, 2, 2, color);
  }),
  plaque: (text) => T(`plaque-${text}`, ptw(text) + 6, 11, (c, w, h) => {
    rect(c, '#1c3a56', 0, 0, w, h); rect(c, '#2c5a80', 0, 0, w, 1); ptext(c, text, 3, 3, '#f0f4f8');
  }),
  rubber: () => T('rubber', 16, 16, (c, w, h) => {
    const r = rng(113);
    pixels(c, w, h, (x, y) => { const v = (y % 4 === 0 ? 14 : 0) + (r() - 0.5) * 10 + (r() < 0.04 ? 60 : 0); return [42 + v, 44 + v, 46 + v]; });
  }),
  binders: () => T('binders', 64, 16, (c, w, h) => {
    const r = rng(127);
    const cols = ['#2a4a8a', '#8a2a2a', '#2a6a3a', '#c8a030', '#5a5a6a', '#e0e0d8', '#3a7a9a'];
    let x = 0;
    while (x < w) { const bw = 2 + (r() * 3 | 0); rect(c, cols[(r() * cols.length) | 0], x, (r() * 3) | 0, bw, h); rect(c, 'rgba(255,255,255,0.6)', x, 5, bw, 3); rect(c, 'rgba(0,0,0,0.5)', x + bw - 1, 0, 1, h); x += bw; }
  }),
};

/** Smooth (not pixel) gradient for light wedges and shafts: bright at v=0, fades to v=1, soft sides. */
function shaftTexture() {
  return canvasTexture('hosp-shaft', 32, 64, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 1 - y / (h - 1);
      const s = 1 - Math.abs(x / (w - 1) - 0.5) * 2;
      const a = Math.pow(v, 1.6) * Math.min(1, s * 2.5);
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** Set UVs from world/local position (metres / su, sv) so tiling stays even. */
function worldUV(geo, ox, oy, oz, su, sv) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ax > 0.5) uv.setXY(i, z / su, y / sv);
    else if (ay > 0.5) uv.setXY(i, x / su, z / sv);
    else uv.setXY(i, x / su, y / sv);
  }
}

function mergeGeometries(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0, io = 0;
  for (const g of geos) {
    const p = g.attributes.position;
    pos.set(p.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const c = g.userData.color || [1, 1, 1];
    for (let i = 0; i < p.count; i++) col.set(c, (vo + i) * 3);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; } else { for (let i = 0; i < p.count; i++) idx[io + i] = vo + i; io += p.count; }
    vo += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

const FloorSheenShader = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: 0.2 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      // waxed vinyl: soft vertical smear
      vec3 c = vec3(0.0); float ws = 0.0;
      for (int i = -3; i <= 3; i++) {
        float fi = float(i); float w = 1.0 - abs(fi) / 4.0;
        c += texture2D(tDiffuse, uv + vec2(fi * 0.0008, fi * 0.004)).rgb * w; ws += w;
      }
      c /= ws;
      vec2 f = abs(fract(vWorld.xz * 2.0) - 0.5);
      float seam = 1.0 - smoothstep(0.45, 0.5, max(f.x, f.y)) * 0.8;
      float fade = smoothstep(-4.2, -1.5, vWorld.z) * 0.5 + 0.5;
      gl_FragColor = vec4(c * uStrength * seam * fade, 1.0);
    }`,
};

export class HospitalScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'hospital';
    this.title = 'Городская больница Уайтхорса';
    this.background = 0x06080a;
    this.camera = { distance: 8.0, height: 2.3, lookHeight: 1.3, lookZ: -1.0 };
    this.wardBOpen = false;
    const areas = [
      { minX: -21.5, maxX: X_END - 0.6, minZ: -2.6, maxZ: 1.8 },     // main corridor + patient wing + old wing
      { minX: -0.9, maxX: 0.9, minZ: -9.0, maxZ: -2.5 },            // side corridor
      { minX: -5.6, maxX: -3.4, minZ: -6.4, maxZ: -2.5 },           // procedure room
      { minX: 16.3, maxX: 19.9, minZ: -7.4, maxZ: -4.4 },           // ward 109 (Julian)
      { minX: 16.55, maxX: 17.45, minZ: -4.6, maxZ: -2.5 },         // ward 109 door
      // ward 113 (the old woman) in the patient wing — same size as 109 (4.0 × 3.6 m)
      { minX: 29.0, maxX: 32.6, minZ: -7.4, maxZ: -4.4, enabled: () => this.wardBOpen },
      { minX: 29.3, maxX: 30.15, minZ: -4.6, maxZ: -2.5, enabled: () => this.wardBOpen },
    ];
    this.bounds = { walk: { areas }, camera: { minX: -17.5, maxX: X_END - 4.5 } };
    this._batches = new Map();
    this.nightOnly = [];   // [{ m: material, day, night }] opacity / emissive toggles
    this.moonFx = [];
  }

  // ---------------------------------------------------------------- batching

  _add(geo, mat, x, y, z, o = {}) {
    if (o.uv) worldUV(geo, x, y, z, o.uv[0], o.uv[1]);
    if (o.rx || o.ry || o.rz) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0)));
    geo.translate(x, y, z);
    if (o.color != null) { const c = new THREE.Color(o.color); geo.userData.color = [c.r, c.g, c.b]; }
    let list = this._batches.get(mat);
    if (!list) this._batches.set(mat, (list = []));
    list.push(geo);
    return geo;
  }
  bx(w, h, d, mat, x, y, z, o) { return this._add(bevelBox(w, h, d), mat, x, y, z, o); }
  pl(w, h, mat, x, y, z, o) { return this._add(new THREE.PlaneGeometry(w, h), mat, x, y, z, o); }
  cy(rt, rb, h, seg, mat, x, y, z, o) { return this._add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, o); }
  flushBatches() {
    for (const [mat, list] of this._batches) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat);
      if (mat.transparent) mesh.renderOrder = 1;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.root.add(mesh);
    }
    this._batches.clear();
  }
  mat(key, params = {}) { return this.mats.get(key, params); }
  /** Vertex-coloured variant of a material (for tinted batches). */
  matV(key, opts) { return this.mat(key, { ...opts, vertexColors: true }); }
  /** Pixel texture plane material (unlit option for screens / signs). */
  texMat(key, map, { basic = false, transparent = false, emissive = 0, color = 0xffffff } = {}) {
    if (basic) return this.mat(key, { map, color, transparent, alphaTest: transparent ? 0.05 : 0, forceStandard: false, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: emissive || 1, roughness: 0.6 });
    return this.mat(key, { map, color, transparent, alphaTest: transparent ? 0.05 : 0, roughness: 0.7, emissive: emissive ? 0xffffff : 0, emissiveMap: emissive ? map : null, emissiveIntensity: emissive });
  }
  /** Simple framed picture/notice on the back wall. */
  framed(map, w, h, x, y, z = BACK + 0.02, frameColor = 0x2a2c30, key = null) {
    const fm = this.mat(`frame-${frameColor}`, { color: frameColor, roughness: 0.5, metalness: 0.2 });
    const b = 0.035;
    this.bx(w + b * 2, b, 0.03, fm, x, y + h / 2 + b / 2, z + 0.015);
    this.bx(w + b * 2, b, 0.03, fm, x, y - h / 2 - b / 2, z + 0.015);
    this.bx(b, h, 0.03, fm, x - w / 2 - b / 2, y, z + 0.015);
    this.bx(b, h, 0.03, fm, x + w / 2 + b / 2, y, z + 0.015);
    this.pl(w, h, this.texMat(key || `pic-${map.uuid}`, map), x, y, z + 0.012);
  }
  sanitizer(x, y, z = BACK + 0.02, ry = 0) {
    const white = this.mat('hPlasticW', { color: 0xeef0f0, roughness: 0.5 });
    const dx = Math.sin(ry), dz = Math.cos(ry);
    this.bx(0.12, 0.22, 0.09, white, x + dx * 0.045, y, z + dz * 0.045, { ry });
    this.bx(0.08, 0.06, 0.02, this.mat('hSanWin', { color: 0x6ab0d8, roughness: 0.2, emissive: 0x0a2030 }), x + dx * 0.092, y + 0.03, z + dz * 0.092, { ry });
    this.bx(0.06, 0.03, 0.05, this.mat('hPlasticG', { color: 0x606870, roughness: 0.5 }), x + dx * 0.07, y - 0.12, z + dz * 0.07, { ry });
  }

  // ---------------------------------------------------------------- build

  build() {
    const root = this.root;
    // scene-local overrides of the shared LocationBase prop materials (bed, IV, chairs)
    this.mat('steel', { map: TX.steel(), color: 0xc4cad0, metalness: 0.45, roughness: 0.38 });
    this.mat('steelDark', { color: 0x40444a, metalness: 0.4, roughness: 0.5 });
    this.mat('sheet', { map: TX.sheet(), color: 0xffffff, roughness: 0.95 });
    this.mat('blanket', { map: TX.blanket(), color: 0xffffff, roughness: 0.95 });
    this.mat('monitorBody', { color: 0x2e3236, roughness: 0.5 });
    this.mat('doorGlass', { color: 0x2a3640, roughness: 0.1, metalness: 0.3, emissive: 0x0c141a });
    // shared palette (looked up by name further down)
    this.mat('hBlack', { color: 0x141414, roughness: 0.6 });
    this.mat('hYellow', { color: 0xe8c020, roughness: 0.5 });
    this.mat('hPlasticW', { color: 0xeef0f0, roughness: 0.5 });
    this.mat('hPlasticG', { color: 0x606870, roughness: 0.5 });
    this.mat('hFireRed', { color: 0xb81818, roughness: 0.4 });
    this.mat('hGlass', { color: 0xc8dce8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    this.mat('hPaper', { color: 0xf4f4ee, roughness: 0.9 });
    this.mat('hClipboard', { color: 0x8a6a40, roughness: 0.6 });
    this.mat('hBrass', { color: 0xb08a40, metalness: 0.7, roughness: 0.35 });
    this.mat('hCabinetW', { color: 0xe4e6e2, roughness: 0.5 });
    this.mat('hDrawerFace', { color: 0xd4d8d6, roughness: 0.5 });
    this.mat('hWorkTop', { color: 0xd8dcd4, roughness: 0.5 });
    this.mat('hAccent', { color: 0x2a6ab0, roughness: 0.4 });
    this.mat('hSharps', { color: 0xe8c020, roughness: 0.5 });
    this.mat('hElevFrame', { color: 0x5a6068, metalness: 0.5, roughness: 0.35 });

    this.buildShell();
    this.buildCeiling();
    this.buildEntrance();
    this.buildCorridorA();
    this.buildProcedure();
    this.buildSideCorridor();
    this.buildNurseStation();
    this.buildStretch(); // between station and ward 107, staff door, end of corridor

    // ---------------------------------------------------------------- wards
    // every ward is 4.0 m wide and 3.6 m deep; the old woman's ward (113) is built with the
    // patient wing (HospitalExpansion), 107 is an empty dark room now
    this.wardA = this.buildWard(16.1, 20.1, '109', { window: true });
    this.wardA.hinge.rotation.y = 1.35; // Julian's door stands open
    this.anchors.wardADoor = new THREE.Vector3(16.9, 1.9, BACK + 0.15);

    this.buildExpansion(); // patient wing, old wing, operating area (HospitalExpansion.js)
    for (const [pane, n] of this.wardViews || []) this.deepenView(pane, undefined, n);

    this.buildSignage();
    this.buildLights();
    this.buildForeground();
    this.flushBatches();

    this.dustFx = this.dust(new THREE.Box3(new THREE.Vector3(-22, 0.3, -3.5), new THREE.Vector3(X_END - 1, 2.8, 2)), 520);
    this.setState('day');
    // painted VN backdrop: ward 109 seen from the corridor
    this.shots = { ward: { pos: [18.4, 1.6, -1.4], look: [18.8, 1.15, -6.8], fov: 56 } };
    this.vnHide = [];
    return root;
  }

  buildShell() {
    const root = this.root;
    const floorTex = tiled(TX.floor(), 23, 7.5);
    this.floor(-23, 23, -10, 5, this.mat('hFloor', { map: floorTex, color: 0xd4dcd6, roughness: 0.32, metalness: 0.0 }));
    if (!this.low) {
      const refl = new Reflector(new THREE.PlaneGeometry(46, 6.6), {
        textureWidth: Math.floor(window.innerWidth * 0.5), textureHeight: Math.floor(window.innerHeight * 0.5),
        shader: FloorSheenShader, clipBias: 0.003,
      });
      refl.material.transparent = true;
      refl.material.blending = THREE.AdditiveBlending;
      refl.material.depthWrite = false;
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(0, 0.003, -0.7);
      refl.renderOrder = 1;
      root.add(refl);
      this.sheen = refl;
    }
    // wayfinding lines on the floor: blue runs the ward, yellow turns into surgery
    const stripe = (color, x0, x1, z, w = 0.07) => this.bx(x1 - x0, 0.004, w, this.mat(`stripe-${color}`, { color, roughness: 0.5 }), (x0 + x1) / 2, 0.003, z);
    stripe(0x2a6ab0, -21.3, 21.3, 1.25);
    stripe(0xd8b020, -21.3, 0.3, 1.1);
    this.bx(0.07, 0.004, 10.15, this.mat('stripe-14200864', { color: 0xd8b020, roughness: 0.5 }), 0.3, 0.003, -4.0);
    stripe(0x3a9a5a, -21.3, -14.0, 0.95);

    const wallMat = this.mat('hWall', { map: TX.block(), color: 0xe4ece4, roughness: 0.75 });
    this.wallMat = wallMat;
    const holes = [
      { x0: -21.4, x1: -19.4, y0: 0, y1: 2.5 },   // entrance
      { x0: -12.8, x1: -11.2, y0: 0, y1: 2.3 },   // elevator
      { x0: -5.8, x1: -3.2, y0: 0, y1: 2.4 },     // procedure room
      { x0: -1.0, x1: 1.0, y0: 0, y1: 2.6 },      // side corridor
      { x0: 9.0, x1: 13.0, y0: 0, y1: 2.6 },      // ward 107 front
      { x0: 16.1, x1: 20.1, y0: 0, y1: 2.6 },     // ward 109 front
      { x0: -9.85, x1: -8.75, y0: 0, y1: 2.2 },   // stairs door
      { x0: 14.0, x1: 15.0, y0: 0, y1: 2.2 },     // staff-only door
    ];
    this.wall(-23, 23, H, BACK, wallMat, holes);
    this.plane(15, H, wallMat, -23, H / 2, -2.5, Math.PI / 2); // the far end is open: the corridor goes on (HospitalExpansion)

    // lower wall protection, rails, skirting, wall stripe, corner guards
    // wall dressing runs only between openings (it used to run across the doors)
    const spans = [];
    let from = -23;
    for (const h of [...holes].sort((a, b) => a.x0 - b.x0)) { if (h.x0 > from) spans.push([from, h.x0]); from = Math.max(from, h.x1); }
    if (from < 23) spans.push([from, 23]);
    const wains = this.mat('hWains', { map: TX.wainscot(), color: 0xffffff, roughness: 0.55 });
    const skirt = this.mat('hSkirt', { color: 0x2a3436, roughness: 0.6 });
    const railM = this.mat('hRail', { map: TX.veneer(), color: 0xc89a6a, roughness: 0.4 });
    const bracket = this.mat('steel');
    const capM = this.mat('hCap', { color: 0xd0dcd8, roughness: 0.5 });
    const blueStripe = this.mat('hWallStripe', { color: 0x2a6ab0, roughness: 0.5 });
    const guard = this.mat('hGuard', { map: TX.steel(), color: 0xe0e4e8, metalness: 0.5, roughness: 0.3 });
    for (const [a, b] of spans) {
      const w = b - a, cx = (a + b) / 2;
      this.bx(w, 1.0, 0.03, wains, cx, 0.5, BACK + 0.015, { uv: [2, 1] });
      this.bx(w, 0.03, 0.05, capM, cx, 1.015, BACK + 0.025);
      this.bx(w, 0.1, 0.04, skirt, cx, 0.05, BACK + 0.035);
      this.bx(w, 0.06, 0.012, blueStripe, cx, 1.32, BACK + 0.006);
      // handrail on brackets (round bar)
      this.cy(0.03, 0.03, w - 0.1, 8, railM, cx, 0.9, BACK + 0.1, { rz: Math.PI / 2 });
      for (let x = a + 0.3; x < b - 0.2; x += 1.2) this.bx(0.03, 0.03, 0.09, bracket, x, 0.87, BACK + 0.055);
      // stretcher bumper
      this.bx(w - 0.05, 0.12, 0.035, this.mat('hBumper', { color: 0x3c5a5e, roughness: 0.6 }), cx, 0.32, BACK + 0.045);
    }
    for (const h of holes) {
      if (h.y1 <= 2.2) continue; // plain doors have their own frames
      for (const x of [h.x0, h.x1]) {
        if (Math.abs(x) >= 22.9) continue;
        this.bx(0.06, 1.6, 0.06, guard, x + (x === h.x0 ? -0.02 : 0.02), 0.85, BACK + 0.02);
      }
    }
  }

  buildCeiling() {
    const root = this.root;
    const ceilMat = this.mat('hCeil', { map: tiled(TX.ceiling(), 46 / 1.2, 15 / 1.2), roughness: 0.9, emissive: 0xffffff, emissiveMap: tiled(TX.ceiling(), 46 / 1.2, 15 / 1.2), emissiveIntensity: 0.1, color: 0xb8bcb8 });
    this.ceilMat = ceilMat;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(46, 15), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -2.5); root.add(ceil);
    // front fascia: a bulkhead edge at the cut so the ceiling reads as a slab
    this.bx(46, 0.22, 0.12, this.mat('hFascia', { color: 0x1a1e22, roughness: 0.8 }), 0, H - 0.11, 4.95);

    // troffers: housing + prismatic lens. Lens materials: A (off at night), B (dim at night), F (flicker)
    const lensTex = TX.lens();
    const mkLens = (k) => this.mat(`hLens${k}`, { color: 0x000000, map: lensTex, emissive: 0xe4eeff, emissiveMap: lensTex, emissiveIntensity: 1.6, side: THREE.DoubleSide });
    this.lens = { A: mkLens('A'), B: mkLens('B'), F: mkLens('F') };
    const housing = this.mat('fluoHousing', { color: 0xc8ccd0, roughness: 0.6 });
    this.troffer = (x, z, kind = 'A', w = 1.2, d = 0.6) => {
      this.bx(w + 0.06, 0.05, d + 0.06, housing, x, H - 0.02, z);
      this.pl(w, d, this.lens[kind], x, H - 0.047, z, { rx: Math.PI / 2 });
    };
    for (let x = -21; x <= 21; x += 3) {
      const kind = Math.abs(x - 6) < 1.6 || Math.abs(x - 3) < 0.1 ? 'B' : (x === -12 ? 'F' : 'A');
      this.troffer(x, -1.3, kind);
    }
    this.troffer(-16.5, -3.4, 'A', 1.2, 0.6);
    // return-air vents, sprinklers, smoke detectors, water stains
    const ventM = this.texMat('hVent', TX.vent());
    const sprM = this.mat('hSprinkler', { color: 0xd8d0b0, metalness: 0.6, roughness: 0.4 });
    const smokeM = this.mat('hPlasticW', { color: 0xeef0f0, roughness: 0.5 });
    for (let x = -19.5; x <= 21; x += 6) this.pl(0.6, 0.6, ventM, x, H - 0.005, 0.9, { rx: Math.PI / 2 });
    for (let x = -21; x <= 21; x += 3) {
      for (const z of [-3.1, 0.3, 2.6]) {
        this.cy(0.012, 0.012, 0.05, 6, sprM, x + 1.5, H - 0.03, z);
        this.cy(0.035, 0.02, 0.012, 8, sprM, x + 1.5, H - 0.06, z);
      }
    }
    for (const x of [-15, -6, 3.2, 12, 20]) {
      this.cy(0.08, 0.08, 0.04, 14, smokeM, x, H - 0.02, -0.2);
      this.bx(0.012, 0.012, 0.012, this.mat('hLedRed', { color: 0x000000, emissive: 0xff2020, emissiveIntensity: 3 }), x + 0.04, H - 0.042, -0.15);
    }
    const stainM = this.texMat('hStain', TX.stain(), { transparent: true });
    for (const [x, z, s] of [[-9.4, -2.2, 0.7], [7.6, 0.4, 0.5], [14.2, -3.0, 0.9]]) this.pl(s, s, stainM, x, H - 0.004, z, { rx: Math.PI / 2, rz: x });
  }

  buildEntrance() {
    const root = this.root;
    this.outsideMats = [];
    const outside = (w, h, x, y, z) => {
      const m = new THREE.MeshBasicMaterial({ map: streetTexture('morning'), color: 0xdde6ee });
      this.outsideMats.push(m);
      return this.plane(w, h, m, x, y, z);
    };
    outside(5, 3.4, -20.4, 1.6, BACK - 1.6);
    // vestibule: side walls, outer doors, slush on the mat
    const vest = this.mat('hVest', { map: TX.block(), color: 0xc8d0cc, roughness: 0.8 });
    for (const x of [-21.45, -19.35]) this.bx(0.1, 2.6, 1.6, vest, x, 1.3, BACK - 0.8, { uv: [2, 2] });
    this.bx(2.0, 0.6, 0.1, vest, -20.4, 2.8, BACK - 1.5);
    const frameBronze = this.mat('hAlu', { color: 0x3a3632, metalness: 0.5, roughness: 0.4 });
    const glass = this.mat('hGlass', { color: 0xc8dce8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false });
    for (const z of [BACK, BACK - 1.45]) {
      for (const x of [-20.9, -19.9]) this.box(0.96, 2.46, 0.03, glass, x, 1.23, z);
      this.bx(2.0, 0.07, 0.08, frameBronze, -20.4, 2.47, z);
      for (const x of [-21.38, -20.4, -19.42]) this.bx(0.06, 2.5, 0.08, frameBronze, x, 1.25, z);
      for (const x of [-20.9, -19.9]) this.bx(0.6, 0.04, 0.05, this.mat('steel'), x, 1.05, z + 0.05);
    }
    this.bx(1.9, 0.01, 1.4, this.mat('hRubberMat', { map: tiled(TX.rubber(), 6, 4), color: 0xffffff, roughness: 0.9 }), -20.4, 0.006, BACK - 0.72);
    this.bx(2.2, 0.012, 1.3, this.mat('hRubberMat2', { map: tiled(TX.rubber(), 7, 4), color: 0xd0d0d0, roughness: 0.9 }), -20.4, 0.006, -3.3);
    const r = rng(3);
    const slush = this.mat('hSlush', { color: 0xdfe6ea, roughness: 0.3, emissive: 0x101418 });
    for (let i = 0; i < 26; i++) this.bx(0.04 + r() * 0.1, 0.006, 0.03 + r() * 0.08, slush, -21.2 + r() * 1.7, 0.016, -2.7 - r() * 2.6);
    const sign = this.textSign('WHITEHORSE GENERAL HOSPITAL', { w: 3.4, h: 0.32, bg: '#0e3a5a', fg: '#f4f8fa' });
    sign.position.set(-20.4, 2.8, BACK + 0.03); root.add(sign);
    this.anchors.entrance = new THREE.Vector3(-20.4, 1.4, BACK + 0.2);
    // parked wheelchairs left of the reception
    const wc = this.wheelchair(); wc.position.set(-18.85, 0, -3.62); wc.rotation.y = 0.15; root.add(wc);

    // ---------------------------------------------------------------- reception
    const lam = this.mat('hLaminate', { map: TX.laminate(), color: 0xffffff, roughness: 0.6 });
    const top = this.mat('recTopH', { color: 0x3a6a82, roughness: 0.35 });
    this.bx(3.2, 1.0, 0.04, lam, -16.5, 0.55, -2.77, { uv: [2, 1] });
    this.bx(3.2, 0.1, 0.05, this.mat('hSkirt'), -16.5, 0.05, -2.77);
    this.bx(3.2, 1.1, 0.66, this.mat('hDeskBody', { color: 0xcfd6d8, roughness: 0.6 }), -16.5, 0.55, -3.12);
    this.bx(3.32, 0.05, 0.42, top, -16.5, 1.12, -2.86);
    this.bx(3.2, 0.04, 0.5, this.mat('hWorkTop', { color: 0xd8dcd4, roughness: 0.5 }), -16.5, 0.78, -3.45);
    this.bx(3.3, 0.07, 0.02, this.mat('hAccent', { color: 0x2a6ab0, roughness: 0.4 }), -16.5, 0.92, -2.745);
    // sneeze guard
    this.box(3.0, 0.62, 0.02, glass, -16.5, 1.46, -2.97);
    this.bx(0.4, 0.04, 0.03, this.mat('steel'), -16.5, 1.16, -2.95);
    for (const x of [-18.0, -15.0]) this.bx(0.03, 0.66, 0.03, frameBronze, x, 1.47, -2.97);
    // behind the desk: monitor, printer, shelves, binders, clock, NOW SERVING
    const scr = this.texMat('hEmr', TX.emr(), { basic: true, emissive: 1.1 });
    this.bx(0.42, 0.3, 0.04, this.mat('monitorBody'), -17.2, 1.27, -3.4);
    this.pl(0.38, 0.26, scr, -17.2, 1.27, -3.378);
    this.bx(0.05, 0.2, 0.05, this.mat('monitorBody'), -17.2, 0.95, -3.43);
    this.bx(0.42, 0.3, 0.04, this.mat('monitorBody'), -15.9, 1.27, -3.4, { ry: -0.25 });
    this.pl(0.38, 0.26, scr, -15.895, 1.27, -3.378, { ry: -0.25 });
    this.bx(0.45, 0.22, 0.38, this.mat('hPlasticBeige', { color: 0xd8d4c8, roughness: 0.6 }), -15.3, 0.91, -3.62);
    const shelfM = this.mat('hShelf', { color: 0xe0e2de, roughness: 0.6 });
    const binders = this.texMat('hBinders', TX.binders());
    for (const y of [1.55, 1.95]) {
      this.bx(2.2, 0.03, 0.3, shelfM, -16.6, y, BACK + 0.15);
      this.pl(2.1, 0.3, binders, -16.6, y + 0.165, BACK + 0.27);
    }
    this.clock(-15.0, 2.2, BACK + 0.02, 'reception');
    this.pl(0.36, 0.12, this.texMat('hLed47', TX.led('NOW 47', '#ff3020'), { basic: true, emissive: 1.6 }), -18.05, 2.1, BACK + 0.025);
    this.bx(0.4, 0.15, 0.04, this.mat('monitorBody'), -18.05, 2.1, BACK + 0.005);
    // ticket dispenser at the counter end
    this.cy(0.02, 0.02, 1.1, 6, this.mat('steel'), -14.95, 0.55, -2.7);
    this.bx(0.14, 0.18, 0.1, this.mat('hRedPlastic', { color: 0xb02020, roughness: 0.4 }), -14.95, 1.18, -2.7);
    // waiting bench with magazines and a brochure rack
    this.bench(-14.3, -3.35, 1.8, 0x3a7a86);
    this.colliders.push({ box: { minX: -18.2, maxX: -14.8, minZ: -3.6, maxZ: -2.7 } });
    this.anchors.reception = new THREE.Vector3(-16.5, 1.6, -3.1);
    this.colliders.push({ box: { minX: -15.3, maxX: -13.3, minZ: -3.7, maxZ: -3.0 } });
    for (let i = 0; i < 3; i++) this.bx(0.22, 0.012, 0.3, this.matV('hMagazine', { color: 0xffffff, roughness: 0.7 }), -13.75 + i * 0.07, 0.49 + i * 0.012, -3.35, { ry: i * 0.4, color: [0xc04040, 0x3a7ab0, 0xe0c060][i] });
    this.bx(0.6, 0.6, 0.06, this.mat('hRackAcrylic', { color: 0xcfe0e8, transparent: true, opacity: 0.5, roughness: 0.1 }), -14.3, 1.7, BACK + 0.04);
    for (let i = 0; i < 6; i++) this.bx(0.16, 0.22, 0.01, this.matV('hBrochure', { color: 0xffffff, roughness: 0.7 }), -14.48 + (i % 3) * 0.18, 1.6 + (i / 3 | 0) * 0.27, BACK + 0.075, { color: [0x2a6ab0, 0xe0e0d8, 0x3a9a5a, 0xd06030, 0xe8d070, 0x8a5aa0][i] });
    this.framed(TX.visiting(), 0.6, 0.4, -13.55, 1.8, BACK + 0.02, 0xd0d4d6);
  }

  buildCorridorA() {
    const root = this.root;
    // elevator: brushed steel doors in a dark frame, floor indicator
    const elev = new THREE.Group();
    const elevMat = this.mat('elevator', { map: TX.steel(), color: 0xc8d0d8, metalness: 0.6, roughness: 0.3 });
    this.box(0.78, 2.28, 0.05, elevMat, -0.4, 1.14, 0, elev);
    this.box(0.78, 2.28, 0.05, elevMat, 0.4, 1.14, 0, elev);
    elev.position.set(-12, 0, BACK - 0.02);
    root.add(elev);
    const ef = this.mat('hElevFrame', { color: 0x5a6068, metalness: 0.5, roughness: 0.35 });
    this.bx(0.1, 2.35, 0.12, ef, -12.85, 1.17, BACK + 0.02);
    this.bx(0.1, 2.35, 0.12, ef, -11.15, 1.17, BACK + 0.02);
    this.bx(1.8, 0.12, 0.12, ef, -12, 2.36, BACK + 0.02);
    this.bx(0.004, 2.26, 0.052, this.mat('hDarkGap', { color: 0x08090a }), -12, 1.14, BACK - 0.02);
    this.bx(1.6, 0.02, 0.2, this.mat('steel'), -12, 0.01, BACK + 0.05);
    this.pl(0.24, 0.09, this.texMat('hElevInd', TX.led('2 >', '#ffb030'), { basic: true, emissive: 1.8 }), -12, 2.6, BACK + 0.02);
    this.bx(0.3, 0.13, 0.03, this.mat('monitorBody'), -12, 2.6, BACK + 0.003);
    // call panel
    this.bx(0.13, 0.28, 0.02, this.mat('steel'), -10.9, 1.2, BACK + 0.01);
    const ebtn = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), this.mat('ebtn', { color: 0, emissive: 0xffc860, emissiveIntensity: 2 }));
    ebtn.position.set(-10.9, 1.27, BACK + 0.025); root.add(ebtn);
    this.cy(0.03, 0.03, 0.01, 10, this.mat('hBtnOff', { color: 0x2a2c30 }), -10.9, 1.13, BACK + 0.025, { rx: Math.PI / 2 });
    const es = this.textSign('ЛИФТ · 1 ЭТАЖ', { w: 1.1, h: 0.18 });
    es.position.set(-12, 2.86, BACK + 0.03); root.add(es);
    this.anchors.elevator = new THREE.Vector3(-12, 1.8, BACK + 0.2);
    // fire extinguisher cabinet
    const red = this.mat('hFireRed', { color: 0xb81818, roughness: 0.4 });
    this.bx(0.46, 0.78, 0.06, red, -10.3, 1.3, BACK + 0.03);
    this.bx(0.38, 0.6, 0.02, this.mat('hCabInner', { color: 0x4a1010, roughness: 0.6 }), -10.3, 1.27, BACK + 0.062);
    this.cy(0.07, 0.07, 0.42, 10, red, -10.3, 1.18, BACK + 0.08);
    this.bx(0.06, 0.08, 0.05, this.mat('hBlack', { color: 0x141414 }), -10.3, 1.43, BACK + 0.08);
    this.box(0.38, 0.6, 0.01, this.mat('hGlass'), -10.3, 1.27, BACK + 0.07);
    this.pl(0.3, 0.07, this.texMat('hFireTxt', TX.led('FIRE', '#ffffff')), -10.3, 1.62, BACK + 0.066);
    // stairs: steel fire door with push bar and wired glass
    this.hDoor(-9.3, BACK + 0.02, { sign: 'ЛЕСТНИЦА · STAIRS', w: 1.0, color: 0x5e7c76, push: true });
    this.anchors.stairs = new THREE.Vector3(-9.3, 1.8, BACK + 0.2);
    // pull station + horn/strobe
    this.bx(0.11, 0.15, 0.05, red, -8.45, 1.22, BACK + 0.025);
    this.bx(0.06, 0.03, 0.02, this.mat('hPlasticW'), -8.45, 1.2, BACK + 0.055);
    this.bx(0.13, 0.13, 0.06, red, -8.45, 2.3, BACK + 0.03);
    this.bx(0.08, 0.04, 0.02, this.mat('hStrobe', { color: 0xf0f0f0, emissive: 0xffffff, emissiveIntensity: 0.2 }), -8.45, 2.27, BACK + 0.065);
    // notice board above the cooler
    this.framed(TX.cork(), 1.0, 0.66, -7.55, 1.98, BACK + 0.02, 0x6a5a48);
    // water cooler
    const cooler = new THREE.Group();
    this.box(0.36, 1.0, 0.36, this.mat('coolerBody', { color: 0xe8ecee, roughness: 0.5 }), 0, 0.5, 0, cooler);
    this.box(0.3, 0.06, 0.2, this.mat('steelDark'), 0, 0.62, 0.12, cooler);
    for (const [x, c] of [[-0.06, 0x2060d0], [0.06, 0xd03030]]) this.box(0.04, 0.05, 0.04, this.mat(`tap-${c}`, { color: c, roughness: 0.4 }), x, 0.78, 0.19, cooler);
    this.box(0.36, 0.08, 0.36, this.mat('hPlasticG'), 0, 1.04, 0, cooler);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.44, 14), new THREE.MeshStandardMaterial({ color: 0x8ac8f0, transparent: true, opacity: 0.55, roughness: 0.05, emissive: 0x0a2030 }));
    bottle.position.y = 1.31; cooler.add(bottle);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.28, 14), this.mat('hWater', { color: 0x4a9ad0, roughness: 0.1, transparent: true, opacity: 0.6 }));
    water.position.y = 1.22; cooler.add(water);
    cooler.position.set(-7.4, 0, BACK + 0.35);
    root.add(cooler);
    this.colliders.push({ x: -7.4, z: BACK + 0.35, r: 0.3 });
    this.anchors.cooler = new THREE.Vector3(-7.4, 1.3, BACK + 0.4);
    this.cy(0.04, 0.04, 0.4, 10, this.mat('hAcrylic', { color: 0xdfe8ee, transparent: true, opacity: 0.6, roughness: 0.1 }), -6.98, 1.4, BACK + 0.06);
    this.cy(0.035, 0.035, 0.32, 10, this.mat('hPlasticW'), -6.98, 1.38, BACK + 0.06);
    this.cy(0.13, 0.11, 0.42, 12, this.mat('hBinGrey', { color: 0x6a7074, roughness: 0.6 }), -6.98, 0.21, BACK + 0.2);
    // vending machine (glows)
    this.bx(0.86, 1.86, 0.72, this.mat('hVendBody', { color: 0x24282e, roughness: 0.5 }), -6.38, 0.93, -3.62);
    this.vendMat = this.texMat('hVendFront', TX.vending(), { basic: true, emissive: 0.9 });
    this.pl(0.82, 1.64, this.vendMat, -6.38, 1.0, -3.255);
    this.box(0.56, 1.08, 0.01, this.mat('hGlass'), -6.48, 1.15, -3.25);
    this.vendGlow = glow(0xc8e0ff, 1.6, 0.0); this.vendGlow.position.set(-6.4, 1.2, -3.1); root.add(this.vendGlow);
    this.vendPool = this.pool(0xa8c8ff, -6.4, -2.7, 1.6, 1.4, 0.0);
    // framed print + pay phone between procedure room and side corridor
    this.payPhone(-2.62, 1.3);
    this.framed(TX.print('aurora'), 0.66, 0.44, -1.75, 1.8, BACK + 0.02, 0xc8ccd0);
    this.sanitizer(-1.3, 1.25);
  }

  buildProcedure() {
    const root = this.root;
    const tile = this.mat('procWall', { map: TX.tiles(), color: 0xffffff, roughness: 0.4 });
    const paint = this.mat('procPaint', { map: TX.block(), color: 0xe8eeec, roughness: 0.8 });
    // tiled to 1.8 m, painted above
    this.bx(2.6, 1.8, 0.1, tile, -4.5, 0.9, -6.8, { uv: [0.8, 0.8] });
    this.bx(2.6, H - 1.8, 0.1, paint, -4.5, 1.8 + (H - 1.8) / 2, -6.8, { uv: [2, 2] });
    for (const x of [-5.85, -3.15]) {
      this.bx(0.1, 1.8, 2.8, tile, x, 0.9, -5.4, { uv: [0.8, 0.8] });
      this.bx(0.1, H - 1.8, 2.8, paint, x, 1.8 + (H - 1.8) / 2, -5.4, { uv: [2, 2] });
    }
    this.bx(2.6, 0.04, 2.8, this.mat('procFloor', { map: TX.floor(), color: 0xc8d8d8, roughness: 0.35 }), -4.5, 0.004, -5.4, { uv: [2, 2] });
    // door frame + sign
    const ef = this.mat('hElevFrame');
    this.bx(0.08, 2.44, 0.14, ef, -5.82, 1.22, BACK + 0.02);
    this.bx(0.08, 2.44, 0.14, ef, -3.18, 1.22, BACK + 0.02);
    this.bx(2.72, 0.08, 0.14, ef, -4.5, 2.42, BACK + 0.02);
    const ps = this.textSign('ПРОЦЕДУРНАЯ', { w: 1.3, h: 0.2 });
    ps.position.set(-4.5, 2.66, BACK + 0.03); root.add(ps);
    this.anchors.procedure = new THREE.Vector3(-4.5, 1.6, BACK + 0.1);
    this.anchors.examSpot = { x: -4.4, z: -5.6 };

    // exam table: padded vinyl top on a drawer base, paper roll
    const exam = new THREE.Group();
    this.box(1.8, 0.1, 0.7, this.mat('examTop', { color: 0x3a6a80, roughness: 0.55 }), 0, 0.85, 0, exam);
    this.box(1.7, 0.012, 0.5, this.mat('hPaperRoll', { color: 0xf4f4ee, roughness: 0.9 }), 0.05, 0.906, 0, exam);
    const head = this.box(0.5, 0.1, 0.7, this.mat('examTop'), -0.72, 0.95, 0, exam); head.rotation.z = -0.35;
    this.box(1.5, 0.75, 0.6, this.mat('hCabinetW', { color: 0xe4e6e2, roughness: 0.5 }), 0, 0.41, 0, exam);
    for (let i = 0; i < 3; i++) {
      this.box(0.44, 0.2, 0.01, this.mat('hDrawerFace', { color: 0xd4d8d6, roughness: 0.5 }), -0.48 + i * 0.48, 0.6, 0.305, exam);
      this.box(0.16, 0.02, 0.02, this.mat('steel'), -0.48 + i * 0.48, 0.65, 0.315, exam);
    }
    this.box(0.4, 0.08, 0.3, this.mat('hStep', { color: 0x30363c, roughness: 0.6 }), 0.4, 0.14, 0.45, exam);
    exam.position.set(-4.5, 0, -6.2); root.add(exam);
    this.colliders.push({ box: { minX: -5.4, maxX: -3.6, minZ: -6.55, maxZ: -5.85 } });
    // round stool where the patient sits for the exam
    this.cy(0.18, 0.18, 0.06, 14, this.mat('examTop'), -4.7, 0.47, -6.0);
    this.cy(0.02, 0.02, 0.44, 6, this.mat('steel'), -4.7, 0.22, -6.0);
    this.cy(0.2, 0.2, 0.02, 10, this.mat('steelDark'), -4.7, 0.02, -6.0);
    // upper cabinets with glass doors and bottles
    const cab = this.mat('hCabinetW');
    this.bx(1.5, 0.6, 0.03, cab, -4.85, 2.15, -6.73);
    for (const y of [1.86, 2.44]) this.bx(1.5, 0.03, 0.32, cab, -4.85, y, -6.6);
    for (const x of [-5.59, -4.85, -4.11]) this.bx(0.03, 0.6, 0.32, cab, x, 2.15, -6.6);
    this.bx(1.5, 0.3, 0.3, cab, -4.85, 0.45, -6.62);
    this.bx(1.52, 0.03, 0.34, this.mat('hWorkTop'), -4.85, 0.615, -6.6);
    this.box(0.7, 0.5, 0.01, this.mat('hGlass'), -5.22, 2.15, -6.43);
    this.box(0.7, 0.5, 0.01, this.mat('hGlass'), -4.48, 2.15, -6.43);
    const r = rng(19);
    for (let i = 0; i < 12; i++) {
      const x = -5.5 + i * 0.11 + r() * 0.02;
      const hh = 0.08 + r() * 0.1;
      this.cy(0.025, 0.025, hh, 8, this.matV('hBottles', { color: 0xffffff, roughness: 0.3 }), x, (i < 6 ? 1.875 : 2.165) + hh / 2, -6.6, { color: [0xd8a040, 0xe8e8e8, 0x6a9ad0, 0xa04020, 0xf0f0f0][(r() * 5) | 0] });
    }
    this.bx(1.4, 0.015, 0.28, cab, -4.85, 2.16, -6.58);
    // left wall: sharps, gloves, BP cuff; right wall: eye chart, instrument tray
    this.bx(0.14, 0.24, 0.22, this.mat('hSharps', { color: 0xe8c020, roughness: 0.5 }), -5.75, 1.25, -5.2);
    this.bx(0.02, 0.08, 0.2, this.mat('hSharpsLid', { color: 0xc02020, roughness: 0.5 }), -5.67, 1.38, -5.2);
    for (let i = 0; i < 3; i++) this.bx(0.08, 0.12, 0.24, this.matV('hGloves', { color: 0xffffff, roughness: 0.6 }), -5.76, 1.55 + i * 0.14, -4.75, { color: [0x6a8ae0, 0xa070d0, 0xe8e8e8][i] });
    this.bx(0.06, 0.2, 0.16, this.mat('hPlasticG'), -5.77, 1.5, -5.9);
    this.bx(0.02, 0.22, 0.05, this.mat('hBlack'), -5.74, 1.3, -5.86);
    this.pl(0.32, 0.54, this.texMat('hEye', TX.eyeChart()), -3.205, 1.6, -5.0, { ry: -Math.PI / 2 });
    this.sanitizer(-3.2, 1.25, -4.5, -Math.PI / 2);
    // mayo stand with instrument tray
    const steel = this.mat('steel');
    this.cy(0.015, 0.015, 0.9, 6, steel, -3.5, 0.45, -6.3);
    this.bx(0.5, 0.02, 0.34, steel, -3.65, 0.92, -6.2);
    for (let i = 0; i < 5; i++) this.bx(0.18, 0.008, 0.012, steel, -3.7 + (i % 2) * 0.05, 0.935, -6.32 + i * 0.05, { ry: 0.2 * i });
    this.bx(0.12, 0.03, 0.08, this.mat('hGauze', { color: 0xf4f6f6, roughness: 0.9 }), -3.5, 0.94, -6.1);
    this.cy(0.12, 0.1, 0.36, 10, this.mat('hBinPedal', { color: 0xd8dcd8, roughness: 0.5 }), -5.55, 0.18, -6.45);
    // examination lamp on an arm (the spot originates in its head)
    const arm = this.mat('hLampArm', { color: 0xe0e2e4, roughness: 0.4 });
    this.cy(0.025, 0.025, 1.4, 8, arm, -3.45, 0.7, -6.55);
    this.cy(0.22, 0.22, 0.03, 12, this.mat('steelDark'), -3.45, 0.02, -6.55);
    this.cy(0.016, 0.016, 0.9, 6, arm, -3.85, 1.6, -6.25, { rz: 1.0, ry: 0.6 });
    this.cy(0.13, 0.17, 0.12, 14, arm, -4.25, 1.85, -6.0);
    this.examBulb = this.mat('hExamBulb', { color: 0x000000, emissive: 0xfff4e0, emissiveIntensity: 3 });
    this.cy(0.14, 0.14, 0.01, 14, this.examBulb, -4.25, 1.785, -6.0);
    const exLamp = new THREE.SpotLight(0xfff6ea, 18, 4, 0.6, 0.5, 1.4);
    exLamp.position.set(-4.25, 1.9, -5.9); exLamp.target.position.set(-4.5, 0.8, -6.1);
    root.add(exLamp, exLamp.target);
    this.examLamp = exLamp;
    this.troffer(-4.5, -5.4, 'A', 1.2, 0.6);
  }

  buildSideCorridor() {
    const root = this.root;
    const scMat = this.mat('scWall', { map: TX.block(), color: 0xd4dcd6, roughness: 0.8 });
    const wains = this.mat('hWains');
    for (const x of [-1.05, 1.05]) {
      this.bx(0.1, H, 5.2, scMat, x, H / 2, -6.6, { uv: [2, 2] });
      const s = Math.sign(x);
      this.bx(0.03, 1.0, 5.2, wains, x - s * 0.065, 0.5, -6.6, { uv: [2, 1] });
      this.cy(0.03, 0.03, 5.0, 8, this.mat('hRail'), x - s * 0.13, 0.9, -6.6, { rx: Math.PI / 2 });
      this.bx(0.012, 0.06, 5.2, this.mat('hWallStripe'), x - s * 0.056, 1.32, -6.6);
    }
    this.bx(2.2, H, 0.1, scMat, 0, H / 2, -9.2, { uv: [2, 2] });
    this.bx(2.0, 0.04, 5.2, this.mat('procFloor'), 0, 0.004, -6.6, { uv: [2, 2] });
    // surgery double doors with porthole windows
    const dm = this.mat('hSurgDoor', { color: 0x7a90a0, roughness: 0.45 });
    for (const s of [-1, 1]) {
      this.bx(0.58, 2.1, 0.05, dm, s * 0.3, 1.05, -9.12);
      this.cy(0.11, 0.11, 0.02, 14, this.mat('hPorthole', { color: 0x000000, emissive: 0xcfe4f0, emissiveIntensity: 0.9 }), s * 0.3, 1.5, -9.09, { rx: Math.PI / 2 });
      this.bx(0.4, 0.3, 0.012, this.mat('steel'), s * 0.3, 0.2, -9.09);
    }
    this.bx(1.3, 0.08, 0.12, this.mat('hElevFrame'), 0, 2.14, -9.12);
    const sg = this.textSign('ХИРУРГИЯ · SURGERY', { w: 1.2, h: 0.18, bg: '#1a2026', fg: '#e8e8e0' });
    sg.position.set(0, 2.45, -9.13); root.add(sg);
    const sdoor = this.hDoor(0, -7.0, { sign: 'СЛУЖЕБНЫЙ', w: 0.9 });
    sdoor.position.x = 0.98; sdoor.rotation.y = -Math.PI / 2;
    this.troffer(0, -5.6, 'B');
    this.troffer(0, -8.0, 'A');
    this.anchors.sideCorridor = new THREE.Vector3(0, 1.8, -7.0);
    const arrow = this.textSign('← ТЕРАПИЯ   ХИРУРГИЯ ↑', { w: 2.0, h: 0.2, bg: '#0e3a5a', fg: '#f4f8fa' });
    arrow.position.set(0, 2.82, BACK + 0.03); root.add(arrow);
    // parked gurney along the left wall + a linen hamper at the far end
    const steel = this.mat('steel');
    this.bx(0.62, 0.1, 1.9, this.mat('hGurneyPad', { color: 0x2e5a6a, roughness: 0.6 }), -0.6, 0.78, -6.6);
    this.bx(0.6, 0.03, 1.75, this.mat('sheet'), -0.6, 0.845, -6.65);
    this.bx(0.5, 0.08, 0.36, this.mat('sheet'), -0.6, 0.88, -5.85);
    for (const z of [-5.75, -7.45]) {
      this.cy(0.02, 0.02, 0.66, 6, steel, -0.6, 0.38, z);
      this.cy(0.05, 0.05, 0.03, 8, this.mat('hBlack'), -0.6, 0.05, z, { rz: Math.PI / 2 });
    }
    this.bx(0.6, 0.03, 1.8, steel, -0.6, 0.3, -6.6);
    this.bx(0.03, 0.2, 1.4, steel, -0.29, 0.94, -6.6);
    this.colliders.push({ box: { minX: -0.95, maxX: -0.28, minZ: -7.6, maxZ: -5.6 } });
    this.linenCart(0.55, -8.55, root);
    this.colliders.push({ x: 0.55, z: -8.55, r: 0.35 });
  }

  buildNurseStation() {
    const root = this.root;
    const lam = this.mat('hLaminate');
    // counter: kick plate, laminate front, accent band, raised transaction ledge, work surface behind
    this.bx(3.6, 0.1, 0.04, this.mat('hSkirt'), 5, 0.05, -2.66);
    this.bx(3.6, 0.98, 0.04, lam, 5, 0.59, -2.68, { uv: [2, 1] });
    this.bx(3.62, 0.07, 0.02, this.mat('hAccent'), 5, 0.88, -2.655);
    this.bx(3.6, 1.05, 0.62, this.mat('hDeskBody'), 5, 0.52, -3.02);
    this.bx(3.76, 0.05, 0.36, this.mat('nsTop', { color: 0x3a6a82, roughness: 0.35 }), 5, 1.1, -2.78);
    this.bx(3.76, 0.04, 0.02, this.mat('hTopEdge', { color: 0x2a4a5a, roughness: 0.4 }), 5, 1.1, -2.6);
    this.bx(3.5, 0.04, 0.55, this.mat('hWorkTop'), 5, 0.8, -3.32);
    this.colliders.push({ box: { minX: 3.1, maxX: 6.9, minZ: -3.5, maxZ: -2.6 } });
    this.officeChair(4.2, -3.65, 0.3);
    this.officeChair(5.9, -3.7, -0.2);
    // monitors on arms with glowing EMR screens
    const scr = this.texMat('hEmr');
    this.nsScreens = [];
    for (const [x, ry] of [[4.0, 0.12], [5.25, -0.1]]) {
      this.bx(0.46, 0.32, 0.04, this.mat('monitorBody'), x, 1.36, -2.98, { ry });
      this.pl(0.42, 0.28, scr, x + Math.sin(ry) * 0.022, 1.36, -2.958, { ry });
      this.bx(0.05, 0.24, 0.05, this.mat('monitorBody'), x, 1.17, -3.02);
    }
    this.screenGlow = [];
    for (const x of [4.0, 5.25]) { const g = glow(0x6aa8e8, 0.7, 0.0); g.position.set(x, 1.36, -2.85); root.add(g); this.screenGlow.push(g); }
    // on the ledge: folders, phone, mug, pen cup, sign-in clipboard, glove box
    const r = rng(29);
    for (let i = 0; i < 6; i++) this.bx(0.3, 0.018, 0.23, this.matV('hFolder', { color: 0xffffff, roughness: 0.8 }), 3.45 + (i % 2) * 0.02, 1.135 + i * 0.019, -2.8, { ry: (r() - 0.5) * 0.2, color: [0xe8d8a0, 0xd8c890, 0x8ab0d8, 0xe8d8a0, 0xd88a8a, 0xf0e8d0][i] });
    this.bx(0.2, 0.06, 0.16, this.mat('hPhone', { color: 0x2a2c30, roughness: 0.5 }), 4.65, 1.155, -2.82);
    this.bx(0.18, 0.04, 0.05, this.mat('hPhone'), 4.65, 1.2, -2.86, { rz: 0.05 });
    this.bx(0.02, 0.01, 0.02, this.mat('hLedRed'), 4.72, 1.19, -2.75);
    this.cy(0.04, 0.035, 0.1, 10, this.mat('hMug', { color: 0xb83030, roughness: 0.5 }), 6.55, 1.18, -2.8);
    this.cy(0.035, 0.035, 0.1, 8, this.mat('hBlack'), 6.75, 1.18, -2.85);
    for (let i = 0; i < 4; i++) this.cy(0.004, 0.004, 0.14, 4, this.matV('hPens', { color: 0xffffff }), 6.74 + (i % 2) * 0.02, 1.25, -2.85 + (i >> 1) * 0.02, { rz: (i - 1.5) * 0.12, color: [0x2040c0, 0x101010, 0xc02020, 0x2040c0][i] });
    this.bx(0.24, 0.012, 0.32, this.mat('hClipboard', { color: 0x8a6a40, roughness: 0.6 }), 5.85, 1.13, -2.77, { ry: 0.2 });
    this.bx(0.2, 0.004, 0.26, this.mat('hPaper', { color: 0xf4f4ee, roughness: 0.9 }), 5.85, 1.138, -2.76, { ry: 0.2 });
    this.bx(0.24, 0.09, 0.12, this.mat('hGloveBox', { color: 0x6a8ae0, roughness: 0.6 }), 3.2, 1.17, -2.82);
    // banker's desk lamp (the warm night light at the station)
    const dl = new THREE.Group();
    const brass = this.mat('hBrass', { color: 0xb08a40, metalness: 0.7, roughness: 0.35 });
    this.box(0.18, 0.025, 0.12, brass, 0, 0.012, 0, dl);
    this.box(0.025, 0.32, 0.025, brass, 0, 0.17, 0, dl);
    const dlShade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, 0.1, 14, 1, true, 0, Math.PI * 2), this.mat('dlShade', { color: 0x1e6a40, emissive: 0x0a3a18, roughness: 0.3, side: THREE.DoubleSide }));
    dlShade.position.y = 0.36; dl.add(dlShade);
    this.dlBulb = this.mat('hDlBulb', { color: 0x000000, emissive: 0xffd8a0, emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), this.dlBulb); bulb.position.y = 0.32; dl.add(bulb);
    dl.position.set(6.2, 1.125, -2.85); root.add(dl);
    this.deskLamp = new THREE.PointLight(0xffc888, 0, 4.5, 1.5);
    this.deskLamp.position.set(6.2, 1.5, -2.7); root.add(this.deskLamp);
    this.deskGlow = glow(0xffb870, 1.2, 0.0); this.deskGlow.position.set(6.2, 1.45, -2.75); root.add(this.deskGlow);
    this.deskPool = this.pool(0xffb070, 6.0, -2.0, 2.6, 1.8, 0.0);
    this.anchors.nurseStation = new THREE.Vector3(5, 1.6, -3.0);
    this.anchors.doctorsTalk = { x: 3.4, z: -1.8 };

    // back wall: call-light board, census screen, whiteboard, binders, chart rack, clock
    const nss = this.textSign('ПОСТ МЕДСЕСТРЫ · NURSE STATION', { w: 2.8, h: 0.24, bg: '#e8eef2', fg: '#0e3a5a' });
    nss.position.set(5, 2.72, BACK + 0.03); root.add(nss);
    this.bx(0.98, 0.33, 0.05, this.mat('hBlack'), 3.85, 2.18, BACK + 0.025);
    this.pl(0.94, 0.29, this.texMat('hAnnun', TX.annunciator()), 3.85, 2.18, BACK + 0.051);
    this.callLamps = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x101010, emissive: [0x40ff60, 0xffc040, 0xff3030][i % 3], emissiveIntensity: 0 });
      const l = this.box(0.09, 0.09, 0.02, m, 3.85 - 0.47 + (7.5 + i * 13) / 80 * 0.94, 2.225, BACK + 0.06);
      this.callLamps.push(l);
    }
    this.bx(1.02, 0.6, 0.04, this.mat('monitorBody'), 6.35, 2.02, BACK + 0.02);
    this.statusMat = this.texMat('hStatus', TX.status(), { basic: true, emissive: 1.2 });
    this.pl(0.96, 0.54, this.statusMat, 6.35, 2.02, BACK + 0.042);
    this.framed(TX.whiteboard(), 1.0, 0.6, 5.0, 1.72, BACK + 0.02, 0xb8bcc0);
    const binders = this.texMat('hBinders');
    this.bx(1.2, 0.03, 0.28, this.mat('hShelf'), 3.85, 1.55, BACK + 0.14);
    this.pl(1.15, 0.28, binders, 3.85, 1.71, BACK + 0.25);
    // chart rack: slots of coloured patient charts
    this.bx(0.5, 0.62, 0.22, this.mat('hRack', { color: 0x9aa4ac, metalness: 0.4, roughness: 0.4 }), 6.65, 1.25, BACK + 0.12);
    for (let i = 0; i < 6; i++) this.bx(0.44, 0.06, 0.2, this.matV('hCharts', { color: 0xffffff, roughness: 0.6 }), 6.65, 1.0 + i * 0.1, BACK + 0.14, { rx: -0.2, color: [0x2a6ab0, 0xc03030, 0x3a9a5a, 0xe0b020, 0x2a6ab0, 0x8a5aa0][i] });
    this.clock(2.1, 2.3, BACK + 0.02, 'station');
    // crash cart + defib next to the station
    this.crashCart(2.05, -3.62);
    this.sanitizer(1.35, 1.25);
  }

  /** Corridor between the station and the wards, the staff door and the far end. */
  buildStretch() {
    const root = this.root;
    this.medCart(7.75, -3.65);
    this.framed(TX.poster('flu'), 0.32, 0.44, 7.35, 1.75);
    this.framed(TX.poster('hands'), 0.32, 0.44, 7.85, 1.75);
    this.framed(TX.poster('quiet'), 0.32, 0.44, 8.35, 1.75);
    this.sanitizer(8.8, 1.25);
    // fire extinguisher on a bracket + pull station
    const red = this.mat('hFireRed');
    this.cy(0.075, 0.075, 0.45, 10, red, 13.45, 0.85, BACK + 0.1);
    this.bx(0.06, 0.08, 0.06, this.mat('hBlack'), 13.45, 1.12, BACK + 0.1);
    this.bx(0.18, 0.04, 0.12, this.mat('steelDark'), 13.45, 0.6, BACK + 0.07);
    this.pl(0.18, 0.18, this.texMat('hFireTxt'), 13.45, 1.45, BACK + 0.01);
    this.bx(0.11, 0.15, 0.05, red, 13.85, 1.22, BACK + 0.025);
    this.hDoor(14.5, BACK + 0.02, { sign: 'ТОЛЬКО ПЕРСОНАЛ', w: 0.9, color: 0x6a7480 });
    this.bx(0.14, 0.2, 0.04, this.mat('hKeypad', { color: 0x30343a, roughness: 0.5 }), 15.22, 1.25, BACK + 0.02);
    this.bx(0.02, 0.02, 0.01, this.mat('hLedRed'), 15.22, 1.33, BACK + 0.045);
    this.framed(TX.print('river'), 0.5, 0.36, 15.66, 1.8, BACK + 0.02, 0xc8ccd0);
    this.framed(TX.print('lake'), 0.62, 0.42, 22.0, 1.8, BACK + 0.02, 0xc8ccd0);
    // radiator under the end of the corridor + a tall plant
    this.radiator(22.0, 0.45, BACK + 0.08, 1.2);
    this.plant(22.6, BACK + 0.4, root, 1.6, 7);
    this.plant(-22.3, BACK + 0.4, root, 1.5, 8);
  }

  buildSignage() {
    const root = this.root;
    // exit signs (green) above doors + glow
    this.exitSigns = [];
    this.exitGlows = [];
    for (const x of [-20.4, -9.3, 14.5]) {
      const s = this.textSign('ВЫХОД · EXIT', { w: 0.7, h: 0.16, bg: '#0a6a2a', fg: '#e8ffe8', emissive: 1.6 });
      s.position.set(x, 2.95, BACK + 0.05); root.add(s);
      this.bx(0.74, 0.2, 0.04, this.mat('hPlasticW'), x, 2.95, BACK + 0.025);
      this.exitSigns.push(s);
      const g = glow(0x30ff70, 1.1, 0.0); g.position.set(x, 2.95, BACK + 0.2); root.add(g); this.exitGlows.push(g);
    }
    // ceiling-hung directional signs (double-sided)
    const hang = (text, x) => {
      const s = this.textSign(text, { w: 1.7, h: 0.22, bg: '#0e3a5a', fg: '#f4f8fa' });
      s.position.set(x, 2.72, -2.3); root.add(s);
      const b = s.clone(); b.rotation.y = Math.PI; b.position.z -= 0.01; root.add(b);
      for (const s2 of [-0.7, 0.7]) this.cy(0.006, 0.006, 0.26, 4, this.mat('steel'), x + s2, H - 0.13, -2.3);
    };
    hang('← РЕГИСТРАТУРА · ЛИФТ', -7.0);
    hang('ПАЛАТЫ 101–115 →', 7.8);
    // paper snowflakes taped to the ward glass (winter craft)
    const flake = this.texMat('hFlake', TX.snowflake(), { transparent: true });
    for (const [x, y, s] of [[12.6, 2.25, 0.2], [12.25, 2.0, 0.14], [11.75, 2.32, 0.16], [20.6, 2.25, 0.2], [20.25, 2.05, 0.14], [17.9, 2.3, 0.15]]) this.pl(s, s, flake, x, y, BACK + 0.025);
  }

  buildLights() {
    const root = this.root;
    // corridor wash: five points instead of a spot per fixture
    this.corrLights = [];
    for (const [x, z] of [[-16, -1.6], [-8, -1.6], [-0.5, -2.2], [5.5, -1.6], [14.5, -1.6]]) {
      const l = new THREE.PointLight(0xe4eeff, 7, 11, 1.2);
      l.position.set(x, 2.75, z); root.add(l);
      this.corrLights.push(l);
    }
    this.flickLight = this.corrLights[1];
    const hemi = new THREE.HemisphereLight(0xd0dce8, 0x30383a, 1.2);
    root.add(hemi);
    this.lights.hemi = hemi;
    // floor-level night lights (amber) with their pools
    this.nightLamps = [];
    const nlm = this.mat('hNightLamp', { color: 0x201810, emissive: 0xffb050, emissiveIntensity: 0 });
    this.nightLampMat = nlm;
    for (const x of [-13.6, -2.4, 8.6, 15.6]) {
      this.bx(0.16, 0.08, 0.03, this.mat('hPlasticW'), x, 0.42, BACK + 0.04);
      this.bx(0.12, 0.04, 0.02, nlm, x, 0.42, BACK + 0.06);
      this.nightLamps.push(this.pool(0xffa050, x, BACK + 0.7, 1.4, 1.3, 0.0));
    }
  }

  buildForeground() {
    const root = this.root;
    const fg = (x, z, name, build) => {
      const g = new THREE.Group(); g.name = name; build(g); g.position.set(x, 0, z); root.add(g); this.foregroundGroups.push(g);
    };
    fg(-15.5, 3.0, 'fg-wheelchair', (g) => { const w = this.wheelchair(); w.rotation.y = 0.5; g.add(w); });
    fg(-6.5, 3.2, 'fg-trolley', (g) => this.cleaningTrolley(g));
    fg(2.0, 3.4, 'fg-plant', (g) => this.plant(0, 0, g, 1.8, 11));
    fg(12.0, 3.1, 'fg-chairs', (g) => {
      const seat = this.mat('plasticChairH', { color: 0x3a7a86, roughness: 0.55 });
      const steel = this.mat('steel');
      for (let i = 0; i < 3; i++) {
        this.box(0.5, 0.07, 0.46, seat, i * 0.56, 0.46, 0, g);
        const back = this.box(0.5, 0.45, 0.05, seat, i * 0.56, 0.72, 0.22, g); back.rotation.x = 0.1;
        this.box(0.04, 0.04, 0.4, steel, i * 0.56 + 0.27, 0.62, 0.02, g);
      }
      this.box(1.7, 0.04, 0.04, steel, 0.56, 0.4, 0, g);
      for (const x of [0, 1.12]) { this.box(0.04, 0.4, 0.04, steel, x, 0.2, -0.15, g); this.box(0.04, 0.4, 0.04, steel, x, 0.2, 0.15, g); }
      const coat = this.box(0.42, 0.06, 0.4, this.mat('hParka', { color: 0x6a3a1e, roughness: 0.9 }), 1.12, 0.52, -0.02, g); coat.rotation.z = 0.05;
      this.box(0.4, 0.4, 0.06, this.mat('hParka'), 1.12, 0.72, 0.2, g).rotation.x = 0.15;
    });
    fg(-13.6, 3.0, 'fg-ivpole', (g) => {
      const iv = new THREE.Group();
      const steel = this.mat('steel');
      this.box(0.025, 1.9, 0.025, steel, 0, 0.95, 0, iv);
      this.box(0.4, 0.02, 0.02, steel, 0, 1.88, 0, iv);
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const leg = this.box(0.28, 0.02, 0.02, steel, Math.cos(a) * 0.12, 0.05, -Math.sin(a) * 0.12, iv); leg.rotation.y = a; }
      this.box(0.14, 0.22, 0.04, this.mat('hSaline', { color: 0xdde8f0, transparent: true, opacity: 0.7, roughness: 0.2 }), 0.16, 1.68, 0, iv);
      g.add(iv);
    });
    fg(16.0, 3.2, 'fg-linen', (g) => this.linenCart(0, 0, g));
  }

  // ---------------------------------------------------------------- reusable props

  hDoor(x, z, { w = 1.0, h = 2.15, color = 0x6a7480, sign, push = false } = {}) {
    const g = new THREE.Group();
    const frameMat = this.mat('hDoorFrame', { color: 0x4a5258, roughness: 0.45, metalness: 0.3 });
    this.box(w + 0.16, 0.08, 0.14, frameMat, 0, h + 0.04, 0, g);
    this.box(0.08, h, 0.14, frameMat, -w / 2 - 0.04, h / 2, 0, g);
    this.box(0.08, h, 0.14, frameMat, w / 2 + 0.04, h / 2, 0, g);
    const leafMat = push ? this.mat(`hDoorPaint-${color}`, { color, roughness: 0.5 }) : this.mat('hVeneer', { map: TX.veneer(), color: 0xffffff, roughness: 0.55 });
    const leaf = this.box(w, h, 0.05, leafMat, 0, h / 2, -0.02, g);
    this.box(w * 0.28, h * 0.32, 0.06, this.mat('doorGlass'), w * 0.18, h * 0.66, -0.015, g);
    this.box(w, 0.25, 0.055, this.mat('steel'), 0, 0.13, -0.015, g);
    if (push) this.box(w * 0.8, 0.06, 0.08, this.mat('steel'), 0, h * 0.47, 0.03, g);
    else this.box(0.14, 0.025, 0.06, this.mat('steel'), w * 0.36, h * 0.47, 0.04, g);
    if (sign) {
      const s = this.textSign(sign, { w: Math.max(0.6, sign.length * 0.07), h: 0.18, bg: '#1a2026', fg: '#e8e8e0' });
      s.position.set(0, h + 0.28, 0.02); g.add(s);
    }
    g.position.set(x, 0, z);
    g.userData.leaf = leaf;
    this.root.add(g);
    return g;
  }

  clock(x, y, z, key) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), this.mat('hClockFace', { color: 0xf4f4ee, roughness: 0.5 }));
    face.rotation.x = Math.PI / 2; face.position.set(x, y, z + 0.02); this.root.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 6, 20), this.mat('hBlack'));
    rim.position.set(x, y, z + 0.04); this.root.add(rim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; this.bx(0.012, 0.03, 0.005, this.mat('hBlack'), x + Math.sin(a) * 0.14, y + Math.cos(a) * 0.14, z + 0.043, { rz: -a }); }
    const handM = this.mat('hBlack');
    const mk = (len, wd) => { const p = new THREE.Group(); const m = new THREE.Mesh(bevelBox(wd, len, 0.006), handM); m.position.y = len / 2 - 0.02; p.add(m); p.position.set(x, y, z + 0.05); this.root.add(p); return p; };
    this.clocks = this.clocks || [];
    this.clocks.push({ hour: mk(0.09, 0.016), min: mk(0.13, 0.01) });
  }
  setClocks(h, m) {
    for (const c of this.clocks || []) {
      c.min.rotation.z = -(m / 60) * Math.PI * 2;
      c.hour.rotation.z = -((h % 12) / 12 + m / 720) * Math.PI * 2;
    }
  }

  payPhone(x, y) {
    const steel = this.mat('steel');
    this.bx(0.5, 0.75, 0.04, this.mat('hPhoneHood', { color: 0x9aa0a8, metalness: 0.5, roughness: 0.4 }), x, y + 0.05, BACK + 0.02);
    this.bx(0.26, 0.44, 0.12, steel, x, y, BACK + 0.08);
    this.bx(0.06, 0.24, 0.06, this.mat('hBlack'), x - 0.1, y + 0.02, BACK + 0.16);
    for (let i = 0; i < 12; i++) this.bx(0.025, 0.02, 0.01, this.mat('hPlasticG'), x + 0.02 + (i % 3) * 0.04, y + 0.05 - (i / 3 | 0) * 0.035, BACK + 0.145);
    this.bx(0.14, 0.04, 0.01, this.mat('hLcd', { color: 0x000000, emissive: 0x80c070, emissiveIntensity: 0.6 }), x + 0.06, y + 0.15, BACK + 0.145);
    this.bx(0.45, 0.03, 0.25, steel, x, y - 0.33, BACK + 0.13);
    this.bx(0.3, 0.05, 0.22, this.mat('hPhoneBook', { color: 0xd8c040, roughness: 0.8 }), x + 0.05, y - 0.29, BACK + 0.13);
  }

  wheelchair() {
    const g = new THREE.Group();
    const steel = this.mat('steel');
    const black = this.mat('hTyre', { color: 0x141618, roughness: 0.7 });
    const seat = this.mat('wcSeat', { color: 0x1a2a3a, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), black); w.position.set(0, 0.32, s * 0.28); g.add(w);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.008, 4, 20), steel); rim.position.set(0, 0.32, s * 0.3); g.add(rim);
      for (let k = 0; k < 3; k++) { const sp = this.box(0.5, 0.008, 0.008, steel, 0, 0.32, s * 0.28, g); sp.rotation.z = (k / 3) * Math.PI; }
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 4, 10), black); c.position.set(0.38, 0.07, s * 0.22); g.add(c);
      this.box(0.04, 0.6, 0.03, steel, -0.2, 0.75, s * 0.22, g);
      this.box(0.45, 0.03, 0.03, steel, 0.05, 0.7, s * 0.24, g);
      this.box(0.03, 0.42, 0.03, steel, 0.3, 0.3, s * 0.2, g).rotation.z = 0.3;
      this.box(0.12, 0.03, 0.03, steel, -0.26, 1.04, s * 0.22, g);
    }
    this.box(0.45, 0.05, 0.46, seat, 0.05, 0.5, 0, g);
    this.box(0.04, 0.42, 0.46, seat, -0.2, 0.78, 0, g);
    this.box(0.12, 0.02, 0.4, this.mat('hBlack'), 0.42, 0.12, 0, g);
    return g;
  }

  linenCart(x, z, parent) {
    const g = new THREE.Group();
    const steel = this.mat('steel');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.025, 0.95, 0.025, steel, sx * 0.3, 0.5, sz * 0.22, g);
    this.box(0.62, 0.025, 0.46, steel, 0, 0.95, 0, g);
    const bag = this.box(0.56, 0.62, 0.42, this.mat('hLinenBag', { map: TX.blanket(), color: 0x6a8ac0, roughness: 0.9 }), 0, 0.6, 0, g);
    bag.scale.set(1, 1, 1);
    this.box(0.4, 0.12, 0.3, this.mat('sheet'), 0.04, 0.98, 0, g).rotation.z = 0.15;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.05, 0.06, 0.03, this.mat('hBlack'), sx * 0.3, 0.03, sz * 0.22, g);
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  cleaningTrolley(g) {
    const grey = this.mat('hTrolley', { color: 0x4a5058, roughness: 0.6 });
    const yellow = this.mat('hYellow', { color: 0xe8c020, roughness: 0.5 });
    this.box(0.9, 0.05, 0.45, grey, 0, 0.18, 0, g);
    this.box(0.04, 1.0, 0.45, grey, -0.43, 0.6, 0, g);
    this.box(0.5, 0.03, 0.4, grey, -0.18, 0.85, 0, g);
    this.box(0.04, 0.04, 0.45, this.mat('steel'), -0.47, 1.05, 0, g);
    this.box(0.36, 0.32, 0.36, yellow, 0.2, 0.36, 0, g);
    this.box(0.3, 0.02, 0.3, this.mat('hDirtyWater', { color: 0x5a6a5a, roughness: 0.1 }), 0.2, 0.5, 0, g);
    this.box(0.12, 0.2, 0.2, yellow, 0.42, 0.62, 0, g);
    const mop = this.box(0.025, 1.3, 0.025, this.mat('hMopHandle', { color: 0x3060a0, roughness: 0.4 }), 0.25, 0.85, 0.05, g); mop.rotation.z = -0.2;
    this.box(0.2, 0.36, 0.38, this.mat('hTrashBag', { color: 0x16181a, roughness: 0.4 }), -0.25, 0.42, 0, g);
    for (let i = 0; i < 3; i++) this.box(0.06, 0.16, 0.06, this.mat(`hSpray-${i}`, { color: [0x40a0e0, 0xe04060, 0x60c060][i], roughness: 0.3 }), -0.32 + i * 0.09, 0.95, 0.05, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.05, 0.08, 0.03, this.mat('hBlack'), sx * 0.4, 0.06, sz * 0.18, g);
    // wet floor sign (A-frame) beside it
    const wf = this.texMat('hWetFloor', TX.wetFloor());
    for (const s of [-1, 1]) { const p = this.box(0.3, 0.62, 0.012, wf, 0.85, 0.3, s * 0.08, g); p.rotation.x = s * 0.18; }
  }

  crashCart(x, z) {
    const red = this.mat('hCrashRed', { color: 0xc02424, roughness: 0.45 });
    this.bx(0.62, 0.95, 0.5, red, x, 0.55, z);
    for (let i = 0; i < 5; i++) {
      this.bx(0.58, 0.012, 0.01, this.mat('hBlack'), x, 0.2 + i * 0.17, z + 0.252);
      this.bx(0.3, 0.025, 0.02, this.mat('hPlasticW'), x, 0.28 + i * 0.17, z + 0.26);
    }
    this.bx(0.66, 0.04, 0.54, this.mat('hPlasticG'), x, 1.04, z);
    this.bx(0.36, 0.22, 0.26, this.mat('hDefib', { color: 0x30363c, roughness: 0.5 }), x - 0.08, 1.17, z);
    this.bx(0.14, 0.09, 0.01, this.mat('hDefibScr', { color: 0x000000, emissive: 0x40e070, emissiveIntensity: 1.0 }), x - 0.12, 1.21, z + 0.131);
    this.bx(0.06, 0.06, 0.01, this.mat('hYellow'), x + 0.03, 1.2, z + 0.131);
    this.cy(0.05, 0.05, 0.6, 10, this.mat('hO2', { color: 0x2a8a4a, roughness: 0.4 }), x + 0.36, 0.7, z);
    this.cy(0.02, 0.02, 0.08, 6, this.mat('steel'), x + 0.36, 1.04, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.bx(0.06, 0.08, 0.04, this.mat('hBlack'), x + sx * 0.26, 0.04, z + sz * 0.2);
  }

  medCart(x, z) {
    const blue = this.mat('hMedBlue', { color: 0x3a6aa0, roughness: 0.45 });
    this.bx(0.7, 0.9, 0.5, this.mat('hPlasticW'), x, 0.52, z);
    for (let i = 0; i < 4; i++) {
      this.bx(0.64, 0.19, 0.01, blue, x, 0.2 + i * 0.21, z + 0.255);
      this.bx(0.22, 0.02, 0.02, this.mat('hPlasticG'), x, 0.27 + i * 0.21, z + 0.265);
    }
    this.bx(0.74, 0.03, 0.54, this.mat('hPlasticG'), x, 0.985, z);
    this.bx(0.36, 0.02, 0.26, this.mat('monitorBody'), x - 0.05, 1.01, z);
    this.bx(0.36, 0.24, 0.02, this.mat('monitorBody'), x - 0.05, 1.13, z - 0.13, { rx: -0.3 });
    this.bx(0.33, 0.2, 0.005, this.texMat('hEmr'), x - 0.05, 1.135, z - 0.115, { rx: -0.3 });
    this.bx(0.12, 0.1, 0.12, this.mat('hSharps'), x + 0.26, 1.05, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.bx(0.06, 0.08, 0.04, this.mat('hBlack'), x + sx * 0.3, 0.04, z + sz * 0.2);
  }

  radiator(x, y, z, w) {
    const m = this.mat('hRadiator', { color: 0xe4e4dc, roughness: 0.5 });
    const n = Math.round(w / 0.07);
    for (let i = 0; i < n; i++) this.bx(0.045, 0.6, 0.1, m, x - w / 2 + (i + 0.5) * (w / n), y, z);
    this.bx(w, 0.04, 0.06, m, x, y - 0.26, z);
    this.cy(0.015, 0.015, y - 0.3, 6, this.mat('steel'), x - w / 2 - 0.05, (y - 0.3) / 2, z);
  }

  plant(x, z, parent, height = 1.6, seed = 7) {
    const g = new THREE.Group();
    this.box(0.4, 0.42, 0.4, this.mat('potH', { color: 0x9a9890, roughness: 0.7 }), 0, 0.21, 0, g);
    this.box(0.36, 0.02, 0.36, this.mat('hSoil', { color: 0x2a1e14, roughness: 1 }), 0, 0.42, 0, g);
    this.box(0.03, height * 0.6, 0.03, this.mat('hTrunk', { color: 0x4a3a28, roughness: 0.9 }), 0, 0.42 + height * 0.3, 0, g);
    const r = rng(seed);
    const n = this.low ? 16 : 34;
    const leafGeo = new THREE.IcosahedronGeometry(0.1, 0);
    const leaves = new THREE.InstancedMesh(leafGeo, this.mat('plantH', { color: 0xffffff, roughness: 0.85 }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const t = r();
      const y = 0.6 + t * (height - 0.5);
      const rad = 0.12 + Math.sin(t * Math.PI) * 0.32;
      const a = r() * Math.PI * 2;
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
      const s = 0.7 + r() * 0.8;
      m4.compose(new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.8), q, new THREE.Vector3(s * 1.3, s * 0.5, s));
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, c.setHSL(0.3 + r() * 0.06, 0.45, 0.16 + r() * 0.12));
    }
    g.add(leaves);
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }

  /** A ward behind a glass front: bed, monitor, IV, window, chair, sink. */
  buildWard(x0, x1, number, { patient = false, window = false } = {}) {
    const root = this.root;
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = 3.6, zb = BACK - depth;
    const wm = this.mat(`ward-${number}`, { map: TX.block(), color: patient ? 0xf0e0cc : 0xdce8e0, roughness: 0.8 });
    const bedX = cx + 0.45, bedZ = BACK - 2.0;
    const winX = cx + 0.6, winW = 1.6, winY0 = 1.05, winY1 = 2.35;
    // back wall (with a real window opening), side walls
    if (window) {
      this.wall(x0, x1, H, zb + 0.05, wm, [{ x0: winX - winW / 2, x1: winX + winW / 2, y0: winY0, y1: winY1 }]);
      this.box(w, H, 0.1, this.mat('hWardBackOuter', { color: 0x0a0c0e }), cx, H / 2, zb - 3.4);   // behind the (deepened) view
    } else this.bx(w, H, 0.1, wm, cx, H / 2, zb, { uv: [2, 2] });
    this.bx(0.1, H, depth, wm, x0, H / 2, BACK - depth / 2, { uv: [2, 2] });
    this.bx(0.1, H, depth, wm, x1, H / 2, BACK - depth / 2, { uv: [2, 2] });
    this.bx(w, 0.04, depth, this.mat(`wardFloor-${number}`, { map: TX.floor(), color: patient ? 0xd8d0c4 : 0xc8d4d0, roughness: 0.35 }), cx, 0.005, BACK - depth / 2, { uv: [2, 2] });
    // inner wainscot + bumper on the back wall
    this.bx(w - 0.1, 0.9, 0.02, this.mat('hWains'), cx, 0.45, zb + 0.06, { uv: [2, 1] });
    this.bx(w - 0.1, 0.08, 0.04, this.mat('hRail'), cx, 0.92, zb + 0.08);
    this.bx(w - 0.1, 0.1, 0.03, this.mat('hSkirt'), cx, 0.05, zb + 0.08);

    // glass front: low wall + glass panes, a door gap at the left
    const doorX0 = x0 + 0.4, doorX1 = x0 + 1.45;
    const glassMat = this.mat('wardGlass', { color: 0xc8dce8, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const lowM = this.mat('wardLow', { map: TX.wainscot(), color: 0xffffff, roughness: 0.55 });
    this.bx(x1 - doorX1, 0.22, 0.08, lowM, (doorX1 + x1) / 2, 0.11, BACK, { uv: [2, 1] });
    this.box(x1 - doorX1, 2.38, 0.03, glassMat, (doorX1 + x1) / 2, 1.41, BACK);
    // no mullions across the pane: they would cut through the bed (a story point)
    const alu = this.mat('wardFrame', { color: 0xb8c0c4, metalness: 0.4, roughness: 0.35 });
    this.bx(0.4, 2.6, 0.08, lowM, x0 + 0.2, 1.3, BACK, { uv: [2, 1] });
    this.bx(x1 - x0, 0.1, 0.1, alu, cx, 2.6, BACK);
    this.bx(x1 - doorX1, 0.04, 0.1, alu, (doorX1 + x1) / 2, 0.24, BACK);
    this.bx(0.05, 2.6, 0.1, alu, doorX1 + 0.02, 1.3, BACK);
    this.bx(0.05, 2.6, 0.1, alu, x1 - 0.03, 1.3, BACK);
    this.bx(0.04, 2.25, 0.1, alu, doorX0 + 0.01, 1.12, BACK);
    this.bx(doorX1 - doorX0, 0.06, 0.1, alu, (doorX0 + doorX1) / 2, 2.22, BACK);
    // glare streaks at the right edge of the pane (away from the bed)
    this.pl(0.5, 1.2, this.mat('hGlare', { color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false, roughness: 0.1 }), x1 - 0.45, 1.9, BACK + 0.02, { rz: 0.5 });
    // blinds on the glass (top band)
    const bl = this.plane(x1 - doorX1, 0.5, this.texMat('hBlindsF', tiled(TX.blinds(), 8, 4), { transparent: true }), (doorX1 + x1) / 2, 2.3, BACK + 0.03);
    bl.renderOrder = 1;
    // pillar: plaque, sanitizer, name slot
    this.pl(0.24, 0.09, this.texMat(`hPlaque-${number}`, TX.plaque(number)), x0 + 0.2, 1.62, BACK + 0.045);
    this.bx(0.26, 0.08, 0.01, this.mat('hPaper'), x0 + 0.2, 1.48, BACK + 0.045);
    this.sanitizer(x0 + 0.2, 1.2, BACK + 0.04);
    // door leaf (swings open into the room): veneer, vision panel, kick plate, lever
    const hinge = new THREE.Group();
    hinge.position.set(doorX0, 0, BACK);
    const dw = doorX1 - doorX0;
    const leaf = this.box(dw, 2.2, 0.05, this.mat(`wardDoor-${number}`, { map: TX.veneer(), color: 0xf0f0f0, roughness: 0.5 }), dw / 2, 1.1, 0, hinge);
    this.box(0.18, 0.7, 0.06, this.mat('doorGlass'), dw * 0.72, 1.45, 0.0, hinge);
    this.box(dw, 0.24, 0.056, this.mat('steel'), dw / 2, 0.12, 0, hinge);
    this.box(0.16, 0.025, 0.08, this.mat('steel'), dw - 0.12, 1.02, 0.03, hinge);
    root.add(hinge);
    const num = this.textSign(`ПАЛАТА ${number}`, { w: 0.9, h: 0.18 });
    num.position.set(x0 + 0.92, 2.78, BACK + 0.03); root.add(num);

    // bed, monitor (on a wall arm), IV, cabinet, chair, sink
    const bed = this.bed(bedX, bedZ);
    const black = this.mat('hBlack');
    for (const sx of [-0.95, 0.95]) for (const sz of [-0.4, 0.4]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), black); wh.rotation.x = Math.PI / 2; wh.position.set(sx, 0.05, sz); bed.add(wh); }
    this.box(0.04, 0.3, 0.24, this.mat('hClipboard'), 1.06, 0.72, 0.15, bed);
    this.box(0.01, 0.26, 0.2, this.mat('hPaper'), 1.085, 0.72, 0.15, bed);
    this.box(0.3, 0.1, 0.86, this.mat(patient ? 'hKnit' : 'blanket', patient ? { map: TX.knit(), color: 0xffffff, roughness: 0.95 } : {}), 0.78, 0.8, 0, bed);
    const mon = this.monitor(bedX - 1.45, 1.45, BACK - 2.9);
    this.bx(0.06, 0.06, 0.6, this.mat('steelDark'), bedX - 1.45, 1.45, (zb + BACK - 3.0) / 2 + 0.03);
    const iv = this.ivStand(bedX - 1.25, BACK - 1.3, patient ? 0x8a0010 : 0xdde8f0);
    if (patient) {
      // the blood bag must read from the corridor: a deeper glow, hidden together with the bag
      const bag = iv.userData.bag;
      bag.material.emissive.set(0x5a0008);
      const bg = glow(0xff2030, 0.42, 0.35);
      bg.position.z = 0.04; bag.add(bg);
    }
    // headwall trunking with gas outlets (O2 green, air, vacuum yellow), call button
    const tx0 = x0 + 0.2, tx1 = window ? winX - winW / 2 - 0.12 : cx + 0.3;
    this.bx(tx1 - tx0, 0.2, 0.06, this.mat('hTrunk2', { color: 0xe8ecec, roughness: 0.5 }), (tx0 + tx1) / 2, 1.2, zb + 0.08);
    this.bx(tx1 - tx0, 0.02, 0.065, this.mat('hAccent'), (tx0 + tx1) / 2, 1.3, zb + 0.08);
    const outlets = [[0x2a9a4a], [0x202020], [0xe8c020], [0xe8e8e8]];
    outlets.forEach(([c], i) => this.cy(0.035, 0.035, 0.03, 10, this.mat(`hOutlet-${c}`, { color: c, roughness: 0.4 }), tx0 + 0.2 + i * 0.13, 1.18, zb + 0.12, { rx: Math.PI / 2 }));
    this.cy(0.02, 0.02, 0.02, 8, this.mat('hCallBtn', { color: 0xc02020, emissive: 0x400000 }), tx1 - 0.15, 1.18, zb + 0.12, { rx: Math.PI / 2 });
    this.bx(0.07, 0.12, 0.05, this.mat('hFlowmeter', { color: 0xdfe8ee, transparent: true, opacity: 0.7 }), tx0 + 0.2, 1.06, zb + 0.15);
    // reading lamp above the head end (lit at night in 109)
    const readM = this.mat(`hRead-${number}`, { color: 0x202020, emissive: 0xffc890, emissiveIntensity: 0 });
    this.bx(0.4, 0.05, 0.12, this.mat('hTrunk2'), bedX - 0.8, 2.05, zb + 0.1);
    this.bx(0.36, 0.015, 0.1, readM, bedX - 0.8, 2.023, zb + 0.1);
    // bedside cabinet + what's on it
    const cabX = bedX - 1.45, cabZ = BACK - 2.35;
    this.bx(0.46, 0.72, 0.44, this.mat('hCabinetW'), cabX, 0.37, cabZ);
    this.bx(0.42, 0.18, 0.01, this.mat('hDrawerFace'), cabX, 0.6, cabZ + 0.225);
    this.bx(0.14, 0.02, 0.02, this.mat('steel'), cabX, 0.6, cabZ + 0.235);
    this.bx(0.48, 0.025, 0.46, this.mat('hWorkTop'), cabX, 0.745, cabZ);
    this.cy(0.035, 0.03, 0.1, 8, this.mat('hCup', { color: 0xf0f2f4, roughness: 0.4, transparent: true, opacity: 0.85 }), cabX + 0.12, 0.81, cabZ + 0.1);
    this.cy(0.004, 0.004, 0.14, 4, this.mat('hStraw', { color: 0xe05a8a }), cabX + 0.13, 0.86, cabZ + 0.1, { rz: 0.25 });
    if (patient) {
      // flowers, cards, a photo — someone visits her
      this.cy(0.05, 0.04, 0.16, 10, this.mat('hVase', { color: 0x9ac0d0, transparent: true, opacity: 0.7, roughness: 0.1 }), cabX - 0.1, 0.84, cabZ - 0.05);
      const fr = rng(5);
      for (let i = 0; i < 7; i++) {
        this.cy(0.004, 0.004, 0.22, 4, this.mat('hStem', { color: 0x3a6a2a }), cabX - 0.1 + (fr() - 0.5) * 0.06, 1.0, cabZ - 0.05, { rz: (fr() - 0.5) * 0.5 });
        this.bx(0.05, 0.04, 0.05, this.matV('hPetals', { color: 0xffffff, roughness: 0.8 }), cabX - 0.1 + (fr() - 0.5) * 0.16, 1.1 + fr() * 0.06, cabZ - 0.05 + (fr() - 0.5) * 0.06, { color: [0xe85a7a, 0xf0d040, 0xf4f0e8, 0xd04060][i % 4], ry: fr() * 3 });
      }
      this.bx(0.1, 0.13, 0.01, this.matV('hCards', { color: 0xffffff, roughness: 0.8 }), cabX + 0.05, 0.825, cabZ - 0.12, { rx: -0.2, color: 0xe8d8f0 });
      this.bx(0.1, 0.12, 0.01, this.matV('hCards', { color: 0xffffff }), cabX + 0.17, 0.82, cabZ - 0.1, { rx: -0.2, ry: -0.3, color: 0xd0e8f0 });
      this.bx(0.12, 0.1, 0.015, this.mat('hBrass'), cabX - 0.18, 0.81, cabZ + 0.14, { rx: -0.25 });
    } else {
      // Julian: a plastic water jug, pill cup, a belongings bag
      this.cy(0.06, 0.06, 0.2, 10, this.mat('hJug', { color: 0xd8e4ee, transparent: true, opacity: 0.75, roughness: 0.2 }), cabX - 0.1, 0.86, cabZ - 0.02);
      this.cy(0.02, 0.018, 0.03, 8, this.mat('hPlasticW'), cabX + 0.02, 0.775, cabZ + 0.15);
      this.bx(0.36, 0.4, 0.22, this.mat('hBelongings', { color: 0xd8e4ec, transparent: true, opacity: 0.85, roughness: 0.3 }), x1 - 0.45, 0.68, zb + 0.55, { ry: -0.3 });
    }
    // visitor chair (vinyl armchair)
    const chairX = x1 - 0.45, chairZ = zb + 0.55;
    const vinyl = this.mat(patient ? 'hChairVinylW' : 'hChairVinyl', { color: patient ? 0x8a5a4a : 0x3a6a76, roughness: 0.55 });
    this.bx(0.56, 0.12, 0.52, vinyl, chairX, 0.44, chairZ, { ry: -0.3 });
    this.bx(0.56, 0.5, 0.1, vinyl, chairX + 0.06, 0.76, chairZ - 0.24, { ry: -0.3 });
    for (const s of [-1, 1]) this.bx(0.07, 0.22, 0.5, vinyl, chairX + Math.cos(0.3) * s * 0.3, 0.56, chairZ + Math.sin(0.3) * s * 0.3, { ry: -0.3 });
    this.bx(0.5, 0.36, 0.46, this.mat('steelDark'), chairX, 0.2, chairZ, { ry: -0.3 });
    if (patient) this.bx(0.5, 0.5, 0.03, this.mat('hKnit'), chairX + 0.05, 0.76, chairZ - 0.18, { ry: -0.3, rx: -0.15 });
    // sink corner: basin, mirror, towels, soap
    const sink = new THREE.Group();
    this.box(0.5, 0.12, 0.4, this.mat('sink', { color: 0xf0f2f2, roughness: 0.3 }), 0, 0.85, 0, sink);
    this.box(0.04, 0.2, 0.04, this.mat('steel'), 0, 1.0, -0.15, sink);
    this.box(0.04, 0.03, 0.14, this.mat('steel'), 0, 1.1, -0.1, sink);
    this.box(0.08, 0.6, 0.08, this.mat('hPlasticW'), 0, 0.5, -0.1, sink);
    sink.position.set(x0 + 0.5, 0, zb + 0.35); root.add(sink);
    this.bx(0.46, 0.6, 0.02, this.mat('hMirror', { color: 0x8a9aa8, metalness: 0.9, roughness: 0.08 }), x0 + 0.5, 1.55, zb + 0.07);
    this.bx(0.26, 0.32, 0.12, this.mat('hPlasticW'), x0 + 0.95, 1.5, zb + 0.11);
    this.sanitizer(x0 + 0.2, 1.25, zb + 0.06);
    // patient whiteboard
    this.framed(TX.wardBoard(+number), 0.6, 0.4, x0 + 0.62, 2.25, zb + 0.06, 0xb8bcc0, `hWB-${number}`);
    // TV on an arm in the back-right corner
    this.bx(0.06, 0.4, 0.06, this.mat('steelDark'), x1 - 0.2, 2.5, zb + 0.15);
    this.bx(0.06, 0.06, 0.4, this.mat('steelDark'), x1 - 0.2, 2.3, zb + 0.35);
    this.bx(0.6, 0.36, 0.05, this.mat('hTv', { color: 0x141618, roughness: 0.3, metalness: 0.2 }), x1 - 0.42, 2.2, zb + 0.6, { ry: -0.5 });
    // privacy curtain bunched against the right wall, on a ceiling track
    this.bx(0.03, 0.03, depth - 0.6, this.mat('steel'), x1 - 0.18, H - 0.06, BACK - depth / 2 - 0.2);
    this.bx(w - 0.5, 0.03, 0.03, this.mat('steel'), cx + 0.1, H - 0.06, zb + 0.5);
    this.curtain(x1 - 0.2, BACK - 1.0 - 1.05, 1.0, 2.2);
    // ceiling fixture
    this.troffer(cx, BACK - 1.9, 'A', 1.2, 0.6);

    // window to the outside: recess, mullion, sill, blinds, frost, radiator
    let outsideMat = null;
    if (window) {
      // each ward has its own outside: 109 over the roofs and the river, 107 the courtyard
      const view = number === '109' ? 'ward109' : 'ward107';
      outsideMat = new THREE.MeshBasicMaterial({ map: streetTexture('morning', view), color: 0xdde6ee });
      outsideMat.userData.view = view;
      this.outsideMats.push(outsideMat);
      const pane = this.plane(winW + 0.2, winY1 - winY0 + 0.2, outsideMat, winX, (winY0 + winY1) / 2, zb - 0.26);
      this.wardViews = this.wardViews || [];
      this.wardViews.push([pane, +number]);
      const rev = this.mat('hReveal', { color: 0xd8dcd8, roughness: 0.7 });
      this.bx(winW, 0.04, 0.3, rev, winX, winY0 - 0.02, zb - 0.1);
      this.bx(winW, 0.04, 0.3, rev, winX, winY1 + 0.02, zb - 0.1);
      this.bx(0.04, winY1 - winY0, 0.3, rev, winX - winW / 2 - 0.02, (winY0 + winY1) / 2, zb - 0.1);
      this.bx(0.04, winY1 - winY0, 0.3, rev, winX + winW / 2 + 0.02, (winY0 + winY1) / 2, zb - 0.1);
      this.bx(0.05, winY1 - winY0, 0.06, alu, winX, (winY0 + winY1) / 2, zb - 0.2);
      this.bx(winW, 0.05, 0.06, alu, winX, winY0 + 0.6, zb - 0.2);
      this.bx(winW + 0.2, 0.04, 0.2, this.mat('hSill', { color: 0xeeeee8, roughness: 0.5 }), winX, winY0 - 0.02, zb + 0.1);
      this.pl(winW, winY1 - winY0, this.texMat('hFrost', TX.frost(), { transparent: true }), winX, (winY0 + winY1) / 2, zb - 0.18);
      const blm = this.texMat('hBlindsW', tiled(TX.blinds(), 6, 3), { transparent: true });
      this.pl(winW + 0.04, 0.5, blm, winX, winY1 - 0.25, zb + 0.07);
      this.bx(winW + 0.1, 0.06, 0.06, alu, winX, winY1 + 0.03, zb + 0.08);
      this.cy(0.004, 0.004, 0.8, 4, this.mat('hCord', { color: 0xe8e8e8 }), winX + winW / 2 - 0.05, winY1 - 0.5, zb + 0.09);
      this.radiator(winX, 0.48, zb + 0.12, winW - 0.2);
      if (patient) { const pp = this.plant(winX + 0.55, zb + 0.1, root, 0.6, 3); pp.scale.setScalar(0.45); pp.position.y = winY0; }
      // night: moonlight shaft from the window onto the floor
      const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0x7a9ad8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(winW, 2.2), shaftMat);
      shaft.position.set(winX + 0.1, 1.1, zb + 0.9); shaft.rotation.x = -0.75; shaft.renderOrder = 4;
      root.add(shaft);
      const pool = this.pool(0x6a8ad0, winX + 0.2, zb + 1.5, 2.0, 1.6, 0);
      this.moonFx.push({ m: shaftMat, max: 0.18 }, { m: pool.material, max: 0.22 });
    }
    // warm reading light (night) and the cold room light (day) / moonlight (night)
    const warm = new THREE.PointLight(0xffb070, 0, 5, 1.5);
    warm.position.set(bedX - 0.8, 2.0, BACK - 1.8); root.add(warm);
    const cold = new THREE.PointLight(0xd8e4f0, 5, 5, 1.5);
    cold.position.set(cx, 2.8, BACK - 1.8); root.add(cold);
    // furniture is solid: bed, bedside cabinet, armchair, sink (the drip of the
    // patient's ward too; Julian's own drip rolls along with him by day)
    const B = (x, z, hx, hz) => this.colliders.push({ box: { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz } });
    B(bedX, bedZ, 1.05, 0.48);
    B(cabX, cabZ, 0.26, 0.24);
    B(chairX, chairZ, 0.34, 0.34);
    B(x0 + 0.5, zb + 0.35, 0.28, 0.24);
    if (patient) this.colliders.push({ x: bedX - 1.25, z: BACK - 1.3, r: 0.22 });
    return {
      x0, x1, cx, bed, mon, iv, hinge, leaf, warm, cold, outsideMat, readM,
      bedSpot: { x: bedX, z: bedZ, y: 0.72 },
      doorSpot: { x: (doorX0 + doorX1) / 2, z: -2.4 },
      inside: { x: bedX - 1.0, z: BACK - 1.3 },
    };
  }

  /** Folded cubicle curtain hanging along z (seen nearly edge-on from the corridor). */
  curtain(x, z, len, h) {
    const segs = this.low ? 6 : 14;
    const geo = new THREE.PlaneGeometry(len, h, segs, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / len) * segs * Math.PI) * 0.06);
    geo.computeVertexNormals();
    const tex = tiled(TX.curtain(), 2, 4);
    this._add(geo, this.mat('hCurtain', { map: tex, color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), x, H - 0.1 - h / 2 - 0.25, z, { ry: Math.PI / 2 });
    this.bx(0.1, 0.25, len, this.mat('hCurtainMesh', { color: 0xe8ecec, transparent: true, opacity: 0.6, roughness: 0.9 }), x, H - 0.22, z);
  }

  // ---------------------------------------------------------------- states

  /** Scene State System: 'day' | 'night'. */
  setState(name) {
    this.state = name;
    const night = name === 'night';
    this.night = night;
    this.lens.A.emissiveIntensity = night ? 0.03 : 1.6;
    this.lens.B.emissiveIntensity = night ? 0.35 : 1.6;
    this.lens.F.emissiveIntensity = night ? 0.3 : 1.6;
    this.ceilMat.emissiveIntensity = night ? 0.0 : 0.035;
    const nightCorr = [0.9, 1.2, 0.7, 0.35, 1.0];
    this.corrLights.forEach((l, i) => {
      l.color.set(night ? 0x5070b0 : 0xe4eeff);
      l.intensity = night ? nightCorr[i] : 7;
    });
    this.lights.hemi.intensity = night ? 0.3 : 1.2;
    this.lights.hemi.color.set(night ? 0x4a5a80 : 0xd0dce8);
    this.lights.hemi.groundColor.set(night ? 0x101418 : 0x30383a);
    this.deskLamp.intensity = night ? 3.5 : 0;
    this.deskGlow.material.opacity = night ? 0.45 : 0;
    this.deskPool.material.opacity = night ? 0.22 : 0;
    this.dlBulb.emissiveIntensity = night ? 4 : 0.2;
    for (const wd of [this.wardA, this.wardB]) {
      wd.cold.color.set(night ? 0x5a7ac0 : 0xd8e4f0);
      wd.cold.intensity = night ? (wd === this.wardA ? 2.2 : 1.6) : 5;
      wd.cold.position.set(wd.cx + 0.6, night ? 2.2 : 2.8, night ? BACK - 3.0 : BACK - 1.8);
    }
    this.wardA.warm.intensity = night ? 0.9 : 0;
    this.wardA.readM.emissiveIntensity = night ? 2.2 : 0;
    this.wardB.warm.intensity = this.wardBOpen ? 9 : 0;
    this.wardB.readM.emissiveIntensity = this.wardBOpen ? 2.5 : 0;
    this.examLamp.intensity = night ? 0 : 18;
    this.examBulb.emissiveIntensity = night ? 0 : 3;
    for (const m of this.outsideMats) { m.map = streetTexture(night ? 'night' : 'morning', m.userData.view || 'bar'); m.color.set(night ? 0x8a9ab8 : 0xdde6ee); m.needsUpdate = true; }
    for (const f of this.moonFx) f.m.opacity = night ? f.max : 0;
    for (const g of this.exitGlows) g.material.opacity = night ? 0.55 : 0.12;
    for (const s of this.exitSigns) s.material.emissiveIntensity = night ? 2.2 : 1.6;
    this.nightLampMat.emissiveIntensity = night ? 3 : 0;
    for (const p of this.nightLamps) p.material.opacity = night ? 0.2 : 0;
    this.vendMat.emissiveIntensity = night ? 1.1 : 0.9;
    this.vendGlow.material.opacity = night ? 0.3 : 0.0;
    this.vendPool.material.opacity = night ? 0.16 : 0;
    this.statusMat.emissiveIntensity = night ? 0.9 : 1.2;
    for (const g of this.screenGlow) g.material.opacity = night ? 0.3 : 0.0;
    this.callLamps.forEach((l, i) => { l.material.emissiveIntensity = night ? (i === 3 ? 0 : (i === 1 ? 1.5 : 0)) : (i === 0 || i === 4 ? 1.5 : 0); });
    if (this.sheen) this.sheen.material.uniforms.uStrength.value = night ? 0.42 : 0.2;
    this.setClocks(night ? 3 : 12, night ? 12 : 40);
    if (this.dustFx) this.dustFx.material.opacity = night ? 0.12 : 0.25;
    for (const f of this.expNight || []) f(night);
  }

  /** Ward 107 door opens: warm light spills into the dark corridor. */
  openWardB(open = true) {
    this.wardBOpen = open;
    this.wardBDoorTarget = open ? 1.35 : 0;
    this.wardB.warm.intensity = open ? 9 : 0;
    this.wardB.readM.emissiveIntensity = open ? 2.5 : 0;
    if (open && !this.spill) {
      const dx = this.wardB.x0 - 9.0;   // the light geometry was laid out for a ward at x 9…13
      this.spill = this.pool(0xffb070, 10.0 + dx, -1.8, 2.6, 3.4, 0.0);
      // a wedge of light fanning out of the doorway across the floor
      const geo = new THREE.BufferGeometry();
      const v = [9.42 + dx, 0.014, -4.0, 10.45 + dx, 0.014, -4.0, 7.2 + dx, 0.014, -0.4, 10.6 + dx, 0.014, -0.4];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      geo.setIndex([0, 2, 1, 1, 2, 3]);
      const m = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: 0xffa860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.wedge = new THREE.Mesh(geo, m); this.wedge.renderOrder = 3; this.root.add(this.wedge);
      // (no glow billboard in the doorway: Julian walks through it — the warm
      // room light and the floor wedge carry the doorway on their own)
    }
  }

  update(dt) {
    super.update(dt);
    this.updateExpansion(dt);
    this.updateMonitors(dt, (m) => this.onBeat?.(m));
    if (this.wardBDoorTarget != null) {
      const h = this.wardB.hinge;
      h.rotation.y += (this.wardBDoorTarget - h.rotation.y) * Math.min(1, dt * 1.6);
      if (this.spill) {
        this.spill.material.opacity += ((this.wardBOpen ? 0.35 : 0) - this.spill.material.opacity) * Math.min(1, dt * 2);
        const k = this.spill.material.opacity / 0.35;
        this.wedge.material.opacity = k * 0.95;
      }
    }
    if (this.night) {
      // a dying tube by the elevator
      const t = this.time;
      const on = Math.sin(t * 13.0) + Math.sin(t * 5.3 + 1) > 0.9 || (t % 4.7) < 0.08;
      this.lens.F.emissiveIntensity = on ? 0.9 : 0.06;
      this.flickLight.intensity = on ? 2.2 : 0.8;
      // a call light blinks for 107
      this.callLamps[3].material.emissiveIntensity = Math.sin(t * 3) > 0 ? 2 : 0;
    }
  }
}

installExpansion(HospitalScene, { TX, BACK, H, shaftTexture });
