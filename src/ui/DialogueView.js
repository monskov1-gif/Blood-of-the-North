import { CHARACTERS } from '../../data/characters.js';

const SLOTS = ['left', 'right', 'right2'];
const PORTRAIT_DOWN = ['sad', 'tired', 'concerned', 'dizzy', 'pain'];

/** Preloads the painted portraits so the first swap has no flicker. */
export function preloadPortraits(ids = ['julian', 'kayden', 'waiter']) {
  for (const id of ids) for (let i = 0; i < 3; i++) { const im = new Image(); im.src = `assets/portraits/${id}_${i}.webp`; }
}
const GLITCH = '▓▒░#%&@$¥§¶†‡∆';

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

/**
 * Presentation of dialogue:
 *  - 'vn'   full dialogue screen: painted background, large portraits, text box
 *  - 'bark' cinematic subtitles over the 3D scene while exploring
 */
export class DialogueView {
  constructor({ root, bus, settings, input, audio, state }) {
    this.bus = bus;
    this.settings = settings;
    this.input = input;
    this.audio = audio;
    this.state = state;
    this.auto = false;
    this.skip = false;
    this.mode = null;
    this.cast = {};
    this.expr = {};
    this.speaking = null;
    this.bgProvider = null;
    this.waiter = null;

    // ---------------- VN screen
    const vn = this.vn = el('div', 'vn hidden', root);
    this.bgA = el('div', 'vn-bg', vn);
    this.bgB = el('div', 'vn-bg', vn);
    this.bgFront = this.bgA;
    const pts = el('div', 'vn-portraits', vn);
    this.slots = {};
    for (const s of SLOTS) {
      const wrap = el('div', `pt pt-${s}`, pts);
      const a = el('img', 'pt-img', wrap);
      const b = el('img', 'pt-img', wrap);
      a.alt = b.alt = '';
      this.slots[s] = { wrap, imgs: [a, b], front: 0, id: null, sig: '' };
    }
    this.fx = el('div', 'vn-fx', vn);
    const box = this.box = el('div', 'vn-box', vn);
    const nameRow = el('div', 'vn-name', box);
    this.nameEl = el('span', 'n', nameRow);
    el('span', 'dots', nameRow, '· · ·');
    el('span', 'rule', nameRow);
    this.nameEn = el('span', 'en', nameRow);
    this.textEl = el('div', 'vn-text', box);
    this.nextEl = el('div', 'vn-next', box, '<i></i>');
    this.choicesEl = el('div', 'vn-choices', vn);
    const tools = el('div', 'vn-tools', vn);
    this.btnAuto = this.toolButton(tools, 'АВТО', 'AUTO', () => this.toggleAuto());
    this.btnSkip = this.toolButton(tools, 'ПРОПУСК', 'SKIP', () => this.toggleSkip());
    this.toolButton(tools, 'ЖУРНАЛ', 'LOG', () => this.bus.emit('ui-open', 'log'));
    this.toolButton(tools, 'МЕНЮ', 'MENU', () => this.bus.emit('ui-open', 'pause'));

    vn.addEventListener('pointerup', (e) => {
      if (e.target.closest('.vn-tools, .vn-choices')) return;
      this.advance();
    });

    // ---------------- bark subtitles
    const bark = this.bark = el('div', 'bark hidden', root);
    this.barkName = el('div', 'bark-name', bark);
    this.barkText = el('div', 'bark-text', bark);
    this.barkHint = el('div', 'bark-hint', bark, this.input.isTouch ? 'коснитесь' : 'E / Пробел');
    // barks: a tap anywhere on the scene advances (the canvas is outside #ui)
    window.addEventListener('pointerup', (e) => {
      if (this.mode === 'bark' && !this.blocked && !e.target.closest?.('.touch, .hud-btns, .panel-wrap, .phone-wrap, .vn')) this.advance();
    });

    bus.on('action', ({ action, down }) => {
      if (!down || !this.mode || this.blocked) return;
      if (action === 'interact') this.advance();
      if (action === 'auto' && this.mode === 'vn') this.toggleAuto();
    });

    this.loop();
  }

  toolButton(parent, ru, en, fn) {
    const b = el('button', 'vn-tool', parent, `<b>${ru}</b><small>${en}</small>`);
    b.addEventListener('click', (e) => { e.stopPropagation(); this.audio.play('ui.select'); fn(); });
    return b;
  }

  toggleAuto() { this.auto = !this.auto; this.btnAuto.classList.toggle('on', this.auto); if (this.auto && this.waiter?.done) this.scheduleAuto(); }
  toggleSkip() { this.skip = !this.skip; this.btnSkip.classList.toggle('on', this.skip); if (this.skip) this.advance(true); }

  // ------------------------------------------------------------------ open / close

  async open(d) {
    this.mode = d.mode;
    if (d.mode === 'vn') {
      this.cast = { ...(d.cast || {}) };
      this.expr = {};
      for (const s of SLOTS) this.slots[s].wrap.classList.remove('show', 'active');
      this.textEl.textContent = '';
      this.nameEl.textContent = '';
      this.nameEn.textContent = '';
      if (d.bg) await this.setBackground(d.bg, true);
      this.vn.classList.remove('hidden');
      this.audio.play('ui.open');
      await wait(30);
      this.vn.classList.add('show');
      this.refreshCast();
      await wait(450);
    }
  }

  async close(d) {
    const mode = d?.mode || this.mode;
    if (mode === 'vn') {
      this.vn.classList.remove('show');
      await wait(500);
      this.vn.classList.add('hidden');
    } else {
      this.bark.classList.add('hidden');
    }
    this.mode = null;
    this.speaking = null;
  }

  /** Temporarily hide the VN screen (3D cutscene inside a dialogue). */
  async hideVN() {
    this.vn.classList.remove('show');
    await wait(500);
    this.vn.classList.add('hidden');
    this.suspendedMode = this.mode;
    this.mode = 'cutscene';
  }

  async showVN() {
    this.mode = this.suspendedMode || 'vn';
    this.vn.classList.remove('hidden');
    await wait(30);
    this.vn.classList.add('show');
    await wait(450);
  }

  /** Temporarily switch line presentation to subtitles (used inside cutscenes). */
  setBarkMode(on) { this.mode = on ? 'bark' : (this.suspendedMode || 'vn'); }

  // ------------------------------------------------------------------ background & cast

  async setBackground(key, instant = false) {
    if (!this.bgProvider || this.bgKey === key) return;
    this.bgKey = key;
    const canvas = await this.bgProvider(key);
    if (!canvas) return;
    const back = this.bgFront === this.bgA ? this.bgB : this.bgA;
    back.innerHTML = '';
    back.appendChild(canvas);
    canvas.className = 'vn-bg-canvas';
    back.classList.add('front');
    if (instant) { back.style.transition = 'none'; }
    back.style.opacity = 1;
    this.bgFront.style.opacity = 0;
    this.bgFront.classList.remove('front');
    this.bgFront = back;
    if (instant) { void back.offsetWidth; back.style.transition = ''; }
  }

  setCast(slot, id) {
    this.cast[slot] = id;
    this.refreshCast();
  }

  setExpressions(map) {
    Object.assign(this.expr, map);
    this.refreshCast();
  }

  refreshCast() {
    for (const s of SLOTS) {
      const id = this.cast[s];
      const slot = this.slots[s];
      if (!id) { slot.wrap.classList.remove('show'); slot.id = null; continue; }
      slot.id = id;
      slot.wrap.classList.add('show');
      slot.wrap.classList.toggle('active', this.speaking === id || (this.speaking === 'thought' && id === 'julian'));
      this.drawSlot(slot);
    }
  }

  /**
   * Painted portraits (assets/portraits/<id>_<n>.webp):
   *   0 — neutral, 1 — speaking (gesture, open mouth), 2 — looking down (sad / concerned / unwell).
   * Changes cross-fade between two stacked images.
   */
  drawSlot(slot) {
    const id = slot.id;
    const expr = this.expr[id] || 'neutral';
    const down = PORTRAIT_DOWN.includes(expr);
    const idx = down ? 2 : (this.speaking === id ? 1 : 0);
    const sig = `${id}|${idx}`;
    slot.wrap.classList.toggle('pale', expr === 'dizzy' || expr === 'pain');
    if (slot.sig === sig) return;
    slot.sig = sig;
    const next = slot.imgs[1 - slot.front];
    const cur = slot.imgs[slot.front];
    next.src = `assets/portraits/${id}_${idx}.webp`;
    const swap = () => { next.classList.add('on'); cur.classList.remove('on'); slot.front = 1 - slot.front; };
    if (next.complete && next.naturalWidth) swap(); else next.onload = swap;
  }

  loop() {
    const tick = () => {
      const dt = 1 / 30;
      if (this.distort > 0 && this.typedText) this.renderDistorted();
    };
    setInterval(tick, 1000 / 30);
  }

  // ------------------------------------------------------------------ lines

  speakerInfo(id) {
    if (id === 'thought') return { name: 'Джулиан', en: 'INNER VOICE', cls: 'thought' };
    if (id === 'narrator') return { name: '', en: '', cls: 'narrator' };
    if (id === 'unknown') return { name: '???', en: 'UNKNOWN', cls: 'unknown' };
    const c = CHARACTERS[id];
    return { name: c?.name || id, en: c?.nameEn || '', cls: id };
  }

  showLine(line) {
    return new Promise((resolve) => {
      this.speaking = line.speaker;
      const info = this.speakerInfo(line.speaker);
      const vn = this.mode === 'vn';
      const nameEl = vn ? this.nameEl : this.barkName;
      const textEl = vn ? this.textEl : this.barkText;
      nameEl.textContent = info.name;
      if (vn) {
        this.nameEn.textContent = info.en;
        this.box.className = `vn-box sp-${info.cls}`;
        this.refreshCast();
      } else {
        this.bark.className = `bark sp-${info.cls}`;
      }
      this.distort = line.distort || 0;
      this.choicesEl.innerHTML = '';
      this.nextEl.classList.remove('show');
      this.barkHint.classList.remove('show');
      this.waiter = { resolve, line, done: false, textEl };
      this.type(textEl, line.text, () => {
        this.waiter.done = true;
        if (line.choices) { this.showChoices(line.choices); return; }
        this.nextEl.classList.add('show');
        this.barkHint.classList.add('show');
        if (this.skip && line.read) { setTimeout(() => this.advance(), 60); return; }
        if (this.input.skipHeld && line.read) { setTimeout(() => this.advance(), 40); return; }
        if (this.auto || this.mode === 'cinematic') this.scheduleAuto();
      }, line);
    });
  }

  scheduleAuto() {
    const w = this.waiter;
    if (!w) return;
    const base = 1.2 + (1 - this.settings.get('autoDelay')) * 0.4;
    const ms = (base + w.line.text.length * 0.045) * 1000 * (0.5 + this.settings.get('autoDelay'));
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => { if (this.waiter === w && w.done) this.advance(); }, ms);
  }

  type(target, text, onDone, line) {
    clearInterval(this.typeTimer);
    this.fullText = text;
    this.typedText = '';
    this.typing = true;
    target.textContent = '';
    // a previous distorted line must not leave the blur on
    target.classList.remove('distort');
    target.style.removeProperty('--blur');
    const fast = (this.skip || this.input.skipHeld) && line.read;
    const cps = fast ? 400 : 22 + this.settings.get('textSpeed') * 70;
    let i = 0;
    let acc = 0;
    const step = 1000 / 60;
    this.typeTimer = setInterval(() => {
      acc += (cps * step) / 1000;
      const n = Math.floor(acc);
      if (n > 0) {
        acc -= n;
        i = Math.min(text.length, i + n);
        this.typedText = text.slice(0, i);
        if (this.distort > 0) this.renderDistorted(); else target.textContent = this.typedText;
        if (this.mode === 'vn' && i % 3 === 0 && text[i - 1] !== ' ') this.audio.play('ui.type');
      }
      if (i >= text.length) this.finishTyping(onDone);
    }, step);
    this.typeDone = onDone;
  }

  finishTyping(onDone = this.typeDone) {
    clearInterval(this.typeTimer);
    if (!this.typing) return;
    this.typing = false;
    this.typedText = this.fullText;
    const target = this.waiter?.textEl;
    if (target) { if (this.distort > 0) this.renderDistorted(); else target.textContent = this.fullText; }
    this.refreshCast();
    onDone?.();
  }

  renderDistorted() {
    const target = this.waiter?.textEl;
    if (!target) return;
    const d = this.distort * this.settings.get('effects');
    let html = '';
    for (const ch of this.typedText) {
      if (ch !== ' ' && Math.random() < d * 0.12) html += `<span class="gl">${GLITCH[Math.floor(Math.random() * GLITCH.length)]}</span>`;
      else if (ch !== ' ' && Math.random() < d * 0.25) html += `<span class="jit" style="--j:${(Math.random() - 0.5) * 6 * d}px">${ch}</span>`;
      else html += ch === '<' ? '&lt;' : ch;
    }
    target.innerHTML = html;
    target.style.setProperty('--blur', `${d * 1.2}px`);
    target.classList.toggle('distort', d > 0);
  }

  showChoices(choices) {
    const w = this.waiter;
    this.choicesEl.innerHTML = '';
    const host = this.mode === 'vn' ? this.choicesEl : this.choicesEl;
    if (this.mode !== 'vn') this.vn.classList.remove('hidden');
    choices.forEach((c, i) => {
      const b = el('button', 'choice', host, `<span class="mark">◆</span><span>${c.text}</span>`);
      b.style.animationDelay = `${i * 80}ms`;
      b.addEventListener('mouseenter', () => this.audio.play('ui.hover'));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.play('ui.select');
        this.choicesEl.innerHTML = '';
        this.waiter = null;
        w.resolve(i);
      });
    });
    this.choiceKeys = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) this.choicesEl.children[n - 1]?.click();
    };
    window.addEventListener('keydown', this.choiceKeys, { once: true });
  }

  advance() {
    const w = this.waiter;
    if (!w) return;
    if (this.typing) { this.finishTyping(); return; }
    if (w.line.choices) return;
    clearTimeout(this.autoTimer);
    this.waiter = null;
    this.audio.play('ui.advance');
    w.resolve();
  }

  /** Non-blocking subtitle (does not take input or stop the player). */
  flash(speaker, text, ms = 3200, { top = false } = {}) {
    if (this.mode && this.mode !== 'flash') return Promise.resolve();
    const info = this.speakerInfo(speaker);
    this.mode = 'flash';
    this.bark.className = `bark sp-${info.cls}${top ? ' top' : ''}`;
    this.barkName.textContent = info.name;
    this.barkText.textContent = text;
    this.barkHint.classList.remove('show');
    clearTimeout(this.flashT);
    return new Promise((resolve) => {
      this.flashT = setTimeout(() => {
        if (this.mode === 'flash') { this.bark.classList.add('hidden'); this.mode = null; }
        resolve();
      }, ms);
    });
  }

  // ------------------------------------------------------------------ hallucination look of the dialogue screen

  setFx({ blur = 0, hue = 0, red = 0, wobble = 0, ghost = 0, dark = 0 } = {}) {
    const k = this.settings.get('effects');
    this.vn.style.setProperty('--fx-blur', `${blur * k}px`);
    this.vn.style.setProperty('--fx-hue', `${hue * k}deg`);
    this.vn.style.setProperty('--fx-red', red * k);
    this.vn.style.setProperty('--fx-wobble', wobble * k);
    this.vn.style.setProperty('--fx-ghost', ghost * k);
    this.vn.style.setProperty('--fx-dark', dark);
    this.vn.classList.toggle('fx-on', Math.abs(blur) + Math.abs(hue) + red + wobble + ghost > 0);
  }
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
