import * as THREE from 'three';
import { glowTexture, canvasTexture } from '../render/textures.js';
import { CharacterState } from './CharacterState.js';

const PX = 0.01; // metres per sprite pixel

/**
 * A fully 2D character living in the 3D scene: a lit, alpha-tested plane
 * placed at a world position, so the depth buffer sorts it against the
 * furniture naturally (no manual layering rules).
 *
 * Poses map to atlas frames: { idle, talk, think, raise, … }. Seated and
 * walking variants are found automatically (`<frame>_sit`, `<frame>_walk1/2`).
 */
export class Character2D {
  constructor(atlas, def) {
    this.atlas = atlas;
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.poses = def.poses;
    this.pose = 'idle';
    this.facing = def.facing ?? 1;
    this.seated = false;
    this.state = 'idle';
    this.timeScale = 1;
    this.speed = def.speed ?? 1.35;
    this.time = Math.random() * 10;
    this.breath = Math.random() * 6;
    this.dizzy = 0;
    this.fall = 0;
    this.walkPhase = 0;
    this.path = null;
    this.life = CharacterState.ALIVE;
    this.deadUniform = { value: 0 };

    this.root = new THREE.Group();
    this.root.name = `char:${def.id}`;
    this.root.userData.character = this;

    const tex = atlas.texture.clone();
    tex.needsUpdate = true;
    this.tex = tex;
    this.material = new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(def.selfLight ?? 0x8a7c74),
      emissiveIntensity: 1,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.material.userData.noLightingState = true;
    // corpse variant = same sprite, shader parameter: drained of colour, pale, cold
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms.uDead = this.deadUniform;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDead;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float lumD = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 pale = mix(vec3(lumD), diffuseColor.rgb, 0.28) * vec3(0.92, 0.97, 1.06) + 0.05;
          diffuseColor.rgb = mix(diffuseColor.rgb, pale, uDead);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(dot(totalEmissiveRadiance, vec3(0.333))) * vec3(0.8, 0.88, 1.0), uDead);`);
    };
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    this.sprite = new THREE.Mesh(geo, this.material);
    this.pivot = new THREE.Group();   // used for tilting / falling around the feet
    this.pivot.add(this.sprite);
    this.root.add(this.pivot);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.36),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, userData: { noLightingState: true } }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.renderOrder = 3;
    this.shadow = shadow;
    this.root.add(shadow);

    if (def.layer) this.sprite.layers.set(def.layer);
    this.applyFrame();
  }

  get position() { return this.root.position; }

  frameName() {
    let base = this.poses[this.pose] || this.poses.idle;
    if (this.state === 'walk' && !this.seated) {
      // walking uses the profile frame (`poses.walk`) when the idle frame is a front view
      const wb = this.poses.walk || this.poses.idle;
      const step = Math.floor(this.walkPhase) % 4;
      const w = step === 0 ? `${wb}_walk1` : step === 2 ? `${wb}_walk2` : wb;
      base = this.atlas.has(w) ? w : wb;
    }
    if (this.seated) {
      const s = `${base}_sit`;
      if (this.atlas.has(s)) return s;
    }
    return base;
  }

  applyFrame() {
    const name = this.frameName();
    if (name === this.currentFrame && this.facing === this.appliedFacing) return;
    this.currentFrame = name;
    this.appliedFacing = this.facing;
    const f = this.atlas.frame(name);
    const [W, H] = this.atlas.size;
    this.tex.offset.set(f.x / W, 1 - (f.y + f.h) / H);
    this.tex.repeat.set(f.w / W, f.h / H);
    this.sprite.scale.set(f.w * PX * this.facing, f.h * PX, 1);
    // anchor: keep the torso centre over the root position whatever the frame width
    this.sprite.position.x = (f.w / 2 - f.ax) * PX * this.facing;
    this.frameH = f.h * PX;
  }

  setPose(pose) { if (this.poses[pose]) this.pose = pose; }

  face(dir) { if (dir) this.facing = dir > 0 ? 1 : -1; }

  faceTowards(x) { this.face(x - this.position.x); }

  placeAt(x, z, facing) {
    this.root.position.set(x, 0, z);
    if (facing) this.face(facing);
  }

  sit(seat, facing) {
    this.seated = true;
    this.state = 'idle';
    this.path = null;
    if (seat) this.root.position.set(seat.x, 0, seat.z);
    if (facing) this.face(facing);
    this.shadow.visible = false;
  }

  stand() { this.seated = false; this.shadow.visible = true; }

  /** Walk in a straight line (or through waypoints). Resolves on arrival. */
  walkTo(points, { speed } = {}) {
    const pts = Array.isArray(points) ? points : [points];
    this.stand();
    return new Promise((resolve) => {
      this.path = { pts: pts.map((p) => new THREE.Vector2(p.x, p.z)), i: 0, speed: speed ?? this.speed, resolve };
      this.state = 'walk';
    });
  }

  stop() {
    this.path?.resolve?.();
    this.path = null;
    if (this.state === 'walk') this.state = 'idle';
  }

  /** Gradual faint to the floor. Resolves when on the ground. */
  /** Lie on the floor (already fallen), e.g. waking up after a blackout. */
  lieDown(direction = 1) {
    this.stand();
    this.state = 'collapse';
    this.fallDir = direction;
    this.fall = 1;
    this.onFallen = null;
  }

  /** Slowly get up from the floor (reverse of collapse). */
  riseUp(seconds = 3) {
    this.state = 'rise';
    this.riseSpeed = 1 / seconds;
    return new Promise((resolve) => { this.onRisen = resolve; });
  }

  collapse(direction = 1) {
    this.state = 'collapse';
    this.stand();
    this.fallDir = direction;
    return new Promise((resolve) => { this.onFallen = resolve; });
  }

  /** Called by the player controller every frame while moving manually. */
  driveWalk(vx, vz, dt) {
    const moving = Math.hypot(vx, vz) > 0.01;
    this.state = moving ? 'walk' : (this.state === 'walk' ? 'idle' : this.state);
    if (moving) {
      this.walkPhase += dt * 7.5 * Math.min(1.4, Math.hypot(vx, vz) / 1.3);
      if (Math.abs(vx) > 0.02) this.face(vx);
    }
    this.root.userData.vx = vx;
  }

  /**
   * ALIVE / DEAD (+ reserved states). DEAD: no idle motion, desaturated pale
   * shader variant, a pose ('lying' on the floor or 'slumped' in a seat) and
   * an optional neck-wound overlay.
   */
  setLife(state, { pose = 'lying', dir = 1, wounds = true, tilt } = {}) {
    this.life = state;
    const dead = state === CharacterState.DEAD;
    this.deadUniform.value = dead ? 1 : 0;
    this.path = null;
    this.root.visible = state !== CharacterState.HIDDEN;
    this.deadPose = dead ? pose : null;
    this.deadDir = dir;
    this.deadTilt = tilt;
    if (dead) {
      this.state = 'dead';
      this.shadow.visible = pose === 'lying';
      this.shadow.scale.set(1.9, 1, 1);
      this.shadow.material.opacity = 0.4;
      if (wounds) this.addWounds();
    } else {
      if (this.state === 'dead') this.state = 'idle';
      this.shadow.scale.set(1, 1, 1);
      this.shadow.material.opacity = 0.55;
      if (this.wounds) this.wounds.visible = false;
    }
  }

  get isDead() { return this.life === CharacterState.DEAD; }

  addWounds() {
    if (!this.wounds) {
      const tex = canvasTexture('neck-wounds', 16, 8, (ctx) => {
        ctx.fillStyle = 'rgba(70,0,8,0.95)';
        ctx.fillRect(3, 3, 2, 2); ctx.fillRect(10, 3, 2, 2);
        ctx.fillStyle = 'rgba(120,10,20,0.6)';
        ctx.fillRect(3, 5, 2, 1); ctx.fillRect(10, 5, 2, 1);
      }, { color: true, nearest: true, aniso: 1 });
      this.wounds = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.04), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      this.wounds.renderOrder = 6;
      this.pivot.add(this.wounds);
    }
    this.wounds.visible = true;
  }

  update(dt) {
    if (this.life === CharacterState.DEAD) { this.updateDead(); return; }
    const sdt = dt * this.timeScale;
    this.time += sdt;
    const t = this.time;

    if (this.path) {
      const p = this.path;
      const target = p.pts[p.i];
      const dx = target.x - this.position.x, dz = target.y - this.position.z;
      const d = Math.hypot(dx, dz);
      const step = p.speed * sdt;
      if (d <= step) {
        this.position.x = target.x; this.position.z = target.y;
        p.i++;
        if (p.i >= p.pts.length) {
          this.path = null; this.state = 'idle'; this.walkPhase = 0;
          this.root.userData.vx = 0;
          p.resolve?.();
        }
      } else {
        this.position.x += (dx / d) * step;
        this.position.z += (dz / d) * step;
        if (Math.abs(dx) > 0.01) this.face(dx);
        this.walkPhase += sdt * 7.5 * (p.speed / 1.35);
        this.root.userData.vx = (dx / d) * p.speed;
        this.onStep?.(this);
      }
    }

    // idle life: breathing + tiny weight shift; walking: bob
    let sy = 1, bob = 0, tilt = 0;
    if (this.state === 'walk') {
      const ph = this.walkPhase * Math.PI / 2;
      bob = Math.abs(Math.sin(ph)) * 0.015;
      tilt = Math.sin(ph) * 0.012;
    } else if (this.state !== 'collapse' && this.state !== 'rise') {
      sy = 1 + Math.sin(t * 1.6 + this.breath) * 0.006;
      tilt = Math.sin(t * 0.37 + this.breath) * 0.006;
    }
    if (this.dizzy > 0 && this.state !== 'collapse' && this.state !== 'rise') {
      tilt += Math.sin(t * 1.1) * 0.06 * this.dizzy + Math.sin(t * 2.7) * 0.015 * this.dizzy;
    }
    if (this.state === 'collapse') {
      this.fall = Math.min(1, this.fall + sdt * (0.35 + this.fall * 2.4));
      const e = this.fall * this.fall;
      tilt = -this.fallDir * e * (Math.PI / 2 - 0.08);
      bob = -e * 0.05;
      if (this.fall >= 1 && this.onFallen) { const f = this.onFallen; this.onFallen = null; f(); }
    } else if (this.state === 'rise') {
      this.fall = Math.max(0, this.fall - sdt * this.riseSpeed * (0.6 + this.fall));
      const e = this.fall * this.fall;
      tilt = -this.fallDir * e * (Math.PI / 2 - 0.08) + Math.sin(t * 7) * 0.02 * this.fall;
      bob = -e * 0.05;
      if (this.fall <= 0) { this.state = 'idle'; const f = this.onRisen; this.onRisen = null; f?.(); }
    }
    this.pivot.rotation.z = tilt;
    this.pivot.position.y = bob;
    this.applyFrame();
    this.sprite.scale.y = this.frameH * sy;
  }

  updateDead() {
    const lying = this.deadPose === 'lying';
    const tilt = this.deadTilt ?? (lying ? Math.PI / 2 - 0.04 : 0.32);
    this.pivot.rotation.z = -this.deadDir * tilt;
    this.pivot.position.y = lying ? 0.02 : 0;
    this.applyFrame();
    this.sprite.scale.y = this.frameH;
    if (this.wounds?.visible) {
      // neck: just under the head, over the torso centre line
      const h = this.frameH;
      this.wounds.position.set(this.sprite.position.x * 0.2 + 0.03 * this.facing, h * (this.seated ? 0.8 : 0.845), 0.012);
    }
  }

  setVisible(v) { this.root.visible = v; }
}
