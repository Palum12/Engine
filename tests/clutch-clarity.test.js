import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import { Simulation } from '../src/simulation.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';
import { manualClutchState, manualClutchPresentation } from '../src/manual-clutch.js';

const fixture = run => {
  const names = ['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'];
  const materials = Object.fromEntries(names.map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new DrivetrainModel(materials);
  try { run(model, new Simulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};

// For these rectangular components the transformed BoxGeometry is the actual
// solid, so SAT is an exact box/box check rather than a loose world AABB test.
function boxSolid(mesh) {
  assert.equal(mesh.geometry.type, 'BoxGeometry');
  mesh.geometry.computeBoundingBox();
  const result = new OBB().fromBox3(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
  result.halfSize.addScalar(-1e-5);
  return result;
}

// Transform actual mesh triangles into a strip's local frame. A triangle that
// intersects the shrunken solid box is a real surface penetrating the strip;
// intersecting radial or world-space envelopes alone is not a failure.
function assertSurfaceClearOfBox(surface, boxMesh, description) {
  assert.equal(boxMesh.geometry.type, 'BoxGeometry');
  boxMesh.geometry.computeBoundingBox();
  const box = boxMesh.geometry.boundingBox.clone().expandByScalar(-1e-5);
  const relative = boxMesh.matrixWorld.clone().invert().multiply(surface.matrixWorld);
  const positions = surface.geometry.attributes.position, indices = surface.geometry.index;
  const triangle = new THREE.Triangle();
  const start = surface.geometry.drawRange.start;
  const end = Math.min(indices?.count ?? positions.count, start + surface.geometry.drawRange.count);
  for (let index = start; index + 2 < end; index += 3) {
    [triangle.a, triangle.b, triangle.c].forEach((point, offset) => point.fromBufferAttribute(positions, indices ? indices.getX(index + offset) : index + offset).applyMatrix4(relative));
    assert.equal(triangle.intersectsBox(box), false, `${description}: triangle ${index / 3} enters the solid`);
  }
}

function vertices(mesh, frame) {
  const positions = mesh.geometry.attributes.position;
  return Array.from({ length: positions.count }, (_, index) => {
    const point = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, index));
    return frame ? frame.worldToLocal(point) : point;
  });
}

test('friction presentation distinguishes synchronous grip, loaded slip and unloaded contact', () => {
  const state = manualClutchState(0.5);
  const present = overrides => manualClutchPresentation({ state, engineRpm: 1800, inputOmega: 1800 * Math.PI / 30, transmittedTorque: 60, ...overrides });
  const grip = present({});
  assert.equal(grip.kind, 'grip', 'half pedal reduces clamp but cannot create slip without a speed difference');
  assert.equal(grip.heatPower, 0);
  assert.equal(grip.synchronous, true);
  const slip = present({ inputOmega: 650 * Math.PI / 30 });
  assert.equal(slip.kind, 'slip');
  assert.ok(slip.torque > 0 && slip.heatPower > 0);
  assert.ok(Math.abs(slip.heatPower - slip.torque * slip.slipRpm * Math.PI / 30) < 1e-6, 'heating follows actual friction work');
  const contact = present({ inputOmega: 0, transmittedTorque: 0 });
  assert.equal(contact.kind, 'contact', 'unequal speeds without transmitted torque must not imply friction heating');
  assert.equal(contact.heatPower, 0);
  for (const overrides of [{ state: manualClutchState(1), inputOmega: 0 }, { exploded: true, inputOmega: 0 }]) {
    const disconnected = present(overrides);
    assert.ok(['open', 'exploded'].includes(disconnected.kind));
    assert.equal(disconnected.torque, 0);
    assert.equal(disconnected.heatPower, 0);
    assert.equal(disconnected.operational, disconnected.kind !== 'exploded');
  }
});

test('the model shares friction state with the lesson and moves only the parts caused by pedal travel', () => fixture((model, sim) => {
  model.setView('clutch'); sim.paused = true; sim.rpm = 1800; sim.inputOmega = 1800 * Math.PI / 30; sim.transmittedTorque = 60;
  sim.clutch = 0; model.update(sim, true);
  const plate = model.pressure.position.x, bearing = model.bearing.position.x;
  const strapPoses = model.straps.flatMap(({ segments }) => segments.map(segment => segment.matrixWorld.toArray()));
  assert.equal(model.clutchPresentation.kind, 'grip');
  assert.ok(model.contactEdges.every(edge => edge.visible));
  sim.clutch = 0.5; model.update(sim, true);
  assert.equal(model.clutchPresentation.kind, 'grip', 'a reduced clamp alone does not indicate sliding');
  assert.equal(model.pressure.position.x, plate, 'pressure plate remains against the linings until clamp is released');
  assert.ok(model.bearing.position.x < bearing, 'hydraulic piston advances the bearing before the plate retracts');
  model.straps.flatMap(({ segments }) => segments).forEach((segment, index) => assert.deepEqual(segment.matrixWorld.toArray(), strapPoses[index], 'return straps follow plate displacement, rather than deforming directly from pedal position'));
  sim.inputOmega = 650 * Math.PI / 30; model.update(sim, true);
  assert.equal(model.clutchPresentation.kind, 'slip');
  assert.ok(model.clutchPresentation.heatPower > 0);
  assert.equal(model.contacts[0].material.color.getHex(), model.clutchPresentation.color);
  assert.equal(model.contactEdges[0].material.color.getHex(), model.clutchPresentation.color);
  sim.clutch = 1; model.update(sim, true);
  assert.equal(model.clutchPresentation.kind, 'open');
  assert.equal(model.clutchPresentation.heatPower, 0);
  assert.equal(model.clutchPresentation.torque, 0);
  assert.ok(model.pressure.position.x > plate);
  assert.ok(model.contacts.every(contact => !contact.visible) && model.contactEdges.every(edge => !edge.visible));
  assert.equal(model.clampArrows.visible, false);
  sim.clutch = 0; model.exploded = 0.4; model.update(sim, true);
  assert.equal(model.clutchPresentation.kind, 'exploded');
  assert.equal(model.clutchPresentation.heatPower, 0);
  assert.equal(model.clutchPresentation.torque, 0);
  assert.ok(model.contacts.every(contact => !contact.visible) && model.contactEdges.every(edge => !edge.visible));
  assert.equal(model.actuationArrows.visible, false);
  assert.equal(model.clampArrows.visible, false);
}));

test('actual spring web surfaces clear their support ribs throughout the release stroke', () => fixture((model, sim) => {
  model.setView('clutch');
  const pedals = [...Array.from({ length: 21 }, (_, index) => index / 20), 0.72];
  for (const pedal of pedals) for (const phase of [0, 0.13, 0.9, 2.4]) {
    sim.clutch = pedal; sim.angle = phase * 180 / Math.PI; sim.inputAngle = phase * 0.7;
    model.update(sim, false);
    model.coverSupports.forEach(rib => assertSurfaceClearOfBox(model.diaphragmWeb, rib, `spring/rib at pedal ${pedal}, phase ${phase}`));
    model.fingers.forEach(({ finger }) => {
      assertSurfaceClearOfBox(model.pressureFace, finger, `pressure/inner finger at pedal ${pedal}`);
      assertSurfaceClearOfBox(model.guideSleeve, finger, `guide/inner finger at pedal ${pedal}`);
    });
    model.fulcrumRetainers.forEach(retainer => {
      if (retainer.geometry.type === 'BoxGeometry') {
        assertSurfaceClearOfBox(model.diaphragmWeb, retainer, `spring/retainer bridge at pedal ${pedal}`);
        assertSurfaceClearOfBox(model.pressureFace, retainer, `pressure/retainer bridge at pedal ${pedal}`);
      } else {
        model.fingers.forEach(({ finger }) => assertSurfaceClearOfBox(retainer, finger, `retainer pin/inner finger at pedal ${pedal}`));
        model.pressureFace.geometry.computeBoundingBox();
        vertices(retainer, model.pressureFace).forEach(point => assert.ok(point.x > model.pressureFace.geometry.boundingBox.max.x + 1e-5, 'axial retainer pins remain behind the complete pressure face'));
      }
    });
  }
}));

test('interleaved hub and shaft teeth have no solid overlaps while remaining clear of the fixed guide', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.5, 1]) for (const phase of [0, 0.13, 1.2, 2.4]) {
    sim.clutch = pedal; sim.angle = phase * 180 / Math.PI; sim.inputAngle = phase * 0.77;
    model.update(sim, false);
    const hub = model.hubTeeth.map(boxSolid), shaft = model.inputSplines.children.map(boxSolid);
    hub.forEach(tooth => shaft.forEach(spline => assert.equal(tooth.intersectsOBB(spline), false, 'actual rectangular teeth interleave instead of occupying the same solid')));
    model.inputSplines.children.forEach(spline => assertSurfaceClearOfBox(model.guideSleeve, spline, 'spline/fixed guide'));
  }
}));

test('a rigid hydraulic piston translates, keeps its head in the chamber and clears the guide', () => fixture((model, sim) => {
  model.setView('clutch');
  let initialLength, initialHeadSize, housingPose, initialFront;
  for (const pedal of [0, 0.25, 0.5, 0.75, 1]) {
    sim.clutch = pedal; sim.angle += 31; model.update(sim, false);
    const points = vertices(model.actuatorPiston, model.clutch);
    const front = Math.min(...points.map(point => point.x)), back = Math.max(...points.map(point => point.x));
    initialLength ??= back - front; initialFront ??= front;
    assert.ok(Math.abs(back - front - initialLength) < 1e-6, 'piston sleeve must translate rather than lengthen');
    if (pedal === 1) assert.ok(front < initialFront - 0.05, 'hydraulic piston visibly advances toward the spring');
    const head = new THREE.Box3().setFromObject(model.pistonHead), size = head.getSize(new THREE.Vector3());
    initialHeadSize ??= size.clone();
    assert.ok(size.distanceTo(initialHeadSize) < 1e-6, 'piston head keeps its solid dimensions');
    const housing = new THREE.Box3().setFromObject(model.actuatorHousing);
    housingPose ??= housing.clone();
    assert.ok(housing.min.distanceTo(housingPose.min) < 1e-6 && housing.max.distanceTo(housingPose.max) < 1e-6, 'fluid chamber remains fixed');
    assert.ok(head.min.x >= housing.min.x - 1e-6 && head.max.x <= housing.max.x + 1e-6, 'piston head stays inside the actual chamber length');
    const headRadii = vertices(model.pistonHead, model.releaseActuator).map(point => Math.hypot(point.y, point.z));
    const guideRadii = vertices(model.guideSleeve, model.releaseActuator).map(point => Math.hypot(point.y, point.z));
    assert.ok(Math.min(...headRadii) > Math.max(...guideRadii) + 1e-4, 'stationary guide passes through the piston head bore without contact');
  }
}));
