import { el } from './dom.js';
import { CASES, VICTIMS, LIZZY_PHONE } from '../../data/cases.js';

/**
 * Case files, modelled on docs/claude/case_menu_reference.jpg: a dark desk, a sheet of
 * card with pinned photos and red string, paper tabs on the left, a magnifier, and an
 * open notebook for the case itself.
 *   victims()  — the RCMP list of the dead (typed sheet)
 *   choose()   — two folders on the board → resolves with the chosen case id (or null)
 *   open(id)   — the investigation notebook (HUD folder button)
 */
export class CaseFiles {
  constructor({ root, bus, audio, state, atlas }) {
    this.root = root;
    this.bus = bus;
    this.audio = audio;
    this.state = state;
    this.atlas = atlas;
    this.photos = new Map();
  }

  get isOpen() { return !!this.wrap; }

  // ------------------------------------------------------------------ shell

  shell(cls) {
    this.close(true);
    const w = this.wrap = el('div', `casefiles ${cls}`, this.root);
    w.style.setProperty('--cf-paper', `url(${paperTexture()})`);
    w.style.setProperty('--cf-card', `url(${paperTexture(1)})`);
    el('div', 'cf-desk', w);
    // out-of-focus things on the desk at the edges of the frame (as the shell casings in the reference)
    for (let i = 0; i < 4; i++) el('i', `cf-bokeh b${i}`, w);
    const back = el('button', 'cf-back', w, '<i>↩</i><span>Вернуться<small>RETURN TO THE PLOT</small></span>');
    back.addEventListener('click', () => this.close());
    this.esc = (e) => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); this.close(); } };
    window.addEventListener('keydown', this.esc, true);
    this.bus.emit('panel', true);
    this.audio.play('sfx.paper', { volume: 0.5 });
    return w;
  }

  close(silent = false) {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    window.removeEventListener('keydown', this.esc, true);
    if (!silent) this.bus.emit('panel', false);
    const r = this.resolve; this.resolve = null;
    r?.(this.result ?? null);
    this.result = null;
  }

  // ------------------------------------------------------------------ victims list

  victims() {
    const w = this.shell('cf-victims');
    el('div', 'cf-sheet under', w);
    const sheet = el('div', 'cf-sheet', w);
    el('div', 'cf-clip', sheet);
    el('div', 'cf-sheet-head', sheet, `<b>КОРОЛЕВСКАЯ КАНАДСКАЯ КОННАЯ ПОЛИЦИЯ · М-ОТДЕЛ</b>
      <span>Уайтхорс, Юкон · дело № 1204-УБ</span>
      <h2>Список погибших — бар «Северная роза»</h2>
      <span>ночь с 4 на 5 декабря · подтверждено: ${VICTIMS.length}</span>`);
    const t = el('table', 'cf-list', sheet);
    t.innerHTML = VICTIMS.map((v, i) => `<tr><td>${i + 1}.</td><td>${v.name.toUpperCase()}</td><td>${v.age}</td><td>${v.where}</td></tr>`).join('');
    el('div', 'cf-sheet-foot', sheet, 'Причина смерти во всех случаях: острая кровопотеря.<br>Следов крови на месте происшествия не обнаружено.<br><b>Выживший:</b> Рид, Джулиан, детектив — госпитализирован.');
    el('div', 'cf-stain', sheet);
    el('div', 'cf-hint', w, 'НАЖМИТЕ, ЧТОБЫ ОТЛОЖИТЬ');
    w.addEventListener('pointerdown', (e) => { if (!e.target.closest('.cf-back')) this.close(); });
    this.state.set('read_victims', true);
    return new Promise((r) => { this.resolve = r; });
  }

  // ------------------------------------------------------------------ choosing a case

  choose() {
    const w = this.shell('cf-choose');
    const board = el('div', 'cf-board', w);
    el('div', 'cf-board-label', board, 'ОТДЕЛ ТЯЖКИХ ПРЕСТУПЛЕНИЙ · RCMP WHITEHORSE');
    const svg = el('div', 'cf-strings', board);
    const fw = this.folder(board, CASES.WEREWOLF, 'fw', [
      { cls: 'ph lizzy', kind: 'lizzy', cap: 'Э. Рид · 11.11' },
      { cls: 'ph carc', kind: 'carcass', cap: 'долина Такхини' },
    ], '<s>ЗАКРЫТО</s>', 'не закрыто<br>— Дж.');
    const fv = this.folder(board, CASES.VAMPIRE, 'fv', [
      { cls: 'ph rose', kind: 'rose', cap: '«Северная роза»' },
      { cls: 'ph kayden', kind: 'kayden', cap: 'К. Альварес' },
    ], 'В РАБОТЕ', '');
    const note = el('div', 'cf-note', board, 'одна и та же зима?<br>одна и та же ночь?');
    el('i', 'cf-pin', note);
    const pin = (sel) => board.querySelector(`${sel} > .cf-pin`);
    linkPins(svg, board, [[pin('.ph.lizzy'), pin('.ph.rose')], [pin('.ph.lizzy'), pin('.cf-note')], [pin('.ph.kayden'), pin('.cf-note')], [pin('.ph.carc'), pin('.ph.lizzy')]]);
    deco(w);
    const cap = el('div', 'cf-caption', w, '«Выберите дело, которым займётесь»<small>“Choose the case you will work on”</small>');
    fw.addEventListener('click', () => this.preview('WEREWOLF'));
    fv.addEventListener('click', () => {
      if (fv.classList.contains('wip')) return;
      fv.classList.add('wip');
      el('div', 'cf-stamp-wip', fv, 'ВЕТКА В РАЗРАБОТКЕ');
      this.audio.play('sfx.thud', { volume: 0.5 });
      cap.innerHTML = '«Эта линия расследования ещё в разработке»<small>“The vampire branch is still in development”</small>';
    });
    return new Promise((r) => { this.resolve = r; });
  }

  folder(board, c, cls, photos, stamp, scrawl) {
    const f = el('div', `cf-folder ${cls}`, board);
    el('div', 'cf-ftab', f, c.no.replace('ДЕЛО ', '№ '));
    const body = el('div', 'cf-fbody', f);
    el('div', 'cf-fno', body, `${c.no}<br><small>${c.en}</small>`);
    el('i', 'cf-clipm', body);
    el('div', 'cf-ftitle', body, c.title);
    el('div', `cf-fstamp ${cls}`, body, stamp);
    if (scrawl) el('div', 'cf-scrawl', body, scrawl);
    for (const p of photos) this.photo(body, p.kind, p.cls, p.cap);
    el('i', 'cf-pin', f);
    return f;
  }

  /** The chosen folder opens as a notebook with a «take the case» seal. */
  preview(id) {
    this.audio.play('sfx.paper', { volume: 0.6 });
    const w = this.wrap;
    w.classList.add('cf-previewing');
    const book = this.book(w, id, { preview: true });
    const take = el('button', 'cf-take', book.querySelector('.cf-right'), '<b>ВЗЯТЬ ДЕЛО</b><small>TAKE THE CASE</small>');
    take.addEventListener('click', (e) => { e.stopPropagation(); this.result = id; this.close(); });
    const back = el('button', 'cf-take ghost', book.querySelector('.cf-right'), '<b>К ПАПКАМ</b><small>BACK</small>');
    back.addEventListener('click', (e) => { e.stopPropagation(); book.remove(); w.classList.remove('cf-previewing'); });
  }

  // ------------------------------------------------------------------ the case notebook

  open(id) {
    const w = this.shell('cf-case');
    deco(w);
    this.book(w, id, {});
    return new Promise((r) => { this.resolve = r; });
  }

  book(w, id, { preview = false }) {
    const c = CASES[id];
    const f = this.state.flags;
    const wrapBook = el('div', 'cf-book', w);
    const tabs = el('div', 'cf-tabs', wrapBook);
    const left = el('div', 'cf-page cf-left', wrapBook);
    const right = el('div', 'cf-page cf-right', wrapBook);
    el('div', 'cf-rose', left);
    // left page: evidence pinned with string
    const ev = (c.evidence || []).filter((e) => !e.req || f[e.req]);
    const spots = [[8, 8], [52, 6], [30, 34], [64, 38], [6, 50], [44, 62], [70, 66]];
    const kinds = { carcasses: 'carcass', track: 'track', bark: 'claws', fur: 'fur', phone: 'phone', tourists: 'tent', beast: 'wolf' };
    const pins = [];
    ev.forEach((e, i) => {
      const [x, y] = spots[i % spots.length];
      const p = this.photo(left, kinds[e.id] || 'carcass', `ph ev ${e.phone ? 'is-phone' : ''}`, e.title);
      p.style.left = `${x}%`; p.style.top = `${y}%`;
      p.style.setProperty('--rot', `${((i * 37) % 9) - 4}deg`);
      p.addEventListener('click', () => { show('ev'); detail(e); });
      pins.push(p.querySelector('.cf-pin'));
    });
    const s = el('div', 'cf-strings', left);
    linkPins(s, left, pins.slice(1).map((p, i) => [pins[i], p]));
    el('div', 'cf-pcap', left, `«${c.title}»<small>${c.en}</small>`);
    // right page
    el('div', 'cf-rhead', right, `<span>${c.no}</span><h3>${c.title}</h3><em>${c.status}</em>`);
    const body = el('div', 'cf-rbody', right);
    el('div', 'cf-rmeta', right, id === 'WEREWOLF'
      ? '<span>Место</span>долина р. Такхини, 40 км к С от Уайтхорса<span>Открыто</span>2 ноября<span>Пропавшая</span>Элизабет Рид, 26 л.'
      : '<span>Место</span>бар «Северная роза», Эндрю-стрит<span>Дата</span>ночь с 4 на 5 декабря<span>Погибших</span>11');
    el('div', 'cf-rstamp', right, preview ? 'RCMP' : 'В РАБОТЕ');
    const sections = preview ? [['case', 'Дело', 'FILE']] : [['case', 'Дело', 'FILE'], ['ev', 'Улики', 'EVIDENCE'], ['tasks', 'Задачи', 'TASKS'], ['victims', 'Жертвы', 'VICTIMS']];
    const tabEls = {};
    const show = (key) => {
      for (const [k, t] of Object.entries(tabEls)) t.classList.toggle('on', k === key);
      body.innerHTML = '';
      if (key === 'case') {
        el('p', 'cf-text', body, c.summary);
        el('p', 'cf-hand', body, c.personal);
      } else if (key === 'ev') {
        const list = el('div', 'cf-evlist', body);
        for (const e of ev) {
          const row = el('button', `cf-evrow${e.phone ? ' phone' : ''}`, list, `<span>${e.title}</span>${e.phone && !f.saw_lizzy_phone ? '<i>вещдок № 11</i>' : ''}`);
          row.addEventListener('click', () => detail(e));
        }
        if (!ev.length) el('p', 'cf-text', body, 'Улики пока у детектива Ковальски.');
      } else if (key === 'tasks') {
        const list = el('div', 'cf-tasks', body);
        for (const t of c.tasks || []) {
          if (t.req && !f[t.req]) continue;
          el('div', `cf-task${f[t.done] ? ' done' : ''}`, list, t.text);
        }
      } else if (key === 'victims') {
        if (!f.read_victims) { el('p', 'cf-text', body, 'Список погибших — на доске объявлений в участке.'); return; }
        const t = el('table', 'cf-list small', body);
        t.innerHTML = VICTIMS.map((v, i) => `<tr><td>${i + 1}.</td><td>${v.name}</td><td>${v.age}</td></tr>`).join('');
      }
      this.audio.play('ui.hover', { volume: 0.4 });
    };
    const detail = (e) => {
      body.innerHTML = '';
      el('h4', 'cf-evtitle', body, e.title);
      el('p', 'cf-text', body, e.text);
      if (e.phone) {
        const b = el('button', 'cf-take small', body, '<b>ЗАРЯДИТЬ И ВКЛЮЧИТЬ</b><small>POWER ON</small>');
        b.addEventListener('click', () => this.lizzyPhone(body));
      }
      const back = el('button', 'cf-link', body, '← к списку улик');
      back.addEventListener('click', () => show('ev'));
    };
    for (const [k, ru, en] of sections) {
      const t = tabEls[k] = el('button', 'cf-tab', tabs, `${ru}<small>${en}</small>`);
      t.addEventListener('click', () => show(k));
    }
    show('case');
    return wrapBook;
  }

  /** Evidence #11: Lizzie's phone, cracked, last screen of 11 November. */
  lizzyPhone(body) {
    body.innerHTML = '';
    const ph = el('div', 'cf-lphone', body);
    el('div', 'crack', ph, crackSVG());
    el('i', 'glare', ph);
    el('div', 'time', ph, LIZZY_PHONE.time);
    el('div', 'date', ph, LIZZY_PHONE.date);
    const list = el('div', 'notes', ph);
    LIZZY_PHONE.items.forEach((m, i) => {
      const n = el('div', `ntf${m.draft ? ' draft' : ''}${m.missed ? ' missed' : ''}${m.photo ? ' photo' : ''}`, list, `<b>${m.who} <span>${m.t}</span></b>${m.text}`);
      n.style.animationDelay = `${0.4 + i * 0.5}s`;
      if (m.photo) { const im = el('img', 'shot', n); this.paint('eyes').then((u) => { im.src = u; }); }
    });
    this.audio.play('sfx.phone', { volume: 0.5 });
    const back = el('button', 'cf-link', body, '← к списку улик');
    back.addEventListener('click', () => this.wrap?.querySelector('.cf-tab:nth-child(2)')?.click());
    if (!this.state.get('saw_lizzy_phone')) {
      this.state.set('saw_lizzy_phone', true);
      this.bus.emit('lizzy-phone');
    }
  }

  // ------------------------------------------------------------------ photos

  photo(parent, kind, cls, cap) {
    const p = el('div', `cf-photo ${cls}`, parent);
    const img = el('img', '', p);
    img.alt = '';
    el('i', 'cf-pin', p);
    if (cap) el('span', 'cf-pcaption', p, cap);
    this.paint(kind).then((url) => { img.src = url; });
    return p;
  }

  async paint(kind) {
    if (this.photos.has(kind)) return this.photos.get(kind);
    const job = paintPhoto(kind, this.atlas);
    this.photos.set(kind, job);
    return job;
  }
}

// ------------------------------------------------------------------ helpers

/** Red string between pins, measured from the laid-out DOM (in % of the holder's parent). */
function linkPins(holder, box, pairs) {
  const draw = () => {
    if (!holder.isConnected) return;
    const b = box.getBoundingClientRect();
    if (!b.width) return;
    const at = (e) => { const r = e.getBoundingClientRect(); return [((r.left + r.width / 2 - b.left) / b.width) * 100, ((r.top + r.height / 2 - b.top) / b.height) * 100]; };
    strings(holder, pairs.filter(([a, c]) => a && c).map(([a, c]) => [...at(a), ...at(c)]));
  };
  requestAnimationFrame(() => requestAnimationFrame(draw));
  setTimeout(draw, 450); // after the open animation settles
}

function strings(holder, lines) {
  holder.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines.map(([x1, y1, x2, y2]) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + Math.abs(x2 - x1) * 0.06 + 1.5; // a little sag
    return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" />`;
  }).join('')}</svg>`;
}

/** Magnifier, envelope, blood drops: desk dressing around the board. */
/** A spider-web crack from one impact point (lower left of the screen). */
function crackSVG() {
  const cx = 30, cy = 70, rays = [[-170, 40], [-120, 65], [-75, 80], [-35, 95], [5, 75], [40, 60], [80, 35], [120, 40], [160, 30]];
  let d = '';
  const pts = rays.map(([a, L]) => {
    const r = (a * Math.PI) / 180;
    const p = [[cx, cy]];
    for (let k = 1; k <= 4; k++) p.push([cx + Math.cos(r + Math.sin(k * 2.3 + a) * 0.12) * L * k / 4, cy + Math.sin(r + Math.cos(k * 1.7 + a) * 0.12) * L * k / 4]);
    d += 'M' + p.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    return p;
  });
  for (const ring of [1, 2]) d += ' M' + pts.map((p) => `${p[ring][0].toFixed(1)} ${p[ring][1].toFixed(1)}`).join(' L');
  return `<svg viewBox="0 0 100 160" preserveAspectRatio="none"><path d="${d}" /></svg>`;
}

function deco(w) {
  el('div', 'cf-magnifier', w, '<i class="lens"></i><i class="handle"></i>');
  el('div', 'cf-envelope', w);
  el('div', 'cf-blood', w);
}

const cache = new Map();
/** Grainy paper / card texture (data URL), generated once. */
function paperTexture(kind = 0) {
  if (cache.has(kind)) return cache.get(kind);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const base = kind ? [196, 178, 140] : [222, 208, 176];
  const im = ctx.createImageData(256, 256);
  let s = 7 + kind * 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 256 * 256; i++) {
    const x = i % 256, y = (i / 256) | 0;
    const n = (rnd() - 0.5) * 22 + Math.sin(x * 0.05 + y * 0.013) * 5 + Math.sin(y * 0.21) * 2;
    im.data[i * 4] = base[0] + n; im.data[i * 4 + 1] = base[1] + n; im.data[i * 4 + 2] = base[2] + n * 0.8; im.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  // fibres and age spots
  for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(120,96,60,${0.04 + rnd() * 0.08})`; ctx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 14, 1); }
  for (let i = 0; i < 10; i++) { ctx.fillStyle = `rgba(140,100,50,${0.03 + rnd() * 0.05})`; ctx.beginPath(); ctx.arc(rnd() * 256, rnd() * 256, 4 + rnd() * 18, 0, 7); ctx.fill(); }
  const url = c.toDataURL();
  cache.set(kind, url);
  return url;
}

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

/** Small "police photographs": grainy, desaturated, warm-black. */
async function paintPhoto(kind, atlas) {
  const W = 160, H = 120;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = kind.length * 977 + 3;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sprite = (name, dx, dy, k = 1, flip = false) => {
    if (!atlas?.has(name)) return;
    const f = atlas.frame(name), img = atlas.texture.image;
    x.save();
    x.imageSmoothingEnabled = false;
    if (flip) { x.translate(dx + f.w * k, dy); x.scale(-1, 1); x.drawImage(img, f.x, f.y, f.w, f.h, 0, 0, f.w * k, f.h * k); } else x.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, f.w * k, f.h * k);
    x.restore();
  };
  const snowGround = (y0, tone = 200) => {
    for (let yy = y0; yy < H; yy++) for (let xx = 0; xx < W; xx += 2) { const n = (r() - 0.5) * 26; x.fillStyle = `rgb(${tone + n},${tone + n},${tone + 6 + n})`; x.fillRect(xx, yy, 2, 1); }
  };
  const trees = (n, y0, dark = 40) => {
    for (let i = 0; i < n; i++) {
      const tx = r() * W, th = 40 + r() * 50;
      x.fillStyle = `rgb(${dark},${dark + 6},${dark + 4})`;
      x.beginPath(); x.moveTo(tx, y0 - th); x.lineTo(tx - 10 - r() * 6, y0); x.lineTo(tx + 10 + r() * 6, y0); x.fill();
    }
  };
  switch (kind) {
    case 'lizzy': case 'kayden': {
      x.fillStyle = '#3a342c'; x.fillRect(0, 0, W, H);
      const img = await loadImg(`assets/portraits/${kind}_0.webp`);
      if (img) { const k = Math.max(W / img.width, (H * 1.6) / img.height); x.drawImage(img, (W - img.width * k) / 2, -H * 0.04, img.width * k, img.height * k); }
      break;
    }
    case 'carcass': {
      x.fillStyle = '#6c7076'; x.fillRect(0, 0, W, H); trees(9, 52, 46); snowGround(50, 196);
      for (let i = 0; i < 9; i++) { const cx = 10 + r() * 140, cy = 64 + r() * 46; x.fillStyle = '#3c2a22'; x.beginPath(); x.ellipse(cx, cy, 9 + r() * 10, 3 + r() * 3, r() - 0.5, 0, 7); x.fill(); x.fillStyle = '#6a1a14'; x.fillRect(cx - 4, cy - 1, 6, 2); }
      break;
    }
    case 'rose': {
      x.fillStyle = '#120a0a'; x.fillRect(0, 0, W, H);
      x.font = 'italic 22px Georgia'; x.textAlign = 'center';
      x.shadowColor = '#ff2a3a'; x.shadowBlur = 12; x.fillStyle = '#ff5a64';
      x.fillText('Northern Rose', W / 2, 46);
      x.shadowBlur = 0; x.fillStyle = '#2a1a16'; x.fillRect(18, 62, 124, 58);
      x.fillStyle = '#d8b070'; for (let i = 0; i < 4; i++) x.fillRect(28 + i * 30, 72, 18, 22);
      x.fillStyle = '#e8e2d8'; x.fillRect(0, 108, W, 12);
      x.fillStyle = '#f2d020'; for (let i = 0; i < 9; i++) x.fillRect(i * 20 + ((r() * 6) | 0), 100, 12, 3);
      break;
    }
    case 'track': {
      x.fillStyle = '#9a9890'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(60,58,52,${r() * 0.3})`; x.fillRect(r() * W, r() * H, 2, 2); }
      x.fillStyle = '#4a4238'; x.beginPath(); x.ellipse(80, 72, 24, 28, 0, 0, 7); x.fill();
      for (const [dx, dy] of [[-26, -30], [-9, -42], [9, -42], [26, -30]]) { x.beginPath(); x.ellipse(80 + dx, 72 + dy, 8, 11, 0, 0, 7); x.fill(); x.fillStyle = '#2a241e'; x.fillRect(80 + dx - 1, 72 + dy - 18, 2, 8); x.fillStyle = '#4a4238'; }
      x.fillStyle = '#f0e8d8'; x.fillRect(116, 96, 40, 14); x.fillStyle = '#222'; x.font = '9px monospace'; x.fillText('19 см', 122, 106);
      break;
    }
    case 'claws': {
      x.fillStyle = '#5a5248'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#8a7a64'; x.fillRect(48, 0, 64, H);
      for (let i = 0; i < 4; i++) { x.strokeStyle = '#e8d8b8'; x.lineWidth = 3; x.beginPath(); x.moveTo(58 + i * 12, 10); x.lineTo(54 + i * 13, 90); x.stroke(); x.strokeStyle = '#3a2a1c'; x.lineWidth = 1; x.beginPath(); x.moveTo(60 + i * 12, 12); x.lineTo(56 + i * 13, 90); x.stroke(); }
      x.fillStyle = '#f2d020'; x.fillRect(4, 40, 18, 3); x.fillStyle = '#ddd'; x.font = '8px monospace'; x.fillText('2,1 м', 4, 36);
      break;
    }
    case 'fur': {
      x.fillStyle = '#d8d4c8'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#555'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i < 4; i++) { x.moveTo(0, 30 + i * 20); x.lineTo(W, 26 + i * 22); } x.stroke();
      for (let i = 0; i < 60; i++) { x.strokeStyle = r() < 0.3 ? '#b8b8c0' : '#2a2622'; x.beginPath(); const cx = 70 + r() * 30, cy = 50 + r() * 20; x.moveTo(cx, cy); x.lineTo(cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 30); x.stroke(); }
      break;
    }
    case 'phone': {
      x.fillStyle = '#d4ccbc'; x.fillRect(0, 0, W, H);
      x.save(); x.translate(80, 62); x.rotate(-0.2);
      x.fillStyle = '#1a1a1e'; x.fillRect(-26, -46, 52, 92); x.fillStyle = '#0a0c12'; x.fillRect(-22, -40, 44, 78);
      x.strokeStyle = 'rgba(220,230,240,0.7)'; x.beginPath(); x.moveTo(-14, -30); x.lineTo(2, -6); x.lineTo(-6, 18); x.moveTo(2, -6); x.lineTo(18, 4); x.stroke();
      x.fillStyle = '#e8b030'; x.fillRect(-16, 30, 10, 6); x.restore();
      x.fillStyle = '#c02020'; x.font = 'bold 10px monospace'; x.fillText('№ 11', 8, 16);
      break;
    }
    case 'tent': {
      x.fillStyle = '#4a5058'; x.fillRect(0, 0, W, H); trees(8, 56, 30); snowGround(54, 180);
      x.fillStyle = '#c86a1c'; x.beginPath(); x.moveTo(40, 96); x.lineTo(80, 58); x.lineTo(124, 96); x.fill();
      x.fillStyle = '#1a1210'; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(70 + i * 8, 66 + i * 4); x.lineTo(64 + i * 10, 94); x.lineTo(68 + i * 10, 94); x.fill(); }
      x.fillStyle = '#6a1a14'; for (let i = 0; i < 14; i++) x.fillRect(30 + r() * 100, 98 + r() * 18, 3, 2);
      break;
    }
    case 'eyes': {
      x.fillStyle = '#06080c'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { const tx = r() * W; x.fillStyle = `rgb(${14 + i},${18 + i},${22 + i})`; x.fillRect(tx, 0, 6 + r() * 8, H); }
      for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(120,130,140,${r() * 0.25})`; x.fillRect(r() * W, r() * H, 1, 1); }
      x.fillStyle = '#ffd890'; x.fillRect(86, 40, 3, 2); x.fillRect(96, 40, 3, 2);
      x.fillStyle = 'rgba(255,200,120,0.25)'; x.fillRect(82, 37, 22, 8);
      break;
    }
    case 'wolf': {
      x.fillStyle = '#1a2026'; x.fillRect(0, 0, W, H); trees(10, 92, 14);
      x.fillStyle = '#2a3036'; x.fillRect(0, 92, W, 28);
      sprite('wolf_dark', 30, 30, 0.45);
      x.fillStyle = 'rgba(255,220,120,0.9)'; x.fillRect(118, 44, 2, 1);
      break;
    }
    default: x.fillStyle = '#555'; x.fillRect(0, 0, W, H);
  }
  // photographic finish: desaturate to warm black-and-white, grain, vignette
  const im = x.getImageData(0, 0, W, H);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % W, py = ((i / 4) / W) | 0;
    let l = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15;
    const keep = kind === 'rose' || kind === 'tent' || kind === 'phone' ? 0.55 : 0.18;
    const vx = px / W - 0.5, vy = py / H - 0.5, v = 1 - (vx * vx + vy * vy) * 1.4;
    const n = (r() - 0.5) * 22;
    for (let k = 0; k < 3; k++) {
      const sep = [1.07, 0.98, 0.84][k];
      d[i + k] = ((l * sep) * (1 - keep) + d[i + k] * keep) * v + n;
    }
  }
  x.putImageData(im, 0, 0);
  return c.toDataURL('image/jpeg', 0.86);
}

