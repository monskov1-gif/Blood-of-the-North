import * as THREE from 'three';

/**
 * Proximity interactions. An interactable is plain data:
 *   { id, label, at: {x, z}, radius, anchor: Vector3 (icon position),
 *     if?: condition, once?: bool, run: async (ctx) => {} }
 * The nearest available one within its radius becomes "focused"; the HUD
 * shows a discreet marker over its anchor, and the interact action runs it.
 */
export class InteractionSystem {
  constructor({ bus, state, input }) {
    this.bus = bus;
    this.state = state;
    this.input = input;
    this.items = [];
    this.focused = null;
    this.enabled = true;
    this.running = false;
    bus.on('action', ({ action, down }) => {
      if (down && action === 'interact') this.trigger();
    });
  }

  setItems(items) {
    this.items = items;
    // a new set of interactables means the story moved on: an item whose run is still pending
    // (a talk that goes on into a whole sequence, a door) must not keep the new ones locked
    this.running = false;
    this.runToken = (this.runToken || 0) + 1;
    // emit the change so the HUD drops the old marker (otherwise a label from
    // the previous location lingers on screen)
    this.setFocus(null);
  }

  add(item) { this.items.push(item); }

  available(item) {
    if (item.disabled) return false;
    if (item.once && this.state.interacted.has(item.id)) return false;
    return this.state.test(item.if);
  }

  update(player) {
    if (!this.enabled || this.running || !player) { this.setFocus(null); return; }
    let best = null, bestD = Infinity;
    const px = player.position.x, pz = player.position.z;
    for (const it of this.items) {
      if (!this.available(it)) continue;
      const dx = px - it.at.x, dz = (pz - it.at.z) * 0.7;
      const d = Math.hypot(dx, dz);
      if (d < (it.radius ?? 1.1) && d < bestD) { best = it; bestD = d; }
    }
    this.setFocus(best);
  }

  setFocus(item) {
    if (item === this.focused) return;
    this.focused = item;
    this.bus.emit('focus', item);
  }

  async trigger(item = this.focused) {
    if (!item || this.running || !this.enabled) return;
    this.running = true;
    this.setFocus(null);
    this.state.markInteracted(item.id);
    this.bus.emit('interact', item);
    const token = this.runToken = (this.runToken || 0) + 1;
    try { await item.run?.(item); } catch (e) { console.error(e); }
    if (this.runToken === token) this.running = false;
  }

  /** Projects an anchor to screen (for the HUD marker). */
  static project(anchor, camera, w, h) {
    const v = new THREE.Vector3().copy(anchor).project(camera);
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 };
  }
}
