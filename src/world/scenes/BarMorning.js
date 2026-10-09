import * as THREE from 'three';
import { bevelBox } from '../nature.js';
import { streetTexture, canvasTexture, glowTexture } from '../../render/textures.js';
import { bistroTable, bentwoodChair, wineGlass, wineBottle, lightPool, pixTex } from '../props.js';

/**
 * BAR_MORNING_CRIME_SCENE — a lighting/props state of the same bar.
 * The geometry is reused; what changes is the real light setup (practicals
 * off, cold daylight through the window and the open door), the window view,
 * the state of the furniture, and the post grade.
 *
 *   applyLightingState(bar, 'evening' | 'morning')
 *   bar.morningProps  — group shown only in the morning
 *   bar.police        — red/blue flashers (police arrival)
 */

const remembered = new WeakMap();

function remember(obj, key, value) {
  let r = remembered.get(obj);
  if (!r) { r = {}; remembered.set(obj, r); }
  if (!(key in r)) r[key] = value;
  return r[key];
}

export function applyLightingState(bar, state) {
  const morning = state === 'morning';
  bar.lightingState = morning ? 'BAR_MORNING_CRIME_SCENE' : 'BAR_EVENING';
  const L = bar.lights;

  // practical lights: chandeliers, back bar, sconces, candle, extras
  for (const c of L.chandeliers) {
    c.light.visible = !morning;
    c.mesh.userData.halo.visible = !morning;
  }
  for (const l of [...L.backbar, ...L.lounge, L.candle, ...(L.extra || [])]) l.visible = !morning;

  const keep = new Set([bar.beamMat, bar.mats.cache.get('coldPane'), bar.snow.points.material, bar.dust.material]);
  if (bar.floorReflector) keep.add(bar.floorReflector.material);
  // everything that glows (bulbs, shades, garlands, LED strip, jukebox, candle halos, light cones, pools)
  bar.root.traverse((o) => {
    if (o.userData.keepInMorning) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.userData?.noLightingState) return;
    if (keep.has(m)) return;
    if (o.isSprite || (m.blending === THREE.AdditiveBlending && !o.userData.daylight)) {
      remember(o, 'visible', o.visible);
      o.visible = morning ? false : remembered.get(o).visible;
      return;
    }
    if (m.emissive && m.emissiveIntensity >= 0.6 && m.emissive.getHex() !== 0) {
      remember(m, 'ei', m.emissiveIntensity);
      m.emissiveIntensity = morning ? remembered.get(m).ei * 0.04 : remembered.get(m).ei;
    }
  });
  bar.backGlowMat.color.set(morning ? 0x2a3038 : 0xffffff);

  // daylight: cold window light, grey-blue ambient, cold fill through the door
  L.hemi.color.set(morning ? 0x8a98ae : 0x5a3a30);
  L.hemi.groundColor.set(morning ? 0x2a2e36 : 0x120808);
  L.hemi.intensity = morning ? 2.1 : 0.55;
  L.window.color.set(morning ? 0xd6e4ff : 0x7f9ee0);
  L.window.intensity = morning ? 70 : 16;
  L.window.angle = morning ? 0.85 : 0.6;
  if (!bar.daylight) {
    // grey daylight filling the room (no warm practicals), the open door, and a
    // cold shaft over the table where Julian and Kayden sat
    bar.daylight = [-9, -3, 3, 9].map((x) => {
      const l = new THREE.PointLight(0xb4c4e2, 13, 15, 1.1);
      l.position.set(x, 3.6, 0.6);
      return l;
    });
    const door = new THREE.SpotLight(0xd0dcf4, 46, 15, 0.7, 0.9, 1.3);
    door.position.set(-12.2, 2.3, -6.2);
    door.target.position.set(-10.5, 0, 0.5);
    const table = new THREE.SpotLight(0xc8d6f0, 42, 10, 0.55, 0.85, 1.3);
    table.position.set(-1.5, 4.2, 2.5);
    table.target.position.set(0.6, 0, 1.0);
    bar.daylight.push(door, table);
    bar.root.add(...bar.daylight, door.target, table.target);
    // one surviving bulb by the entrance — it flickers
    bar.brokenLight = new THREE.PointLight(0xffb070, 2.2, 5, 1.6);
    bar.brokenLight.position.set(-13.0, 2.45, -4.6);
    bar.root.add(bar.brokenLight);
  }
  for (const l of bar.daylight) l.visible = morning;
  bar.brokenLight.visible = morning;

  bar.outsideMat.map = streetTexture(morning ? 'morning' : 'night');
  bar.outsideMat.color.set(morning ? 0xe6eef8 : 0xb4c4e0);
  bar.outsideMat.needsUpdate = true;
  bar.beamMat.color.set(morning ? 0xdce8ff : 0x86a4d6);
  bar.beamMat.opacity = morning ? 0.2 : 0.11;
  for (const b of bar.beams || []) b.visible = true;
  bar.dust.material.color.set(morning ? 0xdfe8ff : 0xffd2a0);
  bar.dust.material.opacity = morning ? 0.32 : 0.45;
  bar.morning = morning;
  if (bar.morningProps) bar.morningProps.visible = morning;
  if (bar.floorReflector) bar.floorReflector.material.uniforms.uStrength.value = morning ? 0.18 : 0.32;
}

/** Furniture knocked over, broken glass, a handbag, drag marks — morning only. */
export function buildMorningProps(bar) {
  const m = bar.mats;
  const g = new THREE.Group();
  g.visible = false;
  const lie = (obj, x, z, rz, ry = 0, y = 0) => { obj.position.set(x, y, z); obj.rotation.set(0, ry, rz); g.add(obj); return obj; };

  // knocked-over chairs and a table
  lie(bentwoodChair(m, 1), -6.9, 0.55, Math.PI / 2, 0.4, 0.22);
  lie(bentwoodChair(m, -1), 4.3, 1.1, -Math.PI / 2, -0.6, 0.22);
  lie(bentwoodChair(m, 1), -9.7, 0.35, Math.PI / 2, 1.2, 0.22);
  lie(bentwoodChair(m, -1), 9.6, -0.6, -Math.PI / 2, 0.2, 0.22);
  const t = bistroTable(m, { radius: 0.45 });
  lie(t, 6.0, 0.95, Math.PI / 2 - 0.1, 0.3, 0.45);

  // broken glass shards (Julian's glass by the table, more by the bar)
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f4, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const shards = (x, z, n, spread = 0.35) => {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.02 + Math.random() * 0.03, 3), shardMat);
      s.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
      s.position.set(x + (Math.random() - 0.5) * spread, 0.004, z + (Math.random() - 0.5) * spread * 0.6);
      g.add(s);
    }
  };
  shards(1.1, 1.05, 14);
  shards(-2.9, -1.9, 10);
  shards(-0.2, 0.6, 6, 0.6);
  const brokenGlass = wineGlass(m, 0x3a0408);
  lie(brokenGlass, 1.25, 1.0, Math.PI / 2, 0.8, 0.04);
  const bottle = wineBottle(m, 0x2a1a0a);
  lie(bottle, -2.6, -1.85, Math.PI / 2, -0.4, 0.04);

  // a handbag on the floor, menus scattered
  const bag = new THREE.Group();
  const body = new THREE.Mesh(bevelBox(0.32, 0.2, 0.12), new THREE.MeshStandardMaterial({ map: pixTex('wood'), color: 0x3a1418, roughness: 0.6 }));
  body.position.y = 0.1;
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 6, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a0a08 }));
  strap.position.y = 0.2;
  bag.add(body, strap);
  lie(bag, 8.6, 0.85, 0.35, 0.5);
  const menuMat = new THREE.MeshStandardMaterial({ color: 0x6a1018, roughness: 0.7 });
  for (const [x, z, r] of [[-5.6, 0.9, 0.4], [3.6, 0.2, 1.3], [-11.0, 0.8, 2.1], [7.2, -1.8, 0.9]]) {
    const menu = new THREE.Mesh(bevelBox(0.22, 0.008, 0.3), menuMat);
    menu.position.set(x, 0.005, z); menu.rotation.y = r;
    g.add(menu);
  }

  // drag marks and scuffs (dark decals), a few small dark drops — no pools of blood
  const decal = (x, z, w, h, rot, color, opacity) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false }));
    d.rotation.set(-Math.PI / 2, 0, rot);
    d.position.set(x, 0.006, z);
    d.renderOrder = 2;
    d.userData.keepInMorning = true;
    g.add(d);
    return d;
  };
  for (let i = 0; i < 7; i++) decal(4.6 + i * 0.32, 0.7 + Math.sin(i) * 0.08, 0.5, 0.08, 0.1, 0x120806, 0.55);
  for (let i = 0; i < 5; i++) decal(-8.4 + i * 0.4, -1.6 + i * 0.12, 0.45, 0.07, -0.3, 0x120806, 0.45);
  for (const [x, z] of [[-4.0, -2.0], [-12.0, -0.3], [2.8, 1.2], [10.4, -0.8], [-9.4, -0.1]]) {
    for (let k = 0; k < 3; k++) decal(x + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.2, 0.05, 0.05, 0, 0x3a0006, 0.8);
  }
  // cold light pools from the window and the open door
  const pool = lightPool(0xdce8ff, 4.2, 3.0, 0.16);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-9.0, 0.012, -1.8);
  pool.userData.daylight = true;
  pool.userData.keepInMorning = true;
  g.add(pool);
  const pool2 = lightPool(0xdce8ff, 2.6, 4.2, 0.14);
  pool2.rotation.x = -Math.PI / 2;
  pool2.position.set(-11.8, 0.012, -2.2);
  pool2.userData.daylight = true;
  pool2.userData.keepInMorning = true;
  g.add(pool2);

  bar.root.add(g);
  bar.morningProps = g;
  g.traverse((o) => { o.userData.keepInMorning = true; });

  // police flashers outside (hidden until the arrival)
  const red = new THREE.PointLight(0xff2030, 0, 16, 1.2);
  const blue = new THREE.PointLight(0x2050ff, 0, 16, 1.2);
  red.position.set(-9.6, 2.0, -6.4);
  blue.position.set(-11.6, 2.0, -6.4);
  bar.root.add(red, blue);
  bar.police = { red, blue, on: false, t: 0 };
  return g;
}

/** Called every frame from the scene update. */
export function updateMorning(bar, dt) {
  if (!bar.morning) return;
  // the broken bulb by the door
  if (bar.brokenLight) {
    bar.flickT = (bar.flickT || 0) - dt;
    if (bar.flickT <= 0) {
      bar.brokenLight.intensity = Math.random() < 0.35 ? 0.1 : 1.6 + Math.random();
      bar.flickT = 0.04 + Math.random() * (Math.random() < 0.2 ? 1.2 : 0.18);
    }
  }
  const p = bar.police;
  if (p?.on) {
    p.t += dt;
    const phase = Math.floor(p.t * 3.2) % 2;
    p.red.intensity = (phase ? 70 : 6) * p.level;
    p.blue.intensity = (phase ? 6 : 70) * p.level;
    bar.outsideMat.color.setRGB(0.9 + (phase ? 0.25 : 0) * p.level, 0.9, 0.95 + (phase ? 0 : 0.3) * p.level);
  }
  // TV is dead: a flicker of static now and then
  if (bar.tv) {
    bar.tv.deadT = (bar.tv.deadT || 0) - dt;
    if (bar.tv.deadT <= 0) {
      const { ctx, canvas } = bar.tv;
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < 0.3) {
        for (let i = 0; i < 600; i++) { const v = Math.random() * 120; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(Math.random() * 256, Math.random() * 192, 2, 1); }
      }
      bar.tv.tex.needsUpdate = true;
      bar.tv.deadT = 0.1 + Math.random() * 0.6;
    }
  }
}

export { canvasTexture };
