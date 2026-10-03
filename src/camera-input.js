import { MOUSE, TOUCH } from 'three';

export class CameraInput {
  constructor(element, controls, onInteract = () => {}) {
    this.element = element;
    this.controls = controls;
    this.onInteract = onInteract;
    this.device = 'auto';
    this.pan = false;
    this.gestureScale = null;
    this.wheelAt = -Infinity;
    this.listeners = {
      wheel: event => this.wheel(event),
      gesturestart: event => this.gesture(event, 'start'),
      gesturechange: event => this.gesture(event, 'change'),
      gestureend: event => this.gesture(event, 'end')
    };
    for (const [name, listener] of Object.entries(this.listeners)) element.addEventListener(name, listener, { capture: true, passive: false });
  }

  setDevice(device) {
    this.device = ['auto', 'touchpad', 'mouse'].includes(device) ? device : 'auto';
    this.wheelAt = -Infinity;
  }

  setPan(pan) {
    this.pan = Boolean(pan);
    this.controls.mouseButtons.LEFT = this.pan ? MOUSE.PAN : MOUSE.ROTATE;
    this.controls.touches.ONE = this.pan ? TOUCH.PAN : TOUCH.ROTATE;
    this.element.dataset.cameraPan = this.pan;
  }

  zoom(factor) {
    if (!this.controls.enabled || !this.controls.enableZoom || !Number.isFinite(factor) || factor <= 0) return;
    this.onInteract();
    this.controls.dollyOut(1 / factor);
  }

  wheel(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.controls.enabled || this.gestureScale !== null) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(1, this.element.clientHeight) : 1;
    const x = event.deltaX * unit;
    const y = event.deltaY * unit;
    if (event.ctrlKey || event.metaKey) {
      this.zoom(Math.exp(Math.max(-100, Math.min(100, y)) * 0.01));
      return;
    }
    if (event.timeStamp - this.wheelAt > 180) this.wheelSource = event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 50 || !Number.isInteger(event.deltaY)) ? 'touchpad' : 'mouse';
    this.wheelAt = event.timeStamp;
    const device = this.device === 'auto' ? this.wheelSource : this.device;
    if (device === 'touchpad') {
      if (!this.controls.enablePan) return;
      this.onInteract();
      this.controls.pan(x, -y);
    } else this.zoom(Math.exp(Math.max(-240, Math.min(240, y)) * 0.0025));
  }

  gesture(event, phase) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (phase === 'end') { this.gestureScale = null; return; }
    const scale = Number(event.scale);
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (phase === 'change' && this.gestureScale !== null) this.zoom(this.gestureScale / scale);
    this.gestureScale = scale;
  }

  dispose() {
    for (const [name, listener] of Object.entries(this.listeners)) this.element.removeEventListener(name, listener, true);
  }
}
