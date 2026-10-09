import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { el, ICONS } from './dom.js';

const OBJECTIVES = {
  kayden: { ru: 'Кайден ждёт за столиком у стойки', en: 'JOIN KAYDEN' },
  air: { ru: 'Воздух. Дойти до двери', en: 'GET OUTSIDE' },
  morning: { ru: 'Что здесь произошло?', en: 'WHAT HAPPENED HERE' },
  car: { ru: 'Осмотреться. Подумать', en: 'LOOK AROUND' },
  cell: { ru: 'Ждать', en: 'WAIT' },
  survivors: { ru: 'Поговорить с выжившими', en: 'TALK TO THE SURVIVORS' },
  medpost: { ru: 'Медпункт: сдать анализы', en: 'MEDICAL POST' },
  interrogation: { ru: 'Вторая допросная', en: 'INTERROGATION ROOM 2' },
  sit: { ru: 'Сесть за стол', en: 'TAKE A SEAT' },
  hospital: { ru: 'Пройтись по отделению', en: 'WALK THE WARD' },
  bed: { ru: 'Вернуться в палату 109', en: 'BACK TO ROOM 109' },
  night: { ru: 'Жажда', en: 'THIRST' },
  back: { ru: 'Вернуться в палату 109', en: 'BACK TO ROOM 109' },
  victims: { ru: 'Список погибших — на доске объявлений', en: 'THE LIST OF THE DEAD' },
  kowalski: { ru: 'Ковальски ждёт у кабинетов', en: 'SEE KOWALSKI' },
  valley: { ru: 'Долина у реки. Где пропала Лиззи', en: 'THE RIVER VALLEY' },
  forest: { ru: 'Осмотреть оцепленное место', en: 'SEARCH THE CORDONED SITE' },
  watch: { ru: 'Не спугнуть. Смотреть', en: 'STAY DOWN. WATCH' },
  follow: { ru: 'Проследить за ним', en: 'FOLLOW HIM' },
  cave: { ru: 'Пещера', en: 'THE CAVE' },
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
      if (flag === 'case_route') this.setCase(value);
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
