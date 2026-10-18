import * as THREE from 'three';

/**
 * Narrative Safe Zones.
 *
 * A safe zone is a story-important point (a character during a key scene, a
 * scripted event spot, an interactable, a spawn point, a key prop). Foreground
 * objects are checked against the active zones every few frames by casting
 * rays from the camera to sample points of each zone. When a foreground object
 * covers more of a zone than the zone allows, the object is faded out (and
 * restored when it no longer occludes). A static validation pass reports the
 * same problems for the scene's camera path, and the debug overlay (F3 or
 * `?debug=1`) shows zones, foreground bounds, walk bounds and violations.
 *
 *   zones.addZone({ id, pos | get: () => Vector3, radius, priority, maxOcclusion, active: () => bool })
 *   zones.addForeground(object3d, { minOpacity })
 */
const SAMPLE_DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];

export class SafeZones {
  constructor(name = 'scene') {
    this.name = name;
    this.zones = [];
    this.foreground = [];
    this.raycaster = new THREE.Raycaster();
    this.tmp = new THREE.Vector3();
    this.frame = 0;
    this.debug = false;
    this.violations = [];
  }

  addZone(z) {
    const zone = {
      radius: 0.4, priority: 1, maxOcclusion: 0.25, active: () => true, ...z,
    };
    zone.center = () => (zone.get ? zone.get() : zone.pos);
    this.zones.push(zone);
    return zone;
  }

  removeZone(id) { this.zones = this.zones.filter((z) => z.id !== id); }

  /** Registers a foreground object; its materials are cloned so it can fade on its own. */
  addForeground(obj, { minOpacity = 0.14, name } = {}) {
    const meshes = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.userData = { ...m.userData, fgBase: { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite } };
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
      meshes.push(o);
    });
    const entry = { obj, meshes, name: name || obj.name || `fg${this.foreground.length}`, opacity: 1, target: 1, minOpacity, box: new THREE.Box3() };
    this.foreground.push(entry);
    return entry;
  }

  /** Fraction (0..1) of the zone hidden by each foreground entry, from `camera`. */
  occlusion(zone, camera) {
    const center = zone.center();
    if (!center) return new Map();
    const camPos = camera.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const hits = new Map();
    for (const [dx, dy] of SAMPLE_DIRS) {
      const p = this.tmp.copy(center).addScaledVector(right, dx * zone.radius).addScaledVector(up, dy * zone.radius);
      const dir = p.clone().sub(camPos);
      const dist = dir.length();
      dir.normalize();
      this.raycaster.set(camPos, dir);
      this.raycaster.far = dist;
      for (const f of this.foreground) {
        if (!f.obj.visible) continue;
        if (!this.raycaster.ray.intersectsBox(f.box)) continue;
        if (this.raycaster.intersectObjects(f.meshes, false).length) hits.set(f, (hits.get(f) || 0) + 1);
      }
    }
    for (const [f, n] of hits) hits.set(f, n / SAMPLE_DIRS.length);
    return hits;
  }

  refreshBoxes() {
    for (const f of this.foreground) f.box.setFromObject(f.obj);
  }

  update(camera, dt) {
    this.frame++;
    if (this.frame % 4 === 0) {
      this.refreshBoxes();
      for (const f of this.foreground) f.target = 1;
      this.violations = [];
      for (const zone of this.zones) {
        if (!zone.active()) continue;
        for (const [f, frac] of this.occlusion(zone, camera)) {
          if (frac > zone.maxOcclusion) {
            f.target = Math.min(f.target, f.minOpacity);
            this.violations.push({ zone: zone.id, object: f.name, frac });
          }
        }
      }
    }
    for (const f of this.foreground) {
      const prev = f.opacity;
      f.opacity += (f.target - f.opacity) * Math.min(1, dt * 6);
      if (Math.abs(f.opacity - prev) < 1e-4 && f.opacity !== f.target) f.opacity = f.target;
      if (Math.abs(f.opacity - prev) > 1e-5 || f.opacity < 1) this.applyOpacity(f);
    }
    if (this.debug) this.updateDebug();
  }

  applyOpacity(f) {
    const fade = f.opacity < 0.995;
    for (const m of f.meshes) {
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const b = mat.userData.fgBase;
        const tr = fade || b.transparent;
        // three.js bakes "opaque" (alpha forced to 1) into the program: recompile when it flips
        if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
        mat.opacity = b.opacity * f.opacity;
        mat.depthWrite = fade ? false : b.depthWrite;
      }
    }
  }

  /**
   * Static check for a list of camera placements (e.g. the side-on path along
   * the room). Zones that only matter in scripted moments are included
   * (`always` = true ignores the active() predicate). Returns violations.
   */
  validate(cameras) {
    this.refreshBoxes();
    const out = [];
    for (const cam of cameras) {
      cam.updateMatrixWorld();
      for (const zone of this.zones) {
        for (const [f, frac] of this.occlusion(zone, cam)) {
          if (frac > zone.maxOcclusion && f.minOpacity >= 1) out.push({ zone: zone.id, object: f.name, frac, at: cam.position.toArray().map((v) => +v.toFixed(1)) });
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ debug view

  setDebug(on, parent, bounds) {
    this.debug = on;
    if (!on) { this.debugGroup?.removeFromParent(); this.debugGroup = null; return; }
    const g = this.debugGroup = new THREE.Group();
    g.renderOrder = 999;
    this.zoneMeshes = this.zones.map((z) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0x40ff80, wireframe: true, depthTest: false, transparent: true, opacity: 0.8 }));
      m.userData.zone = z;
      g.add(m);
      return m;
    });
    this.boxHelpers = this.foreground.map((f) => {
      const h = new THREE.Box3Helper(f.box, 0x3080ff);
      h.material.depthTest = false;
      h.userData.f = f;
      g.add(h);
      return h;
    });
    if (bounds) {
      const areas = bounds.areas || [bounds];
      for (const a of areas) {
        const pts = [[a.minX, a.minZ], [a.maxX, a.minZ], [a.maxX, a.maxZ], [a.minX, a.maxZ], [a.minX, a.minZ]].map(([x, z]) => new THREE.Vector3(x, 0.03, z));
        const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffd040, depthTest: false }));
        g.add(l);
      }
    }
    parent.add(g);
  }

  updateDebug() {
    if (!this.debugGroup) return;
    const bad = new Set(this.violations.map((v) => v.zone));
    const badObj = new Set(this.violations.map((v) => v.object));
    for (const m of this.zoneMeshes) {
      const z = m.userData.zone;
      const c = z.center();
      m.visible = !!c;
      if (!c) continue;
      m.position.copy(c);
      m.scale.setScalar(z.radius);
      m.material.color.set(!z.active() ? 0x606060 : bad.has(z.id) ? 0xff3030 : 0x40ff80);
    }
    for (const h of this.boxHelpers) h.material.color.set(badObj.has(h.userData.f.name) ? 0xff3030 : 0x3080ff);
  }
}
