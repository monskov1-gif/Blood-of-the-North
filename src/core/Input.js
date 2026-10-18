/**
 * Unified input: keyboard, mouse/touch pointer and the virtual joystick feed
 * the same "actions" so gameplay code never cares about the device.
 *
 * axis      → { x, y } in [-1, 1]  (x: left/right, y: depth, + is towards the camera)
 * actions   → 'interact', 'advance', 'menu', 'skip', 'log', 'auto'
 */
const KEYMAP = {
  KeyE: 'interact', Space: 'interact', Enter: 'interact', KeyF: 'interact',
  Escape: 'menu', KeyP: 'menu',
  ControlLeft: 'skip', ControlRight: 'skip',
  KeyL: 'log', KeyA_auto: 'auto',
};

export class Input {
  constructor(bus) {
    this.bus = bus;
    this.keys = new Set();
    this.virtualAxis = { x: 0, y: 0 };
    this.enabled = true;
    this.scrambler = null; // hallucination hook: (axis) => axis
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    window.addEventListener('keydown', (e) => {
      if (e.repeat && KEYMAP[e.code] !== 'skip') return;
      this.keys.add(e.code);
      const action = KEYMAP[e.code];
      if (action) {
        if (['Space', 'Enter'].includes(e.code)) e.preventDefault();
        this.bus.emit('action', { action, source: 'keyboard', down: true });
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const action = KEYMAP[e.code];
      if (action) this.bus.emit('action', { action, source: 'keyboard', down: false });
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  get axis() {
    let x = 0, y = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
      if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
      if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
      if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
      x += this.virtualAxis.x;
      y += this.virtualAxis.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const axis = { x, y };
    return this.scrambler ? this.scrambler(axis) : axis;
  }

  get running() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }

  get skipHeld() { return this.keys.has('ControlLeft') || this.keys.has('ControlRight'); }

  /** Used by touch buttons and UI. */
  trigger(action, source = 'ui') { this.bus.emit('action', { action, source, down: true }); }
}
