export function needsSimulationFrames(sim) {
  return !sim.paused && (sim.suspensionActive || sim.running ||
    sim.transmission === 'hybrid' && sim.hybridEnabled || sim.rpm > .1 ||
    sim.speed > .001 || Math.abs(sim.inputOmega) > .01 ||
    sim.shiftTarget !== null || sim.wheelSlip.some(slip => slip > .01) ||
    // Pressure and hydraulic actuation can still settle after the shafts stop.
    sim.boost > .001 || sim.transmission === 'automatic' &&
      (sim.automatic.lockup > 0 || sim.automatic.shiftCooldown > 0));
}
