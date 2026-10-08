const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Pedal=0 means released. The bearing/diaphragm move throughout pedal travel,
// while the pressure plate remains in contact until clamping force reaches zero.
// These visible, enlarged travels are explanatory, not millimetre OEM dimensions.
export function manualClutchState(pedal, engineTorque = 170, disconnected = false) {
  const travel = clamp(pedal);
  const clampFactor = 1 - smooth(travel / 0.72);
  const release = smooth((travel - 0.72) / 0.28);
  const capacityScale = engineTorque / 170;
  return {
    pedal: travel, clampFactor, contact: clampFactor > 0,
    capacity: disconnected ? 0 : 260 * capacityScale * clampFactor,
    force: 5200 * capacityScale * clampFactor,
    release, plateGap: release * 0.10, discFloat: release * 0.035,
    fingerTravel: travel * 0.16,
    bearingClearance: 0.015 * (1 - smooth(travel / 0.08))
  };
}

// One reading of the actual simulation drives the lesson and its 3D cues.
// Pedal position reduces capacity; it does not, by itself, imply sliding.
export function manualClutchPresentation({ state, engineRpm, inputOmega, transmittedTorque, exploded = false }) {
  const relativeOmega = Math.abs(engineRpm * Math.PI / 30 - inputOmega);
  const slipRpm = relativeOmega * 30 / Math.PI;
  const synchronous = slipRpm <= 60;
  const operational = !exploded;
  const torque = operational && state.contact ? Math.min(Math.abs(transmittedTorque), state.capacity) : 0;
  const heatPower = torque * relativeOmega;
  const kind = exploded ? 'exploded' : !state.contact ? 'open' : !synchronous && torque > 0.2 ? 'slip' : synchronous ? 'grip' : 'contact';
  const color = kind === 'slip' ? 0xffa24f : ['grip', 'contact'].includes(kind) ? 0x75efad : 0x9fb8ca;
  return { kind, slipRpm, torque, heatPower, color, operational, synchronous };
}
