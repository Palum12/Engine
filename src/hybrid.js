import { PSD, FINAL_RATIO, evaluateTraction, psdSunOmega } from './powertrain.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const capacity = 1.3 * 3.6e6;
const efficiency = 0.92;
const finalDriveEfficiency = 0.96;
export const hybridWheelTorque = torque => torque * FINAL_RATIO * (torque < 0 ? 1 / finalDriveEfficiency : finalDriveEfficiency);
const dcPower = p => p >= 0 ? p / efficiency : p * efficiency;
const motorDcPower = (torque, omega) => dcPower(torque * omega) + (torque > 0 ? 300 * Math.min(torque / 5, 1) : 0);
const torqueForDc = (power, omega, fallback) => power < 0 ? omega > 0 ? power / (omega * efficiency) : fallback : power <= 300 + omega * 5 / efficiency ? power / (60 + omega / efficiency) : omega > 0 ? (power - 300) * efficiency / omega : fallback;

export function createHybridState() {
  return { soc: 0.6, voltage: 201.6, capacityKwh: 1.3, mode: 'auto', range: 'D', mg1Omega: 0, mg2Omega: 0, mg1Angle: 0, mg2Angle: 0, carrierAngle: 0, enginePower: 0, mechanicalPower: 0, generatorPower: 0, generatorMechanical: 0, motorPower: 0, motorDcPower: 0, batteryPower: 0, batteryCurrent: 0, lossPower: 0, startPower: 0, mg1Torque: 0, mg2Torque: 0, ringTorque: 0, state: 'EV · silnik benzynowy wyłączony' };
}

export function integrateHybrid(sim, dt, engine) {
  const h = sim.hybrid;
  const parked = h.range === 'P';
  const neutral = h.range === 'N';
  const regenerative = sim.brake > 0 && sim.speed > 0.15 && !neutral && !parked;
  // Wheelspin has no stored rotational energy in this model. Braking removes it
  // before MG2 can turn that illustrative slip speed into battery charge.
  if (regenerative) sim.wheelSlip.fill(0);
  const wheelOmega = evaluateTraction(sim, 0).inputOmega * FINAL_RATIO;
  const engineRequested = sim.hybridEnabled && h.soc > 0.20001 && !neutral && !regenerative && (h.mode === 'charge' || h.mode === 'hybrid' || h.soc < 0.3 || Math.abs(psdSunOmega(0, wheelOmega)) > 10000 * Math.PI / 30 || h.mode === 'auto' && (sim.throttle > 0.35 || sim.speed > 14));
  const targetRpm = engineRequested ? parked || h.mode === 'charge' ? 1300 : 1400 + sim.throttle * 2600 : 0;
  sim.rpm += clamp(targetRpm - sim.rpm, -1800 * dt, 1800 * dt);
  sim.running = engineRequested && sim.rpm > 400;
  sim.stalled = false;
  const engineOmega = sim.rpm * Math.PI / 30;
  h.mg2Omega = wheelOmega;
  h.mg1Omega = psdSunOmega(engineOmega, wheelOmega);
  const dischargeLimit = Math.min(25000, Math.max(0, h.soc - 0.2) * capacity / dt);
  const chargeLimit = Math.min(20000, Math.max(0, 0.85 - h.soc) * capacity / dt);
  const startPower = engineRequested && !sim.running ? Math.min(1800, dischargeLimit * efficiency) : 0;
  const electricallyActive = sim.hybridEnabled && !neutral;
  // Limit regeneration before computing electrical flows and SOC. The final
  // drive loses power in both directions, so road braking torque is larger
  // than the torque reaching MG2 during recovery.
  const regenTorqueLimit = regenerative ? evaluateTraction(sim, hybridWheelTorque(-200)).deliveredTorque / FINAL_RATIO * finalDriveEfficiency : -200;
  const minTorque = electricallyActive && !parked ? Math.max(-200, regenTorqueLimit) : 0;
  const maxTorque = electricallyActive && !parked ? 220 : 0;
  const minMotorDc = Math.max(-40000, motorDcPower(minTorque, wheelOmega));
  const maxMotorDc = Math.min(40000, motorDcPower(maxTorque, wheelOmega));
  let engineTorque = sim.running ? Math.min(engine.torque, h.mode === 'charge' || parked ? 60 : 35 + sim.throttle * 105) * clamp((sim.rpm - 400) / 600, 0, 1) : 0;
  const generatorFactor = engineOmega - PSD.ring / (PSD.sun + PSD.ring) * wheelOmega;
  const maximumGenerator = maxMotorDc + chargeLimit;
  const minimumGenerator = minMotorDc - dischargeLimit;
  if (generatorFactor > 0) engineTorque = Math.min(engineTorque, Math.max(0, (maximumGenerator / efficiency + startPower) / generatorFactor));
  if (generatorFactor < 0) engineTorque = Math.min(engineTorque, Math.max(0, (minimumGenerator * efficiency + startPower) / generatorFactor));
  const wantedMotorTorque = torque => {
    let wanted = electricallyActive && !parked ? regenerative ? -sim.brake * 190 : sim.throttle * 300 - torque * PSD.ring / (PSD.sun + PSD.ring) : 0;
    if (h.mode === 'charge' && !regenerative && !parked) wanted = Math.min(wanted, 0);
    return clamp(wanted, minTorque, maxTorque);
  };
  const generatorDcAt = torque => {
    const mechanical = torque * generatorFactor - startPower;
    return mechanical >= 0 ? mechanical * efficiency : mechanical / efficiency;
  };
  if (generatorFactor > 0 && generatorDcAt(engineTorque) > motorDcPower(wantedMotorTorque(engineTorque), wheelOmega) + chargeLimit) {
    let low = 0;
    let high = engineTorque;
    for (let n = 0; n < 32; n++) {
      const middle = (low + high) / 2;
      if (generatorDcAt(middle) > motorDcPower(wantedMotorTorque(middle), wheelOmega) + chargeLimit) high = middle;
      else low = middle;
    }
    engineTorque = low;
  }
  let ringFromEngine = engineTorque * PSD.ring / (PSD.sun + PSD.ring);
  let enginePower = engineTorque * engineOmega;
  let mechanicalPower = ringFromEngine * wheelOmega;
  let generatorMechanical = enginePower - mechanicalPower - startPower;
  let generatorDc = generatorDcAt(engineTorque);
  let motorTorque = wantedMotorTorque(engineTorque);
  const minDc = Math.max(minMotorDc, generatorDc - chargeLimit);
  const maxDc = Math.min(maxMotorDc, generatorDc + dischargeLimit);
  const wantedDc = motorDcPower(motorTorque, wheelOmega);
  const limitedDc = clamp(wantedDc, minDc, maxDc);
  if (Math.abs(limitedDc - wantedDc) > 1e-6) motorTorque = clamp(torqueForDc(limitedDc, wheelOmega, motorTorque), minTorque, maxTorque);
  let motorMechanical = motorTorque * wheelOmega;
  let motorDc = motorDcPower(motorTorque, wheelOmega);
  if (!electricallyActive) { generatorMechanical = generatorDc = enginePower = mechanicalPower = engineTorque = ringFromEngine = motorTorque = motorMechanical = motorDc = 0; }
  const batteryPower = motorDc - generatorDc;
  h.soc = clamp(h.soc - batteryPower * dt / capacity, 0.2, 0.85);
  Object.assign(h, { enginePower, mechanicalPower, startPower, generatorPower: generatorDc, motorPower: motorMechanical, motorDcPower: motorDc, generatorMechanical, batteryPower, batteryCurrent: batteryPower / h.voltage, lossPower: generatorMechanical - generatorDc + motorDc - motorMechanical, mg1Torque: startPower > 0 && h.mg1Omega > 0.01 ? startPower / h.mg1Omega : -engineTorque * PSD.sun / (PSD.sun + PSD.ring), mg2Torque: motorTorque, ringTorque: parked || neutral ? 0 : ringFromEngine + motorTorque });
  h.state = !sim.hybridEnabled ? 'Układ hybrydowy wyłączony' : neutral ? 'N · brak napędu i rekuperacji' : regenerative ? h.soc >= 0.849 ? 'Bateria pełna · hamowanie cierne' : regenTorqueLimit === 0 ? 'Brak przyczepności · brak rekuperacji' : 'Rekuperacja · koła → MG2 → bateria' : engineRequested && !sim.running ? 'MG1 uruchamia silnik benzynowy' : parked ? enginePower > 1 ? 'P · silnik → MG1 → bateria' : 'P · blokada wyjścia' : !sim.running ? h.soc <= 0.20001 ? 'Minimalny SOC · brak energii do rozruchu i jazdy EV' : 'EV · bateria → falownik → MG2 → koła' : batteryPower < -100 ? 'Podział mocy · napęd i ładowanie baterii' : 'Podział mocy · silnik i MG2 napędzają koła';
  sim.torque = engineTorque;
  sim.transmittedTorque = h.ringTorque;
  sim.inputOmega = engineOmega;
  sim.clutchSlip = 0;
  sim.boost = 0;
  return h.ringTorque;
}
