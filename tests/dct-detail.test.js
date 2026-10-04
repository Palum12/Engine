import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { DctModel } from '../src/models/dct-model.js';
import { DCT_RATIOS } from '../src/powertrain.js';
import { vec } from '../src/models/geometry.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
function fixture(run) {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const model = new DctModel(materials);
  const sim = new Simulation();
  sim.setTransmission('dct');
  try { run(model, sim); } finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
}

test('DCT prepared gears turn independently without an engine torque overlay', () => fixture((model, sim) => {
  sim.gear = 1;
  Object.assign(sim.dct, { selected: [1, 2], engagement: [1, 0], torques: [100, 0], angles: [1.8, 1.1] });
  sim.outputAngle = 0.5;
  model.update(sim, true, 0.1);
  const active = model.gears[0];
  const prepared = model.gears[1];
  const free = model.gears[2];
  assert.equal(active.output.userData.connection, 'transmitting');
  assert.equal(prepared.output.userData.connection, 'prepared');
  assert.equal(free.output.userData.connection, 'free');
  near(prepared.output.rotation.x, -1.1 / DCT_RATIOS[2] + Math.PI / 66);
  assert.notEqual(free.output.rotation.x, free.hub.rotation.x);
  assert.equal(model.paths.find(path => path.gear === 1).path.arrows.visible, true);
  assert.equal(model.paths.find(path => path.gear === 2).path.tube.visible, false);
  sim.dct.engagement = [0.5, 0.5];
  sim.dct.torques = [45, 60];
  model.update(sim, true, 0.1);
  assert.equal(model.paths.find(path => path.gear === 2).path.arrows.visible, true);
}));

test('DCT shift actuator, rail, fork and sleeve stay linked throughout a same-branch shift', () => fixture((model, sim) => {
  Object.assign(sim, { gear: 1, shiftFrom: 1, shiftTarget: 3 });
  sim.dct.selected = [1, 2];
  for (const progress of [0, 0.12, 0.3, 0.5, 0.57, 0.65, 0.9]) {
    sim.shiftProgress = progress;
    if (progress > 0.5) sim.dct.selected = [3, 2];
    model.update(sim, true);
    model.group.updateMatrixWorld(true);
    for (const gear of model.gears) {
      near(gear.fork.position.x, gear.sleeve.position.x);
      near(gear.piston.position.x - gear.fork.position.x, 0.56);
      const body = new THREE.Box3().setFromObject(gear.actuator);
      const piston = new THREE.Box3().setFromObject(gear.piston);
      assert.ok(body.min.x <= piston.min.x && body.max.x >= piston.max.x, `actuator stroke escapes its barrel for gear ${gear.gear}`);
    }
  }
  assert.ok(model.gears[0].sleeve.position.x > model.gears[0].x + 0.5);
  assert.ok(model.gears[2].sleeve.position.x < model.gears[2].x + 0.3);
}));

test('DCT clutch carriers continue to their hubs at every clamp and inspection spacing', () => fixture((model, sim) => {
  model.setSection('clutch', true);
  for (const exploded of [0, 0.5, 1]) for (const engagement of [0, 0.5, 1]) {
    model.exploded = exploded;
    sim.dct.engagement = [engagement, 1 - engagement];
    model.update(sim, true);
    model.packs.forEach(({ plates, piston, web, carrierRibs }) => {
      assert.ok(piston.position.x - 0.045 > plates.at(-1).position.x + 0.021 - 1e-6);
      assert.ok(web.position.x - 0.0225 > piston.position.x + 0.045);
      carrierRibs.forEach(rib => near(rib.position.x + rib.scale.x / 2, web.position.x));
    });
    model.group.updateMatrixWorld(true);
    const innerTail = new THREE.Box3().setFromObject(model.clutchInnerTail);
    const outerTail = new THREE.Box3().setFromObject(model.clutchOuterTail);
    assert.ok(innerTail.min.x < model.packs[0].web.position.x && innerTail.max.x > model.packs[1].web.position.x);
    assert.ok(outerTail.min.x < model.packs[1].web.position.x + 1e-5);
    assert.ok(outerTail.max.x > model.packs[1].web.position.x);
  }
}));

test('DCT bounds include visible mechanisms after scaling, parenting and section changes', () => fixture((model, sim) => {
  const parent = new THREE.Group();
  parent.position.set(-4, 1.1, 2.2);
  parent.rotation.y = -Math.PI / 2;
  parent.scale.setScalar(0.38);
  parent.add(model.group);
  for (const section of ['all', 'clutch', 'k1', 'k2', 'dctShafts', 'dctOdd', 'dctEven', 'dctSelector', 'mechatronics', 'dctOil']) {
    model.setSection(section, true);
    model.exploded = 1;
    model.update(sim, true);
    parent.updateMatrixWorld(true);
    const bounds = model.bounds();
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
    model.group.traverseVisible(object => {
      if (!object.isMesh || object.isInstancedMesh || object.userData.ignorePick) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      const objectBounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
      assert.ok(bounds.containsBox(objectBounds), `${section} misses visible ${object.userData.part}`);
    });
  }
  model.setSection('all');
  model.update(sim, false);
  parent.updateMatrixWorld(true);
  assert.ok(model.bounds().containsBox(new THREE.Box3().setFromObject(model.housing)));
  const endpoint = model.outputStub.localToWorld(vec(0, -0.75, 0));
  near(endpoint.distanceTo(model.group.localToWorld(vec(12.85, 0, 0))), 0);
}));

test('DCT reverse torque reverses arrows and pausing holds overlay positions', () => fixture((model, sim) => {
  Object.assign(sim.dct, { selected: [1, 2], engagement: [1, 0], torques: [-80, 0] });
  model.update(sim, true, 0.2);
  const route = model.paths.find(path => path.gear === 1).path;
  assert.equal(route.arrows.userData.flowDirection, -1);
  const positions = [...route.arrows.instanceMatrix.array];
  sim.paused = true;
  model.update(sim, true, 1);
  assert.deepEqual([...route.arrows.instanceMatrix.array], positions);
  model.showFlow = false;
  model.update(sim, true);
  assert.ok(model.paths.every(({ path }) => !path.arrows.visible && !path.tube.visible));
}));
