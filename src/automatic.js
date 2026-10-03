import { AUTOMATIC_PLANETARIES, AUTOMATIC_GEAR_MODES, AUTOMATIC_RATIOS } from './powertrain.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const rpm = omega => omega * 30 / Math.PI;
const members = () => ({ sun: 0, ring: 0, carrier: 0, planet: 0 });

export function createAutomaticState() {
  return {
    automatic: true, range: 'N', lockup: 0, speedRatio: 0, slipRpm: 0,
    torqueRatio: 1, statorLocked: false, pumpTorque: 0, turbineTorque: 0,
    lockupTorque: 0, lossPower: 0, pumpOmega: 0, turbineOmega: 0, statorOmega: 0,
    pumpAngle: 0, turbineAngle: 0, statorAngle: 0, shiftCooldown: 0,
    effectiveRatio: 0, gearboxEngagement: 0, stageReductions: [0, 0, 0],
    stageOmegas: AUTOMATIC_PLANETARIES.map(members),
    stageAngles: AUTOMATIC_PLANETARIES.map(members)
  };
}

// Every illustrated module obeys Ns*sun + Nr*ring = (Ns+Nr)*carrier.
// A partially applied brake during a shift changes the reaction-member speed.
export function automaticPlanetarySpeeds(inputOmega, reductions) {
  let input = inputOmega;
  return AUTOMATIC_PLANETARIES.map((set, i) => {
    const factor = i === 3 ? set.reduction : 1 + (set.reduction - 1) * reductions[i];
    const output = input / factor;
    let sun, ring, carrier;
    if (set.input === 'sun') {
      sun = input; carrier = output;
      ring = ((set.sun + set.ring) * carrier - set.sun * sun) / set.ring;
    } else if (set.input === 'ring') {
      ring = input; carrier = output;
      sun = ((set.sun + set.ring) * carrier - set.ring * ring) / set.sun;
    } else {
      carrier = input; ring = output; sun = 0;
    }
    input = output;
    return { sun, ring, carrier, planet: -(sun - carrier) * set.sun / set.planet };
  });
}

// A deliberately small converter characteristic, not an OEM calibration map.
// Its multiplication curve cannot create energy: speedRatio*torqueRatio <= 1.
export function converterTransfer(pumpOmega, turbineOmega, lockup, capacityScale = 1) {
  const slip = pumpOmega - turbineOmega;
  const speedRatio = pumpOmega > 1 ? clamp(turbineOmega / pumpOmega, 0, 1) : 0;
  const statorLocked = slip > 1 && speedRatio < 0.85;
  const torqueRatio = statorLocked ? 1 + 1.1 * (1 - speedRatio / 0.85) : 1;
  const hydraulicTorque = clamp(0.0018 * slip * Math.max(30, Math.abs(pumpOmega)), -350 * capacityScale, 350 * capacityScale) * (1 - lockup);
  const lockupTorque = clamp(slip * 40, -420 * capacityScale, 420 * capacityScale) * lockup;
  const pumpTorque = hydraulicTorque + lockupTorque;
  const turbineTorque = hydraulicTorque * torqueRatio + lockupTorque;
  const lossPower = Math.max(0, pumpTorque * pumpOmega - turbineTorque * turbineOmega);
  return { speedRatio, slipRpm: Math.abs(rpm(slip)), torqueRatio, statorLocked, pumpTorque, turbineTorque, lockupTorque, lossPower };
}

export function integrateAutomatic(sim, dt, engine) {
  const state = sim.automatic;
  sim.advanceShift(dt);
  state.shiftCooldown = Math.max(0, state.shiftCooldown - dt);
  const engagedGear = sim.shiftTarget ?? sim.gear;
  const from = AUTOMATIC_GEAR_MODES[sim.gear];
  const to = AUTOMATIC_GEAR_MODES[engagedGear];
  const shifting = sim.shiftTarget !== null;
  const blend = shifting ? sim.shiftProgress * sim.shiftProgress * (3 - 2 * sim.shiftProgress) : 1;
  state.stageReductions = to.map((reduced, i) => (+from[i]) * (1 - blend) + (+reduced) * blend);
  state.effectiveRatio = engagedGear || sim.gear
    ? state.stageReductions.reduce((ratio, reduction, i) => ratio * (1 + (AUTOMATIC_PLANETARIES[i].reduction - 1) * reduction), 2 / 3)
    : 0;
  state.gearboxEngagement = shifting
    ? sim.gear === 0 ? blend : engagedGear === 0 ? 1 - blend : 1 - 0.18 * Math.sin(sim.shiftProgress * Math.PI)
    : sim.gear ? 1 : 0;

  const omega = sim.rpm * Math.PI / 30;
  const torqueScale = engine.torque / 170;
  const curve = clamp(1 - ((sim.rpm - 3500) / 5700) ** 2, 0.25, 1);
  const idle = clamp((990 - sim.rpm) * 0.9, 0, 140);
  const boostTarget = sim.turbo && sim.running ? sim.throttle * clamp((sim.rpm - 1300) / 2000, 0, 1) * 0.8 : 0;
  sim.boost += (boostTarget - sim.boost) * Math.min(1, dt * 2);
  const combustion = sim.running && sim.rpm < 6500
    ? engine.torque * sim.throttle * curve * (1 + sim.boost * 0.65) + idle * torqueScale : 0;
  const friction = omega > 0 ? (15 + sim.rpm * 0.0045) * torqueScale : 0;
  const wheelInput = sim.outputOmega * state.effectiveRatio;
  if (state.gearboxEngagement > 0) state.turbineOmega = wheelInput;

  const shouldLock = sim.running && sim.gear >= 2 && !shifting && sim.speed > 7 && sim.brake < 0.15 && sim.throttle < 0.85 && rpm(wheelInput) > 1000;
  const lockTarget = shouldLock ? 1 : 0;
  state.lockup = clamp(state.lockup + clamp(lockTarget - state.lockup, -dt * 5, dt * 1.8), 0, 1);
  Object.assign(state, converterTransfer(omega, state.turbineOmega, state.lockup, torqueScale));
  const nextOmega = Math.max(0, omega + (combustion - friction - state.pumpTorque) / engine.inertia * dt);
  sim.rpm = clamp(rpm(nextOmega), 0, 6800);
  if (!sim.running && sim.rpm < 20) sim.rpm = 0;
  state.pumpOmega = sim.rpm * Math.PI / 30;
  if (state.gearboxEngagement === 0) {
    state.turbineOmega = Math.max(0, state.turbineOmega + (state.turbineTorque - state.turbineOmega * 0.035) / 0.12 * dt);
  }
  // Publish torque, heat and speeds from the same time sample. In particular,
  // neutral's free turbine must not display power from its previous speed.
  Object.assign(state, converterTransfer(state.pumpOmega, state.turbineOmega, state.lockup, torqueScale));
  state.statorOmega = state.statorLocked ? 0 : state.turbineOmega * 0.6;
  state.stageOmegas = automaticPlanetarySpeeds(state.turbineOmega, state.stageReductions);
  sim.inputOmega = state.turbineOmega;
  sim.torque = Math.max(0, combustion - friction);
  sim.transmittedTorque = state.turbineTorque * state.gearboxEngagement;
  sim.clutchSlip = state.slipRpm;

  if (state.automatic && state.range === 'D' && sim.running && !shifting && sim.gear && state.shiftCooldown === 0) {
    const upperRpm = 1900 + sim.throttle * 2500;
    if (sim.rpm > upperRpm && sim.gear < 8 && rpm(sim.outputOmega * AUTOMATIC_RATIOS[sim.gear + 1]) > 1000) sim.shift(sim.gear + 1);
    else if (sim.gear > 1 && (rpm(wheelInput) < 950 || sim.throttle > 0.65 && sim.rpm < 2200)) sim.shift(sim.gear - 1);
  }
  return sim.transmittedTorque * state.effectiveRatio;
}
