export const GEAR_RATIOS = [0, 3.5, 2.1, 1.4, 1.05, 0.82];
export const PHASE_OFFSETS = [0, 180, 540, 360];
export const STROKES = [
  { name: 'Ssanie', color: '#68c9ed', description: 'Tłok schodzi w dół. Otwarty zawór dolotowy wpuszcza powietrze, a przy wtrysku pośrednim — mieszankę powietrza z paliwem.' },
  { name: 'Sprężanie', color: '#bd9aff', description: 'Tłok idzie w górę, a oba zawory są zamknięte. Ładunek w cylindrze zostaje sprężony. W tym przykładzie wtrysku bezpośredniego paliwo trafia do cylindra podczas sprężania.' },
  { name: 'Praca', color: '#ffb34c', description: 'Iskra inicjuje spalanie. Rozprężające się gazy pchają tłok w dół, a korbowód obraca wał. To jedyny suw, który dostarcza energię mechaniczną.' },
  { name: 'Wydech', color: '#ed7e77', description: 'Tłok wraca do góry. Otwarty zawór wydechowy pozwala usunąć spaliny. Następnie cały cykl zaczyna się od nowa.' }
];

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const cycleDegrees = (angle, cylinder = 0) => ((angle + PHASE_OFFSETS[cylinder]) % 720 + 720) % 720;
export const strokeIndex = (angle, cylinder = 0) => Math.floor(cycleDegrees(angle, cylinder) / 180);
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
      injection: 'mpi', clutchSlip: 0, stalled: false
    });
  }

  shift(gear) {
    if (!Number.isInteger(gear) || gear < 0 || gear >= GEAR_RATIOS.length) return false;
    if (gear === this.gear) return true;
    if (this.clutch < 0.85) return false;
    this.gear = gear;
    return true;
  }

  start() {
    if (this.gear !== 0 && this.clutch < 0.85) return false;
    this.running = true;
    this.stalled = false;
    this.rpm = 900;
    return true;
  }

  update(dt) {
    if (this.paused) return;
    const steps = Math.ceil(Math.min(dt, 0.1) / 0.002);
    for (let i = 0; i < steps; i++) this.integrate(Math.min(dt, 0.1) / steps);
    const scale = this.animationScale;
    this.angle = (this.angle + this.rpm * 6 * dt * scale) % 720;
    this.inputAngle += this.inputOmega * dt * scale;
    this.outputAngle += this.speed / 0.31 * 3.9 * dt * scale;
  }

  integrate(dt) {
    let omega = this.rpm * Math.PI / 30;
    const ratio = GEAR_RATIOS[this.gear];
    const boostTarget = this.turbo && this.running ? this.throttle * clamp((this.rpm - 1300) / 2000, 0, 1) * 0.8 : 0;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * 2);
    const torqueCurve = clamp(1 - ((this.rpm - 3500) / 5700) ** 2, 0.25, 1);
    const idle = clamp((940 - this.rpm) * 0.55, 0, 85);
    const combustion = this.running && this.rpm < 6500 ? 170 * this.throttle * torqueCurve * (1 + this.boost * 0.65) + idle : 0;
    const friction = omega > 0 ? 15 + this.rpm * 0.0045 : 0;
    if (ratio) this.inputOmega = this.speed / 0.31 * ratio * 3.9;
    const slip = omega - this.inputOmega;
    const capacity = 260 * (1 - this.clutch) ** 2;
    const clutchTorque = clamp(slip * 8, -capacity, capacity);
    this.clutchSlip = Math.abs(slip) * 30 / Math.PI;
    this.transmittedTorque = clutchTorque;
    this.torque = Math.max(0, combustion - friction);
    omega = Math.max(0, omega + (combustion - friction - clutchTorque) / 0.24 * dt);
    if (!ratio) this.inputOmega = Math.max(0, this.inputOmega + (clutchTorque - this.inputOmega * 0.007) / 0.07 * dt);
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
