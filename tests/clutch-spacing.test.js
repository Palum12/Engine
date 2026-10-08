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
const bounds = part => new THREE.Box3().setFromObject(part);
const endpoint = (mesh, along) => mesh.localToWorld(new THREE.Vector3(0, along, 0));

test('inspection separates the clutch layers into clear gaps without changing pedal contact', () => fixture((model, sim) => {
  model.setView('clutch');
  model.exploded = 0.55;
  model.update(sim, true);
  const layers = [model.flywheel, model.disc, model.pressureFace, model.diaphragmRing, model.coverRing, model.bearing].map(bounds);
  for (let i = 1; i < layers.length; i++) assert.ok(layers[i].min.x - layers[i - 1].max.x > 0.45, `layers ${i - 1}/${i} overlap or leave an unreadable gap`);
  assert.ok(model.clutchState.contact);
  assert.ok(model.contacts.every(contact => !contact.visible), 'disassembly gaps must not display a false physical contact');

  // Pedal travel still decreases spring force before opening the physical faces.
  const discX = model.disc.position.x, pressureX = model.pressure.position.x;
  const clamp = model.clutchState.clampFactor;
  sim.clutch = 0.5; model.update(sim, true);
  near(model.disc.position.x, discX); near(model.pressure.position.x, pressureX);
  assert.ok(model.clutchState.clampFactor < clamp);
  assert.ok(model.clutchState.contact);
  sim.clutch = 1; model.update(sim, true);
  assert.ok(model.disc.position.x > discX && model.pressure.position.x > pressureX);
  assert.equal(model.clutchState.contact, false);
  assert.ok(model.contacts.every(contact => !contact.visible));
  assert.ok(bounds(model.bearing).min.x > bounds(model.coverRing).max.x);

  model.exploded = 0; sim.clutch = 0; model.update(sim, true);
  near(model.disc.position.x, 0.2); near(model.pressure.position.x, 0.3075);
  assert.ok(model.clutchState.contact);
}));

test('expanded shafts, splines and camera bounds cover the assembly under vehicle transforms', () => fixture((model, sim) => {
  for (const mode of ['clutch', 'drive-detail']) {
    model.setView(mode);
    for (const explosion of [0, 0.55, 1]) {
      model.exploded = explosion;
      for (const pedal of [0, 0.5, 1]) {
        sim.clutch = pedal; model.update(sim, true);
        const shaft = bounds(model.stub);
        const hub = bounds(model.disc.children.find(child => child.userData.part === 'discHub'));
        const spline = bounds(model.inputSplines);
        assert.ok(spline.min.x <= hub.min.x && spline.max.x >= hub.max.x, 'disc hub slides along visible input splines');
        assert.ok(shaft.min.x < model.disc.position.x && shaft.max.x > model.bearing.position.x, 'input shaft spans separated layers');
        if (mode === 'drive-detail') near(shaft.max.x, bounds(model.topShaft).min.x);
        const cameraBounds = model.bounds(mode);
        const visibleGroups = mode === 'clutch' ? [model.clutch] : [model.clutch, model.gearbox];
        visibleGroups.forEach(part => assert.ok(cameraBounds.containsBox(bounds(part)), `${mode} camera clips expanded assembly`));
      }
    }
  }

  // Bench geometry may subsequently be reparented into a scaled, rotated vehicle.
  model.group.position.set(-6, 1.2, -0.15);
  model.group.scale.setScalar(0.18);
  model.group.rotation.y = -Math.PI / 2;
  model.update(sim, true);
  assert.ok(model.bounds('drive-detail').containsBox(bounds(model.gearbox)));
  near(endpoint(model.stub, -1.6).distanceTo(endpoint(model.topShaft, 3.6)), 0);
}));

test('continuous spring web and flexible straps keep their assembled attachments while the pedal moves', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const explosion of [0, 0.55, 1]) {
    model.exploded = explosion;
    for (const pedal of [0, 0.5, 1]) {
      sim.clutch = pedal; model.update(sim, true);
      const { finger } = model.fingers[0];
      const springPivot = model.diaphragm.worldToLocal(endpoint(finger, -0.5));
      near(springPivot.x, 0); near(Math.hypot(springPivot.y, springPivot.z), 0.78);
      if (explosion === 0) near(model.diaphragmWeb.scale.x, model.diaphragm.position.x - model.pressure.position.x - 0.06);
      const segments = model.straps[0].segments;
      const pressureAttachment = model.pressure.worldToLocal(endpoint(segments[0], -0.5));
      const coverAttachment = model.cover.worldToLocal(endpoint(segments.at(-1), 0.5));
      near(pressureAttachment.x, 0.045); near(coverAttachment.x, -0.05);
      for (let n = 1; n < segments.length; n++) near(endpoint(segments[n - 1], 0.5).distanceTo(endpoint(segments[n], -0.5)), 0);
    }
  }
}));

test('exploded inspections replace the long metal cage with unobtrusive assembly guides', () => fixture((model, sim) => {
  model.setView('clutch'); model.exploded = 0.55; model.update(sim, true);
  assert.equal(model.pressureStraps.visible, false);
  assert.ok(model.fingers.every(({ finger }) => finger.visible));
  const explodedConeLength = model.diaphragmWeb.scale.x;
  model.exploded = 1; model.update(sim, true);
  near(model.diaphragmWeb.scale.x, explodedConeLength, 1e-6);
  model.exploded = 0.55; model.update(sim, true);
  assert.ok(model.assemblyGuides.visible);
  assert.equal(model.guideLines.length, 2);
  const camera = model.bounds('clutch');
  model.guideLines.forEach(line => {
    assert.ok(line.userData.ignorePick);
    assert.ok(line.material.isLineDashedMaterial && line.material.opacity < 0.5);
    assert.ok(model.geometries.has(line.geometry) && model.ownedMaterials.has(line.material));
    assert.ok(camera.containsBox(bounds(line)));
    assert.ok(line.position.z < 0, 'assembly guide stays behind the parts');
    const from = line.localToWorld(new THREE.Vector3(0, 0, 0));
    const to = line.localToWorld(new THREE.Vector3(1, 0, 0));
    assert.ok(from.x < model.flywheel.position.x && to.x > model.bearing.position.x);
  });

  model.setSection('diaphragm', true);
  assert.equal(model.pressureStraps.visible, false, 'isolation must not restore the cage');
  assert.equal(model.assemblyGuides.visible, false, 'part isolation hides drawing guides');
  model.setSection('all');
  assert.ok(model.assemblyGuides.visible);

  model.exploded = 0; model.update(sim, true);
  assert.ok(model.pressureStraps.visible && model.diaphragmWeb.visible);
  assert.equal(model.assemblyGuides.visible, false);
  sim.clutch = 0.5; model.update(sim, true);
  assert.ok(model.pressureStraps.visible && model.diaphragmWeb.visible);
  assert.equal(model.assemblyGuides.visible, false);

  // A vehicle overview must restore physical links even if the bench remembers
  // its previous exploded setting.
  model.exploded = 0.7; model.setView('drive'); model.update(sim, true);
  assert.ok(model.pressureStraps.visible && model.diaphragmWeb.visible);
  assert.equal(model.assemblyGuides.visible, false);
}));
