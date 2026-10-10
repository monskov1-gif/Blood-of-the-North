import * as THREE from 'three';
import { Character2D } from '../characters/Character2D.js';
import { CHARACTERS } from '../../data/characters.js';
import { CROWD, STOOLS_X, STOOL_Z, STOOL_LIFT } from '../../data/crowd.js';
import { DIALOGUES } from '../../data/dialogue/bar.js';
import { paintCocktail } from '../ui/Overlays.js';
import { sleep } from './Director.js';
import { installMorning } from './MorningSequence.js';
import { installCustody, CUSTODY_STAGES } from './CustodySequence.js';
import { installInvestigation, INVESTIGATION_STAGES } from './InvestigationSequence.js';
import { installLizzie, LIZZIE_STAGES } from './LizzieSequence.js';
import { installPlaces } from './Places.js';
import { installHome, HOME_STAGES } from './HomeSequence.js';

/**
 * Scene logic for the prologue in the "Northern Rose" bar:
 * cast placement, ambient NPC life, interactables, the cocktail cutscene,
 * the poisoning and the ending. Stages: explore → talk1 → talk2 → escape → ended.
 */
export class BarStory {
  constructor(game) {
    this.g = game;
    this.scene = game.world;
    this.chars = game.characters;
    this.tasks = 0;
    this.session = 0;
    this.bgCache = new Map();
  }

  /** Invalidates running sequences (new game / load / title). */
  bump() { this.session++; this.escaping = false; this.traveling = false; this.place = null; this.clearCrowd?.(); }

  // ------------------------------------------------------------------ setup

  spawn() {
    const { atlas } = this.g;
    const add = (key, id = key) => {
      const ch = new Character2D(atlas, { ...CHARACTERS[key], id });
      this.chars.set(id, ch);
      this.scene.root.add(ch.root);
      return ch;
    };
    this.julian = add('julian');
    this.kayden = add('kayden');
    this.waiter = add('waiter');
    this.owen = add('owen');
    this.bartender = add('bartender');
    this.waiter2 = add('waiter2');
    this.patronB = add('chris', 'patronB');   // Chris (Кристиан Кокс), the regular at the bar
    // the crowd (data/crowd.js)
    this.crowd = CROWD.map((c, i) => {
      const id = c.id || `crowd${i}`;
      const ch = new Character2D(atlas, { id, name: 'Посетитель', poses: { idle: c.frame }, speed: 1.1 });
      ch.crowd = c;
      this.chars.set(id, ch);
      this.scene.root.add(ch.root);
      if (c.block && c.at) this.scene.colliders.push({ x: c.at.x, z: c.at.z, r: 0.3 });
      return ch;
    });
    this.leaver = this.chars.get('leaver');
    this.wanderer = this.crowd.find((c) => c.crowd.wander);
    this.coupe = this.makeCoupe();
    this.scene.root.add(this.coupe);
    this.resetPositions();
  }

  /** The cocktail on the table: a 2D pixel sprite (reads better than a tiny 3D glass). */
  makeCoupe() {
    const atlas = this.g.atlas;
    const tex = atlas.texture.clone();
    tex.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissiveMap: tex, emissive: new THREE.Color(0x9a8a84), alphaTest: 0.5, side: THREE.DoubleSide,
    });
    mat.userData.noLightingState = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, mat);
    const g = new THREE.Group();
    g.add(mesh);
    const setFrame = (name) => {
      const f = atlas.frame(name);
      const [W, H] = atlas.size;
      tex.offset.set(f.x / W, 1 - (f.y + f.h) / H);
      tex.repeat.set(f.w / W, f.h / H);
      mesh.scale.set(f.w * 0.0075, f.h * 0.0075, 1);
    };
    g.userData.setEmpty = (empty) => setFrame(empty ? 'prop_coupe_big_empty' : 'prop_coupe_big');
    g.userData.setEmpty(false);
    g.visible = false;
    return g;
  }

  resetPositions() {
    this.resetMorning?.();
    const a = this.scene.anchors;
    const J = this.julian, K = this.kayden;
    J.stand(); J.state = 'idle'; J.fall = 0; J.dizzy = 0; J.setPose('idle'); J.setVisible(true);
    J.placeAt(this.scene.spawns.player.x, this.scene.spawns.player.z, 1);
    K.sit(a.kaydenSeat, -1); K.setPose('idle'); K.setVisible(true);
    this.owen.sit(a.owenSeat, -1); this.owen.setPose('idle'); this.owen.setVisible(true);
    this.owenShade?.setVisible(false);
    this.waiter.stand(); this.waiter.placeAt(4.8, -2.15, -1); this.waiter.setPose('idle'); this.waiter.setVisible(true);
    this.bartender.placeAt(-2.6, -4.2, -1); this.bartender.setPose('idle');
    this.bartender.shadow.visible = false;
    // Chris stands at the bar, elbow on the counter (no seated frame for him: the patched-on legs
    // of the old one read as fake)
    this.patronB.stand(); this.patronB.placeAt(STOOLS_X[1] + 0.25, STOOL_Z + 0.35, 1); this.patronB.setPose('idle');
    this.patronB.root.position.y = 0;
    this.placeCrowd();
    this.waiter2.stand(); this.waiter2.placeAt(8.8, -2.2, 1); this.waiter2.setVisible(true);
    this.coupe.visible = false;
    this.coupe.userData.setEmpty(false);
    for (const c of this.chars.values()) { c.timeScale = 1; c.path = null; if (c.state === 'walk') c.state = 'idle'; }
    this.leaverGone = false;
    this.bgCache.clear();
  }

  placeCrowd() {
    const fg = this.scene.foregroundSeats || [];
    for (const ch of this.crowd) {
      const c = ch.crowd;
      ch.setVisible(true);
      ch.root.position.y = 0;
      if (c.seat) {
        let p = c.seat;
        if (c.seat.fg != null) p = fg[c.seat.fg];
        // the sprite sits just in front of the stool's round seat (in its plane the red cushion and the
        // counter's edge cut through the body)
        if (c.seat.stool != null) p = { x: STOOLS_X[c.seat.stool], z: STOOL_Z + 0.24, y: STOOL_LIFT };
        if (!p) { ch.setVisible(false); continue; }
        ch.sit({ x: p.x, z: p.z }, c.facing ?? p.facing ?? 1);
        ch.root.position.y = p.y || 0;
      } else {
        ch.stand();
        ch.placeAt(c.at.x, c.at.z, c.facing ?? 1);
        if (c.noShadow) ch.shadow.visible = false;
      }
    }
  }

  // ------------------------------------------------------------------ interactables

  interactables() {
    const say = (id) => () => this.g.dialogue.start(id);
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    return [
      { id: 'photo', label: 'Старые фотографии', at: { x: -13.0, z: -1.9 }, radius: 1.3, anchor: A(-13.35, 2.6, -4.9), run: say('photo') },
      { id: 'door', label: 'Выход', at: { x: -12.2, z: -2.0 }, radius: 1.1, anchor: A(-12.2, 2.8, -4.8), run: say('door') },
      { id: 'coats', label: 'Вешалка', at: { x: -10.7, z: -2.0 }, radius: 1.0, anchor: A(-10.7, 2.2, -4.4), run: say('coats') },
      { id: 'window', label: 'Окно', at: { x: -8.95, z: -2.0 }, radius: 1.2, anchor: A(-8.95, 2.9, -4.9), run: say('window') },
      { id: 'jukebox', label: 'Музыкальный автомат', at: { x: -7.95, z: -2.0 }, radius: 1.0, anchor: A(-7.95, 1.9, -4.4), run: say('jukebox') },
      { id: 'tv', label: 'Телевизор', at: { x: -5.4, z: -2.2 }, radius: 1.2, anchor: A(-5.55, 3.65, -4.1), run: say('tv') },
      { id: 'chris', label: 'Крис', at: { x: -3.8, z: -2.2 }, radius: 0.6, anchor: A(-3.8, 2.15, -2.73), run: say('chris') },
      { id: 'bartender', label: 'Бармен', at: { x: -2.6, z: -2.25 }, radius: 1.1, anchor: A(-2.6, 2.3, -4.2), run: say('bartender') },
      { id: 'moose', label: 'Трофей', at: { x: 0.9, z: -2.25 }, radius: 1.0, anchor: A(1.0, 4.05, -4.6), run: say('moose') },
      { id: 'newspaper', label: 'Газета', at: { x: 4.45, z: -2.25 }, radius: 1.0, anchor: A(4.45, 1.5, -3.4), run: say('newspaper') },
      { id: 'serviceDoor', label: 'Служебная дверь', at: { x: 5.6, z: -2.25 }, radius: 0.9, anchor: A(5.55, 2.6, -4.8), run: say('serviceDoor') },
      { id: 'gallery', label: 'Картины', at: { x: 9.0, z: -2.2 }, radius: 1.1, anchor: A(9.4, 3.4, -4.9), run: say('gallery') },
      { id: 'mirror', label: 'Зеркало', at: { x: 11.0, z: -2.25 }, radius: 0.9, anchor: A(11.55, 3.45, -4.9), run: say('mirror') },
      { id: 'owen', label: 'Мужчина в чёрном', at: { x: 11.2, z: -0.9 }, radius: 0.9, anchor: A(12.6, 2.0, -1.6), if: '!sat_down', run: say('owen') },
      { id: 'kayden', label: 'Сесть к Кайдену', at: { x: 1.4, z: 1.45 }, radius: 1.3, anchor: A(1.6, 2.0, 0.3), if: '!sat_down', run: () => this.sitDown() },
    ];
  }

  // ------------------------------------------------------------------ commands

  commands() {
    const g = this.g;
    return {
      sfx: (key) => g.audio.play(key),
      pose: (id, pose) => this.chars.get(id)?.setPose(pose),
      wait: (s) => sleep(+s),
      music: (mood) => g.audio.music(mood),
      phase: (n) => { g.hallucination.setPhase(+n); g.state.set('phase', +n); },
      cast: (slot, id) => g.view.setCast(slot, id === 'none' ? null : id),
      jukebox: () => {
        const on = !g.state.get('jukebox_swing');
        g.state.set('jukebox_swing', on);
        g.audio.play('sfx.jukebox');
        g.audio.music(on ? 'jukebox' : 'lounge', 2);
      },
      mirrorFocus: async () => {
        g.cameraSys.setShot({ x: 10.3, y: 2.0, z: 2.3, lookX: 11.6, lookY: 2.0, lookZ: -5, fov: 34 }, 1.4);
        await sleep(1.2);
      },
      lookAtOwen: async () => {
        g.cameraSys.setShot({ x: 12.0, y: 2.0, z: 8.4, lookX: 12.0, lookY: 1.2, lookZ: -1.6, fov: 21 }, 0.9);
        this.julian.faceTowards(this.owen.position.x);
        await sleep(1.4);
        this.owen.setPose('think'); // …and now he is looking this way
      },
      mirrorRelease: () => g.cameraSys.setShot(null, 1.2),
      escape: () => {}, // handled after the dialogue ends (runMain)
      cocktailArrives: () => this.cocktailCutscene(),
      drink: () => this.drinkCutscene(),
      owenGone: () => {
        this.owen.setVisible(false);
        g.state.set('owen_left', true);
        this.bgCache.delete('tableOwen');
        g.view.bgKey = null;
      },
    };
  }

  // ------------------------------------------------------------------ flow

  async newGame() {
    const S = this.session;
    const g = this.g;
    g.state.setStage('explore');
    g.player.enabled = false;
    g.hud.show(false);
    g.cameraSys.setShot({ x: -10.2, y: 2.4, z: 9.4, lookX: -11, lookY: 1.4, lookZ: -1, fov: 30 }, 1);
    // Julian starts at the door (placed before the fade, so he never pops back)
    this.julian.placeAt(-12.2, -2.1, 1);
    g.cameraSys.snap();
    await g.card.show('Кровавый вечер', { num: 'Глава 1', en: 'A Bloody Evening', sub: '«СЕВЕРНАЯ РОЗА» · УАЙТХОРС', ms: 2200 });
    if (S !== this.session) return;
    const fade = g.fader.to(false, 2200);
    await sleep(0.9);
    if (S !== this.session) return;
    g.audio.play('sfx.door');
    // he comes in from the cold: a few steps from the door
    await Promise.all([fade, this.julian.walkTo([{ x: -11.6, z: -0.6 }, { x: -11.2, z: 0.6 }])]);
    if (S !== this.session) return;
    g.cameraSys.setShot(null, 0.8);
    await g.dialogue.start('intro');
    if (S !== this.session) return;
    g.hud.show(true);
    g.player.enabled = true;
    g.saves.autosave('start');
    setTimeout(() => { if (g.state.stage === 'explore') { g.hud.notifyPhone(true); g.audio.play('sfx.phone'); g.hud.toast('ТЕЛЕФОН · 1 НОВОЕ'); } }, 9000);
  }

  async sitDown() {
    const S = this.session;
    const g = this.g;
    g.player.enabled = false;
    g.hud.show(false);
    const a = this.scene.anchors;
    await this.julian.walkTo([{ x: 0.35, z: 1.2 }, { x: a.julianSeat.x - 0.05, z: 0.75 }], { speed: 1.4 });
    if (S !== this.session) return;
    g.audio.play('sfx.chair');
    this.julian.sit(a.julianSeat, 1);
    g.state.set('sat_down', true);
    g.state.set('objective', null);
    g.state.setStage('talk1');
    g.cameraSys.setShot({ x: 1.6, y: 2.1, z: 7.6, lookX: 1.6, lookY: 1.05, lookZ: 0, fov: 30 }, 1.2);
    await sleep(1.1);
    if (S !== this.session) return;
    await this.runMain();
    if (S !== this.session) return;
  }

  async runMain(from) {
    const S = this.session;
    const g = this.g;
    const last = await g.dialogue.start('main', { from });
    if (S !== this.session) return;
    if (last === 'k7') await this.escape();
  }

  async cocktailCutscene() {
    const S = this.session;
    const g = this.g;
    g.saves.block('cutscene');
    await g.view.hideVN();
    if (S !== this.session) return;
    g.view.setBarkMode(true);
    const a = this.scene.anchors;
    const W = this.waiter;
    g.cameraSys.setShot({ x: 2.6, y: 2.0, z: 6.4, lookX: 2.2, lookY: 1.1, lookZ: -1.2, fov: 34 }, 1.2);
    // waiter goes to the pickup spot, collects the drink, comes to the table
    W.stop();
    if (Math.abs(W.position.x - a.pickup.x) > 4) W.placeAt(a.pickup.x + 1.2, a.pickup.z, -1);
    await W.walkTo({ x: a.pickup.x, z: a.pickup.z });
    if (S !== this.session) return;
    W.face(-1);
    W.setPose('bow');
    g.audio.play('sfx.pour');
    await sleep(1.3);
    if (S !== this.session) return;
    g.audio.play('sfx.glass');
    W.setPose('idle');
    this.coupe.visible = false;
    await W.walkTo([{ x: 3.15, z: -0.9 }, { x: 2.95, z: 1.25 }, { x: 2.0, z: 1.3 }], { speed: 1.15 });
    if (S !== this.session) return;
    W.face(-1);
    W.setPose('offer');
    this.coupe.position.copy(a.coupeSpot);
    this.coupe.visible = true;
    g.audio.play('sfx.glass_set');
    this.julian.faceTowards(W.position.x);
    for (const n of Object.values(DIALOGUES.cocktail.nodes)) {
      if (n.speaker === 'julian') this.julian.setPose('talk');
      await g.view.showLine({ speaker: n.speaker, text: n.text, read: false, mode: 'bark' });
      if (S !== this.session) return;
      g.dialogue.history.push({ speaker: n.speaker, text: n.text });
      this.julian.setPose('idle');
    }
    W.setPose('idle');
    // the stranger
    // the camera physically travels along the room to him (side-on, no rotation)
    g.cameraSys.setShot({ x: 11.8, y: 2.0, z: 8.4, lookX: 11.8, lookY: 1.2, lookZ: -1.6, fov: 21 }, 0.75);
    this.owen.setPose('think');
    await sleep(2.6);
    if (S !== this.session) return;
    this.owen.setPose('raise');
    g.pflash.show('assets/portraits/owen_2.webp', { ms: 3600, side: 'right' });
    for (const n of Object.values(DIALOGUES.owenNod.nodes)) {
      if (!g.state.test(n.if)) continue;
      await g.view.showLine({ speaker: n.speaker, text: n.text, read: false, mode: 'bark' });
      if (S !== this.session) return;
      g.dialogue.history.push({ speaker: n.speaker, text: n.text });
    }
    this.owen.setPose('think');
    g.state.set('noticed_owen_cocktail', true);
    await sleep(0.4);
    g.cameraSys.setShot({ x: 1.6, y: 2.1, z: 7.6, lookX: 1.6, lookY: 1.05, lookZ: 0, fov: 30 }, 1.2);
    await sleep(0.6);
    if (S !== this.session) return;
    g.view.bark.classList.add('hidden');
    g.view.setBarkMode(false);
    await g.view.showVN();
    if (S !== this.session) return;
    g.saves.unblock('cutscene');
  }

  async drinkCutscene() {
    const S = this.session;
    const g = this.g;
    g.saves.block('cutscene');
    await g.view.hideVN();
    if (S !== this.session) return;
    // the waiter retreats to the bar
    this.waiter.walkTo([{ x: 2.95, z: 1.25 }, { x: 3.15, z: -1.0 }, { x: 4.8, z: -2.15 }], { speed: 1.1 });
    g.cameraSys.setShot({ x: 1.2, y: 1.6, z: 4.6, lookX: 1.1, lookY: 1.15, lookZ: 0.2, fov: 30 }, 1.2);
    await sleep(1.0);
    if (S !== this.session) return;
    this.julian.setPose('drink');
    this.coupe.visible = false;
    g.audio.play('sfx.glass');
    await g.insert.show(paintCocktail(), 'Тёмно-красный, почти чёрный. Вишня на шпажке.', 3400);
    if (S !== this.session) return;
    this.julian.setPose('idle');
    this.coupe.userData.setEmpty(true);
    this.coupe.visible = true;
    g.audio.play('sfx.glass_set');
    g.state.setStage('talk2');
    await sleep(0.6);
    if (S !== this.session) return;
    g.cameraSys.setShot({ x: 1.6, y: 2.1, z: 7.6, lookX: 1.6, lookY: 1.05, lookZ: 0, fov: 30 }, 1.2);
    await g.view.showVN();
    if (S !== this.session) return;
    g.saves.unblock('cutscene');
  }

  async escape() {
    const g = this.g;
    g.state.setStage('escape');
    g.saves.autosave('escape');
    g.saves.block('escape');
    g.hallucination.setPhase(5);
    g.state.set('phase', 5);
    const a = this.scene.anchors;
    g.audio.play('sfx.chair');
    this.julian.stand();
    this.julian.placeAt(a.julianSeat.x - 0.2, 1.15, -1);
    this.julian.dizzy = 1;
    this.kayden.setPose('think');
    // he is there, by the door — just for a moment
    this.windowGuest = this.crowd.find((c) => c.crowd.seat && c.crowd.seat.x === -8.98);
    this.windowGuest?.setVisible(false);
    this.owen.sit({ x: -8.98, z: -1.2 }, 1);
    this.owen.setPose('look');
    this.owen.setVisible(true);
    // …and his black silhouette in the foreground, between Julian and the camera, watching him go
    if (!this.owenShade) {
      this.owenShade = new Character2D(g.atlas, { ...CHARACTERS.owen, id: 'owenShade', tint: 0x000000, selfLight: 0x000000 });
      this.chars.set('owenShade', this.owenShade);
    }
    const sh = this.owenShade;
    this.scene.root.add(sh.root);
    sh.setVisible(true); sh.stand(); sh.shadow.visible = false;
    // off to the right edge of the frame, never under the subtitles in the middle
    sh.placeAt(a.julianSeat.x + 3.4, 2.3, -1);
    sh.setPose('idle');
    sh.root.scale.setScalar(1.0);
    g.cameraSys.setShot(null, 0.8);
    g.cameraSys.snap();
    g.state.set('objective', 'air');
    g.hud.show(true);
    g.interactions.enabled = false;
    g.player.enabled = true;
    g.view.flash('thought', DIALOGUES.escapeHint.nodes.a.text, 3200);
    this.escapeT = 0;
    this.escaping = true;
  }

  async collapse() {
    const S = this.session;
    const g = this.g;
    this.escaping = false;
    g.player.enabled = false;
    g.hud.show(false);
    // the stranger flickers out of existence
    for (let i = 0; i < 6; i++) { this.owen.setVisible(i % 2 === 1); this.owenShade?.setVisible(i % 2 === 0); await sleep(0.09 + Math.random() * 0.1); }
    this.owen.setVisible(false);
    this.owenShade?.setVisible(false);
    g.hallucination.setPhase(6);
    g.audio.play('sfx.shatter');
    await sleep(0.4);
    if (S !== this.session) return;
    await this.julian.collapse(this.julian.facing);
    if (S !== this.session) return;
    g.audio.play('sfx.thud');
    g.cameraSys.shake = 1.2;
    g.state.setStage('ended');
    await sleep(1.2);
    if (S !== this.session) return;
    await g.fader.to(true, 2600);
    if (S !== this.session) return;
    g.audio.stopAllLoops(3);
    g.audio.music('none', 3);
    await sleep(1.2);
    if (S !== this.session) return;
    g.audio.play('inner.heartbeat', { volume: 0.8 });
    await sleep(1.4);
    if (S !== this.session) return;
    g.audio.play('inner.heartbeat', { volume: 0.5 });
    await sleep(1.6);
    if (S !== this.session) return;
    g.audio.play('inner.whisper');
    await g.view.flash('unknown', DIALOGUES.ending.nodes.a.text, 3400, { top: true });
    if (S !== this.session) return;
    await sleep(0.8);
    if (S !== this.session) return;
    g.audio.play('inner.heartbeat', { volume: 0.25 });
    await sleep(1.6);
    if (S !== this.session) return;
    // the heartbeat slows down… then only the wind. The morning.
    g.audio.play('inner.heartbeat', { volume: 0.15 });
    await sleep(1.8);
    if (S !== this.session) return;
    g.audio.play('sfx.wind_gust');
    await sleep(0.8);
    if (S !== this.session) return;
    await this.toMorning();
  }

  // ------------------------------------------------------------------ dialogue backgrounds

  async paintBackground(key) {
    const cacheKey = `${this.g.locationId}|${this.g.world.state}|${key}|${this.owen.root.visible}`;
    if (this.bgCache.has(cacheKey)) return this.bgCache.get(cacheKey);
    const world = this.g.world;
    // the location's own painted shot; the bar's shots only in the bar; anywhere else without a
    // shot of that name — the current view of the location (never a picture of another place)
    const shot = world.shots?.[key] || (this.g.locationId === 'bar' ? this.scene.shots[key] : null);
    let cam;
    if (shot) {
      cam = new THREE.PerspectiveCamera(shot.fov, 16 / 9, 0.1, 80);
      cam.position.set(...shot.pos);
      cam.lookAt(new THREE.Vector3(...shot.look));
    } else {
      const c = this.g.cameraSys.camera;
      cam = new THREE.PerspectiveCamera(c.fov, 16 / 9, 0.1, 80);
      cam.position.copy(c.position); cam.quaternion.copy(c.quaternion);
    }
    cam.layers.enable(1);
    cam.updateMatrixWorld();
    const low = this.g.renderer.isLow;
    const hide = [this.julian.root, this.kayden.root, this.waiter.root, this.coupe, ...(world.vnHide || [])];
    const canvas = this.g.renderer.paintShot(cam, low ? 960 : 1600, low ? 540 : 900, { radius: low ? 3 : 5, hide });
    this.bgCache.set(cacheKey, canvas);
    return canvas;
  }

  // ------------------------------------------------------------------ ambient life

  startAmbient() {
    const token = ++this.tasks;
    const alive = () => this.tasks === token;
    // bartender & the regular at the bar chat
    (async () => {
      while (alive()) {
        await sleep(3 + Math.random() * 4);
        if (!alive()) return;
        const talkB = Math.random() < 0.5;
        this.bartender.setPose(talkB ? 'talk' : 'idle');
        this.patronB.setPose(talkB ? 'idle' : 'talk');
      }
    })();
    // second waiter drifts around the lounge
    (async () => {
      const spots = [{ x: 8.8, z: -2.2 }, { x: 7.0, z: -2.0 }, { x: 10.0, z: -2.1 }, { x: 6.6, z: -1.0 }];
      let i = 0;
      while (alive()) {
        await sleep(5 + Math.random() * 6);
        if (!alive() || this.g.state.stage === 'escape') return;
        i = (i + 1) % spots.length;
        await this.waiter2.walkTo(spots[i]);
        this.waiter2.face(Math.random() < 0.5 ? -1 : 1);
      }
    })();
    // the main waiter patrols near the bar until the cocktail
    (async () => {
      const spots = [{ x: 4.8, z: -2.15 }, { x: -0.5, z: -1.9 }, { x: 4.2, z: -1.4 }];
      let i = 0;
      while (alive()) {
        await sleep(7 + Math.random() * 6);
        if (!alive() || this.g.state.stage !== 'explore') continue;
        i = (i + 1) % spots.length;
        await this.waiter.walkTo(spots[i], { speed: 1.0 });
        this.waiter.face(-1);
      }
    })();
    // a regular wanders between the bar and the lounge
    (async () => {
      const W = this.wanderer;
      if (!W) return;
      const spots = [{ x: -2.6, z: 0.6 }, { x: 3.0, z: 1.2 }, { x: 5.6, z: 0.4 }, { x: -0.4, z: 1.4 }];
      let i = 0;
      while (alive()) {
        await sleep(6 + Math.random() * 8);
        if (!alive() || this.g.state.stage === 'escape') return;
        i = (i + 1) % spots.length;
        await W.walkTo(spots[i], { speed: 0.9 });
      }
    })();
    // a guest leaves after a while (door opens, cold air)
    (async () => {
      await sleep(55);
      if (!alive() || this.leaverGone || this.g.state.stage !== 'explore') return;
      this.g.audio.play('sfx.chair', { volume: 0.5 });
      await this.leaver.walkTo([{ x: 7.0, z: 1.0 }, { x: 0, z: 1.55 }, { x: -10.0, z: 1.2 }, { x: -11.6, z: -1.4 }, { x: -12.2, z: -2.6 }], { speed: 1.25 });
      if (!alive()) return;
      this.g.audio.play('sfx.door', { volume: 0.6 });
      this.leaver.setVisible(false);
      this.leaverGone = true;
    })();
  }

  stopAmbient() { this.tasks++; }

  // ------------------------------------------------------------------ per frame

  update(dt) {
    const g = this.g;
    this.updateMorning(dt);
    this.updateCustody(dt);
    this.updateInvestigation(dt);
    this.updateLizzie(dt);
    const J = this.julian;
    // Kayden calls out when Julian gets close the first time
    if (g.state.stage === 'explore' && !g.state.get('kayden_called') && J.position.x > -3.5) {
      g.state.set('kayden_called', true);
      this.kayden.setPose('talk');
      g.view.flash('kayden', DIALOGUES.kaydenWave.nodes.a.text, 3600).then(() => this.kayden.setPose('idle'));
    }
    if (this.escaping) {
      this.escapeT += dt;
      // everyone slowly turns to look at him
      for (const c of this.chars.values()) {
        if (c === J || c === this.owen) continue;
        if (Math.random() < dt * 0.6) c.faceTowards(J.position.x);
      }
      if (J.position.x < -4.4 || this.escapeT > 26) this.collapse();
    }
  }

  // ------------------------------------------------------------------ save / load

  save() {
    const J = this.julian;
    return {
      player: { x: J.position.x, z: J.position.z, facing: J.facing },
      leaverGone: this.leaverGone,
      owenVisible: this.owen.root.visible,
    };
  }

  async load(data) {
    const g = this.g;
    this.resetPositions();
    const st = g.state.stage;
    if (data?.leaverGone) { this.leaver.setVisible(false); this.leaverGone = true; }
    // a loaded stage casts its own people: nobody from a later (or earlier) scene stays standing
    // where the previous session left them
    for (const c of this.custodyCast?.values() || []) { c.stop?.(); c.setVisible(false); }
    this.clearCrowd?.();
    const a = this.scene.anchors;
    if (CUSTODY_STAGES.includes(st)) {
      await this.loadCustody(st);
      return;
    }
    if (LIZZIE_STAGES.includes(st)) {
      await this.loadLizzie(st);
      return;
    }
    if (HOME_STAGES.includes(st)) {
      await this.loadHome(st);
      return;
    }
    if (INVESTIGATION_STAGES.includes(st)) {
      await this.loadInvestigation(st);
      return;
    }
    if (st === 'morning' || st === 'police' || st === 'ended') {
      this.setupMorning();
      g.state.setStage('morning');
      this.julian.setLife('alive');
      this.julian.stand();
      this.julian.placeAt(data?.player?.x ?? 0, data?.player?.z ?? 0.9, data?.player?.facing ?? 1);
      this.julian.dizzy = 0.15;
      g.hud.show(true);
      g.player.enabled = true;
      g.cameraSys.setShot(null, 1);
      g.cameraSys.snap();
      await g.fader.to(false, 1500);
      if (st !== 'morning') this.policeArrival();
      else if (g.state.get('kaydenDeathDiscovered')) this.checkPolice();
      return;
    }
    if (st === 'explore') {
      this.julian.placeAt(data?.player?.x ?? this.scene.spawns.player.x, data?.player?.z ?? 0.6, data?.player?.facing ?? 1);
      g.hud.show(true);
      g.player.enabled = true;
      g.cameraSys.setShot(null, 1);
      g.cameraSys.snap();
      await g.fader.to(false, 1200);
      return;
    }
    // conversation stages: resume from the last checkpoint
    this.julian.sit(a.julianSeat, 1);
    g.state.set('sat_down', true);
    g.cameraSys.setShot({ x: 1.6, y: 2.1, z: 7.6, lookX: 1.6, lookY: 1.05, lookZ: 0, fov: 30 }, 1);
    g.cameraSys.snap();
    if (g.state.get('drank_cocktail')) {
      this.coupe.position.copy(a.coupeSpot);
      this.coupe.userData.setEmpty(true);
      this.coupe.visible = true;
    }
    if (g.state.get('owen_left')) this.owen.setVisible(false);
    const phase = g.state.get('phase', 1);
    g.hallucination.setPhase(st === 'escape' || st === 'ended' ? Math.min(4, phase) : phase);
    await g.fader.to(false, 1200);
    if (st === 'escape') { await this.escape(); return; }
    const cp = g.dialogue.checkpoint;
    await this.runMain(cp?.dialogue === 'main' ? cp.node : undefined);
  }
}

installMorning(BarStory);
installCustody(BarStory);
installInvestigation(BarStory);
installLizzie(BarStory);
installPlaces(BarStory);
installHome(BarStory);
