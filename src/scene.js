import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EngineModel } from './models/engine-model.js';
import { DrivetrainModel } from './models/drivetrain-model.js';
import { TurboModel } from './models/turbo-model.js';
import { ModelGeometry, vec } from './models/geometry.js';
import { SystemsModel } from './models/systems-model.js';
import { FinalDriveModel } from './models/final-drive-model.js';
import { DctModel } from './models/dct-model.js';
import { AutomaticModel } from './models/automatic-model.js';
import { HybridModel } from './models/hybrid-model.js';
import { TransferModel } from './models/transfer-model.js';
import { VehicleModel } from './models/vehicle-model.js';
import { SuspensionModel } from './models/suspension-model.js';
import { Simulation } from './simulation.js';
import { CameraInput } from './camera-input.js';

export class EngineScene {
  constructor(container, onSelect, sim = new Simulation()) {
    this.sim = sim;
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
    this.renderer.domElement.setAttribute('aria-label', 'Model 3D silnika. Przeciągnij, aby obracać. Prawy przycisk: kliknięcie pokazuje opis części, przeciąganie przesuwa kamerę. Dwa palce na touchpadzie przesuwają kamerę, szczypnięcie przybliża model. Przycisk Przesuwanie zmienia działanie przeciągania.');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.9;
    this.controls.addEventListener('start', () => { this.cameraGoal = null; });
    this.cameraInput = new CameraInput(container, this.controls, () => { this.cameraGoal = null; });
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
    this.dct = new DctModel(this.materials);
    this.automatic = new AutomaticModel(this.materials);
    this.hybrid = new HybridModel(this.materials);
    this.transfer = new TransferModel(this.materials);
    this.suspension = new SuspensionModel(this.materials);
    this.systems = new SystemsModel(this.materials, this.engine);
    this.root.add(this.engine.group, this.drive.group, this.turbo.group, this.finalDrive.group, this.systems.group, this.dct.group, this.automatic.group, this.hybrid.group, this.transfer.group, this.suspension.group);
    this.buildConnections();
    this.vehicle = new VehicleModel(this.materials, { engine: this.engine, drive: this.drive, dct: this.dct, automatic: this.automatic, hybrid: this.hybrid, transfer: this.transfer, systems: this.systems, turbo: this.turbo, connections: this.connections });
    this.root.add(this.vehicle.group);
    this.vehicle.group.visible = false;
    this.leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.leaders.classList.add('model-leaders');
    container.append(this.leaders);
    this.refreshLabels();
    this.labelSizeRevision = 0;
    this.labelFontListener = () => { this.labelSizeRevision++; };
    document.fonts?.addEventListener('loadingdone', this.labelFontListener);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.setView('engine', true);
    this.raycaster = new THREE.Raycaster();
    this.bindPicking();
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('renderlost'));
    });
  }

  bindPicking() {
    const canvas = this.renderer.domElement;
    let origin = null;
    this.pickListeners = {
      pointerdown: event => {
        const primaryClick = event.button === 0 && !this.cameraInput.pan && !event.ctrlKey && !event.metaKey && !event.shiftKey;
        origin = event.isPrimary !== false && (primaryClick || event.button === 2)
          ? { x: event.clientX, y: event.clientY, button: event.button, pointerId: event.pointerId, dragged: false } : null;
      },
      pointermove: event => {
        if (origin && event.pointerId === origin.pointerId && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6) origin.dragged = true;
      },
      pointercancel: () => { origin = null; },
      pointerup: event => {
        const start = origin;
        origin = null;
        if (!start || event.pointerId !== start.pointerId || event.button !== start.button || start.dragged || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
        this.pickPart(event.clientX, event.clientY);
      },
      contextmenu: event => event.preventDefault()
    };
    for (const [name, listener] of Object.entries(this.pickListeners)) canvas.addEventListener(name, listener);
  }

  pickPart(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const selectable = object => !object || object.visible && !object.userData.ignorePick && selectable(object.parent);
    const hit = this.raycaster.intersectObjects(this.root.children, true).find(candidate => selectable(candidate.object));
    if (!hit) return;
    let object = hit.object;
    let part, cylinder;
    while (object) {
      part ??= object.userData.part;
      cylinder ??= object.userData.cylinder;
      object = object.parent;
    }
    if (part) this.onSelect(part, cylinder);
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
    Object.assign(this.vehicle.models, { engine: this.engine, systems: this.systems, connections: this.connections });
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
      ...this.finalDrive.anchors.map(data => Object.assign(data, { assembly: 'finalDrive' })),
      ...this.dct.anchors.map(data => Object.assign(data, { assembly: ['k1', 'k2'].includes(data.part) ? 'clutch' : data.part === 'mechatronics' ? 'mechatronics' : 'gearbox' })),
      ...this.automatic.anchors.map(data => Object.assign(data, { assembly: ['converter', 'pump', 'converterTurbine', 'stator', 'lockup'].includes(data.part) ? 'converter' : 'gearbox' })),
      ...this.hybrid.anchors.map(data => Object.assign(data, { assembly: data.part })),
      ...this.transfer.anchors.map(data => Object.assign(data, { assembly: 'transfer' })),
      ...this.suspension.anchors.map(data => Object.assign(data, { assembly: 'suspension' })),
      ...this.vehicle.anchors.map(data => Object.assign(data, { assembly: 'vehicle' }))
    ];
    this.labelElements = labels.map(data => {
      const element = document.createElement('button');
      element.className = 'model-label';
      element.textContent = data.text;
      element.addEventListener('click', () => this.onSelect(data.part, data.cylinder));
      element.addEventListener('contextmenu', event => { event.preventDefault(); this.onSelect(data.part, data.cylinder); });
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
    this.container.dataset.transmission = this.sim.transmission;
    this.container.dataset.drive = this.sim.driveLayout;
    this.container.dataset.engineOrientation = this.sim.engineOrientation;
    this.container.dataset.enginePlacement = this.sim.enginePlacement;
    const whole = ['drive', 'drive-detail'].includes(mode);
    this.suspension.group.visible = mode === 'suspension';
    if (mode === 'suspension') {
      this.suspension.update(this.sim);
      this.suspension.setSection(this.inspection, this.isolate);
    }
    if (whole) {
      this.vehicle.restoreDetail();
      this.vehicle.attach();
      this.vehicle.configure(this.sim, this.inspection, this.isolate);
      this.finalDrive.group.visible = false;
      this.grid.position.y = -1.38;
      this.frameView(instant);
      return;
    }
    if (this.vehicle.group.visible) {
      this.vehicle.restoreDetail();
      Object.values(this.vehicle.models).forEach(model => {
        this.root.add(model.group);
        model.group.position.set(0, 0, 0);
        model.group.rotation.set(0, 0, 0);
        model.group.scale.setScalar(1);
      });
      this.vehicle.group.visible = false;
    }
    this.dct.group.visible = this.sim.transmission === 'dct' && ['clutch', 'gearbox'].includes(mode);
    this.dct.setSection(mode === 'clutch' && this.inspection === 'all' ? 'clutch' : this.inspection, mode === 'clutch' || this.isolate);
    this.automatic.group.visible = this.sim.transmission === 'automatic' && ['clutch', 'gearbox'].includes(mode);
    this.automatic.group.position.set(0, 0.8, 0);
    this.automatic.setSection(mode === 'clutch' ? this.inspection === 'all' ? 'converter' : this.inspection : this.inspection, mode === 'clutch' || this.isolate);
    this.hybrid.group.visible = mode === 'hybrid';
    this.hybrid.group.position.set(0, 1, 0);
    this.hybrid.setLayout(false);
    this.hybrid.setSection(this.inspection, this.isolate);
    this.transfer.group.visible = mode === 'transfer';
    this.transfer.group.position.set(0, 1.5, 0);
    this.transfer.configure(this.sim.driveLayout);
    this.engine.setView(mode, this.selectedCylinder);
    if (['engine', 'timing'].includes(mode) && this.inspection === 'cylinderHead') this.engine.setHeadView(this.isolate);
    this.drive.setView(mode);
    this.drive.setSection(['clutch', 'gearbox'].includes(mode) ? this.inspection : 'all', this.isolate);
    if (this.sim.transmission !== 'manual') this.drive.group.visible = false;
    this.drive.group.position.set(['clutch', 'gearbox'].includes(mode) ? 0 : this.engine.shaftEnd + 0.15, 0.8, 0);
    // Part bounds must reflect a newly selected exploded layout before fitting.
    this.drive.update(this.sim, this.cutaway);
    this.turbo.group.visible = mode === 'turbo' || mode === 'drive-detail';
    this.turbo.setSection(mode === 'turbo' ? this.inspection : 'all', mode === 'turbo' && this.isolate);
    this.turbo.group.position.set(0, mode === 'drive-detail' ? 2 : 2.3, mode === 'drive-detail' ? -7.2 : 0);
    this.finalDrive.group.visible = ['drive-detail', 'differential'].includes(mode);
    if (mode !== 'differential') this.finalDrive.demo = false;
    this.systems.setView(mode, this.inspection, this.isolate);
    if (['timing','oil','fuel'].includes(mode)) this.engine.group.visible = !this.isolate;
    if (['engine', 'timing'].includes(mode) && this.inspection === 'cylinderHead') {
      this.engine.group.visible = true;
      this.systems.group.visible = !this.isolate;
      this.drive.group.visible = false;
    }
    if (mode === 'engine' && this.inspection === 'timing' && this.isolate) {
      this.engine.group.visible = this.drive.group.visible = false;
      this.systems.group.visible = this.systems.timing.visible = true;
    }
    this.connections.group.visible = mode === 'drive-detail';
    this.positionDetailedDrive();
    this.grid.position.y = ['oil','fuel','drive', 'drive-detail', 'gearbox', 'turbo'].includes(mode) ? -2.8 : mode === 'clutch' ? -0.75 : -0.1;
    this.applyInspection();
    this.drive.gears.forEach((gear,i) => {
      const focused = this.inspection === 'synchronizer' ? this.drive.synchronizerGear : this.inspection.startsWith('gear') ? Number(this.inspection.slice(4)) : 0;
      const visible = mode !== 'gearbox' || !focused || focused === i + 1;
      for (const part of ['top','bottom','sleeve','hub','cone','dog','shiftFork','rail']) gear[part].visible = visible;
      gear.syncGlow.userData.focusVisible = visible;
    });
    if (mode === 'gearbox' && ['selector', 'synchronizer'].includes(this.inspection)) this.drive.applySection();
    this.finalDrive.input.visible = mode !== 'differential' || this.inspection !== 'core';
    this.finalDrive.group.children.filter(child => child.userData.part === 'wheelHub').forEach(child => { child.visible = mode !== 'differential' || this.inspection !== 'core'; });
    this.finalDrive.axles.forEach(axle => axle.children.forEach(child => { child.visible = mode !== 'differential' || this.inspection !== 'core' || child.userData.part === 'differential'; }));
    this.frameView(instant);
  }

  positionDetailedDrive() {
    if (this.vehicle.group.visible) return;
    const gap = this.mode === 'drive-detail' ? this.drive.explodedGearboxOffset : 0;
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
    if (['drive', 'drive-detail'].includes(mode)) bounds = this.vehicle.bounds(section);
    else if (['engine', 'timing'].includes(mode) && section === 'cylinderHead') bounds = this.engine.bounds('cylinderHead', this.selectedCylinder);
    else if (mode === 'engine' && section === 'timing') bounds = this.systems.bounds('timing');
    else if (mode === 'hybrid') bounds = this.hybrid.bounds(section);
    else if (mode === 'transfer') bounds = this.transfer.bounds();
    else if (mode === 'suspension') bounds = this.suspension.bounds(section);
    else if (this.sim.transmission === 'dct' && ['clutch', 'gearbox'].includes(mode)) bounds = this.dct.bounds(mode === 'clutch' && section === 'all' ? 'clutch' : section);
    else if (this.sim.transmission === 'automatic' && ['clutch', 'gearbox'].includes(mode)) bounds = this.automatic.bounds(mode === 'clutch' && section === 'all' ? 'converter' : section);
    else if (['timing','oil','fuel'].includes(mode)) {
      bounds = mode === 'fuel' && ['carburetor','highPressurePump'].includes(section) ? new THREE.Box3().setFromObject(section === 'carburetor' ? this.systems.carb : this.systems.highPump).expandByScalar(0.4) : this.systems.bounds(mode);
      if (!this.isolate && !['carburetor','highPressurePump'].includes(section)) bounds.union(this.engine.bounds('engine', 0));
    } else if (mode === 'differential') {
      bounds = this.inspection === 'core' ? new THREE.Box3(vec(-0.85,-1,-0.9),vec(0.85,1,0.9)) : this.finalDrive.bounds();
    } else if (mode === 'gearbox' && (this.inspection.startsWith('gear') || ['selector', 'synchronizer'].includes(this.inspection))) {
      bounds = this.drive.bounds(this.inspection);
    } else if (mode === 'clutch' && section !== 'all') {
      bounds = this.drive.bounds(section);
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
      cylinderHead: vec(0.65, 0.6, 1.7), timing: vec(['vr6','w16'].includes(this.engine.id) ? 1.8 : -1.8, this.engine.config.bankAngle === 180 ? 0.8 : 0.25, 0.8), oil: vec(0.5,0.45,1.7), fuel: vec(-0.55,0.4,1.7), differential: vec(1.6,0.6,0.9),
      engine: this.engine.config.bankAngle === 180 ? vec(0.8, 1.8, 0.9) : this.engine.config.bankAngle ? vec(0.75, 0.75, 1.3) : vec(0.65, 0.36, 1.5),
      cylinder: vec(0.6, 0.15, this.engine.config.bankAngle === 180 && this.engine.cylinders[this.selectedCylinder].layout.bankRadians > 0 ? -1.7 : 1.7).applyAxisAngle(vec(1,0,0), this.engine.cylinders[this.selectedCylinder].layout.bankRadians),
      'drive-detail': vec(0.35, 1, 1.5), drive: vec(0.35, 1, 1.5), frontAxle: vec(0.7, 0.55, 1.5), rearAxle: vec(0.7, 0.55, 1.5), finalDrive: vec(1.25, 0.75, 1.5),
      hybrid: vec(0.75, 0.55, 1.7), psd: vec(1.3, 0.35, 1.5), mg1: vec(1.3, 0.45, 1.6), mg2: vec(1.3, 0.45, 1.6), battery: vec(0.4, 1.3, 1.1), inverter: vec(0.6, 1.2, 1.4), transfer: vec(1.1, 0.55, 1.5),
      clutch: vec(0.72, 0.45, 1.9), gearbox: vec(0.6, 0.46, 1.8), turbo: vec(0.8, 0.42, 1.7), suspension: vec(0.85, 0.5, 1.7)
    };
    const view = ['drive', 'drive-detail', 'hybrid', 'engine', 'timing'].includes(mode) && section !== 'all' ? section : mode;
    const lateralClutch = mode === 'clutch' && section === 'all' && this.sim.transmission === 'manual' && this.drive.exploded === 0;
    const radialClutch = mode === 'clutch' && this.sim.transmission === 'manual' && ['clutchCover', 'diaphragm'].includes(section);
    const synchroDetail = mode === 'gearbox' && this.sim.transmission === 'manual' && section === 'synchronizer';
    const dctGearbox = mode === 'gearbox' && this.sim.transmission === 'dct';
    // Look along the rocker shaft so the wheel cannot hide the inboard linkage.
    const suspensionActuation = mode === 'suspension' && ['pushrod', 'pullrod'].includes(this.sim.suspension.type) && ['suspensionRocker', 'suspensionSpring', 'suspensionDamper'].includes(section);
    const direction = suspensionActuation ? vec(-1.7, 0.35, 0.7) : radialClutch ? vec(1.2, 0.35, 1.3) : lateralClutch || synchroDetail ? vec(0.08, 0.12, 1.9) : dctGearbox ? vec(0.18, 0.22, 1.9) : mode === 'differential' && section === 'core' ? vec(1.6,0.6,0.9) : directions[view] || directions[mode];
    this.fitBounds(bounds, direction, instant);
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
    if (this.mode === 'gearbox' && this.inspection === 'synchronizer' && this.sim.transmission === 'manual') {
      this.drive.gearbox.traverseVisible(object => {
        if (!object.isMesh) return;
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        addCorners(object.geometry.boundingBox, object.matrixWorld);
      });
    } else if (['engine', 'cylinder', 'timing'].includes(this.mode) || this.mode === 'turbo' && this.inspection === 'all') {
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
    const margin = this.inspection === 'cylinderHead' && this.isolate ? 1.12 : this.camera.aspect > 1.5 && ['engine', 'clutch', 'gearbox'].includes(this.mode) ? 0.92 : 1;
    this.cameraGoal = center.clone().addScaledVector(direction, distance * margin);
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
    this.cameraInput.zoom(factor);
  }

  setCamera(view) {
    if (!['drive', 'drive-detail'].includes(this.mode)) return;
    const direction = { top: vec(0, 1, 0.001), side: vec(0.1, 0.22, 1.7), perspective: vec(0.35, 1, 1.5) }[view];
    if (direction) this.fitBounds(this.vehicle.bounds(), direction, false);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.labelSizeRevision = (this.labelSizeRevision || 0) + 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.engine) this.setView(this.mode, true);
  }

  render(sim, dt) {
    this.camera.userData.target = this.controls.target;
    this.engine.update(sim, this.cutaway);
    this.drive.update(sim, this.cutaway, false);
    this.turbo.update(sim, dt, this.cutaway);
    this.dct.update(sim, this.cutaway, dt);
    this.automatic.update(sim, this.cutaway, dt);
    this.hybrid.update(sim, this.cutaway, dt);
    this.transfer.update(sim, this.cutaway);
    this.positionDetailedDrive();
    this.finalDrive.update(sim, this.cutaway, dt, sim.driveLayout === 'fwd' ? 0 : 1);
    this.systems.update(sim);
    this.vehicle.update(sim, this.cutaway, dt, this.camera);
    if (this.suspension.group.visible) {
      this.suspension.update(sim);
      this.suspension.setSection(this.inspection, this.isolate);
    }
    if (this.cameraGoal) {
      const lerp = 1 - Math.exp(-dt * 8);
      this.camera.position.lerp(this.cameraGoal, lerp);
      this.controls.target.lerp(this.targetGoal, lerp);
      if (this.camera.position.distanceTo(this.cameraGoal) < 0.02) this.cameraGoal = null;
    }
    this.controls.update();
    this.updateVisibleMatrices();
    // Three's default scene pass also visits every hidden model and gearbox.
    // Visible world matrices are current; keep explicit bounds/picking updates
    // independent by restoring the normal scene flag after drawing.
    const autoUpdate = this.scene.matrixWorldAutoUpdate;
    this.scene.matrixWorldAutoUpdate = false;
    try { this.renderer.render(this.scene, this.camera); }
    finally { this.scene.matrixWorldAutoUpdate = autoUpdate; }
    this.renderLabels();
  }

  updateVisibleMatrices() {
    this.scene.traverseVisible(object => object.updateWorldMatrix(false, false, true));
  }

  renderLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const occupied = [];
    const candidates = [];
    const revision = this.labelSizeRevision || 0;
    const parentVisible = object => !object || object.visible && parentVisible(object.parent);
    const whole = ['drive', 'drive-detail'].includes(this.mode);
    const labelLimit = this.mode === 'suspension' ? width < 600 ? 4 : 5 : whole && this.inspection === 'all' ? width < 600 ? 5 : 8 : width < 600 ? 6 : 14;
    const focusedGear = this.inspection === 'synchronizer' ? this.drive.synchronizerGear : this.inspection.startsWith('gear') ? Number(this.inspection.slice(4)) : 0;
    const hide = ({ element, line }) => {
      if (!element.hidden) element.hidden = true;
      if (line.style.display !== 'none') line.style.display = 'none';
    };
    const position = this.labelPosition || (this.labelPosition = new THREE.Vector3());
    const suspensionPriority = ['suspensionBody', 'suspensionLinks', 'suspensionRocker', 'suspensionSpring', 'suspensionDamper'];
    const labels = this.mode === 'suspension' ? [...this.labelElements].sort((a, b) => suspensionPriority.indexOf(a.data.part) - suspensionPriority.indexOf(b.data.part)) : this.labelElements;
    labels.forEach(record => {
      const { data, element, line } = record;
      const overview = data.anchor.userData.overview || data.assembly === 'vehicle' || ['battery', 'transfer'].includes(data.assembly);
      const detailLabel = !whole || (this.inspection === 'all' ? overview : data.assembly === this.inspection || data.part === this.inspection || this.inspection === 'engine' && data.assembly === 'engine' || ['frontAxle', 'rearAxle', 'finalDrive'].includes(this.inspection) && data.assembly === 'vehicle');
      const turboLabel = this.mode !== 'turbo' || this.inspection === 'all' || data.part === this.inspection || this.inspection === 'turboBearing' && ['turboOil', 'turboShaft'].includes(data.part) || this.inspection === 'turbine' && data.part === 'exhaust' || this.inspection === 'intercooler' && data.part === 'throttleBody';
      const gearLabel = this.mode !== 'gearbox' || !focusedGear || data.part !== 'gearPair' || data.anchor.userData.gear === focusedGear;
      const fuelLabel = this.mode !== 'fuel' || !['carburetor','highPressurePump'].includes(this.inspection) || data.part === this.inspection;
      const timingLabel = !data.anchor.userData.timingSummary || this.isolate;
      const diffLabel = this.mode !== 'differential' || this.inspection !== 'core' || ['differential','finalDrive'].includes(data.part);
      const headLabel = !this.isolate || this.inspection !== 'cylinderHead' || ['cylinderHead', 'camshaft', 'valves'].includes(data.part);
      const automaticLabel = this.sim.transmission !== 'automatic' || !this.isolate || !['planetary', 'automaticClutches', 'valveBody'].includes(this.inspection) || data.part === this.inspection;
      const selectorLabel = this.mode !== 'gearbox' || this.inspection !== 'selector' || !['synchronizerHub', 'synchronizerSleeve', 'synchronizer', 'synchroCone', 'dogTeeth'].includes(data.part);
      const assembledClutchLabel = this.mode !== 'clutch' || this.sim.transmission !== 'manual' || this.drive.exploded > 0 || this.inspection !== 'all' || ['friction', 'pressurePlate', 'diaphragm', 'releaseBearing'].includes(data.part);
      const show = selectorLabel && assembledClutchLabel && !data.anchor.userData.labelHidden && timingLabel && headLabel && automaticLabel && fuelLabel && gearLabel && diffLabel && detailLabel && turboLabel && this.labels && data.views.includes(this.mode) && parentVisible(data.anchor) && (this.mode !== 'cylinder' || data.cylinder === this.selectedCylinder);
      if (!show) { hide(record); return; }
      const text = data.anchor.userData.label || data.text;
      if (element.textContent !== text) { element.textContent = text; record.size = null; }
      // The render pass has already updated visible ancestors, including anchors.
      position.setFromMatrixPosition(data.anchor.matrixWorld).project(this.camera);
      const x = (position.x * 0.5 + 0.5) * width;
      const y = (-position.y * 0.5 + 0.5) * height;
      if (position.z > 1 || x < 5 || x > width - 5 || y < 5 || y > height - 5) {
        hide(record);
        return;
      }
      // Reveal all labels needing measurement first, then batch the reads. This
      // avoids alternating layout writes and forced measurements for each label.
      if ((!record.size || record.size.revision !== revision) && element.hidden) element.hidden = false;
      candidates.push({ record, x, y });
    });
    for (const { record } of candidates) {
      if (!record.size || record.size.revision !== revision) record.size = { width: record.element.offsetWidth || 70, height: record.element.offsetHeight || 26, revision };
    }
    for (const candidate of candidates) {
      const { record } = candidate;
      const { data, element, line, size } = record;
      if (occupied.length >= labelLimit) { hide(record); continue; }
      let { x, y } = candidate;
      const start = { x, y };
      const w = Math.min(width - 30, size.width);
      const h = size.height;
      x = Math.max(w / 2 + 8, Math.min(width - w / 2 - 8, x));
      y = Math.max(82, Math.min(height - 68, y));
      for (let tries = 0; tries < 8 && occupied.some(r => Math.abs(r.x - x) < (r.w + w) / 2 + 5 && Math.abs(r.y - y) < (r.h + h) / 2 + 4); tries++) y += h + 5;
      if (y > height - 45) { hide(record); continue; }
      occupied.push({ x, y, w, h });
      if (element.hidden) element.hidden = false;
      if (record.drawX !== x) { element.style.left = `${x}px`; record.drawX = x; }
      if (record.drawY !== y) { element.style.top = `${y}px`; record.drawY = y; }
      const selected = data.cylinder !== undefined && data.cylinder === this.selectedCylinder;
      if (element.classList.contains('selected') !== selected) element.classList.toggle('selected', selected);
      for (const [key, value] of Object.entries({ x1: start.x, y1: start.y, x2: x, y2: y })) {
        if (line.getAttribute(key) !== String(value)) line.setAttribute(key, value);
      }
      const display = Math.hypot(start.x - x, start.y - y) > 8 ? '' : 'none';
      if (line.style.display !== display) line.style.display = display;
    }
  }

  dispose() {
    this.resizeObserver.disconnect();
    document.fonts?.removeEventListener('loadingdone', this.labelFontListener);
    for (const [name, listener] of Object.entries(this.pickListeners)) this.renderer.domElement.removeEventListener(name, listener);
    this.cameraInput.dispose();
    this.controls.dispose();
    this.engine.dispose();
    this.drive.dispose();
    this.turbo.dispose();
    this.finalDrive.dispose();
    this.dct.dispose();
    this.automatic.dispose();
    this.hybrid.dispose();
    this.transfer.dispose();
    this.suspension.dispose();
    this.vehicle.dispose();
    this.systems.dispose();
    this.connections.dispose();
    Object.values(this.materials).forEach(m => m.dispose());
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
