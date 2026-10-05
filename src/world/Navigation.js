/**
 * Walkable area for side-on scenes: one rectangle in (x, z) — or a union of
 * rectangles (`bounds.areas`, e.g. a corridor plus a side room) — minus
 * circular / box obstacles. Movement is resolved by sliding along obstacles.
 */
export class Navigation {
  constructor(bounds, colliders = []) {
    this.set(bounds, colliders);
  }

  set(bounds, colliders = []) {
    this.b = bounds;
    this.areas = bounds.areas || [bounds];
    this.colliders = colliders;
  }

  /** Clamp a point into the union of walkable areas (nearest area wins). */
  clampArea(x, z) {
    let best = null, bestD = Infinity;
    for (const a of this.areas) {
      if (a.enabled && !a.enabled()) continue;
      const cx = Math.min(a.maxX, Math.max(a.minX, x));
      const cz = Math.min(a.maxZ, Math.max(a.minZ, z));
      const d = (cx - x) ** 2 + (cz - z) ** 2;
      if (d < bestD) { bestD = d; best = { x: cx, z: cz }; }
      if (d === 0) break;
    }
    return best || { x, z };
  }

  clamp(x, z, radius = 0.22) {
    ({ x, z } = this.clampArea(x, z));
    for (let iter = 0; iter < 3; iter++) {
      for (const c of this.colliders) {
        if (c.enabled && !c.enabled()) continue;
        if (c.box) {
          const bx = c.box;
          if (x > bx.minX - radius && x < bx.maxX + radius && z > bx.minZ - radius && z < bx.maxZ + radius) {
            if (c.pushX) {
              x = x < (bx.minX + bx.maxX) / 2 ? bx.minX - radius : bx.maxX + radius;
            } else {
              // push out along z on the side the point is on (walls/bars work both ways)
              z = z < (bx.minZ + bx.maxZ) / 2 && !c.frontOnly ? bx.minZ - radius : bx.maxZ + radius;
            }
          }
          continue;
        }
        const dx = x - c.x, dz = z - c.z;
        const rr = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr) {
          const d = Math.sqrt(d2) || 0.0001;
          x = c.x + (dx / d) * rr;
          z = c.z + (dz / d) * rr;
        }
      }
      ({ x, z } = this.clampArea(x, z));
    }
    return { x, z };
  }
}
