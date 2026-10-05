import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { streetTexture, canvasTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { Snow } from '../Particles.js';

/** Outside Whitehorse General: snowy sidewalk, the hospital doors, a cold morning. */
export class StreetScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'street';
    this.title = 'Уайтхорс';
    this.background = 0xb8c4d0;
    this.camera = { distance: 8.4, height: 2.2, lookHeight: 1.4, lookZ: -1.0 };
    this.bounds = { walk: { minX: -9, maxX: 12, minZ: -1.8, maxZ: 1.6 }, camera: { minX: -5, maxX: 8 } };
  }

  build() {
    const root = this.root;
    const snowMat = this.mat('snowGround', { color: 0xe8eef4, roughness: 0.95 });
    this.floor(-20, 20, -3, 12, snowMat);
    // road beyond the camera side and sidewalk curb
    this.box(40, 0.02, 3, this.mat('road', { color: 0x8a96a4, roughness: 0.8 }), 0, 0.01, 4.2);
    this.box(40, 0.14, 0.2, this.mat('curb', { color: 0xb0b8c0 }), 0, 0.07, 2.6);
    // hospital facade (back)
    const facade = this.mat('facade', { color: 0xc8c4bc, roughness: 0.9 });
    this.wall(-20, 20, 7, -3, facade, [{ x0: -2.2, x1: 0.2, y0: 0, y1: 2.6 }]);
    const glass = this.mat('hGlass', { color: 0x9ab0c0, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.3 });
    for (let x = -18; x <= 18; x += 3) for (const y of [1.6, 4.6]) {
      if (y < 3 && x > -4 && x < 2) continue;
      this.box(1.6, 1.3, 0.05, this.mat('winDark', { color: 0x3a4a5a, roughness: 0.2, metalness: 0.4 }), x, y, -2.96);
      this.box(1.7, 0.06, 0.12, this.mat('sillSnow', { color: 0xf4f8fa }), x, y - 0.68, -2.9);
    }
    this.box(2.4, 2.6, 0.05, glass, -1.0, 1.3, -3.02);
    const inside = this.plane(2.4, 2.6, new THREE.MeshBasicMaterial({ color: 0x8a9eae }), -1.0, 1.3, -3.4);
    inside.name = 'lobbyGlow';
    const canopy = this.box(4.0, 0.2, 2.0, this.mat('canopy', { color: 0x2a4a6a }), -1.0, 2.9, -2.1);
    this.box(4.1, 0.12, 2.1, snowMat, -1.0, 3.06, -2.1);
    const sign = this.textSign('WHITEHORSE GENERAL HOSPITAL', { w: 4.2, h: 0.42, bg: '#0e3a5a', fg: '#f4f8fa' });
    sign.position.set(-1.0, 3.7, -2.95); root.add(sign);
    this.anchors.door = { x: -1.0, z: -2.4 };
    // lamp posts, a bench, parked snowy car, distant town
    for (const x of [-9, 6]) {
      this.box(0.12, 4.2, 0.12, this.mat('post', { color: 0x2a2e34 }), x, 2.1, 1.8);
      const g = glow(0xffe0b0, 0.6, 0.3); g.position.set(x, 4.2, 1.8); root.add(g);
    }
    this.bench(4.0, -2.4, 1.8, 0x4a3a2a);
    this.box(1.9, 0.14, 0.5, snowMat, 4.0, 0.56, -2.4);
    const town = new THREE.Mesh(new THREE.PlaneGeometry(60, 12), new THREE.MeshBasicMaterial({ map: streetTexture('morning'), color: 0xe4eaf0, transparent: true, opacity: 0.0 }));
    town.position.set(0, 5, -30); root.add(town);
    // snow + cold daylight
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-14, 0, -3), new THREE.Vector3(14, 6, 4)), this.low ? 400 : 900);
    root.add(this.snow.points);
    this.animated.push(this.snow);
    const hemi = new THREE.HemisphereLight(0xdfe8f4, 0x8a96a4, 2.2);
    const sun = new THREE.DirectionalLight(0xe8eef8, 1.4);
    sun.position.set(-4, 8, 6);
    root.add(hemi, sun);
    root.fog = null;
    return root;
  }
}
