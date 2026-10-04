import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SuspensionSimulation, SUSPENSION_TYPES, ROAD_TYPES, suspensionRoad } from '../src/suspension.js';
import { SuspensionModel } from '../src/models/suspension-model.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const advance = (state, seconds, dt = 0.01) => { for (let i = 0; i < Math.round(seconds / dt); i++) state.update(dt); };
const fixture = callback => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new SuspensionModel(materials);
  try { callback(model, new SuspensionSimulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};

test('flat-road suspension stays at loaded static equilibrium with tyre and spring support', () => {
  for (const type of Object.keys(SUSPENSION_TYPES)) {
    const state = new SuspensionSimulation(); state.setType(type); state.setRoad('flat');
    const body = state.bodyHeight, wheels = state.wheels.map(wheel => wheel.height);
    advance(state, 5);
    near(state.bodyHeight, body); near(state.bodyVelocity, 0); near(state.roll, 0);
    state.wheels.forEach((wheel, index) => {
      near(wheel.height, wheels[index]); assert.ok(wheel.contact);
      near(wheel.tireForce - wheel.springForce, state.wheelMass * 9.81);
    });
  }
});

test('a bump first moves unsprung wheels and then the sprung body, symmetric inputs do not create roll', () => {
  const state = new SuspensionSimulation();
  const initialWheel = state.wheels[0].height, initialBody = state.bodyHeight;
  let wheelResponse = 0, bodyResponse = 0;
  for (let i = 0; i < 180; i++) {
    state.update(0.01);
    wheelResponse = Math.max(wheelResponse, state.wheels[0].height - initialWheel);
    bodyResponse = Math.max(bodyResponse, state.bodyHeight - initialBody);
    near(state.wheels[0].height, state.wheels[1].height); near(state.roll, 0);
  }
  assert.ok(wheelResponse > 0.045); assert.ok(bodyResponse > 0.015);
  assert.ok(wheelResponse > bodyResponse);
});

test('unequal road profiles produce body roll and the leaf axle rotates as one rigid beam', () => {
  for (const type of ['macpherson', 'leaf']) {
    const state = new SuspensionSimulation(); state.setType(type); state.setRoad('split');
    let maximumRoll = 0;
    for (let i = 0; i < 250; i++) {
      state.update(0.01); maximumRoll = Math.max(maximumRoll, Math.abs(state.roll));
      if (type === 'leaf') near(state.wheels[1].height - state.wheels[0].height, 2 * state.trackHalf * Math.sin(state.axleRoll));
    }
    assert.ok(maximumRoll > 0.012);
  }
});

test('damping removes body oscillation instead of being a spring stiffness control', () => {
  const damped = new SuspensionSimulation(), undamped = new SuspensionSimulation();
  for (const state of [damped, undamped]) { state.setRoad('flat'); state.setSpeed(0); state.bodyHeight += 0.07; }
  undamped.setDamping(0);
  let dampedMotion = 0, undampedMotion = 0;
  for (let i = 0; i < 600; i++) {
    damped.update(0.01); undamped.update(0.01);
    if (i > 350) { dampedMotion += Math.abs(damped.bodyHeight - 1.05); undampedMotion += Math.abs(undamped.bodyHeight - 1.05); }
  }
  assert.ok(dampedMotion < undampedMotion * 0.2);
  near(damped.wheelRate, undamped.wheelRate);
});

test('tyres cannot pull the road and can lose contact above a fast deep hole', () => {
  const state = new SuspensionSimulation(); state.setRoad('holes'); state.setAmplitude(0.18); state.setSpeed(70);
  let lostContact = false;
  for (let i = 0; i < 300; i++) {
    state.update(0.01);
    for (const wheel of state.wheels) { assert.ok(wheel.tireForce >= 0); lostContact ||= !wheel.contact; }
  }
  assert.ok(lostContact);
});

test('suspension pause, zero speed, replay and parameter validation are deterministic', () => {
  const state = new SuspensionSimulation(); advance(state, 0.8); state.paused = true;
  const before = JSON.stringify(state); advance(state, 1); assert.equal(JSON.stringify(state), before);
  state.paused = false; state.setSpeed(0); const distance = state.distance; advance(state, 1); near(state.distance, distance);
  const left = new SuspensionSimulation(), right = new SuspensionSimulation();
  advance(left, 3); advance(right, 3); assert.equal(JSON.stringify(left), JSON.stringify(right));
  left.reset(); right.reset(); assert.equal(JSON.stringify(left), JSON.stringify(right));
  assert.equal(state.setType('unknown'), false); assert.equal(state.setRoad('unknown'), false);
  assert.equal(state.setSpring(NaN), false); assert.equal(state.setDamping(Infinity), false);
  assert.equal(state.setSpeed(-4), true); near(state.speed, 0);
});

test('every layout and road remains finite through repeated obstacles and limiting controls', () => {
  for (const type of Object.keys(SUSPENSION_TYPES)) for (const road of Object.keys(ROAD_TYPES)) {
    const state = new SuspensionSimulation(); state.setType(type); state.setRoad(road); state.setAmplitude(0.18); state.setSpeed(70);
    state.setSpring(2.5); state.setDamping(0);
    advance(state, 15);
    assert.ok([state.bodyHeight, state.bodyVelocity, state.roll, ...state.wheels.flatMap(wheel => [wheel.height, wheel.velocity, wheel.compression])].every(Number.isFinite), `${type}/${road}`);
    assert.ok(state.bodyHeight > 0.3 && state.bodyHeight < 2, `${type}/${road} travel bounded`);
  }
});

test('visible road samples use the same moving profile as tyre physics and paused geometry stays still', () => {
  fixture((model, state) => {
    state.setRoad('split'); advance(state, 0.55); model.update({ suspension: state });
    model.roads.forEach(({ mesh }, side) => {
      const positions = mesh.geometry.attributes.position;
      const i = 56 * 2;
      near(positions.getY(i), state.wheels[side].roadHeight * 4 - 0.03, 1e-6);
      near(state.roadAt(state.distance, side).height, suspensionRoad(state.distance, side, state.road, state.amplitude).height);
    });
    const positions = model.corners.map(corner => corner.wheel.position.toArray());
    state.paused = true; advance(state, 0.5); model.update({ suspension: state });
    assert.deepEqual(model.corners.map(corner => corner.wheel.position.toArray()), positions);
  });
});

test('suspension geometry has reversible sections, stable anchors and connected rigid-axle wheel centres', () => {
  fixture((model, state) => {
    const anchors = model.anchors.map(data => data.anchor);
    for (const type of Object.keys(SUSPENSION_TYPES)) {
      state.setType(type); state.setRoad('split'); advance(state, 0.7); model.update({ suspension: state });
      assert.deepEqual(model.anchors.map(data => data.anchor), anchors);
      for (const section of ['all', 'suspensionLinks', 'suspensionSpring', 'suspensionDamper', 'suspensionRoad', 'suspensionRocker']) {
        model.setSection(section, true);
        assert.equal(model.axleDrive.visible, section === 'all');
        assert.equal(model.roadAnchor.userData.labelHidden, !['all', 'suspensionRoad'].includes(section));
        const box = model.bounds(section);
        assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
        assert.ok(!box.isEmpty());
      }
      model.setSection('all', false);
      assert.ok(model.body.visible && model.roads[0].mesh.visible);
      assert.equal(model.axleDrive.visible, true);
      assert.equal(model.roadAnchor.userData.labelHidden, false);
      if (type === 'leaf') {
        model.group.updateWorldMatrix(true, true);
        for (const corner of model.corners) {
          const endpoint = model.axle.localToWorld(new THREE.Vector3(0, 0, corner.sign * state.trackHalf * 4));
          near(endpoint.distanceTo(corner.wheel.getWorldPosition(new THREE.Vector3())), 0);
        }
      }
    }
  });
});
