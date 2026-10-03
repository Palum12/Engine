import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';
import { getEngine } from '../src/engines.js';
import { integrateHybrid } from '../src/hybrid.js';
import { evaluateTraction, splitAxleTorque, dctEngagement, PSD, FINAL_RATIO } from '../src/powertrain.js';
import { ScenarioPlayer, SCENARIOS } from '../src/scenarios.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const run = (sim, seconds) => { for (let t = 0; t < seconds; t += 0.02) sim.update(Math.min(0.02, seconds - t)); };

test('open axle torque is equal and limited by the weaker wheel; a lock uses both capacities', () => {
  assert.deepEqual(splitAxleTorque(500, [10, 700]).wheels, [10, 10]);
  assert.deepEqual(splitAxleTorque(-500, [10, 700]).wheels, [-10, -10]);
  const locked = splitAxleTorque(500, [10, 700], true);
  near(locked.wheels[0] + locked.wheels[1], 500);
  assert.ok(locked.wheels[1] > 490);
});

test('2H, locked 4WD, open AWD and mechanical quattro respond differently to a low grip axle', () => {
  const sim = new Simulation();
  sim.surfaces = ['ice', 'ice', 'asphalt', 'asphalt'];
  sim.setDriveLayout('awd');
  const open = evaluateTraction(sim, 1000);
  sim.centerLock = true;
  const locked = evaluateTraction(sim, 1000);
  sim.setDriveLayout('quattro');
  const quattro = evaluateTraction(sim, 1000);
  assert.ok(quattro.deliveredTorque > open.deliveredTorque);
  assert.ok(locked.deliveredTorque > quattro.deliveredTorque);
  assert.ok(quattro.frontShare >= 0.2 && quattro.frontShare <= 0.6);
  sim.setDriveLayout('partTime');
  near(evaluateTraction(sim, 400).axleTorques[0], 0);
  sim.driveMode = '4H'; sim.speed = 7; sim.turn = 0.8;
  sim.surfaces.fill('asphalt');
  const dry = evaluateTraction(sim, 400);
  assert.equal(dry.binding, true);
  near(dry.carrierOmega[0], dry.carrierOmega[1]);
  const high = sim.outputOmega;
  sim.driveMode = '4L';
  near(sim.outputOmega, high * 2.5);
});

test('DCT preselection carries no torque until clutch handover; same-branch shifts release first', () => {
  const sim = new Simulation(); sim.setTransmission('dct');
  sim.gear = 1; sim.speed = 4; sim.rpm = 1900; sim.throttle = 0.35;
  sim.traction = evaluateTraction(sim, 0);
  sim.integrate(0.002);
  assert.deepEqual(sim.dct.selected, [1, 2]);
  near(sim.dct.torques[1], 0);
  assert.ok(sim.dct.torques[0] > 0);
  assert.equal(sim.shift(2), true);
  sim.shiftProgress = 0.5; sim.integrate(0.002);
  assert.ok(sim.dct.torques.every(torque => torque > 0));
  near(sim.dct.engagement[0] + sim.dct.engagement[1], 1);
  run(sim, 1);
  assert.equal(sim.gear, 2);
  assert.deepEqual(sim.dct.selected, [3, 2]);
  near(sim.dct.torques[0], 0);
  assert.deepEqual(dctEngagement(1, 3, 0.5), [0, 0]);
});

test('hybrid EV, assist, regeneration and parked charging have the correct energy directions', () => {
  const sim = new Simulation(); sim.setTransmission('hybrid');
  sim.hybrid.mode = 'ev'; sim.throttle = 0.25;
  run(sim, 3);
  assert.ok(sim.speed > 0 && sim.hybrid.batteryPower > 0 && sim.hybrid.motorPower > 0);
  near(sim.hybrid.enginePower, 0);
  assert.ok(sim.hybrid.mg1Omega < 0);
  sim.hybrid.mode = 'hybrid'; sim.throttle = 0.6;
  run(sim, 3);
  assert.ok(sim.running && sim.hybrid.enginePower > 0 && sim.hybrid.generatorPower > 0);
  sim.throttle = 0; sim.brake = 0.25;
  const soc = sim.hybrid.soc;
  run(sim, 0.6);
  assert.ok(sim.hybrid.batteryPower < 0 && sim.hybrid.motorPower < 0 && sim.hybrid.soc > soc);
  sim.hybrid.soc = 0.85;
  run(sim, 0.2);
  near(sim.hybrid.batteryPower, 0, 1e-4);
  sim.speed = 0; sim.traction = evaluateTraction(sim, 0); sim.brake = 0;
  sim.hybrid.range = 'P'; sim.hybrid.mode = 'charge'; sim.hybrid.soc = 0.4;
  run(sim, 3);
  assert.ok(sim.hybrid.generatorPower > 0 && sim.hybrid.batteryPower < 0);
  near(sim.speed, 0); near(sim.hybrid.motorPower, 0);
});

test('hybrid preserves planetary kinematics, electrical limits and energy at SOC boundaries', () => {
  for (const soc of [0.2, 0.200001, 0.6, 0.849999, 0.85])
    for (const speed of [0, 1, 20, 80])
      for (const rpm of [0, 1300, 3600])
        for (const mode of ['ev', 'hybrid', 'charge'])
          for (const range of ['D', 'N', 'P'])
            for (const brake of [0, 0.5]) {
              const sim = new Simulation(); sim.setTransmission('hybrid');
              Object.assign(sim, { speed, rpm, brake, throttle: 0.8 });
              Object.assign(sim.hybrid, { soc, mode, range });
              sim.traction = evaluateTraction(sim, 0);
              integrateHybrid(sim, 0.002, getEngine(sim.engineId));
              const h = sim.hybrid;
              near(PSD.sun * h.mg1Omega + PSD.ring * h.mg2Omega, (PSD.sun + PSD.ring) * sim.rpm * Math.PI / 30);
              near(h.enginePower + h.batteryPower, h.mechanicalPower + h.motorPower + h.lossPower + h.startPower);
              near((soc - h.soc) * h.capacityKwh * 3.6e6 / 0.002, h.batteryPower, 0.01);
              near(h.batteryCurrent * h.voltage, h.batteryPower);
              assert.ok(h.batteryPower <= 25000.01 && h.batteryPower >= -20000.01);
              assert.ok(h.lossPower >= -1e-7);
              assert.ok(h.soc >= 0.2 && h.soc <= 0.85);
              if (range !== 'D') near(h.ringTorque, 0);
            }
});

test('hybrid regeneration recovers only road braking energy with low grip or airborne driven wheels', () => {
  const cases = [
    { surfaces: ['air', 'air', 'air', 'air'], recovers: false },
    { surfaces: ['air', 'air', 'asphalt', 'asphalt'], recovers: false },
    { surfaces: ['air', 'asphalt', 'asphalt', 'asphalt'], recovers: false },
    { surfaces: ['ice', 'ice', 'ice', 'ice'], recovers: true },
    { surfaces: ['ice', 'asphalt', 'asphalt', 'asphalt'], recovers: true },
    { surfaces: ['air', 'asphalt', 'asphalt', 'asphalt'], frontLock: true, recovers: true },
    { surfaces: ['asphalt', 'asphalt', 'asphalt', 'asphalt'], turn: 1, recovers: true }
  ];
  for (const config of cases) for (const soc of [0.6, 0.849999, 0.85]) {
    const sim = new Simulation(); sim.setTransmission('hybrid');
    Object.assign(sim, { speed: 10, brake: 1, frontLock: false, turn: 0 }, config);
    Object.assign(sim.hybrid, { mode: 'ev', soc });
    // Reproduce stale traction after changing road contact and residual wheelspin.
    sim.wheelSlip = [70, 70, 0, 0];
    const dt = 0.002;
    sim.integrate(dt);
    const h = sim.hybrid;
    const roadBrakingPower = Math.max(0, -sim.traction.force * 10);
    assert.ok(-h.motorPower <= roadBrakingPower + 1e-7);
    assert.ok(-h.batteryPower <= roadBrakingPower + 1e-7);
    near(h.motorPower, h.mg2Torque * h.mg2Omega);
    near(h.enginePower + h.batteryPower, h.mechanicalPower + h.motorPower + h.lossPower + h.startPower);
    near((soc - h.soc) * h.capacityKwh * 3.6e6 / dt, h.batteryPower, 0.01);
    if (!config.recovers || soc === 0.85) {
      near(h.motorPower, 0); near(h.batteryPower, 0); near(h.soc, soc);
      near(sim.traction.deliveredTorque, 0);
    } else {
      assert.ok(h.motorPower < 0 && h.batteryPower < 0 && h.soc > soc);
      assert.ok(-h.batteryPower < -h.motorPower);
    }
  }
});

test('hybrid braking does not charge the battery after losing driven wheel contact', () => {
  const sim = new Simulation(); sim.setTransmission('hybrid');
  Object.assign(sim, { speed: 10, brake: 1 });
  sim.hybrid.mode = 'ev';
  sim.update(0.1);
  assert.ok(sim.hybrid.batteryPower < 0);
  sim.surfaces.fill('air');
  const soc = sim.hybrid.soc;
  sim.update(0.1);
  near(sim.hybrid.batteryPower, 0); near(sim.hybrid.motorPower, 0);
  near(sim.traction.deliveredTorque, 0); near(sim.hybrid.soc, soc);
});

test('hybrid wheel-side speed follows the actual front carrier and pause freezes every rotating member', () => {
  const sim = new Simulation(); sim.setTransmission('hybrid');
  sim.hybrid.mode = 'ev'; sim.throttle = 0.3; sim.turn = 0.6;
  run(sim, 2);
  near(sim.hybrid.mg2Omega, sim.traction.inputOmega * FINAL_RATIO, 0.1);
  const before = JSON.stringify(sim);
  sim.paused = true;
  const paused = JSON.stringify(sim);
  run(sim, 1);
  assert.notEqual(paused, before);
  assert.equal(JSON.stringify(sim), paused);
});

test('every guided scenario runs to completion and changing transmission clears transmitted torque', () => {
  for (const [id, scenario] of Object.entries(SCENARIOS)) for (const type of scenario.types) {
    const sim = new Simulation(); sim.setTransmission(type);
    const player = new ScenarioPlayer(sim);
    assert.equal(player.start(id), true);
    while (player.index < player.steps.length - 1) assert.equal(player.next(), true);
    sim.paused = false; run(sim, 0.1);
    assert.ok(Number.isFinite(sim.rpm) && Number.isFinite(sim.speed));
    assert.ok(sim.hybrid.soc >= 0.2 && sim.hybrid.soc <= 0.85);
    sim.setTransmission(type === 'hybrid' ? 'manual' : 'hybrid');
    near(sim.transmittedTorque, 0);
    near(sim.inputOmega, sim.rpm * Math.PI / 30);
  }
});
