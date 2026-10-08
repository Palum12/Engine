import * as THREE from 'three';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { EngineModel } from '../src/models/engine-model.js';
import { SystemsModel } from '../src/models/systems-model.js';
import { SuspensionModel } from '../src/models/suspension-model.js';
import { Simulation } from '../src/simulation.js';

// Operation counts are portable regression evidence. CPU timings describe only
// this runtime, not browser/GPU completion or laptop frame rate.
const palette = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(key => [key, new THREE.MeshStandardMaterial()]));
const counts = { matrixCompositions: 0, instanceWrites: 0, normalRebuilds: 0 };
const originals = [];
for (const [owner, key, counter] of [[THREE.Object3D.prototype, 'updateMatrix', 'matrixCompositions'],
  [THREE.InstancedMesh.prototype, 'setMatrixAt', 'instanceWrites'], [THREE.BufferGeometry.prototype, 'computeVertexNormals', 'normalRebuilds']]) {
  const original = owner[key]; originals.push(() => { owner[key] = original; });
  owner[key] = function(...args) { counts[counter]++; return original.apply(this, args); };
}
const results = [];
function measure(name, update) {
  for (let i = 0; i < 300; i++) update(i);
  for (const key of Object.keys(counts)) counts[key] = 0;
  const times = [];
  for (let i = 0; i < 600; i++) { const start = performance.now(); update(i); times.push(performance.now() - start); }
  times.sort((a, b) => a - b);
  results.push({ name, medianMs: times[299], p95Ms: times[569], perFrame: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value / 600])) });
}
try {
  for (const id of ['r3', 'r4', 'w16']) {
    const sim = new Simulation(); sim.setEngine(id); sim.running = true;
    const engine = new EngineModel(palette, id), systems = new SystemsModel(palette, engine);
    try {
      for (const [name, view, head] of [['all', 'engine', false], ['one-cylinder', 'cylinder', false], ['head', 'engine', true], ['idle', 'engine', false]]) {
        engine.setView(view, 0); if (head) engine.setHeadView(true); sim.running = name !== 'idle';
        measure(`${id}-${name}`, i => { sim.angle = i * .6 % 720; engine.update(sim, true); });
        measure(`${id}-${name}-scene-matrices`, i => {
          sim.angle = i * .6 % 720; engine.update(sim, true, false);
          engine.group.traverseVisible(object => object.updateWorldMatrix(false, false, true));
        });
      }
      for (const view of ['timing', 'oil', 'fuel']) {
        systems.setView(view, 'all', false);
        measure(`${id}-systems-${view}`, i => { sim.angle = i * .6 % 720; systems.update(sim); });
      }
    } finally { systems.dispose(); engine.dispose(); }
  }
  const sim = new Simulation(), suspension = new SuspensionModel(palette);
  try { measure('suspension-paused', () => suspension.update(sim)); } finally { suspension.dispose(); }
  const output = 'artifacts/performance/models.json'; mkdirSync('artifacts/performance', { recursive: true });
  writeFileSync(output, JSON.stringify(results, null, 2) + '\n');
  console.log(`Saved ${results.length} measurements to ${output}`);
} finally { originals.forEach(restore => restore()); Object.values(palette).forEach(material => material.dispose()); }
