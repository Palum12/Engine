import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cycleDegrees, pistonHeight, strokeIndex, GEAR_RATIOS } from './simulation.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COLORS = [0x68c9ed, 0xbd9aff, 0xffb34c, 0xed7e77];

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
    this.scene.fog = new THREE.Fog(0x12191f, 26, 55);
    this.camera = new THREE.PerspectiveCamera(37, 1, 0.05, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'Interaktywny model silnika 3D. Przeciągnij, aby obracać. Użyj kółka myszy lub dwóch palców, aby przybliżyć.');
    this.renderer.domElement.setAttribute('role', 'img');
    container.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2.7;
    this.controls.maxDistance = 32;
    this.controls.maxPolarAngle = Math.PI * 0.87;
    this.controls.enablePan = true;
    this.controls.zoomToCursor = true;
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment);
    this.scene.environment = this.environmentTarget.texture;
    environment.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xdceeff, 0x263647, 2));
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(1, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x67b4ff, 2.5);
    rim.position.set(-4, 4, -6);
    this.scene.add(rim);
    this.materials = {
      steel: new THREE.MeshStandardMaterial({ color: 0xa6b0ba, metalness: 0.88, roughness: 0.28 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x35444e, metalness: 0.78, roughness: 0.35 }),
      block: new THREE.MeshStandardMaterial({ color: 0x667c87, metalness: 0.72, roughness: 0.42, side: THREE.DoubleSide }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc99c54, metalness: 0.8, roughness: 0.28 }),
      black: new THREE.MeshStandardMaterial({ color: 0x192128, metalness: 0.4, roughness: 0.55 }),
      intake: new THREE.MeshStandardMaterial({ color: 0x4399b7, metalness: 0.48, roughness: 0.38 }),
      exhaust: new THREE.MeshStandardMaterial({ color: 0xc86d52, metalness: 0.5, roughness: 0.4 }),
      fuel: new THREE.MeshStandardMaterial({ color: 0xeac268, metalness: 0.5, roughness: 0.3 })
    };
    this.root = new THREE.Group();
    this.scene.add(this.root);
    const grid = new THREE.GridHelper(60, 60, 0x35424b, 0x23303a);
    grid.position.y = -1.1;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    this.scene.add(grid);
    this.buildEngine();
    this.buildDrivetrain();
    this.buildTurbo();
    this.addLabels();
    this.setView('engine', true);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.raycaster = new THREE.Raycaster();
    let origin;
    this.renderer.domElement.addEventListener('pointerdown', event => { origin = [event.clientX, event.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (!origin || Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 6) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      const visible = object => object.visible && (!object.parent || visible(object.parent));
      const hit = this.raycaster.intersectObjects(this.root.children, true).find(item => visible(item.object));
      if (!hit) return;
      let object = hit.object;
      while (object && !object.userData.part) object = object.parent;
      if (object) this.onSelect(object.userData.part, object.userData.cylinder);
    });
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('renderlost'));
    });
  }

  mesh(geometry, material, parent, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? this.materials[material] : material);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  box(width, height, depth, material, parent, position) {
    return this.mesh(new THREE.BoxGeometry(width, height, depth), material, parent, position);
  }

  cylinder(radius, height, material, parent, position, axis = 'y') {
    const mesh = this.mesh(new THREE.CylinderGeometry(radius, radius, height, 40), material, parent, position);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  tube(points, radius, material, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
    return this.mesh(new THREE.TubeGeometry(curve, 22, radius, 10, false), material, parent);
  }

  rod(mesh, from, to) {
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.y = from.distanceTo(to);
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), to.clone().sub(from).normalize());
  }

  gear(radius, thickness, parent, material = 'steel', teeth = 24) {
    const group = new THREE.Group();
    parent.add(group);
    this.cylinder(radius * 0.9, thickness, material, group, [0, 0, 0], 'x');
    this.cylinder(radius * 0.3, thickness * 1.25, 'dark', group, [0, 0, 0], 'x');
    for (let i = 0; i < teeth; i++) {
      const a = i / teeth * Math.PI * 2;
      const tooth = this.box(thickness, radius * 0.16, radius * 0.16, material, group, [0, Math.cos(a) * radius * 0.94, Math.sin(a) * radius * 0.94]);
      tooth.rotation.x = a;
    }
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      this.cylinder(radius * 0.12, thickness + 0.015, 'black', group, [0, Math.cos(a) * radius * 0.57, Math.sin(a) * radius * 0.57], 'x');
    }
    return group;
  }

  buildEngine() {
    this.engine = new THREE.Group();
    this.root.add(this.engine);
    this.engine.userData.part = 'block';
    this.block = new THREE.Group();
    this.engine.add(this.block);
    this.box(7.05, 2.05, 0.26, 'block', this.block, [-0.75, 3.1, -0.68]);
    this.box(7.05, 0.2, 1.65, 'dark', this.block, [-0.75, 1.97, 0]);
    this.box(7.05, 0.18, 0.42, 'steel', this.block, [-0.75, 4.22, -0.67]);
    this.frontCover = this.box(7.05, 2.15, 0.22, 'block', this.block, [-0.75, 3.08, 0.76]);
    this.crankshaft = new THREE.Group();
    this.crankshaft.position.y = 0.8;
    this.crankshaft.userData.part = 'crank';
    this.engine.add(this.crankshaft);
    this.cylinder(0.18, 8.2, 'steel', this.crankshaft, [-0.4, 0, 0], 'x');
    this.cylinders = [];
    [-3.3, -1.6, 0.1, 1.8].forEach((x, i) => {
      const group = new THREE.Group();
      group.position.x = x;
      group.userData = { part: 'piston', cylinder: i };
      this.engine.add(group);
      const sleeve = this.mesh(new THREE.CylinderGeometry(0.68, 0.68, 2.05, 40, 1, true, Math.PI / 2, Math.PI), 'block', group, [0, 3.12, 0]);
      const full = this.mesh(new THREE.CylinderGeometry(0.685, 0.685, 2.05, 40, 1, true, -Math.PI / 2, Math.PI), 'block', group, [0, 3.12, 0]);
      const piston = new THREE.Group();
      group.add(piston);
      this.cylinder(0.585, 0.46, 'steel', piston, [0, 0, 0]);
      [0.15, 0.055, -0.055].forEach(y => this.cylinder(0.596, 0.024, 'black', piston, [0, y, 0]));
      this.cylinder(0.11, 1.22, 'brass', piston, [0, -0.08, 0], 'z');
      const rod = this.cylinder(0.105, 1, 'brass', group, [0, 0, 0]);
      const cap = this.cylinder(0.22, 0.27, 'steel', group, [0, 0, 0], 'x');
      const offset = i === 1 || i === 2 ? Math.PI : 0;
      const crank = new THREE.Group();
      crank.position.x = x;
      crank.rotation.x = offset;
      this.crankshaft.add(crank);
      [-0.29, 0.29].forEach(side => {
        this.box(0.15, 0.95, 0.38, 'dark', crank, [side, 0.22, 0]);
        this.cylinder(0.3, 0.18, 'steel', crank, [side, 0.65, 0], 'x');
        this.cylinder(0.36, 0.18, 'dark', crank, [side, -0.25, 0], 'x');
      });
      this.cylinder(0.16, 0.68, 'steel', crank, [0, 0.65, 0], 'x');
      this.cylinder(0.27, 0.16, 'dark', this.engine, [x - 0.7, 0.8, 0], 'x');
      const head = this.box(1.38, 0.15, 1.25, 'dark', group, [0, 4.32, 0]);
      head.userData.part = 'valves';
      const valves = [];
      [-0.27, 0.27].forEach((valveX, index) => {
        const valve = new THREE.Group();
        valve.position.set(valveX, 4.27, 0.1);
        valve.userData.part = 'valves';
        group.add(valve);
        this.cylinder(0.16, 0.05, index ? 'exhaust' : 'intake', valve, [0, 0, 0]);
        this.cylinder(0.036, 0.63, 'steel', valve, [0, 0.31, 0]);
        for (let j = 0; j < 6; j++) {
          const ring = this.mesh(new THREE.TorusGeometry(0.075, 0.013, 5, 14), 'steel', valve, [0, 0.38 + j * 0.035, 0]);
          ring.rotation.x = Math.PI / 2;
        }
        valves.push(valve);
      });
      const plug = new THREE.Group();
      plug.userData.part = 'spark';
      group.add(plug);
      this.cylinder(0.068, 0.3, 'steel', plug, [0, 4.4, 0.32]);
      this.cylinder(0.058, 0.16, new THREE.MeshStandardMaterial({ color: 0xf1eee3 }), plug, [0, 4.63, 0.32]);
      const spark = this.mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff3b3 }), group, [0, 4.16, 0.25]);
      const chamber = this.cylinder(0.555, 1, new THREE.MeshBasicMaterial({ color: COLORS[0], transparent: true, opacity: 0.22, depthWrite: false }), group, [0, 3.8, 0]);
      this.tube([[-0.27, 4.36, -0.1], [-0.34, 4.6, -0.5], [-0.34, 4.5, -1.12]], 0.115, 'intake', group).userData.part = 'intake';
      this.tube([[0.27, 4.36, -0.1], [0.55, 4.64, -0.42], [0.65, 4.48, -1.35]], 0.1, 'exhaust', group).userData.part = 'exhaust';
      const mpi = this.cylinder(0.063, 0.38, 'fuel', group, [-0.37, 4.86, -0.55]);
      mpi.rotation.z = -0.32;
      mpi.userData.part = 'injection';
      const gdi = this.cylinder(0.065, 0.38, 'fuel', group, [0.3, 4.43, 0.34]);
      gdi.rotation.z = 0.5;
      gdi.userData.part = 'injection';
      const particles = [];
      for (let n = 0; n < 20; n++) particles.push(this.mesh(new THREE.SphereGeometry(0.026, 6, 5), new THREE.MeshBasicMaterial({ color: 0x7ddfff }), group));
      this.cylinders.push({ group, sleeve, full, piston, rod, cap, valves, spark, chamber, mpi, gdi, particles, x });
    });
    this.camshaft = new THREE.Group();
    this.camshaft.userData.part = 'valves';
    this.camshaft.position.set(0, 4.98, -0.12);
    this.engine.add(this.camshaft);
    this.cylinder(0.09, 7.4, 'steel', this.camshaft, [-0.75, 0, 0], 'x');
    this.cylinders.forEach(({ x }, i) => {
      const cam = this.cylinder(0.16, 0.12, 'brass', this.camshaft, [x - 0.27, 0.08 * (i % 2 ? -1 : 1), 0], 'x');
      cam.scale.y = 1.3;
    });
    this.flywheel = this.gear(0.94, 0.21, this.engine, 'dark', 52);
    this.flywheel.position.set(3.14, 0.8, 0);
    this.flywheel.userData.part = 'clutch';
    this.pulley = this.gear(0.48, 0.16, this.engine, 'dark', 24);
    this.pulley.position.set(-4.1, 0.8, 0);
    this.camPulley = this.gear(0.96, 0.12, this.engine, 'dark', 48);
    this.camPulley.position.set(-4.1, 4.98, -0.12);
    this.camPulley.userData.part = 'valves';
    this.tube([[-4.1, 0.8, 0.5], [-4.1, 3.5, 0.86], [-4.1, 4.98, 0.86]], 0.035, 'black', this.engine);
    this.tube([[-4.1, 0.8, -0.5], [-4.1, 3.5, -1.08], [-4.1, 4.98, -1.08]], 0.035, 'black', this.engine);
  }

  buildDrivetrain() {
    this.drive = new THREE.Group();
    this.root.add(this.drive);
    this.drive.userData.part = 'gearbox';
    this.clutchDisc = this.gear(0.78, 0.14, this.drive, 'brass', 28);
    this.clutchDisc.position.set(3.38, 0.8, 0);
    this.clutchDisc.userData.part = 'clutch';
    this.pressurePlate = this.cylinder(0.86, 0.12, 'steel', this.drive, [3.6, 0.8, 0], 'x');
    this.pressurePlate.userData.part = 'clutch';
    this.inputShaft = this.cylinder(0.115, 5.7, 'steel', this.drive, [6.55, 0.8, 0], 'x');
    this.outputShaft = this.cylinder(0.14, 6.0, 'brass', this.drive, [7.4, -0.9, 0], 'x');
    this.gears = [];
    GEAR_RATIOS.slice(1).forEach((ratio, i) => {
      const a = 1.7 / (1 + ratio);
      const b = 1.7 - a;
      const top = this.gear(a, 0.22, this.drive, 'steel', Math.max(12, Math.round(a * 30)));
      const bottom = this.gear(b, 0.22, this.drive, 'steel', Math.max(16, Math.round(b * 30)));
      const x = 4.65 + i * 1.02;
      top.position.set(x, 0.8, 0);
      bottom.position.set(x, -0.9, 0);
      const selector = this.cylinder(0.3, 0.16, 'brass', this.drive, [x + 0.22, -0.9, 0], 'x');
      this.gears.push({ top, bottom, selector, ratio });
    });
    this.wheel = new THREE.Group();
    this.wheel.position.set(11, -0.9, 0);
    this.drive.add(this.wheel);
    this.wheel.userData.part = 'wheel';
    const tyre = this.mesh(new THREE.TorusGeometry(0.86, 0.22, 12, 48), 'black', this.wheel);
    tyre.rotation.y = Math.PI / 2;
    this.cylinder(0.7, 0.22, 'steel', this.wheel, [0, 0, 0], 'x');
    this.cylinder(0.6, 0.24, 'dark', this.wheel, [0, 0, 0], 'x');
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const spoke = this.box(0.27, 0.56, 0.085, 'steel', this.wheel, [0, Math.cos(a) * 0.3, Math.sin(a) * 0.3]);
      spoke.rotation.x = a;
    }
    this.cylinder(0.16, 0.3, 'brass', this.wheel, [0, 0, 0], 'x');
    this.drive.visible = false;
  }

  buildTurbo() {
    this.turbo = new THREE.Group();
    this.turbo.position.set(0, 2.2, 0);
    this.turbo.userData.part = 'turbo';
    this.root.add(this.turbo);
    this.turbine = [];
    [-1.3, 1.3].forEach((x, i) => {
      const housing = this.mesh(new THREE.TorusGeometry(0.95, 0.22, 16, 48), i ? 'intake' : 'exhaust', this.turbo, [x, 0, 0]);
      housing.rotation.y = Math.PI / 2;
      const rotor = new THREE.Group();
      rotor.position.x = x;
      this.turbo.add(rotor);
      this.cylinder(0.22, 0.38, 'steel', rotor, [0, 0, 0], 'x');
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2;
        const blade = this.box(0.28, 0.61, 0.08, 'steel', rotor, [0, Math.cos(a) * 0.53, Math.sin(a) * 0.53]);
        blade.rotation.set(a, 0, 0.3);
      }
      this.turbine.push(rotor);
    });
    this.cylinder(0.115, 2.9, 'brass', this.turbo, [0, 0, 0], 'x');
    this.tube([[-3, 1.4, 0], [-2, 1.4, 0], [-1.3, 0.85, 0]], 0.18, 'exhaust', this.turbo);
    this.tube([[-1.3, 0, 0], [-2.3, 0, 0], [-3.3, -0.7, 0]], 0.2, 'exhaust', this.turbo);
    this.tube([[3.4, -0.6, 0], [2.5, 0, 0], [1.3, 0, 0]], 0.22, 'intake', this.turbo);
    this.tube([[1.3, 0.9, 0], [2.3, 1.5, 0], [3.4, 1.5, 0]], 0.16, 'intake', this.turbo);
    this.turboParticles = [];
    for (let i = 0; i < 30; i++) this.turboParticles.push(this.mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: i < 15 ? 0xff9a6e : 0x6bdafa }), this.turbo));
    this.turbo.visible = false;
  }

  addLabels() {
    this.labelElements = [];
    const add = (text, position, mode, part, cylinder) => {
      const element = document.createElement('button');
      element.className = 'model-label';
      element.textContent = text;
      element.addEventListener('click', () => this.onSelect(part, cylinder));
      this.container.append(element);
      this.labelElements.push({ element, position: V(...position), mode, cylinder });
    };
    this.cylinders.forEach(({ x }, i) => add(`${i + 1}`, [x, 5.3, 0], 'engine', 'piston', i));
    add('Wał korbowy', [-1.6, 0.1, 0.7], 'engine', 'crank');
    add('Zawory i rozrząd', [-0.8, 5.65, -0.2], 'cylinder', 'valves');
    add('Sprzęgło', [3.5, 2.2, 0], 'drive', 'clutch');
    add('Skrzynia biegów', [6.8, 2.3, 0], 'drive', 'gearbox');
    add('Napęd kół', [11, 0.7, 0], 'drive', 'wheel');
    add('Turbina · spaliny', [-1.3, 3.75, 0], 'turbo', 'turbo');
    add('Sprężarka · powietrze', [1.5, 0.65, 0], 'turbo', 'turbo');
  }

  setView(mode, instant = false) {
    this.mode = mode;
    this.engine.visible = mode !== 'turbo';
    this.drive.visible = mode === 'drive';
    this.turbo.visible = mode === 'turbo';
    this.block.visible = mode !== 'cylinder';
    this.cylinders.forEach((c, i) => { c.group.visible = mode !== 'cylinder' || i === this.selectedCylinder; });
    this.crankshaft.visible = mode !== 'cylinder';
    this.camshaft.visible = mode !== 'cylinder';
    this.flywheel.visible = mode !== 'cylinder';
    this.pulley.visible = mode !== 'cylinder';
    this.camPulley.visible = mode !== 'cylinder';
    const x = this.cylinders[this.selectedCylinder].x;
    const views = {
      engine: { target: [-0.65, 2.65, 0], position: [7.3, 6.8, 13.5] },
      cylinder: { target: [x, 3.1, 0], position: [x + 3.5, 4.6, 6.5] },
      drive: { target: [3.3, 1.7, 0], position: [13, 9.5, 21] },
      turbo: { target: [0, 2.4, 0], position: [4.8, 5.3, 9.7] }
    };
    const view = views[mode];
    this.cameraGoal = V(...view.position);
    this.targetGoal = V(...view.target);
    if (this.container.clientWidth < 600 && mode !== 'cylinder') this.cameraGoal.sub(this.targetGoal).multiplyScalar(1.35).add(this.targetGoal);
    if (instant) {
      this.camera.position.copy(this.cameraGoal);
      this.controls.target.copy(this.targetGoal);
      this.cameraGoal = null;
    }
    this.transition = 1;
  }

  selectCylinder(index) {
    this.selectedCylinder = index;
    if (this.mode === 'cylinder') this.setView('cylinder');
  }

  zoom(factor) {
    this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);
    this.cameraGoal = null;
    this.controls.update();
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(sim, dt) {
    const a = sim.angle * Math.PI / 180;
    this.crankshaft.rotation.x = a;
    this.camshaft.rotation.x = a / 2;
    this.flywheel.rotation.x = a;
    this.pulley.rotation.x = a;
    this.camPulley.rotation.x = a / 2;
    this.frontCover.visible = !this.cutaway;
    this.cylinders.forEach((c, i) => {
      const degrees = cycleDegrees(sim.angle, i);
      const theta = degrees * Math.PI / 180;
      const phase = strokeIndex(sim.angle, i);
      const y = pistonHeight(degrees);
      c.piston.position.y = y;
      const pin = V(0, 0.8 + 0.65 * Math.cos(theta), 0.65 * Math.sin(theta));
      this.rod(c.rod, pin, V(0, y, 0));
      c.cap.position.copy(pin);
      c.full.visible = !this.cutaway;
      const height = Math.max(0.03, 4.22 - y - 0.23);
      c.chamber.scale.y = height;
      c.chamber.position.y = y + 0.23 + height / 2;
      c.chamber.material.color.setHex(COLORS[phase]);
      c.chamber.material.opacity = sim.running ? phase === 2 ? 0.32 : 0.18 : 0.04;
      c.valves[0].position.y = 4.27 - (phase === 0 ? Math.sin(degrees / 180 * Math.PI) * 0.21 : 0);
      c.valves[1].position.y = 4.27 - (phase === 3 ? Math.sin((degrees - 540) / 180 * Math.PI) * 0.21 : 0);
      c.spark.visible = sim.running && degrees >= 345 && degrees < 375;
      c.spark.scale.setScalar(0.7 + Math.abs(Math.sin(degrees * 1.3)) * 0.7);
      c.mpi.visible = sim.injection === 'mpi';
      c.gdi.visible = sim.injection === 'gdi';
      c.particles.forEach((particle, n) => {
        const p = ((degrees % 180) / 180 * 2 + n / 20) % 1;
        const fuel = n < 6;
        particle.visible = sim.running && (phase === 0 || phase === 3 || phase === 1 && sim.injection === 'gdi' && fuel);
        if (phase === 3) particle.position.set(0.27 + p * 0.38, 3.9 + p * 0.6, -p * 1.1);
        else if (phase === 1) particle.position.set(0.3 - p * 0.45, 4.15 - p * height * 0.8, 0.3 + Math.sin(n * 6) * p * 0.2);
        else particle.position.set(-0.27 + Math.sin(n * 4) * p * 0.22, 4.45 - p * (height + 0.17), -0.8 + p * 1.0);
        particle.material.color.setHex(phase === 3 ? COLORS[3] : fuel && (sim.injection === 'mpi' || phase === 1) ? 0xffdc80 : COLORS[0]);
      });
    });
    this.clutchDisc.position.x = 3.38 + sim.clutch * 0.3;
    this.pressurePlate.position.x = 3.59 + sim.clutch * 0.4;
    this.clutchDisc.rotation.x = sim.inputAngle;
    this.pressurePlate.rotation.x = a;
    this.gears.forEach(({ top, bottom, selector, ratio }, i) => {
      top.rotation.x = sim.inputAngle;
      bottom.rotation.x = -sim.inputAngle / ratio;
      selector.rotation.x = -sim.outputAngle;
      selector.visible = sim.gear === i + 1;
      bottom.children[0].material = sim.gear === i + 1 ? this.materials.brass : this.materials.steel;
    });
    this.wheel.rotation.x = -sim.outputAngle / 3.9;
    this.turbine.forEach(rotor => {
      if (!sim.paused) rotor.rotation.x += dt * (sim.running && sim.turbo ? 1 + sim.boost * 28 : 0);
    });
    this.turboParticles.forEach((particle, i) => {
      const p = ((a / (Math.PI * 2)) + i / 15) % 1;
      particle.visible = sim.turbo && sim.running;
      particle.position.set(i < 15 ? -3 + p * 1.7 : 3.4 - p * 2.1, i < 15 ? 1.4 - p * 0.55 : -0.6 + p * 0.6, 0.25);
    });
    if (this.cameraGoal) {
      const lerp = 1 - Math.exp(-dt * 7);
      this.camera.position.lerp(this.cameraGoal, lerp);
      this.controls.target.lerp(this.targetGoal, lerp);
      if (this.camera.position.distanceTo(this.cameraGoal) < 0.02) this.cameraGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelElements.forEach(label => {
      const show = this.labels && (label.mode === this.mode || this.mode === 'cylinder' && label.cylinder === this.selectedCylinder);
      label.element.hidden = !show;
      if (!show) return;
      const position = label.position.clone();
      if (label.mode === 'cylinder') position.set(this.cylinders[this.selectedCylinder].x, 5.2, 0);
      position.project(this.camera);
      label.element.style.left = `${(position.x * 0.5 + 0.5) * this.container.clientWidth}px`;
      label.element.style.top = `${(-position.y * 0.5 + 0.5) * this.container.clientHeight}px`;
      label.element.style.visibility = position.z > 1 || Math.abs(position.x) > 0.95 || Math.abs(position.y) > 0.96 ? 'hidden' : 'visible';
      label.element.classList.toggle('selected', label.cylinder === this.selectedCylinder);
    });
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse(object => {
      object.geometry?.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => material.dispose());
    });
    this.environmentTarget.dispose();
    this.renderer.dispose();
  }
}
