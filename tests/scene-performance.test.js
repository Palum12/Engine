import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { Scene, Group, Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial, Matrix4, PerspectiveCamera, Vector3, Box3 } from 'three';
import { EngineScene } from '../src/scene.js';

test('clutch camera keeps the physical mechanism clear of the status card and bottom controls', () => {
  for (const [width, height] of [[1000, 460], [390, 500], [1440, 720]]) {
    const scene = Object.create(EngineScene.prototype);
    const camera = new PerspectiveCamera(40, width / height, 0.06, 160);
    const target = new Vector3();
    Object.assign(scene, {
      camera, mode: 'clutch', inspection: 'all', sim: { transmission: 'manual' },
      container: { clientWidth: width, clientHeight: height },
      controls: { target, update() { camera.lookAt(target); camera.updateMatrixWorld(); } }
    });
    for (const extent of [1.8, 4.4]) {
      const bounds = new Box3(new Vector3(-0.2, -1.3, -1.3), new Vector3(extent, 1.3, 0.05));
      scene.fitBounds(bounds, new Vector3(0.025, 0.04, 1.9), true);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        const screenX = (projected.x + 1) * width / 2;
        const screenY = (1 - projected.y) * height / 2;
        assert.ok(screenX > 0 && screenX < width, `horizontal camera clipping at ${width} × ${height}`);
        assert.ok(screenY > Math.min(width < 600 ? 225 : 150, height * 0.45), `mechanism behind the status card at ${width} × ${height}`);
        assert.ok(screenY < height - Math.min(width < 600 ? 95 : 65, height * 0.20), `mechanism behind bottom controls at ${width} × ${height}`);
      }
    }
  }
});

test('the render matrix pass skips hidden descendants and refreshes them when shown or reparented', () => {
  const scene = Object.create(EngineScene.prototype);
  scene.scene = new Scene();
  const visible = new Group();
  visible.position.set(2, 1, -3);
  visible.rotation.y = Math.PI / 2;
  visible.scale.setScalar(0.5);
  const hidden = new Group();
  hidden.visible = false;
  const detail = new Object3D();
  detail.position.set(1, 2, 3);
  hidden.add(detail);
  visible.add(hidden);
  scene.scene.add(visible);
  let hiddenUpdates = 0;
  const update = detail.updateMatrix.bind(detail);
  detail.updateMatrix = () => { hiddenUpdates++; update(); };
  scene.updateVisibleMatrices();
  assert.equal(hiddenUpdates, 0, 'a hidden assembly must not animate its otherwise visible descendants');

  detail.position.set(4, 5, 6);
  hidden.visible = true;
  scene.updateVisibleMatrices();
  assert.equal(hiddenUpdates, 1);
  const expected = new Vector3(4, 5, 6).applyMatrix4(visible.matrixWorld);
  assert.ok(new Vector3().setFromMatrixPosition(detail.matrixWorld).distanceTo(expected) < 1e-9);

  hidden.visible = false;
  visible.position.x = 8;
  scene.updateVisibleMatrices();
  assert.equal(hiddenUpdates, 1);
  scene.scene.add(hidden);
  hidden.position.z = 7;
  hidden.visible = true;
  scene.updateVisibleMatrices();
  assert.ok(new Vector3().setFromMatrixPosition(detail.matrixWorld).distanceTo(new Vector3(4, 5, 13)) < 1e-9, 'returning from a mounted view must use the current parent and pose');
});

test('visible instanced geometry retains both its instance transform and the current world transform', () => {
  const scene = Object.create(EngineScene.prototype);
  scene.scene = new Scene();
  const parent = new Group();
  parent.position.x = 3;
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial();
  const mesh = new InstancedMesh(geometry, material, 1);
  parent.add(mesh); scene.scene.add(parent);
  try {
    const instance = new Matrix4().makeTranslation(0, 4, 0);
    mesh.setMatrixAt(0, instance);
    parent.rotation.z = Math.PI / 2;
    scene.updateVisibleMatrices();
    const actual = new Matrix4(); mesh.getMatrixAt(0, actual);
    assert.deepEqual(actual.elements, instance.elements);
    assert.ok(new Vector3(0, 0, 0).applyMatrix4(actual).applyMatrix4(mesh.matrixWorld).distanceTo(new Vector3(-1, 0, 0)) < 1e-9);
  } finally { geometry.dispose(); material.dispose(); }
});

test('manual local and world matrices retain their Three.js update semantics', () => {
  const scene = Object.create(EngineScene.prototype);
  scene.scene = new Scene();
  const parent = new Group();
  const local = new Object3D();
  local.matrixAutoUpdate = false;
  local.matrix.makeTranslation(0, 3, 0);
  const world = new Object3D();
  world.matrixWorldAutoUpdate = false;
  world.matrixWorld.makeTranslation(8, 9, 10);
  parent.add(local, world); scene.scene.add(parent);
  scene.updateVisibleMatrices();
  parent.position.x = 4;
  scene.updateVisibleMatrices();
  assert.deepEqual(new Vector3().setFromMatrixPosition(local.matrixWorld).toArray(), [4, 3, 0], 'a manually composed local matrix still follows a moving parent');
  assert.deepEqual(new Vector3().setFromMatrixPosition(world.matrixWorld).toArray(), [8, 9, 10], 'an explicitly managed world matrix remains untouched');
});

test('stable label frames reuse measured sizes and leave unchanged DOM attributes alone', async () => {
  const window = new Window();
  try {
    const scene = Object.create(EngineScene.prototype);
    const camera = new PerspectiveCamera(40, 1.4, 0.06, 160);
    camera.position.z = 10; camera.updateMatrixWorld();
    Object.assign(scene, { camera, container: { clientWidth: 700, clientHeight: 500 }, labels: true, mode: 'clutch', inspection: 'all', isolate: false, drive: { exploded: 0 }, sim: { transmission: 'manual' }, labelSizeRevision: 0 });
    let measurements = 0;
    const anchor = new Object3D(); anchor.updateMatrixWorld();
    const element = window.document.createElement('button');
    const line = window.document.createElementNS('http://www.w3.org/2000/svg', 'line');
    window.document.body.append(element, line);
    Object.defineProperties(element, { offsetWidth: { get() { measurements++; return 120; } }, offsetHeight: { get() { measurements++; return 26; } } });
    scene.labelElements = [{ data: { anchor, text: 'Docisk', assembly: 'clutch', part: 'pressurePlate', views: ['clutch'] }, element, line }];
    scene.renderLabels();
    assert.equal(measurements, 2);
    const observer = new window.MutationObserver(() => {});
    observer.observe(element, { attributes: true }); observer.observe(line, { attributes: true });
    scene.renderLabels();
    assert.equal(measurements, 2, 'unchanged labels must not force another layout measurement');
    assert.deepEqual(observer.takeRecords(), [], 'unchanged labels must not dirty the compositor every frame');
    scene.labelSizeRevision++;
    scene.renderLabels();
    assert.equal(measurements, 4, 'resizing/font changes invalidate cached dimensions');
    scene.labels = false;
    scene.renderLabels();
    assert.equal(element.hidden, true);
    assert.equal(line.style.display, 'none');
    assert.equal(measurements, 4);
    observer.disconnect();
  } finally { await window.happyDOM.close(); }
});
