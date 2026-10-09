import { LocationBase } from '../LocationBase.js';

/** Placeholder — being built. */
class Stub extends LocationBase {
  build() {
    this.floor(-10, 10, -6, 2, this.mat('aptStubFloor', { color: 0x8a6a4a }));
    this.camera = { distance: 6.4, height: 1.5, lookHeight: 1.35, lookZ: -1.0 };
    this.bounds = { walk: { areas: [{ minX: -6, maxX: 6, minZ: -2.2, maxZ: 0.8 }] }, camera: { minX: -3, maxX: 3 } };
    this.doors = [];
    this.spots = {};
    return this.root;
  }
}
export class ApartmentScene extends Stub {}
export class ApartmentBedroomScene extends Stub {}
export class ApartmentAtticScene extends Stub {}
