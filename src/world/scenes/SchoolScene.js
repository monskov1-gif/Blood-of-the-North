import * as THREE from 'three';
import { flareSource } from '../../fx/WindowLight.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LocationBase } from '../LocationBase.js';
import { canvasTexture, rng, streetTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { roundedBox } from '../nature.js';

/**
 * F.H. Collins Secondary, Whitehorse — a corridor after the last bell (L1 «След»).
 * Look (owner's reference): red steel lockers with louvres, cream glazed tile walls with a darker
 * band, a polished floor that mirrors the ceiling lights, recessed fluorescent panels, oak
 * classroom doors with narrow windows. Side-on like every location; a cross corridor opens in
 * the back wall and runs away from the camera in deep perspective.
 *   x -10 … -8   exit doors          x -7.2  trophy case       x -4.6  window onto the yard
 *   x -3.4 … 0   lockers             x 0.4 … 2.6  the cross corridor
 *   x  2.9 … 4   classroom door      x 4.6  fountain     x 5.2 … 7.6  notice board, bench
 */

const BACK = -3.2, H = 3.2;
const TEX = (key, w, h, draw, o = {}) => canvasTexture(`school-${key}`, w, h, draw, { aniso: 8, ...o });
const hex = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b) => `rgb(${hex(r)},${hex(g)},${hex(b)})`;

/** A locker door: glossy red enamel, three louvre groups, a recessed latch, a number plate. */
const lockerTex = (v = 0) => TEX(`locker2-${v}`, 64, 256, (ctx, w, h) => {
  const r = rng(611 + v * 17);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#8a1414'); g.addColorStop(0.15, '#b81e1c'); g.addColorStop(0.7, '#c42420'); g.addColorStop(1, '#7a1010');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,0,0'},${r() * 0.06})`; ctx.fillRect(r() * w, r() * h, 1, 1 + r() * 3); }
  // door edges, the frame gap
  ctx.fillStyle = '#3a0606'; ctx.fillRect(0, 0, 2, h); ctx.fillRect(w - 2, 0, 2, h); ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2);
  ctx.fillStyle = 'rgba(255,200,190,0.35)'; ctx.fillRect(3, 3, 1, h - 6);
  // louvres: top and bottom groups
  for (const y0 of [14, 214]) for (let k = 0; k < 6; k++) {
    const y = y0 + k * 5;
    ctx.fillStyle = '#2a0404'; ctx.fillRect(14, y, 36, 2);
    ctx.fillStyle = 'rgba(255,190,180,0.45)'; ctx.fillRect(14, y + 2, 36, 1);
  }
  // number plate and the latch recess
  ctx.fillStyle = '#d8d4cc'; ctx.fillRect(22, 52, 20, 9); ctx.fillStyle = '#2a2a2a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(214 + v), 32, 60);
  ctx.fillStyle = '#5a0a0a'; ctx.fillRect(46, 112, 10, 30);
  ctx.fillStyle = '#c8ccd0'; ctx.fillRect(48, 116, 6, 22); ctx.fillStyle = '#8a8e92'; ctx.fillRect(48, 134, 6, 3);
  ctx.fillStyle = 'rgba(255,220,210,0.25)'; ctx.fillRect(46, 112, 10, 1);
}, { repeat: [1, 1] });

/** Cream glazed tiles (15 cm), a band of darker tiles at hand height, the grout lines. */
const tileTex = () => TEX('tile2', 128, 128, (ctx, w, h) => {
  const r = rng(612);
  const n = 8, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * 10;
    const g = ctx.createLinearGradient(i * s, j * s, i * s + s, j * s + s);
    g.addColorStop(0, rgb(232 + v, 214 + v, 172 + v)); g.addColorStop(1, rgb(218 + v, 198 + v, 156 + v));
    ctx.fillStyle = g; ctx.fillRect(i * s, j * s, s, s);
    ctx.fillStyle = 'rgba(255,255,240,0.35)'; ctx.fillRect(i * s + 2, j * s + 2, s * 0.5, 1);
  }
  ctx.fillStyle = '#a8977a';
  for (let k = 0; k <= n; k++) { ctx.fillRect(k * s - 0.5, 0, 1, h); ctx.fillRect(0, k * s - 0.5, w, 1); }
}, { repeat: [1, 1] });

const bandTex = () => TEX('band2', 128, 16, (ctx, w, h) => {
  const r = rng(613);
  for (let i = 0; i < 8; i++) { const v = (r() - 0.5) * 10; ctx.fillStyle = rgb(176 + v, 132 + v, 82 + v); ctx.fillRect(i * 16, 0, 16, h); }
  ctx.fillStyle = '#7a6448'; for (let i = 0; i <= 8; i++) ctx.fillRect(i * 16 - 0.5, 0, 1, h);
  ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, h - 1, w, 1);
});

/** Polished terrazzo: cream with flecks, large square joints. */
const floorTex = () => TEX('floor2', 256, 256, (ctx, w, h) => {
  const r = rng(614);
  ctx.fillStyle = '#d8d0c0'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const c = r();
    ctx.fillStyle = c < 0.4 ? 'rgba(150,140,124,0.6)' : c < 0.7 ? 'rgba(240,236,228,0.8)' : c < 0.9 ? 'rgba(120,104,90,0.5)' : 'rgba(170,80,60,0.35)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { ctx.fillStyle = (i + j) % 2 ? 'rgba(120,100,70,0.07)' : 'rgba(255,250,240,0.05)'; ctx.fillRect(i * w / 2, j * h / 2, w / 2, h / 2); }   // two tones of tile
  ctx.fillStyle = 'rgba(110,100,90,0.6)'; ctx.fillRect(0, 0, w, 1); ctx.fillRect(0, 0, 1, h); ctx.fillRect(w / 2, 0, 1, h); ctx.fillRect(0, h / 2, w, 1);
  for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(90,96,104,0.12)'; ctx.fillRect(r() * w, r() * h, 6, 3); }   // wet boot prints
});

/** Acoustic ceiling tiles with a grid. */
const ceilTex = () => TEX('ceil3', 64, 128, (ctx, w, h) => {
  const r = rng(615);
  ctx.fillStyle = '#ebe7dc'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { ctx.fillStyle = 'rgba(150,146,136,0.35)'; ctx.fillRect(r() * w, r() * h, 1, 1); }   // fissured acoustic tile
  ctx.fillStyle = '#f8f6f0'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, h);                                       // white T-bar grid
  ctx.fillStyle = 'rgba(120,116,108,0.5)'; ctx.fillRect(0, 3, w, 1); ctx.fillRect(3, 0, 1, h);
});
/** Troffer diffuser: prismatic lens in a white frame. */
const trofferTex = () => TEX('troffer', 64, 128, (ctx, w, h) => {
  ctx.fillStyle = '#d8d4cc'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(4, 4, w - 8, h - 8);
  ctx.fillStyle = 'rgba(200,196,186,0.5)'; for (let y = 6; y < h - 6; y += 3) ctx.fillRect(4, y, w - 8, 1); for (let x = 6; x < w - 6; x += 3) ctx.fillRect(x, 4, 1, h - 8);
});

/** Oak veneer for the classroom doors. */
const oakTex = () => TEX('oak3', 64, 256, (ctx, w, h) => {
  const r = rng(616);
  ctx.fillStyle = '#c08a4a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    ctx.strokeStyle = `rgba(${r() < 0.5 ? '120,70,30' : '220,170,110'},${0.1 + r() * 0.18})`; ctx.lineWidth = 0.5 + r();
    const x = r() * w; ctx.beginPath(); ctx.moveTo(x, 0); for (let y = 0; y <= h; y += 16) ctx.lineTo(x + Math.sin(y * 0.01 + i) * 0.8, y); ctx.stroke();
  }
});

const boardTex = () => TEX('board2', 192, 128, (ctx, w, h) => {
  const r = rng(604);
  ctx.fillStyle = '#9a6a3a'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(80,50,24,${r() * 0.4})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  const notes = ['#f2ead8', '#f2d860', '#e8a0a0', '#a8d0e8', '#f2ead8', '#c8e8a8', '#f2ead8'];
  for (let i = 0; i < 9; i++) {
    const x = 8 + (i % 4) * 46 + r() * 8, y = 8 + Math.floor(i / 4) * 40 + r() * 8, nw = 28 + r() * 12, nh = 24 + r() * 12;
    ctx.save(); ctx.translate(x + nw / 2, y + nh / 2); ctx.rotate((r() - 0.5) * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-nw / 2 + 2, -nh / 2 + 2, nw, nh);
    ctx.fillStyle = notes[i % notes.length]; ctx.fillRect(-nw / 2, -nh / 2, nw, nh);
    ctx.fillStyle = 'rgba(40,40,50,0.6)'; for (let k = 0; k < 5; k++) ctx.fillRect(-nw / 2 + 4, -nh / 2 + 6 + k * 4, nw - 10 - r() * 8, 1);
    ctx.fillStyle = '#c02020'; ctx.beginPath(); ctx.arc(0, -nh / 2 + 3, 1.6, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#1a2a4a'; ctx.fillRect(140, 88, 44, 32); ctx.fillStyle = '#f2d860'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('WINTER', 146, 102); ctx.fillText('FORMAL', 146, 113);
});

/** The dining hall glimpsed through the cafeteria doors' glass: warm light, tables, a red panel. */
const cafeGlimpseTex = () => TEX('cafeGlimpse', 48, 128, (ctx, w, h) => {
  const r = rng(617);
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f8f2e4'; ctx.fillRect(0, 0, w, 30);
  ctx.fillStyle = '#fffaf0'; for (const y of [8, 20]) ctx.fillRect(4, y, w - 8, 3);
  ctx.fillStyle = '#b02a22'; ctx.fillRect(28, 34, 12, 16);
  ctx.fillStyle = '#d8ccb0'; ctx.fillRect(0, 60, w, 30);
  ctx.fillStyle = '#c8b898'; for (let k = 0; k < 4; k++) ctx.fillRect(2 + k * 12, 78 + (k % 2) * 4, 10, 3);
  ctx.fillStyle = '#9aa0a6'; for (let k = 0; k < 6; k++) ctx.fillRect(4 + k * 8, 82, 1, 10);
  ctx.fillStyle = '#ddd4c2'; ctx.fillRect(0, 92, w, h - 92);
  for (let i = 0; i < 60; i++) { ctx.fillStyle = 'rgba(120,100,80,0.3)'; ctx.fillRect(r() * w, 92 + r() * (h - 92), 1, 1); }
  ctx.fillStyle = 'rgba(80,60,40,0.45)'; ctx.fillRect(14, 54, 6, 38); ctx.fillRect(13, 46, 8, 9);   // someone over there
});

const smearTex = () => TEX('smear', 32, 128, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-in';
  const s = ctx.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.15, 'rgba(0,0,0,1)'); s.addColorStop(0.85, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, w, h);
}, { color: false });
const shadowTex = () => TEX('cshadow', 64, 32, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.scale(1, h / w * 2); ctx.fillStyle = g; ctx.fillRect(0, 0, w, w); ctx.restore();
}, { color: false });

const ReflShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStrength: { value: 0.42 } },
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
      vec3 c = vec3(0.0); float ws = 0.0;
      for (int i = -3; i <= 3; i++) { float fi = float(i); float w = 1.0 - abs(fi) / 4.0; c += texture2D(tDiffuse, uv + vec2(0.0, fi * 0.004)).rgb * w; ws += w; }
      c /= ws;
      gl_FragColor = vec4(c * uStrength, 1.0);
    }`,
};

export class SchoolScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'school';
    this.title = 'Школа';
    this.background = 0x1a1c20;
    this.camera = { distance: 7.0, height: 1.45, lookHeight: 1.45, lookZ: -1.1 };
    this.bounds = { walk: { areas: [{ minX: -9.4, maxX: 11.0, minZ: -2.4, maxZ: 0.9 }] }, camera: { minX: -6.2, maxX: 8.4 } };
  }

  build() {
    const root = this.root;
    // ---- the floor: polished terrazzo + a planar reflection
    const ft = floorTex().clone(); ft.needsUpdate = true; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(28 / 1.2, 22 / 1.2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 22), this.mat('schoolFloor3', { map: ft, color: 0xe2d8c6, roughness: 0.14, metalness: 0.0, forceStandard: true }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(2, 0, -8.4); root.add(floor);
    if (!this.low) {
      const refl = new Reflector(new THREE.PlaneGeometry(28, 22), {
        textureWidth: Math.floor(window.innerWidth * 0.5), textureHeight: Math.floor(window.innerHeight * 0.5), shader: ReflShader, clipBias: 0.003,
      });
      refl.material.transparent = true; refl.material.blending = THREE.AdditiveBlending; refl.material.depthWrite = false;
      refl.rotation.x = -Math.PI / 2; refl.position.set(2, 0.002, -8.4); refl.renderOrder = 1;
      root.add(refl);
    } else {
      // low quality: a soft fake sheen of the ceiling panels on the floor
      for (const x of [-7, -2.5, 2, 6.5, 10.5]) { const s = glow(0xfff8e8, 2.2, 0.16); s.position.set(x, 0.01, -1.6); s.scale.set(1.4, 0.5, 1); root.add(s); }
    }
    // ---- reflections painted on the polish (red lockers, the doors, the light panels) and contact shadows
    const refl = (x, w, depth, color, op, z0 = BACK + 0.47) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, depth), new THREE.MeshBasicMaterial({ map: smearTex(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z0 + depth / 2); root.add(m); return m;
    };
    refl(-1.6, 3.6, 1.6, 0xb01818, this.low ? 0.5 : 0.25);
    refl(8.4, 1.3, 1.6, 0xb01818, this.low ? 0.5 : 0.25);
    refl(3.45, 1.0, 1.4, 0xb07a40, this.low ? 0.35 : 0.18, BACK + 0.05);
    for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5]) refl(x, 0.5, 2.6, 0xfff4e0, this.low ? 0.35 : 0.15, -2.4);
    const shadow = (x, z, w, d, op = 0.45) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: shadowTex(), color: 0x000000, transparent: true, opacity: op, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); root.add(m);
    };
    shadow(-1.6, BACK + 0.5, 3.9, 0.35); shadow(8.4, BACK + 0.5, 1.5, 0.35); shadow(4.6, BACK + 0.32, 0.7, 0.4, 0.35); shadow(6.4, BACK + 0.55, 2.5, 0.7, 0.4);
    // ---- the back wall: tile, a darker band, a dark base cove; holes for the window, the cross corridor, the doors
    const tt = tileTex().clone(); tt.needsUpdate = true; tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(27 / 1.2, H / 1.2);
    const tileM = this.mat('schoolTile', { map: tt, color: 0xffffff, roughness: 0.25, metalness: 0.0 });
    const holes = [
      { x0: -5.7, x1: -3.5, y0: 1.15, y1: 2.65 },     // the window
      { x0: 0.4, x1: 2.6, y0: 0.0, y1: 2.85 },        // the cross corridor
      { x0: 2.95, x1: 3.95, y0: 0.0, y1: 2.2 },       // classroom door
      { x0: -10.0, x1: -8.4, y0: 0.0, y1: 2.3 },      // the exit
      { x0: 9.3, x1: 11.1, y0: 0.0, y1: 2.4 },        // double doors to the cafeteria
    ];
    this.wall(-12, 15, H, BACK, tileM, holes);
    const band = this.mat('schoolBand', { map: bandTex(), color: 0xffffff, roughness: 0.3 });
    const cove = this.mat('schoolCove', { color: 0x4a3426, roughness: 0.5 });
    for (const [a, b] of [[-12, -10.0], [-8.4, 0.4], [2.6, 2.95], [3.95, 9.3], [11.1, 12.8]]) {
      const w = b - a, cx = (a + b) / 2;
      const bt = band.map.clone(); bt.needsUpdate = true; bt.wrapS = THREE.RepeatWrapping; bt.repeat.set(w / 1.2, 1);
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.15), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.3 }));
      bm.position.set(cx, 2.35, BACK + 0.012); root.add(bm);
      this.box(w, 0.14, 0.03, cove, cx, 0.07, BACK + 0.015);
    }
    // ---- the ceiling: acoustic tiles, recessed fluorescent panels (+ their light)
    const ct = ceilTex().clone(); ct.needsUpdate = true; ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(28 / 0.6, 6 / 1.2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(28, 6), this.mat('schoolCeil4', { map: ct, color: 0xffffff, roughness: 1, emissive: 0x6c6a64 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(2, H, -0.2); root.add(ceil);
    const panelM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xf8fbff, emissiveIntensity: 1.9, emissiveMap: trofferTex() });
    for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), panelM); p.rotation.x = Math.PI / 2; p.position.set(x, H - 0.005, -1.2); root.add(p);
      if (x === -4.5 || x === 4.5 || x === 7.5) continue;
      const l = new THREE.PointLight(0xf6f8ff, 5, 8, 1.2); l.position.set(x, H - 0.7, -1.0); root.add(l);
    }
    // ---- the cross corridor, running away from the camera (the reference's perspective)
    this.buildCross(tileM, band, cove, ceil.material, panelM);
    // ---- the window onto the yard (pale November)
    const yard = streetTexture('day', 'bar');
    const view = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.0), new THREE.MeshBasicMaterial({ map: yard, color: 0xc8ccd0 }));
    view.position.set(-4.6, 1.9, BACK - 1.4); root.add(view);
    const frameM = this.mat('schoolFrame2', { color: 0x6a6e72, roughness: 0.4, metalness: 0.5 });
    const wx0 = -5.7, wx1 = -3.5, wy0 = 1.15, wy1 = 2.65;
    for (const [w, h, x, y] of [[wx1 - wx0, 0.06, (wx0 + wx1) / 2, wy0], [wx1 - wx0, 0.06, (wx0 + wx1) / 2, wy1], [0.05, wy1 - wy0, (wx0 + wx1) / 2, (wy0 + wy1) / 2], [0.05, wy1 - wy0, wx0, (wy0 + wy1) / 2], [0.05, wy1 - wy0, wx1, (wy0 + wy1) / 2]]) {
      const m = new THREE.Mesh(roundedBox(w, h, 0.12, 0.02, 1), frameM); m.position.set(x, y, BACK); root.add(m);
    }
    const sill = new THREE.Mesh(roundedBox(wx1 - wx0 + 0.16, 0.05, 0.24, 0.015, 1), this.mat('sill2', { color: 0xd8d0c0, roughness: 0.4 })); sill.position.set(-4.6, wy0 - 0.03, BACK + 0.08); root.add(sill);
    const radiator = this.radiator(-4.6, BACK + 0.12); void radiator;
    // ---- lockers
    this.lockers(-3.4, 0.2, BACK + 0.24, 1);
    this.lockers(7.8, 9.0, BACK + 0.24, 1);
    // ---- the right end: double doors to the cafeteria, the corridor's end wall
    this.cafeDoor(10.2, BACK, tileM, band, cove);
    // ---- the classroom door: oak, a narrow window, a kick plate, a room number
    this.classDoor(3.45, BACK, '112');
    // ---- the exit on the left: glass doors, daylight; trophy case
    this.door(-9.2, BACK + 0.02, { w: 1.6, h: 2.3, color: 0x5a6068, glass: true, sign: 'ВЫХОД · EXIT', signColor: '#e8f0e8' });
    const doorLight = glow(0xe8f0ff, 3.2, 0.25); doorLight.position.set(-9.2, 1.2, BACK + 0.3); root.add(doorLight);
    const caseM = this.mat('trophyCase2', { color: 0x6a4a2c, roughness: 0.4 });
    const cb = new THREE.Mesh(roundedBox(1.6, 1.0, 0.45, 0.03), caseM); cb.position.set(-7.2, 0.5, BACK + 0.25); root.add(cb);
    const gl = new THREE.Mesh(roundedBox(1.6, 0.9, 0.42, 0.02), this.mats.glass()); gl.position.set(-7.2, 1.45, BACK + 0.25); root.add(gl);
    const gold = this.mat('trophy2', { color: 0xd8b040, metalness: 0.8, roughness: 0.25 });
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Group();
      const cup = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.06, 0], [0.06, 0.03], [0.02, 0.05], [0.02, 0.14], [0.07, 0.2], [0.08, 0.3], [0.075, 0.3]].map(([a, b]) => new THREE.Vector2(a, b)), 20), gold);
      t.add(cup); t.position.set(-7.75 + i * 0.36, 1.03, BACK + 0.25); t.scale.setScalar(0.9 + (i % 2) * 0.25); root.add(t);
    }
    // ---- notice board + bench (where the girls meet)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), this.mat('schoolBoard2', { map: boardTex(), color: 0xffffff, roughness: 0.9 }));
    board.position.set(6.4, 1.82, BACK + 0.04); root.add(board);
    const bframe = this.mat('boardFrame', { color: 0x6a4a2a, roughness: 0.5 });
    for (const [w, h, x, y] of [[2.32, 0.06, 6.4, 2.55], [2.32, 0.06, 6.4, 1.09], [0.06, 1.46, 5.27, 1.82], [0.06, 1.46, 7.53, 1.82]]) { const m = new THREE.Mesh(roundedBox(w, h, 0.05, 0.015, 1), bframe); m.position.set(x, y, BACK + 0.04); root.add(m); }
    const yt = this.textSign('F.H. COLLINS · YUKON', { w: 2.4, h: 0.26, bg: '#5a0e0e', fg: '#f2d860', font: 'bold 40px sans-serif' });
    yt.position.set(-1.6, 2.95, BACK + 0.04); root.add(yt);
    this.bench(6.4, BACK + 0.5, 2.2, 0x7a5a3a);
    this.colliders.push({ x: 6.4, z: BACK + 0.5, r: 0.5 });
    // ---- a wall-mounted water fountain, backpacks by the bench
    const steel = this.mat('fountain3', { color: 0x8a9096, metalness: 0.8, roughness: 0.25 });
    const bowl = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.2, 0.0], [0.24, 0.05], [0.25, 0.16], [0.24, 0.17], [0.2, 0.08], [0.0, 0.06]].map(([a, b]) => new THREE.Vector2(a, b)), 28), steel);
    bowl.scale.set(1, 1, 0.75); bowl.position.set(4.6, 0.78, BACK + 0.2); root.add(bowl);
    const back = new THREE.Mesh(roundedBox(0.5, 0.42, 0.06, 0.02), steel); back.position.set(4.6, 0.86, BACK + 0.03); root.add(back);
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.06, 0.24, 24, 1, true, Math.PI / 2, Math.PI), steel); apron.scale.z = 0.75; apron.position.set(4.6, 0.66, BACK + 0.06); root.add(apron);
    const bub = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.06, 16), this.mat('chrome', { color: 0xe8ecf0, metalness: 1, roughness: 0.12 })); bub.position.set(4.6, 0.9, BACK + 0.26); root.add(bub);
    const bar = new THREE.Mesh(roundedBox(0.3, 0.05, 0.03, 0.012), this.mats.cache.get('chrome')); bar.position.set(4.6, 0.86, BACK + 0.39); root.add(bar);
    const packGeo = roundedBox(0.32, 0.42, 0.2, 0.07), pocketGeo = roundedBox(0.24, 0.16, 0.07, 0.03);
    const pack = (x, z, c, ry) => {
      const m = this.mat(`pack2${c}`, { color: c, roughness: 0.9 });
      const b = new THREE.Mesh(packGeo, m); b.position.set(x, 0.21, z); b.rotation.set(-0.12, ry, 0); root.add(b);
      const pk = new THREE.Mesh(pocketGeo, m); pk.position.set(0, -0.07, 0.11); b.add(pk);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16, Math.PI), this.mat('strap', { color: 0x1a1a1a, roughness: 0.8 })); strap.position.set(0, 0.2, 0); b.add(strap);
    };
    pack(5.4, BACK + 0.6, 0x7a2a2a, 0.4); pack(7.6, BACK + 0.65, 0x2a4a6a, -0.3);
    // ---- anchors (interactables follow them)
    this.anchors.board = new THREE.Vector3(6.4, 1.8, BACK + 0.2);
    this.anchors.exit = new THREE.Vector3(-9.2, 1.6, BACK + 0.2);
    this.anchors.window = new THREE.Vector3(-4.6, 1.9, BACK + 0.2);
    this.anchors.lockers = new THREE.Vector3(-1.6, 1.5, BACK + 0.5);
    this.anchors.trophy = new THREE.Vector3(-7.2, 1.5, BACK + 0.4);
    this.anchors.cafeDoor = new THREE.Vector3(10.2, 1.7, BACK + 0.2);
    this.doors = [{ id: 'cafeteria', label: 'Столовая', x: 10.2, z: -2.0, radius: 0.9, anchor: this.anchors.cafeDoor, to: 'cafeteria', spawn: { x: -8.0, z: -1.4, facing: 1 } }];
    this.spots = {
      runLanes: [{ z: -0.2, minX: -9, maxX: 10.5 }, { z: -1.9, minX: -9, maxX: 10.5 }],
      crossCorridor: { x: 1.5, zFar: -14, zNear: -2.6 },   // students walk the cross corridor into the depth
    };
    // ---- foreground: a tiled pillar (fades when it covers someone)
    const fg = new THREE.Group(); fg.name = 'fg-pillar'; root.add(fg); this.foregroundGroups.push(fg);
    const pt = tileTex().clone(); pt.needsUpdate = true; pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(0.5, H / 1.2);
    const pillar = new THREE.Mesh(roundedBox(0.5, H, 0.5, 0.04), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.3 })); pillar.position.set(-3.0, H / 2, 2.4); fg.add(pillar);
    // ---- light: cool daylight from the window and the door, warm-white panels
    const hemi = new THREE.HemisphereLight(0xf0f4fa, 0xc4bcae, 1.05);
    // a soft key from the front-left so the dark outfits separate from the cork board and the lockers
    const rim = new THREE.DirectionalLight(0xfff0dc, 0.55); rim.position.set(-4, 3, 6); root.add(rim);
    const sun = new THREE.DirectionalLight(0xeef2ff, 0.6); sun.position.set(-4, 4, -6);
    root.add(hemi, sun);
    this.lights = { hemi, sun };
    this.windowLights = [
      flareSource('PALE', new THREE.Vector3(-4.6, 2.1, BACK - 0.1), { triggerDistance: 2.6 }),
      flareSource('PALE', new THREE.Vector3(-9.2, 1.6, BACK), { triggerDistance: 2.0, intensity: 0.45, flareSize: 0.6 }),
      flareSource('LAMP', new THREE.Vector3(10.2, 1.7, BACK - 0.2), { triggerDistance: 1.6, fadeDistance: 1.4, intensity: 0.35, flareSize: 0.5 }),
    ];
    return root;
  }

  /** A row of red lockers between x0 and x1 (0.4 m each), with a base and a top trim. */
  lockers(x0, x1, z, dir = 1) {
    const root = this.root;
    const doorMs = Array.from({ length: 6 }, (_, v) => this.mat(`lockerDoor2-${v}`, { map: lockerTex(v), color: 0xffffff, roughness: 0.32, metalness: 0.35 }));
    const bodyM = this.mat('lockerBody3', { color: 0x2a0606, roughness: 0.5, metalness: 0.3 });
    const capM = this.mat('lockerCap', { color: 0x9a1614, roughness: 0.35, metalness: 0.35 });
    const n = Math.floor((x1 - x0) / 0.4);
    const body = new THREE.Mesh(roundedBox(n * 0.4 + 0.04, 1.9, 0.44, 0.02, 1), bodyM);
    body.position.set(x0 + n * 0.2, 0.95 + 0.1, z); root.add(body);
    const doorGeo = roundedBox(0.37, 1.84, 0.02, 0.008, 1);
    for (let i = 0; i < n; i++) {
      const k = Math.round((x0 + i * 0.4) * 2.5 + 40);
      const d = new THREE.Mesh(doorGeo, doorMs[((k % 6) + 6) % 6]);
      d.position.set(x0 + 0.2 + i * 0.4, 1.05, z + dir * 0.225); root.add(d);
    }
    const base = this.mat('lockerBase', { color: 0x2a1a14, roughness: 0.6 });
    this.box(n * 0.4 + 0.02, 0.1, 0.38, base, x0 + n * 0.2, 0.05, z - 0.03);                 // recessed plinth
    const cap = new THREE.Mesh(roundedBox(n * 0.4 + 0.06, 0.05, 0.5, 0.015), capM); cap.position.set(x0 + n * 0.2, 2.03, z); cap.rotation.x = -0.12; this.root.add(cap);   // sloped top
    for (const ex of [x0 - 0.01, x0 + n * 0.4 + 0.01]) { const side = new THREE.Mesh(roundedBox(0.03, 1.92, 0.46, 0.01), capM); side.position.set(ex, 1.06, z); this.root.add(side); }
  }

  /** Oak classroom door in a steel frame: a tall narrow window, kick plate, lever handle, number. */
  classDoor(x, z, num) {
    const root = this.root;
    const frame = this.mat('classFrame', { color: 0x6a6e74, roughness: 0.4, metalness: 0.5 });
    for (const [w, h, dx, y] of [[1.12, 0.07, 0, 2.235], [0.06, 2.2, -0.53, 1.1], [0.06, 2.2, 0.53, 1.1]]) { const m = new THREE.Mesh(roundedBox(w, h, 0.16, 0.015, 1), frame); m.position.set(x + dx, y, z + 0.02); root.add(m); }
    const leaf = new THREE.Mesh(roundedBox(0.98, 2.16, 0.05, 0.01, 1), this.mat('oakDoor', { map: oakTex(), color: 0xffffff, roughness: 0.35 }));
    leaf.position.set(x, 1.08, z - 0.02); root.add(leaf);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0x9aa8b4, roughness: 0.05, metalness: 0.4, emissive: 0x202830 }));
    win.position.set(x + 0.28, 1.5, z + 0.006); root.add(win);
    const kick = new THREE.Mesh(roundedBox(0.94, 0.22, 0.01, 0.004, 1), this.mat('kick', { color: 0xb8bcc0, metalness: 0.8, roughness: 0.3 })); kick.position.set(x, 0.13, z + 0.008); root.add(kick);
    const lever = new THREE.Mesh(roundedBox(0.14, 0.025, 0.025, 0.01, 1), this.mats.cache.get('kick')); lever.position.set(x - 0.36, 1.0, z + 0.05); root.add(lever);
    for (const hy of [0.3, 1.1, 1.9]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 12), this.mats.cache.get('kick')); hg.position.set(x + 0.5, hy, z + 0.03); root.add(hg); }
    const sign = this.textSign(num, { w: 0.22, h: 0.12, bg: '#2a2a2a', fg: '#f2f2f2', font: 'bold 60px sans-serif' }); sign.position.set(x + 0.68, 1.75, z + 0.02); this.root.add(sign);
  }

  /**
   * Double doors to the cafeteria at x: oak leaves with tall wired-glass panes (warm light and the
   * dining hall behind), push bars, kick plates, a sign over them; the corridor ends in a tiled wall.
   */
  cafeDoor(x, z, tileM, band, cove) {
    const root = this.root;
    const frame = this.mat('classFrame', { color: 0x6a6e74, roughness: 0.4, metalness: 0.5 });
    for (const [w, h, dx, y] of [[1.96, 0.08, 0, 2.44], [0.08, 2.44, -0.94, 1.22], [0.08, 2.44, 0.94, 1.22]]) { const m = new THREE.Mesh(roundedBox(w, h, 0.18, 0.015, 1), frame); m.position.set(x + dx, y, z + 0.02); root.add(m); }
    const oak = this.mat('oakDoor', { map: oakTex(), color: 0xffffff, roughness: 0.35 });
    const kickM = this.mat('kick', { color: 0xb8bcc0, metalness: 0.8, roughness: 0.3 });
    const glassM = new THREE.MeshBasicMaterial({ map: cafeGlimpseTex(), color: 0xf0e2c8 });
    for (const s of [-1, 1]) {
      const cx = x + s * 0.45;
      const leaf = new THREE.Mesh(roundedBox(0.88, 2.38, 0.05, 0.01, 1), oak); leaf.position.set(cx, 1.19, z - 0.02); root.add(leaf);
      const gf = new THREE.Mesh(roundedBox(0.46, 1.12, 0.02, 0.008, 1), frame); gf.position.set(cx, 1.6, z + 0.01); root.add(gf);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.06), glassM); gl.position.set(cx, 1.6, z + 0.022); root.add(gl);
      const kick = new THREE.Mesh(roundedBox(0.84, 0.22, 0.01, 0.004, 1), kickM); kick.position.set(cx, 0.13, z + 0.01); root.add(kick);
      const bar = new THREE.Mesh(roundedBox(0.64, 0.05, 0.06, 0.02, 1), kickM); bar.position.set(cx, 1.0, z + 0.05); root.add(bar);
    }
    const sign = this.textSign('СТОЛОВАЯ · CAFETERIA', { w: 1.5, h: 0.22, bg: '#5a0e0e', fg: '#f2d860', font: 'bold 40px sans-serif' });
    sign.position.set(x, 2.78, z + 0.03); root.add(sign);
    const warm = glow(0xffc880, 1.6, 0.2); warm.position.set(x, 1.6, z + 0.3); root.add(warm);
    const l = new THREE.PointLight(0xffd8a0, 1.6, 4, 1.6); l.position.set(x, 1.6, z + 0.6); root.add(l);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4), new THREE.MeshBasicMaterial({ map: smearTex(), color: 0xffb060, transparent: true, opacity: this.low ? 0.35 : 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.004, z + 0.75); root.add(m);
    // a fire extinguisher cabinet beside the doors
    const cab = new THREE.Mesh(roundedBox(0.36, 0.7, 0.12, 0.02, 1), this.mat('extCab', { color: 0xd8d4cc, roughness: 0.4, metalness: 0.3 })); cab.position.set(11.75, 1.3, z + 0.06); root.add(cab);
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 16), this.mat('extRed', { color: 0xc01818, roughness: 0.35 })); ext.position.set(11.75, 1.28, z + 0.1); root.add(ext);
    // the corridor's end wall (tile, band, cove), seen side-on at the right edge
    const D = 3.2 - z;
    const et = tileM.map.clone(); et.needsUpdate = true; et.repeat.set(D / 1.2, H / 1.2);
    const end = new THREE.Mesh(new THREE.PlaneGeometry(D, H), new THREE.MeshStandardMaterial({ map: et, roughness: 0.25 }));
    end.position.set(12.8, H / 2, z + D / 2); end.rotation.y = -Math.PI / 2; root.add(end);
    const bt = band.map.clone(); bt.needsUpdate = true; bt.repeat.set(D / 1.2, 1);
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(D, 0.15), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.3 }));
    bm.position.set(12.79, 2.35, z + D / 2); bm.rotation.y = -Math.PI / 2; root.add(bm);
    this.box(0.03, 0.14, D, cove, 12.785, 0.07, z + D / 2);
  }

  radiator(x, z) {
    const m = this.mat('radiator', { color: 0xd8d4c8, roughness: 0.5, metalness: 0.3 });
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) { const f = new THREE.Mesh(roundedBox(0.06, 0.6, 0.1, 0.02, 1), m); f.position.set(-0.6 + i * 0.092, 0.55, 0); g.add(f); }
    g.position.set(x, 0, z); this.root.add(g);
    return g;
  }

  /** The corridor that runs into the depth behind the opening: lockers both sides, panels, a far door. */
  buildCross(tileM, band, cove, ceilM, panelM) {
    const root = this.root;
    const X0 = 0.4, X1 = 2.6, Z0 = BACK, Z1 = BACK - 30;
    const L = Z0 - Z1, cz = (Z0 + Z1) / 2;
    for (const [x, ry] of [[X0, Math.PI / 2], [X1, -Math.PI / 2]]) {
      const tt = tileM.map.clone(); tt.needsUpdate = true; tt.repeat.set(L / 1.2, H / 1.2);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshStandardMaterial({ map: tt, roughness: 0.25 }));
      w.position.set(x, H / 2, cz); w.rotation.y = ry; root.add(w);
      // lockers along both walls (seen in steep perspective)
      const doorM = this.mat('lockerDoor2-0', { map: lockerTex(0), color: 0xffffff, roughness: 0.32, metalness: 0.35 });
      for (let k = 0; k < 66; k++) {
        const zz = Z0 - 0.6 - k * 0.4;
        if ((k > 9 && k < 13) || (k > 39 && k < 43)) continue;     // classroom doors on each side
        const d = new THREE.Mesh(roundedBox(0.37, 1.84, 0.4, 0.01, 1), doorM);
        d.position.set(x + (ry > 0 ? 0.21 : -0.21), 1.05, zz); d.rotation.y = ry; root.add(d);
      }
      const leaf = new THREE.Mesh(roundedBox(1.0, 2.16, 0.05, 0.01, 1), this.mat('oakDoor', { map: oakTex(), color: 0xffffff, roughness: 0.35 })); leaf.position.set(x + (ry > 0 ? 0.03 : -0.03), 1.08, Z0 - 0.6 - 11 * 0.4); leaf.rotation.y = ry; root.add(leaf);
    }
    // ceiling, panels and their lights, the far wall with double doors and lockers
    const ct = ceilM.map.clone(); ct.needsUpdate = true; ct.repeat.set((X1 - X0) / 0.6, L / 0.6);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, L), new THREE.MeshStandardMaterial({ map: ct, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set((X0 + X1) / 2, H, cz); root.add(ceil);
    for (let k = 0; k < 10; k++) {
      const z = Z0 - 1.8 - k * 3.0;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), panelM); p.rotation.x = Math.PI / 2; p.position.set((X0 + X1) / 2, H - 0.005, z); root.add(p);
      if (k % 2 === 0) { const l = new THREE.PointLight(0xfff4e0, 1.6, 5, 1.6); l.position.set((X0 + X1) / 2, H - 0.3, z); root.add(l); }
    }
    const end = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, H), tileM); end.position.set((X0 + X1) / 2, H / 2, Z1); root.add(end);
    const dd = new THREE.Mesh(roundedBox(1.4, 2.2, 0.05, 0.01, 1), this.mat('farDoors', { color: 0x9a1a18, roughness: 0.4, metalness: 0.3 })); dd.position.set((X0 + X1) / 2, 1.1, Z1 + 0.03); root.add(dd);
    const seam = this.mat('farSeam', { color: 0x2a0a0a }); this.box(0.02, 2.2, 0.06, seam, (X0 + X1) / 2, 1.1, Z1 + 0.04);
    // the far end is brighter: a window over the doors
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xe8ecf0 })); win.position.set((X0 + X1) / 2, 2.6, Z1 + 0.02); root.add(win);
    const exit = this.textSign('EXIT', { w: 0.42, h: 0.16, bg: '#1a0a0a', fg: '#ff3a2a', font: 'bold 80px sans-serif' }); exit.position.set((X0 + X1) / 2, 2.32, Z1 + 0.05); root.add(exit);
    const g = glow(0xff4030, 0.5, 0.25); g.position.set((X0 + X1) / 2, 2.32, Z1 + 0.1); root.add(g);
    void band; void cove;
  }
}
