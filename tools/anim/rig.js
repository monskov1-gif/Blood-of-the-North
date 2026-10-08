// Cut-out character rig: skeleton (FK + 2-bone IK legs), sprite parts from one sheet,
// a biomechanical walk cycle and an idle stance. Character space = the owner's reference
// frame (side view, facing +x, y down, ground at GROUND). No dependencies.

export const GROUND = 955;

// ---------------------------------------------------------------- parts on the sheet
// rect: [x0, y0, x1, y1] on tools/art/girl/parts_sheet.png
// at:   where the part-local point `pin` lands in the bind pose (character space)
// scale: the parts were painted at different scales; each is fitted to the reference
export const PARTS = {
  hair_back:  { rect: [238, 20, 479, 364], scale: 1.0, pin: [150, 40], at: [150, 160] },
  arm_far:    { rect: [303, 436, 436, 690], scale: 0.95, pin: [42, 14], at: [166, 304] },
  leg_far:    { rect: [606, 748, 689, 966], scale: 1.06, pin: [40, 0], at: [156, 590] },
  boot_far:   { rect: [1234, 793, 1374, 971], scale: 0.8, pin: [55, 0], at: [192, 816] },
  torso_back: { rect: [1262, 23, 1474, 361], scale: 0.93, pin: [110, 10], at: [160, 272] },
  skirt:      { rect: [898, 509, 1135, 668], scale: 0.5, pin: [118, 10], at: [156, 560] },
  leg_near:   { rect: [234, 748, 321, 969], scale: 1.06, pin: [40, 0], at: [148, 590] },
  boot_near:  { rect: [920, 799, 1073, 971], scale: 0.8, pin: [50, 0], at: [150, 816] },
  torso_front:{ rect: [1007, 22, 1242, 398], scale: 0.93, pin: [118, 10], at: [165, 272] },
  bag:        { rect: [570, 420, 722, 704], scale: 0.98, pin: [112, 4], at: [152, 290] },
  arm_near:   { rect: [59, 427, 224, 705], scale: 1.0, pin: [40, 12], at: [140, 300] },
  scarf:      { rect: [751, 22, 924, 375], scale: 0.86, pin: [80, 20], at: [190, 270] },
  head:       { rect: [4, 90, 214, 304], scale: 0.78, pin: [115, 190], at: [172, 268] },
  hair_front: { rect: [508, 25, 707, 362], scale: 0.8, pin: [100, 10], at: [168, 128] },
  earphones:  { rect: [1262, 473, 1345, 695], scale: 0.8, pin: [12, 4], at: [156, 214] }, // one bud: the other ear is out of view
};

// ---------------------------------------------------------------- skeleton (bind pose)
// name: [parent, x, y]  (joint position in character space)
export const JOINTS = {
  pelvis: [null, 152, 530],
  chest: ['pelvis', 160, 300],
  neck: ['chest', 172, 268],
  headTop: ['neck', 178, 140],
  shoulderN: ['chest', 140, 300], elbowN: ['shoulderN', 148, 440], wristN: ['elbowN', 178, 540],
  shoulderF: ['chest', 166, 304], elbowF: ['shoulderF', 172, 436], wristF: ['elbowF', 208, 534],
  hipN: ['pelvis', 148, 530], kneeN: ['hipN', 151, 691], ankleN: ['kneeN', 150, 905], toeN: ['ankleN', 228, 950], heelN: ['ankleN', 112, 952],
  hipF: ['pelvis', 156, 530], kneeF: ['hipF', 159, 694], ankleF: ['kneeF', 192, 905], toeF: ['ankleF', 270, 950], heelF: ['ankleF', 154, 952],
};

// sprite → bone (the bone that carries it); limbs are cut in two at the joint
export const ATTACH = [
  // [part, bone, seg]  seg: { joint, side: 'up'|'down', r } — limbs are cut at the joint with a round
  // overlap (a disc of radius r around the joint belongs to both pieces), so a bent knee or elbow
  // never shows the corner of a cut
  ['hair_back', 'hairB'],
  ['arm_far', 'elbowF', { joint: 'elbowF', side: 'down', r: 30 }], ['arm_far', 'shoulderF', { joint: 'elbowF', side: 'up', r: 30 }],
  ['leg_far', 'kneeF', { joint: 'kneeF', side: 'down', r: 34 }], ['leg_far', 'hipF', { joint: 'kneeF', side: 'up', r: 34 }],
  ['boot_far', 'kneeF', { joint: 'ankleF', side: 'up', r: 30 }], ['boot_far', 'ankleF', { joint: 'ankleF', side: 'down', r: 30 }],
  ['torso_back', 'chest'],
  ['skirt', 'pelvis'],
  ['leg_near', 'kneeN', { joint: 'kneeN', side: 'down', r: 34 }], ['leg_near', 'hipN', { joint: 'kneeN', side: 'up', r: 34 }],
  ['boot_near', 'kneeN', { joint: 'ankleN', side: 'up', r: 30 }], ['boot_near', 'ankleN', { joint: 'ankleN', side: 'down', r: 30 }],
  ['torso_front', 'chest'],
  ['bag', 'bag'],
  ['hair_front', 'hairF'],
  ['scarf', 'scarf'],
  ['arm_near', 'elbowN', { joint: 'elbowN', side: 'down', r: 32 }], ['arm_near', 'shoulderN', { joint: 'elbowN', side: 'up', r: 32 }],
  ['head', 'neck'],
  ['earphones', 'neck'],
];
// spring-driven accessories hang from these joints (bind positions)
const SPRINGS = { bag: [140, 300, 'chest'], scarf: [182, 278, 'chest'], hairB: [150, 175, 'neck'], hairF: [175, 175, 'neck'] };

const D2R = Math.PI / 180;
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const ang = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const len = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export class Rig {
  constructor(img) {
    this.img = img;
    this.bind = {};
    for (const [k, [, x, y]] of Object.entries(JOINTS)) this.bind[k] = [x, y];
    for (const [k, [x, y]] of Object.entries(SPRINGS)) this.bind[k] = [x, y];
    const b = this.bind;
    this.L = {
      thighN: len(...b.hipN, ...b.kneeN), shinN: len(...b.kneeN, ...b.ankleN),
      thighF: len(...b.hipF, ...b.kneeF), shinF: len(...b.kneeF, ...b.ankleF),
    };
    this.spring = { bag: [0, 0], scarf: [0, 0], hairB: [0, 0], hairF: [0, 0] }; // [angle, velocity]
    this.t = 0; this.dist = 0; this.mode = 'idle'; this.blend = 0;
    this.speed = 1; // 1 = normal walking pace
  }

  // ---------------------------------------------------------------- pose
  /** World pose: every bone gets an origin [x,y] and a rotation delta from the bind pose. */
  solve(dt) {
    this.t += dt;
    const walkW = (this.blend += ((this.mode === 'walk' ? 1 : 0) - this.blend) * Math.min(1, dt * 5));
    const P = {};
    const b = this.bind;
    // gait timing: cadence ~108 steps/min at speed 1, stride grows with speed
    const cycleT = 1.12 / Math.pow(this.speed, 0.45);
    const stride = 640 * Math.pow(this.speed, 0.6);           // px, two steps (≈ 1.3 m at 5 px/cm)
    const vel = stride / cycleT;
    if (this.mode === 'walk') this.phase = ((this.phase || 0) + dt / cycleT) % 1;
    const ph = this.phase || 0;
    this.vel = vel * walkW;
    this.dist += this.vel * dt;

    // foot path relative to the hip (ground space). Stance: the planted foot travels backwards
    // exactly as fast as the body moves forward (no sliding); swing: lift, carry, reach.
    const ST = 0.62;                                  // stance share of the cycle
    const A = stride * ST * 0.53, B = stride * ST * 0.47;   // ahead of / behind the hip
    const foot = (p) => {
      let fx, lift = 0, footA = 0;
      if (p < ST) {
        const q = p / ST;
        fx = lerp(A, -B, q);
        if (q < 0.12) footA = lerp(15, 0, smooth(q / 0.12));                 // heel strike, toe up
        else if (q > 0.68) footA = -lerp(0, 35, smooth((q - 0.68) / 0.32));  // heel off, roll onto the toe
      } else {
        const q = (p - ST) / (1 - ST);
        fx = lerp(-B, A, smooth(q));
        lift = Math.sin(Math.min(1, q * 1.3) * Math.PI) * 30 + Math.sin(q * Math.PI) * 8;
        footA = q < 0.3 ? lerp(-35, 0, smooth(q / 0.3)) : lerp(0, 15, smooth((q - 0.3) / 0.7));
      }
      return { fx: fx * walkW, lift: lift * walkW, footA: footA * walkW, stance: p < ST };
    };
    const feet = { N: foot(ph), F: foot((ph + 0.5) % 1) };
    // pelvis height from the legs (compass gait): the hip may be no lower than a stance leg allows
    // with a slightly flexed knee — high at mid-stance, low at double support, no fixed sine
    const breathe = Math.sin(this.t * 2 * Math.PI * 0.23);
    const idleSway = Math.sin(this.t * 2 * Math.PI * 0.11) * 2 * (1 - walkW);
    const ankleOf = (side, f) => {
      const heel0 = b[`heel${side}`], toe0 = b[`toe${side}`], ank0 = b[`ankle${side}`];
      const piv0 = f.footA >= 0 ? heel0 : toe0;
      const fa = -f.footA * D2R;
      const [ax, ay] = rot(ank0[0] - piv0[0], ank0[1] - piv0[1], fa);
      return [piv0[0] + f.fx + ax, piv0[1] - f.lift + ay, fa];
    };
    let pelY = b.pelvis[1];
    if (walkW > 0.001) {
      let need = -1e9;
      for (const side of ['N', 'F']) {
        const f = feet[side];
        const [axx, ayy] = ankleOf(side, f);
        const R = (this.L[`thigh${side}`] + this.L[`shin${side}`]) * (f.stance ? 0.995 : 0.999);
        const dx = axx - b[`hip${side}`][0];
        const hipY = ayy - Math.sqrt(Math.max(0, R * R - dx * dx));   // lowest the hip may sit (y down)
        if (f.stance) need = Math.max(need, hipY);
      }
      if (need < -1e8) need = b.pelvis[1];
      const target = Math.max(b.pelvis[1] - 2, need) - b.hipN[1] + b.pelvis[1];
      this.pelY = this.pelY == null ? target : lerp(this.pelY, target, Math.min(1, dt * 18));
      pelY = lerp(b.pelvis[1], this.pelY, walkW);
    } else this.pelY = null;
    const pel = [b.pelvis[0] + idleSway, pelY];
    const bob = b.pelvis[1] - pelY;
    const lean = (3.5 * walkW + 0.6 * breathe * (1 - walkW)) * D2R;   // torso pitch (forward = +)
    const twist = Math.sin(ph * 2 * Math.PI) * 1.2 * D2R * walkW;
    P.pelvis = { o: pel, a: Math.sin(ph * 4 * Math.PI) * 0.8 * D2R * walkW };
    const chestA = lean + twist;
    const fk = (name, parent, a) => {
      const [px, py] = P[parent].o, pb = b[parent];
      const [dx, dy] = rot(b[name][0] - pb[0], b[name][1] - pb[1], P[parent].a);
      P[name] = { o: [px + dx, py + dy], a: P[parent].a + a };
    };
    fk('chest', 'pelvis', chestA - P.pelvis.a);
    // breathing: the chest rises a little
    P.chest.o[1] -= 1.2 * breathe * (1 - walkW);
    fk('neck', 'chest', 0);
    // the head stays level (counter-rotates the torso), small nod with the step
    P.neck.a = -lean * 0.6 + Math.sin(ph * 4 * Math.PI + 0.6) * 0.7 * D2R * walkW + Math.sin(this.t * 0.7) * 0.4 * D2R * (1 - walkW);

    // arms: swing opposite to the leg on the same side, elbow bends more on the forward swing
    const swing = (side) => {
      const p = side === 'N' ? ph : (ph + 0.5) % 1;
      const s = Math.sin((p - 0.04) * 2 * Math.PI);                 // + = arm back (near leg forward)
      const sh = (-s * 17 * walkW + 1.2 * breathe * (1 - walkW)) * D2R;
      const el = (-(6 + 10 * Math.max(0, -s)) * walkW - 2 * (1 - walkW)) * D2R;   // forearm forward
      fk(`shoulder${side}`, 'chest', 0);
      P[`shoulder${side}`].a = P.chest.a * 0.3 + sh;
      fk(`elbow${side}`, `shoulder${side}`, el);
      fk(`wrist${side}`, `elbow${side}`, 0);
    };
    swing('N'); swing('F');

    // legs: foot path in ground space, 2-bone IK for hip and knee
    for (const side of ['N', 'F']) {
      const hip = `hip${side}`, knee = `knee${side}`, ankle = `ankle${side}`;
      fk(hip, 'pelvis', 0);
      const [hx, hy] = P[hip].o;
      const [tx0, ty0, fa] = ankleOf(side, feet[side]);
      let tx = tx0, ty = ty0;
      // 2-bone IK (knee points forward = +x)
      const l1 = this.L[`thigh${side}`], l2 = this.L[`shin${side}`];
      let dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy);
      const maxR = (l1 + l2) * 0.999;
      if (d > maxR) { tx = hx + dx / d * maxR; ty = hy + dy / d * maxR; dx = tx - hx; dy = ty - hy; d = maxR; }
      const a0 = Math.atan2(dy, dx);
      const cosK = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
      const aThigh = a0 - Math.acos(Math.max(-1, Math.min(1, cosK)));   // knee bends forward
      const kx = hx + Math.cos(aThigh) * l1, ky = hy + Math.sin(aThigh) * l1;
      const aShin = Math.atan2(ty - ky, tx - kx);
      const bThigh = ang(...b[hip], ...b[knee]), bShin = ang(...b[knee], ...b[ankle]);
      P[hip].a = aThigh - bThigh;
      P[knee] = { o: [kx, ky], a: aShin - bShin };
      P[ankle] = { o: [tx, ty], a: fa };
    }

    // accessories on damped springs: they lag behind the body's motion
    const acc = this.lastPel ? [(pel[0] - this.lastPel[0]) / Math.max(dt, 1e-3), (pel[1] - this.lastPel[1]) / Math.max(dt, 1e-3)] : [0, 0];
    this.lastPel = pel.slice();
    const vy = acc[1];
    const drive = { bag: [vy * 0.0016 + Math.sin(ph * 4 * Math.PI) * 0.03 * walkW, 0.045 * walkW], scarf: [vy * 0.0012, 0.07 * walkW],
      hairB: [vy * 0.001, 0.05 * walkW], hairF: [vy * 0.0014, 0.06 * walkW] };
    const k = { bag: 60, scarf: 40, hairB: 55, hairF: 70 }, c = { bag: 7, scarf: 5, hairB: 6, hairF: 7 };
    for (const n of Object.keys(this.spring)) {
      const s = this.spring[n];
      const [kick, trail] = drive[n];
      const target = trail + Math.sin(this.t * 1.3 + n.length) * 0.006;
      s[1] += (-(s[0] - target) * k[n] - s[1] * c[n]) * dt + kick * dt * 60 * 0.15;
      s[0] += s[1] * dt;
    }
    for (const n of Object.keys(SPRINGS)) {
      const par = SPRINGS[n][2];
      fk(n, par, this.spring[n][0]);
    }
    P.bag.a += 0; // the bag swings back when walking (positive = clockwise = back for +x facing)
    this.P = P;
    return P;
  }

  // ---------------------------------------------------------------- draw
  draw(ctx, { skeleton = false } = {}) {
    const P = this.P, b = this.bind;
    for (const [part, bone, seg] of ATTACH) {
      const pt = PARTS[part];
      const [x0, y0, x1, y1] = pt.rect;
      const w = x1 - x0, h = y1 - y0, s = pt.scale;
      // bind placement of the part: local point `pin` at `at`
      const ox = pt.at[0] - pt.pin[0] * s, oy = pt.at[1] - pt.pin[1] * s;
      const J = P[bone], jb = b[bone];
      ctx.save();
      ctx.translate(J.o[0], J.o[1]);
      ctx.rotate(J.a);
      ctx.translate(-jb[0], -jb[1]);
      if (seg) {
        const [jx, jy] = b[seg.joint], r = seg.r;
        ctx.beginPath();
        if (seg.side === 'up') ctx.rect(ox - 50, oy - 50, w * s + 100, jy - oy + 50);
        else ctx.rect(ox - 50, jy, w * s + 100, oy + h * s - jy + 50);
        ctx.moveTo(jx + r, jy); ctx.arc(jx, jy, r, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(this.img, x0, y0, w, h, ox, oy, w * s, h * s);
      ctx.restore();
    }
    if (skeleton) this.drawSkeleton(ctx);
  }

  drawSkeleton(ctx) {
    const P = this.P;
    ctx.save();
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    const line = (a, bb, col) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(...P[a].o); ctx.lineTo(...P[bb].o); ctx.stroke(); };
    const tip = (j, from, to) => { const b = this.bind; const [dx, dy] = rot(b[to][0] - b[from][0], b[to][1] - b[from][1], P[from].a); return [P[from].o[0] + dx, P[from].o[1] + dy]; };
    const seg = (from, to, col) => { const [x, y] = tip(null, from, to); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(...P[from].o); ctx.lineTo(x, y); ctx.stroke(); };
    line('pelvis', 'chest', '#ffd84a'); line('chest', 'neck', '#ffd84a'); seg('neck', 'headTop', '#ffd84a');
    for (const [s, col] of [['F', '#4ac0ff'], ['N', '#ff7a4a']]) {
      line('chest', `shoulder${s}`, col); line(`shoulder${s}`, `elbow${s}`, col); seg(`elbow${s}`, `wrist${s}`, col);
      line('pelvis', `hip${s}`, col); line(`hip${s}`, `knee${s}`, col); line(`knee${s}`, `ankle${s}`, col);
      seg(`ankle${s}`, `toe${s}`, col); seg(`ankle${s}`, `heel${s}`, col);
    }
    for (const n of ['bag', 'scarf', 'hairB', 'hairF']) { ctx.fillStyle = '#b0ff7a'; ctx.beginPath(); ctx.arc(...P[n].o, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#fff';
    for (const [n, J] of Object.entries(P)) { if (['bag', 'scarf', 'hairB', 'hairF'].includes(n)) continue; ctx.beginPath(); ctx.arc(...J.o, 4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
}
