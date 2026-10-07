import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';

const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const fixture = run => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new DrivetrainModel(materials);
  try { run(model, new Simulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};
const bounds = part => new THREE.Box3().setFromObject(part);

test('cover bolts join the flywheel flange and cover cup while the pressure plate can retract inside it', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.5, 0.8, 1]) {
    sim.clutch = pedal; sim.angle += 37;
    model.update(sim, false);
    const flywheel = bounds(model.flywheel), flange = bounds(model.coverFlange), cup = bounds(model.coverCup);
    model.coverBolts.forEach(bolt => {
      const attachment = bounds(bolt);
      assert.ok(flywheel.intersectsBox(attachment), 'cover fixing passes into the flywheel');
      assert.ok(flange.intersectsBox(attachment), 'cover fixing passes through the cover flange');
    });
    assert.ok(cup.intersectsBox(flange), 'continuous cover cup meets its flywheel flange');
    assert.ok(bounds(model.pressure).max.x < model.cover.position.x - 0.2, 'released plate stays ahead of the diaphragm fulcrum');
    near(model.cover.rotation.x, model.flywheel.rotation.x);
    near(model.diaphragm.rotation.x, model.flywheel.rotation.x);
  }
}));

test('fixed input carrier supports the concentric actuator and guide throughout its bearing stroke', () => fixture((model, sim) => {
  model.setView('clutch');
  let supportPosition, housingPosition;
  for (const pedal of [0, 0.2, 0.5, 0.8, 1]) {
    sim.clutch = pedal; sim.angle += 63; sim.inputAngle += 0.7;
    model.update(sim, false);
    const support = model.releaseSupport.getWorldPosition(new THREE.Vector3()).toArray();
    const housing = model.actuatorHousing.getWorldPosition(new THREE.Vector3()).toArray();
    supportPosition ??= support; housingPosition ??= housing;
    assert.deepEqual(support, supportPosition);
    assert.deepEqual(housing, housingPosition);
    near(model.releaseSupport.rotation.x, 0); near(model.bearing.rotation.x, 0);
    const guide = bounds(model.guideSleeve), bearing = bounds(model.bearing);
    assert.ok(guide.min.x < bearing.min.x && guide.max.x > bearing.max.x, 'bearing stays on its stationary guide sleeve');
    const carrier = bounds(model.inputCarrier);
    assert.ok(carrier.intersectsBox(guide), 'guide ends at its gearbox carrier');
    assert.ok(carrier.intersectsBox(bounds(model.actuatorHousing)), 'hydraulic cylinder ends at the same fixed carrier');
    if (model.clutchState.bearingClearance === 0) near(model.bearingRace.rotation.x, model.flywheel.rotation.x);
  }
}));

test('clutch cutaway stays fixed through independent crank/input rotation and restores complete parts', () => fixture((model, sim) => {
  model.setView('clutch'); sim.clutch = 0.4;
  let rotations;
  for (const phase of [0, 0.6, 1.8, 3.7]) {
    sim.angle = phase * 180 / Math.PI; sim.inputAngle = phase / 3;
    model.update(sim, true);
    const current = model.clutchSections.map(({ mesh }) => mesh.getWorldQuaternion(new THREE.Quaternion()));
    rotations ??= current;
    current.forEach((rotation, index) => assert.ok(rotation.angleTo(rotations[index]) < 1e-6, 'section plane follows neither rotating shaft'));
    assert.ok(model.fingers.some(({ finger }) => finger.visible) && model.fingers.some(({ finger }) => !finger.visible));
  }
  model.update(sim, false);
  model.clutchSections.forEach(({ mesh, fullGeometry }) => assert.equal(mesh.geometry, fullGeometry));
  assert.ok(model.fingers.every(({ finger, outer }) => finger.visible && outer.visible));
}));

test('explicit disassembly freezes detached components and suppresses contact and torque overlays', () => fixture((model, sim) => {
  model.setView('clutch'); sim.transmittedTorque = 50;
  const parts = [model.flywheel, model.disc, model.pressure, model.cover, model.diaphragm, model.bearingRace];
  for (const explosion of [0.01, 0.55, 1]) {
    model.exploded = explosion;
    model.update(sim, true);
    const rotations = parts.map(part => part.quaternion.toArray());
    sim.angle += 180; sim.inputAngle += 1;
    model.update(sim, true);
    parts.forEach((part, index) => assert.deepEqual(part.quaternion.toArray(), rotations[index]));
    assert.ok(model.contacts.every(contact => !contact.visible));
    assert.equal(model.flow.visible, false);
  }
  model.exploded = 0; model.update(sim, true);
  assert.ok(model.contacts.every(contact => contact.visible));
  assert.ok(model.flow.visible);
}));
