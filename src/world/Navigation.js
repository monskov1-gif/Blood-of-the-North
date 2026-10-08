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

  /** Is the point inside an (enabled) obstacle, grown by `radius`? */
  blocked(x, z, radius = 0.22) {
    for (const c of this.colliders) {
      if (c.enabled && !c.enabled()) continue;
      if (c.box) {
        const b = c.box;
        if (x > b.minX - radius && x < b.maxX + radius && z > b.minZ - radius && z < b.maxZ + radius) return true;
      } else if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + radius) ** 2) return true;
    }
    return false;
  }

  /** The straight segment a→b is clear of obstacles (sampled every 10 cm). */
  segmentClear(ax, az, bx, bz, radius = 0.2) {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.blocked(ax + (bx - ax) * t, az + (bz - az) * t, radius)) return false;
    }
    return true;
  }

  /**
   * A path from a to b that goes round tables, counters and other obstacles (A* on a 20 cm grid,
   * then string-pulled to as few corners as possible). NPCs walk scripted paths with it, so they
   * never cut through furniture. Start and goal may sit inside an obstacle (a chair, a bed): the
   * cells next to them are opened. Returns null when there is no way round.
   */
  findPath(a, b, radius = 0.2) {
    if (this.segmentClear(a.x, a.z, b.x, b.z, radius)) return [b];
    const C = 0.2;
    let minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minZ = Math.min(a.z, b.z), maxZ = Math.max(a.z, b.z);
    for (const ar of this.areas) { minZ = Math.min(minZ, ar.minZ); maxZ = Math.max(maxZ, ar.maxZ); }
    minX -= 4; maxX += 4; minZ -= 0.6; maxZ += 0.6;
    const W = Math.ceil((maxX - minX) / C) + 1, H = Math.ceil((maxZ - minZ) / C) + 1;
    if (W * H > 60000) return null;
    const inArea = (x, z) => this.areas.some((ar) => (!ar.enabled || ar.enabled()) && x > ar.minX - 0.6 && x < ar.maxX + 0.6 && z > ar.minZ - 0.6 && z < ar.maxZ + 0.6);
    const near = (x, z, p) => Math.hypot(x - p.x, z - p.z) < 0.45;
    const free = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = minX + i * C, z = minZ + j * C;
      free[j * W + i] = near(x, z, a) || near(x, z, b) || (inArea(x, z) && !this.blocked(x, z, radius)) ? 1 : 0;
    }
    const idx = (p) => Math.round((p.z - minZ) / C) * W + Math.round((p.x - minX) / C);
    const s = idx(a), g = idx(b);
    const gx = g % W, gz = (g / W) | 0;
    const open = [s], came = new Int32Array(W * H).fill(-1), cost = new Float32Array(W * H).fill(Infinity);
    cost[s] = 0;
    const hfun = (k) => Math.hypot((k % W) - gx, ((k / W) | 0) - gz);
    const f = new Float32Array(W * H).fill(Infinity); f[s] = hfun(s);
    const seen = new Uint8Array(W * H);
    let found = false, guard = 0;
    while (open.length && guard++ < 40000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === g) { found = true; break; }
      seen[cur] = 1;
      const ci = cur % W, cj = (cur / W) | 0;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
        const ni = ci + di, nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (!free[n] || seen[n]) continue;
        if (di && dj && (!free[cj * W + ni] || !free[nj * W + ci])) continue;   // no corner cutting
        const c2 = cost[cur] + w;
        if (c2 < cost[n]) { cost[n] = c2; came[n] = cur; f[n] = c2 + hfun(n); if (!open.includes(n)) open.push(n); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = g; k !== -1 && k !== s; k = came[k]) cells.unshift({ x: minX + (k % W) * C, z: minZ + ((k / W) | 0) * C });
    // string pulling: keep only the corners needed to stay clear
    const pts = [];
    let from = a, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.segmentClear(from.x, from.z, cells[j].x, cells[j].z, radius * 0.9)) j--;
      pts.push(cells[j]); from = cells[j]; i = j + 1;
    }
    pts[pts.length - 1] = { x: b.x, z: b.z };
    return pts;
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
