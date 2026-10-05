import * as THREE from 'three';
import { LocationBase, tileTexture, tiled } from '../LocationBase.js';
import { canvasTexture } from '../../render/textures.js';
import { glow, lightCone } from '../props.js';

/**
 * Interrogation room 2 — small, cold, a one-way mirror on the back wall with
 * an observation room behind it (people watching, barely visible).
 */
const BACK = -3.0;
const H = 2.8;

export class InterrogationScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'interrogation';
    this.title = 'Допросная';
    this.background = 0x050607;
    this.camera = { distance: 6.2, height: 2.0, lookHeight: 1.15, lookZ: -1.0, fov: 34, minWidth: 6.4 };
    this.bounds = { walk: { minX: -3.1, maxX: 3.1, minZ: -2.3, maxZ: 1.0 }, camera: { minX: 0, maxX: 0 } };
  }

  build() {
    const root = this.root;
    this.floor(-5, 5, -6, 4, this.mat('irFloor', { map: tiled(tileTexture('lino'), 5, 5), color: 0x9aa098, roughness: 0.6 }));
    const wallMat = this.mat('irWall', { map: tileTexture('block'), color: 0xa8b0aa, roughness: 0.9 });
    this.wall(-3.6, 3.6, H, BACK, wallMat, [
      { x0: -1.2, x1: 2.0, y0: 0.95, y1: 2.15 },  // mirror
      { x0: -3.2, x1: -2.2, y0: 0, y1: 2.15 },   // door
    ]);
    for (const x of [-3.6, 3.6]) this.plane(8, H, wallMat, x, H / 2, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), this.mat('irCeil', { color: 0x8a8e8c, roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, 0); root.add(ceil);
    this.box(7.2, 0.12, 0.04, this.mat('irSkirt', { color: 0x30363a }), 0, 0.06, BACK + 0.03);

    // one-way mirror: dark reflective glass, the observation room faintly behind it
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2026, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.86, envMapIntensity: 1 });
    this.mirror = this.plane(3.2, 1.2, glass, 0.4, 1.55, BACK);
    this.mirrorMat = glass;
    this.box(3.3, 0.06, 0.08, this.mat('mirrorFrame', { color: 0x2a2e32, metalness: 0.6 }), 0.4, 0.92, BACK + 0.04);
    this.box(3.3, 0.06, 0.08, this.mat('mirrorFrame', { color: 0x2a2e32, metalness: 0.6 }), 0.4, 2.18, BACK + 0.04);
    // observation room
    this.box(4, H, 0.05, this.mat('obsWall', { color: 0x15181a }), 0.4, H / 2, BACK - 2.2);
    this.box(3.4, 0.9, 0.5, this.mat('obsDesk', { color: 0x222628 }), 0.4, 0.45, BACK - 0.9);
    const obsLight = new THREE.PointLight(0x7090b0, 0.6, 3, 1.6);
    obsLight.position.set(0.4, 2.2, BACK - 1.2);
    root.add(obsLight);
    this.obsLight = obsLight;
    this.anchors.mirror = new THREE.Vector3(0.4, 1.55, BACK + 0.1);
    this.anchors.observers = [{ x: -0.3, z: BACK - 1.4 }, { x: 1.2, z: BACK - 1.5 }];

    // door
    this.box(1.0, 2.15, 0.05, this.mat('irDoor', { color: 0x4a5560, metalness: 0.2, roughness: 0.5 }), -2.7, 1.07, BACK - 0.02);
    this.box(0.25, 0.25, 0.06, this.mat('irDoorWin', { color: 0x10161c, metalness: 0.5 }), -2.7, 1.6, BACK + 0.01);
    this.anchors.door = new THREE.Vector3(-2.7, 1.9, BACK + 0.1);

    // table, two chairs; the suspect's chair has a ring for cuffs
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    const top = this.mat('irTable', { color: 0x6a6e70, roughness: 0.45, metalness: 0.2 });
    this.box(1.6, 0.05, 0.9, top, 0.5, 0.76, -1.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.05, 0.74, 0.05, steel, 0.5 + sx * 0.72, 0.37, -1.0 + sz * 0.38);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 14), steel);
    ring.position.set(0.0, 0.8, -1.0); ring.rotation.x = Math.PI / 2; root.add(ring);
    this.colliders.push({ box: { minX: -0.35, maxX: 1.35, minZ: -1.5, maxZ: -0.5 } });
    const chair = (x, ry) => {
      const g = new THREE.Group();
      this.box(0.46, 0.05, 0.44, steel, 0, 0.47, 0, g);
      this.box(0.05, 0.5, 0.44, steel, -0.22, 0.74, 0, g);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.03, 0.47, 0.03, steel, sx * 0.2, 0.23, sz * 0.2, g);
      g.position.set(x, 0, -1.0); g.rotation.y = ry; root.add(g);
      return g;
    };
    chair(-0.55, 0);
    chair(1.6, Math.PI);
    this.anchors.julianSeat = { x: -0.5, z: -1.0 };
    this.anchors.officerSeat = { x: 1.55, z: -1.0 };
    this.anchors.table = new THREE.Vector3(0.5, 1.0, -1.0);
    this.anchors.julianChair = new THREE.Vector3(-0.55, 1.1, -1.0);
    // paper cup, folder, recorder on the table
    this.cup = this.box(0.08, 0.11, 0.08, this.mat('cup', { color: 0xf0f0ec, roughness: 0.8 }), 0.15, 0.84, -0.8);
    this.cup.visible = false;
    this.box(0.32, 0.03, 0.24, this.mat('folder', { color: 0xc8a860 }), 0.9, 0.8, -1.1);
    this.box(0.14, 0.04, 0.08, this.mat('recorder', { color: 0x1a1a1c }), 0.5, 0.8, -1.25);
    const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), this.mat('recLed', { color: 0, emissive: 0xff2020, emissiveIntensity: 4 }));
    recLed.position.set(0.55, 0.83, -1.21); root.add(recLed);
    this.recLed = recLed;

    // camera in the corner, wall clock
    const cam = new THREE.Group();
    this.box(0.18, 0.1, 0.1, this.mat('camBody', { color: 0x202224 }), 0, 0, 0, cam);
    const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), this.mat('recLed', { color: 0, emissive: 0xff2020, emissiveIntensity: 4 }));
    camLed.position.set(0.08, 0.02, 0.05); cam.add(camLed);
    cam.position.set(3.3, 2.55, BACK + 0.3); cam.rotation.y = -0.6;
    root.add(cam);
    this.anchors.camera = new THREE.Vector3(3.3, 2.55, BACK + 0.3);
    const clockTex = canvasTexture('irclock', 128, 128, (ctx) => {
      ctx.fillStyle = '#efefe8'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, 7); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 5; ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = '#111'; ctx.fillRect(64 + Math.cos(a) * 48 - 2, 64 + Math.sin(a) * 48 - 2, 4, 4); }
    });
    this.plane(0.38, 0.38, this.mat('irclockMat', { map: clockTex }), 2.7, 2.25, BACK + 0.02);
    this.clockHand = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 0.005), this.mat('hand', { color: 0x111111 }));
    this.clockHand.geometry.translate(0, 0.075, 0);
    this.clockHand.position.set(2.7, 2.25, BACK + 0.04);
    root.add(this.clockHand);
    this.anchors.clock = new THREE.Vector3(2.7, 2.25, BACK + 0.1);

    // one hard overhead lamp above the table (cone of light), a cold fill
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.2, 18, 1, true), this.mat('shadeSteel', { color: 0x3a3e42, metalness: 0.6, side: THREE.DoubleSide }));
    lampShade.position.set(0.5, 2.3, -1.0); root.add(lampShade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), this.mat('irBulb', { color: 0, emissive: 0xf4f6ff, emissiveIntensity: 5 }));
    bulb.position.set(0.5, 2.22, -1.0); root.add(bulb);
    this.lamp = new THREE.SpotLight(0xf0f4ff, 30, 6, 0.75, 0.6, 1.4);
    this.lamp.position.set(0.5, 2.2, -1.0); this.lamp.target.position.set(0.5, 0, -1.0);
    root.add(this.lamp, this.lamp.target);
    const cone = lightCone(0xe8eeff, 2.1, 1.3, 0.16);
    cone.position.set(0.5, 2.2 - 1.05, -1.0); root.add(cone);
    const hemi = new THREE.HemisphereLight(0x9aa8b8, 0x1a1c1e, 0.8);
    root.add(hemi);
    this.lights = { hemi, lamp: this.lamp };

    // foreground: a water cart with a jug — fades if it would cover the table
    const fgGroup = new THREE.Group();
    fgGroup.name = 'fg-cart';
    this.box(0.6, 0.05, 0.4, steel, 0, 0.8, 0, fgGroup);
    this.box(0.6, 0.05, 0.4, steel, 0, 0.3, 0, fgGroup);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.03, 0.8, 0.03, steel, sx * 0.28, 0.4, sz * 0.18, fgGroup);
    this.box(0.16, 0.26, 0.16, new THREE.MeshStandardMaterial({ color: 0xcfe6f6, transparent: true, opacity: 0.5 }), 0.1, 0.96, 0, fgGroup);
    fgGroup.position.set(-2.4, 0, 1.9);
    root.add(fgGroup);
    this.foregroundGroups.push(fgGroup);
    this.anchors.jug = new THREE.Vector3(-2.3, 1.1, 1.9);
    return root;
  }

  /** Light behind the mirror up → the watchers become visible through the glass. */
  setObserved(v) {
    this.obsLight.intensity = v ? 3.5 : 0.6;
    this.mirrorMat.opacity = v ? 0.6 : 0.86;
  }

  update(dt) {
    super.update(dt);
    this.clockHand.rotation.z = -this.time * 0.105;
    this.recLed.visible = Math.floor(this.time * 1.2) % 2 === 0;
    // the buzzing lamp
    this.lamp.intensity = 30 * (0.97 + Math.random() * 0.03) * (Math.random() < 0.004 ? 0.4 : 1);
  }
}
