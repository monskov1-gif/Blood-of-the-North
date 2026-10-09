import * as THREE from 'three';
import { glowTexture } from '../render/textures.js';

/** Floating dust motes (warm, catching the light) inside a box volume. */
export class Dust {
  constructor(box, count = 400, color = 0xffd2a0, size = 0.035) {
    this.box = box;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
      pos[i * 3 + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random());
      pos[i * 3 + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
      this.vel[i * 3] = (Math.random() - 0.5) * 0.04;
      this.vel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.material = new THREE.PointsMaterial({
      size, map: glowTexture(), color, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.speed = 1;
  }

  update(dt, t) {
    const p = this.points.geometry.attributes.position.array;
    const b = this.box;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += (this.vel[i] + Math.sin(t * 0.3 + i) * 0.01) * dt * this.speed;
      p[i + 1] += (this.vel[i + 1] + Math.cos(t * 0.2 + i) * 0.006) * dt * this.speed;
      p[i + 2] += this.vel[i + 2] * dt * this.speed;
      if (p[i] < b.min.x) p[i] = b.max.x; else if (p[i] > b.max.x) p[i] = b.min.x;
      if (p[i + 1] < b.min.y) p[i + 1] = b.max.y; else if (p[i + 1] > b.max.y) p[i + 1] = b.min.y;
      if (p[i + 2] < b.min.z) p[i + 2] = b.max.z; else if (p[i + 2] > b.max.z) p[i + 2] = b.min.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

/** Snow falling outside the window. */
export class Snow {
  constructor(box, count = 500) {
    this.box = box;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = THREE.MathUtils.lerp(box.min.x, box.max.x, Math.random());
      pos[i * 3 + 1] = THREE.MathUtils.lerp(box.min.y, box.max.y, Math.random());
      pos[i * 3 + 2] = THREE.MathUtils.lerp(box.min.z, box.max.z, Math.random());
      this.speeds[i] = 0.3 + Math.random() * 0.5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.035, map: glowTexture(), color: 0xdfe8ff, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.speed = 1;
  }

  update(dt, t) {
    const p = this.points.geometry.attributes.position.array;
    const b = this.box;
    for (let i = 0, k = 0; i < p.length; i += 3, k++) {
      p[i + 1] -= this.speeds[k] * dt * this.speed;
      p[i] += Math.sin(t * 0.8 + k) * 0.15 * dt * this.speed;
      if (p[i + 1] < b.min.y) { p[i + 1] = b.max.y; p[i] = THREE.MathUtils.lerp(b.min.x, b.max.x, Math.random()); }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
