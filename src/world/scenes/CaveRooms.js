import * as THREE from 'three';
import { flareSource } from '../../fx/WindowLight.js';
import { glowTexture } from '../../render/textures.js';
import { glow } from '../props.js';
import { fbm3, rockGeometry, roundedBox, shaftTexture } from '../nature.js';
import { CaveBase, BACK, V3, sat, bloodTex, dragTex, outsideTex, archMask, fabricTex, taperTube } from './CaveScene.js';

/**
 * The chambers around the hall (see CaveScene.js for the map and the construction).
 * Every one is a location of its own; the passages are Places.js doors.
 */

// ==================================================================== the den

/** `cave_den` — where the pack sleeps: furs, bones, a deer carcass, their folded human clothes. */
export class CaveDenScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_den', title: 'Пещера · логово', x0: -9.5, x1: 9.5, nx: -37,
      openings: [
        { x: 7.0, w: 1.9, h: 2.4, tint: 0x8a6040, door: { id: 'den_hall', label: 'В зал', to: 'cave', spawn: { x: -9.6, z: -1.5, facing: 1 } } },
      ],
      cam: { minX: -4.8, maxX: 4.8 },
      torches: [-3.2, 4.0],
      lights: [[-0.6, 0.6, 0.9]],
      fg: [[-8.0, 1.3, 0.75], [-2.4, 1.0, 0.5], [3.4, 1.1, 0.55], [8.6, 1.2, 0.7]],
      lips: [[-5.8, 0.42, 1.1], [1.8, 0.36, 0.9]],
    });
  }

  buildRoom() {
    const g = this.root;
    // their beds: furs pressed into hollows in the sand
    for (const [x, z, rot, c] of [[-6.8, -1.5, 0.3, 0x4a3a2c], [-4.4, -0.5, -0.5, 0x5a4a3a], [-2.0, -1.8, 0.9, 0x3a2e24], [0.9, -0.6, -0.2, 0x6a5a48], [2.9, -1.8, 0.4, 0x4a3a2c]]) this.pelt(x, z, rot, g, c, 0.1, 0.95, 0.6);
    // bones: the pile at the far wall, another by the clothes
    this.bonePile(-7.8, -2.45, 14, g, 2);
    this.colliders.push({ x: -7.8, z: -2.45, r: 0.45 });
    this.bonePile(4.0, -2.55, 8, g, 1);
    this.colliders.push({ x: 4.0, z: -2.55, r: 0.35 });
    // a deer carcass: spine, ribs, the head with its antlers on the sand
    const bone = this.boneMat();
    const cz = -2.3, cx = -3.9;
    const spine = new THREE.Mesh(taperTube([V3(0, -0.65, 0), V3(0.03, 0, 0.01), V3(0, 0.65, 0)], 0.04, 0.022, 12, 7), bone); spine.rotation.z = Math.PI / 2; spine.position.set(cx, 0.32, cz); g.add(spine);
    for (let i = 0; i < 8; i++) {
      const x = cx - 0.45 + i * 0.13;
      for (const s of [-1, 1]) {
        const k = 0.75 + Math.sin(i * 0.9) * 0.25, br = i === 2 && s > 0;    // one rib snapped off
        const pts = [V3(x, 0.32, cz), V3(x + 0.02, 0.26, cz + s * 0.2 * k), V3(x + 0.04, 0.08 + (1 - k) * 0.1, cz + s * 0.28 * k), V3(x + 0.05, 0.0 + (1 - k) * 0.08, cz + s * 0.22 * k)];
        g.add(new THREE.Mesh(taperTube(br ? pts.slice(0, 3) : pts, 0.016, 0.007, 8, 5), bone));
      }
    }
    const meat = new THREE.Mesh(rockGeometry(1205, { detail: 3, rough: 0.4, flat: -1, colA: 0x6a2a1c, colB: 0x3a1410, dark: 0.5 }), this.mat('meatV', { vertexColors: true, color: 0xffffff, roughness: 0.6 }));
    meat.scale.set(0.5, 0.12, 0.25); meat.position.set(cx + 0.1, 0.06, cz); g.add(meat);
    const head = this.antlers(cx + 0.95, 0.2, cz + 0.2, bone); head.rotation.set(-1.2, 0.4, 0.2);
    head.children.slice(-2).forEach((m) => { m.visible = false; });   // no plaque and peg on the floor
    g.add(head);
    this.colliders.push({ x: cx, z: cz, r: 0.6 }, { x: cx + 0.9, z: cz + 0.1, r: 0.35 });
    // their clothes, folded: jackets, jeans, boots — for when they walk on two legs
    const cl = [0x3a4a5a, 0x5a3a2a, 0x2a2a2a, 0x3a4a6a, 0x6a5a3a, 0x4a2a2a];
    cl.forEach((c, i) => {
      const m = new THREE.Mesh(roundedBox(0.5 - (i % 3) * 0.04, 0.07, 0.36, 0.03), this.mat(`cloth${c}`, { color: c, map: fabricTex(), roughness: 1 }));
      m.position.set(1.5 + (i % 2) * 0.08, 0.04 + i * 0.07, -2.55 + (i % 3) * 0.03); m.rotation.y = (i % 3 - 1) * 0.15; g.add(m);
    });
    for (let i = 0; i < 3; i++) {
      const boot = new THREE.Mesh(roundedBox(0.3, 0.12, 0.12, 0.05), this.mat('boot', { color: 0x3a2a1c, roughness: 0.9 })); boot.position.set(2.2 + i * 0.16, 0.06, -2.2 + (i % 2) * 0.1); boot.rotation.y = 0.3 + i * 0.2; g.add(boot);
      const shaft = new THREE.Mesh(roundedBox(0.11, 0.2, 0.12, 0.04), this.mats.cache.get('boot')); shaft.position.set(-0.08, 0.13, 0); boot.add(shaft);
    }
    this.colliders.push({ x: 1.7, z: -2.5, r: 0.4 });
    // their fire, antlers on the rock, days scratched into the wall by somebody before us
    this.denFire = this.fire(-0.6, -1.0, 0.8, g);
    this.wallAntlers(-5.4, 2.0, g);
    this.wallAntlers(-0.9, 2.15, g);
    this.wallMark('tally', 5.2, 1.25, 0.7, g);
    this.stalagmite(1210, -5.6, 0.5, 1.2, 0.3);
    this.stalagmite(1211, 5.2, 0.35, 1.0, 0.26);
    this.solidBoulder(1212, -8.6, -0.3, 0.7, 0.7, 0.55);
    this.anchors.furs = V3(-4.4, 0.4, -0.5);
    this.anchors.bones = V3(-7.8, 0.5, -2.45);
    this.anchors.carcass = V3(-3.9, 0.6, -2.3);
    this.anchors.clothes = V3(1.7, 0.6, -2.5);
    this.anchors.marks = V3(5.2, 1.3, -2.6);
    this.anchors.fire = V3(-0.6, 0.5, -1.0);
  }

  roomState(name) {
    this.setFire(this.denFire, name === 'L4');
  }
}

// ==================================================================== the deep passage

/** `cave_deep` — the narrow winding passage from the hall down to the slab. Low, wet, scratched. */
export class CaveDeepScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_deep', title: 'Пещера · узкий ход', x0: -9.5, x1: 9.5, nx: 61,
      openings: [
        { x: -7.6, w: 1.5, h: 2.0, tint: 0x601414, tintOpacity: 0.0, door: { id: 'deep_altar', label: 'Дальше, вглубь', to: 'cave_altar', spawn: { x: 4.7, z: -1.1, facing: -1 } } },
        { x: 7.6, w: 1.5, h: 2.0, tint: 0x8a6040, door: { id: 'deep_hall', label: 'В зал', to: 'cave', spawn: { x: -0.6, z: -1.6, facing: 1 } } },
      ],
      minZ: -1.6, maxZ: 0.35,
      vault: 3.15, lean: 2.0, distance: 7.0, ambient: 1.0,
      cam: { minX: -4.8, maxX: 4.8 },
      torches: [-3.8, 4.2],
      fg: [[-7.0, 1.4, 0.95], [-1.4, 1.2, 0.8], [4.2, 1.3, 0.85], [8.6, 1.2, 0.85]],
      lips: [[-4.4, 0.45, 1.2], [1.4, 0.42, 1.1], [6.4, 0.42, 1.2]],
    });
  }

  buildRoom() {
    const g = this.root;
    // the passage pinches: rock bulges from the wall, columns in the way
    this.solidBoulder(1301, -5.4, -2.05, 0.85, 1.1, 0.65);
    this.solidBoulder(1302, 1.9, -2.1, 0.75, 0.95, 0.6);
    this.stalagmite(1303, -3.2, -1.55, 1.5, 0.32);
    this.stalagmite(1304, 3.7, -1.6, 1.2, 0.28);
    this.stalagmite(1305, -0.4, 0.62, 0.9, 0.26);
    this.stalagmite(1306, 5.6, 0.55, 1.0, 0.24);
    // water drips from the vault into a dark pool
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), this.mat('cavePool', { color: 0x3a3028, metalness: 0.75, roughness: 0.12 }));
    pool.rotation.x = -Math.PI / 2; pool.scale.set(1.4, 0.7, 1); pool.position.set(1.0, 0.018, -0.65); g.add(pool);
    this.stalactite(1307, 1.0, -0.7, 0.5, 0.12, g, 3.05);
    // claw furrows cut into the soft rock at shoulder height
    this.wallMark('claw', -1.9, 1.25, 0.75, g);
    this.wallMark('claw', -1.1, 0.95, 0.55, g);
    // drag marks along the floor (L4 onward) and Olivia's sweater caught on a rock (L5)
    this.drag = new THREE.Group(); g.add(this.drag);
    for (let i = 0; i < 5; i++) this.floorDecal(dragTex(), 6.0 - i * 3.0, -0.7 + Math.sin(i) * 0.25, 3.2, 0.6, Math.sin(i * 1.3) * 0.12, this.drag, 0.85);
    this.sweater = new THREE.Group(); g.add(this.sweater);
    const sw = new THREE.Mesh(roundedBox(0.22, 0.02, 0.16, 0.008), this.mat('sweater', { color: 0x8a1a1a, roughness: 1 }));
    sw.position.set(-3.0, 0.05, -1.05); sw.rotation.y = 0.5; this.sweater.add(sw);
    const deerKnit = new THREE.Mesh(roundedBox(0.08, 0.022, 0.05, 0.006), this.mat('sweaterW', { color: 0xe0d8c8, roughness: 1 }));
    deerKnit.position.set(-2.98, 0.06, -1.03); deerKnit.rotation.y = 0.5; this.sweater.add(deerKnit);
    for (let i = 0; i < 3; i++) { const d = this.floorDecal(bloodTex(4 + i), -4.6 + i * 1.7, -0.9 + i * 0.2, 0.35, 0.35, i, this.sweater, 0.9); d.position.y = 0.021; }
    // the red of the chamber below, seen down the passage (L5)
    this.redLight = new THREE.PointLight(0xc03a20, 0, 6, 1.4); this.redLight.position.set(-7.6, 1.0, -2.4); g.add(this.redLight);
    this.anchors.pool = V3(1.0, 0.4, -0.65);
    this.anchors.claws = V3(-1.6, 1.2, -2.8);
    this.anchors.sweater = V3(-3.0, 0.3, -1.05);
    this.anchors.drag = V3(2.6, 0.3, -0.7);
  }

  roomState(name) {
    const L5 = name === 'L5';
    this.drag.visible = name === 'L4' || L5;
    this.sweater.visible = L5;
    this.redLight.intensity = L5 ? 7 : 0;
    const o = this.cfg.openings[0];
    if (o.glowSprite) o.glowSprite.material.opacity = L5 ? 0.35 : 0;
  }
}

// ==================================================================== the altar

/** `cave_altar` — the chamber of the slab: old blood soaked into the stone, skulls, antlers, red fire. */
export class CaveAltarScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_altar', title: 'Пещера · камень', x0: -8.5, x1: 7.5, nx: 113,
      openings: [
        { x: 5.6, w: 1.6, h: 2.2, tint: 0x8a6040, tintOpacity: 0.12, door: { id: 'altar_deep', label: 'Назад', to: 'cave_deep', spawn: { x: -7.0, z: -0.7, facing: 1 } } },
      ],
      cam: { minX: -4.0, maxX: 3.0 },
      torches: [-4.2, 1.4],
      lights: [[-1.6, 1.5, 0.9], [3.0, 0.6, 0.9]],
      fg: [[-7.4, 1.3, 0.75], [-3.0, 1.0, 0.5], [2.2, 1.0, 0.55], [6.8, 1.2, 0.7]],
      lips: [[-5.2, 0.42, 1.1], [0.4, 0.38, 1.0]],
      clear: [[-3.2, 0.0]],
    });
  }

  buildRoom() {
    const g = this.root;
    // a slab of rock laid across two stones: a natural flat top, broken edges, chisel bites,
    // the old blood soaked into the top and run down the side
    const SX = -1.6, SZ = -1.3;
    const sgeo = rockGeometry(1405, { detail: this.low ? 3 : 4, rough: 0.2, sharp: 0.7, strata: 1.4, flat: -0.6, top: 0.5, colA: 0x7a7470, colB: 0x4a4644, dark: 0.55 });
    { const p = sgeo.attributes.position, col = sgeo.attributes.color; const c = new THREE.Color(), bl = new THREE.Color(0x3a1210), bl2 = new THREE.Color(0x24100c);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        c.fromArray(col.array, i * 3);
        const top = sat((y - 0.3) * 4);
        const pool = fbm3(x * 1.8, 0, z * 1.8, 63, 3);
        if (top > 0 && pool > 0.5) c.lerp(bl, Math.min(0.85, (pool - 0.5) * 6) * top);
        const run = sat((fbm3(x * 9, 0, z * 2, 64, 2) - 0.6) * 5) * sat(0.6 - Math.abs(y)) * (z > 0.3 ? 1 : 0);
        if (run > 0) c.lerp(bl2, run * 0.8);                                   // runs down the front face
        col.setXYZ(i, c.r, c.g, c.b);
      } }
    const slab = new THREE.Mesh(sgeo, this.sandMat);
    slab.scale.set(1.36, 0.22, 0.7); slab.position.set(SX, 0.42, SZ); slab.rotation.y = 0.04; g.add(slab);
    for (const s of [-1, 1]) this.boulder(1406 + s, SX + s * 0.85, SZ + 0.05, 0.42, 0.42, 0.55, g, { colA: 0x5e5854, colB: 0x34302e, sharp: 0.9 });
    this.colliders.push({ box: { minX: SX - 1.35, maxX: SX + 1.35, minZ: SZ - 0.68, maxZ: SZ + 0.68 }, pushX: false });
    const bone = this.boneMat();
    for (const [dx, dz] of [[-1.1, -0.5], [1.15, 0.45]]) g.add(this.skull(SX + dx, 0.62, SZ + dz, bone));
    // old stains on the floor round the stone
    const stain = this.mat('oldStain', { map: bloodTex(1), transparent: true, alphaTest: 0.3, color: 0x6a4a40, depthWrite: false });
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), stain); d.rotation.x = -Math.PI / 2; d.rotation.z = i; d.position.set(SX - 1.4 + i * 0.7, 0.012, -0.3 + (i % 2) * 0.5); g.add(d); }
    // skulls piled at the foot of the wall, antlers hung on the rock
    for (const [x, y, z] of [[-6.9, 0.14, -2.45], [-6.6, 0.14, -2.25], [-6.75, 0.32, -2.37], [2.4, 0.14, -2.5], [2.7, 0.14, -2.3], [-4.4, 0.14, -2.4]]) g.add(this.skull(x, y, z, bone));
    this.colliders.push({ x: -6.7, z: -2.35, r: 0.35 }, { x: 2.55, z: -2.4, r: 0.3 });
    this.bonePile(-5.4, -2.1, 7, g, 0);
    for (const x of [-5.2, -1.6, 2.0]) this.wallAntlers(x, 2.0, g);
    this.stalagmite(1401, -7.3, 0.3, 1.3, 0.3);
    this.stalagmite(1402, 4.3, 0.55, 1.1, 0.26);
    this.solidBoulder(1403, 3.6, -2.25, 0.6, 0.8, 0.5);
    // the red light of the chamber, the ritual fire (L5)
    this.ritualLight = new THREE.PointLight(0xc03a20, 0, 9, 1.3); this.ritualLight.position.set(SX, 2.6, 0.4); g.add(this.ritualLight);
    this.ritualFire = this.fire(3.0, -1.9, 0.9, g);
    this.anchors.slab = { x: SX, z: SZ };
    this.anchors.slabV = V3(SX, 0.9, SZ);
    this.anchors.peek = { x: 3.4, z: 0.3 };
    this.anchors.antlers = V3(-1.6, 1.6, -2.8);
    this.anchors.skulls = V3(-6.7, 0.5, -2.35);
  }

  roomState(name) {
    const L5 = name === 'L5';
    this.ritualLight.intensity = L5 ? 12 : 0;
    this.setFire(this.ritualFire, L5);
  }
}

// ==================================================================== the store

/** `cave_store` — what is left of the others: backpacks, a torn tent, a boot, a phone, bones. */
export class CaveStoreScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_store', title: 'Пещера · кладовая', x0: -7.5, x1: 8.5, nx: 171,
      openings: [
        { x: -5.6, w: 1.9, h: 2.4, tint: 0x8a6040, door: { id: 'store_hall', label: 'В зал', to: 'cave', spawn: { x: 9.6, z: -1.6, facing: -1 } } },
        { x: 6.6, w: 2.0, h: 2.5, tint: 0x5a6a8a, tintOpacity: 0.18, door: { id: 'store_tunnel', label: 'В тоннель', to: 'cave_tunnel', spawn: { x: -5.9, z: -1.5, facing: 1 } } },
      ],
      cam: { minX: -2.6, maxX: 3.6 },
      torches: [-1.6, 3.8],
      fg: [[-6.6, 1.3, 0.7], [-1.0, 1.0, 0.5], [4.6, 1.1, 0.55]],
      lips: [[-3.6, 0.4, 1.0], [2.6, 0.36, 0.9]],
    });
  }

  buildRoom() {
    const g = this.root;
    // backpacks: faded, dusty nylon, slumped; lids, straps, side pockets
    const packs = [0x3a4c5e, 0x6e3e36, 0x46523a, 0x8a7040, 0x4a4454, 0x3a5656];
    const slump = (geo, seed, k = 0.05) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = fbm3(x * 6 + seed, y * 6, z * 6, seed, 2) - 0.5;
        p.setXYZ(i, x * (1 + n * 0.4) + Math.sin(y * 18 + seed) * k * 0.15, y - Math.max(0, y) * k * (1 + n), z * (1 + n * 0.5 + Math.sin(x * 20 + seed) * k * 0.4));
      }
      geo.computeVertexNormals(); return geo;
    };
    const fab = fabricTex();
    const strapM = this.mat('packStrap', { color: 0x1e1c1a, roughness: 1 });
    this.extraPack = null;
    packs.forEach((c, i) => {
      const pm = this.mat(`hpack${i}`, { color: c, map: fab, roughness: 0.95 });
      const x = -3.7 + i * 0.75, z = -2.55 + (i % 2) * 0.3;
      const b = new THREE.Mesh(slump(roundedBox(0.36, 0.5, 0.22, 0.08, 3), 400 + i, 0.08), pm);
      b.position.set(x, 0.25, z); b.rotation.set(i % 3 === 2 ? -1.2 : 0, i, i % 2 ? 0.3 : -0.2); g.add(b);
      if (i % 3 === 2) b.position.y = 0.13;                                         // fallen on its back
      const pk = new THREE.Mesh(slump(roundedBox(0.26, 0.18, 0.08, 0.04, 2), 420 + i, 0.03), pm); pk.position.set(0, -0.08, 0.12); b.add(pk);
      const lid = new THREE.Mesh(slump(roundedBox(0.34, 0.1, 0.24, 0.05, 2), 440 + i, 0.02), pm); lid.position.set(0, 0.22, 0.01); lid.rotation.x = 0.15; b.add(lid);
      for (const sx of [-0.09, 0.09]) { const st = new THREE.Mesh(roundedBox(0.035, 0.42, 0.015, 0.006, 1), strapM); st.position.set(sx, 0.0, -0.115); st.rotation.x = 0.06; b.add(st); }
      const side = new THREE.Mesh(roundedBox(0.06, 0.16, 0.14, 0.03, 2), pm); side.position.set(i % 2 ? 0.2 : -0.2, -0.1, 0); b.add(side);
      if (i === 5) this.extraPack = b;   // the newest one (L4)
      this.colliders.push({ x, z, r: 0.24 });
    });
    // a torn, collapsed dome tent: faded orange nylon in folds, a snapped pole, the door gaping
    const tentGeo = new THREE.SphereGeometry(0.9, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    { const tp = tentGeo.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), a = Math.atan2(z, x);
        const fold = Math.sin(a * 11 + fbm3(x * 2, y * 2, z * 2, 43, 2) * 9) * 0.07 * (0.2 + y) + (fbm3(x * 4, y * 4, z * 4, 44, 2) - 0.5) * 0.18;
        const sag = sat(x + 0.2) * 0.75 * y + fbm3(x * 3, y * 3, z * 3, 41, 2) * 0.3 * y;   // the right half has fallen in
        const dent = Math.exp(-((x - 0.15) ** 2 + z * z) * 6) * 0.25;                       // and the roof caved where the pole broke
        const k = 1 + fold;
        tp.setXYZ(i, x * k * (1 + sat(x) * 0.25), Math.max(0.01, y * 0.7 - sag * 0.6 - dent * y), z * k * 0.85);
      }
      tentGeo.computeVertexNormals(); }
    const tentMat = this.mat('torntent2', { color: 0x80583c, map: fab, roughness: 0.9, side: THREE.DoubleSide });
    const tent = new THREE.Group(); tent.position.set(1.9, 0.0, -2.55); tent.rotation.set(0, 0.5, 0); g.add(tent);
    tent.add(new THREE.Mesh(tentGeo, tentMat));
    const fly = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5, 6, 4), this.mat('tentFly', { color: 0x5a5a4a, map: fab, roughness: 1, side: THREE.DoubleSide }));
    { const fp = fly.geometry.attributes.position; for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin(fp.getX(i) * 9) * 0.04 + fp.getY(i) * fp.getY(i) * 0.4); fly.geometry.computeVertexNormals(); }
    fly.position.set(-0.45, 0.32, 0.25); fly.rotation.set(-0.9, -0.6, 0.3); tent.add(fly);
    const tear = new THREE.Mesh(new THREE.CircleGeometry(0.2, 7), this.mat('tentDoor', { color: 0x0e0b09, roughness: 1, side: THREE.DoubleSide }));
    { const tp = tear.geometry.attributes.position; for (let i = 1; i < tp.count; i++) { const k = 0.5 + ((i * 7) % 5) * 0.15; tp.setXY(i, tp.getX(i) * k, tp.getY(i) * k * 1.4); } }
    tear.scale.setScalar(0.6); tear.position.set(-0.32, 0.22, 0.62); tear.rotation.set(-0.6, -0.5, 0.3); tent.add(tear);
    const poleM = this.mat('tentPole', { color: 0x5a5e62, metalness: 0.6, roughness: 0.5 });
    tent.add(new THREE.Mesh(taperTube([V3(-0.85, 0, 0.1), V3(-0.5, 0.5, 0.05), V3(0, 0.57, 0), V3(0.35, 0.42, -0.05)], 0.008, 0.008, 12, 4), poleM));
    tent.add(new THREE.Mesh(taperTube([V3(0.35, 0.42, -0.05), V3(0.55, 0.62, 0.1), V3(0.62, 0.78, 0.2)], 0.008, 0.007, 6, 4), poleM));   // snapped, sticking out
    tent.add(new THREE.Mesh(taperTube([V3(-0.6, 0.3, 0.45), V3(-0.9, 0.12, 0.8), V3(-1.1, 0.0, 1.05)], 0.003, 0.003, 6, 3), this.mat('guyline', { color: 0x8a8070, roughness: 1 })));
    this.colliders.push({ x: 1.9, z: -2.5, r: 0.55 });
    const boot = new THREE.Mesh(roundedBox(0.3, 0.12, 0.12, 0.05), this.mat('boot', { color: 0x3a2a1c, roughness: 0.9 })); boot.position.set(-1.3, 0.06, -1.5); boot.rotation.y = 0.6; g.add(boot);
    const shaft = new THREE.Mesh(roundedBox(0.11, 0.18, 0.12, 0.04), this.mats.cache.get('boot')); shaft.position.set(-0.08, 0.12, 0); boot.add(shaft);
    // a sleeping bag, half unrolled, quilted, flattened by whoever slept on it
    const bagGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.8, 18, 10);
    { const bp = bagGeo.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
        const n = fbm3(x * 5, y * 5, z * 5, 47, 2) - 0.5;
        bp.setXYZ(i, x * (0.55 + n * 0.3) + Math.sin(y * 12) * 0.01, y, z * (1 + n * 0.3));
      }
      bagGeo.computeVertexNormals(); }
    const bag = new THREE.Mesh(bagGeo, this.mat('sleepbag2', { color: 0x4a5444, map: fabricTex('quilt'), roughness: 0.95 }));
    bag.rotation.set(0, 0.4, Math.PI / 2); bag.position.set(-0.4, 0.09, -1.95); g.add(bag);
    const sack = new THREE.Mesh(slump(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10, 3), 48, 0.02), this.mat('stuffsack', { color: 0x2e3436, map: fab, roughness: 1 })); sack.position.set(-0.05, 0.08, -2.25); sack.rotation.set(0.2, 0, 1.3); g.add(sack);
    this.colliders.push({ x: -0.4, z: -1.95, r: 0.3 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.14, 20), this.mat('camppot', { color: 0x7a7a74, metalness: 0.6, roughness: 0.45 })); pot.position.set(0.9, 0.07, -1.6); pot.rotation.z = 1.2; g.add(pot);
    const phone = new THREE.Mesh(roundedBox(0.075, 0.012, 0.15, 0.006), this.mat('deadphone', { color: 0x141618, metalness: 0.3, roughness: 0.25 }));
    phone.position.set(-2.6, 0.01, -1.85); phone.rotation.y = 0.7; g.add(phone);
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.13), new THREE.MeshBasicMaterial({ color: 0x3a4652, transparent: true, opacity: 0.6 }));
    crack.rotation.x = -Math.PI / 2; crack.rotation.z = 0.7; crack.position.set(-2.6, 0.018, -1.85); g.add(crack);
    // bones, sorted: long bones in a heap, a skull on top
    this.bonePile(3.9, -2.4, 10, g, 1);
    this.colliders.push({ x: 3.9, z: -2.4, r: 0.45 });
    this.stalagmite(1501, -2.2, 0.55, 1.1, 0.26);
    this.solidBoulder(1502, 5.0, 0.45, 0.6, 0.6, 0.45);
    this.anchors.packs = V3(-1.8, 0.8, -2.5);
    this.anchors.tent = V3(1.9, 0.8, -2.5);
    this.anchors.bones = V3(3.9, 0.5, -2.4);
    this.anchors.phone = V3(-2.6, 0.3, -1.85);
    this.anchors.boot = V3(-1.3, 0.3, -1.5);
    this.anchors.bob = { x: -0.9, z: -1.5 };
  }

  roomState(name) {
    if (this.extraPack) this.extraPack.visible = name === 'L4' || name === 'L5';
  }
}

// ==================================================================== the tunnel to the mouth

/** `cave_tunnel` — the long tunnel to the exit: guards, cold moonlight at the mouth, a crack to the rift. */
export class CaveTunnelScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_tunnel', title: 'Пещера · тоннель', x0: -8.5, x1: 17, nx: 229, openRight: true,
      walkX: [-7.6, 13.9],
      openings: [
        { x: -6.6, w: 2.0, h: 2.5, tint: 0x8a6040, door: { id: 'tunnel_store', label: 'В кладовую', to: 'cave_store', spawn: { x: 5.9, z: -1.5, facing: -1 } } },
        { x: 1.2, w: 1.0, h: 2.0, tint: 0x4a5a7a, tintOpacity: 0.16, door: { id: 'tunnel_rift', label: 'Щель', to: 'cave_rift', spawn: { x: 3.7, z: -0.7, facing: -1 } } },
        { x: 14.0, w: 2.1, h: 2.5, walkIn: false },
      ],
      cam: { minX: -4.4, maxX: 12.4 },
      torches: [-3.6, 4.6, 9.2],
      lights: [[14.0, 1.4, 1.0], [15.5, 1.0, 1.0]],
      fg: [[-7.6, 1.3, 0.7], [-2.0, 1.0, 0.5], [3.6, 1.0, 0.5], [8.8, 1.2, 0.6], [13.0, 1.4, 0.85]],
      lips: [[-5.0, 0.4, 1.0], [1.0, 0.38, 0.9], [6.6, 0.4, 1.0], [11.4, 0.45, 1.2]],
      clear: [[12.6, 15.8]],
    });
  }

  buildRoom() {
    const g = this.root;
    // the tunnel narrows towards the mouth
    this.solidBoulder(1601, 9.6, -2.3, 0.8, 1.1, 0.6);
    this.solidBoulder(1602, 12.5, -2.25, 0.7, 2.2, 0.6, g, { colA: 0x3e3e42, colB: 0x1e1e22 });
    this.solidBoulder(1603, 15.4, -2.2, 0.8, 2.4, 0.6, g, { colA: 0x3e3e42, colB: 0x1e1e22 });
    for (let i = 0; i < 5; i++) this.boulder(950 + i, 9 + i * 1.3, 1.25 + (i % 2) * 0.3, 0.5, 0.45, 0.35);
    this.stalagmite(1604, -1.2, 0.5, 1.0, 0.24);
    this.stalagmite(1605, 6.2, -1.7, 1.3, 0.28);
    this.solidBoulder(1606, -4.6, -2.15, 0.7, 0.9, 0.55);
    // the mouth: the night outside through a ragged arch, more of it round the last bend
    const mouthOpen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), new THREE.MeshBasicMaterial({ map: outsideTex(), alphaMap: archMask(), transparent: true, depthWrite: false }));
    mouthOpen.position.set(14.0, 1.25, BACK - 1.0); g.add(mouthOpen);
    const lintel = this.boulder(962, 14.0, BACK + 0.8, 1.6, 0.5, 0.6, g, { colA: 0x3e3e42, colB: 0x1e1e22 }); lintel.position.y = 2.45;
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4), new THREE.MeshBasicMaterial({ map: outsideTex() }));
    outside.position.set(17.6, 1.9, -1.0); outside.rotation.y = -Math.PI / 2; g.add(outside);
    for (const [z, h] of [[-3.6, 3.4], [1.6, 2.6]]) this.boulder(1610 + Math.round(z), 17.0, z, 0.9, h, 1.0, g, { colA: 0x2e2e32, colB: 0x18181c });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.4), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x6a88c0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(14.4, 0.03, -1.0); g.add(pool);
    const mg = glow(0xa8b8d8, 4.0, 0.35); mg.position.set(15.4, 1.3, -0.8); g.add(mg);
    const shT = shaftTexture();
    for (let i = 0; i < 5; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + i * 0.3, 6), new THREE.MeshBasicMaterial({ map: shT, color: 0x9ab0d4, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }));
      sh.position.set(13.6 - i * 0.55, 1.6, -1.4 + i * 0.2); sh.rotation.z = 1.05 + i * 0.04; g.add(sh);
    }
    const moonSpot = new THREE.SpotLight(0x9ab4e0, 18, 16, 0.55, 0.6, 1.2);
    moonSpot.position.set(16.4, 2.6, -1.6); moonSpot.target.position.set(8.5, 0, -0.4); g.add(moonSpot, moonSpot.target);
    this.moonLight = new THREE.PointLight(0x8aa0c8, 9, 12, 1.2); this.moonLight.position.set(15.0, 2.2, -0.6); g.add(this.moonLight);
    const sn = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), new THREE.MeshLambertMaterial({ map: glowTexture(), color: 0xc8d0dc, transparent: true, opacity: 0.8, depthWrite: false }));
    sn.rotation.x = -Math.PI / 2; sn.position.set(15.6, 0.012, -0.6); g.add(sn);
    this.windowLights = [flareSource('MOON', V3(15.2, 1.5, -1.0), { triggerDistance: 4.0, fadeDistance: 3.0, dir: V3(-0.6, 0, 0.8) })];
    this.anchors.guards = [{ x: 10.9, z: -1.3 }, { x: 12.1, z: -0.2 }];
    // the guards lie across the way out (L3, L4): nobody walks past them
    this.guardBlock = true;
    this.colliders.push({ box: { minX: 10.3, maxX: 13.2, minZ: -2.4, maxZ: 1.2 }, pushX: true, enabled: () => this.guardBlock });
    this.anchors.exit = { x: 13.4, z: -0.6 };
    this.anchors.mouth = V3(14.0, 1.6, -2.6);
    this.anchors.packE = { x: 8.4, z: -0.6 };
  }

  roomState(name) {
    this.guardBlock = name !== 'L5';
  }
}

// ==================================================================== the rift

/**
 * `cave_rift` — a dead-end crevice off the tunnel. Narrow, cold; a crack in the vault lets in a
 * thread of moonlight (far too narrow to climb). Puriel's alcove at the far end.
 */
export class CaveRiftScene extends CaveBase {
  constructor(opts) {
    super(opts, {
      id: 'cave_rift', title: 'Пещера · расселина', x0: -7.0, x1: 6.5, nx: 307,
      openings: [
        { x: 4.6, w: 1.0, h: 2.0, tint: 0x8a6040, tintOpacity: 0.16, door: { id: 'rift_tunnel', label: 'В тоннель', to: 'cave_tunnel', spawn: { x: 1.2, z: -1.6, facing: 1 } } },
        { x: -4.4, w: 2.0, h: 1.5, depth: 0.9, dark: 0.45 },
      ],
      minZ: -1.7, maxZ: 0.25,
      vault: 3.0, lean: 1.9, distance: 7.0, ambient: 0.8,
      cam: { minX: -2.2, maxX: 2.4 },
      torches: [2.6],
      lights: [[-1.2, 2.6, 0.7]],
      fg: [[-6.0, 1.3, 0.95], [-1.6, 1.2, 0.85], [3.0, 1.2, 0.85]],
      lips: [[-3.4, 0.42, 1.1], [1.4, 0.4, 1.0]],
    });
  }

  buildRoom() {
    const g = this.root;
    this.stalagmite(1701, -1.0, -1.6, 1.3, 0.3);
    this.stalagmite(1702, 2.2, 0.45, 0.9, 0.24);
    this.solidBoulder(1703, 0.9, -2.05, 0.6, 0.8, 0.5);
    // a thread of moonlight from a crack in the vault
    const shT = shaftTexture();
    for (let i = 0; i < 3; i++) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + i * 0.15, 3.6), new THREE.MeshBasicMaterial({ map: shT, color: 0x9ab0d4, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
      sh.position.set(-1.2 + i * 0.08, 1.6, -1.2 + i * 0.1); sh.rotation.z = 0.12; g.add(sh);
    }
    const spot = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x7a90c0, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    spot.rotation.x = -Math.PI / 2; spot.position.set(-1.4, 0.02, -1.1); g.add(spot);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc8d4f0, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    star.scale.set(0.3, 0.3, 1); star.position.set(-1.05, 3.05, -1.3); g.add(star);
    this.crackLight = new THREE.PointLight(0x8aa0d0, 4, 5, 1.4); this.crackLight.position.set(-1.2, 2.4, -1.2); g.add(this.crackLight);
    // a drip pool
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), this.mat('cavePool', { color: 0x3a3028, metalness: 0.75, roughness: 0.12 }));
    pool.rotation.x = -Math.PI / 2; pool.scale.set(1.3, 0.7, 1); pool.position.set(1.6, 0.018, -0.9); g.add(pool);
    // nails scratched into the rock by somebody who tried to climb out
    this.wallMark('claw', -2.5, 1.1, 0.6, g);
    // Puriel's alcove: blood soaked into the straw (her body is cast by the story)
    this.purielGroup = new THREE.Group(); g.add(this.purielGroup);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshLambertMaterial({ map: bloodTex(2), transparent: true, alphaTest: 0.3, depthWrite: false }));
    st.rotation.x = -Math.PI / 2; st.position.set(-4.4, 0.013, -2.1); this.purielGroup.add(st);
    this.straw([[-4.6, -2.3]], this.purielGroup, 120, 745);
    // a little cold light reaches the alcove from the crack, so what lies there can be seen
    this.alcoveLight = new THREE.PointLight(0x9aa8c8, 3.5, 4.5, 1.3); this.alcoveLight.position.set(-4.0, 1.4, -0.9); g.add(this.alcoveLight);
    this.anchors.puriel = { x: -4.4, z: -2.15 };
    this.anchors.crack = V3(-1.2, 2.4, -1.2);
    this.anchors.pool = V3(1.6, 0.4, -0.9);
    this.anchors.nails = V3(-2.5, 1.1, -2.8);
  }

  roomState(name) {
    this.purielGroup.visible = name === 'L3' || name === 'L3N' || name === 'L4';
  }
}
