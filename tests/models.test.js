import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation, GEAR_RATIOS } from '../src/simulation.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';
import { TurboModel } from '../src/models/turbo-model.js';
import { FinalDriveModel } from '../src/models/final-drive-model.js';

function modelFixture(Model, run) {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new Model(materials);
  try { run(model, new Simulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
}

test('torque arrows remain separated in the clutch and disappear when the pedal disconnects it', () => {
  modelFixture(DrivetrainModel, (model, sim) => {
    model.setView('clutch');
    sim.transmittedTorque = 30;
    sim.inputAngle = 0.71;
    for (const exploded of [0, 0.65, 1]) {
      model.exploded = exploded;
      model.update(sim, true);
      const points = [];
      for (let i = 0; i < model.flow.count; i++) {
        const matrix = new THREE.Matrix4();
        model.flow.getMatrixAt(i, matrix);
        points.push(new THREE.Vector3().setFromMatrixPosition(matrix));
      }
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) assert.ok(points[i].distanceTo(points[j]) > 0.25);
    }
    sim.clutch = 1;
    model.update(sim, true);
    assert.equal(model.flow.visible, false);
    sim.clutch = 0;
    model.showFlow = false;
    model.update(sim, true);
    assert.equal(model.flow.visible, false);
  });
});

test('gear pairs preserve opposite rotation and their ratios with the clutch exploded', () => {
  modelFixture(DrivetrainModel, (model, sim) => {
    model.setView('drive-detail');
    model.exploded = 1;
    sim.inputAngle = 0.5;
    model.update(sim, true);
    const initial = model.gears.map(gear => gear.bottom.rotation.x);
    sim.inputAngle += 1.2;
    model.update(sim, true);
    model.gears.forEach((gear, i) => assert.ok(Math.abs(gear.bottom.rotation.x - initial[i] + 1.2 / GEAR_RATIOS[i + 1]) < 1e-9));
    assert.ok(model.gearbox.position.x > model.bearing.position.x);
  });
});

test('both turbo wheels share rotation, pause together and show a separate wastegate path', () => {
  modelFixture(TurboModel, (model, sim) => {
    sim.turbo = true;
    sim.boost = 0.7;
    model.update(sim, 0.1, true);
    assert.equal(model.rotors[0].rotation.x, model.rotors[1].rotation.x);
    const angle = model.rotors[0].rotation.x;
    assert.ok(angle > 0 && model.wastegateOpening > 0);
    assert.equal(model.paths.find(path => path.kind === 'bypass').arrows.visible, true);
    model.setSection('turboBearing', true);
    model.update(sim, 0, true);
    assert.equal(model.center.visible, true);
    assert.equal(model.hot.visible, false);
    assert.equal(model.cold.visible, false);
    assert.ok(model.paths.every(path => !path.arrows.visible));
    sim.paused = true;
    model.update(sim, 1, false);
    assert.equal(model.rotors[0].rotation.x, angle);
    assert.ok(model.covers.every(cover => cover.visible));
    sim.turbo = false;
    model.update(sim, 1, true);
    assert.ok(model.paths.every(path => !path.arrows.visible));
    assert.equal(model.wastegateOpening, 0);
  });
});

test('final drive reduces shaft rotation by 3.9 and turns both half shafts equally in straight travel', () => {
  modelFixture(FinalDriveModel, (model, sim) => {
    sim.outputAngle = 3.9 * Math.PI;
    model.update(sim, true);
    assert.equal(model.input.rotation.x, -sim.outputAngle);
    assert.equal(model.carrier.rotation.z, -Math.PI);
    assert.ok(model.axles.every(axle => axle.rotation.z === -Math.PI));
  });
});
