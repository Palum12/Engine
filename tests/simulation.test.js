import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, pistonHeight, strokeIndex, cycleDegrees, GEAR_RATIOS } from '../src/simulation.js';

function advance(sim, seconds, fps = 60) {
  for (let n = 0; n < seconds * fps; n++) sim.update(1 / fps);
}
function launch() {
  const sim = new Simulation();
  sim.clutch = 1;
  sim.throttle = 0.25;
  sim.shift(1);
  advance(sim, 2);
  for (let n = 0; n < 240; n++) {
    sim.clutch = 1 - n / 240;
    sim.update(1 / 60);
  }
  sim.clutch = 0;
  advance(sim, 3);
  return sim;
}

test('a four-stroke cycle takes 720 degrees and maintains firing order 1-3-4-2', () => {
  assert.deepEqual([90, 270, 450, 630].map(a => strokeIndex(a)), [0, 1, 2, 3]);
  assert.deepEqual([360, 540, 720, 900].map(a => [0, 1, 2, 3].find(c => cycleDegrees(a, c) === 360)), [0, 2, 3, 1]);
  assert.ok(Math.abs(pistonHeight(0) - pistonHeight(360)) < 1e-8);
  assert.ok(Math.abs(pistonHeight(0) - pistonHeight(180) - 1.3) < 1e-8);
});

test('idle stays stable and neutral does not move the car', () => {
  const sim = new Simulation();
  advance(sim, 15);
  assert.ok(sim.rpm > 850 && sim.rpm < 1000);
  assert.equal(sim.running, true);
  sim.throttle = 0.6;
  advance(sim, 8);
  assert.ok(sim.rpm > 3000);
  assert.equal(sim.speed, 0);
});

test('a shift requires the clutch, validates gear, and restart is interlocked', () => {
  const sim = new Simulation();
  assert.equal(sim.shift(1), false);
  sim.clutch = 1;
  assert.equal(sim.shift(1), true);
  assert.equal(sim.shift(9), false);
  sim.clutch = 0;
  sim.running = false;
  assert.equal(sim.start(), false);
  sim.clutch = 1;
  assert.equal(sim.start(), true);
});

test('a gradual launch moves the vehicle; disengaging the clutch removes torque', () => {
  const sim = launch();
  assert.ok(sim.running);
  assert.ok(sim.speed > 2);
  const speed = sim.speed;
  sim.clutch = 1;
  advance(sim, 2);
  assert.equal(sim.transmittedTorque, 0);
  assert.ok(sim.speed < speed);
  assert.ok(sim.rpm > 2500);
});

test('a released clutch enforces the selected gear ratio with small slip', () => {
  const sim = launch();
  const inputRpm = sim.speed / 0.31 * 3.9 * GEAR_RATIOS[sim.gear] * 30 / Math.PI;
  assert.ok(Math.abs(sim.rpm - inputRpm) < 120);
});

test('dumping the clutch at idle stalls; braking slows a moving vehicle', () => {
  const stalled = new Simulation();
  stalled.clutch = 1;
  stalled.shift(1);
  stalled.clutch = 0;
  advance(stalled, 2);
  assert.equal(stalled.running, false);
  assert.equal(stalled.stalled, true);
  const sim = launch();
  sim.clutch = 1;
  sim.brake = 1;
  advance(sim, 3);
  assert.ok(sim.speed < 0.1);
});

test('turbo builds pressure gradually and loses it after being disabled', () => {
  const sim = new Simulation();
  sim.throttle = 0.7;
  advance(sim, 5);
  assert.equal(sim.boost, 0);
  sim.turbo = true;
  sim.update(1 / 60);
  assert.ok(sim.boost > 0 && sim.boost < 0.1);
  advance(sim, 3);
  assert.ok(sim.boost > 0.4);
  sim.turbo = false;
  advance(sim, 4);
  assert.ok(sim.boost < 0.001);
});

test('pause freezes mechanics and changing animation speed leaves physics unchanged', () => {
  const first = new Simulation();
  first.paused = true;
  const before = JSON.stringify(first);
  advance(first, 3);
  assert.equal(JSON.stringify(first), before);
  const a = new Simulation();
  const b = new Simulation();
  a.throttle = b.throttle = 0.4;
  b.animationScale = 1;
  advance(a, 3, 30);
  advance(b, 3, 60);
  assert.ok(Math.abs(a.rpm - b.rpm) < 3);
  assert.notEqual(a.angle, b.angle);
});
