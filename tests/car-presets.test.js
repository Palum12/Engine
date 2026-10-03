import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_PRESETS, getCarPreset } from '../src/car-presets.js';
import { ENGINES } from '../src/engines.js';
import { applyCarPreset } from '../src/car-configuration.js';
import { Simulation } from '../src/simulation.js';

test('every named car preset selects an available, compatible educational configuration', () => {
  assert.ok(CAR_PRESETS.length >= 10);
  assert.equal(new Set(CAR_PRESETS.map(preset => preset.id)).size, CAR_PRESETS.length);
  for (const preset of CAR_PRESETS) {
    assert.ok(ENGINES[preset.engineId], preset.id);
    assert.ok(ENGINES[preset.engineId].mountOrientations.includes(preset.engineOrientation), preset.id);
    assert.ok(['front', 'mid', 'rear'].includes(preset.enginePlacement), preset.id);
    assert.ok(['manual', 'dct', 'automatic', 'hybrid'].includes(preset.transmission), preset.id);
    assert.ok(['fwd', 'rwd', 'awd', 'quattro', 'partTime'].includes(preset.driveLayout), preset.id);
    assert.ok(['mpi', 'gdi', 'carb'].includes(preset.injection), preset.id);
    assert.ok(['belt', 'chain'].includes(preset.timing), preset.id);
    assert.equal(typeof preset.turbo, 'boolean');
    assert.ok(preset.year >= 2000 && preset.variant && preset.factoryTransmission && preset.summary && preset.note, preset.id);
    assert.ok(preset.sources.length > 0, preset.id);
    preset.sources.forEach(reference => {
      assert.equal(new URL(reference.url).protocol, 'https:');
      assert.ok(reference.title);
    });
  }
});

test('Corolla, A4, 911 and Veyron retain their distinct powertrain architectures', () => {
  const corolla = getCarPreset('corolla-hybrid-2025');
  assert.equal(corolla.engineId, 'r4');
  assert.equal(corolla.engineOrientation, 'transverse');
  assert.equal(corolla.transmission, 'hybrid');
  assert.equal(corolla.driveLayout, 'fwd');
  assert.equal(corolla.factoryGears, null);
  assert.equal(corolla.turbo, false);

  const a4 = getCarPreset('a4-quattro-2011');
  assert.equal(a4.engineOrientation, 'longitudinal');
  assert.equal(a4.driveLayout, 'quattro');
  assert.match(a4.note, /40:60/);

  const porsche = getCarPreset('911-carrera-s-2025');
  assert.equal(porsche.engineId, 'boxer6');
  assert.equal(porsche.enginePlacement, 'rear');
  assert.equal(porsche.engineOrientation, 'longitudinal');
  assert.equal(porsche.driveLayout, 'rwd');
  assert.equal(porsche.transmission, 'dct');

  const bugatti = getCarPreset('veyron-2005');
  assert.equal(bugatti.engineId, 'w16');
  assert.equal(bugatti.enginePlacement, 'mid');
  assert.equal(bugatti.driveLayout, 'awd');
  assert.equal(bugatti.transmission, 'dct');
  assert.equal(bugatti.turbo, true);
});

test('presets include transverse FWD and longitudinal RWD torque-converter automatics', () => {
  const fwd = getCarPreset('508-eat8-2018');
  assert.equal(fwd.engineOrientation, 'transverse');
  assert.equal(fwd.driveLayout, 'fwd');
  assert.equal(fwd.transmission, 'automatic');
  assert.equal(fwd.factoryGears, 8);
  assert.match(fwd.factoryTransmission, /Aisin/);
  const rwd = getCarPreset('330i-2019');
  assert.equal(rwd.engineOrientation, 'longitudinal');
  assert.equal(rwd.driveLayout, 'rwd');
  assert.equal(rwd.transmission, 'automatic');
  assert.match(rwd.factoryTransmission, /ZF/);
});

test('presets disclose factory gear counts that differ from shared educational models', () => {
  for (const preset of CAR_PRESETS) {
    if (preset.transmission === 'manual' && preset.factoryGears !== 5) assert.match(preset.note, /5-biegowej/);
    if (preset.transmission === 'dct') assert.match(preset.note, /6-biegowego/);
  }
  assert.equal(getCarPreset('not-a-car'), null);
});

const dirtyState = transmission => {
  const sim = new Simulation();
  sim.setTransmission(transmission);
  if (transmission !== 'hybrid') {
    sim.setEngine('w16');
    sim.setEnginePlacement('mid');
    sim.setDriveLayout('awd');
  }
  Object.assign(sim, {
    speed: 26, rpm: 4300, throttle: 0.75, brake: 0.4, clutch: 0.7, gear: 3,
    shiftTarget: 4, shiftFrom: 3, shiftProgress: 0.6, boost: 0.7,
    torque: 150, transmittedTorque: 120, stalled: true, running: false,
    paused: true, animationScale: 0.08, centerLock: true, frontLock: true, rearLock: true
  });
  sim.surfaces = ['ice', 'snow', 'mud', 'ice'];
  sim.wheelSlip.fill(0.5);
  sim.dct.engagement = [0.3, 0.7];
  sim.dct.torques = [80, 120];
  sim.hybrid.soc = 0.2;
  sim.hybrid.range = 'P';
  sim.automatic.lockup = 1;
  sim.automatic.range = 'D';
  sim.automatic.turbineOmega = 340;
  return sim;
};

test('every preset resets moving and shifting states across all transmission types', () => {
  const fields = ['engineId', 'engineOrientation', 'enginePlacement', 'transmission', 'driveLayout', 'turbo', 'injection', 'timing'];
  for (const startingTransmission of ['manual', 'dct', 'automatic', 'hybrid']) {
    for (const preset of CAR_PRESETS) {
      const sim = dirtyState(startingTransmission);
      assert.equal(applyCarPreset(sim, preset.id), true, `${startingTransmission} -> ${preset.id}`);
      for (const field of fields) assert.equal(sim[field], preset[field], `${preset.id}: ${field}`);
      assert.equal(sim.speed, 0);
      assert.equal(sim.gear, 0);
      assert.equal(sim.shiftTarget, null);
      assert.equal(sim.shiftFrom, 0);
      assert.equal(sim.shiftProgress, 0);
      assert.equal(sim.throttle, 0);
      assert.equal(sim.brake, 0);
      assert.equal(sim.clutch, 0);
      assert.equal(sim.boost, 0);
      assert.equal(sim.torque, 0);
      assert.equal(sim.transmittedTorque, 0);
      assert.equal(sim.stalled, false);
      assert.equal(sim.paused, true);
      assert.equal(sim.animationScale, 0.08);
      assert.equal(sim.running, preset.transmission !== 'hybrid');
      assert.equal(sim.centerLock, false);
      assert.equal(sim.frontLock, false);
      assert.equal(sim.rearLock, false);
      assert.deepEqual(sim.surfaces, ['asphalt', 'asphalt', 'asphalt', 'asphalt']);
      assert.deepEqual(sim.wheelSlip, [0, 0, 0, 0]);
      assert.deepEqual(sim.dct.engagement, [0, 0]);
      assert.deepEqual(sim.dct.torques, [0, 0]);
      assert.equal(sim.dct.automatic, preset.transmission === 'dct');
      assert.equal(sim.automatic.lockup, 0);
      assert.equal(sim.automatic.range, 'N');
      assert.equal(sim.automatic.turbineOmega, 0);
      assert.equal(sim.hybrid.range, 'D');
      assert.ok(sim.hybrid.soc > 0.2);
      assert.equal(sim.driveMode, preset.driveLayout === 'partTime' ? '2H' : '4H');
      assert.ok(sim.traction.wheels.every(wheel => Number.isFinite(wheel.omega)));
    }
  }
});

test('unknown car preset leaves the active simulation untouched', () => {
  const sim = dirtyState('automatic');
  const before = JSON.stringify(sim);
  assert.equal(applyCarPreset(sim, 'missing-car'), false);
  assert.equal(JSON.stringify(sim), before);
});

test('Ibiza 1.0 MPI 2016 selects three cylinders, belt timing, a manual and open front axle', () => {
  const sim = dirtyState('automatic');
  Object.assign(sim, { clutchCapacity: 10, clutchForce: 200, clutchClamp: 0.1, slipPower: 12000 });
  assert.equal(applyCarPreset(sim, 'ibiza-mpi-2016'), true);
  assert.equal(ENGINES[sim.engineId].cylinders, 3);
  assert.equal(sim.enginePlacement, 'front');
  assert.equal(sim.engineOrientation, 'transverse');
  assert.equal(sim.driveLayout, 'fwd');
  assert.equal(sim.transmission, 'manual');
  assert.equal(sim.injection, 'mpi');
  assert.equal(sim.timing, 'belt');
  assert.equal(sim.turbo, false);
  assert.equal(sim.frontLock, false);
  assert.equal(sim.clutchClamp, 1);
  assert.ok(sim.clutchCapacity > ENGINES.r3.torque);
  assert.equal(sim.slipPower, 0);
});

test('changing the engine while paused clears stale torque without changing the mounting or selected gear', () => {
  const sim = new Simulation();
  sim.setEngine('v12'); sim.gear = 1; sim.rpm = 3000; sim.integrate(0.002);
  assert.ok(sim.transmittedTorque > ENGINES.r3.torque);
  sim.paused = true;
  sim.setEngine('r3');
  assert.equal(sim.transmittedTorque, 0);
  assert.equal(sim.torque, 0);
  assert.equal(sim.slipPower, 0);
  assert.equal(sim.gear, 1);
  assert.equal(sim.engineOrientation, 'longitudinal');
  assert.equal(sim.paused, true);
});
