import { ENGINES, getEngine } from './engines.js';
import { DCT_RATIOS, FINAL_RATIO, WHEEL_RADIUS, VEHICLE_MASS, evaluateTraction, dctSelection, dctEngagement, DRIVE_LAYOUTS } from './powertrain.js';
import { createHybridState, integrateHybrid } from './hybrid.js';

export const GEAR_RATIOS = [0, 3.5, 2.1, 1.4, 1.05, 0.82];
export const PHASE_OFFSETS = ENGINES.r4.offsets;
export const STROKES = [
  { name: 'Ssanie', color: '#68c9ed', description: 'Tłok oddala się od głowicy. Otwarty zawór dolotowy wpuszcza powietrze, a przy MPI lub gaźniku — mieszankę powietrza z paliwem.' },
  { name: 'Sprężanie', color: '#bd9aff', description: 'Tłok zbliża się do głowicy, a zawory dolotowe i wydechowe są zamknięte. Ładunek w cylindrze zostaje sprężony. W tym przykładzie wtrysku bezpośredniego paliwo trafia do cylindra podczas sprężania.' },
  { name: 'Praca', color: '#ffb34c', description: 'Spalanie zaczyna się od iskry pod koniec sprężania. Front płomienia zużywa mieszankę, po czym zanika. Gorące gazy nadal rozprężają się i pchają tłok w stronę wału, przekazując energię przez korbowód.' },
  { name: 'Wydech', color: '#c4d0dc', description: 'Tłok zbliża się do głowicy i wypycha produkty spalania przez otwarte zawory wydechowe. Jasne znaczniki pokazują drogę gazów. To nie czarny dym: normalne spaliny są w większości niewidoczne. Gazy nie przechodzą przez tłok ani wał.' }
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
    Object.assign(this, {
      transmission: 'manual', driveLayout: 'rwd', driveMode: '2H', centerLock: false, frontLock: false, rearLock: false,
      surfaces: ['asphalt', 'asphalt', 'asphalt', 'asphalt'], wheelAngles: [0, 0, 0, 0], wheelSlip: [0, 0, 0, 0], axleAngles: [0, 0],
      dct: { ...dctSelection(0), engagement: [0, 0], torques: [0, 0], omegas: [0, 0], angles: [0, 0], automatic: false },
      hybrid: createHybridState(), hybridEnabled: true
    });
    this.traction = evaluateTraction(this, 0);
  }

  get ratios() { return this.transmission === 'dct' ? DCT_RATIOS : GEAR_RATIOS; }
  get transferRatio() { return this.driveLayout === 'partTime' && this.driveMode === '4L' ? 2.5 : 1; }
  get outputOmega() { return this.traction.inputOmega * FINAL_RATIO * this.transferRatio; }

  setTransmission(id) {
    if (!['manual', 'dct', 'hybrid'].includes(id)) return false;
    this.transmission = id;
    this.gear = 0;
    this.shiftTarget = null;
    this.shiftProgress = 0;
    this.clutch = 0;
    this.throttle = 0;
    this.brake = 0;
    this.speed = 0;
    this.wheelSlip.fill(0);
    this.rpm = id === 'hybrid' ? 0 : 900;
    this.running = id !== 'hybrid';
    this.inputOmega = this.rpm * Math.PI / 30;
    this.transmittedTorque = this.torque = this.clutchSlip = this.boost = 0;
    this.stalled = false;
    this.dct = { ...dctSelection(0), engagement: [0, 0], torques: [0, 0], omegas: [0, 0], angles: [0, 0], automatic: false };
    if (id === 'hybrid') { this.driveLayout = 'fwd'; this.turbo = false; this.hybrid.range = 'D'; }
    this.traction = evaluateTraction(this, 0);
    return true;
  }

  setDriveLayout(id) {
    if (!DRIVE_LAYOUTS[id] || this.transmission === 'hybrid' && id !== 'fwd') return false;
    this.driveLayout = id;
    this.centerLock = false;
    this.frontLock = this.rearLock = false;
    this.driveMode = id === 'partTime' ? '2H' : '4H';
    this.traction = evaluateTraction(this, 0);
    return true;
  }

  setEngine(id) {
    if (!ENGINES[id]) return false;
    this.engineId = id;
    this.timing = ENGINES[id].timing;
    return true;
  }

  shift(gear) {
    if (this.transmission === 'hybrid' || !Number.isInteger(gear) || gear < 0 || gear >= this.ratios.length) return false;
    if (this.shiftTarget !== null) return false;
    if (gear === this.gear) return true;
    if (this.transmission === 'manual' && this.clutch < 0.85) return false;
    this.shiftFrom = this.gear;
    this.shiftTarget = gear;
    this.shiftProgress = 0;
    if (this.transmission === 'manual') this.gear = 0;
    return true;
  }

  get shiftStage() {
    if (this.shiftTarget === null) return 'idle';
    if (this.transmission === 'dct') return this.shiftProgress < 0.2 ? 'preselect' : this.shiftProgress < 0.8 ? 'handover' : 'lock';
    return this.shiftProgress < 0.25 ? 'release' : this.shiftProgress < 0.75 ? 'synchronize' : 'engage';
  }

  advanceShift(dt) {
    if (this.shiftTarget === null) return;
    this.shiftProgress = Math.min(1, this.shiftProgress + dt / (this.transmission === 'dct' ? 1.6 : 2.4));
    if (this.shiftProgress >= 1) {
      this.gear = this.shiftTarget;
      if (this.gear) this.inputOmega = this.outputOmega * this.ratios[this.gear];
      this.shiftTarget = null;
      if (this.transmission === 'dct') Object.assign(this.dct, dctSelection(this.gear));
    }
  }

  start() {
    if (this.transmission === 'hybrid') { this.hybridEnabled = true; return true; }
    if (this.transmission === 'manual' && (this.gear !== 0 || this.shiftTarget !== null) && this.clutch < 0.85) return false;
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
    this.outputAngle += this.outputOmega * dt * scale;
    this.differentialAngle += this.speed / 0.31 * this.turn * 0.5 * dt * scale;
    this.traction.wheels.forEach((wheel, i) => { this.wheelAngles[i] += wheel.omega * dt * scale; });
    this.traction.carrierOmega.forEach((omega, i) => { this.axleAngles[i] += omega * dt * scale; });
    this.dct.omegas.forEach((omega, i) => { this.dct.angles[i] += omega * dt * scale; });
    this.hybrid.mg1Angle += this.hybrid.mg1Omega * dt * scale;
    this.hybrid.mg2Angle += this.hybrid.mg2Omega * dt * scale;
    this.hybrid.carrierAngle += this.rpm * Math.PI / 30 * dt * scale;
  }

  integrate(dt) {
    if (this.transmission === 'hybrid') {
      const torque = integrateHybrid(this, dt, getEngine(this.engineId));
      this.move(torque * FINAL_RATIO * 0.96, dt, true);
      if (this.hybrid.range === 'P') this.speed = 0;
      return;
    }
    if (this.transmission === 'dct') { this.integrateDct(dt); return; }
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
    if (ratio) this.inputOmega = this.outputOmega * ratio;
    const slip = omega - this.inputOmega;
    const capacity = this.shiftTarget !== null ? 0 : 260 * torqueScale * clamp((0.85 - this.clutch) / 0.85, 0, 1) ** 2;
    const clutchTorque = capacity === 0 ? 0 : clamp(slip * 8, -capacity, capacity);
    this.clutchSlip = Math.abs(slip) * 30 / Math.PI;
    this.transmittedTorque = clutchTorque;
    this.torque = Math.max(0, combustion - friction);
    omega = Math.max(0, omega + (combustion - friction - clutchTorque) / engine.inertia * dt);
    if (!ratio) this.inputOmega = Math.max(0, this.inputOmega + (clutchTorque - this.inputOmega * 0.007) / 0.07 * dt);
    if (this.shiftTarget && this.shiftStage === 'synchronize') {
      const target = this.outputOmega * GEAR_RATIOS[this.shiftTarget];
      this.inputOmega += (target - this.inputOmega) * Math.min(1, dt * 32);
    }
    this.move(ratio ? clutchTorque * ratio * FINAL_RATIO * this.transferRatio * 0.92 : 0, dt);
    this.rpm = clamp(omega * 30 / Math.PI, 0, 6800);
    if (this.running && this.rpm < 380) {
      this.running = false;
      this.stalled = true;
    }
    if (!this.running && this.rpm < 20) this.rpm = 0;
  }

  move(wheelTorque, dt, hybrid = false) {
    this.traction = evaluateTraction(this, wheelTorque);
    this.traction.wheels.forEach((wheel, i) => {
      const rate = wheel.slipTarget > wheel.slip ? wheel.surface === 'asphalt' ? 2 : 16 : 45;
      this.wheelSlip[i] = Math.max(0, wheel.slip + clamp(wheel.slipTarget - wheel.slip, -rate * dt, rate * dt));
    });
    const resistance = this.speed > 0.01 ? 140 + this.speed ** 2 * 0.42 : 0;
    const regenerated = hybrid ? Math.max(0, -this.traction.force) : 0;
    const braking = Math.max(0, this.brake * 9500 - regenerated);
    this.speed = Math.max(0, this.speed + (this.traction.force - resistance - braking) / VEHICLE_MASS * dt);
  }

  integrateDct(dt) {
    this.advanceShift(dt);
    const state = this.dct;
    if (this.shiftTarget === null) Object.assign(state, dctSelection(this.gear));
    else if (this.shiftTarget && (this.shiftFrom % 2 !== this.shiftTarget % 2 || this.shiftProgress > 0.5)) state.selected[this.shiftTarget % 2 ? 0 : 1] = this.shiftTarget;
    state.engagement = dctEngagement(this.gear, this.shiftTarget, this.shiftProgress);
    const engine = getEngine(this.engineId);
    const omega = this.rpm * Math.PI / 30;
    const torqueScale = engine.torque / 170;
    const curve = clamp(1 - ((this.rpm - 3500) / 5700) ** 2, 0.25, 1);
    const idle = clamp((970 - this.rpm) * 0.65, 0, 100);
    const boostTarget = this.turbo && this.running ? this.throttle * clamp((this.rpm - 1300) / 2000, 0, 1) * 0.8 : 0;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * 2);
    const combustion = this.running && this.rpm < 6500 ? (engine.torque * this.throttle * curve * (1 + this.boost * 0.65) + idle * torqueScale) : 0;
    const friction = omega > 0 ? (15 + this.rpm * 0.0045) * torqueScale : 0;
    const launch = clamp((this.rpm - 700) / 650, 0, 1);
    state.omegas = state.selected.map(gear => this.outputOmega * DCT_RATIOS[gear]);
    state.torques = state.omegas.map((input, i) => clamp((omega - input) * 6, -300 * torqueScale, 300 * torqueScale) * state.engagement[i] * launch);
    const transmitted = state.torques[0] + state.torques[1];
    this.rpm = clamp((omega + (combustion - friction - transmitted) / engine.inertia * dt) * 30 / Math.PI, 0, 6800);
    this.torque = Math.max(0, combustion - friction);
    this.transmittedTorque = transmitted;
    this.inputOmega = state.omegas[state.active < 0 ? 0 : state.active];
    this.clutchSlip = Math.abs(this.rpm - this.inputOmega * 30 / Math.PI);
    const outputTorque = state.torques.reduce((total, torque, i) => total + torque * DCT_RATIOS[state.selected[i]], 0);
    this.move(outputTorque * FINAL_RATIO * this.transferRatio * 0.92, dt);
    if (!this.running && this.rpm < 20) this.rpm = 0;
    if (state.automatic && this.running && this.shiftTarget === null && this.gear) {
      if (this.rpm > 3300 && this.gear < 6) this.shift(this.gear + 1);
      else if (this.rpm < 1300 && this.gear > 1) this.shift(this.gear - 1);
    }
  }
}
