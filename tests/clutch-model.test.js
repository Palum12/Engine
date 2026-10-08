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
  assert.ok(model.fingers.every(({ finger }) => finger.visible));
  assert.ok(model.diaphragmWeb.visible);
}));

const vertices = mesh => {
  const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const start = mesh.geometry.drawRange.start, end = Math.min(index?.count ?? position.count, start + mesh.geometry.drawRange.count);
  return Array.from({ length: end - start }, (_, n) => {
    const i = index ? index.getX(start + n) : start + n;
    return mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(position, i));
  });
};
const endpoint = (mesh, along) => mesh.localToWorld(new THREE.Vector3(0, along, 0));

test('both fulcrum faces have actual cover supports and the continuous spring web reaches the pressure back face', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.3, 0.72, 0.9, 1]) for (const phase of [0, 27, 89, 173, 281]) {
    sim.clutch = pedal; sim.angle = phase; model.update(sim, false);
    model.coverSupports.forEach((rib, index) => {
      const inner = model.fulcrumRings[index % 2].worldToLocal(endpoint(rib, -0.5));
      near(inner.x, 0); assert.ok(Math.hypot(inner.y, inner.z) > 0.771 && Math.hypot(inner.y, inner.z) < 0.809);
      const outer = model.coverRing.worldToLocal(endpoint(rib, 0.5));
      near(outer.x, 0); assert.ok(Math.hypot(outer.y, outer.z) > 1.11 && Math.hypot(outer.y, outer.z) < 1.24);
    });
    const web = vertices(model.diaphragmWeb).map(point => model.pressure.worldToLocal(point));
    const edge = web.filter(point => Math.hypot(point.y, point.z) > 0.985);
    assert.ok(edge.length > 0);
    assert.ok(Math.min(...edge.map(point => point.x)) < 0.06 && Math.max(...edge.map(point => point.x)) > 0.06, 'continuous outer spring rim contacts the back face, rather than ending in air');
    web.forEach(point => assert.ok(Math.hypot(point.y, point.z) < 1.11, 'spring remains inside the cover bore'));
  }
}));

test('damper coils sit between real end seats joined to the hub and lining carrier, clear of both friction faces', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.5, 1]) for (const phase of [0, 0.7, 2.1]) {
    sim.clutch = pedal; sim.inputAngle = phase; model.update(sim, false);
    model.damperWindows.forEach(({ window, coil, seats, webs }) => {
      const points = vertices(coil).map(point => window.worldToLocal(point));
      points.forEach(point => {
        assert.ok(Math.hypot(point.y, point.z) < 0.62, 'coil clears the inner bore of the pressure plate');
        assert.ok(point.x + model.disc.position.x > 0.1525, 'coil never enters the flywheel friction face');
      });
      [-1, 1].forEach((side, index) => {
        const tip = coil.localToWorld(new THREE.Vector3(0, side * 0.17, 0.055));
        const seat = seats[index].worldToLocal(tip);
        assert.ok(Math.abs(seat.x) <= 0.075 && Math.abs(seat.y) <= 0.09 && Math.abs(seat.z) <= 0.020001, 'coil end sits on its solid spring seat');
        const inner = model.hubFlange.worldToLocal(endpoint(webs[index], -0.5));
        assert.ok(Math.abs(inner.x) < 0.035 && Math.hypot(inner.y, inner.z) > 0.24 && Math.hypot(inner.y, inner.z) < 0.34);
        const outer = model.discCarrier.worldToLocal(endpoint(webs[index], 0.5));
        assert.ok(Math.abs(outer.x) < 0.0275 && Math.hypot(outer.y, outer.z) > 0.64 && Math.hypot(outer.y, outer.z) < 0.77);
        const mount = webs[index].worldToLocal(seats[index].getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(mount.x) < 0.0275 && Math.abs(mount.y) < 0.5 && Math.abs(mount.z) < 0.0375, 'solid seat center lies inside its actual supporting web');
      });
    });
  }
}));

test('real inward hub teeth interleave the shaft splines and splines stop before the stationary guide', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.8, 1]) for (const phase of [0, 0.33, 1.8]) {
    sim.clutch = pedal; sim.inputAngle = phase; model.update(sim, false);
    const spline = model.inputSplines.children[0], tooth = model.hubTeeth[0];
    const splinePoints = vertices(spline).map(point => model.clutch.worldToLocal(point));
    const toothPoints = vertices(tooth).map(point => model.clutch.worldToLocal(point));
    const splineMax = Math.max(...splinePoints.map(point => Math.hypot(point.y, point.z)));
    const hubMin = Math.min(...toothPoints.map(point => Math.hypot(point.y, point.z)));
    assert.ok(splineMax > hubMin, 'radial tooth envelopes overlap to transmit torque');
    near(new THREE.Vector3(0, spline.position.y, spline.position.z).angleTo(new THREE.Vector3(0, tooth.position.y, tooth.position.z)), Math.PI / 20);
    assert.ok(bounds(model.inputSplines).max.x < bounds(model.guideSleeve).min.x, 'spline tips must not cut into the stationary guide bore');
    assert.ok(bounds(model.inputSplines).max.x > bounds(model.discHub).max.x, 'released disc hub remains on the splined section');
  }
}));

test('fixed cutaway clips real strip and coil corners at its planes over independent shaft phases', () => fixture((model, sim) => {
  model.setView('clutch');
  for (const pedal of [0, 0.5, 1]) for (const phase of [0, 0.13, 0.47, 1.1, 2.4, 3.7, 5.8]) {
    sim.clutch = pedal; sim.angle = phase * 180 / Math.PI; sim.inputAngle = phase * 0.7;
    model.update(sim, true);
    [...model.clutchRotatingDetails.map(({ object }) => object), ...model.straps.flatMap(({ segments }) => segments)].forEach(mesh => {
      if (!mesh.visible) return;
      vertices(mesh).forEach(point => {
        model.clutch.worldToLocal(point);
        const first = -Math.sin(2) * point.y + Math.cos(2) * point.z;
        const second = Math.sin(Math.PI * 2 - 0.35) * point.y - Math.cos(Math.PI * 2 - 0.35) * point.z;
        assert.ok(first >= -1e-6 || second >= -1e-6, `${mesh.userData.part} protrudes beyond the actual section plane`);
      });
    });
  }
  const references = model.clutchRotatingDetails.map(({ object }) => object.userData.clutchSection.clipped);
  model.update(sim, false); model.update(sim, true);
  model.clutchRotatingDetails.forEach(({ object }, index) => assert.equal(object.userData.clutchSection.clipped, references[index], 'section buffers are reused'));
}));

test('cutaway pose cache follows paused pedal and ancestor changes, reuses identical frames and keeps box cut faces closed', () => fixture((model, sim) => {
  model.setView('clutch'); sim.paused = true; sim.angle = 0.13 * 180 / Math.PI; sim.inputAngle = 0.13;
  model.update(sim, true);
  const finger = model.fingers.find(({ finger }) => finger.visible && finger.geometry === finger.userData.clutchSection.clipped).finger;
  const clip = finger.userData.clutchSection.clipped, originalVersion = clip.attributes.position.version;
  const initialTip = endpoint(finger, 0.5).x;
  model.update(sim, true);
  assert.equal(clip.attributes.position.version, originalVersion, 'identical paused frame does not rebuild/upload the cut geometry');
  model.update(sim, false); model.update(sim, true);
  assert.equal(finger.geometry, clip, 'same phase restores the cached section after closing the cover');
  assert.equal(clip.attributes.position.version, originalVersion);
  sim.clutch = 1; model.update(sim, true);
  assert.ok(endpoint(finger, 0.5).x < initialTip - 0.3, 'paused pedal still moves the spring tip');
  assert.ok(clip.attributes.position.version > originalVersion, 'pedal deformation invalidates the local pose cache');
  const before = model.damperWindows[0].coil.userData.clutchSection.relative.clone();
  model.damperWindows[0].window.rotation.x += 0.2;
  model.update(sim, true);
  assert.ok(!model.damperWindows[0].coil.userData.clutchSection.relative.equals(before), 'nested support pose invalidates its relative transform');
  const planes = [point => -Math.sin(2) * point.y + Math.cos(2) * point.z, point => Math.sin(Math.PI * 2 - 0.35) * point.y - Math.cos(Math.PI * 2 - 0.35) * point.z];
  let cutFaces = 0;
  model.clutchRotatingDetails.forEach(({ object }) => {
    if (!object.visible) return;
    const points = vertices(object).map(point => model.clutch.worldToLocal(point));
    points.forEach(point => assert.ok(planes[0](point) >= -1e-6 || planes[1](point) >= -1e-6));
    if (object.userData.clutchSection.full.type !== 'BoxGeometry' || object.geometry !== object.userData.clutchSection.clipped) return;
    let caps = 0;
    for (let n = 0; n + 2 < points.length; n += 3) {
      const triangle = points.slice(n, n + 3);
      if (planes.some(plane => triangle.every(point => Math.abs(plane(point)) < 1e-6))) {
        const area = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).length();
        if (area > 1e-9) caps++;
      }
    }
    assert.ok(caps > 0, 'a clipped solid box retains a real closing face on its section plane');
    cutFaces += caps;
  });
  assert.ok(cutFaces > 0);
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
