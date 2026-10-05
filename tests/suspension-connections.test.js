import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SuspensionModel } from '../src/models/suspension-model.js';
import { SuspensionSimulation, SUSPENSION_TYPES } from '../src/suspension.js';

const vector = (x, y, z) => new THREE.Vector3(x, y, z);
const close = (a, b, message, tolerance = 1e-6) => assert.ok(a.distanceTo(b) < tolerance, `${message}: gap ${a.distanceTo(b)}`);
const ends = mesh => [-0.5, 0.5].map(y => mesh.localToWorld(vector(0, y, 0)));
const centre = mesh => mesh.getWorldPosition(vector(0, 0, 0));
const nearest = (point, targets) => Math.min(...targets.map(target => point.distanceTo(target)));
const fixture = callback => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(name => [name, new THREE.MeshStandardMaterial()]));
  const model = new SuspensionModel(materials);
  try { callback(model, new SuspensionSimulation()); }
  finally { model.dispose(); Object.values(materials).forEach(material => material.dispose()); }
};

test('five layouts keep actual guidance, damper eyes and wheel hubs attached during unequal bumps', () => {
  fixture((model, state) => {
    for (const type of Object.keys(SUSPENSION_TYPES)) {
      state.setType(type); state.setRoad('split'); state.setAmplitude(0.15);
      for (let frame = 0; frame < 160; frame++) {
        state.update(0.015); model.update({ suspension: state }); model.group.updateWorldMatrix(true, true);
        for (const corner of model.corners) {
          const mountedPins = corner.bodyPins.filter(pin => pin.visible).map(centre);
          const uprightTabs = corner.tabs.filter(tab => tab.visible).flatMap(ends);
          for (const { mesh, pins, role } of corner.connections) {
            const endpoints = ends(mesh);
            close(endpoints[0], centre(pins[0]), `${type} ${role} inner eye`);
            close(endpoints[1], centre(pins[1]), `${type} ${role} outer eye`);
            if (role === 'guidance') {
              assert.ok(nearest(endpoints[0], mountedPins) < 1e-6, `${type} body-side guidance boss`);
              assert.ok(nearest(endpoints[1], [...mountedPins, ...uprightTabs]) < 1e-6, `${type} upright guidance boss`);
            }
          }
          corner.damper.eyes.forEach((eye, index) => close(centre(eye), corner.damperEnds[index], `${type} damper eye ${index}`));
          const barrel = new THREE.Box3().setFromObject(corner.damper.tube), pistonRod = new THREE.Box3().setFromObject(corner.damper.rod);
          assert.ok(barrel.intersectsBox(pistonRod), `${type} piston rod remains inside its barrel`);
          if (type !== 'leaf') {
            const hubEnds = ends(corner.hub);
            close(hubEnds[1], centre(corner.wheel), `${type} hub meets wheel centre`);
            assert.ok(new THREE.Box3().setFromObject(corner.upright).containsPoint(hubEnds[0]), `${type} hub joins knuckle`);
            close(corner.coil.localToWorld(vector(0, 0, 0)), corner.springEnds[0], `${type} lower spring seat`);
            close(corner.coil.localToWorld(vector(0, 1, 0)), corner.springEnds[1], `${type} upper spring seat`);
          }
          assert.ok([...model.bounds().min.toArray(), ...model.bounds().max.toArray()].every(Number.isFinite));
        }
      }
    }
  });
});

test('push and pull linkages have rigid rocker triangles, constant rods and shorten springs on bump', () => {
  fixture((model, state) => {
    for (const type of ['pushrod', 'pullrod']) {
      state.setType(type); const restHeight = state.wheels[1].height;
      let previousAngle, previousCoil, rockerLengths;
      for (let step = 0; step <= 80; step++) {
        const travel = -0.2 + step * 0.005;
        state.wheels[1].height = restHeight + travel; state.wheels[1].travel = travel;
        model.update({ suspension: state }); model.group.updateWorldMatrix(true, true);
        const corner = model.corners[1], pinPositions = corner.rockerPins.map(centre);
        assert.equal(corner.kinematicLimit, false, `${type} reachable travel ${travel}`);
        assert.ok(Math.abs(corner.pushpull.scale.y - corner.actuationRodLength) < 1e-6, `${type} rigid actuation rod`);
        const lengths = [pinPositions[0].distanceTo(pinPositions[1]), pinPositions[0].distanceTo(pinPositions[2]), pinPositions[1].distanceTo(pinPositions[2])];
        rockerLengths ??= lengths;
        lengths.forEach((length, index) => assert.ok(Math.abs(length - rockerLengths[index]) < 1e-6, `${type} rigid rocker arm`));
        const coilLength = corner.coil.scale.y;
        if (previousAngle !== undefined) {
          assert.ok(Math.abs(corner.rockerAngle - previousAngle) < 0.06, `${type} continuous rocker branch`);
          assert.ok(coilLength < previousCoil, `${type} spring compresses as wheel rises`);
        }
        previousAngle = corner.rockerAngle; previousCoil = coilLength;
        close(ends(corner.pushpull)[1], pinPositions[1], `${type} rod joins rocker pin`);
        close(centre(corner.damper.eyes[0]), pinPositions[2], `${type} coilover joins other rocker pin`);
        close(centre(corner.pivot), pinPositions[0], `${type} rocker stays on its shaft`);
      }
    }
  });
});

test('actuation rods close across bounded roll poses and extreme supported road controls', () => {
  fixture((model, state) => {
    for (const type of ['pushrod', 'pullrod']) {
      state.setType(type);
      for (const roll of [-0.25, 0, 0.25]) for (const side of [0, 1]) {
        state.roll = roll; let previousCoil;
        for (let step = 0; step <= 90; step++) {
          const travel = -0.23 + step * 0.005, sign = side ? 1 : -1;
          state.wheels[side].height = state.staticWheelHeight + sign * state.trackHalf * Math.sin(roll) + travel;
          model.update({ suspension: state });
          const corner = model.corners[side];
          assert.equal(corner.kinematicLimit, false, `${type} roll ${roll} travel ${travel} closes`);
          assert.ok(Math.abs(corner.pushpull.scale.y - corner.actuationRodLength) < 1e-6, `${type} bounded-pose rod stays rigid`);
          if (previousCoil !== undefined) assert.ok(corner.coil.scale.y < previousCoil, `${type} spring shortens on a rolling chassis`);
          previousCoil = corner.coil.scale.y;
        }
      }
      for (const road of ['bumps', 'holes', 'waves', 'split']) for (const spring of [0.4, 2.5]) for (const damping of [0, 3]) {
        state.setRoad(road); state.setSpeed(60); state.setAmplitude(0.15); state.setSpring(spring); state.setDamping(damping);
        for (let frame = 0; frame < 800; frame++) {
          state.update(0.015);
          if (frame % 6) continue;
          model.update({ suspension: state });
          for (const corner of model.corners) {
            assert.equal(corner.kinematicLimit, false, `${type}/${road}/${spring}/${damping} reachable dynamics`);
            assert.ok(Math.abs(corner.pushpull.scale.y - corner.actuationRodLength) < 1e-6, `${type}/${road} actual rod is rigid`);
          }
        }
      }
    }
  });
});

test('leaf eyes, chassis hangers and clamp bridges remain joined under body and axle roll', () => {
  fixture((model, state) => {
    state.setType('leaf'); state.setRoad('split'); state.setAmplitude(0.15);
    let rollSeen = false;
    for (let frame = 0; frame < 140; frame++) {
      state.update(0.015); model.update({ suspension: state }); model.group.updateWorldMatrix(true, true);
      rollSeen ||= Math.abs(state.roll) > 0.01;
      for (const corner of model.corners) {
        const leaf = corner.leaf, positions = leaf.layers[0].geometry.attributes.position;
        for (const [index, vertex] of [[0, 0], [1, 48]]) {
          const midpoint = vector((positions.getX(vertex) + positions.getX(vertex + 1)) / 2,
            (positions.getY(vertex) + positions.getY(vertex + 1)) / 2, (positions.getZ(vertex) + positions.getZ(vertex + 1)) / 2);
          close(midpoint, centre(leaf.eyes[index]), 'leaf main blade enters its end eye', 1e-5);
        }
        close(ends(leaf.hangers[0])[1], model.body.localToWorld(vector(-0.62 * 4, -0.45 * 4, corner.sign * 0.72 * 4)), 'front hanger attaches to rolled sill');
        close(ends(leaf.shackle)[1], model.body.localToWorld(vector(0.62 * 4, -0.45 * 4, corner.sign * 0.72 * 4)), 'rear shackle attaches to rolled sill');
        for (let i = 0; i < 2; i++) {
          const bridgeEnds = ends(leaf.clampBridges[i]);
          close(bridgeEnds[0], ends(leaf.clamps[i * 2])[1], 'U-bolt first leg joins its bridge');
          close(bridgeEnds[1], ends(leaf.clamps[i * 2 + 1])[1], 'U-bolt second leg joins its bridge');
        }
      }
    }
    assert.ok(rollSeen);
  });
});

test('suspension context is transparent and click-through, sections and concise anchors restore', () => {
  fixture((model, state) => {
    const anchors = model.anchors.map(({ anchor }) => anchor);
    for (const type of Object.keys(SUSPENSION_TYPES)) {
      state.setType(type); model.update({ suspension: state });
      for (const section of ['suspensionLinks', 'suspensionSpring', 'suspensionDamper', 'suspensionRocker']) {
        model.setSection(section, true); assert.ok(!model.bounds(section).isEmpty());
        assert.ok(model.corners[1].mounts.visible, 'isolation retains local attachment brackets');
      }
      model.setSection('all'); model.update({ suspension: state });
      assert.deepEqual(model.anchors.map(({ anchor }) => anchor), anchors);
      assert.ok(model.bodyShell.every(mesh => mesh.visible));
      assert.equal(model.axleBeam.visible, type === 'leaf', 'independent layouts have no rigid axle beam');
      model.anchors.filter(data => ['suspensionWheel', 'suspensionRoad'].includes(data.part)).forEach(data => assert.equal(data.anchor.userData.labelHidden, true));
      for (const mesh of model.bodyShell) if (mesh.isMesh && mesh.material.transparent) assert.ok(mesh.userData.ignorePick);
    }
  });
});

test('overview camera bounds fit nearby road while keeping the long road geometry intact', () => {
  fixture((model, state) => {
    model.update({ suspension: state });
    const bounds = model.bounds('all');
    assert.ok(bounds.min.x > -5 && bounds.max.x < 5, 'long road does not force a distant overview');
    for (const { mesh } of model.roads) {
      mesh.geometry.computeBoundingBox();
      assert.ok(mesh.geometry.boundingBox.min.x <= -8 && mesh.geometry.boundingBox.max.x >= 8, 'moving road remains complete');
    }
  });
});
