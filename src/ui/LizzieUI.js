import { el, wait } from './dom.js';
import { paintCCTV, paintValleyMap, paintSnapshot } from './LizzieArt.js';

const MAP_CACHE = new Map();
const FONTS = ['30px "Playfair SC"', 'italic 13px "Old Standard TT"', '13px "Old Standard TT"', '26px MonteCarlo'];

/**
 * Lizzie's phone camera (photos of the traces in L1, the video in L2) and the river map
 * where the player connects the kill sites herself (L1).
 */
export class LizzieUI {
  constructor({ root, bus, audio }) {
    this.root = root;
    this.bus = bus;
    this.audio = audio;
    this.photos = [];
  }

  /** Shutter: a black blink, a white flash, a polaroid of the frame slides into the corner. */
  async photo(label) {
    const f = el('div', 'lz-flash', this.root);
    this.audio.play('ui.select', { volume: 0.8 });
    const t = el('div', 'lz-thumb', this.root, `<div class="ph"><canvas width="216" height="150"></canvas></div><span>${label}</span><em>${new Date().toTimeString().slice(0, 5)}</em>`);
    const cv = t.querySelector('canvas');
    if (!grabView(cv)) paintSnapshot(cv, label);
    this.photos.push(label);
    await wait(420);
    f.remove();
    setTimeout(() => t.classList.add('out'), 1900);
    setTimeout(() => t.remove(), 2500);
  }

  /** Recording overlay over the live scene: REC, time code, frame corners. Returns stop(). */
  film() {
    const w = el('div', 'lz-rec', this.root, `<div class="grain"></div><div class="grid"></div>
      <div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div>
      <div class="focus"><i></i></div>
      <div class="rec"><i></i>REC <span class="tc">00:00:00</span></div>
      <div class="fmt">4K · 30 FPS · HDR</div>
      <div class="bat"><b><i></i></b> 23%</div>
      <div class="meter"><span>L</span><i></i><span>R</span><i></i></div>
      <div class="zoom">1×</div><div class="exp">ISO 3200 · 1/30 · ☀︎ −0.7</div>`);
    const tc = w.querySelector('.tc'), bars = w.querySelectorAll('.meter i');
    const t0 = performance.now();
    const iv = setInterval(() => {
      const ms = performance.now() - t0, s = Math.floor(ms / 1000), fr = Math.floor((ms % 1000) / 33.4);
      tc.textContent = `00:${String(s).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
      bars.forEach((b) => (b.style.setProperty('--lvl', `${18 + Math.random() * 62}%`)));
    }, 120);
    this.audio.play('ui.select', { volume: 0.6 });
    return () => { clearInterval(iv); w.classList.add('out'); setTimeout(() => w.remove(), 500); };
  }

  /**
   * The river valley map: the player clicks the pins in order (by date); the line is drawn,
   * extended, and the next point appears. Used by Lizzie (L1) and by Julian (chapters 6, 8).
   *   opts: { title, pins: [[x, y, label]], next: [x, y, label], hint, done, extra: [[x, y, label]] }
   */
  map(opts = {}) {
    const pins = opts.pins || [[22, 47, '1 · юг'], [43, 34, '2 · середина'], [62, 22, '3 · север']];
    const nx = opts.next || [78, 12, '4 · излучина?'];
    const hint = opts.hint || 'Соедините места нападений по порядку: от первого к последнему';
    const done = opts.done || 'Каждые четыре дня — севернее, вдоль реки. Следующая — у излучины.';
    return new Promise((resolve) => {
      const w = el('div', 'lz-map-wrap', this.root);
      const m = el('div', `lz-map ${opts.julian ? 'jul' : ''}`, w);
      m.innerHTML = `<canvas class="paper"></canvas><div class="shade"></div><svg viewBox="0 0 100 70" preserveAspectRatio="none">
        <path class="link-shadow" d="" /><path class="link" d="" /><path class="next" d="" /></svg>`;
      drawMap(m.querySelector('canvas'), { julian: !!opts.julian, title: opts.title });
      el('div', 'lz-map-hint', w, hint);
      const link = m.querySelector('.link'), next = m.querySelector('.next');
      for (const [x, y, label] of opts.extra || []) { const q = el('div', 'lz-pin ghost', m, `<b>${label}</b>`); q.style.left = `${x}%`; q.style.top = `${(y / 70) * 100}%`; }
      let k = 0;
      pins.forEach(([x, y, label], i) => {
        const p = el('button', 'lz-pin', m, `<b>${label}</b>`);
        p.style.left = `${x}%`; p.style.top = `${(y / 70) * 100}%`;
        p.addEventListener('click', () => {
          if (i !== k) { p.classList.add('shake'); setTimeout(() => p.classList.remove('shake'), 400); return; }
          p.classList.add('on');
          this.audio.play('ui.hover', { volume: 0.6 });
          k++;
          const d = 'M' + pins.slice(0, k).map(([a, b]) => `${a} ${b}`).join(' L');
          link.setAttribute('d', d); m.querySelector('.link-shadow').setAttribute('d', d);
          if (k === pins.length) {
            const [lx, ly] = pins[pins.length - 1];
            next.setAttribute('d', `M${lx} ${ly} L ${nx[0]} ${nx[1]}`);
            const q = el('div', 'lz-pin next', m, `<b>${nx[2]}</b>`);
            q.style.left = `${nx[0]}%`; q.style.top = `${(nx[1] / 70) * 100}%`;
            w.querySelector('.lz-map-hint').textContent = done;
            setTimeout(() => { w.classList.add('out'); setTimeout(() => { w.remove(); this.bus.emit('panel', false); resolve(true); }, 500); }, 3600);
          }
        });
      });
      this.bus.emit('panel', true);
    });
  }

  /**
   * CCTV of the «Northern Rose» (chapter 6): frames with time codes; the player marks what is
   * wrong. Resolves when the required anomalies are found.
   */
  cctv(frames, need = 2) {
    return new Promise((resolve) => {
      const w = el('div', 'lz-map-wrap cctv', this.root);
      el('div', 'cc-title', w, 'ЗАПИСИ КАМЕР · «СЕВЕРНАЯ РОЗА» · 25–26 НОЯБРЯ');
      const grid = el('div', 'cc-grid', w);
      const note = el('div', 'lz-map-hint', w, `Найдите, что не так на записях (${need})`);
      let found = 0;
      frames.forEach((f, i) => {
        const c = el('button', 'cc-frame', grid);
        const cv = document.createElement('canvas'); cv.width = 480; cv.height = 300; c.appendChild(cv);
        setTimeout(() => paintCCTV(cv, f), 60 + i * 90); // one still per tick, so the panel opens at once
        el('span', 'cc-mark', c);
        c.addEventListener('click', () => {
          if (c.classList.contains('seen')) return;
          c.classList.add('seen', f.anomaly ? 'hit' : 'miss');
          note.textContent = f.note;
          this.audio.play(f.anomaly ? 'ui.select' : 'ui.hover', { volume: 0.6 });
          if (f.anomaly && ++found >= need) setTimeout(() => { w.classList.add('out'); setTimeout(() => { w.remove(); this.bus.emit('panel', false); resolve(true); }, 500); }, 2600);
        });
      });
      this.bus.emit('panel', true);
    });
  }
}

/** The map sheet is painted once per variant and copied after that. */
function drawMap(cv, o) {
  const key = `${o.julian}|${o.title || ''}`;
  const paint = () => {
    if (!MAP_CACHE.has(key)) { const c = document.createElement('canvas'); paintValleyMap(c, o); MAP_CACHE.set(key, c); }
    const src = MAP_CACHE.get(key);
    cv.width = src.width; cv.height = src.height; cv.getContext('2d').drawImage(src, 0, 0);
  };
  const fonts = document.fonts ? Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  Promise.race([fonts, wait(1200)]).then(() => requestAnimationFrame(paint));
}

/** Copy the live game frame into the polaroid (false when the WebGL buffer can't be read). */
function grabView(cv) {
  try {
    const v = document.getElementById('view'); const src = v?.tagName === 'CANVAS' ? v : v?.querySelector('canvas');
    if (!src || !src.width) return false;
    const x = cv.getContext('2d'), s = Math.min(src.width / cv.width, src.height / cv.height) * 0.62;
    const sw = cv.width * s, sh = cv.height * s;
    x.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let sum = 0;
    for (let i = 0; i < d.length; i += 64) sum += d[i] + d[i + 1] + d[i + 2];
    if (sum / (d.length / 64) < 6) return false;
    // phone flash: a hot centre falling off to the corners
    const g = x.createRadialGradient(cv.width / 2, cv.height * 0.55, 0, cv.width / 2, cv.height * 0.55, cv.width * 0.7);
    g.addColorStop(0, 'rgba(255,250,235,0.35)'); g.addColorStop(0.5, 'rgba(255,250,235,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    x.globalCompositeOperation = 'overlay'; x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'source-over';
    return true;
  } catch { return false; }
}
