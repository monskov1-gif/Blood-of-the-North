/**
 * Procedural pictures for LizzieUI: the night CCTV stills of the «Northern Rose» (a small 3D
 * scene projected through a high wide-angle camera, IR monochrome, noise, smear, barrel
 * distortion, OSD) and the topographic paper map of the Takhini valley.
 */

// ------------------------------------------------------------------ shared helpers
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function valueNoise(seed) {
  const r = mulberry(seed), p = new Float32Array(65536);
  for (let i = 0; i < p.length; i++) p[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const i0 = (yi & 255) << 8, i1 = ((yi + 1) & 255) << 8, x0 = xi & 255, x1 = (xi + 1) & 255;
    const a = p[i0 | x0], b = p[i0 | x1], c = p[i1 | x0], d = p[i1 | x1];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
export function fbm(n, x, y, o = 4) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); t += a; a *= 0.5; f *= 2.03; } return s / t; }
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const gray = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

// ------------------------------------------------------------------ tiny 3D projection
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));

function camera(pos, tgt, vfov, W, H) {
  const f = norm(sub(tgt, pos)), r = norm(cross([0, 1, 0], f)), u = cross(f, r);
  return basisCam(pos, r, u, f, (H / 2) / Math.tan(vfov / 2), W, H);
}
function basisCam(pos, r, u, f, F, W, H) {
  const toCam = (p) => { const d = sub(p, pos); return [dot(d, r), dot(d, u), dot(d, f)]; };
  const pr = (c) => [W / 2 + (c[0] / c[2]) * F, H / 2 - (c[1] / c[2]) * F];
  return {
    pos, r, u, f, F, W, H, toCam, pr,
    P(p) { const c = toCam(p); return c[2] > 0.05 ? [...pr(c), c[2]] : null; },
    /** pixels per metre at a world point */
    s(p) { return F / Math.max(0.2, toCam(p)[2]); },
    /** the same camera seen in a mirror at the plane x = mx */
    mirror(mx) { const M = (v) => [-v[0], v[1], v[2]]; return basisCam([2 * mx - pos[0], pos[1], pos[2]], M(r), M(u), M(f), F, W, H); },
  };
}
/** project a polygon (clipped against the near plane) and trace it */
function tracePoly(x, cam, pts) {
  const cs = pts.map(cam.toCam), out = [], N = 0.08;
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    if (a[2] >= N) out.push(a);
    if ((a[2] >= N) !== (b[2] >= N)) { const t = (N - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, N]); }
  }
  if (out.length < 3) return false;
  x.beginPath(); out.forEach((c, i) => { const [sx, sy] = cam.pr(c); i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }); x.closePath();
  return true;
}
function poly(x, cam, pts, fill, stroke) {
  if (!tracePoly(x, cam, pts)) return;
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = 1; x.stroke(); }
}
function line3(x, cam, a, b, w, col) {
  const A = cam.P(a), B = cam.P(b); if (!A || !B) return;
  x.strokeStyle = col; x.lineWidth = Math.max(0.6, w); x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke();
}
/** axis-aligned box with back-face culling and per-face tones */
function box(x, cam, [x0, x1], [y0, y1], [z0, z1], tones) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces = [
    [[1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], tones.side],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], tones.side],
    [[0, 1, 0], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], tones.top],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], tones.bottom ?? tones.side],
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], tones.front],
    [[0, 0, -1], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], tones.front],
  ];
  for (const [n, pts, t] of faces) {
    const fc = add(c, [n[0] * (x1 - x0) / 2, n[1] * (y1 - y0) / 2, n[2] * (z1 - z0) / 2]);
    if (dot(n, sub(cam.pos, fc)) > 0) poly(x, cam, pts, gray(t), gray(Math.max(0, t - 18), 0.6));
  }
}
function disc(x, cam, c, r, y, fill, stroke, seg = 20) {
  const pts = []; for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push([c[0] + Math.cos(a) * r, y, c[1] + Math.sin(a) * r]); }
  poly(x, cam, pts, fill, stroke);
}
/** soft dark blob on the floor */
function floorShadow(x, cam, cx, cz, r, a = 0.55) {
  const P = cam.P([cx, 0.01, cz]); if (!P) return;
  const s = cam.s([cx, 0, cz]), sy = Math.max(0.25, Math.abs(cam.toCam([cx, 0, cz + r])[1] - cam.toCam([cx, 0, cz - r])[1]) / (2 * r) * 1.3);
  x.save(); x.translate(P[0], P[1]); x.scale(1, clamp(sy, 0.3, 1));
  const g = x.createRadialGradient(0, 0, 0, 0, 0, r * s); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, r * s, 0, 7); x.fill(); x.restore();
}

// ------------------------------------------------------------------ people
/**
 * A person as a volumetric stick figure (round-capped capsules), all in world space, so the
 * high-angle perspective foreshortens them naturally.
 *   o: { x, z, dir (facing angle, 0 = +z), pose: stand|walk|sit|slump|lie, seat, coat, legs, skin, hair,
 *        arm: wave|offer|bar|table|hang, faceBlur, glass }
 */
function person(x, cam, o) {
  const f = [Math.sin(o.dir), 0, Math.cos(o.dir)], side = [Math.cos(o.dir), 0, -Math.sin(o.dir)], up = [0, 1, 0];
  const at = (p, ...terms) => terms.reduce((acc, [v, k]) => add(acc, mul(v, k)), p);
  const pose = o.pose || 'stand';
  let pelvis, lean = up, legs = [];
  if (pose === 'sit' || pose === 'slump') {
    const seat = o.seat ?? 0.46;
    pelvis = [o.x, seat + 0.1, o.z];
    for (const k of [-1, 1]) {
      const hip = at(pelvis, [side, k * 0.1]), knee = at(hip, [f, 0.44], [up, -0.02]), foot = [knee[0] + f[0] * 0.06, 0.04, knee[2] + f[2] * 0.06];
      legs.push([hip, knee, foot]);
    }
    if (pose === 'slump') { const a = 1.2; lean = add(mul(f, Math.sin(a)), mul(up, Math.cos(a))); }
  } else if (pose === 'lie') {
    pelvis = [o.x, 0.12, o.z]; lean = f;
    for (const k of [-1, 1]) { const hip = at(pelvis, [side, k * 0.1]); legs.push([hip, at(hip, [f, -0.45], [side, k * 0.04]), at(hip, [f, -0.9], [side, k * 0.1])]); }
  } else {
    pelvis = [o.x, 0.94, o.z];
    const stride = pose === 'walk' ? 0.26 : 0.02;
    for (const k of [-1, 1]) {
      const hip = at(pelvis, [side, k * 0.1]), foot = [hip[0] + f[0] * stride * k + side[0] * k * 0.03, 0.05, hip[2] + f[2] * stride * k + side[2] * k * 0.03];
      legs.push([hip, at([(hip[0] + foot[0]) / 2, 0.5, (hip[2] + foot[2]) / 2], [f, 0.03]), foot]);
    }
  }
  const neck = at(pelvis, [lean, 0.56]), head = at(pelvis, [lean, 0.71]);
  const shL = at(neck, [side, -0.19], [lean, -0.04]), shR = at(neck, [side, 0.19], [lean, -0.04]);
  const arm = (sh, k, kind) => {
    if (kind === 'wave') return [at(sh, [side, k * 0.18], [up, 0.2]), at(sh, [side, k * 0.26], [up, 0.5])];
    if (kind === 'offer') return [at(sh, [f, 0.26], [up, -0.16], [side, k * 0.04]), at(sh, [f, 0.58], [up, -0.08], [side, -k * 0.06])];
    if (kind === 'bar') return [at(sh, [f, 0.18], [up, -0.24]), at(sh, [f, 0.42], [up, -0.26], [side, -k * 0.08])];
    if (kind === 'shoulder') return [at(sh, [side, k * 0.22], [up, -0.12]), at(sh, [side, k * 0.52], [up, -0.06])];
    if (kind === 'table') return [at(sh, [f, 0.2], [lean, -0.05], [side, k * 0.06]), at(sh, [f, 0.36], [side, k * 0.18], [up, -0.1])];
    if (kind === 'flung') return [at(sh, [side, k * 0.3], [f, 0.05]), at(sh, [side, k * 0.62], [f, 0.18])];
    return [at(sh, [lean, -0.28], [f, 0.02], [side, k * 0.03]), at(sh, [lean, -0.55], [f, 0.06], [side, k * 0.02])];
  };
  const armsK = [o.armL || o.arms || (pose === 'lie' ? 'flung' : 'hang'), o.armR || o.arms || (pose === 'lie' ? 'flung' : 'hang')];
  const arms = [[shL, ...arm(shL, -1, armsK[0])], [shR, ...arm(shR, 1, armsK[1])]];

  const coat = o.coat ?? 70, legsT = o.legs ?? Math.max(10, coat - 20), skin = o.skin ?? 168, hair = o.hair ?? 40;
  const S = cam.s(pelvis);
  const seg = (pts, w, t, hl = 0) => {
    const P = pts.map((p) => cam.P(p)); if (P.some((q) => !q)) return;
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = gray(Math.max(0, t - 26)); x.lineWidth = w * S + 1.4; x.beginPath(); P.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.stroke();
    x.strokeStyle = gray(t); x.lineWidth = w * S; x.stroke();
    if (hl) { x.strokeStyle = gray(Math.min(255, t + hl), 0.35); x.lineWidth = w * S * 0.45; x.beginPath(); P.forEach((q, i) => (i ? x.lineTo(q[0], q[1] - w * S * 0.18) : x.moveTo(q[0], q[1] - w * S * 0.18))); x.stroke(); }
  };
  const toCam = norm(sub(cam.pos, pelvis)), facingCam = dot(f, toCam);
  // shadow
  if (pose !== 'lie') floorShadow(x, cam, o.x + f[0] * (pose === 'stand' || pose === 'walk' ? 0 : 0.25), o.z + f[2] * 0.25, 0.42, 0.5);
  // far leg / arm first
  const dL = Math.hypot(...sub(cam.pos, shL)), dR = Math.hypot(...sub(cam.pos, shR));
  const order = dL > dR ? [0, 1] : [1, 0];
  for (const i of order) seg(legs[i], 0.13, legsT, 18);
  const armsBehind = facingCam < 0;
  const drawArm = (i) => { seg(arms[i], 0.1, coat - 4, 20); const h = cam.P(arms[i][2]); if (h) { x.fillStyle = gray(skin); x.beginPath(); x.arc(h[0], h[1], Math.max(1, 0.05 * S), 0, 7); x.fill(); } };
  if (armsBehind) order.forEach(drawArm); else drawArm(order[0]);
  // torso: capsule pelvis → neck, plus a long coat tail when standing
  if (o.longCoat && (pose === 'stand' || pose === 'walk')) seg([at(pelvis, [up, -0.45]), pelvis], 0.4, coat - 6, 0);
  seg([at(pelvis, [lean, 0.04]), at(pelvis, [lean, 0.42])], 0.38, coat, 26);
  seg([shL, shR], 0.16, coat, 22);
  // head
  const H = cam.P(head);
  if (H) {
    const hr = 0.105 * S;
    x.fillStyle = gray(Math.max(0, hair - 20)); x.beginPath(); x.ellipse(H[0], H[1], hr + 0.8, hr * 1.12 + 0.8, 0, 0, 7); x.fill();
    if (facingCam > -0.2 && !o.faceBlur) {
      // the face, shifted toward where the person looks
      const fp = cam.P(at(head, [f, 0.05], [up, -0.01]));
      x.fillStyle = gray(skin); x.beginPath(); x.ellipse(fp[0], fp[1] + hr * 0.15, hr * 0.78, hr * 0.92, 0, 0, 7); x.fill();
      x.fillStyle = gray(hair); x.beginPath(); x.ellipse(H[0], H[1] - hr * 0.55, hr * 0.98, hr * 0.6, 0, 0, 7); x.fill();
      x.fillStyle = gray(Math.max(0, skin - 70), 0.8); x.fillRect(fp[0] - hr * 0.45, fp[1] - hr * 0.05, hr * 0.3, Math.max(1, hr * 0.14)); x.fillRect(fp[0] + hr * 0.15, fp[1] - hr * 0.05, hr * 0.3, Math.max(1, hr * 0.14));
    } else {
      x.fillStyle = gray(hair); x.beginPath(); x.ellipse(H[0], H[1], hr, hr * 1.12, 0, 0, 7); x.fill();
      x.fillStyle = gray(Math.min(255, hair + 40), 0.4); x.beginPath(); x.ellipse(H[0] - hr * 0.2, H[1] - hr * 0.45, hr * 0.5, hr * 0.3, -0.4, 0, 7); x.fill();
      if (!o.faceBlur && facingCam > -0.75) { x.fillStyle = gray(skin, 0.9); x.beginPath(); x.ellipse(H[0] + (dot(f, cam.r) > 0 ? 1 : -1) * hr * 0.75, H[1] + hr * 0.2, hr * 0.28, hr * 0.5, 0, 0, 7); x.fill(); }
    }
    if (o.faceBlur) {
      // the face burnt out: a white overexposed smear with a halo and a horizontal bleed
      const fp = cam.P(at(head, [f, 0.06]));
      const g = x.createRadialGradient(fp[0], fp[1], 0, fp[0], fp[1], hr * 2.8);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.32, 'rgba(250,250,250,0.95)'); g.addColorStop(0.55, 'rgba(220,220,220,0.45)'); g.addColorStop(1, 'rgba(200,200,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(fp[0], fp[1], hr * 2.8, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(fp[0] - hr * 4, fp[1] - 1, hr * 8, 2);
    }
  }
  if (!armsBehind) drawArm(order[1]);
  if (o.glass) {
    const hand = arms[1][2], g0 = cam.P(add(hand, [0, 0.02, 0])), g1 = cam.P(add(hand, [0, 0.16, 0]));
    if (g0 && g1) {
      const w = 0.07 * S;
      x.fillStyle = 'rgba(235,235,235,0.9)'; x.beginPath(); x.moveTo(g1[0] - w, g1[1]); x.lineTo(g1[0] + w, g1[1]); x.lineTo(g0[0], g0[1] - 1); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(240,240,240,0.9)'; x.lineWidth = 1; x.beginPath(); x.moveTo(g0[0], g0[1]); x.lineTo(g0[0], g0[1] + 0.06 * S); x.stroke();
      const gl = x.createRadialGradient(g1[0], g1[1], 0, g1[0], g1[1], w * 4); gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gl; x.beginPath(); x.arc(g1[0], g1[1], w * 4, 0, 7); x.fill();
    }
  }
}

// ------------------------------------------------------------------ the bar
/*
 * The «Northern Rose», world metres: x −5 … 5 (left wall with the back bar and the mirror),
 * z 0 … 12 (z = 12 the street wall with windows), ceiling 3.2. The counter runs along the left wall.
 */
const ROOM = { x0: -5, x1: 5, z0: 0, z1: 12, h: 3.2 };
const MIRROR = { x: -4.98, y0: 1.02, y1: 2.32, z0: 4.0, z1: 9.4 };
const BAR_LAMPS = [3.4, 5.6, 7.8, 10].map((z) => [-3.25, 2.25, z]);
const TABLES = [[0.4, 4.2], [2.9, 4.6], [0.9, 7.4], [3.4, 8.2], [0.2, 10.4], [2.6, 10.9]];
const TABLE_LAMPS = [[0.9, 2.35, 7.4], [0.4, 2.35, 4.2], [3.4, 2.35, 8.2]];

function drawRoom(x, cam, cfg, opts) {
  const { day } = cfg, W = cam.W, H = cam.H;
  x.fillStyle = gray(day ? 90 : 40); x.fillRect(0, 0, W, H);
  const R = ROOM;
  // ceiling with beams
  poly(x, cam, [[R.x0, R.h, R.z0], [R.x1, R.h, R.z0], [R.x1, R.h, R.z1], [R.x0, R.h, R.z1]], gray(day ? 120 : 52));
  for (let z = 1; z < 12; z += 1.6) box(x, cam, [R.x0, R.x1], [R.h - 0.18, R.h], [z, z + 0.18], { side: 60, top: 60, bottom: 46, front: 54 });
  // walls: upper plaster, lower wainscot with vertical boards
  const wall = (pts, t) => poly(x, cam, pts, gray(t));
  wall([[R.x0, 0, R.z1], [R.x1, 0, R.z1], [R.x1, R.h, R.z1], [R.x0, R.h, R.z1]], 150);       // street wall
  wall([[R.x1, 0, R.z0], [R.x1, 0, R.z1], [R.x1, R.h, R.z1], [R.x1, R.h, R.z0]], 138);       // right wall
  wall([[R.x0, 0, R.z0], [R.x0, 0, R.z1], [R.x0, R.h, R.z1], [R.x0, R.h, R.z0]], 128);       // left wall (back bar)
  wall([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, R.h, R.z0], [R.x0, R.h, R.z0]], 140);       // door wall
  wall([[R.x0, 0, R.z1], [R.x1, 0, R.z1], [R.x1, 1.05, R.z1], [R.x0, 1.05, R.z1]], 92);
  wall([[R.x1, 0, R.z0], [R.x1, 0, R.z1], [R.x1, 1.05, R.z1], [R.x1, 1.05, R.z0]], 86);
  wall([[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, 1.05, R.z0], [R.x0, 1.05, R.z0]], 88);
  for (let i = -5; i <= 5; i += 0.32) line3(x, cam, [i, 0, R.z1 - 0.01], [i, 1.05, R.z1 - 0.01], 1, gray(70, 0.6));
  for (let i = 0; i <= 12; i += 0.32) { line3(x, cam, [R.x1 - 0.01, 0, i], [R.x1 - 0.01, 1.05, i], 1, gray(66, 0.6)); }
  line3(x, cam, [R.x0, 1.05, R.z1 - 0.01], [R.x1, 1.05, R.z1 - 0.01], 2, gray(170));
  line3(x, cam, [R.x1 - 0.01, 1.05, R.z0], [R.x1 - 0.01, 1.05, R.z1], 2, gray(160));
  // floor: planks + scuffs
  poly(x, cam, [[R.x0, 0, R.z0], [R.x1, 0, R.z0], [R.x1, 0, R.z1], [R.x0, 0, R.z1]], gray(74));
  for (let i = -5; i <= 5; i += 0.16) line3(x, cam, [i, 0, R.z0], [i, 0, R.z1], 1, gray(70, 0.45));
  const r = mulberry(7);
  for (let i = 0; i < 90; i++) { const px = -5 + r() * 10, pz = r() * 12; line3(x, cam, [px, 0, pz], [px, 0, pz + 0.3 + r()], 1, gray(64, 0.35)); }
  // windows on the street wall and the right wall
  const win = (pts, cx, cy, cz) => { // night: dark street, a sodium lamp blur, falling snow; day: burnt-out white
    poly(x, cam, pts, gray(day ? 236 : 34));
    const c = cam.P([cx, cy, cz]); if (!c || !tracePoly(x, cam, pts)) return;
    x.save(); x.clip();
    const s = cam.s([cx, cy, cz]);
    if (day) {
      x.fillStyle = gray(200, 0.8); x.fillRect(c[0] - 2 * s, c[1] + 0.25 * s, 4 * s, 0.7 * s); // the far snow bank
      x.fillStyle = gray(150, 0.5); x.fillRect(c[0] - 0.4 * s, c[1] - 0.6 * s, 0.12 * s, 1.4 * s);
    } else {
      const g = x.createRadialGradient(c[0] + 0.3 * s, c[1] - 0.2 * s, 0, c[0] + 0.3 * s, c[1] - 0.2 * s, 0.9 * s);
      g.addColorStop(0, gray(250, 1)); g.addColorStop(0.15, gray(200, 0.8)); g.addColorStop(1, gray(60, 0));
      x.fillStyle = g; x.fillRect(c[0] - 2 * s, c[1] - 2 * s, 4 * s, 4 * s);
      x.fillStyle = gray(120, 0.7); x.fillRect(c[0] - 2 * s, c[1] + 0.35 * s, 4 * s, 0.5 * s);
      x.fillStyle = gray(18); x.fillRect(c[0] - 1.1 * s, c[1] + 0.05 * s, 1.5 * s, 0.4 * s);      // a parked car
      x.fillStyle = gray(18); x.fillRect(c[0] - 0.85 * s, c[1] - 0.12 * s, 0.9 * s, 0.25 * s);
    }
    const sr = mulberry(Math.round(cx * 13 + cz * 7));
    for (let i = 0; i < 26; i++) { x.fillStyle = gray(day ? 255 : 230, 0.5 + sr() * 0.5); x.fillRect(c[0] + (sr() - 0.5) * 2.4 * s, c[1] + (sr() - 0.5) * 1.6 * s, 1, 1 + sr() * 2); }
    x.restore();
    x.strokeStyle = gray(day ? 120 : 70); x.lineWidth = Math.max(1, 0.06 * s); tracePoly(x, cam, pts); x.stroke();
    line3(x, cam, [cx - (cz === R.z1 - 0.01 ? 0 : 0), cy - 0.7, cz], [cx, cy + 0.7, cz], Math.max(1, 0.05 * s), gray(day ? 120 : 70));
  };
  for (const wx of [-2.2, 1.0, 3.6]) win([[wx - 0.9, 1.15, R.z1 - 0.01], [wx + 0.9, 1.15, R.z1 - 0.01], [wx + 0.9, 2.55, R.z1 - 0.01], [wx - 0.9, 2.55, R.z1 - 0.01]], wx, 1.85, R.z1 - 0.01);
  for (const wz of [4.4, 8.2]) win([[R.x1 - 0.01, 1.15, wz - 0.9], [R.x1 - 0.01, 1.15, wz + 0.9], [R.x1 - 0.01, 2.55, wz + 0.9], [R.x1 - 0.01, 2.55, wz - 0.9]], R.x1 - 0.01, 1.85, wz);
  // door with a push bar and a bright gap (front wall, right)
  poly(x, cam, [[3.3, 0, 0.01], [4.4, 0, 0.01], [4.4, 2.2, 0.01], [3.3, 2.2, 0.01]], gray(70));
  // framed photos, moose antlers, a dartboard, the neon rose over the street windows
  for (const [pz, py, w, h] of [[1.2, 1.4, 0.5, 0.4], [2.0, 1.55, 0.4, 0.5], [9.6, 1.35, 0.6, 0.45], [10.6, 1.5, 0.45, 0.45]]) {
    const fr = [[R.x1 - 0.02, py, pz], [R.x1 - 0.02, py, pz + w], [R.x1 - 0.02, py + h, pz + w], [R.x1 - 0.02, py + h, pz]];
    poly(x, cam, fr, gray(150)); poly(x, cam, fr.map(([a, b, c]) => [a, b + (b > py ? -0.06 : 0.06), c + (c > pz ? -0.06 : 0.06)]), gray(62));
  }
  const ant = cam.P([R.x1 - 0.05, 2.5, 6.3]);
  if (ant) { const s = cam.s([R.x1, 2.5, 6.3]); x.strokeStyle = gray(190); x.lineWidth = Math.max(1, 0.05 * s); x.lineCap = 'round';
    for (const k of [-1, 1]) { x.beginPath(); x.moveTo(ant[0], ant[1]); x.quadraticCurveTo(ant[0] + k * 0.3 * s, ant[1] - 0.1 * s, ant[0] + k * 0.5 * s, ant[1] - 0.35 * s); x.stroke();
      for (let t = 0; t < 4; t++) { x.beginPath(); x.moveTo(ant[0] + k * (0.2 + t * 0.09) * s, ant[1] - (0.1 + t * 0.05) * s); x.lineTo(ant[0] + k * (0.24 + t * 0.1) * s, ant[1] - (0.3 + t * 0.06) * s); x.stroke(); } }
    x.fillStyle = gray(80); x.beginPath(); x.ellipse(ant[0], ant[1] + 0.06 * s, 0.1 * s, 0.14 * s, 0, 0, 7); x.fill(); }
  // left wall: the mirror (with the reflection rendered by the caller) and liquor shelves
  const mir = [[MIRROR.x, MIRROR.y0, MIRROR.z0], [MIRROR.x, MIRROR.y0, MIRROR.z1], [MIRROR.x, MIRROR.y1, MIRROR.z1], [MIRROR.x, MIRROR.y1, MIRROR.z0]];
  if (opts.reflection && tracePoly(x, cam, mir)) {
    x.save(); x.clip(); x.drawImage(opts.reflection, 0, 0);
    const c0 = cam.P([MIRROR.x, MIRROR.y1, MIRROR.z0]), c1 = cam.P([MIRROR.x, MIRROR.y0, MIRROR.z1]);
    if (c0 && c1) { const g = x.createLinearGradient(c0[0], c0[1], c1[0], c1[1]); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.75, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fill(); }
    x.restore();
  } else poly(x, cam, mir, gray(60));
  x.strokeStyle = gray(150); x.lineWidth = 2; if (tracePoly(x, cam, mir)) x.stroke();
  for (const [z0, z1] of [[1.8, 3.8], [9.6, 11.3]]) {
    poly(x, cam, [[R.x0 + 0.01, 1.0, z0], [R.x0 + 0.01, 1.0, z1], [R.x0 + 0.01, 2.5, z1], [R.x0 + 0.01, 2.5, z0]], gray(46));
    for (const sy of [1.3, 1.72, 2.14]) {
      box(x, cam, [R.x0, R.x0 + 0.3], [sy - 0.03, sy], [z0, z1], { side: 120, top: 150, front: 110 });
      const br = mulberry(Math.round(sy * 100 + z0 * 10));
      for (let z = z0 + 0.08; z < z1 - 0.05; z += 0.11 + br() * 0.05) bottle(x, cam, [R.x0 + 0.15, sy, z], 0.24 + br() * 0.12, 60 + br() * 120);
    }
  }
}
function bottle(x, cam, p, h, t) {
  const a = cam.P(p), b = cam.P([p[0], p[1] + h, p[2]]); if (!a || !b) return;
  const s = cam.s(p), w = 0.035 * s;
  x.fillStyle = gray(t); x.beginPath(); x.moveTo(a[0] - w, a[1]); x.lineTo(a[0] + w, a[1]); x.lineTo(a[0] + w, a[1] + (b[1] - a[1]) * 0.62); x.lineTo(a[0] + w * 0.35, a[1] + (b[1] - a[1]) * 0.78); x.lineTo(b[0] + w * 0.3, b[1]); x.lineTo(b[0] - w * 0.3, b[1]); x.lineTo(a[0] - w * 0.35, a[1] + (b[1] - a[1]) * 0.78); x.lineTo(a[0] - w, a[1] + (b[1] - a[1]) * 0.62); x.closePath(); x.fill();
  x.fillStyle = gray(Math.min(255, t + 90), 0.7); x.fillRect(a[0] - w * 0.6, a[1] + (b[1] - a[1]) * 0.55, Math.max(1, w * 0.35), (b[1] - a[1]) * -0.4);
}
function stool(x, cam, sx, sz, t = 90) {
  floorShadow(x, cam, sx, sz, 0.3, 0.4);
  line3(x, cam, [sx, 0.05, sz], [sx, 0.74, sz], 0.05 * cam.s([sx, 0.4, sz]), gray(120));
  disc(x, cam, [sx, sz], 0.2, 0.3, null, gray(130, 0.8), 14);
  disc(x, cam, [sx, sz], 0.2, 0.76, gray(t), gray(t + 40), 16);
}
function table(x, cam, tx, tz, cfg, upturned) {
  floorShadow(x, cam, tx, tz, 0.75, 0.55);
  const s = cam.s([tx, 0.4, tz]);
  const chairs = [[0.62, 0], [-0.62, 0], [0, 0.62], [0, -0.62]];
  const chair = ([dx, dz]) => {
    const cx = tx + dx, cz = tz + dz, nx = Math.sign(dx), nz = Math.sign(dz);
    if (upturned) return;
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) line3(x, cam, [cx + lx, 0, cz + lz], [cx + lx, 0.45, cz + lz], 0.03 * s, gray(80));
    box(x, cam, [cx - 0.2, cx + 0.2], [0.42, 0.47], [cz - 0.2, cz + 0.2], { side: 90, top: 120, front: 96 });
    const bx = cx + nx * 0.2, bz = cz + nz * 0.2;
    if (nx) box(x, cam, [bx - 0.03, bx + 0.03], [0.47, 0.95], [cz - 0.2, cz + 0.2], { side: 100, top: 130, front: 86 });
    else box(x, cam, [cx - 0.2, cx + 0.2], [0.47, 0.95], [bz - 0.03, bz + 0.03], { side: 86, top: 130, front: 100 });
  };
  // chairs behind the table first
  const camSide = (c) => -Math.hypot(tx + c[0] - cam.pos[0], tz + c[1] - cam.pos[2]);
  const sorted = [...chairs].sort((a, b) => camSide(a) - camSide(b));
  sorted.slice(0, 2).forEach(chair);
  line3(x, cam, [tx, 0.02, tz], [tx, 0.74, tz], 0.07 * s, gray(70));
  disc(x, cam, [tx, tz], 0.48, 0.76, gray(132), gray(178), 22);
  if (upturned) {
    for (const [dx, dz] of chairs) { // chairs upside down on the table top, legs to the ceiling
      const cx = tx + dx * 0.45, cz = tz + dz * 0.45;
      box(x, cam, [cx - 0.19, cx + 0.19], [0.78, 0.83], [cz - 0.19, cz + 0.19], { side: 92, top: 110, front: 96 });
      for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) line3(x, cam, [cx + lx, 0.83, cz + lz], [cx + lx, 1.26, cz + lz], 0.03 * s, gray(110));
    }
  } else {
    const gr = mulberry(Math.round(tx * 31 + tz * 17));
    for (let i = 0; i < 3; i++) { const p = cam.P([tx + (gr() - 0.5) * 0.6, 0.77, tz + (gr() - 0.5) * 0.6]); if (p) { x.fillStyle = gray(200, 0.9); x.fillRect(p[0] - 1, p[1] - 3, 2, 3); } }
    if (cfg.kind === 'after') { const p = cam.P([tx + 0.3, 0.77, tz - 0.2]); if (p) { x.fillStyle = gray(30, 0.8); x.beginPath(); x.ellipse(p[0], p[1], 0.18 * s, 0.07 * s, 0.4, 0, 7); x.fill(); } }
  }
  sorted.slice(2).forEach(chair);
}

/** everything in the room: furniture, the counter, people, lamps — painter's order */
function drawScene(x, cam, cfg, opts = {}) {
  drawRoom(x, cam, cfg, opts);
  if (opts.mirror) { x.fillStyle = 'rgba(0,0,0,0.62)'; x.fillRect(0, 0, cam.W, cam.H); } // the room behind the camera is dim; faces in the glass stand out
  const items = [];
  const push = (p, fn) => items.push([Math.hypot(...sub(cam.pos, p)), fn]);
  // back bar counter and bartender behind the counter
  box(x, cam, [-5, -4.45], [0, 0.98], [1.6, 11.4], { side: 70, top: 140, front: 74 });
  for (let z = 4.3; z < 9.2; z += 0.35) bottle(x, cam, [-4.7, 0.98, z], 0.2 + ((z * 7) % 1) * 0.1, 110 + ((z * 13) % 1) * 80);
  const people = (cfg.people || []).filter((q) => !(opts.mirror && q.noReflection));
  people.filter((q) => q.x < -3.6).forEach((q) => person(x, cam, q));
  // the counter: front panelling, a brass foot rail, the polished top with a lit edge
  box(x, cam, [-3.62, -3.02], [0, 1.08], [1.8, 11.2], { side: 64, top: 168, front: 70 });
  for (let z = 1.9; z < 11.2; z += 0.4) line3(x, cam, [-3.01, 0.08, z], [-3.01, 1.02, z], 1, gray(46, 0.7));
  line3(x, cam, [-2.9, 0.22, 1.8], [-2.9, 0.22, 11.2], Math.max(1.2, 0.04 * cam.s([-2.9, 0.2, 6])), gray(190));
  line3(x, cam, [-3.0, 1.08, 1.8], [-3.0, 1.08, 11.2], 1.5, gray(220, 0.8));
  for (const z of [2.6, 3.5, 4.4, 5.5, 6.6, 7.5, 8.6, 9.6, 10.6]) push([-2.7, 0.4, z], () => stool(x, cam, -2.72, z));
  if (!opts.mirror) TABLES.forEach(([tx, tz]) => push([tx, 0.4, tz], () => table(x, cam, tx, tz, cfg, cfg.day && cfg.kind === 'enter')));
  // booths along the right wall
  if (!opts.mirror) for (const bz of [2.4, 6.3, 10.0]) push([4.6, 0.5, bz], () => {
    box(x, cam, [4.3, 4.95], [0, 0.48], [bz - 0.9, bz + 0.9], { side: 80, top: 104, front: 76 });
    box(x, cam, [4.75, 4.98], [0.48, 1.3], [bz - 0.9, bz + 0.9], { side: 92, top: 120, front: 84 });
  });
  for (const q of people.filter((q) => q.x >= -3.6)) {
    const d = Math.hypot(...sub(cam.pos, [q.x, 0.8, q.z])) - (q.pose === 'sit' || q.pose === 'slump' ? 0.05 : 0);
    items.push([d - 0.3, () => person(x, cam, q)]);
  }
  if (!opts.mirror) for (const it of cfg.props || []) push(it.p, () => it.draw(x, cam));
  items.sort((a, b) => b[0] - a[0]).forEach(([, fn]) => fn());
  // pendant lamps: cords, conical shades, bulbs
  for (const l of [...BAR_LAMPS, ...TABLE_LAMPS]) {
    line3(x, cam, [l[0], ROOM.h, l[2]], [l[0], l[1] + 0.2, l[2]], 1, gray(30));
    const a = cam.P([l[0], l[1] + 0.2, l[2]]), b = cam.P(l); if (!a || !b) continue;
    const s = cam.s(l);
    x.fillStyle = gray(40); x.beginPath(); x.moveTo(a[0] - 0.06 * s, a[1]); x.lineTo(a[0] + 0.06 * s, a[1]); x.lineTo(b[0] + 0.2 * s, b[1]); x.lineTo(b[0] - 0.2 * s, b[1]); x.closePath(); x.fill();
  }
  // Christmas lights along the top of the street wall and the bar
  const cr = mulberry(12);
  for (let i = 0; i <= 40; i++) { const t = i / 40, p = cam.P([-5 + t * 10, 2.95 - Math.abs(Math.sin(t * 18)) * 0.12, ROOM.z1 - 0.03]); if (p && cr() > 0.2) { x.fillStyle = gray(255, 0.9); x.fillRect(p[0] - 1, p[1] - 1, 2, 2); } }
  for (let i = 0; i <= 50; i++) { const t = i / 50, p = cam.P([-4.98, 2.75 - Math.abs(Math.sin(t * 22)) * 0.1, 1.5 + t * 10]); if (p && cr() > 0.2) { x.fillStyle = gray(255, 0.9); x.fillRect(p[0] - 1, p[1] - 1, 2, 2); } }
}
/** light map: ambient + pools under every pendant + the window glow; multiplied over the scene */
function lightScene(x, cam, cfg, W, H) {
  const L = document.createElement('canvas'); L.width = W; L.height = H;
  const l = L.getContext('2d', { willReadFrequently: true });
  l.fillStyle = gray(cfg.day ? 168 : 92); l.fillRect(0, 0, W, H);
  if (!cfg.day) { // the camera's own IR illuminator: a hot spot on the near floor, falling off with distance
    const ir = l.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, H * 1.1); ir.addColorStop(0, gray(150)); ir.addColorStop(0.55, gray(60)); ir.addColorStop(1, gray(0));
    l.globalCompositeOperation = 'lighter'; l.fillStyle = ir; l.fillRect(0, 0, W, H); l.globalCompositeOperation = 'source-over';
  }
  l.globalCompositeOperation = 'lighter';
  const pool = (p, r, a) => {
    const c = cam.P(p); if (!c) return; const s = cam.s(p), R = r * s;
    const g = l.createRadialGradient(c[0], c[1], 0, c[0], c[1], R); g.addColorStop(0, gray(255, a)); g.addColorStop(0.5, gray(255, a * 0.35)); g.addColorStop(1, gray(255, 0));
    l.fillStyle = g; l.beginPath(); l.arc(c[0], c[1], R, 0, 7); l.fill();
  };
  if (!cfg.day) {
    for (const b of BAR_LAMPS) { pool([b[0], 1.1, b[2]], 1.6, 0.75); pool(b, 1.1, 0.4); pool([-4.9, 1.8, b[2]], 1.4, 0.3); }
    for (const b of TABLE_LAMPS) { pool([b[0], 0.76, b[2]], 1.5, 0.7); pool([b[0], 0, b[2]], 2.2, 0.35); }
    pool([1, 2.7, 11.9], 3, 0.35);
  } else {
    for (const wx of [-2.2, 1.0, 3.6]) pool([wx, 0.2, 10.5], 3.2, 0.5);
    for (const wz of [4.4, 8.2]) pool([3.6, 0.2, wz], 3, 0.45);
  }
  x.globalCompositeOperation = 'multiply'; x.drawImage(L, 0, 0); x.globalCompositeOperation = 'source-over';
}
function bloom(x, cam, cfg, extra = []) {
  x.globalCompositeOperation = 'screen';
  const glow = (c, r, a) => { const g = x.createRadialGradient(c[0], c[1], 0, c[0], c[1], r); g.addColorStop(0, gray(255, a)); g.addColorStop(0.25, gray(255, a * 0.45)); g.addColorStop(1, gray(255, 0)); x.fillStyle = g; x.beginPath(); x.arc(c[0], c[1], r, 0, 7); x.fill(); };
  if (!cfg.day) {
    for (const l of [...BAR_LAMPS, ...TABLE_LAMPS, ...extra]) {
      const c = cam.P([l[0], l[1] - 0.02, l[2]]); if (!c || c[0] < -20 || c[0] > cam.W + 20) continue;
      const s = cam.s(l);
      glow(c, 0.7 * s, 0.85); glow(c, 0.16 * s, 1);
      if (l[1] > 2.3 && s > 40) { x.fillStyle = gray(255, 0.05); x.fillRect(c[0] - 0.5, 0, 1, cam.H); } // faint CCD smear
    }
    const n = cam.P([1, 2.75, 11.95]); if (n) glow(n, 1.6 * cam.s([1, 2.75, 11.95]), 0.35);
  }
  x.globalCompositeOperation = 'source-over';
}
/** the neon «Northern Rose» over the windows */
function neon(x, cam, cfg) {
  const o = cam.P([0.1, 2.8, 11.98]), e = cam.P([2.0, 2.8, 11.98]); if (!o || !e || cfg.day) return;
  const s = cam.s([1, 2.8, 12]);
  x.save(); x.translate(o[0], o[1]); x.rotate(Math.atan2(e[1] - o[1], e[0] - o[0])); x.scale(Math.hypot(e[0] - o[0], e[1] - o[1]) / (1.9 * s), 1);
  x.font = `italic ${Math.max(6, 0.32 * s)}px Georgia, serif`; x.shadowColor = 'rgba(255,255,255,0.9)'; x.shadowBlur = 8;
  x.fillStyle = gray(250); x.fillText('Northern Rose', 0, 0); x.restore();
}

// ------------------------------------------------------------------ CCTV still
const CAMS = {
  1: (W, H) => camera([4.4, 2.9, 0.6], [-0.6, 0.55, 7.0], 0.86, W, H),
  2: (W, H) => camera([1.8, 2.9, 11.5], [-3.5, 0.95, 6.9], 0.84, W, H),
  3: (W, H) => camera([-2.4, 2.9, 0.4], [2.2, 0.45, 8.0], 0.9, W, H),
  /** the dome over the middle of the room, turned to the counter and the mirror */
  mirror: (W, H) => camera([0.6, 2.7, 7.2], [-4.98, 1.25, 6.75], 0.64, W, H),
};
const JULIAN = { coat: 62, legs: 34, hair: 30, skin: 176 };
const BLACK = { coat: 14, legs: 10, hair: 12, longCoat: true, faceBlur: true, noReflection: true };
function cast(kind, day) {
  const P = (o) => ({ ...o });
  if (kind === 'enter' && day) return [];
  if (kind === 'enter') return [
    P({ ...JULIAN, x: 2.5, z: 3.6, dir: -0.45, pose: 'walk' }),
    P({ x: 0.9, z: 8.05, dir: Math.PI - 0.4, pose: 'sit', arms: 'table', armR: 'wave', coat: 176, hair: 60 }),   // Kayden waves
    P({ x: 1.55, z: 7.4, dir: -Math.PI / 2, pose: 'sit', arms: 'table', coat: 140, hair: 190 }),
    P({ x: -2.72, z: 4.4, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar', coat: 100, hair: 50 }),
    P({ x: -2.72, z: 6.6, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar', coat: 46, hair: 130 }),
    P({ x: -4.2, z: 5.4, dir: Math.PI / 2, pose: 'stand', coat: 205, legs: 30, hair: 40 }),                        // bartender, white shirt
    P({ x: 2.9, z: 5.25, dir: Math.PI, pose: 'sit', arms: 'table', coat: 150, hair: 90 }),
    P({ x: 3.4, z: 8.85, dir: Math.PI, pose: 'sit', arms: 'table', coat: 165, hair: 40 }),
  ];
  if (kind === 'cocktail') return [
    P({ ...JULIAN, x: -2.72, z: 8.6, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar' }),
    P({ ...BLACK, x: -1.85, z: 9.55, dir: -2.3, pose: 'stand', armR: 'offer', glass: true }),
    P({ x: -4.2, z: 4.6, dir: Math.PI / 2, pose: 'stand', coat: 205, legs: 30, hair: 40 }),
    P({ x: -2.72, z: 3.5, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar', coat: 100, hair: 50 }),
    P({ x: 0.4, z: 4.85, dir: Math.PI, pose: 'sit', arms: 'table', coat: 176, hair: 60 }),
    P({ x: 1.05, z: 4.2, dir: -Math.PI / 2, pose: 'sit', arms: 'table', coat: 140, hair: 190 }),
    P({ x: 0.9, z: 6.75, dir: 0, pose: 'sit', arms: 'table', coat: 70, hair: 40 }),
  ];
  if (kind === 'mirror') return [
    P({ ...JULIAN, x: -2.72, z: 6.6, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar' }),
    P({ ...BLACK, faceBlur: false, x: -2.72, z: 7.5, dir: -Math.PI / 2 - 0.25, pose: 'sit', seat: 0.76, armL: 'bar', armR: 'bar' }),
    P({ x: -2.72, z: 4.4, dir: -Math.PI / 2, pose: 'sit', seat: 0.76, arms: 'bar', coat: 100, hair: 50 }),
    P({ x: -4.2, z: 3.4, dir: Math.PI / 2, pose: 'stand', coat: 205, legs: 30, hair: 40 }),
  ];
  if (kind === 'after') return [
    P({ x: 0.9, z: 8.05, dir: Math.PI, pose: 'slump', arms: 'table', coat: 176, hair: 60 }),
    P({ x: 1.55, z: 7.4, dir: -Math.PI / 2, pose: 'slump', arms: 'table', coat: 140, hair: 190 }),
    P({ x: -2.72, z: 4.4, dir: -Math.PI / 2, pose: 'slump', seat: 0.76, arms: 'table', coat: 100, hair: 50 }),
    P({ x: 1.8, z: 5.6, dir: 2.2, pose: 'lie', coat: 46, hair: 130 }),
    P({ x: 2.9, z: 5.25, dir: Math.PI, pose: 'slump', arms: 'table', coat: 150, hair: 90 }),
    P({ x: 3.4, z: 8.85, dir: Math.PI, pose: 'slump', arms: 'table', coat: 165, hair: 40 }),
    P({ x: -1.2, z: 9.6, dir: -1.1, pose: 'lie', coat: 150, hair: 50 }),
  ];
  return [];
}

/**
 * One CCTV still (frame = the story's { cam, tc, kind }); paints into the canvas as it is sized.
 */
export function paintCCTV(cv, frame) {
  const W = cv.width, H = cv.height, out = cv.getContext('2d', { willReadFrequently: true });
  const hour = parseInt(frame.tc, 10) || 0, day = hour >= 5 && hour < 12, kind = frame.kind;
  const seed = (frame.cam * 977 + (frame.tc || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) >>> 0;
  const r = mulberry(seed);
  const S = document.createElement('canvas'); S.width = W; S.height = H;
  const x = S.getContext('2d', { willReadFrequently: true });
  const camN = CAMS[frame.cam] ? frame.cam : 1;
  const cam = CAMS[kind === 'mirror' ? 'mirror' : kind === 'cocktail' ? 2 : camN](W, H);
  const cfg = { day, kind, people: cast(kind, day) };
  if (kind === 'after') cfg.props = [{ p: [0.4, 0, 6.2], draw: (c, k) => { // a toppled chair and broken glass
    box(c, k, [0.1, 0.55], [0, 0.06], [5.9, 6.35], { side: 90, top: 110, front: 96 }); box(c, k, [0.55, 1.0], [0, 0.06], [6.05, 6.15], { side: 90, top: 110, front: 96 });
    const gr = mulberry(5); for (let i = 0; i < 18; i++) { const p = k.P([0.6 + (gr() - 0.5), 0.01, 6.6 + (gr() - 0.5) * 0.8]); if (p) { c.fillStyle = gray(230, 0.8); c.fillRect(p[0], p[1], 1, 1); } }
  } }];
  if (kind === 'static') {
    drawScene(x, CAMS[1](W, H), { day: false, kind: 'enter', people: [] });
  } else {
    let reflection = null;
    if (kind === 'mirror' || kind === 'cocktail' || camN === 2) {
      const mc = cam.mirror(MIRROR.x), R = document.createElement('canvas'); R.width = W; R.height = H;
      const rx = R.getContext('2d', { willReadFrequently: true }); drawScene(rx, mc, cfg, { mirror: true }); bloom(rx, mc, cfg);
      reflection = R;
    }
    drawScene(x, cam, cfg, { reflection });
    neon(x, cam, cfg);
    lightScene(x, cam, cfg, W, H);
    bloom(x, cam, cfg);
  }
  // ---- sensor + tape: luma, oversharpening halo, smear, barrel distortion, noise, vignette
  const src = x.getImageData(0, 0, W, H).data;
  const Y = new Float32Array(W * H);
  for (let i = 0, j = 0; j < Y.length; i += 4, j++) Y[j] = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
  const B = new Float32Array(W * H); // 3×3 blur for the unsharp mask
  for (let yy = 1; yy < H - 1; yy++) for (let xx = 1; xx < W - 1; xx++) { const k = yy * W + xx; B[k] = (Y[k - W - 1] + Y[k - W] + Y[k - W + 1] + Y[k - 1] + Y[k] + Y[k + 1] + Y[k + W - 1] + Y[k + W] + Y[k + W + 1]) / 9; }
  for (let k = 0; k < Y.length; k++) Y[k] = Y[k] + (Y[k] - (B[k] || Y[k])) * 0.9;
  const samp = (sx, sy) => {
    if (sx < 0 || sy < 0 || sx > W - 2 || sy > H - 2) return 0;
    const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, k = iy * W + ix;
    return (Y[k] * (1 - fx) + Y[k + 1] * fx) * (1 - fy) + (Y[k + W] * (1 - fx) + Y[k + W + 1] * fx) * fy;
  };
  const img = out.createImageData(W, H), d = img.data;
  const K = 0.24, norm0 = 1 / (1 + K * 0.42), cx = W / 2, cy = H / 2;
  const rowOff = new Float32Array(H);
  for (let yy = 0; yy < H; yy++) rowOff[yy] = r() < 0.04 ? (r() - 0.5) * 3 : 0;
  const band = kind === 'static' ? -1 : r() < 0.35 ? Math.floor(r() * H) : -1; // a tracking band
  const tint = day ? [0.96, 0.98, 1.02] : [0.86, 0.99, 0.84];
  for (let yy = 0; yy < H; yy++) {
    const inBand = band >= 0 && Math.abs(yy - band) < 5;
    for (let xx = 0; xx < W; xx++) {
      const nx = (xx - cx) / cx, ny = (yy - cy) / cx, r2 = nx * nx + ny * ny, fct = (1 + K * r2) * norm0;
      const sx = cx + nx * fct * cx + rowOff[yy] + (inBand ? 4 : 0), sy = cy + ny * fct * cx;
      let v = samp(sx, sy) * 0.74 + samp(sx - 1.6, sy) * 0.26;
      if (kind === 'static') v *= 0.16;
      v = 16 + v * 0.9;
      v *= 1 - 0.6 * Math.pow(r2 * 0.62, 1.6);
      const amp = kind === 'static' ? 210 : 16 + 26 * (1 - v / 255);
      v += (r() + r() - 1) * amp;
      if (kind === 'static' && r() < 0.02) v += 120;
      if (inBand) v += 30 + r() * 40;
      if (yy & 1) v *= 0.88;
      const o = (yy * W + xx) * 4;
      d[o] = v * tint[0]; d[o + 1] = v * tint[1]; d[o + 2] = v * tint[2]; d[o + 3] = 255;
    }
  }
  out.putImageData(img, 0, 0);
  if (kind === 'static') {
    out.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 6; i++) out.fillRect(0, r() * H, W, 2 + r() * 10);
    out.fillStyle = 'rgba(0,0,0,0.82)'; out.fillRect(W / 2 - 92, H / 2 - 26, 184, 52);
    out.strokeStyle = 'rgba(230,230,230,0.8)'; out.lineWidth = 1; out.strokeRect(W / 2 - 88, H / 2 - 22, 176, 44);
    out.fillStyle = '#ececec'; out.font = 'bold 17px "Courier New", monospace'; out.textAlign = 'center';
    out.fillText('NO SIGNAL', W / 2, H / 2 - 2); out.font = '12px "Courier New", monospace'; out.fillText('VIDEO LOSS  00:41:12', W / 2, H / 2 + 15); out.textAlign = 'left';
  }
  // OSD
  const date = hour >= 12 ? '12-04-2025' : '12-05-2025';
  const osd = (t, px, py, align = 'left') => { out.textAlign = align; out.fillStyle = 'rgba(0,0,0,0.7)'; out.fillText(t, px + 1, py + 1); out.fillStyle = '#f2f2f2'; out.fillText(t, px, py); };
  out.font = 'bold 13px "Courier New", monospace';
  osd(`CAM${String(frame.cam).padStart(2, '0')}`, 10, 18);
  osd(`${date}  ${frame.tc}`, W - 10, 18, 'right');
  out.font = 'bold 11px "Courier New", monospace';
  osd({ 1: 'ENTRANCE / HALL', 2: 'BAR', 3: 'HALL W' }[frame.cam] || 'HALL', 10, H - 10);
  osd(kind === 'static' ? '' : day ? 'DAY' : 'IR ◐', W - 10, H - 10, 'right');
  out.textAlign = 'left';
}

// ------------------------------------------------------------------ the valley map
/** the river as the old SVG path (viewBox 100×70), extended off the sheet on both ends */
export const RIVER_D = 'M2 74 C4 70, 6 68, 8 66 C18 58, 14 48, 26 44 S40 40, 44 32 S58 22, 66 20 S82 14, 88 6 S94 -1, 98 -4';
function bez(p0, p1, p2, p3, n, out) { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } }
function riverPts() {
  const pts = [[2, 74]];
  bez([2, 74], [4, 70], [6, 68], [8, 66], 6, pts);
  bez([8, 66], [18, 58], [14, 48], [26, 44], 30, pts);
  bez([26, 44], [38, 40], [40, 40], [44, 32], 30, pts);
  bez([44, 32], [48, 24], [58, 22], [66, 20], 30, pts);
  bez([66, 20], [74, 18], [82, 14], [88, 6], 30, pts);
  bez([88, 6], [94, -2], [94, -1], [98, -4], 10, pts);
  return pts;
}
/** a wobbly polyline through control points (Catmull-Rom) */
function curve(ctrl, n = 10) {
  const pts = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; pts.push([0, 1].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3))); }
  }
  pts.push(ctrl[ctrl.length - 1]);
  return pts;
}
function distPoly(pts, px, py) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l), qx = ax + dx * t - px, qy = ay + dy * t - py, d = qx * qx + qy * qy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
const TRIBS = [
  { name: 'руч. Ольховый', pts: curve([[34, 69], [31, 62], [29, 55], [27, 49], [24.5, 45.6]]) },
  { name: 'руч. Каменный', pts: curve([[58, 66], [54, 56], [51, 47], [48, 38], [45.5, 31]]) },
  { name: 'руч. Медвежий', pts: curve([[36, 2], [42, 8], [49, 14], [55, 19], [60, 21.2]]) },
  { name: '', pts: curve([[6, 22], [14, 26], [22, 31], [31, 35], [40.6, 37.2]]) },
  { name: 'руч. Сухой', pts: curve([[99, 32], [92, 27], [85, 22], [78, 18.5], [72, 18.4]]) },
  { name: '', pts: curve([[70, 44], [68, 36], [64, 29], [60, 23]]) },
  { name: '', pts: curve([[12, 4], [16, 12], [19, 20], [20, 26], [22, 31]]) },
];
const LAKE = { cx: -3, cy: 73, rx: 13, ry: 9.5 };
const lakeR = (a) => 1 + 0.1 * Math.sin(3 * a + 1) + 0.06 * Math.sin(7 * a + 2) + 0.03 * Math.sin(13 * a);
const inLake = (mx, my) => { const dx = (mx - LAKE.cx) / LAKE.rx, dy = (my - LAKE.cy) / LAKE.ry; return Math.hypot(dx, dy) - lakeR(Math.atan2(dy, dx)); };
const HIGHWAY = 'M-2 54 C 8 55, 16 57, 26 55 S 46 49, 60 46 S 86 41, 102 38';
const GRAVEL = curve([[60, 46], [65, 39], [69, 33], [73, 27], [78, 22], [82, 17.5], [85, 13], [86.5, 10]]);
const TRAIL = curve([[22, 42], [24, 34], [28, 26], [34, 19], [42, 13], [52, 9], [62, 7]]);
const CLIFF = curve([[70, 7.5], [76, 6], [82, 5.6], [87, 4.6]], 8).concat(curve([[90.5, 3.8], [94, 4.6], [99, 5.4]], 8));

/** height in metres at map units (mx, my), from the precomputed grid + fine detail */
export function paintValleyMap(cv, opts = {}) {
  const W = (cv.width = 1200), H = (cv.height = 840), U = W / 100;
  const x = cv.getContext('2d', { willReadFrequently: true });
  const julian = !!opts.julian;
  const R = mulberry(julian ? 417 : 1104), n1 = valueNoise(11), n2 = valueNoise(23), n3 = valueNoise(37), n4 = valueNoise(51);
  const river = riverPts();
  // ---- fields on a 0.5-unit grid
  const GS = 0.5, GW = 202, GH = 142;
  const hF = new Float32Array(GW * GH), dF = new Float32Array(GW * GH), fF = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    const mx = gx * GS, my = gy * GS, k = gy * GW + gx;
    const d = distPoly(river, mx, my);
    let dt = 1e9; for (const t of TRIBS) dt = Math.min(dt, distPoly(t.pts, mx, my));
    const valley = 1 - Math.exp(-((d / 10) ** 2));
    let h = 642 + (70 - my) * 2.2 + valley * (230 + 330 * fbm(n1, mx * 0.045, my * 0.045, 4)) + valley * 90 * fbm(n2, mx * 0.11, my * 0.11, 3);
    h -= valley * 110 * Math.exp(-((dt / 2.6) ** 2));
    // the cliffs: a plateau north of the scarp line, cut by the gorge
    const cyL = mx < 88 ? 7.5 - (mx - 70) * 0.16 : 3.8 + (mx - 90) * 0.18;
    h += 380 * smooth(66, 74, mx) * smooth(-0.6, 1.4, cyL - my) * smooth(0.5, 3.5, d);
    const lk = inLake(mx, my);
    if (lk < 0) h = 640;
    hF[k] = h; dF[k] = Math.min(d, lk < 0 ? 0 : 99);
    fF[k] = smooth(0.46, 0.56, fbm(n3, mx * 0.075 + 9, my * 0.075, 4) + 0.05 * Math.exp(-((d / 6) ** 2))) * smooth(1.2, 2.2, d) * (h < 1080 ? 1 : 0) * smooth(0.6, 2, lk);
  }
  const bil = (A, mx, my) => {
    const gx = clamp(mx / GS, 0, GW - 1.001), gy = clamp(my / GS, 0, GH - 1.001), ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, k = iy * GW + ix;
    return (A[k] * (1 - fx) + A[k + 1] * fx) * (1 - fy) + (A[k + GW] * (1 - fx) + A[k + GW + 1] * fx) * fy;
  };
  // ---- full-res heights (grid + fine detail)
  const Hh = new Float32Array(W * H);
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const mx = px / U, my = py / U; Hh[py * W + px] = bil(hF, mx, my) + (fbm(n4, mx * 0.5, my * 0.5, 2) - 0.5) * 34 * clamp(bil(dF, mx, my) / 3); }
  // ---- paper, relief tint, hillshade, forest hatching, contours
  const img = x.createImageData(W, H), d = img.data;
  const base = julian ? [228, 219, 196] : [233, 222, 192];
  const labelSpots = [];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const k = py * W + px, mx = px / U, my = py / U, h = Hh[k];
    const hx = Hh[k + (px < W - 1 ? 1 : 0)] - Hh[k - (px > 0 ? 1 : 0)], hy = Hh[k + (py < H - 1 ? W : 0)] - Hh[k - (py > 0 ? W : 0)];
    const shade = clamp(1 + (-hx * 0.7 - hy * 0.7) * 0.012, 0.86, 1.08);
    const grain = 1 + (n2(px * 0.05, py * 0.05) - 0.5) * 0.07 + (R() - 0.5) * 0.045;
    const t = smooth(700, 1150, h);
    let cr = base[0] * (1 - t * 0.02) + t * 4, cg = base[1] * (1 - t * 0.07), cb = base[2] * (1 - t * 0.16);
    cg *= 1 + (1 - t) * 0.012;
    const fo = bil(fF, mx, my);
    if (fo > 0.01) {
      cr *= 1 - 0.2 * fo; cg *= 1 - 0.07 * fo; cb *= 1 - 0.24 * fo;
      if ((px - py * 0.9 + 4000) % 7 < 1.1 && fo > 0.35) { cr *= 0.8; cg *= 0.88; cb *= 0.8; }
    }
    let m = shade * grain;
    // contours: 20 m, index every 100 m
    const dw = bil(dF, mx, my);
    if (dw > 0.9 && px < W - 1 && py < H - 1) {
      const b0 = Math.floor(h / 20), b1 = Math.floor(Hh[k + 1] / 20), b2 = Math.floor(Hh[k + W] / 20);
      if (b0 !== b1 || b0 !== b2) {
        const idx = Math.floor(h / 100) !== Math.floor(Hh[k + 1] / 100) || Math.floor(h / 100) !== Math.floor(Hh[k + W] / 100);
        const a = idx ? 0.62 : 0.4;
        cr = cr * (1 - a) + 150 * a; cg = cg * (1 - a) + 96 * a; cb = cb * (1 - a) + 52 * a;
        if (idx && R() < 0.004) labelSpots.push([px, py, Math.round(h / 100) * 100, Math.atan2(hy, hx)]);
      } else if (px > 0 && py > 0) {
        const i0 = Math.floor(h / 100), i1 = Math.floor(Hh[k - 1] / 100), i2 = Math.floor(Hh[k - W] / 100);
        if (i0 !== i1 || i0 !== i2) { cr = cr * 0.62 + 150 * 0.38; cg = cg * 0.62 + 96 * 0.38; cb = cb * 0.62 + 52 * 0.38; }
      }
    }
    const o = k * 4; d[o] = cr * m; d[o + 1] = cg * m; d[o + 2] = cb * m; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);

  x.save(); x.scale(U, U);
  const P = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); };
  // ---- tree symbols sprinkled through the forest
  for (let i = 0; i < 900; i++) {
    const mx = R() * 100, my = R() * 70; if (bil(fF, mx, my) < 0.6) continue;
    x.strokeStyle = 'rgba(70,96,58,0.55)'; x.lineWidth = 0.09; x.beginPath(); x.arc(mx, my, 0.32, 0, 7); x.stroke();
    x.fillStyle = 'rgba(70,96,58,0.6)'; x.fillRect(mx - 0.04, my + 0.3, 0.08, 0.28);
  }
  // ---- marsh by the river
  for (let i = 0; i < 260; i++) {
    const mx = R() * 100, my = R() * 70, dd = bil(dF, mx, my); if (dd < 1.2 || dd > 3.2 || fbm(n1, mx * 0.2, my * 0.2) < 0.55) continue;
    x.strokeStyle = 'rgba(60,100,130,0.55)'; x.lineWidth = 0.08; x.beginPath(); x.moveTo(mx - 0.45, my); x.lineTo(mx + 0.45, my);
    for (const k of [-0.25, 0, 0.25]) { x.moveTo(mx + k, my); x.lineTo(mx + k * 1.4, my - 0.35); }
    x.stroke();
  }
  // ---- water: lake with shore lines, tributaries, the river
  const lakePath = () => { x.beginPath(); for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2, rr = lakeR(a); const px = LAKE.cx + Math.cos(a) * LAKE.rx * rr, py = LAKE.cy + Math.sin(a) * LAKE.ry * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); };
  lakePath(); x.fillStyle = '#a9c3cc'; x.fill();
  for (let i = 1; i <= 4; i++) { x.save(); lakePath(); x.clip(); x.translate(LAKE.cx, LAKE.cy); x.scale(1 - i * 0.07, 1 - i * 0.09); x.translate(-LAKE.cx, -LAKE.cy); lakePath(); x.strokeStyle = `rgba(60,100,130,${0.4 - i * 0.07})`; x.lineWidth = 0.1; x.stroke(); x.restore(); }
  lakePath(); x.strokeStyle = '#3f6a86'; x.lineWidth = 0.16; x.stroke();
  for (const t of TRIBS) {
    for (let i = 0; i < t.pts.length - 1; i++) { const w = 0.1 + (i / t.pts.length) * 0.32; x.strokeStyle = '#4f7d9c'; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(...t.pts[i]); x.lineTo(...t.pts[i + 1]); x.stroke(); }
  }
  const rp = new Path2D(RIVER_D);
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.strokeStyle = '#3d6884'; x.lineWidth = 1.55; x.stroke(rp);
  x.strokeStyle = '#a7c4d2'; x.lineWidth = 1.2; x.stroke(rp);
  x.strokeStyle = 'rgba(70,110,140,0.35)'; x.lineWidth = 0.08; x.setLineDash([0.9, 0.7]); x.stroke(rp); x.setLineDash([]);
  for (const [i, s] of [[40, 0.55], [84, 0.4], [118, 0.5]]) { const [a, b] = river[i]; x.fillStyle = '#e4d8b6'; x.beginPath(); x.ellipse(a, b, s, 0.22, Math.atan2(river[i + 1][1] - b, river[i + 1][0] - a), 0, 7); x.fill(); x.strokeStyle = '#3d6884'; x.lineWidth = 0.06; x.stroke(); }
  // ---- power line, trail, gravel road, highway with a bridge
  x.strokeStyle = 'rgba(30,30,30,0.6)'; x.lineWidth = 0.08; x.beginPath(); x.moveTo(-1, 37); x.lineTo(101, 25); x.stroke();
  for (let t = 0; t < 1; t += 0.035) { const px = -1 + 102 * t, py = 37 - 12 * t; x.beginPath(); x.moveTo(px - 0.05, py - 0.45); x.lineTo(px + 0.05, py + 0.45); x.stroke(); }
  x.fillStyle = 'rgba(30,30,30,0.85)'; for (const p of TRAIL.filter((_, i) => i % 2 === 0)) { x.beginPath(); x.arc(p[0], p[1], 0.13, 0, 7); x.fill(); }
  P(GRAVEL); x.strokeStyle = '#3a2a1c'; x.lineWidth = 0.5; x.stroke(); x.strokeStyle = '#f0e6cc'; x.lineWidth = 0.3; x.stroke(); x.strokeStyle = '#8a5a2e'; x.setLineDash([0.9, 0.6]); x.lineWidth = 0.3; x.stroke(); x.setLineDash([]);
  const hw = new Path2D(HIGHWAY);
  x.strokeStyle = '#2a1e16'; x.lineWidth = 0.95; x.stroke(hw); x.strokeStyle = '#d9663c'; x.lineWidth = 0.62; x.stroke(hw); x.strokeStyle = 'rgba(255,240,210,0.6)'; x.lineWidth = 0.08; x.setLineDash([1, 1]); x.stroke(hw); x.setLineDash([]);
  // bridge where the highway crosses the river
  { const bx = 16.4, by = 56.3; x.save(); x.translate(bx, by); x.rotate(-0.15); x.fillStyle = '#efe6cc'; x.fillRect(-1.3, -0.62, 2.6, 1.24); x.strokeStyle = '#1e1a16'; x.lineWidth = 0.14;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(-1.6, s * 0.95); x.lineTo(-1.1, s * 0.6); x.lineTo(1.1, s * 0.6); x.lineTo(1.6, s * 0.95); x.stroke(); }
    x.fillStyle = '#d9663c'; x.fillRect(-1.3, -0.3, 2.6, 0.6); x.restore(); }
  // ---- cliffs: scarp line with rock hachures
  P(CLIFF); x.strokeStyle = '#3a2a1c'; x.lineWidth = 0.14; x.stroke();
  for (let i = 0; i < CLIFF.length - 1; i++) {
    const [a, b] = CLIFF[i], [c, e] = CLIFF[i + 1]; if (Math.hypot(c - a, e - b) > 2) continue;
    for (let t = 0; t < 1; t += 0.34) { const px = a + (c - a) * t, py = b + (e - b) * t, l = 0.7 + R() * 1.1; x.lineWidth = 0.11; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 0.18 + R() * 0.36, py + l); x.stroke(); }
    if (R() < 0.3) { x.fillStyle = '#3a2a1c'; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 0.5, b + 1.1); x.lineTo(a - 0.3, b + 0.9); x.fill(); }
  }
  // ---- buildings and spot heights
  const bld = (bx, by, n = 1) => { for (let i = 0; i < n; i++) { x.fillStyle = '#1e1a16'; x.fillRect(bx + (i % 3) * 0.75, by + Math.floor(i / 3) * 0.75, 0.5, 0.5); } };
  bld(55, 50.5, 5); bld(34.2, 18.4); bld(70.4, 29.2, 2); bld(10.5, 40.5, 2); bld(91, 39.5, 3);
  const spot = (sx, sy, h) => { x.fillStyle = '#2a1e16'; x.beginPath(); x.moveTo(sx, sy - 0.45); x.lineTo(sx + 0.4, sy + 0.25); x.lineTo(sx - 0.4, sy + 0.25); x.fill(); x.font = 'italic 1.25px "Old Standard TT", Georgia, serif'; x.fillText(h, sx + 0.7, sy + 0.45); };
  spot(93, 2.6, '1384'); spot(70, 3.6, '1302'); spot(9, 33, '1046'); spot(48, 62, '988'); spot(95, 46, '1112'); spot(30, 9, '1175');
  x.restore();

  // ---- contour numbers, set along the index contours
  x.save();
  const pinsAt = [[22, 47], [43, 34], [62, 22], [74, 15], [80, 9], [84, 5], [86, 4], [78, 12]];
  const placed = [];
  for (const [px, py, h, a] of labelSpots) {
    const mx = px / U, my = py / U;
    if (pinsAt.some(([q, w]) => Math.hypot(q - mx, (w - my) * 1) < 6) || placed.some(([q, w]) => Math.hypot(q - px, w - py) < 140)) continue;
    if (mx < 3 || mx > 97 || my < 3 || my > 67 || (mx < 38 && my < 13) || (mx > 58 && my > 55)) continue;
    placed.push([px, py]);
    x.save(); x.translate(px, py); let ang = a + Math.PI / 2; if (Math.cos(ang) < 0) ang += Math.PI; x.rotate(ang);
    x.font = '13px "Old Standard TT", Georgia, serif'; const tw = x.measureText(h).width;
    x.fillStyle = `rgb(${base.join(',')})`; x.fillRect(-tw / 2 - 2, -7, tw + 4, 13); x.fillStyle = '#8a5a30'; x.textAlign = 'center'; x.fillText(h, 0, 4); x.restore();
  }
  x.restore();

  // ---- UTM grid
  x.strokeStyle = 'rgba(60,90,150,0.32)'; x.lineWidth = 1;
  for (let i = 10; i < 100; i += 10) { x.beginPath(); x.moveTo(i * U, 0); x.lineTo(i * U, H); x.stroke(); }
  for (let i = 10; i < 70; i += 10) { x.beginPath(); x.moveTo(0, i * U); x.lineTo(W, i * U); x.stroke(); }

  // ---- lettering
  const label = (t, lx, ly, { size = 15, font = 'italic', color = '#2a2018', ang = 0, sp = 0, family = '"Old Standard TT", Georgia, serif', halo = true } = {}) => {
    x.save(); x.translate(lx * U, ly * U); x.rotate(ang); x.font = `${font} ${size}px ${family}`; x.textAlign = 'center';
    if (sp) x.letterSpacing = `${sp}px`;
    if (halo) { x.strokeStyle = `rgba(${base.join(',')},0.85)`; x.lineWidth = 3; x.lineJoin = 'round'; x.strokeText(t, 0, 0); }
    x.fillStyle = color; x.fillText(t, 0, 0); x.restore();
  };
  // the river name along its curve
  const along = (t, i0, step, off, size, color) => {
    let i = i0;
    for (const ch of t) {
      const [a, b] = river[Math.min(i, river.length - 3)], [c, e] = river[Math.min(i, river.length - 3) + 2], ang = Math.atan2(e - b, c - a), nx = Math.sin(ang), ny = -Math.cos(ang);
      label(ch, a + nx * off, b + ny * off, { size, color, ang, font: 'italic', halo: true });
      i += step;
    }
  };
  along('р. ТАКХИНИ', 66, 2, 1.9, 19, '#2f5f80');
  along('ТАКХИНИ', 108, 2, -1.9, 15, '#2f5f80');
  label('оз. Кусава', 7.5, 69, { size: 18, color: '#2f5f80' });
  TRIBS.forEach((t) => { if (!t.name) return; const i = Math.floor(t.pts.length * 0.35), [a, b] = t.pts[i], [c, e] = t.pts[i + 1]; let ang = Math.atan2(e - b, c - a); if (Math.cos(ang) < 0) ang += Math.PI; label(t.name, a + 1.2, b - 0.5, { size: 12, color: '#3f6f8f', ang }); });
  label('ЧЁРНЫЕ СКАЛЫ', 78.5, 10.7, { size: 13, font: '', color: '#3a2a1c', ang: -0.12, sp: 3, family: '"Playfair SC", Georgia, serif' });
  label('Такхини-Хот-Спрингс', 57, 54, { size: 13, font: '', color: '#1e1a16' });
  label('лагерь рыбаков', 71.5, 31.6, { size: 12, color: '#1e1a16' });
  label('изба', 35, 17.2, { size: 12, color: '#1e1a16' });
  label('ферма Ларсена', 11.5, 43.2, { size: 12, color: '#1e1a16' });
  label('АЛЯСКИНСКАЯ ТРАССА', 39, 53.4, { size: 12, font: '', color: '#5a2a16', ang: -0.2, sp: 2, family: '"Playfair SC", Georgia, serif' });
  label('Уайтхорс 23 км →', 93, 36.6, { size: 12, color: '#5a2a16', ang: -0.08 });
  label('грунт.', 66.4, 37.5, { size: 11, color: '#5a3a1c', ang: -1.0 });
  label('тропа', 26.6, 30, { size: 11, color: '#2a2018', ang: -1.1 });
  label('ЛЭП', 8, 35.4, { size: 10, font: '', color: '#2a2018', ang: -0.12 });
  // highway shield
  { const sx = 30 * U, sy = 52.8 * U; x.fillStyle = '#f2ead4'; x.strokeStyle = '#2a1e16'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(sx - 9, sy - 10); x.lineTo(sx + 9, sy - 10); x.lineTo(sx + 9, sy + 3); x.quadraticCurveTo(sx, sy + 11, sx - 9, sy + 3); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#2a1e16'; x.font = 'bold 12px Georgia, serif'; x.textAlign = 'center'; x.fillText('1', sx, sy + 2); }

  // ---- title cartouche
  x.save();
  const tx = 3.2 * U, ty = 3.2 * U, tw = 33 * U, th = 8.6 * U;
  x.fillStyle = 'rgba(240,232,210,0.94)'; x.fillRect(tx, ty, tw, th);
  x.strokeStyle = '#2a2018'; x.lineWidth = 2; x.strokeRect(tx, ty, tw, th); x.lineWidth = 0.8; x.strokeRect(tx + 4, ty + 4, tw - 8, th - 8);
  x.fillStyle = '#2a2018'; x.textAlign = 'left';
  let ts = 30; x.font = `${ts}px "Playfair SC", Georgia, serif`;
  const title = opts.title || 'ДОЛИНА ТАКХИНИ';
  while (x.measureText(title).width > tw - 28 && ts > 14) { ts--; x.font = `${ts}px "Playfair SC", Georgia, serif`; }
  x.fillText(title, tx + 14, ty + 14 + ts);
  x.font = 'italic 13px "Old Standard TT", Georgia, serif'; x.fillStyle = '#4a3a2a';
  x.fillText('Территория Юкон · Топографическая карта · Лист 105 D/14', tx + 14, ty + th - 30);
  x.fillText('Масштаб 1 : 50 000 · Сечение рельефа 20 м', tx + 14, ty + th - 13);
  x.restore();

  // ---- legend, scale bar, north arrow
  x.save();
  const lx = 37.5 * U, ly = 60.5 * U, lw = 21 * U, lh = 7.6 * U;
  x.fillStyle = 'rgba(240,232,210,0.92)'; x.fillRect(lx, ly, lw, lh); x.strokeStyle = '#2a2018'; x.lineWidth = 1; x.strokeRect(lx, ly, lw, lh);
  x.font = '11px "Old Standard TT", Georgia, serif'; x.fillStyle = '#2a2018';
  const leg = [
    ['трасса', (a, b) => { x.strokeStyle = '#2a1e16'; x.lineWidth = 6; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 26, b); x.stroke(); x.strokeStyle = '#d9663c'; x.lineWidth = 4; x.stroke(); }],
    ['грунт. дорога', (a, b) => { x.strokeStyle = '#8a5a2e'; x.lineWidth = 3; x.setLineDash([6, 4]); x.beginPath(); x.moveTo(a, b); x.lineTo(a + 26, b); x.stroke(); x.setLineDash([]); }],
    ['тропа', (a, b) => { x.fillStyle = '#2a2018'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(a + 2 + i * 6, b, 1.4, 0, 7); x.fill(); } }],
    ['лес', (a, b) => { x.fillStyle = 'rgba(150,170,120,0.7)'; x.fillRect(a, b - 6, 26, 12); x.strokeStyle = 'rgba(70,96,58,0.8)'; x.lineWidth = 1; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(a + i * 6, b + 6); x.lineTo(a + i * 6 + 6, b - 6); x.stroke(); } }],
    ['скалы', (a, b) => { x.strokeStyle = '#3a2a1c'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(a, b - 4); x.lineTo(a + 26, b - 4); x.stroke(); for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(a + i * 4, b - 4); x.lineTo(a + i * 4, b + 4); x.stroke(); } }],
    ['ЛЭП', (a, b) => { x.strokeStyle = '#2a2018'; x.lineWidth = 1; x.beginPath(); x.moveTo(a, b); x.lineTo(a + 26, b); x.stroke(); for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(a + 3 + i * 7, b - 4); x.lineTo(a + 3 + i * 7, b + 4); x.stroke(); } }],
  ];
  leg.forEach(([t, fn], i) => { const a = lx + 10 + (i % 2) * (lw / 2), b = ly + 18 + Math.floor(i / 2) * 24; fn(a, b); x.fillStyle = '#2a2018'; x.textAlign = 'left'; x.fillText(t, a + 32, b + 4); });
  // scale bar
  const sx0 = 66 * U, sy0 = 66.3 * U, km = 2.4 * U;
  for (let i = 0; i < 5; i++) { x.fillStyle = i % 2 ? '#f2ead4' : '#2a2018'; x.fillRect(sx0 + i * km, sy0, km, 6); }
  x.strokeStyle = '#2a2018'; x.lineWidth = 1; x.strokeRect(sx0, sy0, km * 5, 6);
  x.font = '11px "Old Standard TT", Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#2a2018';
  for (let i = 0; i <= 5; i++) x.fillText(String(i), sx0 + i * km, sy0 - 4);
  x.fillText('километры', sx0 + km * 2.5, sy0 + 19);
  // north arrow / compass rose
  const cx = 92.5 * U, cy = 58 * U, rr = 4.2 * U;
  x.translate(cx, cy);
  x.strokeStyle = 'rgba(42,32,24,0.7)'; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, rr * 0.72, 0, 7); x.stroke(); x.beginPath(); x.arc(0, 0, rr * 0.66, 0, 7); x.stroke();
  for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2, l = i % 4 ? 0.05 : 0.1; x.beginPath(); x.moveTo(Math.cos(a) * rr * 0.72, Math.sin(a) * rr * 0.72); x.lineTo(Math.cos(a) * rr * (0.72 - l), Math.sin(a) * rr * (0.72 - l)); x.stroke(); }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, l = i % 2 ? rr * 0.55 : rr, w = i % 2 ? rr * 0.08 : rr * 0.13;
    for (const s of [-1, 1]) { x.fillStyle = s < 0 ? '#2a2018' : '#f2ead4'; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * l, Math.sin(a) * l); x.lineTo(Math.cos(a + s * 0.5 * Math.PI) * w, Math.sin(a + s * 0.5 * Math.PI) * w); x.closePath(); x.fill(); x.strokeStyle = '#2a2018'; x.lineWidth = 0.8; x.stroke(); }
  }
  x.fillStyle = '#2a2018'; x.font = 'bold 16px "Playfair SC", Georgia, serif'; x.textAlign = 'center'; x.fillText('С', 0, -rr - 4);
  x.font = '11px "Playfair SC", Georgia, serif'; x.fillText('Ю', 0, rr + 12); x.fillText('В', rr + 8, 4); x.fillText('З', -rr - 8, 4);
  x.restore();

  // ---- pencil / ink notes and the evidence stamp
  const hand = (t, hx, hy, ang, size = 26, col = 'rgba(52,52,58,0.78)') => { x.save(); x.translate(hx * U, hy * U); x.rotate(ang); x.font = `${size}px MonteCarlo, Pinyon, cursive`; x.fillStyle = col; x.textAlign = 'left'; x.fillText(t, 0, 0); x.restore(); };
  const pencilCircle = (cx0, cy0, rx, ry, col = 'rgba(52,52,58,0.6)') => { x.save(); x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2.15, j = 1 + (R() - 0.5) * 0.06; const px = cx0 * U + Math.cos(a) * rx * U * j, py = cy0 * U + Math.sin(a) * ry * U * j; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.restore(); };
  if (julian) {
    hand('патруль 2 р./сут.', 4.5, 24, -0.05);
    hand('след 18 см — не волк', 27.5, 26.8, -0.08);
    pencilCircle(35, 18.6, 2.2, 1.6); hand('?', 37.6, 17.4, 0.1, 30);
    hand('мост — камера ДОТ', 5.5, 61.5, -0.03, 22);
    // round evidence stamp, faded: drawn on its own sheet, eroded, then pressed onto the map
    const st = document.createElement('canvas'), sr = 5.6 * U; st.width = st.height = Math.ceil(sr * 2.4); const y = st.getContext('2d', { willReadFrequently: true });
    y.translate(st.width / 2, st.height / 2); y.strokeStyle = '#4a3a8a'; y.fillStyle = '#4a3a8a'; y.lineWidth = 3; y.beginPath(); y.arc(0, 0, sr, 0, 7); y.stroke(); y.lineWidth = 1.2; y.beginPath(); y.arc(0, 0, sr * 0.7, 0, 7); y.stroke();
    y.font = 'bold 11px "Courier New", monospace'; const ring = 'КККП · УАЙТХОРС · ОТДЕЛ ТЯЖКИХ ПРЕСТУПЛЕНИЙ · ';
    [...ring].forEach((ch, i) => { y.save(); y.rotate((i / ring.length) * Math.PI * 2); y.fillText(ch, -3, -sr * 0.78); y.restore(); });
    y.font = 'bold 15px "Courier New", monospace'; y.textAlign = 'center'; y.fillText('ВЕЩДОК', 0, -2); y.font = 'bold 13px "Courier New", monospace'; y.fillText('0417-ФН', 0, 16);
    y.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 700; i++) { y.fillStyle = `rgba(0,0,0,${R()})`; y.fillRect((R() - 0.5) * sr * 2.3, (R() - 0.5) * sr * 2.3, 2 + R() * 5, 1 + R() * 3); }
    x.save(); x.translate(89 * U, 32 * U); x.rotate(-0.28); x.globalAlpha = 0.62; x.globalCompositeOperation = 'multiply'; x.drawImage(st, -st.width / 2, -st.height / 2); x.restore();
  } else {
    hand('тут выли', 6, 29, -0.1, 28, 'rgba(40,52,110,0.8)');
    hand('вороны!', 27, 25.5, 0.06, 28, 'rgba(40,52,110,0.8)');
    pencilCircle(57, 51.4, 4.4, 2.6, 'rgba(40,52,110,0.55)'); hand('закрыто с окт.', 62.5, 52.5, -0.04, 22, 'rgba(40,52,110,0.75)');
  }

  // ---- paper ageing: stains, foxing, fold creases, edge wear
  x.save(); x.globalCompositeOperation = 'multiply';
  const ringStain = (sx, sy, sr) => { for (let i = 0; i < 3; i++) { x.strokeStyle = `rgba(150,100,50,${0.12 + R() * 0.12})`; x.lineWidth = 2 + R() * 4; x.beginPath(); x.arc(sx + R() * 3, sy + R() * 3, sr + R() * 4, R() * 6, R() * 6 + 4.5 + R() * 2); x.stroke(); } const g = x.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr); g.addColorStop(0, 'rgba(190,150,100,0.12)'); g.addColorStop(1, 'rgba(190,150,100,0)'); x.fillStyle = g; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill(); };
  ringStain(julian ? 16 * U : 82 * U, julian ? 31 * U : 44 * U, 48);
  for (let i = 0; i < 4; i++) { const sx = R() * W, sy = R() * H, sr = 30 + R() * 90; const g = x.createRadialGradient(sx, sy, 0, sx, sy, sr); g.addColorStop(0, 'rgba(200,170,120,0.0)'); g.addColorStop(0.8, 'rgba(190,150,100,0.14)'); g.addColorStop(1, 'rgba(190,150,100,0)'); x.fillStyle = g; x.beginPath(); x.arc(sx, sy, sr, 0, 7); x.fill(); }
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(150,100,60,${0.08 + R() * 0.25})`; x.beginPath(); x.arc(R() * W, R() * H, 0.6 + R() * 2.2, 0, 7); x.fill(); }
  // folds: three vertical, one horizontal; each panel slightly differently lit
  const fx = [W / 4, W / 2, (3 * W) / 4], fy = H / 2;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const g = x.createLinearGradient(i * W / 4, j * fy, (i + 1) * W / 4, (j + 1) * fy);
    const a = 0.04 + ((i + j) % 2) * 0.05; g.addColorStop(0, `rgba(160,140,110,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(i * W / 4, j * fy, W / 4, fy);
  }
  x.strokeStyle = 'rgba(90,70,50,0.35)'; x.lineWidth = 1.4;
  for (const v of fx) { x.beginPath(); x.moveTo(v, 0); for (let yy = 0; yy <= H; yy += 40) x.lineTo(v + (R() - 0.5) * 1.5, yy); x.stroke(); }
  x.beginPath(); x.moveTo(0, fy); for (let xx = 0; xx <= W; xx += 40) x.lineTo(xx, fy + (R() - 0.5) * 1.5); x.stroke();
  // edge darkening
  const eg = (x0, y0, x1, y1) => { const g = x.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(120,90,50,0.38)'); g.addColorStop(1, 'rgba(255,255,255,0)'); return g; };
  x.fillStyle = eg(0, 0, 60, 0); x.fillRect(0, 0, 60, H); x.fillStyle = eg(W, 0, W - 60, 0); x.fillRect(W - 60, 0, 60, H);
  x.fillStyle = eg(0, 0, 0, 50); x.fillRect(0, 0, W, 50); x.fillStyle = eg(0, H, 0, H - 50); x.fillRect(0, H - 50, W, 50);
  x.restore();
  // crease highlights and abrasion (ink rubbed away along the folds)
  x.save(); x.strokeStyle = 'rgba(255,250,235,0.5)'; x.lineWidth = 1;
  for (const v of fx) { x.beginPath(); x.moveTo(v + 1.5, 0); x.lineTo(v + 1.5, H); x.stroke(); }
  x.beginPath(); x.moveTo(0, fy + 1.5); x.lineTo(W, fy + 1.5); x.stroke();
  for (let i = 0; i < 700; i++) { const onV = R() < 0.75, px = onV ? fx[Math.floor(R() * 3)] + (R() - 0.5) * 6 : R() * W, py = onV ? R() * H : fy + (R() - 0.5) * 6; x.fillStyle = `rgba(240,232,212,${0.3 + R() * 0.5})`; x.fillRect(px, py, 1 + R() * 2, 1 + R() * 3); }
  for (const v of fx) { const g = x.createRadialGradient(v, fy, 0, v, fy, 12); g.addColorStop(0, 'rgba(236,226,204,0.55)'); g.addColorStop(1, 'rgba(245,238,220,0)'); x.fillStyle = g; x.beginPath(); x.arc(v, fy, 12, 0, 7); x.fill(); }
  x.restore();
  // neat line
  x.strokeStyle = '#2a2018'; x.lineWidth = 2.5; x.strokeRect(10, 10, W - 20, H - 20); x.lineWidth = 0.8; x.strokeRect(16, 16, W - 32, H - 32);
  x.font = '10px "Old Standard TT", Georgia, serif'; x.fillStyle = '#4a3a2a'; x.textAlign = 'center';
  for (let i = 10; i < 100; i += 20) x.fillText(`${(4 + i / 10) | 0}⁰⁰`, i * U, 9);
  x.textAlign = 'left'; x.fillText('135°30′', 20, 28);
}

// ------------------------------------------------------------------ Lizzie's phone snapshot
/** a little flash photo of forest ground for the polaroid preview (when the game canvas can't be read) */
export function paintSnapshot(cv, label) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d'), r = mulberry([...label].reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0), n = valueNoise(5);
  const img = x.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const v = fbm(n, i * 0.08, y * 0.08, 4), leaf = fbm(n, i * 0.3 + 40, y * 0.3, 2);
    const fall = 1 - Math.hypot((i - W / 2) / W, (y - H * 0.55) / H) * 1.4;
    const o = (y * W + i) * 4, b = clamp(fall) * (0.5 + v * 0.8);
    d[o] = (110 + leaf * 70) * b; d[o + 1] = (98 + leaf * 50) * b; d[o + 2] = (80 + v * 30) * b; d[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.strokeStyle = 'rgba(30,24,18,0.7)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const a = r() * W, b = r() * H; x.beginPath(); x.moveTo(a, b); x.lineTo(a + (r() - 0.5) * 30, b + (r() - 0.5) * 12); x.stroke(); }
  x.fillStyle = 'rgba(240,236,224,0.85)';
  if (label === 'кости') for (let i = 0; i < 5; i++) { x.save(); x.translate(W * (0.3 + r() * 0.4), H * (0.4 + r() * 0.3)); x.rotate(r() * 3); x.fillRect(-12, -2, 24, 4); x.beginPath(); x.arc(-12, 0, 3, 0, 7); x.arc(12, 0, 3, 0, 7); x.fill(); x.restore(); }
  if (label === 'следы') for (let i = 0; i < 3; i++) { const a = W * (0.3 + i * 0.2), b = H * (0.7 - i * 0.15); x.fillStyle = 'rgba(20,16,12,0.75)'; x.beginPath(); x.ellipse(a, b, 7, 6, 0, 0, 7); x.fill(); for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(a - 7 + k * 4.6, b - 10, 2, 2.6, 0, 0, 7); x.fill(); } }
  if (label === 'борозды') { x.strokeStyle = 'rgba(230,210,180,0.85)'; x.lineWidth = 2; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(W * 0.35 + k * 8, H * 0.2); x.lineTo(W * 0.42 + k * 9, H * 0.8); x.stroke(); } }
  if (label === 'вороны') for (let i = 0; i < 4; i++) { const a = W * (0.2 + r() * 0.6), b = H * (0.25 + r() * 0.4); x.fillStyle = '#0c0a0a'; x.beginPath(); x.ellipse(a, b, 6, 3.5, 0.2, 0, 7); x.fill(); x.beginPath(); x.moveTo(a - 3, b); x.lineTo(a - 14, b - 6); x.lineTo(a + 2, b - 2); x.fill(); x.beginPath(); x.moveTo(a + 3, b); x.lineTo(a + 14, b - 7); x.lineTo(a, b - 2); x.fill(); }
  if (label === 'туши') { x.fillStyle = 'rgba(120,40,30,0.85)'; x.beginPath(); x.ellipse(W / 2, H * 0.6, W * 0.25, H * 0.13, -0.1, 0, 7); x.fill(); x.strokeStyle = 'rgba(235,225,210,0.8)'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(W / 2, H * 0.6, 8 + k * 3, 3.4, 4.6); x.stroke(); } }
  if (label === 'берёзка') { x.strokeStyle = '#e8e4da'; x.lineWidth = 5; x.beginPath(); x.moveTo(W * 0.5, H); x.lineTo(W * 0.46, H * 0.45); x.lineTo(W * 0.6, H * 0.05); x.stroke(); x.strokeStyle = '#1a1612'; x.lineWidth = 1.4; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(W * 0.46, H * (0.3 + k * 0.1)); x.lineTo(W * 0.5, H * (0.3 + k * 0.1)); x.stroke(); } }
}
