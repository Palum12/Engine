import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { PerspectiveCamera, Vector3, MOUSE, TOUCH } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CameraInput } from '../src/camera-input.js';

async function fixture(run) {
  const window = new Window();
  const scene = window.document.createElement('div');
  const canvas = window.document.createElement('canvas');
  const label = window.document.createElement('button');
  scene.append(canvas, label);
  window.document.body.append(scene);
  Object.defineProperties(canvas, { clientHeight: { value: 500 }, clientWidth: { value: 700 } });
  const camera = new PerspectiveCamera(40, 1.4, 0.06, 160);
  camera.position.set(0, 3, 10);
  const controls = new OrbitControls(camera, canvas);
  controls.minDistance = 1.8;
  controls.maxDistance = 65;
  let interactions = 0;
  const input = new CameraInput(scene, controls, () => interactions++);
  const wheel = (target, options) => {
    const event = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, ...options });
    for (const key of ['ctrlKey', 'metaKey', 'shiftKey']) Object.defineProperty(event, key, { value: Boolean(options[key]) });
    target.dispatchEvent(event);
    return event;
  };
  const gesture = (name, scale) => {
    const event = new window.Event(name, { bubbles: true, cancelable: true });
    event.scale = scale;
    label.dispatchEvent(event);
    return event;
  };
  try { await run({ window, scene, canvas, label, camera, controls, input, wheel, gesture, interactions: () => interactions }); }
  finally { input.dispose(); controls.dispose(); await window.happyDOM.close(); }
}

test('pinch over canvas and labels cancels page zoom and changes only camera distance, including during a drag', async () => {
  await fixture(({ camera, controls, canvas, label, wheel, interactions }) => {
    controls.state = 0;
    for (const target of [canvas, label]) {
      const distance = camera.position.distanceTo(controls.target);
      const center = controls.target.clone();
      assert.equal(wheel(target, { ctrlKey: true, deltaY: -12 }).defaultPrevented, true);
      assert.ok(camera.position.distanceTo(center) < distance);
      assert.ok(controls.target.equals(center));
    }
    assert.equal(interactions(), 2);
  });
});

test('touchpad scrolling pans both camera and target without changing viewing distance', async () => {
  await fixture(({ camera, controls, canvas, input, wheel }) => {
    input.setDevice('touchpad');
    const cameraBefore = camera.position.clone();
    const targetBefore = controls.target.clone();
    const distance = camera.position.distanceTo(controls.target);
    wheel(canvas, { deltaX: 15, deltaY: 90 });
    assert.ok(controls.target.distanceTo(targetBefore) > 0.1);
    assert.ok(camera.position.clone().sub(cameraBefore).distanceTo(controls.target.clone().sub(targetBefore)) < 1e-8);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - distance) < 1e-8);
  });
});

test('auto recognizes small pixel gestures, while explicit mouse and line wheels zoom', async () => {
  await fixture(({ camera, controls, canvas, input, wheel }) => {
    wheel(canvas, { deltaY: 6.5 });
    assert.ok(controls.target.distanceTo(new Vector3()) > 0);
    input.setDevice('mouse');
    const center = controls.target.clone();
    const distance = camera.position.distanceTo(center);
    wheel(canvas, { deltaY: 100 });
    assert.ok(camera.position.distanceTo(center) > distance);
    assert.ok(controls.target.equals(center));
    input.setDevice('auto');
    wheel(canvas, { deltaY: -3, deltaMode: 1 });
    assert.ok(controls.target.equals(center));
  });
});

test('Safari scale gestures zoom once and preserve distance limits', async () => {
  await fixture(({ camera, controls, label, wheel, gesture, input }) => {
    const distance = camera.position.distanceTo(controls.target);
    assert.equal(gesture('gesturestart', 1).defaultPrevented, true);
    gesture('gesturechange', 2);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - distance / 2) < 1e-8);
    wheel(label, { ctrlKey: true, deltaY: -10 });
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - distance / 2) < 1e-8);
    gesture('gestureend', 2);
    input.zoom(0.00001);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 1.8) < 1e-8);
    input.zoom(100000);
    assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 65) < 1e-8);
  });
});

test('pan mode switches mouse and touchscreen dragging, and disposal and outside gestures preserve browser defaults', async () => {
  await fixture(({ window, scene, canvas, controls, input, wheel }) => {
    input.setPan(true);
    assert.equal(controls.mouseButtons.LEFT, MOUSE.PAN);
    assert.equal(controls.touches.ONE, TOUCH.PAN);
    assert.equal(controls.touches.TWO, TOUCH.DOLLY_PAN);
    assert.equal(scene.dataset.cameraPan, 'true');
    input.setPan(false);
    assert.equal(controls.mouseButtons.LEFT, MOUSE.ROTATE);
    assert.equal(controls.touches.ONE, TOUCH.ROTATE);
    assert.equal(wheel(window.document.body, { ctrlKey: true, deltaY: -5 }).defaultPrevented, false);
    input.dispose();
    assert.equal(wheel(scene, { ctrlKey: true, deltaY: -5 }).defaultPrevented, false);
    controls.enabled = false;
    assert.equal(wheel(canvas, { ctrlKey: true, deltaY: -5 }).defaultPrevented, false);
  });
});
