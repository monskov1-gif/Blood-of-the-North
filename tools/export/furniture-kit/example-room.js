import * as THREE from 'three';
import { FurnitureKit, TEX } from './furniture-kit.js';

/**
 * Demo: a living-room corner and a sleeping nook, built only from furniture.
 * The floor and one backdrop plane are just a stage for the screenshots — the kit does not build
 * rooms; give it whatever shell your project already has.
 *
 * Layout (side-on, camera on +z): back of everything at z = BACK, x runs along the set.
 *   x −4 … −0.4  sofa, rug + coffee table, torchiere, TV corner, bookcase
 *   x  0.2 … 4   bed with nightstand lamp, desk + chair, dresser
 */
export function buildDemoRoom(root, { low = false } = {}) {
  const kit = new FurnitureKit(root, { low });
  const BACK = -2.8;
  kit.setupLights();

  // ---- stage (not part of the kit)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), kit.texM('floor', TEX.planks(0), { roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -0.5);
  floor.material.map.repeat.set(9 / 1.28, 5 / 1.28);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), kit.texM('backdrop', TEX.paint('demo', [168, 156, 142]), { roughness: 0.95 }));
  back.position.set(0, 1.4, BACK);
  root.add(floor, back);

  // ---- living corner
  kit.sofa(-2.3, BACK + 0.05, 0, { w: 2.2, seed: 1 });
  kit.rug(-2.3, -1.1, 3.2, 2.0);
  const top = kit.coffeeTable(-2.3, -0.9);
  kit.withT(-2.3, -0.9, 0, () => {
    kit.rb(0.36, 0.03, 0.26, 0.01, kit.M('tray', 0x2a1e18, { roughness: 0.4 }), -0.2, top + 0.015, -0.05);
    kit.candle('tableCandle', -0.26, top + 0.03, -0.07);
    kit.candle('tableCandle2', -0.12, top + 0.03, -0.01, { h: 0.12, r: 0.03 });
    kit.mug(0.3, top, 0.1, 0x3a5a6a, 0.6);
    kit.bookStack(0.25, top, -0.13, 2, 33);
  });
  kit.torchiere('torchiere', -3.75, BACK + 0.3);
  kit.tvUnit(-3.6, -1.2, Math.PI / 2 - 0.25);
  kit.bookcase(-0.7, BACK, 0);
  kit.plant(-3.2, 0, BACK + 0.35, 0.9, 'palm');
  kit.framed(TEX.art(0), 0.9, 0.55, -2.3, 1.75, BACK, 0x2a2420, 0.05);
  kit.statePool(0xffb070, -2.6, 0.02, -1.0, 2.4, 1.6, 0.18, ['evening', 'night']);

  // ---- sleeping nook
  kit.bed(1.55, -1.6, 0, { L: 2.1, W: 1.5 });
  const ns = kit.nightstand(-0.05, BACK + 0.1, 0);
  kit.tableLamp('bedLamp', -0.05, ns, BACK + 0.3);
  kit.bookStack(0.07, ns, BACK + 0.38, 2, 71);
  const deskTop = kit.desk(3.55, BACK + 0.02, 0, { w: 1.1 });
  kit.withT(3.55, BACK + 0.02, 0, () => {
    kit.mug(0.15, deskTop, 0.4, 0x2a2a30, 0.4);
    kit.tableLamp('deskLamp', -0.35, deskTop, 0.18, { on: { evening: 0.8, night: 0, day: 0 }, shade: 0x2a4a3a });
    kit.pl(0.21, 0.28, kit.texM('paper-1', TEX.paper(1)), -0.2, deskTop + 0.004, 0.35, { rx: -Math.PI / 2, rz: 0.3 });
    kit.fairyLights('deskLights', [[-0.55, 1.9, 0.03], [-0.2, 1.75, 0.03], [0.2, 1.8, 0.03], [0.55, 1.68, 0.03]], 18);
  });
  kit.chair(3.4, -2.0, Math.PI + 0.15, { jacket: 0x2c2a2c });
  kit.framed(TEX.art(1), 0.5, 0.36, 1.5, 1.7, BACK, 0x1a1410, 0.03);

  kit.flushBatches();
  return kit;
}
