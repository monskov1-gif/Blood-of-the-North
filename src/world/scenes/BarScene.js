import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  panelTexture, plankTexture, damaskTexture, leopardTexture, rugTexture, ceilingTexture,
  paintingTexture, streetTexture, beamTexture, newspaperTexture, canvasTexture,
} from '../../render/textures.js';
import {
  MaterialLib, bistroTable, bentwoodChair, barStool, candle, wineGlass, tumbler, bottleRow,
  chandelier, sconce, tableLamp, garland, frame, glow, lightPool,
} from '../props.js';
import { Dust, Snow } from '../Particles.js';

/**
 * "Northern Rose" — the bar on the outskirts of Whitehorse.
 *
 * Coordinate system (metres): x runs along the room (left → right on screen),
 * z is depth (back wall at z = -5, camera at z ≈ +11.5), y is up.
 * 1 sprite pixel = 1 cm, so a 180px character is 1.8 m tall.
 *
 * Layout, left → right:
 *   x -14 … -7   entrance: door, coat rack, window to the snowy street, jukebox
 *   x  -7 …  5   the bar: counter, stools, arched back bar, TV, moose trophy
 *   x   5 …  6   service door
 *   x   6 … 14   lounge: banquette, mirrors, gallery wall, Owen's dim corner
 * Front (z ≈ 2.6 … 3.6): foreground tables and chairs that overlap characters.
 */

const BACK = -5;
const X0 = -14, X1 = 14;
const CEIL = 4.4;
const WIN = { x: -8.95, w: 2.3, h: 2.0, sill: 1.25 };

const FloorReflectionShader = {
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.32 },
    uTime: { value: 0 },
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
      // vertical smear: polished wood stretches reflections
      vec3 c = vec3(0.0);
      float wsum = 0.0;
      for (int i = -4; i <= 4; i++) {
        float fi = float(i);
        float w = 1.0 - abs(fi) / 5.0;
        c += texture2D(tDiffuse, uv + vec2(fi * 0.0012, fi * 0.006)).rgb * w;
        wsum += w;
      }
      c /= wsum;
      // plank seams break the reflection
      float seam = smoothstep(0.0, 0.03, abs(fract(vWorld.z * 0.5 + 0.5) - 0.5));
      float fade = smoothstep(-5.0, -1.0, vWorld.z) * 0.6 + 0.4;
      gl_FragColor = vec4(c * uStrength * seam * fade, 1.0);
    }`,
};

export class BarScene {
  constructor({ renderer, bus, quality }) {
    this.id = 'bar';
    this.renderer = renderer;
    this.bus = bus;
    this.low = quality === 'low';
    this.mats = new MaterialLib(this.low);
    this.root = new THREE.Group();
    this.animated = [];
    this.flickers = [];
    this.lights = {};
    this.time = 0;
    this.title = 'Бар «Северная Роза»';

    this.bounds = {
      walk: { minX: -13.2, maxX: 13.3, minZ: -2.3, maxZ: 1.9 },
      camera: { minX: -8.6, maxX: 9.2 },
    };
    this.colliders = [];
    this.spawns = { player: { x: -11.6, z: 0.9, facing: 1 } };
    this.anchors = {};
  }

  build() {
    const r = this.root;
    this.buildShell();
    this.buildEntrance();
    this.buildBar();
    this.buildLounge();
    this.buildForeground();
    this.buildMidTables();
    this.buildLighting();
    this.buildAtmosphere();
    r.traverse((o) => { if (o.isMesh) o.matrixAutoUpdate = true; });
    return r;
  }

  // ---------------------------------------------------------------- shell

  buildShell() {
    const m = this.mats;
    const floorMat = m.get('floor', { map: plankTexture(), color: 0xb08870, roughness: 0.35, metalness: 0.0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 2, 13), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1.5);
    this.root.add(floor);

    if (!this.low) {
      // additive planar reflection on top of the lit floor
      const refl = new Reflector(new THREE.PlaneGeometry(X1 - X0 + 2, 11.5), {
        textureWidth: Math.floor(window.innerWidth * 0.5),
        textureHeight: Math.floor(window.innerHeight * 0.5),
        shader: FloorReflectionShader,
        clipBias: 0.003,
      });
      refl.material.transparent = true;
      refl.material.blending = THREE.AdditiveBlending;
      refl.material.depthWrite = false;
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(0, 0.002, 0.75);
      refl.renderOrder = 1;
      this.root.add(refl);
      this.floorReflector = refl;
    }

    // back wall: damask + wainscot + chair rail + crown
    const wallTex = damaskTexture().clone();
    wallTex.needsUpdate = true;
    wallTex.repeat.set(1.15, 1.15);
    const wallMat = m.get('damaskBack', { map: wallTex, color: 0xc8a8a0, roughness: 0.9 });
    const wallShape = new THREE.Shape();
    wallShape.moveTo(X0, 0); wallShape.lineTo(X1, 0); wallShape.lineTo(X1, CEIL); wallShape.lineTo(X0, CEIL); wallShape.lineTo(X0, 0);
    const hole = new THREE.Path();
    hole.moveTo(WIN.x - WIN.w / 2, WIN.sill); hole.lineTo(WIN.x - WIN.w / 2, WIN.sill + WIN.h);
    hole.lineTo(WIN.x + WIN.w / 2, WIN.sill + WIN.h); hole.lineTo(WIN.x + WIN.w / 2, WIN.sill); hole.lineTo(WIN.x - WIN.w / 2, WIN.sill);
    wallShape.holes.push(hole);
    const wall = new THREE.Mesh(new THREE.ShapeGeometry(wallShape), wallMat);
    wall.position.set(0, 0, BACK);
    this.root.add(wall);
    const sideTex = damaskTexture().clone();
    sideTex.needsUpdate = true;
    sideTex.repeat.set(7, 2.2);
    const sideMat = m.get('damaskSide', { map: sideTex, color: 0xa88880, roughness: 0.9 });

    const panelTex = panelTexture().clone();
    panelTex.needsUpdate = true;
    panelTex.repeat.set(24, 1);
    const panelMat = m.get('panel', { map: panelTex, roughness: 0.4 });
    const wains = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 1.15, 0.06), panelMat);
    wains.position.set(0, 0.575, BACK + 0.03);
    this.root.add(wains);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.08, 0.1), m.woodPolished());
    rail.position.set(0, 1.18, BACK + 0.05);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.22, 0.2), m.woodDark());
    crown.position.set(0, CEIL - 0.11, BACK + 0.1);
    const skirting = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, 0.14, 0.09), m.woodDark());
    skirting.position.set(0, 0.07, BACK + 0.07);
    this.root.add(rail, crown, skirting);

    // side walls (seen in perspective at the ends)
    for (const x of [X0, X1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(14, CEIL), sideMat);
      side.position.set(x, CEIL / 2, 2);
      side.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(14, 1.15, 0.06), panelMat);
      sw.position.set(x + (x < 0 ? 0.03 : -0.03), 0.575, 2);
      sw.rotation.y = side.rotation.y;
      this.root.add(side, sw);
    }

    // lacquered red ceiling with dark beams
    const ceilMat = m.get('ceiling', { map: ceilingTexture(), color: 0xffffff, roughness: 0.25, metalness: 0.1 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0, 14), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, CEIL, 2);
    this.root.add(ceil);
    for (let x = X0 + 2; x < X1; x += 3.2) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 14), m.woodDark());
      beam.position.set(x, CEIL - 0.15, 2);
      this.root.add(beam);
    }

    // pilasters separating the zones
    for (const x of [-7, 6.1]) this.pilaster(x);
  }

  pilaster(x) {
    const m = this.mats;
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, CEIL, 0.3), m.wood());
    col.position.set(x, CEIL / 2, BACK + 0.15);
    const flutes = new THREE.Mesh(new THREE.BoxGeometry(0.34, CEIL - 0.9, 0.04), m.woodDark());
    flutes.position.set(x, CEIL / 2, BACK + 0.31);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.22, 0.42), m.get('giltCap', { color: 0x6a4a1c, metalness: 0.6, roughness: 0.4 }));
    cap.position.set(x, CEIL - 0.45, BACK + 0.2);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.4), m.woodDark());
    base.position.set(x, 0.15, BACK + 0.2);
    this.root.add(col, flutes, cap, base);
  }

  // ---------------------------------------------------------------- entrance

  buildEntrance() {
    const m = this.mats;
    const root = this.root;

    // front door with frosted panes
    const doorX = -12.2;
    const frameMat = m.woodDark();
    const doorFrame = new THREE.Group();
    for (const [w, h, x, y] of [[1.5, 0.16, 0, 2.5], [0.14, 2.5, -0.7, 1.25], [0.14, 2.5, 0.7, 1.25]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), frameMat);
      b.position.set(x, y, 0);
      doorFrame.add(b);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.26, 2.42, 0.06), m.wood());
    door.position.set(0, 1.21, -0.02);
    const paneMat = m.get('coldPane', { color: 0x0, emissive: 0x6f8fc0, emissiveIntensity: 0.7, roughness: 0.2 });
    for (const [x, y] of [[-0.28, 1.85], [0.28, 1.85], [-0.28, 1.25], [0.28, 1.25]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), paneMat);
      p.position.set(x, y, 0.02);
      doorFrame.add(p);
    }
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), m.brass());
    handle.position.set(0.5, 1.05, 0.06);
    const transom = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), paneMat);
    transom.position.set(0, 2.72, -0.03);
    doorFrame.add(door, handle, transom);
    doorFrame.position.set(doorX, 0, BACK + 0.11);
    root.add(doorFrame);
    const doorGlow = lightPool(0x7fa0d8, 2.4, 1.6, 0.18);
    doorGlow.rotation.x = -Math.PI / 2;
    doorGlow.position.set(doorX, 0.01, BACK + 1.0);
    root.add(doorGlow);
    this.anchors.door = new THREE.Vector3(doorX, 1.5, BACK + 0.2);

    // old photographs by the door
    const photo = frame(m, 0.62, 0.78, paintingTexture('photo', 1), { gold: false, border: 0.05 });
    photo.position.set(-13.35, 1.95, BACK + 0.01);
    root.add(photo);
    const photo2 = frame(m, 0.4, 0.5, paintingTexture('photo', 2), { gold: false, border: 0.04 });
    photo2.position.set(-13.4, 2.95, BACK + 0.01);
    root.add(photo2);
    this.anchors.photo = new THREE.Vector3(-13.35, 1.95, BACK + 0.1);

    // coat rack with parkas
    const rack = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 8), m.woodDark());
    pole.position.y = 0.95;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 12), m.woodDark());
    rack.add(pole, foot);
    const coatCols = [0x1b2230, 0x3a2a1e, 0x2a2a26];
    coatCols.forEach((c, i) => {
      const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 10), m.get(`coat-${c}`, { color: c, roughness: 1 }));
      const a = (i / 3) * Math.PI * 2 + 0.4;
      coat.position.set(Math.cos(a) * 0.17, 1.35, Math.sin(a) * 0.12);
      coat.scale.set(1, 1, 0.6);
      rack.add(coat);
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.05, 6, 12), m.get('fur', { color: 0x8a7a64, roughness: 1 }));
      hood.position.set(coat.position.x, 1.82, coat.position.z);
      hood.rotation.x = Math.PI / 2;
      if (i === 0) rack.add(hood);
    });
    rack.position.set(-10.7, 0, BACK + 0.45);
    root.add(rack);
    this.anchors.coats = new THREE.Vector3(-10.7, 1.4, BACK + 0.45);

    // window with the snowy street outside
    const winX = WIN.x, winW = WIN.w, winH = WIN.h, sill = WIN.sill;
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.2), new THREE.MeshBasicMaterial({ map: streetTexture(), color: 0x9fb4d8 }));
    outside.position.set(winX, sill + winH / 2 + 0.1, BACK - 1.4);
    root.add(outside);
    // wall cut: build the wall around the window opening as a dark reveal
    const reveal = m.get('reveal', { color: 0x140806, roughness: 0.8 });
    const sillReveal = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, 0.5), reveal);
    sillReveal.position.set(winX, sill, BACK - 0.25);
    root.add(sillReveal);
    const sides = [[winX - winW / 2, 0], [winX + winW / 2, 0]];
    sides.forEach(([x]) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, 0.5), reveal);
      s.position.set(x, sill + winH / 2, BACK - 0.25);
      root.add(s);
    });
    const topR = new THREE.Mesh(new THREE.BoxGeometry(winW, 0.06, 0.5), reveal);
    topR.position.set(winX, sill + winH, BACK - 0.25);
    root.add(topR);
    // mullions
    const mull = m.woodDark();
    for (const dx of [-winW / 2, -winW / 6, winW / 6, winW / 2]) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, winH, 0.08), mull);
      v.position.set(winX + dx, sill + winH / 2, BACK + 0.02);
      root.add(v);
    }
    for (const dy of [0, winH * 0.55, winH]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.1, 0.06, 0.08), mull);
      h.position.set(winX, sill + dy, BACK + 0.02);
      root.add(h);
    }
    const sillBoard = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.3, 0.05, 0.28), m.woodPolished());
    sillBoard.position.set(winX, sill, BACK + 0.12);
    root.add(sillBoard);
    // frost on the glass
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({
      map: canvasTexture('frost', 256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
        g.addColorStop(0, 'rgba(200,220,255,0)'); g.addColorStop(1, 'rgba(210,225,255,0.55)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }, { color: false }),
      transparent: true, depthWrite: false, opacity: 0.8,
    }));
    frost.position.set(winX, sill + winH / 2, BACK + 0.005);
    root.add(frost);
    // heavy velvet curtains
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.7, 3.0, 24, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 26) * 0.05);
      geo.computeVertexNormals();
      const c = new THREE.Mesh(geo, m.get('curtain', { color: 0x5a0c12, roughness: 0.9, side: THREE.DoubleSide }));
      c.position.set(winX + side * (winW / 2 + 0.2), 1.5 + 0.55, BACK + 0.12);
      root.add(c);
    }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, winW + 1.4, 8), m.brass());
    rod.rotation.z = Math.PI / 2; rod.position.set(winX, 3.55, BACK + 0.14);
    root.add(rod);
    this.anchors.window = new THREE.Vector3(winX, 1.9, BACK + 0.1);
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(winX - 1.6, sill - 0.3, BACK - 1.3), new THREE.Vector3(winX + 1.6, sill + winH + 0.4, BACK - 0.3)), this.low ? 250 : 500);
    root.add(this.snow.points);
    this.animated.push(this.snow);

    // cold light shafts from the window
    const beamMat = new THREE.MeshBasicMaterial({
      map: beamTexture(), color: 0x86a4d6, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 5), beamMat);
      b.position.set(winX - 0.6 + i * 0.6, 1.25, BACK + 1.8);
      b.rotation.set(-1.0, 0, 0.12 - i * 0.05);
      root.add(b);
    }
    this.beamMat = beamMat;
    const pool = lightPool(0x7f9dd6, 3.0, 2.2, 0.1);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(winX + 0.2, 0.012, BACK + 3.0);
    root.add(pool);

    // jukebox
    const jb = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.45, 0); shape.lineTo(0.45, 0); shape.lineTo(0.45, 1.05);
    shape.absarc(0, 1.05, 0.45, 0, Math.PI, false); shape.lineTo(-0.45, 0);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.55, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), m.woodPolished());
    const tubeMat = m.get('jukeTube', { color: 0x000000, emissive: 0xff7a2a, emissiveIntensity: 2.4 });
    const arcCurve = new THREE.EllipseCurve(0, 1.05, 0.38, 0.38, 0, Math.PI);
    const arcPts = arcCurve.getPoints(30).map((p) => new THREE.Vector3(p.x, p.y, 0.6));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.38, 0.3, 0.6), ...arcPts, new THREE.Vector3(-0.38, 0.3, 0.6)]), 60, 0.025, 6), tubeMat);
    const grilleMat = m.get('jukeGrille', { color: 0x1b0b06, emissive: 0x7a2a0a, emissiveIntensity: 0.6 });
    const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), grilleMat);
    grille.position.set(0, 0.42, 0.59);
    const windowMat = m.get('jukeWindow', { color: 0x000000, emissive: 0xffd28a, emissiveIntensity: 1.2 });
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24, 0, Math.PI), windowMat);
    win.position.set(0, 1.0, 0.6);
    jb.add(body, tube, grille, win);
    const jglow = glow(0xff8a3a, 1.8, 0.35);
    jglow.position.set(0, 0.9, 0.7);
    jb.add(jglow);
    jb.position.set(-7.95, 0, BACK + 0.06);
    root.add(jb);
    this.jukebox = { tubeMat, windowMat, glow: jglow, hue: 0 };
    this.anchors.jukebox = new THREE.Vector3(-7.95, 1.2, BACK + 0.5);

    // wall sconces by the entrance
    for (const x of [-13.0, -10.7]) {
      const s = sconce(m, 0xb8644a);
      s.position.set(x, 2.45, BACK + 0.02);
      root.add(s);
    }
  }

  // ---------------------------------------------------------------- bar

  buildBar() {
    const m = this.mats;
    const root = this.root;
    const x0 = -6.2, x1 = 5.0;
    const len = x1 - x0, cx = (x0 + x1) / 2;
    const frontZ = -3.15, depth = 0.72;

    // counter body with panel texture
    const counterTex = panelTexture().clone();
    counterTex.needsUpdate = true;
    counterTex.repeat.set(len / 1.0, 1);
    const counterMat = m.get('counterFront', { map: counterTex, roughness: 0.4 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, depth), counterMat);
    counter.position.set(cx, 0.525, frontZ - depth / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.07, depth + 0.16), m.marble());
    top.position.set(cx, 1.09, frontZ - depth / 2 + 0.03);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(len + 0.24, 0.05, 0.08), m.woodPolished());
    lip.position.set(cx, 1.06, frontZ + 0.08);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), m.brass());
    rail.rotation.z = Math.PI / 2;
    rail.position.set(cx, 0.22, frontZ + 0.14);
    const led = new THREE.Mesh(new THREE.BoxGeometry(len, 0.015, 0.02), m.emissive(0xff2020, 3));
    led.position.set(cx, 1.0, frontZ + 0.03);
    root.add(counter, top, lip, rail, led);
    for (let x = x0 + 0.6; x < x1; x += 1.4) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), m.brass());
      bracket.position.set(x, 0.22, frontZ + 0.08);
      root.add(bracket);
    }
    const ledPool = lightPool(0xff2a2a, len, 0.9, 0.18);
    ledPool.rotation.x = -Math.PI / 2;
    ledPool.position.set(cx, 0.012, frontZ + 0.35);
    root.add(ledPool);

    // stools
    for (let i = 0; i < 7; i++) {
      const s = barStool(m);
      s.position.set(x0 + 0.85 + i * 1.55, 0, frontZ + 0.42);
      root.add(s);
    }

    // glasses, taps, register on the counter
    for (let i = 0; i < 6; i++) {
      const t = tumbler(m, i % 2 ? 0x8a4a14 : 0x5a2808);
      t.position.set(x0 + 1.0 + i * 1.7 + Math.random() * 0.3, 1.125, frontZ - 0.18);
      root.add(t);
    }
    for (let i = 0; i < 3; i++) {
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.32, 6), m.brass());
      tap.position.set(-1.6 + i * 0.16, 1.28, frontZ - 0.45);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), m.black());
      handle.position.set(-1.6 + i * 0.16, 1.5, frontZ - 0.45);
      root.add(tap, handle);
    }
    const register = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.35), m.brass());
    register.position.set(3.9, 1.29, frontZ - 0.4);
    const regTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.1), m.brass());
    regTop.position.set(3.9, 1.5, frontZ - 0.52);
    root.add(register, regTop);

    // newspaper on the counter end
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), m.get('newspaper', { map: newspaperTexture(), roughness: 0.9 }));
    paper.rotation.x = -Math.PI / 2; paper.rotation.z = 0.25;
    paper.position.set(4.45, 1.13, frontZ - 0.2);
    root.add(paper);
    this.anchors.newspaper = new THREE.Vector3(4.45, 1.2, frontZ - 0.2);

    // back bar: cabinet, shelves, arches, glowing back panel
    const bbZ = BACK + 0.25;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.95, 0.5), m.wood());
    cab.position.set(cx, 0.475, bbZ);
    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(len + 0.1, 0.05, 0.56), m.woodPolished());
    cabTop.position.set(cx, 0.97, bbZ);
    root.add(cab, cabTop);
    const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.4, 1.9), new THREE.MeshBasicMaterial({
      map: canvasTexture('backlight', 256, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, h, 0, 0);
        g.addColorStop(0, '#5a2a0a'); g.addColorStop(0.5, '#c8782a'); g.addColorStop(1, '#3a1606');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'multiply';
        const v = ctx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 4; i++) { v.addColorStop(i / 4, i % 1 === 0 ? '#ffffff' : '#ffffff'); }
        ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
      }), color: 0xffffff,
    }));
    backGlow.position.set(cx, 2.0, BACK + 0.02);
    root.add(backGlow);
    this.backGlowMat = backGlow.material;

    const shelfYs = [1.25, 1.75, 2.25];
    for (const y of shelfYs) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(len - 0.4, 0.04, 0.32), m.get('glassShelf', { color: 0x3a2a1a, roughness: 0.2, metalness: 0.3, emissive: 0x2a1404 }));
      shelf.position.set(cx, y, BACK + 0.2);
      root.add(shelf);
      const bottles = bottleRow(m, len - 0.6, Math.floor(y * 100));
      bottles.position.set(cx, y + 0.02, BACK + 0.2);
      root.add(bottles);
    }
    // arches over the back bar (three bays)
    const bays = 3, bayW = (len - 0.4) / bays;
    for (let i = 0; i < bays; i++) {
      const bx = x0 + 0.2 + bayW * (i + 0.5);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(bayW / 2 - 0.05, 0.09, 8, 40, Math.PI), m.wood());
      arch.position.set(bx, 2.75, BACK + 0.15);
      arch.scale.y = 0.6;
      root.add(arch);
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.16), m.get('giltCap', { color: 0x6a4a1c, metalness: 0.6, roughness: 0.4 }));
      key.position.set(bx, 2.75 + (bayW / 2) * 0.6, BACK + 0.2);
      root.add(key);
      if (i > 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.85, 0.2), m.wood());
        post.position.set(x0 + 0.2 + bayW * i, 1.9, BACK + 0.2);
        root.add(post);
      }
      // Christmas garland following the arch
      const pts = [];
      for (let k = 0; k <= 24; k++) {
        const a = Math.PI - (k / 24) * Math.PI;
        pts.push(new THREE.Vector3(bx + Math.cos(a) * (bayW / 2 - 0.05), 2.75 + Math.sin(a) * (bayW / 2) * 0.6, BACK + 0.32));
      }
      root.add(garland(m, new THREE.CatmullRomCurve3(pts), this.low ? 24 : 46));
    }
    const entab = new THREE.Mesh(new THREE.BoxGeometry(len + 0.3, 0.32, 0.36), m.woodDark());
    entab.position.set(cx, 3.95, BACK + 0.18);
    root.add(entab);
    for (const sx of [x0 - 0.05, x1 + 0.05]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, 0.4), m.wood());
      end.position.set(sx, 2.45, BACK + 0.2);
      root.add(end);
    }

    // moose trophy above the middle bay — Yukon touch
    const moose = this.buildMoose();
    moose.position.set(-0.6 + 1.6, 3.55, BACK + 0.25);
    root.add(moose);
    this.anchors.moose = new THREE.Vector3(1.0, 3.5, BACK + 0.5);

    // old CRT television on a bracket, showing the local news
    const tv = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.5), m.get('tvBody', { color: 0x221a14, roughness: 0.5 }));
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 256; tvCanvas.height = 192;
    const tvTex = new THREE.CanvasTexture(tvCanvas);
    tvTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tvTex, color: 0xd8e0ff }));
    screen.position.z = 0.252;
    const tvGlow = glow(0x9ab0ff, 1.6, 0.28);
    tvGlow.position.z = 0.35;
    tv.add(box, screen, tvGlow);
    tv.position.set(-5.55, 3.15, BACK + 0.9);
    tv.rotation.set(0.18, 0.25, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), m.black());
    arm.position.set(-5.55, 3.45, BACK + 0.35);
    root.add(tv, arm);
    this.tv = { canvas: tvCanvas, ctx: tvCanvas.getContext('2d'), tex: tvTex, t: 0, glow: tvGlow };
    this.anchors.tv = new THREE.Vector3(-5.55, 3.15, BACK + 0.9);

    // service door between bar and lounge
    const sd = new THREE.Group();
    const sdoor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 2.2, 0.06), m.woodDark());
    sdoor.position.y = 1.1;
    const porthole = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), m.get('porthole', { color: 0, emissive: 0xffc890, emissiveIntensity: 0.9 }));
    porthole.position.set(0, 1.55, 0.035);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 20), m.brass());
    ring.position.set(0, 1.55, 0.04);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.01), m.brass());
    kick.position.set(0, 0.13, 0.035);
    sd.add(sdoor, porthole, ring, kick);
    sd.position.set(5.55, 0, BACK + 0.04);
    root.add(sd);
    const sdSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.12), m.get('staffSign', {
      map: canvasTexture('staff', 256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#1a120c'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a07a3a'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = '#c8a060'; ctx.font = 'bold 26px serif'; ctx.textAlign = 'center'; ctx.fillText('STAFF ONLY', w / 2, 42);
      }),
    }));
    sdSign.position.set(5.55, 2.4, BACK + 0.08);
    root.add(sdSign);
    this.anchors.serviceDoor = new THREE.Vector3(5.55, 1.5, BACK + 0.2);
    this.anchors.bartenderSpot = new THREE.Vector3(-2.6, 0, -4.2);
    this.anchors.pickup = new THREE.Vector3(3.1, 0, -2.45);

    // colliders: counter front edge (stools)
    for (let x = x0 + 0.85; x < x1; x += 1.55) this.colliders.push({ x, z: frontZ + 0.42, r: 0.24 });
  }

  buildMoose() {
    const m = this.mats;
    const g = new THREE.Group();
    const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 6), m.woodPolished());
    plaque.rotation.x = Math.PI / 2;
    plaque.scale.set(0.8, 1, 1.2);
    const fur = m.get('mooseFur', { color: 0x3a2617, roughness: 1 });
    const neck = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), fur);
    neck.scale.set(1, 1.1, 0.9); neck.position.set(0, -0.05, 0.2);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), fur);
    head.scale.set(0.9, 1.0, 1.5); head.position.set(0, -0.1, 0.48);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), m.get('mooseNose', { color: 0x2a1a10, roughness: 1 }));
    snout.scale.set(0.9, 0.9, 1.3); snout.position.set(0, -0.2, 0.72);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 8), fur);
    bell.position.set(0, -0.42, 0.42); bell.rotation.x = Math.PI;
    g.add(plaque, neck, head, snout, bell);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), m.get('eye', { color: 0x050505, roughness: 0.1, metalness: 0.3 }));
      eye.position.set(s * 0.15, -0.02, 0.56);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), fur);
      ear.position.set(s * 0.2, 0.12, 0.42); ear.rotation.z = -s * 1.1;
      // palmate antler
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.25, 0.05, 0.45, 0.18);
      for (let i = 0; i < 5; i++) {
        const a = 0.45 + i * 0.1;
        shape.lineTo(a, 0.32 + (i % 2) * 0.08);
        shape.lineTo(a + 0.05, 0.22);
      }
      shape.lineTo(0.75, 0.05);
      shape.quadraticCurveTo(0.4, -0.05, 0, -0.04);
      const antler = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }), m.get('antler', { color: 0xb8a07a, roughness: 0.7 }));
      antler.scale.set(s, 1, 1);
      antler.position.set(s * 0.15, 0.12, 0.35);
      antler.rotation.set(-0.2, -s * 0.5, s * 0.15);
      g.add(eye, ear, antler);
    }
    return g;
  }

  // ---------------------------------------------------------------- lounge

  buildLounge() {
    const m = this.mats;
    const root = this.root;
    const lx0 = 6.4, lx1 = 13.8;
    const lw = lx1 - lx0, lcx = (lx0 + lx1) / 2;

    // leopard wallpaper above the wainscot (ref 06)
    const leo = leopardTexture();
    leo.repeat.set(lw / 1.5, 2);
    const wallLeo = new THREE.Mesh(new THREE.PlaneGeometry(lw, CEIL - 1.22 - 0.22), m.get('leopard', { map: leo, color: 0xb09070, roughness: 0.9 }));
    wallLeo.position.set(lcx, 1.22 + (CEIL - 1.44) / 2, BACK + 0.004);
    root.add(wallLeo);

    // banquette with tufted back
    const seat = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.2, 0.45, 0.62), m.velvet());
    seat.position.set(lcx, 0.225, BACK + 0.62);
    const backGeo = new THREE.BoxGeometry(lw - 0.2, 0.75, 0.2, 40, 6, 1);
    const pos = backGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getZ(i) > 0) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setZ(i, pos.getZ(i) + Math.abs(Math.sin(x * 6) * Math.sin(y * 9)) * 0.05);
      }
    }
    backGeo.computeVertexNormals();
    const back = new THREE.Mesh(backGeo, m.velvetDark());
    back.position.set(lcx, 0.85, BACK + 0.24);
    const piping = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, lw - 0.2, 8), m.velvet());
    piping.rotation.z = Math.PI / 2; piping.position.set(lcx, 1.24, BACK + 0.28);
    root.add(seat, back, piping);
    this.colliders.push({ x: lcx, z: BACK + 0.62, r: 0.1, box: { minX: lx0, maxX: lx1, minZ: BACK, maxZ: BACK + 1.0 } });

    // small tables in front of the banquette
    for (const x of [7.6, 10.2, 12.8]) {
      const t = bistroTable(m, { radius: 0.3, height: 0.7 });
      t.position.set(x, 0, BACK + 1.35);
      root.add(t);
      const c = candle(m);
      c.position.set(x, 0.72, BACK + 1.35);
      root.add(c);
      this.flickers.push(c);
      const gl = wineGlass(m);
      gl.position.set(x + 0.12, 0.72, BACK + 1.3);
      root.add(gl);
    }

    // mirrors: a real one (Reflector) and a darker antique one
    this.buildMirror(11.55, 2.35, 1.3, 1.85, true);
    this.buildMirror(8.0, 2.35, 1.1, 1.6, false);

    // gallery wall around the mirrors
    const arts = [
      ['panther', 0.62, 0.46, 9.4, 3.15], ['portrait', 0.42, 0.55, 9.45, 2.25], ['landscape', 0.55, 0.42, 9.35, 1.62],
      ['river', 0.5, 0.62, 13.1, 2.7], ['portrait', 0.34, 0.44, 13.15, 1.75], ['landscape', 0.7, 0.5, 6.85, 3.25],
      ['panther', 0.38, 0.3, 10.5, 3.6], ['photo', 0.36, 0.46, 6.85, 2.3],
    ];
    arts.forEach(([kind, w, h, x, y], i) => {
      const f = frame(m, w, h, paintingTexture(kind, i + 3), { gold: i % 3 !== 1, border: 0.05 });
      f.position.set(x, y, BACK + 0.01);
      root.add(f);
    });
    this.anchors.gallery = new THREE.Vector3(9.4, 2.4, BACK + 0.1);

    // pleated sconces
    for (const x of [6.85, 10.45, 13.25]) {
      const s = sconce(m, 0xd77a72);
      s.position.set(x, 2.6, BACK + 0.02);
      if (x === 13.25) s.visible = true;
      root.add(s);
    }
    // table lamp on the bar end, fringed (ref 05)
    const lamp = tableLamp(m);
    lamp.position.set(-5.7, 1.12, -3.55);
    root.add(lamp);
    const lamp2 = tableLamp(m, 0x4a1010);
    lamp2.position.set(4.6, 1.12, -3.7);
    root.add(lamp2);
  }

  buildMirror(x, y, w, h, real) {
    const m = this.mats;
    const g = new THREE.Group();
    // arched frame: rectangle + half-torus top
    const fm = m.get('mirrorFrame', { color: 0x0e0b09, roughness: 0.4, metalness: 0.4 });
    const gilt = m.get('gilt', { color: 0x8a6428, roughness: 0.35, metalness: 0.8, emissive: 0x1a0e02 });
    const side = new THREE.BoxGeometry(0.1, h - w / 2, 0.08);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(side, fm);
      b.position.set(s * (w / 2 + 0.05), -w / 4, 0.04);
      g.add(b);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.02, h - w / 2, 0.09), gilt);
      gl.position.set(s * (w / 2 + 0.005), -w / 4, 0.045);
      g.add(gl);
    }
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.1, 0.08), fm);
    bottom.position.set(0, -h / 2 - 0.05, 0.04);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(w / 2 + 0.05, 0.05, 6, 30, Math.PI), fm);
    arc.position.set(0, h / 2 - w / 2, 0.04);
    g.add(bottom, arc);

    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2 - w / 2);
    shape.absarc(0, h / 2 - w / 2, w / 2, 0, Math.PI, false); shape.lineTo(-w / 2, -h / 2);
    const geo = new THREE.ShapeGeometry(shape, 24);
    if (real && !this.low) {
      const mirror = new Reflector(geo, {
        textureWidth: 512, textureHeight: 640, color: 0x8a7a6e, clipBias: 0.003,
      });
      mirror.position.z = 0.01;
      g.add(mirror);
      this.mirror = mirror;
      // a faint antique tarnish on top
      const tarnish = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: canvasTexture('tarnish', 256, 256, (ctx, ww, hh) => {
          const gr = ctx.createRadialGradient(ww / 2, hh / 2, ww * 0.2, ww / 2, hh / 2, ww * 0.7);
          gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(1, 'rgba(30,20,12,0.55)');
          ctx.fillStyle = gr; ctx.fillRect(0, 0, ww, hh);
        }, { color: false }),
        transparent: true, depthWrite: false,
      }));
      tarnish.position.z = 0.012;
      // ShapeGeometry UVs are in shape units — normalise to 0..1
      const uv = tarnish.geometry.attributes.uv;
      const tg = tarnish.geometry.clone();
      const tuv = tg.attributes.uv;
      for (let i = 0; i < tuv.count; i++) tuv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
      tarnish.geometry = tg;
      g.add(tarnish);
    } else {
      const fake = new THREE.Mesh(geo, m.get('fakeMirror', { color: 0x231a16, roughness: 0.05, metalness: 0.9, emissive: 0x120a06 }));
      fake.position.z = 0.01;
      g.add(fake);
    }
    g.position.set(x, y, BACK + 0.02);
    this.root.add(g);
    if (real) this.anchors.mirror = new THREE.Vector3(x, y, BACK + 0.1);
  }

  // ---------------------------------------------------------------- tables

  buildMidTables() {
    const m = this.mats;
    const root = this.root;
    // Julian & Kayden's table
    const main = bistroTable(m, { radius: 0.4 });
    main.position.set(1.6, 0, 0.3);
    root.add(main);
    const c = candle(m);
    c.position.set(1.62, 0.76, 0.42);
    root.add(c);
    this.flickers.push(c);
    const k1 = tumbler(m); k1.position.set(1.85, 0.76, 0.2); root.add(k1);
    // Julian's glass placeholder (whisky), the coupe is added by the story
    const j1 = tumbler(m, 0x6a3a10); j1.position.set(1.32, 0.76, 0.28); root.add(j1);
    const menu = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.3), m.get('menu', { color: 0x6a1018, roughness: 0.7 }));
    menu.position.set(1.5, 0.765, 0.05); menu.rotation.y = 0.3;
    root.add(menu);
    const chairJ = bentwoodChair(m, 1); chairJ.position.set(0.82, 0, 0.36); root.add(chairJ);
    const chairK = bentwoodChair(m, -1); chairK.position.set(2.38, 0, 0.36); root.add(chairK);
    this.anchors.mainTable = new THREE.Vector3(1.6, 0.78, 0.3);
    this.anchors.julianSeat = new THREE.Vector3(0.84, 0, 0.36);
    this.anchors.kaydenSeat = new THREE.Vector3(2.36, 0, 0.36);
    this.anchors.coupeSpot = new THREE.Vector3(1.38, 0.76, 0.42);
    this.colliders.push({ x: 1.6, z: 0.3, r: 0.95 });

    // left table (patrons talking)
    const lt = bistroTable(m, { radius: 0.36 });
    lt.position.set(-9.7, 0, -1.25);
    root.add(lt);
    const lc = candle(m); lc.position.set(-9.7, 0.76, -1.15); root.add(lc); this.flickers.push(lc);
    const w1 = wineGlass(m); w1.position.set(-9.95, 0.76, -1.2); root.add(w1);
    const w2 = wineGlass(m, 0x9a7a30); w2.position.set(-9.45, 0.76, -1.3); root.add(w2);
    const c1 = bentwoodChair(m, 1); c1.position.set(-10.42, 0, -1.2); root.add(c1);
    const c2 = bentwoodChair(m, -1); c2.position.set(-8.98, 0, -1.2); root.add(c2);
    this.colliders.push({ x: -9.7, z: -1.25, r: 0.95 });
    this.anchors.leftTable = new THREE.Vector3(-9.7, 0, -1.25);

    // Owen's table — darker corner, no candle lit
    const ot = bistroTable(m, { radius: 0.32 });
    ot.position.set(12.0, 0, -1.6);
    root.add(ot);
    const oc = candle(m, { lit: false }); oc.position.set(11.9, 0.76, -1.5); root.add(oc);
    const oglass = wineGlass(m, 0x4a060c); oglass.position.set(11.78, 0.76, -1.55); root.add(oglass);
    this.owenGlass = oglass;
    const ochair = bentwoodChair(m, -1); ochair.position.set(12.62, 0, -1.6); root.add(ochair);
    this.colliders.push({ x: 12.2, z: -1.6, r: 0.85 });
    this.anchors.owenSeat = new THREE.Vector3(12.6, 0, -1.6);
    this.anchors.owenTable = new THREE.Vector3(12.0, 0.78, -1.6);
  }

  buildForeground() {
    const m = this.mats;
    const root = this.root;
    // tables and chairs closer to the camera than the walk lane — they occlude characters
    const spots = [-11.4, -6.5, -2.2, 4.4, 8.6, 12.6];
    spots.forEach((x, i) => {
      const z = 2.85 + (i % 2) * 0.35;
      const t = bistroTable(m, { radius: 0.38 });
      t.position.set(x, 0, z);
      root.add(t);
      const c = candle(m);
      c.position.set(x + 0.05, 0.76, z - 0.05);
      root.add(c);
      this.flickers.push(c);
      if (i % 2 === 0) { const g = wineGlass(m); g.position.set(x - 0.15, 0.76, z); root.add(g); }
      else { const g = tumbler(m); g.position.set(x + 0.18, 0.76, z + 0.05); root.add(g); }
      const ch1 = bentwoodChair(m, 1); ch1.position.set(x - 0.68, 0, z + 0.05); ch1.rotation.y = 0.15; root.add(ch1);
      const ch2 = bentwoodChair(m, -1); ch2.position.set(x + 0.68, 0, z - 0.05); ch2.rotation.y = -0.2; root.add(ch2);
      if (i % 3 === 1) {
        const ch3 = bentwoodChair(m, 1); ch3.rotation.y = Math.PI / 2 + 0.3; ch3.position.set(x + 0.1, 0, z + 0.75); root.add(ch3);
      }
    });
    // potted palms (foreground silhouettes)
    for (const x of [-13.3, 0.0, 6.9]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.5, 14), m.brass());
      pot.position.set(x, 0.25, 3.7);
      root.add(pot);
      const leafMat = m.get('leaf', { color: 0x14241a, roughness: 0.9, side: THREE.DoubleSide });
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      leafShape.quadraticCurveTo(0.14, 0.45, 0, 1.15);
      leafShape.quadraticCurveTo(-0.14, 0.45, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leafShape, 6);
      for (let i = 0; i < 11; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(x, 0.45, 3.7);
        leaf.rotation.set(0, (i / 11) * Math.PI * 2 + Math.random() * 0.3, 0.35 + Math.random() * 0.75, 'YXZ');
        leaf.scale.setScalar(0.8 + Math.random() * 0.4);
        root.add(leaf);
      }
    }
    // a heavy column in the extreme foreground
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, CEIL, 18), m.woodDark());
    col.position.set(-4.4, CEIL / 2, 4.6);
    root.add(col);
    const col2 = col.clone(); col2.position.x = 10.6; root.add(col2);
  }

  // ---------------------------------------------------------------- lights

  buildLighting() {
    const root = this.root;
    const L = this.lights;
    const hemi = new THREE.HemisphereLight(0x5a3a30, 0x120808, 0.55);
    root.add(hemi);
    L.hemi = hemi;

    const chandX = [-9.3, 0.6, 9.6];
    L.chandeliers = chandX.map((x, i) => {
      const ch = chandelier(this.mats);
      ch.position.set(x, 3.55, -0.9);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), this.mats.brass());
      chain.position.set(x, CEIL - 0.3 + 0.0, -0.9);
      root.add(ch, chain);
      const pl = new THREE.PointLight(0xffb070, i === 1 ? 26 : 20, 0, 1.6);
      pl.position.set(x, 3.3, -0.9);
      root.add(pl);
      return { mesh: ch, light: pl, base: pl.intensity };
    });

    const bottles = new THREE.PointLight(0xff9a40, 9, 6, 1.6);
    bottles.position.set(-2.8, 1.8, -4.3);
    const bottles2 = new THREE.PointLight(0xff9a40, 9, 6, 1.6);
    bottles2.position.set(2.6, 1.8, -4.3);
    root.add(bottles, bottles2);
    L.backbar = [bottles, bottles2];

    const window = new THREE.SpotLight(0x7f9ee0, 16, 14, 0.6, 0.95, 1.6);
    window.position.set(-8.9, 2.9, BACK - 1.0);
    window.target.position.set(-8.0, 0, 1.8);
    root.add(window, window.target);
    L.window = window;

    const lounge1 = new THREE.PointLight(0xff8a70, 5, 5, 1.6);
    lounge1.position.set(7.0, 2.4, -4.2);
    const lounge2 = new THREE.PointLight(0xff8a70, 4, 4.5, 1.6);
    lounge2.position.set(10.4, 2.4, -4.2);
    root.add(lounge1, lounge2);
    L.lounge = [lounge1, lounge2];

    const candleLight = new THREE.PointLight(0xff9040, 2.4, 3.2, 1.5);
    candleLight.position.set(1.6, 1.05, 0.55);
    root.add(candleLight);
    L.candle = candleLight;

    if (!this.low) {
      const led = new THREE.PointLight(0xff2020, 3, 3.5, 1.8);
      led.position.set(-0.6, 0.5, -2.6);
      const entrance = new THREE.PointLight(0xffa070, 4, 5, 1.6);
      entrance.position.set(-12.0, 2.4, -3.8);
      const front = new THREE.PointLight(0xff9a50, 3.5, 6, 1.6);
      front.position.set(4.4, 1.2, 2.8);
      root.add(led, entrance, front);
      L.extra = [led, entrance, front];
    }

    // light pools under the chandeliers
    chandX.forEach((x) => {
      const p = lightPool(0xffa060, 5, 3.4, 0.12);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, 0.011, -0.6);
      root.add(p);
    });
  }

  buildAtmosphere() {
    this.dust = new Dust(new THREE.Box3(new THREE.Vector3(X0, 0.2, -4.5), new THREE.Vector3(X1, 3.8, 2.5)), this.low ? 260 : 700);
    this.root.add(this.dust.points);
    this.animated.push(this.dust);
    this.root.fog = null;
  }

  // ---------------------------------------------------------------- runtime

  /** Called by the hallucination system: 0..1 how "wrong" the room is. */
  setUnreality(u) { this.unreality = u; }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const u = this.unreality || 0;
    for (const a of this.animated) a.update(dt, t);
    // candle flicker
    for (const c of this.flickers) {
      const f = 0.85 + Math.sin(t * 13 + c.position.x * 3) * 0.08 + Math.sin(t * 23 + c.position.z * 5) * 0.06;
      c.userData.halo?.scale.setScalar(0.32 * f);
      c.userData.flame?.scale.set(1, 2.2 * f, 1);
    }
    if (this.lights.candle) this.lights.candle.intensity = 2.4 * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 27) * 0.05);
    // chandeliers: gentle electrical flicker, unnatural pulse when unreality rises
    this.lights.chandeliers.forEach((c, i) => {
      let k = 1 + Math.sin(t * 0.5 + i) * 0.02;
      if (Math.random() < 0.002 + u * 0.03) k *= 0.6;
      k *= 1 + u * Math.sin(t * (1.2 + i * 0.4)) * 0.45;
      c.light.intensity = c.base * k;
      c.mesh.userData.halo.material.opacity = 0.55 * k;
      c.mesh.rotation.y = Math.sin(t * 0.2 + i) * 0.02 + u * Math.sin(t * 0.7 + i) * 0.15;
    });
    if (u > 0) {
      const hue = (t * 0.05) % 1;
      this.lights.backbar.forEach((l) => l.color.setHSL(0.07 - u * 0.08 + Math.sin(t + hue) * 0.02 * u, 1, 0.55));
      this.lights.lounge.forEach((l) => l.color.setHSL(0.98 - u * 0.05, 0.9, 0.6));
    }
    // jukebox hue cycle
    const jb = this.jukebox;
    jb.hue = (jb.hue + dt * 0.03) % 1;
    jb.tubeMat.emissive.setHSL(0.05 + Math.sin(t * 0.4) * 0.04, 1, 0.5);
    jb.glow.material.opacity = 0.3 + Math.sin(t * 2) * 0.05;
    // TV
    this.drawTV(dt);
    if (this.floorReflector) this.floorReflector.material.uniforms.uTime.value = t;
  }

  drawTV(dt) {
    const tv = this.tv;
    tv.t += dt;
    if ((tv.frame = (tv.frame || 0) + 1) % 3) return;
    const { ctx, canvas } = tv;
    const w = canvas.width, h = canvas.height;
    const t = tv.t;
    const scene = Math.floor(t / 7) % 3;
    if (scene === 0) {
      // anchor in the studio
      ctx.fillStyle = '#1a2a48'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#28406a'; ctx.fillRect(150, 20, 90, 70);
      ctx.fillStyle = '#d0d8e8'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('CHON-TV', 162, 60);
      ctx.fillStyle = '#0b0f18'; ctx.beginPath(); ctx.ellipse(80, 150, 50, 60, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#c8a088'; ctx.beginPath(); ctx.ellipse(80, 80, 22, 28, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.ellipse(80, 64, 24, 16, 0, Math.PI, 0); ctx.fill();
    } else if (scene === 1) {
      // aerial: snowy river valley, tape around carcasses
      ctx.fillStyle = '#c8d0d8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5a6a7a'; ctx.beginPath(); ctx.moveTo(0, 60); ctx.bezierCurveTo(90, 100, 160, 30, 256, 80); ctx.lineTo(256, 110); ctx.bezierCurveTo(160, 60, 90, 130, 0, 90); ctx.fill();
      ctx.fillStyle = '#1a1612';
      for (let i = 0; i < 26; i++) ctx.fillRect((i * 37) % 240, 130 + (i * 13) % 40, 6, 12);
      ctx.fillStyle = '#4a2a20';
      for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(60 + i * 22, 120 + (i % 3) * 6, 8, 3, 0.3, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#e8c020'; ctx.lineWidth = 2; ctx.strokeRect(40, 108, 170, 30);
    } else {
      ctx.fillStyle = '#0c0f16'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e0e4ee'; ctx.font = 'bold 18px sans-serif';
      ctx.fillText('ДОЛИНА ЮКОНА', 20, 70);
      ctx.font = '14px sans-serif';
      ctx.fillText('найдено 23 туши', 20, 96);
      ctx.fillText('версия полиции: волки', 20, 118);
    }
    // ticker
    ctx.fillStyle = '#8a1010'; ctx.fillRect(0, h - 30, w, 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    const msg = 'ЮКОН: МАССОВАЯ ГИБЕЛЬ ЖИВОТНЫХ У РЕКИ  •  ОХОТНИКОВ ПРОСЯТ НЕ ВЫХОДИТЬ В ДОЛИНУ  •  −34°C В УАЙТХОРСЕ  •  ';
    const tw = ctx.measureText(msg).width;
    const off = (t * 40) % tw;
    ctx.fillText(msg + msg, -off, h - 10);
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
    tv.tex.needsUpdate = true;
    tv.glow.material.opacity = 0.22 + Math.random() * 0.06;
  }

  // ---------------------------------------------------------------- data for systems

  /** Camera shots used for painted dialogue backgrounds. */
  get shots() {
    return {
      table: { pos: [1.6, 1.45, 3.4], look: [1.6, 1.2, -4.0], fov: 46 },
      tableOwen: { pos: [6.4, 1.5, 2.6], look: [12.6, 1.0, -2.2], fov: 40 },
      tableDark: { pos: [1.0, 1.35, 2.9], look: [2.4, 1.3, -4.0], fov: 52 },
      bar: { pos: [-1.4, 1.6, -0.6], look: [-1.4, 1.7, -5], fov: 50 },
    };
  }
}
