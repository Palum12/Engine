import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cycleVisuals, chargeSample } from '../src/cycle-visuals.js';
import { ENGINES, crankPin } from '../src/engines.js';
import { Simulation, pistonHeight } from '../src/simulation.js';
import { EngineModel } from '../src/models/engine-model.js';
import { SystemsModel } from '../src/models/systems-model.js';

const materials = () => Object.fromEntries(['steel','dark','block','brass','black','intake','exhaust','fuel','white'].map(name => [name, new THREE.MeshStandardMaterial()]));

test('gas, valve and flame envelopes are continuous across all four stroke boundaries and cycle wrap', () => {
  for (const angle of [0, 180, 360, 540, 720]) {
    const before = cycleVisuals(angle - 0.0001), after = cycleVisuals(angle + 0.0001);
    for (const key of ['intake','exhaust','injection','flame','heat','charge','spark']) assert.ok(Math.abs(before[key] - after[key]) < 0.0001, `${angle}: ${key}`);
    for (let n = 0; n < 64; n++) {
      const a = chargeSample(angle - 0.0001, n), b = chargeSample(angle + 0.0001, n);
      assert.ok(Math.abs(a.visibility - b.visibility) < 0.0001);
      if (a.visibility > 0.01 && b.visibility > 0.01) {
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z, a.level - b.level) < 0.0001);
        assert.ok(Math.abs(a.burned - b.burned) < 0.0001);
      }
    }
  }
});

test('the same charge is retained during compression and fuel burns progressively before exhaust', () => {
  for (let n = 0; n < 64; n++) {
    assert.equal(chargeSample(180,n).visibility, 1);
    assert.equal(chargeSample(300,n).visibility, 1);
    assert.equal(chargeSample(300,n).burned, 0);
    assert.equal(chargeSample(430,n).burned, 1);
  }
  assert.ok(cycleVisuals(378).flame > 0.9);
  assert.equal(cycleVisuals(500).flame, 0);
  assert.equal(cycleVisuals(630).flame, 0);
  assert.ok(cycleVisuals(630).exhaust > 0.9);
});

test('the flame front reaches charge near the spark before more distant charge', () => {
  const samples = Array.from({length:64}, (_,n) => chargeSample(370,n));
  const distance = p => Math.hypot(p.x,(1-p.level)*0.8,p.z-0.3);
  samples.sort((a,b)=>distance(a)-distance(b));
  assert.ok(samples[0].burned > samples.at(-1).burned);
});

test('opposed boxer pistons move together toward opposite heads on separate crankpins', () => {
  for (let a = 0; a < 720; a += 13) {
    for (let i = 0; i < 4; i += 2) {
      const left = crankPin(a, 'boxer4', i), right = crankPin(a, 'boxer4', i + 1);
      assert.ok(Math.abs(left.z + right.z) < 1e-9);
      assert.ok(Math.abs(left.y + right.y - 1.6) < 1e-9);
      assert.ok(Math.abs(Math.hypot(left.y - right.y, left.z - right.z) - 1.3) < 1e-9);
      assert.ok(Math.abs(pistonHeight(a + ENGINES.boxer4.offsets[i]) - pistonHeight(a + ENGINES.boxer4.offsets[i + 1])) < 1e-9);
    }
  }
});

for (const id of Object.keys(ENGINES)) test(`${id}: head layout, valve links, chain branches and visible gas stay coherent`, () => {
  const m = materials(), engine = new EngineModel(m,id), systems = new SystemsModel(m,engine), sim = new Simulation();
  sim.setEngine(id);
  const expected = { r4:[1,2,1], r6:[1,2,1], v6:[2,4,2], vr6:[1,2,2], v12:[2,4,2], w16:[2,4,3], boxer4:[2,4,2] }[id];
  assert.equal(engine.heads.length,expected[0]);
  assert.equal(engine.camshafts.length,expected[1]);
  assert.equal(systems.timingLoops.length,expected[2]);
  assert.equal(engine.rockers.length,engine.config.cylinders*4);
  assert.equal(new Set(engine.cylinders.map(c=>c.layout.bank)).size,engine.config.angles.length);
  for (const angle of [0,90,179.99,180,270,348,365,378,405,500,540,630,719.99]) {
    sim.angle = angle;
    engine.update(sim,true); systems.update(sim);
    for (const {wheel,speed} of systems.timingWheels) assert.ok(Math.abs(wheel.rotation.x - angle*Math.PI/180*speed)<1e-10);
    for (const c of engine.cylinders) {
      assert.equal(c.chamber.geometry.parameters.openEnded,true);
      for (let n=0;n<c.charge.count;n++) {
        const matrix = new THREE.Matrix4();c.charge.getMatrixAt(n,matrix);
        const position = new THREE.Vector3().setFromMatrixPosition(matrix);
        assert.ok(position.y > c.piston.position.y+0.25 && position.y < 4.18);
        assert.ok(Math.hypot(position.x,position.z) <= 0.45);
      }
      c.flames.children.forEach(plume=>assert.ok(plume.position.y - plume.scale.y/2 >= c.piston.position.y+0.25));
    }
  }
  systems.dispose();engine.dispose();Object.values(m).forEach(material=>material.dispose());
});
