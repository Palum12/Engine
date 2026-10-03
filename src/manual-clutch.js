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
    release, plateGap: release * 0.28, discFloat: release * 0.08,
    fingerTravel: travel * 0.42,
    bearingClearance: 0.04 * (1 - smooth(travel / 0.08))
  };
}
