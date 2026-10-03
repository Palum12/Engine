import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ENGINES } from '../src/engines.js';
import { Simulation } from '../src/simulation.js';
import { EngineModel } from '../src/models/engine-model.js';
import { SystemsModel } from '../src/models/systems-model.js';

const palette = () => Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white']
  .map(name => [name, new THREE.MeshStandardMaterial()]));

function fixture(id, run) {
  const materials = palette(), engine = new EngineModel(materials, id), systems = new SystemsModel(materials, engine);
  const sim = new Simulation(); sim.setEngine(id);
  try { run(engine, systems, sim); }
  finally { systems.dispose(); engine.dispose(); Object.values(materials).forEach(material => material.dispose()); }
}

for (const id of Object.keys(ENGINES)) test(`${id}: timing-wheel connections meet the actual camshaft ends through mounting and rotation`, () => {
  fixture(id, (engine, systems, sim) => {
    const mounted = new THREE.Group(); mounted.add(engine.group, systems.group);
    mounted.position.set(4, 1, -3); mounted.rotation.set(0.13, -Math.PI / 2, -0.08); mounted.scale.setScalar(0.38);
    const connections = systems.timingWheels.filter(wheel => wheel.shaft);
    assert.equal(connections.length, engine.camshafts.length);
    for (const angle of [0, 137, 580]) {
      sim.angle = angle; engine.update(sim, true); systems.update(sim); mounted.updateMatrixWorld(true);
      for (const { shaft, connector, attachment, wheel } of connections) {
        assert.ok(connector, 'every cam wheel is joined by a visible shaft extension');
        const endpoint = shaft.userData.shaftEndpoints[attachment.x < 0 ? 0 : 1];
        const camEnd = shaft.localToWorld(new THREE.Vector3(...endpoint));
        const length = connector.geometry.parameters.height;
        const ends = [-length / 2, length / 2].map(y => connector.localToWorld(new THREE.Vector3(0, y, 0)));
        assert.ok(Math.min(...ends.map(end => end.distanceTo(camEnd))) < 1e-7, 'connector ends at the camshaft metal');
        const wheelCenter = wheel.getWorldPosition(new THREE.Vector3());
        assert.ok(Math.min(...ends.map(end => end.distanceTo(wheelCenter))) < 1e-7, 'other end enters the wheel hub');
        // Validate endpoint metadata against the actual cylinder mesh rather than
        // relying on a second copy of the configured shaft-length constant.
        const body = shaft.userData.shaftBody;
        const actualEnd = body.localToWorld(new THREE.Vector3(0, attachment.x < 0 ? body.geometry.parameters.height / 2 : -body.geometry.parameters.height / 2, 0));
        assert.ok(actualEnd.distanceTo(camEnd) < 1e-7);
      }
    }
  });
});

for (const id of ['r3', 'vr6', 'w16', 'boxer6']) test(`${id}: continuous head casting survives cutaway, isolation and return to a cylinder`, () => {
  fixture(id, (engine, _systems, sim) => {
    assert.equal(engine.headCastings.length, engine.config.headAngles.length);
    assert.notEqual(engine.headAlloy, engine.materials.block);
    const overview = engine.anchors.filter(data => data.part === 'cylinderHead' && data.anchor.userData.overview);
    assert.equal(overview.length, 1);
    assert.match(overview[0].text, /Głowica/);
    engine.setView('engine', 0); engine.setHeadView(true); engine.update(sim, true);
    for (const casting of engine.headCastings) {
      assert.ok(casting.rear.visible && casting.rim.visible);
      assert.equal(casting.front.visible, false);
      const rearBounds = new THREE.Box3().setFromObject(casting.rear);
      for (const c of casting.cylinders) {
        const chamber = c.unit.localToWorld(new THREE.Vector3(0, 4.64, 0));
        assert.ok(chamber.x > rearBounds.min.x && chamber.x < rearBounds.max.x, 'one casting spans all chambers');
        assert.ok(c.valves.every(valve => valve.visible));
        assert.ok(c.headCasting.panels.every(panel => !panel.visible));
      }
    }
    const bounds = engine.bounds('cylinderHead');
    assert.ok([...bounds.min, ...bounds.max].every(Number.isFinite) && !bounds.isEmpty());
    engine.update(sim, false);
    assert.ok(engine.headCastings.every(casting => casting.front.visible));
    engine.setView('cylinder', 0); engine.update(sim, false);
    assert.ok(engine.heads.every(head => !head.visible));
    assert.ok(engine.cylinders[0].headCasting.front.visible);
    assert.ok(engine.cylinders[0].headCasting.panels.every(panel => panel.visible));
    engine.setView('engine', 0); engine.update(sim, true);
    assert.ok(engine.heads.every(head => head.visible));
    assert.ok(engine.cylinders.every(c => c.piston.visible && c.blockSupports.visible));
  });
});
