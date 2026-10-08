import * as THREE from 'three';
import { glowTexture, canvasTexture } from '../render/textures.js';
import { CharacterState } from './CharacterState.js';

const PX = 0.01; // metres per sprite pixel
// walk-cycle beats per second at normal walking speed (6 beats = two steps ≈ 1 s)
const WALK_BEATS = 6;

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
    this.material = this.makeMaterial(tex);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    this.sprite = new THREE.Mesh(geo, this.material);
    this.pivot = new THREE.Group();   // used for tilting / falling around the feet
    this.pivot.add(this.sprite);
    this.root.add(this.pivot);
    // painted "lying on the floor" frame (def.lie), shown instead of the tipped-over
    // standing sprite once the body is down; crossfaded while getting up
    this.lieFrameName = def.lie || null;
    this.lieAmount = 0;


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

  makeMaterial(tex) {
    const m = new THREE.MeshLambertMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color(this.def.selfLight ?? 0x8a7c74),
      emissiveIntensity: 1,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    m.userData.noLightingState = true;
    // corpse variant = same sprite, shader parameter: drained of colour, pale, cold
    m.onBeforeCompile = (shader) => {
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
    return m;
  }

  /** Painted lying frame for this character (bodies, Julian on the floor). */
  setLieFrame(name) {
    this.lieFrameName = name && this.atlas.has(name) ? name : null;
    if (this.lieMesh) this.lieMesh.userData.frame = null;
  }

  /**
   * Shows the lying frame with `amount` 0..1 (crossfade against the tipped
   * standing sprite). `dir` = which side the head lies on (+1 = right).
   * The feet stay at the root, like the tipped-over sprite.
   */
  showLie(amount, dir) {
    if (!this.lieFrameName) return false;
    if (!this.lieMesh) {
      const tex = this.atlas.texture.clone();
      tex.needsUpdate = true;
      const geo = new THREE.PlaneGeometry(1, 1);
      geo.translate(0, 0.5, 0);
      this.lieMesh = new THREE.Mesh(geo, this.makeMaterial(tex));
      if (this.def.layer) this.lieMesh.layers.set(this.def.layer);
      this.root.add(this.lieMesh);
    }
    const L = this.lieMesh;
    if (L.userData.frame !== this.lieFrameName || L.userData.dir !== dir) {
      const f = this.atlas.frame(this.lieFrameName);
      const [W, H] = this.atlas.size;
      const map = L.material.map;
      map.offset.set(f.x / W, 1 - (f.y + f.h) / H);
      map.repeat.set(f.w / W, f.h / H);
      // painted frames lie head-left: flip when the head goes to the right
      // (`s`: some frames use bigger pixels — cm per pixel)
      const px = PX * (f.s || 1);
      L.scale.set(f.w * px * (dir > 0 ? -1 : 1), f.h * px, 1);
      L.position.set(dir * f.w * px * 0.5, 0.004, 0.002);
      L.userData.frame = this.lieFrameName; L.userData.dir = dir;
      L.userData.w = f.w * px; L.userData.h = f.h * px;
    }
    this.lieAmount = amount;
    L.visible = amount > 0.001;
    this.pivot.visible = amount < 0.999;
    const fade = amount > 0.001 && amount < 0.999;
    // stochastic (hashed) alpha crossfade: no sorting issues between the two planes
    for (const [m, o] of [[L.material, amount], [this.material, 1 - amount]]) {
      if (m.alphaHash !== fade) { m.alphaHash = fade; m.alphaTest = fade ? 0 : 0.5; m.needsUpdate = true; }
      m.opacity = fade ? o : 1;
    }
    return true;
  }

  hideLie() {
    if (!this.lieMesh || (!this.lieMesh.visible && this.pivot.visible)) return;
    this.lieMesh.visible = false;
    this.pivot.visible = true;
    this.lieAmount = 0;
    for (const m of [this.lieMesh.material, this.material]) {
      if (m.alphaHash) { m.alphaHash = false; m.alphaTest = 0.5; m.needsUpdate = true; }
      m.opacity = 1;
    }
  }

  frameName() {
    let base = this.poses[this.pose] || this.poses.idle;
    if (this.state === 'walk' && !this.seated) {
      // walking uses the profile frame (`poses.walk`) when the idle frame is a front view
      const wb = this.poses.walk || this.poses.idle;
      // 6-beat cycle: each stride frame is held for two beats, the passing
      // (standing) frame for one — softer than flipping every beat
      const step = Math.floor(this.walkPhase) % 6;
      const w = step < 2 ? `${wb}_walk1` : step === 2 || step === 5 ? wb : `${wb}_walk2`;
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
    const px = PX * (f.s || 1);
    this.sprite.scale.set(f.w * px * this.facing, f.h * px, 1);
    // anchor: keep the torso centre over the root position whatever the frame width
    this.sprite.position.x = (f.w / 2 - f.ax) * px * this.facing;
    this.frameH = f.h * px;
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
  walkTo(points, { speed, direct = false } = {}) {
    let pts = Array.isArray(points) ? points : [points];
    // round furniture: every leg of the route goes through the scene's navigation (A*), unless
    // the script asks for a straight line (direct) or the character isn't in the active scene
    const nav = Character2D.nav;
    if (nav && !direct && this.root.parent && this.root.parent === Character2D.navRoot) {
      const out = [];
      let from = { x: this.position.x, z: this.position.z };
      for (const p of pts) {
        const leg = nav.findPath(from, p);
        out.push(...(leg || [p]));
        from = p;
      }
      pts = out;
    }
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
      this.walkPhase += dt * WALK_BEATS * Math.min(1.4, Math.hypot(vx, vz) / 1.3);
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
      this.hideLie();
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
        this.walkPhase += sdt * WALK_BEATS * (p.speed / 1.35);
        this.root.userData.vx = (dx / d) * p.speed;
        this.onStep?.(this);
      }
    }

    // idle life: breathing + tiny weight shift; walking: bob
    let sy = 1, bob = 0, tilt = 0;
    if (this.state === 'walk') {
      // rise on the passing beats (2 and 5), settle into the strides
      const u = this.walkPhase;
      bob = (0.5 + 0.5 * Math.cos(2 * Math.PI * (u - 2.5) / 3)) * 0.01;
      tilt = Math.sin(2 * Math.PI * u / 6) * 0.007;
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
    if (this.lieFrameName && (this.state === 'collapse' || this.state === 'rise')) {
      // down: the painted lying frame takes over at the end of the fall;
      // getting up: it fades into the tipped standing sprite over the first quarter
      const k = this.state === 'collapse' ? (this.fall >= 0.98 ? 1 : 0) : Math.min(1, Math.max(0, (this.fall - 0.72) / 0.26));
      this.showLie(k, this.fallDir);
    } else if (this.lieMesh?.visible) this.hideLie();
    this.applyFrame();
    this.sprite.scale.y = this.frameH * sy;
  }

  updateDead() {
    const lying = this.deadPose === 'lying';
    if (lying && this.showLie(1, this.deadDir)) {
      this.applyFrame();
      if (this.wounds?.visible) {
        // neck: a little in from the head end of the painted body
        if (this.wounds.parent !== this.root) this.root.add(this.wounds);
        const L = this.lieMesh.userData;
        this.wounds.position.set(this.deadDir * L.w * 0.86, L.h * 0.55, 0.012);
      }
      return;
    }
    if (this.lieMesh?.visible) this.hideLie();
    if (this.wounds && this.wounds.parent !== this.pivot) this.pivot.add(this.wounds);
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
