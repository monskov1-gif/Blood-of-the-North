import * as THREE from 'three';
import { sleep } from './Director.js';

/**
 * Lizzie's line (docs/claude/lizzy_arc_spec.md), interleaved with Julian's chapters:
 *   J1 bar → L1 «След» → J2 morning/police/car → L2 «Лес» → J3 station…hospital, the heart stops
 *   → L3 «Пещера» (in the black) → J4 thirst, first blood → L4 «Стая» → J5 recovery, station, the
 *   case folders (investigation_route) → [WEREWOLF: the valley, the wolf, the cave] → L5 «Побег».
 * The player character wears Lizzie's sprites in her chapters (setOutfit('lizzy')), so camera,
 * controls, interactions and saves are the same systems as Julian's.
 * Installed onto BarStory like the other sequences.
 */

export const LIZZIE_STAGES = ['lizzie_1', 'lizzie_2', 'lizzie_3', 'lizzie_4', 'lizzie_5'];

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// the game's chapter numbers (01 Julian … 12 the crossing) and the dates of Lizzie's line:
// time between her chapters is uneven on purpose — hours, days, weeks
const CARDS = {
  1: ['След', 'The Trail', 'ПЯТНИЦА, 5 НОЯБРЯ', 'Глава 2 · Лиззи'],
  2: ['Лес', 'The Forest', 'ЧЕТВЕРГ, 11 НОЯБРЯ · ВЕЧЕР', 'Глава 4 · Лиззи'],
  3: ['Пещера', 'The Cave', '13 НОЯБРЯ', 'Глава 7 · Лиззи'],
  4: ['Стая', 'The Pack', 'ДЕКАБРЬ · ДЕНЬ ДВАДЦАТЫЙ', 'Глава 9 · Лиззи'],
  5: ['Побег', 'The Escape', '13 ДЕКАБРЯ · НОЧЬ', 'Глава 11 · Лиззи'],
};

const methods = {
  // ------------------------------------------------------------------ plumbing

  /** Plays Lizzie's chapter n; resolves true when it finished in the same session. */
  async playLizzie(n) {
    const g = this.g;
    const S = this.session;
    g.audio.setMasterVolume(1, 0.05);
    g.letterbox.set(false, 10);
    g.cameraSys.roll = 0;
    for (const k of ['dying', 'wakeflash', 'thirst', 'blood', 'flash', 'evening', 'lzhit']) g.renderer.clearLayer(k);
    g.hud.el.classList.add('lizzie');
    g.hallucination.reset();
    for (const k of ['kayden', 'morning', 'hangover', 'police', 'wake', 'interro']) g.renderer.clearLayer(k);
    await this[`lizzieL${n}`]();
    g.hud.el.classList.remove('lizzie');
    this.lzFollow = null;
    this.lzChaseS = null;
    if (S !== this.session) return false;
    if (n < 5) g.state.set(`lizzie_chapter_${n}_complete`, true);
    return true;
  },

  /** Enter a location as Lizzie; her cast of the previous chapter is put away. */
  async lzEnter(location, state, stage) {
    for (const id of this.lzIds || []) this.custodyCast?.get(id)?.setVisible(false);
    await this.enter(location, state, stage);
    this.julian.root.position.y = 0;
  },

  lzCastIn(key, id, x, z, facing = 1) {
    const ch = this.castIn(this.g.world, key, id);
    ch.placeAt(x, z, facing);
    this.lzIds = this.lzIds || new Set();
    this.lzIds.add(id);
    ch.root.scale.setScalar(ch.def?.scale || 1);
    return ch;
  },

  async lzCard(n) {
    const g = this.g;
    const [t, en, sub, num] = CARDS[n];
    g.fader.set(true);
    await g.card.show(t, { num, en, sub, ms: 2300, style: 'chapter-b' });
  },

  lzSay(id) { return () => this.g.dialogue.start(id); },

  /** A blood pool on the snow / stone (L2, L5). */
  lzBlood(x, z, s = 1, y = 0.014) {
    const w = this.g.world;
    if (w.addBlood) { const d = w.addBlood(x, z, s); d.position.y = y; return d; }
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.35 * s, 9), new THREE.MeshLambertMaterial({ color: 0x6a0808, transparent: true, opacity: 0.85, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.y = 0.7;
    w.root.add(m);
    (this.lzDecals = this.lzDecals || []).push(m);
    return m;
  },

  lzClearDecals() { for (const d of this.lzDecals || []) d.removeFromParent(); this.lzDecals = []; },

  async lzHit(strength = 1) {
    const g = this.g;
    g.renderer.setLayer('lzhit', { exposure: 0.25 * strength, tint: [0.35 * strength, -0.06, -0.06], vignette: 0.3 * strength });
    g.cameraSys.shake = 0.6 * strength;
    await sleep(0.14);
    g.renderer.clearLayer('lzhit');
  },

  // ------------------------------------------------------------------ L1 — СЛЕД

  async lizzieL1() {
    const g = this.g;
    const S = this.session;
    await this.lzCard(1);
    if (S !== this.session) return;
    await this.lzEnter('school', null, 'lizzie_1');
    const w = g.world, L = this.julian;
    L.placeAt(-3.4, -0.6, 1);
    const pu = this.lzCastIn('puriel', 'lz_puriel', 5.7, -2.3, -1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 6.7, -2.4, -1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 7.8, -2.2, -1);
    this.lzCast = { pu, ol, vi };
    g.narrative.setChar('lizzie', 'curious');
    this.setAmbience(['amb.room']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1400);
    if (!(await this.lines(g.dialogue.dialogues.l1_open))) return;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'lz_girls');
    return new Promise((resolve) => {
      this.lzDone = resolve;
      const talk = async () => {
        g.player.enabled = false;
        await g.dialogue.start('l1_girls');
        if (S !== this.session) return;
        g.narrative.setChar('lizzie', 'investigative');
        await this.lzL1Sites();
        resolve();
      };
      g.interactions.setItems([
        { id: 'l1_window', label: 'Окно', at: { x: -4.6, z: -2.0 }, radius: 0.9, anchor: w.anchors.window, run: this.lzSay('l1_window') },
        { id: 'l1_trophy', label: 'Кубки', at: { x: -7.2, z: -2.0 }, radius: 0.8, anchor: w.anchors.trophy, run: this.lzSay('l1_trophy') },
        { id: 'l1_lockers', label: 'Мой шкафчик', at: { x: -1.6, z: -2.0 }, radius: 0.6, anchor: w.anchors.lockers, run: this.lzSay('l1_lockers') },
        { id: 'l1_board', label: 'Доска объявлений', at: { x: 6.0, z: -1.6 }, radius: 0.5, anchor: w.anchors.board, run: this.lzSay('l1_board') },
        { id: 'l1_girls', label: 'Девочки', at: { x: 5.0, z: -1.4 }, radius: 1.0, anchor: V(6.6, 2.0, -2.3), run: talk },
        { id: 'l1_exit', label: 'Выход', at: { x: -9.0, z: -2.0 }, radius: 0.9, anchor: w.anchors.exit, run: () => (g.state.get('lz_l1_agreed') ? null : g.dialogue.start('l1_exit_wait')) },
      ]);
    });
  },

  async lzL1Sites() {
    const g = this.g;
    const S = this.session;
    const site = async (n, x, sub) => {
      await g.fader.to(true, 900);
      if (S !== this.session) return false;
      if (n === 1) { await this.lzEnter('forest', 'l1', null); g.state.set('objective', 'lz_sites'); }
      g.hud.show(false);
      g.player.enabled = false;
      const L = this.julian;
      L.root.position.y = 0;
      L.placeAt(x, 0.2, 1);
      const { pu, ol, vi } = this.lzCast;
      for (const [i, c] of [pu, ol, vi].entries()) { this.g.world.root.add(c.root); c.setVisible(true); c.placeAt(x - 1.2 - i * 0.9, 0.5 - i * 0.35, 1); }
      this.lzFollow = [pu, ol, vi];
      g.cameraSys.setShot(null, 1); g.cameraSys.snap();
      await g.card.show(`Точка ${n}`, { en: `Site ${n}`, sub, ms: 1600 });
      await g.fader.to(false, 900);
      return S === this.session;
    };
    const w = () => g.world;
    const photo = (id) => g.state.get(`lz_photo_${id}`);
    // site 1 — south
    if (!(await site(1, -10.4, 'ЮГ РЕКИ · СУББОТА'))) return;
    if (!(await this.lines(g.dialogue.dialogues.l1_siteA))) return;
    await this.lzExplore([
      { id: 'l1_bones', label: 'Кости в кустах', at: { x: -8.0, z: -1.9 }, radius: 0.8, anchor: w().anchors.siteA.bones, run: this.lzSay('l1_bones') },
      { id: 'l1_claws', label: 'Борозды на ели', at: { x: -6.2, z: -2.1 }, radius: 0.7, anchor: w().anchors.siteA.claws, run: this.lzSay('l1_claws') },
      { id: 'l1_sapling', label: 'Сломанная берёза', at: { x: -5.4, z: -2.0 }, radius: 0.6, anchor: w().anchors.siteA.sapling, run: this.lzSay('l1_sapling') },
    ], { x: -3.6, label: 'Дальше, на север' }, () => ['bones', 'claws', 'sapling'].filter(photo).length >= 2);
    if (S !== this.session) return;
    // site 2 — further north: carcasses, ravens
    if (!(await site(2, 10.2, 'СЕВЕРНЕЕ · ВОСКРЕСЕНЬЕ'))) return;
    if (!(await this.lines(g.dialogue.dialogues.l1_siteB))) return;
    await this.lzExplore([
      { id: 'l1_carcass', label: 'Туши', at: { x: 13.4, z: -1.8 }, radius: 0.9, anchor: w().anchors.siteB.carcass, run: this.lzSay('l1_carcass') },
      { id: 'l1_ravens', label: 'Вороны', at: { x: 15.4, z: -1.8 }, radius: 0.8, anchor: w().anchors.siteB.ravens, run: this.lzSay('l1_ravens') },
    ], { x: 18.2, label: 'Дальше, на север' }, () => ['carcass', 'ravens'].some(photo));
    if (S !== this.session) return;
    // site 3 — north: fresh tracks, the map
    if (!(await site(3, 20.0, 'СЕВЕР · ПОНЕДЕЛЬНИК'))) return;
    if (!(await this.lines(g.dialogue.dialogues.l1_siteC))) return;
    await this.lzExplore([
      { id: 'l1_tracks', label: 'Следы', at: { x: 23.6, z: -1.4 }, radius: 0.9, anchor: w().anchors.siteC.tracks, run: this.lzSay('l1_tracks') },
    ], { x: 25.6, label: 'Карта', run: () => g.dialogue.start('l1_mapTime') }, () => photo('tracks'), () => g.state.get('lz_map_done'));
    if (S !== this.session) return;
    g.player.enabled = false;
    if (!(await this.lines(g.dialogue.dialogues.l1_after))) return;
    await g.fader.to(true, 1400);
  },

  /**
   * Free exploration with a gate: `items` are the clues, `gate` the way on (shown once `ready()`);
   * resolves when the gate is used (or `done()` turns true).
   */
  lzExplore(items, gate, ready, done) {
    const g = this.g;
    g.hud.show(true);
    g.player.enabled = true;
    return new Promise((resolve) => {
      const go = { id: `lz_gate_${gate.x}`, label: gate.label, at: { x: gate.x, z: 0.0 }, radius: 1.0, anchor: V(gate.x + 0.4, 1.4, -0.4),
        run: async () => {
          if (!ready()) { await g.dialogue.start('l1_needPhotos'); return; }
          if (gate.run) { await gate.run(); if (done && !done()) return; }
          g.interactions.setItems([]);
          resolve();
        } };
      g.interactions.setItems([...items, go]);
    });
  },

  // ------------------------------------------------------------------ L2 — ЛЕС

  async lizzieL2() {
    const g = this.g;
    const S = this.session;
    await this.lzCard(2);
    if (S !== this.session) return;
    await this.lzEnter('forest', 'l2', 'lizzie_2');
    g.state.set('objective', 'lz_herd');
    const w = g.world, L = this.julian;
    w.clearHerd();
    this.lzClearDecals();
    L.placeAt(-7.4, 0.3, 1);
    const pu = this.lzCastIn('puriel', 'lz_puriel', -8.6, 0.6, 1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', -9.5, 0.1, 1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', -10.3, 0.5, 1);
    this.lzCast = { pu, ol, vi };
    this.lzFollow = [pu, ol, vi];
    // the herd at the river: deer and hares, pressed together
    const deer = [];
    for (let i = 0; i < 9; i++) deer.push(w.critter('deer', 0.6 + i * 0.95 + (i % 3) * 0.2, -3.0 - (i % 3) * 0.75, i % 2));
    for (let i = 0; i < 6; i++) w.critter('hare', -1.5 + i * 1.6, -2.6 - (i % 2) * 0.4, i);
    deer.forEach((d, i) => { if (i % 3 === 1) d.userData.setPose('graze'); d.scale.x = i % 2 ? -1 : 1; });
    this.lzDeer = deer;
    this.setAmbience(['amb.wind']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1600);
    if (!(await this.lines(g.dialogue.dialogues.l2_open))) return;
    g.narrative.setChar('lizzie', 'investigative');
    // explore a little; the growl comes after three looks
    const seen = () => ['lz_l2_river', 'lz_l2_snow', 'lz_l2_deer', 'lz_l2_bushes'].filter((k) => g.state.get(k)).length;
    await new Promise((resolve) => {
      const wrap = (id) => async () => { await g.dialogue.start(id); if (seen() >= 3) resolve(); };
      g.hud.show(true);
      g.player.enabled = true;
      g.interactions.setItems([
        { id: 'l2_river', label: 'Река', at: { x: -1.0, z: -2.2 }, radius: 1.0, anchor: w.anchors.river, run: wrap('l2_river') },
        { id: 'l2_snow', label: 'Снег', at: { x: -4.6, z: -1.4 }, radius: 0.9, anchor: V(-4.6, 0.4, -1.8), run: wrap('l2_snow') },
        { id: 'l2_deer', label: 'Олени', at: { x: 3.4, z: -2.2 }, radius: 1.2, anchor: V(3.8, 1.4, -3.4), run: wrap('l2_deer') },
        { id: 'l2_bushes', label: 'Кусты', at: { x: 8.6, z: -2.0 }, radius: 0.9, anchor: V(9.0, 0.8, -3.0), run: wrap('l2_bushes') },
      ]);
    });
    if (S !== this.session) return;
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    g.letterbox.set(true, 1200);
    g.audio.music('tense', 2);
    L.face(1);
    g.cameraSys.setShot({ x: 2.6, y: 2.1, z: 6.6, lookX: 3.4, lookY: 1.0, lookZ: -3.4, fov: 40 }, 2);
    if (!(await this.lines(g.dialogue.dialogues.l2_growl))) return;
    g.narrative.setChar('lizzie', 'frightened');
    // the wolves come out of the trees and take the deer
    const cols = [['wolfDark', 'wolf'], ['wolfGrey', 'wolfGrey'], ['wolfRed', 'wolfRed'], ['wolfWhite', 'wolfWhite']];
    const wolves = cols.map(([id, key], i) => { const wf = this.lzCastIn(key, `lz_${id}`, 12.5 + i * 0.8, -3.6 - (i % 2) * 0.8, -1); wf.root.scale.setScalar(1.55); return wf; });
    this.lzWolves = wolves;
    g.audio.play('sfx.whoosh', { volume: 0.6 });
    await Promise.all(wolves.map((wf, i) => wf.walkTo({ x: deer[8 - i * 2].position.x + 0.9, z: deer[8 - i * 2].position.z }, { speed: 5.5 - i * 0.4, direct: true })));
    if (S !== this.session) return;
    for (const [i, wf] of wolves.entries()) {
      const d = deer[8 - i * 2];
      d.userData.setPose('dead');
      this.lzBlood(d.position.x, d.position.z + 0.15, 1.4);
      wf.setPose('eat');
      g.audio.play('sfx.thud', { volume: 0.5 });
      await this.lzHit(0.5);
      await sleep(0.35);
    }
    // the rest of the herd breaks for the trees
    this.lzScatter = deer.filter((_, i) => i % 2 === 1 || i === 0);
    g.narrative.setWw('animal_blood_consumed', g.narrative.ww('animal_blood_consumed') + 4);
    if (!(await this.lines(g.dialogue.dialogues.l2_wolves))) return;
    // film it
    g.letterbox.set(false, 800);
    g.cameraSys.setShot(null, 1.2);
    g.hud.show(true);
    g.player.enabled = true;
    await new Promise((resolve) => {
      g.interactions.setItems([{ id: 'l2_film', label: 'Снять на телефон', at: { x: L.position.x, z: L.position.z }, radius: 6, anchor: V(L.position.x + 0.4, 2.0, L.position.z), run: async () => { await g.dialogue.start('l2_film'); resolve(); } }]);
    });
    if (S !== this.session) return;
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    // the call to Julian, the unsent message
    if (!(await this.lines(g.dialogue.dialogues.l2_call))) return;
    g.state.set('lz_called_julian', true);
    // one of them looks up — and comes
    const dark = wolves[0];
    dark.setPose('idle');
    dark.faceTowards(L.position.x);
    g.letterbox.set(true, 800);
    if (!(await this.lines(g.dialogue.dialogues.l2_noticed))) return;
    g.audio.play('inner.heartbeat', { volume: 0.9 });
    // Puriel runs first — he goes for her; she vanishes behind the trees
    pu.faceTowards(-14);
    this.lzFollow = null;
    const puRun = pu.walkTo({ x: -14.5, z: 1.2 }, { speed: 3.6, direct: true });
    await sleep(0.4);
    const chase = dark.walkTo({ x: -14.0, z: 1.0 }, { speed: 7.5, direct: true });
    await Promise.race([puRun, chase]);
    g.audio.play('sfx.shouts', { volume: 0.8 });
    g.narrative.setChar('puriel', 'attacked');
    pu.setVisible(false); dark.setVisible(false);
    for (const wf of wolves.slice(1)) { wf.setPose('idle'); wf.walkTo({ x: L.position.x + 0.8, z: L.position.z - 0.3 }, { speed: 6.5, direct: true }); }
    await sleep(0.9);
    await this.lzHit(1.4);
    g.state.set('lz_phone_dropped', true);
    await g.fader.to(true, 250);
    g.letterbox.set(false, 10);
    g.narrative.setChar('lizzie', 'captive');
    g.narrative.setChar('olivia', 'captive');
    g.narrative.setChar('vicky', 'captive');
    await sleep(0.8);
    if (!(await this.lines(g.dialogue.dialogues.l2_after))) return;
    await sleep(0.8);
  },

  // ------------------------------------------------------------------ L3 — ПЕЩЕРА

  async lizzieL3() {
    const g = this.g;
    const S = this.session;
    await this.lzCard(3);
    if (S !== this.session) return;
    await this.lzEnter('cave', 'L3', 'lizzie_3');
    const w = g.world, L = this.julian;
    L.placeAt(w.anchors.bedL.x + 0.6, -1.4, 1);
    L.lieDown(1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 1.6, -1.3, -1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 3.0, -1.6, -1);
    const guards = w.anchors.guards.map((p, i) => { const wf = this.lzCastIn(i ? 'wolfGrey' : 'wolf', `lz_guard${i}`, p.x, p.z, -1); wf.root.scale.setScalar(1.25); wf.setPose('eat'); return wf; });
    this.lzCast = { ol, vi, guards };
    this.setAmbience(['amb.oldwing']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1800);
    await L.riseUp(1.4);
    if (S !== this.session) return;
    if (!(await this.lines(g.dialogue.dialogues.l3_wake))) return;
    g.narrative.setChar('bob', 'hostile_neutral');
    // day: look around; talk to the girls when ready
    const day = () => ['lz_l3_food', 'lz_l3_store', 'lz_l3_guards'].filter((k) => g.state.get(k)).length >= 2;
    await new Promise((resolve) => {
      g.hud.show(true);
      g.player.enabled = true;
      g.state.set('objective', 'lz_cave');
      g.interactions.setItems([
        { id: 'l3_food', label: 'Еда', at: { x: 4.2, z: -1.6 }, radius: 0.9, anchor: w.anchors.food, run: this.lzSay('l3_food') },
        { id: 'l3_beds', label: 'Солома', at: { x: 0.8, z: -1.7 }, radius: 0.8, anchor: w.anchors.beds, run: this.lzSay('l3_beds') },
        { id: 'l3_store', label: 'Чужие вещи', at: { x: 8.2, z: -1.6 }, radius: 1.0, anchor: w.anchors.store, run: this.lzSay('l3_store') },
        { id: 'l3_bones', label: 'Кости', at: { x: 10.4, z: -1.6 }, radius: 0.8, anchor: w.anchors.bones, run: this.lzSay('l3_bones') },
        { id: 'l3_guards', label: 'Выход', at: { x: 16.6, z: -0.6 }, radius: 1.2, anchor: V(18.8, 1.6, -0.8), run: this.lzSay('l3_guards') },
        { id: 'l3_girls', label: 'Оливия и Викки', at: { x: 2.2, z: -1.0 }, radius: 1.0, anchor: V(2.3, 1.9, -1.4),
          run: async () => { if (!day()) { await g.view.flash('lthought', 'Сначала осмотреться. Понять, где мы.', 2200); return; } await g.dialogue.start('l3_girls'); resolve(); } },
      ]);
    });
    if (S !== this.session) return;
    // night
    g.interactions.setItems([]);
    g.player.enabled = false;
    await g.fader.to(true, 1200);
    await g.card.show('Ночь', { en: 'Night', ms: 1500 });
    w.lights.hemi.intensity = 0.3;
    w.nicheFire.base = 2.4;
    ol.lieDown(-1); vi.lieDown(1);
    for (const gd of guards) gd.setPose('idle');
    L.placeAt(1.0, -0.8, 1);
    const pu = this.lzCastIn('puriel', 'lz_puriel', w.anchors.puriel.x, w.anchors.puriel.z, -1);
    pu.lieDown(-1);
    this.lzCast.pu = pu;
    g.cameraSys.snap();
    await g.fader.to(false, 1200);
    if (!(await this.lines(g.dialogue.dialogues.l3_night))) return;
    await new Promise((resolve) => {
      g.player.enabled = true;
      g.interactions.setItems([
        { id: 'l3_alcove', label: 'Проход', at: { x: 12.8, z: -1.6 }, radius: 1.0, anchor: V(13.2, 1.4, -2.6), run: () => resolve() },
        { id: 'l3_guards2', label: 'Выход', at: { x: 16.6, z: -0.6 }, radius: 1.2, anchor: V(18.8, 1.6, -0.8), run: this.lzSay('l3_guards') },
      ]);
    });
    if (S !== this.session) return;
    // Puriel
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    g.letterbox.set(true, 900);
    g.cameraSys.setShot({ x: 12.2, y: 1.6, z: 3.4, lookX: 13.0, lookY: 0.6, lookZ: -2.2, fov: 38 }, 1.4);
    for (let i = 0; i < 3; i++) this.lzBlood(12.6 + i * 0.5, -2.0 + (i % 2) * 0.3, 1.0);
    if (!(await this.lines(g.dialogue.dialogues.l3_found))) return;
    g.narrative.setChar('puriel', 'dead');
    g.narrative.setChar('lizzie', 'grieving');
    g.audio.play('sfx.shouts', { volume: 0.9 });
    await this.lzHit(0.8);
    // Stinko Bob comes out of the tunnel
    const bob = this.lzCastIn('bob', 'lz_bob', 19.6, -0.4, -1);
    g.cameraSys.setShot({ x: 14.6, y: 1.7, z: 3.8, lookX: 14.6, lookY: 1.1, lookZ: -1.6, fov: 40 }, 1.6);
    await bob.walkTo({ x: 14.6, z: -1.0 }, { speed: 1.4, direct: true });
    if (S !== this.session) return;
    bob.setPose('idle');
    g.narrative.setChar('bob', 'conversational');
    if (!(await this.lines(g.dialogue.dialogues.l3_bob))) return;
    g.narrative.setChar('bob', 'lore_source');
    g.narrative.setWw('human_blood_consumed', g.narrative.ww('human_blood_consumed') + 1);
    g.state.set('lz_bob_rules', true);
    bob.face(1);
    bob.walkTo({ x: 19.8, z: -0.4 }, { speed: 1.2, direct: true }).then(() => bob.setVisible(false));
    // back to the others — and the first attempt
    await L.walkTo({ x: 2.6, z: -0.8 }, { speed: 1.5, direct: true });
    ol.stand(); vi.stand(); ol.placeAt(1.6, -1.3, 1); vi.placeAt(3.4, -1.5, -1);
    g.letterbox.set(false, 600);
    if (S !== this.session) return;
    await g.dialogue.start('l3_tell');
    if (S !== this.session) return;
    g.narrative.setChar('lizzie', 'desperate');
    g.narrative.setChar('olivia', 'frightened');
    this.lzFollow = [ol, vi];
    g.cameraSys.setShot(null, 1);
    await L.walkTo({ x: 16.4, z: -0.4 }, { speed: 1.2, direct: true });
    if (S !== this.session) return;
    g.letterbox.set(true, 600);
    for (const gd of guards) { gd.setPose('idle'); gd.faceTowards(L.position.x); }
    await guards[0].walkTo({ x: 17.4, z: -0.5 }, { speed: 2.4, direct: true });
    g.audio.play('inner.heartbeat', { volume: 0.8 });
    if (!(await this.lines(g.dialogue.dialogues.l3_fail))) return;
    this.lzFollow = null;
    await g.fader.to(true, 1400);
    g.letterbox.set(false, 10);
    g.narrative.setChar('olivia', 'captive');
    g.state.set('lz_first_escape_failed', true);
  },

  // ------------------------------------------------------------------ L4 — СТАЯ

  async lizzieL4() {
    const g = this.g;
    const S = this.session;
    await this.lzCard(4);
    if (S !== this.session) return;
    await this.lzEnter('cave', 'L4', 'lizzie_4');
    const w = g.world, L = this.julian;
    g.narrative.tickDays(19);
    g.narrative.setChar('lizzie', 'captive');
    L.placeAt(1.8, -0.6, -1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 0.6, -1.4, 1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 2.8, -1.5, -1);
    const seats = w.anchors.hallSeats;
    // spread through the hall: two by the fires, one lying at the wall, two closer to the niche
    const spots = [[-8.9, -1.9, 1], [-6.6, -0.3, -1], [-4.7, -2.3, 1], [-3.0, -0.9, -1], [-1.1, -1.9, -1]];
    const pack = ['packA', 'packB', 'packC', 'packD', 'packE'].map((k, i) => this.lzCastIn(k, `lz_${k}`, spots[i][0], spots[i][1], spots[i][2]));
    void seats;
    pack[2].setPose('eat');                         // the grey one gnaws the same bone for weeks
    pack[0].setPose('eat');
    const bob = this.lzCastIn('bob', 'lz_bob', -9.4, -0.6, 1);
    this.lzCast = { ol, vi, pack, bob };
    this.setAmbience(['amb.oldwing']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1600);
    if (!(await this.lines(g.dialogue.dialogues.l4_open))) return;
    g.narrative.setChar('pack', 'territorial_conflict');
    const talks = () => ['lz_l4_a', 'lz_l4_b', 'lz_l4_c', 'lz_l4_d', 'lz_l4_e', 'lz_l4_bob'].filter((k) => g.state.get(k)).length;
    await new Promise((resolve) => {
      const wrap = (id, ch) => async () => { ch?.faceTowards(L.position.x); await g.dialogue.start(id); if (talks() >= 4 && g.state.get('lz_l4_e')) resolve(); };
      g.hud.show(true);
      g.player.enabled = true;
      g.state.set('objective', 'lz_pack');
      const at = (c) => ({ x: c.position.x + 0.6, z: Math.max(-1.9, c.position.z + 0.3) });
      g.interactions.setItems([
        ...pack.map((c, i) => ({ id: `l4_${c.id}`, label: ['Хриплый', 'Молодой', 'Очкарик', 'Марта', 'Рыжая'][i], at: at(c), radius: 0.8, anchor: V(c.position.x, 2.0, c.position.z), run: wrap(`l4_pack${'ABCDE'[i]}`, c) })),
        { id: 'l4_bob', label: 'Боб', at: at(bob), radius: 0.8, anchor: V(bob.position.x, 2.0, bob.position.z), run: wrap('l4_bob', bob) },
        { id: 'l4_fire', label: 'Костёр', at: { x: -7.6, z: -1.2 }, radius: 0.8, anchor: V(-7.6, 1.2, -1.9), run: wrap('l4_fire') },
      ]);
    });
    if (S !== this.session) return;
    // evening: they come for Vicky
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    await L.walkTo({ x: 1.6, z: -0.5 }, { speed: 1.4, direct: true });
    g.letterbox.set(true, 900);
    g.cameraSys.setShot({ x: 0.4, y: 1.8, z: 4.4, lookX: 0.2, lookY: 1.1, lookZ: -1.4, fov: 40 }, 1.4);
    const [a, b] = [pack[0], pack[1]];
    a.setPose('idle'); b.setPose('idle');
    await Promise.all([a.walkTo({ x: 1.6, z: -1.7 }, { speed: 1.6, direct: true }), b.walkTo({ x: 4.4, z: -1.3 }, { speed: 1.6, direct: true })]);
    if (S !== this.session) return;
    const take = this.lines(g.dialogue.dialogues.l4_take);
    await sleep(2.4);
    g.narrative.setChar('vicky', 'taken');
    // teeth in her jacket: she is knocked down and dragged across the stone, like a carcass
    a.faceTowards(vi.position.x);
    await a.walkTo({ x: vi.position.x - 0.9, z: vi.position.z - 0.1 }, { speed: 2.6, direct: true });
    g.audio.play('sfx.thud', { volume: 0.7 });
    vi.lieDown(-1);
    a.face(-1);
    this.lzDrag = [{ who: vi, by: a, dx: 1.05, dz: 0.15 }];
    a.walkTo({ x: -10.0, z: -1.5 }, { speed: 1.3, direct: true });
    b.walkTo({ x: -8.9, z: -0.8 }, { speed: 1.3, direct: true });
    if (!(await take)) return;
    this.lzDrag = null;
    vi.setVisible(false); a.setVisible(false); b.setVisible(false);
    g.narrative.feed('human', 1);
    if (!(await this.lines(g.dialogue.dialogues.l4_end))) return;
    g.narrative.setChar('lizzie', 'desperate');
    await g.fader.to(true, 1400);
    g.letterbox.set(false, 10);
  },

  // ------------------------------------------------------------------ L5 — ПОБЕГ

  async lizzieL5() {
    const g = this.g;
    const S = this.session;
    const route = g.narrative.route || 'WEREWOLF';
    g.narrative.resetL5();
    await this.lzCard(5);
    if (S !== this.session) return;
    await this.lzEnter('cave', 'L5', 'lizzie_5');
    const w = g.world, L = this.julian;
    L.placeAt(1.0, -1.2, -1);
    L.lieDown(-1);
    // Olivia on the slab, four of them holding her
    const ol = this.lzCastIn('olivia', 'lz_olivia', w.anchors.slab.x - 0.5, w.anchors.slab.z - 0.1, 1);
    ol.root.position.y = 0.56;
    ol.lieDown(1);
    const holders = [['packA', -15.6, -1.1, 1], ['packD', -12.4, -1.2, -1], ['packE', -14.8, -0.2, 1], ['packB', -13.2, -2.1, -1]]
      .map(([k, x, z, f]) => { const wf = this.lzCastIn(k, `lz_${k}`, x, z, f); wf.setPose('idle'); return wf; });
    this.lzCast = { ol, holders };
    this.setAmbience(['amb.oldwing']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1600);
    await L.riseUp(1.2);
    if (!(await this.lines(g.dialogue.dialogues.l5_wake))) return;
    g.narrative.setChar('olivia', 'taken');
    g.narrative.setChar('lizzie', 'frightened');
    // follow the voice into the deep (the hall is empty tonight)
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'lz_follow');
    let heard = false;
    await new Promise((resolve) => {
      this.lzWatch = (dt) => {
        if (!heard && L.position.x < -1.2) { heard = true; this.lines(g.dialogue.dialogues.l5_voice, { blocking: false }); }
        if (L.position.x < w.anchors.peek.x + 0.4 && !g.dialogue.busy) { this.lzWatch = null; resolve(); }
      };
    });
    if (S !== this.session) return;
    // the observation position: the player cannot intervene
    g.player.enabled = false;
    g.hud.show(false);
    L.face(-1);
    g.letterbox.set(true, 1200);
    g.audio.music('none', 1);
    const chamber = { x: -11.4, y: 1.6, z: 3.6, lookX: -13.6, lookY: 0.8, lookZ: -1.2, fov: 40 };
    g.cameraSys.setShot(chamber, 1.8);
    await sleep(1.8);
    if (!(await this.lines(g.dialogue.dialogues.l5_watch))) return;
    g.narrative.setChar('olivia', 'dying');
    // the attack beats
    const beat = async (wf, k) => {
      const p = wf.position.clone();
      wf.setPose('eat');
      await wf.walkTo({ x: p.x + (w.anchors.slab.x - p.x) * 0.3, z: p.z + (w.anchors.slab.z - p.z) * 0.3 }, { speed: 4, direct: true });
      g.audio.play('sfx.tear', { volume: 0.7 }); g.audio.play('sfx.thud', { volume: 0.5 });
      this.lzBlood(w.anchors.slab.x + (Math.random() - 0.5) * 1.6, w.anchors.slab.z + (Math.random() - 0.5) * 0.8, 0.8 + k * 0.25, 0.56);
      this.lzBlood(p.x * 0.5 + w.anchors.slab.x * 0.5, 0.2 + (Math.random() - 0.5), 0.9, 0.016);
      ol.pivot.position.x = (Math.random() - 0.5) * 0.06;
      await this.lzHit(0.7);
      if (k === 1) g.pflash.show('assets/portraits/lizzy_2.webp', { ms: 1500, side: 'right' });
      await wf.walkTo({ x: p.x, z: p.z }, { speed: 2.5, direct: true });
    };
    const beatsText = this.lines(g.dialogue.dialogues.l5_beats);
    for (let k = 0; k < 4; k++) { if (S !== this.session) return; await beat(holders[k], k); await sleep(0.4); }
    if (!(await beatsText)) return;
    // she sees Lizzie
    ol.pivot.position.x = 0;
    g.cameraSys.setShot({ x: -10.4, y: 1.4, z: 2.0, lookX: -12.6, lookY: 0.9, lookZ: -1.0, fov: 34 }, 1.2);
    if (!(await this.lines(g.dialogue.dialogues.l5_run))) return;
    holders[1].setPose('idle');
    holders[1].faceTowards(L.position.x);
    if (!(await this.lines(g.dialogue.dialogues.l5_seen))) return;
    // the chase
    g.letterbox.set(false, 500);
    g.cameraSys.setShot(null, 0.8);
    g.audio.music('tense', 0.5);
    g.narrative.setChar('lizzie', 'escaping');
    await this.lzRunCave([holders[1], holders[3]]);
    if (S !== this.session) return;
    // her screams fade behind — outside
    g.narrative.setChar('olivia', 'dead');
    await this.lzRunForest(route);
  },

  /** Inside: run right to the exit; the two wolves come after. Caught → back to the chamber edge. */
  async lzRunCave(chasers) {
    const g = this.g;
    const S = this.session;
    const L = this.julian;
    const start = { x: -8.6, z: 0.2 };
    while (S === this.session) {
      for (const [i, c] of chasers.entries()) { c.setVisible(true); c.setPose('idle'); c.placeAt(-12.2 - i * 0.7, -0.6 + i * 0.5, 1); }
      L.placeAt(start.x, start.z, 1);
      g.hud.show(true);
      g.player.enabled = true;
      g.state.set('objective', 'lz_escape');
      const res = await this.lzChaseStep(chasers, (x) => x > 20.6);
      if (S !== this.session) return;
      if (res === 'escaped') return;
      await this.lzCaught();
    }
  },

  /** Outside: the forest at night, from the cave mouth to the west. */
  async lzRunForest(route) {
    const g = this.g;
    const S = this.session;
    await g.fader.to(true, 350);
    await this.lzEnter('forest', 'night', null);
    // chapter 12: the lines cross (a short card — the chase does not stop for long)
    await g.card.show('Пересечение', { num: 'Глава 12', en: 'The Crossing', sub: 'ДОЛИНА ТАКХИНИ · НОЧЬ', ms: 1100, style: 'chapter-b' });
    const w = g.world, L = this.julian;
    const chasers = ['wolfGrey', 'wolfWhite'].map((k, i) => { const c = this.lzCastIn(k, `lz_out${i}`, 42.2 + i * 0.4, -4.6, -1); c.root.scale.setScalar(1.5); c.setVisible(false); return c; });
    let julian = null;
    if (route === 'WEREWOLF') {
      julian = this.lzCastIn('julianL', 'lz_julian', 11.4, 0.2, 1);   // he went down to the river to wait for dawn
      julian.setVisible(false);
    }
    while (S === this.session) {
      L.placeAt(41.2, -1.8, -1);
      g.cameraSys.setShot(null, 1); g.cameraSys.snap();
      await g.fader.to(false, 350);
      if (!(await this.lines(g.dialogue.dialogues.l5_outside, { blocking: false }))) return;
      g.hud.show(true);
      g.player.enabled = true;
      setTimeout(() => chasers.forEach((c, i) => { c.setVisible(true); c.placeAt(42.2 + i * 0.4, -4.4 + i * 0.3, -1); }), 900);
      const goal = route === 'WEREWOLF' ? (x) => x < 13.4 : (x) => x < 17.0;
      const res = await this.lzChaseStep(chasers, goal);
      if (S !== this.session) return;
      if (res === 'escaped' || route === 'VAMPIRE') break;
      await this.lzCaught();
      chasers.forEach((c) => c.setVisible(false));
    }
    g.player.enabled = false;
    g.hud.show(false);
    if (route === 'WEREWOLF') await this.lzEndingSaved(julian, chasers);
    else await this.lzEndingDead(chasers);
  },

  /** A chase step: wolves keep a few metres behind and close in if she stops. */
  lzChaseStep(chasers, goal) {
    return new Promise((resolve) => {
      this.lzChaseS = { chasers, goal, resolve, t: 0 };
    });
  },

  async lzCaught() {
    const g = this.g;
    g.player.enabled = false;
    await this.lzHit(1.2);
    await g.fader.to(true, 500);
    await this.lines(g.dialogue.dialogues.l5_caught_retry);
  },

  async lzEndingSaved(julian, chasers) {
    const g = this.g;
    const S = this.session;
    const L = this.julian;
    julian.setVisible(true);
    julian.placeAt(L.position.x - 1.6, L.position.z + 0.3, 1);
    chasers.forEach((c) => c.stop());
    g.letterbox.set(true, 600);
    g.cameraSys.setShot({ x: L.position.x - 0.8, y: 1.6, z: 4.4, lookX: L.position.x - 0.8, lookY: 1.2, lookZ: -0.6, fov: 36 }, 0.6);
    if (!(await this.lines(g.dialogue.dialogues.l5_julian))) return;
    // he takes her up and runs — faster than a man can run
    julian.root.add(L.root);
    L.placeAt(0.1, 0.25, 1);
    L.root.position.y = 0.95;
    L.lieDown(1);
    julian.face(-1);
    g.audio.play('sfx.whoosh', { volume: 1 });
    g.renderer.setLayer('lzspeed', { blur: 1.2, exposure: 0.1 });
    g.cameraSys.setShot({ x: julian.position.x - 6, y: 1.8, z: 6, lookX: julian.position.x - 6, lookY: 1.1, lookZ: -0.6, fov: 40 }, 0.4);
    await julian.walkTo({ x: julian.position.x - 22, z: 0.4 }, { speed: 16, direct: true });
    g.renderer.clearLayer('lzspeed');
    if (S !== this.session) return;
    g.world.root.add(L.root);
    L.root.position.y = 0;
    await g.fader.to(true, 1200);
    g.letterbox.set(false, 10);
    if (!(await this.lines(g.dialogue.dialogues.l5_saved))) return;
    g.narrative.setFate('SAVED');
    g.state.set('lizzie_chapter_5_complete', true);
    await g.card.show('Продолжение следует', { en: 'To Be Continued', sub: 'ЛИЗЗИ — ЖИВА', ms: 3200 });
    this.lzFinish();
  },

  async lzEndingDead(chasers) {
    const g = this.g;
    const L = this.julian;
    g.letterbox.set(true, 400);
    chasers.forEach((c) => { c.walkTo({ x: L.position.x + 0.5, z: L.position.z }, { speed: 9, direct: true }); });
    await sleep(0.7);
    g.audio.play('sfx.shouts', { volume: 1 });
    await this.lzHit(1.6);
    await g.fader.to(true, 120);
    g.audio.stopAllLoops(0.1);
    await sleep(1.6);
    if (!(await this.lines(g.dialogue.dialogues.l5_dead))) return;
    g.narrative.setFate('DEAD');
    g.state.set('lizzie_chapter_5_complete', true);
    await g.card.show('Три дня спустя', { en: 'Three Days Later', ms: 1800 });
    g.audio.play('sfx.tv', { volume: 0.5 });
    if (!(await this.lines(g.dialogue.dialogues.l5_news))) return;
    g.letterbox.set(false, 10);
    await g.card.show('Продолжение следует', { en: 'To Be Continued', sub: 'ЛИЗЗИ — ПОГИБЛА', ms: 3200 });
    this.lzFinish();
  },

  lzFinish() {
    const g = this.g;
    g.hud.el.classList.remove('lizzie');
    g.state.set('demo_completed', true);
    g.state.setStage('ended');
    g.saves.clear('auto');
    g.keyScene = false;
    g.showEnding();
  },

  // ------------------------------------------------------------------ per frame + loading

  updateLizzie(dt) {
    const g = this.g;
    if (!g.state.stage?.startsWith('lizzie')) return;
    const L = this.julian;
    // companions keep up with her
    if (this.lzFollow) {
      this.lzFollow.forEach((f, i) => {
        if (!f.root.visible) return;
        const tx = L.position.x - L.facing * (1.0 + i * 0.85);
        const tz = Math.max(-2.1, Math.min(1.3, L.position.z + (i % 2 ? 0.45 : -0.35)));
        const d = Math.hypot(f.position.x - tx, f.position.z - tz);
        if (d > 1.5 && f.state !== 'walk') f.walkTo({ x: tx, z: tz }, { speed: d > 4 ? 2.6 : 1.7, direct: true }).then(() => f.faceTowards(L.position.x));
      });
    }
    this.lzWatch?.(dt);
    // a wolf drags someone by the clothes
    for (const d of this.lzDrag || []) { if (!d.who.root.visible) continue; d.who.root.position.x = d.by.position.x + d.dx; d.who.root.position.z = d.by.position.z + d.dz; }
    // the herd scatters (L2)
    if (this.lzScatter) { for (const d of this.lzScatter) { d.position.x -= dt * 3.2; d.scale.x = -1; if (d.position.x < -16) d.visible = false; } }
    // the chase
    const c = this.lzChaseS;
    if (c) {
      c.t += dt;
      if (c.goal(L.position.x)) { this.lzChaseS = null; c.resolve('escaped'); return; }
      for (const w of c.chasers) {
        if (!w.root.visible) continue;
        const d = Math.hypot(w.position.x - L.position.x, w.position.z - L.position.z);
        if (d < 0.75 && c.t > 1.2) { this.lzChaseS = null; c.chasers.forEach((x) => x.stop()); c.resolve('caught'); return; }
        const speed = d > 7 ? 4.2 : d > 3 ? 2.6 : 2.1;   // keep the pressure, never out-run a running girl
        w._chaseT = (w._chaseT || 0) - dt;
        if (w._chaseT <= 0 || w.state !== 'walk') { w._chaseT = 0.3; w.walkTo({ x: L.position.x, z: L.position.z }, { speed, direct: true }); }
      }
    }
  },

  async loadLizzie(stage) {
    const g = this.g;
    this.bump();
    await g.dialogue.abort();
    this.lzFollow = null; this.lzChaseS = null; this.lzWatch = null; this.lzScatter = null;
    const n = +stage.slice(-1);
    const S = this.session;
    if (!(await this.playLizzie(n))) return;
    if (S !== this.session) return;
    // continue Julian's line where the chapter was cut in
    const route = g.state.get('investigation_route');
    if (n === 1) await this.startStation();
    if (n === 2) await this.startNight();
    if (n === 3) await (route === 'WEREWOLF' ? this.startForest() : this.vampireChain());
    if (n === 4) {
      if (route === 'WEREWOLF') await this.startForestNight();
      else { g.fader.set(true); await g.card.show('Без отражения', { num: 'Глава 10', en: 'No Reflection', sub: 'РАССЛЕДОВАНИЕ ДЖУЛИАНА — В РАЗРАБОТКЕ', ms: 2600, style: 'chapter-b' }); await this.playLizzie(5); }
    }
  },

  lizzieCommands() {
    const g = this.g;
    const LABELS = { bones: 'кости', claws: 'борозды', sapling: 'берёзка', carcass: 'туши', ravens: 'вороны', tracks: 'следы' };
    return {
      lzPhoto: async (id) => { await g.lzui.photo(LABELS[id] || id); g.state.set(`lz_photo_${id}`, true); },
      lzMap: async () => { await g.lzui.map(); g.state.set('lz_map_done', true); },
      lzFilm: async () => {
        const stop = g.lzui.film();
        // the wolves drag their kills into the trees while she records
        (this.lzWolves || []).slice(1).forEach((wf, i) => { wf.setPose('idle'); wf.walkTo({ x: 12 + i, z: -4.2 }, { speed: 1.4, direct: true }); });
        await sleep(5.5);
        stop();
        g.state.set('lz_filmed', true);
      },
    };
  },
};

export function installLizzie(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}
