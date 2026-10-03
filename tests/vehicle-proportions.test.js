import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { FinalDriveModel } from '../src/models/final-drive-model.js';
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

const palette = () => Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(key => [key, new THREE.MeshStandardMaterial()]));
const box = object => { object.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(object); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} differs from ${expected}`);

test('compact differential preserves wheel reach, common bevel apex and the enlarged bench geometry', () => {
  const materials = palette(), model = new FinalDriveModel(materials);
  try {
    const benchCarrier = box(model.carrierFrame[1]);
    const benchShaft = box(model.shafts[0]);
    const benchInput = model.inputEndpoint();
    model.setCoreScale(0.48);
    model.group.updateMatrixWorld(true);
    const compactCarrier = box(model.carrierFrame[1]);
    const tire = box(model.wheels[0]).getSize(vec());
    assert.ok(compactCarrier.getSize(vec()).y < tire.y * 0.4, 'the differential cage should be much smaller than a tire');
    for (let side = 0; side < 2; side++) {
      const shaft = box(model.shafts[side]);
      const wheelCenter = model.wheels[side].getWorldPosition(vec());
      assert.ok(shaft.min.z <= wheelCenter.z && shaft.max.z >= wheelCenter.z, 'each shaft reaches its wheel hub');
      near(model.sideHolders[side].getWorldPosition(vec()).distanceTo(model.carrier.getWorldPosition(vec())), 0);
      near(model.planets[side].holder.getWorldPosition(vec()).distanceTo(model.carrier.getWorldPosition(vec())), 0);
    }
    model.setCoreScale(1);
    assert.ok(box(model.carrierFrame[1]).equals(benchCarrier));
    assert.ok(box(model.shafts[0]).equals(benchShaft));
    assert.ok(model.inputEndpoint().distanceTo(benchInput) < 1e-6);
  } finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
});

function vehicleFixture(run) {
  const materials = palette();
  const models = {
    engine: new EngineModel(materials, 'r3'), drive: new DrivetrainModel(materials),
    dct: new DctModel(materials), automatic: new AutomaticModel(materials),
    hybrid: new HybridModel(materials), transfer: new TransferModel(materials),
    turbo: new TurboModel(materials), connections: new ModelGeometry(materials),
  };
  models.systems = new SystemsModel(materials, models.engine);
  const vehicle = new VehicleModel(materials, models), sim = new Simulation();
  sim.setEngine('r3'); vehicle.attach();
  try { run({ vehicle, models, sim }); }
  finally {
    vehicle.dispose(); Object.values(models).forEach(model => model.dispose());
    Object.values(materials).forEach(material => material.dispose());
  }
}

test('transverse FWD final-drive gears stay compact and mesh after transmission changes', () => {
  vehicleFixture(({ vehicle, models, sim }) => {
    sim.setDriveLayout('fwd'); sim.setEngineOrientation('transverse');
    for (const transmission of ['manual', 'dct', 'automatic', 'hybrid']) {
      sim.setTransmission(transmission); vehicle.configure(sim); vehicle.group.updateMatrixWorld(true);
      const crown = vehicle.axleSpur.children[0];
      const crownFace = crown.userData.face;
      const pinionFace = vehicle.axlePinionRotor.userData.face;
      const centers = [vehicle.axleSpur, vehicle.axlePinion].map(gear => gear.getWorldPosition(vec()));
      near(centers[0].z, centers[1].z);
      const crownRadius = box(crownFace).getSize(vec()).y / 2;
      const pinionRadius = box(pinionFace).getSize(vec()).y / 2;
      const tireRadius = box(vehicle.wheels[0].wheel).getSize(vec()).y / 2;
      assert.ok(crownRadius < tireRadius * 0.5, `${transmission}: crown fits beside the differential rather than dominating the wheel`);
      assert.ok(Math.abs(centers[0].distanceTo(centers[1]) - crownRadius - pinionRadius) < 0.15, `${transmission}: pitch circles remain in contact`);
      const transmissionModel = models[transmission === 'manual' ? 'drive' : transmission];
      near(models.engine.group.localToWorld(vec(models.engine.shaftEnd, 0.8, 0)).distanceTo(transmissionModel.group.getWorldPosition(vec())), 0);
      const bounds = vehicle.bounds('differential');
      assert.ok(bounds.getSize(vec()).y < tireRadius, 'inspection framing follows the compact mechanism');
    }
  });
});

test('vehicle routes meet scaled longitudinal inputs and retain aligned wheel hubs across mounting arrangements', () => {
  vehicleFixture(({ vehicle, sim }) => {
    for (const transmission of ['manual', 'dct', 'automatic']) for (const placement of ['front', 'mid', 'rear']) for (const orientation of ['longitudinal', 'transverse']) for (const layout of ['fwd', 'rwd', 'awd', 'quattro', 'partTime']) {
      sim.setTransmission(transmission); sim.setEnginePlacement(placement);
      sim.setDriveLayout(layout); sim.setEngineOrientation(orientation);
      vehicle.configure(sim); vehicle.group.updateMatrixWorld(true);
      const driven = [sim.driveLayout !== 'rwd', sim.driveLayout !== 'fwd'];
      for (let axle = 0; axle < 2; axle++) {
        const finalDrive = axle ? vehicle.rear : vehicle.front;
        for (let side = 0; side < 2; side++) near(finalDrive.wheels[side].getWorldPosition(vec()).distanceTo(vehicle.wheels[axle * 2 + side].wheel.getWorldPosition(vec())), 0);
        if (!driven[axle] || axle === vehicle.spurAxle) continue;
        const endpoint = finalDrive.inputEndpoint();
        const joints = vehicle.routing.group.children.filter(object => object.geometry?.type === 'SphereGeometry');
        assert.ok(joints.some(joint => joint.getWorldPosition(vec()).distanceTo(endpoint) < 1e-6), `${transmission}/${placement}/${orientation}/${layout}: a routed shaft must meet each longitudinal input`);
      }
      assert.ok(vehicle.paths.every(({ path }) => path.curve.getPoint(0.5).toArray().every(Number.isFinite)));
    }
  });
});
