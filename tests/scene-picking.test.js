import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, MOUSE } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EngineScene } from '../src/scene.js';

async function fixture(run) {
  const window = new Window();
  const canvas = window.document.createElement('canvas');
  window.document.body.append(canvas);
  Object.defineProperties(canvas, { clientHeight: { value: 500 }, clientWidth: { value: 700 } });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 700, height: 500 });
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  const camera = new PerspectiveCamera(40, 1.4, 0.06, 160);
  camera.position.set(0, 0, 10);
  camera.updateMatrixWorld();
  const controls = new OrbitControls(camera, canvas);
  const root = new Group();
  const geometry = new BoxGeometry(2, 2, 1);
  const material = new MeshBasicMaterial();
  const damper = new Mesh(geometry, material);
  damper.userData.part = 'suspensionDamper';
  root.add(damper);
  const selections = [];
  const scene = Object.create(EngineScene.prototype);
  Object.assign(scene, { renderer: { domElement: canvas }, camera, root, raycaster: new Raycaster(), cameraInput: { pan: false }, labels: false, onSelect: (...args) => selections.push(args) });
  scene.bindPicking();
  const pointer = (name, x = 350, y = 250, button = 2, extra = {}) => {
    const event = new window.PointerEvent(name, { bubbles: true, cancelable: true, clientX: x, clientY: y, button, buttons: name === 'pointerup' ? 0 : button === 2 ? 2 : 1, pointerId: 1, pointerType: 'mouse', isPrimary: true, ...extra });
    canvas.dispatchEvent(event);
    return event;
  };
  try { await run({ window, canvas, scene, root, geometry, material, controls, camera, selections, pointer }); }
  finally {
    for (const [name, listener] of Object.entries(scene.pickListeners)) canvas.removeEventListener(name, listener);
    controls.dispose(); geometry.dispose(); material.dispose(); await window.happyDOM.close();
  }
}

test('right click selects visible geometry with labels off and suppresses the canvas menu only', async () => {
  await fixture(({ window, canvas, scene, root, geometry, material, selections, pointer }) => {
    const hidden = new Group(); hidden.visible = false;
    const hiddenMesh = new Mesh(geometry, material); hiddenMesh.position.z = 4; hiddenMesh.userData.part = 'suspensionBody'; hidden.add(hiddenMesh);
    const flow = new Group(); flow.userData.ignorePick = true;
    const flowMesh = new Mesh(geometry, material); flowMesh.position.z = 3; flowMesh.userData.part = 'flow'; flow.add(flowMesh);
    root.add(hidden, flow); root.updateMatrixWorld(true);
    let rejectedRaycasts = 0;
    hiddenMesh.raycast = flowMesh.raycast = () => { rejectedRaycasts++; };
    pointer('pointerdown');
    const menu = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    canvas.dispatchEvent(menu);
    pointer('pointerup');
    assert.deepEqual(selections, [['suspensionDamper', undefined]]);
    assert.equal(rejectedRaycasts, 0, 'hidden and ignored subtrees are excluded before intersection work');
    assert.equal(scene.labels, false, 'selecting a part does not enable labels');
    assert.equal(menu.defaultPrevented, true);
    const outside = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    window.document.body.dispatchEvent(outside);
    assert.equal(outside.defaultPrevented, false);
  });
});

test('right-button pan drag never selects a part, including a drag that returns to its start', async () => {
  await fixture(({ controls, camera, selections, pointer }) => {
    const before = camera.position.clone();
    assert.equal(controls.mouseButtons.RIGHT, MOUSE.PAN);
    pointer('pointerdown'); pointer('pointermove', 430, 280);
    assert.ok(camera.position.distanceTo(before) > 0.1, 'OrbitControls still receives the pan drag');
    pointer('pointermove'); pointer('pointerup');
    assert.deepEqual(selections, []);
  });
});

test('left-button pan mode, cancelled pointers and secondary touches cannot accidentally select', async () => {
  await fixture(({ scene, selections, pointer }) => {
    scene.cameraInput.pan = true;
    pointer('pointerdown', 350, 250, 0); pointer('pointerup', 350, 250, 0);
    pointer('pointerdown'); pointer('pointercancel'); pointer('pointerup');
    pointer('pointerdown'); pointer('pointerdown', 350, 250, 0, { pointerId: 2, isPrimary: false }); pointer('pointerup');
    assert.deepEqual(selections, []);
    pointer('pointerdown'); pointer('pointerup');
    assert.equal(selections.length, 1, 'right click remains available while left-button pan mode is active');
  });
});
