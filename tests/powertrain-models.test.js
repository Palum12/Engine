import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { ENGINES } from '../src/engines.js';
import { EngineScene } from '../src/scene.js';
import { EngineModel } from '../src/models/engine-model.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';
import { DctModel } from '../src/models/dct-model.js';
import { HybridModel } from '../src/models/hybrid-model.js';
import { TransferModel } from '../src/models/transfer-model.js';
import { TurboModel } from '../src/models/turbo-model.js';
import { SystemsModel } from '../src/models/systems-model.js';
import { FinalDriveModel } from '../src/models/final-drive-model.js';
import { VehicleModel } from '../src/models/vehicle-model.js';
import { ModelGeometry, vec } from '../src/models/geometry.js';
import { bevelGearGeometry } from '../src/models/mechanical-geometry.js';
import { getInspections } from '../src/inspection.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const materials = () => Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));

function fixture(run) {
  const m = materials();
  const scene = Object.create(EngineScene.prototype);
  Object.assign(scene, { sim: new Simulation(), root: new THREE.Group(), camera: new THREE.PerspectiveCamera(40, 16 / 9, 0.06, 160), controls: { target: vec(), update() {} }, container: { dataset: {} }, grid: new THREE.Object3D(), mode: 'engine', inspection: 'all', isolate: false, selectedCylinder: 0 });
  scene.engine = new EngineModel(m);
  scene.drive = new DrivetrainModel(m);
  scene.dct = new DctModel(m);
  scene.hybrid = new HybridModel(m);
  scene.transfer = new TransferModel(m);
  scene.turbo = new TurboModel(m);
  scene.systems = new SystemsModel(m, scene.engine);
  scene.finalDrive = new FinalDriveModel(m);
  scene.connections = new ModelGeometry(m);
  const models = Object.fromEntries(['engine', 'drive', 'dct', 'hybrid', 'transfer', 'turbo', 'systems', 'connections'].map(key => [key, scene[key]]));
  scene.vehicle = new VehicleModel(m, models);
  scene.root.add(...Object.values(models).map(model => model.group), scene.finalDrive.group, scene.vehicle.group);
  scene.camera.position.set(8, 15, 25);
  try { run(scene, scene.sim); }
  finally { scene.vehicle.dispose(); scene.finalDrive.dispose(); Object.values(models).forEach(model => model.dispose()); Object.values(m).forEach(material => material.dispose()); }
}

test('all drive configurations and inspections have finite camera bounds and reversible whole/bench layouts', () => {
  fixture((scene, sim) => {
    for (const type of ['manual', 'dct', 'hybrid']) for (const layout of type === 'hybrid' ? ['fwd'] : ['rwd', 'fwd', 'partTime', 'awd', 'quattro']) {
      sim.setTransmission(type); sim.setDriveLayout(layout);
      for (const view of ['drive', 'drive-detail', 'clutch', 'gearbox', 'differential', 'transfer', 'hybrid', 'engine', 'timing', 'oil', 'fuel']) {
        if (view === 'hybrid' && type !== 'hybrid' || view === 'transfer' && ['rwd', 'fwd'].includes(layout)) continue;
        scene.setView(view, true);
        for (const entry of getInspections(view, sim) || [{ id: 'all' }]) {
          scene.inspect(entry.id, true);
          assert.ok(scene.camera.position.toArray().every(Number.isFinite), `${type}/${layout}/${view}/${entry.id}`);
          assert.ok(scene.controls.target.toArray().every(Number.isFinite));
          scene.vehicle.update(sim, true, 0.02, scene.camera);
        }
        scene.inspect('all', false);
      }
      scene.setView('drive-detail', true);
      assert.equal(scene.engine.group.parent, scene.vehicle.assembly);
      assert.equal(scene.vehicle.wheels.length, 4);
      scene.setView('engine', true);
      assert.equal(scene.engine.group.parent, scene.root);
      near(scene.engine.group.scale.x, 1);
      near(scene.engine.group.rotation.y, 0);
    }
  });
});

test('whole-vehicle packaging accommodates all seven engine architectures without stale routing', () => {
  fixture((scene, sim) => {
    for (const id of Object.keys(ENGINES)) {
      scene.engine.dispose(); scene.systems.dispose();
      scene.engine = new EngineModel(scene.drive.materials, id);
      scene.systems = new SystemsModel(scene.drive.materials, scene.engine);
      Object.assign(scene.vehicle.models, { engine: scene.engine, systems: scene.systems });
      sim.setEngine(id);
      for (const layout of ['rwd', 'fwd', 'quattro']) {
        sim.setDriveLayout(layout); scene.setView('drive-detail', true);
        scene.vehicle.update(sim, true, 0.02, scene.camera);
        const end = scene.engine.group.localToWorld(vec(scene.engine.shaftEnd, 0.8, 0));
        const input = scene.drive.group.getWorldPosition(vec());
        near(end.distanceTo(input), 0, 1e-6);
        assert.ok(scene.vehicle.paths.every(({ path }) => path.curve.getPoint(0.5).toArray().every(Number.isFinite)));
      }
    }
    scene.engine.dispose(); scene.systems.dispose();
  });
});

test('valve rockers keep local dimensions and meet valve tips when engines are moved into a whole vehicle', () => {
  const m = materials();
  const sim = new Simulation();
  try {
    for (const id of Object.keys(ENGINES)) {
      const engine = new EngineModel(m, id);
      try {
        sim.setEngine(id);
        for (const angle of [0, 90, 180, 355, 540, 710]) {
          sim.angle = angle;
          engine.group.position.set(0, 0, 0);
          engine.group.rotation.set(0, 0, 0);
          engine.group.scale.setScalar(1);
          engine.update(sim, true);
          const lengths = engine.rockers.map(({ rocker }) => rocker.scale.y);
          for (const rotation of [0, -Math.PI / 2]) {
            engine.group.position.set(-7, 0.9, -2.1);
            engine.group.rotation.y = rotation;
            engine.group.scale.setScalar(0.28);
            engine.update(sim, true);
            engine.group.updateMatrixWorld(true);
            engine.rockers.forEach(({ rocker, start, valve }, n) => {
              near(rocker.scale.y, lengths[n]);
              const ends = [rocker.localToWorld(vec(0, -0.5, 0)), rocker.localToWorld(vec(0, 0.5, 0))];
              near(ends[0].distanceTo(rocker.parent.localToWorld(start.clone())), 0);
              near(ends[1].distanceTo(valve.localToWorld(vec(0, 0.72, 0))), 0);
              assert.ok(rocker.scale.y < 2.5, `${id}: ${rocker.scale.y}`);
            });
          }
        }
      } finally { engine.dispose(); }
    }
  } finally { Object.values(m).forEach(material => material.dispose()); }
});

test('DCT input and output plates rotate independently and its output gears follow the shafts', () => {
  fixture((scene, sim) => {
    sim.setTransmission('dct'); scene.dct.group.visible = true;
    sim.angle = 180; sim.dct.angles = [0.4, 0.7]; sim.outputAngle = 0.9;
    sim.dct.engagement = [1, 0];
    scene.dct.update(sim, true);
    const [k1, k2] = scene.dct.packs;
    near(k1.plates[0].rotation.x, Math.PI);
    near(k1.plates[1].rotation.x, 0.4);
    near(k2.plates[1].rotation.x, 0.7);
    near(k1.plates[1].position.x - k1.plates[0].position.x, 0.042);
    assert.ok(k2.plates[1].position.x - k2.plates[0].position.x > 0.07);
    scene.dct.outputGears.forEach(gear => near(gear.rotation.x, -0.9 + Math.PI / 30));
    assert.ok(scene.dct.outerShaft.geometry.boundingBox === null || scene.dct.outerShaft.geometry.boundingBox.isBox3);
    scene.dct.setSection('k2', true);
    assert.equal(k1.pack.visible, false);
    assert.equal(k2.pack.visible, true);
  });
});

test('bevel pairs share pitch-cone apex, clear halfshafts and separate crown from side-gear backs', () => {
  const side = bevelGearGeometry(16, 12, 0.07, 0.2, 0.105);
  const planet = bevelGearGeometry(12, 16, 0.07, 0.2, 0.06);
  near(side.userData.delta + planet.userData.delta, Math.PI / 2);
  near(side.userData.outerDistance, planet.userData.outerDistance);
  fixture(scene => {
    scene.finalDrive.group.updateMatrixWorld(true);
    const crown = new THREE.Box3().setFromObject(scene.finalDrive.crown);
    const left = new THREE.Box3().setFromObject(scene.finalDrive.sideGears[0]);
    assert.ok(crown.max.z < left.min.z - 0.02);
    near(scene.finalDrive.sideHolders[0].position.length(), 0);
    near(scene.finalDrive.planets[0].holder.position.length(), 0);
    assert.ok(side.userData.bore > 0.095 && planet.userData.bore > 0.055);
  });
  side.dispose(); planet.dispose();
});

test('hybrid current paths reverse for charging, AC arrows denote energy and pause holds their positions', () => {
  fixture((scene, sim) => {
    sim.setTransmission('hybrid'); scene.setView('hybrid', true);
    Object.assign(sim.hybrid, { batteryPower: 6000, generatorPower: 2000, motorDcPower: 8000 });
    scene.hybrid.update(sim, true, 0.1);
    const positive = scene.hybrid.paths[0].path;
    const negative = scene.hybrid.paths[1].path;
    assert.equal(positive.arrows.userData.flowDirection, 1);
    assert.equal(negative.arrows.userData.flowDirection, -1);
    sim.hybrid.batteryPower = -4000;
    scene.hybrid.update(sim, true, 0.1);
    assert.equal(positive.arrows.userData.flowDirection, -1);
    assert.equal(negative.arrows.userData.flowDirection, 1);
    const before = [...positive.arrows.instanceMatrix.array];
    sim.paused = true; scene.hybrid.update(sim, true, 1);
    assert.deepEqual([...positive.arrows.instanceMatrix.array], before);
    scene.hybrid.showFlow = false; scene.hybrid.update(sim, true);
    assert.ok(scene.hybrid.paths.every(({ path }) => !path.arrows.visible));
  });
});

test('disconnected 2H chain follows the passive front axle; 4H reconnects both sprockets to the main shaft', () => {
  fixture((scene, sim) => {
    sim.setDriveLayout('partTime'); scene.transfer.group.visible = true;
    sim.axleAngles = [0.7, 1.2]; sim.outputAngle = 1.2 * 3.9;
    scene.transfer.update(sim, true);
    scene.transfer.sprockets.forEach(gear => near(gear.rotation.x, 0.7 * 3.9));
    assert.notEqual(scene.transfer.mainShaft.rotation.x, scene.transfer.sprockets[0].rotation.x);
    sim.driveMode = '4H'; scene.transfer.update(sim, true);
    scene.transfer.sprockets.forEach(gear => near(gear.rotation.x, scene.transfer.mainShaft.rotation.x));
  });
});
