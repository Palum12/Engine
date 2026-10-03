import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { manualClutchState } from '../src/manual-clutch.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';

const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += 0.02) sim.update(0.02); };
const fixture = runTest => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new DrivetrainModel(materials);
  try { runTest(model, new Simulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};

test('pedal travel progressively reduces clamp force and torque capacity before a release gap opens', () => {
  let previous = Infinity;
  for (const pedal of [0, 0.15, 0.3, 0.45, 0.6, 0.72]) {
    const state = manualClutchState(pedal);
    assert.ok(state.capacity < previous);
    previous = state.capacity;
    near(state.plateGap, 0);
    near(state.force / 5200, state.clampFactor);
  }
  near(previous, 0);
  assert.ok(manualClutchState(0.85).plateGap > 0);
  near(manualClutchState(1).capacity, 0);
  near(manualClutchState(0, 340).capacity, manualClutchState(0).capacity * 2);
});

test('partial clamp limits actual torque and slip power is nonnegative friction heat', () => {
  const sim = new Simulation();
  sim.gear = 1; sim.rpm = 2000; sim.clutch = 0.55; sim.throttle = 0.4;
  const initialSlip = sim.rpm * Math.PI / 30 - sim.outputOmega * sim.ratios[1];
  sim.integrate(0.002);
  assert.ok(sim.clutchCapacity > 0 && sim.clutchCapacity < 90);
  near(sim.clutchCapacity, manualClutchState(sim.clutch).capacity);
  near(sim.clutchClamp, manualClutchState(sim.clutch).clampFactor);
  near(Math.abs(sim.transmittedTorque), sim.clutchCapacity);
  near(sim.slipPower, sim.transmittedTorque * initialSlip);
  assert.ok(sim.slipPower > 1000);
  sim.clutch = 0.9; sim.integrate(0.002);
  near(sim.transmittedTorque, 0); near(sim.slipPower, 0);
  sim.paused = true;
  const before = JSON.stringify(sim); run(sim, 0.4); assert.equal(JSON.stringify(sim), before);
});

test('reset and engine/transmission changes clear clutch heat and refresh available clamp torque', () => {
  const sim = new Simulation();
  sim.gear = 1; sim.rpm = 2000; sim.clutch = 0.55; sim.throttle = 0.4;
  sim.integrate(0.002);
  assert.ok(sim.slipPower > 1000);
  sim.reset();
  near(sim.slipPower, 0);
  near(sim.clutchClamp, 1);
  near(sim.clutchCapacity, manualClutchState(0).capacity);
  sim.setEngine('v12');
  assert.ok(sim.clutchCapacity > manualClutchState(0).capacity);
  sim.setTransmission('dct');
  near(sim.clutchCapacity, 0); near(sim.clutchForce, 0); near(sim.clutchClamp, 0); near(sim.slipPower, 0);
  sim.setTransmission('manual');
  assert.ok(sim.clutchCapacity > 0);
});

test('bearing, spring fingers and pressure straps visibly change throughout pedal travel while faces remain clamped', () => fixture((model, sim) => {
  model.setView('clutch');
  const samples = [0, 0.2, 0.4, 0.6].map(pedal => {
    sim.clutch = pedal; model.update(sim, true);
    near(model.disc.position.x, 0.2);
    near(model.pressure.position.x, 0.3075);
    return { bearing: model.bearing.position.x, finger: model.fingers[0].finger.quaternion.toArray(), strap: model.straps[0].segments[0].quaternion.toArray(), opacity: model.contacts[0].material.opacity };
  });
  for (let n = 1; n < samples.length; n++) {
    assert.ok(samples[n].bearing < samples[n - 1].bearing - 0.06);
    assert.notDeepEqual(samples[n].finger, samples[n - 1].finger);
    assert.notDeepEqual(samples[n].strap, samples[n - 1].strap);
    assert.ok(samples[n].opacity < samples[n - 1].opacity);
  }
  sim.clutch = 0.85; model.update(sim, true);
  assert.ok(model.disc.position.x - 0.0475 > 0.1525);
  assert.ok(model.pressure.position.x - 0.06 > model.disc.position.x + 0.0475);
  assert.ok(model.contacts.every(contact => !contact.visible));
  const finger = model.fingers[0].finger;
  const tip = finger.localToWorld(new THREE.Vector3(0, 0.5, 0));
  const localTip = model.bearing.worldToLocal(tip.clone());
  near(localTip.x, -0.085);
  near(Math.hypot(localTip.y, localTip.z), 0.22);
}));

test('flywheel and pressure follow engine phase while a slipping disc and spline follow the gearbox input', () => fixture((model, sim) => {
  model.setView('clutch'); sim.angle = 90; sim.inputAngle = 0.2;
  sim.rpm = 1800; sim.inputOmega = 40; sim.transmittedTorque = 60; sim.clutch = 0.4;
  model.update(sim, true);
  near(model.flywheel.rotation.x, Math.PI / 2);
  near(model.pressure.rotation.x, Math.PI / 2);
  near(model.disc.rotation.x, 0.2); near(model.inputSplines.rotation.x, 0.2);
  assert.ok(model.frictionMaterial.emissiveIntensity > 0);
  assert.equal(model.contacts[0].material.color.getHex(), 0xffa24f);
  sim.clutch = 1; model.update(sim, true);
  near(model.frictionMaterial.emissiveIntensity, 0);
}));

test('free gears rotate on visible needle bearings independently of the splined output hubs', () => fixture((model, sim) => {
  model.setView('gearbox'); sim.gear = 0; sim.inputAngle = 1.1; sim.outputAngle = 0.3;
  model.update(sim, true);
  model.gears.forEach(gear => {
    assert.equal(gear.bottom.userData.lockedToShaft, false);
    near(gear.hub.rotation.x, -0.3); near(gear.sleeve.rotation.x, -0.3);
    assert.equal(gear.needleCage.children.length, 16);
    assert.equal(gear.sleeveTeeth.length, 36);
    assert.equal(gear.needleBearing.parent, gear.bottom);
    assert.equal(gear.gearCone.parent, gear.bottom);
    near(gear.shiftFork.position.x, gear.sleeve.position.x);
    const slider = gear.shiftFork.localToWorld(new THREE.Vector3(0, 1.25, 1.55));
    const railPoint = model.gearbox.localToWorld(new THREE.Vector3(gear.shiftFork.position.x, -0.55, 1.55));
    near(slider.distanceTo(railPoint), 0);
  });
  const gear = model.gears[2]; sim.gear = 3;
  sim.inputAngle = 2.5; sim.outputAngle = 2.5 / gear.ratio; model.update(sim, true);
  assert.equal(gear.bottom.userData.lockedToShaft, true);
  const bottom = gear.bottom.rotation.x, shaft = gear.hub.rotation.x;
  sim.inputAngle += 0.5 * gear.ratio; sim.outputAngle += 0.5; model.update(sim, true);
  near(gear.bottom.rotation.x - bottom, gear.hub.rotation.x - shaft);
}));

test('synchronization seats the friction cone before the sleeve overlaps the dog teeth', () => fixture((model, sim) => {
  model.setView('gearbox'); sim.clutch = 1; sim.shift(2);
  const gear = model.gears[1];
  sim.shiftProgress = 0.5; model.update(sim, true);
  near(gear.cone.position.x, gear.x + 0.37);
  assert.equal(gear.syncGlow.visible, true);
  const dogRight = gear.dog.position.x + 0.06;
  assert.ok(gear.sleeve.position.x - 0.23 > dogRight);
  sim.shiftProgress = 0.95; model.update(sim, true);
  assert.equal(gear.syncGlow.visible, false);
  assert.ok(gear.sleeve.position.x - 0.23 < dogRight);
}));

test('dog teeth index into sleeve gaps before overlap and stay aligned after a real shift', () => fixture((model, sim) => {
  model.setView('gearbox'); sim.clutch = 1; sim.shift(2);
  const gear = model.gears[1], pitch = Math.PI * 2 / 36;
  const remainder = () => {
    const delta = gear.dog.rotation.x - gear.sleeve.rotation.x;
    return delta - Math.round(delta / pitch) * pitch;
  };
  sim.inputAngle = 1.37; sim.outputAngle = 0.41;
  sim.shiftProgress = 0.5; model.update(sim, true);
  near(gear.dog.rotation.x, -sim.inputAngle / gear.ratio);
  assert.ok(Math.abs(remainder()) > 0.01);
  sim.shiftProgress = 0.9; model.update(sim, true);
  near(remainder(), 0);
  assert.ok(gear.sleeve.position.x - 0.23 > gear.dog.position.x + 0.06);
  sim.shiftProgress = 0.95; model.update(sim, true);
  near(remainder(), 0);
  assert.ok(gear.sleeve.position.x - 0.23 < gear.dog.position.x + 0.06);
  run(sim, 0.4); assert.equal(sim.gear, 2);
  const before = JSON.stringify(sim);
  model.update(sim, true); near(remainder(), 0);
  assert.equal(JSON.stringify(sim), before);
  const free = model.gears[3];
  near(free.dog.rotation.x, -sim.inputAngle / free.ratio);
}));

test('detailed clutch and gear inspections have finite bounds and reversible section visibility', () => fixture((model, sim) => {
  for (const section of ['flywheel', 'friction', 'discHub', 'pressurePlate', 'diaphragm', 'releaseBearing']) {
    model.setView('clutch'); model.update(sim, true); model.setSection(section, true);
    const bounds = model.bounds(section);
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
  }
  for (let n = 1; n <= 5; n++) {
    model.setView('gearbox'); model.setSection(`gear${n}`, true); model.update(sim, true);
    const bounds = model.bounds(`gear${n}`);
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
    model.gears.forEach((gear, i) => assert.equal(gear.bottom.visible, i === n - 1));
  }
  model.setView('clutch'); model.setSection('all'); model.update(sim, true);
  assert.ok(model.disc.visible && model.pressure.visible && model.bearing.visible);
}));
