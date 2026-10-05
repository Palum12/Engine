import test from 'node:test';
import assert from 'node:assert/strict';
import { SuspensionSimulation, SUSPENSION_TYPES, ROAD_TYPES } from '../src/suspension.js';

const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const travelAt = (state, side) => state.bodyHeight + (side ? 1 : -1) * state.trackHalf * Math.sin(state.roll) - state.wheels[side].height - (1.05 - state.staticWheelHeight);

test('mechanical stops bound full-UI travel without separating rigid-axle wheels or pulling the road', () => {
  for (const type of Object.keys(SUSPENSION_TYPES)) for (const road of Object.keys(ROAD_TYPES)) {
    const state = new SuspensionSimulation(); state.setType(type); state.setRoad(road);
    state.setSpring(0.4); state.setDamping(0); state.setSpeed(60); state.setAmplitude(0.15);
    for (let step = 0; step < 900; step++) {
      state.update(0.01);
      for (let side = 0; side < 2; side++) {
        const travel = travelAt(state, side);
        assert.ok(travel >= -0.220001 && travel <= 0.230001, `${type}/${road}: travel ${travel}`);
        assert.ok(state.wheels[side].tireForce >= 0, 'tyre contact stays unilateral');
      }
      if (type === 'leaf') {
        near(state.wheels[1].height - state.wheels[0].height, 2 * state.trackHalf * Math.sin(state.axleRoll));
        near(state.wheels[1].velocity - state.wheels[0].velocity, 2 * state.trackHalf * Math.cos(state.axleRoll) * state.axleRollVelocity);
      }
    }
  }
});

test('travel-stop reactions preserve vertical momentum and dissipate rather than add impact energy', () => {
  for (const type of ['macpherson', 'leaf']) {
    const state = new SuspensionSimulation(); state.setType(type);
    state.bodyVelocity = 0.5;
    if (type === 'leaf') {
      state.axleHeight -= 0.4; state.axleVelocity = -3; state.axleRollVelocity = 0.2;
      state.refreshAxleWheels();
    } else state.wheels.forEach((wheel, side) => { wheel.height -= 0.4 - side * 0.08; wheel.velocity = -3 + side; });
    const centerOfMass = () => 720 * state.bodyHeight + state.wheelMass * (state.wheels[0].height + state.wheels[1].height);
    const momentum = () => 720 * state.bodyVelocity + state.wheelMass * (state.wheels[0].velocity + state.wheels[1].velocity);
    const energy = () => 0.5 * 720 * state.bodyVelocity ** 2 + 0.5 * 490 * state.rollVelocity ** 2 + (type === 'leaf'
      ? state.wheelMass * state.axleVelocity ** 2 + 0.5 * 110 * state.axleRollVelocity ** 2
      : 0.5 * state.wheelMass * state.wheels.reduce((sum, wheel) => sum + wheel.velocity ** 2, 0));
    const before = { center: centerOfMass(), momentum: momentum(), energy: energy() };
    state.constrainTravel();
    near(centerOfMass(), before.center, 1e-6); near(momentum(), before.momentum, 1e-6);
    assert.ok(energy() < before.energy);
    for (let side = 0; side < 2; side++) assert.ok(travelAt(state, side) <= 0.230001);
    // Leaving the stop is allowed; it must not behave like a welded joint.
    state.bodyVelocity = -1; state.rollVelocity = 0;
    if (type === 'leaf') { state.axleVelocity = 0; state.axleRollVelocity = 0; state.refreshAxleWheels(); }
    else state.wheels.forEach(wheel => { wheel.velocity = 0; });
    state.constrainTravel(); near(state.bodyVelocity, -1);
  }
});

test('long undamped road resonance stays within the one-axis roll and travel operating range', () => {
  for (const type of Object.keys(SUSPENSION_TYPES)) for (const [spring, speed] of [[1, 18], [2.5, 30]]) {
    const state = new SuspensionSimulation(); state.setType(type); state.setRoad('waves');
    state.setSpring(spring); state.setSpeed(speed); state.setDamping(0); state.setAmplitude(0.15);
    for (let step = 0; step < 3000; step++) {
      state.update(0.01);
      assert.ok(Math.abs(state.roll) <= 0.250001, `${type}: body must not flip in this axle lesson`);
      if (type === 'leaf') assert.ok(Math.abs(state.axleRoll) <= 0.250001);
      for (let side = 0; side < 2; side++) assert.ok(travelAt(state, side) >= -0.220001 && travelAt(state, side) <= 0.230001);
    }
  }
});
