import * as THREE from 'three';
import { clamp } from '../simulation.js';
import { ModelGeometry, vec } from './geometry.js';

export class TurboModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'turbo';
    this.showFlow = true;
    this.rotorAngle = 0;
    this.flowTime = 0;
    this.wastegateOpening = 0;
    this.section = 'all';
    this.isolate = false;
    this.paths = [];
    this.covers = [];
    this.rotors = [];
    this.hot = this.subgroup(this.group, [-1.7, 0, 0], 'turbine');
    this.cold = this.subgroup(this.group, [1.7, 0, 0], 'compressor');
    this.center = this.subgroup(this.group, [0, 0, 0], 'turboBearing');
    this.cooler = this.subgroup(this.group, [3.6, -2.5, 0], 'intercooler');
    this.rotors.push(this.buildWheel(this.hot, false), this.buildWheel(this.cold, true));
    this.buildCenter();
    this.buildCooler();
    this.buildWastegate();
    this.addFlow([[-4.5, 1.9, 0], [-3.4, 1.9, 0], [-2.5, 1.55, 0], [-1.7, 1.05, 0]], 0xe68565, 'exhaust', 'exhaust', 0.22);
    this.addFlow([[-1.7, 0, 0], [-2.5, 0, 0], [-3.3, -0.8, 0], [-4.5, -0.8, 0]], 0xe68565, 'exhaust', 'exhaust', 0.25);
    this.addFlow([[4.9, 0, 0], [3.6, 0, 0], [2.5, 0, 0], [1.7, 0, 0]], 0x69d5ee, 'intake', 'compressor', 0.27);
    this.addFlow([[1.7, 1.06, 0], [2.5, 1.55, 0], [4.9, 1.1, 0], [4.9, -1.5, 0], [4.9, -2.5, 0], [4.65, -2.5, 0]], 0xf5b74e, 'charge', 'intercooler', 0.18);
    this.addFlow([[2.55, -2.5, 0], [1.7, -2.5, 0], [0.8, -3.15, 0], [-0.4, -3.15, 0], [-1.8, -3.15, 0]], 0x69d5ee, 'cooled', 'throttleBody', 0.2);
    this.throttle = this.subgroup(this.group, [0, -3.15, 0], 'throttleBody');
    this.ring(0.23, 0.035, 'steel', this.throttle, [0, 0, 0]);
    this.throttlePlate = this.cylinder(0.2, 0.025, 'brass', this.throttle, [0, 0, 0], 'x', 'throttleBody');
    this.cylinder(0.035, 0.58, 'steel', this.throttle, [0, 0, 0], 'y', 'throttleBody');
    this.box(0.34, 0.23, 0.23, 'dark', this.throttle, [0, 0.36, 0], 'throttleBody');
    this.anchor('5 · Turbo i intercooler', this.group, [0, 2.3, 0], 'turbo', ['drive-detail']);
    const views = ['turbo', 'drive-detail'];
    this.anchor('1 · Spaliny z silnika', this.group, [-4.0, 2.25, 0], 'exhaust', views);
    this.anchor('2 · Wirnik turbiny', this.hot, [0, -1.35, 0.6], 'turbine', views);
    this.anchor('3 · Wałek i łożyska', this.center, [0, 0.7, 0.7], 'turboBearing', views);
    this.anchor('4 · Wirnik sprężarki', this.cold, [0, -1.35, 0.6], 'compressor', views);
    this.anchor('Powietrze z filtra', this.group, [4.2, 0.48, 0.3], 'compressor', views);
    this.anchor('5 · Intercooler', this.cooler, [0, -0.85, 0.5], 'intercooler', views);
    this.anchor('6 · Przepustnica → silnik', this.throttle, [-0.5, -0.65, 0.5], 'throttleBody', views);
    this.anchor('Wastegate · obejście spalin', this.group, [-3.5, 0.6, 0.85], 'wastegate', views);
    this.anchor('Dopływ oleju', this.center, [0, 1.6, 0.4], 'turboOil', views);
  }

  buildWheel(parent, compressor) {
    const color = compressor ? 0x599fbf : 0xc77a5e;
    const casing = this.material({ color, metalness: 0.52, roughness: 0.38, side: THREE.DoubleSide });
    const profile = [new THREE.Vector2(0.9, -0.25), new THREE.Vector2(1.13, -0.14), new THREE.Vector2(1.22, 0.1), new THREE.Vector2(1.12, 0.34), new THREE.Vector2(0.85, 0.4), new THREE.Vector2(0.38, 0.28)];
    const shell = this.mesh(new THREE.LatheGeometry(profile, 48, Math.PI * 0.25, Math.PI * 1.5), casing, parent, [0, 0, 0]);
    shell.rotation.z = Math.PI / 2;
    const cover = this.mesh(new THREE.LatheGeometry(profile, 20, Math.PI * 1.75, Math.PI * 0.5), casing, parent, [0, 0, 0]);
    cover.rotation.z = Math.PI / 2;
    this.covers.push(cover);
    const spiral = Array.from({ length: 41 }, (_, i) => {
      const a = i / 40 * Math.PI * 1.7;
      const r = 0.86 + i / 40 * 0.24;
      return [0, Math.cos(a) * r, Math.sin(a) * r];
    });
    this.pipe(this.curve(spiral), 0.13, compressor ? 'intake' : 'exhaust', parent);
    this.annulus(0.98, 0.85, 0.09, 'dark', parent, [0.34, 0, 0]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      this.cylinder(0.048, 0.14, 'steel', parent, [0.36, Math.cos(a), Math.sin(a)], 'x', compressor ? 'compressor' : 'turbine', 6);
    }
    const rotor = this.subgroup(parent, [0, 0, 0]);
    this.cylinder(0.2, 0.7, 'steel', rotor, [0, 0, 0], 'x');
    const cone = this.mesh(new THREE.ConeGeometry(0.26, 0.6, 32), 'steel', rotor, [compressor ? 0.25 : -0.25, 0, 0]);
    cone.rotation.z = compressor ? -Math.PI / 2 : Math.PI / 2;
    const geometry = this.geometry(`blade:${compressor}`, () => {
      const vertices = [];
      const indices = [];
      for (let i = 0; i <= 12; i++) {
        const r = 0.22 + i / 12 * 0.63;
        const twist = (compressor ? 1 : -1) * i / 12 * 0.65;
        for (const side of [-1, 1]) vertices.push(side * (0.25 - i / 12 * 0.1), Math.cos(twist + side * 0.09) * r, Math.sin(twist + side * 0.09) * r);
        if (i < 12) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      return g;
    });
    const bladeMaterial = this.material({ color: compressor ? 0xb4d1df : 0xe0b29c, metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) this.mesh(geometry, bladeMaterial, rotor).rotation.x = i / 14 * Math.PI * 2;
    return rotor;
  }

  buildCenter() {
    this.shaft = this.cylinder(0.09, 3.9, 'brass', this.center, [0, 0, 0], 'x', 'turboShaft');
    for (const x of [-0.7, 0.7]) {
      this.annulus(0.27, 0.105, 0.28, 'brass', this.center, [x, 0, 0], 'turboBearing');
      this.annulus(0.36, 0.275, 0.32, 'steel', this.center, [x, 0, 0], 'turboBearing');
      for (const dx of [-0.2, 0.2]) this.annulus(0.22, 0.1, 0.04, 'dark', this.center, [x + dx, 0, 0], 'turboBearing');
    }
    this.annulus(0.3, 0.1, 0.07, 'brass', this.center, [0.37, 0, 0], 'turboBearing');
    const shell = this.mesh(new THREE.CylinderGeometry(0.43, 0.43, 2.5, 32, 1, true, Math.PI / 2, Math.PI), 'block', this.center);
    shell.rotation.z = Math.PI / 2;
    const cover = this.mesh(new THREE.CylinderGeometry(0.43, 0.43, 2.5, 32, 1, true, Math.PI * 1.5, Math.PI), 'block', this.center);
    cover.rotation.z = Math.PI / 2;
    this.covers.push(cover);
    const oil = this.material({ color: 0x83bc83, metalness: 0.35, roughness: 0.4 });
    this.pipe(this.curve([[0, 1.3, -0.25], [0, 0.9, -0.25], [0, 0.42, 0]]), 0.06, oil, this.center, 'turboOil');
    this.pipe(this.curve([[0, -0.42, 0], [0, -0.9, -0.25], [0, -1.5, -0.25]]), 0.095, oil, this.center, 'turboOil');
    this.cylinder(0.13, 0.15, 'brass', this.center, [0, 0.5, 0], 'y', 'turboOil', 6);
  }

  buildCooler() {
    this.box(2.05, 0.9, 0.48, 'dark', this.cooler, [0, 0, 0]);
    for (let i = 0; i < 18; i++) this.box(0.05, 0.82, 0.5, 'steel', this.cooler, [-0.9 + i * 0.106, 0, 0]);
    for (const y of [-0.5, 0.5]) this.box(2.2, 0.09, 0.54, 'block', this.cooler, [0, y, 0]);
    for (const x of [-1.05, 1.05]) this.box(0.25, 1.05, 0.58, 'intake', this.cooler, [x, 0, 0]);
  }

  buildWastegate() {
    this.addFlow([[-3.4, 1.9, 0], [-3.6, 1.0, 0.6], [-3.7, 0.15, 0.6], [-3.3, -0.8, 0]], 0xe68565, 'bypass', 'wastegate', 0.12);
    this.gate = this.subgroup(this.group, [-3.65, 0.6, 0.6], 'wastegate');
    this.cylinder(0.115, 0.035, 'brass', this.gate, [0, 0, 0], 'y', 'wastegate');
    this.cylinder(0.22, 0.33, 'steel', this.group, [-2.6, 0.7, 0.85], 'x', 'wastegate');
    this.gateRod = this.cylinder(0.035, 1, 'brass', this.group, [0, 0, 0], 'y', 'wastegate');
  }

  addFlow(points, color, kind, part, radius) {
    const curve = this.curve(points);
    const material = this.material({ color, metalness: 0.18, roughness: 0.4, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.pipe(curve, radius, material, this.group, part);
    const count = Math.max(3, Math.ceil(curve.getLength() / 0.6));
    const arrows = this.arrows(count, color, this.group, 0.16);
    arrows.userData.part = part;
    this.paths.push({ curve, kind, part, arrows, material });
  }

  sectionAllows(part) {
    if (!this.isolate || this.section === 'all') return true;
    const parts = {
      turbine: ['turbine', 'exhaust'], compressor: ['compressor'],
      turboBearing: ['turboBearing', 'turboShaft', 'turboOil'],
      wastegate: ['wastegate'], intercooler: ['intercooler', 'throttleBody']
    };
    return (parts[this.section] || []).includes(part);
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    this.isolate = isolate;
    this.group.children.forEach(child => { child.visible = this.sectionAllows(child.userData.part); });
  }

  bounds(section = 'all') {
    const boxes = {
      all: [[-4.9, -4, -1.5], [5.3, 2.6, 1.5]],
      turbine: [[-3, -1.5, -1.35], [-0.8, 1.7, 1.35]],
      compressor: [[0.6, -1.5, -1.35], [3.1, 1.7, 1.35]],
      turboBearing: [[-1.45, -1.6, -0.8], [1.45, 1.6, 0.9]],
      wastegate: [[-4.2, -1.1, -0.5], [-2.1, 2.1, 1.25]],
      intercooler: [[-1.6, -4, -0.8], [5.3, -1.35, 0.8]]
    };
    this.group.updateMatrixWorld(true);
    const [min, max] = boxes[section] || boxes.all;
    return new THREE.Box3(vec(...min), vec(...max)).applyMatrix4(this.group.matrixWorld);
  }

  update(sim, dt, cutaway) {
    if (!this.group.visible) return;
    const active = sim.running && sim.turbo;
    this.wastegateOpening = active ? clamp((sim.boost - 0.4) / 0.35, 0, 1) : 0;
    if (!sim.paused && active) {
      this.rotorAngle += dt * (0.8 + sim.boost * 18);
      this.flowTime += dt * (0.12 + sim.throttle * 0.38);
    }
    this.rotors.forEach(rotor => { rotor.rotation.x = this.rotorAngle; });
    this.covers.forEach(cover => { cover.visible = !cutaway; });
    this.gate.rotation.z = this.wastegateOpening * Math.PI * 0.45;
    this.between(this.gateRod, vec(-2.65, 0.7, 0.85), vec(-3.65 + this.wastegateOpening * 0.12, 0.6, 0.85));
    this.throttlePlate.rotation.y = (0.06 + sim.throttle * 0.94) * Math.PI / 2;
    this.paths.forEach(({ curve, kind, part, arrows, material }) => {
      material.opacity = cutaway ? 0.22 : 1;
      material.depthWrite = !cutaway;
      arrows.visible = this.sectionAllows(part) && this.showFlow && active && (kind !== 'bypass' || this.wastegateOpening > 0.05);
      if (!arrows.visible) return;
      for (let n = 0; n < arrows.count; n++) {
        const t = (this.flowTime + n / arrows.count) % 1;
        this.arrow(arrows, n, curve.getPoint(t), curve.getTangent(t));
      }
      arrows.instanceMatrix.needsUpdate = true;
    });
  }
}
