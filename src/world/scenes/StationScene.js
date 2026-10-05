import * as THREE from 'three';
import { LocationBase, tileTexture, tiled } from '../LocationBase.js';
import { streetTexture, canvasTexture, rng } from '../../render/textures.js';
import { glow } from '../props.js';

/**
 * Whitehorse RCMP detachment — side-on cut-away of the ground floor.
 *   x -13 … -8   entrance, reception desk
 *   x  -8 … -1   waiting area (survivors), vending machine, notice board
 *   x  -1 …  4   corridor with glass offices
 *   x   4 …  8   holding cell (alcove behind the back wall, barred front)
 *   x   8 … 13   med post, door to the interrogation room
 */
const BACK = -4;
const H = 3.0;

export class StationScene extends LocationBase {
  constructor(opts) {
    super(opts);
    this.id = 'station';
    this.title = 'Полицейский участок';
    this.background = 0x080a0c;
    this.camera = { distance: 8.0, height: 2.3, lookHeight: 1.3, lookZ: -0.8 };
    const corridor = { minX: -12.6, maxX: 12.6, minZ: -2.6, maxZ: 1.8, enabled: () => !this.lockedIn };
    this.cell = { minX: 4.65, maxX: 7.55, minZ: -6.0, maxZ: -4.3, enabled: () => this.cellOpen || this.lockedIn };
    this.cellDoorway = { minX: 5.7, maxX: 6.5, minZ: -4.4, maxZ: -2.5, enabled: () => this.cellOpen };
    this.bounds = { walk: { areas: [corridor, this.cell, this.cellDoorway] }, camera: { minX: -8.6, maxX: 8.6 } };
    this.cellOpen = false;
    this.shots = { station: { pos: [-4.6, 1.5, 2.6], look: [-4.8, 1.4, -4.0], fov: 52 } };
    this.vnHide = [];
  }

  build() {
    const root = this.root;
    const floorTex = tiled(tileTexture('checker'), 13, 4);
    this.floor(-14, 14, -7, 5, this.mat('stFloor', { map: floorTex, roughness: 0.35, metalness: 0.05 }));
    const wallMat = this.mat('stWall', { map: tileTexture('block'), color: 0xd0d6d0, roughness: 0.85 });
    const lowerMat = this.mat('stWallLower', { map: tileTexture('wallLower'), color: 0x6a7a8a, roughness: 0.7 });
    // back wall with openings: entrance, cell, med post, interrogation door
    this.wall(-14, 14, H, BACK, wallMat, [
      { x0: -12.9, x1: -11.1, y0: 0, y1: 2.4 },  // entrance doors (glass)
      { x0: 4.5, x1: 7.7, y0: 0, y1: 2.6 },      // holding cell
      { x0: 9.0, x1: 10.6, y0: 0, y1: 2.3 },     // med post
      { x0: -4.8, x1: -2.6, y0: 1.2, y1: 2.3 },  // window to the street
    ]);
    // lower wainscot band (blue-grey) except where openings are
    for (const [a, b] of [[-14, -12.9], [-11.1, 4.5], [7.7, 9.0], [10.6, 14]]) {
      this.box(b - a, 1.0, 0.04, lowerMat, (a + b) / 2, 0.5, BACK + 0.03);
    }
    this.box(28, 0.06, 0.06, this.mat('stRail', { color: 0x2a3440, roughness: 0.5 }), 0, 1.02, BACK + 0.05);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(28, 12), this.mat('stCeil', { map: tiled(tileTexture('ceiling'), 14, 6), roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -1);
    root.add(ceil);
    for (const x of [-14, 14]) this.plane(12, H, wallMat, x, H / 2, -1, x < 0 ? Math.PI / 2 : -Math.PI / 2);

    // outside (entrance + window)
    const outside = new THREE.MeshBasicMaterial({ map: streetTexture('morning'), color: 0xdde4ec });
    this.plane(6, 3.4, outside, -11.5, 1.6, BACK - 1.4);
    this.plane(4, 2.6, outside, -3.7, 1.8, BACK - 1.2);
    const glassMat = this.mat('stGlass', { color: 0xbfd2e0, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2 });
    for (const x of [-12.45, -11.55]) {
      this.box(0.86, 2.36, 0.04, glassMat, x, 1.18, BACK);
      this.box(0.86, 0.06, 0.06, this.mat('steelDark', { color: 0x3a3e44, metalness: 0.6, roughness: 0.5 }), x, 1.05, BACK + 0.03);
    }
    const ent = this.textSign('RCMP · GRC  WHITEHORSE', { w: 2.2, h: 0.3, bg: '#14324a', fg: '#f0e6c8' });
    ent.position.set(-12, 2.72, BACK + 0.03); root.add(ent);
    this.anchors.entrance = new THREE.Vector3(-12, 1.4, BACK + 0.2);
    this.box(2.4, 0.04, 2.2, this.mat('mat', { color: 0x2a2c30, roughness: 1 }), -12, 0.01, -1.7);

    // reception desk with the desk sergeant
    const recMat = this.mat('recDesk', { color: 0x5a6a7a, roughness: 0.5 });
    this.box(3.0, 1.1, 0.6, recMat, -9.5, 0.55, -2.55);
    this.box(3.1, 0.05, 0.75, this.mat('recTop', { color: 0x8a8070, roughness: 0.4 }), -9.5, 1.12, -2.6);
    this.box(0.05, 0.6, 2.8, glassMat, -9.5, 1.45, -2.25).rotation.y = Math.PI / 2;
    const monitor = this.box(0.44, 0.3, 0.05, this.mat('pcMon', { color: 0x000, emissive: 0x3a6a8a, emissiveIntensity: 1.2 }), -10.2, 1.32, -3.0);
    monitor.rotation.y = 0.3;
    const recSign = this.textSign('ПРИЁМНАЯ · RECEPTION', { w: 2.0, h: 0.26, bg: '#1a2a36', fg: '#e8e4d8' });
    recSign.position.set(-9.5, 2.55, BACK + 0.03); root.add(recSign);
    this.colliders.push({ box: { minX: -11, maxX: -8, minZ: -3.6, maxZ: -2.3 } });
    this.anchors.desk = new THREE.Vector3(-9.5, 1.6, -2.6);
    this.anchors.deskOfficer = new THREE.Vector3(-9.4, 0, -3.3);
    // flags
    const flag = (x, colors) => {
      const tex = canvasTexture(`flag-${colors.join()}`, 128, 64, (ctx, w, h) => {
        if (colors[0] === 'ca') {
          ctx.fillStyle = '#d52b1e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.fillRect(w / 4, 0, w / 2, h);
          ctx.fillStyle = '#d52b1e'; ctx.beginPath(); ctx.moveTo(w / 2, 12); ctx.lineTo(w / 2 + 14, 40); ctx.lineTo(w / 2 - 14, 40); ctx.fill(); ctx.fillRect(w / 2 - 2, 38, 4, 14);
        } else {
          ctx.fillStyle = '#1a56a0'; ctx.fillRect(0, 0, w / 3, h); ctx.fillStyle = '#fff'; ctx.fillRect(w / 3, 0, w / 3, h); ctx.fillStyle = '#1e8a3a'; ctx.fillRect(2 * w / 3, 0, w / 3, h);
          ctx.fillStyle = '#d23'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 9, 0, 7); ctx.fill();
        }
      });
      const f = this.plane(0.9, 0.45, this.mat(`flagMat-${colors[0]}`, { map: tex, roughness: 0.9, side: THREE.DoubleSide }), x, 2.3, BACK + 0.04);
      f.rotation.z = 0.02;
    };
    flag(-8.0, ['ca']); flag(-7.0, ['yt']);

    // waiting area: benches, vending + water cooler, notice board
    this.bench(-6.4, -3.3, 2.4);
    this.bench(-3.2, -3.3, 2.0);
    this.colliders.push({ box: { minX: -7.7, maxX: -2.1, minZ: -3.7, maxZ: -2.95 } });
    this.anchors.benchA = { x: -7.1, z: -3.2 };
    this.anchors.benchB = { x: -5.7, z: -3.2 };
    this.anchors.benchC = { x: -3.6, z: -3.2 };
    const vend = new THREE.Group();
    this.box(0.9, 1.9, 0.7, this.mat('vend', { color: 0x203a5a, roughness: 0.4 }), 0, 0.95, 0, vend);
    this.box(0.62, 1.2, 0.02, this.mat('vendGlass', { color: 0x000, emissive: 0x8ac0e8, emissiveIntensity: 0.9 }), -0.08, 1.15, 0.36, vend);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) this.box(0.08, 0.2, 0.05, this.mat('vendBottle', { color: 0xa8d8f0, transparent: true, opacity: 0.8 }), -0.3 + c * 0.14, 0.7 + r * 0.28, 0.33, vend);
    vend.position.set(-1.2, 0, BACK + 0.4);
    root.add(vend);
    const vg = glow(0x8ac0e8, 1.4, 0.2); vg.position.set(-1.2, 1.2, BACK + 0.9); root.add(vg);
    this.colliders.push({ x: -1.2, z: BACK + 0.4, r: 0.5 });
    this.anchors.vending = new THREE.Vector3(-1.2, 1.4, BACK + 0.8);
    const board = new THREE.Group();
    this.box(1.6, 1.0, 0.04, this.mat('cork', { color: 0x9a7a50, roughness: 1 }), 0, 0, 0, board);
    const posters = [['WANTED', '#e8e0c8'], ['MISSING', '#f0ecd8'], ['NOTICE', '#d8e0e8'], ['', '#f0e0c0']];
    posters.forEach(([t, bg], i) => {
      const tex = canvasTexture(`poster-${t}-${i}`, 128, 160, (ctx, w, h) => {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#222'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t || 'ОБЪЯВЛЕНИЕ', w / 2, 24);
        if (t === 'MISSING') {
          ctx.fillStyle = '#6a5a50'; ctx.fillRect(34, 34, 60, 70);
          ctx.fillStyle = '#d8b8a0'; ctx.beginPath(); ctx.ellipse(64, 62, 16, 20, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(64, 50, 20, 14, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#222'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('ELIZABETH REED', w / 2, 122); ctx.font = '10px sans-serif'; ctx.fillText('Yukon River valley', w / 2, 138);
        } else {
          ctx.fillStyle = '#555'; for (let k = 0; k < 7; k++) ctx.fillRect(16, 46 + k * 14, 96 - (k % 3) * 12, 5);
        }
      });
      const p = this.plane(0.32, 0.4, this.mat(`posterMat-${i}`, { map: tex, roughness: 0.9 }), -0.55 + i * 0.37, (i % 2) * 0.1 - 0.05, 0.03, 0, board);
      p.rotation.z = (i - 1.5) * 0.04;
    });
    board.position.set(-4.4, 1.85, BACK + 0.03);
    root.add(board);
    this.anchors.board = new THREE.Vector3(-4.4, 1.9, BACK + 0.2);

    // corridor offices: glass partition with blinds, doors
    const blindsTex = canvasTexture('blinds', 64, 64, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(220,226,230,0.0)'; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 6) { ctx.fillStyle = 'rgba(200,206,210,0.92)'; ctx.fillRect(0, y, w, 4); }
    }, { color: true, repeat: [4, 3] });
    for (const x0 of [0.0, 2.3]) {
      this.box(2.1, 0.9, 0.05, this.mat('partLow', { color: 0x5a6878, roughness: 0.6 }), x0 + 1.05, 0.45, BACK + 0.02);
      const blinds = this.plane(2.0, 1.2, new THREE.MeshStandardMaterial({ map: blindsTex, transparent: true, roughness: 0.8, alphaTest: 0.1 }), x0 + 1.05, 1.55, BACK + 0.03);
      blinds.userData.blinds = true;
    }
    // offices behind the glass: lit desks and silhouettes
    this.box(4.6, 2.4, 0.05, this.mat('officeBack', { color: 0x8a9298, roughness: 0.9 }), 2.3, 1.2, BACK - 2.5);
    this.desk(1.1, BACK - 1.6, 1.4);
    this.desk(3.4, BACK - 1.6, 1.4);
    const offLight = new THREE.PointLight(0xe8f0ff, 5, 5, 1.5); offLight.position.set(2.3, 2.6, BACK - 1.4); root.add(offLight);
    this.door(-0.4, BACK + 0.02, { sign: 'ДЕТЕКТИВЫ', w: 0.9 });
    this.anchors.offices = new THREE.Vector3(2.2, 1.7, BACK + 0.1);

    // holding cell alcove (behind the back wall), barred front with a sliding door
    const cellMat = this.mat('cellWall', { map: tileTexture('block'), color: 0xb8bab2, roughness: 0.9 });
    this.box(3.2, H, 0.1, cellMat, 6.1, H / 2, -6.5);
    this.box(0.1, H, 2.6, cellMat, 4.45, H / 2, -5.2);
    this.box(0.1, H, 2.6, cellMat, 7.75, H / 2, -5.2);
    this.box(3.2, 0.06, 2.6, cellMat, 6.1, H - 0.03, -5.2);
    this.box(3.2, 0.02, 2.6, this.mat('cellFloor', { color: 0x6a6e70, roughness: 0.9 }), 6.1, 0.005, -5.2);
    this.box(2.6, 0.45, 0.55, this.mat('cellBench', { color: 0x8a8e90, roughness: 0.8 }), 6.1, 0.22, -6.15);
    const toilet = this.box(0.4, 0.42, 0.5, this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), 7.35, 0.21, -6.1);
    toilet.name = 'toilet';
    const cellLight = new THREE.PointLight(0xd8e0ea, 4, 4, 1.6); cellLight.position.set(6.1, 2.7, -5.2); root.add(cellLight);
    const bars = new THREE.Group();
    const barMat = this.mat('bars', { color: 0x2a2e34, metalness: 0.8, roughness: 0.4 });
    for (let i = 0; i < 17; i++) this.box(0.035, 2.6, 0.035, barMat, 4.55 + i * 0.19, 1.3, 0, bars);
    this.box(3.2, 0.08, 0.06, barMat, 6.1, 2.58, 0, bars);
    this.box(3.2, 0.06, 0.06, barMat, 6.1, 1.1, 0, bars);
    bars.position.z = BACK + 0.02;
    root.add(bars);
    const cellDoor = new THREE.Group();
    for (let i = 0; i < 6; i++) this.box(0.035, 2.5, 0.035, barMat, i * 0.19, 1.25, 0, cellDoor);
    this.box(1.05, 0.06, 0.05, barMat, 0.48, 1.1, 0, cellDoor);
    this.box(1.05, 0.06, 0.05, barMat, 0.48, 2.48, 0, cellDoor);
    cellDoor.position.set(5.6, 0, BACK + 0.12);
    root.add(cellDoor);
    this.cellDoor = cellDoor;
    this.cellDoorX = 5.6;
    // the bars stay closed except at the door gap
    const cellSign = this.textSign('КАМЕРА ВРЕМ. СОДЕРЖАНИЯ · 1', { w: 2.1, h: 0.2, bg: '#2a2a20', fg: '#e8d890' });
    cellSign.position.set(6.1, 2.8, BACK + 0.05); root.add(cellSign);
    this.anchors.cellInside = { x: 6.1, z: -5.4 };
    this.anchors.cellBench = { x: 5.6, z: -6.0 };
    this.anchors.cellDoor = new THREE.Vector3(6.1, 2.0, BACK + 0.2);
    // lamp over the cell door: the "in custody" light
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), this.mat('custodyLamp', { color: 0, emissive: 0xff3a20, emissiveIntensity: 3 }));
    lamp.position.set(7.9, 2.6, BACK + 0.1); root.add(lamp);

    // med post alcove
    const mpMat = this.mat('mpWall', { color: 0xdfe6ea, roughness: 0.8 });
    this.box(1.6, 2.3, 0.08, mpMat, 9.8, 1.15, -6.0);
    this.medArea = { minX: 9.2, maxX: 10.4, minZ: -5.6, maxZ: -2.5 };
    this.bounds.walk.areas.push(this.medArea);
    this.box(0.08, 2.3, 2.0, mpMat, 9.0, 1.15, -5.0);
    this.box(0.08, 2.3, 2.0, mpMat, 10.6, 1.15, -5.0);
    const mpSign = this.textSign('МЕДПУНКТ ✚', { w: 1.2, h: 0.22, bg: '#f0f4f6', fg: '#b01818' });
    mpSign.position.set(9.8, 2.5, BACK + 0.04); root.add(mpSign);
    this.officeChair(9.5, -5.2, 0.4);
    const kit = this.box(0.5, 0.35, 0.3, this.mat('medKit', { color: 0xe8e8e8 }), 10.2, 0.95, -5.6);
    kit.name = 'kit';
    this.desk(10.2, -5.6, 0.7, 0.5, 0xd8dce0);
    const mpLight = new THREE.PointLight(0xeaf2ff, 4, 4, 1.6); mpLight.position.set(9.8, 2.2, -5); root.add(mpLight);
    this.anchors.medpost = new THREE.Vector3(9.8, 1.6, BACK + 0.1);
    this.anchors.medChair = { x: 9.5, z: -5.2 };

    // interrogation door at the far right
    this.interDoor = this.door(12.2, BACK + 0.02, { sign: 'ДОПРОСНАЯ 2', w: 1.0, color: 0x4a5560 });
    this.anchors.interrogationDoor = new THREE.Vector3(12.2, 2.0, BACK + 0.2);

    // wall clock
    const clockTex = canvasTexture('clock', 128, 128, (ctx, w) => {
      ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(64, 64, 60, 0, 7); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 5; ctx.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.fillStyle = '#222'; ctx.fillRect(64 + Math.cos(a) * 48 - 2, 64 + Math.sin(a) * 48 - 2, 4, 4); }
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 28 * Math.cos(-2.1), 64 + 28 * Math.sin(-2.1)); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + 44 * Math.cos(-1.0), 64 + 44 * Math.sin(-1.0)); ctx.stroke();
    });
    const clock = this.plane(0.42, 0.42, this.mat('clockMat', { map: clockTex, roughness: 0.6 }), 8.4, 2.4, BACK + 0.03);
    clock.name = 'clock';

    // lights: rows of cold fluorescents, one of them flickers
    this.fluos = [];
    for (let x = -12; x <= 12; x += 3) this.fluos.push(this.fluorescent(x, H - 0.04, -0.8, { intensity: 10, range: 6.5 }));
    this.flicker = this.fluos[6];
    const hemi = new THREE.HemisphereLight(0xc8d4e4, 0x30343a, 1.3);
    root.add(hemi);
    this.lights.hemi = hemi;

    // foreground: chairs, a ficus, a desk with files — they frame the shot and fade if needed
    const fg = (x, z, name, build) => {
      const g = new THREE.Group();
      g.name = name;
      build(g);
      g.position.set(x, 0, z);
      root.add(g);
      this.foregroundGroups.push(g);
    };
    const plastic = this.mat('plasticChair', { color: 0x3a5a7a, roughness: 0.6 });
    const steel = this.mat('steel', { color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 });
    for (const [x, name] of [[-9.0, 'fg-chairs-1'], [3.2, 'fg-chairs-2']]) {
      fg(x, 3.0, name, (g) => {
        for (let i = 0; i < 3; i++) {
          this.box(0.5, 0.05, 0.46, plastic, i * 0.58, 0.46, 0, g);
          this.box(0.5, 0.45, 0.05, plastic, i * 0.58, 0.7, 0.21, g);
          for (const s of [-1, 1]) this.box(0.03, 0.46, 0.03, steel, i * 0.58 + s * 0.22, 0.23, 0, g);
        }
      });
    }
    fg(-4.2, 3.4, 'fg-ficus', (g) => {
      this.box(0.4, 0.45, 0.4, this.mat('pot', { color: 0x4a4038, roughness: 0.8 }), 0, 0.22, 0, g);
      const leaf = this.mat('ficus', { color: 0x2a4a30, roughness: 0.9 });
      const r = rng(5);
      for (let i = 0; i < 26; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.12 + r() * 0.08, 6, 5), leaf);
        l.position.set((r() - 0.5) * 0.7, 0.8 + r() * 1.2, (r() - 0.5) * 0.5);
        l.scale.set(1, 0.6, 1);
        g.add(l);
      }
      this.box(0.04, 1.4, 0.04, this.mat('trunk', { color: 0x4a3a2a }), 0, 1.0, 0, g);
    });
    fg(8.2, 3.2, 'fg-desk', (g) => {
      this.box(1.6, 0.04, 0.8, this.mat('desk-fg', { color: 0x6a5a48, roughness: 0.5 }), 0, 0.76, 0, g);
      for (const sx of [-1, 1]) this.box(0.04, 0.74, 0.7, steel, sx * 0.75, 0.37, 0, g);
      for (let i = 0; i < 4; i++) this.box(0.32, 0.04, 0.24, this.mat('folder', { color: [0xc8a860, 0xa8b8c8, 0xc8c0b0, 0x8a4a40][i] }), -0.4 + (i % 2) * 0.1, 0.8 + i * 0.04, 0.05, g);
      this.box(0.36, 0.26, 0.04, this.mat('pcMon', { color: 0x000, emissive: 0x3a6a8a, emissiveIntensity: 1.2 }), 0.45, 0.95, -0.1, g);
    });

    this.dust(new THREE.Box3(new THREE.Vector3(-13, 0.3, -3.5), new THREE.Vector3(13, 2.8, 2)), 260);
    this.anchors.spawn = { x: 6.1, z: -5.2 };
    return root;
  }

  setCellOpen(open) {
    this.cellOpen = open;
    this.cellDoorTarget = open ? this.cellDoorX + 1.1 : this.cellDoorX;
  }

  update(dt) {
    super.update(dt);
    if (this.cellDoorTarget != null) {
      this.cellDoor.position.x += (this.cellDoorTarget - this.cellDoor.position.x) * Math.min(1, dt * 3);
    }
    const f = this.flicker;
    if (f) {
      const on = Math.random() > 0.015;
      f.light.intensity = on ? f.base : 1;
      f.tube.material.emissiveIntensity = on ? 2.2 : 0.3;
    }
  }
}
