import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { flareSource } from '../../fx/WindowLight.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { Snow } from '../Particles.js';
import { mountainTex } from './PoliceCarScene.js';
import { fbm3, rockGeometry, rockMaterial, spruceStand, setStandSnow, setRockSnow, bareTree, barkTexture, reliefGround, shaftTexture, mistTexture } from '../nature.js';

/**
 * The Takhini river valley, 40 km north of Whitehorse: where Lizzie vanished and the
 * carcasses were found. Late autumn, the first thin snow. Side-on like every location.
 *   x -14 … -6   trailhead: a pull-off, the trail sign
 *   x  -5 … 11   the cordoned site: police tape, evidence markers, the clawed aspen,
 *                marker 11 (Lizzie's phone); the river behind (z −6 … −9)
 *   x  12 … 30   deeper forest, a clearing above the river (the wolf, at dusk)
 *   x  31 … 46   rock slope and the cave mouth (x ≈ 42)
 * States: 'day' (overcast, the walk ends past the tape) / 'night' (blue dusk, whole valley).
 */

const PX = (key, w, h, draw) => canvasTexture(`forest-${key}`, w, h, draw, { nearest: true, aniso: 1 });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const sat = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = sat((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = (r, g, b, a = 1) => `rgba(${hex(r)},${hex(g)},${hex(b)},${a})`;

/** Smooth value noise on a wrapping grid (for tileable textures). */
function vnoise(r, n) {
  const g = Array.from({ length: n * n }, () => r());
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

/** Forest floor: thin first snow, broken by patches of dead grass, needles and earth. */
const groundTex = () => PX('ground', 128, 128, (ctx, w, h) => {
  const r = rng(301);
  const n1 = vnoise(r, 8), n2 = vnoise(r, 16), n3 = vnoise(r, 32);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = n1(x / 16, y / 16) * 0.55 + n2(x / 8, y / 8) * 0.3 + n3(x / 4, y / 4) * 0.15;
    const d = (r() - 0.5) * 8;
    if (v > 0.69) {           // bare: dead grass / earth
      const k = (v - 0.69) * 2.5;
      ctx.fillStyle = rgb(128 - k * 30 + d, 112 - k * 28 + d, 84 - k * 22 + d);
    } else if (v > 0.64) {    // slush edge
      ctx.fillStyle = rgb(176 + d, 178 + d, 176 + d);
    } else {                  // snow, slightly blue in the hollows
      const k = Math.min(1, v / 0.64);
      ctx.fillStyle = rgb(206 + k * 18 + d, 214 + k * 14 + d, 226 + k * 8 + d);
    }
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 70; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(84,72,54,0.45)' : 'rgba(150,132,90,0.5)'; ctx.fillRect(r() * w, r() * h, 1, 1 + (r() < 0.4 ? 1 : 0)); }
  const leaf = ['#b88a2a', '#a8582a', '#8a3a1c'];
  for (let i = 0; i < 8; i++) { ctx.fillStyle = leaf[i % 3]; ctx.fillRect(r() * w, r() * h, 1, 1); }
});

/** November floor: no snow yet — dry grass, moss, earth, fallen needles and a few last leaves. */
const groundTexAutumn = () => PX('groundAut', 128, 128, (ctx, w, h) => {
  const r = rng(305);
  const n1 = vnoise(r, 8), n2 = vnoise(r, 16), n3 = vnoise(r, 32);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = n1(x / 16, y / 16) * 0.55 + n2(x / 8, y / 8) * 0.3 + n3(x / 4, y / 4) * 0.15;
    const d = (r() - 0.5) * 14;
    if (v > 0.62) ctx.fillStyle = rgb(74 + d, 82 + d, 52 + d);            // moss
    else if (v > 0.45) ctx.fillStyle = rgb(138 + d, 122 + d, 82 + d);     // dry grass
    else if (v > 0.33) ctx.fillStyle = rgb(112 + d, 96 + d, 66 + d);
    else ctx.fillStyle = rgb(78 + d, 64 + d, 48 + d);                      // earth and needles
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 260; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(170,150,96,0.7)' : 'rgba(60,50,36,0.6)'; ctx.fillRect(r() * w, r() * h, 1, 2 + Math.floor(r() * 2)); }   // grass blades
  const leaf = ['#a87a2a', '#8a4a20', '#6a3418'];
  for (let i = 0; i < 30; i++) { ctx.fillStyle = leaf[i % 3]; ctx.fillRect(r() * w, r() * h, 1 + (r() < 0.3 ? 1 : 0), 1); }
});

/** November trail: trodden wet earth, needles, boot prints in the mud. */
const pathTexAutumn = () => PX('pathAut', 64, 32, (ctx, w, h) => {
  const r = rng(307);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 16; ctx.fillStyle = rgb(92 + n, 78 + n, 60 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(60,48,36,0.7)' : 'rgba(130,112,80,0.6)'; ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 1); }
  for (let i = 0; i < 18; i++) { const x = r() * w, y = r() * h; ctx.fillStyle = 'rgba(48,40,32,0.6)'; ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 1, y + 2, 2, 1); }
});

/** Low undergrowth (blueberry, ferns) for November: dark green and rust. */
const undergrowthTex = () => canvasTexture('forest-undergrowth2', 128, 64, (ctx, w, h) => {
  const r = rng(306);
  ctx.clearRect(0, 0, w, h);
  // willow shrubs: thin reddish-brown stems fanning up, a few last leaves
  for (let i = 0; i < 26; i++) {
    const x0 = w / 2 + (r() - 0.5) * w * 0.5, lean = (x0 - w / 2) * 0.9 + (r() - 0.5) * 20, top = h * (0.08 + r() * 0.4);
    ctx.strokeStyle = r() < 0.5 ? '#5a3424' : '#3e2a20'; ctx.lineWidth = 1 + r();
    ctx.beginPath(); ctx.moveTo(x0, h); ctx.quadraticCurveTo(x0 + lean * 0.3, (h + top) / 2, x0 + lean, top); ctx.stroke();
    for (let k = 0; k < 3; k++) { const t = 0.4 + r() * 0.5; const bx = x0 + lean * t * t, by = h - (h - top) * t; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + (r() - 0.5) * 14, by - 4 - r() * 8); ctx.stroke(); }
    if (r() < 0.6) { ctx.fillStyle = ['#8a6a2a', '#6a4a20', '#4a4a26'][Math.floor(r() * 3)]; ctx.beginPath(); ctx.ellipse(x0 + lean, top, 2.5, 1.2, r() * 3, 0, 7); ctx.fill(); }
  }
  // fireweed: tall rust stalks with pale seed fluff
  for (let i = 0; i < 6; i++) {
    const x = 10 + r() * (w - 20), top = h * (0.02 + r() * 0.2);
    ctx.strokeStyle = '#7a3a28'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + (r() - 0.5) * 6, top); ctx.stroke();
    for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(220,214,200,0.7)'; ctx.fillRect(x + (r() - 0.5) * 5, top + k * 3, 2, 2); }
  }
  // low blueberry / moss mats at the base
  for (let i = 0; i < 160; i++) { ctx.fillStyle = ['#1e2a1c', '#26341f', '#3a2a1c', '#5a3a20'][Math.floor(r() * 4)]; ctx.beginPath(); ctx.ellipse(w / 2 + (r() - 0.5) * w * 0.9, h - r() * 12, 2 + r() * 3, 1 + r() * 2, 0, 0, 7); ctx.fill(); }
}, { aniso: 4 });

/** The trodden path: packed snow, boot prints, a tyre rut at the trailhead. */
const pathTex = () => PX('path', 64, 32, (ctx, w, h) => {
  const r = rng(302);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 12; ctx.fillStyle = rgb(176 + n, 180 + n, 186 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h; ctx.fillStyle = 'rgba(110,104,96,0.55)'; ctx.fillRect(x, y, 3, 2); ctx.fillRect(x + 1, y + 2, 2, 1); }
  for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(96,84,66,0.5)'; ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 1); }
});

/** Spruce bark, aspen bark (pale with dark eyes), birch bark. */
const barkTex = (kind) => PX(`bark${kind}`, 16, 64, (ctx, w, h) => {
  const r = rng(310 + kind);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = (r() - 0.5) * 14 + Math.sin(x * 1.3) * 6;
    ctx.fillStyle = kind === 0 ? rgb(70 + n, 54 + n, 42 + n) : kind === 1 ? rgb(184 + n, 186 + n, 170 + n) : rgb(222 + n * 0.5, 220 + n * 0.5, 210 + n * 0.5);
    ctx.fillRect(x, y, 1, 1);
  }
  if (kind) for (let i = 0; i < 14; i++) { ctx.fillStyle = kind === 1 ? 'rgba(40,40,36,0.75)' : 'rgba(30,28,26,0.85)'; ctx.fillRect(r() * w, r() * h, 2 + r() * (kind === 2 ? 6 : 3), 1 + (r() < 0.3 ? 1 : 0)); }
});

/** Four claw grooves, 2.1 m up the aspen: torn bark, pale wood underneath. */
const clawTex = () => PX('claws', 32, 48, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    for (let y = 2; y < h - 2; y++) {
      const x = 3 + i * 5 + Math.round(y * 0.28 + Math.sin(y * 0.3 + i) * 0.5);
      if (x > w - 3) continue;
      ctx.fillStyle = '#efe2c4'; ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 2, y, 1, 1);
      if (y % 7 === 0) { ctx.fillStyle = '#5a3a24'; ctx.fillRect(x + 3, y, 1, 2); }
    }
  }
});

/** A far wall of spruce: jagged tips, solid (tinted by the material for day / dusk). */
const ridgeTex = (seed) => PX(`ridge${seed}`, 512, 48, (ctx, w, h) => {
  const r = rng(500 + seed);
  ctx.clearRect(0, 0, w, h);
  const base = new Array(w).fill(0).map((_, x) => Math.round(h * 0.62 + Math.sin(x / w * Math.PI * 6 + seed) * 3 + Math.sin(x / w * Math.PI * 22) * 1.5));
  for (let x = 0; x < w; x++) { ctx.fillStyle = '#fff'; ctx.fillRect(x, base[x], 1, h - base[x]); }
  for (let i = 0; i < 110; i++) {
    const x = Math.floor(r() * w), H = 8 + Math.floor(r() * 16), b = base[x] + 2;
    for (let y = 0; y < H; y++) {
      const half = Math.floor((y / H) * 6.5) + (y % 3 === 0 ? 1 : 0);
      ctx.fillStyle = (y % 3 === 0 && r() < 0.5) ? '#dde' : '#fff';
      ctx.fillRect((x - half + w) % w, b - H + y, half * 2 + 1, 1);
    }
  }
});

/** A deer (side view, faces +x): 'stand' | 'graze' | 'dead' (lying, torn). Mule-deer coat, white rump. */
const deerTex = (pose, coat = 0) => PX(`deer-${pose}-${coat}`, 96, 72, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const body = coat ? [150, 112, 76] : [128, 94, 62], c = (k, a = 1) => `rgba(${Math.round(body[0] * k)},${Math.round(body[1] * k)},${Math.round(body[2] * k)},${a})`;
  const ell = (cx, cy, rx, ry, col, rot = 0) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill(); ctx.restore(); };
  const leg = (x, y, len, bend, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 3, len * 0.45); ctx.fillRect(x + bend, y + len * 0.45, 2, len * 0.55); ctx.fillStyle = '#1a1410'; ctx.fillRect(x + bend, y + len - 1, 3, 2); };
  if (pose === 'dead') {
    ell(44, 54, 24, 8, c(1));
    ell(44, 58, 22, 3.5, '#d8c8a8');
    ell(72, 52, 8, 5, c(1), -0.3); ell(80, 55, 5, 3, c(0.9));
    for (const [x, b] of [[30, -4], [36, 3], [54, -5], [60, 4]]) { ctx.fillStyle = c(0.6); ctx.fillRect(x, 60, 2, 2); ctx.save(); ctx.translate(x, 61); ctx.rotate(b * 0.12); ctx.fillRect(0, 0, 14, 2); ctx.restore(); }
    ell(42, 52, 11, 5, '#6a1210'); ell(40, 52, 6, 3, '#a01c16'); ell(46, 62, 16, 2.5, 'rgba(80,10,8,0.85)');
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(36 + i * 2.2, 50, 1, 3); }   // ribs
    return;
  }
  const g = pose === 'graze';
  // legs behind the body (far side darker)
  leg(26, 38, 26, -1, c(0.5)); leg(60, 38, 26, 1, c(0.5));
  ell(44, 34, 22, 10, c(1));                       // barrel
  ell(28, 32, 9, 9, c(1.02));                       // haunch
  ell(58, 31, 9, 9, c(0.98));                       // shoulder
  ell(44, 41, 18, 3.5, '#d6c6a4');                  // pale belly
  ell(22, 30, 3.5, 4.5, '#c8bcaa'); ctx.fillStyle = '#2a2018'; ctx.fillRect(19, 27, 2, 5);   // white rump, black-tipped tail
  ctx.fillStyle = c(0.82); ctx.fillRect(30, 25, 26, 2);                                   // darker back line
  leg(30, 38, 27, 1, c(0.72)); leg(64, 38, 27, -1, c(0.72));
  if (g) {
    ell(68, 40, 5, 8, c(0.95), -0.9); ell(75, 50, 4.5, 6, c(1), -0.4); ell(78, 56, 3, 3, c(0.85));
    ctx.fillStyle = '#1a1410'; ctx.fillRect(79, 57, 2, 2);
    ell(71, 46, 3, 1.6, c(0.7), -1.2);
  } else {
    ell(66, 22, 5, 10, c(0.95), 0.45);              // neck
    ell(72, 12, 6, 5, c(1));                         // head
    ell(78, 14, 4, 3, c(0.9));                       // muzzle
    ctx.fillStyle = '#1a1410'; ctx.fillRect(81, 13, 2, 2); ctx.fillRect(72, 10, 2, 2);   // nose, eye
    ell(66, 6, 2.5, 5, c(0.85), -0.5); ell(70, 5, 2.2, 4.6, c(0.75), -0.2);              // big mule-deer ears
    ell(66, 7, 1.2, 3, '#d8b8a0', -0.5);
    ell(74, 17, 2.4, 1.1, '#cfc4b4');                  // pale throat patch
  }
  // grain so it reads as fur, not flat paint
  const r = rng(77 + coat + (g ? 5 : 0));
  const im = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < im.data.length; i += 4) { if (im.data[i + 3] < 10) continue; const n = (r() - 0.5) * 18; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
  ctx.putImageData(im, 0, 0);
});

/** A raven: frame 0 on the ground, 1 wings up. */
const ravenTex = (f) => PX(`raven${f}`, 16, 12, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#121214';
  if (f === 0) { ctx.fillRect(4, 5, 7, 4); ctx.fillRect(10, 3, 3, 3); ctx.fillRect(13, 4, 2, 1); ctx.fillRect(2, 6, 3, 2); ctx.fillRect(6, 9, 1, 2); ctx.fillRect(8, 9, 1, 2); }
  else { ctx.fillRect(4, 6, 7, 3); ctx.fillRect(10, 5, 3, 2); ctx.fillRect(13, 6, 2, 1); ctx.fillRect(3, 1, 3, 5); ctx.fillRect(7, 0, 3, 6); }
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(11, 4, 1, 1);
});

/** Police tape: yellow, black lettering in pixels. */
const tapeTex = () => PX('tape', 128, 8, (ctx, w, h) => {
  ctx.fillStyle = '#e8c41c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1814';
  for (let x = 2; x < w; x += 4) { if ((x / 4) % 9 > 6) continue; ctx.fillRect(x, 2, 2, 4); if ((x / 4) % 3 === 0) ctx.fillRect(x + 2, 2, 1, 1); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 7, w, 1);
});

/** Yellow evidence tent with a black number. */
const markerTex = (n) => PX(`marker${n}`, 24, 16, (ctx, w, h) => {
  ctx.fillStyle = '#e4b81c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b08a10'; ctx.fillRect(0, h - 2, w, 2);
  ctx.fillStyle = '#141210'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), w / 2, h / 2);
});

/** Rock: grey-brown, lichen, frost in the cracks. */
const rockTex = () => PX('rock', 64, 64, (ctx, w, h) => {
  const r = rng(320);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = (r() - 0.5) * 18 + Math.sin(x * 0.2 + y * 0.35) * 8; ctx.fillStyle = rgb(138 + n, 132 + n, 122 + n); ctx.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 18; i++) { const x = r() * w, y = r() * h, L = 6 + r() * 14; ctx.fillStyle = 'rgba(30,28,26,0.6)'; for (let k = 0; k < L; k++) ctx.fillRect(x + k * 0.7, y + Math.sin(k) * 1.5, 1, 1); }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(150,160,110,0.45)' : 'rgba(220,226,232,0.6)'; ctx.fillRect(r() * w, r() * h, 2 + r() * 3, 1 + r() * 2); }
});

/** River ice and black water. */
const riverTex = () => PX('river', 64, 32, (ctx, w, h) => {
  const r = rng(330);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const water = Math.abs(y - h / 2 + Math.sin(x * 0.15) * 3) < 9;
    const n = (r() - 0.5) * 10;
    ctx.fillStyle = water ? rgb(78 + n, 96 + n, 112 + n) : rgb(186 + n, 198 + n, 208 + n);
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(230,240,248,0.6)'; ctx.fillRect(r() * w, r() * h, 3 + r() * 6, 1); }
  for (let i = 0; i < 26; i++) { ctx.fillStyle = 'rgba(150,175,195,0.75)'; ctx.fillRect(r() * w, h / 2 - 7 + r() * 14, 2 + r() * 5, 1); } // ripples
});

/** Tileable ripple normal map for open water (sum of integer-frequency waves). */
const waterNormalTex = () => canvasTexture('forest-waternormal', 128, 128, (ctx, w, h) => {
  const r = rng(331);
  const waves = Array.from({ length: 9 }, () => ({ kx: Math.floor(r() * 6) + 1, ky: Math.floor(r() * 4) - 2, a: 0.4 + r(), p: r() * 6.28 }));
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = 0, dy = 0;
    for (const wv of waves) { const ph = 2 * Math.PI * (wv.kx * x / w + wv.ky * y / h) + wv.p; const c = Math.cos(ph) * wv.a; dx += c * wv.kx; dy += c * wv.ky; }
    const i = (y * w + x) * 4;
    img.data[i] = 128 + dx * 9; img.data[i + 1] = 128 + dy * 9; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}, { color: false, repeat: [14, 2] });

/** Shelf ice: grey-blue ice, white wind-blown snow streaks, a few cracks. */
const iceTex = () => canvasTexture('forest-ice', 256, 128, (ctx, w, h) => {
  const r = rng(332);
  ctx.fillStyle = '#7e8e9c'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = r() * h, L = 20 + r() * 80, t = 2 + r() * 8;
    ctx.fillStyle = `rgba(236,242,248,${0.5 + r() * 0.5})`;
    ctx.beginPath(); ctx.ellipse(x, y, L, t, (r() - 0.5) * 0.25, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,56,70,0.5)'; ctx.lineWidth = 1;
  for (let k = 0; k < 14; k++) { let x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 16; ctx.lineTo(x, y); } ctx.stroke(); }
}, { repeat: [12, 1] });

const RiverReflShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() { vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec3 vW;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 uv = vUv.xy / vUv.w;
      uv.x += sin(vW.x * 3.0 + uTime * 0.8) * 0.002 + sin(vW.z * 11.0 + uTime * 1.3) * 0.0015;
      uv.y += sin(vW.x * 1.7 - uTime * 0.6) * 0.004;
      gl_FragColor = vec4(texture2D(tDiffuse, uv).rgb * 0.38, 1.0);
    }`,
};

/** A dead hare (small pixel sprite), torn open. */
const hareTex = (kind) => PX(`hare${kind}`, 24, 12, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const fur = kind ? '#8a7a64' : '#d8d6d0', dark = kind ? '#5a4a3a' : '#9a9690';
  ctx.fillStyle = fur; ctx.fillRect(4, 6, 13, 4); ctx.fillRect(15, 4, 5, 4); ctx.fillRect(18, 1, 2, 4); ctx.fillRect(20, 2, 1, 3);
  ctx.fillStyle = dark; ctx.fillRect(4, 9, 13, 1); ctx.fillRect(2, 8, 3, 2);
  ctx.fillStyle = '#6a1210'; ctx.fillRect(7, 7, 6, 2); ctx.fillStyle = '#9a1c16'; ctx.fillRect(9, 7, 2, 1);
  ctx.fillStyle = '#1a1010'; ctx.fillRect(18, 5, 1, 1);
});

export class ForestScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'forest';
    this.title = 'Долина Такхини';
    this.background = 0xa8b2bc;
    this.camera = { distance: 8.6, height: 2.2, lookHeight: 1.35, lookZ: -0.9 };
    this.areasDay = [{ minX: -12, maxX: 12.5, minZ: -2.3, maxZ: 1.5 }];
    this.areasNight = [{ minX: -12, maxX: 43.2, minZ: -2.3, maxZ: 1.5 }];
    this.bounds = { walk: { areas: this.areasDay }, camera: { minX: -8, maxX: 9 } };
    this.dayNight = [];
  }

  B(w, h, d, mat, x, y, z, parent = this.root) { return this.box(w, h, d, mat, x, y, z, parent); }

  build() {
    this.rockMat = rockMaterial(this.low);
    this.buildBackdrop();
    this.buildGround();
    this.buildRiver();
    this.buildTrees();
    this.buildSite();
    this.buildClearing();
    this.buildNovember();
    this.buildCave();
    this.buildForeground();
    this.buildAtmosphere();
    this.anchors.start = { x: -10.5, z: 0.2 };
    this.anchors.siteIn = { x: -3.0, z: 0.0 };
    this.anchors.wolf = { x: 24.2, z: -12.6 };
    this.anchors.hide = { x: 17.5, z: -1.8 };
    this.anchors.cave = { x: 42.2, z: -2.6 };
    this.shots = {
      forest: { pos: [3, 2.2, 7.2], look: [3, 1.4, -2], fov: 36 },
    };
    this.allStands = []; this.snowGeos = [];
    this.root.traverse((o) => { if (o.userData?.cardMat) this.allStands.push(o); if (o.geometry?.userData?.snowCols) this.snowGeos.push(o.geometry); });
    this.windowLights = [
      flareSource('MIST', new THREE.Vector3(8, 12, -70), { always: true, enabled: () => this.state === 'day' }),
      flareSource('MOON', new THREE.Vector3(30, 22, -95), { always: true, enabled: () => this.state === 'night' || this.state === 'l2' }),
    ];
    this.setState('day');
    return this.root;
  }

  // ---------------------------------------------------------------- backdrop

  buildBackdrop() {
    const root = this.root;
    const skyC = document.createElement('canvas');
    skyC.width = 8; skyC.height = 128;
    this.skyCanvas = skyC;
    this.skyTexture = new THREE.CanvasTexture(skyC);
    this.skyTexture.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(260, 80), new THREE.MeshBasicMaterial({ map: this.skyTexture, depthWrite: false, fog: false }));
    sky.position.set(16, 20, -100); root.add(sky);
    const layer = (tex, w, h, x, y, z, rep) => {
      const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); t.wrapS = THREE.RepeatWrapping;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, fog: false }));
      m.position.set(x, y, z); root.add(m); return m;
    };
    this.mtn = layer(mountainTex(), 220, 34, 16, 12, -88, 2);
    this.far = layer(ridgeTex(1), 180, 12, 16, 4.6, -46, 3);
    this.far2 = layer(ridgeTex(2), 130, 8, 16, 2.9, -36, 4);
    // fog banks between the layers (soft, uneven — not a flat band)
    const hz = (y, z, op, w = 240, h = 16) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xdfe6ee, transparent: true, opacity: op, depthWrite: false, fog: false }));
      m.position.set(16, y, z); root.add(m); return m;
    };
    this.hazes = [hz(4, -40, 0.4), hz(2.5, -30, 0.3), hz(1.6, -20, 0.18)];
    this.banks = [];
    const mr = rng(77);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26 + mr() * 20, 5 + mr() * 3), new THREE.MeshBasicMaterial({ map: mistTexture(1 + (i % 3)), color: 0xe4e8ee, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
      m.position.set(-14 + i * 8 + mr() * 4, 1.6 + mr() * 2.5, -18 - mr() * 14);
      m.userData.vx = 0.15 + mr() * 0.2;
      root.add(m); this.banks.push(m);
    }
    // low ground fog drifting between the trunks (mid-ground, not only on the back plane)
    this.lowFog = [];
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(7 + mr() * 6, 1.4 + mr() * 0.8), new THREE.MeshBasicMaterial({ map: mistTexture(1 + (i % 3)), color: 0xe4e8ee, transparent: true, opacity: 0.3, depthWrite: false }));
      m.position.set(-16 + i * 5.4 + mr() * 2, 0.45 + mr() * 0.5, -3.4 - mr() * 3.2);
      m.userData.vx = 0.08 + mr() * 0.1;
      root.add(m); this.lowFog.push(m);
    }
    // moon (dusk only)
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: 0xf2f0e4, transparent: true, depthWrite: false, fog: false }));
    this.moon.position.set(30, 22, -95); root.add(this.moon);
    this.moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xb8c8e0, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    this.moonGlow.scale.set(22, 22, 1); this.moonGlow.position.set(30, 22, -96); root.add(this.moonGlow);
    // the low sun (Lizzie's November afternoon), behind the trees
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd8a0, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.sunDisc.scale.set(30, 30, 1); this.sunDisc.position.set(-6, 9, -70); root.add(this.sunDisc);
  }

  paintSky(stops) {
    const ctx = this.skyCanvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    for (const [k, c] of stops) g.addColorStop(k, c);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128);
    this.skyTexture.needsUpdate = true;
  }

  // ---------------------------------------------------------------- ground

  /** Ground height: the flat trail lane, soft drifts, the river channel, the far bank rising. */
  groundH(x, z) {
    const RZ = -8.6, half = 2.4;
    const dz = Math.abs(z - RZ);
    let h = 0;
    const lane = smooth(1.2, 3.2, Math.max(-z - 2.4, z - 1.8));           // 0 on the lane, 1 away from it
    h += (fbm3(x * 0.22, 0, z * 0.22, 41, 3) - 0.45) * 0.55 * lane;          // drifts
    h += (fbm3(x * 1.1, 0, z * 1.1, 43, 2) - 0.5) * 0.08 * lane;
    const bank = smooth(half + 1.3, half - 0.2, dz);                         // 1 inside the channel
    h = h * (1 - bank) - 0.62 * bank;
    if (z < RZ - half - 0.8) h += Math.pow(Math.max(0, RZ - half - 0.8 - z), 1.25) * 0.22;   // far bank climbs
    return h;
  }

  buildGround() {
    const gt = groundTex().clone(); gt.needsUpdate = true; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(90 / 2.56, 44 / 2.56);
    const snowLit = new THREE.Color(0xf4f6f8), snowSh = new THREE.Color(0xb8c6d6), earth = new THREE.Color(0x5a5048), stone = new THREE.Color(0x7a7470);
    const geo = reliefGround(90, 44, this.low ? 120 : 180, this.low ? 60 : 88, (x, z) => this.groundH(x + 16, z - 12), (c, x, y, z, ny) => {
      const steep = sat((0.93 - ny) * 7);
      c.copy(snowLit).lerp(snowSh, sat((0.98 - ny) * 4) * 0.7 + (fbm3(x * 0.4, 0, z * 0.4, 51, 2) - 0.5) * 0.3);
      if (y < -0.2) c.lerp(stone, sat(-0.2 - y) * 1.6 * (0.4 + steep));        // wet stones at the waterline
      c.lerp(earth, steep * 0.55 * (fbm3(x * 1.7, 0, z * 1.7, 53, 2) > 0.45 ? 1 : 0.4));
    });
    geo.translate(16, 0, -12);
    const ground = new THREE.Mesh(geo, this.mat('forestGround', { map: gt, color: 0xffffff, roughness: 0.95, vertexColors: true }));
    this.root.add(ground);
    this.groundSnow = ground;
    const at = groundTexAutumn().clone(); at.needsUpdate = true; at.wrapS = at.wrapT = THREE.RepeatWrapping; at.repeat.set(90 / 2.56, 44 / 2.56);
    const grassC = new THREE.Color(0xd8ccb0), mossC = new THREE.Color(0x9aa080), mud = new THREE.Color(0x6a5a48);
    const ageo = geo.clone();
    { const p = ageo.attributes.position, n = ageo.attributes.normal, col = ageo.attributes.color, c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        c.copy(grassC).lerp(mossC, sat(fbm3(x * 0.3, 0, z * 0.3, 57, 3) * 2 - 0.7));
        c.lerp(mud, sat((0.93 - n.getY(i)) * 5) * 0.6 + (y < -0.2 ? sat(-0.2 - y) * 1.5 : 0));
        col.setXYZ(i, c.r, c.g, c.b);
      } }
    this.groundAutumn = new THREE.Mesh(ageo, this.mat('forestGroundAut', { map: at, color: 0xffffff, roughness: 1, vertexColors: true }));
    this.groundAutumn.visible = false;
    this.root.add(this.groundAutumn);
    // the trail: a packed strip along the walk lane
    const pt = pathTex().clone(); pt.needsUpdate = true; pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(60 / 1.28, 1);
    const pathAlpha = canvasTexture('forest-pathalpha', 4, 64, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(0.3, '#fff'); g.addColorStop(0.7, '#fff'); g.addColorStop(1, '#000'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, { color: false });
    const path = new THREE.Mesh(new THREE.PlaneGeometry(60, 1.9), this.mat('forestPath', { map: pt, alphaMap: pathAlpha, color: 0xffffff, roughness: 0.9, transparent: true, opacity: 0.7, depthWrite: false }));
    path.rotation.x = -Math.PI / 2; path.position.set(16, 0.008, 0.2); this.root.add(path);
    this.pathMesh = path;
    this.pathSnowTex = pt;
    const pa = pathTexAutumn().clone(); pa.needsUpdate = true; pa.wrapS = pa.wrapT = THREE.RepeatWrapping; pa.repeat.set(60 / 1.28, 1);
    this.pathAutTex = pa;
    // snow drifts along the lane edges: smooth, rounded, blue in their shadows
    const r = rng(340);
    const driftGeo = rockGeometry(3, { detail: 3, rough: 0.45, flat: -0.2, colA: 0xf2f4f6, colB: 0xdfe6ee, dark: 0.18, snow: 0 });
    const lumps = [];
    for (let x = -14; x < 46; x += 1.1) {
      lumps.push([x + r() * 0.6, -2.7 - r() * 0.5, 0.5 + r() * 0.7, 0.1 + r() * 0.14, 0.3 + r() * 0.25]);
      if (r() < 0.3) lumps.push([x + r() * 0.6, 2.2 + r() * 0.5, 0.35 + r() * 0.4, 0.06 + r() * 0.06, 0.25]);
    }
    const im = new THREE.InstancedMesh(driftGeo, this.mat('forestDrift', { vertexColors: true, color: 0xffffff, roughness: 1 }), lumps.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    lumps.forEach(([x, z, sx, sy, sz], i) => { q.setFromEuler(e.set(0, r() * 3, 0)); m.compose(new THREE.Vector3(x, -0.03, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m); });
    this.root.add(im);
    this.drifts = im;
    // undergrowth (November only — in December it is under the snow)
    const ug = new THREE.PlaneGeometry(1, 0.5); ug.translate(0, 0.25, 0);
    const ugm = new THREE.InstancedMesh(ug, this.mat('undergrowth', { map: undergrowthTex(), color: 0xffffff, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), 220);
    for (let i = 0; i < 220; i++) {
      const front = r() >= 0.8;
      const x = -16 + r() * 64, z = front ? 2.0 + r() * 0.8 : -2.6 - r() * 3.0;
      const herdSpot = x > -2 && x < 10 && z > -4.8 && !front;      // the herd stands here in L2
      if (herdSpot && r() < 0.8) { m.compose(new THREE.Vector3(0, -9, 0), q, new THREE.Vector3(0.001, 0.001, 1)); ugm.setMatrixAt(i, m); continue; }
      q.setFromEuler(e.set(0, (r() - 0.5) * 1.2, 0));
      const sc = front ? 0.35 + r() * 0.35 : 0.8 + r() * 1.4;
      m.compose(new THREE.Vector3(x, this.groundH(x, z) - 0.03, z), q, new THREE.Vector3(sc, sc * (0.7 + r() * 0.6), 1)); ugm.setMatrixAt(i, m);
    }
    this.undergrowth = ugm; ugm.visible = false;
    const blade = new THREE.PlaneGeometry(0.03, 0.5, 1, 3); blade.translate(0, 0.25, 0);
    { const bp = blade.attributes.position; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 1.8) + y * y * 0.5); } }
    const gm = new THREE.InstancedMesh(blade, this.mat('dryGrassMass', { color: 0xb09a62, roughness: 1, side: THREE.DoubleSide }), 2600);
    const gc = new THREE.Color();
    for (let i = 0; i < 2600; i++) {
      const cx = -16 + (Math.floor(i / 20) * 0.53) % 64, cz = Math.floor(i / 20) % 2 ? -2.6 - r() * 2.4 : 1.9 + r() * 1.4;
      const x = cx + (r() - 0.5) * 0.9, z = cz + (r() - 0.5) * 0.5;
      q.setFromEuler(e.set(0, r() * 6, (r() - 0.5) * 0.9));
      m.compose(new THREE.Vector3(x, this.groundH(x, z) - 0.03, z), q, new THREE.Vector3(1, 0.5 + r() * 0.9, 1)); gm.setMatrixAt(i, m);
      gm.setColorAt(i, gc.setRGB(0.75 + r() * 0.3, 0.7 + r() * 0.25, 0.5 + r() * 0.2));
    }
    this.grassMass = gm; gm.visible = false; this.root.add(gm);
    const leafG = new THREE.PlaneGeometry(0.07, 0.05);
    const leaves = new THREE.InstancedMesh(leafG, this.mat('fallenLeaf', { color: 0xffffff, roughness: 1, side: THREE.DoubleSide }), 900);
    const lc = [[0.62, 0.42, 0.16], [0.5, 0.26, 0.12], [0.7, 0.55, 0.22], [0.36, 0.3, 0.18]];
    for (let i = 0; i < 900; i++) {
      const x = -16 + r() * 64, z = r() < 0.5 ? 1.5 + r() * 2.5 : -2.4 - r() * 2.6;
      q.setFromEuler(e.set(-Math.PI / 2 + (r() - 0.5) * 0.4, r() * 6, 0)); m.compose(new THREE.Vector3(x, this.groundH(x, z) + 0.01, z), q, new THREE.Vector3(1, 1, 1)); leaves.setMatrixAt(i, m);
      const c = lc[i % 4]; leaves.setColorAt(i, gc.setRGB(c[0], c[1], c[2]));
    }
    this.fallenLeaves = leaves; leaves.visible = false; this.root.add(leaves);
    this.root.add(ugm);
    // dead grass poking through: thin bent blades in tufts
    const grass = this.mat('deadGrass', { color: 0x9a8458, roughness: 1, side: THREE.DoubleSide });
    const tuftGeo = new THREE.PlaneGeometry(0.025, 0.36, 1, 3); tuftGeo.translate(0, 0.18, 0);
    { const tp = tuftGeo.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) * (1 - y * 2) + y * y * 0.6); } }
    const tufts = [];
    for (let i = 0; i < 190; i++) {
      const x = -14 + r() * 60, z = r() < 0.7 ? -2.5 - r() * 3 : 1.75 + r() * 0.6;
      for (let k = 0; k < 6; k++) tufts.push([x + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.25, (r() - 0.5) * 0.6, 0.6 + r() * 0.8, r() * 6]);
    }
    const tim = new THREE.InstancedMesh(tuftGeo, grass, tufts.length);
    tufts.forEach(([x, z, lean, sc, ry], i) => { q.setFromEuler(e.set(0, ry, lean)); m.compose(new THREE.Vector3(x, this.groundH(x, z) - 0.02, z), q, new THREE.Vector3(1, sc, 1)); tim.setMatrixAt(i, m); });
    this.root.add(tim);
    // tracks on the trail: boots (the investigators, weeks ago) and, closer to the site, paws
    const prints = [];
    for (let x = -12; x < 13; x += 0.36) prints.push([x, 0.15 + ((x * 2.78) % 2 > 1 ? 0.12 : -0.12), 0.11, 0.05]);
    for (let x = -4; x < 30; x += 0.55) prints.push([x + r() * 0.1, 1.05 + Math.sin(x) * 0.15, 0.07, 0.07]);
    const pim = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 9), this.mat('trailPrint', { color: 0x8a96a6, roughness: 1, transparent: true, opacity: 0.7, depthWrite: false }), prints.length);
    const qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    prints.forEach(([x, z, sx, sz], i) => { m.compose(new THREE.Vector3(x, 0.012, z), qq, new THREE.Vector3(sx, sz * 2, 1)); pim.setMatrixAt(i, m); });
    this.root.add(pim);
    this.prints = pim;
  }

  buildRiver() {
    // black open water in the middle of the channel: a moving normal map + sky reflected at grazing angles
    const nt = waterNormalTex();
    const water = new THREE.MeshPhongMaterial({ color: 0x0b141a, specular: 0x9aaabb, shininess: 70, normalMap: nt, normalScale: new THREE.Vector2(0.6, 0.6) });
    water.onBeforeCompile = (sh) => {
      sh.uniforms.uSky = this.waterSky = { value: new THREE.Color(0x8a96a6) };
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uSky;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float fres = pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 2.5);\n totalEmissiveRadiance += uSky * (0.18 + 0.75 * fres);');
    };
    this.waterMat = water;
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(70, 5.6), water);
    wm.rotation.x = -Math.PI / 2; wm.position.set(12, -0.4, -8.6); this.root.add(wm);
    if (!this.low) {
      // the far bank and the sky mirrored in the slow black water (rippled)
      const refl = new Reflector(new THREE.PlaneGeometry(70, 5.6), {
        textureWidth: Math.floor(window.innerWidth * 0.4), textureHeight: Math.floor(window.innerHeight * 0.4), shader: RiverReflShader, clipBias: 0.003,
      });
      refl.material.transparent = true; refl.material.blending = THREE.AdditiveBlending; refl.material.depthWrite = false;
      refl.rotation.x = -Math.PI / 2; refl.position.set(12, -0.395, -8.6); refl.renderOrder = 1;
      this.root.add(refl); this.riverRefl = refl;
    }
    // shelf ice along both banks: thick plates with a broken inner edge, snow streaks over grey ice
    const iceMat = this.iceMat = this.mat('riverIce', { map: iceTex(), color: 0xffffff, roughness: 0.35, metalness: 0.05 });
    const shelf = (zEdge, dir, seed) => {
      const r = rng(seed);
      const pts = [];
      const N = 140;
      for (let i = 0; i <= N; i++) { const x = -22 + (70 * i) / N; pts.push([x, zEdge + dir * (0.4 + fbm3(x * 0.35, seed, 0, seed, 3) * 1.5 + (r() < 0.06 ? 0.6 : 0))]); }
      const shape = new THREE.Shape();
      shape.moveTo(-22, zEdge - dir * 1.2);
      for (const [x, z] of pts) shape.lineTo(x, z);
      shape.lineTo(48, zEdge - dir * 1.2);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2, curveSegments: 1 });
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, iceMat);
      mesh.position.y = -0.27;
      // rotateX(π/2) maps shape y → z
      this.root.add(mesh);
      // floes drifting off the shelf
      for (let k = 0; k < 7; k++) {
        const fg = rockGeometry(seed + k, { detail: 2, rough: 0.25, flat: -0.02, colA: 0xe8eef4, colB: 0xb8c8d6, dark: 0.2 });
        const f = new THREE.Mesh(fg, this.mat('floe', { vertexColors: true, color: 0xffffff, roughness: 0.4 }));
        f.scale.set(0.3 + r() * 0.5, 0.06, 0.2 + r() * 0.35); f.rotation.y = r() * 3;
        f.position.set(-18 + r() * 60, -0.39, zEdge + dir * (1.6 + r() * 0.8));
        this.root.add(f); (this.floes ||= []).push(f);
      }
    };
    shelf(-6.0, -1, 601);
    shelf(-11.2, 1, 602);
    // stones in the shallows, snow on their tops
    const sr = rng(345);
    for (let i = 0; i < 64; i++) {
      const rg = rockGeometry(700 + (i % 26), { detail: 3, rough: 0.35, flat: -0.35, snow: 0.55, colA: 0x5e5a56, colB: 0x46423e });
      const st = new THREE.Mesh(rg, this.rockMat);
      const zz = sr() < 0.5 ? -6.0 - sr() * 0.8 : -11.2 + sr() * 0.8;
      const big = i < 22; st.position.set(-20 + sr() * 64, -0.35, zz); st.scale.set((big ? 0.25 + sr() * 0.45 : 0.08 + sr() * 0.12), (big ? 0.2 + sr() * 0.3 : 0.06 + sr() * 0.08), (big ? 0.25 + sr() * 0.35 : 0.08 + sr() * 0.1)); st.rotation.y = sr() * 6;
      this.root.add(st);
    }
    // reeds on the far bank, a pale strip of frozen grass
    const reedGeo = new THREE.PlaneGeometry(0.02, 0.7, 1, 2); reedGeo.translate(0, 0.35, 0);
    const reed = this.mat('reed', { color: 0xa89068, roughness: 1, side: THREE.DoubleSide });
    const rim = new THREE.InstancedMesh(reedGeo, reed, 260);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 260; i++) {
      const x = -20 + sr() * 62, z = sr() < 0.6 ? -11.6 - sr() * 0.9 : -5.2 - sr() * 0.5;
      q.setFromEuler(e.set(0, sr() * 3, (sr() - 0.5) * 0.4)); m.compose(new THREE.Vector3(x, this.groundH(x, z) - 0.05, z), q, new THREE.Vector3(1, 0.5 + sr() * 0.9, 1)); rim.setMatrixAt(i, m);
    }
    this.root.add(rim);
    // steam over the open water
    this.steam = [];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(5 + sr() * 5, 1.3 + sr()), new THREE.MeshBasicMaterial({ map: mistTexture(1 + (i % 3)), color: 0xe8eef4, transparent: true, opacity: 0.0, depthWrite: false }));
      sp.position.set(-18 + i * 4.6 + sr() * 2, 0.15 + sr() * 0.4, -8.6 + (sr() - 0.5) * 2.4);
      sp.userData = { base: 0.12 + sr() * 0.16, ph: sr() * 6, vx: 0.18 + sr() * 0.2 };
      this.root.add(sp); this.steam.push(sp);
    }
    this.anchors.river = new THREE.Vector3(2.0, 0.6, -6.0);
  }

  // ---------------------------------------------------------------- trees

  /** A single snow-laden spruce (for the story's named trees). */
  spruce(x, z, s, parent = this.root, kind = 'young') {
    const g = spruceStand([{ x: 0, z: 0, s, kind }], { low: this.low, snow: 1, variant: Math.abs(Math.round(x * 3)) % 3 });
    g.position.set(x, this.groundH(x, z), z);
    parent.add(g);
    return g;
  }

  /** Leafless aspen (kind 1) / birch (kind 2) with real branching and a few last leaves. */
  bare(x, z, s, kind = 1, parent = this.root) {
    const g = bareTree(Math.round(x * 97 + z * 31 + kind * 7 + 1000), { low: this.low, height: 4.8, kind: kind === 2 ? 'birch' : 'aspen', leaves: kind === 1 ? 0.35 : 0.12 });
    g.position.set(x, this.groundH(x, z) - 0.05, z); g.scale.setScalar(s);
    parent.add(g);
    return g;
  }

  buildTrees() {
    const r = rng(350);
    const open = (x) => (x > -3.5 && x < 10.5) || (x > 19 && x < 28.5); // the site, the clearing: river in view
    const near = [], bankTrees = [], far = [];
    // first row behind the lane: tall trunks (crowns above the frame) and young snowy spruces
    for (let x = -18; x < 50; x += (r() < 0.3 ? 3.5 + r() * 3 : 0.7 + r() * 1.2)) {   // clusters and gaps, not a picket fence
      if (x > 31 && x < 46) continue;
      const z = -3.6 - r() * 1.8;
      if (open(x) && r() < 0.75) continue;
      const k = r();
      if (k < 0.08) near.push({ x, z, s: 0.8 + r() * 0.3, kind: 'tall', snag: true, y: this.groundH(x, z) });
      else if (k < 0.5) near.push({ x, z, s: 0.95 + r() * 0.3, kind: 'tall', y: this.groundH(x, z) });
      else if (k < 0.78) near.push({ x, z: z - 0.4, s: 0.55 + r() * 0.35, kind: 'young', y: this.groundH(x, z - 0.4) });
      else if (r() < 0.35) this.bare(x, z, 0.95 + r() * 0.3, r() < 0.5 ? 1 : 2);
    }
    // the near bank right at the water
    for (let x = -20; x < 48; x += 1.2 + r() * 1.6) {
      if (open(x) && r() < 0.8) continue;
      const z = -5.0 - r() * 0.6;
      bankTrees.push({ x, z, s: 0.6 + r() * 0.5, kind: r() < 0.5 ? 'tall' : 'young', y: this.groundH(x, z) });
    }
    // the far bank: a dense wall of spruce climbing the slope, a few birches between
    const clearing = (x) => (x > 2 && x < 7.5) || (x > 21 && x < 25.5) || (x > -16 && x < -12.5);
    for (let x = -26; x < 58; x += 0.7 + r() * 0.8) {
      for (let row = 0; row < 3; row++) {
        if (clearing(x) && row < 2 && r() < 0.85) continue;
        const z = -12.4 - row * 3.2 - r() * 2.6;
        if (r() < 0.12 && row === 0) { this.bare(x, z, 1.1, 2); continue; }
        far.push({ x: x + r() * 0.5, z, s: 0.75 + r() * 0.55, kind: r() < 0.6 ? 'tall' : 'young', y: this.groundH(x, z) });
      }
    }
    const stand = (list, variant, tint, bark = 'spruce') => { const g = spruceStand(list, { low: this.low, snow: 1, variant, tint, bark }); this.root.add(g); this.stands.push(g); return g; };
    this.stands = [];
    stand(near, 0, 0xffffff, 'mossy');
    stand(bankTrees, 1, 0xf0f0f0);
    stand(far, 2, 0xe4e8ec);
    // undergrowth: small snow-buried spruces and fallen logs along the lane
    const young = [];
    for (let x = -16; x < 46; x += 2.2 + r() * 3) { const z = -2.9 - r() * 0.9; if (!(x > 31 && x < 46)) young.push({ x, z, s: 0.18 + r() * 0.16, kind: 'young', y: this.groundH(x, z) }); }
    stand(young, 1, 0xffffff);
    this.snowBits = new THREE.Group(); this.root.add(this.snowBits);
    const logM = this.mat('logBark', { map: barkTexture('mossy'), color: 0xd8d0c8, roughness: 1 });
    const snowM = this.mat('logSnow', { color: 0xeef2f6, roughness: 1 });
    for (const [x, z, L, ry] of [[-11.2, -4.6, 3.4, 0.25], [13.2, -4.3, 4.2, -0.18], [29.6, -4.0, 3.0, 0.4]]) {
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, L, 16), logM); lg.rotation.set(0, ry, Math.PI / 2); lg.position.set(x, this.groundH(x, z) + 0.14, z); this.root.add(lg);
      const sn = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, L * 0.92, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9), snowM); sn.rotation.set(0, ry, Math.PI / 2); sn.position.set(x, this.groundH(x, z) + 0.2, z); sn.scale.set(1, 1, 1.15); this.snowBits.add(sn);
    }
  }

  // ---------------------------------------------------------------- the cordoned site

  buildSite() {
    const root = this.root;
    // trailhead sign
    const wood = this.mat('signWood', { color: 0x5a4430, roughness: 0.9 });
    this.B(0.1, 1.5, 0.1, wood, -9.0, 0.75, -2.6); this.B(0.1, 1.5, 0.1, wood, -7.8, 0.75, -2.6);
    const sign = this.textSign('TAKHINI RIVER TRAIL', { w: 1.5, h: 0.42, bg: '#4a3626', fg: '#e8dcc0', font: 'bold 30px serif' });
    sign.position.set(-8.4, 1.3, -2.55); root.add(sign);
    // everything the police left (hidden in Lizzie's November)
    const site = this.siteGroup = new THREE.Group(); root.add(site);
    // stakes + tape around the site (x −4 … 10.5, z −5.6 … −2.5), a loose end on the path
    const stake = this.mat('stake', { color: 0x6a5a44, roughness: 0.9 });
    const tape = this.tapeMat = this.mat('tape', { map: tapeTex(), color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x2a2400 });
    const posts = [[-4.2, -2.6], [-1.0, -2.65], [2.5, -2.55], [6.0, -2.7], [10.4, -2.6], [10.6, -5.4], [-4.4, -5.3]];
    for (const [x, z] of posts) this.B(0.06, 1.0, 0.06, stake, x, 0.5, z, site);
    const span = (a, b, y = 0.88, sag = 0.12) => {
      const [x1, z1] = a, [x2, z2] = b, L = Math.hypot(x2 - x1, z2 - z1);
      const geo = new THREE.PlaneGeometry(L, 0.07, 16, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = p.getX(i) / L + 0.5; p.setY(i, p.getY(i) - Math.sin(t * Math.PI) * sag); }
      const m = new THREE.Mesh(geo, tape);
      m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      site.add(m);
      return m;
    };
    for (let i = 0; i < posts.length - 1; i++) span(posts[i], posts[i + 1]);
    span(posts[posts.length - 1], posts[0]);
    // the front run is torn: one end hangs down onto the snow
    const loose = span([-4.2, -2.6], [-5.3, -1.6], 0.5, 0.35); loose.rotation.z = -0.5;
    // evidence markers
    const tents = [[1, -0.9, -3.6], [4, 1.6, -4.4], [7, 4.4, -3.4], [11, 3.0, -2.95], [14, 6.6, -4.8], [19, 8.4, -3.9], [23, -2.2, -4.6]];
    for (const [n, x, z] of tents) {
      const geo = new THREE.PlaneGeometry(0.3, 0.22);
      const mm = this.mat(`marker${n}`, { map: markerTex(n), color: 0xffffff, roughness: 0.6, emissive: 0x1a1400 });
      const a = new THREE.Mesh(geo, mm); a.position.set(x - 0.05, 0.1, z); a.rotation.set(-0.25, 0.3, 0); site.add(a);
      const b = new THREE.Mesh(geo, mm); b.position.set(x + 0.05, 0.1, z - 0.04); b.rotation.set(0.25, 0.3, 0); site.add(b);
    }
    this.anchors.marker11 = new THREE.Vector3(3.0, 0.25, -2.95);
    // old dark stains under the snow, a few bones
    const stain = this.mat('stain', { color: 0x4a1a14, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false });
    const sr = rng(360);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.3 + sr() * 0.5, 9), stain);
      s.rotation.x = -Math.PI / 2; s.position.set(-3 + sr() * 12, 0.012, -3.2 - sr() * 2.4); s.scale.set(1 + sr(), 0.5 + sr() * 0.5, 1); site.add(s);
    }
    const bone = this.mat('bone', { color: 0xd8d0c0, roughness: 0.8 });
    for (let i = 0; i < 6; i++) { const b = this.B(0.5 + sr() * 0.4, 0.05, 0.05, bone, -1 + sr() * 9, 0.03, -3.4 - sr() * 1.8, site); b.rotation.y = sr() * 3; }
    // a ribcage, half under snow
    for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 4, 10, Math.PI), bone); rib.position.set(5.2 + k * 0.1, 0.02, -4.2); rib.rotation.set(0, Math.PI / 2, 0); site.add(rib); }
    // the clawed aspen: thicker, right by the tape
    this.bare(7.4, -3.0, 1.12, 1);
    const claws = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.95), this.mat('claws', { map: clawTex(), transparent: true, alphaTest: 0.5, color: 0xffffff, roughness: 0.9 }));
    claws.position.set(7.4, 2.05, -2.86); site.add(claws);
    this.anchors.claws = new THREE.Vector3(7.4, 2.2, -2.8);
    // a weathered "MISSING" flyer stapled to a spruce at the trailhead
    const flyer = this.textSign('ПРОПАЛА', { w: 0.32, h: 0.42, bg: '#e8e2d4', fg: '#1a1a1a', font: 'bold 34px sans-serif' });
    flyer.position.set(-6.2, 1.55, -3.5); site.add(flyer);
    this.spruce(-6.2, -3.75, 0.85, this.root, 'tall');
    this.anchors.flyer = new THREE.Vector3(-6.2, 1.6, -3.4);
    this.anchors.river = new THREE.Vector3(2.0, 0.6, -6.0);
    this.anchors.tape = new THREE.Vector3(-4.6, 1.0, -2.2);
  }

  // ---------------------------------------------------------------- November (Lizzie's line)

  /** L1: three kill sites along the river, weeks before Julian's visit. */
  buildNovember() {
    const g = this.lizzyGroup = new THREE.Group(); this.root.add(g);
    const r = rng(810);
    const bush = this.mat('bushF', { color: 0x2a2a22, roughness: 1, flatShading: true });
    const bone = this.mat('bone', { color: 0xd8d0c0, roughness: 0.8 });
    // site A (south, x −10…−5): cleaned up — bones left in the bushes, claw marks, a snapped sapling
    g.add(spruceStand(Array.from({ length: 6 }, (_, i) => ({ x: -9.6 + i * 0.9, z: -2.9 - r() * 0.4, s: 0.16 + r() * 0.1, kind: 'young' })), { low: this.low, snow: 0.6, variant: 1 }));
    for (let i = 0; i < 7; i++) { const b = this.B(0.45, 0.05, 0.05, bone, -9.2 + r() * 3.2, 0.06, -2.55 - r() * 0.3, g); b.rotation.y = r() * 3; }
    const claws = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.95), this.mats.cache.get('claws') || this.mat('claws', { transparent: true }));
    claws.position.set(-6.2, 1.7, -3.55); g.add(claws);
    const sap = this.B(0.06, 1.2, 0.06, this.mat('twigF', { color: 0x3e342c, roughness: 1 }), -5.4, 0.35, -2.7, g); sap.rotation.z = 1.2;
    this.anchors.siteA = { bones: new THREE.Vector3(-8.0, 0.4, -2.6), claws: new THREE.Vector3(-6.2, 1.8, -3.4), sapling: new THREE.Vector3(-5.4, 0.6, -2.6) };
    // site B (x 12…17): carcasses rotting, ravens
    const rot = this.mat('rotting', { color: 0x5a4234, roughness: 0.9, flatShading: true });
    const torn = this.mat('torn', { color: 0x6a1c16, roughness: 0.7, flatShading: true });
    this.ravens = [];
    for (let i = 0; i < 4; i++) {
      const x = 12.4 + i * 1.3, z = -2.5 - (i % 2) * 0.6;
      const dm = new THREE.MeshLambertMaterial({ map: deerTex('dead', i % 2), transparent: true, alphaTest: 0.5, emissive: 0x1a1612, side: THREE.DoubleSide });
      const dg = new THREE.PlaneGeometry(1.6, 1.2); dg.translate(0, 0.6 - 0.62, 0);
      const c = new THREE.Mesh(dg, dm); c.position.set(x, 0, z); c.scale.x = i % 2 ? -1 : 1; g.add(c);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), this.mat('carcBlood', { color: 0x3a0e0a, roughness: 0.7, transparent: true, opacity: 0.7, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.scale.set(1.5, 0.7, 1); pool.position.set(x, 0.012, z + 0.1); g.add(pool);
      const ribM = this.mat('ribDull', { color: 0x8a6a5a, roughness: 0.8 });
      for (let k = 0; k < 3; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), ribM); rib.position.set(x - 0.2 + k * 0.08, 0.2, z); rib.rotation.y = Math.PI / 2; g.add(rib); }
    }
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshLambertMaterial({ map: ravenTex(0), transparent: true, alphaTest: 0.5 }));
      m.position.set(12.2 + r() * 5, 0.3, -2.2 - r() * 0.9); m.scale.x = r() < 0.5 ? -1 : 1; g.add(m);
      this.ravens.push({ m, x: m.position.x, ph: r() * 6, up: false });
    }
    this.anchors.siteB = { carcass: new THREE.Vector3(13.6, 0.5, -2.4), ravens: new THREE.Vector3(15.2, 0.6, -2.4) };
    // site C (x 22…27, the clearing above the river): fresh tracks going north
    const fp = this.mat('trackL1', { color: 0x6a7480, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
    for (let k = 0; k < 16; k++) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.09, 7), fp); f.rotation.x = -Math.PI / 2; f.position.set(21 + k * 0.45, 0.013, -1.9 - (k % 2) * 0.22); f.scale.y = 1.4; g.add(f); }
    this.anchors.siteC = { tracks: new THREE.Vector3(24.0, 0.3, -2.0), view: new THREE.Vector3(26.5, 1.2, -6.0) };
    // the herd for L2 (positioned by the story): deer and hares in the site
    this.herd = new THREE.Group(); this.root.add(this.herd);
    this.critters = [];
  }

  /** A deer / hare at (x, z); `pose` swaps its sprite. Returned so the story can move it. */
  critter(kind, x, z, coat = 0) {
    const tex = kind === 'deer' ? deerTex('stand', coat) : hareTex(coat % 2);
    const dusk = this.state === 'l2' || this.state === 'night';
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5, color: dusk ? 0x9aa0b4 : 0xffffff, emissive: dusk ? 0x0a0a0e : 0x2a2620 });
    const geo = kind === 'deer' ? new THREE.PlaneGeometry(1.6, 1.2) : new THREE.PlaneGeometry(0.42, 0.21);
    geo.translate(0, kind === 'deer' ? 0.6 : 0.1, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0, z);
    m.userData = { kind, coat, pose: 'stand', setPose: (p) => { if (kind !== 'deer') return; m.userData.pose = p; mat.map = deerTex(p, coat); mat.needsUpdate = true; } };
    const sh = new THREE.Mesh(new THREE.CircleGeometry(kind === 'deer' ? 0.55 : 0.18, 20), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.35, 1); sh.position.set(0, 0.015, 0.05); m.add(sh);
    this.herd.add(m);
    this.critters.push(m);
    return m;
  }

  clearHerd() { this.herd.clear(); this.critters = []; }

  // ---------------------------------------------------------------- the clearing (dusk)

  buildClearing() {
    // a snow-covered rock outcrop Julian crouches behind (only his head and shoulders show)
    for (const [x, y, z, sx, sy, sz, ry] of [[16.75, 0.0, -0.85, 0.85, 0.75, 0.65, 0.4], [17.75, 0.0, -0.8, 0.95, 0.95, 0.7, 1.1], [18.7, 0.0, -0.9, 0.8, 0.66, 0.62, 2.0], [17.3, 0.0, -0.45, 0.55, 0.36, 0.42, 0.7], [18.3, 0.0, -0.5, 0.48, 0.3, 0.4, 2.6]]) {
      const geo = rockGeometry(Math.round(x * 10), { detail: 4, rough: 0.3, flat: -0.05, snow: 0.6, sharp: 0.6, colA: 0x8e8a84, colB: 0x6e6a66, strata: 0.3 });
      const b = new THREE.Mesh(geo, this.rockMat); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.y = ry; this.root.add(b);
    }
    this.colliders.push({ x: 16.7, z: -0.75, r: 0.6 }, { x: 17.75, z: -0.7, r: 0.6 }, { x: 18.75, z: -0.8, r: 0.6 });
    this.hares = new THREE.Group();
    const hr = rng(370);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.21), new THREE.MeshLambertMaterial({ map: hareTex(i % 2), transparent: true, alphaTest: 0.5 }));
      m.position.set(21.6 + hr() * 2.6, 0.1, -11.7 - hr() * 0.5); m.scale.x = hr() < 0.5 ? -1 : 1;
      this.hares.add(m);
    }
    const blood = this.mat('freshBlood', { color: 0x6a0a0a, roughness: 0.6, transparent: true, opacity: 0.8, depthWrite: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.2 + hr() * 0.3, 8), blood); s.rotation.x = -Math.PI / 2; s.position.set(21.6 + hr() * 3, 0.03, -11.6 - hr() * 0.6); this.hares.add(s); }
    this.root.add(this.hares);
  }

  // ---------------------------------------------------------------- the cave

  buildCave() {
    const g = new THREE.Group();
    const r = rng(380);
    const rock = (seed, x, y, z, sx, sy, sz, ry = 0, snow = 0.55, o = {}) => {
      const b = new THREE.Mesh(rockGeometry(seed, { detail: 4, rough: 0.34, sharp: 0.8, snow, flat: -0.25, colA: 0x7a746e, colB: 0x5a5652, ...o }), this.rockMat);
      b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.y = ry; g.add(b); return b;
    };
    // the slope: big jumbled boulders rising to the right, snow lying on every ledge
    for (let i = 0; i < 16; i++) {
      const x = 31.5 + r() * 15, z = -4.6 - r() * 2.4;
      if (x > 40.2 && x < 44.2) continue; // keep the mouth clear
      const w = 0.6 + r() * 1.3, h = 0.4 + r() * 0.9 + (x - 31) * 0.04, d = 0.6 + r() * 0.8;
      rock(400 + i, x, 0, z, w, h, d, r() * 6);
    }
    // the cliff: a weathered face of stacked blocks, darker, spruces on top
    for (let i = 0; i < 10; i++) {
      const rad = 2.4 + r() * 1.2;
      rock(430 + i, 33 + i * 1.8, rad * 0.35 + r() * 0.5, -6.6 - rad - r() * 0.8, rad, rad * (0.9 + r() * 0.4), rad * 0.8, r() * 6, 0.45, { colA: 0x5e5a58, colB: 0x46423e, rough: 0.28 });
    }
    g.add(spruceStand(Array.from({ length: 7 }, (_, i) => ({ x: 33.5 + i * 2.3 + r(), z: -9.4 - r(), y: 4.4 + r() * 1.4, s: 0.55 + r() * 0.3, kind: 'young' })), { low: this.low, snow: 1, variant: 2 }));
    // footprints in the snow, leading inside: bare feet, and paws
    const fp = this.mat('caveFp', { color: 0x5a6678, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false });
    for (let k = 0; k < 12; k++) { const t = k / 11, f = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), fp); f.rotation.x = -Math.PI / 2; f.position.set(39.6 + t * 2.6 + (k % 2) * 0.18, 0.02, -2.2 - t * 3.3); f.scale.y = 2.4; f.rotation.z = -0.65; g.add(f); }
    // the mouth: a deep black opening framed by two weathered jambs and a heavy lintel
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    mouth.scale.set(1, 1.6, 1); mouth.position.set(42.2, 0.0, -5.74); g.add(mouth);
    rock(460, 40.35, 0, -5.5, 0.85, 2.6, 0.9, 0.4, 0.4);
    rock(461, 44.05, 0, -5.5, 0.95, 2.4, 0.9, 0.9, 0.4);
    rock(462, 42.2, 2.75, -5.55, 2.3, 0.85, 1.0, 0.2, 0.7);
    // icicles along the lintel
    const frost = this.mat('icicle', { color: 0xd8e4ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (let k = 0; k < 11; k++) { const x = 41.0 + k * 0.24, L = 0.12 + ((k * 7) % 4) * 0.08; const ic = new THREE.Mesh(new THREE.ConeGeometry(0.025 + (k % 3) * 0.01, L, 8), frost); ic.position.set(x, 2.15 - L / 2 - Math.abs(x - 42.2) * 0.12, -4.75); ic.rotation.x = Math.PI; g.add(ic); }
    // cold breath from the dark: faint mist at the mouth
    this.caveMist = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture(2), color: 0x8a96a8, transparent: true, opacity: 0.18, depthWrite: false }));
    this.caveMist.scale.set(4, 2, 1); this.caveMist.position.set(42.2, 0.7, -5.0); g.add(this.caveMist);
    // a cold moonlit wash on the rock face, so the dark mouth reads against it
    this.caveLight = new THREE.PointLight(0x9ab0d8, 0, 12, 1.2);
    this.caveLight.position.set(41.6, 6.0, -2.6); g.add(this.caveLight);
    this.root.add(g);
    this.anchors.caveMouth = new THREE.Vector3(42.2, 1.8, -5.0);
  }

  // ---------------------------------------------------------------- foreground

  buildForeground() {
    const fgGroup = (name) => { const g = new THREE.Group(); g.name = name; this.root.add(g); this.foregroundGroups.push(g); return g; };
    const r = rng(390);
    for (const x of [-12.6, 9.6, 21.2, 35.8]) {
      const g = fgGroup(`fg-birch-${x}`);
      if (r() < 0.6) this.bare(x + r() * 0.4, 3.4 + r() * 0.5, 1.2, 2, g);
      else g.add(spruceStand([{ x: x + r() * 0.4, z: 3.6 + r() * 0.4, s: 1.1, kind: 'tall', y: 0 }], { low: this.low, snow: 1, variant: 0, tint: 0x8a9098 }));
    }
    const brush = fgGroup('fg-brush');
    const dry = this.mat('dryGrassFg', { color: 0x9a8258, roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const x = -14 + r() * 62, z = 2.6 + r() * 0.5;
      for (let k = 0; k < 5; k++) { const h = 0.14 + r() * 0.22; const b = this.B(0.018, h, 0.018, dry, x + (r() - 0.5) * 0.18, h / 2, z, brush); b.rotation.z = (r() - 0.5) * 0.8; }
    }
  }

  // ---------------------------------------------------------------- light

  buildAtmosphere() {
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-14, 0, -6), new THREE.Vector3(46, 7, 4)), this.low ? 220 : 520);
    this.snow.speed = 0.5;
    this.root.add(this.snow.points);
    this.animated.push(this.snow);
    this.fog = new THREE.FogExp2(0xb4bcc4, 0.03);
    const hemi = new THREE.HemisphereLight(0xdfe6ee, 0x6a7078, 1.5);
    const sun = new THREE.DirectionalLight(0xf0ece4, 0.9);
    sun.position.set(-8, 10, 6);
    // a cold key that stays with Julian at dusk (he must stay readable)
    const key = new THREE.PointLight(0x9ab0d8, 0, 7, 1.4);
    // dusk: the last warm light low behind the far bank — a rim on the wolf and on Julian
    const rim = new THREE.DirectionalLight(0xd89a6a, 0);
    rim.position.set(30, 3, -30);
    this.root.add(hemi, sun, sun.target, key, rim);
    this.lights = { hemi, sun, key, rim };
    // low sun through the trunks: soft additive shafts, and long blue trunk shadows across the snow
    this.shafts = new THREE.Group(); this.root.add(this.shafts);
    const st = shaftTexture(), r = rng(395);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + r() * 1.8, 16), new THREE.MeshBasicMaterial({ map: st, color: 0xffd9a0, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      m.position.set(-14 + i * 4.2 + r() * 2, 5.5, -4.5 - r() * 7);
      m.rotation.z = -0.55 - r() * 0.12;
      m.userData = { base: 0.08 + r() * 0.12, ph: r() * 6 };
      this.shafts.add(m);
    }
    const shTex = canvasTexture('forest-shadowstrip', 16, 128, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.7, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const sg = ctx.createLinearGradient(0, 0, w, 0); sg.addColorStop(0, 'rgba(0,0,0,1)'); sg.addColorStop(0.3, 'rgba(0,0,0,0)'); sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
    }, { color: false });
    this.shadows = new THREE.Group(); this.root.add(this.shadows);
    const shM = new THREE.MeshBasicMaterial({ map: shTex, color: 0x34405a, transparent: true, opacity: 0.42, depthWrite: false, fog: false });
    for (let x = -16; x < 48; x += 1.3 + r() * 2.2) {
      if (x > 31 && x < 46) continue;
      const L = 7 + r() * 5, wd = 0.3 + r() * 0.35;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, L), shM);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -0.32 - r() * 0.1;
      const z0 = -4.2 - r() * 1.2;
      m.position.set(x + Math.sin(0.37) * L * 0.5, 0.02, z0 + L * 0.5 * Math.cos(0.37));
      this.shadows.add(m);
    }
  }

  setState(name) {
    this.state = name;
    const night = name === 'night';
    const nov = name === 'l1' || name === 'l2';
    this.bounds.walk.areas = night ? this.areasNight : name === 'l1' ? [{ minX: -12, maxX: 28, minZ: -2.3, maxZ: 1.5 }] : this.areasDay;
    this.bounds.camera = night ? { minX: -8, maxX: 40 } : name === 'l1' ? { minX: -8, maxX: 25 } : { minX: -8, maxX: 9 };
    this.siteGroup.visible = !nov;
    this.lizzyGroup.visible = name === 'l1';
    if (this.herd) this.herd.visible = name === 'l2';
    const L = this.lights;
    const dark = name === 'night' || name === 'l2';
    const golden = false;
    const grey = name === 'l1';                 // November afternoon: overcast, no snow on the ground yet
    // look per state: 'day' — grey mist and falling snow; 'l1' — low golden sun through the trunks;
    // 'l2' / 'night' — blue dusk, moon, fog over the water
    L.hemi.color.set(dark ? 0x5a6a8a : grey ? 0xb4bcc4 : 0xdfe6ee); L.hemi.groundColor.set(dark ? 0x1a1e28 : grey ? 0x3a3a30 : 0x6a7078);
    L.hemi.intensity = name === 'l2' ? 1.45 : dark ? 0.85 : grey ? 1.25 : 1.35;
    if (name === 'l2') { L.hemi.color.set(0x8a9ab8); L.hemi.groundColor.set(0x3a3e40); }
    L.sun.color.set(dark ? 0x8aa4d4 : grey ? 0xd8dce0 : 0xe8ecf0); L.sun.intensity = dark ? 0.7 : grey ? 0.4 : 0.55;
    if (golden) { L.sun.position.set(-26, 12, -40); L.sun.target.position.set(0, 0, 0); } else L.sun.position.set(dark ? 14 : -8, 10, dark ? -4 : 6);
    L.key.intensity = dark ? 3.2 : 0;
    L.rim.intensity = dark ? 1.4 : golden ? 0.8 : 0;
    L.rim.color.set(golden ? 0xffb070 : 0xd89a6a);
    L.rim.position.set(30, 3, -30);
    if (this.caveLight) this.caveLight.intensity = dark ? 11 : 3;
    this.background = dark ? 0x1a2232 : grey ? 0x8e949a : 0xa8b2bc;
    this.fog.color.set(name === 'l2' ? 0x56647a : dark ? 0x1e2838 : grey ? 0x8a9096 : 0xb4bcc4);
    this.fog.density = dark ? 0.028 : golden ? 0.016 : 0.025;
    if (name === 'l2') this.paintSky([[0, '#1a1e34'], [0.45, '#3e3c5e'], [0.62, '#6a5a78'], [0.72, '#9a7a72'], [0.8, '#7a6a72'], [1, '#4a4a5e']]);
    else if (dark) this.paintSky([[0, '#0c1222'], [0.45, '#22304e'], [0.6, '#46507a'], [0.68, '#7a6278'], [0.74, '#b07c5e'], [0.8, '#8a6258'], [1, '#3a3446']]);
    else if (grey) this.paintSky([[0, '#5e6268'], [0.45, '#8a8e94'], [0.8, '#a8acb0'], [1, '#b4b6b8']]);
    else this.paintSky([[0, '#7a8696'], [0.55, '#aab4c0'], [1, '#cdd2d8']]);
    if (this.tapeMat) this.tapeMat.emissive.set(dark ? 0x6a5600 : 0x2a2400);
    if (this.waterMat) this.waterMat.specular.set(nov ? 0x262c34 : 0x9aaabb);
    if (this.waterSky) this.waterSky.value.set(name === 'l2' ? 0x18202c : dark ? 0x2a3854 : grey ? 0x343a42 : 0x8a96a6);   // November water is black, not a bright strip
    this.mtn.material.color.set(dark ? 0x5a6884 : grey ? 0x6e7470 : 0xd8e0ea);
    this.far.material.color.set(dark ? 0x283246 : grey ? 0x3a4238 : 0x8e9aa4);
    this.far2.material.color.set(dark ? 0x1c2432 : grey ? 0x2a3228 : 0x6a7680);
    this.hazes.forEach((h, i) => { h.material.color.set(name === 'l2' ? 0x6a6a8a : dark ? 0x3a4a68 : grey ? 0x9aa0a6 : 0xdfe6ee); h.material.opacity = (dark ? [0.35, 0.25, 0.16] : [0.45, 0.35, 0.22])[i]; });
    this.banks.forEach((b) => { b.material.color.set(dark ? 0x46567a : grey ? 0xa4aab0 : 0xe4e8ee); b.material.opacity = dark ? 0.28 : 0.4; });
    this.lowFog.forEach((b) => { b.material.color.set(dark ? 0x3e4c66 : grey ? 0x9aa0a6 : 0xe8ecf0); b.material.opacity = dark ? 0.22 : grey ? 0.26 : 0.3; });
    // the ground follows the grade of the hour (the dusk is blue, not olive)
    this.groundAutumn.material.color.set(name === 'l2' ? 0xa8b4cc : 0xffffff);
    if (name === 'l2') { L.key.intensity = 5.5; L.rim.color.set(0x8aa4d8); L.rim.intensity = 2.2; L.rim.position.set(-6, 6, -20); }   // a cold sky rim on the herd and Lizzie
    this.undergrowth.material.color.set(name === 'l2' ? 0x8a96b4 : 0xffffff);
    // November (l1, l2): no snow on the ground or the branches yet
    const snowy = !nov;
    for (const st of this.allStands || []) setStandSnow(st, snowy ? 1 : 0);
    for (const g of this.snowGeos || []) setRockSnow(g, snowy);
    this.prints.visible = snowy;
    this.groundSnow.visible = snowy; this.groundAutumn.visible = !snowy;
    this.drifts.visible = snowy; this.snowBits.visible = snowy;
    this.undergrowth.visible = !snowy;
    this.pathMesh.material.map = snowy ? this.pathSnowTex : this.pathAutTex; this.pathMesh.material.needsUpdate = true;
    this.pathMesh.material.opacity = snowy ? 0.7 : 0.85;
    this.iceMat.color.set(snowy ? 0xffffff : 0x3e4852);            // November: thin dark ice, not snow
    for (const f of this.floes || []) f.visible = snowy;
    this.grassMass.visible = !snowy;
    this.fallenLeaves.visible = !snowy;
    this.snow.points.visible = name !== 'l1';
    this.moon.visible = this.moonGlow.visible = dark;
    this.sunDisc.visible = golden;
    this.shafts.visible = name === 'day';
    this.shafts.children.forEach((m) => m.material.color.set(golden ? 0xffd9a0 : 0xe8eef4));
    this.shadows.visible = false;
    this.snow.speed = name === 'day' ? 0.8 : name === 'l2' ? 0.35 : 0.5;
    this.hares.visible = name === 'night';
    this.caveMist.material.color.set(dark ? 0x6a7a98 : 0x8a96a8);
    this.steam.forEach((sp) => sp.material.color.set(name === 'l2' ? 0xa8b4cc : dark ? 0x6a7a98 : 0xe8eef4));
  }

  update(dt) {
    super.update(dt);
    if (this.lizzyGroup?.visible) {
      for (const rv of this.ravens) {
        const k = Math.sin(this.time * 1.3 + rv.ph);
        const up = k > 0.85;   // now and then a raven hops / flaps
        if (up !== rv.up) { rv.up = up; rv.m.material.map = ravenTex(up ? 1 : 0); rv.m.material.needsUpdate = true; }
        rv.m.position.y = 0.3 + (up ? 0.12 : 0);
      }
    }
    if (this.lights.key.intensity > 0 && this.followTarget) {
      const p = this.followTarget().position;
      this.lights.key.position.set(p.x + 0.8, 2.4, p.z + 2.0);
    }
    if (this.caveMist) this.caveMist.material.opacity = 0.14 + Math.sin(this.time * 0.7) * 0.05;
    // the river moves; steam breathes over it; fog banks drift; shafts flicker as branches sway
    if (this.riverRefl) this.riverRefl.material.uniforms.uTime.value = this.time;
    if (this.waterMat) { this.waterMat.normalMap.offset.x = this.time * 0.035; this.waterMat.normalMap.offset.y = Math.sin(this.time * 0.3) * 0.02; }
    const dark = this.state === 'night' || this.state === 'l2';
    for (const sp of this.steam) {
      sp.position.x += sp.userData.vx * dt; if (sp.position.x > 46) sp.position.x = -20;
      sp.material.opacity = sp.userData.base * (this.state === 'l2' ? 2.4 : dark ? 1.4 : 1) * (0.75 + 0.25 * Math.sin(this.time * 0.4 + sp.userData.ph));
    }
    for (const b of this.banks) { b.position.x += b.userData.vx * dt; if (b.position.x > 60) b.position.x = -24; }
    for (const b of this.lowFog) { b.position.x += b.userData.vx * dt; if (b.position.x > 50) b.position.x = -20; }
    if (this.shafts.visible) for (const m of this.shafts.children) m.material.opacity = m.userData.base * (this.state === 'l1' ? 1 : 0.45) * (0.7 + 0.3 * Math.sin(this.time * 0.5 + m.userData.ph));
  }
}
