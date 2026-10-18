import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { el, ICONS } from './dom.js';

const OBJECTIVES = {
  kayden: { ru: 'Найти Кайдена — он ждёт за столиком у бара', en: 'JOIN KAYDEN' },
  air: { ru: 'Мне плохо. Дойти до выхода — дверь слева', en: 'GET OUTSIDE' },
  morning: { ru: 'Осмотреть бар: что здесь случилось ночью?', en: 'WHAT HAPPENED HERE' },
  car: { ru: 'Меня везут в участок. Осмотреться, поговорить с Куинн', en: 'LOOK AROUND' },
  cell: { ru: 'Ждать в камере, пока вызовут', en: 'WAIT' },
  survivors: { ru: 'Поговорить с выжившими в зале ожидания', en: 'TALK TO THE SURVIVORS' },
  medpost: { ru: 'Пройти в медпункт и сдать анализы', en: 'MEDICAL POST' },
  interrogation: { ru: 'Пройти во вторую допросную', en: 'INTERROGATION ROOM 2' },
  sit: { ru: 'Сесть за стол напротив офицера', en: 'TAKE A SEAT' },
  hospital: { ru: 'Пройтись по отделению, поговорить с персоналом', en: 'WALK THE WARD' },
  bed: { ru: 'Вернуться в свою палату — 109', en: 'BACK TO ROOM 109' },
  night: { ru: 'Жажда. Найти, чем её утолить', en: 'THIRST' },
  back: { ru: 'Вернуться в палату 109, пока не заметили', en: 'BACK TO ROOM 109' },
  victims: { ru: 'Прочитать список погибших на доске объявлений', en: 'THE LIST OF THE DEAD' },
  kowalski: { ru: 'Подойти к Ковальски у кабинетов — справа', en: 'SEE KOWALSKI' },
  valley: { ru: 'Выйти из участка (дверь слева) и ехать к реке, где пропала Лиззи', en: 'THE RIVER VALLEY' },
  forest: { ru: 'Осмотреть оцепленное место: ленту, маркеры, осину, реку', en: 'SEARCH THE CORDONED SITE' },
  watch: { ru: 'Пригнуться и наблюдать за волком. Не подходить', en: 'STAY DOWN. WATCH' },
  follow: { ru: 'Держаться на расстоянии и проследить за ним до логова', en: 'FOLLOW HIM' },
  cave: { ru: 'Подойти ко входу в пещеру', en: 'THE CAVE' },
  lz_girls: { ru: 'Девочки ждут в столовой — дверь в конце коридора, справа', en: 'THE GIRLS · CAFETERIA' },
  lz_home: { ru: 'Поговорить с Джулом — он на кухне, справа', en: 'JULIAN IN THE KITCHEN' },
  lz_upstairs: { ru: 'Подняться к себе в мансарду — лестница у кухни', en: 'UPSTAIRS' },
  jh_attic: { ru: 'Подняться в её комнату — лестница у кухни', en: 'HER ROOM' },
  jh_out: { ru: 'Взять пальто с вешалки и выйти — входная дверь', en: 'GET READY' },
  lz_sites: { ru: 'Найти и сфотографировать следы здесь — девочки помогут', en: 'PHOTOGRAPH THE TRACES' },
  lz_herd: { ru: 'Тихо подойти к стаду у реки и осмотреться', en: 'THE HERD BY THE RIVER' },
  lz_cave: { ru: 'Осмотреться в пещере: где мы, где выход?', en: 'WHERE ARE WE' },
  lz_l3_girls: { ru: 'Вернуться к Оливии и Викки в зал', en: 'BACK TO THE GIRLS' },
  lz_l3_night: { ru: 'Найти Пуриэль — щель за тоннелем к выходу', en: 'FIND PURIEL' },
  lz_l3_back: { ru: 'Вернуться в зал и рассказать девочкам', en: 'BACK TO THE HALL' },
  lz_l3_escape: { ru: 'Пробраться к выходу — тихо, вдоль стены', en: 'TO THE MOUTH. QUIETLY' },
  lz_pack: { ru: 'Поговорить со стаей — они в залах и в логове', en: 'LISTEN TO THE PACK' },
  lz_l4_back: { ru: 'Вечер. Вернуться к девочкам в зал', en: 'EVENING. BACK TO THE GIRLS' },
  lz_l5_deep: { ru: 'Голос Оливии из глубины — вниз по узкому ходу', en: 'THE VOICE BELOW' },
  lz_follow: { ru: 'Найти Оливию — дальше, вглубь', en: 'FIND OLIVIA' },
  lz_escape: { ru: 'БЕГИ — к выходу из пещеры', en: 'RUN' },
};

/** Exploration overlay: objective, interaction marker, phone & menu buttons, toasts. */
export class HUD {
  constructor({ root, bus, input, state }) {
    this.bus = bus;
    this.input = input;
    this.state = state;
    const h = this.el = el('div', 'hud off', root);
    this.obj = el('div', 'objective', h, '<span class="dia"></span><span class="txt"></span>');
    this.marker = el('div', 'marker', h, '<div class="lbl"></div><div class="gem"></div>');
    this.toastEl = el('div', 'toast', h);
    const btns = el('div', 'hud-btns', h);
    // the investigation folder (after a case is taken at the station)
    this.caseBtn = el('button', 'hud-btn case', btns, `${ICONS.folder}<span class="badge"></span>`);
    this.caseBtn.title = 'Папка расследования (J)';
    this.caseBtn.addEventListener('click', () => bus.emit('ui-open', 'case'));
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyJ' && this.visible) bus.emit('ui-open', 'case'); });
    this.phoneBtn = el('button', 'hud-btn', btns, `${ICONS.phone}<span class="badge"></span>`);
    this.phoneBtn.title = 'Телефон (Q)';
    this.phoneBtn.addEventListener('click', () => bus.emit('ui-open', 'phone'));
    const menuBtn = el('button', 'hud-btn', btns, ICONS.menu);
    menuBtn.title = 'Меню (Esc)';
    menuBtn.addEventListener('click', () => bus.emit('ui-open', 'pause'));
    window.addEventListener('keydown', (e) => { if (e.code === 'KeyQ' && this.visible) bus.emit('ui-open', 'phone'); });

    bus.on('focus', (item) => { this.focus = item; this.renderMarker(); });
    bus.on('flag', ({ flag, value }) => {
      if (flag === 'objective') this.setObjective(value);
      if (flag === 'investigation_route') this.setCase(value);
    });
  }

  show(v) { this.visible = v; this.el.classList.toggle('off', !v); }

  setObjective(key) {
    const o = OBJECTIVES[key];
    if (!o) { this.obj.classList.remove('show'); return; }
    this.obj.querySelector('.txt').innerHTML = `${o.ru}<small>${o.en}</small>`;
    this.obj.classList.add('show');
  }

  setCase(route) { this.caseBtn.classList.toggle('on', !!route); }

  notifyCase(on) { this.caseBtn.classList.toggle('notify', on); }

  notifyPhone(on) { this.phoneBtn.classList.toggle('notify', on); }

  renderMarker() {
    const f = this.focus;
    this.marker.classList.toggle('show', !!f);
    if (!f) return;
    const key = this.input.isTouch ? '' : '<span class="key">E</span>';
    this.marker.querySelector('.lbl').innerHTML = `${key}${f.label}`;
  }

  /**
   * Faint white dots over interactables the player is approaching but can't use yet: they fade in
   * as the distance closes (≈5 m → nothing, at the edge of reach → clearly visible).
   */
  updateHints(near, camera) {
    this.hints = this.hints || new Map();
    const seen = new Set();
    const k = window.__uiScale || 1;
    if (this.visible) {
      for (const { item, d } of near || []) {
        if (item === this.focus || d <= 0 || !item.anchor) continue;
        let h = this.hints.get(item);
        if (!h) { h = el('div', 'hint-dot', this.el); this.hints.set(item, h); }
        const p = InteractionSystem.project(item.anchor, camera, window.innerWidth, window.innerHeight);
        h.style.left = `${p.x / k}px`; h.style.top = `${Math.max(60, p.y / k)}px`;
        h.style.opacity = String(Math.max(0, Math.min(0.75, 0.85 * (1 - d / 4.5))));
        seen.add(item);
      }
    }
    for (const [item, h] of this.hints) if (!seen.has(item)) { h.remove(); this.hints.delete(item); }
  }

  update(camera) {
    if (!this.focus || !this.visible) return;
    const p = InteractionSystem.project(this.focus.anchor, camera, window.innerWidth, window.innerHeight);
    const k = window.__uiScale || 1; // #ui is zoomed on big screens
    this.marker.style.left = `${p.x / k}px`;
    this.marker.style.top = `${Math.max(60, p.y / k - 10)}px`;
  }

  toast(text, ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
}
