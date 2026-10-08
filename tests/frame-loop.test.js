import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrameLoop } from '../src/frame-loop.js';

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
  const f=fixture(); f.loop.invalidate(); f.loop.invalidate(); assert.equal(f.pending.size,1);
  f.frame(0); assert.equal(f.renders.length,1); assert.equal(f.updates.length,1); assert.equal(f.pending.size,0);
  f.loop.invalidate(); f.frame(100000); assert.ok(f.steps.at(-1) <= .1); assert.equal(f.renders.length,2);
  f.loop.dispose(); f.loop.invalidate(); assert.equal(f.pending.size,0);
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
