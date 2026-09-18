const defineEngine = (id, name, cylinders, bankAngle, firingOrder, displacement, torque, inertia) => {
  const interval = 720 / cylinders;
  const offsets = Array.from({ length: cylinders }, (_, i) => (720 - firingOrder.indexOf(i + 1) * interval) % 720);
  return Object.freeze({ id, name, cylinders, bankAngle, firingOrder, displacement, torque, inertia, interval, offsets });
};

export const ENGINES = Object.freeze({
  r4: defineEngine('r4', 'R4', 4, 0, [1, 3, 4, 2], '2.0 l', 170, 0.24),
  v6: defineEngine('v6', 'V6', 6, 60, [1, 2, 3, 4, 5, 6], '3.0 l', 255, 0.34),
  v12: defineEngine('v12', 'V12', 12, 60, [1, 2, 5, 6, 9, 10, 11, 12, 7, 8, 3, 4], '6.0 l', 510, 0.6)
});

export const getEngine = id => ENGINES[id] ?? ENGINES.r4;
export const cylinderLayout = (engineId, index) => {
  const engine = getEngine(engineId);
  const banks = engine.bankAngle ? 2 : 1;
  const rows = engine.cylinders / banks;
  const bank = banks === 1 ? 0 : index % 2;
  const row = Math.floor(index / banks);
  const bankRadians = banks === 1 ? 0 : (bank === 0 ? -1 : 1) * engine.bankAngle * Math.PI / 360;
  const x = (row - (rows - 1) / 2) * 1.8 + (banks === 1 ? 0 : bank === 0 ? -0.13 : 0.13);
  return { x, row, bank, bankRadians, offset: engine.offsets[index] };
};

export const crankPin = (angle, engineId, index) => {
  const layout = cylinderLayout(engineId, index);
  const theta = (angle + layout.offset) * Math.PI / 180 + layout.bankRadians;
  return { x: layout.x, y: 0.8 + 0.65 * Math.cos(theta), z: 0.65 * Math.sin(theta) };
};
