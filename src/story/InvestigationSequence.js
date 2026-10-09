import * as THREE from 'three';
import { glowTexture } from '../render/textures.js';
import { sleep } from './Director.js';

/**
 * After the discharge: the station a week later (the list of the dead, Kowalski's offer,
 * the case folders), then the werewolf branch:
 *   station_return → forest (the cordoned site by day) → the tourists (call + radio)
 *   → forest_night (dusk: the wolf eats, becomes a man, Julian follows him to a cave) → ended
 * Installed onto BarStory like the custody sequence; shares its cast and helpers
 * (enter, castIn, lines, setAmbience).
 */

export const INVESTIGATION_STAGES = ['station_return', 'forest', 'forest_night'];

const A = (x, y, z) => new THREE.Vector3(x, y, z);

const methods = {
  // ------------------------------------------------------------------ STATION, A WEEK LATER

  async startStationReturn() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('station', null, 'station_return');
    const w = g.world;
    w.lockedIn = false;
    w.setCellOpen?.(true);
    w.setMedOpen?.(false);
    // the custody-day crowd has gone home
    for (const c of this.custodyCast?.values() || []) if (c.root.parent === w.root) c.setVisible(false);
    const sg = this.castIn(w, 'sergeant');
    sg.placeAt(w.anchors.deskOfficer.x, w.anchors.deskOfficer.z, 1);
    sg.shadow.visible = false;
    const quinn = this.castIn(w, 'quinn', 'quinn_station');
    quinn.placeAt(0.4, -2.75, -1);
    const kow = this.castIn(w, 'investigator', 'kowalski');
    kow.placeAt(3.8, -2.7, -1);
    // the witnesses came back to give statements again
    const ray = this.castIn(w, 'barman', 'ray_return');
    ray.placeAt(-7.4, -2.75, 1);
    const noah = this.castIn(w, 'survivorWaiter', 'noah_return');
    noah.sit({ x: w.anchors.benchB.x, z: w.anchors.benchB.z }, 1);
    noah.setPose('hands');
    this.returnCast = { sg, quinn, kow, ray, noah };
    const J = this.julian;
    J.placeAt(-11.4, -2.0, 1);
    this.setAmbience(['amb.station']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.card.show('Улики', { num: 'Глава 6', en: 'Evidence', sub: 'УЧАСТОК · ДЕНЬ СЕДЬМОЙ', ms: 2200, style: 'chapter-b' });
    if (S !== this.session) return;
    await g.fader.to(false, 1400);
    await J.walkTo({ x: -8.6, z: -1.6 }, { speed: 1.1 });
    if (S !== this.session) return;
    sg.face(1);
    if (!(await this.lines(g.dialogue.dialogues.sr_enter))) return;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', g.state.get('investigation_route') ? 'valley' : 'kowalski');
    g.interactions.setItems(this.stationReturnInteractables(w));
  },

  stationReturnInteractables(w) {
    const g = this.g;
    const c = this.returnCast;
    const f = () => g.state.flags;
    const say = (id) => () => g.dialogue.start(id);
    const talk = (id, ch) => async () => { ch.faceTowards(this.julian.position.x); await g.dialogue.start(id); this.evidenceProgress(); };
    return [
      { id: 'sr_desk', label: 'Сержант Пелли', at: { x: -9.5, z: -1.9 }, radius: 1.0, anchor: w.anchors.desk, run: say('sr_desk') },
      { id: 'sr_ray', label: 'Рэй, бармен', at: { x: -7.4, z: -2.1 }, radius: 0.6, anchor: A(-7.4, 2.1, -2.75), run: talk('sr_ray', c.ray) },
      { id: 'sr_noah', label: 'Ноа, официант', at: { x: -5.7, z: -2.2 }, radius: 0.6, anchor: A(-5.7, 1.7, -3.2), run: talk('sr_noah', c.noah) },
      { id: 'sr_board', label: 'Список погибших', at: { x: -4.4, z: -2.4 }, radius: 0.6, anchor: w.anchors.board, run: () => this.readVictims() },
      { id: 'sr_map', label: 'Карта нападений', at: { x: -2.6, z: -2.4 }, radius: 0.6, anchor: A(-2.6, 1.85, -4.2), run: () => this.attackMap() },
      { id: 'sr_quinn', label: 'Куинн', at: { x: 0.4, z: -2.2 }, radius: 0.6, anchor: A(0.4, 2.1, -2.75),
        run: async () => { c.quinn.faceTowards(this.julian.position.x); await g.dialogue.start(f().sr_quinn ? 'sr_quinn_again' : 'sr_quinn'); } },
      { id: 'sr_cctv', label: 'Записи камер', at: { x: 2.0, z: -2.4 }, radius: 0.6, anchor: w.anchors.offices, run: () => this.reviewCameras() },
      { id: 'sr_kowalski', label: 'Детектив Ковальски', at: { x: 3.6, z: -2.2 }, radius: 0.7, anchor: A(3.8, 2.1, -2.7), run: () => this.talkKowalski() },
      { id: 'sr_exit', label: 'Выход', at: { x: -12.0, z: -2.2 }, radius: 0.9, anchor: w.anchors.entrance,
        run: () => (f().investigation_route ? this.afterEvidence() : g.dialogue.start('sr_exit_wait')) },
    ];
  },

  /** What Julian has looked at himself (chapter 6): the list, the cameras, the map (+ witnesses). */
  evidenceDone() {
    const f = this.g.state.flags;
    return !!(f.read_victims && f.sr_cctv_done && f.sr_map_done);
  },

  evidenceProgress() {
    if (this.evidenceDone() && !this.g.state.get('investigation_route')) this.g.state.set('objective', 'kowalski');
  },

  async reviewCameras() {
    const g = this.g;
    if (!g.state.get('offer_heard')) return g.dialogue.start('sr_kowalski_wait');
    if (g.state.get('sr_cctv_done')) return g.view.flash('thought', 'Пятно вместо лица. Пустое зеркало. Сорок одна минута тишины.', 2600);
    await g.lzui.cctv([
      { cam: 1, tc: '22:47:10', kind: 'enter', anomaly: false, note: 'Я вхожу. Кайден машет из-за столика. Обычный вечер.' },
      { cam: 2, tc: '23:31:44', kind: 'cocktail', anomaly: true, note: 'Мужчина в углу передаёт коктейль. Вместо лица — белое пятно. На каждом кадре.' },
      { cam: 2, tc: '23:44:02', kind: 'mirror', anomaly: true, note: 'Зеркало за стойкой. Я в нём есть. Его — нет.' },
      { cam: 1, tc: '23:58:30', kind: 'static', anomaly: true, note: 'Обе камеры слепнут. Сорок одна минута помех.' },
      { cam: 1, tc: '00:39:51', kind: 'after', anomaly: false, note: 'Камера оживает. В зале уже никто не двигается.' },
      { cam: 3, tc: '06:12:00', kind: 'enter', anomaly: false, note: 'Утро. Пусто. Только снег за окном.' },
    ], 3);
    g.state.set('sr_cctv_done', true);
    await this.lines(g.dialogue.dialogues.sr_cctv_after);
    this.evidenceProgress();
  },

  async attackMap() {
    const g = this.g;
    if (!g.state.get('offer_heard')) return g.dialogue.start('sr_kowalski_wait');
    if (g.state.get('sr_map_done')) return g.view.flash('thought', 'Каждые четыре дня — севернее. Потом — тишина.', 2400);
    await g.lzui.map({
      julian: true,
      title: 'ДЕЛО 0417-ФН · НАПАДЕНИЯ',
      pins: [[22, 47, '30 окт.'], [43, 34, '3 нояб.'], [62, 22, '7 нояб.'], [74, 15, '11 нояб. · Лиззи']],
      next: [84, 5, 'скалы?'],
      hint: 'Соедините нападения по датам',
      done: 'Каждые четыре дня — севернее. После 11 ноября — ничего. Выше излучины — скалы.',
    });
    g.state.set('sr_map_done', true);
    await this.lines(g.dialogue.dialogues.sr_map_after);
    this.evidenceProgress();
  },

  async readVictims() {
    const g = this.g;
    const first = !g.state.get('read_victims');
    await g.dialogue.start(first ? 'sr_board' : 'sr_board_again');
    if (first) {
      await this.lines(g.dialogue.dialogues.sr_board_after);
      if (!g.state.get('investigation_route')) g.state.set('objective', 'kowalski');
    }
  },

  async talkKowalski() {
    const g = this.g;
    const k = this.returnCast.kow;
    k.faceTowards(this.julian.position.x);
    if (g.state.get('investigation_route')) return g.dialogue.start('sr_exit_wait').then(() => g.hud.toast('Папка расследования — кнопка с папкой (J)'));
    if (!g.state.get('offer_heard')) {
      g.player.enabled = false;
      const ok = await this.lines(g.dialogue.dialogues.sr_offer);
      g.player.enabled = true;
      if (!ok) return;
      g.state.set('offer_heard', true);
      g.state.set('objective', 'evidence');
      return;
    }
    if (!this.evidenceDone()) return g.dialogue.start('sr_kowalski_wait2');
    g.player.enabled = false;
    await this.lines(g.dialogue.dialogues.sr_choose);
    g.player.enabled = true;
    return this.chooseCase();
  },

  async chooseCase() {
    const g = this.g;
    const id = await g.cases.choose();
    if (!id) return;
    g.state.set('investigation_route', id);
    if (id === 'VAMPIRE') {
      g.player.enabled = false;
      await this.lines(g.dialogue.dialogues.j5_vampire);
      g.player.enabled = true;
      g.state.set('objective', 'vampire_lead');
      g.hud.notifyCase(true);
      g.saves.autosave('case');
      return;
    }
    g.player.enabled = false;
    await this.lines(g.dialogue.dialogues.sr_took_wolf);
    g.player.enabled = true;
    g.state.set('objective', 'valley');
    g.hud.notifyCase(true);
    g.hud.toast('Папка расследования — улики по делу (J)', 3200);
    g.saves.autosave('case');
  },

  // ------------------------------------------------------------------ THE VALLEY BY DAY

  async startForest() {
    const g = this.g;
    const S = this.session;
    await g.fader.to(true, 900);
    await this.enter('forest', 'day', 'forest');
    const w = g.world;
    const J = this.julian;
    J.placeAt(w.anchors.start.x, w.anchors.start.z, 1);
    this.setAmbience(['amb.wind']);
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    g.cameraSys.snap();
    await g.card.show('Территория', { num: 'Глава 8', en: 'Territory', sub: 'ДОЛИНА ТАКХИНИ', ms: 2200, style: 'chapter-b' });
    if (S !== this.session) return;
    await g.fader.to(false, 2000);
    await J.walkTo({ x: -7.6, z: 0.3 }, { speed: 1.0 });
    if (S !== this.session) return;
    if (!(await this.lines(g.dialogue.dialogues.fo_arrive))) return;
    g.keyScene = false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'forest');
    g.interactions.setItems(this.forestInteractables(w));
  },

  forestInteractables(w) {
    const g = this.g;
    const say = (id) => () => g.dialogue.start(id);
    return [
      { id: 'fo_car', label: 'Машина', at: { x: -11.2, z: 0.2 }, radius: 0.9, anchor: A(-11.6, 1.4, 0.4), run: say('fo_car') },
      { id: 'fo_flyer', label: 'Листовка', at: { x: -6.2, z: -2.1 }, radius: 0.7, anchor: w.anchors.flyer, run: say('fo_flyer') },
      { id: 'fo_tape', label: 'Оцепление', at: { x: -4.6, z: -1.8 }, radius: 0.8, anchor: w.anchors.tape, run: say('fo_tape') },
      { id: 'fo_river', label: 'Река', at: { x: 0.6, z: -2.2 }, radius: 1.0, anchor: w.anchors.river, run: say('fo_river') },
      { id: 'fo_marker11', label: 'Маркер № 11', at: { x: 3.0, z: -2.2 }, radius: 0.7, anchor: w.anchors.marker11, run: say('fo_marker11') },
      { id: 'fo_bones', label: 'Кости', at: { x: 5.2, z: -2.2 }, radius: 0.6, anchor: A(5.4, 0.4, -4.0), run: say('fo_bones') },
      { id: 'fo_claws', label: 'Осина', at: { x: 7.4, z: -2.2 }, radius: 0.7, anchor: w.anchors.claws, run: say('fo_claws') },
      { id: 'fo_analysis', label: 'Сопоставить следы', at: { x: 9.6, z: -1.6 }, radius: 0.8, anchor: A(9.6, 1.2, -2.4), run: () => (g.state.get('fo_claws') && g.state.get('fo_bones') ? g.dialogue.start('fo_analysis') : g.view.flash('thought', 'Сначала — осина и кости. Потом сопоставлять.', 2200)) },
      { id: 'fo_trail', label: 'Тропа в чащу', at: { x: 12.0, z: 0.2 }, radius: 0.9, anchor: A(12.6, 1.4, 0), run: say('fo_trail') },
    ];
  },

  /** The site has been looked at: Quinn calls — the tourists. Then the radio, then dusk. */
  async touristsCall() {
    const g = this.g;
    const S = this.session;
    this.callStarted = true;
    g.player.enabled = false;
    g.keyScene = true;
    await sleep(1.2);
    g.audio.play('sfx.phone');
    await sleep(1.0);
    if (S !== this.session) return;
    if (!(await this.lines(g.dialogue.dialogues.fo_call))) return;
    g.state.set('tourists_news', true);
    g.hud.notifyCase(true);
    await g.fader.to(true, 1600);
    if (S !== this.session) return;
    g.hud.show(false);
    await g.card.show('Два дня спустя', { en: 'Two Days Later', ms: 1900 });
    g.audio.play('sfx.tv', { volume: 0.5 });
    if (!(await this.lines(g.dialogue.dialogues.fo_news))) return;
    await sleep(0.8);
    if (S !== this.session) return;
    // the routes: the tourists' camp on the map — the line ends at the cliffs
    await g.lzui.map({
      julian: true,
      title: 'МАРШРУТЫ · ДОЛИНА ТАКХИНИ',
      pins: [[22, 47, '30 окт.'], [43, 34, '3 нояб.'], [62, 22, '7 нояб.'], [74, 15, '11 нояб.'], [80, 9, '9 дек. · туристы']],
      next: [86, 4, 'логово?'],
      hint: 'Добавьте новое нападение и соедините все по датам',
      done: 'Месяц тишины — и снова север. Туристы стояли под самыми скалами. Оно живёт там.',
    });
    if (S !== this.session) return;
    if (!(await this.lines(g.dialogue.dialogues.fo_routes))) return;
    g.keyScene = false;
    if (!g.state.get('lizzie_chapter_4_complete') && !(await this.playLizzie(4))) return;
    if (S !== this.session) return;
    await this.startForestNight();
  },

  // ------------------------------------------------------------------ THE VALLEY AT DUSK

  async startForestNight() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('forest', 'night', 'forest_night');
    const w = g.world;
    const J = this.julian;
    J.placeAt(w.anchors.start.x + 1.5, w.anchors.start.z, 1);
    g.state.set('saw_transform', false);
    g.state.set('found_cave', false);
    this.nightPhase = 'walk';
    this.followClose = 0;
    // the wolf at the river, eating; the man appears later
    const wolf = this.castIn(w, 'wolf', 'beast');
    wolf.placeAt(w.anchors.wolf.x, w.anchors.wolf.z, -1);
    wolf.root.scale.setScalar(1.7);
    wolf.setPose('eat');
    wolf.eatT = 0;
    const man = this.castIn(w, 'stranger', 'stranger');
    man.setVisible(false);
    this.beast = wolf; this.stranger = man;
    this.setAmbience(['amb.wind']);
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    g.cameraSys.snap();
    await g.card.show('Волк', { num: 'Глава 10', en: 'The Wolf', sub: 'СУМЕРКИ · ДОЛИНА ТАКХИНИ', ms: 2200, style: 'chapter-b' });
    if (S !== this.session) return;
    await g.fader.to(false, 2200);
    if (!(await this.lines(g.dialogue.dialogues.fn_arrive))) return;
    g.keyScene = false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', null);
    g.interactions.setItems(this.forestNightInteractables(w));
  },

  forestNightInteractables(w) {
    const g = this.g;
    const say = (id) => () => g.dialogue.start(id);
    return [
      { id: 'fn_marker', label: 'Маркер № 11', at: { x: 3.0, z: -2.2 }, radius: 0.7, anchor: w.anchors.marker11, run: say('fo_marker11') },
      { id: 'fn_claws', label: 'Осина', at: { x: 7.4, z: -2.2 }, radius: 0.7, anchor: w.anchors.claws, run: say('fo_claws') },
    ];
  },

  /** Hidden behind the fallen spruce: the wolf feeds, freezes, and becomes a man. */
  async wolfScene() {
    const g = this.g;
    const S = this.session;
    const w = g.world;
    const J = this.julian, wolf = this.beast, man = this.stranger;
    this.nightPhase = 'watch';
    g.player.enabled = false;
    g.keyScene = true;
    g.hud.show(false);
    g.letterbox.set(true, 1200);
    g.audio.music('tense', 3);
    await J.walkTo(w.anchors.hide, { speed: 0.8, direct: true });
    if (S !== this.session) return;
    J.face(1);
    J.setPose('think');
    J.root.position.y = -0.62;   // crouched behind the rocks: head and shoulders above them
    const wx = w.anchors.wolf.x, wz = w.anchors.wolf.z;
    const wide = { x: 16.2, y: 1.45, z: 3.4, lookX: 21.2, lookY: 1.1, lookZ: -7.0, fov: 38 };
    const close = { x: 21.8, y: 1.6, z: -3.6, lookX: wx, lookY: 1.4, lookZ: wz, fov: 32 };
    g.cameraSys.setShot(wide, 2.4);
    await sleep(2.6);
    if (!(await this.lines(g.dialogue.dialogues.fn_watch))) return;
    // it stops eating and lifts its head
    this.nightPhase = 'still';
    wolf.setPose('idle');
    g.audio.play('inner.heartbeat', { volume: 0.7 });
    if (!(await this.lines(g.dialogue.dialogues.fn_turn))) return;
    await sleep(1.4);
    wolf.face(1);
    await sleep(1.0);
    if (S !== this.session) return;
    // the change: shudders, steam, a hard white breath — and a man stands where it stood
    g.cameraSys.dolly(wide, close, 4.5);
    const breath = g.audio.loop('inner.breath', { volume: 0.6, fade: 1 });
    this.transformT = 0;
    this.nightPhase = 'transform';
    this.puffs = this.makePuffs(w, wx, wz);
    for (let i = 0; i < 5; i++) { await sleep(0.55 + Math.random() * 0.3); g.audio.play('sfx.thud', { volume: 0.35 + i * 0.08 }); g.cameraSys.shake = 0.15 + i * 0.05; }
    if (S !== this.session) return;
    g.renderer.setLayer('flash', { exposure: 0.35, saturation: -0.3 });
    g.audio.play('sfx.whoosh');
    await sleep(0.25);
    wolf.setVisible(false);
    man.setVisible(true);
    man.placeAt(wx, wz, 1);
    man.root.scale.set(1, 0.55, 1);
    this.riseT = 0;
    g.renderer.clearLayer('flash');
    breath?.stop(2);
    await sleep(2.4);
    if (S !== this.session) return;
    this.nightPhase = 'after';
    man.root.scale.set(1, 1, 1);
    man.faceTowards(J.position.x);
    await sleep(1.2);
    man.face(1);
    if (!(await this.lines(g.dialogue.dialogues.fn_after))) return;
    // he doesn't rush after him: where will it go?
    g.letterbox.set(false, 400);
    await g.dialogue.start('fn_predict');
    if (S !== this.session) return;
    g.state.set('saw_transform', true);
    g.hud.notifyCase(true);
    // he walks off along the river; Julian follows on the path
    g.letterbox.set(false, 1200);
    g.cameraSys.setShot(null, 1.6);
    J.setPose('idle');
    J.root.position.y = 0;
    g.keyScene = false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'follow');
    this.followRoute = [{ x: 26.5, z: -11.4 }, { x: 29.5, z: -6.0 }, { x: 31.5, z: -2.9 }, { x: 36.0, z: -2.7 }, { x: 40.6, z: -2.9 }, { x: 42.2, z: -4.6 }];
    this.followI = 0;
    this.nightPhase = 'follow';
  },

  makePuffs(w, x, z) {
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7e889a, transparent: true, opacity: 0, depthWrite: false });
    return Array.from({ length: 10 }, (_, i) => {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(x + (Math.random() - 0.5) * 1.4, 0.3 + Math.random() * 1.0, z + 0.3);
      s.userData = { t: -i * 0.22, vx: (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.3 };
      w.root.add(s);
      return s;
    });
  },

  async caveEnding() {
    const g = this.g;
    const S = this.session;
    this.nightPhase = 'end';
    g.player.enabled = false;
    g.keyScene = true;
    g.hud.show(false);
    g.letterbox.set(true, 1200);
    const J = this.julian;
    await J.walkTo({ x: 39.7, z: -1.8 }, { speed: 0.7, direct: true });
    if (S !== this.session) return;
    J.face(1);
    g.cameraSys.setShot({ x: 40.2, y: 1.8, z: 5.2, lookX: 41.8, lookY: 1.4, lookZ: -3.5, fov: 36 }, 2.5);
    g.audio.play('inner.drone', { volume: 0.4 });
    await sleep(2.0);
    if (!(await this.lines(g.dialogue.dialogues.fn_cave))) return;
    g.state.set('found_cave', true);
    J.face(-1);
    J.walkTo({ x: 36.0, z: -0.4 }, { speed: 0.9, direct: true });
    await sleep(1.0);
    await g.fader.to(true, 2600);
    if (S !== this.session) return;
    g.letterbox.set(false, 10);
    g.keyScene = false;
    // J5 → L5: he waits by the cave; inside, it is the night of Lizzie's escape
    await this.playLizzie(5);
  },

  /** After chapter 6 (both routes): ch.7 is Lizzie's cave, then Julian's line by route. */
  async afterEvidence() {
    const g = this.g;
    const S = this.session;
    if (!g.state.get('lizzie_chapter_3_complete') && !(await this.playLizzie(3))) return;
    if (S !== this.session) return;
    // the morning at home, then his own investigation by route
    return this.startHome(2);
  },

  /** Route VAMPIRE: Julian goes after the man from the bar (his chapters 8 and 10 are still in development). */
  async vampireChain() {
    const g = this.g;
    const S = this.session;
    g.player.enabled = false;
    g.hud.show(false);
    g.fader.set(true);
    await g.card.show('Человек из бара', { num: 'Глава 8', en: 'The Man from the Bar', sub: 'РАССЛЕДОВАНИЕ ДЖУЛИАНА — В РАЗРАБОТКЕ', ms: 2600, style: 'chapter-b' });
    if (S !== this.session) return;
    if (!g.state.get('lizzie_chapter_4_complete') && !(await this.playLizzie(4))) return;
    if (S !== this.session) return;
    g.fader.set(true);
    await g.card.show('Без отражения', { num: 'Глава 10', en: 'No Reflection', sub: 'РАССЛЕДОВАНИЕ ДЖУЛИАНА — В РАЗРАБОТКЕ', ms: 2600, style: 'chapter-b' });
    if (S !== this.session) return;
    await this.playLizzie(5);
  },

  // ------------------------------------------------------------------ per frame + loading

  updateInvestigation(dt) {
    const g = this.g;
    const st = g.state.stage;
    if (st === 'forest' && !this.callStarted && g.player.enabled && !g.dialogue.busy) {
      const f = g.state.flags;
      const seen = ['fo_tape', 'fo_marker', 'fo_claws', 'fo_river'].filter((k) => f[k]).length;
      if (seen >= 3 && f.fo_marker && f.fo_analysis_done) this.touristsCall();
    }
    if (st !== 'forest_night') return;
    const J = this.julian, wolf = this.beast, man = this.stranger;
    if (!wolf) return;
    // feeding: the rig tugs at the kill; every few seconds the head comes up to look round
    if (this.nightPhase === 'walk' || this.nightPhase === 'watch') {
      wolf.eatT += dt;
      const up = wolf.pose !== 'eat';
      if (wolf.eatT > (up ? 1.3 : 4 + Math.random() * 3)) { wolf.eatT = 0; wolf.setPose(up ? 'eat' : 'idle'); }
    }
    if (this.nightPhase === 'walk') {
      if (J.position.x > 13.2 && !this.heardSound) { this.heardSound = true; this.lines(g.dialogue.dialogues.fn_sound, { blocking: false }); g.state.set('objective', 'watch'); }
      if (J.position.x > 15.6 && !g.dialogue.busy) this.wolfScene();
    }
    if (this.nightPhase === 'transform') {
      this.transformT += dt;
      const k = Math.min(1, this.transformT / 3.2);
      wolf.root.position.x = this.g.world.anchors.wolf.x + Math.sin(this.transformT * 38) * 0.04 * k;
      wolf.root.scale.set(1.7 * (1 - 0.1 * k), 1.7 * (1 - 0.25 * k + Math.sin(this.transformT * 22) * 0.04 * k), 1.7);
    }
    if (this.puffs) {
      for (const s of this.puffs) {
        const u = s.userData; u.t += dt;
        if (u.t < 0) continue;
        s.position.x += u.vx * dt; s.position.y += u.vy * dt;
        s.scale.setScalar(0.5 + u.t * 0.55);
        s.material.opacity = Math.max(0, Math.sin(Math.min(1, u.t / 2.6) * Math.PI) * 0.22);
      }
      if (this.puffs.every((s) => s.userData.t > 2.7)) { for (const s of this.puffs) s.removeFromParent(); this.puffs = null; }
    }
    if (this.riseT != null && man.root.visible && this.nightPhase === 'transform') {
      this.riseT += dt;
      man.root.scale.y = 0.55 + 0.45 * Math.min(1, this.riseT / 2.0);
    }
    if (this.nightPhase === 'follow') this.updateFollow(dt);
  },

  /** He keeps ahead: waits if Julian falls behind, stops and looks back if he comes too close. */
  updateFollow(dt) {
    const g = this.g;
    const J = this.julian, man = this.stranger;
    const d = man.position.x - J.position.x;
    this.followClose = Math.max(0, this.followClose - dt);
    if (d < 2.6 && this.followClose <= 0 && this.followI < this.followRoute.length - 1) {
      this.followClose = 4;
      man.stop();
      man.faceTowards(J.position.x);
      g.view.flash('thought', g.dialogue.dialogues.fn_close[0][1], 2000);
      setTimeout(() => man.face(1), 2200);
      return;
    }
    if (this.followClose > 1.8) return;
    if (d > 11 && man.state === 'walk') { man.stop(); return; }
    if (man.state !== 'walk' && d < 8.5 && this.followI < this.followRoute.length) {
      const p = this.followRoute[this.followI];
      man.walkTo(p, { speed: 1.0, direct: true }).then(() => {
        if (man.position.x === p.x || Math.hypot(man.position.x - p.x, man.position.z - p.z) < 0.15) this.followI++;
        if (this.followI >= this.followRoute.length) { man.setVisible(false); this.strangerGone = true; }
      });
    }
    if (this.strangerGone && J.position.x > 38.5 && !g.dialogue.busy) this.caveEnding();
  },

  async loadInvestigation(stage) {
    this.bump();
    await this.g.dialogue.abort();
    this.callStarted = false;
    this.heardSound = false;
    this.strangerGone = false;
    this.nightPhase = null;
    this.puffs?.forEach((s) => s.removeFromParent());
    this.puffs = null;
    this.riseT = null;
    const start = {
      station_return: () => this.startStationReturn(),
      forest: () => this.startForest(),
      forest_night: () => this.startForestNight(),
    }[stage];
    if (start) await start();
  },

  investigationCommands() {
    const g = this.g;
    return {
      victims: () => g.cases.victims(),
      chooseCase: () => this.chooseCase(),
      kneel: async () => { this.julian.setPose('think'); await sleep(0.4); },
    };
  },
};

export function installInvestigation(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}

