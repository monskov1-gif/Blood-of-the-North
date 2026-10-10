import * as THREE from 'three';
import { sleep } from './Director.js';

/**
 * Places (v0.14): doors between locations and the life inside them.
 *
 * A location lists its doors — `world.doors = [{ id, label, x, z, radius, anchor, to, spawn }]`.
 * The chapter playing there describes the rest with `this.place = { items, state, onEnter, door }`:
 *   items(locationId)  → its own interactables in that location,
 *   state[locationId]  → the Scene State the location opens in ('evening', 'night'…),
 *   onEnter(locationId) → cast / crowd / objective on arrival,
 *   door(door)         → optional gate: return a bark id to keep the door shut, a function to run
 *                        instead of the walk-through (e.g. a door that leads out of the chapter),
 *                        or nothing to let the player through.
 * Walking up to a door and pressing E fades out, switches the location, puts the player at the
 * door's `spawn` on the other side and fades back in.
 *
 * The crowd: background characters that live while the player is in a location — students
 * running along the corridor, walking into the depth of a cross corridor, queueing, or sitting
 * behind the tables. They stop and hide when the player leaves.
 */

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const methods = {
  /** Starts a chapter's set of places (the items/hooks above) in the current location. */
  setPlace(place) {
    this.place = place;
    this.placeItems();
  },

  endPlace() {
    this.place = null;
    this.clearCrowd();
  },

  /** Interactables of the current location: the chapter's items + the location's doors. */
  placeItems() {
    const g = this.g;
    const loc = g.locationId;
    const own = this.place?.items?.(loc) || [];
    const doors = (g.world.doors || []).map((d) => ({
      id: `door_${loc}_${d.id}`, label: d.label, at: { x: d.x, z: d.z }, radius: d.radius ?? 0.9,
      anchor: d.anchor || new THREE.Vector3(d.x, 1.7, d.z - 0.2), door: true,
      run: () => this.useDoor(d),
    }));
    g.interactions.setItems([...own, ...doors]);
  },

  async useDoor(d) {
    const gate = this.place?.door?.(d);
    if (typeof gate === 'string') return this.g.dialogue.start(gate);
    if (typeof gate === 'function') return gate();
    if (gate === false || !d.to) return null;
    return this.travel(d.to, d.spawn, { sound: d.sound });
  },

  /** Fade out → another location → the player at `spawn` → fade in. */
  async travel(to, spawn = {}, { state, ms = 420, sound = 'sfx.door' } = {}) {
    const g = this.g;
    const S = this.session;
    if (this.traveling) return;
    this.traveling = true;
    const J = this.julian;
    g.player.enabled = false;
    J.stop?.();
    if (sound) g.audio.play(sound, { volume: sound === 'sfx.door' ? 0.45 : 0.6 });
    await g.fader.to(true, ms);
    if (S !== this.session) { this.traveling = false; return; }
    this.clearCrowd();
    g.interactions.setItems([]);
    await g.setLocation(to, { state: state ?? this.place?.state?.[to] });
    g.world.followTarget = () => J;
    J.root.position.y = 0;
    J.stand();
    J.placeAt(spawn.x ?? 0, spawn.z ?? -0.6, spawn.facing ?? 1);
    g.cameraSys.setShot(null, 0);
    g.cameraSys.snap();
    await this.place?.onEnter?.(to);
    if (S !== this.session) { this.traveling = false; return; }
    this.placeItems();
    await sleep(0.1);
    await g.fader.to(false, ms + 120);
    this.traveling = false;
    if (S === this.session && !g.dialogue.busy) g.player.enabled = true;
  },

  // ------------------------------------------------------------------ the crowd

  /**
   * Background people for the current location. Each entry: { key, x, z, facing, do, … }
   *   do: 'lane'   — walks / runs back and forth along { z, minX, maxX } (speed, run chance)
   *       'depth'  — walks into the depth of a cross corridor and back ({ x, zNear, zFar })
   *       'stand'  — stands, turns now and then (queue, chatting pairs)
   *       'seated' — behind a table: lowered so the table hides the legs
   */
  spawnCrowd(list) {
    const g = this.g;
    this.clearCrowd();
    const token = this.crowdToken = (this.crowdToken || 0) + 1;
    const S = this.session;
    const alive = () => this.crowdToken === token && this.session === S;
    this.extras = list.map((c, i) => {
      const ch = this.castIn(g.world, c.key, `crowd_${c.key}_${i}`);
      ch.root.scale.setScalar(ch.def?.scale || 1);
      ch.placeAt(c.x, c.z, c.facing ?? (Math.random() < 0.5 ? 1 : -1));
      ch.root.position.y = c.y ?? 0;
      if (c.do === 'seated') { ch.shadow.visible = false; ch.root.position.y = c.y ?? -0.45; }
      this.crowdLife(ch, c, alive);
      return ch;
    });
    return this.extras;
  },

  async crowdLife(ch, c, alive) {
    await sleep(rnd(0, 1.5));
    while (alive()) {
      if (c.do === 'lane') {
        const run = Math.random() < (c.run ?? 0.35);
        const speed = run ? rnd(2.6, 3.4) : rnd(1.0, 1.35);
        // run to the far end of the lane, or a short wander
        const far = Math.random() < 0.6;
        const tx = far ? (ch.position.x < (c.minX + c.maxX) / 2 ? rnd(c.maxX - 1.5, c.maxX) : rnd(c.minX, c.minX + 1.5)) : THREE.MathUtils.clamp(ch.position.x + rnd(-3, 3), c.minX, c.maxX);
        await ch.walkTo({ x: tx, z: c.z + rnd(-0.15, 0.15) }, { speed, direct: true });
        if (!alive()) break;
        await sleep(rnd(0.4, run ? 1.2 : 3.5));
      } else if (c.do === 'depth') {
        await ch.walkTo({ x: c.x + rnd(-0.3, 0.3), z: c.zFar }, { speed: rnd(1.0, 1.3), direct: true });
        if (!alive()) break;
        await sleep(rnd(1.5, 5));
        await ch.walkTo({ x: c.x + rnd(-0.3, 0.3), z: c.zNear }, { speed: rnd(1.0, 1.3), direct: true });
        if (!alive()) break;
        await sleep(rnd(1.5, 5));
      } else {
        await sleep(rnd(3, 9));
        if (!alive()) break;
        if (c.turn !== false && Math.random() < 0.5) ch.face(-ch.facing);
      }
    }
  },

  clearCrowd() {
    this.crowdToken = (this.crowdToken || 0) + 1;
    for (const ch of this.extras || []) { ch.stop(); ch.setVisible(false); ch.root.position.y = 0; ch.shadow.visible = true; }
    this.extras = [];
  },

  /** The school's background life (corridor / cafeteria), laid out from the scene's spots. */
  schoolCrowd(loc) {
    const w = this.g.world;
    const sp = w.spots || {};
    const G = ['stuG0', 'stuG1', 'stuG2', 'stuG3', 'stuG4', 'stuG5'];
    const B = ['stuB0', 'stuB1', 'stuB2', 'stuB3'];
    const list = [];
    if (loc === 'school') {
      const lanes = sp.runLanes || [{ z: -0.2, minX: -9, maxX: 10.5 }, { z: -1.9, minX: -9, maxX: 10.5 }];
      const keys = [B[0], G[1], B[1], G[3], G[5]];
      keys.forEach((key, i) => {
        const L = lanes[i % lanes.length];
        list.push({ key, do: 'lane', x: rnd(L.minX, L.maxX), z: L.z, minX: L.minX, maxX: L.maxX, run: i < 2 ? 0.7 : 0.25 });
      });
      const cc = sp.crossCorridor;
      if (cc) {
        list.push({ key: G[0], do: 'depth', x: cc.x - 0.3, z: cc.zFar + 2, zNear: cc.zNear, zFar: cc.zFar });
        list.push({ key: B[2], do: 'depth', x: cc.x + 0.4, z: cc.zNear - 1, zNear: cc.zNear, zFar: cc.zFar });
      }
      // a pair chatting by the lockers
      list.push({ key: G[4], do: 'stand', x: -2.4, z: -2.2, facing: 1 }, { key: B[3], do: 'stand', x: -1.7, z: -2.25, facing: -1, turn: false });
    } else if (loc === 'cafeteria') {
      const seats = (sp.seatsBehind || []).slice();
      const girls = sp.girlsTable;
      // keep the girls' table free
      const free = seats.filter((s) => !girls || Math.abs(s.x - girls.x) > 1.4 || Math.abs(s.z - girls.z) > 0.6);
      const seatKeys = [G[0], B[1], G[2], G[4], B[3], G[5], B[0], G[1]];
      free.slice(0, seatKeys.length).forEach((s, i) => list.push({ key: seatKeys[i], do: 'seated', x: s.x, z: s.z, y: s.y, facing: s.facing ?? (i % 2 ? 1 : -1) }));
      (sp.queue || []).slice(0, 3).forEach((q, i) => list.push({ key: [B[2], G[3], B[0]][i], do: 'stand', x: q.x, z: q.z, facing: q.facing ?? 1, turn: false }));
      const lanes = sp.walkLanes || [{ z: -0.3, minX: -8.5, maxX: 8.5 }];
      [G[1], B[1], G[5]].forEach((key, i) => {
        const L = lanes[i % lanes.length];
        list.push({ key, do: 'lane', x: rnd(L.minX, L.maxX), z: L.z, minX: L.minX, maxX: L.maxX, run: i === 0 ? 0.5 : 0.15 });
      });
    }
    return this.spawnCrowd(list);
  },
};

export function installPlaces(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}

export { pick };
