import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { createFrameLoop } from '../src/frame-loop.js';
import { needsSimulationFrames } from '../src/simulation-activity.js';

function loopFor(sim) {
  let nextId = 0;
  const callbacks = new Map(), steps = [], readouts = [];
  const loop = createFrameLoop({
    requestFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
    cancelFrame: id => callbacks.delete(id),
    isActive: () => needsSimulationFrames(sim), isVisible: () => true, maxFps: () => 30,
    advance: dt => { steps.push(dt); sim.update(dt); },
    render: () => false,
    updateUI: () => readouts.push({ state: sim.hybrid.state, batteryPower: sim.hybrid.batteryPower, batteryCurrent: sim.hybrid.batteryCurrent })
  });
  const frame = time => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(callback => callback(time));
  };
  return { loop, frame, callbacks, steps, readouts };
}

for (const throttle of [0, .3]) {
  test(`a settled EV shutdown refreshes derived state after waking at zero dt (throttle ${throttle})`, () => {
    const sim = new Simulation();
    sim.setTransmission('hybrid');
    sim.hybrid.mode = 'ev';
    Object.assign(sim, { throttle, brake: 1 });
    sim.update(1 / 60);
    assert.equal(sim.rpm, 0);
    assert.equal(sim.speed, 0);
    assert.equal(sim.inputOmega, 0);
    assert.ok(sim.wheelSlip.every(slip => slip === 0));
    assert.equal(sim.hybrid.batteryPower > 0, throttle > 0, 'the zero-throttle case also needs a new state label without residual power');

    sim.hybridEnabled = false;
    const f = loopFor(sim);
    try {
      f.loop.invalidate();
      f.frame(10_000);
      assert.equal(f.steps[0], 0, 'waking must discard elapsed idle time');
      assert.equal(f.callbacks.size, 1, 'an invalidated wake needs a follow-up step even with every shaft stopped');
      f.frame(10_000 + 1000 / 60);
      assert.ok(f.steps[1] > 0 && f.steps[1] < .02, 'the next sample uses only the new frame interval');
      assert.deepEqual(f.readouts.at(-1), { state: 'Układ hybrydowy wyłączony', batteryPower: 0, batteryCurrent: 0 });
      assert.equal(f.callbacks.size, 0, 'the refreshed terminal state can sleep');
    } finally { f.loop.dispose(); }
  });
}

test('a follow-up wake frame preserves global pause and still lets a stationary scene sleep', () => {
  const sim = new Simulation();
  sim.setTransmission('hybrid');
  sim.hybrid.mode = 'ev';
  Object.assign(sim, { throttle: .3, brake: 1 });
  sim.update(1 / 60);
  sim.paused = true;
  const before = JSON.stringify(sim);
  const f = loopFor(sim);
  try {
    f.loop.invalidate();
    f.frame(10_000);
    assert.equal(f.callbacks.size, 1);
    f.frame(10_000 + 1000 / 60);
    assert.equal(JSON.stringify(sim), before, 'a positive browser interval must not advance paused physics');
    assert.equal(f.callbacks.size, 0, 'a paused scene must sleep after its wake frames');
  } finally { f.loop.dispose(); }
});
