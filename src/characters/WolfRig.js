import * as THREE from 'three';
import { WOLF_RIG } from '../../data/wolfRig.js';

const PX = 0.01; // metres per sprite pixel (1 px = 1 cm)
const D2R = Math.PI / 180;

/**
 * A wolf animated from its eight painted parts (tools/wolf_rig.py) instead of baked frames.
 *
 * Gaits follow real canids: a slow walk is a symmetrical four-beat lateral sequence
 * (hind-left, fore-left, hind-right, fore-right); faster it becomes a trot (diagonal pairs move
 * together, a little suspension) and in a chase a rotary gallop (the body flexes and stretches,
 * head and tail level with the back). Feeding: the forelegs brace apart, the shoulders and the
 * chest ruff drop with the neck (no hump), the head works at the kill with short tugging pulls.
 * Idle: breathing in the barrel and ruff, a slow look around, the tail hanging loose.
 *
 * Paws stay on the ground: each leg is re-attached every frame to the moving body and stretched
 * or folded so its paw lands where it stood.
 */
export class WolfRig {
  constructor(char, colour) {
    this.char = char;
    const L = WOLF_RIG[colour];
    this.L = L;
    this.group = new THREE.Group();
    this.parts = {};
    this.eat = 0;          // 0 standing … 1 head down at the kill
    this.run = 0;          // 0 walk … 1 gallop
    this.t = Math.random() * 10;
    // rig space: x forward (facing +x), y up, centred on the barrel
    const body = L.parts.body;
    this.cx = body.l + body.w * 0.5;
    const piv = (p) => ({ x: p.l + p.fx * p.w - this.cx, y: L.H - (p.t + p.fy * p.h) });
    const mesh = (key) => {
      const p = L.parts[key];
      const tex = char.atlas.texture.clone(); tex.needsUpdate = true;
      const f = char.atlas.frame(`wolf_${colour}_p_${key}`);
      const [W, H] = char.atlas.size;
      tex.offset.set(f.x / W, 1 - (f.y + f.h) / H);
      tex.repeat.set(f.w / W, f.h / H);
      const geo = new THREE.PlaneGeometry(p.w * PX, p.h * PX);
      geo.translate(p.w * (0.5 - p.fx) * PX, p.h * (p.fy - 0.5) * PX, 0);
      const m = new THREE.Mesh(geo, char.makeMaterial(tex));
      if (char.def.layer) m.layers.set(char.def.layer);
      return m;
    };
    // body group pivots at the hips; head, ruff and tail ride on it
    const bp = piv(body);
    this.bodyG = new THREE.Group(); this.bodyG.position.set(bp.x * PX, bp.y * PX, 0);
    this.bodyRest = this.bodyG.position.clone();
    const z = { hindR: -0.006, frontR: -0.004, tail: -0.002, body: 0, hindL: 0.002, frontL: 0.004, ruff: 0.006, head: 0.008 };
    for (const key of ['tail', 'body', 'ruff', 'head']) {
      const g = new THREE.Group();
      const p = piv(L.parts[key]);
      g.position.set((p.x - bp.x) * PX, (p.y - bp.y) * PX, z[key]);
      g.add(mesh(key));
      if (key === 'body') { g.position.set(0, 0, 0); }
      this.bodyG.add(g);
      this.parts[key] = { g, rest: g.position.clone() };
    }
    this.group.add(this.bodyG);
    // legs hang from attachment points on the body
    for (const key of ['hindR', 'frontR', 'hindL', 'frontL']) {
      const p = L.parts[key], pv = piv(p);
      const g = new THREE.Group(); g.add(mesh(key));
      g.position.set(pv.x * PX, pv.y * PX, z[key]);
      this.group.add(g);
      const len = p.h * (1 - p.fy) * PX;                          // pivot → paw
      this.parts[key] = { g, attach: new THREE.Vector2((pv.x - bp.x) * PX, (pv.y - bp.y) * PX), len, ground: pv.y * PX - len };
    }
    // the gait: phase offsets of each foot in the stride (lateral walk), and for the trot / gallop
    this.walkOff = { hindL: 0, frontL: 0.25, hindR: 0.5, frontR: 0.75 };
    this.trotOff = { hindL: 0, frontR: 0, hindR: 0.5, frontL: 0.5 };
    this.gallopOff = { hindL: 0, hindR: 0.1, frontR: 0.45, frontL: 0.55 };
  }

  update(dt) {
    const c = this.char;
    this.t += dt;
    const t = this.t;
    const walking = c.state === 'walk' && !c.seated;
    const speed = walking ? Math.hypot(c.root.userData.vx || 0, 0) || (c.path?.speed ?? c.speed) : 0;
    const wantRun = walking ? Math.min(1, Math.max(0, (speed - 1.6) / 2.4)) : 0;
    this.run += (wantRun - this.run) * Math.min(1, dt * 4);
    const wantEat = !walking && c.pose === 'eat' ? 1 : 0;
    this.eat += (wantEat - this.eat) * Math.min(1, dt * 3.2);
    const e = this.eat * this.eat * (3 - 2 * this.eat);
    const g = this.run;
    // stride phase: one full stride per 6 walk beats (Character2D.walkPhase)
    const ph = walking ? (c.walkPhase / 6) : 0;
    const W = walking ? 1 : 0;

    // ---- body: bob (twice a stride at a walk/trot, once in a gallop), pitch, breathing
    const P = this.parts;
    const breath = Math.sin(t * 1.7) * 0.006;
    const bob = W * ((1 - g) * Math.cos(ph * Math.PI * 4) * 0.012 + g * Math.cos(ph * Math.PI * 2) * 0.05);
    const pitch = W * g * Math.sin(ph * Math.PI * 2) * 5 * D2R      // the gallop rocks the body
      - e * 11 * D2R;                                              // feeding: the front goes down
    this.bodyG.position.set(this.bodyRest.x, this.bodyRest.y + bob - e * 0.05, 0);
    this.bodyG.rotation.z = pitch;
    P.body.g.scale.y = 1 + breath;
    // gallop: the spine stretches and flexes
    P.body.g.scale.x = 1 + W * g * Math.sin(ph * Math.PI * 2 + 1.2) * 0.07;

    // ---- head and neck: low and level when moving, a slow look around at rest, down at the kill
    let head = 0, headX = 0, headY = 0;
    if (W) head = -6 * (1 - g) - 10 * g + Math.sin(ph * Math.PI * 4 + 0.6) * 2.5 * (1 - g);
    else head = Math.sin(t * 0.37) * 3 + Math.sin(t * 0.13) * 2;
    // feeding: head right down, tugging back in short pulls, now and then a shake
    const tug = Math.pow(Math.max(0, Math.sin(t * 2.3)), 4);
    head = head * (1 - e) - e * (66 + tug * 9 + Math.sin(t * 7.1) * 1.5);
    headX = -e * tug * 0.06 + e * 0.05; headY = -e * 0.2;
    P.head.g.rotation.z = head * D2R;
    P.head.g.position.set(P.head.rest.x + headX, P.head.rest.y + headY, P.head.rest.z);
    // the chest ruff hangs with the neck: no hump when the head is down
    P.ruff.g.rotation.z = (-e * 32 + (W ? Math.sin(ph * Math.PI * 4) * 2 : breath * 60)) * D2R;
    P.ruff.g.position.set(P.ruff.rest.x + e * 0.03, P.ruff.rest.y - e * 0.1, P.ruff.rest.z);
    P.ruff.g.scale.y = 1 + breath * 1.5 + e * 0.06;

    // ---- tail: hangs loose and sways at rest, rides level behind in a chase, low while feeding
    const tail = W ? (-4 * (1 - g) + 18 * g + Math.sin(ph * Math.PI * 4) * 4) : (-6 + Math.sin(t * 0.9) * 4);
    P.tail.g.rotation.z = (tail * (1 - e) + (-14 + Math.sin(t * 0.6) * 3) * e) * D2R;

    // ---- legs: swing by gait, lift the paw on the forward swing, brace apart while feeding
    const cos = Math.cos(this.bodyG.rotation.z), sin = Math.sin(this.bodyG.rotation.z);
    for (const key of ['hindR', 'frontR', 'hindL', 'frontL']) {
      const L = P[key];
      const front = key.startsWith('front');
      // the attachment point moves with the body (bob, pitch)
      const ax = this.bodyG.position.x + L.attach.x * cos - L.attach.y * sin;
      const ay = this.bodyG.position.y + L.attach.x * sin + L.attach.y * cos;
      let swing = 0, lift = 0;
      if (W) {
        const off = (1 - g) * (g < 0.5 ? this.walkOff[key] : this.trotOff[key]) + g * this.gallopOff[key];
        const u = ((ph + off) % 1 + 1) % 1;
        const amp = (front ? 24 : 20) * (1 + g * 1.7);
        // stance (u < 0.6): the paw sweeps back; swing (u ≥ 0.6): it comes forward, lifted
        if (u < 0.6) swing = amp * (0.5 - u / 0.6);
        else { const s = (u - 0.6) / 0.4; swing = amp * (-0.5 + s); lift = Math.sin(s * Math.PI) * (0.1 + g * 0.12); }
      } else {
        swing = e * (front ? (key === 'frontL' ? 9 : -5) : (key === 'hindL' ? -3 : 2));   // forelegs brace apart
      }
      const th = swing * D2R;
      L.g.position.set(ax, ay, L.g.position.z);
      L.g.rotation.z = th;
      // the paw stays on the ground: stretch / fold the leg to reach it (lifted on the swing)
      const reach = Math.max(0.05, (ay - L.ground) - lift);
      L.g.scale.y = Math.min(1.08, Math.max(0.62, reach / (L.len * Math.max(0.5, Math.cos(th)))));
    }
  }
}
