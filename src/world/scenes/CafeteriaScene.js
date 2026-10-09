import { LocationBase } from '../LocationBase.js';

/** Placeholder — being built. */
export class CafeteriaScene extends LocationBase {
  build() {
    this.floor(-10, 10, -6, 2, this.mat('cafStubFloor', { color: 0xd8d0c0 }));
    this.camera = { distance: 7.0, height: 1.45, lookHeight: 1.45, lookZ: -1.1 };
    this.bounds = { walk: { areas: [{ minX: -9, maxX: 9, minZ: -2.4, maxZ: 0.9 }] }, camera: { minX: -6, maxX: 6 } };
    this.doors = [];
    this.spots = {};
    return this.root;
  }
}
