import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EngineModel } from './models/engine-model.js';
import { DrivetrainModel } from './models/drivetrain-model.js';
import { TurboModel } from './models/turbo-model.js';
import { ModelGeometry, vec } from './models/geometry.js';
import { SystemsModel } from './models/systems-model.js';
import { FinalDriveModel } from './models/final-drive-model.js';

export class EngineScene {
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.mode = 'engine';
    this.cutaway = true;
    this.labels = true;
    this.inspection = 'all';
    this.isolate = false;
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
    this.finalDrive = new FinalDriveModel(this.materials);
    this.systems = new SystemsModel(this.materials, this.engine);
    this.root.add(this.engine.group, this.drive.group, this.turbo.group, this.finalDrive.group, this.systems.group);
    this.buildConnections();
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
    this.systems.dispose();
    this.engine = new EngineModel(this.materials, id);
    this.systems = new SystemsModel(this.materials, this.engine);
    this.root.add(this.engine.group, this.systems.group);
    this.selectedCylinder = 0;
    this.buildConnections();
    this.refreshLabels();
    this.setView(this.mode);
  }

  refreshLabels() {
    this.labelElements?.forEach(({ element, line }) => { element.remove(); line.remove(); });
    const labels = [
      ...this.engine.anchors.map(data => Object.assign(data, { assembly: 'engine' })),
      ...this.drive.anchors.map(data => Object.assign(data, { assembly: data.views.includes('clutch') || data.part === 'clutch' ? 'clutch' : 'gearbox' })),
      ...this.turbo.anchors.map(data => Object.assign(data, { assembly: 'turbo' })),
      ...this.systems.anchors.map(data => Object.assign(data, { assembly: data.views.includes('timing') ? 'timing' : data.views.includes('oil') ? 'oil' : 'fuel' })),
      ...this.finalDrive.anchors.map(data => Object.assign(data, { assembly: 'finalDrive' }))
    ];
    this.labelElements = labels.map(data => {
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

  buildConnections() {
    this.connections?.dispose();
    this.connections = new ModelGeometry(this.materials);
    const g = this.connections;
    const intake = g.material({ color: 0x69bbd6, metalness: 0.35, roughness: 0.4, transparent: true, opacity: 0.35, depthWrite: false });
    const exhaust = g.material({ color: 0xc78165, metalness: 0.35, roughness: 0.4, transparent: true, opacity: 0.35, depthWrite: false });
    this.engine.group.updateMatrixWorld(true);
    for (const c of this.engine.cylinders) {
      const inlet = c.unit.localToWorld(vec(-0.87, 4.71, -0.03));
      const outlet = c.unit.localToWorld(vec(0.87, 4.7, -0.03));
      g.pipe(g.curve([[c.layout.x, 6.3, -2.9], [c.layout.x, 5.7, -2.7], inlet]), 0.1, intake, g.group, 'intake');
      g.pipe(g.curve([outlet, [c.layout.x, 5.3, -3.8], [c.layout.x, 5.8, -4.1]]), 0.1, exhaust, g.group, 'exhaust');
    }
    const half = this.engine.length / 2;
    g.pipe(g.curve([[-half, 6.3, -2.9], [0, 6.3, -2.9], [half, 6.3, -2.9]]), 0.18, intake, g.group, 'intake');
    g.pipe(g.curve([[-half, 5.8, -4.1], [0, 5.8, -4.1], [half, 5.8, -4.1]]), 0.18, exhaust, g.group, 'exhaust');
    g.pipe(g.curve([[0, 5.8, -4.1], [-4, 5.8, -5.5], [-4.5, 3.9, -7.2]]), 0.18, exhaust, g.group, 'exhaust');
    g.pipe(g.curve([[-1.8, -1.15, -7.2], [-2.5, -0.8, -6], [-2.5, 6.3, -4.5], [0, 6.3, -2.9]]), 0.18, intake, g.group, 'intake');
    this.root.add(g.group);
    g.group.visible = false;
  }

  setView(mode, instant = false) {
    if (mode !== this.mode) { this.inspection = 'all'; this.isolate = false; }
    this.mode = mode;
    this.container.dataset.view = mode;
    this.container.dataset.engine = this.engine.id;
    this.container.dataset.cylinders = this.engine.config.cylinders;
    this.engine.setView(mode, this.selectedCylinder);
    this.drive.setView(mode);
    this.drive.group.position.set(['clutch', 'gearbox'].includes(mode) ? 0 : this.engine.shaftEnd + 0.15, 0.8, 0);
    this.turbo.group.visible = mode === 'turbo' || mode === 'drive-detail';
    this.turbo.setSection(mode === 'turbo' ? this.inspection : 'all', mode === 'turbo' && this.isolate);
    this.turbo.group.position.set(0, mode === 'drive-detail' ? 2 : 2.3, mode === 'drive-detail' ? -7.2 : 0);
    this.finalDrive.group.visible = ['drive-detail', 'differential'].includes(mode);
    if (mode !== 'differential') this.finalDrive.demo = false;
    this.systems.setView(mode, this.inspection, this.isolate);
    if (['timing','oil','fuel'].includes(mode)) this.engine.group.visible = !this.isolate;
    this.connections.group.visible = mode === 'drive-detail';
    this.positionDetailedDrive();
    this.grid.position.y = ['oil','fuel','drive', 'drive-detail', 'gearbox', 'turbo'].includes(mode) ? -2.8 : mode === 'clutch' ? -0.75 : -0.1;
    this.applyInspection();
    this.drive.gears.forEach((gear,i) => {
      const visible = mode !== 'gearbox' || !this.inspection.startsWith('gear') || Number(this.inspection.slice(4)) === i + 1;
      for (const part of ['top','bottom','sleeve','hub','cone','dog','shiftFork','rail']) gear[part].visible = visible;
      gear.syncGlow.userData.focusVisible = visible;
    });
    this.finalDrive.input.visible = mode !== 'differential' || this.inspection !== 'core';
    this.finalDrive.group.children.filter(child => child.userData.part === 'wheelHub').forEach(child => { child.visible = mode !== 'differential' || this.inspection !== 'core'; });
    this.finalDrive.axles.forEach(axle => axle.children.forEach(child => { child.visible = mode !== 'differential' || this.inspection !== 'core' || child.userData.part === 'differential'; }));
    this.frameView(instant);
  }

  positionDetailedDrive() {
    const gap = this.mode === 'drive-detail' ? this.drive.exploded * 3.25 : 0;
    this.drive.gearbox.position.x = 3.8 + gap;
    this.finalDrive.group.position.set(this.mode === 'differential' ? 0 : this.drive.group.position.x + 16 + gap, this.mode === 'differential' ? 0 : -1, 0);
  }

  inspect(section, isolate = this.isolate) {
    this.inspection = section;
    this.isolate = isolate;
    this.setView(this.mode, true);
  }

  applyInspection() {
    if (this.mode !== 'drive-detail') return;
    const section = this.isolate ? this.inspection : 'all';
    this.engine.group.visible = ['all', 'engine'].includes(section);
    this.drive.group.visible = ['all', 'clutch', 'gearbox'].includes(section);
    this.drive.clutch.visible = ['all', 'clutch'].includes(section);
    this.drive.gearbox.visible = ['all', 'gearbox'].includes(section);
    this.drive.wheel.visible = false;
    this.finalDrive.group.visible = ['all', 'finalDrive'].includes(section);
    this.turbo.group.visible = ['all', 'turbo'].includes(section);
    this.connections.group.visible = section === 'all';
    if (['timing','oil','fuel'].includes(section)) this.engine.group.visible = false;
  }

  frameView(instant = false) {
    this.root.updateMatrixWorld(true);
    const mode = this.mode;
    const section = this.inspection;
    let bounds;
    if (['timing','oil','fuel'].includes(mode)) {
      bounds = mode === 'fuel' && ['carburetor','highPressurePump'].includes(section) ? new THREE.Box3().setFromObject(section === 'carburetor' ? this.systems.carb : this.systems.highPump).expandByScalar(0.4) : this.systems.bounds(mode);
      if (!this.isolate && !['carburetor','highPressurePump'].includes(section)) bounds.union(this.engine.bounds('engine', 0));
    } else if (mode === 'differential') {
      bounds = this.inspection === 'core' ? new THREE.Box3(vec(-0.85,-1,-0.9),vec(0.85,1,0.9)) : this.finalDrive.bounds();
    } else if (mode === 'gearbox' && this.inspection.startsWith('gear')) {
      const selected = this.drive.gears[Number(this.inspection.slice(4))-1];
      bounds = new THREE.Box3(vec(selected.x - 0.1,-2.45,-0.65),vec(selected.x + 1.15,-0.95,0.65)).applyMatrix4(this.drive.gearbox.matrixWorld);
    } else if (mode === 'turbo') bounds = this.turbo.bounds(section);
    else if (mode === 'drive-detail') {
      if (section === 'engine') bounds = this.engine.bounds('engine', 0);
      else if (['clutch', 'gearbox'].includes(section)) bounds = this.drive.bounds(section);
      else if (section === 'finalDrive') bounds = this.finalDrive.bounds();
      else if (section === 'turbo') bounds = this.turbo.bounds();
      else if (['timing','oil','fuel'].includes(section)) bounds = this.systems.bounds(section);
      else bounds = this.engine.bounds('engine', 0).union(this.drive.bounds('drive')).union(this.finalDrive.bounds()).union(this.turbo.bounds()).union(new THREE.Box3(vec(-5, -1.5, -7.5), vec(5, 6.8, 0)));
    } else if (['clutch', 'gearbox'].includes(mode)) bounds = this.drive.bounds(mode);
    else {
      bounds = this.engine.bounds(mode, this.selectedCylinder);
      if (mode === 'drive') bounds.union(this.drive.bounds(mode));
      if (mode === 'engine') bounds.union(this.systems.bounds('timing'));
    }
    const directions = {
      timing: vec(-1.8,0.25,0.8), oil: vec(0.5,0.45,1.7), fuel: vec(-0.55,0.4,1.7), differential: vec(0.9,0.55,1.7),
      engine: this.engine.config.bankAngle ? vec(0.75, 0.75, 1.3) : vec(0.65, 0.36, 1.5),
      cylinder: vec(0.6, 0.15, 1.7), drive: vec(0.45, 0.36, 1.5),
      'drive-detail': vec(0.28, 0.5, 1.8), finalDrive: vec(1.25, 0.75, 1.5),
      clutch: vec(1.2, 0.45, 1.5), gearbox: vec(0.6, 0.46, 1.8), turbo: vec(0.8, 0.42, 1.7)
    };
    const view = mode === 'drive-detail' && section !== 'all' ? section : mode;
    this.fitBounds(bounds, mode === 'differential' && section === 'core' ? vec(1.6,0.6,0.9) : directions[view] || directions[mode], instant);
  }

  fitBounds(bounds, direction, instant) {
    direction.normalize();
    const center = bounds.getCenter(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(vec(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanY = Math.tan(this.camera.fov / 2 * Math.PI / 180) * 0.82;
    const tanX = Math.tan(this.camera.fov / 2 * Math.PI / 180) * this.camera.aspect * 0.9;
    let distance = 0;
    const corners = [];
    const addCorners = (box, matrix) => {
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const point = vec(x, y, z);
        if (matrix) point.applyMatrix4(matrix);
        corners.push(point);
      }
    };
    if (['drive-detail', 'turbo'].includes(this.mode) && this.inspection === 'all') {
      this.root.traverseVisible(object => {
        if (!object.isMesh || object.isInstancedMesh) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        addCorners(object.geometry.boundingBox, object.matrixWorld);
      });
    } else addCorners(bounds);
    for (const point of corners) {
      const corner = point.sub(center);
      const depth = corner.dot(direction);
      distance = Math.max(distance, Math.abs(corner.dot(right)) / tanX + depth, Math.abs(corner.dot(up)) / tanY + depth);
    }
    this.targetGoal = center;
    this.cameraGoal = center.clone().addScaledVector(direction, distance * (this.camera.aspect > 1.5 && ['engine', 'clutch', 'gearbox'].includes(this.mode) ? 0.92 : 1.0));
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
    this.turbo.update(sim, dt, this.cutaway);
    this.positionDetailedDrive();
    this.finalDrive.update(sim, this.cutaway, dt);
    this.systems.update(sim);
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
      const overview = ['block', 'clutch', 'gearbox', 'finalDrive', 'turbo'].includes(data.part);
      const detailLabel = this.mode !== 'drive-detail' || (this.inspection === 'all' ? overview : data.assembly === this.inspection && !['block', 'turbo'].includes(data.part));
      const turboLabel = this.mode !== 'turbo' || this.inspection === 'all' || data.part === this.inspection || this.inspection === 'turboBearing' && ['turboOil', 'turboShaft'].includes(data.part) || this.inspection === 'turbine' && data.part === 'exhaust' || this.inspection === 'intercooler' && data.part === 'throttleBody';
      const gearLabel = this.mode !== 'gearbox' || !this.inspection.startsWith('gear') || data.part !== 'gearPair' || data.anchor.userData.gear === Number(this.inspection.slice(4));
      const fuelLabel = this.mode !== 'fuel' || !['carburetor','highPressurePump'].includes(this.inspection) || data.part === this.inspection;
      const diffLabel = this.mode !== 'differential' || this.inspection !== 'core' || ['differential','finalDrive'].includes(data.part);
      const show = fuelLabel && gearLabel && diffLabel && detailLabel && turboLabel && this.labels && data.views.includes(this.mode) && parentVisible(data.anchor) && (this.mode !== 'cylinder' || data.cylinder === this.selectedCylinder);
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
    this.finalDrive.dispose();
    this.systems.dispose();
    this.connections.dispose();
    Object.values(this.materials).forEach(m => m.dispose());
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
