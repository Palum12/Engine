import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ModelGeometry } from '../src/models/geometry.js';
import { EngineModel } from '../src/models/engine-model.js';
import { SystemsModel } from '../src/models/systems-model.js';
import { SuspensionModel } from '../src/models/suspension-model.js';
import { TransferModel } from '../src/models/transfer-model.js';
import { Simulation } from '../src/simulation.js';

const palette = () => Object.fromEntries(['steel','dark','block','brass','black','intake','exhaust','fuel','white'].map(key => [key, new THREE.MeshStandardMaterial()]));
const particles = engine => engine.cylinders.flatMap(c => [c.charge, c.air, c.fuel, c.gas]);
const versions = meshes => meshes.map(mesh => mesh.instanceMatrix.version);

test('disposing a model releases its instanced buffers once, including detached instances, without disposing borrowed assemblies or palette', () => {
  const materials = palette(), owner = new ModelGeometry(materials), borrowed = new ModelGeometry(materials);
  const owned = owner.particles(3, 0xffffff, .02, owner.group);
  const detached = owner.arrows(2, 0xffffff, owner.group); detached.removeFromParent();
  const foreign = borrowed.particles(3, 0xffffff, .02, borrowed.group); owner.group.add(borrowed.group);
  const counts = [0,0,0,0];
  [owned, detached, foreign, materials.steel].forEach((object, i) => object.addEventListener('dispose', () => counts[i]++));
  try { owner.dispose(); owner.dispose(); assert.deepEqual(counts, [1,1,0,0]); }
  finally { borrowed.dispose(); Object.values(materials).forEach(m => m.dispose()); }
});

test('actual directly constructed timing and transfer instances release their resources', () => {
  const materials = palette(), engine = new EngineModel(materials), systems = new SystemsModel(materials, engine), transfer = new TransferModel(materials);
  let expected = 0, disposed = 0;
  for (const model of [engine, systems, transfer]) model.group.traverse(o => { if(o.isInstancedMesh) { expected++; o.addEventListener('dispose', () => disposed++); } });
  for (const model of [engine, systems, transfer]) model.dispose();
  assert.ok(expected > 16); assert.equal(disposed, expected);
  Object.values(materials).forEach(m => m.dispose());
});

test('single cylinder, isolated head and stopped engine avoid updating invisible particle buffers and restore the current phase when shown', () => {
  const materials = palette(), engine = new EngineModel(materials, 'w16'), sim = new Simulation();
  sim.setEngine('w16'); sim.running = true; sim.angle = 225;
  try {
    engine.setView('cylinder', 0);
    const before = versions(particles(engine)); engine.update(sim, true);
    const after = versions(particles(engine));
    assert.ok(after[0] > before[0]); assert.deepEqual(after.slice(4), before.slice(4));
    engine.setView('engine', 0); engine.setHeadView(true);
    const headBefore = versions(particles(engine)); sim.angle = 377; engine.update(sim, true);
    assert.deepEqual(versions(particles(engine)), headBefore);
    engine.setView('engine', 0); sim.running = false;
    const stopped = versions(particles(engine)); engine.update(sim, true);
    assert.deepEqual(versions(particles(engine)), stopped);
    sim.running = true; engine.update(sim, true);
    assert.ok(engine.cylinders[15].charge.instanceMatrix.version > stopped[60]);
    assert.ok(Math.abs(engine.cylinders[15].piston.position.y - engine.cylinders[0].piston.position.y) > .01);
  } finally { engine.dispose(); Object.values(materials).forEach(m => m.dispose()); }
});

test('oil and fuel inspections do not animate hidden timing links; returning to timing synchronizes them', () => {
  const materials = palette(), engine = new EngineModel(materials), systems = new SystemsModel(materials, engine), sim = new Simulation();
  try {
    const links = systems.timingLoops.map(loop => loop.links);
    for (const mode of ['oil','fuel']) { systems.setView(mode, 'all', false); const before = versions(links); sim.angle += 30; systems.update(sim); assert.deepEqual(versions(links), before); }
    systems.setView('timing', 'all', false); const before = versions(links); systems.update(sim);
    assert.ok(versions(links).every((v,i) => v > before[i]));
  } finally { systems.dispose(); engine.dispose(); Object.values(materials).forEach(m => m.dispose()); }
});

test('unchanged road geometry is reused while paused and invalidates on distance, amplitude and surface changes', () => {
  const materials = palette(), model = new SuspensionModel(materials), sim = new Simulation();
  try {
    model.update(sim); const meshes = model.roads.map(r => r.mesh);
    const version = () => meshes.map(mesh => mesh.geometry.attributes.position.version);
    const before = version(); model.update(sim); assert.deepEqual(version(), before);
    for(const change of [() => { sim.suspension.distance += .2; }, () => sim.suspension.setAmplitude(.13), () => sim.suspension.setRoad('split')]) {
      const old = version(); change(); model.update(sim); assert.ok(version().every((v,i) => v > old[i]));
    }
  } finally { model.dispose(); Object.values(materials).forEach(m => m.dispose()); }
});
