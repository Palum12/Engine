# Mechanical models

These modules build educational Three.js assemblies from primitive and custom
geometry. They deliberately explain mechanical principles rather than reproduce
the exact internals or scale of every real vehicle preset.

## Ownership and lifecycle

- Extend `ModelGeometry` in `geometry.js`. Use its geometry cache, owned material
  tracking, `subgroup`, `anchor`, and `dispose` helpers. Shared palette materials
  belong to `EngineScene`; do not dispose them from an individual model.
- A model exposes `group`, `update`, and `bounds`. Assemblies with inspections
  also expose `setSection(section, isolate)` or `setView(mode)`.
- `scene.js` reparents the same model groups between its root (bench views) and
  `VehicleModel.assembly` (whole-vehicle views). Always reset position, rotation,
  and scale when moving back to a bench view. Avoid baking world transforms into
  reusable geometry.
- Dynamic paths and rebuilds must remove their old groups before disposing
  resources. The transverse final-drive spur belongs to routing geometry but is
  parented to a differential carrier, so detach it explicitly during rebuilds.

## Coordinates and connections

- Vehicle front is negative X; front axle is X = -7 and rear axle X = +7.
  Y is vertical and wheel/halfshaft axes are Z. The chassis spans roughly
  X = ±9.4, with wheels at Z = ±3.
- Engine crankshaft and transmission shafts run along local X. The engine
  transmission attachment is local `(engine.shaftEnd, 0.8, 0)` and each
  transmission input is its group origin. Keep those world positions identical.
- `engineOrientation` and `enginePlacement` are separate from `driveLayout`.
  FWD can be longitudinal. Transverse AWD exists. Do not infer transverse solely
  from FWD, or hide the crown gear solely because a vehicle has FWD.
- Front longitudinal assemblies rotate Y = 0; mid/rear longitudinal assemblies
  rotate Y = π; transverse assemblies rotate Y = -π/2. Whole-vehicle scales are
  intentionally smaller than bench scales.
- Routing rebuild keys include transmission, drive layout, engine architecture,
  engine orientation, and engine placement. Changing a mounting arrangement must
  replace its shafts, flow paths, and any transverse final-drive spur.
- Manual output is local `(12.1, -1.8, 0)`, DCT `(12.85, 0, 0)`, hybrid
  `(6.25, 0, 0)`. The automatic exposes `outputPosition` for its own endpoint.

## Animation, flows, and visibility

- Simulation owns angles, torques, transmission state, wheel speeds, and mounting
  compatibility. Models consume that state; avoid independent physics updates.
- Only advance a model's animation clock when `sim.paused` is false. Reversing
  torque or electrical power must reverse its corresponding animated flow.
- Each transmission owns its internal torque overlay. Vehicle routing only
  describes external shafts and axles; adding a second flow through the gearbox
  creates confusing overlapping cones.
- Flow particles and cones use `userData.ignorePick = true`. Selectable geometry
  and anchors use stable `userData.part` keys matched by `PARTS` in `main.js`, `POWERTRAIN_PARTS` and inspections.
- Apply section visibility after per-model updates, because updates may restore
  covers. Whole-vehicle LOD hides small meshes and `restoreDetail()` must undo it
  before a bench view or changed vehicle configuration.
- Bounds must use the current world matrix, remain finite, and cover the selected
  inspection. Inspecting an automatic section must use automatic bounds rather
  than the manual gearbox bounds.

## Verification

Run `npm test` and `npm run build` from the project root. The headless geometry
tests use real Three.js meshes without a WebGL renderer. Focus on attachment
alignment, finite camera bounds, reversible parenting, independent shaft
rotation, and paused/reversed flows. Visually check the whole vehicle and bench
views after changing geometry or model visibility; passing tests alone cannot
detect cluttered overlays, clipping, or an awkward camera angle.
