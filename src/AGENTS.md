# Application changes

Read the root `AGENTS.md` first. Use existing ES-module patterns and Polish UI.

Adding a transmission requires coordinated changes to simulation state/ratios,
its procedural model, `EngineScene` lifecycle, `VehicleModel` mounting/routing,
`getInspections`, descriptions, control visibility, quick gear controls, telemetry
and scenario availability. Avoid showing manual pedal/synchronizer instructions
for automatics. Physics, model animation and readouts must use the same state.

Adding a car preset requires an explicit year/market/variant and manufacturer
sources in `docs/CAR_PRESET_REFERENCES.md`. State deviations from the shared models
in the note, especially factory gear counts, AWD topology, turbo counts and engine
geometry. Apply through `applyCarPreset`; test transitions from other powertrains.

`main.js` eagerly creates all controls, then synchronizes their `hidden` flags and
values. Preserve unique DOM IDs and delegated listeners for regenerated buttons.
Changing a preset/configuration stops the scenario. Scenario preparation must
preserve orientation and placement; a lesson may deliberately change drive mode.

Bench and whole-vehicle views reuse the same meshes. On engine replacement,
rebuild SystemsModel and connecting pipes, update VehicleModel's model references,
rebuild labels and restore cylinder selection. Hybrid's compatibility setter can
replace the engine with R4; keep both the selected UI engine and mesh consistent.
