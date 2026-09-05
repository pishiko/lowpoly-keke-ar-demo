// Procedural plush animation. All dimensions are relative to a one-unit-tall model.
export const DURATIONS = { squish: 1.05, jump: 1.25, fall: 0.85, getup: 0.85, spin: 1.3 };
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
export class PlushMotion {
  constructor() { this.reset(); }
  reset() { this.action = null; this.elapsed = 0; this.clock = 0; this.phase = 0; this.lying = false; this.speed = 0; this.events = []; }
  play(name) {
    if (name === 'fall' && this.lying) name = 'getup';
    if (!DURATIONS[name] || this.action || (this.lying && name !== 'getup' && name !== 'squish')) return false;
    this.action = name; this.elapsed = 0; this.events.push(name); return true;
  }
  update(dt, moving = 0, reducedMotion = false) {
    this.clock += dt;
    this.speed += (moving - this.speed) * (1 - Math.exp(-dt * 14));
    const oldStep = Math.floor(this.phase / Math.PI);
    this.phase += dt * 12 * Math.min(1, this.speed * 1.5);
    if (this.speed > 0.1 && Math.floor(this.phase / Math.PI) > oldStep && !this.lying) this.events.push('step');
    const breath = reducedMotion ? 0 : Math.sin(this.clock * 2.6) * 0.013;
    let sy = 1 + breath - Math.cos(this.phase * 2) * this.speed * 0.045;
    let y = Math.abs(Math.sin(this.phase)) * this.speed * 0.045;
    let roll = Math.sin(this.phase) * this.speed * 0.065;
    let yaw = 0;
    const name = this.action;
    if (name) {
      const previous = this.elapsed;
      this.elapsed += dt;
      const t = Math.min(1, this.elapsed / DURATIONS[name]);
      if (name === 'squish') sy += -0.3 * Math.sin(t * Math.PI * 4) * Math.exp(-t * 3.5);
      if (name === 'jump') {
        if (t < 0.16) sy -= 0.22 * Math.sin(t / 0.16 * Math.PI / 2);
        else if (t < 0.76) { const air = (t - 0.16) / 0.6; y += 0.57 * 4 * air * (1 - air); sy += 0.13 * Math.sin(air * Math.PI); }
        else sy -= 0.23 * Math.sin((t - 0.76) / 0.24 * Math.PI) * (1 - (t - 0.76) / 0.3);
        if (previous < DURATIONS.jump * 0.76 && this.elapsed >= DURATIONS.jump * 0.76) this.events.push('land');
      }
      if (name === 'fall') {
        roll = Math.PI / 2 * smooth(t / 0.72) + (t > 0.72 ? Math.sin((t - 0.72) * 22) * 0.08 * (1 - t) : 0);
        if (previous < DURATIONS.fall * 0.72 && this.elapsed >= DURATIONS.fall * 0.72) this.events.push('land');
      }
      if (name === 'getup') { roll = Math.PI / 2 * (1 - smooth(t)); sy -= Math.sin(t * Math.PI) * 0.12; }
      if (name === 'spin') { yaw = Math.PI * 2 * smooth(t); y += Math.sin(t * Math.PI) * 0.11; sy += Math.sin(t * Math.PI * 2) * 0.05; }
      if (t >= 1) { if (name === 'fall') this.lying = true; if (name === 'getup') this.lying = false; this.action = null; }
    }
    if (this.lying && name !== 'getup') roll = Math.PI / 2;
    // Lift the side of the plush so its body stays above the floor when it falls.
    y += Math.abs(Math.sin(roll)) * 0.34;
    return { y, roll, yaw, sy, sx: 1 / Math.sqrt(sy), sz: 1 / Math.sqrt(sy) };
  }
  drainEvents() { return this.events.splice(0); }
  get canMove() { return !this.lying && !['fall', 'getup'].includes(this.action); }
}
