import * as THREE from 'three';
import { LocationBase } from '../LocationBase.js';
import { streetTexture, canvasTexture, glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { Snow } from '../Particles.js';

/**
 * Police car — a side-on cut-away of the cabin (the near side is open, like a
 * dollhouse). Julian sits in the back behind the partition, the officer
 * drives. The town scrolls past the far windows in parallax layers.
 * x: rear (-) → front (+). Camera looks in from +z.
 */
export class PoliceCarScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'car';
    this.title = 'Полицейская машина';
    this.background = 0x0a0d12;
    this.camera = { distance: 4.6, height: 1.35, lookHeight: 1.0, lookZ: -0.2, fov: 34, minWidth: 4.2 };
    this.bounds = { walk: { minX: -1.9, maxX: 2.2, minZ: 0.2, maxZ: 0.2 }, camera: { minX: 0.1, maxX: 0.1 } };
    this.speed = 9; // m/s of the outside layers
  }

  build() {
    const root = this.root;
    const body = this.mat('carInterior', { color: 0x3a3e44, roughness: 0.8 });
    const plastic = this.mat('carPlastic', { color: 0x2a2c30, roughness: 0.6 });
    const vinyl = this.mat('carVinyl', { color: 0x2a2e34, roughness: 0.55, metalness: 0.1 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });

    // shell: floor, roof, far side with window openings, front and rear
    this.box(5.2, 0.08, 1.8, body, 0.2, 0.25, -0.6);
    this.box(5.0, 0.06, 1.8, body, 0.2, 1.72, -0.6);
    const far = this.wall(-2.4, 2.8, 1.5, -1.45, body, [
      { x0: -2.0, x1: -0.15, y0: 0.72, y1: 1.32 },
      { x0: 0.25, x1: 2.2, y0: 0.72, y1: 1.32 },
    ]);
    far.position.y = 0.25;
    this.box(0.08, 1.5, 1.8, body, -2.4, 1.0, -0.6);
    // windscreen frame (front, angled)
    const ws = this.box(0.06, 0.8, 1.8, this.mat('carGlass', { color: 0x22303c, transparent: true, opacity: 0.35, roughness: 0.05 }), 2.7, 1.35, -0.6);
    ws.rotation.z = -0.5;
    // door panel trims
    this.box(4.4, 0.3, 0.06, plastic, 0.2, 0.82, -1.4);
    this.box(0.06, 0.8, 0.06, plastic, 0.05, 1.25, -1.4); // B pillar
    // back bench + front seat
    this.box(1.3, 0.14, 1.4, vinyl, -1.25, 0.52, -0.6);
    this.box(0.16, 0.7, 1.4, vinyl, -1.95, 0.9, -0.6).rotation.z = 0.12;
    this.box(0.6, 0.14, 0.6, vinyl, 1.15, 0.55, -0.3);
    this.box(0.14, 0.72, 0.6, vinyl, 0.82, 0.95, -0.3).rotation.z = 0.1;
    this.box(0.18, 0.2, 0.26, vinyl, 0.78, 1.42, -0.3); // headrest
    // partition cage between front and back
    const cage = new THREE.Group();
    this.box(0.05, 1.1, 1.6, this.mat('cagePlex', { color: 0x9ab0c0, transparent: true, opacity: 0.12, roughness: 0.05 }), 0, 0.6, 0, cage);
    for (let i = 0; i < 9; i++) this.box(0.02, 1.1, 0.02, steel, 0.02, 0.6, -0.75 + i * 0.19, cage);
    for (let j = 0; j < 4; j++) this.box(0.02, 0.02, 1.6, steel, 0.02, 0.15 + j * 0.3, 0, cage);
    cage.position.set(0.5, 0.6, -0.6);
    root.add(cage);
    this.anchors.cage = new THREE.Vector3(0.52, 1.25, -0.2);
    // dashboard, wheel, radio, laptop mount
    this.box(0.7, 0.3, 1.7, plastic, 2.35, 0.95, -0.6);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), plastic);
    wheel.position.set(1.85, 1.15, -0.3); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0.4;
    root.add(wheel);
    this.wheel = wheel;
    const radio = this.box(0.16, 0.1, 0.24, this.mat('radio', { color: 0x101214, roughness: 0.4 }), 2.05, 1.05, -0.95);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), this.mat('radioLed', { color: 0, emissive: 0x40ff60, emissiveIntensity: 3 }));
    led.position.set(2.0, 1.06, -0.82); led.rotation.y = Math.PI / 2;
    root.add(led);
    this.radioLed = led;
    this.anchors.radio = new THREE.Vector3(2.05, 1.1, -0.95);
    const screen = this.box(0.04, 0.24, 0.34, this.mat('laptop', { color: 0x000000, emissive: 0x2a5070, emissiveIntensity: 1.4 }), 2.0, 1.3, -0.95);
    screen.rotation.z = 0.2;
    const dashGlow = glow(0x5a9ac8, 1.0, 0.25);
    dashGlow.position.set(1.95, 1.2, -0.8);
    root.add(dashGlow);
    // water bottle in the door pocket (given by the officer)
    const bottle = new THREE.Group();
    const bmat = new THREE.MeshStandardMaterial({ color: 0xcfe6f6, transparent: true, opacity: 0.55, roughness: 0.05 });
    this.box(0.07, 0.24, 0.07, bmat, 0, 0.12, 0, bottle);
    this.box(0.04, 0.03, 0.04, this.mat('cap', { color: 0x2060c0 }), 0, 0.26, 0, bottle);
    bottle.position.set(1.0, 0.95, -1.2);
    bottle.visible = false;
    root.add(bottle);
    this.bottle = bottle;

    // outside: parallax layers behind the far windows
    const street = streetTexture('morning').clone();
    street.needsUpdate = true;
    street.wrapS = THREE.RepeatWrapping;
    street.repeat.set(1.4, 1);
    this.streetTex = street;
    const far1 = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), new THREE.MeshBasicMaterial({ map: street, color: 0xc8d2de }));
    far1.position.set(0.2, 1.5, -6.5);
    root.add(far1);
    // passing posts / trees (near parallax)
    this.posts = [];
    const postMat = new THREE.MeshBasicMaterial({ color: 0x2a2e34 });
    const treeMat = new THREE.MeshBasicMaterial({ color: 0x1c2420 });
    for (let i = 0; i < 6; i++) {
      const tree = i % 2 === 0;
      const m = new THREE.Mesh(tree ? new THREE.ConeGeometry(0.55, 2.6, 6) : new THREE.BoxGeometry(0.12, 3.4, 0.12), tree ? treeMat : postMat);
      m.position.set(-6 + i * 2.6, tree ? 1.3 : 1.7, -2.8 - (i % 3) * 0.5);
      root.add(m);
      this.posts.push(m);
    }
    // snow streaks outside
    this.snow = new Snow(new THREE.Box3(new THREE.Vector3(-4, 0.2, -4), new THREE.Vector3(4, 3, -1.8)), this.low ? 150 : 300);
    root.add(this.snow.points);
    this.animated.push(this.snow);
    // dark ground outside + road
    this.box(14, 0.05, 6, new THREE.MeshBasicMaterial({ color: 0xbcc8d4 }), 0, -0.05, -4.5);

    // lights: cold daylight from the windows, dash glow, a soft fill on Julian
    const hemi = new THREE.HemisphereLight(0xaab8cc, 0x30343a, 2.6);
    const day = new THREE.DirectionalLight(0xd6e2f4, 1.6);
    day.position.set(-1, 3, -4);
    const fill = new THREE.PointLight(0xc8d4e8, 12, 6, 1.3);
    fill.position.set(-1.0, 1.6, 0.8);
    const dash = new THREE.PointLight(0x5a9ac8, 2.5, 2.5, 1.6);
    dash.position.set(1.9, 1.25, -0.5);
    root.add(hemi, day, fill, dash);
    this.lights = { hemi, day, fill, dash };

    // anchors
    this.anchors.julianSeat = new THREE.Vector3(-1.15, 0.3, -0.35);
    this.anchors.driverSeat = new THREE.Vector3(1.2, 0.33, -0.1);
    this.anchors.window = new THREE.Vector3(-1.1, 1.25, -1.4);
    this.anchors.cuffs = new THREE.Vector3(-0.95, 0.95, -0.2);
    this.anchors.outsideFront = new THREE.Vector3(1.2, 1.25, -1.4);
    return root;
  }

  update(dt) {
    super.update(dt);
    const t = this.time;
    this.streetTex.offset.x += dt * this.speed * 0.006;
    for (const p of this.posts) {
      p.position.x -= dt * this.speed * (0.6 + (-p.position.z - 2.8) * 0.1);
      if (p.position.x < -7) p.position.x += 15.6;
    }
    // engine/road vibration and the wheel's small corrections
    this.root.position.y = Math.sin(t * 23) * 0.004 + Math.sin(t * 3.1) * 0.006;
    this.wheel.rotation.x = 0.4 + Math.sin(t * 0.7) * 0.06;
    this.radioLed.material.emissiveIntensity = Math.random() < 0.02 ? 6 : 3;
  }
}
