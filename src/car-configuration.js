import { getCarPreset } from './car-presets.js';

export function applyCarPreset(sim, id) {
  const preset = getCarPreset(id);
  if (!preset) return false;
  const { paused, animationScale } = sim;
  sim.reset();
  sim.setEngine(preset.engineId);
  sim.setTransmission(preset.transmission);
  sim.setEnginePlacement(preset.enginePlacement);
  sim.setEngineOrientation(preset.engineOrientation);
  sim.setDriveLayout(preset.driveLayout);
  Object.assign(sim, { turbo: preset.turbo, injection: preset.injection, timing: preset.timing, paused, animationScale });
  if (preset.transmission === 'dct') sim.dct.automatic = true;
  return true;
}
