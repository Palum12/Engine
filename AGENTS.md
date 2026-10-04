# Engine / Lab

Polish educational mechanics app built with plain ES modules, Three.js and Vite.
There is no backend, React, remote asset CDN or database. Work inside this project;
keep browser downloads, profiles and QA outputs under `.cache/` or `artifacts/`.
Do not push or deploy unless the current user task authorizes it. A push to `main`
triggers GitHub Pages deployment through `.github/workflows/pages.yml`.

## Start and verify

- Node 22.12+ and npm. Install with `npm ci`; start with `npm run dev`.
- `npm test` runs Node tests for physics, Three.js geometry, camera input and the
  actual interface in happy-dom. `npm run build` creates the static site in `dist/`.
- For actual WebGL QA: `npm run browser:install`, then `npm run test:browser`.
  Playwright uses Chromium, a local Vite server and `artifacts/browser/` screenshots.
  It checks every tab, every car preset, automatic inspections and phone layout.
  Do not edit browser-facing source during this run: Vite HMR can reset test state.
- Follow up visual changes by opening generated screenshots. A DOM or geometry
  test alone does not prove a clear camera view. GPU and physical touchpad behavior
  still need checking on the user's target device.

## Code map

- `src/main.js`: DOM templates, event handlers, display synchronization, animation
  loop. `Simulation` is the only physics state; `EngineScene` consumes it.
- `src/simulation.js`, `powertrain.js`: stepping, gear changes, traction, axle
  torque splitting, engine mounting compatibility and transmission constants.
- `src/automatic.js`: torque converter, stator, lock-up, shifts and the educational
  eight-speed planetary transmission. `src/hybrid.js`: e-CVT/DC energy balance.
- `src/engines.js`: ten cylinder architectures, including R3 for Ibiza 1.0 MPI,
  firing offsets and crank layout.
- `src/manual-clutch.js`: shared progressive clamp/capacity/release state for
  manual physics, geometry and UI. Force falls before a visible plate gap opens.
- `src/suspension.js`: separate axle experiment owned by `Simulation.suspension`.
  `suspensionActive` switches stepping to this experiment, with its own tempo.
  `src/suspension-ui.js` supplies controls/descriptions; the procedural model is
  `src/models/suspension-model.js`. Road heights used by tyres and meshes must agree.
- `src/car-presets.js`: concrete car years/variants, factory data and primary links.
  `src/car-configuration.js` applies presets through simulation setters and resets
  old shift/slip/traction state. These are architecture presets, not OEM performance
  simulations. Manual has 5 gears, DCT 6, hydrokinetic automatic 8; notes disclose
  differences from factory transmissions.
- `src/scene.js`: renderer, camera fit, labels, picking, bench/vehicle reparenting.
  Read `src/models/AGENTS.md` before changing assembly geometry or routing.
- `src/inspection.js`: context-sensitive sections. `src/powertrain-ui.js` supplies
  configuration templates and part descriptions; `src/scenarios.js` runs lessons.
- CSS is split: `style.css` base, `layout.css` page, `inspection.css` mechanism
  tools, `cycle.css` stroke panel, `powertrain.css` vehicle/presets, `camera.css` gestures.
- `docs/` records manufacturer references, chosen variants and model simplifications.
  `PROMPT.md` is historical context, not a current specification.
- `docs/NEXT_SESSION.md` records user feedback and implementation status.
  Check the linked `docs/MECHANISM_AND_SUSPENSION_QA.md` for verification evidence
  and limitations; a checked backlog item alone is not proof of a clear view.

## Conventions and pitfalls

- Write UTF-8 and preserve Polish diacritics. PowerShell-to-Python stdin can lose
  non-ASCII text; prefer patches or explicit Unicode escapes for source edits.
- Distances/meshes are illustrative; physics uses SI internally. RPM = rad/s ×30/π.
  Engine phase spans 720 degrees; `animationScale` slows visuals, not physics.
- Engine orientation (`longitudinal`/`transverse`) and placement (`front`/`mid`/`rear`)
  are separate from driven axles. FWD can be longitudinal. Hybrid supports only R4,
  front/transverse/FWD. Setters enforce supported combinations; refresh UI controls
  and the scene after automatic compatibility changes.
- Changing away from e-CVT while its dedicated tab is selected must leave that
  tab, or `changeView('hybrid')` would immediately re-enable e-CVT.
- Keep part IDs unique across subsystems: `turbine` is the turbo part,
  `converterTurbine` is the automatic part (inspection section remains `turbine`).
- Whole-vehicle flow only overlays external shafts; manual internal arrows appear
  in clutch/gearbox inspections. The Przepływ checkbox controls flow overlays.
- Touchpad vertical wheel pan uses `controls.pan(deltaX, -deltaY)`; pinch affects
  camera distance. Mouse wheel zoom and touch dragging retain their own behavior.
- Tests importing the actual main.js strip CSS with a CRLF-compatible expression.
  Do not introduce Node-only imports into browser modules.
- Mounting/drive/transmission controls live in `#mount-settings` above the canvas.
  Refresh automatic compatibility changes in all controls and preset indicators.
- `refreshClutchState()` initializes and clears manual torque/force/heat telemetry
  on reset and engine/transmission changes. The 85% pedal threshold only interlocks
  starting/shifting; use `manualClutchState().contact` for clutch connection status.
- FWD differential inspections select `vehicle.front`; RWD selects `vehicle.rear`.
  The bench demo is visual and independent of vehicle physics. Stop it on pedals,
  view/configuration/preset changes. Straight travel naturally has equal speeds.
- Suspension is a standalone one-axle lesson, independent of the car preset.
  Global pause freezes it; its step button advances 0.1 simulation seconds.
  Equal wheel spring/damper rates compare layouts without inventing OEM tuning.
  Pushrod/pullrod actuate inboard springs; double wishbones still guide the wheels.
  Leaf springs use a rigid axle with heave/roll. Keep unilateral tyre contact.
- Manual gearbox sections `selector` and `synchronizer` expose the actuation
  path and one cropped mechanism. Keep `setSynchronizerGear`, `applySection`,
  section bounds and the actual staged Simulation shift consistent.
- Ferrari's preset name "F1 DCT" is a road-car dual-clutch transmission. Our
  shared six-speed educational DCT is not an exact seven-speed Ferrari gearbox.
