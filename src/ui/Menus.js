import { el, ICONS } from './dom.js';
import { CHARACTERS } from '../../data/characters.js';
import { VERSION } from '../version.js';

const STAGE_LABEL = {
  explore: 'Бар «Северная Роза»',
  talk1: 'Разговор с Кайденом',
  talk2: 'После коктейля',
  escape: 'Воздух…',
  morning: 'Утро. Место преступления',
  police: 'Утро. Полиция',
  car: 'Полицейская машина',
  station: 'Полицейский участок',
  interrogation: 'Допросная',
  medical: 'Обследование',
  hospital_day: 'Больница. День',
  hospital_evening: 'Больница. Вечер',
  hospital_night: 'Больница. Ночь',
  hospital_return: 'Больница. Ночь',
  recovery: 'Выздоровление',
  street: 'Выписка',
  ended: 'Конец демо',
};

function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Title screen modelled on REF UI-1: case dossier on the left, a ring with a blade pointer on the right. */
export class MainMenu {
  constructor({ root, bus, audio, saves }) {
    this.bus = bus;
    this.audio = audio;
    this.saves = saves;
    const m = this.el = el('div', 'mainmenu hidden', root);
    el('div', 'mm-title', m, `<h1><span class="title-lockup"><span class="w">BLOOD</span><span class="of">of the</span><span class="w">NORTH</span></span></h1><div class="sub">ДЕМО v${VERSION} · ПРОЛОГ · YUKON</div>`);
    this.dossier = el('div', 'dossier', m);
    const ring = this.ring = el('div', 'ring', m);
    ring.innerHTML = ringSVG();
    this.pointer = ring.querySelector('.pointer');
    this.items = el('div', 'mm-items', ring);
    el('div', 'mm-foot', m, `DEMO v${VERSION}`);
    this.entries = [];
  }

  open() {
    const latest = this.saves.latest();
    const defs = [
      { ru: 'Продолжить', en: 'CONTINUE', act: 'continue', disabled: !latest },
      { ru: 'Новая игра', en: 'NEW GAME', act: 'new' },
      { ru: 'Загрузить', en: 'LOAD', act: 'load', disabled: !latest },
      { ru: 'Настройки', en: 'SETTINGS', act: 'settings' },
      { ru: 'Об игре', en: 'ABOUT', act: 'about' },
    ];
    this.items.innerHTML = '';
    const n = defs.length;
    this.entries = defs.map((d, i) => {
      const ang = -38 + (76 / (n - 1)) * i; // degrees, 0 = pointing right
      const rad = (ang * Math.PI) / 180;
      const R = 0.36;
      const b = el('button', 'mm-item', this.items, `${d.ru}<small>${d.en}</small>`);
      b.style.left = `${50 + Math.cos(rad) * R * 100 * 0.62}%`;
      b.style.top = `${50 + Math.sin(rad) * R * 100}%`;
      b.disabled = !!d.disabled;
      b.addEventListener('mouseenter', () => this.point(i));
      b.addEventListener('focus', () => this.point(i));
      b.addEventListener('click', () => {
        if (b.disabled || this.pending) return;
        this.point(i);
        setTimeout(() => this.audio.play('ui.select'), 420);
        this.pending = true;
        // the clock hand swings to the item first, then the item fires
        setTimeout(() => { this.pending = false; this.bus.emit('menu', d.act); }, 500);
      });
      return { ...d, b, ang };
    });
    this.point(latest ? 0 : 1, true);
    this.fit();
    window.addEventListener('resize', this.fitHandler = () => this.fit());
    this.renderDossier(latest?.data);
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('show'));
    this.keyHandler = (e) => {
      const enabled = this.entries.filter((x) => !x.b.disabled);
      const idx = enabled.indexOf(this.entries[this.sel]);
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { this.point(this.entries.indexOf(enabled[(idx + 1) % enabled.length])); }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { this.point(this.entries.indexOf(enabled[(idx - 1 + enabled.length) % enabled.length])); }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.entries[this.sel].b.click(); }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  /** Keeps the arc labels inside the viewport on narrow screens. */
  fit() {
    requestAnimationFrame(() => {
      const ringRect = this.ring.getBoundingClientRect();
      for (const e of this.entries) {
        e.b.style.marginLeft = '0px';
        const r = e.b.getBoundingClientRect();
        const over = r.right - (window.innerWidth - 14);
        if (over > 0) e.b.style.marginLeft = `${-over}px`;
      }
      void ringRect;
    });
  }

  close() {
    window.removeEventListener('resize', this.fitHandler);
    this.el.classList.remove('show');
    window.removeEventListener('keydown', this.keyHandler);
    setTimeout(() => this.el.classList.add('hidden'), 900);
  }

  point(i, silent) {
    if (this.sel === i) return;
    this.sel = i;
    this.entries.forEach((e, k) => e.b.classList.toggle('sel', k === i));
    const prev = this.ang ?? this.entries[i].ang;
    this.ang = this.entries[i].ang;
    this.pointer.style.transform = `rotate(${this.entries[i].ang}deg)`;
    // the clock mechanism: one tick per few degrees of travel, then a soft clunk
    if (!silent) this.audio.play('ui.clock', { volume: 1, rate: Math.min(6, Math.max(2, Math.round(Math.abs(this.ang - prev) / 6))) });
  }

  renderDossier(save) {
    const flags = save?.state?.flags || {};
    const seen = save?.state?.interacted?.length || 0;
    this.dossier.innerHTML = `
      <div class="stats">
        <div class="stat">${ICONS.eye}${seen}/14</div>
        <div class="stat">${ICONS.claw}${flags.read_news || flags.read_newspaper ? 1 : 0}/1</div>
        <div class="stat">${ICONS.glass}${flags.drank_cocktail ? 1 : 0}/1</div>
      </div>
      <h3>Пролог. Северная Роза</h3>
      <div class="case">ДЕЛО № 1147 · ДОЛИНА ЮКОНА</div>
      <p>«Двадцать три туши у реки. Следы когтей на высоте двух метров. Коллеги говорят — волки. Лиззи пропала там же двадцать три дня назад».</p>
      <p style="margin:0">— из записей Дж. Рида</p>
      <div class="stamp">НЕ ЗАКРЫТО</div>`;
  }
}

function ringSVG() {
  // ornate ring + slowly rotating medallion + blade pointer (all procedural)
  const teeth = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    const x1 = 500 + Math.cos(a) * 170, y1 = 500 + Math.sin(a) * 170;
    const x2 = 500 + Math.cos(a) * 188, y2 = 500 + Math.sin(a) * 188;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const petals = Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45} 500 500)" d="M500 500 C 520 440, 560 400, 500 340 C 440 400, 480 440, 500 500 Z"/>`).join('');
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r1 = 452, r2 = i % 6 === 0 ? 470 : 460;
    return `<line x1="${500 + Math.cos(a) * r1}" y1="${500 + Math.sin(a) * r1}" x2="${500 + Math.cos(a) * r2}" y2="${500 + Math.sin(a) * r2}"/>`;
  }).join('');
  return `
  <svg viewBox="0 0 1000 1000">
    <defs>
      <radialGradient id="med" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3a2a26" stop-opacity="0.85"/><stop offset="1" stop-color="#120a09" stop-opacity="0.6"/></radialGradient>
      <linearGradient id="blade" x1="0" x2="1"><stop offset="0" stop-color="#cfc6b8"/><stop offset="0.75" stop-color="#e9e2d6"/><stop offset="1" stop-color="#b0161d"/></linearGradient>
    </defs>
    <g fill="none" stroke="rgba(233,220,197,0.55)">
      <circle cx="500" cy="500" r="480" stroke-width="1.5"/>
      <circle cx="500" cy="500" r="446" stroke-width="0.8" stroke-dasharray="2 6"/>
      <g stroke-width="1">${ticks}</g>
    </g>
    <g class="rot">
      <circle cx="500" cy="500" r="200" fill="url(#med)" stroke="rgba(233,220,197,0.35)"/>
      <g stroke="rgba(233,220,197,0.4)" stroke-width="2">${teeth}</g>
      <g fill="rgba(150,40,40,0.35)" stroke="rgba(233,220,197,0.45)" stroke-width="1.2">${petals}</g>
    </g>
    <g class="rot2" fill="none" stroke="rgba(233,220,197,0.45)">
      <circle cx="500" cy="500" r="120" stroke-dasharray="14 8"/>
      <circle cx="500" cy="500" r="60"/>
      <path d="M500 380 L515 470 L620 500 L515 530 L500 620 L485 530 L380 500 L485 470 Z" fill="rgba(20,10,10,0.6)"/>
    </g>
    <path d="M330 640 C 380 700, 420 690, 470 720" stroke="rgba(176,22,29,0.6)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <circle cx="465" cy="735" r="9" fill="rgba(176,22,29,0.7)"/>
    <g class="pointer">
      <path d="M480 500 L700 492 L760 500 L700 508 Z" fill="url(#blade)" stroke="#2a1a14" stroke-width="2"/>
      <path d="M420 500 C 440 470, 470 470, 480 500 C 470 530, 440 530, 420 500 Z" fill="#cfc6b8" stroke="#2a1a14" stroke-width="2"/>
      <circle cx="500" cy="500" r="16" fill="#1a1010" stroke="#cfc6b8" stroke-width="3"/>
      <path d="M740 500 L780 490 L800 500 L780 510 Z" fill="#b0161d"/>
    </g>
  </svg>`;
}

/** Paper-styled modal panels: pause, settings, save/load, log, about. */
export class Panels {
  constructor({ root, bus, audio, settings, saves, dialogue, state }) {
    this.root = root;
    this.bus = bus;
    this.audio = audio;
    this.settings = settings;
    this.saves = saves;
    this.dialogue = dialogue;
    this.state = state;
    this.stack = [];
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.stack.length) { e.stopPropagation(); this.closeTop(); }
    }, true);
  }

  get open() { return this.stack.length > 0; }

  frame(title, en) {
    const wrap = el('div', 'panel-wrap', this.root);
    const p = el('div', 'panel', wrap);
    el('h2', '', p, title);
    el('div', 'en', p, en);
    const close = el('button', 'close', p, '×');
    close.addEventListener('click', () => this.closeTop());
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.closeTop(); });
    p.insertAdjacentHTML('beforeend', '<svg class="blood" viewBox="0 0 100 100"><path d="M60 10 C 64 30, 80 40, 72 58 C 66 72, 46 70, 44 56 C 42 42, 56 34, 60 10 Z" fill="rgba(150,10,16,0.55)"/><circle cx="30" cy="78" r="5" fill="rgba(150,10,16,0.5)"/><circle cx="84" cy="84" r="3" fill="rgba(150,10,16,0.5)"/></svg>');
    this.stack.push(wrap);
    this.bus.emit('panel', true);
    this.audio.play('ui.open');
    return p;
  }

  closeTop() {
    const w = this.stack.pop();
    w?.remove();
    if (!this.stack.length) this.bus.emit('panel', false);
  }

  closeAll() { while (this.stack.length) this.closeTop(); }

  pause({ inGame = true } = {}) {
    const p = this.frame('Пауза', `PAUSE · DEMO v${VERSION}`);
    const list = el('div', 'menu-list', p);
    const item = (ru, en, fn, disabled) => {
      const b = el('button', '', list, `${ru}<small>${en}</small>`);
      b.disabled = !!disabled;
      b.addEventListener('click', () => { this.audio.play('ui.select'); fn(); });
    };
    item('Продолжить', 'RESUME', () => this.closeAll());
    item('Сохранить', 'SAVE', () => this.savePanel('save'), !this.saves.canSave);
    item('Загрузить', 'LOAD', () => this.savePanel('load'));
    item('Журнал реплик', 'LOG', () => this.log());
    item('Настройки', 'SETTINGS', () => this.settingsPanel());
    item('Главное меню', 'MAIN MENU', () => { this.closeAll(); this.bus.emit('menu', 'title'); });
    if (!this.saves.canSave) el('div', 'note', p, 'Сейчас сохранение недоступно — идёт сцена. Игра сохраняется автоматически.');
  }

  settingsPanel() {
    const p = this.frame('Настройки', 'SETTINGS');
    const s = this.settings;
    const slider = (key, ru, en) => {
      const r = el('div', 'row', p, `<label>${ru}<small>${en}</small></label>`);
      const i = el('input', '', r);
      i.type = 'range'; i.min = 0; i.max = 1; i.step = 0.05; i.value = s.get(key);
      i.addEventListener('input', () => s.set(key, +i.value));
    };
    const select = (key, ru, en, opts) => {
      const r = el('div', 'row', p, `<label>${ru}<small>${en}</small></label>`);
      const sel = el('select', '', r);
      for (const [v, t] of opts) { const o = el('option', '', sel, t); o.value = v; }
      sel.value = s.get(key);
      sel.addEventListener('change', () => s.set(key, sel.value));
    };
    slider('textSpeed', 'Скорость текста', 'CONVERSATION SPEED');
    slider('autoDelay', 'Пауза автотекста', 'AUTOMATIC SPEED');
    slider('musicVolume', 'Музыка', 'MUSIC VOLUME');
    slider('ambienceVolume', 'Атмосфера', 'AMBIENCE VOLUME');
    slider('sfxVolume', 'Звуки', 'SOUND EFFECT VOLUME');
    slider('effects', 'Сила визуальных эффектов', 'EFFECT INTENSITY');
    select('quality', 'Качество графики', 'GRAPHICS', [['auto', 'Авто'], ['high', 'Высокое'], ['low', 'Низкое (телефоны)']]);
    select('touchControls', 'Сенсорное управление', 'TOUCH CONTROLS', [['auto', 'Авто'], ['on', 'Всегда'], ['off', 'Выкл.']]);
    el('div', 'note', p, 'Управление: A/D или ←/→ — ходьба, W/S — глубина, Shift — быстрее, E/Пробел — действие, Q — телефон, Esc — меню, Ctrl — пропуск прочитанного, 1–4 — выбор ответа. Смена качества перезагружает страницу.');
  }

  savePanel(mode) {
    const p = this.frame(mode === 'save' ? 'Сохранить' : 'Загрузить', mode === 'save' ? 'SAVE GAME' : 'LOAD GAME');
    const box = el('div', 'slots', p);
    const render = () => {
      box.innerHTML = '';
      for (const { slot, data } of this.saves.list()) {
        if (mode === 'save' && slot === 'auto') continue;
        const row = el('div', 'slot', box);
        el('div', 'num', row, slot === 'auto' ? 'АВТО' : `№ ${slot}`);
        el('div', 'info', row, data
          ? `${STAGE_LABEL[data.state?.stage] || 'Бар'}<small>${fmtTime(data.time)}</small>`
          : '<small>пусто</small>');
        const acts = el('div', 'acts', row);
        if (mode === 'save') {
          const b = el('button', '', acts, 'ЗАПИСАТЬ');
          b.addEventListener('click', () => { this.saves.save(slot); this.audio.play('ui.select'); this.bus.emit('toast', 'Сохранено'); render(); });
        } else {
          const b = el('button', '', acts, 'ОТКРЫТЬ');
          b.disabled = !data;
          b.addEventListener('click', () => { this.closeAll(); this.bus.emit('load-slot', slot); });
        }
      }
    };
    render();
  }

  log() {
    const p = this.frame('Журнал', 'DIALOGUE LOG');
    const box = el('div', 'log', p);
    const hist = this.dialogue.history;
    if (!hist.length) el('div', 'note', box, 'Пока пусто.');
    for (const h of hist) {
      if (!h.text) continue;
      if (h.speaker === 'choice') { el('div', 'choice-line', box, `◆ ${h.text}`); continue; }
      const who = h.speaker === 'thought' ? 'ДЖУЛИАН (МЫСЛИ)' : h.speaker === 'narrator' ? '' : h.speaker === 'unknown' ? '???' : (CHARACTERS[h.speaker]?.name || h.speaker).toUpperCase();
      el('div', h.speaker === 'thought' ? 'thought' : '', box, `${who ? `<span class="who">${who}</span>` : ''}${h.text}`);
    }
    setTimeout(() => { p.scrollTop = p.scrollHeight; }, 0);
  }

  about() {
    const p = this.frame('Об игре', 'ABOUT');
    el('div', '', p, `<p style="font-size:18px;line-height:1.5">Blood of the North — визуальная новелла о следователе из Уайтхорса, Юкон. Это демо-пролог: один вечер в баре «Северная Роза».</p>
      <p style="font-size:16px;line-height:1.5">3D-окружение и 2D-персонажи. Окружение, фоны диалогов, текстуры, музыка и звук генерируются кодом в браузере.</p><p style="font-size:14px">Версия демо: v${VERSION}</p>
      <div class="note">Демо содержит сцены изменённого сознания (мерцание, искажения картинки и звука). Силу эффектов можно снизить в настройках.</div>`);
  }
}
