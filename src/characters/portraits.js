/**
 * Procedural portraits for the dialogue screen (visual novel mode).
 * Everything is drawn with canvas paths and gradients — no image files.
 * Reference: semi-realistic painted busts (REF 07–09): soft shading,
 * thin dark line-art, muted palette, waist-up framing.
 *
 * paintPortrait(id, { expr, mouth, blink }) → HTMLCanvasElement (cached)
 */
import { rng } from '../render/textures.js';

const W = 640, H = 960;
const cache = new Map();

// ------------------------------------------------------------------ expressions

const EXPR = {
  neutral:   { eye: 1.0, look: [0, 0], brow: [0, 0], mouth: 'flat' },
  talk:      { eye: 1.0, look: [0, 0], brow: [0.05, 0], mouth: 'flat' },
  smile:     { eye: 0.78, look: [0, 0], brow: [-0.05, 0.05], mouth: 'smile' },
  smirk:     { eye: 0.85, look: [0, 0], brow: [0.1, 0], mouth: 'smirk' },
  concerned: { eye: 0.95, look: [0, 1], brow: [0.35, -0.2], mouth: 'frown' },
  sad:       { eye: 0.5, look: [0, 4], brow: [0.3, -0.25], mouth: 'frown' },
  surprised: { eye: 1.18, look: [0, -1], brow: [0.45, 0.2], mouth: 'o' },
  serious:   { eye: 0.82, look: [0, 0], brow: [-0.3, 0.1], mouth: 'flat' },
  tired:     { eye: 0.55, look: [0, 2], brow: [0.12, -0.1], mouth: 'flat' },
  dizzy:     { eye: 0.48, look: [3, 3], brow: [0.3, -0.35], mouth: 'open', pale: 1, sweat: 1, cross: true },
  pain:      { eye: 0.2, look: [0, 2], brow: [0.5, -0.4], mouth: 'grit', pale: 0.8, sweat: 1 },
};

export const EXPRESSIONS = Object.keys(EXPR);

// ------------------------------------------------------------------ helpers

function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function rg(ctx, x, y, r0, r1, stops, x1 = x, y1 = y) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function fillStroke(ctx, path, fill, stroke = 'rgba(30,18,14,0.85)', lw = 2.2) {
  ctx.fillStyle = fill;
  ctx.fill(path);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(path); }
}

function poly(points, close = true) {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
}

/** Smooth closed path through points (Catmull-Rom → Bézier). */
function smooth(points, close = true) {
  const p = new Path2D();
  const n = points.length;
  const get = (i) => points[(i + n) % n];
  p.moveTo(...points[0]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    if (!close && i === 0) p0[0] = p1[0];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  if (close) p.closePath();
  return p;
}

/** Tapered hair strand from root (x0,y0) to tip (x1,y1). */
function strandPath(x0, y0, x1, y1, bend, w) {
  const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
  const nx = -(y1 - y0), ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  const ox = (nx / len) * w, oy = (ny / len) * w;
  const p = new Path2D();
  p.moveTo(x0 - ox, y0 - oy);
  p.quadraticCurveTo(mx - ox * 0.7, my - oy * 0.7, x1, y1);
  p.quadraticCurveTo(mx + ox * 0.7, my + oy * 0.7, x0 + ox, y0 + oy);
  p.closePath();
  return p;
}

function hairStrands(ctx, list, pal, r) {
  for (const s of list) {
    const p = strandPath(...s);
    ctx.fillStyle = lg(ctx, s[0], s[1], s[2], s[3], [[0, pal.base], [0.55, r() < 0.35 ? pal.light : pal.base], [1, pal.dark]]);
    ctx.fill(p);
    ctx.strokeStyle = pal.line; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(p); ctx.globalAlpha = 1;
  }
}

function paperGrain(ctx, r, amount = 10) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ face parts

/** Head parts are authored around FACE; HEAD moves/scales them onto the body. */
const HEAD = { k: 1.2, dy: 44 };
function headSpace(ctx, fn) {
  ctx.save();
  ctx.translate(320, 382 + HEAD.dy);
  ctx.scale(HEAD.k, HEAD.k);
  ctx.translate(-320, -382);
  fn();
  ctx.restore();
}

const FACE = {
  cx: 320, eyeY: 268, eyeDX: 40, browY: 236, noseY: 306, mouthY: 340, chinY: 382,
};

function facePath(f, jaw = 1) {
  const { cx } = f;
  return smooth([
    [cx - 78, 200], [cx - 80, 262], [cx - 70, 312], [cx - 46 * jaw, 356], [cx - 16, f.chinY], [cx + 16, f.chinY],
    [cx + 46 * jaw, 356], [cx + 70, 312], [cx + 80, 262], [cx + 78, 200], [cx + 50, 150], [cx, 136], [cx - 50, 150],
  ]);
}

function drawNeck(ctx, skin) {
  const p = poly([[276, 360], [364, 360], [372, 452], [268, 452]]);
  ctx.fillStyle = lg(ctx, 0, 380, 0, 452, [[0, skin.shadow], [0.5, skin.base], [1, skin.shade]]);
  ctx.fill(p);
  ctx.strokeStyle = skin.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(276, 370); ctx.lineTo(270, 452); ctx.moveTo(364, 370); ctx.lineTo(370, 452); ctx.stroke();
}

function drawEars(ctx, skin) {
  for (const s of [-1, 1]) {
    const x = FACE.cx + s * 80;
    const p = smooth([[x, 248], [x + s * 14, 252], [x + s * 16, 280], [x + s * 6, 302], [x - s * 2, 296]]);
    fillStroke(ctx, p, skin.shade, skin.line, 1.8);
  }
}

function drawFace(ctx, skin, e, opts = {}) {
  const f = FACE;
  const face = facePath(f, opts.jaw ?? 1);
  // base + soft form shading (key light from the left)
  ctx.fillStyle = lg(ctx, f.cx - 90, 0, f.cx + 90, 0, [[0, skin.light], [0.45, skin.base], [1, skin.shade]]);
  ctx.fill(face);
  ctx.save();
  ctx.clip(face);
  // jaw/underside shadow
  ctx.fillStyle = rg(ctx, f.cx, 420, 10, 120, [[0, skin.shadow], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 300, W, 200);
  // cheek blush
  for (const s of [-1, 1]) {
    ctx.fillStyle = rg(ctx, f.cx + s * 46, 318, 2, 34, [[0, skin.blush], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(f.cx + s * 46 - 40, 278, 80, 80);
  }
  // hair shadow on forehead
  ctx.fillStyle = lg(ctx, 0, 140, 0, 250, [[0, skin.shadow], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 130, W, 130);
  if (e.pale) {
    ctx.fillStyle = `rgba(190,215,200,${0.32 * e.pale})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rg(ctx, f.cx, 290, 10, 70, [[0, `rgba(80,60,90,${0.25 * e.pale})`], [1, 'rgba(0,0,0,0)']]);
    for (const s of [-1, 1]) ctx.fillRect(f.cx + s * 40 - 40, 262, 80, 40);
  }
  ctx.restore();
  ctx.strokeStyle = skin.line; ctx.lineWidth = 2.4; ctx.stroke(face);
  return face;
}

function drawEye(ctx, x, y, side, iris, e, skin, blink) {
  const open = blink ? 0.04 : e.eye;
  const w = 26, h = 12.5 * open;
  const lx = e.look[0] * (e.cross ? side : 1), ly = e.look[1];
  // white
  const white = new Path2D();
  white.moveTo(x - w, y + 1);
  white.quadraticCurveTo(x - 4 * side, y - h * 1.5, x + w, y - 1 - (side > 0 ? 2 : 0));
  white.quadraticCurveTo(x + 2 * side, y + h * 1.1, x - w, y + 1);
  if (open > 0.1) {
    ctx.fillStyle = '#efe6df';
    ctx.fill(white);
    ctx.save();
    ctx.clip(white);
    // iris
    ctx.fillStyle = rg(ctx, x + lx, y + ly - 2, 1, 11, [[0, iris.light], [0.6, iris.base], [1, iris.dark]]);
    ctx.beginPath(); ctx.arc(x + lx, y + ly + 1, 12.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#120a08';
    ctx.beginPath(); ctx.arc(x + lx, y + ly + 1, 5, 0, Math.PI * 2); ctx.fill();
    // upper lid shadow
    ctx.fillStyle = 'rgba(70,40,30,0.45)';
    ctx.fillRect(x - w, y - 20, w * 2, 12 + 6 * (1 - open));
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x + lx - 4, y + ly - 4, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // upper lash line (thick, tapered)
  ctx.strokeStyle = '#1e120e';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - w - 2, y + 2);
  ctx.quadraticCurveTo(x - 4 * side, y - h * 1.55 - 1, x + w + 1, y - 2);
  ctx.stroke();
  // outer-corner wing
  const ox = side > 0 ? x + w : x - w;
  ctx.beginPath(); ctx.moveTo(ox, side > 0 ? y - 2 : y + 2); ctx.lineTo(ox + side * 7, y - 6); ctx.stroke();
  if (open > 0.1) {
    // lower lash line
    ctx.strokeStyle = 'rgba(60,30,24,0.6)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x - w + 4, y + 3); ctx.quadraticCurveTo(x, y + h * 1.15 + 1, x + w - 2, y); ctx.stroke();
  }
  // crease
  ctx.strokeStyle = skin.line; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - w + 3, y - 9 - 4 * open); ctx.quadraticCurveTo(x, y - 17 - 5 * open, x + w - 2, y - 10 - 3 * open); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBrows(ctx, e, color, thick = 1) {
  const [inner, outer] = e.brow;
  for (const s of [-1, 1]) {
    const x = FACE.cx + s * FACE.eyeDX;
    const y = FACE.browY;
    const xi = x - s * 22, xo = x + s * 26;
    const yi = y - inner * 14 + (inner < 0 ? -inner * 4 : 0);
    const yo = y - outer * 10 + 2;
    const p = new Path2D();
    p.moveTo(xi, yi + 3 * thick);
    p.quadraticCurveTo(x, y - 7 - inner * 4, xo, yo);
    p.quadraticCurveTo(x, y - 2 - inner * 4, xi, yi - 3 * thick);
    p.closePath();
    ctx.fillStyle = color; ctx.fill(p);
    ctx.strokeStyle = color; ctx.lineWidth = 2 * thick; ctx.stroke(p);
  }
}

function drawNose(ctx, skin, big = 1) {
  const x = FACE.cx, y = FACE.noseY;
  ctx.strokeStyle = skin.line; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.moveTo(x + 4, y - 30 * big); ctx.quadraticCurveTo(x + 10, y - 6, x + 6, y + 2); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = skin.shadow;
  ctx.beginPath(); ctx.ellipse(x - 2, y + 4, 12 * big, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,20,16,0.7)';
  ctx.beginPath(); ctx.ellipse(x - 7, y + 4, 3, 1.6, 0.3, 0, Math.PI * 2); ctx.ellipse(x + 6, y + 4, 3, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();
}

function drawMouth(ctx, kind, open, skin, lipColor) {
  const x = FACE.cx + 1, y = FACE.mouthY;
  ctx.lineCap = 'round';
  const line = (fn) => { ctx.strokeStyle = 'rgba(70,30,26,0.9)'; ctx.lineWidth = 2.4; ctx.beginPath(); fn(); ctx.stroke(); };
  if (open || kind === 'o' || kind === 'open' || kind === 'grit') {
    const h = kind === 'o' ? 12 : kind === 'grit' ? 6 : open ? 9 : 7;
    const w = kind === 'o' ? 10 : 19;
    const p = new Path2D();
    p.moveTo(x - w, y);
    p.quadraticCurveTo(x, y - 4, x + w, y);
    p.quadraticCurveTo(x, y + h * 1.6, x - w, y);
    ctx.fillStyle = '#4a1a18'; ctx.fill(p);
    if (kind === 'grit') { ctx.fillStyle = '#e8ddd2'; ctx.fillRect(x - w + 4, y - 1, w * 2 - 8, 4); }
    else { ctx.fillStyle = 'rgba(230,220,210,0.85)'; ctx.fillRect(x - w * 0.6, y - 1, w * 1.2, 2.5); }
    ctx.strokeStyle = 'rgba(60,24,20,0.9)'; ctx.lineWidth = 2; ctx.stroke(p);
    ctx.fillStyle = lipColor; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.ellipse(x, y + h * 1.0 + 4, w * 0.6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    return;
  }
  if (kind === 'smile') line(() => { ctx.moveTo(x - 20, y - 3); ctx.quadraticCurveTo(x, y + 9, x + 20, y - 4); });
  else if (kind === 'smirk') line(() => { ctx.moveTo(x - 16, y + 1); ctx.quadraticCurveTo(x + 4, y + 4, x + 20, y - 5); });
  else if (kind === 'frown') line(() => { ctx.moveTo(x - 18, y + 3); ctx.quadraticCurveTo(x, y - 3, x + 18, y + 3); });
  else line(() => { ctx.moveTo(x - 18, y); ctx.quadraticCurveTo(x, y + 3, x + 18, y); });
  // lower lip hint
  ctx.fillStyle = lipColor; ctx.globalAlpha = 0.45;
  ctx.beginPath(); ctx.ellipse(x, y + 9, 12, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSweat(ctx, e) {
  if (!e.sweat) return;
  ctx.fillStyle = 'rgba(220,235,255,0.75)';
  ctx.strokeStyle = 'rgba(90,110,130,0.6)'; ctx.lineWidth = 1;
  for (const [x, y, s] of [[398, 222, 1], [252, 290, 0.8], [390, 300, 0.7]]) {
    const p = new Path2D();
    p.moveTo(x, y - 10 * s); p.quadraticCurveTo(x + 6 * s, y, x, y + 6 * s); p.quadraticCurveTo(x - 6 * s, y, x, y - 10 * s);
    ctx.fill(p); ctx.stroke(p);
  }
}

function drawFaceFeatures(ctx, e, look, opts) {
  const { skin, iris, brow, lip, blink, mouthOpen } = opts;
  drawEye(ctx, FACE.cx - FACE.eyeDX, FACE.eyeY, -1, iris, e, skin, blink);
  drawEye(ctx, FACE.cx + FACE.eyeDX, FACE.eyeY, 1, iris, e, skin, blink);
  drawBrows(ctx, e, brow, opts.browThick ?? 1);
  drawNose(ctx, skin, opts.nose ?? 1);
  if (!opts.noMouth) drawMouth(ctx, e.mouth, mouthOpen, skin, lip);
  drawSweat(ctx, e);
}

// ------------------------------------------------------------------ clothing pieces

function torsoPath() {
  return smooth([[320, 432], [190, 452], [122, 480], [96, 540], [92, 700], [98, 960], [542, 960], [548, 700], [544, 540], [518, 480], [450, 452]]);
}

/** Arms hanging along the body (hands in pockets), drawn over the torso. */
function arms(ctx, pal) {
  for (const s of [-1, 1]) {
    const x = 320 + s * 222;
    const arm = smooth([[x - s * 4, 486], [x + s * 24, 560], [x + s * 30, 720], [x + s * 22, 960], [x - s * 70, 960], [x - s * 64, 760], [x - s * 58, 600], [x - s * 40, 520]]);
    ctx.fillStyle = lg(ctx, x + s * 30, 0, x - s * 70, 0, s < 0
      ? [[0, pal.light], [0.6, pal.base], [1, pal.shade]]
      : [[0, pal.dark], [0.6, pal.shade], [1, pal.base]]);
    ctx.fill(arm);
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2.4; ctx.stroke(arm);
    // elbow crease + inner-arm shadow
    ctx.strokeStyle = pal.fold; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - s * 50, 700); ctx.quadraticCurveTo(x - s * 20, 690, x + s * 10, 712); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 40, 740); ctx.quadraticCurveTo(x - s * 14, 732, x + s * 8, 748); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill(smooth([[x - s * 58, 600], [x - s * 64, 760], [x - s * 70, 960], [x - s * 86, 960], [x - s * 80, 700]]));
  }
}

/** Fine hair texture lines clipped to a hair shape. */
function hairTexture(ctx, path, color, r, count = 60, dir = 1) {
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    const x = 200 + r() * 240, y = 80 + r() * 140;
    ctx.globalAlpha = 0.25 + r() * 0.35;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dir * (r() - 0.3) * 30, y + 60, x + (r() - 0.5) * 30, y + 120 + r() * 80); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function trench(ctx, pal, { open = 1, epaulette = true } = {}) {
  const body = torsoPath();
  ctx.fillStyle = lg(ctx, 80, 0, 560, 0, [[0, pal.light], [0.35, pal.base], [0.75, pal.shade], [1, pal.dark]]);
  ctx.fill(body);
  ctx.strokeStyle = pal.line; ctx.lineWidth = 2.6; ctx.stroke(body);
  // folds
  ctx.strokeStyle = pal.fold; ctx.lineWidth = 2;
  for (const [x0, y0, x1, y1, b] of [[150, 620, 130, 940, -20], [190, 700, 210, 960, 15], [480, 640, 500, 950, 20], [440, 720, 430, 960, -10]]) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + b, (y0 + y1) / 2, x1, y1); ctx.stroke();
  }
  arms(ctx, pal);
  if (epaulette) {
    for (const s of [-1, 1]) {
      const x = 320 + s * 148;
      const p = poly([[x - s * 54, 476], [x + s * 22, 500], [x + s * 18, 518], [x - s * 58, 494]]);
      fillStroke(ctx, p, pal.shade, pal.line, 2);
      ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.arc(x - s * 40, 490, 4, 0, 7); ctx.fill();
    }
  }
  // big lapels / collar opening onto the inner layer
  const inner = poly([[320, 452], [258, 470], [236, 560], [262, 960], [380, 960], [404, 560], [382, 470]]);
  return inner;
}

function lapels(ctx, pal, depthY = 640) {
  for (const s of [-1, 1]) {
    const p = poly([
      [320 + s * 30, 446], [320 + s * 92, 456], [320 + s * 120, 506], [320 + s * 78, 540], [320 + s * 92, 572], [320 + s * 26, depthY],
    ]);
    ctx.fillStyle = lg(ctx, 320 + s * 120, 456, 320, depthY, [[0, s < 0 ? pal.light : pal.shade], [1, pal.base]]);
    ctx.fill(p);
    ctx.strokeStyle = pal.line; ctx.lineWidth = 2.2; ctx.stroke(p);
    ctx.strokeStyle = pal.fold; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(320 + s * 84, 468); ctx.lineTo(320 + s * 104, 504); ctx.stroke();
  }
}

function shirtAndTie(ctx, shirt, tie, { tieBar = false, collarDark = false } = {}) {
  const sp = poly([[320, 436], [282, 446], [272, 640], [368, 640], [358, 446]]);
  ctx.fillStyle = lg(ctx, 270, 0, 370, 0, [[0, shirt.light], [0.6, shirt.base], [1, shirt.shade]]);
  ctx.fill(sp);
  // collar points
  for (const s of [-1, 1]) {
    const c = poly([[320, 452], [320 + s * 40, 432], [320 + s * 44, 470], [320 + s * 12, 488]]);
    fillStroke(ctx, c, collarDark ? shirt.base : shirt.light, 'rgba(40,30,30,0.7)', 1.6);
  }
  // tie
  const knot = poly([[308, 462], [332, 462], [328, 490], [312, 490]]);
  fillStroke(ctx, knot, tie.base, 'rgba(10,10,14,0.9)', 1.6);
  const blade = poly([[312, 490], [328, 490], [342, 640], [320, 668], [298, 640]]);
  ctx.fillStyle = lg(ctx, 300, 0, 340, 0, [[0, tie.light], [0.5, tie.base], [1, tie.dark]]);
  ctx.fill(blade);
  ctx.strokeStyle = 'rgba(10,10,14,0.9)'; ctx.lineWidth = 1.6; ctx.stroke(blade);
  if (tieBar) { ctx.fillStyle = '#b8b8c0'; ctx.fillRect(296, 560, 48, 5); }
}

function scarf(ctx, r) {
  // long red knitted scarf: wrap around the neck + two hanging tails with fringe
  const base = '#7a161a', light = '#9a2a2a', dark = '#4a0c10', line = 'rgba(30,6,8,0.9)';
  const tailL = smooth([[262, 452], [300, 470], [292, 600], [276, 760], [232, 762], [226, 600], [234, 480]]);
  const tailR = smooth([[360, 452], [404, 470], [416, 620], [418, 790], [372, 792], [362, 630], [350, 486]]);
  for (const p of [tailR, tailL]) {
    ctx.fillStyle = lg(ctx, 220, 450, 420, 800, [[0, light], [0.5, base], [1, dark]]);
    ctx.fill(p); ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.stroke(p);
  }
  const wrap = smooth([[236, 420], [320, 456], [404, 420], [416, 470], [320, 506], [226, 470]]);
  ctx.fillStyle = lg(ctx, 0, 410, 0, 510, [[0, light], [1, dark]]);
  ctx.fill(wrap); ctx.strokeStyle = line; ctx.stroke(wrap);
  const wrap2 = smooth([[250, 448], [330, 478], [410, 452], [400, 492], [320, 520], [244, 484]]);
  ctx.fillStyle = lg(ctx, 0, 440, 0, 520, [[0, base], [1, dark]]);
  ctx.fill(wrap2); ctx.stroke(wrap2);
  // knit ribs
  ctx.strokeStyle = 'rgba(30,4,6,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(236 + i * 6, 490); ctx.quadraticCurveTo(250 + i * 5, 620, 236 + i * 5, 760); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(364 + i * 6, 490); ctx.quadraticCurveTo(372 + i * 6, 640, 376 + i * 5, 790); ctx.stroke();
  }
  // fringe
  ctx.strokeStyle = base; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath(); ctx.moveTo(234 + i * 7, 760); ctx.lineTo(232 + i * 7 + (r() - 0.5) * 6, 800 + r() * 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(374 + i * 6, 790); ctx.lineTo(372 + i * 6 + (r() - 0.5) * 6, 830 + r() * 14); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,4,6,0.6)'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(236 + i * 7, 762); ctx.lineTo(236 + i * 7, 790); ctx.stroke(); }
}

// ------------------------------------------------------------------ characters

const PAINTERS = {
  julian(ctx, e, o) {
    const r = rng(7);
    const skin = { base: '#ecd3c3', light: '#f6e4d8', shade: '#d4ae9b', shadow: 'rgba(150,95,80,0.55)', blush: 'rgba(225,140,130,0.16)', line: 'rgba(110,60,48,0.9)' };
    const hair = { base: '#6e4a32', light: '#9c7350', dark: '#3a2418', line: 'rgba(40,22,14,0.7)' };
    const coat = { base: '#c8b496', light: '#ddcdb2', shade: '#a8936f', dark: '#86724f', line: 'rgba(70,52,34,0.9)', fold: 'rgba(110,90,62,0.6)' };
    const suit = { base: '#9a9a9e', light: '#b8b8bc', shade: '#77777c', dark: '#5a5a60', line: 'rgba(40,40,46,0.9)', fold: 'rgba(70,70,76,0.6)' };

    // back hair mass
    headSpace(ctx, () => {
      ctx.fillStyle = hair.dark;
      ctx.fill(smooth([[224, 210], [236, 130], [320, 96], [404, 130], [418, 220], [404, 320], [376, 352], [264, 352], [236, 320]]));
    });
    trench(ctx, coat);
    // inner suit (double-breasted grey)
    ctx.save(); ctx.clip(poly([[320, 440], [230, 470], [214, 960], [426, 960], [410, 470]]));
    ctx.fillStyle = lg(ctx, 214, 0, 426, 0, [[0, suit.light], [0.5, suit.base], [1, suit.shade]]);
    ctx.fillRect(0, 430, W, 540);
    ctx.restore();
    lapels(ctx, suit, 610);
    shirtAndTie(ctx, { base: '#e6e2dc', light: '#f4f2ee', shade: '#bdb7b0' }, { base: '#1d2238', light: '#2c3452', dark: '#10131f' });
    // suit buttons
    ctx.fillStyle = '#3a3a40';
    for (const [x, y] of [[296, 690], [344, 690], [296, 760], [344, 760]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); }
    // trench lapels over the suit
    for (const s of [-1, 1]) {
      const p = poly([[320 + s * 70, 452], [320 + s * 150, 470], [320 + s * 176, 540], [320 + s * 120, 600], [320 + s * 108, 960], [320 + s * 86, 960], [320 + s * 92, 560]]);
      ctx.fillStyle = lg(ctx, 320 + s * 176, 0, 320 + s * 86, 0, [[0, s < 0 ? coat.light : coat.shade], [1, coat.base]]);
      ctx.fill(p); ctx.strokeStyle = coat.line; ctx.lineWidth = 2.4; ctx.stroke(p);
    }
    drawNeck(ctx, skin);
    scarf(ctx, r);
    headSpace(ctx, () => {
      drawEars(ctx, skin);
      drawFace(ctx, skin, e, { jaw: 0.95 });
      drawFaceFeatures(ctx, e, null, { ...o, skin, iris: { base: '#8a3a2a', light: '#c0704a', dark: '#3a1410' }, brow: '#4a3020', lip: '#c48478' });
      // messy fringe that falls over the eyes
      const fr = [];
      for (let i = 0; i < 26; i++) {
        const rootX = 236 + i * 7 + r() * 8, rootY = 118 + r() * 30;
        const tipX = rootX + (r() - 0.5) * 60 + (rootX < 320 ? -14 : 14);
        const tipY = 230 + r() * 70;
        fr.push([rootX, rootY, tipX, tipY, (r() - 0.5) * 40, 7 + r() * 7]);
      }
      for (let i = 0; i < 10; i++) {
        const left = i < 5;
        const rx = left ? 236 + r() * 20 : 384 + r() * 20;
        fr.push([rx, 170 + r() * 40, rx + (left ? -16 : 16) + (r() - 0.5) * 10, 320 + r() * 50, (r() - 0.5) * 20, 8]);
      }
      // crown volume
      ctx.fillStyle = lg(ctx, 0, 90, 0, 200, [[0, hair.light], [1, hair.base]]);
      ctx.fill(smooth([[228, 220], [236, 140], [290, 102], [360, 100], [412, 140], [418, 220], [380, 170], [320, 150], [262, 170]]));
      hairStrands(ctx, fr, hair, r);
      // flyaways
      ctx.strokeStyle = hair.base; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = 240 + r() * 160;
        ctx.beginPath(); ctx.moveTo(x, 110); ctx.quadraticCurveTo(x + (r() - 0.5) * 40, 80, x + (r() - 0.5) * 50, 70 + r() * 20); ctx.stroke();
      }
    });
  },

  kayden(ctx, e, o) {
    const r = rng(19);
    const skin = { base: '#b98468', light: '#cf9c80', shade: '#966246', shadow: 'rgba(90,50,34,0.6)', blush: 'rgba(170,90,70,0.25)', line: 'rgba(70,36,24,0.95)' };
    const hair = { base: '#231c1a', light: '#4a3c36', dark: '#0e0a09', line: 'rgba(8,6,6,0.8)' };
    const coat = { base: '#6c5d50', light: '#837262', shade: '#54473c', dark: '#3e342c', line: 'rgba(28,22,18,0.95)', fold: 'rgba(40,32,26,0.6)' };

    headSpace(ctx, () => {
      ctx.fillStyle = hair.dark;
      ctx.fill(smooth([[226, 220], [236, 130], [320, 96], [404, 128], [416, 230], [404, 352], [372, 376], [268, 376], [236, 352]]));
    });
    const inner = trench(ctx, coat);
    ctx.save(); ctx.clip(inner);
    ctx.fillStyle = lg(ctx, 230, 0, 410, 0, [[0, '#2a2a2e'], [0.5, '#1c1c20'], [1, '#121214']]);
    ctx.fillRect(0, 430, W, 540);
    // shirt pockets + badge
    ctx.strokeStyle = 'rgba(70,70,80,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(254, 560, 52, 50); ctx.strokeRect(336, 560, 52, 50);
    ctx.restore();
    shirtAndTie(ctx, { base: '#1d1d22', light: '#2c2c32', shade: '#141418' }, { base: '#121214', light: '#24242a', dark: '#060608' }, { tieBar: true, collarDark: true });
    // badge
    const bx = 372, by = 560;
    ctx.fillStyle = rg(ctx, bx - 4, by - 4, 2, 24, [[0, '#f0d890'], [0.6, '#b89040'], [1, '#6a4a18']]);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const rr = i % 2 ? 16 : 22; ctx.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#6a4a18'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
    // duty belt
    ctx.fillStyle = '#121010'; ctx.fillRect(236, 850, 170, 34);
    ctx.fillStyle = '#9a9aa0'; ctx.fillRect(300, 848, 40, 38); ctx.fillStyle = '#121010'; ctx.fillRect(308, 856, 24, 22);
    // coat lapels
    for (const s of [-1, 1]) {
      const p = poly([[320 + s * 62, 446], [320 + s * 150, 466], [320 + s * 180, 548], [320 + s * 124, 610], [320 + s * 112, 960], [320 + s * 82, 960], [320 + s * 88, 560]]);
      ctx.fillStyle = lg(ctx, 320 + s * 180, 0, 320 + s * 82, 0, [[0, s < 0 ? coat.light : coat.shade], [1, coat.base]]);
      ctx.fill(p); ctx.strokeStyle = coat.line; ctx.lineWidth = 2.4; ctx.stroke(p);
    }
    drawNeck(ctx, skin);
    headSpace(ctx, () => {
      drawEars(ctx, skin);
      const face = drawFace(ctx, skin, e, { jaw: 1.12 });
      // stubble
      ctx.save(); ctx.clip(face);
      ctx.fillStyle = 'rgba(30,20,18,0.28)';
      for (let i = 0; i < 900; i++) {
        const x = 250 + r() * 140, y = 300 + r() * 90;
        if (Math.abs(x - 320) < 30 && y < 330) continue;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
      ctx.fillStyle = rg(ctx, 320, 360, 10, 90, [[0, 'rgba(40,28,24,0.25)'], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(220, 290, 200, 110);
      ctx.restore();
      // nasolabial / age lines
      ctx.strokeStyle = 'rgba(80,40,28,0.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(296, 304); ctx.quadraticCurveTo(286, 326, 292, 346); ctx.moveTo(348, 304); ctx.quadraticCurveTo(358, 326, 350, 346); ctx.stroke();
      drawFaceFeatures(ctx, { ...e, brow: [e.brow[0] - 0.15, e.brow[1]] }, null, {
        ...o, skin, iris: { base: '#4a3a2a', light: '#7a6448', dark: '#1a120a' }, brow: '#1a1210', lip: '#8a5244', browThick: 1.6, nose: 1.15,
      });
      // moustache (over the upper lip)
      const mx = 321, my = 326;
      const must = smooth([[mx, my - 6], [mx + 22, my - 8], [mx + 42, my + 2], [mx + 44, my + 14], [mx + 30, my + 8], [mx + 10, my + 6], [mx, my + 8], [mx - 10, my + 6], [mx - 30, my + 8], [mx - 44, my + 14], [mx - 42, my + 2], [mx - 22, my - 8]]);
      ctx.fillStyle = lg(ctx, 0, my - 8, 0, my + 14, [[0, '#2e2420'], [1, '#110c0a']]);
      ctx.fill(must);
      ctx.strokeStyle = 'rgba(70,56,48,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) { const x = mx - 40 + i * 4.6; ctx.beginPath(); ctx.moveTo(x, my - 4); ctx.lineTo(x + (x < mx ? -3 : 3), my + 8); ctx.stroke(); }
      // curly hair: swept back with curls at the hairline and nape
      ctx.fillStyle = hair.base;
      ctx.fill(smooth([[230, 236], [236, 150], [300, 106], [370, 110], [414, 156], [416, 236], [392, 196], [330, 168], [262, 196]]));
      for (let i = 0; i < 70; i++) {
        const a = Math.PI * (0.95 + r() * 1.1);
        const rad = 84 + r() * 26;
        const x = 320 + Math.cos(a) * rad * 1.05, y = 210 + Math.sin(a) * rad * 0.95;
        const cr = 8 + r() * 9;
        ctx.fillStyle = r() < 0.3 ? hair.light : hair.base;
        ctx.beginPath(); ctx.arc(x, y, cr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hair.line; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, cr * 0.7, a, a + 3.6); ctx.stroke();
      }
      // a few loose curls on the forehead + nape curls
      for (const [x, y] of [[236, 300], [404, 300], [244, 334], [398, 334]]) {
        ctx.strokeStyle = hair.base; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y, 8, 0.5, 4.6); ctx.stroke();
      }
      // sideburns
      ctx.fillStyle = hair.base;
      ctx.globalAlpha = 0.8;
      ctx.fill(poly([[242, 236], [250, 236], [248, 284], [243, 288]]));
      ctx.fill(poly([[398, 236], [390, 236], [392, 284], [397, 288]]));
      ctx.globalAlpha = 1;
    });
  },

  waiter(ctx, e, o) {
    const r = rng(31);
    const skin = { base: '#ead3c8', light: '#f5e4dc', shade: '#cfae9f', shadow: 'rgba(140,90,80,0.5)', blush: 'rgba(220,130,120,0.15)', line: 'rgba(100,58,48,0.9)' };
    const hair = { base: '#2c2220', light: '#4c3c36', dark: '#140e0c', line: 'rgba(10,6,6,0.75)' };
    headSpace(ctx, () => {
      ctx.fillStyle = hair.dark;
      ctx.fill(smooth([[218, 230], [228, 130], [320, 92], [412, 126], [424, 240], [416, 350], [388, 380], [256, 380], [226, 350]]));
    });
    // white shirt with soft folds
    const body = torsoPath();
    ctx.fillStyle = lg(ctx, 80, 0, 560, 0, [[0, '#f2eeea'], [0.5, '#dcd6d0'], [1, '#aaa39c']]);
    ctx.fill(body); ctx.strokeStyle = 'rgba(70,64,60,0.8)'; ctx.lineWidth = 2.2; ctx.stroke(body);
    ctx.strokeStyle = 'rgba(140,130,124,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 110 + r() * 60, y = 560 + r() * 300;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y + 20, x + 50, y + 70); ctx.stroke();
      const x2 = 470 + r() * 60;
      ctx.beginPath(); ctx.moveTo(x2, y); ctx.quadraticCurveTo(x2 - 26, y + 24, x2 - 40, y + 70); ctx.stroke();
    }
    // black vest
    arms(ctx, { base: '#dcd6d0', light: '#f2eeea', shade: '#b8b0a8', dark: '#9a928a', line: 'rgba(70,64,60,0.8)', fold: 'rgba(140,130,124,0.55)' });
    const vest = poly([[250, 452], [196, 520], [190, 960], [450, 960], [444, 520], [390, 452], [350, 470], [320, 640], [290, 470]]);
    ctx.fillStyle = lg(ctx, 190, 0, 450, 0, [[0, '#2a2628'], [0.5, '#181516'], [1, '#0c0a0b']]);
    ctx.fill(vest); ctx.strokeStyle = '#050404'; ctx.lineWidth = 2.4; ctx.stroke(vest);
    shirtAndTie(ctx, { base: '#e8e4e0', light: '#f6f4f2', shade: '#c0bab4' }, { base: '#111012', light: '#25232a', dark: '#050505' });
    // re-draw vest fronts over the shirt opening edges
    for (const s of [-1, 1]) {
      const p = poly([[320 + s * 40, 470], [320 + s * 2, 650], [320 + s * 2, 960], [320 + s * 130, 960], [320 + s * 124, 520], [320 + s * 70, 452]]);
      ctx.fillStyle = lg(ctx, 320, 0, 320 + s * 130, 0, [[0, '#221e20'], [1, s < 0 ? '#2e2a2c' : '#0e0c0d']]);
      ctx.fill(p); ctx.strokeStyle = '#050404'; ctx.lineWidth = 2; ctx.stroke(p);
    }
    ctx.fillStyle = '#3a3438';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(330, 690 + i * 60, 5, 0, 7); ctx.fill(); }
    // apron band
    ctx.fillStyle = '#0a0909'; ctx.fillRect(190, 900, 260, 60);
    drawNeck(ctx, skin);
    headSpace(ctx, () => {
      drawEars(ctx, skin);
      const face = drawFace(ctx, skin, e, { jaw: 0.92 });
      // freckles
      ctx.save(); ctx.clip(face);
      ctx.fillStyle = 'rgba(150,90,70,0.55)';
      for (let i = 0; i < 46; i++) {
        const s = r() < 0.5 ? -1 : 1;
        const x = 320 + s * (8 + r() * 52), y = 282 + r() * 34;
        ctx.beginPath(); ctx.arc(x, y, 1 + r() * 1.3, 0, 7); ctx.fill();
      }
      ctx.restore();
      drawFaceFeatures(ctx, e, null, { ...o, skin, iris: { base: '#8a98a2', light: '#c4d0d8', dark: '#3c464e' }, brow: '#2a201c', lip: '#c8857a' });
      // wavy hair with side part, falling to the jaw
      const fr = [];
      for (let i = 0; i < 18; i++) {
        const rootX = 290 + r() * 30, rootY = 112 + r() * 12;
        const toLeft = i < 12;
        const tipX = toLeft ? 228 + r() * 70 : 360 + r() * 50;
        const tipY = toLeft ? 210 + r() * 120 : 200 + r() * 60;
        fr.push([rootX, rootY, tipX, tipY, (toLeft ? -1 : 1) * (14 + r() * 26), 9 + r() * 6]);
      }
      for (let i = 0; i < 12; i++) {
        const left = i % 2 === 0;
        const rx = left ? 232 + r() * 12 : 396 + r() * 12;
        fr.push([rx, 180 + r() * 50, rx + (left ? -12 : 12) + (r() - 0.5) * 16, 360 + r() * 50, (left ? -1 : 1) * 18, 9]);
      }
      ctx.fillStyle = lg(ctx, 0, 90, 0, 220, [[0, hair.light], [1, hair.base]]);
      ctx.fill(smooth([[226, 230], [232, 146], [300, 102], [366, 104], [416, 150], [420, 230], [380, 180], [310, 160], [260, 186]]));
      hairStrands(ctx, fr, hair, r);
    });
  },
};

// ------------------------------------------------------------------ public API

/**
 * @param {string} id        julian | kayden | waiter
 * @param {object} state     { expr, mouth (bool, lip-flap), blink (bool) }
 */
export function paintPortrait(id, { expr = 'neutral', mouth = false, blink = false } = {}) {
  const key = `${id}|${expr}|${mouth}|${blink}`;
  if (cache.has(key)) return cache.get(key);
  const painter = PAINTERS[id];
  if (!painter) return null;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const e = EXPR[expr] || EXPR.neutral;
  ctx.save();
  // subtle head/body lean per expression gives life
  if (expr === 'dizzy') { ctx.translate(320, 900); ctx.rotate(-0.04); ctx.translate(-320, -900); }
  painter(ctx, e, { blink, mouthOpen: mouth });
  ctx.restore();
  // painterly finish: warm key light from the left, cool rim on the right
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = lg(ctx, 0, 0, W, 0, [[0, 'rgba(255,190,120,0.12)'], [0.45, 'rgba(0,0,0,0)'], [0.62, 'rgba(20,10,20,0.10)'], [1, 'rgba(40,40,80,0.28)']]);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lg(ctx, 0, H * 0.55, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(10,4,4,0.45)']]);
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  paperGrain(ctx, rng(3), 9);
  cache.set(key, c);
  return c;
}

export function hasPortrait(id) { return !!PAINTERS[id]; }

/** Silhouette used for characters whose face is not revealed yet (Owen). */
export function paintSilhouette() {
  const key = 'silhouette';
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = lg(ctx, 0, 0, W, 0, [[0, '#0d0b0e'], [1, '#1a161c']]);
  ctx.fill(torsoPath());
  ctx.fill(facePath(FACE, 1.05));
  ctx.fill(smooth([[226, 230], [236, 120], [320, 92], [404, 120], [414, 230], [400, 180], [320, 150], [240, 180]]));
  ctx.fill(poly([[282, 330], [358, 330], [366, 452], [274, 452]]));
  ctx.strokeStyle = 'rgba(140,40,50,0.35)'; ctx.lineWidth = 3;
  ctx.stroke(facePath(FACE, 1.05));
  cache.set(key, c);
  return c;
}
