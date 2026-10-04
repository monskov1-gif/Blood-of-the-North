import * as THREE from 'three';

/**
 * Fixed side-on cinematic camera. It never orbits: it slides along x
 * following a target, with optional "shots" (framing overrides) for
 * cutscenes, plus additive shake/sway used by the hallucination.
 */
export class CameraSystem {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 80);
    this.baseHeight = 2.4;
    this.baseDistance = 8.4;
    this.lookHeight = 1.28;
    this.lookZ = -0.6;
    this.bounds = { minX: -100, maxX: 100 };
    this.x = 0;
    this.target = null;
    this.shot = null;          // { x, y, z, lookX, lookY, lookZ, fov }
    this.shotBlend = 0;
    this.sway = 0;             // hallucination wobble amount
    this.fovOffset = 0;
    this.shake = 0;
    this.time = 0;
    this.lead = 0;
    this.aspect = 16 / 9;
  }

  setBounds(b) { this.bounds = b; }
  follow(target) { this.target = target; }

  /** Smoothly move to an explicit framing; pass null to return to follow mode. */
  setShot(shot, speed = 1.5) { this.shot = shot; this.shotSpeed = speed; if (shot) this.lastShot = shot; }

  resize(w, h) {
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    // keep a minimum visible width on narrow (portrait) screens
    const baseFov = 32;
    const minWidth = 6.2; // metres visible at the subject plane
    const dist = this.baseDistance;
    const hFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * this.aspect);
    const width = 2 * dist * Math.tan(hFov / 2);
    if (width < minWidth) {
      const needH = 2 * Math.atan(minWidth / (2 * dist));
      this.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(needH / 2) / this.aspect));
    } else {
      this.fov = baseFov;
    }
    this.camera.updateProjectionMatrix();
  }

  snap() {
    if (this.target) this.x = THREE.MathUtils.clamp(this.target.position.x, this.bounds.minX, this.bounds.maxX);
    this.shotBlend = this.shot ? 1 : 0;
    this.update(0);
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.target) {
      const vx = this.target.userData.vx || 0;
      this.lead = THREE.MathUtils.damp(this.lead, THREE.MathUtils.clamp(vx * 0.6, -1.2, 1.2), 1.5, dt);
      const desired = THREE.MathUtils.clamp(this.target.position.x + this.lead, this.bounds.minX, this.bounds.maxX);
      this.x = THREE.MathUtils.damp(this.x, desired, 3, dt);
    }
    const cam = this.camera;
    const follow = {
      x: this.x, y: this.baseHeight, z: this.baseDistance,
      lookX: this.x, lookY: this.lookHeight, lookZ: this.lookZ, fov: this.fov,
    };
    this.shotBlend = THREE.MathUtils.damp(this.shotBlend, this.shot ? 1 : 0, this.shotSpeed || 1.5, dt);
    const s = this.shot || this.lastShot || follow;
    const k = this.shotBlend;
    const lerp = (a, b) => a + (b - a) * k;
    const sfov = s.fov ?? follow.fov;
    cam.position.set(lerp(follow.x, s.x ?? follow.x), lerp(follow.y, s.y ?? follow.y), lerp(follow.z, s.z ?? follow.z));
    const look = new THREE.Vector3(lerp(follow.lookX, s.lookX ?? follow.lookX), lerp(follow.lookY, s.lookY ?? follow.lookY), lerp(follow.lookZ, s.lookZ ?? follow.lookZ));

    // hallucination: slow drunk sway + small shakes
    if (this.sway > 0) {
      cam.position.x += Math.sin(t * 0.6) * 0.25 * this.sway;
      cam.position.y += Math.sin(t * 0.9 + 1) * 0.12 * this.sway;
      look.x += Math.sin(t * 0.45 + 2) * 0.35 * this.sway;
      look.y += Math.cos(t * 0.7) * 0.15 * this.sway;
    }
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.1;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.1;
      this.shake = Math.max(0, this.shake - dt * 2);
    }
    cam.lookAt(look);
    if (this.sway > 0) cam.rotation.z += Math.sin(t * 0.5) * 0.03 * this.sway;
    cam.fov = lerp(follow.fov, sfov) + this.fovOffset + (this.sway > 0 ? Math.sin(t * 0.8) * 2.2 * this.sway : 0);
    cam.updateProjectionMatrix();
  }
}
