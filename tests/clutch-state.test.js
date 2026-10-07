import test from 'node:test';
import assert from 'node:assert/strict';
import { manualClutchState } from '../src/manual-clutch.js';
import { Simulation } from '../src/simulation.js';
import { getEngine } from '../src/engines.js';

const pedals = [0, 0.5, 0.72, 0.84, 0.85, 1];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10,
  `${actual} != ${expected}`);

test('manual clutch state remains finite and bounded across and outside the pedal range', () => {
  for (const pedal of [-3, ...pedals, 4]) {
    const state = manualClutchState(pedal);
    for (const value of Object.values(state).filter(value => typeof value === 'number')) {
      assert.ok(Number.isFinite(value), `pedal ${pedal}`);
      assert.ok(value >= 0, `pedal ${pedal}`);
    }
    for (const key of ['pedal', 'clampFactor', 'release']) {
      assert.ok(state[key] <= 1, `${key} at pedal ${pedal}`);
    }
    assert.equal(state.contact, state.clampFactor > 0);
    if (state.plateGap > 0) {
      assert.equal(state.contact, false);
      assert.ok(state.discFloat > 0 && state.discFloat < state.plateGap);
    }
  }
  assert.deepEqual(manualClutchState(-3), manualClutchState(0));
  assert.deepEqual(manualClutchState(4), manualClutchState(1));
});

test('actual manual torque reaches the shared capacity for both slip directions and engine scales', () => {
  for (const engineId of ['r4', 'v8']) for (const pedal of pedals) for (const direction of [1, -1]) {
    const sim = new Simulation();
    sim.setEngine(engineId);
    sim.clutch = pedal;
    // Large relative speed reaches the friction limit rather than the
    // unsaturated speed-matching part of the model.
    sim.rpm = direction > 0 ? 3000 : 900;
    sim.inputOmega = direction > 0 ? 0 : 1000;
    const state = manualClutchState(pedal, getEngine(engineId).torque);
    sim.update(0.001);
    near(sim.clutchCapacity, state.capacity);
    near(sim.clutchForce, state.force);
    near(sim.clutchClamp, state.clampFactor);
    near(sim.transmittedTorque, direction * state.capacity);
    assert.ok(sim.slipPower >= 0);
    if (!state.contact) {
      assert.equal(sim.transmittedTorque, 0);
      assert.equal(sim.slipPower, 0);
    }
  }
});

test('zero clamp and an open gap precede the separate manual shift interlock', () => {
  for (const pedal of [0.72, 0.84, 0.85, 1]) {
    const sim = new Simulation();
    sim.clutch = pedal;
    const state = manualClutchState(pedal);
    assert.equal(state.contact, false);
    assert.equal(state.capacity, 0);
    assert.equal(sim.shift(1), pedal >= 0.85, `pedal ${pedal}`);
    if (pedal > 0.72) assert.ok(state.plateGap > 0);
  }
});

test('shift disconnection suppresses torque without inventing a pedal movement', () => {
  const state = manualClutchState(0.5, 170, true);
  const clamped = manualClutchState(0.5);
  assert.equal(state.capacity, 0);
  near(state.force, clamped.force);
  near(state.plateGap, clamped.plateGap);
  const sim = new Simulation();
  sim.clutch = 1;
  sim.shift(1);
  sim.clutch = 0.5;
  sim.rpm = 3000;
  sim.inputOmega = 0;
  sim.update(0.001);
  assert.notEqual(sim.shiftTarget, null);
  assert.equal(sim.clutchCapacity, 0);
  assert.equal(sim.transmittedTorque, 0);
});
