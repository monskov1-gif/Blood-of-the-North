import * as THREE from 'three';
import { EventBus } from './EventBus.js';
import { Settings } from './Settings.js';
import { GameState } from './GameState.js';
import { SaveSystem } from './SaveSystem.js';
import { Input } from './Input.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Renderer } from '../render/Renderer.js';
import { CameraSystem } from '../camera/CameraSystem.js';
import { SpriteAtlas } from '../characters/SpriteAtlas.js';
import { PlayerController } from '../characters/PlayerController.js';
import { Navigation } from '../world/Navigation.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { DialogueSystem } from '../dialogue/DialogueSystem.js';
import { Director } from '../story/Director.js';
import { Hallucination } from '../fx/Hallucination.js';
import { HUD } from '../ui/HUD.js';
import { DialogueView, preloadPortraits } from '../ui/DialogueView.js';
import { TouchControls } from '../ui/TouchControls.js';
import { MainMenu, Panels } from '../ui/Menus.js';
import { Fader, PhoneView, Insert, EndingScreen, PortraitFlash } from '../ui/Overlays.js';
import { el } from '../ui/dom.js';
import { SCENES } from '../world/scenes/index.js';
import { DIALOGUES } from '../../data/dialogue/index.js';

/**
 * Composition root. Owns every system and the main loop; scenes plug in via
 * SCENES (world builder + story script). Modes: boot → title → play → ending.
 */
export class Game {
  constructor() {
    this.bus = new EventBus();
    this.settings = new Settings(this.bus);
    this.state = new GameState(this.bus);
    this.saves = new SaveSystem(this.bus);
    this.input = new Input(this.bus);
    this.audio = new AudioManager(this.bus, this.settings);
    this.renderer = new Renderer(document.getElementById('view'), this.settings, this.bus);
    this.cameraSys = new CameraSystem();
    this.cameraSys.camera.layers.enable(1);
    this.director = new Director();
    this.characters = new Map();
    this.mode = 'boot';
    this.clock = new THREE.Clock();
    this.frame = 0;
  }

  progress(p, note) {
    const bar = document.querySelector('#boot .boot-bar i');
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    if (note) document.querySelector('#boot .boot-note').textContent = note;
  }

  async boot() {
    preloadPortraits(['julian', 'kayden', 'waiter', 'owen']);
    this.progress(0.1, 'персонажи…');
    this.atlas = await new SpriteAtlas().load();
    this.progress(0.35, 'бар «Северная Роза»…');
    await nextFrame();

    // world
    const sceneDef = SCENES.bar;
    this.scene3d = new THREE.Scene();
    this.scene3d.background = new THREE.Color(0x040202);
    this.world = new sceneDef.World({ renderer: this.renderer, bus: this.bus, quality: this.renderer.quality });
    this.scene3d.add(this.world.build());
    this.renderer.setup(this.scene3d, this.cameraSys.camera);
    this.cameraSys.setBounds(this.world.bounds.camera);
    this.nav = new Navigation(this.world.bounds.walk, this.world.colliders);
    this.progress(0.6, 'свет…');
    await nextFrame();

    // UI
    const root = document.getElementById('ui');
    this.fader = new Fader(root);
    this.fader.set(true);
    this.view = new DialogueView({ root, bus: this.bus, settings: this.settings, input: this.input, audio: this.audio, state: this.state });
    this.hud = new HUD({ root, bus: this.bus, input: this.input, state: this.state });
    this.touch = new TouchControls({ root, input: this.input, bus: this.bus, settings: this.settings });
    this.insert = new Insert(root);
    this.pflash = new PortraitFlash(root);
    this.phone = new PhoneView({ root, bus: this.bus, audio: this.audio, state: this.state });
    this.ending = new EndingScreen({ root, bus: this.bus, audio: this.audio });

    // systems
    this.dialogue = new DialogueSystem({
      bus: this.bus, state: this.state, director: this.director, view: this.view,
      characters: this.characters, dialogues: DIALOGUES,
    });
    this.interactions = new InteractionSystem({ bus: this.bus, state: this.state, input: this.input });
    this.panels = new Panels({ root, bus: this.bus, audio: this.audio, settings: this.settings, saves: this.saves, dialogue: this.dialogue, state: this.state });
    this.mainMenu = new MainMenu({ root, bus: this.bus, audio: this.audio, saves: this.saves });

    // story
    this.story = new sceneDef.Story(this);
    this.story.spawn();
    this.player = new PlayerController(this.story.julian, this.input, this.nav, this.audio);
    this.cameraSys.follow(this.story.julian.root);
    this.director.registerAll(this.story.commands());
    this.interactions.setItems(this.story.interactables());
    this.view.bgProvider = (key) => this.story.paintBackground(key);
    this.hallucination = new Hallucination({
      renderer: this.renderer, audio: this.audio, cameraSys: this.cameraSys, scene: this.world,
      characters: this.characters, player: this.player, view: this.view, settings: this.settings,
    });
    for (const c of this.characters.values()) {
      c.onStep = (ch) => {
        ch.stepAcc = (ch.stepAcc || 0) + 1;
        if (ch.stepAcc % 26 === 0 && ch !== this.story.julian) {
          const dx = ch.position.x - this.cameraSys.camera.position.x;
          if (Math.abs(dx) < 7) this.audio.play('sfx.step', { volume: 0.25, pan: Math.max(-1, Math.min(1, dx / 7)) });
        }
        if (ch === this.story.julian && ch.stepAcc % 22 === 0) this.audio.play('sfx.step', { volume: 0.6 });
      };
    }

    this.rotateHint(root);
    this.registerSaves();
    this.wireEvents();
    this.progress(1, '');
    this.resize();
    this.bus.on('resize', () => this.resize());
    this.cameraSys.snap();
    this.loop();
    document.getElementById('boot').classList.add('out');
    setTimeout(() => document.getElementById('boot')?.remove(), 900);
    this.toTitle(true);
  }

  registerSaves() {
    this.saves.register('state', { save: () => this.state.serialize(), load: (d) => this.state.restore(d) });
    this.saves.register('dialogue', { save: () => this.dialogue.save(), load: (d) => this.dialogue.load(d) });
    this.saves.register('story', { save: () => this.story.save(), load: () => {} });
    this.saves.register('audio', { save: () => ({ swing: this.state.get('jukebox_swing') }), load: () => {} });
  }

  wireEvents() {
    const bus = this.bus;
    bus.on('menu', (act) => this.onMenu(act));
    bus.on('ui-open', (what) => {
      if (this.mode !== 'play') return;
      if (what === 'pause' && !this.panels.open && !this.phone.isOpen) this.panels.pause();
      if (what === 'log') this.panels.log();
      if (what === 'phone' && this.hud.visible && !this.dialogue.busy && !this.panels.open) {
        this.hud.notifyPhone(false);
        this.phone.open();
      }
    });
    bus.on('action', ({ action, down }) => {
      if (!down) return;
      if (action === 'menu' && this.mode === 'play' && !this.panels.open && !this.phone.isOpen) this.panels.pause();
      if (action === 'log' && this.mode === 'play' && !this.panels.open) this.panels.log();
    });
    bus.on('panel', (open) => {
      this.view.blocked = open;
      this.updateControl();
    });
    bus.on('dialogue-start', () => this.updateControl());
    bus.on('dialogue-end', () => this.updateControl());
    bus.on('stage', () => this.saves.autosave('stage'));
    bus.on('checkpoint', () => setTimeout(() => this.saves.autosave('checkpoint'), 0));
    bus.on('toast', (t) => this.hud.toast(t));
    bus.on('saved', ({ slot }) => { if (slot !== 'auto') this.hud.toast('СОХРАНЕНО'); });
    bus.on('load-slot', (slot) => this.loadSlot(slot));
    bus.on('voicemail', () => this.audio.play('inner.heartbeat', { volume: 0.4 }));
    // pause the 3D render while the dialogue screen fully covers it (battery on phones)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.audio.ctx?.suspend(); else this.audio.ctx?.resume(); });
  }

  /** Phones in portrait: suggest landscape (can be dismissed). */
  rotateHint(root) {
    if (!this.input.isTouch) return;
    const h = el('div', 'rotate-hint enabled', root, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>
      <div>Поверните устройство горизонтально —<br>так сцена видна целиком.</div>`);
    const b = el('button', '', h, 'Играть вертикально');
    b.addEventListener('click', () => h.classList.remove('enabled'));
  }

  updateControl() {
    const blocked = this.panels.open || this.phone.isOpen || this.dialogue.busy || this.mode !== 'play';
    this.blocked = blocked;
    this.touch.show(this.mode === 'play' && !this.dialogue.busy && this.hud.visible && !this.panels.open);
  }

  resize() {
    this.cameraSys.resize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------------ modes

  async toTitle(first = false) {
    this.mode = 'title';
    this.story.bump();
    await this.dialogue.abort();
    this.panels.closeAll();
    this.ending.hide();
    this.hud.show(false);
    this.touch.show(false);
    this.player.enabled = false;
    this.story.stopAmbient();
    this.state.reset();
    this.hallucination.reset();
    this.story.resetPositions();
    this.story.julian.setVisible(false);
    this.cameraSys.setShot({ x: 3.2, y: 2.3, z: 10.5, lookX: 1.5, lookY: 1.6, lookZ: -2, fov: 30 }, 1);
    this.cameraSys.snap();
    this.renderer.setLayer('menu', { blur: 0.35, exposure: -0.18, vignette: 0.25 });
    this.story.startAmbient();
    if (first) {
      await this.fader.to(false, 1600);
      this.tapToStart();
    } else {
      this.audio.music('title', 3);
      await this.fader.to(false, 1200);
      this.mainMenu.open();
    }
  }

  tapToStart() {
    const root = document.getElementById('ui');
    const t = el('div', 'tap-start', root, `<span>${this.input.isTouch ? 'КОСНИТЕСЬ ЭКРАНА' : 'НАЖМИТЕ ЛЮБУЮ КЛАВИШУ'}</span>`);
    const start = () => {
      t.remove();
      window.removeEventListener('keydown', start);
      this.audio.unlock();
      this.audio.loop('amb.crowd');
      this.audio.loop('amb.vent');
      this.audio.loop('amb.wind', { volume: 0.4 });
      this.audio.music('title', 2);
      this.mainMenu.open();
      // fullscreen helps a lot on phones (address bar)
      if (this.input.isTouch && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    };
    t.addEventListener('pointerup', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
  }

  async onMenu(act) {
    if (act === 'new') return this.newGame();
    if (act === 'continue') { const l = this.saves.latest(); if (l) this.loadSlot(l.slot); return; }
    if (act === 'load') return this.panels.savePanel('load');
    if (act === 'settings') return this.panels.settingsPanel();
    if (act === 'about') return this.panels.about();
    if (act === 'title') { await this.fader.to(true, 900); this.mainMenu.close(); return this.toTitle(); }
  }

  async beginPlay() {
    this.mainMenu.close();
    this.ending.hide();
    await this.fader.to(true, 900);
    this.story.bump();
    await this.dialogue.abort();
    this.story.stopAmbient();
    this.renderer.clearLayer('menu');
    this.hallucination.reset();
    this.mode = 'play';
    this.story.julian.setVisible(true);
  }

  async newGame() {
    await this.beginPlay();
    this.state.reset();
    this.dialogue.history = [];
    this.dialogue.checkpoint = null;
    this.saves.clear('auto');
    this.story.resetPositions();
    this.story.startAmbient();
    this.audio.music('lounge', 3);
    this.updateControl();
    await this.story.newGame();
  }

  async loadSlot(slot) {
    const data = this.saves.read(slot);
    if (!data) return;
    await this.beginPlay();
    this.saves.apply(data);
    this.audio.music(data.audio?.swing ? 'jukebox' : 'lounge', 2);
    this.story.startAmbient();
    this.updateControl();
    this.hud.setObjective(this.state.get('objective'));
    await this.story.load(data.story);
  }

  showEnding() {
    this.mode = 'ending';
    this.updateControl();
    this.hud.show(false);
    this.ending.show(this.state);
  }

  // ------------------------------------------------------------------ loop

  loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.frame++;
      this.updateControl();
      const canMove = this.mode === 'play' && !this.blocked;
      this.input.enabled = canMove;
      this.player.update(canMove ? dt : dt);
      for (const c of this.characters.values()) c.update(dt);
      if (this.mode === 'play') {
        this.interactions.enabled = this.player.enabled && !this.blocked && (this.state.stage === 'explore' || this.state.stage === 'morning');
        this.interactions.update(this.story.julian);
        this.story.update(dt);
      } else {
        this.interactions.update(null);
        if (this.mode === 'title') this.titleDrift(dt);
      }
      this.hallucination.update(dt);
      this.world.update(dt);
      this.cameraSys.update(dt);
      this.hud.update(this.cameraSys.camera);
      // the dialogue screen covers everything: skip the 3D render to save power
      const covered = this.view.mode === 'vn' && !this.view.vn.classList.contains('hidden') && this.view.vn.classList.contains('show');
      if (!covered || this.frame % 20 === 0) this.renderer.render(dt);
    };
    requestAnimationFrame(tick);
  }

  titleDrift(dt) {
    this.titleT = (this.titleT || 0) + dt;
    const t = this.titleT * 0.05;
    this.cameraSys.setShot({ x: 1.5 + Math.sin(t) * 4.5, y: 2.3 + Math.sin(t * 1.7) * 0.15, z: 10.5, lookX: 1.5 + Math.sin(t) * 4.8, lookY: 1.6, lookZ: -2, fov: 30 }, 0.5);
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
