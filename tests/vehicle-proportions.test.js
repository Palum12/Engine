import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { applyCarPreset } from '../src/car-configuration.js';
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

function vehicleFixture(run, engineId = 'r3') {
  const materials = palette();
  const models = {
    engine: new EngineModel(materials, engineId), drive: new DrivetrainModel(materials),
    dct: new DctModel(materials), automatic: new AutomaticModel(materials),
    hybrid: new HybridModel(materials), transfer: new TransferModel(materials),
    turbo: new TurboModel(materials), connections: new ModelGeometry(materials),
  };
  models.systems = new SystemsModel(materials, models.engine);
  const vehicle = new VehicleModel(materials, models), sim = new Simulation();
  sim.setEngine(engineId); vehicle.attach();
  try { run({ vehicle, models, sim }); }
  finally {
    vehicle.dispose(); Object.values(models).forEach(model => model.dispose());
    Object.values(materials).forEach(material => material.dispose());
  }
}

// Test the rendered shaft cylinders against real mechanical triangles, rather
// than treating a gearbox's empty spaces as solid because its bounds overlap.
function shaftIntersections(vehicle, model) {
  const solids = [];
  model.group.traverseVisible(object => {
    if (object.isMesh && !object.isInstancedMesh && !object.userData.ignorePick
      && !object.material.transparent) solids.push(object);
  });
  const hits = [];
  for (const shaft of vehicle.routing.group.children) {
    if (shaft.geometry?.type !== 'CylinderGeometry') continue;
    const start = shaft.localToWorld(vec(0, -0.5, 0));
    const end = shaft.localToWorld(vec(0, 0.5, 0));
    const length = start.distanceTo(end), direction = end.clone().sub(start).normalize();
    const right = vec(1, 0, 0).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    const forward = vec(0, 0, 1).applyQuaternion(shaft.getWorldQuaternion(new THREE.Quaternion()));
    // Include the shaft surface: an empty bore at its center is not clearance
    // for the entire cylinder. Ignore only the intended joints at either end.
    const origins = [start];
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      origins.push(start.clone().addScaledVector(right, Math.cos(a) * 0.095).addScaledVector(forward, Math.sin(a) * 0.095));
    }
    if (origins.some(origin => new THREE.Raycaster(origin, direction, 0.16, length - 0.16).intersectObjects(solids, false).length)) {
      hits.push([start.toArray(), end.toArray()]);
    }
  }
  return hits;
}

test('Bugatti AWD shafts clear the DCT instead of cutting through its gears', () => {
  vehicleFixture(({ vehicle, models, sim }) => {
    applyCarPreset(sim, 'veyron-2005');
    vehicle.configure(sim);
    for (const phase of [0, 0.47, 1.19]) {
      sim.angle = phase * 180 / Math.PI; sim.outputAngle = phase * 0.7;
      sim.dct.angles = [phase, phase * 1.3];
      models.dct.update(sim, true, 0); vehicle.group.updateMatrixWorld(true);
      assert.deepEqual(shaftIntersections(vehicle, models.dct), [], 'external drive shafts must stay outside DCT solids throughout rotation');
      assert.deepEqual(shaftIntersections(vehicle, models.transfer), [], 'external shafts attach at ports rather than passing through the central gears');
    }
    const output = models.dct.outputStub.localToWorld(vec(0, -0.75, 0));
    const joints = vehicle.routing.group.children.filter(object => object.geometry?.type === 'SphereGeometry');
    assert.ok(joints.some(joint => joint.getWorldPosition(vec()).distanceTo(output) < 1e-6), 'the input route must still attach to the actual DCT output');
    const entry = vehicle.paths.find(({ key }) => key === 'input').path.curve.points.at(-1);
    const rearExit = vehicle.paths.find(({ key }) => key === 'rear').path.curve.points[0];
    assert.ok(entry.distanceTo(rearExit) > 0.3, 'the carrier input must not join the rear output shaft directly');
  }, 'w16');
});

test('AWD and quattro drive their carriers through a distinct, rotating input pinion', () => {
  const materials = palette(), model = new TransferModel(materials), sim = new Simulation();
  try {
    model.group.position.set(2, 0.65, 0); model.group.scale.setScalar(0.62);
    for (const layout of ['awd', 'quattro']) {
      sim.setDriveLayout(layout); sim.axleAngles = [0.37, 1.21];
      model.update(sim, true);
      const carrier = layout === 'awd' ? model.carrier : model.quattroCarrier;
      // Equal gears reverse direction without inventing a new transfer ratio.
      near(model.inputPinion.rotation.x - Math.PI / 24, -carrier.rotation.x);
      if (layout === 'quattro') {
        const carrierDrive = carrier.children.find(object => object.userData.face && object.position.x > 0);
        assert.ok(box(carrierDrive).min.x > box(model.lockPacks[1]).max.x, 'the carrier gear must clear the independently rotating lock pack');
      }
      for (const side of [-1, 1]) {
        const port = model.inputEndpoint(side);
        const shaftTip = model.inputShaft.localToWorld(vec(0, -side * model.inputShaft.geometry.parameters.height / 2, 0));
        near(port.distanceTo(shaftTip), 0);
        assert.ok(port.distanceTo(model.group.localToWorld(vec(side * 1.62, 0, 0))) > 0.6, 'the carrier drive stays separate from each axle output');
        assert.ok(model.bounds().containsPoint(port), 'inspection framing includes the actual input');
      }
    }
    model.configure('partTime'); assert.equal(model.inputDrive.visible, false);
    model.configure('awd'); assert.equal(model.inputDrive.visible, true);
  } finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
});

test('longitudinal AWD return routes remain connected after mounting and transmission changes', () => {
  vehicleFixture(({ vehicle, models, sim }) => {
    for (const transmission of ['manual', 'dct', 'automatic']) for (const placement of ['front', 'mid', 'rear']) for (const layout of ['awd', 'quattro', 'partTime']) {
      sim.setTransmission(transmission); sim.setEnginePlacement(placement);
      sim.setDriveLayout(layout); sim.setEngineOrientation('longitudinal');
      vehicle.configure(sim); vehicle.group.updateMatrixWorld(true);
      const mechanism = models[transmission === 'manual' ? 'drive' : transmission];
      assert.deepEqual(shaftIntersections(vehicle, mechanism), [], `${transmission}/${placement}/${layout}: external shafts clear the transmission`);
      const transferPosition = models.transfer.group.position.clone();
      const routing = vehicle.routing;
      vehicle.configure(sim, 'transfer', true); vehicle.configure(sim);
      assert.equal(vehicle.routing, routing, 'inspection changes reuse routing');
      near(models.transfer.group.position.distanceTo(transferPosition), 0);
      for (const { path } of vehicle.paths) {
        // Halfshaft overlays sit above the wheel axis for readability; this
        // checks the longitudinal routes that were moved around the gearbox.
        if (path.curve.points.length !== 2 || Math.abs(path.curve.points[0].x - path.curve.points[1].x) < 1e-6) continue;
        const midpoint = path.curve.getPoint(0.5);
        assert.ok(vehicle.routing.group.children.some(object => object.geometry?.type === 'CylinderGeometry'
          && object.getWorldPosition(vec()).distanceTo(midpoint) < 1e-6), 'external flow follows its physical shaft');
      }
    }
  });
});

test('stable vehicle LOD reuses its hidden mesh list and restores details before rebuilding', () => {
  vehicleFixture(({ vehicle, models, sim }) => {
    vehicle.configure(sim);
    const camera = new THREE.PerspectiveCamera(); camera.position.set(25, 18, 25);
    vehicle.detail = 'overview'; vehicle.update(sim, true, 1 / 60, camera);
    const hidden = []; vehicle.assembly.traverse(object => { if (object.userData.lodHidden) hidden.push(object); });
    assert.ok(hidden.length > 0);
    let traversals = 0;
    const traverse = vehicle.assembly.traverse;
    vehicle.assembly.traverse = function(callback) { traversals++; return traverse.call(this, callback); };
    models.engine.update(sim, true, false); vehicle.update(sim, true, 1 / 60, camera);
    assert.equal(traversals, 0, 'stable frames must not rescan the complete assembly for LOD');
    assert.ok(hidden.every(object => !object.visible));
    vehicle.restoreDetail(); assert.ok(hidden.every(object => object.visible && object.userData.lodHidden === undefined));
    vehicle.detail = 'service'; vehicle.update(sim, true, 1 / 60, camera);
    assert.ok(traversals > 0, 'a changed level rebuilds the list');
  });
});

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
