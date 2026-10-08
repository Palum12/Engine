import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';

const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const fixture = runTest => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new DrivetrainModel(materials);
  try { runTest(model, new Simulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};
const vertices = mesh => {
  const position = mesh.geometry.attributes.position;
  return Array.from({ length: position.count }, (_, index) => mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(position, index)));
};

test('release stroke keeps inner spring fingers and disc damper springs outside the pressure plate', () => fixture((model, sim) => {
  model.setView('clutch');
  for (let sample = 0; sample <= 20; sample++) {
    sim.clutch = sample / 20;
    sim.angle = sample * 13;
    model.update(sim, true);
    const pressureBack = model.pressure.position.x + 0.06;
    // Inner fingers must never cross the annular pressure plate. The outer
    // fingers deliberately end on its back face and carry the clamping force.
    model.fingers.forEach(({ finger }) => vertices(finger).forEach(point => {
      const radius = Math.hypot(point.y, point.z);
      if (radius > 0.62 && radius < 1.05) assert.ok(point.x > pressureBack, 'inner finger intersects the pressure plate during release');
    }));
    model.disc.traverse(mesh => {
      if (!mesh.geometry || mesh.userData.part !== 'torsionSprings') return;
      vertices(mesh).forEach(point => assert.ok(Math.hypot(point.y, point.z) < 0.62, 'pressure opening must clear the disc torsion damper'));
    });
    assert.ok(model.coverRing.geometry.boundingBox || model.coverRing.geometry.attributes.position);
    // The open cover surrounds the plate, rather than sharing its radial band.
    vertices(model.coverRing).forEach(point => assert.ok(Math.hypot(point.y, point.z) > 1.10));
  }
}));

test('concentric slave cylinder stays fixed while its piston follows the bearing without a dangling lever', () => fixture((model, sim) => {
  model.setView('clutch');
  const housing = [];
  const strokes = [];
  for (const pedal of [0, 0.25, 0.5, 0.75, 1]) {
    sim.clutch = pedal; sim.angle += 41; model.update(sim, true);
    housing.push(model.actuatorHousing.getWorldPosition(new THREE.Vector3()).toArray());
    const piston = new THREE.Box3().setFromObject(model.actuatorPiston);
    const bearing = new THREE.Box3().setFromObject(model.bearing);
    near(piston.min.x, model.bearing.position.x + 0.085);
    assert.ok(piston.min.x < bearing.max.x, 'piston directly carries the bearing');
    strokes.push(piston.max.x - piston.min.x);
    near(model.releaseActuator.rotation.x, 0);
    assert.equal(model.releaseActuator.userData.part, 'releaseActuator');
  }
  housing.forEach(point => assert.deepEqual(point, housing[0]));
  for (let n = 1; n < strokes.length; n++) near(strokes[n], strokes[0]);
  assert.equal(model.pressure.children.length, 1, 'pressure plate has no unexplained protruding phase marker');
}));

test('selector pin moves only the selected rail, whose collar and fork carry exactly the sleeve travel', () => fixture((model, sim) => {
  model.setView('gearbox'); model.setSection('selector'); sim.clutch = 1;
  for (let target = 1; target <= 5; target++) {
    sim.gear = 0; sim.shiftTarget = target; sim.shiftFrom = 0;
    for (const progress of [0.3, 0.5, 0.8, 1]) {
      sim.shiftProgress = progress; model.update(sim, true);
      const gear = model.gears[target - 1];
      const pin = model.selectorPin.getWorldPosition(new THREE.Vector3());
      const slot = gear.selectorSlot.getWorldPosition(new THREE.Vector3());
      near(pin.x, slot.x); near(pin.z, slot.z);
      assert.ok(Math.abs(pin.y - slot.y) < 0.23, 'selector pin stays in the rail slot');
      const collar = gear.forkCollar.getWorldPosition(new THREE.Vector3());
      const onRail = gear.shiftRail.localToWorld(new THREE.Vector3(gear.shiftFork.position.x - gear.shiftRail.position.x, 0, 0));
      near(collar.distanceTo(onRail), 0);
      near(gear.shiftRail.position.x, gear.sleeve.position.x - gear.x - 0.84);
      model.gears.forEach((other, index) => { if (index !== target - 1) near(other.shiftRail.position.x, 0); });
    }
  }
}));

test('synchronizer close-up excludes large gears and selector rods, fits visible detail and restores the gearbox', () => fixture((model, sim) => {
  model.setView('gearbox'); model.update(sim, true);
  const whole = model.bounds('gearbox').getSize(new THREE.Vector3());
  for (let number = 1; number <= 5; number++) {
    model.setSynchronizerGear(number); model.setSection('synchronizer'); model.update(sim, true);
    const bounds = model.bounds('synchronizer');
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.x < whole.x / 3 && size.y < whole.y / 2, 'camera concentrates on the sleeve, cone and dog teeth');
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
    model.gears.forEach((gear, index) => {
      assert.equal(gear.bottom.visible, index === number - 1);
      assert.equal(gear.shiftRail.visible, false);
      assert.equal(gear.top.visible, false);
      if (index === number - 1) {
        assert.ok(gear.cutGearCone.visible && gear.cutRingFace.visible && gear.detailGearRing.visible);
        assert.ok(gear.fullGearChildren.every(child => !child.visible));
        assert.ok(gear.fullHubChildren.every(child => !child.visible));
        assert.ok(gear.sleeveRims.every(rim => !rim.visible));
        assert.ok(gear.cutSleeveRims.every(rim => rim.visible));
      }
    });
    model.gearbox.traverseVisible(mesh => {
      if (!mesh.geometry) return;
      const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(mesh.matrixWorld);
      assert.ok(bounds.containsBox(box), 'close-up camera contains every visible mesh');
    });
  }
  model.setSection('all'); model.update(sim, true);
  assert.ok(model.selector.visible && model.topShaft.visible && model.bottomShaft.visible);
  assert.ok(!model.detailOutputShaft.visible);
  model.gears.forEach(gear => {
    assert.ok(gear.top.visible && gear.bottom.visible && gear.shiftRail.visible && gear.forkStem.visible);
    assert.ok(gear.fullGearChildren.every(child => child.visible));
    assert.ok(gear.fullHubChildren.every(child => child.visible));
    assert.ok(gear.sleeveRims.every(rim => rim.visible));
    assert.ok(!gear.cutHubFace.visible && gear.cutHubTeeth.every(({ tooth }) => !tooth.visible));
    assert.ok(gear.gearCone.visible && gear.ringFace.visible);
    assert.ok(!gear.cutGearCone.visible && !gear.cutRingFace.visible);
  });
}));

test('cutaway window stays open through shaft rotations while the exposed hub teeth keep rotating', () => fixture((model, sim) => {
  model.setView('gearbox'); model.setSection('synchronizer');
  const gear = model.gears[1];
  const cutParts = [gear.cutFace, gear.cutHubFace, gear.cutGearCone, gear.cutRingFace, gear.detailGearRing, ...gear.cutSleeveRims];
  let reference;
  let initialTooth;
  for (const phase of [0, 0.4, 1.4, 3.2, 5.5]) {
    sim.inputAngle = phase * 2.1; sim.outputAngle = phase; model.update(sim, true);
    const windows = cutParts.map(mesh => mesh.getWorldQuaternion(new THREE.Quaternion()).toArray());
    if (!reference) reference = windows;
    else windows.forEach((rotation, index) => rotation.forEach((component, axis) => near(component, reference[index][axis])));
    const tooth = gear.cutHubTeeth[0].tooth.getWorldPosition(new THREE.Vector3());
    if (!initialTooth) initialTooth = tooth;
    else assert.ok(tooth.distanceTo(initialTooth) > 0.05);
  }
  model.setSection('clutchCover', true); model.setView('clutch'); model.update(sim, true);
  model.clutch.children.forEach(part => { if (part !== model.cover) assert.ok(!part.visible, 'cover isolation must not leave disconnected spring or strap ends'); });
}));
