import { el } from './dom.js';
import { valueNoise, fbm, mulberry } from './LizzieArt.js';
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
    ], 'ДОСТУП ЗАКРЫТ', 'свидетель<br>— не моё');
    const note = el('div', 'cf-note', board, 'одна и та же зима?<br>одна и та же ночь?');
    el('i', 'cf-pin', note);
    const pin = (sel) => board.querySelector(`${sel} > .cf-pin`);
    linkPins(svg, board, [[pin('.ph.lizzy'), pin('.ph.rose')], [pin('.ph.lizzy'), pin('.cf-note')], [pin('.ph.kayden'), pin('.cf-note')], [pin('.ph.carc'), pin('.ph.lizzy')]]);
    deco(w);
    const cap = el('div', 'cf-caption', w, '«Выберите дело, которым займётесь»<small>“Choose the case you will work on”</small>');
    fw.addEventListener('click', () => this.preview('WEREWOLF'));
    fv.addEventListener('click', () => this.preview('VAMPIRE'));
    void cap;
    return new Promise((r) => { this.resolve = r; });
  }

  folder(board, c, cls, photos, stamp, scrawl) {
    const f = el('div', `cf-folder ${cls}`, board);
    el('div', 'cf-ftab', f, c.no.replace('ДЕЛО ', ''));
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
    if (CASES[id].wip) {
      // the bar case is Kowalski's, and Julian is its only surviving witness: he can't take it
      el('p', 'cf-hand small', book.querySelector('.cf-rbody'), 'Свидетель не может вести своё дело. Ковальски не отдаст его — и правильно сделает.');
      el('div', 'cf-take locked', book.querySelector('.cf-right'), '<b>ДОСТУП ЗАКРЫТ</b><small>WITNESS — NOT ASSIGNABLE</small>');
    } else {
      const take = el('button', 'cf-take', book.querySelector('.cf-right'), '<b>ВЗЯТЬ ДЕЛО</b><small>TAKE THE CASE</small>');
      take.addEventListener('click', (e) => { e.stopPropagation(); this.result = id; this.close(); });
    }
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
      this.wrap?.classList.remove('cf-phone-on');
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
          if (t.req && ![].concat(t.req).every((k) => f[k])) continue;
          const row = el(t.action && !f[t.done] ? 'button' : 'div', `cf-task${f[t.done] ? ' done' : ''}${t.action && !f[t.done] ? ' act' : ''}`, list, t.text);
          if (t.action === 'analysis' && !f[t.done]) row.addEventListener('click', () => this.analysis(body, () => show('tasks')));
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
      this.wrap?.classList.remove('cf-phone-on');
    };
    for (const [k, ru, en] of sections) {
      const t = tabEls[k] = el('button', 'cf-tab', tabs, `${ru}<small>${en}</small>`);
      t.addEventListener('click', () => show(k));
    }
    show('case');
    return wrapBook;
  }

  /**
   * Task «Сопоставить следы» (chapter 8): three findings from the valley side by side on the page,
   * one question. A wrong answer is crossed out with the reason in Julian's hand.
   */
  analysis(body, back) {
    body.innerHTML = '';
    el('h4', 'cf-evtitle', body, 'Сопоставить следы');
    const row = el('div', 'cf-an-row', body);
    const cards = [
      ['track', 'Слепок · 19 см', 'Передняя лапа. Волчья по форме, по размеру — вдвое больше.'],
      ['claws', 'Борозды · 2,1 м', 'Четыре полосы, сверху вниз. Зверь стоял на задних лапах.'],
      ['carcass', 'Кость', 'Перекушена, не разгрызена. Следы одной пасти. Стаи нет.'],
    ];
    for (const [kind, cap, note] of cards) {
      const card = el('div', 'cf-an-card', row);
      this.photo(card, kind, 'ph an', cap);
      el('p', 'cf-an-note', card, note);
    }
    el('p', 'cf-hand', body, 'Что здесь было?');
    const answers = [
      ['Стая волков', 'Тогда где следы стаи? Здесь прошёл один.'],
      ['Медведь-шатун', 'Медведь не убивает двадцать три туши, не съев ни одной. И когти не те.'],
      ['Один зверь. Огромный. Встаёт на задние лапы.', null],
    ];
    const list = el('div', 'cf-an-answers', body);
    const msg = el('p', 'cf-an-msg', body, '');
    for (const [text, wrong] of answers) {
      const b = el('button', 'cf-an-ans', list, text);
      b.addEventListener('click', () => {
        if (wrong) {
          b.classList.add('wrong'); msg.textContent = wrong;
          this.audio.play('ui.hover', { volume: 0.5 });
          return;
        }
        b.classList.add('right');
        msg.textContent = 'Один. Огромный. И он не охотится — он что-то уничтожает. Нарочно.';
        this.state.set('fo_analysis_done', true);
        this.audio.play('sfx.paper', { volume: 0.6 });
        setTimeout(back, 2600);
      });
    }
    const bk = el('button', 'cf-link', body, '← к задачам');
    bk.addEventListener('click', back);
  }

  /** Evidence #11: Lizzie's phone, cracked, last screen of 11 November. */
  lizzyPhone(body) {
    body.innerHTML = '';
    this.wrap?.classList.add('cf-phone-on');
    const ph = el('div', 'cf-lphone', body);
    const cr = el('div', 'crack', ph);
    cr.style.backgroundImage = `url(${crackTexture()})`;
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
/** Shattered glass: an impact point with chips, radial cracks of varying width, broken rings. */
let crackURL = null;
function crackTexture() {
  if (crackURL) return crackURL;
  const W = 360, H = 640, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  let s = 91;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const cx = W * 0.86, cy = H * 0.9;   // impact in the lower corner, away from the text
  const rays = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + r() * 0.3, L = 120 + r() * 420;
    const pts = [[cx, cy]];
    let px = cx, py = cy, ang = a;
    for (let k = 0; k < 9; k++) { ang += (r() - 0.5) * 0.35; px += Math.cos(ang) * L / 9; py += Math.sin(ang) * L / 9; pts.push([px, py]); }
    rays.push(pts);
  }
  const stroke = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); };
  x.lineJoin = 'miter';
  // shadow under every crack (refraction), then the bright edge, tapering away from the impact
  for (const p of rays) for (let k = 0; k < p.length - 1; k++) {
    const w = Math.max(0.5, 2.6 - k * 0.3);
    stroke([p[k], p[k + 1]], w + 1.6, 'rgba(0,0,0,0.55)');
    stroke([[p[k][0] - 0.8, p[k][1] - 0.8], [p[k + 1][0] - 0.8, p[k + 1][1] - 0.8]], w, 'rgba(240,246,252,0.85)');
  }
  // broken concentric rings between neighbouring rays
  for (const ring of [1, 2, 4]) for (let i = 0; i < rays.length; i++) {
    if (r() < 0.35) continue;
    const a = rays[i][ring], b = rays[(i + 1) % rays.length][ring];
    stroke([a, [(a[0] + b[0]) / 2 + (r() - 0.5) * 10, (a[1] + b[1]) / 2 + (r() - 0.5) * 10], b], 1.1, 'rgba(235,242,250,0.7)');
  }
  // the impact: crushed glass, small chips with light and dark facets
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = r() * 26;
    x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    x.beginPath(); x.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
    x.lineTo(cx + Math.cos(a + 0.4) * (d + 8), cy + Math.sin(a + 0.4) * (d + 8)); x.lineTo(cx + Math.cos(a - 0.3) * (d + 6), cy + Math.sin(a - 0.3) * (d + 6)); x.fill();
  }
  crackURL = c.toDataURL();
  return crackURL;
}

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

/** Small "police photographs": grainy, desaturated, warm-black, lit by an on-camera flash. */
async function paintPhoto(kind, atlas) {
  const W = 240, H = 180;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const r = mulberry(kind.length * 977 + 3), n = valueNoise(kind.length * 31 + 5);
  const sprite = (name, dx, dy, k = 1) => {
    if (!atlas?.has(name)) return;
    const f = atlas.frame(name), img = atlas.texture.image;
    x.save(); x.imageSmoothingEnabled = false; x.drawImage(img, f.x, f.y, f.w, f.h, dx, dy, f.w * k, f.h * k); x.restore();
  };
  /** per-pixel texture: fn(px, py) → [r, g, b] */
  const field = (fn, x0 = 0, y0 = 0, w = W, h = H) => {
    const im = x.getImageData(x0, y0, w, h), d = im.data;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const o = (yy * w + xx) * 4, v = fn(x0 + xx, y0 + yy, d[o], d[o + 1], d[o + 2]); if (v) { d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = 255; } }
    x.putImageData(im, x0, y0);
  };
  /** a spruce: a thin trunk with drooping, ragged tiers of branches */
  const spruce = (tx, by, h, tone) => {
    x.fillStyle = `rgb(${tone},${tone + 4},${tone + 3})`;
    x.fillRect(tx - 1, by - h, 2, h);
    for (let i = 0; i < h / 3; i++) {
      const yy = by - h + i * 3 + 2, w = 1.5 + (i / (h / 3)) * h * 0.22 * (0.7 + r() * 0.5);
      x.beginPath(); x.moveTo(tx, yy - 2); x.lineTo(tx - w, yy + 2 + r() * 2); x.lineTo(tx - w * 0.3, yy + 1); x.lineTo(tx + w * 0.3, yy + 1); x.lineTo(tx + w, yy + 2 + r() * 2); x.closePath(); x.fill();
    }
  };
  const forestWall = (y0, n0, tone) => { for (let i = 0; i < n0; i++) spruce(r() * W, y0 + r() * 6, 40 + r() * 60, tone + r() * 12); };
  const snow = (y0, tone = 205) => field((px, py) => {
    if (py < y0) return null;
    const t = (py - y0) / (H - y0), v = tone - 30 + t * 40 + (fbm(n, px * 0.05, py * 0.12, 4) - 0.5) * 50 + (r() - 0.5) * 10;
    return [v, v, v + 6];
  });
  const flash = (cx, cy, rad, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, `rgba(255,250,240,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'overlay'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; };
  const scale = (sx, sy, len, label) => { // forensic scale bar
    for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#f2f0e8' : '#141414'; x.fillRect(sx + i * len / 10, sy, len / 10, 5); }
    x.strokeStyle = '#141414'; x.lineWidth = 1; x.strokeRect(sx, sy, len, 5);
    x.fillStyle = '#f2f0e8'; x.fillRect(sx, sy + 5, len, 9); x.fillStyle = '#141414'; x.font = '8px monospace'; x.fillText(label, sx + 3, sy + 12);
  };
  const tag = (tx, ty, t) => { x.save(); x.translate(tx, ty); x.rotate(-0.06); x.fillStyle = '#f4ecd2'; x.fillRect(0, 0, 44, 16); x.strokeStyle = '#2a2a2a'; x.strokeRect(0, 0, 44, 16); x.fillStyle = '#c01818'; x.font = 'bold 10px monospace'; x.fillText(t, 5, 12); x.restore(); };
  switch (kind) {
    case 'lizzy': case 'kayden': {
      x.fillStyle = '#3a342c'; x.fillRect(0, 0, W, H);
      const img = await loadImg(`assets/portraits/${kind}_0.webp`);
      if (img) { const k = Math.max(W / img.width, (H * 1.6) / img.height); x.drawImage(img, (W - img.width * k) / 2, -H * 0.04, img.width * k, img.height * k); }
      break;
    }
    case 'carcass': {
      // a grey overcast sky, the black spruce wall, trampled snow with dark carcasses and drag marks
      const g = x.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, '#8a8e94'); g.addColorStop(1, '#a8acb0'); x.fillStyle = g; x.fillRect(0, 0, W, 80);
      forestWall(78, 46, 30); snow(72, 205);
      for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(90,80,76,0.45)'; x.lineWidth = 3 + r() * 3; x.beginPath(); const sx = r() * W, sy = 90 + r() * 80; x.moveTo(sx, sy); x.bezierCurveTo(sx + 20, sy - 8, sx + 50, sy + 6, sx + 80 * (r() - 0.3), sy - 20 - r() * 10); x.stroke(); }
      const carc = (cx, cy, k, ang) => {
        x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(k, k);
        x.fillStyle = 'rgba(60,20,16,0.35)'; x.beginPath(); x.ellipse(2, 3, 30, 10, 0, 0, 7); x.fill();           // blood-soaked snow
        x.fillStyle = '#3e2c22'; x.beginPath(); x.ellipse(0, 0, 22, 8, 0, 0, 7); x.fill();                        // the body
        x.beginPath(); x.ellipse(-24, -3, 7, 4.5, -0.4, 0, 7); x.fill(); x.fillRect(-20, -6, 6, 6);               // neck + head
        x.strokeStyle = '#3e2c22'; x.lineWidth = 2.6; x.lineCap = 'round';
        for (const [lx, a] of [[-14, 1.05], [-9, 1.2], [9, 1.0], [14, 1.18]]) { x.beginPath(); x.moveTo(lx, 5); x.lineTo(lx + Math.cos(a) * 9, 5 + Math.sin(a) * 9); x.lineTo(lx + Math.cos(a) * 9 + 3, 5 + Math.sin(a) * 9 + 8); x.stroke(); }  // stiff legs, all to one side
        x.fillStyle = '#7a1c16'; x.beginPath(); x.ellipse(2, -1, 11, 5, 0, 0, 7); x.fill();                        // the opened flank
        x.strokeStyle = '#d8c8b8'; x.lineWidth = 1.1; for (let k2 = 0; k2 < 6; k2++) { x.beginPath(); x.arc(2 + k2 * 2.6 - 6, 3, 5, 3.6, 5.6); x.stroke(); }
        x.strokeStyle = '#5a4a3a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-28, -6); x.lineTo(-34, -16); x.lineTo(-38, -14); x.moveTo(-33, -14); x.lineTo(-30, -20); x.stroke(); // antler
        x.restore();
      };
      carc(70, 118, 1.15, 0.1); carc(168, 104, 0.85, -0.2); carc(120, 152, 1.4, 0.05); carc(206, 140, 1.1, 0.4);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(70,16,12,${0.3 + r() * 0.5})`; x.fillRect(20 + r() * 210, 96 + r() * 80, 1 + r() * 2, 1); }
      flash(120, 130, 140, 0.45);
      break;
    }
    case 'rose': {
      // the bar at night from across the street: board siding, warm windows, the neon, snow and a car
      x.fillStyle = '#0a0a10'; x.fillRect(0, 0, W, H);
      field((px, py) => { if (py < 52 || py > 140) return null; const v = 34 + ((py % 5) === 0 ? -12 : 0) + (fbm(n, px * 0.2, py * 0.05) - 0.5) * 18; return [v + 6, v, v - 2]; });
      x.fillStyle = '#16110e'; x.beginPath(); x.moveTo(0, 54); x.lineTo(120, 26); x.lineTo(240, 54); x.fill();
      field((px, py) => { if (py < 26 || py > 56) return null; const t = Math.abs(px - 120) / 120 * 28; if (py < 54 - (28 - t)) return null; const v = 196 + (r() - 0.5) * 30; return [v, v, v + 8]; });
      for (let i = 0; i < 4; i++) { const wx = 18 + i * 56; const g = x.createLinearGradient(0, 74, 0, 112); g.addColorStop(0, '#f0c070'); g.addColorStop(1, '#a86a30'); x.fillStyle = g; x.fillRect(wx, 74, 36, 38); x.fillStyle = '#2a1a10'; x.fillRect(wx + 17, 74, 2, 38); x.fillRect(wx, 92, 36, 2); x.fillStyle = 'rgba(40,24,14,0.7)'; x.fillRect(wx + 4, 96, 10, 16); }
      x.font = 'italic 26px Georgia'; x.textAlign = 'center'; x.shadowColor = '#ff2a3a'; x.shadowBlur = 16; x.fillStyle = '#ff6a74'; x.fillText('Northern Rose', W / 2, 66); x.shadowBlur = 4; x.fillStyle = '#ffd8dc'; x.fillText('Northern Rose', W / 2, 66); x.shadowBlur = 0; x.textAlign = 'left';
      snow(140, 170);
      const rg = x.createRadialGradient(120, 150, 0, 120, 150, 90); rg.addColorStop(0, 'rgba(255,80,90,0.35)'); rg.addColorStop(1, 'rgba(255,80,90,0)'); x.fillStyle = rg; x.fillRect(0, 140, W, 40);
      x.fillStyle = '#08080a'; x.beginPath(); x.moveTo(150, 168); x.lineTo(156, 150); x.lineTo(176, 144); x.lineTo(206, 144); x.lineTo(222, 152); x.lineTo(236, 156); x.lineTo(236, 170); x.closePath(); x.fill();
      x.fillStyle = '#ffeec0'; x.fillRect(230, 158, 6, 4);
      for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`; x.fillRect(r() * W, r() * H, 1, 1 + r() * 2); }
      break;
    }
    case 'track': {
      // plaster cast of a print on a lab table, with a scale bar and an evidence tag
      field((px, py) => { const v = 70 + fbm(n, px * 0.04, py * 0.04) * 40; return [v, v - 4, v - 8]; });
      x.save(); x.translate(120, 92); x.rotate(-0.08);
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.ellipse(6, 8, 78, 64, 0, 0, 7); x.fill();
      x.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, rr = 1 + (r() - 0.5) * 0.08; const px = Math.cos(a) * 74 * rr, py = Math.sin(a) * 60 * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fillStyle = '#d8d2c2'; x.fill();
      x.restore();
      field((px, py, R0, G0, B0) => { if (R0 < 150) return null; const v = R0 + (fbm(n, px * 0.15, py * 0.15) - 0.5) * 34 + (r() - 0.5) * 8; return [v, v - 3, v - 10]; });
      const pad = (cx, cy, rx, ry, a = 0) => {
        x.save(); x.translate(cx, cy); x.rotate(a);
        const g = x.createRadialGradient(-rx * 0.3, -ry * 0.4, 1, 0, 0, Math.max(rx, ry)); g.addColorStop(0, '#8a8274'); g.addColorStop(0.7, '#5c564a'); g.addColorStop(1, '#a8a090');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill();
        x.strokeStyle = 'rgba(250,246,236,0.7)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0.2, 2.4); x.stroke();
        x.restore();
      };
      pad(120, 108, 26, 22);
      for (const [dx, dy, a] of [[-30, -26, -0.4], [-11, -40, -0.1], [11, -40, 0.1], [30, -26, 0.4]]) {
        pad(120 + dx, 108 + dy, 8, 11, a);
        x.strokeStyle = '#3a342c'; x.lineWidth = 2.4; x.lineCap = 'round'; x.beginPath(); x.moveTo(120 + dx * 1.15, 108 + dy - 12); x.lineTo(120 + dx * 1.3, 108 + dy - 22); x.stroke();
      }
      scale(14, 160, 100, '0    5    10 СМ');
      tag(178, 14, '№ 7');
      flash(100, 80, 150, 0.35);
      break;
    }
    case 'claws': {
      // spruce bark close-up: vertical fissured bark, four fresh gouges of pale wood, a tape measure
      field((px, py) => { const f = fbm(n, px * 0.09, py * 0.012, 5), cr = Math.abs(Math.sin(px * 0.35 + f * 6)); const v = 46 + f * 70 - (cr < 0.18 ? 30 : 0); return [v + 6, v, v - 6]; });
      for (let i = 0; i < 4; i++) {
        const x0 = 70 + i * 26, top = 12 + r() * 10, bot = 150 + r() * 14;
        x.fillStyle = '#c8b896'; x.beginPath(); x.moveTo(x0, top); x.quadraticCurveTo(x0 - 6, (top + bot) / 2, x0 - 4 + i, bot); x.lineTo(x0 + 3 + i, bot - 4); x.quadraticCurveTo(x0 + 3, (top + bot) / 2, x0 + 8, top + 4); x.closePath(); x.fill();
        x.strokeStyle = '#1c140e'; x.lineWidth = 1.4; x.stroke();
        x.strokeStyle = 'rgba(120,96,64,0.8)'; x.lineWidth = 0.7; for (let k = 0; k < 8; k++) { const yy = top + 10 + k * 16; x.beginPath(); x.moveTo(x0 - 2, yy); x.lineTo(x0 + 4, yy + 6); x.stroke(); }
        for (let k = 0; k < 6; k++) { x.strokeStyle = '#d8c8a6'; x.lineWidth = 1; x.beginPath(); const yy = top + r() * (bot - top); x.moveTo(x0 + 6, yy); x.lineTo(x0 + 12 + r() * 6, yy + 4 + r() * 6); x.stroke(); } // torn fibres
      }
      x.fillStyle = '#e8c020'; x.fillRect(10, 0, 16, H); x.fillStyle = '#1a1a1a'; x.font = '8px monospace';
      for (let i = 0; i < H; i += 6) { x.fillRect(10, i, i % 30 === 0 ? 8 : 4, 1); if (i % 30 === 0) x.fillText(String(240 - i / 3 | 0), 15, i + 9); }
      x.fillStyle = '#fff'; x.font = 'bold 10px monospace'; x.fillText('2,1 м', 32, 14);
      flash(130, 90, 140, 0.35);
      break;
    }
    case 'fur': {
      // barbed wire across a blurred winter field, a tuft of coarse grey-black hair caught on a barb
      field((px, py) => { const v = 150 + fbm(n, px * 0.02, py * 0.02, 3) * 60 - py * 0.2; return [v, v, v + 6]; });
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(40,44,48,0.35)'; x.beginPath(); x.ellipse(r() * W, 30 + r() * 30, 30, 50, 0, 0, 7); x.fill(); }
      const wire = (y0, y1) => {
        x.strokeStyle = '#2a2826'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, y0); x.lineTo(W, y1); x.stroke();
        x.strokeStyle = 'rgba(230,226,220,0.6)'; x.lineWidth = 0.6; for (let t = 0; t < W; t += 6) { x.beginPath(); x.moveTo(t, y0 + (y1 - y0) * t / W - 1); x.lineTo(t + 3, y0 + (y1 - y0) * (t + 3) / W + 1); x.stroke(); }
        for (let t = 30; t < W; t += 52) { const yy = y0 + (y1 - y0) * t / W; x.strokeStyle = '#1e1c1a'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(t - 6, yy - 7); x.lineTo(t + 6, yy + 7); x.moveTo(t + 6, yy - 7); x.lineTo(t - 6, yy + 7); x.stroke(); }
      };
      wire(70, 62); wire(140, 128);
      for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, l = 10 + r() * 34, cx = 134 + (r() - 0.5) * 10, cy = 66 + (r() - 0.5) * 6; const t = r(); x.strokeStyle = t < 0.25 ? 'rgba(200,198,190,0.85)' : t < 0.6 ? 'rgba(40,36,32,0.85)' : 'rgba(90,84,76,0.85)'; x.lineWidth = 0.6 + r() * 0.6; x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.5 + 6, cx + Math.cos(a) * l, cy + Math.abs(Math.sin(a)) * l * 0.8); x.stroke(); }
      tag(8, 150, '№ 9');
      break;
    }
    case 'phone': {
      // the phone in a sealed evidence bag on a steel table
      field((px, py) => { const v = 120 + (fbm(n, px * 0.3, py * 0.02) - 0.5) * 40 + py * 0.1; return [v, v + 2, v + 6]; });
      x.save(); x.translate(122, 92); x.rotate(-0.16);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(-70, -76, 148, 160);
      x.fillStyle = 'rgba(235,240,245,0.28)'; x.fillRect(-74, -82, 148, 160); x.strokeStyle = 'rgba(255,255,255,0.5)'; x.strokeRect(-74, -82, 148, 160);
      x.fillStyle = '#c02020'; x.fillRect(-74, -82, 148, 14); x.fillStyle = '#fff'; x.font = 'bold 9px monospace'; x.fillText('ВЕЩДОК · EVIDENCE № 11', -66, -72);
      x.fillStyle = '#16161a'; x.beginPath(); x.roundRect(-30, -52, 60, 112, 8); x.fill();
      x.fillStyle = '#05070c'; x.fillRect(-26, -44, 52, 96);
      x.strokeStyle = 'rgba(210,225,240,0.75)'; x.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2; x.beginPath(); x.moveTo(-8, -12); let px = -8, py = -12; for (let k = 0; k < 4; k++) { px += Math.cos(a + (r() - 0.5)) * 9; py += Math.sin(a + (r() - 0.5)) * 9; x.lineTo(Math.max(-26, Math.min(26, px)), Math.max(-44, Math.min(52, py))); } x.stroke(); }
      x.fillStyle = 'rgba(90,70,50,0.7)'; for (let i = 0; i < 40; i++) x.fillRect(-30 + r() * 60, 30 + r() * 30, 2 + r() * 4, 1 + r() * 2);  // dried mud
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(-70, -60); x.lineTo(-40, -60); x.lineTo(40, 70); x.lineTo(10, 70); x.closePath(); x.fill();   // plastic sheen
      x.fillStyle = '#f4ecd2'; x.fillRect(16, 56, 52, 18); x.fillStyle = '#1d2550'; x.font = 'italic 10px Georgia'; x.fillText('Э. Рид · 11.11', 19, 69);
      x.restore();
      break;
    }
    case 'tent': {
      // the tourists' camp at night in the flash: a slashed orange tent, snow, scattered gear
      x.fillStyle = '#05070a'; x.fillRect(0, 0, W, H);
      forestWall(90, 30, 14); snow(86, 160);
      // a half-collapsed dome tent: one pole snapped, the fly slashed in parallel rips
      x.fillStyle = '#c8681c'; x.beginPath(); x.moveTo(44, 146); x.bezierCurveTo(52, 96, 92, 72, 122, 76); x.bezierCurveTo(150, 80, 176, 104, 200, 146); x.closePath(); x.fill();
      x.fillStyle = '#7a3a0e'; x.beginPath(); x.moveTo(122, 76); x.bezierCurveTo(150, 80, 176, 104, 200, 146); x.lineTo(160, 146); x.bezierCurveTo(150, 116, 140, 96, 122, 76); x.fill();
      x.strokeStyle = 'rgba(255,200,140,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(60, 140); x.bezierCurveTo(70, 100, 100, 82, 122, 80); x.stroke();
      for (let i = 0; i < 4; i++) { x.fillStyle = '#0a0806'; x.beginPath(); x.moveTo(84 + i * 10, 92 + i * 2); x.quadraticCurveTo(78 + i * 12, 118, 82 + i * 13, 142); x.lineTo(87 + i * 13, 142); x.quadraticCurveTo(85 + i * 12, 118, 89 + i * 10, 93 + i * 2); x.fill(); x.fillStyle = '#e08a40'; x.fillRect(86 + i * 10, 93 + i * 2, 4, 1); }
      x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.ellipse(122, 150, 84, 8, 0, 0, 7); x.fill();
      x.strokeStyle = '#d8c8b0'; x.lineWidth = 1; x.beginPath(); x.moveTo(122, 76); x.lineTo(128, 64); x.moveTo(44, 146); x.lineTo(30, 160); x.moveTo(196, 146); x.lineTo(220, 158); x.stroke();
      x.fillStyle = '#2a4a8a'; x.fillRect(30, 150, 22, 8); x.fillStyle = '#1a1a1a'; x.fillRect(176, 160, 18, 10);
      for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(90,16,12,${0.5 + r() * 0.5})`; x.fillRect(40 + r() * 160, 148 + r() * 28, 2 + r() * 2, 1 + r()); }
      flash(118, 120, 130, 0.55);
      break;
    }
    case 'eyes': {
      x.fillStyle = '#06080c'; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) { const tx = r() * W; x.fillStyle = `rgb(${14 + i},${18 + i},${22 + i})`; x.fillRect(tx, 0, 8 + r() * 12, H); }
      field((px, py, R0) => { const v = R0 + (r() - 0.5) * 18; return [v, v + 2, v + 4]; });
      x.fillStyle = 'rgba(255,200,120,0.25)'; x.beginPath(); x.ellipse(138, 60, 22, 9, 0, 0, 7); x.fill();
      x.fillStyle = '#ffd890'; x.beginPath(); x.ellipse(130, 60, 3, 2, 0, 0, 7); x.ellipse(146, 60, 3, 2, 0, 0, 7); x.fill();
      break;
    }
    case 'wolf': {
      x.fillStyle = '#1a2026'; x.fillRect(0, 0, W, H); forestWall(138, 30, 10);
      x.fillStyle = '#2a3036'; x.fillRect(0, 138, W, 42);
      sprite('wolf_dark', 45, 45, 0.68);
      x.fillStyle = 'rgba(255,220,120,0.9)'; x.fillRect(177, 66, 3, 2);
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
    const keep = kind === 'rose' || kind === 'tent' || kind === 'phone' ? 0.55 : kind === 'lizzy' || kind === 'kayden' ? 0.18 : 0.22;
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

