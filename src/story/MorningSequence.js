import * as THREE from 'three';
import { Character2D } from '../characters/Character2D.js';
import { CharacterState } from '../characters/CharacterState.js';
import { CHARACTERS } from '../../data/characters.js';
import { BODIES, KAYDEN_BODY, JULIAN_WAKE } from '../../data/morning.js';
import { paintCocktail } from '../ui/Overlays.js';
import { sleep } from './Director.js';

/**
 * BAR_MORNING_CRIME_SCENE — the morning after, staged in the same bar.
 *
 *   EVENING → collapse → BLACK (heartbeat slows, wind) → MORNING
 *   wake up → explore → bodies → KAYDEN (once) → memory flash
 *   → POLICE_ARRIVAL → cliffhanger → title
 *
 * Installed as methods on BarStory (installMorning), so the evening and the
 * morning share the cast, the save system and the director.
 */

const HANGOVER = { blur: 0.12, vignette: 0.12, ca: 0.15 };
const MORNING_GRADE = { saturation: -0.42, bloom: -0.38, grain: -0.01, vignette: -0.08, exposure: 0.16, tint: [-0.12, -0.02, 0.1] };
const KAYDEN_GRADE = { saturation: -0.2, vignette: 0.28 };

const methods = {
  // ------------------------------------------------------------------ state

  /** Applies the morning state to the bar, cast and audio (no cutscene). */
  setupMorning() {
    const g = this.g;
    this.scene.setTimeOfDay('morning');
    g.renderer.setLayer('morning', MORNING_GRADE);
    g.renderer.setLayer('hangover', HANGOVER);
    g.hallucination.reset();
    g.renderer.clearLayer('kayden');
    // the room is empty: staff survived elsewhere, Owen is gone
    for (const c of [this.waiter, this.waiter2, this.bartender, this.owen, this.patronB, this.windowGuest].filter(Boolean)) c.setLife(CharacterState.HIDDEN);
    for (const c of this.crowd) {
      if (c.crowd.frame === 'npc_butler_side_v') c.setLife(CharacterState.HIDDEN);
    }
    this.coupe.visible = false;
    // bodies: reuse the evening crowd (same faces, same clothes)
    const used = new Set();
    this.bodies = [];
    for (const b of BODIES) {
      const ch = this.crowd.find((c) => c.crowd.frame === b.frame && !used.has(c));
      if (!ch) continue;
      used.add(ch);
      ch.setVisible(true);
      if (b.pose === 'lying') {
        ch.stand();
        ch.placeAt(b.x, b.z, b.dir);
        ch.root.position.y = 0;
        ch.setPose('idle');
        ch.setLife(CharacterState.DEAD, { pose: 'lying', dir: b.dir });
        if (b.z > -2.35) this.scene.colliders.push({ x: b.x + b.dir * 0.8, z: b.z, r: 0.5, morning: true });
      } else {
        ch.setLife(CharacterState.DEAD, { pose: 'slumped', dir: ch.facing, tilt: 0.22 + Math.random() * 0.18 });
      }
      this.bodies.push(ch);
    }
    for (const c of this.crowd) if (!used.has(c) && c.life !== CharacterState.HIDDEN) c.setLife(CharacterState.HIDDEN);
    // Kayden
    const K = this.kayden;
    K.stand();
    K.placeAt(KAYDEN_BODY.x, KAYDEN_BODY.z, 1);
    K.setPose('idle');
    K.setLife(CharacterState.DEAD, { pose: 'lying', dir: KAYDEN_BODY.dir });
    this.scene.colliders.push({ x: KAYDEN_BODY.x + 0.85, z: KAYDEN_BODY.z, r: 0.55, morning: true });
    // the open front door
    if (this.scene.doorHinge) this.scene.doorHinge.rotation.y = -1.25;
    this.interactions.setItems(this.morningInteractables());
    // audio: no music, only the empty building
    const a = g.audio;
    a.stopAllLoops(1.5);
    a.music('none', 2);
    a.setMuffle(0, 1);
    setTimeout(() => {
      if (g.state.stage !== 'morning' && g.state.stage !== 'police') return;
      a.loop('amb.wind', { volume: 1.6, fade: 3 });
      a.loop('amb.room', { fade: 4 });
      a.loop('amb.vent', { volume: 0.6, fade: 4 });
      a.loop('amb.morning', { fade: 2 });
      a.loop('inner.breath', { fade: 3 });
    }, 1600);
  },

  /** Back to the evening (new game / title). */
  resetMorning() {
    this.scene.setTimeOfDay('evening');
    this.g.renderer.clearLayer('morning');
    this.g.renderer.clearLayer('hangover');
    this.g.renderer.clearLayer('kayden');
    this.g.renderer.clearLayer('police');
    this.scene.colliders.splice(0, this.scene.colliders.length, ...this.scene.colliders.filter((c) => !c.morning));
    if (this.scene.doorHinge) this.scene.doorHinge.rotation.y = 0;
    if (this.scene.police) { this.scene.police.on = false; this.scene.police.red.intensity = 0; this.scene.police.blue.intensity = 0; }
    for (const c of this.chars.values()) c.setLife(CharacterState.ALIVE);
    for (const o of this.officers || []) o.setLife(CharacterState.HIDDEN);
    this.policeStarted = false;
    this.policeRunning = false;
    this.hinted = false;
    this.drone?.stop(0.5);
    this.drone = null;
    // evening ambience back
    const a = this.g.audio;
    if (a.ready) {
      for (const k of ['amb.room', 'amb.morning', 'inner.breath', 'amb.siren', 'inner.drone', 'inner.ring', 'amb.car', 'amb.station', 'amb.interrogation', 'amb.hospital_day', 'amb.hospital_night', 'sfx.flatline']) a.loops.get(k)?.stop(0.5);
      a.setMuffle(0, 0.5);
      a.loop('amb.crowd'); a.loop('amb.vent'); a.loop('amb.wind', { volume: 0.4 });
    }
    this.interactions?.setItems(this.interactables());
  },

  get interactions() { return this.g.interactions; },

  // ------------------------------------------------------------------ interactables

  morningInteractables() {
    const say = (id) => () => this.g.dialogue.start(id).then(() => this.checkPolice());
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    return [
      { id: 'm_glass', label: 'Разбитый бокал', at: { x: 1.0, z: 1.55 }, radius: 0.9, anchor: A(1.15, 0.6, 1.0), run: () => this.glassMemory() },
      { id: 'm_chair', label: 'Опрокинутый стул', at: { x: -6.9, z: 1.15 }, radius: 1.0, anchor: A(-6.9, 0.8, 0.55), run: say('m_chair') },
      { id: 'm_body_bar', label: 'Мужчина у стойки', at: { x: -3.5, z: -1.4 }, radius: 1.1, anchor: A(-3.6, 0.7, -2.0), run: say('m_body_bar') },
      { id: 'm_body_window', label: 'Женщина у окна', at: { x: -8.4, z: 0.45 }, radius: 1.0, anchor: A(-8.5, 0.7, -0.3), run: say('m_body_window') },
      { id: 'm_body_door', label: 'У входа', at: { x: -11.4, z: 0.45 }, radius: 1.0, anchor: A(-12.4, 0.7, -0.55), run: say('m_body_door') },
      { id: 'm_body_far', label: 'В глубине зала', at: { x: 9.6, z: 0.2 }, radius: 1.1, anchor: A(9.9, 0.7, -0.85), run: say('m_body_far') },
      { id: 'm_bar', label: 'Барная стойка', at: { x: -1.0, z: -2.25 }, radius: 1.0, anchor: A(-1.0, 1.6, -3.4), run: say('m_bar') },
      { id: 'm_behind_bar', label: 'Заглянуть за стойку', at: { x: 3.0, z: -2.25 }, radius: 1.0, anchor: A(3.0, 1.5, -3.6), if: '!bartender_discovered', run: () => this.discoverBartender() },
      { id: 'm_door', label: 'Дверь', at: { x: -12.2, z: -2.0 }, radius: 1.1, anchor: A(-12.2, 2.8, -4.8), run: say('m_door') },
      { id: 'm_window', label: 'Окно', at: { x: -8.95, z: -2.05 }, radius: 1.1, anchor: A(-8.95, 2.9, -4.9), run: say('m_window') },
      { id: 'm_marks', label: 'Следы на полу', at: { x: 5.3, z: 1.35 }, radius: 1.0, anchor: A(5.3, 0.4, 0.7), run: say('m_marks') },
      { id: 'm_bag', label: 'Сумка', at: { x: 8.4, z: 1.45 }, radius: 0.9, anchor: A(8.6, 0.5, 0.85), run: say('m_bag') },
      { id: 'm_kayden', label: 'Человек у столика', at: { x: KAYDEN_BODY.x - 0.6, z: KAYDEN_BODY.z + 0.5 }, radius: 1.3, anchor: A(KAYDEN_BODY.x + 0.9, 0.8, KAYDEN_BODY.z), if: '!kaydenDeathDiscovered', run: () => this.discoverKayden() },
    ];
  },

  // ------------------------------------------------------------------ sequences

  /** The time gap after the collapse: black, slowing heartbeat, wind, the morning fades in. */
  async toMorning() {
    const g = this.g;
    const S = this.session;
    g.state.setStage('morning');
    g.saves.unblock('escape');
    g.view.bark.classList.add('hidden');
    this.setupMorning();
    this.julian.setLife(CharacterState.ALIVE);
    this.julian.placeAt(JULIAN_WAKE.x, JULIAN_WAKE.z, JULIAN_WAKE.dir);
    this.julian.lieDown(JULIAN_WAKE.dir);
    this.julian.dizzy = 0.35;
    g.player.enabled = false;
    g.hud.show(false);
    g.cameraSys.setShot({ x: JULIAN_WAKE.x + 0.6, y: 0.55, z: JULIAN_WAKE.z + 2.6, lookX: JULIAN_WAKE.x - 0.4, lookY: 0.2, lookZ: JULIAN_WAKE.z - 0.4, fov: 42 }, 2);
    g.cameraSys.snap();
    g.renderer.setLayer('wake', { blur: 1.4, vignette: 0.5, exposure: -0.3 });
    await sleep(2.5);
    if (S !== this.session) return;
    g.audio.play('inner.heartbeat', { volume: 0.3 });
    await sleep(1.6);
    const ring = g.audio.loop('inner.ring', { volume: 0.6, fade: 3 });
    await g.dialogue.start('m_wake');
    if (S !== this.session) return;
    // the image comes back slowly: floor first
    await g.fader.to(false, 5200);
    if (S !== this.session) return;
    await sleep(1.0);
    ring?.stop(5);
    // getting up: the camera tilts with him, the picture swims
    g.cameraSys.setShot({ x: JULIAN_WAKE.x + 0.3, y: 1.6, z: JULIAN_WAKE.z + 5.2, lookX: JULIAN_WAKE.x - 0.2, lookY: 0.9, lookZ: JULIAN_WAKE.z, fov: 36 }, 0.6);
    g.cameraSys.sway = 0.35;
    await this.julian.riseUp(4.2);
    if (S !== this.session) return;
    g.renderer.clearLayer('wake');
    await g.dialogue.start('m_wake2');
    if (S !== this.session) return;
    g.cameraSys.setShot(null, 0.6);
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'morning');
    g.saves.autosave('morning');
    this.morningT = 0;
  },

  /** Kayden. Staged slowly: coat → face → disbelief → pulse → denial → silence. */
  async discoverKayden() {
    const g = this.g;
    const S = this.session;
    if (g.state.get('kaydenDeathDiscovered')) return;
    g.state.set('kaydenDeathDiscovered', true);
    g.state.set('kayden_dead_discovered', true);
    g.keyScene = true;
    g.saves.block('kayden');
    g.player.enabled = false;
    g.hud.show(false);
    const say = async (speaker, text, hold = 0) => {
      g.dialogue.history.push({ speaker, text });
      await g.view.flash(speaker, text, 2400 + text.length * 45);
      if (hold) await sleep(hold);
    };
    const J = this.julian;
    J.dizzy = 0.15;
    // the coat first
    const KB = KAYDEN_BODY;
    g.cameraSys.setShot({ x: KB.x - 0.4, y: 1.7, z: 6.4, lookX: KB.x - 0.2, lookY: 0.7, lookZ: KB.z, fov: 34 }, 0.7);
    await J.walkTo({ x: KB.x - 0.55, z: KB.z + 0.5 }, { speed: 0.55 });
    if (S !== this.session) return;
    J.face(1);
    await say('thought', 'Тренч. Знакомый тренч.', 0.8);
    if (S !== this.session) return;
    // slow push-in towards the face; the room goes quiet
    g.audio.setMuffle(0.55, 3);
    g.audio.loops.get('amb.morning')?.setVolume(0, 2);
    g.renderer.setLayer('kayden', KAYDEN_GRADE);
    g.cameraSys.setShot({ x: KB.x + 1.1, y: 1.2, z: KB.z + 3.4, lookX: KB.x + 1.3, lookY: 0.4, lookZ: KB.z, fov: 32 }, 0.35);
    await sleep(2.2);
    if (S !== this.session) return;
    await say('julian', 'Кайден?', 1.4);
    await J.walkTo({ x: KB.x + 0.7, z: KB.z + 0.5 }, { speed: 0.4 });
    if (S !== this.session) return;
    await say('julian', 'Кайден…', 0.6);
    g.pflash.el.classList.add('dead');
    g.pflash.show('assets/portraits/kayden_2.webp', { ms: 5200, side: 'right' });
    await say('narrator', 'Джулиан опускается рядом. Пальцы ищут пульс на шее.', 0.4);
    // silence. just the breathing and the heart.
    g.audio.setMuffle(0.9, 1.5);
    g.audio.play('inner.heartbeat', { volume: 0.7 });
    await sleep(1.3);
    g.audio.play('inner.heartbeat', { volume: 0.6 });
    await sleep(1.4);
    if (S !== this.session) return;
    await say('julian', 'Нет…', 0.8);
    await say('julian', 'Ну же.', 0.4);
    await say('julian', 'Очнись.', 0.4);
    await say('julian', 'Давай, Кайден.', 0.2);
    if (S !== this.session) return;
    g.pflash.el.classList.remove('dead');
    g.audio.play('inner.heartbeat', { volume: 0.5 });
    await sleep(3.4);
    if (S !== this.session) return;
    await say('thought', 'Он холодный.', 1.2);
    await say('julian', 'Эти раны…', 0.3);
    await say('julian', 'Что с тобой случилось?', 0.6);
    // the low drone only after he understands
    this.drone = g.audio.loop('inner.drone', { volume: 0.5, fade: 6 });
    await say('thought', 'Два прокола на шее. Как у туш в долине. Те же.', 0.6);
    if (S !== this.session) return;
    // paranoia: his own hands
    g.cameraSys.setShot({ x: KB.x + 0.7, y: 1.5, z: KB.z + 3.6, lookX: KB.x + 0.8, lookY: 1.0, lookZ: KB.z + 0.4, fov: 30 }, 0.6);
    J.setPose('think');
    await sleep(1.0);
    await say('thought', 'Руки. На пальцах — что-то бурое, засохшее.', 0.4);
    await say('julian', 'Что было ночью?', 0.8);
    J.setPose('idle');
    if (S !== this.session) return;
    g.audio.setMuffle(0.15, 4);
    g.audio.loops.get('amb.morning')?.setVolume(0.8, 4);
    g.renderer.setLayer('kayden', { saturation: -0.1, vignette: 0.12 });
    g.cameraSys.setShot(null, 0.5);
    g.hud.show(true);
    g.player.enabled = true;
    g.saves.unblock('kayden');
    g.keyScene = false;
    g.saves.autosave('kayden');
    this.kaydenT = 0;
    this.checkPolice();
  },

  /** The broken glass at their table: a memory flash that breaks off. */
  async glassMemory() {
    const g = this.g;
    const S = this.session;
    if (!g.state.get('kaydenDeathDiscovered') || g.state.get('memory_flash')) {
      await g.dialogue.start('m_glass');
      this.checkPolice();
      return;
    }
    g.state.set('memory_flash', true);
    g.player.enabled = false;
    const say = (speaker, text) => { g.dialogue.history.push({ speaker, text }); return g.view.flash(speaker, text, 2200 + text.length * 45); };
    await say('thought', 'Мой бокал. Вишня… горечь…');
    if (S !== this.session) return;
    // flash: the stranger, the glass, the light — then it's gone
    g.audio.play('sfx.whoosh');
    g.renderer.setLayer('flash', { exposure: 1.2, blur: 1.2, ca: 1.5 });
    g.pflash.show('assets/portraits/owen_1.webp', { ms: 1300, side: 'left', flash: true });
    await sleep(0.25);
    g.renderer.setLayer('flash', { exposure: 0.4, blur: 0.8, ca: 1 });
    await sleep(1.1);
    g.insert.show(paintCocktail(), '', 900);
    g.audio.play('inner.whisper');
    await sleep(1.2);
    g.renderer.setLayer('flash', { exposure: 1.6, blur: 2 });
    await sleep(0.18);
    g.renderer.clearLayer('flash');
    if (S !== this.session) return;
    await say('thought', 'Мужчина в чёрном. Взгляд. Свет —');
    await say('thought', 'Дальше — пусто.');
    g.audio.play('sfx.phone');
    g.hud.toast('07:42 · 14 ПРОПУЩЕННЫХ', 3200);
    await say('julian', 'Сколько я был без сознания…?');
    if (S !== this.session) return;
    g.player.enabled = true;
    this.checkPolice();
  },

  /** Behind the counter: a sound, a pause — the bartender jumps up, terrified. */
  async discoverBartender() {
    const g = this.g;
    const S = this.session;
    g.player.enabled = false;
    g.keyScene = true;
    const J = this.julian;
    const B = this.bartender;
    J.face(-1);
    await J.walkTo({ x: 3.1, z: -2.25 }, { speed: 0.6 });
    if (S !== this.session) return;
    J.face(-1);
    g.cameraSys.setShot({ x: 2.6, y: 1.65, z: 3.4, lookX: 2.4, lookY: 1.15, lookZ: -3.8, fov: 34 }, 0.8);
    g.audio.play('sfx.glass', { volume: 0.35 });
    await g.view.flash('thought', 'За стойкой что-то шевельнулось.', 2200);
    if (S !== this.session) return;
    await sleep(1.3);
    // the bartender pops up from behind the counter
    B.setLife('alive');
    B.setVisible(true);
    B.stand();
    B.placeAt(2.2, -4.05, 1);
    B.shadow.visible = false;
    B.setPose('talk');
    B.root.position.y = -1.9;
    this.popUp = { ch: B, t: 0 };
    g.audio.play('sfx.bottle');
    g.audio.play('sfx.whoosh', { volume: 0.6 });
    g.cameraSys.shake = 0.35;
    J.setPose('talk');
    for (const [who, text, pose] of g.dialogue.dialogues.m_bartender_lines) {
      if (S !== this.session) return;
      if (pose) B.setPose(pose);
      g.dialogue.history.push({ speaker: who, text });
      await g.view.flash(who, text, 1800 + text.length * 42);
    }
    J.setPose('idle');
    B.setPose('idle');
    g.state.set('bartender_discovered', true);
    g.cameraSys.setShot(null, 0.8);
    g.keyScene = false;
    g.player.enabled = true;
    this.checkPolice();
  },

  /** POLICE_ARRIVAL fires once Kayden is found and the room has been looked at. */
  checkPolice() {
    const f = this.g.state.flags;
    if (this.policeStarted || !f.kaydenDeathDiscovered) return;
    const bodies = ['m_body_bar', 'm_body_window', 'm_body_door', 'm_body_far'].filter((k) => f[k]).length;
    const clues = ['bartender_discovered', 'm_clue_chair', 'm_clue_bar', 'm_clue_door', 'm_clue_window', 'm_clue_marks', 'm_clue_bag', 'memory_flash'].filter((k) => f[k]).length;
    if (bodies >= 2 && clues >= 2) {
      this.policeStarted = true;
      setTimeout(() => this.policeArrival(), 3500);
    }
  },

  async policeArrival() {
    const g = this.g;
    const S = this.session;
    if (S !== this.session || this.policeRunning) return;
    this.policeRunning = true;
    this.policeStarted = true;
    g.state.setStage('police');
    g.saves.block('police');
    g.interactions.enabled = false;
    // a distant siren; he freezes
    const siren = g.audio.loop('amb.siren', { volume: 0.05, fade: 2 });
    await sleep(1.5);
    if (S !== this.session) return;
    g.player.enabled = false;
    g.hud.show(false);
    this.julian.face(-1);
    await g.view.flash('thought', 'Сирена.', 2200);
    siren?.setVolume(0.35, 4);
    await sleep(3);
    siren?.setVolume(1.0, 3);
    // red / blue through the window and the door
    const P = this.scene.police;
    P.on = true; P.level = 0;
    const ramp = setInterval(() => { P.level = Math.min(1, P.level + 0.05); if (P.level >= 1) clearInterval(ramp); }, 100);
    g.renderer.setLayer('police', { saturation: 0.15 });
    await sleep(2.2);
    g.audio.play('sfx.cardoor');
    await sleep(0.5);
    g.audio.play('sfx.cardoor', { pan: -0.4 });
    await sleep(0.9);
    g.audio.play('sfx.shouts');
    await sleep(1.4);
    if (S !== this.session) return;
    await g.view.flash('officer', 'ПОЛИЦИЯ!', 1600, { top: true });
    // they come in
    g.audio.play('sfx.door_bang');
    g.cameraSys.shake = 0.5;
    siren?.setVolume(0.6, 1);
    const offs = this.spawnOfficers();
    const J = this.julian;
    const tx = J.position.x;
    const walks = offs.map((o, i) => o.walkTo([{ x: -11.4, z: -1.2 + i * 0.6 }, { x: Math.max(-10.5, tx - 4.2 - i * 0.7), z: -0.6 + i * 0.9 }], { speed: 2.0 }));
    g.cameraSys.setShot({ x: tx - 2.4, y: 1.9, z: 7.4, lookX: tx - 2.4, lookY: 1.2, lookZ: -0.2, fov: 36 }, 0.8);
    await Promise.all(walks);
    if (S !== this.session) return;
    offs.forEach((o) => { o.face(1); o.setPose('aim'); });
    await g.view.flash('officer', 'Не двигаться!', 2000);
    J.setPose('talk');
    await g.view.flash('julian', 'Подождите —', 1500);
    J.setPose('idle');
    await g.view.flash('officer2', 'Отойдите от тел! Руки — так, чтобы я их видел!', 2600);
    if (S !== this.session) return;
    // he looks at Kayden. Then at them. He does not understand.
    J.face(1);
    await sleep(1.4);
    J.face(-1);
    await sleep(0.8);
    g.cameraSys.setShot({ x: tx - 1.2, y: 1.7, z: 6.2, lookX: tx - 0.6, lookY: 1.25, lookZ: 0.4, fov: 32 }, 0.25);
    await sleep(3.2);
    if (S !== this.session) return;
    // an officer walks up, turns him around: handcuffs
    const cop = offs[0];
    await cop.walkTo({ x: tx - 0.75, z: J.position.z }, { speed: 1.6 });
    if (S !== this.session) return;
    cop.setPose('idle');
    J.face(1);
    await g.view.flash('officer', 'Руки за спину.', 1800);
    g.audio.play('sfx.cuffs');
    J.setPose('think');
    await g.view.flash('officer', 'Вы задержаны до выяснения обстоятельств. Всё, что скажете…', 2800);
    await g.view.flash('julian', 'Я детектив Рид. Я… я не знаю, что здесь случилось.', 2600);
    await g.view.flash('officer2', 'Вот и разберёмся. В машину его.', 2000);
    g.state.set('police_arrived', true);
    g.state.set('arrested', true);
    if (S !== this.session) return;
    // CUT TO BLACK
    g.fader.set(true);
    g.audio.stopAllLoops(0.2);
    g.audio.setMasterVolume(0, 0.05);
    this.drone?.stop(0.2);
    await sleep(1.8);
    g.audio.setMasterVolume(1, 0.1);
    g.saves.unblock('police');
    J.setPose('idle');
    if (S !== this.session) return;
    await this.startCar();
  },

  spawnOfficers() {
    if (!this.officers) {
      this.officers = ['officer', 'officer2', 'officer'].map((key, i) => {
        const ch = new Character2D(this.g.atlas, { ...CHARACTERS[key], id: `${key}_${i}` });
        this.chars.set(ch.id, ch);
        this.scene.root.add(ch.root);
        return ch;
      });
    }
    this.officers.forEach((o, i) => {
      o.setLife(CharacterState.ALIVE);
      o.setVisible(true);
      o.stand();
      o.placeAt(-12.2, -2.6 - i * 0.2, 1);
      o.setPose('idle');
    });
    return this.officers;
  },

  updateMorning(dt) {
    const g = this.g;
    if (this.popUp) {
      const p = this.popUp;
      p.t += dt;
      const k = Math.min(1, p.t / 0.28);
      p.ch.root.position.y = -1.9 * (1 - k) * (1 - k) + (k >= 1 ? Math.sin(p.t * 20) * 0.01 * Math.max(0, 1 - (p.t - 0.28) * 2) : 0);
      if (p.t > 1) { p.ch.root.position.y = 0; this.popUp = null; }
    }
    if (g.state.stage !== 'morning') return;
    this.morningT = (this.morningT || 0) + dt;
    // a nudge if he wanders for a long time without finding Kayden
    if (!g.state.get('kaydenDeathDiscovered') && this.morningT > 70 && !this.hinted) {
      this.hinted = true;
      g.view.flash('thought', g.dialogue.dialogues.m_hint.nodes.a.text, 3200);
    }
    // safety net: the police come anyway a while after Kayden
    if (g.state.get('kaydenDeathDiscovered') && !this.policeStarted) {
      this.kaydenT = (this.kaydenT || 0) + dt;
      if (this.kaydenT > 55) { this.policeStarted = true; this.policeArrival(); }
    }
  },
};

export function installMorning(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}
