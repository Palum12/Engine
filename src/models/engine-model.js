import * as THREE from 'three';
import { getEngine, cylinderLayout } from '../engines.js';
import { cycleDegrees, pistonHeight, strokeIndex } from '../simulation.js';
import { ModelGeometry, vec, PHASE_COLORS, UP } from './geometry.js';

export class EngineModel extends ModelGeometry {
  constructor(materials, id = 'r4') {
    super(materials);
    this.id = id;
    this.config = getEngine(id);
    this.group.userData.part = 'block';
    this.cylinders = [];
    this.camshafts = [];
    const rows = this.config.cylinders / (this.config.bankAngle ? 2 : 1);
    this.length = rows * 1.8;
    this.shaftEnd = this.length / 2 + 0.45;
    this.structure = this.subgroup();
    this.crankshaft = this.subgroup(this.structure, [0, 0.8, 0], 'crank');
    this.cylinder(0.18, this.length + 1.2, 'steel', this.crankshaft, [0, 0, 0], 'x');
    this.housing = this.subgroup(this.structure, [0, 0, 0], 'block');
    this.box(this.length + 0.2, 0.18, 0.18, 'dark', this.housing, [0, 0.3, -0.8]);
    this.box(this.length + 0.2, 0.18, 0.18, 'dark', this.housing, [0, 0.3, 0.8]);
    for (let i = 0; i <= rows; i++) {
      const x = (i - rows / 2) * 1.8;
      this.annulus(0.33, 0.19, 0.16, 'block', this.housing, [x, 0.8, 0], 'crank');
      this.box(0.16, 0.5, 0.17, 'block', this.housing, [x, 0.49, 0]);
      this.box(0.18, 0.12, 1.7, 'block', this.housing, [x, 0.28, 0]);
    }
    this.portMaterials = [
      this.material({ color: 0x64c8e8, metalness: 0.22, roughness: 0.35, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }),
      this.material({ color: 0xdd785c, metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide })
    ];
    for (let i = 0; i < this.config.cylinders; i++) this.buildCylinder(i);
    const banks = this.config.bankAngle ? 2 : 1;
    for (let bank = 0; bank < banks; bank++) {
      const root = this.subgroup(this.structure, [0, 0.8, 0], 'valves');
      root.rotation.x = banks === 1 ? 0 : (bank === 0 ? -1 : 1) * Math.PI / 6;
      const shaft = this.subgroup(root, [0, 4.31, -0.12], 'valves');
      this.cylinder(0.075, this.length, 'steel', shaft, [0, 0, 0], 'x');
      this.cylinders.filter(c => c.layout.bank === bank).forEach(c => {
        [-0.27, 0.27].forEach((dx, n) => {
          const cam = this.subgroup(shaft, [c.layout.x + dx, 0, 0]);
          cam.rotation.x = -c.layout.offset * Math.PI / 360 + n * Math.PI * 0.5;
          const lobe = this.cylinder(0.14, 0.12, 'brass', cam, [0, 0.045, 0], 'x');
          lobe.scale.y = 1.2;
        });
      });
      this.camshafts.push(shaft);
    }
    this.pulley = this.gear(36, 0.48, 0.12, 'dark', this.structure, [-this.shaftEnd, 0.8, 0], 'crank');
    this.anchor('1 · Silnik', this.structure, [0, 5.65, 0], 'block', ['drive-detail']);
    this.anchor('Wał korbowy', this.structure, [0, 0.0, 0.9], 'crank', ['engine', 'drive-detail']);
    if (this.config.bankAngle) {
      this.anchor('Bank A · nieparzyste', this.structure, [-this.length / 2 - 0.15, 4.2, -2.1], 'banks', ['engine', 'drive-detail']);
      this.anchor('Bank B · parzyste', this.structure, [-this.length / 2 - 0.15, 4.2, 2.1], 'banks', ['engine', 'drive-detail']);
    }
    this.group.updateMatrixWorld(true);
  }

  buildCylinder(index) {
    const layout = cylinderLayout(this.id, index);
    const pivot = this.subgroup(this.group, [layout.x, 0.8, 0], 'piston');
    pivot.rotation.x = layout.bankRadians;
    pivot.userData.cylinder = index;
    const unit = this.subgroup(pivot, [0, -0.8, 0]);
    const sleeve = this.mesh(this.geometry('sleeve', () => new THREE.CylinderGeometry(0.67, 0.67, 2.13, 40, 1, true, Math.PI / 2, Math.PI)), 'block', unit, [0, 3.18, 0], 'block');
    const front = this.mesh(this.geometry('sleeveFront', () => new THREE.CylinderGeometry(0.67, 0.67, 2.13, 40, 1, true, -Math.PI / 2, Math.PI)), 'block', unit, [0, 3.18, 0], 'block');
    this.box(1.43, 0.13, 0.42, 'dark', unit, [0, 4.35, -0.45], 'valves');
    [-0.6, 0.6].forEach(x => {
      this.cylinder(0.075, 0.18, 'steel', unit, [x, 4.4, -0.44], 'y');
      this.cylinder(0.046, 2.13, 'steel', unit, [x, 3.19, -0.36], 'y');
    });
    const piston = this.subgroup(unit, [0, 0, 0], 'piston');
    this.cylinder(0.57, 0.42, 'steel', piston, [0, 0, 0]);
    this.cylinder(0.58, 0.035, 'brass', piston, [0, 0.21, 0]);
    [0.14, 0.04, -0.07].forEach(y => this.ring(0.573, 0.018, 'black', piston, [0, y, 0], 'y'));
    this.cylinder(0.095, 1.2, 'dark', piston, [0, -0.07, 0], 'x');
    const rod = this.cylinder(0.08, 1, 'brass', unit, [0, 0, 0], 'y', 'rod', 16);
    const cap = this.annulus(0.21, 0.12, 0.19, 'steel', unit, [0, 0, 0], 'rod');
    const crank = this.subgroup(this.crankshaft, [layout.x, 0, 0], 'crank');
    crank.rotation.x = layout.offset * Math.PI / 180 + layout.bankRadians;
    this.cylinder(0.115, 0.34, 'steel', crank, [0, 0.65, 0], 'x');
    [-0.22, 0.22].forEach(x => {
      this.box(0.11, 0.85, 0.3, 'dark', crank, [x, 0.24, 0]);
      this.cylinder(0.26, 0.12, 'steel', crank, [x, 0.65, 0], 'x');
      this.cylinder(0.32, 0.15, 'dark', crank, [x, -0.18, 0], 'x');
    });
    const valves = [];
    [-0.27, 0.27].forEach((x, i) => {
      const valve = this.subgroup(unit, [x, 4.22, 0], 'valves');
      this.cylinder(0.17, 0.045, i ? 'exhaust' : 'intake', valve, [0, 0, 0]);
      this.cylinder(0.03, 0.74, 'steel', valve, [0, 0.37, 0]);
      for (let n = 0; n < 7; n++) this.ring(0.068, 0.012, 'steel', valve, [0, 0.42 + n * 0.035, 0], 'y');
      this.cylinder(0.1, 0.04, 'steel', valve, [0, 0.7, 0]);
      valves.push(valve);
    });
    const plug = this.subgroup(unit, [0, 4.32, 0.3], 'spark');
    this.cylinder(0.045, 0.22, 'steel', plug, [0, -0.04, 0]);
    this.cylinder(0.065, 0.15, 'white', plug, [0, 0.16, 0]);
    this.cylinder(0.045, 0.1, 'dark', plug, [0, 0.28, 0]);
    const spark = this.mesh(this.geometry('spark', () => new THREE.SphereGeometry(0.085, 10, 8)), this.material({ color: 0xfff3a4, toneMapped: false }, true), unit, [0, 4.18, 0.3], 'spark');
    const chamber = this.cylinder(0.555, 1, this.material({ color: PHASE_COLORS[0], transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }, true), unit, [0, 3.8, 0]);
    chamber.userData.ignorePick = true;
    const intake = this.curve([[-0.87, 4.71, -0.03], [-0.62, 4.71, -0.03], [-0.27, 4.44, -0.03], [-0.27, 4.22, -0.03]]);
    const exhaust = this.curve([[0.27, 4.22, -0.03], [0.27, 4.43, -0.03], [0.62, 4.7, -0.03], [0.87, 4.7, -0.03]]);
    this.pipe(intake, 0.12, this.portMaterials[0], unit, 'intake');
    this.pipe(exhaust, 0.11, this.portMaterials[1], unit, 'exhaust');
    this.ring(0.12, 0.022, 'intake', unit, [-0.87, 4.71, -0.03], 'x', 'intake');
    this.ring(0.11, 0.022, 'exhaust', unit, [0.87, 4.7, -0.03], 'x', 'exhaust');
    const mpiTip = intake.getPoint(0.38);
    const gdiTip = vec(0.36, 4.17, 0.3);
    const mpi = this.injector(unit, mpiTip, vec(-0.4, 0.9, 0.3));
    const gdi = this.injector(unit, gdiTip, vec(0.6, 0.8, 0.12));
    const air = this.particles(14, 0x69d5ff, 0.024, unit);
    const fuel = this.particles(20, 0xffcc51, 0.019, unit);
    const gas = this.particles(14, 0xff8a70, 0.027, unit);
    const injectorAnchor = this.anchor('Wtrysk MPI · przed zaworem', unit, [-0.66, 5.45, 0], 'injection', ['cylinder'], index);
    this.anchor('Świeca', unit, [0.2, 4.74, 0.5], 'spark', ['cylinder'], index);
    this.anchor(String(index + 1), unit, [0, 5.34, 0], 'piston', ['engine', 'drive-detail'], index);
    this.cylinders.push({ layout, pivot, unit, sleeve, front, piston, rod, cap, valves, spark, chamber, intake, exhaust, mpi, gdi, mpiTip, gdiTip, air, fuel, gas, injectorAnchor });
  }

  injector(parent, tip, direction) {
    const group = this.subgroup(parent, tip.toArray(), 'injection');
    group.quaternion.setFromUnitVectors(UP, direction.normalize());
    this.cylinder(0.027, 0.12, 'steel', group, [0, 0.06, 0]);
    this.cylinder(0.065, 0.27, 'fuel', group, [0, 0.255, 0]);
    this.cylinder(0.089, 0.06, 'dark', group, [0, 0.27, 0]);
    this.box(0.13, 0.17, 0.13, 'black', group, [0, 0.46, 0]);
    this.ring(0.063, 0.013, 'black', group, [0, 0.135, 0], 'y');
    return group;
  }

  setView(mode, selected) {
    this.group.visible = ['engine', 'cylinder', 'drive', 'drive-detail'].includes(mode);
    this.structure.visible = mode !== 'cylinder';
    this.cylinders.forEach((c, i) => { c.pivot.visible = mode !== 'cylinder' || i === selected; });
  }

  bounds(mode, selected) {
    if (mode === 'cylinder') return new THREE.Box3().setFromObject(this.cylinders[selected].pivot);
    return new THREE.Box3(vec(-this.shaftEnd - 0.5, -0.05, this.config.bankAngle ? -2.75 : -0.9), vec(this.shaftEnd + 0.3, 5.5, this.config.bankAngle ? 2.75 : 0.95));
  }

  update(sim, cutaway) {
    if (!this.group.visible) return;
    const radians = sim.angle * Math.PI / 180;
    this.crankshaft.rotation.x = radians;
    this.pulley.rotation.x = radians;
    this.camshafts.forEach(shaft => { shaft.rotation.x = radians / 2; });
    this.portMaterials.forEach(material => { material.opacity = cutaway ? 0.24 : 1; material.depthWrite = !cutaway; });
    this.cylinders.forEach((c, index) => {
      const degrees = cycleDegrees(sim.angle, index, this.id);
      const theta = degrees * Math.PI / 180;
      const phase = strokeIndex(sim.angle, index, this.id);
      const y = pistonHeight(degrees);
      c.piston.position.y = y;
      const pin = vec(0, 0.8 + 0.65 * Math.cos(theta), 0.65 * Math.sin(theta));
      this.between(c.rod, pin, vec(0, y, 0));
      c.cap.position.copy(pin);
      c.front.visible = !cutaway;
      const floor = y + 0.25;
      const height = Math.max(0.025, 4.18 - floor);
      c.chamber.position.y = floor + height / 2;
      c.chamber.scale.y = height;
      c.chamber.material.color.setHex(PHASE_COLORS[phase]);
      c.chamber.material.opacity = sim.running ? phase === 2 ? 0.2 : 0.1 : 0.03;
      c.valves[0].position.y = 4.22 - (phase === 0 ? Math.sin(theta) * 0.18 : 0);
      c.valves[1].position.y = 4.22 - (phase === 3 ? Math.sin(theta - 3 * Math.PI) * 0.18 : 0);
      c.spark.visible = sim.running && degrees >= 347 && degrees < 373;
      c.mpi.visible = sim.injection === 'mpi';
      c.gdi.visible = sim.injection === 'gdi';
      const inlet = sim.running && phase === 0;
      const gdiFiring = sim.running && sim.injection === 'gdi' && degrees >= 230 && degrees <= 345;
      c.air.visible = inlet;
      c.fuel.visible = sim.injection === 'mpi' ? inlet : gdiFiring;
      c.gas.visible = sim.running && phase === 3;
      const flowTime = (degrees % 180) / 180 * 2;
      for (let n = 0; n < 14; n++) {
        const p = (flowTime + n / 14) % 1;
        let point;
        if (p < 0.65) point = c.intake.getPoint(p / 0.65);
        else {
          const t = (p - 0.65) / 0.35;
          point = vec(-0.27 + Math.sin(n * 1.7) * 0.12 * t, 4.17 - t * height * 0.85, -0.03 + Math.cos(n) * t * 0.1);
        }
        this.particle(c.air, n, point);
        if (p < 0.3) {
          const t = p / 0.3;
          point = vec(0.27, floor + height * (0.35 + 0.65 * t), -0.03);
        } else point = c.exhaust.getPoint((p - 0.3) / 0.7);
        this.particle(c.gas, n, point);
      }
      for (let n = 0; n < 20; n++) {
        const p = (flowTime + n / 20) % 1;
        let point;
        if (sim.injection === 'mpi') {
          if (p < 0.63) point = c.intake.getPoint(0.38 + p / 0.63 * 0.62);
          else {
            const t = (p - 0.63) / 0.37;
            point = vec(-0.27 + Math.cos(n * 2.4) * 0.1 * t, 4.17 - t * height * 0.8, -0.03 + Math.sin(n * 2.4) * 0.08 * t);
          }
        } else {
          point = c.gdiTip.clone().add(vec(-0.43 * p + Math.cos(n * 2.4) * 0.12 * p, -p * height * 0.8, -0.15 * p + Math.sin(n * 2.4) * 0.1 * p));
        }
        point.y = Math.max(floor + 0.02, point.y);
        this.particle(c.fuel, n, point);
      }
      c.air.instanceMatrix.needsUpdate = true;
      c.fuel.instanceMatrix.needsUpdate = true;
      c.gas.instanceMatrix.needsUpdate = true;
      const label = this.anchors.find(a => a.anchor === c.injectorAnchor);
      label.text = sim.injection === 'mpi' ? 'Wtrysk MPI · przed zaworem' : 'Wtrysk GDI · w cylindrze';
      c.injectorAnchor.position.set(sim.injection === 'mpi' ? -0.65 : 0.65, 5.45, 0.25);
    });
    this.group.updateMatrixWorld(true);
  }
}
