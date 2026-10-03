const defineEngine = (id, name, cylinders, bankAngle, firingOrder, displacement, torque, inertia, options = {}) => {
  const interval = 720 / cylinders;
  const offsets = Array.from({ length: cylinders }, (_, i) => (720 - firingOrder.indexOf(i + 1) * interval) % 720);
  const angles = bankAngle ? [-bankAngle / 2, bankAngle / 2] : [0];
  return Object.freeze({ id, name, cylinders, bankAngle, firingOrder, displacement, torque, inertia, interval, offsets,
    angles, headAngles: angles, headForBank: angles.map((_, i) => i), pitch: 1.8,
    stagger: bankAngle ? [-0.28, 0.28] : [0], valvesPerCylinder: 4, timing: 'belt',
    mountOrientations: Object.freeze(['longitudinal']),
    architecture: bankAngle ? `V ${bankAngle}° · 2 głowice · 4 wałki` : 'Rzędowy · 1 głowica · 2 wałki',
    note: 'Przykładowy układ DOHC. Geometria, fazy zaworów i numeracja są dydaktyczne.', ...options });
};

export const ENGINES = Object.freeze({
  r3: defineEngine('r3', 'R3 · 1.0 MPI', 3, 0, [1, 2, 3], '1.0 l', 95, 0.18, {
    mountOrientations: Object.freeze(['longitudinal', 'transverse']),
    architecture: 'R3 · 1 głowica · 2 wałki · 12 zaworów',
    note: 'Trzycylindrowy wolnossący DOHC inspirowany 1.0 MPI EA211. Wtrysk do kanałów dolotowych, pasek zębaty i zapłony co 240°. Geometria oraz numeracja są dydaktyczne; osiągi nie stanowią kalibracji konkretnego auta.'
  }),
  r4: defineEngine('r4', 'R4', 4, 0, [1, 3, 4, 2], '2.0 l', 170, 0.24, {
    mountOrientations: Object.freeze(['longitudinal', 'transverse'])
  }),
  r6: defineEngine('r6', 'Inline 6', 6, 0, [1, 5, 3, 6, 2, 4], '3.0 l', 255, 0.34, {
    timing: 'chain', note: 'R6: sześć cylindrów w jednej linii. Wybrano wariant DOHC z łańcuchem; istnieją też R6 z innym rozrządem.'
  }),
  v6: defineEngine('v6', 'V6', 6, 60, [1, 2, 3, 4, 5, 6], '3.0 l', 255, 0.34, {
    mountOrientations: Object.freeze(['longitudinal', 'transverse'])
  }),
  vr6: defineEngine('vr6', 'VR6', 6, 15, [1, 5, 3, 6, 2, 4], '2.8 l', 235, 0.34, {
    headAngles: [0], headForBank: [0, 0], pitch: 2.5, stagger: [-0.65, 0.65], timing: 'chain',
    mountOrientations: Object.freeze(['longitudinal', 'transverse']),
    architecture: 'VR 15° · 1 głowica · 2 wałki',
    note: 'Wariant 24V: wspólna głowica nad dwoma przesuniętymi rzędami. Jeden wałek obsługuje dolot obu rzędów, drugi wydech. W starszym VR6 12V podział był inny.'
  }),
  v8: defineEngine('v8', 'V8', 8, 90, [1, 2, 3, 4, 5, 6, 7, 8], '4.5 l', 340, 0.44, {
    timing: 'chain', architecture: 'V 90° · 2 głowice · 4 wałki',
    note: 'Przykładowy DOHC V8 z płaskim wałem: czopy leżą w dwóch przeciwległych kierunkach. Zapłony co 90°. Numeracja i kolejność zapłonów są dydaktyczne; nie odwzorowują dokumentacji Ferrari. Istnieją także V8 z wałem krzyżowym i innym rozrządem.'
  }),
  v12: defineEngine('v12', 'V12', 12, 60, [1, 2, 5, 6, 9, 10, 11, 12, 7, 8, 3, 4], '6.0 l', 510, 0.6),
  w16: defineEngine('w16', 'W16 · Bugatti', 16, 90, [1, 9, 5, 13, 3, 11, 7, 15, 4, 12, 8, 16, 2, 10, 6, 14], '8.0 l', 680, 0.8, {
    angles: [-52.5, -37.5, 37.5, 52.5], headAngles: [-45, 45], headForBank: [0, 0, 1, 1],
    pitch: 3, stagger: [-0.9, 0.3, -0.3, 0.9], timing: 'chain',
    architecture: 'W 90° / 15° · 2 głowice · 4 wałki',
    note: 'Architektura W16 Bugatti: dwa VR8 pod kątem 90°, cztery rzędy po cztery cylindry. Zapłony co 45°. Numeracja i kolejność tutaj są dydaktyczne. Fabryczny silnik ma cztery turbosprężarki; moduł turbo pokazuje zasadę jednej.'
  }),
  boxer4: defineEngine('boxer4', 'Boxer 4', 4, 180, [1, 3, 2, 4], '2.0 l', 170, 0.24, {
    timing: 'chain', architecture: 'Boxer 180° · 2 głowice · 4 wałki',
    note: 'Wariant DOHC inspirowany Subaru FB: po dwa wałki i osobny obwód łańcucha na głowicę. Przeciwległe tłoki poruszają się równocześnie ku głowicom; mają osobne czopy wału. Starsze boksery EJ stosowały też pasek.'
  }),
  boxer6: defineEngine('boxer6', 'Boxer 6', 6, 180, [1, 3, 5, 2, 4, 6], '3.0 l', 255, 0.34, {
    timing: 'chain', architecture: 'Boxer 180° · 2 głowice · 4 wałki',
    note: 'Sześciocylindrowy bokser DOHC inspirowany Porsche 911. Po trzy cylindry po obu stronach, osobne czopy wału dla przeciwległych tłoków i zapłony co 120°. Numeracja, kolejność zapłonów i trasa łańcuchów są dydaktyczne. Położenie silnika z tyłu wybiera się osobno w konfiguracji pojazdu.'
  })
});

export const getEngine = id => ENGINES[id] ?? ENGINES.r4;
export const cylinderLayout = (engineId, index) => {
  const engine = getEngine(engineId);
  const banks = engine.angles.length;
  const rows = engine.cylinders / banks;
  const bank = index % banks;
  const row = Math.floor(index / banks);
  const bankRadians = engine.angles[bank] * Math.PI / 180;
  const x = (row - (rows - 1) / 2) * engine.pitch + engine.stagger[bank];
  return { x, row, bank, head: engine.headForBank[bank], bankRadians, offset: engine.offsets[index] };
};

export const crankPin = (angle, engineId, index) => {
  const layout = cylinderLayout(engineId, index);
  const theta = (angle + layout.offset) * Math.PI / 180 + layout.bankRadians;
  return { x: layout.x, y: 0.8 + 0.65 * Math.cos(theta), z: 0.65 * Math.sin(theta) };
};
