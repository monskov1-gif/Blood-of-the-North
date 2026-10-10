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
  1: ['След', 'The Trail', 'ЗА НЕСКОЛЬКО НЕДЕЛЬ ДО · СРЕДА, 3 НОЯБРЯ', 'Глава 2 · Лиззи'],
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

  /**
   * Lay someone down on the cave floor where the body reads: out of the back-wall rubble (the
   * sprite lies in the screen plane, so anything behind or under it cuts it), on the open floor,
   * clear of the boulders, lifted over the floor relief.
   */
  lzLie(ch, dir = 1) {
    const w = this.g.world;
    ch.lieDown(dir);
    const areas = w.bounds?.walk?.areas || [];
    const x = ch.position.x;
    const a = areas.find((r) => x >= r.minX && x <= r.maxX) || areas[0];
    let z = ch.position.z;
    if (a) z = Math.min(a.maxZ - 0.15, Math.max(z, a.minZ + 0.9));
    // the body spans ~1.7 m to one side of its feet: slide it off any boulder in that span
    let nx = x;
    for (const c of w.colliders || []) {
      const cx0 = Math.min(nx, nx + dir * 1.7), cx1 = Math.max(nx, nx + dir * 1.7);
      if (c.x + c.r > cx0 && c.x - c.r < cx1 && Math.abs(c.z - z) < c.r + 0.35) z = Math.min(a ? a.maxZ - 0.15 : z + 0.6, c.z + c.r + 0.4);
    }
    ch.root.position.set(nx, ch.root.position.y || 0, z);
    if ((ch.root.position.y || 0) < 0.08) ch.root.position.y = 0.08;
    return ch;
  },

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
    // a step back in time, said loud and clear: Lizzie's line starts a month before the bar
    g.fader.set(true);
    await g.card.show('Несколько недель назад', { en: 'Several weeks earlier', sub: 'ЗА МЕСЯЦ ДО НОЧИ В «СЕВЕРНОЙ РОЗЕ»', ms: 2800, style: 'chapter-b' });
    if (S !== this.session) return;
    // the evening before: at home, Julian's case on the kitchen table (src/story/HomeSequence.js)
    if (!g.state.get('lh_done')) {
      if (!(await this.lzHome()) || S !== this.session) return;
      g.state.set('lh_done', true);
      g.fader.set(true);
      await g.card.show('Пятница', { en: 'Friday', sub: '5 НОЯБРЯ · ШКОЛА', ms: 1700 });
      if (S !== this.session) return;
    }
    await this.lzEnter('school', null, 'lizzie_1');
    const L = this.julian;
    L.placeAt(-3.4, -0.6, 1);
    g.narrative.setChar('lizzie', 'curious');
    this.setAmbience(['amb.room']);
    g.hud.show(false);
    g.player.enabled = false;
    // the girls wait in the cafeteria (CafeteriaScene); the corridor is full of the last break
    const pu = this.lzCastIn('puriel', 'lz_puriel', 0, -2.2, -1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 0, -2.4, -1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 0, -2.1, -1);
    this.lzCast = { pu, ol, vi };
    const seatGirls = () => {
      const w = g.world;
      const t = w.spots?.girlsTable || { x: 3.2, z: -2.3 };
      for (const [i, c] of [pu, ol, vi].entries()) {
        w.root.add(c.root); c.setVisible(true);
        c.placeAt(t.x + (i - 1) * 0.75, t.z - 0.05 * i, i === 0 ? 1 : -1);
      }
      w.shots = { ...(w.shots || {}), school: { fov: 34, pos: [t.x - 0.5, 1.55, 2.6], look: [t.x + 0.2, 1.3, t.z - 0.4] } };
    };
    [pu, ol, vi].forEach((c) => c.setVisible(false));
    this.schoolCrowd('school');
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
        this.endPlace();
        await this.lzL1Sites();
        resolve();
      };
      this.setPlace({
        onEnter: (loc) => {
          this.schoolCrowd(loc);
          if (loc === 'cafeteria') seatGirls();
          else [pu, ol, vi].forEach((c) => c.setVisible(false));
        },
        items: (loc) => {
          const w = g.world;
          if (loc === 'school') {
            return [
              { id: 'l1_window', label: 'Окно', at: { x: -4.6, z: -2.0 }, radius: 0.9, anchor: w.anchors.window, run: this.lzSay('l1_window') },
              { id: 'l1_trophy', label: 'Кубки', at: { x: -7.2, z: -2.0 }, radius: 0.8, anchor: w.anchors.trophy, run: this.lzSay('l1_trophy') },
              { id: 'l1_lockers', label: 'Мой шкафчик', at: { x: -1.6, z: -2.0 }, radius: 0.6, anchor: w.anchors.lockers, run: this.lzSay('l1_lockers') },
              { id: 'l1_board', label: 'Доска объявлений', at: { x: 6.0, z: -1.6 }, radius: 0.5, anchor: w.anchors.board, run: this.lzSay('l1_board') },
              { id: 'l1_exit', label: 'Выход', at: { x: -9.0, z: -2.0 }, radius: 0.9, anchor: w.anchors.exit, run: () => g.dialogue.start('l1_exit_wait') },
            ];
          }
          if (loc === 'cafeteria') {
            const t = w.spots?.girlsTable || { x: 3.2, z: -2.3 };
            const A = w.anchors || {};
            const it = [{ id: 'l1_girls', label: 'Девочки', at: { x: t.x - 1.3, z: -1.4 }, radius: 1.1, anchor: new THREE.Vector3(t.x, 1.9, t.z), run: talk }];
            if (A.menu) it.push({ id: 'l1_menu', label: 'Меню', at: { x: A.menu.x, z: -1.6 }, radius: 0.7, anchor: A.menu, run: this.lzSay('l1_menu') });
            if (A.banner) it.push({ id: 'l1_banner', label: 'Плакат', at: { x: A.banner.x, z: -1.6 }, radius: 0.7, anchor: A.banner, run: this.lzSay('l1_banner') });
            if (A.vending) it.push({ id: 'l1_vending', label: 'Автомат', at: { x: A.vending.x, z: -1.6 }, radius: 0.7, anchor: A.vending, run: this.lzSay('l1_vending') });
            return it;
          }
          return [];
        },
      });
    });
  },

  async lzL1Sites() {
    const g = this.g;
    const S = this.session;
    const { pu, ol, vi } = this.lzCast;
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
      this.lzFollow = null;
      this.lzSearch = null;
      // each site is its own stretch of the bank: she can't walk on up the river on her own —
      // the girls take her to the next place when this one is done
      const SPAN = { 1: [-11.8, -3.2], 2: [8.6, 17.4], 3: [18.4, 26.6] }[n];
      const walk = { areas: [{ minX: SPAN[0], maxX: SPAN[1], minZ: -2.3, maxZ: 1.5 }] };
      g.world.bounds.walk = walk;
      g.nav.set(walk, g.world.colliders);
      g.cameraSys.setBounds({ minX: SPAN[0] + 3.2, maxX: Math.max(SPAN[0] + 3.2, SPAN[1] - 3.2) });
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
    ], { x: -3.6, label: 'Дальше, на север' }, () => ['bones', 'claws', 'sapling'].filter(photo).length >= 2, null, { girls: [pu, ol, vi] });
    if (S !== this.session) return;
    // site 2 — further north: carcasses, ravens
    if (!(await site(2, 10.2, 'СЕВЕРНЕЕ · ВОСКРЕСЕНЬЕ'))) return;
    if (!(await this.lines(g.dialogue.dialogues.l1_siteB))) return;
    await this.lzExplore([
      { id: 'l1_carcass', label: 'Туши', at: { x: 13.4, z: -1.8 }, radius: 0.9, anchor: w().anchors.siteB.carcass, run: this.lzSay('l1_carcass') },
      { id: 'l1_ravens', label: 'Вороны', at: { x: 15.4, z: -1.8 }, radius: 0.8, anchor: w().anchors.siteB.ravens, run: this.lzSay('l1_ravens') },
    ], { x: 18.2, label: 'Дальше, на север' }, () => ['carcass', 'ravens'].some(photo), null, { girls: [pu, ol, vi] });
    if (S !== this.session) return;
    // site 3 — north: fresh tracks, the map
    if (!(await site(3, 20.0, 'СЕВЕР · ПОНЕДЕЛЬНИК'))) return;
    if (!(await this.lines(g.dialogue.dialogues.l1_siteC))) return;
    await this.lzExplore([
      { id: 'l1_tracks', label: 'Следы', at: { x: 23.6, z: -1.4 }, radius: 0.9, anchor: w().anchors.siteC.tracks, run: this.lzSay('l1_tracks') },
    ], { x: 25.6, label: 'Карта', run: () => g.dialogue.start('l1_mapTime') }, () => photo('tracks'), () => g.state.get('lz_map_done'), { girls: [pu, ol, vi] });
    if (S !== this.session) return;
    g.player.enabled = false;
    if (!(await this.lines(g.dialogue.dialogues.l1_after))) return;
    await g.fader.to(true, 1400);
  },

  /**
   * Free exploration with a gate: `items` are the clues, `gate` the way on (shown once `ready()`);
   * resolves when the gate is used (or `done()` turns true).
   */
  lzExplore(items, gate, ready, done, { girls } = {}) {
    const g = this.g;
    g.hud.show(true);
    g.player.enabled = true;
    if (girls) this.lzSearchStart(girls, items);
    return new Promise((resolve) => {
      const go = { id: `lz_gate_${gate.x}`, label: gate.label, at: { x: gate.x, z: 0.0 }, radius: 1.0, anchor: V(gate.x + 0.4, 1.4, -0.4),
        run: async () => {
          if (!ready()) { await g.dialogue.start('l1_needPhotos'); return; }
          if (gate.run) { await gate.run(); if (done && !done()) return; }
          g.interactions.setItems([]);
          this.lzSearch = null;
          resolve();
        } };
      // each clue is photographed once; when enough are in, the way on opens by itself (the girls
      // call her on) — the player never has to hunt for an invisible gate
      let moving = false;
      const advance = async () => {
        if (moving || !ready()) return;
        moving = true;
        await sleep(0.6);
        if (g.dialogue.busy) await new Promise((r) => { const t = setInterval(() => { if (!g.dialogue.busy) { clearInterval(t); r(); } }, 200); });
        await this.lines(gate.run ? [['olivia', 'Рид, доставай карту. Отметим всё, пока не стемнело.']] : [['vikki', 'Всё, Рид, хватит. Идём дальше, пока светло.'], ['lthought', 'Дальше — вдоль реки, на север.']]);
        await go.run();
        moving = false;
      };
      const clues = items.map((it) => ({ ...it, once: true, run: async (x) => { await it.run(x); advance(); } }));
      g.interactions.setItems(clues);
    });
  },

  /**
   * The girls search on their own: each walks her own route between the clues, stops, looks,
   * points. When the player has found nothing new for a while, the girl nearest to a clue still
   * unfound walks up to it and calls Lizzie over.
   */
  lzSearchStart(girls, items) {
    const g = this.g;
    this.lzFollow = null;
    const CALL = {
      lz_puriel: ['puriel', 'Рид! Иди сюда — тут что-то есть!'],
      lz_olivia: ['olivia', 'Лиззи… посмотри. Вот здесь.'],
      lz_vikki: ['vikki', 'Эй, детектив. Не это ищешь?'],
    };
    const S = this.session;
    const found = () => items.filter((it) => g.state.interacted.has(it.id)).length;
    const st = this.lzSearch = { t: 0, last: 0, n: found(), calling: null };
    girls.forEach((f, i) => {
      (async () => {
        await sleep(0.5 + i * 0.7);
        while (this.lzSearch === st && S === this.session) {
          if (st.calling === f) { await sleep(1); continue; }
          // her own route: from clue to clue, a step aside, a look
          const it = items[(i + Math.floor(Math.random() * items.length)) % items.length];
          const tx = it.at.x + (Math.random() - 0.5) * 2.4 + (i - 1) * 0.6;
          const tz = Math.max(-2.0, Math.min(1.0, it.at.z + 0.4 + (Math.random() - 0.5) * 1.2));
          await f.walkTo({ x: tx, z: tz }, { speed: 0.9 + Math.random() * 0.4, direct: true });
          if (this.lzSearch !== st) break;
          f.faceTowards(it.at.x);
          if (Math.random() < 0.4 && f.poses.talk) { f.setPose('talk'); await sleep(1.2); f.setPose('idle'); }
          await sleep(2 + Math.random() * 4);
        }
      })();
    });
    st.tick = (dt) => {
      st.t += dt;
      const n = found();
      if (n !== st.n) { st.n = n; st.last = st.t; if (st.calling) { st.calling.setPose('idle'); st.calling = null; } }
      if (st.calling || g.dialogue.busy || !g.player.enabled || st.t - st.last < (globalThis.__lzHelpAfter ?? 28)) return;
      const left = items.filter((it) => !g.state.interacted.has(it.id));
      if (!left.length) return;
      const L = this.julian;
      const it = left.sort((a, b) => Math.abs(a.at.x - L.position.x) - Math.abs(b.at.x - L.position.x))[0];
      const f = girls.filter((c) => c.root.visible).sort((a, b) => Math.abs(a.position.x - it.at.x) - Math.abs(b.position.x - it.at.x))[0];
      if (!f) return;
      st.calling = f;
      st.last = st.t;
      f.walkTo({ x: it.at.x + 0.5, z: Math.min(1.0, it.at.z + 0.5) }, { speed: 1.8, direct: true }).then(() => {
        if (this.lzSearch !== st) return;
        f.faceTowards(L.position.x);
        if (f.poses.talk) f.setPose('talk');
        const [who, text] = CALL[f.def?.id || f.id] || ['puriel', 'Лиззи! Сюда!'];
        this.lines([[who, text]], { blocking: false });
        g.audio.play('sfx.step', { volume: 0.3 });
      });
    };
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
    // a herd, not a row: bunched, at different depths, heads up and down, facing both ways
    const hx = [0.6, 1.5, 2.1, 2.9, 3.6, 4.3, 5.0, 5.7, 6.6], hz = [-3.4, -2.9, -3.95, -3.15, -4.3, -2.8, -3.65, -4.05, -3.0];
    const hs = [1.0, 0.9, 1.08, 0.86, 1.04, 0.95, 1.1, 0.88, 1.0], hf = [1, -1, 1, 1, -1, 1, -1, 1, -1], hg = [0, 1, 0, 1, 1, 0, 0, 1, 0];
    for (let i = 0; i < 9; i++) deer.push(w.critter('deer', hx[i], hz[i], i % 2));
    for (let i = 0; i < 6; i++) w.critter('hare', -1.5 + i * 1.6 + (i % 2) * 0.4, -2.6 - (i % 3) * 0.35, i);
    deer.forEach((d, i) => { if (hg[i]) d.userData.setPose('graze'); d.scale.set(hf[i] * hs[i], hs[i], 1); });
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
    // they all run — Puriel is the fastest and the furthest out, so he goes for her first;
    // Olivia and Vicky scatter the other ways, Lizzie stumbles after them
    this.lzFollow = null;
    for (const c of [pu, ol, vi]) c.setPose('idle');
    pu.faceTowards(-14);
    const puRun = pu.walkTo({ x: -14.5, z: 1.2 }, { speed: 3.6, direct: true });
    ol.faceTowards(-14); ol.walkTo({ x: -13.0, z: -1.6 }, { speed: 3.1, direct: true });
    vi.faceTowards(-14); vi.walkTo({ x: -15.0, z: 0.4 }, { speed: 3.3, direct: true });
    L.face(-1); L.walkTo({ x: L.position.x - 2.4, z: L.position.z + 0.2 }, { speed: 2.6, direct: true });
    await sleep(0.4);
    const chase = dark.walkTo({ x: -14.0, z: 1.0 }, { speed: 7.5, direct: true });
    await Promise.race([puRun, chase]);
    g.audio.play('sfx.shouts', { volume: 0.8 });
    g.narrative.setChar('puriel', 'attacked');
    pu.setVisible(false); dark.setVisible(false);
    // the rest of the pack cuts the others off
    const prey = [ol, vi, L];
    wolves.slice(1).forEach((wf, i) => { const t = prey[i % prey.length]; wf.setPose('idle'); wf.walkTo({ x: t.position.x + 0.8, z: t.position.z - 0.3 }, { speed: 6.5, direct: true }); });
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

  // ------------------------------------------------------------------ the cave (L3–L5)

  /** The chambers of the cave (src/world/scenes/CaveScene.js + CaveRooms.js). */
  lzCaveRooms() { return ['cave', 'cave_den', 'cave_deep', 'cave_altar', 'cave_store', 'cave_tunnel', 'cave_rift']; },

  /** A new chapter in the cave: no blood left over from the last time in any chamber. */
  lzCaveReset() {
    for (const [id, w] of this.g.locations || []) if (id.startsWith('cave')) { w.clearBlood?.(); w.state = null; }
  },

  /** The scene state every chamber opens in from now on (and the one we are in, right away). */
  lzCaveSetState(st) {
    this.lzCaveState = st;
    if (this.place?.state) for (const id of this.lzCaveRooms()) this.place.state[id] = st;
    this.g.world.setState?.(st);
  },

  /**
   * The chapter's life in the cave: its interactables per chamber, who is where when the player
   * comes in, and which passages are shut (gate returns a bark id). Open passages lead through
   * lzCaveGo (a short fade, footsteps on sand — no door sound in the rock).
   */
  lzCavePlace(st, { items, onEnter, gate }) {
    this.lzCaveState = st;
    this.setPlace({
      state: Object.fromEntries(this.lzCaveRooms().map((id) => [id, st])),
      items: (loc) => items(loc) || [],
      onEnter: (loc) => onEnter?.(loc),
      door: (d) => gate?.(d) || (() => this.lzCaveGo(d.to, d.spawn)),
    });
  },

  /** Through a passage into the next chamber. */
  async lzCaveGo(to, spawn = {}, ms = 380) {
    const g = this.g;
    const S = this.session;
    const L = this.julian;
    if (this.traveling) return false;
    this.traveling = true;
    g.player.enabled = false;
    L.stop?.();
    g.audio.play('sfx.step', { volume: 0.5 });
    await g.fader.to(true, ms);
    if (S !== this.session) { this.traveling = false; return false; }
    g.interactions.setItems([]);
    this.lzWatch = null;
    await g.setLocation(to, { state: this.place?.state?.[to] ?? this.lzCaveState });
    g.world.followTarget = () => L;
    L.root.position.y = 0;
    L.stand();
    L.placeAt(spawn.x ?? 0, spawn.z ?? -0.8, spawn.facing ?? 1);
    g.cameraSys.setShot(null, 0);
    g.cameraSys.snap();
    await this.place?.onEnter?.(to);
    if (S !== this.session) { this.traveling = false; return false; }
    if (this.place) this.placeItems();
    await sleep(0.05);
    await g.fader.to(false, ms + 120);
    this.traveling = false;
    if (S === this.session && !g.dialogue.busy && !this.lzHold) g.player.enabled = true;
    return true;
  },

  /** An interactable in a cave chamber. */
  lzIt(id, label, x, z, anchor, run, radius = 0.9) {
    return { id, label, at: { x, z }, radius, anchor: anchor || V(x, 1.0, z - 0.4), run };
  },

  /** Companions put just behind Lizzie (after a passage): [[character key, cast id], …]. */
  lzBehind(list) {
    const L = this.julian;
    list.forEach(([key, id], i) => {
      this.lzCastIn(key, id, L.position.x - L.facing * (0.9 + i * 0.8), Math.max(-1.9, Math.min(0.8, L.position.z + (i % 2 ? 0.4 : -0.3))), L.facing);
    });
  },

  // ------------------------------------------------------------------ L3 — ПЕЩЕРА

  async lizzieL3() {
    const g = this.g;
    const S = this.session;
    await this.lzCard(3);
    if (S !== this.session) return;
    this.lzHold = false;
    this.lzCaveReset();
    await this.lzEnter('cave', 'L3', 'lizzie_3');
    const L = this.julian;
    const A = () => g.world.anchors;
    L.placeAt(A().bedL.x, A().bedL.z, 1);
    this.lzLie(L, 1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 6.2, -1.4, -1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 7.3, -1.0, -1);
    this.lzCast = { ol, vi, guards: [] };
    this.setAmbience(['amb.oldwing']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1800);
    await L.riseUp(1.4);
    if (S !== this.session) return;
    if (!(await this.lines(g.dialogue.dialogues.l3_wake))) return;
    g.narrative.setChar('bob', 'hostile_neutral');

    // the chapter moves through phases: day (look around) → night (find Puriel) → back → escape
    let phase = 'day';
    let next = null;
    const wait = () => new Promise((r) => { next = r; });
    const go = () => { const r = next; next = null; r?.(); };
    const f = (k) => g.state.get(k);
    const looked = () => f('lz_l3_store') && f('lz_l3_guards') && ['lz_l3_den', 'lz_l3_deep', 'lz_l3_food', 'lz_l3_beds', 'lz_l3_bucket', 'lz_l3_ashes'].some(f);
    const bark = (id) => async () => {
      await g.dialogue.start(id);
      if (phase === 'day' && looked() && g.state.get('objective') === 'lz_cave') g.state.set('objective', 'lz_l3_girls');
    };
    const girlsDay = () => { this.lzCastIn('olivia', 'lz_olivia', 6.2, -1.4, -1); this.lzCastIn('vikki', 'lz_vikki', 7.3, -1.0, -1); };
    const girlsAsleep = () => { this.lzLie(this.lzCastIn('olivia', 'lz_olivia', 5.5, -0.9, 1), -1); this.lzLie(this.lzCastIn('vikki', 'lz_vikki', 8.7, -0.5, 1), 1); };
    const items = (loc) => {
      const a = A();
      switch (loc) {
        case 'cave':
          if (phase === 'day') {
            return [
              this.lzIt('l3_beds', 'Солома', 5.0, -1.8, a.beds, bark('l3_beds')),
              this.lzIt('l3_food', 'Еда', 8.0, -1.8, a.food, bark('l3_food')),
              this.lzIt('l3_bucket', 'Ведро', 2.6, -1.1, a.bucket, bark('l3_bucket'), 0.8),
              this.lzIt('l3_ashes', 'Кострище', -7.2, -0.7, a.ashes, bark('l3_ashes')),
              this.lzIt('l3_girls', 'Оливия и Викки', 6.8, -0.8, V(6.8, 1.9, -1.2), async () => {
                if (!looked()) { await g.dialogue.start('l3_look_more'); return; }
                await g.dialogue.start('l3_girls');
                go();
              }, 1.0),
            ];
          }
          if (phase === 'night') return [this.lzIt('l3_sleeping', 'Оливия и Викки', 7.6, -0.9, V(7.6, 1.0, -1.4), bark('l3_sleeping'), 1.1), this.lzIt('l3_ashes', 'Кострище', -7.2, -0.7, a.ashes, bark('l3_ashes'))];
          if (phase === 'back') return [this.lzIt('l3_tell', 'Оливия и Викки', 7.6, -0.9, V(7.6, 1.0, -1.4), () => go(), 1.1)];
          return [];
        case 'cave_den':
          return [
            this.lzIt('l3_den_furs', 'Шкуры', -4.4, -0.1, a.furs, bark('l3_den_furs')),
            this.lzIt('l3_den_bones', 'Кости', -7.4, -1.7, a.bones, bark('l3_den_bones')),
            this.lzIt('l3_den_carcass', 'Олень', -3.9, -1.5, a.carcass, bark('l3_den_carcass')),
            this.lzIt('l3_den_clothes', 'Одежда', 1.7, -1.8, a.clothes, bark('l3_den_clothes')),
            this.lzIt('l3_den_marks', 'Зарубки', 5.2, -1.8, a.marks, bark('l3_den_marks')),
          ];
        case 'cave_deep':
          return [
            this.lzIt('l3_deep_claws', 'Борозды', -1.6, -1.3, a.claws, bark('l3_deep_claws')),
            this.lzIt('l3_deep_pool', 'Вода', 1.0, -0.2, a.pool, bark('l3_deep_pool')),
          ];
        case 'cave_store':
          return [
            this.lzIt('l3_store', 'Рюкзаки', -1.8, -1.8, a.packs, bark('l3_store')),
            this.lzIt('l3_store_phone', 'Телефон', -2.6, -1.3, a.phone, bark('l3_store_phone'), 0.7),
            this.lzIt('l3_store_tent', 'Палатка', 1.9, -1.7, a.tent, bark('l3_store_tent')),
            this.lzIt('l3_bones', 'Кости', 3.9, -1.7, a.bones, bark('l3_bones')),
          ];
        case 'cave_tunnel':
          return [
            this.lzIt('l3_tunnel_moon', 'Луна', 6.6, -0.4, a.mouth, bark('l3_tunnel_moon')),
            this.lzIt('l3_guards', 'Выход', 9.2, -0.6, V(11.4, 1.6, -0.8), bark(phase === 'day' ? 'l3_guards' : 'l3_guards_night'), 1.1),
          ];
        case 'cave_rift':
          return [
            this.lzIt('l3_rift_crack', 'Щель в своде', -1.3, -0.7, a.crack, bark('l3_rift_crack')),
            this.lzIt('l3_rift_nails', 'Царапины', -2.6, -1.4, a.nails, bark('l3_rift_nails'), 0.8),
            this.lzIt('l3_rift_pool', 'Вода', 1.6, -0.4, a.pool, bark('l3_rift_pool'), 0.8),
          ];
        default: return [];
      }
    };
    const onEnter = (loc) => {
      if (loc === 'cave') {
        if (phase === 'day') girlsDay();
        else if (phase === 'night' || phase === 'back') girlsAsleep();
      }
      if (loc === 'cave_tunnel') {
        this.lzCast.guards = A().guards.map((p, i) => {
          const wf = this.lzCastIn(i ? 'wolfGrey' : 'wolf', `lz_guard${i}`, p.x, p.z, -1);
          wf.root.scale.setScalar(1.25);
          wf.setPose(phase === 'day' ? 'eat' : 'idle');
          return wf;
        });
        if (phase === 'escape') this.lzWatch = () => { if (L.position.x > 7.2 && !g.dialogue.busy && !this.traveling) { this.lzWatch = null; go(); } };
      }
      if (loc === 'cave_rift' && phase !== 'day') {
        const pu = this.lzCastIn('puriel', 'lz_puriel', A().puriel.x, A().puriel.z, -1);
        this.lzLie(pu, -1);
        this.lzCast.pu = pu;
        if (phase === 'night') this.lzWatch = () => { if (L.position.x < -1.6 && !g.dialogue.busy && !this.traveling) { this.lzWatch = null; go(); } };
      }
      if (phase === 'escape') this.lzBehind([['olivia', 'lz_olivia'], ['vikki', 'lz_vikki']]);
    };
    const gate = (d) => {
      if (phase === 'day' && d.id === 'tunnel_rift') return 'l3_rift_day';
      if (d.id === 'deep_altar') return 'l3_deep_dark';
      if (phase === 'night' && d.id === 'hall_den') return 'l3_not_now';
      if (phase === 'back' && (d.id === 'hall_den' || d.id === 'hall_deep')) return 'l3_back_first';
      return null;
    };
    this.lzCavePlace('L3', { items, onEnter, gate });
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', looked() ? 'lz_l3_girls' : 'lz_cave');
    await wait();
    if (S !== this.session) return;

    // night
    g.interactions.setItems([]);
    g.player.enabled = false;
    this.lzHold = true;
    await g.fader.to(true, 1200);
    await g.card.show('Ночь', { en: 'Night', ms: 1500 });
    if (S !== this.session) return;
    phase = 'night';
    this.lzCaveSetState('L3N');
    girlsAsleep();
    L.placeAt(3.9, -0.4, 1);
    g.cameraSys.snap();
    await g.fader.to(false, 1200);
    if (!(await this.lines(g.dialogue.dialogues.l3_night))) return;
    this.lzHold = false;
    g.state.set('objective', 'lz_l3_night');
    this.placeItems();
    g.player.enabled = true;
    await wait();                                     // she walks into the rift and finds Puriel
    if (S !== this.session) return;

    // Puriel
    g.interactions.setItems([]);
    g.player.enabled = false;
    this.lzHold = true;
    g.hud.show(false);
    g.letterbox.set(true, 900);
    const P = A().puriel;
    g.cameraSys.setShot({ x: P.x + 0.8, y: 1.6, z: 3.4, lookX: P.x + 0.2, lookY: 0.6, lookZ: -2.0, fov: 38 }, 1.4);
    for (let i = 0; i < 3; i++) this.lzBlood(P.x - 0.4 + i * 0.5, -1.8 + (i % 2) * 0.3, 1.0);
    if (!(await this.lines(g.dialogue.dialogues.l3_found))) return;
    g.narrative.setChar('puriel', 'dead');
    g.narrative.setChar('lizzie', 'grieving');
    g.audio.play('sfx.shouts', { volume: 0.9 });
    await this.lzHit(0.8);
    // Stinko Bob comes in from the tunnel
    const bob = this.lzCastIn('bob', 'lz_bob', 4.6, -2.2, -1);
    L.face(1);
    g.cameraSys.setShot({ x: 0.6, y: 1.7, z: 3.8, lookX: 0.4, lookY: 1.1, lookZ: -1.4, fov: 40 }, 1.6);
    await bob.walkTo({ x: L.position.x + 1.5, z: -0.9 }, { speed: 1.4 });
    if (S !== this.session) return;
    bob.setPose('idle');
    bob.faceTowards(L.position.x);
    g.narrative.setChar('bob', 'conversational');
    if (!(await this.lines(g.dialogue.dialogues.l3_bob))) return;
    g.narrative.setChar('bob', 'lore_source');
    g.narrative.setWw('human_blood_consumed', g.narrative.ww('human_blood_consumed') + 1);
    g.state.set('lz_bob_rules', true);
    bob.face(1);
    bob.walkTo({ x: 4.6, z: -2.4 }, { speed: 1.2 }).then(() => bob.setVisible(false));
    g.letterbox.set(false, 600);
    g.cameraSys.setShot(null, 1);
    g.hud.show(true);
    phase = 'back';
    this.lzHold = false;
    g.state.set('objective', 'lz_l3_back');
    this.placeItems();
    g.player.enabled = true;
    await wait();                                     // back in the hall: wake the girls
    if (S !== this.session) return;

    // tell them — and the first attempt
    g.interactions.setItems([]);
    g.player.enabled = false;
    for (const c of [ol, vi]) { c.stand(); c.state = 'idle'; c.fall = 0; c.pivot.rotation.z = 0; c.setPose('idle'); }
    ol.placeAt(6.6, -1.6, -1); vi.placeAt(8.0, -1.1, -1);
    await g.dialogue.start('l3_tell');
    if (S !== this.session) return;
    g.narrative.setChar('lizzie', 'desperate');
    g.narrative.setChar('olivia', 'frightened');
    phase = 'escape';
    this.lzFollow = [ol, vi];
    g.state.set('objective', 'lz_l3_escape');
    this.placeItems();
    g.player.enabled = true;
    await wait();                                     // in the tunnel, close to the guards
    if (S !== this.session) return;
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    g.letterbox.set(true, 600);
    const guards = this.lzCast.guards || [];
    for (const gd of guards) { gd.setPose('idle'); gd.faceTowards(L.position.x); }
    if (guards[0]) await guards[0].walkTo({ x: L.position.x + 1.1, z: L.position.z - 0.1 }, { speed: 2.4, direct: true });
    g.audio.play('inner.heartbeat', { volume: 0.8 });
    if (!(await this.lines(g.dialogue.dialogues.l3_fail))) return;
    this.lzFollow = null;
    this.endPlace();
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
    this.lzHold = false;
    this.lzCaveReset();
    await this.lzEnter('cave', 'L4', 'lizzie_4');
    const L = this.julian;
    const A = () => g.world.anchors;
    g.narrative.tickDays(19);
    g.narrative.setChar('lizzie', 'captive');
    L.placeAt(3.9, -0.4, 1);
    const ol = this.lzCastIn('olivia', 'lz_olivia', 6.4, -1.5, -1);
    const vi = this.lzCastIn('vikki', 'lz_vikki', 7.6, -1.2, -1);
    // the pack is spread through the chambers: by the fires, in the den, at the mouth; Bob in the store
    const WHERE = {
      cave: [['packA', -6.0, -0.8, -1, 'idle'], ['packB', -2.9, -1.0, 1, 'idle']],
      cave_den: [['packC', -3.0, -1.7, -1, 'eat'], ['packD', 2.8, -0.9, -1, 'idle']],
      cave_store: [['bob', -0.6, -1.4, -1, 'idle']],
      cave_tunnel: [['packE', 8.2, -0.7, 1, 'idle'], ['wolfGrey', 11.0, -1.3, -1, 'eat']],
    };
    const NAMES = { packA: 'Хриплый', packB: 'Молодой', packC: 'Очкарик', packD: 'Марта', packE: 'Рыжая', bob: 'Боб' };
    const who = {};
    const castRoom = (loc) => {
      for (const [k, x, z, fc, pose] of WHERE[loc] || []) {
        const c = this.lzCastIn(k, k === 'wolfGrey' ? 'lz_wguard' : `lz_${k}`, x, z, fc);
        if (k === 'wolfGrey') c.root.scale.setScalar(1.25);
        c.setPose(pose);
        who[k] = c;
      }
    };
    castRoom('cave');
    this.lzCast = { ol, vi, who };
    this.setAmbience(['amb.oldwing']);
    g.hud.show(false);
    g.player.enabled = false;
    g.cameraSys.snap();
    await g.fader.to(false, 1600);
    if (!(await this.lines(g.dialogue.dialogues.l4_open))) return;
    g.narrative.setChar('pack', 'territorial_conflict');
    let evening = false;
    let next = null;
    const talks = () => ['lz_l4_a', 'lz_l4_b', 'lz_l4_c', 'lz_l4_d', 'lz_l4_e', 'lz_l4_bob'].filter((k) => g.state.get(k)).length;
    const ready = () => talks() >= 4 && g.state.get('lz_l4_e');
    const after = () => {
      if (!evening && ready()) {
        evening = true;
        g.state.set('objective', 'lz_l4_back');
        this.placeItems();
        g.dialogue.start('l4_evening');
      }
    };
    const bark = (id, ch) => async () => { ch?.faceTowards(L.position.x); await g.dialogue.start(id); after(); };
    const talkTo = (k, id) => {
      const c = who[k];
      if (!c?.root.visible) return null;
      return this.lzIt(`l4_${k}`, NAMES[k], c.position.x + 0.7 * (c.facing || 1), Math.max(-1.9, Math.min(0.7, c.position.z + 0.3)), V(c.position.x, 2.0, c.position.z), bark(id, c), 0.9);
    };
    const items = (loc) => {
      const a = A();
      const list = {
        cave: () => [talkTo('packA', 'l4_packA'), talkTo('packB', 'l4_packB'),
          this.lzIt('l4_fire', 'Костёр', -7.2, -0.6, a.spit, bark('l4_fire')),
          evening
            ? this.lzIt('l4_evening_go', 'Оливия и Викки', 7.0, -0.7, V(7.0, 1.9, -1.3), () => next?.(), 1.1)
            : this.lzIt('l4_girls', 'Оливия и Викки', 7.0, -0.7, V(7.0, 1.9, -1.3), bark('l4_girls'), 1.1)],
        cave_den: () => [talkTo('packC', 'l4_packC'), talkTo('packD', 'l4_packD'),
          this.lzIt('l4_den_clothes', 'Одежда', 1.4, -1.8, a.clothes, bark('l4_den_clothes')),
          this.lzIt('l4_den_marks', 'Зарубки', 5.3, -1.8, a.marks, bark('l4_den_marks')),
          this.lzIt('l4_den_carcass', 'Олень', -4.8, -1.4, a.carcass, bark('l4_den_carcass'))],
        cave_store: () => [talkTo('bob', 'l4_bob'), this.lzIt('l4_store_pack', 'Рюкзаки', -2.6, -1.8, a.packs, bark('l4_store_pack'))],
        cave_tunnel: () => [talkTo('packE', 'l4_packE'), this.lzIt('l4_tunnel_exit', 'Выход', 9.4, -0.3, V(11.4, 1.6, -0.8), bark('l4_tunnel_exit'), 1.0)],
        cave_deep: () => [this.lzIt('l4_deep_drag', 'Борозды', 2.6, -0.4, a.drag, bark('l4_deep_drag')), this.lzIt('l3_deep_claws', 'Борозды на стене', -1.6, -1.3, a.claws, bark('l3_deep_claws'))],
        cave_rift: () => [this.lzIt('l4_rift', 'Ниша', -3.6, -1.3, V(-4.4, 0.6, -2.1), bark('l4_rift'))],
      }[loc];
      return (list?.() || []).filter(Boolean);
    };
    const onEnter = (loc) => {
      castRoom(loc);
      if (loc === 'cave') { this.lzCastIn('olivia', 'lz_olivia', 6.4, -1.5, -1); this.lzCastIn('vikki', 'lz_vikki', 7.6, -1.2, -1); }
    };
    const gate = (d) => (d.id === 'deep_altar' ? 'l4_deep_block' : null);
    this.lzCavePlace('L4', { items, onEnter, gate });
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'lz_pack');
    await new Promise((resolve) => { next = resolve; });
    if (S !== this.session) return;
    // evening: they come for Vicky
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    this.endPlace();
    await L.walkTo({ x: 4.1, z: -0.3 }, { speed: 1.4 });
    L.face(1);
    g.letterbox.set(true, 900);
    g.cameraSys.setShot({ x: 3.6, y: 1.8, z: 4.6, lookX: 3.4, lookY: 1.1, lookZ: -1.4, fov: 40 }, 1.4);
    const [a, b] = [who.packA, who.packB];
    a.setPose('idle'); b.setPose('idle');
    await Promise.all([a.walkTo({ x: 4.0, z: -1.6 }, { speed: 1.6 }), b.walkTo({ x: 3.2, z: -0.4 }, { speed: 1.6 })]);
    if (S !== this.session) return;
    const take = this.lines(g.dialogue.dialogues.l4_take);
    await sleep(2.4);
    g.narrative.setChar('vicky', 'taken');
    // teeth in her jacket: she is knocked down and dragged across the stone into the deep, like a carcass
    a.faceTowards(vi.position.x);
    await a.walkTo({ x: vi.position.x - 0.9, z: vi.position.z - 0.1 }, { speed: 2.6 });
    g.audio.play('sfx.thud', { volume: 0.7 });
    vi.lieDown(-1);
    a.face(-1);
    this.lzDrag = [{ who: vi, by: a, dx: 1.05, dz: 0.15 }];
    a.walkTo([{ x: 3.4, z: -1.2 }, { x: -0.6, z: -2.5 }], { speed: 1.3 });
    b.walkTo([{ x: 0.4, z: -1.0 }, { x: -0.6, z: -2.4 }], { speed: 1.3 });
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
    this.lzHold = false;
    this.lzCaveReset();
    await this.lzEnter('cave', 'L5', 'lizzie_5');
    const L = this.julian;
    const A = () => g.world.anchors;
    L.placeAt(A().bedL.x, A().bedL.z, -1);
    L.lieDown(-1);
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
    let heard = false;
    let next = null;
    let ol = null, holders = [];
    const bark = (id) => () => g.dialogue.start(id);
    const items = (loc) => {
      const a = A();
      return {
        cave: [this.lzIt('l5_straw', 'Солома', 5.0, -1.8, a.beds, bark('l5_straw')), this.lzIt('l5_drag', 'Следы', 1.6, -1.0, V(1.4, 0.3, -1.6), bark('l5_drag'))],
        cave_den: [this.lzIt('l5_den', 'Шкуры', -4.4, -0.1, a.furs, bark('l5_den'))],
        cave_deep: [this.lzIt('l5_sweater', 'Шерсть', -3.0, -0.6, a.sweater, bark('l5_sweater'), 0.8), this.lzIt('l5_pool', 'Вода', 1.0, -0.2, a.pool, bark('l5_pool'))],
      }[loc] || [];
    };
    const voice = () => {
      if (heard) return;
      heard = true;
      g.state.set('objective', 'lz_l5_deep');
      this.lines(g.dialogue.dialogues.l5_voice, { blocking: false });
    };
    const onEnter = (loc) => {
      if (loc === 'cave') this.lzWatch = () => { if (L.position.x < 2.0) voice(); };
      if (loc === 'cave_deep') voice();
      if (loc === 'cave_altar') {
        const sl = A().slab;
        // Olivia on the slab, four of them holding her
        ol = this.lzCastIn('olivia', 'lz_olivia', sl.x - 0.5, sl.z - 0.1, 1);
        ol.root.position.y = 0.56;
        ol.lieDown(1);
        holders = [['packA', -1.6, 0.2, 1], ['packD', 1.6, 0.1, -1], ['packE', -0.8, 1.1, 1], ['packB', 0.8, -0.8, -1]]
          .map(([k, dx, dz, fc]) => { const wf = this.lzCastIn(k, `lz_${k}`, sl.x + dx, sl.z + dz, fc); wf.setPose('idle'); return wf; });
        this.lzCast = { ol, holders };
        this.lzWatch = () => { if (L.position.x < A().peek.x + 0.4 && !g.dialogue.busy && !this.traveling) { this.lzWatch = null; next?.(); } };
      }
    };
    const gate = (d) => (d.id === 'hall_store' ? 'l5_noleave' : null);
    this.lzCavePlace('L5', { items, onEnter, gate });
    onEnter('cave');
    g.hud.show(true);
    g.player.enabled = true;
    g.state.set('objective', 'lz_follow');
    await new Promise((resolve) => { next = resolve; });
    if (S !== this.session) return;
    this.endPlace();
    const w = g.world;
    const sl = w.anchors.slab;
    // the observation position: the player cannot intervene
    g.interactions.setItems([]);
    g.player.enabled = false;
    g.hud.show(false);
    L.face(-1);
    g.letterbox.set(true, 1200);
    g.audio.music('none', 1);
    g.cameraSys.setShot({ x: sl.x + 2.6, y: 1.6, z: 3.6, lookX: sl.x + 0.4, lookY: 0.8, lookZ: -1.2, fov: 40 }, 1.8);
    await sleep(1.8);
    if (!(await this.lines(g.dialogue.dialogues.l5_watch))) return;
    g.narrative.setChar('olivia', 'dying');
    // the attack beats
    const beat = async (wf, k) => {
      const p = wf.position.clone();
      wf.setPose('eat');
      await wf.walkTo({ x: p.x + (sl.x - p.x) * 0.3, z: p.z + (sl.z - p.z) * 0.3 }, { speed: 4, direct: true });
      g.audio.play('sfx.tear', { volume: 0.7 }); g.audio.play('sfx.thud', { volume: 0.5 });
      this.lzBlood(sl.x + (Math.random() - 0.5) * 1.6, sl.z + (Math.random() - 0.5) * 0.8, 0.8 + k * 0.25, 0.56);
      this.lzBlood(p.x * 0.5 + sl.x * 0.5, sl.z + 1.4 + (Math.random() - 0.5), 0.9, 0.016);
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
    g.cameraSys.setShot({ x: sl.x + 3.6, y: 1.4, z: 2.0, lookX: sl.x + 1.4, lookY: 0.9, lookZ: -1.0, fov: 34 }, 1.2);
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

  /**
   * Inside: the run back through the chambers — the slab, the deep passage, the hall, the store,
   * the tunnel and out of the mouth. Each passage takes her on the moment she reaches it (no key);
   * the two wolves come out of the rock behind her a beat later. Caught → back to the start of
   * the same chamber.
   */
  async lzRunCave(chasers) {
    const g = this.g;
    const S = this.session;
    const L = this.julian;
    const ROUTE = [
      { loc: 'cave_altar', exit: 'altar_deep' },
      { loc: 'cave_deep', exit: 'deep_hall', from: { x: -7.6, z: -2.9 } },
      { loc: 'cave', exit: 'hall_store', from: { x: -0.6, z: -2.9 } },
      { loc: 'cave_store', exit: 'store_tunnel', from: { x: -5.6, z: -2.9 } },
      { loc: 'cave_tunnel', exit: null, from: { x: -6.6, z: -2.9 } },
    ];
    this.place = null;
    this.lzCaveState = 'L5';
    this.lzWatch = null;
    const first = chasers.map((c) => ({ x: c.position.x, z: c.position.z }));
    let start = { x: L.position.x, z: L.position.z, facing: 1 };
    let i = 0, retry = false;
    while (S === this.session && i < ROUTE.length) {
      const r = ROUTE[i];
      const w = g.world;
      const door = r.exit ? w.doors.find((d) => d.id === r.exit) : null;
      const goal = door ? () => Math.hypot(L.position.x - door.x, (L.position.z - door.z) * 0.7) < 1.0 : () => L.position.x > w.anchors.exit.x - 0.2;
      // where the wolves are when she starts here
      const wolvesAt = (k) => (r.from ? { x: r.from.x - k * 0.4, z: r.from.z + k * 0.3 } : first[k]);
      chasers.forEach((c, k) => {
        w.root.add(c.root);
        c.stop(); c.setPose('idle');
        const p = wolvesAt(k);
        c.placeAt(p.x, p.z, 1);
        c.setVisible(!r.from);
      });
      if (retry) {
        L.root.position.y = 0; L.stand();
        L.placeAt(start.x, start.z, start.facing);
        g.cameraSys.setShot(null, 0); g.cameraSys.snap();
        await g.fader.to(false, 400);
      }
      g.interactions.setItems(door ? [{ id: `lz_run_${door.id}`, label: door.label, at: { x: door.x, z: door.z }, radius: 1.05, anchor: door.anchor, run: () => {} }] : []);
      g.hud.show(true);
      g.player.enabled = true;
      g.state.set('objective', 'lz_escape');
      if (r.from) setTimeout(() => { if (S === this.session && g.world === w) chasers.forEach((c) => c.setVisible(true)); }, 1500);   // they come out of the dark a beat after her
      const res = await this.lzChaseStep(chasers, goal, { nav: true });
      if (S !== this.session) return;
      if (res === 'caught') { await this.lzCaught(); retry = true; continue; }
      retry = false;
      g.interactions.setItems([]);
      if (!door) return;                                 // out of the mouth
      chasers.forEach((c) => c.stop());
      await this.lzCaveGo(door.to, door.spawn, 220);
      start = { ...door.spawn };
      i++;
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
  lzChaseStep(chasers, goal, { nav = false } = {}) {
    return new Promise((resolve) => {
      this.lzChaseS = { chasers, goal, resolve, t: 0, nav };
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
    this.lzSearch?.tick?.(dt);
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
        if (w._chaseT <= 0 || w.state !== 'walk') { w._chaseT = 0.3; w.walkTo({ x: L.position.x, z: L.position.z }, { speed, direct: !c.nav }); }   // in the cave: round the rocks
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
    if (n === 3) await this.startHome(2);
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
