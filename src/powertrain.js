export const DCT_RATIOS = [0, 3.6, 2.2, 1.52, 1.15, 0.9, 0.74];
export const FINAL_RATIO = 3.9;
export const WHEEL_RADIUS = 0.31;
export const VEHICLE_MASS = 1250;
export const TRANSMISSIONS = {
  manual: { name: 'Manualna · 5 biegów', hint: 'Pedał rozłącza silnik od wejścia skrzyni. Przesuwka wybiera drogę momentu.' },
  dct: { name: 'DCT · 6 biegów · mokre sprzęgła', hint: 'K1: 1/3/5. K2: 2/4/6. Przygotowany bieg zaczyna napędzać koła dopiero po załączeniu swojego sprzęgła.' },
  hybrid: { name: 'Hybryda · planetarna e-CVT', hint: 'Silnik → jarzmo. MG1 → słońce. MG2 i wyjście → wieniec. Obroty MG1 pozwalają zmieniać obroty silnika przy tej samej prędkości auta.' }
};
export const DRIVE_LAYOUTS = {
  rwd: { name: 'RWD · tylna oś', hint: 'Silnik wzdłużnie, skrzynia, wał napędowy i tylny dyferencjał.' },
  fwd: { name: 'FWD · przednia oś', hint: 'Zespół poprzeczny. Przekładnia główna przy skrzyni napędza przednie półosie.' },
  partTime: { name: '4WD · 2H / 4H / 4L', hint: '2H: tylna oś. 4H: osie połączone sztywno. 4L: dodatkowa redukcja 2,5:1. Sztywne połączenie osi wymusza poślizg opon w zakręcie.' },
  awd: { name: 'AWD · centralny dyferencjał', hint: 'Otwarty centralny dyferencjał pozwala osiom obracać się z różnymi prędkościami. Blokada łączy ich obroty; rozdział momentu zależy wtedy od oporu osi.' },
  quattro: { name: 'quattro · mechaniczne 40:60', hint: 'Schemat planetarnego samoblokującego mechanizmu opisanego przez Audi. Podstawowy podział 40% przód / 60% tył; w tym wariancie zakres 20–60% na przód. Nie jest to quattro ultra.' }
};
export const SURFACES = { asphalt: { name: 'Asfalt', mu: 0.95 }, wet: { name: 'Mokro', mu: 0.4 }, ice: { name: 'Lód', mu: 0.025 }, air: { name: 'W powietrzu', mu: 0 } };
export const WHEEL_NAMES = ['Przód lewy', 'Przód prawy', 'Tył lewy', 'Tył prawy'];
export const PSD = { sun: 30, ring: 78, planet: 24, planets: 3 };
export const psdSunOmega = (engineOmega, ringOmega) => ((PSD.sun + PSD.ring) * engineOmega - PSD.ring * ringOmega) / PSD.sun;
export const psdPlanetOmega = (sunOmega, carrierOmega) => -(sunOmega - carrierOmega) * PSD.sun / PSD.planet;
const bound = (n, low, high) => Math.max(low, Math.min(high, n));

export function splitAxleTorque(request, capacities, locked = false) {
  const available = locked ? capacities[0] + capacities[1] : 2 * Math.min(...capacities);
  const total = Math.sign(request) * Math.min(Math.abs(request), available);
  const share = locked && available > 0 ? capacities[0] / available : 0.5;
  return { total, wheels: [total * share, total * (1 - share)], available };
}

export function evaluateTraction(sim, requestedTorque) {
  const capacity = sim.surfaces.map(id => (SURFACES[id]?.mu ?? SURFACES.asphalt.mu) * VEHICLE_MASS * 9.81 * WHEEL_RADIUS / 4);
  const axles = [splitAxleTorque(1e9, capacity.slice(0, 2), sim.frontLock), splitAxleTorque(1e9, capacity.slice(2), sim.rearLock)];
  const both = ['awd', 'quattro'].includes(sim.driveLayout) || sim.driveLayout === 'partTime' && sim.driveMode !== '2H';
  const centerLocked = sim.driveLayout === 'partTime' && both || sim.driveLayout === 'awd' && sim.centerLock;
  let frontShare = sim.driveLayout === 'fwd' ? 1 : 0;
  if (both) {
    const sum = axles[0].available + axles[1].available;
    if (centerLocked) frontShare = sum > 0 ? axles[0].available / sum : 0.5;
    else if (sim.driveLayout === 'quattro') {
      frontShare = 0.4;
      if (Math.abs(requestedTorque) * 0.4 > axles[0].available) frontShare = Math.max(0.2, axles[0].available / Math.max(1, Math.abs(requestedTorque)));
      if (Math.abs(requestedTorque) * (1 - frontShare) > axles[1].available) frontShare = Math.min(0.6, 1 - axles[1].available / Math.max(1, Math.abs(requestedTorque)));
    } else frontShare = 0.5;
  }
  const limit = Math.min(frontShare > 0 ? axles[0].available / frontShare : Infinity, frontShare < 1 ? axles[1].available / (1 - frontShare) : Infinity);
  const delivered = Math.sign(requestedTorque) * Math.min(Math.abs(requestedTorque), limit);
  const front = splitAxleTorque(delivered * frontShare, capacity.slice(0, 2), sim.frontLock);
  const rear = splitAxleTorque(delivered * (1 - frontShare), capacity.slice(2), sim.rearLock);
  const roadOmega = sim.speed / WHEEL_RADIUS;
  const turn = sim.turn * 0.13;
  const frontFactor = Math.sqrt(1 + (sim.turn * 2.7 / 10) ** 2);
  const demand = [requestedTorque * frontShare, requestedTorque * (1 - frontShare)];
  const wheels = [front, rear].flatMap((axle, a) => axle.wheels.map((torque, side) => {
    const index = a * 2 + side;
    const driven = a === 0 ? frontShare > 0 : frontShare < 1;
    const weakest = capacity[index] <= capacity[a * 2 + (1 - side)];
    const lost = Math.max(0, Math.abs(demand[a]) - axle.available);
    const slipTarget = driven && weakest && !(a === 0 ? sim.frontLock : sim.rearLock) ? Math.min(70, lost / 18) : 0;
    const slip = sim.wheelSlip?.[index] || 0;
    const locked = a === 0 ? sim.frontLock : sim.rearLock;
    const factor = centerLocked ? 1 : a === 0 ? frontFactor : 1;
    const omega = roadOmega * factor * (locked ? 1 : 1 + (side ? turn : -turn)) + slip;
    return { name: WHEEL_NAMES[index], surface: sim.surfaces[index], torque, capacity: capacity[index], omega, rpm: omega * 30 / Math.PI, slip, slipTarget, driven };
  }));
  const carrierOmega = [0, 1].map(a => (wheels[a * 2].omega + wheels[a * 2 + 1].omega) / 2);
  const inputOmega = frontShare === 1 ? carrierOmega[0] : frontShare === 0 ? carrierOmega[1] : centerLocked ? roadOmega : sim.driveLayout === 'quattro' ? carrierOmega[0] * 0.4 + carrierOmega[1] * 0.6 : (carrierOmega[0] + carrierOmega[1]) / 2;
  return { wheels, carrierOmega, inputOmega, requestedTorque, deliveredTorque: delivered, force: delivered / WHEEL_RADIUS, frontShare, axleTorques: [front.total, rear.total], centerLocked, binding: centerLocked && sim.speed > 0.3 && Math.abs(sim.turn) > 0.2 && sim.surfaces.every(id => id === 'asphalt'), slip: Math.abs(requestedTorque) > Math.abs(delivered) + 1 };
}

export function dctSelection(gear) {
  if (!gear) return { selected: [1, 2], active: -1, prepared: 1 };
  const next = gear < 6 ? gear + 1 : 5;
  const active = gear % 2 ? 0 : 1;
  const selected = [];
  selected[active] = gear;
  selected[1 - active] = next;
  return { selected, active, prepared: next };
}

export function dctEngagement(gear, target, progress) {
  if (target === null) return gear ? gear % 2 ? [1, 0] : [0, 1] : [0, 0];
  if (!target) return gear % 2 ? [1 - bound(progress * 2, 0, 1), 0] : [0, 1 - bound(progress * 2, 0, 1)];
  const incoming = target % 2 ? 0 : 1;
  const outgoing = gear ? gear % 2 ? 0 : 1 : -1;
  const result = [0, 0];
  if (incoming === outgoing) {
    result[incoming] = progress < 0.5 ? Math.max(0, 1 - progress * 4) : bound((progress - 0.65) / 0.35, 0, 1);
  } else {
    let blend = bound((progress - 0.2) / 0.6, 0, 1);
    blend = blend * blend * (3 - 2 * blend);
    result[incoming] = blend;
    if (outgoing >= 0) result[outgoing] = 1 - blend;
  }
  return result;
}
