import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { createFrameLoop } from '../src/frame-loop.js';
import { needsSimulationFrames } from '../src/simulation-activity.js';

function stoppedSimulation() {
  const sim = new Simulation();
  Object.assign(sim, { running: false, paused: false, rpm: 0, speed: 0, inputOmega: 0, clutch: 1 });
  return sim;
}

function runUntilSettled(sim) {
  let callback;
  const loop = createFrameLoop({
    requestFrame: next => { callback = next; return 1; },
    cancelFrame: () => { callback = undefined; },
    isActive: () => needsSimulationFrames(sim), isVisible: () => true, maxFps: () => 30,
    advance: dt => sim.update(dt), render: () => false, updateUI: () => {}
  });
  loop.invalidate();
  let frames = 0;
  try {
    while (callback && frames < 360) {
      const next = callback;
      callback = undefined;
      next(frames++ * 1000 / 60);
    }
    assert.equal(callback, undefined, 'completed work should eventually let the loop sleep');
  } finally { loop.dispose(); }
  return frames;
}

for (const transmission of ['manual', 'dct', 'automatic']) {
  for (const target of [1, 0]) {
    test(`${transmission} completes a shift to ${target || 'neutral'} with every shaft stopped`, () => {
      const sim = stoppedSimulation();
      sim.setTransmission(transmission);
      Object.assign(sim, { running: false, rpm: 0, speed: 0, inputOmega: 0, clutch: 1, gear: target ? 0 : 1 });
      assert.equal(needsSimulationFrames(sim), false);
      assert.equal(sim.shift(target), true);
      assert.equal(needsSimulationFrames(sim), true, 'an accepted shift needs time even at zero RPM');
      sim.paused = true;
      assert.equal(needsSimulationFrames(sim), false, 'global pause also freezes a pending shift');
      sim.paused = false;
      assert.ok(runUntilSettled(sim) > 1, 'the initial zero-dt wake cannot complete a staged shift');
      assert.equal(sim.shiftTarget, null);
      assert.equal(sim.gear, target);
    });
  }
}

test('switching off EV drive at rest lets remaining wheel slip decay before sleeping', () => {
  const sim = new Simulation();
  sim.setTransmission('hybrid');
  Object.assign(sim, { throttle: .3, surfaces: ['ice', 'ice', 'asphalt', 'asphalt'] });
  sim.hybrid.mode = 'ev';
  sim.hybrid.range = 'D';
  for (let i = 0; i < 5; i++) sim.update(1 / 60);
  sim.hybridEnabled = false;
  sim.brake = 1;
  sim.update(1 / 60);
  assert.equal(sim.running, false);
  assert.equal(sim.rpm, 0);
  assert.equal(sim.speed, 0);
  assert.equal(sim.inputOmega, 0);
  assert.ok(sim.wheelSlip.some(slip => slip > .1), 'the real EV transition leaves spinning wheels');
  assert.equal(needsSimulationFrames(sim), true);
  runUntilSettled(sim);
  assert.ok(sim.wheelSlip.every(slip => slip <= .01));
});

for (const transmission of ['manual', 'dct', 'automatic']) {
  test(`${transmission} lets turbo pressure fall below the readout precision after shutting down at rest`, () => {
    const sim = new Simulation();
    sim.setTransmission(transmission);
    Object.assign(sim, { clutch: 1, throttle: 1, turbo: true, brake: 1 });
    for (let i = 0; i < 180; i++) sim.update(1 / 60);
    assert.equal(sim.shift(1), true);
    for (let i = 0; i < 160; i++) sim.update(1 / 60);
    assert.ok(sim.boost > .01, 'the running engine has built real boost');
    Object.assign(sim, { running: false, clutch: 0 });
    runUntilSettled(sim);
    assert.equal(sim.rpm, 0);
    assert.equal(sim.speed, 0);
    assert.ok(sim.boost <= .001, `sleep must not freeze ${sim.boost.toFixed(3)} bar in the stopped engine`);
    assert.equal(sim.boost.toFixed(2), '0.00', 'both pressure readouts should show atmospheric pressure');
  });
}

test('an automatic finishes its shift cooldown before sleeping with every shaft stopped', () => {
  const sim = stoppedSimulation();
  sim.setTransmission('automatic');
  Object.assign(sim, { running: false, rpm: 0, speed: 0, inputOmega: 0 });
  assert.equal(sim.shift(1), true);
  runUntilSettled(sim);
  assert.equal(sim.gear, 1);
  assert.equal(sim.shiftTarget, null);
  assert.equal(sim.automatic.shiftCooldown, 0, 'later ignition must not resume a cooldown frozen during an unpaused stop');
});

test('an automatic completes the remaining lock-up release after its shafts stop', () => {
  const sim = stoppedSimulation();
  sim.setTransmission('automatic');
  Object.assign(sim, { running: false, rpm: 0, speed: 0, inputOmega: 0 });
  // Lock-up has continuous travel. Its remaining hydraulic release is
  // independent of the already stopped pump, turbine and vehicle.
  sim.automatic.lockup = .65;
  assert.equal(needsSimulationFrames(sim), true);
  runUntilSettled(sim);
  assert.equal(sim.automatic.lockup, 0);
});
