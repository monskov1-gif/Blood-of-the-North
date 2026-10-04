/**
 * Walkable area for side-on scenes: a rectangle in (x, z) minus circular /
 * box obstacles. Movement is resolved by sliding along obstacles.
 */
export class Navigation {
  constructor(bounds, colliders = []) {
    this.b = bounds;
    this.colliders = colliders;
  }

  clamp(x, z, radius = 0.22) {
    const b = this.b;
    x = Math.min(b.maxX, Math.max(b.minX, x));
    z = Math.min(b.maxZ, Math.max(b.minZ, z));
    for (let iter = 0; iter < 3; iter++) {
      for (const c of this.colliders) {
        if (c.box) {
          const bx = c.box;
          if (x > bx.minX - radius && x < bx.maxX + radius && z > bx.minZ - radius && z < bx.maxZ + radius) {
            z = Math.max(z, bx.maxZ + radius);
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
      x = Math.min(b.maxX, Math.max(b.minX, x));
      z = Math.min(b.maxZ, Math.max(b.minZ, z));
    }
    return { x, z };
  }
}
