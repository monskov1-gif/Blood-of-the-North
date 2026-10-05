import * as THREE from 'three';
import { LocationBase, tileTexture, tiled } from '../LocationBase.js';
import { streetTexture, canvasTexture, rng } from '../../render/textures.js';
import { glow } from '../props.js';

/**
 * Whitehorse General — 2nd floor, side-on cut-away. States: 'day' / 'night'.
 *   x -22 … -14  entrance hall: reception, waiting area
 *   x -14 …  -3  corridor A: elevator, stairs, water cooler, procedure room
 *   x  -1 …   1  side corridor going back (surgery / service)
 *   x   3 …   7  nurse station
 *   x   9 …  13  ward 207 — the old woman (glass front)
 *   x  14 …  15  staff door
 *   x  16 …  21  ward 209 — Julian (glass front)
 */
const BACK = -4;
const H = 3.1;

export class HospitalScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'hospital';
    this.title = 'Городская больница Уайтхорса';
    this.background = 0x06080a;
    this.camera = { distance: 8.0, height: 2.3, lookHeight: 1.3, lookZ: -1.0 };
    this.wardBOpen = false;
    const areas = [
      { minX: -21.5, maxX: 21.4, minZ: -2.6, maxZ: 1.8 },          // main corridor
      { minX: -0.9, maxX: 0.9, minZ: -9.0, maxZ: -2.5 },            // side corridor
      { minX: -5.6, maxX: -3.4, minZ: -6.4, maxZ: -2.5 },           // procedure room
      { minX: 16.3, maxX: 20.8, minZ: -7.4, maxZ: -4.4 },           // ward 209 (Julian)
      { minX: 16.55, maxX: 17.45, minZ: -4.6, maxZ: -2.5 },         // ward 209 door
      { minX: 9.2, maxX: 12.8, minZ: -7.4, maxZ: -4.4, enabled: () => this.wardBOpen },
      { minX: 9.55, maxX: 10.45, minZ: -4.6, maxZ: -2.5, enabled: () => this.wardBOpen },
    ];
    this.bounds = { walk: { areas }, camera: { minX: -17.5, maxX: 17.5 } };
  }

  build() {
    const root = this.root;
    this.floor(-23, 23, -10, 5, this.mat('hFloor', { map: tiled(tileTexture('lino'), 23, 8), color: 0xb8c4c0, roughness: 0.3, metalness: 0.05 }));
    const wallMat = this.mat('hWall', { map: tileTexture('wall'), color: 0xd8e2de, roughness: 0.85 });
    const lowerMat = this.mat('hWallLower', { map: tileTexture('wallLower'), color: 0x7a9a9a, roughness: 0.6 });
    const holes = [
      { x0: -21.4, x1: -19.4, y0: 0, y1: 2.5 },   // entrance
      { x0: -12.8, x1: -11.2, y0: 0, y1: 2.3 },   // elevator
      { x0: -5.8, x1: -3.2, y0: 0, y1: 2.4 },     // procedure room
      { x0: -1.0, x1: 1.0, y0: 0, y1: 2.6 },      // side corridor
      { x0: 9.0, x1: 13.0, y0: 0, y1: 2.6 },      // ward 207 front
      { x0: 16.1, x1: 21.0, y0: 0, y1: 2.6 },     // ward 209 front
    ];
    this.wall(-23, 23, H, BACK, wallMat, holes);
    const spans = [[-23, -21.4], [-19.4, -12.8], [-11.2, -5.8], [-3.2, -1.0], [1.0, 9.0], [13.0, 16.1], [21.0, 23]];
    for (const [a, b] of spans) {
      this.box(b - a, 1.0, 0.04, lowerMat, (a + b) / 2, 0.5, BACK + 0.03);
      this.box(b - a, 0.08, 0.1, this.mat('handrail', { color: 0xc8ccd0, roughness: 0.4 }), (a + b) / 2, 0.95, BACK + 0.1);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(46, 15), this.mat('hCeil', { map: tiled(tileTexture('ceiling'), 23, 7), roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -2.5); root.add(ceil);
    for (const x of [-23, 23]) this.plane(15, H, wallMat, x, H / 2, -2.5, x < 0 ? Math.PI / 2 : -Math.PI / 2);

    this.outsideMats = [];
    const outside = (w, h, x, y, z) => {
      const m = new THREE.MeshBasicMaterial({ map: streetTexture('morning'), color: 0xdde6ee });
      this.outsideMats.push(m);
      return this.plane(w, h, m, x, y, z);
    };

    // ---------------------------------------------------------------- entrance hall
    outside(5, 3.4, -20.4, 1.6, BACK - 1.6);
    const glass = this.mat('hGlass', { color: 0xc8dce8, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2 });
    for (const x of [-20.9, -19.9]) this.box(0.96, 2.46, 0.04, glass, x, 1.23, BACK);
    const sign = this.textSign('WHITEHORSE GENERAL HOSPITAL', { w: 3.4, h: 0.32, bg: '#0e3a5a', fg: '#f4f8fa' });
    sign.position.set(-20.4, 2.8, BACK + 0.03); root.add(sign);
    this.anchors.entrance = new THREE.Vector3(-20.4, 1.4, BACK + 0.2);
    this.box(3.2, 1.1, 0.7, this.mat('recDeskH', { color: 0xe4e8ea, roughness: 0.5 }), -16.5, 0.55, -3.1);
    this.box(3.3, 0.05, 0.85, this.mat('recTopH', { color: 0x5a8aa0, roughness: 0.4 }), -16.5, 1.12, -3.1);
    const rs = this.textSign('РЕГИСТРАТУРА · RECEPTION', { w: 2.4, h: 0.26, bg: '#e8eef2', fg: '#0e3a5a' });
    rs.position.set(-16.5, 2.5, BACK + 0.03); root.add(rs);
    this.colliders.push({ box: { minX: -18.2, maxX: -14.8, minZ: -3.6, maxZ: -2.7 } });
    this.anchors.reception = new THREE.Vector3(-16.5, 1.6, -3.1);
    this.bench(-14.3, -3.35, 1.8, 0x5a7a8a);
    this.colliders.push({ box: { minX: -15.3, maxX: -13.3, minZ: -3.7, maxZ: -3.0 } });

    // ---------------------------------------------------------------- corridor A
    // elevator
    const elev = new THREE.Group();
    const elevMat = this.mat('elevator', { color: 0xb0b8c0, metalness: 0.85, roughness: 0.25 });
    this.box(0.78, 2.28, 0.05, elevMat, -0.4, 1.14, 0, elev);
    this.box(0.78, 2.28, 0.05, elevMat, 0.4, 1.14, 0, elev);
    elev.position.set(-12, 0, BACK - 0.02);
    root.add(elev);
    const ebtn = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), this.mat('ebtn', { color: 0, emissive: 0xffc860, emissiveIntensity: 2 }));
    ebtn.position.set(-10.9, 1.2, BACK + 0.03); root.add(ebtn);
    const es = this.textSign('ЛИФТ · 2 ЭТАЖ', { w: 1.1, h: 0.18 });
    es.position.set(-12, 2.5, BACK + 0.03); root.add(es);
    this.anchors.elevator = new THREE.Vector3(-12, 1.8, BACK + 0.2);
    this.door(-9.3, BACK + 0.02, { sign: 'ЛЕСТНИЦА · STAIRS', w: 1.0, color: 0x6a8a7a });
    this.anchors.stairs = new THREE.Vector3(-9.3, 1.8, BACK + 0.2);
    // water cooler
    const cooler = new THREE.Group();
    this.box(0.36, 1.0, 0.36, this.mat('coolerBody', { color: 0xe8ecee }), 0, 0.5, 0, cooler);
    this.box(0.3, 0.42, 0.3, new THREE.MeshStandardMaterial({ color: 0x9ad0f0, transparent: true, opacity: 0.55, roughness: 0.05 }), 0, 1.22, 0, cooler);
    cooler.position.set(-7.4, 0, BACK + 0.35);
    root.add(cooler);
    this.colliders.push({ x: -7.4, z: BACK + 0.35, r: 0.3 });
    this.anchors.cooler = new THREE.Vector3(-7.4, 1.3, BACK + 0.4);
    // procedure room alcove
    const pMat = this.mat('procWall', { color: 0xe4ecee, roughness: 0.8 });
    this.box(2.6, H, 0.1, pMat, -4.5, H / 2, -6.8);
    this.box(0.1, H, 2.8, pMat, -5.85, H / 2, -5.4);
    this.box(0.1, H, 2.8, pMat, -3.15, H / 2, -5.4);
    const exam = new THREE.Group();
    this.box(1.8, 0.1, 0.7, this.mat('examTop', { color: 0x4a6a80 }), 0, 0.85, 0, exam);
    this.box(0.5, 0.8, 0.3, this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), 0, 0.4, -0.15, exam);
    exam.position.set(-4.5, 0, -6.2); root.add(exam);
    const exLamp = new THREE.SpotLight(0xffffff, 18, 4, 0.5, 0.5, 1.4);
    exLamp.position.set(-4.3, 2.6, -5.6); exLamp.target.position.set(-4.5, 0.8, -6.0);
    root.add(exLamp, exLamp.target);
    this.examLamp = exLamp;
    const ps = this.textSign('ПРОЦЕДУРНАЯ', { w: 1.3, h: 0.2 });
    ps.position.set(-4.5, 2.6, BACK + 0.03); root.add(ps);
    this.anchors.procedure = new THREE.Vector3(-4.5, 1.6, BACK + 0.1);
    this.anchors.examSpot = { x: -4.4, z: -5.6 };

    // ---------------------------------------------------------------- side corridor (depth)
    const scMat = this.mat('scWall', { map: tileTexture('wall'), color: 0xc8d4d0, roughness: 0.85 });
    this.box(0.1, H, 5.2, scMat, -1.05, H / 2, -6.6);
    this.box(0.1, H, 5.2, scMat, 1.05, H / 2, -6.6);
    this.box(2.2, H, 0.1, scMat, 0, H / 2, -9.2);
    this.door(0, -9.1, { sign: 'ХИРУРГИЯ', w: 1.2, color: 0x7a90a0 });
    const sdoor = this.door(0, -7.0, { sign: 'СЛУЖЕБНЫЙ', w: 0.9 });
    sdoor.position.x = 0.98; sdoor.rotation.y = -Math.PI / 2;
    this.fluorescent(0, H - 0.04, -6.5, { intensity: 6, range: 5 });
    this.anchors.sideCorridor = new THREE.Vector3(0, 1.8, -7.0);
    const arrow = this.textSign('← ТЕРАПИЯ   ХИРУРГИЯ ↑', { w: 2.0, h: 0.2, bg: '#0e3a5a', fg: '#f4f8fa' });
    arrow.position.set(0, 2.82, BACK + 0.03); root.add(arrow);

    // ---------------------------------------------------------------- nurse station
    const ns = new THREE.Group();
    this.box(3.6, 1.05, 0.6, this.mat('nsDesk', { color: 0xd8e4e8, roughness: 0.5 }), 0, 0.52, 0, ns);
    this.box(3.7, 0.05, 0.75, this.mat('nsTop', { color: 0x4a7a90 }), 0, 1.07, 0, ns);
    this.box(0.4, 0.3, 0.05, this.mat('pcMon', { color: 0x000, emissive: 0x3a6a8a, emissiveIntensity: 1.2 }), -0.8, 1.3, -0.15, ns);
    this.box(0.4, 0.3, 0.05, this.mat('pcMon', { color: 0x000, emissive: 0x3a6a8a, emissiveIntensity: 1.2 }), 0.6, 1.3, -0.15, ns);
    ns.position.set(5, 0, -3.0);
    root.add(ns);
    this.colliders.push({ box: { minX: 3.1, maxX: 6.9, minZ: -3.5, maxZ: -2.6 } });
    const nss = this.textSign('ПОСТ МЕДСЕСТРЫ · NURSE STATION', { w: 2.8, h: 0.24, bg: '#e8eef2', fg: '#0e3a5a' });
    nss.position.set(5, 2.6, BACK + 0.03); root.add(nss);
    // desk lamp (the warm night light at the station)
    const dl = new THREE.Group();
    this.box(0.05, 0.4, 0.05, this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 }), 0, 0.2, 0, dl);
    const dlShade = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 12, 1, true), this.mat('dlShade', { color: 0x2a6040, side: THREE.DoubleSide }));
    dlShade.position.y = 0.42; dl.add(dlShade);
    dl.position.set(6.2, 1.1, -3.1); root.add(dl);
    this.deskLamp = new THREE.PointLight(0xffc888, 0, 4, 1.6);
    this.deskLamp.position.set(6.2, 1.5, -2.9); root.add(this.deskLamp);
    this.deskGlow = glow(0xffb870, 1.2, 0.0); this.deskGlow.position.set(6.2, 1.45, -2.9); root.add(this.deskGlow);
    this.anchors.nurseStation = new THREE.Vector3(5, 1.6, -3.0);
    this.anchors.doctorsTalk = { x: 3.4, z: -1.8 };

    // ---------------------------------------------------------------- wards
    this.wardB = this.buildWard(9.0, 13.0, '207', { patient: true });
    this.door(14.5, BACK + 0.02, { sign: 'ТОЛЬКО ПЕРСОНАЛ', w: 0.9, color: 0x6a7480 });
    this.wardA = this.buildWard(16.1, 21.0, '209', { window: true });
    this.wardA.hinge.rotation.y = 1.35; // Julian's door stands open
    this.anchors.wardBDoor = new THREE.Vector3(10.0, 1.9, BACK + 0.15);
    this.anchors.wardADoor = new THREE.Vector3(16.9, 1.9, BACK + 0.15);

    // exit signs (green) above doors
    this.exitSigns = [];
    for (const x of [-20.4, -9.3, 14.5]) {
      const s = this.textSign('ВЫХОД · EXIT', { w: 0.7, h: 0.16, bg: '#0a6a2a', fg: '#e8ffe8', emissive: 1.6 });
      s.position.set(x, 2.95, BACK + 0.05); root.add(s);
      this.exitSigns.push(s);
    }

    // ---------------------------------------------------------------- lights
    this.fluos = [];
    for (let x = -21; x <= 21; x += 3) this.fluos.push(this.fluorescent(x, H - 0.04, -0.9, { intensity: 9, range: 6.5 }));
    const hemi = new THREE.HemisphereLight(0xd0dce8, 0x30383a, 1.4);
    root.add(hemi);
    this.lights.hemi = hemi;
    // night: blue moonlight through ward windows + a dim corridor wash
    this.nightFill = new THREE.PointLight(0x5a78a8, 0, 14, 1.2);
    this.nightFill.position.set(0, 2.5, 0.5); root.add(this.nightFill);
    this.nightFill2 = new THREE.PointLight(0x5a78a8, 0, 14, 1.2);
    this.nightFill2.position.set(14, 2.5, 0.5); root.add(this.nightFill2);
    this.nightFill3 = new THREE.PointLight(0x5a78a8, 0, 14, 1.2);
    this.nightFill3.position.set(-14, 2.5, 0.5); root.add(this.nightFill3);

    // ---------------------------------------------------------------- foreground
    const fg = (x, z, name, build) => {
      const g = new THREE.Group(); g.name = name; build(g); g.position.set(x, 0, z); root.add(g); this.foregroundGroups.push(g);
    };
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    fg(-15.5, 3.0, 'fg-wheelchair', (g) => {
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 20), steel); w.position.set(0, 0.32, s * 0.28); g.add(w); }
      this.box(0.45, 0.05, 0.5, this.mat('wcSeat', { color: 0x1a1c20 }), 0.05, 0.5, 0, g);
      this.box(0.05, 0.5, 0.5, this.mat('wcSeat', { color: 0x1a1c20 }), -0.2, 0.8, 0, g);
    });
    fg(-6.5, 3.2, 'fg-trolley', (g) => {
      for (const y of [0.3, 0.6, 0.9]) this.box(0.8, 0.03, 0.5, steel, 0, y, 0, g);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.025, 0.95, 0.025, steel, sx * 0.38, 0.47, sz * 0.23, g);
      this.box(0.3, 0.12, 0.2, this.mat('linen', { color: 0xe8ecee }), -0.15, 0.68, 0, g);
      this.box(0.18, 0.2, 0.12, this.mat('box', { color: 0x8ab0c8 }), 0.2, 1.0, 0, g);
    });
    fg(2.0, 3.4, 'fg-plant', (g) => {
      this.box(0.42, 0.5, 0.42, this.mat('potH', { color: 0xd8dcd8 }), 0, 0.25, 0, g);
      const leaf = this.mat('plantH', { color: 0x2a5a3a, roughness: 0.9 });
      const r = rng(11);
      for (let i = 0; i < 22; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.12 + r() * 0.07, 6, 5), leaf); l.position.set((r() - 0.5) * 0.6, 0.7 + r() * 1.0, (r() - 0.5) * 0.5); l.scale.y = 0.6; g.add(l); }
    });
    fg(12.0, 3.1, 'fg-chairs', (g) => {
      const seat = this.mat('plasticChairH', { color: 0x5a7a8a, roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        this.box(0.5, 0.05, 0.46, seat, i * 0.58, 0.46, 0, g);
        this.box(0.5, 0.45, 0.05, seat, i * 0.58, 0.7, 0.21, g);
        for (const s of [-1, 1]) this.box(0.03, 0.46, 0.03, steel, i * 0.58 + s * 0.22, 0.23, 0, g);
      }
    });

    this.dustFx = this.dust(new THREE.Box3(new THREE.Vector3(-22, 0.3, -3.5), new THREE.Vector3(22, 2.8, 2)), 300);
    this.setState('day');
    return root;
  }

  /** A ward behind a glass front: bed, monitor, IV, window, chair, sink. */
  buildWard(x0, x1, number, { patient = false, window = false } = {}) {
    const root = this.root;
    const w = x1 - x0, cx = (x0 + x1) / 2, depth = 3.6, zb = BACK - depth;
    const wm = this.mat(`ward-${number}`, { map: tileTexture('wall'), color: patient ? 0xd8dcd0 : 0xd4e0dc, roughness: 0.85 });
    this.box(w, H, 0.1, wm, cx, H / 2, zb);
    this.box(0.1, H, depth, wm, x0, H / 2, BACK - depth / 2);
    this.box(0.1, H, depth, wm, x1, H / 2, BACK - depth / 2);
    this.box(w, 0.04, depth, this.mat('wardFloor', { color: 0xa8b4b0, roughness: 0.4 }), cx, 0.005, BACK - depth / 2);
    // glass front: low wall + glass panes, a door gap at the left
    const doorX0 = x0 + 0.4, doorX1 = x0 + 1.45;
    const glassMat = this.mat('wardGlass', { color: 0xc8dce8, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.2 });
    this.box(x1 - doorX1, 0.22, 0.06, this.mat('wardLow', { color: 0x7a9a9a }), (doorX1 + x1) / 2, 0.11, BACK);
    this.box(x1 - doorX1, 2.38, 0.03, glassMat, (doorX1 + x1) / 2, 1.41, BACK);
    for (let mx = doorX1 + 1.2; mx < x1 - 0.2; mx += 1.2) this.box(0.05, 2.4, 0.06, this.mat('wardFrame', { color: 0xb8c0c4 }), mx, 1.3, BACK);
    this.box(0.4, 2.6, 0.06, this.mat('wardLow', { color: 0x7a9a9a }), x0 + 0.2, 1.3, BACK);
    this.box(x1 - x0, 0.1, 0.08, this.mat('wardFrame', { color: 0xb8c0c4 }), cx, 2.6, BACK);
    // blinds on the glass (half down)
    const blindsTex = canvasTexture('wardBlinds', 64, 64, (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      for (let y = 0; y < ch; y += 6) { ctx.fillStyle = 'rgba(210,216,220,0.95)'; ctx.fillRect(0, y, cw, 4); }
    }, { repeat: [3, 1] });
    const bl = this.plane(x1 - doorX1, 0.5, new THREE.MeshStandardMaterial({ map: blindsTex, transparent: true, alphaTest: 0.1 }), (doorX1 + x1) / 2, 2.3, BACK + 0.03);
    bl.renderOrder = 1;
    // door leaf (swings open into the room)
    const hinge = new THREE.Group();
    hinge.position.set(doorX0, 0, BACK);
    const leaf = this.box(doorX1 - doorX0, 2.2, 0.05, this.mat(`wardDoor-${number}`, { color: 0x8aa0b0, roughness: 0.5 }), (doorX1 - doorX0) / 2, 1.1, 0, hinge);
    this.box(0.25, 0.6, 0.06, this.mat('doorGlass', { color: 0x1c2630, roughness: 0.1, metalness: 0.4, emissive: 0x0a1018 }), (doorX1 - doorX0) / 2, 1.5, 0.01, hinge);
    root.add(hinge);
    const num = this.textSign(`ПАЛАТА ${number}`, { w: 0.9, h: 0.18 });
    num.position.set(x0 + 0.92, 2.78, BACK + 0.03); root.add(num);
    // bed, monitor, IV, chair, sink
    const bedX = cx + 0.45, bedZ = BACK - 2.0;
    const bed = this.bed(bedX, bedZ);
    const mon = this.monitor(bedX - 1.45, 1.45, BACK - 2.9);
    const iv = this.ivStand(bedX - 1.25, BACK - 1.3, patient ? 0x8a0010 : 0xdde8f0);
    this.officeChair(x1 - 0.45, BACK - 3.0, -0.9);
    const sink = new THREE.Group();
    this.box(0.5, 0.12, 0.4, this.mat('sink', { color: 0xf0f2f2 }), 0, 0.85, 0, sink);
    this.box(0.04, 0.2, 0.04, this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), 0, 1.0, -0.15, sink);
    sink.position.set(x0 + 0.5, 0, zb + 0.35); root.add(sink);
    // window to the outside on the back wall
    let outsideMat = null;
    if (window) {
      outsideMat = new THREE.MeshBasicMaterial({ map: streetTexture('morning'), color: 0xdde6ee });
      this.outsideMats.push(outsideMat);
      this.box(1.6, 1.3, 0.04, outsideMat, cx + 0.6, 1.7, zb + 0.06);
      this.box(1.7, 0.06, 0.08, this.mat('wardFrame', { color: 0xb8c0c4 }), cx + 0.6, 1.05, zb + 0.08);
    }
    // warm reading light (night)
    const warm = new THREE.PointLight(0xffb070, 0, 5, 1.5);
    warm.position.set(bedX - 0.8, 2.0, BACK - 1.8); root.add(warm);
    const cold = new THREE.PointLight(0xd8e4f0, 5, 5, 1.5);
    cold.position.set(cx, 2.8, BACK - 1.8); root.add(cold);
    return {
      x0, x1, cx, bed, mon, iv, hinge, leaf, warm, cold, outsideMat,
      bedSpot: { x: bedX, z: bedZ, y: 0.72 },
      doorSpot: { x: (doorX0 + doorX1) / 2, z: -2.4 },
      inside: { x: bedX - 1.0, z: BACK - 1.3 },
    };
  }

  /** Scene State System: 'day' | 'night'. */
  setState(name) {
    this.state = name;
    const night = name === 'night';
    for (const f of this.fluos) {
      const keep = night && (Math.abs(f.group.position.x - 5) < 1.6 || Math.abs(f.group.position.x + 12) < 1.6);
      f.light.visible = !night || keep;
      f.light.intensity = keep ? f.base * 0.18 : f.base;
      f.tube.material.emissiveIntensity = night ? (keep ? 0.5 : 0.04) : 2.2;
    }
    this.lights.hemi.intensity = night ? 0.25 : 1.4;
    this.lights.hemi.color.set(night ? 0x4a5a80 : 0xd0dce8);
    for (const l of [this.nightFill, this.nightFill2, this.nightFill3]) l.intensity = night ? 3.2 : 0;
    this.deskLamp.intensity = night ? 3.5 : 0;
    this.deskGlow.material.opacity = night ? 0.45 : 0;
    this.wardA.cold.intensity = night ? 0 : 5;
    this.wardB.cold.intensity = night ? 0 : 5;
    this.wardA.warm.intensity = night ? 0.6 : 0;
    this.examLamp.intensity = night ? 0 : 18;
    for (const m of this.outsideMats) { m.map = streetTexture(night ? 'night' : 'morning'); m.color.set(night ? 0x8a9ab8 : 0xdde6ee); m.needsUpdate = true; }
    if (this.dustFx) this.dustFx.material.opacity = night ? 0.12 : 0.25;
  }

  /** Ward 207 door opens: warm light spills into the dark corridor. */
  openWardB(open = true) {
    this.wardBOpen = open;
    this.wardBDoorTarget = open ? 1.35 : 0;
    this.wardB.warm.intensity = open ? 5 : 0;
    if (open && !this.spill) {
      this.spill = this.pool(0xffb070, 10.0, -1.8, 2.6, 3.4, 0.0);
    }
  }

  update(dt) {
    super.update(dt);
    this.updateMonitors(dt, (m) => this.onBeat?.(m));
    if (this.wardBDoorTarget != null) {
      const h = this.wardB.hinge;
      h.rotation.y += (this.wardBDoorTarget - h.rotation.y) * Math.min(1, dt * 1.6);
      if (this.spill) this.spill.material.opacity += ((this.wardBOpen ? 0.35 : 0) - this.spill.material.opacity) * Math.min(1, dt * 2);
    }
  }
}
