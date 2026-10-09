import { el, wait } from './dom.js';

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

  /** Shutter: white flash, a polaroid thumbnail slides into the corner. */
  async photo(label) {
    const f = el('div', 'lz-flash', this.root);
    this.audio.play('ui.select', { volume: 0.8 });
    const t = el('div', 'lz-thumb', this.root, `<i></i><span>${label}</span>`);
    this.photos.push(label);
    await wait(380);
    f.remove();
    setTimeout(() => t.classList.add('out'), 1800);
    setTimeout(() => t.remove(), 2400);
  }

  /** Recording overlay over the live scene: REC, time code, frame corners. Returns stop(). */
  film() {
    const w = el('div', 'lz-rec', this.root, '<div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div><div class="rec"><i></i>REC</div><div class="tc">00:00</div><div class="bat">▮▮▯ 23:41</div>');
    const tc = w.querySelector('.tc');
    const t0 = performance.now();
    const iv = setInterval(() => { const s = Math.floor((performance.now() - t0) / 1000); tc.textContent = `00:${String(s).padStart(2, '0')}`; }, 250);
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
      m.innerHTML = `<svg viewBox="0 0 100 70" preserveAspectRatio="none">
        <path class="river" d="M8 66 C 18 58, 14 48, 26 44 S 40 40, 44 32 S 58 22, 66 20 S 82 14, 88 6" />
        <path class="road" d="M2 50 L 30 54 L 60 46 L 98 40" />
        <path class="cliffs" d="M76 4 l3 -2 l3 3 l3 -3 l3 2 l3 -2 l3 3" />
        <text x="4" y="8">${opts.title || 'ДОЛИНА ТАКХИНИ'}</text><text x="70" y="66">↑ С</text>
        <path class="link" d="" /><path class="next" d="" /></svg>`;
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
          link.setAttribute('d', 'M' + pins.slice(0, k).map(([a, b]) => `${a} ${b}`).join(' L'));
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
      el('div', 'cc-title', w, 'ЗАПИСИ КАМЕР · «СЕВЕРНАЯ РОЗА» · 4–5 ДЕКАБРЯ');
      const grid = el('div', 'cc-grid', w);
      const note = el('div', 'lz-map-hint', w, `Найдите, что не так на записях (${need})`);
      let found = 0;
      frames.forEach((f) => {
        const c = el('button', 'cc-frame', grid);
        const cv = document.createElement('canvas'); cv.width = 240; cv.height = 150; c.appendChild(cv);
        paintCam(cv.getContext('2d'), f.kind);
        el('span', 'cc-tc', c, `CAM ${f.cam} · ${f.tc}`);
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

/** Grainy black-and-white camera stills of the bar (procedural, small). */
function paintCam(x, kind) {
  const W = 240, H = 150;
  let s = kind.length * 131 + 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, W, H);
  if (kind === 'static') {
    for (let i = 0; i < 6000; i++) { const v = r() * 255; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(r() * W, r() * H, 2, 1); }
    x.fillStyle = '#000'; x.fillRect(70, 64, 100, 20); x.fillStyle = '#ddd'; x.font = '12px monospace'; x.fillText('NO SIGNAL · 41:12', 76, 78);
    return;
  }
  // the bar: counter, shelves, tables
  x.fillStyle = '#2e2e2e'; x.fillRect(0, 70, W, 80);
  x.fillStyle = '#3a3a3a'; x.fillRect(20, 30, 200, 36);
  for (let i = 0; i < 40; i++) { x.fillStyle = r() < 0.5 ? '#5a5a5a' : '#777'; x.fillRect(24 + i * 5, 34 + (i % 3) * 10, 3, 8); }
  x.fillStyle = '#444'; x.fillRect(10, 74, 220, 10);
  const person = (px, py, h = 40, c = '#555', face = '#999') => { x.fillStyle = c; x.fillRect(px - 6, py - h, 12, h); x.fillStyle = face; x.fillRect(px - 4, py - h - 9, 8, 9); };
  if (kind === 'enter') { person(40, 130); person(90, 120); person(150, 126); person(200, 128); x.fillStyle = '#888'; x.fillRect(196, 80, 30, 50); }
  if (kind === 'cocktail') {
    person(60, 128); person(110, 122, 40, '#4a4a4a');
    person(200, 120, 42, '#111', '#fff');                 // the man in black: a white blur where the face is
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(200, 74, 10, 0, 7); x.fill();
    x.fillStyle = '#bbb'; x.fillRect(150, 100, 6, 8);    // the glass on the tray
  }
  if (kind === 'mirror') {
    x.fillStyle = '#4a4a4a'; x.fillRect(150, 20, 70, 50);  // the mirror
    person(120, 130, 42, '#555'); person(176, 132, 44, '#111', '#888');
    x.fillStyle = '#3a3a3a'; x.fillRect(110, 58, 10, 10); // only Julian is reflected
  }
  if (kind === 'after') { for (let i = 0; i < 6; i++) { x.fillStyle = '#4a4a4a'; x.fillRect(20 + i * 36, 120 + (i % 2) * 8, 26, 7); } }
  // grain + scanlines + vignette
  const im = x.getImageData(0, 0, W, H);
  for (let i = 0; i < im.data.length; i += 4) { const n = (r() - 0.5) * 40; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
  x.putImageData(im, 0, 0);
  x.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1);
}
