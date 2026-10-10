import * as THREE from 'three';
import { Character2D } from '../characters/Character2D.js';
import { CharacterState } from '../characters/CharacterState.js';
import { CHARACTERS, JULIAN_OUTFITS } from '../../data/characters.js';

const GOWN_STAGES = new Set(['hospital_day', 'hospital_evening', 'hospital_night', 'hospital_return', 'recovery']);
// script line under the time-skip cards
const CARD_EN = { 'День второй': 'Day Two', 'День третий': 'Day Three', 'День четвёртый': 'Day Four', 'День пятый': 'Day Five' };
// each stage has its own score (MusicEngine moods); some change again inside the stage
const STAGE_MUSIC = {
  car: 'car', station: 'station', interrogation: 'interrogation', medical: 'clinic',
  hospital_day: 'hospital_day', hospital_evening: 'hospital_evening', hospital_night: 'hospital_night',
  hospital_return: 'hospital_night', recovery: 'recovery', street: 'street',
  station_return: 'station', forest: 'street', forest_night: 'hospital_night',
  lizzie_1: 'recovery', lizzie_2: 'street', lizzie_3: 'hospital_night', lizzie_4: 'interrogation', lizzie_5: 'hospital_night',
  home_1: 'hospital_night', home_2: 'recovery',
};
import { glow } from '../world/props.js';
import { sleep } from './Director.js';

/**
 * Extended demo: arrest → police car → station → interrogation → medical
 * exam → hospital (day, evening, night) → first blood → recovery → discharge.
 *
 * Installed onto BarStory (installCustody) like the morning sequence, so all
 * scenes share one cast, director, dialogue system and save system. Every
 * stage has a start function that can also be used to resume a save.
 */

export const CUSTODY_STAGES = ['car', 'station', 'interrogation', 'medical', 'hospital_day', 'hospital_evening', 'hospital_night', 'hospital_return', 'recovery', 'street'];

const AMBIENCES = ['amb.oldwing', 'amb.crowd', 'amb.vent', 'amb.wind', 'amb.room', 'amb.morning', 'inner.breath', 'amb.siren', 'inner.drone', 'inner.ring',
  'amb.car', 'amb.station', 'amb.interrogation', 'amb.hospital_day', 'amb.hospital_night', 'sfx.flatline'];

const methods = {
  // ------------------------------------------------------------------ helpers

  /** A cast member living in a given location (created once). */
  castIn(world, key, id = key) {
    this.custodyCast = this.custodyCast || new Map();
    let ch = this.custodyCast.get(id);
    if (!ch) {
      ch = new Character2D(this.g.atlas, { ...CHARACTERS[key], id });
      this.custodyCast.set(id, ch);
      this.chars.set(id, ch);
    }
    world.root.add(ch.root);
    ch.setLife(CharacterState.ALIVE);
    ch.setVisible(true);
    ch.stand();
    ch.state = 'idle';
    ch.fall = 0;
    ch.root.position.y = 0;
    ch.pivot.rotation.z = 0;
    ch.setPose('idle');
    return ch;
  },

  /** Plays scripted [speaker, text, pose?] lines as cinematic subtitles. */
  async lines(list, { blocking = true } = {}) {
    const S = this.session;
    const g = this.g;
    for (const [who, text, pose] of list) {
      if (S !== this.session) return false;
      if (who === 'card') { await g.card.show(text, { en: CARD_EN[text], ms: 1800 }); continue; }
      const ch = this.chars.get(who) || this.custodyCast?.get(who);
      if (pose && ch) ch.setPose(pose);
      g.dialogue.history.push({ speaker: who, text });
      await g.view.flash(who, text, 1700 + text.length * 42, { top: !blocking });
    }
    return S === this.session;
  },

  setAmbience(keys = []) {
    const a = this.g.audio;
    if (!a.ready) return;
    for (const k of AMBIENCES) if (!keys.includes(k)) a.loops.get(k)?.stop(1.2);
    a.setMuffle(0, 0.5);
    for (const k of keys) a.loop(k, { fade: 2 });
  },

  /** Resets Julian to a neutral living state in the current location. */
  resetJulian() {
    const J = this.julian;
    J.setLife(CharacterState.ALIVE);
    J.setVisible(true);
    J.stand();
    J.state = 'idle';
    J.fall = 0;
    J.dizzy = 0;
    J.root.position.y = 0;
    J.pivot.rotation.z = 0;
    J.setPose('idle');
    J.path = null;
    const g = this.g;
    g.player.setGaze(null);
    g.player.impair = 0;
    g.hallucination.reset();
    for (const k of ['morning', 'hangover', 'kayden', 'police', 'wake', 'thirst', 'blood', 'flash', 'interro', 'dying', 'wakeflash']) g.renderer.clearLayer(k);
    g.letterbox?.set(false, 10); g.cameraSys.roll = 0;
    g.cameraSys.sway = 0;
    g.cameraSys.setShot(null, 1);
  },

  async enter(location, state, stage) {
    const g = this.g;
    this.stopAmbient();
    g.interactions.setItems([]);
    await g.setLocation(location, { state });
    g.world.followTarget = () => this.julian;
    // a new place starts on its own framing, not halfway out of the previous shot
    g.cameraSys.setShot(null, 1);
    g.cameraSys.snap();
    this.resetJulian();
    if (stage) g.state.setStage(stage);
    const st = stage || g.state.stage || '';
    this.setOutfit(st.startsWith('lizzie') ? 'lizzy' : GOWN_STAGES.has(st) ? 'gown' : 'coat');
    if (STAGE_MUSIC[stage]) g.audio.music(STAGE_MUSIC[stage], 2.5);
  },

  /**
   * The water comes straight back out: a spray of droplets from his mouth that arcs down onto the
   * floor and the seat in front, and a dark wet patch that stays a while.
   */
  spitSpray() {
    const g = this.g, J = this.julian;
    const root = g.world.root;
    const head = J.root.getWorldPosition(new THREE.Vector3());
    root.worldToLocal(head);
    head.y += (J.frameH || 1.3) * (J.seated ? 0.86 : 0.9);
    head.x += J.facing * 0.12;
    head.z += 0.04;
    const n = 34;
    const geo = new THREE.SphereGeometry(0.009, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.85, depthWrite: false });
    const drops = new THREE.InstancedMesh(geo, mat, n);
    drops.frustumCulled = false;
    root.add(drops);
    const P = [], V = [];
    for (let i = 0; i < n; i++) {
      P.push(head.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02)));
      const sp = 1.2 + Math.random() * 1.6;
      const a = (Math.random() - 0.5) * 0.7;
      V.push(new THREE.Vector3(J.facing * sp * Math.cos(a), 0.4 + Math.random() * 0.9, sp * Math.sin(a) * 0.6));
    }
    const floorY = Math.max(0, J.root.position.y + 0.02);
    const m = new THREE.Matrix4();
    let t = 0, last = performance.now();
    const step = () => {
      const now = performance.now(); const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      for (let i = 0; i < n; i++) {
        if (P[i].y > floorY) { V[i].y -= 9.8 * dt; P[i].addScaledVector(V[i], dt); }
        const s = P[i].y <= floorY ? 0.6 : 1;
        m.makeScale(s, s, s).setPosition(P[i]);
        drops.setMatrixAt(i, m);
      }
      drops.instanceMatrix.needsUpdate = true;
      mat.opacity = Math.max(0, 0.85 - Math.max(0, t - 0.7) * 1.4);
      if (t < 1.4) requestAnimationFrame(step); else { drops.removeFromParent(); geo.dispose(); mat.dispose(); }
    };
    requestAnimationFrame(step);
    // the wet patch on the floor in front of him
    const wet = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ color: 0x0a0c10, transparent: true, opacity: 0, depthWrite: false }));
    wet.rotation.x = -Math.PI / 2; wet.scale.set(1.6, 0.8, 1);
    wet.position.set(head.x + J.facing * 0.55, floorY + 0.005, head.z);
    root.add(wet);
    setTimeout(() => { wet.material.opacity = 0.35; }, 450);
    setTimeout(() => wet.removeFromParent(), 40000);
  },

  /** Coat or hospital gown: sprites, lying frame and the VN portrait. */
  setOutfit(name) {
    const o = JULIAN_OUTFITS[name];
    const J = this.julian;
    J.poses = { ...o.poses };
    J.setLieFrame(o.lie);
    CHARACTERS.julian.portrait = o.portrait;
    J.currentFrame = null;
    this.outfit = name;
  },

  lieInBed(spot, dir = -1) {
    const J = this.julian;
    J.stand();
    // the sprite lies in the screen plane, so put it on the near edge of the
    // mattress — otherwise the bed itself hides him
    J.placeAt(spot.x + 0.95, spot.z + 0.5, 1);
    J.lieDown(dir);
    J.root.position.y = 0.62;
    J.shadow.visible = false;
  },

  gazeReticle(world) {
    if (!this.reticle) {
      this.reticle = glow(0xffe0b0, 0.13, 0.55); // a soft point of attention, not an orb
      this.reticle.renderOrder = 20;
    }
    world.root.add(this.reticle);
    this.reticle.visible = true;
    return this.reticle;
  },

  /** Director commands used by custody dialogue nodes (`cmd: '…'`). */
  custodyCommands() {
    const g = this.g;
    return {
      bottle: () => { g.world.bottle && (g.world.bottle.visible = true); g.audio.play('sfx.paper', { volume: 0.4 }); },
      spitWater: async () => {
        const w = g.world;
        this.julian.setPose('think');
        g.audio.play('sfx.gulp');
        await sleep(1.0);
        g.audio.play('sfx.spit');
        g.cameraSys.shake = 0.5;
        this.spitSpray();
        if (w.bottle) w.bottle.visible = false;
        this.julian.setPose('idle');
        await sleep(0.6);
      },
      observed: () => {
        g.world.setObserved?.(true);
        setTimeout(() => g.world.setObserved?.(false), 5000);
      },
      waterCup: async () => {
        const w = g.world;
        if (w.cup) w.cup.visible = true;
        g.audio.play('sfx.water');
        await sleep(0.8);
        this.julian.setPose('think');
        g.audio.play('sfx.gulp');
        await sleep(1.4);
        this.julian.setPose('idle');
      },
      medOpen: () => {
        g.world.setMedOpen?.(true);
        g.audio.play('sfx.cell', { volume: 0.5 });
        this.stationCast?.nurse?.setVisible(true);
      },
      reattach: () => {
        const w = g.world;
        g.audio.play('sfx.cuffs', { volume: 0.3 });
        // the leads go back on — and read nothing: he has no pulse to give them
        if (w.wardA) { w.wardA.iv.userData.tube.visible = true; Object.assign(w.wardA.mon, { flat: false, fault: true, bpm: 0 }); }
        g.audio.loops.get('sfx.flatline')?.stop(0.3);
      },
      monitorOff: () => {
        const w = g.world;
        g.audio.play('sfx.cuffs', { volume: 0.2 });
        if (w.wardA) Object.assign(w.wardA.mon, { fault: false, flat: false, off: true, bpm: 0 });
      },
      drinkWater: async () => {
        g.audio.play('sfx.water');
        this.julian.setPose('think');
        await sleep(0.6);
        g.audio.play('sfx.gulp');
        await sleep(1.6);
        this.julian.setPose('idle');
      },
    };
  },

  // ------------------------------------------------------------------ safe zones per location

  registerSafeZones(world) {
    const zones = world.safeZones;
    if (!zones || zones.storyRegistered) return;
    zones.storyRegistered = true;
    const g = this.g;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const jpos = new THREE.Vector3();
    zones.addZone({ id: 'julian (key scene)', radius: 0.5, maxOcclusion: 0.34, priority: 3,
      get: () => jpos.copy(this.julian.root.getWorldPosition(jpos)).add(V(0, 0.9, 0)),
      active: () => g.mode === 'play' && (g.keyScene || !g.player.enabled) && this.julian.root.parent === world.root });
    // free walk in the long hospital: a column or door post may cross Julian, but never hide him
    if (['hospital', 'forest', 'school'].includes(world.id) || world.id?.startsWith('cave')) {
      const walking = () => g.mode === 'play' && g.player.enabled && !g.keyScene && this.julian.root.parent === world.root;
      const jp2 = new THREE.Vector3();
      zones.addZone({ id: 'julian (walk)', radius: 0.42, maxOcclusion: 0.3, priority: 1, active: walking,
        get: () => jpos.copy(this.julian.root.getWorldPosition(jpos)).add(V(0, 1.05, 0)) });
      zones.addZone({ id: 'julian legs (walk)', radius: 0.3, maxOcclusion: 0.4, priority: 1, active: walking,
        get: () => jp2.copy(this.julian.root.getWorldPosition(jp2)).add(V(0, 0.4, 0)) });
    }
    zones.addZone({ id: 'focused interactable', radius: 0.32, maxOcclusion: 0.12, priority: 2,
      get: () => g.interactions.focused?.anchor || null, active: () => !!g.interactions.focused && g.world === world });
    const st = () => g.state.stage;
    const add = (id, pos, radius, active, priority = 2, maxOcclusion = 0.2) => zones.addZone({ id, pos, radius, active, priority, maxOcclusion });
    switch (world.id || 'bar') {
      case 'bar':
        add('collapse spot', V(-4.6, 0.9, 0.6), 0.9, () => st() === 'escape', 3);
        add('main table', V(1.6, 1.0, 0.3), 0.8, () => st() === 'talk1' || st() === 'talk2');
        add('kayden body', V(-0.2, 0.4, 1.15), 0.7, () => st() === 'morning', 3);
        add('bartender spot', V(2.2, 1.3, -4.05), 0.6, () => st() === 'morning');
        add('police entry', V(-11.4, 1.0, -1.0), 0.8, () => st() === 'police');
        add('owen table', V(12.2, 1.0, -1.6), 0.6, () => st() === 'talk1');
        break;
      case 'station':
        add('holding cell', V(6.1, 1.2, -4.6), 0.9, () => st() === 'station');
        add('survivors', V(-5.0, 1.0, -3.0), 1.2, () => st() === 'station');
        add('med post', V(9.8, 1.2, -5.0), 0.6, () => st() === 'station');
        break;
      case 'interrogation':
        add('interrogation table', V(0.5, 1.0, -1.0), 0.8, () => true, 3);
        break;
      case 'hospital':
        add('patient + blood bag', V(world.wardB.bedSpot.x, 1.1, world.wardB.bedSpot.z), 0.9, () => st() === 'hospital_night', 3);
        add('julian bed', V(world.wardA.bedSpot.x, 0.9, world.wardA.bedSpot.z), 0.9, () => true);
        add('doctors', V(3.6, 1.2, -2.2), 0.8, () => st() === 'hospital_day');
        break;
      default:
    }
  },

  // ------------------------------------------------------------------ POLICE CAR

  async startCar() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('car', null, 'car');
    const w = g.world;
    const J = this.julian;
    J.sit({ x: w.anchors.julianSeat.x, z: w.anchors.julianSeat.z }, 1);
    J.root.position.y = w.anchors.julianSeat.y;
    J.setPose('think');
    const driver = this.castIn(w, 'driver');
    driver.sit({ x: w.anchors.driverSeat.x, z: w.anchors.driverSeat.z }, 1);
    driver.root.position.y = w.anchors.driverSeat.y;
    this.driver = driver;
    w.vnHide = [driver.root]; // the painted VN backdrop shows the cabin, she is on the portrait
    w.bottle.visible = false;
    this.setAmbience(['amb.car']);
    g.player.setGaze({ x: w.anchors.cuffs.x, z: -0.3, minX: w.gazeRange.minX, maxX: w.gazeRange.maxX, y: 1.0 });
    this.gazeReticle(w);
    g.hud.show(false);
    g.player.enabled = false;
    await g.card.show('Полицейская машина', { en: 'The Ride', sub: 'УТРО · WHITEHORSE, YUKON', ms: 2200 });
    if (S !== this.session) return;
    await g.fader.to(false, 1800);
    await g.dialogue.start('car_intro');
    if (S !== this.session) return;
    g.hud.show(true);
    g.player.enabled = true;
    this.carT = 0;
    g.interactions.setItems(this.carInteractables(w));
  },

  carInteractables(w) {
    const say = (id) => () => g.dialogue.start(id);
    const g = this.g;
    const at = (a) => ({ x: a.x, z: -0.3 }); // gaze positions along the cabin
    const A = w.anchors;
    return [
      { id: 'car_window', label: 'Окно', at: { x: -0.98, z: -0.3 }, radius: 0.18, anchor: A.window, run: say('car_window') },
      { id: 'car_cuffs', label: 'Наручники', at: { x: -0.62, z: -0.3 }, radius: 0.16, anchor: A.cuffs, run: say('car_cuffs') },
      { id: 'car_cage', label: 'Решётка', at: at(A.cage), radius: 0.14, anchor: A.cage, run: say('car_cage') },
      { id: 'car_driver', label: 'Куинн', at: { x: 0.08, z: -0.3 }, radius: 0.2, anchor: A.driverHead, run: () => this.carTalk() },
      { id: 'car_radio', label: 'Рация', at: { x: 0.7, z: -0.3 }, radius: 0.22, anchor: A.radio, run: say('car_radio') },
    ];
  },

  async carTalk() {
    const g = this.g;
    const S = this.session;
    if (this.carTalking) return;
    this.carTalking = true;
    g.interactions.setItems([]);
    g.player.enabled = false;
    if (this.reticle) this.reticle.visible = false;
    g.keyScene = true;
    await g.dialogue.start('car_talk');
    if (S !== this.session) return;
    g.keyScene = false;
    await sleep(1.2);
    await g.fader.to(true, 1600);
    this.carTalking = false;
    if (S !== this.session) return;
    if (!g.state.get('lizzie_chapter_1_complete') && !(await this.playLizzie(1))) return;
    await this.startStation();
  },

  // ------------------------------------------------------------------ POLICE STATION

  async startStation() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('station', null, 'station');
    const w = g.world;
    w.lockedIn = true;
    w.setCellOpen(false);
    const J = this.julian;
    J.sit({ x: w.anchors.cellBench.x, z: w.anchors.cellBench.z }, 1);
    J.setPose('think');
    this.setAmbience(['amb.station']);
    // survivors in the waiting area, sergeant at the desk
    const sg = this.castIn(w, 'sergeant');
    sg.placeAt(w.anchors.deskOfficer.x, w.anchors.deskOfficer.z, 1);
    sg.shadow.visible = false;
    const noah = this.castIn(w, 'survivorWaiter');
    noah.sit({ x: w.anchors.benchB.x, z: w.anchors.benchB.z }, 1);
    noah.setPose('hands');
    const leo = this.castIn(w, 'barman'); // Ray — the bartender found under the counter
    leo.placeAt(-2.0, -2.7, -1);
    const chef = this.castIn(w, 'chef');
    chef.placeAt(-7.9, -2.75, 1);
    const tommy = this.castIn(w, 'dishwasher');
    tommy.placeAt(-3.5, -2.8, -1);
    const nurse = this.castIn(w, 'medic');
    nurse.placeAt(10.1, -5.4, -1);
    nurse.shadow.visible = false;
    // the med post is shut until he is called for the blood test
    w.setMedOpen?.(!!g.state.get('survivors_questioned'));
    nurse.setVisible(!!g.state.get('survivors_questioned'));
    this.stationCast = { sg, noah, leo, chef, tommy, nurse };
    g.cameraSys.snap();
    await g.card.show('Подозреваемый', { num: 'Глава 3', en: 'The Suspect', sub: 'УЧАСТОК RCMP · WHITEHORSE', ms: 2200, style: 'chapter-b' });
    if (S !== this.session) return;
    await g.fader.to(false, 1500);
    g.hud.show(true);
    await g.dialogue.start('st_cell');
    if (S !== this.session) return;
    await sleep(2.5);
    if (S !== this.session) return;
    // the sergeant comes to let him out
    await sg.walkTo([{ x: -8.0, z: -2.0 }, { x: 6.1, z: -2.6 }], { speed: 1.5 });
    if (S !== this.session) return;
    sg.face(1);
    J.stand();
    J.placeAt(6.1, -4.7, 1);
    J.setPose('idle');
    g.audio.play('sfx.cell');
    w.setCellOpen(true);
    await g.dialogue.start('st_release');
    if (S !== this.session) return;
    w.lockedIn = false;
    sg.walkTo([{ x: 0, z: -2.0 }, { x: w.anchors.deskOfficer.x, z: w.anchors.deskOfficer.z }], { speed: 1.4 }).then(() => sg.face(1));
    g.player.enabled = true;
    this.stationT = 0;
    g.interactions.setItems(this.stationInteractables(w));
    g.saves.autosave('station');
  },

  stationInteractables(w) {
    const g = this.g;
    const say = (id) => () => g.dialogue.start(id).then(() => this.checkCalled());
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    const c = this.stationCast;
    const talk = (id, ch) => async () => { ch.setPose(ch.poses.talk ? 'talk' : 'idle'); await g.dialogue.start(id); ch.setPose(ch === c.noah ? 'hands' : 'idle'); this.checkCalled(); };
    return [
      { id: 'st_noah', label: 'Ноа, официант', at: { x: -5.6, z: -2.4 }, radius: 0.9, anchor: A(-5.7, 1.7, -3.2), run: talk('st_noah', c.noah) },
      { id: 'st_leo', label: 'Рэй, бармен', at: { x: -2.1, z: -2.2 }, radius: 0.8, anchor: A(-2.0, 2.1, -2.7), run: talk('st_leo', c.leo) },
      { id: 'st_chef', label: 'Шеф Ларош', at: { x: -7.8, z: -2.2 }, radius: 0.8, anchor: A(-7.9, 2.1, -2.75), run: talk('st_chef', c.chef) },
      { id: 'st_tommy', label: 'Томми, посудомойщик', at: { x: -3.6, z: -2.2 }, radius: 0.7, anchor: A(-3.5, 2.0, -2.8), run: talk('st_tommy', c.tommy) },
      { id: 'st_board', label: 'Доска объявлений', at: { x: -4.4, z: -2.4 }, radius: 0.5, anchor: w.anchors.board, run: say('st_board') },
      { id: 'st_vending', label: 'Автомат с водой', at: { x: -1.2, z: -2.4 }, radius: 0.6, anchor: w.anchors.vending, run: say('st_vending') },
      { id: 'st_offices', label: 'Кабинеты', at: { x: 2.2, z: -2.4 }, radius: 1.0, anchor: w.anchors.offices, run: say('st_offices') },
      { id: 'st_desk', label: 'Сержант Пелли', at: { x: -9.5, z: -1.9 }, radius: 1.0, anchor: w.anchors.desk, run: say('st_desk') },
      { id: 'st_entrance', label: 'Выход', at: { x: -12.0, z: -2.2 }, radius: 0.9, anchor: w.anchors.entrance, run: say('st_entrance') },
      { id: 'st_medpost', label: 'Медпункт', at: { x: 9.8, z: -2.4 }, radius: 0.8, anchor: w.anchors.medpost, run: () => (g.state.get('survivors_questioned') && !g.state.get('blood_test') ? this.bloodTest() : g.dialogue.start('st_medpost_wait')) },
      { id: 'st_interrogation', label: 'Допросная №2', at: { x: 12.2, z: -2.4 }, radius: 0.8, anchor: w.anchors.interrogationDoor, run: () => (g.state.get('blood_test') ? this.startInterrogation() : g.dialogue.start('st_door_wait')) },
    ];
  },

  checkCalled() {
    const f = this.g.state.flags;
    if (this.calledStarted || f.survivors_questioned) return;
    const talked = ['talked_noah', 'talked_leo', 'talked_chef', 'talked_tommy'].filter((k) => f[k]).length;
    if (talked >= 3 || (talked >= 2 && this.stationT > 70)) {
      this.calledStarted = true;
      setTimeout(() => this.g.dialogue.start('st_called'), 1200);
    }
  },

  async bloodTest() {
    const g = this.g;
    const S = this.session;
    const w = g.world;
    g.player.enabled = false;
    g.keyScene = true;
    const J = this.julian;
    await J.walkTo([{ x: 9.8, z: -2.5 }, { x: w.anchors.medChair.x, z: w.anchors.medChair.z + 0.1 }], { speed: 1.2 });
    if (S !== this.session) return;
    J.sit({ x: w.anchors.medChair.x, z: w.anchors.medChair.z }, 1);
    g.cameraSys.setShot({ x: 9.8, y: 1.6, z: -0.8, lookX: 9.8, lookY: 1.0, lookZ: -5.4, fov: 40 }, 1.0);
    await g.dialogue.start('st_blood');
    if (S !== this.session) return;
    J.stand();
    J.placeAt(9.8, -2.6, 1);
    g.cameraSys.setShot(null, 0.8);
    g.keyScene = false;
    g.player.enabled = true;
  },

  // ------------------------------------------------------------------ INTERROGATION

  async startInterrogation() {
    const g = this.g;
    const S = this.session;
    await g.fader.to(true, 900);
    await this.enter('interrogation', null, 'interrogation');
    const w = g.world;
    const J = this.julian;
    J.placeAt(-2.6, -2.0, 1);
    const dawson = this.castIn(w, 'interrogator');
    dawson.sit({ x: w.anchors.officerSeat.x, z: w.anchors.officerSeat.z }, -1);
    dawson.setPose('sit');
    this.dawson = dawson;
    w.vnHide = [dawson.root];
    // the watchers behind the one-way mirror
    const obs = w.anchors.observers.map((p, i) => {
      const o = this.castIn(w, i ? 'sergeant' : 'investigator', `observer${i}`);
      o.placeAt(p.x, p.z, 1);
      o.setPose(i ? 'idle' : 'front');
      return o;
    });
    this.observers = obs;
    w.setObserved(false);
    w.cup.visible = false;
    this.setAmbience(['amb.interrogation']);
    g.cameraSys.snap();
    await g.fader.to(false, 1200);
    if (S !== this.session) return;
    J.walkTo({ x: -2.0, z: -1.6 }, { speed: 1.2 });
    await g.dialogue.start('ir_enter');
    if (S !== this.session) return;
    g.player.enabled = true;
    g.hud.show(true);
    const say = (id) => () => g.dialogue.start(id);
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    g.interactions.setItems([
      { id: 'ir_mirror', label: 'Зеркало', at: { x: 0.4, z: -2.2 }, radius: 1.2, anchor: w.anchors.mirror, run: say('ir_mirror') },
      { id: 'ir_camera', label: 'Камера', at: { x: 2.8, z: -2.0 }, radius: 0.7, anchor: w.anchors.camera, run: say('ir_camera') },
      { id: 'ir_clock', label: 'Часы', at: { x: 2.6, z: -2.2 }, radius: 0.5, anchor: w.anchors.clock, run: say('ir_clock') },
      { id: 'ir_door', label: 'Дверь', at: { x: -2.7, z: -2.2 }, radius: 0.6, anchor: w.anchors.door, run: say('ir_door') },
      { id: 'ir_jug', label: 'Графин', at: { x: -2.4, z: 0.9 }, radius: 0.8, anchor: w.anchors.jug, run: say('ir_jug') },
      { id: 'ir_sit', label: 'Сесть за стол', at: { x: -0.8, z: -0.6 }, radius: 0.8, anchor: w.anchors.julianChair, run: () => this.interrogation() },
    ]);
  },

  async interrogation() {
    const g = this.g;
    const S = this.session;
    const w = g.world;
    const J = this.julian;
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.keyScene = true;
    g.hud.show(false);
    await J.walkTo({ x: w.anchors.julianSeat.x - 0.1, z: -0.6 }, { speed: 1.0 });
    if (S !== this.session) return;
    g.audio.play('sfx.chair');
    J.sit({ x: w.anchors.julianSeat.x, z: w.anchors.julianSeat.z }, 1);
    g.cameraSys.setShot({ x: 0.5, y: 1.55, z: 3.6, lookX: 0.5, lookY: 1.0, lookZ: -1.2, fov: 34 }, 0.7);
    await sleep(0.8);
    await g.dialogue.start('ir_talk');
    if (S !== this.session) return;
    // he tries to stand: the room tilts, they catch him
    g.hallucination.setPhase(4);
    J.stand();
    J.placeAt(w.anchors.julianSeat.x - 0.2, -0.5, 1);
    J.dizzy = 1;
    g.audio.play('sfx.chair');
    await sleep(1.4);
    if (S !== this.session) return;
    await g.view.flash('interrogator', 'Рид? Рид!', 1200);
    this.dawson.stand();
    this.dawson.setPose('idle');
    this.dawson.placeAt(w.anchors.officerSeat.x, -0.4, -1);
    await this.dawson.walkTo({ x: J.position.x + 0.55, z: J.position.z }, { speed: 2.4 });
    g.cameraSys.shake = 0.8;
    J.dizzy = 2;
    await g.view.flash('interrogator', 'Врача! Быстро, врача сюда!', 1800);
    if (S !== this.session) return;
    await g.fader.to(true, 1400);
    g.hallucination.reset();
    await this.startMedical();
  },

  // ------------------------------------------------------------------ MEDICAL EXAM

  async startMedical() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('hospital', 'day', 'medical');
    const w = g.world;
    const J = this.julian;
    J.sit({ x: w.anchors.examSpot.x - 0.3, z: w.anchors.examSpot.z - 0.2 }, 1);
    J.root.position.y = 0.45;
    const doc = this.castIn(w, 'doctor');
    doc.placeAt(-3.75, -5.3, -1);
    const psy = this.castIn(w, 'doctor2');
    psy.placeAt(-5.2, -4.8, 1);
    this.setAmbience(['amb.hospital_day']);
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    g.cameraSys.setShot({ x: -4.5, y: 1.55, z: -1.2, lookX: -4.5, lookY: 1.1, lookZ: -6.2, fov: 40 }, 1);
    g.cameraSys.snap();
    await g.card.show('Городская больница', { en: 'Whitehorse General', sub: 'ОБСЛЕДОВАНИЕ', ms: 2200 });
    if (S !== this.session) return;
    g.renderer.setLayer('wake', { blur: 0.5, vignette: 0.3 });
    await g.fader.to(false, 1400);
    // penlight flashes
    for (let i = 0; i < 3; i++) {
      g.renderer.setLayer('flash', { exposure: 0.9, bloom: 0.6 });
      await sleep(0.18);
      g.renderer.clearLayer('flash');
      await sleep(0.35);
    }
    if (!(await this.lines(g.dialogue.dialogues.med_lines))) return;
    g.renderer.clearLayer('wake');
    g.state.set('diagnosis', 'dissociatives');
    g.keyScene = false;
    await g.fader.to(true, 1400);
    if (S !== this.session) return;
    doc.setVisible(false);
    psy.setVisible(false);
    await this.startHospitalDay();
  },

  // ------------------------------------------------------------------ HOSPITAL — DAY

  async startHospitalDay() {
    const g = this.g;
    const S = this.session;
    this.eveningStarted = false;
    g.fader.set(true);
    await this.enter('hospital', 'day', 'hospital_day');
    const w = g.world;
    const J = this.julian;
    this.lieInBed(w.wardA.bedSpot);
    Object.assign(w.wardA.mon, { bpm: 54, flat: false, fault: false, off: false });
    w.wardA.iv.userData.bag.visible = true;
    w.wardB.iv.userData.bag.visible = true;
    w.wardB.iv.userData.tube.visible = true;
    w.openWardB(false);
    const patient = this.castIn(w, 'patient');
    this.lieInBed.call({ julian: patient }, w.wardB.bedSpot);
    patient.setVisible(true);
    // doctors at the nurse station (to be overheard), a nurse walking the floor
    const doc = this.castIn(w, 'doctor');
    doc.placeAt(3.3, -2.25, 1);
    const psy = this.castIn(w, 'doctor2');
    psy.placeAt(4.4, -2.25, -1);
    const nurse = this.castIn(w, 'nurse');
    nurse.placeAt(-10, -1.5, 1);
    // a second nurse behind the station counter, busy with charts
    const nurse2 = this.castIn(w, 'nurse2');
    nurse2.placeAt(6.2, -3.55, -1);
    // the rest of the floor goes on with its day: an orderly walks the long
    // corridor into the old wing, a visitor waits by the window in the nook
    const orderly = this.castIn(w, 'medic', 'orderly');
    orderly.placeAt(44, -1.2, -1);
    const visitor = this.castIn(w, 'patronA', 'visitor');
    visitor.placeAt(32.25, -2.95, 1);
    this.hospCast = { doc, psy, nurse, nurse2, patient, orderly, visitor };
    this.setAmbience(['amb.hospital_day']);
    w.onBeat = (m) => { if (m === w.wardA.mon && Math.abs(J.position.x - m.halo.getWorldPosition(new THREE.Vector3()).x) < 6) g.audio.play('sfx.beep', { volume: 0.35 }); };
    g.cameraSys.setShot({ x: 18.6, y: 1.7, z: 1.4, lookX: 18.6, lookY: 0.9, lookZ: -6.0, fov: 42 }, 1);
    g.cameraSys.snap();
    await g.card.show('Палата 109', { en: 'Noon', sub: 'ПОЛДЕНЬ', ms: 2000 });
    if (S !== this.session) return;
    await g.fader.to(false, 1600);
    await g.dialogue.start('h_wake');
    if (S !== this.session) return;
    await J.riseUp(2.2);
    J.root.position.y = 0;
    J.placeAt(w.wardA.inside.x, w.wardA.inside.z, -1);
    J.shadow.visible = true;
    g.cameraSys.setShot(null, 0.6);
    g.hud.show(true);
    g.player.enabled = true;
    this.hospT = 0;
    // the nurse makes rounds
    this.nurseRounds();
    this.orderlyRounds();
    g.interactions.setItems(this.hospitalDayInteractables(w));
  },

  async nurseRounds() {
    const S = this.session;
    const n = this.hospCast.nurse;
    const spots = [{ x: -10, z: -1.5 }, { x: 7.5, z: -1.2 }, { x: -2, z: -1.8 }, { x: 13.5, z: -1.4 }];
    let i = 0;
    while (S === this.session && this.g.state.stage === 'hospital_day') {
      i = (i + 1) % spots.length;
      await n.walkTo(spots[i]);
      await sleep(3 + Math.random() * 5);
    }
  },

  async orderlyRounds() {
    const S = this.session;
    const o = this.hospCast.orderly;
    const spots = [{ x: 52.5, z: -1.4 }, { x: 40.5, z: -2.3 }, { x: 26.0, z: -1.7 }, { x: 46.0, z: -1.2 }];
    let i = 0;
    while (S === this.session && this.g.state.stage === 'hospital_day') {
      await o.walkTo(spots[i]);
      i = (i + 1) % spots.length;
      await sleep(4 + Math.random() * 6);
    }
  },

  /**
   * Sound zones of the long ground floor: the old wing has its own hollow
   * room tone (and the main hum thins out), the PA speaks now and then by day
   * in the newer part. Steps echo in the old wing (see Game onStep → echoAt).
   */
  updateHospitalSound(dt) {
    const g = this.g, a = g.audio;
    if (!a.ready || g.world?.id !== 'hospital') return;
    const st = g.state.stage;
    if (!st.startsWith('hospital')) return;
    const x = this.julian.position.x;
    const old = Math.min(1, Math.max(0, (x - 36.5) / 2.5));
    const night = g.world.night;
    const v = Math.round(old * 20) / 20;
    if (v !== this.oldWingV || !a.loops.has('amb.oldwing')) {
      this.oldWingV = v;
      a.loop('amb.oldwing', { fade: 2, volume: 0 })?.setVolume(v * (night ? 1.25 : 1), 1.2);
      a.loops.get(night ? 'amb.hospital_night' : 'amb.hospital_day')?.setVolume(1 - v * 0.65, 1.2);
    }
    if (st === 'hospital_day' && g.player.enabled && !g.dialogue.busy) {
      this.paT = (this.paT ?? 40) - dt;
      if (this.paT <= 0) { this.paT = 70 + Math.random() * 80; a.play('sfx.announce', { volume: 1 - old * 0.75 }); }
    }
  },

  hospitalDayInteractables(w) {
    const g = this.g;
    const say = (id) => () => g.dialogue.start(id);
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    return [
      { id: 'h_window', label: 'Окно', at: { x: 19.2, z: -6.4 }, radius: 1.0, anchor: A(19.0, 2.4, -7.5), run: say('h_window') },
      { id: 'h_cooler', label: 'Кулер с водой', at: { x: -7.4, z: -2.4 }, radius: 0.7, anchor: w.anchors.cooler, run: say('h_cooler') },
      { id: 'h_reception', label: 'Регистратура', at: { x: -16.5, z: -2.2 }, radius: 1.2, anchor: w.anchors.reception, run: say('h_reception') },
      { id: 'h_elevator', label: 'Лифт', at: { x: -12.0, z: -2.4 }, radius: 0.8, anchor: w.anchors.elevator, run: say('h_elevator') },
      { id: 'h_stairs', label: 'Лестница', at: { x: -9.3, z: -2.4 }, radius: 0.7, anchor: w.anchors.stairs, run: say('h_stairs') },
      { id: 'h_procedure', label: 'Процедурная', at: { x: -4.5, z: -3.0 }, radius: 1.0, anchor: w.anchors.procedure, run: say('h_procedure') },
      { id: 'h_side', label: 'Хирургия', at: { x: 0, z: -6.0 }, radius: 1.2, anchor: w.anchors.sideCorridor, run: say('h_side') },
      { id: 'h_station', label: 'Пост медсестры', at: { x: 5.0, z: -2.0 }, radius: 1.0, anchor: w.anchors.nurseStation, run: say('h_station') },
      { id: 'h_wardB', label: 'Палата 113', at: { x: w.wardB.cx, z: -2.3 }, radius: 1.3, anchor: A(w.wardB.cx, 2.1, -4.0), run: say('h_wardB_day') },
      { id: 'h_bed', label: 'Лечь в кровать', at: { x: w.wardA.bedSpot.x + 0.4, z: -4.9 }, radius: 1.6, anchor: A(w.wardA.bedSpot.x, 1.3, w.wardA.bedSpot.z),
        run: () => (g.state.get('overheard_doctors') ? this.startEvening() : g.dialogue.start('h_bed_wait')) },
    ];
  },

  // ------------------------------------------------------------------ EVENING — the investigator

  inWardA() {
    const a = this.g.world?.wardA;
    const p = this.julian.position;
    return !!a && p.x > a.x0 + 0.2 && p.x < a.x1 - 0.1 && p.z < -4.45;
  },

  async startEvening() {
    const g = this.g;
    const S = this.session;
    if (this.eveningStarted) return;
    this.eveningStarted = true;
    g.player.enabled = false;
    g.interactions.setItems([]);
    await g.fader.to(true, 1200);
    if (S !== this.session) return;
    await this.enter('hospital', 'day', 'hospital_evening');
    const w = g.world;
    const J = this.julian;
    this.lieInBed(w.wardA.bedSpot);
    Object.assign(w.wardA.mon, { bpm: 50, flat: false, fault: false, off: false });
    for (const c of ['doc', 'psy', 'nurse', 'nurse2', 'orderly', 'visitor']) this.hospCast?.[c]?.setVisible(false);
    const kow = this.castIn(w, 'quinn');
    kow.setPose('side'); // painted standing profile: she walks in and stands by the bed
    w.vnHide = [kow.root];
    kow.placeAt(16.9, -1.5, 1);
    this.setAmbience(['amb.hospital_day']);
    g.renderer.setLayer('evening', { exposure: -0.12, tint: [0.06, 0.0, -0.06], saturation: -0.1 });
    g.cameraSys.setShot({ x: 18.4, y: 1.7, z: 1.2, lookX: 18.4, lookY: 0.9, lookZ: -6.0, fov: 42 }, 1);
    g.cameraSys.snap();
    g.hud.show(false);
    g.keyScene = true;
    await g.card.show('Вечер', { en: 'Evening', ms: 1800 });
    if (S !== this.session) return;
    await g.fader.to(false, 1400);
    await kow.walkTo([{ x: 16.9, z: -4.6 }, { x: w.wardA.bedSpot.x + 0.85, z: w.wardA.bedSpot.z + 1.2 }], { speed: 1.0 });
    if (S !== this.session) return;
    kow.face(-1);
    await g.dialogue.start('h_investigator');
    if (S !== this.session) return;
    await kow.walkTo([{ x: 16.9, z: -4.6 }, { x: 16.9, z: -1.5 }, { x: 8, z: -1.0 }], { speed: 1.1 });
    kow.setVisible(false);
    g.keyScene = false;
    if (S !== this.session) return;
    if (!g.state.get('lizzie_chapter_2_complete') && !(await this.playLizzie(2))) return;
    await this.startNight();
  },

  // ------------------------------------------------------------------ NIGHT — heart stop, thirst

  async startNight() {
    const g = this.g;
    const S = this.session;
    this.returnStarted = false;
    this.bloodFocus = false;
    await g.fader.to(true, 1800);
    if (S !== this.session) return;
    await this.enter('hospital', 'night', 'hospital_night');
    g.renderer.clearLayer('evening');
    const w = g.world;
    const J = this.julian;
    this.lieInBed(w.wardA.bedSpot);
    w.openWardB(false);
    w.wardB.iv.userData.bag.visible = true;
    w.wardB.iv.userData.tube.visible = true;
    w.wardA.iv.userData.bag.visible = true;
    w.wardA.iv.userData.tube.visible = true;
    const patient = this.castIn(w, 'patient');
    this.lieInBed.call({ julian: patient }, w.wardB.bedSpot);
    for (const c of ['doc', 'psy', 'nurse', 'nurse2', 'orderly', 'visitor']) this.hospCast?.[c]?.setVisible(false);
    this.custodyCast.get('quinn')?.setVisible(false);
    if (g.world) g.world.vnHide = [];
    this.setAmbience(['amb.hospital_night']);
    const mon = w.wardA.mon;
    Object.assign(mon, { bpm: 46, flat: false, fault: false, off: false });
    w.onBeat = (m) => { if (m === mon) g.audio.play('sfx.beep', { volume: 0.5 }); };
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    // open on Julian in bed with the monitor beside him, then drift in on the
    // monitor while the pulse slows. The camera looks through the glass front,
    // right of the door, so the door post never covers the screen.
    const mp = mon.halo.getWorldPosition(new THREE.Vector3());
    const wide = { x: 18.9, y: 1.6, z: -2.2, lookX: 18.3, lookY: 1.05, lookZ: -6.3, fov: 38 };
    // from the right of the bed: clear of the door post and of the drip stand
    const mid = { x: mp.x + 2.6, y: mp.y - 0.05, z: mp.z + 3.2, lookX: mp.x + 0.6, lookY: mp.y - 0.25, lookZ: mp.z - 0.2, fov: 30 };
    const close = { x: mp.x + 1.1, y: mp.y + 0.02, z: mp.z + 1.9, lookX: mp.x, lookY: mp.y - 0.02, lookZ: mp.z, fov: 18 };
    g.cameraSys.setShot(wide, 1);
    g.cameraSys.snap();
    await g.card.show('Жажда', { num: 'Глава 5', en: 'Thirst', sub: 'НОЧЬ · 03:12', ms: 2000, style: 'chapter-b' });
    if (S !== this.session) return;
    g.letterbox.set(true, 2400);
    await g.fader.to(false, 2000);
    // THE HEART STOPS — one long, unbroken push-in while the pulse runs down: the room loses its
    // colour, sound goes under water, the frame tilts a little; every beat is a dull thump and
    // a pulse of dark at the edges, each one weaker and later than the last
    const dur = 17;
    const push = g.cameraSys.dolly(wide, mid, dur);
    let beatPulse = 0;
    w.onBeat = (m) => {
      if (m !== mon) return;
      g.audio.play('sfx.beep', { volume: 0.5 });
      g.audio.play('inner.heartbeat', { volume: 0.9 });
      beatPulse = 1;
    };
    const t0 = g.cameraSys.time;   // game time: the push and the pulse stay in step
    while (S === this.session) {
      const k = Math.min(1, (g.cameraSys.time - t0) / dur);
      mon.bpm = Math.max(9, Math.round(46 - 37 * Math.pow(k, 0.8)));
      beatPulse *= 0.82;
      g.renderer.setLayer('dying', { saturation: -0.75 * k, vignette: 0.08 + 0.28 * k + beatPulse * 0.18, exposure: -0.1 * k - beatPulse * 0.07, blur: 0.4 * k, tint: [0.02 * k, -0.04 * k, 0.03 * k] });
      g.audio.setMuffle(0.15 + 0.6 * k, 0.3);
      g.cameraSys.roll = -0.05 * k;
      if (k >= 1) break;
      await sleep(0.1);
    }
    await push;
    if (S !== this.session) return;
    // flatline: one snap in to the screen, the line goes straight, the tone
    w.onBeat = null;
    mon.bpm = 0;
    mon.flat = true;
    g.state.set('flatline', true);
    g.audio.music('none', 0.6); // only the flatline
    g.audio.setMuffle(0, 0.05);
    const flat = g.audio.loop('sfx.flatline', { fade: 0.05 });
    g.cameraSys.shake = 0.5;
    g.renderer.setLayer('dying', { saturation: -0.85, vignette: 0.45, exposure: -0.05, blur: 0, tint: [-0.03, 0.04, 0.0] });
    await g.cameraSys.dolly(mid, close, 1.1, (q) => 1 - Math.pow(1 - q, 3));
    if (S !== this.session) return;
    await sleep(2.6);
    if (S !== this.session) return;
    // everything goes: the picture sinks to black, the tone thins to a ringing, then nothing
    const ring = g.audio.loop('inner.ring', { fade: 0.8, volume: 2.5 });
    flat?.stop(2.2);
    await g.fader.to(true, 2200);
    if (S !== this.session) return;
    g.audio.setMasterVolume(0, 0.4);
    ring?.stop(0.5);
    g.renderer.clearLayer('dying');
    g.cameraSys.roll = 0;
    await sleep(2.4);
    if (S !== this.session) return;
    g.letterbox.set(false, 300);
    // he wakes — the thirst
    g.audio.setMasterVolume(1, 0.05);
    g.audio.music('thirst', 1);
    g.audio.play('sfx.whoosh');
    g.audio.play('inner.heartbeat', { volume: 1 });
    g.renderer.setLayer('thirst', { redPulse: 0.35, vignette: 0.45, ca: 0.8, saturation: -0.35, blur: 0.25, wave: 0.3 });
    // the eyes snap open: a hard red flash that drains into the thirst
    g.renderer.setLayer('wakeflash', { exposure: 0.9, redPulse: 1.2, tint: [0.35, -0.1, -0.1] });
    g.cameraSys.setShot(close, 1);
    g.cameraSys.snap();
    g.cameraSys.setShot(null, 1.4);
    g.cameraSys.shake = 1.6;
    g.fader.set(false);
    (async () => { for (let i = 10; i >= 0; i--) { g.renderer.setLayer('wakeflash', { exposure: 0.09 * i, redPulse: 0.12 * i, tint: [0.035 * i, -0.01 * i, -0.01 * i] }); await sleep(0.06); } g.renderer.clearLayer('wakeflash'); })();
    // he is awake, and the line stays flat: the heart did not start again
    mon.flat = true; mon.bpm = 0;
    if (!(await this.lines(g.dialogue.dialogues.n_wake))) return;
    g.audio.play('sfx.tear');
    w.wardA.iv.userData.tube.visible = false;
    Object.assign(mon, { flat: false, fault: true }); // the leads torn off
    await J.riseUp(1.2);
    J.root.position.y = 0;
    J.placeAt(w.wardA.inside.x, w.wardA.inside.z, -1);
    J.shadow.visible = true;
    g.cameraSys.setShot(null, 0.8);
    g.cameraSys.sway = 0.25;
    g.player.impair = 0.25;
    g.keyScene = false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'night');
    this.nightT = 0;
    this.thirstBeat = 0;
    g.interactions.setItems(this.nightInteractables(w));
  },

  nightInteractables(w) {
    const g = this.g;
    const say = (id) => () => g.dialogue.start(id);
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    const items = [
      { id: 'n_sink', label: 'Раковина', at: { x: w.wardA.x0 + 0.6, z: -6.8 }, radius: 0.8, anchor: A(w.wardA.x0 + 0.5, 1.3, -7.25), run: say('n_sink') },
      { id: 'n_cooler', label: 'Кулер', at: { x: -7.4, z: -2.4 }, radius: 0.7, anchor: w.anchors.cooler, run: say('n_cooler') },
      { id: 'n_station', label: 'Пост медсестры', at: { x: 5.0, z: -2.0 }, radius: 1.0, anchor: w.anchors.nurseStation, run: say('n_station') },
      { id: 'n_elevator', label: 'Лифт', at: { x: -12.0, z: -2.4 }, radius: 0.8, anchor: w.anchors.elevator, run: say('n_elevator') },
      // the old woman's door (113): voices behind it — the night's next step, a clear prompt
      { id: 'n_ward_door', label: 'Палата 113 — голоса за дверью', at: { x: w.wardB.doorSpot.x, z: -2.2 }, radius: 1.4, anchor: A(w.wardB.doorSpot.x, 1.9, -3.9),
        if: '!ward_b_open', run: () => this.wardBOpens() },
      { id: 'n_bag', label: 'Пакет с кровью', at: { x: w.wardB.bedSpot.x - 1.0, z: -5.4 }, radius: 1.5, anchor: A(w.wardB.bedSpot.x - 1.05, 1.95, w.wardB.bedSpot.z + 0.7),
        if: 'ward_b_open && nurse_left && !blood_consumed', run: () => this.bloodEvent() },
      { id: 'n_bed', label: 'Лечь в кровать', at: { x: w.wardA.bedSpot.x + 0.4, z: -4.9 }, radius: 1.6, anchor: A(w.wardA.bedSpot.x, 1.3, w.wardA.bedSpot.z),
        if: 'blood_consumed', run: () => this.nurseReturns() },
    ];
    return items;
  },

  /** The door of 113 opens: warm light, a voice, the nurse leaves without turning. */
  wardBOpens() {
    if (this.wardBStarted) return this.wardVoice;
    this.wardVoice = this.wardBScene();
    return this.wardVoice;
  },

  async wardBScene() {
    const g = this.g;
    const S = this.session;
    const w = g.world;
    this.wardBStarted = true;
    w.openWardB(true);
    g.audio.play('sfx.door', { volume: 0.4 });
    g.state.set('ward_b_open', true);
    const door = w.wardB.doorSpot;
    const nurse = this.castIn(w, 'nurseNight');
    nurse.placeAt(door.x, -4.9, -1);
    await sleep(0.6);
    if (!(await this.lines(g.dialogue.dialogues.n_ward_voice.slice(0, 1), { blocking: false }))) return;
    // she steps out and heads for the stairs; as soon as she is out of the ward the bag is his
    nurse.walkTo([{ x: door.x, z: -2.0 }], { speed: 1.05, direct: true }).then(() => {
      if (S !== this.session) return;
      g.state.set('nurse_left', true);
      // away from Julian's ward: she turns right, down the far end of the corridor, never facing him
      const far = Math.max(...(w.bounds.walk.areas || [{ maxX: door.x + 8 }]).map((a) => a.maxX));
      nurse.face(1);
      return nurse.walkTo([{ x: door.x + 2.5, z: -1.7 }, { x: Math.max(door.x + 4, far - 0.5), z: -1.8 }], { speed: 1.15, direct: true });
    }).then(() => { if (S === this.session) nurse.setVisible(false); });
    g.audio.play('sfx.lighter', { delay: 2.5, volume: 0.3 });
    await sleep(1.5);
    if (S !== this.session) return;
    await this.lines(g.dialogue.dialogues.n_ward_voice.slice(1), { blocking: false });
  },

  /** BLOOD CONSUMPTION EVENT. */
  async bloodEvent() {
    const g = this.g;
    const S = this.session;
    const w = g.world;
    const J = this.julian;
    g.player.enabled = false;
    g.keyScene = true;
    g.hud.show(false);
    g.state.set('blood_bag_seen', true);
    // let the nurse finish her lines first — two subtitle streams must not overlap
    await this.wardVoice;
    if (S !== this.session) return;
    const bag = w.wardB.iv.userData.bag;
    const bed = w.wardB.bedSpot;
    // in front of the middle of the bed, facing the head end: the drip and the
    // patient's head stay clear on his left (by the doorway the door leaf and the
    // jamb would hide him or the bag)
    await J.walkTo([{ x: bed.x - 0.9, z: bed.z + 1.2 }, { x: bed.x + 0.25, z: bed.z + 1.0 }], { speed: 0.7 });
    if (S !== this.session) return;
    J.face(-1);
    // perception narrows: the room blurs and greys, the red stays, the heart pounds
    g.audio.setMuffle(0.8, 2);
    // the room sinks into dark and red; the bag is the one bright thing left in it
    // (pure red is dark once colour drains away; the bag glows light-red and the
    // thirst filter eases its desaturation while he stares, so the red survives)
    g.renderer.setLayer('blood', { saturation: -0.1, blur: 0.6, vignette: 0.1, redPulse: 0.1, exposure: -0.35 });
    bag.material.emissive.set(0xff3848);
    bag.material.emissiveIntensity = 3.2;
    // (locations are cached, so the boost is set absolutely, never compounded)
    for (const c of bag.children) {
      c.userData.baseScale ??= c.scale.clone();
      c.scale.copy(c.userData.baseScale).multiplyScalar(2.2);
      if (c.material && !c.userData.ownMat) { c.material = c.material.clone(); c.userData.ownMat = true; }
      if (c.material) c.material.opacity = 0.85;
    }
    // from the corridor, right of the doorway jamb: drip, patient's head, Julian
    g.cameraSys.setShot({ x: bed.x - 0.3, y: 1.45, z: bed.z + 3.3, lookX: bed.x - 0.7, lookY: 1.28, lookZ: bed.z + 0.5, fov: 30 }, 0.9);
    this.bloodFocus = true; // the thirst vignette eases so the bag stays in the light
    const beats = setInterval(() => g.audio.play('inner.heartbeat', { volume: 1 }), 520);
    // the dread under it: a low drone swelling, whispers at the edge of hearing
    const drone = g.audio.loop('inner.drone', { fade: 1.6, volume: 1.8 });
    const whispers = setInterval(() => g.audio.play('inner.whisper', { volume: 0.6 + Math.random() * 0.5, rate: 0.7 + Math.random() * 0.3 }), 1700);
    for (const [who, text] of g.dialogue.dialogues.n_patient) {
      if (S !== this.session) { clearInterval(beats); clearInterval(whispers); drone?.stop(0.3); return; }
      g.dialogue.history.push({ speaker: who, text });
      await g.view.flash(who, text, 1900 + text.length * 40);
    }
    // he lunges for the bag
    g.cameraSys.shake = 1.4;
    clearInterval(whispers);
    g.audio.play('sfx.tear');
    g.audio.play('sfx.shatter', { volume: 0.35, rate: 0.5 });   // a low, wrong crack under the tear
    g.audio.play('inner.ring', { volume: 1.2 });
    g.audio.play('inner.breath', { volume: 1.0, delay: 0.3 });
    bag.visible = false;
    w.wardB.iv.userData.tube.visible = false;
    J.setPose('think');
    await sleep(0.25);
    g.fader.set(true);
    clearInterval(beats);
    g.audio.play('sfx.gulp');
    g.audio.play('sfx.gulp', { delay: 0.7, rate: 0.85 });
    g.audio.play('sfx.gulp', { delay: 1.4, rate: 0.75, volume: 0.8 });
    drone?.stop(2.0);
    await sleep(2.2);
    if (S !== this.session) return;
    // instant clarity: every effect drops, sound snaps back
    for (const k of ['blood', 'thirst']) g.renderer.clearLayer(k);
    g.audio.music('hospital_night', 5); // the thirst is quiet now
    g.audio.setMuffle(0, 0.05);
    g.cameraSys.sway = 0;
    g.player.impair = 0;
    J.dizzy = 0;
    g.state.set('blood_consumed', true);
    this.bloodFocus = false;
    g.fader.set(false);
    g.audio.play('sfx.whoosh', { volume: 0.4 });
    if (!(await this.lines(g.dialogue.dialogues.n_after))) return;
    J.setPose('idle');
    g.cameraSys.setShot(null, 0.8);
    g.keyScene = false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.setStage('hospital_return');
    await g.dialogue.start('n_return_hint');
    g.interactions.setItems(this.nightInteractables(w));
  },

  async nurseReturns() {
    const g = this.g;
    const S = this.session;
    if (this.returnStarted) return;
    this.returnStarted = true;
    const w = g.world;
    g.player.enabled = false;
    g.keyScene = true;
    g.hud.show(false);
    g.interactions.setItems([]);
    this.lieInBed(w.wardA.bedSpot);
    Object.assign(w.wardA.mon, { flat: false, fault: true, off: false, bpm: 0 });
    g.cameraSys.setShot({ x: 18.4, y: 1.7, z: 1.0, lookX: 18.4, lookY: 0.9, lookZ: -6.0, fov: 44 }, 0.8);
    const nurse = this.castIn(w, 'nurse');
    nurse.placeAt(10.5, -1.6, 1);
    g.audio.play('sfx.step', { volume: 0.6 });
    await nurse.walkTo([{ x: 16.9, z: -2.0 }, { x: 16.9, z: -4.6 }, { x: w.wardA.bedSpot.x + 0.85, z: w.wardA.bedSpot.z + 1.2 }], { speed: 2.4 });
    if (S !== this.session) return;
    nurse.face(-1);
    w.vnHide = [nurse.root];
    // she reattaches everything mid-conversation (cmd 'reattach')
    await g.dialogue.start('n_nurse_vn');
    if (S !== this.session) return;
    w.vnHide = [];
    g.state.set('hospital_nurse_returned', true);
    await nurse.walkTo([{ x: 16.9, z: -4.6 }, { x: 16.9, z: -1.6 }, { x: 9, z: -1.4 }], { speed: 1.4 });
    nurse.setVisible(false);
    await sleep(1.5);
    if (S !== this.session) return;
    await this.startRecovery();
  },

  // ------------------------------------------------------------------ RECOVERY + DISCHARGE

  async startRecovery() {
    const g = this.g;
    const S = this.session;
    await g.fader.to(true, 1600);
    if (S !== this.session) return;
    await this.enter('hospital', 'day', 'recovery');
    const w = g.world;
    const J = this.julian;
    w.openWardB(false);
    w.wardB.iv.userData.bag.visible = true;
    w.wardB.iv.userData.tube.visible = true;
    // the "broken" monitor was taken away: an empty arm, the screen dead
    Object.assign(w.wardA.mon, { off: true, fault: false, flat: false, bpm: 0 });
    w.onBeat = null;
    this.setAmbience(['amb.hospital_day']);
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    const doc = this.castIn(w, 'doctor');
    const psy = this.castIn(w, 'doctor2');
    const nurse = this.castIn(w, 'nurse');
    const shots = {
      ward: { x: 18.4, y: 1.7, z: 1.2, lookX: 18.4, lookY: 0.9, lookZ: -6.0, fov: 42 },
      corridor: { x: 6, y: 2.0, z: 6.8, lookX: 6, lookY: 1.2, lookZ: -1.2, fov: 32 },
    };
    const lines = g.dialogue.dialogues.recovery;
    const scene = (i) => {
      // stage each beat in the ward or the corridor
      if (i === 0) {
        this.lieInBed(w.wardA.bedSpot);
        doc.placeAt(w.wardA.bedSpot.x + 0.85, w.wardA.bedSpot.z + 1.2, -1);   // inside the room (its wall is at bed + 1.35)
        psy.setVisible(false); nurse.setVisible(false);
        g.cameraSys.setShot(shots.ward, 2); g.cameraSys.snap();
      } else if (i === 1) {
        J.stand(); J.root.position.y = 0; J.shadow.visible = true; J.placeAt(4.0, -1.2, 1);
        nurse.setVisible(true); nurse.placeAt(5.2, -1.2, -1);
        doc.setVisible(false);
        g.cameraSys.setShot(shots.corridor, 2); g.cameraSys.snap();
        J.walkTo({ x: 8.5, z: -1.2 }, { speed: 1.3 });
        nurse.walkTo({ x: 9.6, z: -1.2 }, { speed: 1.2 });
      } else {
        J.stand(); J.placeAt(w.wardA.inside.x + 0.35, w.wardA.inside.z, 1);
        doc.setVisible(true); doc.placeAt(w.wardA.inside.x + 1.15, w.wardA.inside.z + 0.15, -1);
        psy.setVisible(true); psy.placeAt(w.wardA.inside.x + 1.85, w.wardA.inside.z + 0.55, -1);
        nurse.setVisible(false);
        g.cameraSys.setShot(shots.ward, 2); g.cameraSys.snap();
      }
    };
    let beat = -1;
    for (const [who, text] of lines) {
      if (S !== this.session) return;
      if (who === 'card') {
        await g.fader.to(true, 600);
        await g.card.show(text, { en: CARD_EN[text], ms: 1700 });
        beat++;
        scene(beat);
        await g.fader.to(false, 900);
        continue;
      }
      g.dialogue.history.push({ speaker: who, text });
      await g.view.flash(who, text, 1900 + text.length * 40);
    }
    g.state.set('recovered', true);
    await g.fader.to(true, 1400);
    if (S !== this.session) return;
    await this.startStreet();
  },

  async startStreet() {
    const g = this.g;
    const S = this.session;
    g.fader.set(true);
    await this.enter('street', null, 'street');
    const w = g.world;
    const J = this.julian;
    J.placeAt(w.anchors.door.x, w.anchors.door.z, 1);
    this.setAmbience(['amb.wind']);
    g.hud.show(false);
    g.player.enabled = false;
    g.keyScene = true;
    g.cameraSys.setShot({ x: 1.5, y: 2.0, z: 8.0, lookX: 1.5, lookY: 1.4, lookZ: -1.5, fov: 34 }, 1);
    g.cameraSys.snap();
    await g.card.show('Выписка', { en: 'Discharge', sub: 'ДЕНЬ ШЕСТОЙ', ms: 2200 });
    if (S !== this.session) return;
    g.audio.play('sfx.door', { volume: 0.5 });
    await g.fader.to(false, 2200);
    await J.walkTo([{ x: w.anchors.door.x, z: -0.6 }, { x: 3.0, z: 0.2 }], { speed: 0.9 });
    if (S !== this.session) return;
    J.face(1);
    // a few seconds of silence, just snow
    await sleep(3.0);
    if (!(await this.lines(g.dialogue.dialogues.street))) return;
    await sleep(2.0);
    if (S !== this.session) return;
    await g.fader.to(true, 2600);
    g.keyScene = false;
    if (S !== this.session) return;
    // home first (the empty flat, her room), then a week later: back at the station
    await this.startHome(1);
  },

  // ------------------------------------------------------------------ per frame + loading

  updateCustody(dt) {
    const g = this.g;
    const st = g.state.stage;
    if (this.reticle?.visible && g.player.gaze) {
      const p = g.player.gaze.position;
      this.reticle.position.set(p.x, 1.0 + Math.sin(performance.now() / 300) * 0.02, -0.1);
    }
    if (st === 'car' && g.player.enabled) {
      this.carT = (this.carT || 0) + dt;
      const f = g.state.flags;
      const looked = ['car_window', 'car_cuffs', 'car_cage', 'car_radio'].filter((k) => f[k]).length;
      if (!this.carTalking && !g.dialogue.busy && (looked >= 2 || this.carT > 35)) this.carTalk();
    }
    if (st === 'station') {
      this.stationT = (this.stationT || 0) + dt;
      if (this.stationT > 120 && !this.calledStarted && !g.dialogue.busy && g.player.enabled) {
        this.calledStarted = true;
        g.dialogue.start('st_called');
      }
    }
    this.updateHospitalSound(dt);
    // by day his drip rolls along with him (he tears it off at night)
    const iv = g.world?.wardA?.iv;
    if (iv) {
      iv.userData.home ??= iv.position.clone();
      if (st === 'hospital_day' && g.player.enabled) {
        const J = this.julian;
        const tx = J.position.x - J.facing * 0.42, tz = J.position.z - 0.28;
        const k = Math.min(1, dt * 4);
        const vx = (tx - iv.position.x) * k;
        iv.position.x += vx;
        iv.position.z += (tz - iv.position.z) * k;
        iv.rotation.z = THREE.MathUtils.clamp(-vx * 6, -0.12, 0.12); // a slight lean when pulled
        // the line always runs into his arm, whichever side of him the stand rolls on
        iv.userData.aimTube?.(J.position.x - iv.position.x, 1.02, J.position.z - iv.position.z + 0.03);
        if (Math.abs(vx) > 0.004 && (this.ivSqueak = (this.ivSqueak || 0) - dt) < 0) { this.ivSqueak = 1.4; g.audio.play('sfx.step', { volume: 0.12 }); }
      } else if (st !== 'hospital_day' && !iv.position.equals(iv.userData.home)) {
        iv.position.copy(iv.userData.home); iv.rotation.z = 0;
        iv.userData.aimTube?.(null);
      }
    }
    if (st === 'hospital_day' && g.player.enabled) {
      this.hospT = (this.hospT || 0) + dt;
      const x = this.julian.position.x;
      if (!g.state.get('overheard_doctors') && !this.overhearing && x > 0.2 && x < 7.5) {
        this.overhearing = true;
        this.lines(g.dialogue.dialogues.h_doctors, { blocking: false }).then((ok) => {
          this.overhearing = false;
          if (!ok) return;
          g.state.set('overheard_doctors', true);
          g.state.set('objective', 'bed');
          this.hospCast?.doc.walkTo({ x: -2.0, z: -1.8 }).then(() => this.hospCast?.doc.walkTo({ x: -0.2, z: -8.5 }));
          this.hospCast?.psy.walkTo({ x: -12, z: -2.3 });
        });
      }
      if (!g.state.get('overheard_doctors') && this.hospT > 150) { g.state.set('overheard_doctors', true); g.state.set('objective', 'bed'); }
      // "back to room 109" always completes: stepping into the ward is enough
      if (g.state.get('overheard_doctors') && this.inWardA()) this.startEvening();
    }
    if (st === 'hospital_return' && g.player.enabled && this.inWardA()) this.nurseReturns();
    if (st === 'hospital_night' && !g.state.get('blood_consumed')) {
      this.nightT = (this.nightT || 0) + dt;
      // thirst grows: heartbeat quickens, the picture pulses
      const k = Math.min(1, this.nightT / 90);
      this.thirstBeat -= dt;
      if (this.thirstBeat <= 0 && g.player.enabled) { this.thirstBeat = 1.0 - k * 0.45; g.audio.play('inner.heartbeat', { volume: 0.55 + k * 0.4 }); }
      g.renderer.setLayer('thirst', { redPulse: 0.3 + k * 0.25, vignette: (0.4 + k * 0.2) * (this.bloodFocus ? 0.3 : 1), ca: 0.6 + k * 0.6, saturation: (-0.3 - k * 0.2) * (this.bloodFocus ? 0.2 : 1), blur: 0.2 + k * 0.2, wave: 0.25 + k * 0.3 });
      const x = this.julian.position.x;
      // a voice down the corridor: after a while he notices it (the door of 113 is the prompt;
      // walking right up to it opens it too, so the night never stalls)
      if (!this.wardHinted && g.player.enabled && !this.wardBStarted && (g.state.get('night_water') || this.nightT > 22)) {
        this.wardHinted = true;
        this.lines(g.dialogue.dialogues.n_ward_hint, { blocking: false });
      }
      const door = g.world.wardB?.doorSpot;
      if (door && !this.wardBStarted && g.player.enabled && this.wardHinted && Math.abs(x - door.x) < 0.7 && this.julian.position.z < -1.6) {
        this.wardBOpens();
      }
    }
  },

  async loadCustody(stage) {
    // a fresh session: whatever scene was running stops touching the cast
    this.bump();
    await this.g.dialogue.abort();
    const start = {
      car: () => this.startCar(),
      station: () => this.startStation(),
      interrogation: () => this.startInterrogation(),
      medical: () => this.startMedical(),
      hospital_day: () => this.startHospitalDay(),
      hospital_evening: () => this.startEvening(),
      hospital_night: () => { this.wardHinted = false; this.g.state.set('nurse_left', false); this.g.state.set('blood_consumed', false); this.g.state.set('ward_b_open', false); this.wardBStarted = false; return this.startNight(); },
      hospital_return: () => { this.wardHinted = false; this.g.state.set('nurse_left', false); this.g.state.set('blood_consumed', false); this.g.state.set('ward_b_open', false); this.wardBStarted = false; return this.startNight(); },
      recovery: () => this.startRecovery(),
      street: () => this.startStreet(),
    }[stage];
    this.carTalking = false;
    this.eveningStarted = false;
    this.returnStarted = false;
    this.calledStarted = false;
    this.wardBStarted = false;
    this.overhearing = false;
    if (start) await start();
  },
};

export function installCustody(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}
