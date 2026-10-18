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
    const z = { hindR: -0.006, frontR: -0.004, tail: -0.002, body: 0, hindL: -0.001, frontL: 0.004, ruff: 0.006, head: 0.008 };
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
    this.walkOff = { hindL: 0, frontL: 0.75, hindR: 0.5, frontR: 0.25 };   // touch-down order HL, FL, HR, FR
    this.trotOff = { hindL: 0, frontR: 0, hindR: 0.5, frontL: 0.5 };
    this.gallopOff = { hindL: 0, hindR: 0.1, frontR: 0.45, frontL: 0.55 };
  }

  update(dt) {
    const c = this.char;
    this.t += dt;
    const t = this.t;
    const walking = c.state === 'walk' && !c.seated;
    const speed = walking ? (Math.abs(c.root.userData.vx || 0) > 0.02 ? Math.abs(c.root.userData.vx) : (c.path?.speed ?? c.speed)) : 0;
    const wantRun = walking ? Math.min(1, Math.max(0, (speed - 1.6) / 2.4)) : 0;
    this.run += (wantRun - this.run) * Math.min(1, dt * 4);
    const wantEat = !walking && c.pose === 'eat' ? 1 : 0;
    this.eat += (wantEat - this.eat) * Math.min(1, dt * 3.2);
    const e = this.eat * this.eat * (3 - 2 * this.eat);
    const g = this.run;
    // the rig owns its stride: frequency = speed / stride length (≈1.1 m at a walk, ≈2.6 m in a
    // gallop) — a walking wolf makes ~1.2 strides a second, a galloping one ~2
    if (walking) this.ph = ((this.ph || 0) + dt * speed / (1.1 + 1.5 * g)) % 1;
    const ph = walking ? this.ph : 0;
    const W = walking ? 1 : 0;
    const TAU = Math.PI * 2;
    const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

    // ---- body: bob (twice a stride at a walk/trot; in a gallop highest in the gathered flight),
    // pitch (nose up on the hind push-off, down on landing on the forelegs), breathing
    const P = this.parts;
    const breath = Math.sin(t * 1.7) * 0.006;
    const bob = W * ((1 - g) * Math.cos(ph * TAU * 2) * 0.012 + g * Math.max(0, Math.cos((ph - 0.7) * TAU)) * 0.07);
    const pitch = W * g * Math.sin((ph + 0.1) * TAU) * 8 * D2R
      - e * 14 * D2R;                                              // feeding: the front goes down
    // feeding: the whole body rocks back on each tug at the kill
    const tug = e > 0.01 ? Math.pow(Math.max(0, Math.sin(t * 3.6)), 6) * (Math.sin(t * 0.7) > -0.3 ? 1 : 0) : 0;
    this.bodyG.position.set(this.bodyRest.x - e * tug * 0.03 + (W ? 0 : Math.sin(t * 0.23) * 0.01), this.bodyRest.y + bob - e * 0.07, 0);
    this.bodyG.rotation.z = pitch;
    P.body.g.scale.y = 1 + breath;
    // gallop: the spine flexes and stretches — the shoulders, ruff and head travel with it
    const flex = 1 + W * g * Math.sin(ph * TAU + 1.2) * 0.08;
    P.body.g.scale.x = flex;

    // ---- head and neck: low and level when moving (stretched out with the back in a gallop),
    // a slow look around at rest, right down at the kill
    let head = 0, headX = 0, headY = 0;
    if (W) { head = -6 * (1 - g) - 18 * g + Math.sin(ph * TAU * 2 + 0.6) * 2.5 * (1 - g); headX = g * 0.04; headY = -g * 0.06; }
    else head = Math.sin(t * 0.37) * 3 + Math.sin(t * 0.13) * 2;
    // feeding: the tug pulls back and up, then the muzzle goes down again
    head = head * (1 - e) - e * (70 - tug * 16 + Math.sin(t * 7.1) * 1.5);
    headX = headX * (1 - e) + e * (0.09 - tug * 0.07); headY = headY * (1 - e) - e * 0.27;
    P.head.g.rotation.z = head * D2R;
    P.head.g.position.set(P.head.rest.x * flex + headX, P.head.rest.y + headY, P.head.rest.z);
    // the chest ruff hangs with the neck: one line from the withers to the crown, no hump
    P.ruff.g.rotation.z = (-e * 42 + (W ? Math.sin(ph * TAU * 2) * 2 : 0)) * D2R;
    P.ruff.g.position.set(P.ruff.rest.x * flex + e * 0.06, P.ruff.rest.y - e * 0.15, P.ruff.rest.z);
    P.ruff.g.scale.set(1 - e * 0.08, 1 + breath * 1.5 + e * 0.1 + W * g * 0.06, 1);

    // ---- tail (+ = down): hangs loose and sways at rest and at a walk, rides level in a chase,
    // low while feeding
    const tail = W ? (16 * (1 - g) - 8 * g + Math.sin(ph * TAU * 2) * 4 * (1 - g)) : (20 + Math.sin(t * 0.9) * 3);
    P.tail.g.rotation.z = (tail * (1 - e) + (14 + Math.sin(t * 0.6) * 3) * e) * D2R;

    // ---- legs: swing by gait (walk → trot → gallop blended), lift the paw on the forward swing,
    // brace apart while feeding. Stance shortens from 60% of the stride at a walk to ~28% in a
    // gallop, which opens the suspension phases.
    const cos = Math.cos(this.bodyG.rotation.z), sin = Math.sin(this.bodyG.rotation.z);
    const wt = sstep(0.15, 0.45, g), gt = sstep(0.55, 0.9, g);
    const D = 0.6 - 0.32 * g;
    for (const key of ['hindR', 'frontR', 'hindL', 'frontL']) {
      const L = P[key];
      const front = key.startsWith('front');
      // the attachment point moves with the body (bob, pitch, the flexing spine)
      const atx = L.attach.x * (front ? flex : 1);
      const ax = this.bodyG.position.x + atx * cos - L.attach.y * sin;
      const ay = this.bodyG.position.y + atx * sin + L.attach.y * cos;
      let swing = 0, lift = 0;
      if (W) {
        const lerp = (a, b, k) => a + (b - a) * k;
        // phase offsets blend through the gaits (offsets wrap, so blend the short way round)
        const blend = (a, b, k) => { let d = b - a; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return a + d * k; };
        const off = blend(blend(this.walkOff[key], this.trotOff[key], wt), this.gallopOff[key], gt);
        const u = ((ph + off) % 1 + 1) % 1;
        const amp = (front ? 28 : 24) * lerp(1, 2.2, g);
        if (u < D) swing = amp * (0.5 - u / D);
        else { const s = (u - D) / (1 - D); swing = amp * (-0.5 + s); lift = Math.sin(s * Math.PI) * (0.1 + g * 0.22); }
      } else {
        swing = e * (front ? (key === 'frontL' ? 14 : -8) : (key === 'hindL' ? -3 : 2));   // forelegs brace apart
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
