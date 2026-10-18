import { el, ICONS } from './dom.js';

/**
 * On-screen joystick (left) + interact / run buttons (right) for phones and
 * tablets. Feeds Input.virtualAxis and triggers actions, so gameplay code is
 * identical for touch and keyboard.
 */
export class TouchControls {
  constructor({ root, input, bus, settings }) {
    this.input = input;
    this.bus = bus;
    this.settings = settings;
    const t = this.el = el('div', 'touch hidden', root);
    const joy = this.joy = el('div', 'joy', t);
    this.knob = el('div', 'knob', joy);
    const btns = el('div', 'tbtns', t);
    this.runBtn = el('button', 'tbtn small', btns, `${ICONS.run}БЕГ`);
    this.actBtn = el('button', 'tbtn', btns, `${ICONS.hand}ДЕЙСТВИЕ`);

    this.pointer = null;
    joy.addEventListener('pointerdown', (e) => { this.pointer = e.pointerId; joy.setPointerCapture(e.pointerId); this.move(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === this.pointer) this.move(e); });
    const end = (e) => { if (e.pointerId === this.pointer) { this.pointer = null; this.setAxis(0, 0); } };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    this.actBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.input.trigger('interact', 'touch'); });
    this.actBtn.addEventListener('pointerup', (e) => e.stopPropagation());
    this.runBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.input.keys.add('ShiftLeft'); });
    const runEnd = (e) => { e.stopPropagation(); this.input.keys.delete('ShiftLeft'); };
    this.runBtn.addEventListener('pointerup', runEnd);
    this.runBtn.addEventListener('pointercancel', runEnd);

    bus.on('focus', (item) => this.actBtn.classList.toggle('ready', !!item));
    bus.on('settings', ({ key }) => { if (key === 'touchControls') this.refresh(); });
    this.wanted = false;
  }

  get enabled() {
    const s = this.settings.get('touchControls');
    return s === 'on' || (s === 'auto' && this.input.isTouch);
  }

  show(v) { this.wanted = v; this.refresh(); }

  refresh() {
    this.el.classList.toggle('hidden', !(this.wanted && this.enabled));
    if (!this.wanted) this.setAxis(0, 0);
  }

  move(e) {
    const r = this.joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    this.setAxis(dx, dy);
  }

  setAxis(x, y) {
    const dead = 0.18;
    const k = (v) => (Math.abs(v) < dead ? 0 : (v - Math.sign(v) * dead) / (1 - dead));
    this.input.virtualAxis.x = k(x);
    this.input.virtualAxis.y = k(y);
    this.knob.style.transform = `translate(${x * 39}px, ${y * 39}px)`;
  }
}
