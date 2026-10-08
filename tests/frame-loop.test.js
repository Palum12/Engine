import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameLoop } from '../src/frame-loop.js';
import { Window } from 'happy-dom';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function fixture() {
  let next = 0, active = false, visible = true, moving = false, fps = 60;
  const pending = new Map(), steps = [], renders = [], updates = [];
  const loop = createFrameLoop({
    requestFrame: callback => { pending.set(++next, callback); return next; }, cancelFrame: id => pending.delete(id),
    isActive: () => active, isVisible: () => visible, maxFps: () => fps,
    advance: dt => steps.push(dt), render: dt => { renders.push(dt); return moving; }, updateUI: () => updates.push(1)
  });
  const frame = time => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(time)); };
  return { loop, pending, steps, renders, updates, frame, active: value => { active = value; }, visible: value => { visible = value; }, moving: value => { moving = value; }, fps: value => { fps = value; } };
}
test('settled pause sleeps, coalesces invalidations, and wakes for input without catching up idle time', () => {
  const f = fixture();
  f.loop.invalidate(); f.loop.invalidate();
  assert.equal(f.pending.size, 1);
  f.frame(0);
  assert.equal(f.renders.length, 1);
  assert.equal(f.updates.length, 1);
  assert.equal(f.pending.size, 1, 'a zero-dt wake must allow one real clock step for changed derived state');
  f.frame(16);
  assert.equal(f.pending.size, 0);
  f.loop.invalidate(); f.frame(100000);
  assert.equal(f.steps.at(-1), 0, 'idle time must not be integrated');
  f.frame(100016);
  assert.equal(f.steps.at(-1), .016);
  assert.equal(f.pending.size, 0, 'the refreshed idle scene sleeps again');
  f.loop.dispose(); f.loop.invalidate();
  assert.equal(f.pending.size, 0);
});
test('camera damping keeps frames alive while physics is paused, then settles', () => {
  const f=fixture(); f.moving(true); f.loop.invalidate(); f.frame(0); f.frame(16); assert.equal(f.pending.size,1);
  f.moving(false); f.frame(32); assert.equal(f.pending.size,0);
});
test('30 fps drawing preserves every physics step and elapsed simulation time', () => {
  const run=fps => { const f=fixture(); f.active(true); f.fps(fps); f.loop.invalidate(); for(let i=0;i<=60;i++)f.frame(i*1000/60); f.loop.dispose(); return f; };
  const a=run(60), b=run(30);
  assert.deepEqual(a.steps,b.steps); assert.ok(b.renders.length <= 32); assert.ok(a.renders.length >= 59);
  assert.ok(Math.abs(b.steps.reduce((a,b)=>a+b,0)-1)<.001);
});
test('hidden tabs stop scheduling and visibility wake does not integrate the hidden interval', () => {
  const f=fixture();f.active(true);f.loop.invalidate();f.frame(0);f.visible(false);f.frame(16);assert.equal(f.pending.size,0);
  f.visible(true);f.loop.invalidate();f.frame(10000);assert.equal(f.steps.at(-1),0);f.loop.dispose();
});

test('the final simulation state is drawn and synchronized before the loop sleeps', () => {
  for (const fps of [30, 60]) {
    let value = 0, active = true, callback;
    const draws = [], readouts = [];
    const loop = createFrameLoop({
      requestFrame: next => { callback = next; return 1; },
      cancelFrame: () => { callback = undefined; },
      isActive: () => active, isVisible: () => true, maxFps: () => fps,
      advance: dt => { if (dt > 0) { value = 42; active = false; } },
      render: () => { draws.push(value); return false; },
      updateUI: () => readouts.push(value)
    });
    const frame = time => { const next = callback; callback = undefined; next?.(time); };
    loop.invalidate();
    frame(0);
    frame(1000 / 60);
    assert.equal(draws.at(-1), 42, `${fps} FPS must show the final model state`);
    assert.equal(readouts.at(-1), 42, `${fps} FPS must show the final telemetry`);
    assert.equal(callback, undefined, 'a fully synchronized settled scene can sleep');
    loop.dispose();
  }
});

test('visibility changes discard hidden time even when the browser suspends all hidden RAF callbacks', () => {
  const f = fixture();
  f.active(true);
  f.loop.invalidate();
  f.frame(0);
  f.frame(16);
  f.visible(false);
  f.loop.invalidate();
  assert.equal(f.pending.size, 0, 'a hidden document must cancel its pending callback immediately');
  f.visible(true);
  f.loop.invalidate();
  f.frame(10000);
  assert.equal(f.steps.at(-1), 0, 'resume starts a new browser-clock interval');
  f.loop.dispose();
});

test('real OrbitControls damping respects the render and telemetry budgets in economy mode', async () => {
  const window = new Window();
  const canvas = window.document.createElement('canvas');
  window.document.body.append(canvas);
  Object.defineProperties(canvas, { clientHeight: { value: 500 }, clientWidth: { value: 700 } });
  const camera = new PerspectiveCamera(40, 1.4, .06, 160);
  camera.position.set(0, 3, 10);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .01;
  let nextId = 0, draws = 0, readouts = 0;
  const callbacks = new Map();
  const loop = createFrameLoop({
    requestFrame: callback => { callbacks.set(++nextId, callback); return nextId; },
    cancelFrame: id => callbacks.delete(id),
    isActive: () => false, isVisible: () => true, maxFps: () => 30,
    advance: () => {}, render: () => { draws++; return controls.update(); },
    updateUI: () => readouts++
  });
  controls.addEventListener('change', () => loop.invalidate());
  const frame = time => {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(callback => callback(time));
  };
  try {
    loop.invalidate();
    frame(0);
    draws = readouts = 0;
    const before = camera.position.clone();
    controls.rotateLeft(.7);
    for (let i = 1; i <= 60; i++) frame(i * 1000 / 60);
    assert.ok(camera.position.distanceTo(before) > 1, 'camera damping must still advance');
    assert.ok(draws >= 29 && draws <= 31, `expected about 30 draws, received ${draws}`);
    assert.ok(readouts <= 14, `camera changes must not force telemetry every frame (${readouts})`);
    assert.equal(callbacks.size, 1, 'unfinished damping keeps its next frame scheduled');
    controls.dampingFactor = 1;
    for (let i = 61; i <= 70; i++) frame(i * 1000 / 60);
    assert.equal(callbacks.size, 0, 'the settled camera eventually sleeps');
    controls.rotateLeft(.2);
    assert.equal(callbacks.size, 1, 'a new camera interaction wakes the scene');
  } finally {
    loop.dispose();
    controls.dispose();
    await window.happyDOM.close();
  }
});
