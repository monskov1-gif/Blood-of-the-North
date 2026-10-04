import * as THREE from 'three';
import { glowTexture, labelTexture, rng } from '../render/textures.js';

/**
 * Reusable prop builders. Every builder returns a THREE.Group positioned at
 * the origin; scenes place them. Materials come from a small cached library
 * so dozens of chairs share one material.
 */

export class MaterialLib {
  constructor(low) {
    this.low = low;
    this.cache = new Map();
  }

  get(key, params) {
    if (this.cache.has(key)) return this.cache.get(key);
    const M = this.low && !params.forceStandard ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
    const p = { ...params };
    delete p.forceStandard;
    if (M === THREE.MeshLambertMaterial) { delete p.roughness; delete p.metalness; delete p.envMapIntensity; }
    const m = new M(p);
    this.cache.set(key, m);
    return m;
  }

  wood() { return this.get('wood', { color: 0x3b1a0e, roughness: 0.45, metalness: 0.0 }); }
  woodDark() { return this.get('woodDark', { color: 0x1d0d07, roughness: 0.5 }); }
  woodPolished() { return this.get('woodPolished', { color: 0x2c1209, roughness: 0.22, metalness: 0.05 }); }
  velvet() { return this.get('velvet', { color: 0x6e0f17, roughness: 0.95 }); }
  velvetDark() { return this.get('velvetDark', { color: 0x4a0a10, roughness: 0.95 }); }
  brass() { return this.get('brass', { color: 0xb4823a, roughness: 0.3, metalness: 0.9, emissive: 0x2a1604 }); }
  black() { return this.get('black', { color: 0x0b0908, roughness: 0.6 }); }
  marble() { return this.get('marble', { color: 0x5a1a1c, roughness: 0.18, metalness: 0.1 }); }
  glass() {
    return this.get('glass', {
      color: 0xd9e6f0, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.28, depthWrite: false,
      emissive: 0x141414,
    });
  }
  emissive(color, intensity = 2) {
    return this.get(`em-${color}-${intensity}`, { color: 0x000000, emissive: color, emissiveIntensity: intensity });
  }
}

const glowMats = new Map();
/** Additive camera-facing glow — fakes light halos, bloom does the rest. */
export function glow(color, size, opacity = 0.6) {
  const k = `${color}-${opacity}`;
  if (!glowMats.has(k)) {
    glowMats.set(k, new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
  }
  const s = new THREE.Sprite(glowMats.get(k));
  s.scale.set(size, size, 1);
  s.renderOrder = 5;
  return s;
}

/** Soft additive light pool on the floor/wall (fake bounce light). */
export function lightPool(color, w, h, opacity = 0.25) {
  const m = new THREE.MeshBasicMaterial({
    map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.renderOrder = 2;
  return p;
}

// ------------------------------------------------------------------ furniture

export function bistroTable(mats, { radius = 0.36, height = 0.74, top = 'marble' } = {}) {
  const g = new THREE.Group();
  const topMesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.035, 28), top === 'marble' ? mats.marble() : mats.woodPolished());
  topMesh.position.y = height;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.012, 6, 32), mats.brass());
  rim.rotation.x = Math.PI / 2; rim.position.y = height;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, height, 10), mats.black());
  stem.position.y = height / 2;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 20), mats.black());
  foot.position.y = 0.02;
  g.add(topMesh, rim, stem, foot);
  g.userData.radius = radius;
  return g;
}

/** Bentwood (Thonet style) chair. `facing`: +1 faces +x, -1 faces -x. */
export function bentwoodChair(mats, facing = 1) {
  const g = new THREE.Group();
  const m = mats.woodDark();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 20), mats.velvetDark());
  seat.position.y = 0.46;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 24), m);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.44;
  g.add(seat, ring);
  const legGeo = new THREE.CylinderGeometry(0.015, 0.012, 0.46, 6);
  for (const [x, z] of [[0.14, 0.14], [-0.14, 0.14], [0.14, -0.14], [-0.14, -0.14]]) {
    const leg = new THREE.Mesh(legGeo, m);
    leg.position.set(x * 1.05, 0.23, z * 1.05);
    leg.rotation.z = x * 0.25; leg.rotation.x = -z * 0.25;
    g.add(leg);
  }
  // bent back hoop
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.017, 6, 24, Math.PI), m);
  back.position.set(-0.18 * facing, 0.75, 0);
  back.rotation.y = Math.PI / 2;
  back.scale.set(1, 1.5, 1);
  const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6), m);
  post1.position.set(-0.19 * facing, 0.62, 0.17);
  const post2 = post1.clone(); post2.position.z = -0.17;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 16), m);
  loop.position.set(-0.19 * facing, 0.64, 0); loop.rotation.y = Math.PI / 2;
  g.add(back, post1, post2, loop);
  return g;
}

export function barStool(mats) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.11, 22), mats.velvet());
  seat.position.y = 0.78;
  const studs = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.008, 4, 30), mats.brass());
  studs.rotation.x = Math.PI / 2; studs.position.y = 0.74;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.74, 10), mats.black());
  pole.position.y = 0.37;
  const foot = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 24), mats.brass());
  foot.rotation.x = Math.PI / 2; foot.position.y = 0.3;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.04, 18), mats.black());
  base.position.y = 0.02;
  g.add(seat, studs, pole, foot, base);
  return g;
}

export function candle(mats, { lit = true } = {}) {
  const g = new THREE.Group();
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 10), mats.glass());
  holder.position.y = 0.035;
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), mats.get('wax', { color: 0xe8dcc0, roughness: 0.6, emissive: 0x402010 }));
  wax.position.y = 0.02;
  g.add(holder, wax);
  if (lit) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), mats.emissive(0xffb050, 6));
    flame.scale.set(1, 2.2, 1); flame.position.y = 0.05;
    const halo = glow(0xff9a40, 0.32, 0.55);
    halo.position.y = 0.06;
    g.add(flame, halo);
    g.userData.flame = flame;
    g.userData.halo = halo;
  }
  return g;
}

export function wineGlass(mats, filled = 0x5a0a10) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.07, 12, 1, true), mats.glass());
  bowl.position.y = 0.15;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), mats.glass());
  stem.position.y = 0.06;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 12), mats.glass());
  g.add(bowl, stem, base);
  if (filled) {
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.02, 0.04, 12), mats.get(`liq-${filled}`, { color: filled, roughness: 0.1, emissive: filled, emissiveIntensity: 0.25 }));
    liq.position.y = 0.135;
    g.add(liq);
  }
  return g;
}

export function tumbler(mats, fill = 0x8a4a14) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12, 1, true), mats.glass());
  glass.position.y = 0.045;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.035, 12), mats.get(`liq-${fill}`, { color: fill, roughness: 0.1, emissive: fill, emissiveIntensity: 0.35 }));
  liq.position.y = 0.02;
  g.add(glass, liq);
  return g;
}

/** Instanced bottles on a shelf of given length. */
export function bottleRow(mats, length, seed = 1) {
  const r = rng(seed);
  const count = Math.floor(length / 0.11);
  const bodyGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 10);
  bodyGeo.translate(0, 0.5, 0);
  const neckGeo = new THREE.CylinderGeometry(0.012, 0.02, 1, 8);
  neckGeo.translate(0, 0.5, 0);
  const tints = [0x7a3a08, 0x5a2a06, 0x2c4a1a, 0x9a6a20, 0x3a1206, 0xb08a40, 0x1e2a1a, 0x6a1010, 0xd0b070];
  const bodyMat = mats.get('bottle', {
    color: 0xffffff, roughness: 0.12, metalness: 0.0, emissive: 0x3a1c06, emissiveIntensity: 0.9,
    transparent: true, opacity: 0.88,
  });
  const labelMat = mats.get('bottleLabel', { map: labelTexture(), roughness: 0.8 });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const necks = new THREE.InstancedMesh(neckGeo, bodyMat, count);
  const labels = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.07), labelMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = -length / 2 + 0.055 + i * 0.11 + (r() - 0.5) * 0.02;
    const h = 0.2 + r() * 0.14;
    const w = 0.8 + r() * 0.45;
    m.compose(new THREE.Vector3(x, 0, (r() - 0.5) * 0.06), q, new THREE.Vector3(w, h, w));
    bodies.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, h, 0), q, new THREE.Vector3(1, 0.06 + r() * 0.08, 1));
    necks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, h * 0.45, 0.042 * w), q, new THREE.Vector3(w, 1, 1));
    labels.setMatrixAt(i, m);
    c.setHex(tints[Math.floor(r() * tints.length)]);
    bodies.setColorAt(i, c); necks.setColorAt(i, c);
    labels.setColorAt(i, c.setHSL(0, 0, 0.6 + r() * 0.4));
  }
  const g = new THREE.Group();
  g.add(bodies, necks, labels);
  return g;
}

// ------------------------------------------------------------------ lights

export function chandelier(mats) {
  const g = new THREE.Group();
  const brass = mats.brass();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), brass);
  stem.position.y = 0.35;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.02, 8, 36), brass);
  ring.rotation.x = Math.PI / 2;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.015, 8, 30), brass);
  ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.28;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass);
  bowl.position.y = -0.05;
  g.add(stem, ring, ring2, bowl);
  const bulbMat = mats.emissive(0xffc27a, 5);
  const crystalMat = mats.get('crystal', { color: 0xfff0d8, emissive: 0xffd9a0, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 });
  const crystalGeo = new THREE.OctahedronGeometry(0.025);
  g.userData.bulbs = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 0.45, z = Math.sin(a) * 0.45;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.05, 8), brass);
    cup.position.set(x, 0.03, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), bulbMat);
    bulb.scale.set(1, 1.8, 1);
    bulb.position.set(x, 0.09, z);
    g.add(cup, bulb);
    g.userData.bulbs.push(bulb);
    for (let k = 0; k < 2; k++) {
      const cr = new THREE.Mesh(crystalGeo, crystalMat);
      const aa = a + (k + 0.5) * (Math.PI / 10);
      cr.position.set(Math.cos(aa) * 0.42, -0.06 - k * 0.07, Math.sin(aa) * 0.42);
      cr.scale.y = 1.8;
      g.add(cr);
    }
  }
  for (let i = 0; i < 14; i++) {
    const cr = new THREE.Mesh(crystalGeo, crystalMat);
    cr.position.set((Math.random() - 0.5) * 0.18, -0.2 - Math.random() * 0.15, (Math.random() - 0.5) * 0.18);
    cr.scale.y = 2;
    g.add(cr);
  }
  const halo = glow(0xffb36a, 2.4, 0.55);
  halo.position.y = 0.05;
  g.add(halo);
  g.userData.halo = halo;
  return g;
}

/** Wall sconce with pleated shade (ref 06). */
export function sconce(mats, shadeColor = 0xc7605a) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12), mats.brass());
  plate.rotation.x = Math.PI / 2;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.01, 6, 12, Math.PI / 2), mats.brass());
  arm.position.set(0, 0.0, 0.12); arm.rotation.y = Math.PI / 2;
  const shadeMat = mats.get(`shade-${shadeColor}`, {
    color: shadeColor, emissive: shadeColor, emissiveIntensity: 1.3, side: THREE.DoubleSide, roughness: 0.9,
    transparent: true, opacity: 0.95,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.13, 16, 1, true), shadeMat);
  shade.position.set(0, 0.17, 0.13);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.emissive(0xffd0a0, 4));
  bulb.position.set(0, 0.14, 0.13);
  const halo = glow(0xff9070, 1.1, 0.45);
  halo.position.set(0, 0.16, 0.16);
  g.add(plate, arm, shade, bulb, halo);
  return g;
}

/** Fringed table lamp (ref 05). */
export function tableLamp(mats, shadeColor = 0x120a08) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.25, 12), mats.brass());
  base.position.y = 0.125;
  const shadeMat = mats.get(`lampshade-${shadeColor}`, { color: shadeColor, emissive: 0x3a1808, roughness: 0.9, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.17, 16, 1, true), shadeMat);
  shade.position.y = 0.36;
  const fringe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.175, 0.04, 16, 1, true), mats.get('fringe', { color: 0xb08a40, emissive: 0x3a2808, roughness: 1, side: THREE.DoubleSide }));
  fringe.position.y = 0.26;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), mats.emissive(0xffc080, 4));
  bulb.position.y = 0.3;
  const pool = glow(0xffa860, 0.9, 0.5);
  pool.position.y = 0.22;
  g.add(base, shade, fringe, bulb, pool);
  return g;
}

/** Arched string of fairy lights with greenery (ref 06 garland). */
export function garland(mats, curve, count = 40) {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.06, 6, false), mats.get('garland', { color: 0x0d1a0e, roughness: 1 }));
  g.add(tube);
  const geo = new THREE.SphereGeometry(0.012, 4, 4);
  const mat = mats.emissive(0xffd890, 6);
  const lights = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const p = curve.getPoint(i / (count - 1));
    p.x += (Math.random() - 0.5) * 0.08; p.y += (Math.random() - 0.5) * 0.08; p.z += 0.05;
    m.makeTranslation(p.x, p.y, p.z);
    lights.setMatrixAt(i, m);
  }
  g.add(lights);
  return g;
}

export function frame(mats, w, h, texture, { gold = true, depth = 0.05, border = 0.07 } = {}) {
  const g = new THREE.Group();
  const fm = gold ? mats.get('gilt', { color: 0x8a6428, roughness: 0.35, metalness: 0.8, emissive: 0x1a0e02 }) : mats.black();
  const parts = [
    [w + border * 2, border, 0, h / 2 + border / 2],
    [w + border * 2, border, 0, -h / 2 - border / 2],
    [border, h, -w / 2 - border / 2, 0],
    [border, h, w / 2 + border / 2, 0],
  ];
  for (const [pw, ph, x, y] of parts) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, depth), fm);
    b.position.set(x, y, depth / 2);
    g.add(b);
  }
  if (texture) {
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.get(`art-${texture.uuid}`, { map: texture, roughness: 0.7 }));
    canvas.position.z = 0.01;
    g.add(canvas);
  }
  return g;
}
