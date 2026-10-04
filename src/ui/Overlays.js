import { el, wait } from './dom.js';
import { VERSION } from '../version.js';

export class Fader {
  constructor(root) { this.el = el('div', 'fader', root); }

  async to(on, ms = 1000) {
    this.el.style.setProperty('--fade', `${ms}ms`);
    void this.el.offsetWidth;
    this.el.classList.toggle('on', on);
    await wait(ms);
  }

  set(on) {
    this.el.style.setProperty('--fade', '0ms');
    this.el.classList.toggle('on', on);
    void this.el.offsetWidth;
  }
}

/** Julian's phone: lock screen with Lizzie's missed call and voicemail. */
export class PhoneView {
  constructor({ root, bus, audio, state }) {
    this.root = root;
    this.bus = bus;
    this.audio = audio;
    this.state = state;
  }

  open() {
    if (this.wrap) return;
    this.audio.play('sfx.phone');
    const w = this.wrap = el('div', 'phone-wrap', this.root);
    const ph = el('div', 'phone', w);
    const sc = el('div', 'screen', ph);
    el('div', 'aurora', sc);
    el('div', 'time', sc, '22:47');
    el('div', 'date', sc, 'суббота, 4 декабря · −34°');
    const notes = el('div', 'notes', sc);
    el('div', 'ntf', notes, '<b>Кайден <span>12 мин назад</span></b>ты где? я уже взял тебе виски. не заставляй пить оба');
    el('div', 'ntf missed', notes, '<b>Пропущенный вызов <span>11 нояб.</span></b>Лиззи 🦊');
    const vm = el('div', 'ntf play', notes, `<b>Голосовое · Лиззи <span>11 нояб. · 0:07</span></b>
      Нажмите, чтобы прослушать
      <div class="wave">${Array.from({ length: 34 }, (_, i) => `<i style="height:${4 + Math.abs(Math.sin(i * 1.7) * 16)}px;animation-delay:${i * 30}ms"></i>`).join('')}</div>
      <div class="transcript">«Джул, это я… Я у реки, тут… <i>(треск)</i> …ты должен это увидеть. Перезвони мне. Пожалуйста».</div>`);
    vm.addEventListener('click', (e) => {
      e.stopPropagation();
      vm.querySelector('.wave').classList.add('playing');
      vm.querySelector('.transcript').classList.add('show');
      this.audio.play('sfx.tv', { volume: 0.4 });
      this.audio.play('inner.whisper', { delay: 0.3 });
      setTimeout(() => vm.querySelector('.wave')?.classList.remove('playing'), 7000);
      if (!this.state.get('heard_voicemail')) {
        this.state.set('heard_voicemail', true);
        this.bus.emit('voicemail');
      }
    });
    el('div', 'ntf', notes, '<b>Капитан Морроу <span>вчера</span></b>Рид, дело о волках закрыто. Отдыхай.');
    const close = el('div', 'close-p', sc);
    el('div', 'phone-hint', w, 'НАЖМИТЕ ВНЕ ТЕЛЕФОНА, ЧТОБЫ УБРАТЬ');
    w.addEventListener('pointerdown', (e) => { if (e.target === w || e.target === close) this.close(); });
    this.esc = (e) => { if (e.code === 'Escape' || e.code === 'KeyQ') { e.stopPropagation(); this.close(); } };
    window.addEventListener('keydown', this.esc, true);
    this.state.set('read_phone', true);
    this.bus.emit('panel', true);
  }

  close() {
    this.wrap?.remove();
    this.wrap = null;
    window.removeEventListener('keydown', this.esc, true);
    this.bus.emit('panel', false);
  }

  get isOpen() { return !!this.wrap; }
}

/** Painted close-up of the cocktail (procedural, based on the reference). */
export function paintCocktail() {
  const W = 600, H = 750;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // cream backdrop with soft vignette
  ctx.fillStyle = '#ece3cf'; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, 520);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(90,60,30,0.25)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const cx = W / 2;
  // foot
  ctx.fillStyle = 'rgba(210,210,214,0.55)';
  ctx.beginPath(); ctx.ellipse(cx, 660, 120, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,120,130,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(cx - 30, 655, 50, 6, 0, 0, Math.PI * 2); ctx.fill();
  // stem
  const sg = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
  sg.addColorStop(0, 'rgba(150,150,160,0.7)'); sg.addColorStop(0.5, 'rgba(250,250,255,0.9)'); sg.addColorStop(1, 'rgba(140,140,150,0.7)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.moveTo(cx - 14, 420); ctx.quadraticCurveTo(cx - 5, 450, cx - 6, 640); ctx.lineTo(cx + 6, 640); ctx.quadraticCurveTo(cx + 5, 450, cx + 14, 420); ctx.fill();
  // bowl (coupe)
  const top = 230, rx = 190;
  ctx.save();
  const bowl = new Path2D();
  bowl.moveTo(cx - rx, top);
  bowl.bezierCurveTo(cx - rx, top + 170, cx - 60, top + 200, cx, top + 200);
  bowl.bezierCurveTo(cx + 60, top + 200, cx + rx, top + 170, cx + rx, top);
  bowl.closePath();
  ctx.clip(bowl);
  // liquid: deep red with depth
  const lq = ctx.createLinearGradient(0, top + 40, 0, top + 200);
  lq.addColorStop(0, '#6e0a14'); lq.addColorStop(0.5, '#8a1420'); lq.addColorStop(1, '#4a040c');
  ctx.fillStyle = lq; ctx.fillRect(0, top + 40, W, 200);
  const glowG = ctx.createRadialGradient(cx - 20, top + 150, 5, cx, top + 150, 160);
  glowG.addColorStop(0, 'rgba(230,60,60,0.55)'); glowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowG; ctx.fillRect(0, top, W, 220);
  // foam band
  const fg = ctx.createLinearGradient(0, top + 22, 0, top + 46);
  fg.addColorStop(0, '#d8b8a0'); fg.addColorStop(1, '#a8705a');
  ctx.fillStyle = fg; ctx.fillRect(0, top + 20, W, 26);
  // condensation dots
  for (let i = 0; i < 220; i++) {
    const x = cx - rx + Math.random() * rx * 2, y = top + 50 + Math.random() * 150;
    ctx.fillStyle = `rgba(255,220,220,${Math.random() * 0.25})`;
    ctx.beginPath(); ctx.arc(x, y, Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // glass rim + highlight
  ctx.strokeStyle = 'rgba(160,160,170,0.8)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(cx, top, rx, 16, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.stroke(bowl);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(cx - rx + 18, top + 20); ctx.bezierCurveTo(cx - rx + 14, top + 110, cx - 110, top + 160, cx - 70, top + 180); ctx.stroke();
  // pick + cherry
  ctx.strokeStyle = '#9a9aa4'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + 20, top - 18); ctx.lineTo(cx + 260, top - 8); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + 18, top - 18, 6, 0, Math.PI * 2); ctx.stroke();
  const ch = ctx.createRadialGradient(cx + 132, top - 30, 4, cx + 140, top - 16, 34);
  ch.addColorStop(0, '#c43040'); ch.addColorStop(0.4, '#6a0a14'); ch.addColorStop(1, '#2a0206');
  ctx.fillStyle = ch;
  ctx.beginPath(); ctx.arc(cx + 140, top - 14, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(cx + 128, top - 28, 7, 4, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#7a1018'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + 142, top - 42); ctx.bezierCurveTo(cx + 150, top - 110, cx + 160, top - 150, cx + 180, top - 190); ctx.stroke();
  // film grain
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Insert {
  constructor(root) {
    this.el = el('div', 'insert', root);
    this.card = el('div', 'card', this.el);
    this.cap = el('div', 'cap', this.card);
  }

  async show(canvas, caption = '', ms = 3200) {
    this.card.querySelector('canvas')?.remove();
    this.card.prepend(canvas);
    this.cap.textContent = caption;
    this.el.classList.add('show');
    await wait(ms);
    this.el.classList.remove('show');
    await wait(800);
  }
}

export class EndingScreen {
  constructor({ root, bus, audio }) {
    this.root = root;
    this.bus = bus;
    this.audio = audio;
  }

  async show(state) {
    const e = this.el = el('div', 'ending', this.root);
    const t = el('div', 't', e, 'BLOOD <em>OF THE</em> NORTH');
    const d = el('div', 'd', e, `DEMO v${VERSION} COMPLETE · ДЕМО ЗАВЕРШЕНО`);
    const f = state.flags;
    const found = state.interacted.size;
    const stats = el('div', 'stats', e, [
      `Осмотрено мест: ${found} из 14.`,
      f.noticed_owen ? 'Вы заметили незнакомца до того, как он заметил вас.' : 'Незнакомец остался для вас просто лицом в толпе.',
      f.mirror_anomaly ? 'Вы видели, что зеркало его не отражает.' : '',
      f.heard_voicemail ? 'Вы прослушали голосовое Лиззи.' : '',
    ].filter(Boolean).join(' '));
    const btns = el('div', 'btns', e);
    const cont = el('button', '', btns, 'Продолжить<small>ГЛАВА 1 · СКОРО</small>');
    cont.disabled = true;
    const again = el('button', '', btns, 'Начать заново<small>NEW GAME</small>');
    const menu = el('button', '', btns, 'Главное меню<small>MAIN MENU</small>');
    again.addEventListener('click', () => { this.hide(); this.bus.emit('menu', 'new'); });
    menu.addEventListener('click', () => { this.hide(); this.bus.emit('menu', 'title'); });
    await wait(400);
    t.classList.add('show');
    await wait(2600);
    d.classList.add('show');
    await wait(1200);
    stats.classList.add('show');
    btns.classList.add('show');
  }

  hide() { this.el?.remove(); this.el = null; }
}
