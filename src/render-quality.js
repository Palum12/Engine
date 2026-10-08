export class RenderQuality {
  constructor() { this.setMode('auto'); }
  setMode(mode) {
    if (!['auto', 'economy', 'high'].includes(mode)) return false;
    this.mode = mode; this.reduced = mode === 'economy'; this.slow = this.fast = 0;
    return true;
  }
  // Hysteresis avoids toggling quality on a preset change or a single expensive frame.
  observe(milliseconds, dt) {
    if (this.mode !== 'auto') return;
    const elapsed = Math.max(0, Math.min(dt, .1));
    this.slow = milliseconds > 28 ? this.slow + elapsed : 0;
    this.fast = milliseconds < 20 ? this.fast + elapsed : 0;
    if (!this.reduced && this.slow >= 3) { this.reduced = true; this.fast = 0; }
    else if (this.reduced && this.fast >= 10) { this.reduced = false; this.slow = 0; }
  }
  settings(dpr = 1) {
    return { pixelRatio: Math.min(dpr, this.reduced ? 1 : 1.6), maxFps: this.reduced ? 30 : 60, particleFraction: this.reduced ? .5 : 1 };
  }
}
