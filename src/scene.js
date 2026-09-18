import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EngineModel } from './models/engine-model.js';
import { DrivetrainModel } from './models/drivetrain-model.js';
import { TurboModel } from './models/turbo-model.js';
import { vec } from './models/geometry.js';

export class EngineScene {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.mode = 'engine';
    this.cutaway = true;
    this.labels = true;
    this.selectedCylinder = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12191f);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.06, 160);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute('aria-label', 'Model 3D silnika. Przeciągnij, aby obracać; przybliżaj kółkiem myszy lub dwoma palcami.');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.9;
    this.controls.addEventListener('start', () => { this.cameraGoal = null; });
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment);
    this.scene.environment = this.environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdceeff, 0x24303d, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 8, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x85baff, 1.7);
    rim.position.set(-5, 5, -7);
    this.scene.add(rim);
    const material = (color, metalness = 0.75, roughness = 0.35) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
    this.materials = {
      steel: material(0xa3b3c0, 0.85, 0.3), dark: material(0x334653), block: material(0x708795, 0.55, 0.4),
      brass: material(0xc39850, 0.7, 0.3), black: material(0x172128, 0.2, 0.8),
      intake: material(0x4f9cbd, 0.45, 0.36), exhaust: material(0xd68a6e, 0.5, 0.4),
      fuel: material(0xf5be4f, 0.45, 0.3), white: material(0xe0e5e2, 0.05, 0.4)
    };
    this.materials.block.side = THREE.DoubleSide;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.grid = new THREE.GridHelper(80, 80, 0x2b3f4c, 0x1e2e39);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.45;
    this.scene.add(this.grid);
    this.engine = new EngineModel(this.materials);
    this.drive = new DrivetrainModel(this.materials);
    this.turbo = new TurboModel(this.materials);
    this.root.add(this.engine.group, this.drive.group, this.turbo.group);
    this.leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.leaders.classList.add('model-leaders');
    container.append(this.leaders);
    this.refreshLabels();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setView('engine', true);
    this.raycaster = new THREE.Raycaster();
    let origin;
    this.renderer.domElement.addEventListener('pointerdown', event => { origin = [event.clientX, event.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (!origin || Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 6) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      const visible = object => object.visible && (!object.parent || visible(object.parent));
      const hits = this.raycaster.intersectObjects(this.root.children, true).filter(hit => visible(hit.object) && !hit.object.userData.ignorePick);
      if (!hits.length) return;
      let object = hits[0].object;
      let part, cylinder;
      while (object) {
        part ??= object.userData.part;
        cylinder ??= object.userData.cylinder;
        object = object.parent;
      }
      if (part) this.onSelect(part, cylinder);
    });
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('renderlost'));
    });
  }

  setEngine(id) {
    if (this.engine.id === id) return;
    this.engine.dispose();
    this.engine = new EngineModel(this.materials, id);
    this.root.add(this.engine.group);
    this.selectedCylinder = 0;
    this.refreshLabels();
    this.setView(this.mode);
  }

  refreshLabels() {
    this.labelElements?.forEach(({ element, line }) => { element.remove(); line.remove(); });
    this.labelElements = [...this.engine.anchors, ...this.drive.anchors, ...this.turbo.anchors].map(data => {
      const element = document.createElement('button');
      element.className = 'model-label';
      element.textContent = data.text;
      element.addEventListener('click', () => this.onSelect(data.part, data.cylinder));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.leaders.append(line);
      this.container.append(element);
      return { data, element, line };
    });
  }

  setView(mode, instant = false) {
    this.mode = mode;
    this.container.dataset.view = mode;
    this.container.dataset.engine = this.engine.id;
    this.container.dataset.cylinders = this.engine.config.cylinders;
    this.engine.setView(mode, this.selectedCylinder);
    this.drive.setView(mode);
    this.drive.group.position.set(['clutch', 'gearbox'].includes(mode) ? 0 : this.engine.shaftEnd + 0.15, 0.8, 0);
    this.turbo.group.visible = mode === 'turbo';
    this.grid.position.y = ['drive', 'gearbox'].includes(mode) ? -2.8 : mode === 'clutch' ? -0.75 : -0.1;
    this.root.updateMatrixWorld(true);
    let bounds;
    if (mode === 'turbo') bounds = new THREE.Box3(vec(-3.6, 0.5, -1), vec(3.7, 4, 1.1));
    else if (['clutch', 'gearbox'].includes(mode)) bounds = this.drive.bounds(mode);
    else {
      bounds = this.engine.bounds(mode, this.selectedCylinder);
      if (mode === 'drive') bounds.union(this.drive.bounds(mode));
      if (mode === 'engine') bounds.max.x += 0.3;
    }
    const directions = {
      engine: this.engine.config.bankAngle ? vec(0.75, 0.75, 1.3) : vec(0.65, 0.36, 1.5),
      cylinder: vec(0.6, 0.15, 1.7), drive: vec(0.45, 0.36, 1.5),
      clutch: vec(1.2, 0.45, 1.5), gearbox: vec(0.6, 0.46, 1.8), turbo: vec(0.9, 0.4, 1.5)
    };
    this.fitBounds(bounds, directions[mode], instant);
  }

  fitBounds(bounds, direction, instant) {
    direction.normalize();
    const center = bounds.getCenter(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(vec(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanY = Math.tan(this.camera.fov / 2 * Math.PI / 180) * 0.82;
    const tanX = Math.tan(this.camera.fov / 2 * Math.PI / 180) * this.camera.aspect * 0.9;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const corner = vec(x, y, z).sub(center);
      const depth = corner.dot(direction);
      distance = Math.max(distance, Math.abs(corner.dot(right)) / tanX + depth, Math.abs(corner.dot(up)) / tanY + depth);
    }
    this.targetGoal = center;
    this.cameraGoal = center.clone().addScaledVector(direction, distance * (this.camera.aspect > 1.5 && this.mode !== 'cylinder' ? 0.88 : 1.04));
    if (instant) {
      this.camera.position.copy(this.cameraGoal);
      this.controls.target.copy(this.targetGoal);
      this.cameraGoal = null;
      this.controls.update();
    }
  }

  selectCylinder(index) {
    this.selectedCylinder = Math.min(index, this.engine.config.cylinders - 1);
    if (this.mode === 'cylinder') this.setView('cylinder');
  }

  zoom(factor) {
    this.cameraGoal = null;
    this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);
    this.controls.update();
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.engine) this.setView(this.mode, true);
  }

  render(sim, dt) {
    this.engine.update(sim, this.cutaway);
    this.drive.update(sim, this.cutaway);
    this.turbo.update(sim, dt);
    if (this.cameraGoal) {
      const lerp = 1 - Math.exp(-dt * 8);
      this.camera.position.lerp(this.cameraGoal, lerp);
      this.controls.target.lerp(this.targetGoal, lerp);
      if (this.camera.position.distanceTo(this.cameraGoal) < 0.02) this.cameraGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.renderLabels();
  }

  renderLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const occupied = [];
    this.labelElements.forEach(({ data, element, line }) => {
      const parentVisible = object => !object || object.visible && parentVisible(object.parent);
      const show = this.labels && data.views.includes(this.mode) && parentVisible(data.anchor) && (this.mode !== 'cylinder' || data.cylinder === this.selectedCylinder);
      element.hidden = !show;
      line.style.display = show ? '' : 'none';
      if (!show) return;
      if (element.textContent !== data.text) element.textContent = data.text;
      const position = data.anchor.getWorldPosition(new THREE.Vector3()).project(this.camera);
      let x = (position.x * 0.5 + 0.5) * width;
      let y = (-position.y * 0.5 + 0.5) * height;
      if (position.z > 1 || x < 5 || x > width - 5 || y < 5 || y > height - 5) {
        element.hidden = true;
        line.style.display = 'none';
        return;
      }
      const start = { x, y };
      const w = Math.min(width - 30, element.offsetWidth || 70);
      const h = element.offsetHeight || 26;
      x = Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, x));
      y = Math.max(82, Math.min(height - 68, y));
      for (let tries = 0; tries < 8 && occupied.some(r => Math.abs(r.x - x) < (r.w + w) / 2 + 5 && Math.abs(r.y - y) < (r.h + h) / 2 + 4); tries++) y += h + 5;
      if (y > height - 45) { element.hidden = true; line.style.display = 'none'; return; }
      occupied.push({ x, y, w, h });
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.classList.toggle('selected', data.cylinder !== undefined && data.cylinder === this.selectedCylinder);
      line.setAttribute('x1', start.x);
      line.setAttribute('y1', start.y);
      line.setAttribute('x2', x);
      line.setAttribute('y2', y);
      line.style.display = Math.hypot(start.x - x, start.y - y) > 8 ? '' : 'none';
    });
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.engine.dispose();
    this.drive.dispose();
    this.turbo.dispose();
    Object.values(this.materials).forEach(m => m.dispose());
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
