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
    const pleats = Math.round(w / 0.09);
    const geo = new THREE.PlaneGeometry(w, drop, Math.max(6, pleats * 2), 3);
    const p = geo.attributes.position;
    // tighter, deeper folds when bunched
    const depth = state === 'open' ? 0.07 : 0.045;
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
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = 3.4, zb = BACK - depth;
    const wm = this.mat(`hxWard-${number}`, { map: TX.block(), color: light === 'warm' ? 0xeee0cc : 0xd8e4dc, roughness: 0.8 });
    const winX = cx + 0.5, winW = 1.3, winY0 = 1.05, winY1 = 2.3;
    if (window) {
      this.wall(x0, x1, H, zb, wm, [{ x0: winX - winW / 2, x1: winX + winW / 2, y0: winY0, y1: winY1 }]);
      const view = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'ward107'), color: 0xc8d2dc });
      view.userData.view = 'ward107';
      this.outsideMats.push(view);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.6, winY1 - winY0 + 0.6), view);
      pane.position.set(winX, (winY0 + winY1) / 2, zb - 0.25); root.add(pane);
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
    this.bx(0.44, 0.7, 0.42, this.mat('hCabinetW'), bedX - 1.4, 0.36, BACK - 2.3);
    this.ivStand(bedX - 1.15, BACK - 1.4);
    const scr = this.mat(`hxMon-${light}`, { color: 0x081008, emissive: 0x30c070, emissiveIntensity: light === 'dark' ? 0.2 : 0.7 });
    this.bx(0.4, 0.28, 0.12, this.mat('monitorBody'), bedX - 1.4, 1.45, BACK - 2.8);
    this.pl(0.34, 0.22, scr, bedX - 1.4, 1.45, BACK - 2.735);
    if (occupant) {
      // someone in the bed: a mound under the blanket
      const mound = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.2, 4, 8), this.mat('blanket'));
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
    const viewMat = new THREE.MeshBasicMaterial({ map: streetTexture('morning', view), color: 0xffffff });
    viewMat.userData.view = view;
    this.outsideMats.push(viewMat);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.8, h + 0.8), viewMat);
    pane.position.set(cx, cy, z - 0.3); root.add(pane);
    // the glare of the glass itself (washes the view out by day)
    const glareMat = new THREE.MeshBasicMaterial({ color: profile.color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
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
    // its light zone for WindowLightSystem (exposure/bloom response + lens flare)
    const zone = {
      ...profile,
      position: new THREE.Vector3(cx, cy + h * 0.15, z - 0.1),
      dir: new THREE.Vector3(0, 0, 1),
      enabled: () => !this.night,
    };
    this.windowLights.push(zone);
    this.expNight.push((night) => {
      glareMat.opacity = night ? 0.14 : 0.32;
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
      { x0: 23.6, x1: 27.2, y0: 0, y1: 2.6 },  // ward 111
      { x0: 27.55, x1: 28.45, y0: 0, y1: 2.2 }, // linen
      { x0: 28.8, x1: 32.4, y0: 0, y1: 2.6 },  // ward 113
      { x0: 33.0, x1: 34.6, y0: 1.25, y1: 2.55 }, // window B over the waiting chairs
      { x0: 35.0, x1: 35.9, y0: 0, y1: 2.2 },  // ward 115
    ];
    this.wallRun(X_WING, X_OLD - 0.35, H, holes, { mat: this.wallMat, dado: this.mat('hWains') });
    this.bx(X_OLD - X_WING, 0.06, 0.012, this.mat('hWallStripe', { color: 0x2a6ab0, roughness: 0.5 }), (X_WING + X_OLD) / 2, 1.32, BACK + 0.006);
    // wards: 111 half-drawn (someone asleep), 113 drawn shut (a shadow behind it, the lamp on)
    this.closedWard(23.6, 27.2, '111', { curtain: 'partial', light: 'cold', occupant: true });
    this.closedWard(28.8, 32.4, '113', { curtain: 'closed', light: 'warm', occupant: true });
    this.hDoor(28.0, BACK + 0.02, { sign: 'БЕЛЬЁ · LINEN', w: 0.9, color: 0x7a8490, push: true });
    const d115 = this.hDoor(35.45, BACK + 0.02, { sign: 'ПАЛАТА 115', w: 0.9 });
    void d115;
    const s115 = this.mat('hxStrip-115', { color: 0x000000, emissive: 0xffc078, emissiveIntensity: 0 });
    this.bx(0.8, 0.015, 0.02, s115, 35.45, 0.012, BACK + 0.05);
    this.expNight.push((night) => { s115.emissiveIntensity = night ? 2.6 : 0; });
    // waiting nook under window B: chairs, a low table, magazines, a plant
    const seat = this.mat('plasticChairH', { color: 0x3a7a86, roughness: 0.55 });
    for (let i = 0; i < 3; i++) {
      const x = 33.2 + i * 0.56;
      this.bx(0.5, 0.07, 0.46, seat, x, 0.46, BACK + 0.4);
      this.bx(0.5, 0.45, 0.05, seat, x, 0.72, BACK + 0.17, { rx: -0.1 });
      this.bx(0.04, 0.42, 0.04, this.mat('steel'), x - 0.22, 0.21, BACK + 0.4);
      this.bx(0.04, 0.42, 0.04, this.mat('steel'), x + 0.22, 0.21, BACK + 0.4);
    }
    this.bx(0.7, 0.04, 0.42, this.mat('hLaminate', { map: TX.laminate(), color: 0xffffff, roughness: 0.6 }), 34.0, 0.42, BACK + 1.0);
    for (let i = 0; i < 3; i++) this.bx(0.22, 0.012, 0.3, this.matV('hMagazine', { color: 0xffffff, roughness: 0.7 }), 33.85 + i * 0.09, 0.45 + i * 0.012, BACK + 1.0, { ry: i * 0.5, color: [0xc04040, 0x3a7ab0, 0xe0c060][i] });
    this.plant(32.75, BACK + 0.4, root, 1.4, 12);
    this.brightWindow(33.0, 34.6, 1.25, 2.55, PROFILES.B, 'ward109');
    // corridor ceiling: troffers, two of them dimmed
    for (let x = 24.5; x < X_OLD - 0.6; x += 3) this.troffer(x, -1.3, Math.abs(x - 30.5) < 0.1 ? 'B' : 'A');
    const l = new THREE.PointLight(0xe4eeff, 6, 11, 1.2); l.position.set(30, 2.75, -1.6); root.add(l);
    this.expNight.push((night) => { l.color.set(night ? 0x5070b0 : 0xe4eeff); l.intensity = night ? 1.6 : 6; });
    // night lamps low on the wall (like the ones in the old corridor): a dim amber pool each
    for (const nx of [27.9, 32.6]) {
      const nm = this.mat('hxNightLamp', { color: 0x201810, emissive: 0xffb060, emissiveIntensity: 0 });
      this.bx(0.22, 0.08, 0.04, nm, nx, 0.38, BACK + 0.05);
      const np = this.pool(0xffa050, nx, BACK + 0.9, 1.6, 1.3, 0);
      this.expNight.push((night) => { nm.emissiveIntensity = night ? 3 : 0; np.material.opacity = night ? 0.2 : 0; });
    }
    // directional sign at the end of the wing
    const s = this.textSign('СТАРОЕ КРЫЛО · ОПЕРБЛОК →', { w: 1.9, h: 0.22, bg: '#0e3a5a', fg: '#f4f8fa' });
    s.position.set(33.4, 2.72, -2.3); root.add(s);
    const sb = s.clone(); sb.rotation.y = Math.PI; sb.position.z -= 0.01; root.add(sb);
    // a fire extinguisher, hand rub, a notice board
    this.cy(0.075, 0.075, 0.45, 10, this.mat('hFireRed'), 32.65, 0.85, BACK + 0.1);
    this.sanitizer(27.4, 1.25);
    this.framed(TX.poster('hands'), 0.32, 0.44, 32.6, 1.75);
    // foreground: a meds cart and an IV pole near the camera
    const fg = (x, z, name, build) => { const g = new THREE.Group(); g.name = name; build(g); g.position.set(x, 0, z); root.add(g); this.foregroundGroups.push(g); };
    fg(25.6, 3.0, 'fg-crashcart-w', (g) => {
      const red = this.mat('hFireRed');
      this.box(0.7, 0.95, 0.5, red, 0, 0.55, 0, g);
      for (let i = 0; i < 4; i++) this.box(0.66, 0.02, 0.01, this.mat('hBlack'), 0, 0.25 + i * 0.2, 0.255, g);
      this.box(0.74, 0.04, 0.54, this.mat('hPlasticG'), 0, 1.04, 0, g);
    });
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
    for (const bx of [51.2, 53.4]) {
      this.bx(1.7, 0.06, 0.42, wood, bx, 0.46, BACK + 0.45);
      this.bx(1.7, 0.4, 0.05, wood, bx, 0.78, BACK + 0.22, { rx: -0.12 });
      for (const dx of [-0.75, 0.75]) this.bx(0.05, 0.46, 0.4, iron, bx + dx, 0.23, BACK + 0.45);
    }
    this.clock(52.3, 2.75, BACK + 0.02, 'oldwing');
    // standing scale
    this.bx(0.4, 0.06, 0.34, iron, 42.4, 0.04, BACK + 0.4);
    this.bx(0.05, 1.4, 0.05, iron, 42.4, 0.72, BACK + 0.25);
    this.bx(0.3, 0.05, 0.05, iron, 42.4, 1.42, BACK + 0.28);
    // gurney with a sheet by window C
    this.bx(1.9, 0.06, 0.62, this.mat('steel'), 45.3, 0.72, BACK + 0.55);
    this.bx(1.85, 0.12, 0.6, this.mat('sheet'), 45.3, 0.8, BACK + 0.55);
    for (const dx of [-0.85, 0.85]) this.bx(0.04, 0.7, 0.04, this.mat('steel'), 45.3 + dx, 0.35, BACK + 0.55);
    // glass-fronted medicine cabinet between window C and the OR doors
    this.bx(0.7, 1.8, 0.35, this.mat('hxCabinetCream', { color: 0xe4e0d0, roughness: 0.5 }), 47.85 + 0.0, 0.95, BACK + 0.2);
    this.bx(0.6, 1.3, 0.02, this.mat('hGlass'), 47.85, 1.2, BACK + 0.38);
    for (let i = 0; i < 9; i++) this.cy(0.025, 0.025, 0.12, 6, this.matV('hxVial', { color: 0xffffff, roughness: 0.3 }), 47.62 + (i % 3) * 0.2, 0.7 + Math.floor(i / 3) * 0.42, BACK + 0.25, { color: [0x8a5a20, 0xc8d8c0, 0x5a3a20][i % 3] });
    // the boarded side corridor: a sawhorse and a sign, the dark going on behind
    this.sideCorridorDark(55.5, 56.8);
    // pendant lights (old glass globes)
    const globe = this.mat('hxGlobe', { color: 0xe8e4d8, emissive: 0xfff2d8, emissiveIntensity: 0.9, roughness: 0.3 });
    const globeN = this.mat('hxGlobeN', { color: 0xe8e4d8, emissive: 0xffe8c8, emissiveIntensity: 0.9, roughness: 0.3 });
    const globeOff = this.mat('hxGlobeOff', { color: 0xc8c4b8, emissive: 0x000000, roughness: 0.3 });
    for (const [gx, on] of [[39.5, true], [43.5, true], [47.5, false], [51.5, true], [55.0, true]]) {
      this.cy(0.006, 0.006, 0.9, 4, iron, gx, H2 - 0.45, -1.3);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), gx === 51.5 ? globeN : on ? globe : globeOff);
      g.position.set(gx, H2 - 1.0, -1.3); root.add(g);
      this.pendants.push(g);
    }
    // light: warm from window A, cold from C/D, the globes
    // at night only the globe by the benches burns (warm, weak)
    const nightGlobe = new THREE.PointLight(0xffc888, 0, 6, 1.6); nightGlobe.position.set(51.5, H2 - 1.2, -1.3); root.add(nightGlobe);
    const warm = new THREE.PointLight(0xffd8a0, 5, 9, 1.3); warm.position.set(41.5, 2.4, -1.8); root.add(warm);
    const cold = new THREE.PointLight(0xdce6f4, 5, 10, 1.3); cold.position.set(52.5, 2.6, -1.6); root.add(cold);
    this.expNight.push((night) => {
      warm.color.set(night ? 0x4a5a98 : 0xffd8a0); warm.intensity = night ? 1.5 : 5;
      cold.color.set(night ? 0x3a4a80 : 0xdce6f4); cold.intensity = night ? 1.8 : 5;
      globe.emissiveIntensity = night ? 0.12 : 0.9;
      nightGlobe.intensity = night ? 2.2 : 0;
      globeN.emissiveIntensity = night ? 1.1 : 0.9;
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
      this.box(0.5, H2, 0.5, this.mat('hxOldWall'), 0, H2 / 2, 0, g);
      this.box(0.54, 1.25, 0.54, this.mat('hxOldDado'), 0, 0.625, 0, g);
    });
  },

  /** Old wooden door (single or double), optionally with frosted glass lit from behind. */
  oldDoor(x, w, h, { sign, frosted = false, double = false, lit = null } = {}) {
    const root = this.root;
    const wood = this.mat('hxDoorWood', { color: 0x5a3a20, roughness: 0.5 });
    const frame = this.mat('hxWoodFrame', { color: 0x4a301a, roughness: 0.5 });
    this.bx(w + 0.24, 0.14, 0.16, frame, x, h + 0.07, BACK + 0.02);
    for (const s of [-1, 1]) this.bx(0.12, h, 0.16, frame, x + s * (w / 2 + 0.06), h / 2, BACK + 0.02);
    const leaves = double ? 2 : 1, lw = w / leaves;
    const glassM = frosted ? this.mat(`hxFrosted-${lit}`, { map: TXX.frosted(), color: 0xffffff, emissive: 0xfff4dc, emissiveMap: TXX.frosted(), emissiveIntensity: lit === 'day' ? 0.5 : 0, roughness: 0.3 }) : null;
    for (let k = 0; k < leaves; k++) {
      const lx = x - w / 2 + lw * (k + 0.5);
      this.bx(lw - 0.02, h, 0.05, wood, lx, h / 2, BACK);
      for (const py of [0.35, 1.0]) this.bx(lw - 0.2, 0.36, 0.06, frame, lx, py, BACK + 0.005);
      if (glassM) this.bx(lw - 0.24, h * 0.36, 0.06, glassM, lx, h * 0.72, BACK + 0.008);
      else this.bx(lw - 0.2, 0.5, 0.06, frame, lx, h * 0.72, BACK + 0.005);
      this.bx(0.04, 0.12, 0.05, this.mat('hBrass'), lx + (k ? -1 : 1) * (lw / 2 - 0.1), 1.02, BACK + 0.05);
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
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), this.mat('hxFarBulb', { color: 0, emissive: 0xffe0b0, emissiveIntensity: 2.5 }));
    bulb.position.set(cx, 2.5, BACK - depth + 0.8); root.add(bulb);
    const g = glow(0xffd8a0, 0.6, 0.35); g.position.copy(bulb.position); root.add(g);
    this.pool(0xffc890, cx, BACK - depth + 1.0, 1.0, 1.4, 0.18);
    // sawhorse barrier + sign
    const stripe = this.mat('hxBarrier', { color: 0xe8e0d0, roughness: 0.6 });
    const red = this.mat('hFireRed');
    this.bx(w + 0.1, 0.16, 0.05, stripe, cx, 1.0, BACK + 0.15);
    for (let i = 0; i < 4; i++) this.bx(0.14, 0.16, 0.055, red, x0 + 0.2 + i * 0.32, 1.0, BACK + 0.15);
    for (const s of [-1, 1]) this.bx(0.05, 1.0, 0.05, stripe, cx + s * (w / 2 - 0.05), 0.5, BACK + 0.15, { rz: s * 0.12 });
    const sign = this.textSign('РЕМОНТ · ПРОХОДА НЕТ', { w: 1.1, h: 0.2, bg: '#e8c020', fg: '#141414' });
    sign.position.set(cx, 1.35, BACK + 0.16); root.add(sign);
  },

  /** The old operating theatre behind the back wall: seen through the porthole doors and the observation window. */
  buildOperating() {
    const root = this.root;
    const x0 = 48.0, x1 = 55.2, depth = 5.2, zb = BACK - depth, cx = (x0 + x1) / 2;
    const tiles = this.mat('hxOrTiles', { map: tiled(TXX.orTiles(), (x1 - x0) / 0.5, 6), color: 0xffffff, roughness: 0.4 });
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
    this.bx(0.5, 0.7, 0.4, steel, tx, 0.35, tz);
    this.bx(2.0, 0.1, 0.62, this.mat('hxOrPad', { color: 0x2a4a4a, roughness: 0.6 }), tx, 0.78, tz);
    this.cy(0.03, 0.03, 1.1, 6, steel, tx, H2 - 0.55, tz);
    const lampM = this.mat('hxOrLamp', { color: 0x202020, emissive: 0xfff8e8, emissiveIntensity: 1.6 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.18, 24), this.mat('hxOrLampBody', { color: 0xd8dcd8, metalness: 0.5, roughness: 0.3 }));
    lamp.position.set(tx, 2.55, tz); root.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), lampM); lens.rotation.x = Math.PI / 2; lens.position.set(tx, 2.45, tz); root.add(lens);
    const lampGlow = glow(0xfff4e0, 1.6, 0.45); lampGlow.position.set(tx, 2.3, tz); root.add(lampGlow);
    const pool = this.pool(0xfff4e0, tx, tz, 2.6, 1.6, 0.3);
    for (const [ix, iz] of [[50.6, BACK - 1.6], [53.8, BACK - 3.8]]) {
      this.bx(0.7, 0.04, 0.45, steel, ix, 0.9, iz); this.bx(0.7, 0.04, 0.45, steel, ix, 0.45, iz);
      for (const dx of [-0.32, 0.32]) for (const dz of [-0.2, 0.2]) this.bx(0.02, 0.9, 0.02, steel, ix + dx, 0.45, iz + dz);
      for (let i = 0; i < 5; i++) this.bx(0.14, 0.01, 0.02, steel, ix - 0.25 + i * 0.12, 0.925, iz);
    }
    this.bx(1.6, 2.0, 0.4, this.mat('hxOrCabinet', { color: 0xdfe4e0, roughness: 0.5 }), 49.4, 1.0, zb + 0.25);
    this.bx(1.4, 1.5, 0.02, this.mat('hGlass'), 49.4, 1.2, zb + 0.46);
    this.bx(1.9, 0.06, 0.62, steel, 54.0, 0.72, BACK - 1.4);
    const sheetShape = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 4, 8), this.mat('sheet'));
    sheetShape.rotation.z = Math.PI / 2; sheetShape.scale.set(1, 1, 0.8); sheetShape.position.set(54.0, 0.92, BACK - 1.4); root.add(sheetShape);
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
    const l = new THREE.PointLight(0xe8f0ff, 4, 7, 1.4); l.position.set(tx, 2.8, tz + 0.6); root.add(l);
    this.expNight.push((night) => {
      l.intensity = night ? 0.25 : 4;
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
    const view = new THREE.MeshBasicMaterial({ map: streetTexture('morning', 'ward109'), color: 0xffffff });
    view.userData.view = 'ward109'; this.outsideMats.push(view);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(zB - zA + 1, y1 - y0 + 1), view);
    pane.rotation.y = -Math.PI / 2; pane.position.set(X_END + 0.35, (y0 + y1) / 2, (zA + zB) / 2); root.add(pane);
    const glareMat = new THREE.MeshBasicMaterial({ color: PROFILES.D.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
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
      glareMat.opacity = night ? 0.16 : 0.85; glareMat.color.set(night ? 0x4a68b0 : PROFILES.D.color);
      shaftMat.opacity = night ? 0.12 : PROFILES.D.shaft; shaftMat.color.set(night ? 0x5a78c0 : PROFILES.D.color);
      patch.material.opacity = night ? 0.14 : PROFILES.D.patch; patch.material.color.set(night ? 0x5a78c0 : PROFILES.D.color);
    });
  },

  /** How much footsteps echo at x (0 in the new building, 1 in the old wing). */
  echoAt(x) { return Math.min(1, Math.max(0, (x - X_OLD + 0.5) / 2)); },

  /** Per-frame life of the expansion: curtains in the draught, shadows behind curtains, a tired globe. */
  updateExpansion(dt) {
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
  A: { id: 'A', color: 0xffd8a0, triggerDistance: 3.4, fadeDistance: 2.2, intensity: 1.0, exposure: 0.16, bloom: 0.22, shaft: 0.2, patch: 0.28,
    flareSize: 1.0, starburstIntensity: 1.0, ghostIntensity: 0.8, ghostCount: 6, ghostSpacing: 0.42, ringIntensity: 0.5, colorTint: [1.0, 0.86, 0.6], ghostTints: [[0.5, 1.0, 0.6], [0.8, 1.0, 0.5], [1.0, 0.7, 0.3]], maxScreenOpacity: 0.85, old: true },
  B: { id: 'B', color: 0xdfe8ff, triggerDistance: 2.8, fadeDistance: 1.8, intensity: 0.7, exposure: 0.12, bloom: 0.2, shaft: 0.14, patch: 0.18,
    flareSize: 0.75, starburstIntensity: 0.45, ghostIntensity: 0.6, ghostCount: 5, ghostSpacing: 0.5, ringIntensity: 0.6, colorTint: [0.85, 0.92, 1.0], ghostTints: [[0.5, 0.6, 1.0], [0.8, 0.5, 1.0], [0.6, 0.9, 1.0]], maxScreenOpacity: 0.6 },
  C: { id: 'C', color: 0xe8ecf4, triggerDistance: 2.6, fadeDistance: 1.6, intensity: 0.55, exposure: 0.08, bloom: 0.25, shaft: 0.12, patch: 0.14,
    flareSize: 0.7, starburstIntensity: 0.3, ghostIntensity: 0.35, ghostCount: 3, ghostSpacing: 0.6, ringIntensity: 0.2, colorTint: [0.95, 0.97, 1.0], ghostTints: [[0.9, 0.95, 1.0]], streaks: true, maxScreenOpacity: 0.5, old: true },
  D: { id: 'D', color: 0xfff0d4, triggerDistance: 4.5, fadeDistance: 4.0, intensity: 1.3, exposure: 0.42, bloom: 0.7, shaft: 0.3, patch: 0.4,
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
