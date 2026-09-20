import { ENGINES, getEngine } from './engines.js';

export const GEAR_RATIOS = [0, 3.5, 2.1, 1.4, 1.05, 0.82];
export const PHASE_OFFSETS = ENGINES.r4.offsets;
export const STROKES = [
  { name: 'Ssanie', color: '#68c9ed', description: 'Tłok schodzi w dół. Otwarty zawór dolotowy wpuszcza powietrze, a przy MPI lub gaźniku — mieszankę powietrza z paliwem.' },
  { name: 'Sprężanie', color: '#bd9aff', description: 'Tłok idzie w górę, a oba zawory są zamknięte. Ładunek w cylindrze zostaje sprężony. W tym przykładzie wtrysku bezpośredniego paliwo trafia do cylindra podczas sprężania.' },
  { name: 'Praca', color: '#ffb34c', description: 'Iskra inicjuje spalanie. Rozprężające się gazy pchają tłok w dół, a korbowód obraca wał. To jedyny suw, który dostarcza energię mechaniczną.' },
  { name: 'Wydech', color: '#ed7e77', description: 'Tłok wraca do góry. Otwarty zawór wydechowy pozwala usunąć spaliny. Następnie cały cykl zaczyna się od nowa.' }
];

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const cycleDegrees = (angle, cylinder = 0, engineId = 'r4') => ((angle + getEngine(engineId).offsets[cylinder]) % 720 + 720) % 720;
export const strokeIndex = (angle, cylinder = 0, engineId = 'r4') => Math.floor(cycleDegrees(angle, cylinder, engineId) / 180);
export const pistonHeight = (angle) => {
  const radians = angle * Math.PI / 180;
  return 0.65 * Math.cos(radians) + Math.sqrt(4 - (0.65 * Math.sin(radians)) ** 2) + 0.8;
};

export class Simulation {
  constructor() { this.reset(); }

  reset() {
    Object.assign(this, {
      rpm: 900, speed: 0, throttle: 0, clutch: 0, brake: 0,
      gear: 0, running: true, paused: false, turbo: false,
      boost: 0, torque: 0, transmittedTorque: 0, inputOmega: 900 * Math.PI / 30,
      angle: 30, inputAngle: 0, outputAngle: 0, animationScale: 0.02,
      injection: 'mpi', timing: 'belt', clutchSlip: 0, stalled: false, engineId: 'r4',
      shiftTarget: null, shiftFrom: 0, shiftProgress: 0, turn: 0, differentialAngle: 0
    });
  }

  setEngine(id) {
    if (!ENGINES[id]) return false;
    this.engineId = id;
    return true;
  }

  shift(gear) {
    if (!Number.isInteger(gear) || gear < 0 || gear >= GEAR_RATIOS.length) return false;
    if (this.shiftTarget !== null) return false;
    if (gear === this.gear) return true;
    if (this.clutch < 0.85) return false;
    this.shiftFrom = this.gear;
    this.shiftTarget = gear;
    this.shiftProgress = 0;
    this.gear = 0;
    return true;
  }

  get shiftStage() {
    if (this.shiftTarget === null) return 'idle';
    return this.shiftProgress < 0.25 ? 'release' : this.shiftProgress < 0.75 ? 'synchronize' : 'engage';
  }

  advanceShift(dt) {
    if (this.shiftTarget === null) return;
    this.shiftProgress = Math.min(1, this.shiftProgress + dt / 2.4);
    if (this.shiftProgress >= 1) {
      this.gear = this.shiftTarget;
      if (this.gear) this.inputOmega = this.speed / 0.31 * GEAR_RATIOS[this.gear] * 3.9;
      this.shiftTarget = null;
    }
  }

  start() {
    if ((this.gear !== 0 || this.shiftTarget !== null) && this.clutch < 0.85) return false;
    this.running = true;
    this.stalled = false;
    this.rpm = 900;
    return true;
  }

  update(dt) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const steps = Math.ceil(Math.min(dt, 0.1) / 0.002);
    for (let i = 0; i < steps; i++) this.integrate(Math.min(dt, 0.1) / steps);
    const scale = this.animationScale;
    this.angle = (this.angle + this.rpm * 6 * dt * scale) % 720;
    this.inputAngle += this.inputOmega * dt * scale;
    this.outputAngle += this.speed / 0.31 * 3.9 * dt * scale;
    this.differentialAngle += this.speed / 0.31 * this.turn * 0.5 * dt * scale;
  }

  integrate(dt) {
    this.advanceShift(dt);
    let omega = this.rpm * Math.PI / 30;
    const ratio = GEAR_RATIOS[this.gear];
    const boostTarget = this.turbo && this.running ? this.throttle * clamp((this.rpm - 1300) / 2000, 0, 1) * 0.8 : 0;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * 2);
    const engine = getEngine(this.engineId);
    const torqueScale = engine.torque / 170;
    const torqueCurve = clamp(1 - ((this.rpm - 3500) / 5700) ** 2, 0.25, 1);
    const idle = clamp((940 - this.rpm) * 0.55, 0, 85);
    const combustion = this.running && this.rpm < 6500 ? engine.torque * this.throttle * torqueCurve * (1 + this.boost * 0.65) + idle * torqueScale : 0;
    const friction = omega > 0 ? (15 + this.rpm * 0.0045) * torqueScale : 0;
    if (ratio) this.inputOmega = this.speed / 0.31 * ratio * 3.9;
    const slip = omega - this.inputOmega;
    const capacity = this.shiftTarget !== null ? 0 : 260 * torqueScale * clamp((0.85 - this.clutch) / 0.85, 0, 1) ** 2;
    const clutchTorque = capacity === 0 ? 0 : clamp(slip * 8, -capacity, capacity);
    this.clutchSlip = Math.abs(slip) * 30 / Math.PI;
    this.transmittedTorque = clutchTorque;
    this.torque = Math.max(0, combustion - friction);
    omega = Math.max(0, omega + (combustion - friction - clutchTorque) / engine.inertia * dt);
    if (!ratio) this.inputOmega = Math.max(0, this.inputOmega + (clutchTorque - this.inputOmega * 0.007) / 0.07 * dt);
    if (this.shiftTarget && this.shiftStage === 'synchronize') {
      const target = this.speed / 0.31 * GEAR_RATIOS[this.shiftTarget] * 3.9;
      this.inputOmega += (target - this.inputOmega) * Math.min(1, dt * 32);
    }
    const force = ratio ? clutchTorque * ratio * 3.9 * 0.92 / 0.31 : 0;
    const resistance = this.speed > 0.01 ? 140 + this.speed ** 2 * 0.42 : 0;
    this.speed = Math.max(0, this.speed + (force - resistance - this.brake * 9500) / 1250 * dt);
    this.rpm = clamp(omega * 30 / Math.PI, 0, 6800);
    if (this.running && this.rpm < 380) {
      this.running = false;
      this.stalled = true;
    }
    if (!this.running && this.rpm < 20) this.rpm = 0;
  }
}
