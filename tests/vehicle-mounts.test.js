import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { ENGINES } from '../src/engines.js';
import { EngineModel } from '../src/models/engine-model.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';
import { DctModel } from '../src/models/dct-model.js';
import { AutomaticModel } from '../src/models/automatic-model.js';
import { HybridModel } from '../src/models/hybrid-model.js';
import { TransferModel } from '../src/models/transfer-model.js';
import { TurboModel } from '../src/models/turbo-model.js';
import { SystemsModel } from '../src/models/systems-model.js';
import { VehicleModel } from '../src/models/vehicle-model.js';
import { ModelGeometry, vec } from '../src/models/geometry.js';

function fixture(run) {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const models = {
    engine: new EngineModel(materials),
    drive: new DrivetrainModel(materials),
    dct: new DctModel(materials),
    automatic: new AutomaticModel(materials),
    hybrid: new HybridModel(materials),
    transfer: new TransferModel(materials),
    turbo: new TurboModel(materials),
    connections: new ModelGeometry(materials),
  };
  models.systems = new SystemsModel(materials, models.engine);
  const vehicle = new VehicleModel(materials, models);
  const sim = new Simulation();
  const rebuildEngine = id => {
    models.engine.dispose(); models.systems.dispose();
    models.engine = new EngineModel(materials, id);
    models.systems = new SystemsModel(materials, models.engine);
    sim.setEngine(id);
    vehicle.attach();
  };
  vehicle.attach();
  try { run({ vehicle, models, sim, rebuildEngine }); }
  finally {
    vehicle.dispose();
    Object.values(models).forEach(model => model.dispose());
    Object.values(materials).forEach(material => material.dispose());
  }
}

test('all architectures keep their crankshaft connected to each transmission across supported mounting arrangements', () => {
  fixture(({ vehicle, models, sim, rebuildEngine }) => {
    for (const id of Object.keys(ENGINES)) {
      rebuildEngine(id);
      for (const transmission of ['manual', 'dct', 'automatic']) {
        sim.setTransmission(transmission);
        for (const orientation of ENGINES[id].mountOrientations || ['longitudinal']) {
          for (const placement of ['front', 'mid', 'rear']) {
            sim.setEnginePlacement(placement);
            sim.setDriveLayout(placement === 'front' ? 'fwd' : 'rwd');
            sim.setEngineOrientation(orientation);
            assert.equal(sim.engineOrientation, orientation);
            assert.equal(sim.enginePlacement, placement);
            vehicle.configure(sim);
            vehicle.group.updateMatrixWorld(true);
            const engineEnd = models.engine.group.localToWorld(vec(models.engine.shaftEnd, 0.8, 0));
            const input = models[transmission === 'manual' ? 'drive' : transmission].group.getWorldPosition(vec());
            assert.ok(engineEnd.distanceTo(input) < 1e-6, `${id}/${transmission}/${orientation}/${placement}`);
            for (const section of ['all', 'engine', 'gearbox', 'clutch', 'finalDrive']) {
              const bounds = vehicle.bounds(section);
              assert.ok(!bounds.isEmpty() && [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
            }
            assert.ok(vehicle.paths.every(({ path }) => path.curve.getPoint(0.5).toArray().every(Number.isFinite)));
          }
        }
      }
    }
  });
});

test('longitudinal FWD uses its front crown and input while transverse AWD keeps a rear mechanical drive', () => {
  fixture(({ vehicle, sim }) => {
    sim.setEngineOrientation('longitudinal'); sim.setDriveLayout('fwd');
    vehicle.configure(sim);
    assert.equal(vehicle.front.group.visible, true);
    assert.equal(vehicle.front.crown.visible, true);
    assert.equal(vehicle.front.input.visible, true);
    assert.equal(vehicle.rear.group.visible, false);
    assert.equal(vehicle.axleSpur, null);
    const longitudinalRouting = vehicle.routing;

    sim.setEngineOrientation('transverse'); sim.setDriveLayout('awd');
    vehicle.configure(sim);
    assert.notEqual(vehicle.routing, longitudinalRouting);
    assert.equal(longitudinalRouting.group.parent, null);
    assert.equal(vehicle.axleSpur.parent, vehicle.front.carrier);
    assert.equal(vehicle.front.crown.visible, false);
    assert.equal(vehicle.front.input.visible, false);
    assert.equal(vehicle.rear.group.visible, true);
    assert.equal(vehicle.rear.crown.visible, true);
    assert.ok(vehicle.paths.some(({ key }) => key === 'front'));
    assert.ok(vehicle.paths.some(({ key }) => key === 'rear'));
    const spur = vehicle.axleSpur;

    sim.setEngineOrientation('longitudinal'); vehicle.configure(sim);
    assert.equal(spur.parent, null);
    assert.equal(vehicle.axleSpur, null);
    assert.equal(vehicle.front.crown.visible, true);
  });
});

test('mid and rear engines sit on the correct side of the rear axle and single-axle routing stays outside the gearbox', () => {
  fixture(({ vehicle, models, sim, rebuildEngine }) => {
    for (const [engine, placement] of [['w16', 'mid'], ['boxer6', 'rear']]) {
      rebuildEngine(engine);
      sim.setTransmission('dct'); sim.setEnginePlacement(placement); sim.setDriveLayout('rwd');
      vehicle.configure(sim);
      assert.ok(models.engine.group.position.x > 0);
      assert.equal(models.engine.group.rotation.y, Math.PI);
      assert.ok(placement === 'rear' ? models.engine.group.position.x > 7 : models.engine.group.position.x < 7);
      assert.equal(vehicle.front.group.visible, false);
      assert.equal(vehicle.rear.group.visible, true);
      assert.ok(vehicle.paths.every(({ key, path }) => key === 'rear' && path.arrows.count <= 3));
    }
  });
});

test('transverse mid and rear placements occupy different sides of the rear axle', () => {
  fixture(({ vehicle, models, sim }) => {
    sim.setEnginePlacement('mid'); sim.setEngineOrientation('transverse'); sim.setDriveLayout('rwd');
    vehicle.configure(sim);
    const middleX = models.engine.group.position.x;
    assert.ok(middleX < 7);
    sim.setEnginePlacement('rear'); vehicle.configure(sim);
    assert.ok(models.engine.group.position.x > 7);
    assert.ok(models.engine.group.position.x > middleX + 1);
    assert.equal(vehicle.axleSpur.parent, vehicle.rear.carrier);
  });
});

test('front shaft meets the central output for AWD, quattro and the offset part-time transfer', () => {
  fixture(({ vehicle, sim }) => {
    for (const layout of ['awd', 'quattro', 'partTime']) {
      sim.setDriveLayout(layout); vehicle.configure(sim);
      const path = vehicle.paths.find(entry => entry.key === 'front').path;
      assert.ok(Math.abs(path.curve.getPoint(0).z - (layout === 'partTime' ? -0.9 : 0)) < 1e-8);
    }
    sim.setDriveLayout('awd'); sim.setEngineOrientation('transverse'); vehicle.configure(sim);
    const path = vehicle.paths.find(entry => entry.key === 'input').path;
    assert.ok(Math.abs(path.curve.getPoint(1).z) < 1e-8);
  });
});

test('automatic inspections use the attached automatic assembly and its own bounds', () => {
  fixture(({ vehicle, models, sim }) => {
    sim.setTransmission('automatic');
    vehicle.configure(sim, 'converter', true);
    assert.equal(models.automatic.group.parent, vehicle.assembly);
    assert.equal(models.automatic.group.visible, true);
    assert.equal(models.drive.group.visible, false);
    assert.equal(models.dct.group.visible, false);
    assert.ok(vehicle.bounds('converter').equals(models.automatic.bounds('converter')));
    vehicle.configure(sim, 'engine', true);
    assert.equal(models.automatic.group.visible, false);
  });
});
