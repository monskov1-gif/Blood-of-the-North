import * as THREE from 'three';
import { sleep } from './Director.js';

/**
 * The Reeds' apartment (v0.14): living room + kitchen, Julian's bedroom, Lizzie's attic —
 * three locations joined by doors (src/story/Places.js).
 *   lzHome()      — L1 prologue, Wednesday 3 November, evening: Julian tells Lizzie about the
 *                   valley case at the kitchen table; she copies his photos and pins the map.
 *   startHome(1)  — chapter 5 → 6: Julian comes home after the discharge, at night; her room,
 *                   her map with a fourth pin.
 *   startHome(2)  — chapter 7 → 8: the morning he sets out on his own investigation (both routes).
 */

export const HOME_STAGES = ['home_1', 'home_2'];

const methods = {
  /** Interactable `at` in front of an anchor, inside the walkable strip. */
  homeAt(a, fallbackX = 0) {
    const area = this.g.world.bounds.walk.areas?.[0] || { minZ: -2, maxZ: 0.8 };
    const x = a?.x ?? fallbackX;
    const z = THREE.MathUtils.clamp((a?.z ?? -2) + 0.9, area.minZ + 0.15, area.maxZ - 0.15);
    return { at: { x, z }, anchor: a || new THREE.Vector3(x, 1.5, -2) };
  },

  /** Builds interactables from [anchorKey, label, run] rows; rows whose anchor is missing are skipped. */
  homeItems(rows) {
    const A = this.g.world.anchors || {};
    return rows.filter(([k]) => A[k]).map(([k, label, run, radius]) => ({ id: `home_${this.g.locationId}_${k}`, label, ...this.homeAt(A[k]), radius: radius ?? 0.75, run }));
  },

  /** The VN background for talks in the flat: the kitchen table. */
  homeShot() {
    const w = this.g.world;
    const t = w.anchors?.table || new THREE.Vector3(0, 1.2, -2);
    w.shots = { ...(w.shots || {}), home: { fov: 36, pos: [t.x - 0.4, 1.55, 2.8], look: [t.x + 0.2, 1.25, t.z - 0.6] } };
  },

  // ------------------------------------------------------------------ L1 prologue (Lizzie)

  async lzHome() {
    const g = this.g;
    const S = this.session;
    const say = (id) => () => g.dialogue.start(id);
    const f = () => g.state.flags;
    await this.lzEnter('apartment', 'evening', 'lizzie_1');
    if (S !== this.session) return false;
    const w = g.world, L = this.julian, sp = w.spots || {};
    const e = sp.entry || { x: -3, z: -0.6 };
    L.placeAt(e.x, e.z, 1);
    this.homeShot();
    // Julian at the kitchen table, over the case photos
    const st = sp.kitchenStand || { x: (w.anchors.table?.x ?? 2) + 0.6, z: -1.4 };
    const jul = this.lzCastIn('julianL', 'lz_julian_home', st.x, st.z, st.facing ?? -1);
    jul.setPose('think');
    this.lzHomeJul = jul;
    this.setAmbience(['amb.room']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1400);
    if (!(await this.lines(g.dialogue.dialogues.lh_open))) return false;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'lz_home');
    return new Promise((resolve) => {
      const talk = async () => {
        g.player.enabled = false;
        jul.faceTowards(L.position.x); jul.setPose('talk');
        await g.dialogue.start('lh_julian');
        if (S !== this.session) return;
        jul.setPose('idle');
        // he goes off to the shower: the folder stays open on the table
        const bd = (w.doors || []).find((d) => d.id === 'to_bedroom');
        const gone = jul.walkTo({ x: bd ? bd.x : st.x + 3, z: bd ? bd.z : -2 }, { speed: 1.2, direct: true }).then(() => jul.setVisible(false));
        await this.lines(g.dialogue.dialogues.lh_after);
        await gone;
        if (S !== this.session) return;
        g.state.set('objective', 'lz_upstairs');
        this.placeItems();
        g.player.enabled = true;
      };
      const sleepNow = async () => {
        if (!f().lh_pins) return g.dialogue.start('lh_bed_wait');
        g.player.enabled = false;
        g.hud.show(false);
        if (!(await this.lines(g.dialogue.dialogues.lh_night))) return;
        await g.fader.to(true, 1400);
        this.endPlace();
        resolve(S === this.session);
      };
      this.setPlace({
        state: { apartment: 'evening', apt_bedroom: 'evening', apt_attic: 'evening' },
        onEnter: (loc) => { if (loc === 'apartment') { this.homeShot(); jul.setVisible(!f().lh_talked); } },
        items: (loc) => {
          if (loc === 'apartment') {
            return this.homeItems([
              ['table', f().lh_talked ? 'Фото по делу' : 'Джул', () => (f().lh_talked ? g.dialogue.start('lh_photos') : talk()), 1.0],
              ['fridge', 'Холодильник', say('lh_fridge')], ['photo', 'Фото на стене', say('lh_photo')],
              ['coat', 'Вешалка', say('lh_coat')], ['window', 'Окно', say('lh_window')],
              ['tv', 'Телевизор', say('lh_tv')], ['sofa', 'Диван', say('lh_sofa')],
            ]);
          }
          if (loc === 'apt_bedroom') return this.homeItems([['board', 'Доска', say('lh_board')], ['mirror', 'Зеркало', say('lh_mirror')], ['bed', 'Кровать', say('lh_jbed')]]);
          if (loc === 'apt_attic') {
            return this.homeItems([
              ['map', 'Карта', say('lh_map')], ['desk', 'Стол', say('lh_desk')], ['camera', 'Фотоаппарат', say('lh_camera')],
              ['posters', 'Бабочки', say('lh_posters')], ['window', 'Окно', say('lh_awindow')], ['bed', 'Спать', sleepNow],
            ]);
          }
          return [];
        },
        door: (d) => {
          if (d.id === 'front') return 'lh_door_wait';
          if ((d.id === 'to_attic' || d.id === 'to_bedroom') && !f().lh_talked) return 'lh_need_talk';
          if (d.id === 'to_bedroom' && f().lh_talked) return null;
          return null;
        },
      });
    });
  },

  // ------------------------------------------------------------------ Julian at home

  async startHome(n) {
    const g = this.g;
    const S = this.session;
    const say = (id) => () => g.dialogue.start(id);
    const f = () => g.state.flags;
    const night = n === 1;
    g.fader.set(true);
    await this.enter('apartment', night ? 'night' : 'day', `home_${n}`);
    if (S !== this.session) return;
    const w = g.world, J = this.julian, sp = w.spots || {};
    const e = sp.entry || { x: -3, z: -0.6 };
    J.placeAt(e.x, e.z, 1);
    this.homeShot();
    this.setAmbience(['amb.room']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.card.show(night ? 'Дом' : 'Утро', { en: night ? 'Home' : 'Morning', sub: night ? 'НОЧЬ ПОСЛЕ ВЫПИСКИ' : 'ДОМ · ДО РАССВЕТА НЕ СПАЛ', ms: 2000 });
    if (S !== this.session) return;
    g.audio.play('sfx.door', { volume: 0.5 });
    await g.fader.to(false, 1600);
    if (!(await this.lines(g.dialogue.dialogues[night ? 'jh1_open' : 'jh2_open']))) return;
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', night ? 'jh_attic' : 'jh_out');
    const done = new Promise((resolve) => {
      const finish = async () => {
        if (this.homeLeaving) return;
        this.homeLeaving = true;
        g.player.enabled = false;
        g.hud.show(false);
        const route = g.state.get('investigation_route');
        const lines = night ? 'jh1_end' : route === 'WEREWOLF' ? 'jh2_go_wolf' : 'jh2_go_vampire';
        await this.lines(g.dialogue.dialogues[lines]);
        await g.fader.to(true, 1800);
        this.homeLeaving = false;
        this.endPlace();
        resolve(S === this.session);
      };
      // night: once her desk and her map are seen, he knows enough
      const attic = (id) => async () => { await g.dialogue.start(id); if (night && f().jh1_map && f().jh1_desk) finish(); };
      const J1 = (id) => say(`jh1_${id}`);
      this.setPlace({
        state: { apartment: night ? 'night' : 'day', apt_bedroom: night ? 'night' : 'day', apt_attic: night ? 'night' : 'day' },
        onEnter: (loc) => { if (loc === 'apartment') this.homeShot(); },
        items: (loc) => {
          if (loc === 'apartment') {
            const p = night ? 'jh1' : 'jh2';
            return this.homeItems([
              ['table', 'Стол', say(`${p}_table`), 1.0], ['fridge', 'Холодильник', say(`${p}_fridge`)], ['photo', 'Фото на стене', say(`${p}_photo`)],
              ['coat', 'Вешалка', say(`${p}_coat`)], ['window', 'Окно', say(`${p}_window`)], ['tv', 'Телевизор', say(`${p}_tv`)], ['sofa', 'Диван', say(`${p}_sofa`)],
            ]);
          }
          if (loc === 'apt_bedroom') return this.homeItems([['board', 'Доска', J1('board')], ['mirror', 'Зеркало', J1('mirror')], ['bed', 'Кровать', J1('jbed')]]);
          if (loc === 'apt_attic') {
            return this.homeItems([
              ['map', 'Карта', attic('jh1_map')], ['desk', 'Стол', attic('jh1_desk')], ['camera', 'Фотоаппарат', J1('camera')],
              ['posters', 'Бабочки', J1('posters')], ['window', 'Окно', J1('awindow')], ['bed', 'Её кровать', J1('bed')],
            ]);
          }
          return [];
        },
        door: (d) => {
          if (d.id !== 'front') return null;
          if (night) return 'jh1_need';
          return f().jh2_ready ? finish : 'jh2_door_wait';
        },
      });
    });
    if (!(await done)) return;
    if (night) return this.startStationReturn();
    const route = g.state.get('investigation_route');
    return route === 'WEREWOLF' ? this.startForest() : this.vampireChain();
  },

  async loadHome(stage) {
    this.bump();
    await this.g.dialogue.abort();
    this.homeLeaving = false;
    await this.startHome(+stage.slice(-1));
  },
};

export function installHome(Story) {
  for (const [k, v] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
    Object.defineProperty(Story.prototype, k, v);
  }
}
