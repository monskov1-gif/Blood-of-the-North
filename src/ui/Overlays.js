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

/** Photo-like close-up of the cocktail (procedural; based on the reference photo). */
export function paintCocktail() {
  const W = 800, H = 1000;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rad = (x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
  const lin = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };

  // --- background: dark bar, out of focus (bokeh), polished table
  ctx.fillStyle = lin(0, 0, 0, H, [[0, '#120806'], [0.55, '#1e0d08'], [0.62, '#2a120a'], [1, '#0a0403']]);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = rnd() * H * 0.55, r = 20 + rnd() * 60;
    const hue = rnd() < 0.75 ? `255,${150 + rnd() * 60 | 0},${60 + rnd() * 40 | 0}` : `255,${60 + rnd() * 40 | 0},${50 | 0}`;
    ctx.fillStyle = rad(x, y, r * 0.6, r, [[0, `rgba(${hue},${0.05 + rnd() * 0.1})`], [0.85, `rgba(${hue},${0.05 + rnd() * 0.05})`], [1, `rgba(${hue},0)`]]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // table surface with soft reflection band
  const tableY = H * 0.78;
  ctx.fillStyle = lin(0, tableY - 40, 0, H, [[0, 'rgba(60,24,12,0)'], [0.1, 'rgba(70,28,14,0.9)'], [1, 'rgba(18,6,3,1)']]);
  ctx.fillRect(0, tableY - 40, W, H);
  ctx.fillStyle = 'rgba(255,170,90,0.06)';
  ctx.fillRect(0, tableY + 4, W, 3);

  const cx = W / 2;
  const rimY = 330, rx = 230, ry = 34, bowlDepth = 210;
  const stemTop = rimY + bowlDepth - 6, footY = tableY + 10;

  // --- caustic: red light thrown on the table by the drink
  ctx.fillStyle = rad(cx + 40, footY + 30, 10, 220, [[0, 'rgba(220,30,40,0.55)'], [0.4, 'rgba(160,10,24,0.25)'], [1, 'rgba(80,0,10,0)']]);
  ctx.beginPath(); ctx.ellipse(cx + 40, footY + 30, 240, 46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(cx - 30, footY + 8, 150, 18, 0, 0, Math.PI * 2); ctx.fill();

  // --- foot
  ctx.fillStyle = lin(cx - 130, 0, cx + 130, 0, [[0, 'rgba(200,190,185,0.35)'], [0.5, 'rgba(255,245,240,0.15)'], [1, 'rgba(200,190,185,0.4)']]);
  ctx.beginPath(); ctx.ellipse(cx, footY, 130, 22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,230,0.55)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, footY, 128, 20, 0, Math.PI * 0.95, Math.PI * 1.35); ctx.stroke();

  // --- stem (refracts the background: darker core, bright edges)
  ctx.fillStyle = lin(cx - 10, 0, cx + 10, 0, [[0, 'rgba(255,240,230,0.7)'], [0.3, 'rgba(90,40,30,0.5)'], [0.6, 'rgba(255,220,200,0.35)'], [1, 'rgba(255,240,230,0.65)']]);
  ctx.beginPath();
  ctx.moveTo(cx - 18, stemTop); ctx.quadraticCurveTo(cx - 6, stemTop + 40, cx - 7, footY - 12);
  ctx.lineTo(cx + 7, footY - 12); ctx.quadraticCurveTo(cx + 6, stemTop + 40, cx + 18, stemTop); ctx.fill();
  ctx.fillStyle = 'rgba(200,30,40,0.35)'; ctx.fillRect(cx - 2, stemTop + 10, 4, footY - stemTop - 30);

  // --- bowl path
  const bowl = new Path2D();
  bowl.moveTo(cx - rx, rimY);
  bowl.bezierCurveTo(cx - rx, rimY + bowlDepth * 0.75, cx - 70, rimY + bowlDepth, cx, rimY + bowlDepth);
  bowl.bezierCurveTo(cx + 70, rimY + bowlDepth, cx + rx, rimY + bowlDepth * 0.75, cx + rx, rimY);
  bowl.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI, false);
  ctx.save();
  ctx.clip(bowl);
  // liquid body: deep red, lit from behind-left
  const liqTop = rimY + 26;
  ctx.fillStyle = lin(0, liqTop, 0, rimY + bowlDepth, [[0, '#7c0a16'], [0.45, '#8f1220'], [1, '#3a0208']]);
  ctx.fillRect(0, liqTop, W, bowlDepth);
  ctx.fillStyle = rad(cx - 40, rimY + 120, 10, 210, [[0, 'rgba(255,90,90,0.75)'], [0.35, 'rgba(220,40,50,0.45)'], [1, 'rgba(60,0,10,0)']]);
  ctx.fillRect(0, liqTop, W, bowlDepth);
  // refraction of the bokeh inside the drink
  for (let i = 0; i < 14; i++) {
    const x = cx - rx + rnd() * rx * 2, y = liqTop + 30 + rnd() * 120;
    ctx.fillStyle = rad(x, y, 2, 18, [[0, 'rgba(255,190,120,0.35)'], [1, 'rgba(255,190,120,0)']]);
    ctx.beginPath(); ctx.ellipse(x, y, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  }
  // darker edges (glass thickness)
  ctx.strokeStyle = 'rgba(30,0,4,0.55)'; ctx.lineWidth = 26; ctx.stroke(bowl);
  // foam meniscus with bubbles
  ctx.fillStyle = lin(0, liqTop - 18, 0, liqTop + 16, [[0, '#e8cdb8'], [0.6, '#c9957c'], [1, '#8a3a30']]);
  ctx.beginPath(); ctx.ellipse(cx, liqTop, rx - 14, ry - 6, 0, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 420; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
    const x = cx + Math.cos(a) * (rx - 16) * rr, y = liqTop + Math.sin(a) * (ry - 8) * rr;
    const br = 0.6 + rnd() * 2.6;
    ctx.fillStyle = `rgba(255,240,228,${0.25 + rnd() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,60,40,0.25)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  // condensation droplets
  for (let i = 0; i < 260; i++) {
    const x = cx - rx + 10 + rnd() * (rx * 2 - 20), y = liqTop + 24 + rnd() * (bowlDepth - 40);
    const r = 1 + rnd() * rnd() * 6;
    ctx.fillStyle = 'rgba(40,0,6,0.35)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.4, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,170,0.3)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // glass above the liquid (thin, transparent)
  ctx.strokeStyle = 'rgba(255,245,235,0.6)'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.ellipse(cx, rimY, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, rimY, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,230,0.45)'; ctx.lineWidth = 2; ctx.stroke(bowl);
  // specular streaks
  ctx.fillStyle = lin(cx - rx + 20, 0, cx - rx + 60, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
  ctx.beginPath();
  ctx.moveTo(cx - rx + 22, rimY + 16); ctx.bezierCurveTo(cx - rx + 26, rimY + 110, cx - 150, rimY + 170, cx - 110, rimY + 192);
  ctx.lineTo(cx - 100, rimY + 182); ctx.bezierCurveTo(cx - 140, rimY + 150, cx - rx + 52, rimY + 100, cx - rx + 46, rimY + 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx + rx - 60, rimY + 70, 6, 40, -0.4, 0, Math.PI * 2); ctx.fill();

  // --- cocktail pick (metal) and cherry
  ctx.strokeStyle = lin(cx - 40, 0, cx + 330, 0, [[0, '#8a8a92'], [0.5, '#f0f0f6'], [1, '#6a6a72']]);
  ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 40, rimY - 22); ctx.lineTo(cx + 320, rimY - 6); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx - 50, rimY - 26, 11, 0, Math.PI * 2); ctx.stroke();
  const chx = cx + 170, chy = rimY - 24, chr = 42;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(chx + 10, rimY + 4, 40, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rad(chx - 14, chy - 16, 4, chr * 1.1, [[0, '#e0505e'], [0.25, '#9a0e22'], [0.7, '#4a0210'], [1, '#1a0006']]);
  ctx.beginPath(); ctx.arc(chx, chy, chr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rad(chx + 20, chy + 22, 2, 30, [[0, 'rgba(255,60,60,0.45)'], [1, 'rgba(255,60,60,0)']]);
  ctx.beginPath(); ctx.arc(chx, chy, chr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(chx - 16, chy - 18, 10, 6, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(chx + 18, chy - 6, 4, 9, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = lin(0, chy - 200, 0, chy - 30, [[0, '#3a0a0a'], [1, '#7a1a14']]);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(chx + 2, chy - 36); ctx.bezierCurveTo(chx + 10, chy - 110, chx + 24, chy - 160, chx + 52, chy - 220); ctx.stroke();

  // --- photographic finish: vignette + grain + slight warm grade
  ctx.fillStyle = rad(W / 2, H * 0.48, H * 0.25, H * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.65)']]);
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 16;
    img.data[i] += n + 3; img.data[i + 1] += n; img.data[i + 2] += n - 2;
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
    const t = el('div', 't', e, '<span class="title-lockup"><span class="w">BLOOD</span><span class="of">of the</span><span class="w">NORTH</span></span>');
    const d = el('div', 'd', e, `DEMO v${VERSION} COMPLETE · ДЕМО ЗАВЕРШЕНО`);
    const f = state.flags;
    const found = state.interacted.size;
    const stats = el('div', 'stats', e, [
      `Осмотрено мест: ${found} из 26.`,
      f.noticed_owen ? 'Вы заметили незнакомца до того, как он заметил вас.' : 'Незнакомец остался для вас просто лицом в толпе.',
      f.mirror_anomaly ? 'Вы видели, что зеркало его не отражает.' : '',
      f.heard_voicemail ? 'Вы прослушали голосовое Лиззи.' : '',
      f.saw_wounds ? 'Вы видели проколы на шее.' : '',
      f.memory_flash ? 'Вы почти вспомнили, что было в бокале.' : '',
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

/** A painted portrait sliding in over the 3D scene (cutscene close-ups, memory flashes). */
export class PortraitFlash {
  constructor(root) {
    this.el = el('div', 'pflash', root);
    this.img = el('img', '', this.el);
    this.img.alt = '';
  }

  async show(src, { ms = 2600, side = 'right', flash = false } = {}) {
    this.img.src = src;
    this.el.className = `pflash ${side}${flash ? ' memory' : ''}`;
    await new Promise((r) => (this.img.complete ? r() : (this.img.onload = r)));
    void this.el.offsetWidth;
    this.el.classList.add('show');
    await wait(ms);
    this.el.classList.remove('show');
    await wait(600);
  }
}
