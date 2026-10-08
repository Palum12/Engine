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
- Vehicle differentials use `setCoreScale(0.48)` while bench gears remain full
  size. Scale the central mechanism, bearings and inner joints independently of
  wheel reach. Use `inputEndpoint()` for longitudinal routing; the transverse
  spur cancels its carrier parent's scale to retain meshing pitch circles.
- Camshaft `shaftEndpoints` describe the actual shaft geometry. Timing-wheel
  connectors must use them, not the longer crankshaft's `shaftEnd`.

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

- Timing belts/chains must remain visible in vehicle overviews. Meshes marked
  `userData.lodEssential` are exempt from size-based LOD. Do not hide the whole
  `systems.timing` group while leaving disconnected camshafts visible.
- `cylinder-head.js` builds cutaway castings around the valve seats, guides, ports,
  gasket and combustion chamber. `setHeadView` hides lower engine parts only for
  an isolated head; `setView` must restore them before other inspections.
- Manual gears rotate freely on needle bearings until a sleeve joins dog teeth
  to its splined hub. Cones contact before dog engagement. Clutch geometry uses
  `manualClutchState`; keep contact, deformation, force and slip explanations in sync.
- Manual clutch explosion is an inspection layout, independent of pedal travel.
  Use `explodedGearboxOffset` for attached shaft/bounds spacing. The interface
  remembers the chosen bench layout; whole-car mounting always assembles parts.
- The clutch now uses a concentric hydraulic release actuator. The rotating
  bearing face is separate from its fixed cylinder. Keep the released pressure
  plate clear of the spring support/cover over the full pedal and exploded range.
  Do not add unexplained phase-marker boxes to physical friction surfaces.
- Keep the diaphragm's continuous outer web on the pressure back face and both
  fulcrum rings supported by cover ribs. Disc damper coils need actual end seats
  and webs joining the hub to the lining carrier; their envelope must clear the
  flywheel and pressure bore. Input splines end before the stationary guide.
  Section planes must clip real strip corners and coil triangles, not only hide
  a mesh by its center angle. Check independent shaft phases and full pedal travel.
  Reuse clipped geometry buffers; do not rebuild geometries during animation.
  DrivetrainModel.update defaults to updating matrices for standalone callers;
  EngineScene supplies false and prepares only visible world matrices itself.
- Selector rails move forks and sleeves, not the free gears. `synchronizer`
  crops shafts around one mechanism; returning to `all` must restore all shafts.
- DCT packs are axially staggered for readability, with connected baskets and
  concentric shaft tails. Gearbox positions and the output attachment stay fixed
  when the clutch inspection is exploded. Hydraulic lines end at rail actuators.
- Suspension uses X for travel and Z for the two wheels, with visual SI scale 4.
  Stable anchors use `labelHidden` for inactive layouts/far-side duplicates.
  Bounds traverse visible ancestors and detail sections fit the near-side parts.
  Body cutaway, subframe mounts and uprights must share the exact hardpoints
  used by moving links, spring seats and damper eyes. Do not substitute floating
  rods or a detached upper rectangle for visible load paths. Include body roll
  in every body-side hardpoint; keep the hub and upright connected through travel.
  Five-link layouts need five individual upright/subframe attachments. Push/pull
  rods supplement double wishbones and end at real pins of a pivoted rocker;
  the rocker pivot and fixed coilover end are mounted to the body. Keep all pins
  on the rocker mesh and telescopic damper sections overlapping over travel.
  Solve the rigid actuation rod in the rolling body's local frame, retaining
  its continuous rest branch. Check both force-relative travel limits plus
  body roll; a clamped inverse cosine must not silently stretch the rod.
  Overview labels name only important mechanisms; wheels/road and far-side
  duplicates stay selectable without permanent labels. Label visibility must
  never disable raycasting or right-click part descriptions.
  Actuator close-ups look from negative X along the rocker shaft; a +Z wheel-side
  view hides the low pullrod behind the wheel and sill. Keep isolation optional.
  Whole-axle camera bounds include only nearby road (X ±4 scene units); the full
  moving road remains rendered and its dedicated section still fits the road.
- A continuous casting joins each head's chambers in engine views; the single
  chamber casting is retained for cylinder views. Only the first head anchor has
  `userData.overview`, keeping a discoverable head label in vehicle overviews.

Run `npm test` and `npm run build` from the project root. The headless geometry
tests use real Three.js meshes without a WebGL renderer. Focus on attachment
alignment, finite camera bounds, reversible parenting, independent shaft
rotation, and paused/reversed flows. Visually check the whole vehicle and bench
views after changing geometry or model visibility; passing tests alone cannot
detect cluttered overlays, clipping, or an awkward camera angle.
