import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, crankPin, cylinderLayout } from '../src/engines.js';
import { Simulation, cycleDegrees, pistonHeight } from '../src/simulation.js';

for (const engine of Object.values(ENGINES)) {
  test(`${engine.name} has evenly spaced ignition events and a full cycle for every cylinder`, () => {
    const events = [];
    for (let angle = 0; angle < 720; angle++) {
      for (let cylinder = 0; cylinder < engine.cylinders; cylinder++) {
        if (cycleDegrees(angle, cylinder, engine.id) === 360) events.push(angle);
        assert.ok(Number.isFinite(pistonHeight(cycleDegrees(angle, cylinder, engine.id))));
      }
    }
    assert.equal(events.length, engine.cylinders);
    assert.equal(new Set(engine.firingOrder).size, engine.cylinders);
    events.forEach((angle, i) => assert.equal((events[(i + 1) % events.length] - angle + 720) % 720, engine.interval));
  });

  test(`${engine.name} connecting rods keep their length in both banks`, () => {
    for (let cylinder = 0; cylinder < engine.cylinders; cylinder++) {
      const layout = cylinderLayout(engine.id, cylinder);
      for (let angle = 0; angle < 720; angle += 7) {
        const localY = pistonHeight(cycleDegrees(angle, cylinder, engine.id)) - 0.8;
        const piston = { y: 0.8 + localY * Math.cos(layout.bankRadians), z: localY * Math.sin(layout.bankRadians) };
        const pin = crankPin(angle, engine.id, cylinder);
        assert.ok(Math.abs(Math.hypot(piston.y - pin.y, piston.z - pin.z) - 2) < 1e-9);
      }
    }
  });

  test(`${engine.name} idles stably and produces increasing torque under throttle`, () => {
    const sim = new Simulation();
    sim.setEngine(engine.id);
    for (let n = 0; n < 600; n++) sim.update(1 / 60);
    assert.ok(sim.running && sim.rpm > 850 && sim.rpm < 1000);
    sim.throttle = 0.4;
    for (let n = 0; n < 120; n++) sim.update(1 / 60);
    assert.ok(sim.rpm > 2000);
    assert.equal(sim.speed, 0);
  });
}

test('V12 bank pairs share crank-pin angles, while V6 uses split pins', () => {
  for (let i = 0; i < 12; i += 2) {
    const a = crankPin(37, 'v12', i);
    const b = crankPin(37, 'v12', i + 1);
    assert.ok(Math.hypot(a.y - b.y, a.z - b.z) < 1e-9);
  }
  for (let i = 0; i < 6; i += 2) {
    const a = crankPin(37, 'v6', i);
    const b = crankPin(37, 'v6', i + 1);
    assert.ok(Math.abs(Math.hypot(a.y - b.y, a.z - b.z) - 0.65) < 1e-9);
  }
});

test('unknown engine configurations do not change the active model', () => {
  const sim = new Simulation();
  sim.setEngine('v12');
  assert.equal(sim.setEngine('v99'), false);
  assert.equal(sim.engineId, 'v12');
});
