import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation } from '../src/simulation.js';
import { AUTOMATIC_RATIOS, AUTOMATIC_PLANETARIES, AUTOMATIC_GEAR_MODES, evaluateTraction } from '../src/powertrain.js';
import { automaticPlanetarySpeeds, converterTransfer } from '../src/automatic.js';
import { AutomaticModel } from '../src/models/automatic-model.js';

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += 0.02) sim.update(Math.min(0.02, seconds - t)); };
const setup = () => { const sim = new Simulation(); sim.setTransmission('automatic'); return sim; };

test('eight planetary selections produce eight descending ratios and preserve every mesh relation', () => {
  assert.equal(AUTOMATIC_RATIOS.length, 9);
  assert.ok(AUTOMATIC_RATIOS[1] > 4 && AUTOMATIC_RATIOS[8] < 0.7);
  for (let gear = 1; gear <= 8; gear++) {
    if (gear > 1) assert.ok(AUTOMATIC_RATIOS[gear] < AUTOMATIC_RATIOS[gear - 1]);
    const stages = automaticPlanetarySpeeds(200, AUTOMATIC_GEAR_MODES[gear]);
    stages.forEach((members, i) => {
      const set = AUTOMATIC_PLANETARIES[i];
      near(set.sun * members.sun + set.ring * members.ring, (set.sun + set.ring) * members.carrier);
      near(members.planet, -(members.sun - members.carrier) * set.sun / set.planet);
    });
    near(stages[3].ring, 200 / AUTOMATIC_RATIOS[gear]);
  }
});

test('converter multiplies launch torque, freewheels near coupling and dissipates rather than creates energy', () => {
  for (const pump of [0, 50, 100, 300]) for (const turbine of [0, 30, 90, 300, 400]) for (const lockup of [0, 0.5, 1]) {
    const state = converterTransfer(pump, turbine, lockup);
    assert.ok(state.lossPower >= 0 && Number.isFinite(state.lossPower));
    assert.ok(state.pumpTorque * pump - state.turbineTorque * turbine >= -1e-8);
  }
  const stalled = converterTransfer(100, 0, 0);
  assert.equal(stalled.statorLocked, true);
  assert.ok(stalled.turbineTorque > stalled.pumpTorque * 2);
  const coupled = converterTransfer(100, 95, 0);
  assert.equal(coupled.statorLocked, false);
  near(coupled.torqueRatio, 1);
});

test('automatic neutral is stationary, drive creeps at idle and brakes stop it without stalling', () => {
  const sim = setup();
  run(sim, 3);
  near(sim.speed, 0);
  assert.ok(sim.rpm > 850 && sim.rpm < 1050);
  assert.equal(sim.shift(1), true);
  run(sim, 5);
  assert.ok(sim.speed > 0.3 && sim.speed < 3);
  assert.ok(sim.running && !sim.stalled);
  assert.ok(sim.automatic.turbineTorque > 0);
  sim.brake = 0.5;
  run(sim, 3);
  near(sim.speed, 0);
  assert.ok(sim.rpm > 850);
  assert.ok(sim.automatic.statorLocked && sim.automatic.lockup === 0);
});

test('automatic drives every ratio without clutch input, changes gears by itself and locks its converter', () => {
  const sim = setup();
  assert.equal(sim.shift(9), false);
  sim.shift(1);
  sim.throttle = 0.45;
  sim.clutch = 1; // An obsolete pedal value must not disconnect an automatic.
  run(sim, 24);
  assert.ok(sim.speed > 15 && sim.gear > 2);
  assert.ok(sim.automatic.lockup > 0.95 && sim.automatic.slipRpm < 70);
  const lockedSlip = sim.automatic.slipRpm;
  sim.throttle = 1;
  run(sim, 0.4);
  assert.ok(sim.automatic.lockup < 0.05);
  assert.ok(sim.automatic.slipRpm > lockedSlip);
  for (let gear = 1; gear <= 8; gear++) {
    const manual = setup(); manual.automatic.automatic = false;
    manual.speed = 10 + gear * 3;
    manual.traction = evaluateTraction(manual, 0);
    assert.equal(manual.shift(gear), true);
    run(manual, 1.3);
    assert.equal(manual.gear, gear);
    assert.ok(Number.isFinite(manual.rpm) && Number.isFinite(manual.speed));
  }
});

test('pause holds converter/planetary animation and changing transmission clears hydraulic state', () => {
  const sim = setup(); sim.shift(1); sim.throttle = 0.4; run(sim, 3);
  sim.paused = true;
  const before = JSON.stringify(sim);
  run(sim, 1);
  assert.equal(JSON.stringify(sim), before);
  sim.setTransmission('manual');
  near(sim.automatic.lockup, 0); near(sim.transmittedTorque, 0);
  assert.ok(sim.automatic.stageAngles.every(members => Object.values(members).every(angle => angle === 0)));
});

test('published converter powers balance at every step, including neutral and engine braking', () => {
  for (const throttle of [0, 0.4, 1]) for (const gear of [0, 1, 5, 8]) {
    const sim = setup(); sim.automatic.automatic = false;
    sim.speed = gear ? 12 : 0; sim.throttle = throttle;
    sim.traction = evaluateTraction(sim, 0);
    if (gear) sim.shift(gear);
    for (let n = 0; n < 100; n++) {
      if (n === 70) sim.brake = 1;
      sim.update(0.02);
      const h = sim.automatic;
      near(h.pumpOmega, sim.rpm * Math.PI / 30);
      near(h.pumpTorque * h.pumpOmega - h.turbineTorque * h.turbineOmega, h.lossPower);
      assert.ok(h.lossPower >= 0);
    }
  }
});

test('parking is interlocked while moving and drive/neutral ranges reconnect and release wheel torque', () => {
  const sim = setup();
  assert.equal(sim.setAutomaticRange('P'), true);
  run(sim, 0.2); near(sim.speed, 0);
  assert.equal(sim.setAutomaticRange('D'), true);
  run(sim, 3);
  assert.ok(sim.speed > 0.3);
  assert.equal(sim.setAutomaticRange('P'), false);
  assert.equal(sim.setAutomaticRange('N'), true);
  run(sim, 1.3);
  near(sim.transmittedTorque, 0);
  assert.equal(sim.gear, 0);
});

test('engine mount setters preserve valid front, mid, rear and hybrid configurations', () => {
  const sim = new Simulation();
  assert.equal(sim.setEngineOrientation('transverse'), true);
  assert.equal(sim.driveLayout, 'fwd');
  sim.setDriveLayout('rwd');
  assert.equal(sim.engineOrientation, 'longitudinal', 'front RWD keeps a connected longitudinal drive path');
  sim.setEngineOrientation('transverse');
  sim.setEnginePlacement('mid');
  sim.setDriveLayout('rwd');
  sim.setEnginePlacement('front');
  assert.equal(sim.driveLayout, 'fwd', 'returning a transverse engine to the front restores FWD');
  assert.equal(sim.setEngineOrientation('longitudinal'), true);
  assert.equal(sim.driveLayout, 'fwd');
  sim.setEngine('r6');
  assert.equal(sim.setEngineOrientation('transverse'), false);
  sim.setEnginePlacement('rear');
  assert.equal(sim.enginePlacement, 'rear'); assert.equal(sim.driveLayout, 'rwd');
  sim.setDriveLayout('quattro');
  assert.equal(sim.enginePlacement, 'front'); assert.equal(sim.engineOrientation, 'longitudinal');
  sim.setEnginePlacement('mid');
  assert.equal(sim.driveLayout, 'awd');
  sim.setTransmission('hybrid');
  assert.equal(sim.engineId, 'r4'); assert.equal(sim.engineOrientation, 'transverse');
  assert.equal(sim.enginePlacement, 'front'); assert.equal(sim.driveLayout, 'fwd');
  assert.equal(sim.setEngine('r6'), false);
  assert.equal(sim.setEnginePlacement('rear'), false);
  assert.equal(sim.setEngineOrientation('longitudinal'), false);
});

test('automatic model rotates actual converter members and planetaries and has finite isolated bounds', () => {
  const materials = Object.fromEntries(['steel', 'dark', 'block', 'brass', 'black', 'intake', 'exhaust', 'fuel', 'white'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const model = new AutomaticModel(materials);
  const sim = setup(); sim.shift(1); sim.throttle = 0.4; run(sim, 2);
  try {
    model.update(sim, true, 0.1);
    near(model.pump.rotation.x, sim.automatic.pumpAngle);
    near(model.turbine.rotation.x, sim.automatic.turbineAngle);
    model.stages.forEach((stage, index) => {
      near(stage.sun.rotation.x, sim.automatic.stageAngles[index].sun);
      near(stage.ring.rotation.x, sim.automatic.stageAngles[index].ring);
      near(stage.carrier.rotation.x, sim.automatic.stageAngles[index].carrier);
    });
    assert.notEqual(model.pump.rotation.x, model.turbine.rotation.x);
    for (const section of ['all', 'converter', 'pump', 'turbine', 'stator', 'lockup', 'planetary', 'automaticClutches', 'valveBody']) {
      model.setSection(section, true);
      const box = model.bounds(section);
      assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
    }
    model.setSection('turbine', true);
    assert.equal(model.turbine.visible, true); assert.equal(model.pump.visible, false);
    model.setSection('automaticClutches', true);
    assert.ok(model.stages.every(stage => !stage.sun.visible && !stage.ring.visible && !stage.carrier.visible));
    assert.ok(model.stages.slice(0, 3).every(stage => stage.pack.visible && stage.brake.visible));
    assert.equal(model.output.visible, false);
    model.setSection('planetary', true);
    assert.ok(model.stages.every(stage => stage.sun.visible && stage.ring.visible && stage.carrier.visible && !stage.pack.visible));
    model.setSection('all');
    sim.paused = true;
    const arrows = [...model.paths[0].arrows.instanceMatrix.array];
    model.update(sim, true, 1);
    assert.deepEqual([...model.paths[0].arrows.instanceMatrix.array], arrows);
  } finally {
    model.dispose(); Object.values(materials).forEach(material => material.dispose());
  }
});
