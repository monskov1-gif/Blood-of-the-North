/**
 * Moves the player character from the unified input axis. Depth movement is
 * slower than lateral (it reads better from a side camera). Supports an
 * "impairment" hook used during the hallucination (drift, lag, stumbles).
 */
export class PlayerController {
  constructor(character, input, nav, audio) {
    this.c = character;
    this.input = input;
    this.nav = nav;
    this.audio = audio;
    this.enabled = false;
    this.vx = 0; this.vz = 0;
    this.impair = 0;        // 0..1
    this.stepAcc = 0;
    this.time = 0;
  }

  /**
   * Seated / restrained scenes (police car): the axis moves a "gaze" point
   * that drives interactions instead of the character.
   *   setGaze({ x, z, minX, maxX, y }) / setGaze(null)
   */
  setGaze(cfg) {
    this.gaze = cfg ? { position: { x: cfg.x, y: cfg.y ?? 1, z: cfg.z }, cfg } : null;
  }

  update(dt) {
    this.time += dt;
    if (this.gaze) {
      if (this.enabled) {
        const a = this.input.axis;
        const g = this.gaze;
        g.position.x = Math.min(g.cfg.maxX, Math.max(g.cfg.minX, g.position.x + a.x * dt * 1.6));
      }
      this.c.root.userData.vx = 0;
      return;
    }
    const c = this.c;
    let ax = 0, az = 0;
    if (this.enabled) {
      const a = this.input.axis;
      ax = a.x; az = a.y;
    }
    const run = this.enabled && this.input.running ? 1.5 : 1;
    let tx = ax * c.speed * run;
    let tz = az * c.speed * 0.6 * run;
    if (this.impair > 0) {
      const t = this.time;
      // drunken drift and delayed response
      tx = tx * (1 - this.impair * 0.55) + Math.sin(t * 0.9) * 0.45 * this.impair;
      tz = tz * (1 - this.impair * 0.5) + Math.sin(t * 1.3 + 1) * 0.3 * this.impair;
    }
    const resp = 10 * (1 - this.impair * 0.85);
    this.vx += (tx - this.vx) * Math.min(1, dt * resp);
    this.vz += (tz - this.vz) * Math.min(1, dt * resp);
    if (Math.abs(this.vx) < 0.01 && Math.abs(this.vz) < 0.01 && !this.impair) { this.vx = 0; this.vz = 0; }
    if (c.state === 'collapse' || c.state === 'rise' || c.isDead || c.seated || c.path) { c.root.userData.vx = 0; return; }
    const p = this.nav.clamp(c.position.x + this.vx * dt, c.position.z + this.vz * dt);
    const realVx = (p.x - c.position.x) / Math.max(dt, 1e-4);
    const realVz = (p.z - c.position.z) / Math.max(dt, 1e-4);
    c.position.x = p.x; c.position.z = p.z;
    c.driveWalk(realVx, realVz, dt);
    const speed = Math.hypot(realVx, realVz);
    if (speed > 0.2) {
      this.stepAcc += dt * speed;
      if (this.stepAcc > 0.62) { this.stepAcc = 0; this.audio.play('sfx.step', { volume: 0.7, pan: 0 }); }
    }
  }
}
