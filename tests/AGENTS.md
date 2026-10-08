# Verification

`npm test` discovers `*.test.js` with Node's built-in test runner. Browser tests use
`browser.spec.js` through `npm run test:browser` and are intentionally separate.

- Physics tests use Simulation without DOM/rendering and advance simulation time
  in bounded steps. Verify actual torque, energy, kinematic or transition behavior.
- Model fixtures use real Three.js geometry with palette materials. Dispose model
  resources and shared palette separately. Include new models in EngineScene fixtures.
- The happy-dom UI test loads the actual main.js with CSS imports removed, assigns
  temporary DOM globals, disables RAF and restores globals/timers afterward. WebGL
  fallback is expected there; it is an error in the Chromium browser test.
- Playwright launches a local server (or reuses port5173), stores browser binaries
  and temporary data under `.cache/`, and screenshots under `artifacts/browser/`.
  Allow camera transitions to finish before visual inspection. Keep source unchanged
  during browser runs so HMR does not reset controls or invalidate assertions.
- Avoid tests that duplicate implementation constants without testing behavior.
  Favor dirty-state preset transitions, disconnected torque paths, energy limits,
  finite camera bounds, paused motion, mounting alignment and real interaction.

- `manual-detail.test.js` checks progressive clamp before a gap opens, friction
  heat, independent disc rotation, bearings, cones and dog/sleeve indexing. Keep
  connection readouts consistent with contact, not the shift interlock threshold.
- Clutch containment checks need actual transformed vertices at several crank
  and input phases. An overlapping AABB alone does not prove a mounting or a
  clear cut edge. `scene-performance.test.js` checks hidden-matrix skipping,
  restored/reparented transforms, instanced meshes and stable label measurements.
  Compare actual updateMatrix compositions when matrix APIs change; counts of
  updateMatrixWorld calls alone cannot be compared to an updateWorldMatrix pass.
- `clutch-clarity.test.js` checks actual spring triangles against solid support
  boxes and cylinders, tooth OBBs and the rigid piston/head/fluid chamber.
  Browser clutch checks compare the same WebGL frame with contact cues shown
  and hidden: text changes alone do not prove the two contact edges are visible.
  Include half pedal with equal shaft speeds so pedal position cannot fake slip.
- A selected gear inspection may show a free gear while another gear is active.
  Check its own free-wheel RPM and explanation; do not label it as connected.
- Keep the timing belt visible under vehicle LOD and verify isolated heads restore
  the full engine. Inspect the screenshots for head/camshaft clipping after a fit.
- `head-timing-clarity.test.js`, `clutch-spacing.test.js` and
  `vehicle-proportions.test.js` check continuous shaft attachments, spaced layers,
  camera envelopes, compact differentials and routing that still meets wheel hubs.
- The browser matrix compares mechanism views in Ibiza, A4, 911, 508, Corolla
  hybrid and Veyron, as well as the general all-tab/preset/phone checks. Inspect
  whole-car, head, clutch and gearbox screenshots before deploying visual changes.
- FWD differential tests must exercise `vehicle.front`, mean halfshaft speed,
  cornering satellites, locks, pause and stopping the visual bench demo.
- Suspension tests should compare loaded equilibrium, wheel/body lag, damping
  decay, asymmetric road roll, rigid axle endpoints and unilateral tyre contact.
  Use the same road sampling function for visual and physics assertions.
- The browser lesson test covers clutch release/isolated parts, selector/cone/dog
  stages, both DCT branches, five suspension types, isolated details and phone UI.
  A paused capture can use the actual suspension step button to reach an obstacle
  deterministically; camera fits run through the real inspection selector.
- The compact-navigation browser test checks text-range bounds, not just DOM
  presence. Keep every view and engine name inside its button before any click
  or screenshot can scroll it into view. Include phone/tablet/fullscreen layouts;
  the eight views and nine header engines must remain accessible without a strip
  scrollbar. Boxer 4 is still tested through the Subaru preset.
- `scene-picking.test.js` uses the actual raycaster and OrbitControls to check
  right-click picking with labels off, ancestor visibility and right-button pan.
  A drag returning to its start must still count as a drag, not a selection.
- The suspension-body browser scenario captures all five layouts with labels
  on/off, split-road roll, and rest/close-ups for multilink and push/pull. Check
  actual images for mounting continuity, not just finite bounds. It also picks
  a rendered damper by right click in normal and fullscreen views with labels off.
  Inspect both push/pull actuation close-ups with and without isolation; a test
  pass does not prove that a low rocker is visible behind the wheel or body.
- `suspension-travel.test.js` checks hard travel/roll stops across the road controls,
  rigid-axle DOFs, vertical momentum and inelastic impact energy. Keep these
  checks separate from real-mesh rod closure in `suspension-connections.test.js`.
