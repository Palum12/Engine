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
