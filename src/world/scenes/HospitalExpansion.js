import * as THREE from 'three';
import { tiled } from '../LocationBase.js';
import { canvasTexture, rng, streetTexture } from '../../render/textures.js';
import { glow, lightPool } from '../props.js';

/**
 * Whitehorse General, the rest of the ground floor: the corridor goes on past
 * ward 109 through the PATIENT WING (wards 111/113 with privacy curtains, linen
 * room, waiting nook under a cold window, ward 115), then through a heavy
 * doorway into the OLD WING (high ceiling, retro tiled floor, wooden door
 * frames, tall bright windows, a closed department, the archive) that ends at
 * the old OPERATING AREA — seen through porthole doors and an observation
 * window, never entered — and a boarded-off side corridor going on into the dark.
 *
 * Built from a small modular kit (wall run + dressing, closed ward, privacy
 * curtain OPEN/PARTIAL/CLOSED, door frames, windows that feed the window-light
 * system) and installed onto HospitalScene, so the original scene, its two
 * story wards and every scripted event stay untouched.
 *
 *   x 21 … 23   end of the old corridor (opened up)
 *   x 23 … 37   patient wing: 111 (partial), linen, 113 (closed), waiting + window B, 115
 *   x 37        DOOR_FRAME_LARGE (foreground posts the camera passes)
 *   x 37 … 57   old wing: archive, window A, dept. B (closed), window C (blinds),
 *               OR doors, observation window, boarded side corridor; window D in the end wall
 */

let TX, BACK, H, shaftTexture;
export const X_WING = 23, X_OLD = 37, X_END = 57;
const H2 = 3.8; // old wing ceiling

const T = (key, w, h, draw) => canvasTexture(`hospx-${key}`, w, h, (ctx, cw, ch) => { ctx.imageSmoothingEnabled = false; draw(ctx, cw, ch); }, { nearest: true, aniso: 1 });
const px = (c, col, x, y, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

const TXX = {
  /** Old operating-wing floor: pale terrazzo squares with small dark-green insets, worn. */
  retroFloor: () => T('retro', 64, 64, (c, w, h) => {
    const r = rng(301);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = 184 + (r() - 0.5) * 12 + Math.sin((x + y) * 0.3) * 2;
      px(c, `rgb(${v | 0},${(v - 4) | 0},${(v - 18) | 0})`, x, y);
    }
    // grout grid every 16 px, a dark-green diamond inset at every crossing
    for (let k = 0; k < w; k += 16) { px(c, 'rgba(90,86,72,0.55)', k, 0, 1, h); px(c, 'rgba(90,86,72,0.55)', 0, k, w, 1); }
    for (let yy = 0; yy <= h; yy += 16) for (let xx = 0; xx <= w; xx += 16) {
      for (let d = -2; d <= 2; d++) {
        const span = 2 - Math.abs(d);
        for (let e = -span; e <= span; e++) px(c, (d + e) % 2 ? '#5a7262' : '#627a68', (xx + e + w) % w, (yy + d + h) % h);
      }
    }
    // wear: scuffs along the walking line, a few cracked tiles, stains
    for (let i = 0; i < 70; i++) px(c, `rgba(70,64,52,${0.08 + r() * 0.12})`, r() * w, r() * h, 2 + r() * 5, 1);
    for (let i = 0; i < 6; i++) { let x = r() * w, y = r() * h; for (let k = 0; k < 8; k++) { px(c, 'rgba(60,56,48,0.5)', x, y); x += r() < 0.5 ? 1 : 0; y += 1; } }
  }),
  /** Old wing upper wall: pale institutional green, flaking, patched. */
  oldPaint: () => T('oldpaint', 64, 64, (c, w, h) => {
    const r = rng(302);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (r() - 0.5) * 8; px(c, `rgb(${(196 + v) | 0},${(206 + v) | 0},${(188 + v) | 0})`, x, y); }
    for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, s = 2 + r() * 5; px(c, 'rgba(232,226,206,0.8)', x, y, s, s * 0.7); px(c, 'rgba(120,120,104,0.35)', x, y + s * 0.7, s, 1); }
    for (let i = 0; i < 4; i++) { let x = r() * w, y = 0; for (let k = 0; k < 20; k++) { px(c, 'rgba(110,112,98,0.25)', x, y); x += (r() - 0.5) * 2; y += 1 + (r() < 0.3 ? 1 : 0); } }
  }),
  /** Old wing dado: dark-green gloss paint, chipped at the edges. */
  oldDado: () => T('olddado', 64, 32, (c, w, h) => {
    const r = rng(303);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (r() - 0.5) * 6 + (y < 3 ? 14 : 0); px(c, `rgb(${(46 + v) | 0},${(78 + v) | 0},${(64 + v) | 0})`, x, y); }
    for (let i = 0; i < 12; i++) px(c, 'rgba(200,196,180,0.7)', r() * w, r() * h, 1 + r() * 2, 1);
  }),
  /** Frosted, wired glass with a soft light behind it. */
  frosted: () => T('frosted', 32, 48, (c, w, h) => {
    const r = rng(304);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dfe6e2'); g.addColorStop(1, '#b8c2be');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) px(c, `rgba(255,255,255,${0.1 + r() * 0.2})`, r() * w, r() * h);
    for (let k = 0; k < w; k += 6) px(c, 'rgba(90,96,94,0.35)', k, 0, 1, h);
    for (let k = 0; k < h; k += 6) px(c, 'rgba(90,96,94,0.35)', 0, k, w, 1);
  }),
  /** Operating room wall: small white tiles with a green band. */
  orTiles: () => T('ortiles', 32, 32, (c, w, h) => {
    const r = rng(305);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 222 + (r() - 0.5) * 8; px(c, `rgb(${v | 0},${(v + 4) | 0},${(v + 2) | 0})`, x, y); }
    for (let k = 0; k < w; k += 4) px(c, 'rgba(140,150,146,0.6)', k, 0, 1, h);
    for (let k = 0; k < h; k += 4) px(c, 'rgba(140,150,146,0.6)', 0, k, w, 1);
  }),
  /** Privacy curtain fabric: pale teal with a faint woven check. */
  privacy: () => T('privacy', 32, 32, (c, w, h) => {
    const r = rng(306);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (r() - 0.5) * 6 + ((x % 8 < 1 || y % 8 < 1) ? -10 : 0); px(c, `rgb(${(176 + v) | 0},${(204 + v) | 0},${(204 + v) | 0})`, x, y); }
  }),
  /** Bare branches just outside a window (transparent): late-autumn twigs, a few last leaves, a line of snow. */
  twigs: (seed) => T(`twigs-${seed}`, 96, 72, (c, w, h) => {
    const r = rng(500 + seed);
    const branch = (x, y, a, len, wid) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      c.strokeStyle = '#2a2420'; c.lineWidth = wid; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
      if (wid > 1.2) { c.strokeStyle = 'rgba(232,236,240,0.85)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - wid / 2); c.lineTo(ex, ey - wid / 2); c.stroke(); }
      if (len > 7) for (let k = 0; k < 2; k++) branch(ex, ey, a + (k ? 0.5 : -0.5) + (r() - 0.5) * 0.4, len * 0.62, Math.max(1, wid * 0.65));
      else if (r() < 0.45) { c.fillStyle = ['#d8a020', '#c86a1c', '#b8401c', '#e0b830'][(r() * 4) | 0]; c.fillRect(ex - 1, ey - 1, 2 + (r() * 2 | 0), 2); }
    };
    // one or two limbs reaching in from the sides / the top
    const from = r() < 0.5 ? [[0, h * (0.2 + r() * 0.5), -0.15 + r() * 0.3]] : [[w, h * (0.2 + r() * 0.4), Math.PI + (r() - 0.5) * 0.3]];
    if (r() < 0.6) from.push([w * (0.3 + r() * 0.5), 0, Math.PI / 2 + (r() - 0.5) * 0.6]);
    for (const [x, y, a] of from) branch(x, y, a, 26 + r() * 10, 3.5);
  }),
  /** A seated person's shadow on a curtain (soft-edged silhouette). */
  silhouette: () => canvasTexture('hospx-sil', 64, 128, (c, w, h) => {
    c.fillStyle = 'rgba(10,14,18,0.9)';
    c.beginPath(); c.ellipse(w * 0.5, h * 0.18, w * 0.16, h * 0.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(w * 0.3, h * 0.3); c.quadraticCurveTo(w * 0.5, h * 0.24, w * 0.72, h * 0.3); c.lineTo(w * 0.8, h * 0.62); c.lineTo(w * 0.2, h * 0.62); c.fill();
    c.fillRect(w * 0.2, h * 0.6, w * 0.7, h * 0.12);
    const img = c.getImageData(0, 0, w, h);
    // soften: a cheap box blur on alpha
    const a = img.data, out = new Uint8ClampedArray(a);
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
      let s = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += a[((y + dy) * w + x + dx) * 4 + 3];
      out[(y * w + x) * 4 + 3] = s / 25;
    }
    img.data.set(out); c.putImageData(img, 0, 0);
  }),
};

const methods = {
  // ---------------------------------------------------------------- kit

  /** Back-wall run with holes, plus the dressing (dado, rail, bumper, skirting) between the holes. */
  wallRun(x0, x1, height, holes, { mat, dado, rail = true, old = false } = {}) {
    this.wall(x0, x1, height, BACK, mat, holes);
    const spans = [];
    let from = x0;
    for (const h of [...holes].sort((a, b) => a.x0 - b.x0)) { if (h.x0 > from) spans.push([from, h.x0]); from = Math.max(from, h.x1); }
    if (from < x1) spans.push([from, x1]);
    const skirt = this.mat('hSkirt', { color: 0x2a3436, roughness: 0.6 });
    const railM = old ? this.mat('hxOldRail', { color: 0x6a4a2c, roughness: 0.45 }) : this.mat('hRail', { map: TX.veneer(), color: 0xc89a6a, roughness: 0.4 });
    for (const [a, b] of spans) {
      const w = b - a, cx = (a + b) / 2;
      if (w < 0.05) continue;
      this.bx(w, old ? 1.25 : 1.0, 0.03, dado, cx, old ? 0.625 : 0.5, BACK + 0.015, { uv: [2, 1] });
      this.bx(w, 0.1, 0.04, skirt, cx, 0.05, BACK + 0.035);
      if (rail) this.cy(0.03, 0.03, w - 0.05, 8, railM, cx, old ? 1.27 : 0.9, BACK + 0.08, { rz: Math.PI / 2 });
      if (rail) for (const ex of [a + 0.06, b - 0.06]) if (b - a > 0.3) {
        // rail brackets
        this.rod([ex, old ? 1.27 : 0.9, BACK + 0.012], [ex, old ? 1.27 : 0.9, BACK + 0.08], 0.008, this.mat('steel'));
      }
      if (old) {
        // tongue-and-groove dado: a moulded cap, panel stiles, a plinth
        this.rb(w, 0.045, 0.05, 0.015, railM, cx, 1.235, BACK + 0.03);
        const np = Math.max(1, Math.round(w / 0.62));
        for (let k = 0; k <= np; k++) this.rb(0.05, 1.08, 0.02, 0.008, dado, a + (w * k) / np, 0.66, BACK + 0.035, { uv: [2, 1] });
        this.rb(w, 0.05, 0.02, 0.008, dado, cx, 1.17, BACK + 0.035, { uv: [2, 1] });
        this.rb(w, 0.05, 0.02, 0.008, dado, cx, 0.15, BACK + 0.035, { uv: [2, 1] });
      }
      if (!old) this.bx(w - 0.05, 0.12, 0.035, this.mat('hBumper', { color: 0x3c5a5e, roughness: 0.6 }), cx, 0.32, BACK + 0.045);
    }
  },

  /** Floor + ceiling + front fascia for a corridor segment. */
  slab(x0, x1, floorMat, ceilH, ceilMat) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, 15), floorMat);
    f.rotation.x = -Math.PI / 2; f.position.set(cx, 0.001, -2.5); this.root.add(f);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, 15), ceilMat);
    c.rotation.x = Math.PI / 2; c.position.set(cx, ceilH, -2.5); this.root.add(c);
    this.bx(w, 0.22, 0.12, this.mat('hFascia', { color: 0x1a1e22, roughness: 0.8 }), cx, ceilH - 0.11, 4.95);
  },

  /**
   * Hospital privacy curtain on a ceiling track. state: 'open' (bunched at one
   * end), 'partial' (about half drawn), 'closed' (drawn across). A separate
   * mesh with pleats and a slow idle sway (ventilation), so it sits in the
   * depth sort and can cover what is behind it.
   */
  privacyCurtain(x0, x1, z, state = 'closed', { top = H - 0.14, drop = 2.2, from = 'left' } = {}) {
    const span = x1 - x0;
    const k = state === 'open' ? 0.16 : state === 'partial' ? 0.55 : 0.97;
    const w = Math.max(0.25, span * k);
    const pleats = Math.max(3, Math.round(w / 0.15));
    const geo = new THREE.PlaneGeometry(w, drop, Math.max(6, pleats * 2), 3);
    const p = geo.attributes.position;
    // tighter, deeper folds when bunched
    const depth = state === 'open' ? 0.09 : 0.075;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * pleats * Math.PI) * depth);
    geo.computeVertexNormals();
    const mat = this.mat(`hxCurtain-${state}`, { map: tiled(TXX.privacy(), w / 0.6, drop / 0.6), color: 0xffffff, roughness: 0.92, side: THREE.DoubleSide });
    if (!mat.userData.sway) {
      mat.userData.sway = true;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSway = this.curtainTime;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uSway;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            float hang = clamp((${(drop / 2).toFixed(2)} - position.y) / ${drop.toFixed(2)}, 0.0, 1.0);
            transformed.z += sin(uSway * 0.7 + position.x * 3.1) * 0.025 * hang + sin(uSway * 1.9 + position.x * 7.0) * 0.008 * hang;
            transformed.x += sin(uSway * 0.5 + position.x * 1.3) * 0.01 * hang;`);
      };
    }
    const m = new THREE.Mesh(geo, mat);
    const cx = from === 'left' ? x0 + w / 2 : x1 - w / 2;
    m.position.set(cx, top - drop / 2, z);
    this.root.add(m);
    // the track
    this.bx(span, 0.025, 0.035, this.mat('steel'), (x0 + x1) / 2, top + 0.02, z);
    // runner hooks
    for (let x = cx - w / 2; x <= cx + w / 2; x += 0.12) this.bx(0.01, 0.04, 0.01, this.mat('steel'), x, top, z);
    this.curtains.push(m);
    return m;
  },

  /** A closed ward behind a glass front (not enterable): bed, curtain, its own light. */
  closedWard(x0, x1, number, { curtain = 'closed', light = 'dark', occupant = false, window = true } = {}) {
    const root = this.root;
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = 3.6, zb = BACK - depth;   // every ward: 3.6 m deep
    const wm = this.mat(`hxWard-${number}`, { map: TX.block(), color: light === 'warm' ? 0xeee0cc : 0xd8e4dc, roughness: 0.8 });
    const winX = cx + 0.5, winW = 1.3, winY0 = 1.05, winY1 = 2.3;
    if (window) {
      this.wall(x0, x1, H, zb, wm, [{ x0: winX - winW / 2, x1: winX + winW / 2, y0: winY0, y1: winY1 }]);
      const view = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'ward107'), color: 0xc8d2dc });
      view.userData.view = 'ward107';
      this.outsideMats.push(view);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.6, winY1 - winY0 + 0.6), view);
      pane.position.set(winX, (winY0 + winY1) / 2, zb - 0.25); root.add(pane);
      this.deepenView(pane, undefined, +number);
      this.pl(winW, (winY1 - winY0) * 0.55, this.texMat('hBlindsW', tiled(TX.blinds(), 4, 4), { transparent: true }), winX, winY1 - (winY1 - winY0) * 0.275, zb + 0.06);
    } else this.bx(w, H, 0.1, wm, cx, H / 2, zb, { uv: [2, 2] });
    this.bx(0.1, H, depth, wm, x0, H / 2, BACK - depth / 2, { uv: [2, 2] });
    this.bx(0.1, H, depth, wm, x1, H / 2, BACK - depth / 2, { uv: [2, 2] });
    this.bx(w, 0.04, depth, this.mat('hxWardFloor', { map: TX.floor(), color: 0xc4ccc8, roughness: 0.35 }), cx, 0.005, BACK - depth / 2, { uv: [2, 2] });
    this.bx(w, 0.04, depth, this.mat('hxWardCeil', { color: 0xc8ccc8, roughness: 0.9 }), cx, H - 0.02, BACK - depth / 2);
    this.bx(w - 0.1, 0.9, 0.02, this.mat('hWains'), cx, 0.45, zb + 0.06, { uv: [2, 1] });
    // glass front with a door at the left (closed)
    const doorX0 = x0 + 0.35, doorX1 = x0 + 1.35;
    const glassMat = this.mat('wardGlass', { color: 0xc8dce8, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
    const lowM = this.mat('wardLow', { map: TX.wainscot(), color: 0xffffff, roughness: 0.55 });
    const alu = this.mat('wardFrame', { color: 0xb8c0c4, metalness: 0.4, roughness: 0.35 });
    this.bx(x1 - doorX1, 0.22, 0.08, lowM, (doorX1 + x1) / 2, 0.11, BACK, { uv: [2, 1] });
    this.box(x1 - doorX1, 2.38, 0.03, glassMat, (doorX1 + x1) / 2, 1.41, BACK);
    this.bx(0.35, 2.6, 0.08, lowM, x0 + 0.175, 1.3, BACK, { uv: [2, 1] });
    this.bx(x1 - x0, 0.1, 0.1, alu, cx, 2.6, BACK);
    this.bx(0.05, 2.6, 0.1, alu, doorX1 + 0.02, 1.3, BACK);
    this.bx(0.05, 2.6, 0.1, alu, x1 - 0.03, 1.3, BACK);
    this.bx(x1 - x0, H - 2.65, 0.1, this.wallMat, cx, (H + 2.65) / 2, BACK);
    this.bx(doorX1 - doorX0, 2.2, 0.05, this.mat('hVeneer', { map: TX.veneer(), color: 0xffffff, roughness: 0.55 }), (doorX0 + doorX1) / 2, 1.1, BACK + 0.01);
    this.bx(0.18, 0.6, 0.055, this.mat('doorGlass'), doorX0 + 0.75, 1.45, BACK + 0.012);
    this.bx(0.14, 0.025, 0.06, this.mat('steel'), doorX0 + 0.12, 1.02, BACK + 0.05);
    this.pl(0.24, 0.09, this.texMat(`hPlaque-${number}`, TX.plaque(number)), x0 + 0.175, 1.62, BACK + 0.045);
    const num = this.textSign(`ПАЛАТА ${number}`, { w: 0.9, h: 0.18 });
    num.position.set(x0 + 0.85, 2.78, BACK + 0.03); root.add(num);
    // bed, locker, IV, a dim monitor
    const bedX = cx + 0.45, bedZ = BACK - 2.0;
    this.bed(bedX, bedZ);
    this.locker(bedX - 1.4, BACK - 2.3, 0.44, 0.7, 0.42);
    this.ivStand(bedX - 1.15, BACK - 1.4);
    const scr = this.mat(`hxMon-${light}`, { color: 0x081008, emissive: 0x30c070, emissiveIntensity: light === 'dark' ? 0.2 : 0.7 });
    this.rb(0.42, 0.3, 0.12, 0.03, this.mat('monitorBody'), bedX - 1.4, 1.45, BACK - 2.8);
    this.rb(0.36, 0.24, 0.01, 0.006, this.mat('hBlack'), bedX - 1.4, 1.45, BACK - 2.742);
    this.rod([bedX - 1.4, 1.42, BACK - 2.86], [bedX - 1.4, 1.42, zb + 0.05], 0.02, this.mat('steelDark'));
    this.pl(0.34, 0.22, scr, bedX - 1.4, 1.45, BACK - 2.735);
    if (occupant) {
      // someone in the bed: a mound under the blanket
      const mound = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.2, 8, 20), this.mat('blanket'));
      mound.rotation.z = Math.PI / 2; mound.scale.set(1, 1, 0.7); mound.position.set(bedX + 0.1, 0.78, bedZ); root.add(mound);
    }
    // the room's own light: emissive panel + a pool (no extra point light)
    const panel = this.mat(`hxPanel-${number}`, { color: 0x101010, emissive: light === 'warm' ? 0xffc890 : 0xdfe8f0, emissiveIntensity: light === 'dark' ? 0 : 1.2 });
    this.bx(1.0, 0.03, 0.5, panel, cx, H - 0.05, BACK - 1.8);
    const pool = this.pool(light === 'warm' ? 0xffb070 : 0xc8d8f0, cx, BACK - 1.8, 3.4, 2.6, light === 'dark' ? 0.05 : 0.22);
    // curtain: drawn across the room just behind the glass
    const cur = this.privacyCurtain(x0 + 0.15, x1 - 0.15, BACK - 0.55, curtain, { from: 'right' });
    if (occupant && curtain === 'closed') {
      // a shadow on the curtain: someone sitting up behind it, now and then shifting
      const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), new THREE.MeshBasicMaterial({ map: TXX.silhouette(), transparent: true, opacity: 0.32, depthWrite: false }));
      sil.position.set(cx + 0.4, 1.32, BACK - 0.6); sil.renderOrder = 3; root.add(sil);
      this.shadowFigures.push({ mesh: sil, base: sil.position.clone(), t: Math.random() * 10 });
    }
    // night: most rooms dark; a warm one keeps its lamp, and a strip of light under the door
    const strip = this.mat(`hxStrip-${number}`, { color: 0x000000, emissive: 0xffc078, emissiveIntensity: 0 });
    this.bx(doorX1 - doorX0 - 0.1, 0.015, 0.02, strip, (doorX0 + doorX1) / 2, 0.012, BACK + 0.04);
    this.expNight.push((night) => {
      const on = light === 'warm' || (!night && light !== 'dark');
      panel.emissiveIntensity = night ? (light === 'warm' ? 0.8 : 0) : (light === 'dark' ? 0 : 1.2);
      pool.material.opacity = night ? (light === 'warm' ? 0.2 : 0.02) : (light === 'dark' ? 0.05 : 0.22);
      strip.emissiveIntensity = night && on ? 2.2 : 0;
      scr.emissiveIntensity = night ? 0.5 : (light === 'dark' ? 0.2 : 0.7);
    });
    void cur;
    return { x0, x1, cx };
  },

  /** A window in the back wall that lets real light in: bright glass, a shaft on the floor, a light zone. */
  brightWindow(x0, x1, y0, y1, profile, view = 'ward107', { blinds = false, z = BACK } = {}) {
    const root = this.root;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, w = x1 - x0, h = y1 - y0;
    const viewMat = new THREE.MeshBasicMaterial({ map: streetTexture('morning', view), color: 0xe4dccc }); // peaks near #F0E8D8, never pure white
    viewMat.userData.view = view;
    this.outsideMats.push(viewMat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.8, h + 0.8), viewMat);
    pane.position.set(cx, cy, z - 0.3); root.add(pane);
    this.deepenView(pane, undefined, Math.round(cx));
    // the glare of the glass itself (washes the view out by day)
    const glareMat = new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glareMat);
    glare.position.set(cx, cy, z - 0.05); glare.renderOrder = 2; root.add(glare);
    // frame, mullions, sill
    const frame = this.mat(profile.old ? 'hxWoodFrame' : 'wardFrame', profile.old ? { color: 0x5a3c22, roughness: 0.5 } : { color: 0xb8c0c4, metalness: 0.4, roughness: 0.35 });
    this.bx(w + 0.14, 0.08, 0.14, frame, cx, y1 + 0.04, z);
    this.bx(w + 0.2, 0.06, 0.24, frame, cx, y0 - 0.03, z + 0.05);
    for (const x of [x0 - 0.04, x1 + 0.04]) this.bx(0.08, h, 0.14, frame, x, cy, z);
    const panes = profile.old ? Math.max(2, Math.round(w / 0.45)) : 2;
    for (let k = 1; k < panes; k++) this.bx(0.04, h, 0.06, frame, x0 + (w * k) / panes, cy, z - 0.02);
    if (profile.old) this.bx(w, 0.04, 0.06, frame, cx, y0 + h * 0.62, z - 0.02);
    if (blinds) {
      const bl = this.pl(w, h * 0.7, this.texMat('hxBlinds', tiled(TX.blinds(), 6, 8), { transparent: true }), cx, y1 - h * 0.35, z + 0.04);
      void bl;
    }
    // the shaft of light falling in, and its patch on the floor
    const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: profile.color, transparent: true, opacity: profile.shaft, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.BufferGeometry();
    const fall = 2.6;
    const v = [x0, y1, z + 0.05, x1, y1, z + 0.05, x0 + 0.6, 0.02, z + fall, x1 + 0.6, 0.02, z + fall];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    const shaft = new THREE.Mesh(geo, shaftMat); shaft.renderOrder = 3; root.add(shaft);
    const patch = this.pool(profile.color, cx + 0.5, z + fall * 0.6, w + 0.8, 2.2, profile.patch);
    // at night the moon lays the window's panes on the floor (cold, faint)
    const panesTex = canvasTexture(`hospx-panes-${panes}`, 64, 64, (c, cw, ch) => {
      c.filter = 'blur(2px)';
      c.fillStyle = '#fff'; c.fillRect(6, 4, cw - 12, ch - 8);
      c.fillStyle = '#000';
      for (let k = 1; k < panes; k++) c.fillRect((cw * k) / panes - 2, 0, 4, ch);
      c.fillRect(0, ch * 0.38 - 2, cw, 4);
      c.globalCompositeOperation = 'destination-in';
      const g = c.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, 'rgba(0,0,0,0.2)'); g.addColorStop(0.3, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
      c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    });
    const moonM = new THREE.MeshBasicMaterial({ map: panesTex, color: 0x6a88c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const moon = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.05, 1.5), moonM);
    moon.rotation.x = -Math.PI / 2; moon.position.set(cx + 0.35, 0.006, z + 1.25); moon.renderOrder = 2; root.add(moon);
    this.expNight.push((night) => { moonM.opacity = night ? 0.25 : 0; });
    // its light zone for WindowLightSystem (exposure/bloom response + lens flare)
    const zone = {
      ...profile,
      position: new THREE.Vector3(cx, cy + h * 0.15, z - 0.1),
      dir: new THREE.Vector3(0, 0, 1),
      enabled: () => !this.night,
    };
    this.windowLights.push(zone);
    this.expNight.push((night) => {
      glareMat.opacity = night ? 0.14 : 0.22;
      glareMat.color.set(night ? 0x5070b0 : profile.color);
      shaftMat.opacity = night ? profile.shaft * 0.45 : profile.shaft;
      shaftMat.color.set(night ? 0x5a78c0 : profile.color);
      patch.material.opacity = night ? profile.patch * 0.5 : profile.patch;
      patch.material.color.set(night ? 0x5a78c0 : profile.color);
    });
    return zone;
  },

  /** Heavy doorway between two parts of the building: pilasters, deep header, and front posts the camera passes. */
  doorFrameLarge(x, { width = 0.7, fgWidth = 0.34, left = H, right = H2, wood = true } = {}) {
    const root = this.root;
    const mat = wood ? this.mat('hxArchWood', { color: 0x6a4a30, roughness: 0.55 }) : this.mat('hxArchPaint', { color: 0xc8ccc4, roughness: 0.6 });
    const edge = this.mat('hxArchEdge', { color: 0x2a1c12, roughness: 0.6 });
    const topH = Math.max(left, right);
    const open = 2.75; // clear height of the doorway
    // back pilaster in the wall plane, full height
    this.bx(width, topH, 0.34, mat, x, topH / 2, BACK + 0.12);
    // deep header across the whole corridor (the ceiling steps up/down here)
    this.bx(width, topH - open, 4.95 - BACK, mat, x, (topH + open) / 2, (BACK + 4.95) / 2);
    this.bx(width + 0.04, 0.05, 4.95 - BACK, edge, x, open + 0.02, (BACK + 4.95) / 2);
    // a step in the ceiling on the low side
    if (right !== left) this.bx(0.06, Math.abs(right - left), 4.95 - BACK, this.mat('hxSoffit', { color: 0xb4b8b0, roughness: 0.8 }), x + width / 2 + 0.03, (left + right) / 2 + Math.abs(right - left) / 2 - Math.abs(right - left) / 2, (BACK + 4.95) / 2);
    // threshold strip
    this.bx(width, 0.012, 4.95 - BACK, this.mat('hxThreshold', { color: 0x8a8678, metalness: 0.6, roughness: 0.4 }), x, 0.006, (BACK + 4.95) / 2);
    // FOREGROUND posts + lintel between the camera and the corridor: Julian walks through them
    const fg = new THREE.Group(); fg.name = `fg-doorframe-${x}`;
    this.box(fgWidth, topH, 0.3, mat, x, topH / 2, 2.75, fg);
    this.box(0.03, topH, 0.31, edge, x - fgWidth / 2, topH / 2, 2.75, fg);
    this.box(0.03, topH, 0.31, edge, x + fgWidth / 2, topH / 2, 2.75, fg);
    root.add(fg);
    this.foregroundGroups.push(fg);
  },

  // ---------------------------------------------------------------- build

  buildExpansion() {
    this.windowLights = [];
    this.expNight = [];
    this.curtains = [];
    this.shadowFigures = [];
    this.pendants = [];
    this.curtainTime = this.curtainTime || { value: 0 };
    this.buildPatientWing();
    this.floorShade(X_WING, X_OLD);
    this.floorShade(X_OLD, X_END);
    this.doorFrameLarge(X_OLD);
    this.buildOldWing();
    this.buildOperating();
    this.buildEndWall();
    // the two story wards keep their curtains OPEN (already bunched at the side)
  },

  buildPatientWing() {
    const root = this.root;
    const floorMat = this.mat('hxFloorA', { map: tiled(TX.floor(), (X_OLD - X_WING) / 2, 7.5), color: 0xd0d8d2, roughness: 0.34 });
    const ceilMat = this.mat('hxCeilA', { map: tiled(TX.ceiling(), (X_OLD - X_WING) / 1.2, 15 / 1.2), roughness: 0.9, emissive: 0xffffff, emissiveMap: tiled(TX.ceiling(), (X_OLD - X_WING) / 1.2, 15 / 1.2), emissiveIntensity: 0.03, color: 0xb8bcb8 });
    this.slab(X_WING, X_OLD, floorMat, H, ceilMat);
    const holes = [
      { x0: 23.3, x1: 27.3, y0: 0, y1: 2.6 },  // ward 111
      { x0: 27.55, x1: 28.45, y0: 0, y1: 2.2 }, // linen
      { x0: 28.8, x1: 32.8, y0: 0, y1: 2.6 },  // ward 113 — the old woman
      { x0: 33.2, x1: 34.8, y0: 1.25, y1: 2.55 }, // window B over the waiting chairs
      { x0: 35.0, x1: 35.9, y0: 0, y1: 2.2 },  // ward 115
    ];
    this.wallRun(X_WING, X_OLD - 0.35, H, holes, { mat: this.wallMat, dado: this.mat('hWains') });
    this.bx(X_OLD - X_WING, 0.06, 0.012, this.mat('hWallStripe', { color: 0x2a6ab0, roughness: 0.5 }), (X_WING + X_OLD) / 2, 1.32, BACK + 0.006);
    // wards: 111 half-drawn (someone asleep), 113 drawn shut (a shadow behind it, the lamp on)
    this.closedWard(23.3, 27.3, '111', { curtain: 'partial', light: 'cold', occupant: true });
    // 113: the old woman's ward (story ward B: the blood bag, the nurse) — far from Julian's 109
    this.wardB = this.buildWard(28.8, 32.8, '113', { patient: true, window: true });
    this.anchors.wardBDoor = new THREE.Vector3(this.wardB.doorSpot.x, 1.9, BACK + 0.15);
    // a strip of warm light under her door at night: the ward is lived in
    const s113 = this.mat('hxStrip-113', { color: 0x000000, emissive: 0xffc078, emissiveIntensity: 0 });
    this.bx(0.95, 0.015, 0.02, s113, this.wardB.doorSpot.x, 0.012, BACK + 0.05);
    this.expNight.push((night) => { s113.emissiveIntensity = night ? 2.4 : 0; });
    // 107 (by the station) stands empty now: dark, curtain open
    this.closedWard(9.0, 13.0, '107', { curtain: 'open', light: 'dark', occupant: false });
    this.hDoor(28.0, BACK + 0.02, { sign: 'БЕЛЬЁ · LINEN', w: 0.9, color: 0x7a8490, push: true });
    const d115 = this.hDoor(35.45, BACK + 0.02, { sign: 'ПАЛАТА 115', w: 0.9 });
    void d115;
    const s115 = this.mat('hxStrip-115', { color: 0x000000, emissive: 0xffc078, emissiveIntensity: 0 });
    this.bx(0.8, 0.015, 0.02, s115, 35.45, 0.012, BACK + 0.05);
    this.expNight.push((night) => { s115.emissiveIntensity = night ? 2.6 : 0; });
    // waiting nook under window B: chairs, a low table, magazines, a plant
    this.chairRow(33.4, 3, BACK + 0.42, 1);
    this.rb(0.72, 0.035, 0.44, 0.015, this.mat('hLaminate', { map: TX.laminate(), color: 0xffffff, roughness: 0.6 }), 34.2, 0.42, BACK + 1.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.rod([34.2 + sx * 0.3, 0.4, BACK + 1.0 + sz * 0.17], [34.2 + sx * 0.3, 0.0, BACK + 1.0 + sz * 0.17], 0.014, this.mat('steel'));
    this.rb(0.62, 0.012, 0.36, 0.005, this.mat('steel'), 34.2, 0.14, BACK + 1.0);
    for (let i = 0; i < 3; i++) this.bx(0.22, 0.012, 0.3, this.matV('hMagazine', { color: 0xffffff, roughness: 0.7 }), 34.05 + i * 0.09, 0.45 + i * 0.012, BACK + 1.0, { ry: i * 0.5, color: [0xc04040, 0x3a7ab0, 0xe0c060][i] });
    this.plant(33.0, BACK + 0.35, root, 1.3, 12);
    this.brightWindow(33.2, 34.8, 1.25, 2.55, PROFILES.B, 'ward109');
    // corridor ceiling: troffers, two of them dimmed
    for (let x = 24.5; x < X_OLD - 0.6; x += 3) this.troffer(x, -1.3, Math.abs(x - 30.5) < 0.1 ? 'B' : 'A');
    const l = new THREE.PointLight(0xe4eeff, 6, 11, 1.2); l.position.set(30, 2.75, -1.6); root.add(l);
    this.expNight.push((night) => { l.color.set(night ? 0x5070b0 : 0xe4eeff); l.intensity = night ? 2.4 : 6; });
    // night lamps low on the wall (like the ones in the old corridor): a dim amber pool each
    for (const nx of [27.9, 32.6]) {
      const nm = this.mat('hxNightLamp', { color: 0x201810, emissive: 0xffb060, emissiveIntensity: 0 });
      this.bx(0.22, 0.08, 0.04, nm, nx, 0.38, BACK + 0.05);
      const np = this.pool(0xffa050, nx, BACK + 1.0, 2.8, 2.1, 0);
      const nl = new THREE.PointLight(0xffa860, 0, 3.2, 1.6); nl.position.set(nx, 0.5, BACK + 0.5); this.root.add(nl);
      this.expNight.push((night) => { nm.emissiveIntensity = night ? 3 : 0; np.material.opacity = night ? 0.28 : 0; nl.intensity = night ? 1.4 : 0; });
    }
    // directional sign at the end of the wing
    const s = this.textSign('СТАРОЕ КРЫЛО · ОПЕРБЛОК →', { w: 1.9, h: 0.22, bg: '#0e3a5a', fg: '#f4f8fa' });
    s.position.set(33.4, 2.72, -2.3); root.add(s);
    const sb = s.clone(); sb.rotation.y = Math.PI; sb.position.z -= 0.01; root.add(sb);
    // a fire extinguisher, hand rub, a notice board
    this.extinguisher(36.25, BACK + 0.1);
    this.sanitizer(27.4, 1.25);
    this.framed(TX.poster('hands'), 0.32, 0.44, 20.75, 1.75);
    // foreground: a meds cart and an IV pole near the camera
    const fg = (x, z, name, build) => { const g = new THREE.Group(); g.name = name; build(g); g.position.set(x, 0, z); root.add(g); this.foregroundGroups.push(g); };
    fg(25.6, 3.0, 'fg-crashcart-w', (g) => this.inGroup(g, () => this.crashCart(0, 0, true)));
    fg(30.8, 3.3, 'fg-wheelchair-w', (g) => { const w = this.wheelchair(); w.rotation.y = -0.6; g.add(w); });
  },

  buildOldWing() {
    const root = this.root;
    const x0 = X_OLD + 0.35, x1 = X_END;
    const floorMat = this.mat('hxRetroFloor', { map: tiled(TXX.retroFloor(), (x1 - x0) / 1.28, 15 / 1.28), color: 0xffffff, roughness: 0.28, metalness: 0.05 });
    const ceilMat = this.mat('hxOldCeil', { map: tiled(TXX.oldPaint(), (x1 - x0) / 2, 15 / 2), color: 0xd8dcd2, roughness: 0.95 });
    this.slab(x0 - 0.35, x1, floorMat, H2, ceilMat);
    const wallMat = this.mat('hxOldWall', { map: TXX.oldPaint(), color: 0xffffff, roughness: 0.85 });
    // the wall map tiles every 2 m
    wallMat.map.repeat?.set?.(1, 1);
    const holes = [
      { x0: 38.1, x1: 39.1, y0: 0, y1: 2.35 },    // archive
      { x0: 40.2, x1: 41.9, y0: 0.95, y1: 3.25 }, // window A
      { x0: 43.0, x1: 44.8, y0: 0, y1: 2.6 },     // department B (closed)
      { x0: 45.8, x1: 47.4, y0: 0.95, y1: 3.25 }, // window C (blinds)
      { x0: 48.2, x1: 49.8, y0: 0, y1: 2.5 },     // OR doors
      { x0: 50.4, x1: 54.8, y0: 1.0, y1: 2.35 },  // observation window
      { x0: 55.5, x1: 56.8, y0: 0, y1: 2.7 },     // boarded side corridor
    ];
    this.wallRun(x0, x1, H2, holes, { mat: wallMat, dado: this.mat('hxOldDado', { map: TXX.oldDado(), color: 0xffffff, roughness: 0.3 }), old: true });
    // cornice and a picture rail
    this.bx(x1 - x0, 0.12, 0.12, this.mat('hxCornice', { color: 0xd8d8cc, roughness: 0.7 }), (x0 + x1) / 2, H2 - 0.06, BACK + 0.06);
    this.bx(x1 - x0, 0.03, 0.03, this.mat('hxOldRail'), (x0 + x1) / 2, 2.95, BACK + 0.03);
    // wooden doors: archive (solid), department B (double, frosted glass, closed for years)
    this.oldDoor(38.6, 1.0, 2.35, { sign: 'АРХИВ', frosted: false });
    this.oldDoor(43.9, 1.8, 2.6, { sign: 'ОТДЕЛЕНИЕ Б · ЗАКРЫТО', frosted: true, double: true, lit: 'day' });
    // windows: A warm morning sun, C behind blinds
    this.brightWindow(40.2, 41.9, 0.95, 3.25, PROFILES.A, 'ward107');
    this.brightWindow(45.8, 47.4, 0.95, 3.25, PROFILES.C, 'ward109', { blinds: true });
    this.radiator(41.05, 0.55, BACK + 0.1, 1.4);
    this.radiator(46.6, 0.55, BACK + 0.1, 1.4);
    // old furniture: wooden benches, a standing scale, a gurney under a sheet, a glass cabinet
    const wood = this.mat('hxBenchWood', { color: 0x6a4a2c, roughness: 0.5 });
    const iron = this.mat('hxIron', { color: 0x2a2a2a, metalness: 0.5, roughness: 0.5 });
    for (const bx of [51.2, 53.4]) this.oldBench(bx, BACK + 0.42, 1.7, wood, iron);
    this.clock(52.3, 2.75, BACK + 0.02, 'oldwing');
    this.beamScale(42.4, BACK + 0.36);
    this.oldGurney(45.3, BACK + 0.6);
    this.medCabinet(47.85, BACK + 0.2);
    // the boarded side corridor: a sawhorse and a sign, the dark going on behind
    this.sideCorridorDark(55.5, 56.8);
    // pendant lights (old glass globes)
    const globe = this.mat('hxGlobe', { color: 0xe8e4d8, emissive: 0xfff2d8, emissiveIntensity: 0.4, roughness: 0.3 });
    const globeN = this.mat('hxGlobeN', { color: 0xe8e4d8, emissive: 0xffe8c8, emissiveIntensity: 0.4, roughness: 0.3 });
    const globeOff = this.mat('hxGlobeOff', { color: 0xc8c4b8, emissive: 0x000000, roughness: 0.3 });
    // schoolhouse pendants: ceiling rose, stem, a cast fitter, an opal-glass shade
    const shadeGeo = new THREE.LatheGeometry([[0.062, 0], [0.07, -0.02], [0.11, -0.06], [0.15, -0.12], [0.168, -0.18], [0.17, -0.21], [0.16, -0.26], [0.13, -0.3], [0.08, -0.33], [0.03, -0.342], [0, -0.344]].reverse().map(([r, y]) => new THREE.Vector2(r, y)), 32);
    const brassP = this.mat('hxFitter', { color: 0x8a7a5a, metalness: 0.6, roughness: 0.4 });
    for (const [gx, on] of [[39.5, true], [43.5, true], [47.5, false], [51.5, true], [55.0, true]]) {
      const top = H2 - 0.83;
      this.lathe([[0, 0], [0.09, 0], [0.09, -0.012], [0.07, -0.03], [0.02, -0.04], [0, -0.04]], this.mat('hxCornice'), gx, H2, -1.3);
      this.rod([gx, H2 - 0.03, -1.3], [gx, top + 0.06, -1.3], 0.009, iron);
      this.lathe([[0, 0.12], [0.012, 0.12], [0.02, 0.095], [0.022, 0.07], [0.04, 0.05], [0.07, 0.02], [0.072, 0.0], [0.065, -0.01], [0, -0.01]], brassP, gx, top - 0.01, -1.3);
      const g = new THREE.Mesh(shadeGeo, gx === 51.5 ? globeN : on ? globe : globeOff);
      g.position.set(gx, top - 0.01, -1.3); root.add(g);
      this.pendants.push(g);
    }
    // light: warm from window A, cold from C/D, the globes
    // at night only the globe by the benches burns (warm, weak)
    const nightGlobe = new THREE.PointLight(0xffc888, 0, 6, 1.6); nightGlobe.position.set(51.5, H2 - 1.2, -1.3); root.add(nightGlobe);
    const warm = new THREE.PointLight(0xffd8a0, 5, 9, 1.3); warm.position.set(41.5, 2.4, -1.8); root.add(warm);
    const cold = new THREE.PointLight(0xdce6f4, 5, 10, 1.3); cold.position.set(52.5, 2.6, -1.6); root.add(cold);
    this.expNight.push((night) => {
      warm.color.set(night ? 0x4a5a98 : 0xffd8a0); warm.intensity = night ? 2.0 : 5;
      cold.color.set(night ? 0x3a4a80 : 0xdce6f4); cold.intensity = night ? 2.4 : 5;
      globe.emissiveIntensity = night ? 0.12 : 0.4;
      nightGlobe.intensity = night ? 2.2 : 0;
      globeN.emissiveIntensity = night ? 0.7 : 0.4;
    });
    // signs of the age: a 1970s visiting-hours board, "TИШИНА"
    const quiet = this.textSign('ТИШИНА', { w: 0.7, h: 0.2, bg: '#e8e2c8', fg: '#3a2a1a', font: 'bold 44px serif' });
    quiet.position.set(42.4, 2.35, BACK + 0.03); root.add(quiet);
    const hours = this.textSign('ЧАСЫ ПОСЕЩЕНИЙ 14–18 · 1974', { w: 1.5, h: 0.18, bg: '#2a3a2a', fg: '#e8e2c8' });
    hours.position.set(52.3, 2.35, BACK + 0.03); root.add(hours);
    // foreground: an old wheelchair and a column
    const fg = (x, z, name, build) => { const g = new THREE.Group(); g.name = name; build(g); g.position.set(x, 0, z); root.add(g); this.foregroundGroups.push(g); };
    fg(44.2, 3.1, 'fg-oldwheelchair', (g) => { const w = this.wheelchair(); w.rotation.y = 0.9; w.scale.setScalar(1.02); g.add(w); });
    fg(50.0, 2.9, 'fg-column', (g) => {
      // a plastered pier: dado, oak corner beads, a moulded cap under the ceiling
      const colTex = TXX.oldPaint().clone(); colTex.needsUpdate = true; colTex.repeat.set(0.5, 2);
      this.inGroup(g, () => {
        this.rb(0.5, H2, 0.5, 0.03, this.mat('hxColumn', { map: colTex, color: 0xe8ecdc, roughness: 0.85 }), 0, H2 / 2, 0);
        this.rb(0.54, 1.25, 0.54, 0.02, this.mat('hxOldDado'), 0, 0.625, 0);
        this.rb(0.58, 0.05, 0.58, 0.02, this.mat('hxOldRail'), 0, 1.27, 0);
        this.rb(0.6, 0.06, 0.6, 0.025, this.mat('hxCornice', { color: 0xd8d8cc, roughness: 0.7 }), 0, H2 - 0.17, 0);
        this.rb(0.66, 0.1, 0.66, 0.04, this.mat('hxCornice'), 0, H2 - 0.07, 0);
        this.rb(0.58, 0.12, 0.58, 0.02, this.mat('hSkirt'), 0, 0.06, 0);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.rod([sx * 0.25, 1.3, sz * 0.25], [sx * 0.25, H2 - 0.2, sz * 0.25], 0.018, this.mat('hxOldRail'));
      });
    });
  },

  /** 1950s physician's beam scale: enamel platform with a ribbed mat, tapered column, beam head with two poised bars, height rod. */
  beamScale(x, z) {
    const enamel = this.mat('hxEnamel', { color: 0xe6e2d4, roughness: 0.32 });
    const iron = this.mat('hxIron', { color: 0x2a2a2a, metalness: 0.5, roughness: 0.5 });
    const chrome = this.mat('hChrome', { color: 0xdfe4e8, metalness: 0.75, roughness: 0.22 });
    const rubber = this.mat('hxMat', { color: 0x1e2022, roughness: 0.9 });
    this.rb(0.46, 0.025, 0.42, 0.01, iron, x, 0.0125, z);
    this.rb(0.44, 0.07, 0.4, 0.03, enamel, x, 0.06, z);
    this.rb(0.36, 0.014, 0.3, 0.006, rubber, x, 0.098, z + 0.03);
    for (let i = 0; i < 6; i++) this.rb(0.34, 0.006, 0.012, 0.003, rubber, x, 0.107, z - 0.08 + i * 0.044);
    const cz = z - 0.16;
    this.lathe([[0.055, 0], [0.055, 0.02], [0.04, 0.05], [0.03, 0.07], [0, 0.07]], enamel, x, 0.09, cz);
    this.rod([x, 0.14, cz], [x, 1.3, cz], 0.026, enamel, { r2: 0.017, seg: 20 });
    this.lathe([[0, 0], [0.024, 0], [0.03, 0.02], [0.03, 0.03], [0, 0.03]], enamel, x, 1.28, cz);
    this.rb(0.11, 0.17, 0.1, 0.03, enamel, x, 1.38, cz);
    for (const [yy, p] of [[1.43, 0.32], [1.385, 0.12]]) {
      this.rb(0.52, 0.026, 0.014, 0.006, chrome, x + 0.29, yy, cz + 0.03);
      for (let t = 0; t < 10; t++) this.rb(0.003, 0.012, 0.003, 0.001, iron, x + 0.07 + t * 0.045, yy + 0.008, cz + 0.038);
      this.rb(0.04, 0.05, 0.04, 0.01, iron, x + p, yy, cz + 0.03);
    }
    this.rb(0.035, 0.13, 0.06, 0.012, enamel, x + 0.56, 1.405, cz + 0.03);
    this.rb(0.005, 0.05, 0.005, 0.002, this.mat('hFireRed'), x + 0.56, 1.44, cz + 0.062);
    this.rod([x - 0.05, 1.4, cz + 0.03], [x - 0.11, 1.4, cz + 0.03], 0.007, chrome);
    this.lathe([[0, -0.04], [0.02, -0.035], [0.024, -0.01], [0.015, 0.0], [0, 0.003]], iron, x - 0.12, 1.39, cz + 0.03);
    // height rod and its fold-out head piece
    this.rod([x, 1.46, cz - 0.04], [x, 1.96, cz - 0.04], 0.008, chrome);
    this.rb(0.03, 0.035, 0.035, 0.008, iron, x, 1.9, cz - 0.04);
    this.rod([x, 1.9, cz - 0.02], [x, 1.9, cz + 0.2], 0.006, chrome);
    this.rb(0.06, 0.012, 0.02, 0.004, iron, x, 1.9, cz + 0.2);
  },

  /** Old tubular-steel gurney with a thin mattress and a sheet thrown over it. */
  oldGurney(x, z) {
    const steel = this.mat('steel');
    const L = 1.9, W = 0.6, top = 0.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = x + sx * (L / 2 - 0.1), lz = z + sz * (W / 2 - 0.05);
      this.rod([lx, 0.12, lz], [lx, top, lz], 0.016, steel);
      this.lathe([[0, 0], [0.022, 0], [0.022, 0.03], [0.016, 0.04], [0, 0.04]], steel, lx, 0.1, lz);
      this.caster(lx, 0.11, lz, 0.045, 0);
    }
    for (const yy of [top, 0.26]) {
      for (const sz of [-1, 1]) this.rod([x - L / 2 + 0.06, yy, z + sz * (W / 2 - 0.05)], [x + L / 2 - 0.06, yy, z + sz * (W / 2 - 0.05)], 0.015, steel);
      for (const sx of [-1, 1]) this.rod([x + sx * (L / 2 - 0.1), yy, z - W / 2 + 0.05], [x + sx * (L / 2 - 0.1), yy, z + W / 2 - 0.05], 0.013, steel);
    }
    this.rb(L - 0.3, 0.015, W - 0.12, 0.006, this.mat('hxShelf', { color: 0xb8bec4, metalness: 0.4, roughness: 0.4 }), x, 0.27, z);
    // push bar at the head end
    this.tube([[x - L / 2 + 0.06, top, z - 0.25], [x - L / 2 - 0.06, top + 0.12, z - 0.22], [x - L / 2 - 0.08, top + 0.14, z], [x - L / 2 - 0.06, top + 0.12, z + 0.22], [x - L / 2 + 0.06, top, z + 0.25]], 0.014, steel, { seg: 48, tension: 0.3 });
    this.rb(L - 0.08, 0.07, W - 0.06, 0.03, this.mat('hxOrPad', { color: 0x2a4a4a, roughness: 0.6 }), x, top + 0.05, z);
    const sheet = this.mat('sheetDS', { map: TX.sheet(), color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide });
    this._add(this.drapeGeo(L - 0.06, W - 0.04, 0.14, 0.2, 0.04, 11), sheet, x, top + 0.088, z);
    // a folded grey blanket on the shelf
    const fold = this.pillowGeo(0.5, 0.36, 0.1, 0.035, 0.3); fold.rotateX(-Math.PI / 2);
    this._add(fold, this.mat('hxBlanketGrey', { color: 0x7a8088, roughness: 0.95 }), x + 0.4, 0.33, z);
  },

  /** Enamelled medicine cabinet: turned feet, drawers, a glazed upper case with shelves of bottles, cornice. */
  medCabinet(x, z) {
    const cream = this.mat('hxCabinetCream', { color: 0xe4e0d0, roughness: 0.5 });
    const inside = this.mat('hxCabInside', { color: 0xb4bcb6, roughness: 0.6 });
    const brass = this.mat('hBrass');
    const W = 0.72, D = 0.36, y0 = 0.12, Hc = 1.72;
    const zf = z + D / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.lathe([[0.02, 0], [0.026, 0.01], [0.02, 0.06], [0.026, 0.1], [0.03, 0.12], [0, 0.12]], cream, x + sx * (W / 2 - 0.05), 0, z + sz * (D / 2 - 0.05));
    this.rb(W, 0.04, D, 0.012, cream, x, y0 + 0.02, z);
    for (const sx of [-1, 1]) this.rb(0.03, Hc, D, 0.012, cream, x + sx * (W / 2 - 0.015), y0 + Hc / 2, z);
    this.rb(W - 0.04, Hc, 0.02, 0.006, inside, x, y0 + Hc / 2, z - D / 2 + 0.012);
    this.rb(W + 0.03, 0.03, D + 0.03, 0.01, cream, x, y0 + Hc, z + 0.005);
    this.rb(W + 0.07, 0.06, D + 0.06, 0.022, cream, x, y0 + Hc + 0.045, z + 0.01);
    // two drawers with brass cup pulls, a counter ledge
    for (let i = 0; i < 2; i++) {
      const yy = y0 + 0.13 + i * 0.19;
      this.rb(W - 0.07, 0.17, 0.022, 0.008, cream, x, yy, zf - 0.004);
      this.rb(0.1, 0.03, 0.014, 0.008, brass, x, yy + 0.02, zf + 0.012);
      this.rb(0.03, 0.03, 0.006, 0.004, this.mat('hBlack'), x, yy - 0.04, zf + 0.009);
    }
    const ledge = y0 + 0.44;
    this.rb(W + 0.02, 0.03, D + 0.02, 0.01, cream, x, ledge, z + 0.01);
    // glazed doors: rounded frames, glass, little brass knobs
    const top = y0 + Hc - 0.02, dh = top - ledge - 0.02, dy = (top + ledge) / 2, dw = (W - 0.06) / 2;
    for (const s of [-1, 1]) {
      const dx = x + s * (dw / 2 + 0.002);
      this.rb(0.04, dh, 0.026, 0.01, cream, dx - s * (dw / 2 - 0.02), dy, zf);
      this.rb(0.04, dh, 0.026, 0.01, cream, dx + s * (dw / 2 - 0.02), dy, zf);
      for (const yy of [dy - dh / 2 + 0.025, dy + dh / 2 - 0.025, dy - dh * 0.12]) this.rb(dw, 0.05, 0.026, 0.01, cream, dx, yy, zf);
      this.bx(dw - 0.07, dh - 0.08, 0.004, this.mat('hGlass'), dx, dy, zf);
      this.lathe([[0, 0], [0.012, 0.0], [0.016, 0.012], [0.01, 0.02], [0, 0.022]], brass, x + s * 0.03, dy - dh * 0.12, zf + 0.012, { rx: Math.PI / 2 });
    }
    // shelves and bottles behind the glass
    const vial = this.matV('hxVial', { color: 0xffffff, roughness: 0.25 });
    const r = rng(77);
    for (let k = 0; k < 3; k++) {
      const sy = ledge + 0.04 + k * 0.36;
      this.rb(W - 0.07, 0.014, D - 0.08, 0.005, this.mat('hxShelfGlass', { color: 0xc8d4d0, roughness: 0.2, metalness: 0.2 }), x, sy, z - 0.01);
      let bx = x - W / 2 + 0.07;
      while (bx < x + W / 2 - 0.08) {
        const br = 0.022 + r() * 0.018, bh = 0.09 + r() * 0.11;
        this.lathe([[0, 0], [br, 0], [br, bh * 0.66], [br * 0.6, bh * 0.8], [br * 0.38, bh * 0.84], [br * 0.38, bh], [br * 0.42, bh], [br * 0.42, bh * 1.06], [0, bh * 1.06]], vial, bx + br, sy + 0.007, z - 0.03 + (r() - 0.5) * 0.08, { seg: 16, color: [0x8a5a20, 0xc8d8c0, 0x5a3a20, 0x3a5a8a, 0xe8e8e0][(r() * 5) | 0] });
        bx += br * 2 + 0.015 + r() * 0.03;
      }
    }
  },

  /** Slatted wooden waiting bench on cast-iron ends (facing +z). */
  oldBench(x, z, len, wood, iron) {
    for (let i = 0; i < 3; i++) this.rb(len, 0.035, 0.12, 0.012, wood, x, 0.46, z - 0.13 + i * 0.135);
    for (const [yy, dz] of [[0.66, -0.215], [0.84, -0.238]]) this.rb(len, 0.1, 0.03, 0.012, wood, x, yy, z + dz, { rx: -0.12 });
    for (const ex of [x - len / 2 + 0.12, x + len / 2 - 0.12]) {
      this.tube([[ex, 0.0, z + 0.2], [ex, 0.2, z + 0.19], [ex, 0.44, z + 0.17]], 0.018, iron, { seg: 24 });
      this.tube([[ex, 0.0, z - 0.18], [ex, 0.25, z - 0.19], [ex, 0.44, z - 0.2], [ex, 0.92, z - 0.26]], 0.018, iron, { seg: 32 });
      this.rod([ex, 0.43, z + 0.18], [ex, 0.43, z - 0.2], 0.015, iron);
      this.tube([[ex, 0.43, z + 0.17], [ex, 0.62, z + 0.12], [ex, 0.64, z - 0.05], [ex, 0.62, z - 0.22]], 0.014, iron, { seg: 32 });
      for (const fz of [z + 0.2, z - 0.18]) this.lathe([[0.03, 0], [0.03, 0.015], [0.018, 0.03], [0, 0.03]], iron, ex, 0, fz);
    }
  },

  /** Old wooden door (single or double), optionally with frosted glass lit from behind. */
  oldDoor(x, w, h, { sign, frosted = false, double = false, lit = null } = {}) {
    const root = this.root;
    const wood = this.mat('hxDoorWood', { color: 0x5a3a20, roughness: 0.5 });
    const frame = this.mat('hxWoodFrame', { color: 0x4a301a, roughness: 0.5 });
    // moulded architrave: posts and head with a cornice cap, plinth blocks at the floor
    this.rb(w + 0.28, 0.16, 0.16, 0.03, frame, x, h + 0.08, BACK + 0.02);
    this.rb(w + 0.36, 0.05, 0.2, 0.02, frame, x, h + 0.185, BACK + 0.03);
    for (const s of [-1, 1]) {
      this.rb(0.12, h, 0.16, 0.025, frame, x + s * (w / 2 + 0.06), h / 2, BACK + 0.02);
      this.rb(0.04, h - 0.2, 0.17, 0.012, wood, x + s * (w / 2 + 0.06), h / 2 + 0.1, BACK + 0.025);
      this.rb(0.14, 0.2, 0.18, 0.015, frame, x + s * (w / 2 + 0.06), 0.1, BACK + 0.03);
    }
    const leaves = double ? 2 : 1, lw = w / leaves;
    const glassM = frosted ? this.mat(`hxFrosted-${lit}`, { map: TXX.frosted(), color: 0xffffff, emissive: 0xfff4dc, emissiveMap: TXX.frosted(), emissiveIntensity: lit === 'day' ? 0.5 : 0, roughness: 0.3 }) : null;
    const brass = this.mat('hBrass');
    for (let k = 0; k < leaves; k++) {
      const lx = x - w / 2 + lw * (k + 0.5);
      const hs = k ? -1 : 1; // the handle side
      this.rb(lw - 0.02, h, 0.05, 0.012, wood, lx, h / 2, BACK);
      // fielded panels: a dark bolection frame round a raised field
      const panel = (py, ph) => {
        this.rb(lw - 0.2, ph, 0.03, 0.012, frame, lx, py, BACK + 0.022);
        this.rb(lw - 0.3, ph - 0.1, 0.03, 0.03, wood, lx, py, BACK + 0.032, { seg: 3 });
      };
      panel(0.36, 0.4);
      panel(0.98, 0.5);
      if (glassM) {
        this.rb(lw - 0.2, h * 0.36 + 0.06, 0.03, 0.012, frame, lx, h * 0.72, BACK + 0.022);
        this.bx(lw - 0.26, h * 0.36, 0.01, glassM, lx, h * 0.72, BACK + 0.036);
        for (let q = 1; q < 3; q++) this.rb(0.02, h * 0.36, 0.014, 0.006, frame, lx - (lw - 0.26) / 2 + (lw - 0.26) * q / 3, h * 0.72, BACK + 0.042);
      } else panel(h * 0.72, 0.62);
      // brass: lever on a round rose, a keyhole escutcheon, a kick plate
      const hx = lx + hs * (lw / 2 - 0.1);
      this.lathe([[0, 0], [0.03, 0], [0.032, 0.008], [0.02, 0.016], [0, 0.018]], brass, hx, 1.02, BACK + 0.026, { rx: Math.PI / 2 });
      this.rod([hx, 1.02, BACK + 0.04], [hx, 1.02, BACK + 0.065], 0.008, brass);
      this.tube([[hx, 1.02, BACK + 0.065], [hx - hs * 0.06, 1.02, BACK + 0.07], [hx - hs * 0.11, 1.012, BACK + 0.068]], 0.008, brass, { seg: 16 });
      this.rb(0.025, 0.07, 0.006, 0.006, brass, hx, 0.92, BACK + 0.028);
      this.rb(lw - 0.08, 0.18, 0.006, 0.004, this.mat('hxKick', { color: 0x8a7444, metalness: 0.6, roughness: 0.45 }), lx, 0.1, BACK + 0.028);
    }
    if (glassM) this.expNight.push((night) => { glassM.emissiveIntensity = night ? 0.0 : (lit === 'day' ? 0.5 : 0); });
    if (sign) {
      const s = this.textSign(sign, { w: Math.max(0.6, sign.length * 0.065), h: 0.18, bg: '#e8e2c8', fg: '#2a1a10', font: 'bold 40px serif' });
      s.position.set(x, h + 0.32, BACK + 0.03); root.add(s);
    }
  },

  /** The boarded side corridor: dark depth with one far light, a barrier across the opening. */
  sideCorridorDark(x0, x1) {
    const root = this.root;
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = 7;
    const m = this.mat('hxDarkWall', { map: TXX.oldPaint(), color: 0x6a706a, roughness: 0.9 });
    this.bx(0.1, 2.7, depth, m, x0, 1.35, BACK - depth / 2);
    this.bx(0.1, 2.7, depth, m, x1, 1.35, BACK - depth / 2);
    this.bx(w, 0.02, depth, this.mat('hxRetroFloor'), cx, 0.004, BACK - depth / 2);
    this.bx(w, 0.05, depth, m, cx, 2.7, BACK - depth / 2);
    this.bx(w, 2.7, 0.1, this.mat('hxFarWall', { color: 0x1a1c1a, roughness: 0.9 }), cx, 1.35, BACK - depth);
    // one bulb far down, a pool under it
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), this.mat('hxFarBulb', { color: 0, emissive: 0xffe0b0, emissiveIntensity: 2.5 }));
    bulb.position.set(cx, 2.5, BACK - depth + 0.8); root.add(bulb);
    const g = glow(0xffd8a0, 0.6, 0.35); g.position.copy(bulb.position); root.add(g);
    this.pool(0xffc890, cx, BACK - depth + 1.0, 1.0, 1.4, 0.18);
    // sawhorse barrier + sign
    const stripe = this.mat('hxBarrier', { color: 0xe8e0d0, roughness: 0.6 });
    const red = this.mat('hFireRed');
    // a wooden sawhorse barrier: striped board on two A-frame trestles, and a plank leaning behind it
    this.rb(w + 0.1, 0.16, 0.035, 0.012, stripe, cx, 1.0, BACK + 0.15);
    for (let i = 0; i < 4; i++) this.rb(0.14, 0.162, 0.038, 0.01, red, x0 + 0.2 + i * 0.32, 1.0, BACK + 0.15, { rz: 0.0 });
    const raw = this.mat('hxRawWood', { color: 0x9a7a52, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const tx = cx + s * (w / 2 - 0.12);
      this.rb(0.05, 0.06, 0.32, 0.012, raw, tx, 0.93, BACK + 0.15);
      for (const sz of [-1, 1]) this.rb(0.045, 0.98, 0.035, 0.01, raw, tx, 0.47, BACK + 0.15 + sz * 0.11, { rx: sz * 0.2 });
      this.rb(0.035, 0.03, 0.34, 0.01, raw, tx, 0.35, BACK + 0.15);
    }
    this.rb(0.22, 2.2, 0.03, 0.01, raw, x0 + 0.35, 1.1, BACK - 0.5, { rz: 0.12, rx: -0.05 });
    const sign = this.textSign('РЕМОНТ · ПРОХОДА НЕТ', { w: 1.1, h: 0.2, bg: '#e8c020', fg: '#141414' });
    sign.position.set(cx, 1.35, BACK + 0.16); root.add(sign);
  },

  /** The old operating theatre behind the back wall: seen through the porthole doors and the observation window. */
  buildOperating() {
    const root = this.root;
    const x0 = 48.0, x1 = 55.2, depth = 5.2, zb = BACK - depth, cx = (x0 + x1) / 2;
    const tiles = this.mat('hxOrTiles', { map: tiled(TXX.orTiles(), (x1 - x0) / 0.5, 6), color: 0xa8b4ae, roughness: 0.4 });
    const band = this.mat('hxOrBand', { color: 0x4a7a6a, roughness: 0.4 });
    this.bx(x1 - x0, H2, 0.1, tiles, cx, H2 / 2, zb);
    this.bx(0.1, H2, depth, tiles, x0, H2 / 2, BACK - depth / 2);
    this.bx(0.1, H2, depth, tiles, x1, H2 / 2, BACK - depth / 2);
    this.bx(x1 - x0, 0.12, 0.02, band, cx, 1.5, zb + 0.06);
    this.bx(x1 - x0, 0.03, depth, this.mat('hxOrFloor', { map: tiled(TXX.retroFloor(), 4, 3), color: 0xb8c4bc, roughness: 0.25 }), cx, 0.005, BACK - depth / 2);
    this.bx(x1 - x0, 0.04, depth, this.mat('hxOrCeil', { color: 0xc8ccc4, roughness: 0.9 }), cx, H2 - 0.02, BACK - depth / 2);
    // the table, the big lamp over it, trolleys, cabinets, a covered shape on a gurney
    const steel = this.mat('steel');
    const tx = 52.2, tz = BACK - 2.7;
    // the table: a pedestal on a heavy base, a jointed padded top with a head section
    this.rb(0.8, 0.08, 0.5, 0.03, steel, tx, 0.04, tz);
    this.lathe([[0.16, 0.08], [0.14, 0.12], [0.11, 0.14], [0.1, 0.6], [0.14, 0.64], [0.14, 0.68], [0, 0.68]], steel, tx, 0, tz, { seg: 28 });
    this.rb(1.6, 0.06, 0.56, 0.02, steel, tx + 0.1, 0.7, tz);
    this.rb(1.56, 0.09, 0.56, 0.04, this.mat('hxOrPad', { color: 0x2a4a4a, roughness: 0.6 }), tx + 0.1, 0.775, tz, { seg: 3 });
    this.rb(0.4, 0.08, 0.5, 0.035, this.mat('hxOrPad'), tx - 0.9, 0.79, tz, { rz: -0.12 });
    for (const sz of [-1, 1]) this.rod([tx - 0.6, 0.73, tz + sz * 0.3], [tx + 0.8, 0.73, tz + sz * 0.3], 0.01, steel);
    // ceiling-mounted surgical lamp: column, two-joint arm, a domed head with a lens and handle
    this.lathe([[0, -0.05], [0.12, -0.05], [0.12, -0.02], [0.05, 0], [0, 0]], steel, tx, H2 - 0.02, tz);
    this.rod([tx, H2 - 0.04, tz], [tx, H2 - 0.45, tz], 0.035, steel);
    this.rod([tx, H2 - 0.45, tz], [tx + 0.35, H2 - 0.75, tz + 0.1], 0.028, steel);
    this.rod([tx + 0.35, H2 - 0.75, tz + 0.1], [tx, 2.66, tz], 0.025, steel);
    const lampM = this.mat('hxOrLamp', { color: 0x202020, emissive: 0xfff8e8, emissiveIntensity: 1.6 });
    const body = this.mat('hxOrLampBody', { color: 0xd8dcd8, metalness: 0.5, roughness: 0.3 });
    this.lathe([[0.55, 2.47], [0.57, 2.5], [0.55, 2.56], [0.42, 2.63], [0.2, 2.66], [0.05, 2.67], [0, 2.67]], body, tx, 0, tz, { seg: 40 });
    this.lathe([[0, 2.43], [0.46, 2.45], [0.5, 2.47]], lampM, tx, 0, tz, { seg: 40 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; this.lathe([[0, 2.44], [0.07, 2.445], [0.08, 2.455]], this.mat('hxOrBulbRing', { color: 0x9aa2a6, metalness: 0.6, roughness: 0.3 }), tx + Math.cos(a) * 0.28, 0, tz + Math.sin(a) * 0.28, { seg: 20 }); }
    this.rod([tx, 2.43, tz], [tx, 2.3, tz], 0.02, body);
    this.lathe([[0, 2.24], [0.03, 2.25], [0.035, 2.3], [0, 2.31]], body, tx, 0, tz);
    const lampGlow = glow(0xfff4e0, 1.6, 0.45); lampGlow.position.set(tx, 2.3, tz); root.add(lampGlow);
    const pool = this.pool(0xfff4e0, tx, tz, 2.6, 1.6, 0.3);
    // instrument trolleys: tubular frames, two trays with raised rims, instruments, castors
    for (const [ix, iz] of [[50.6, BACK - 1.6], [53.8, BACK - 3.8]]) {
      for (const yy of [0.9, 0.45]) {
        this.rb(0.7, 0.02, 0.45, 0.008, steel, ix, yy, iz);
        for (const sz of [-1, 1]) this.rb(0.7, 0.03, 0.012, 0.005, steel, ix, yy + 0.02, iz + sz * 0.22);
        for (const sx of [-1, 1]) this.rb(0.012, 0.03, 0.45, 0.005, steel, ix + sx * 0.35, yy + 0.02, iz);
      }
      for (const dx of [-0.32, 0.32]) for (const dz of [-0.2, 0.2]) { this.rod([ix + dx, 0.1, iz + dz], [ix + dx, 0.92, iz + dz], 0.011, steel); this.caster(ix + dx, 0.1, iz + dz, 0.03, 0); }
      for (let i = 0; i < 5; i++) this.rb(0.15, 0.008, 0.014, 0.004, this.mat('hChrome', { color: 0xdfe4e8, metalness: 0.75, roughness: 0.22 }), ix - 0.24 + i * 0.12, 0.918, iz - 0.05 + (i % 2) * 0.06, { ry: 0.15 * (i - 2) });
      this.lathe([[0, 0], [0.07, 0], [0.11, 0.05], [0.115, 0.055]], steel, ix + 0.18, 0.91, iz + 0.08, { seg: 28 });
    }
    // glazed instrument cabinet against the back wall
    const cab = this.mat('hxOrCabinet', { color: 0xdfe4e0, roughness: 0.5 });
    this.rb(1.6, 0.06, 0.4, 0.02, cab, 49.4, 0.03, zb + 0.25);
    for (const sx of [-1, 1]) this.rb(0.04, 2.0, 0.4, 0.015, cab, 49.4 + sx * 0.78, 1.0, zb + 0.25);
    this.rb(1.64, 0.06, 0.44, 0.02, cab, 49.4, 2.02, zb + 0.26);
    this.rb(1.52, 1.94, 0.02, 0.006, this.mat('hxCabInside', { color: 0xb4bcb6, roughness: 0.6 }), 49.4, 1.0, zb + 0.07);
    for (const sy of [0.6, 1.05, 1.5]) this.rb(1.52, 0.015, 0.34, 0.005, this.mat('hxShelfGlass', { color: 0xc8d4d0, roughness: 0.2, metalness: 0.2 }), 49.4, sy, zb + 0.25);
    for (const dx of [-0.39, 0.39]) {
      for (const sx of [-1, 1]) this.rb(0.035, 1.6, 0.025, 0.01, cab, 49.4 + dx + sx * 0.37, 1.15, zb + 0.45);
      for (const yy of [0.37, 1.93]) this.rb(0.76, 0.04, 0.025, 0.01, cab, 49.4 + dx, yy, zb + 0.45);
      this.bx(0.7, 1.5, 0.006, this.mat('hGlass'), 49.4 + dx, 1.15, zb + 0.45);
    }
    this.rb(1.52, 0.3, 0.02, 0.01, cab, 49.4, 0.2, zb + 0.45);
    // the covered shape on the gurney: a body-like form under a draped sheet
    this.oldGurney(54.0, BACK - 1.4);
    const form = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.25, 8, 20), this.mat('sheet'));
    form.rotation.z = Math.PI / 2; form.scale.set(1, 1, 0.7); form.position.set(54.05, 0.83, BACK - 1.4); root.add(form);
    // observation window: glass + blinds half down; porthole double doors
    this.box(54.8 - 50.4, 2.35 - 1.0, 0.03, this.mat('hGlass'), 52.6, 1.675, BACK);
    this.pl(54.8 - 50.4, 0.6, this.texMat('hxBlindsOr', tiled(TX.blinds(), 8, 4), { transparent: true }), 52.6, 2.05, BACK + 0.03);
    const alu = this.mat('wardFrame', { color: 0xb8c0c4, metalness: 0.4, roughness: 0.35 });
    this.bx(4.5, 0.06, 0.12, alu, 52.6, 2.38, BACK); this.bx(4.5, 0.1, 0.2, alu, 52.6, 0.97, BACK + 0.05);
    const doorM = this.mat('hxOrDoor', { color: 0x7a9a8e, roughness: 0.5 });
    for (const s of [-1, 1]) {
      const lx = 49.0 + s * 0.4;
      this.bx(0.78, 2.45, 0.06, doorM, lx, 1.225, BACK);
      this.bx(0.78, 0.3, 0.065, steel, lx, 0.15, BACK + 0.005);
      const portM = this.mat('hxPort', { color: 0x9ab8c0, emissive: 0xe8f4f0, emissiveIntensity: 0.35, roughness: 0.1 });
      const port = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), portM);
      port.position.set(lx, 1.6, BACK + 0.035); root.add(port);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 16), steel); ring.position.set(lx, 1.6, BACK + 0.04); root.add(ring);
    }
    const sign = this.textSign('ОПЕРАЦИОННАЯ · ВХОД ВОСПРЕЩЁН', { w: 1.6, h: 0.18, bg: '#1a2a24', fg: '#e8f0e8' });
    sign.position.set(49.0, 2.8, BACK + 0.03); root.add(sign);
    const redM = this.mat('hxInUse', { color: 0x200000, emissive: 0xff2020, emissiveIntensity: 0.3 });
    this.bx(0.4, 0.14, 0.05, redM, 49.0, 3.1, BACK + 0.04);
    // its own cold light by day; at night only the red lamp over the door
    const l = new THREE.PointLight(0xe8f0ff, 2.2, 7, 1.4); l.position.set(tx, 2.8, tz + 0.6); root.add(l);
    this.expNight.push((night) => {
      l.intensity = night ? 0.25 : 2.2;
      lampM.emissiveIntensity = night ? 0.05 : 1.6;
      lampGlow.material.opacity = night ? 0 : 0.45;
      pool.material.opacity = night ? 0.03 : 0.3;
      redM.emissiveIntensity = night ? 2.2 : 0.3;
      this.mats.cache.get('hxPort').emissiveIntensity = night ? 0.04 : 0.35;
    });
  },

  /** End wall of the old wing with the tall window D (the near-blinding morning one). */
  buildEndWall() {
    const root = this.root;
    const zA = -3.6, zB = -0.6, y0 = 0.8, y1 = 3.5;
    const shape = new THREE.Shape([new THREE.Vector2(BACK, 0), new THREE.Vector2(5, 0), new THREE.Vector2(5, H2), new THREE.Vector2(BACK, H2)]);
    shape.holes.push(new THREE.Path([new THREE.Vector2(zA, y0), new THREE.Vector2(zB, y0), new THREE.Vector2(zB, y1), new THREE.Vector2(zA, y1)]));
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.mat('hxOldWall'));
    wall.rotation.y = Math.PI / 2; wall.position.set(X_END, 0, 0);
    // local x → world -z after the rotation: flip so the hole lands at z zA..zB
    wall.scale.x = -1; root.add(wall);
    const dado = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.25), this.mat('hxOldDado'));
    dado.rotation.y = -Math.PI / 2; dado.position.set(X_END - 0.02, 0.625, 0.5); root.add(dado);
    // the window itself: outside view + glare, wooden frame
    const view = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'ward109'), color: 0xe4dccc });
    view.userData.view = 'ward109'; this.outsideMats.push(view);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(zB - zA + 1, y1 - y0 + 1), view);
    pane.rotation.y = -Math.PI / 2; pane.position.set(X_END + 0.35, (y0 + y1) / 2, (zA + zB) / 2); root.add(pane);
    this.deepenView(pane, new THREE.Vector3(1, 0, 0), 57);
    const glareMat = new THREE.MeshBasicMaterial({ color: PROFILES.D.color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(zB - zA, y1 - y0), glareMat);
    glare.rotation.y = -Math.PI / 2; glare.position.set(X_END + 0.04, (y0 + y1) / 2, (zA + zB) / 2); glare.renderOrder = 2; root.add(glare);
    const frame = this.mat('hxWoodFrame', { color: 0x4a301a, roughness: 0.5 });
    for (const z of [zA, (zA + zB) / 2, zB]) this.bx(0.14, y1 - y0, 0.06, frame, X_END - 0.02, (y0 + y1) / 2, z);
    for (const y of [y0, y0 + (y1 - y0) * 0.62, y1]) this.bx(0.14, 0.06, zB - zA + 0.06, frame, X_END - 0.02, y, (zA + zB) / 2);
    // a long shaft of morning light down the corridor floor
    const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color: PROFILES.D.color, transparent: true, opacity: PROFILES.D.shaft, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.BufferGeometry();
    const v = [X_END, y1, zA, X_END, y1, zB, X_END - 4.0, 0.02, zA + 0.4, X_END - 4.0, 0.02, zB + 0.8];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    const shaft = new THREE.Mesh(geo, shaftMat); shaft.renderOrder = 3; root.add(shaft);
    const patch = this.pool(PROFILES.D.color, X_END - 2.6, (zA + zB) / 2, 3.4, 2.6, PROFILES.D.patch);
    this.windowLights.push({ ...PROFILES.D, position: new THREE.Vector3(X_END, 2.4, (zA + zB) / 2), dir: new THREE.Vector3(-1, 0, 0), enabled: () => !this.night });
    this.expNight.push((night) => {
      glareMat.opacity = night ? 0.16 : 0.45; glareMat.color.set(night ? 0x4a68b0 : PROFILES.D.color);
      shaftMat.opacity = night ? 0.12 : PROFILES.D.shaft; shaftMat.color.set(night ? 0x5a78c0 : PROFILES.D.color);
      patch.material.opacity = night ? 0.14 : PROFILES.D.patch; patch.material.color.set(night ? 0x5a78c0 : PROFILES.D.color);
    });
  },

  /** How much footsteps echo at x (0 in the new building, 1 in the old wing). */
  echoAt(x) { return Math.min(1, Math.max(0, (x - X_OLD + 0.5) / 2)); },

  /**
   * Depth behind a window: the painted view goes ~2.4 m further out (and grows so it still fills
   * the opening) and a layer of bare branches hangs just outside the glass — the camera slides
   * along the corridor, the layers part, the outside stops looking like a picture on the wall.
   */
  deepenView(pane, dir = new THREE.Vector3(0, 0, -1), seed = 1) {
    const D = 2.4;
    const base = pane.position.clone();
    pane.position.addScaledVector(dir, D);
    pane.scale.multiplyScalar(1 + D * 0.5);
    const g = pane.geometry.parameters;
    const twig = new THREE.MeshBasicMaterial({ map: TXX.twigs(seed), transparent: true, alphaTest: 0.4, color: 0xd8d4cc, depthWrite: false });
    const t = new THREE.Mesh(new THREE.PlaneGeometry(g.width * 1.05, g.height * 1.05), twig);
    t.position.copy(base).addScaledVector(dir, 0.55);
    t.rotation.copy(pane.rotation);
    t.renderOrder = 1;
    this.root.add(t);
    this.expNight.push((night) => twig.color.set(night ? 0x2a3040 : 0xd8d4cc));
    return t;
  },

  /** Floor shading for a corridor run: contact shadow at the wall, a worn walking line, dusk toward the camera. */
  floorShade(x0, x1) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const grad = (key, stops) => canvasTexture(`hospx-${key}`, 4, 64, (c, cw, ch) => {
      const g = c.createLinearGradient(0, 0, 0, ch);
      for (const [o, a] of stops) g.addColorStop(o, `rgba(0,0,0,${a})`);
      c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    });
    const plane = (tex, z0, z1, opacity, y) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, z1 - z0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(cx, y, (z0 + z1) / 2); m.renderOrder = 1;
      this.root.add(m);
      return m;
    };
    plane(grad('wallshade', [[0, 0.0], [0.75, 0.35], [1, 0.6]]), BACK, BACK + 0.7, 1, 0.004);   // contact shadow under the dado
    plane(grad('near', [[0, 0.0], [0.5, 0.18], [1, 0.55]]), 2.0, 5.0, 1, 0.0045);             // the floor darkens toward the lens
    plane(grad('path', [[0, 0], [0.5, 0.12], [1, 0]]), -1.7, -0.5, 1, 0.005);                  // the walking line, worn darker
  },

  /** Per-frame life of the expansion: curtains in the draught, shadows behind curtains, a tired globe. */
  updateExpansion(dt) {
    // at night a faint cool key follows Julian, so his silhouette always reads in the dark wings
    if (!this.nightKey) { this.nightKey = new THREE.PointLight(0x8aa0d0, 0, 3.4, 1.5); this.root.add(this.nightKey); }
    const J = this.followTarget?.();
    const want = this.night && J && J.position.x > X_WING - 2 ? 1.6 : 0;
    this.nightKey.intensity += (want - this.nightKey.intensity) * Math.min(1, dt * 2);
    if (J) this.nightKey.position.set(J.position.x + 0.6, 1.7, J.position.z + 1.4);
    this.curtainTime.value += dt;
    const t = this.curtainTime.value;
    for (const s of this.shadowFigures) {
      s.t += dt;
      // mostly still; every ~9 s the person shifts, leans, settles
      const ph = s.t % 9;
      const lean = ph > 7 ? Math.sin((ph - 7) / 2 * Math.PI) : 0;
      s.mesh.position.x = s.base.x + lean * 0.12;
      s.mesh.position.y = s.base.y + Math.sin(t * 0.8) * 0.006;
      s.mesh.material.opacity = this.night ? 0.42 : 0.28;
    }
    if (this.pendants[1]) {
      const on = Math.sin(t * 9.0) + Math.sin(t * 3.7 + 2) > -1.2 || (t % 6.1) > 0.12;
      this.pendants[1].material = on ? this.mats.cache.get('hxGlobe') : this.mats.cache.get('hxGlobeOff');
    }
  },
};

/**
 * Window light profiles (WindowLightZone + WindowLensFlareSource):
 * A warm golden, strong star, greenish ghosts; B cold white, soft, blue/violet;
 * C through blinds, long streaks, weak; D the strong morning one, near blinding.
 */
export const PROFILES = {
  A: { id: 'A', color: 0xffd8a0, triggerDistance: 3.4, fadeDistance: 2.2, intensity: 1.0, exposure: 0.13, bloom: 0.18, shaft: 0.18, patch: 0.28,
    flareSize: 1.0, starburstIntensity: 1.0, ghostIntensity: 0.8, ghostCount: 6, ghostSpacing: 0.42, ringIntensity: 0.5, colorTint: [1.0, 0.86, 0.6], ghostTints: [[0.5, 1.0, 0.6], [0.8, 1.0, 0.5], [1.0, 0.7, 0.3]], maxScreenOpacity: 0.85, old: true },
  B: { id: 'B', color: 0xdfe8ff, triggerDistance: 2.8, fadeDistance: 1.8, intensity: 0.7, exposure: 0.12, bloom: 0.2, shaft: 0.14, patch: 0.18,
    flareSize: 0.75, starburstIntensity: 0.45, ghostIntensity: 0.6, ghostCount: 5, ghostSpacing: 0.5, ringIntensity: 0.6, colorTint: [0.85, 0.92, 1.0], ghostTints: [[0.5, 0.6, 1.0], [0.8, 0.5, 1.0], [0.6, 0.9, 1.0]], maxScreenOpacity: 0.6 },
  C: { id: 'C', color: 0xe8ecf4, triggerDistance: 2.6, fadeDistance: 1.6, intensity: 0.55, exposure: 0.08, bloom: 0.25, shaft: 0.12, patch: 0.14,
    flareSize: 0.7, starburstIntensity: 0.3, ghostIntensity: 0.35, ghostCount: 3, ghostSpacing: 0.6, ringIntensity: 0.2, colorTint: [0.95, 0.97, 1.0], ghostTints: [[0.9, 0.95, 1.0]], streaks: true, maxScreenOpacity: 0.5, old: true },
  D: { id: 'D', color: 0xfff0d4, triggerDistance: 4.5, fadeDistance: 4.0, intensity: 1.2, exposure: 0.24, bloom: 0.4, shaft: 0.2, patch: 0.3,
    flareSize: 1.35, starburstIntensity: 1.4, ghostIntensity: 1.0, ghostCount: 8, ghostSpacing: 0.36, ringIntensity: 0.8, colorTint: [1.0, 0.94, 0.8], ghostTints: [[0.5, 1.0, 0.6], [0.4, 0.7, 1.0], [1.0, 0.4, 0.3], [1.0, 0.85, 0.4]], maxScreenOpacity: 0.95, old: true },
};

export function installExpansion(Scene, deps) {
  ({ TX, BACK, H, shaftTexture } = deps);
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Scene.prototype, k, v);
  }
}

// unused-import guard for bundlers that complain
void lightPool;
