import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';

export class FinalDriveModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'finalDrive';
    this.demo = false;
    this.demoAngle = 0;
    this.demoOffset = 0;
    this.leftSpeed = 0;
    this.rightSpeed = 0;
    this.carrierSpeed = 0;
    this.leftMaterial = this.material({ color: 0x55c5f2, metalness: 0.45, roughness: 0.4 });
    this.rightMaterial = this.material({ color: 0xf7ba55, metalness: 0.45, roughness: 0.4 });
    this.input = this.subgroup(this.group, [-1.4, 0, 0], 'propShaft');
    this.cylinder(0.13, 2.6, 'steel', this.input, [-1.3, 0, 0], 'x', 'propShaft');
    this.pinion = this.gear(10, 0.32, 0.3, 'brass', this.input, [0, 0, 0], 'finalDrive');
    [-0.6, -2.5].forEach(x => {
      this.annulus(0.23, 0.14, 0.12, 'dark', this.input, [x, 0, 0], 'propShaft');
      this.box(0.12, 0.52, 0.15, 'steel', this.input, [x, 0, 0], 'propShaft');
      this.box(0.12, 0.15, 0.52, 'steel', this.input, [x, 0, 0], 'propShaft');
    });
    this.carrier = this.subgroup(this.group, [0, 0, 0], 'differential');
    this.crown = this.gear(39, 1.248, 0.18, 'brass', this.carrier, [0, 0, -0.38], 'finalDrive');
    this.crown.rotation.y = Math.PI / 2;
    for (const z of [-0.45, 0.45]) {
      const ring = this.annulus(0.85, 0.68, 0.1, 'steel', this.carrier, [0, 0, z], 'differential');
      ring.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const rib = this.box(0.15, 0.15, 0.92, 'steel', this.carrier, [Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0], 'differential');
      rib.rotation.z = a;
    }
    this.carrierFrame = this.carrier.children.slice();
    this.cylinder(0.065, 1.25, 'dark', this.carrier, [0, 0, 0], 'y', 'differential');
    this.planets = [];
    for (const side of [-1, 1]) {
      const holder = this.subgroup(this.carrier, [0, side * 0.40, 0], 'differential');
      holder.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(0, side, 0));
      const planet = this.bevel(12, 0.33, 0.23, 'exhaust', holder);
      this.box(0.35, 0.025, 0.055, 'white', planet, [0, 0.125, 0], 'differential');
      this.planets.push({ planet, side });
    }
    this.wheels = [];
    this.axles = [];
    for (const side of [-1, 1]) {
      const axle = this.subgroup(this.group, [0, 0, 0], 'halfShaft');
      this.cylinder(0.13, 2.95, side < 0 ? this.leftMaterial : this.rightMaterial, axle, [0, 0, side * 1.7], 'z', 'halfShaft');
      const holder = this.subgroup(axle, [0, 0, side * 0.34], 'differential');
      holder.quaternion.setFromUnitVectors(vec(0,1,0),vec(0,0,side));
      this.bevel(16, 0.45, 0.23, side < 0 ? this.leftMaterial : this.rightMaterial, holder);
      for (const z of [0.95, 2.65]) {
        this.cylinder(0.23, 0.35, 'dark', axle, [0, 0, side * z], 'z', 'halfShaft');
        for (let n = 0; n < 4; n++) this.ring(0.225, 0.022, 'black', axle, [0, 0, side * (z - 0.12 + n * 0.08)], 'z', 'halfShaft');
      }
      const wheel = this.subgroup(axle, [0, 0, side * 3.0], 'wheelHub');
      this.ring(1.05, 0.22, 'black', wheel, [0, 0, 0], 'z', 'wheelHub');
      const rim = this.annulus(0.87, 0.72, 0.28, 'steel', wheel, [0, 0, 0], 'wheelHub');
      rim.rotation.y = Math.PI / 2;
      this.cylinder(0.2, 0.46, 'brass', wheel, [0, 0, 0], 'z', 'wheelHub');
      const brake = this.annulus(0.61, 0.23, 0.065, 'steel', wheel, [0, 0, -side * 0.24], 'wheelHub');
      brake.rotation.y = Math.PI / 2;
      for (let n = 0; n < 6; n++) {
        const a = n / 6 * Math.PI * 2;
        const spoke = this.box(0.68, 0.09, 0.14, side < 0 ? this.leftMaterial : this.rightMaterial, wheel, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], 'wheelHub');
        spoke.rotation.z = a;
        this.cylinder(0.042, 0.49, 'dark', wheel, [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0], 'z', 'wheelHub', 6);
      }
      this.box(0.29, 0.43, 0.2, 'exhaust', this.group, [0.48, 0, side * 2.73], 'wheelHub');
      this.box(0.1, 0.43, 0.05, 'white', wheel, [0, 0.82, side * 0.23], 'wheelHub');
      this.anchor(side < 0 ? 'L · Koło lewe' : 'P · Koło prawe', this.group, [0, 1.55, side * 3], 'halfShaft', ['differential']);
      this.axles.push(axle);
      this.wheels.push(wheel);
    }
    this.housing = this.mesh(new THREE.SphereGeometry(1.39, 28, 18), this.material({ color: 0x68828e, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.2, depthWrite: false }), this.group, [0, 0, 0], 'finalDrive');
    this.housing.scale.z = 0.55;
    this.anchor('Przekładnia główna · 3,9:1', this.group, [-1.4, 1.6, 0], 'finalDrive', ['drive-detail', 'differential']);
    this.anchor('Kosz i satelity', this.group, [0, 1.25, 0.7], 'differential', ['drive-detail', 'differential']);
    this.anchor('Półosie i przeguby', this.group, [0, 0.5, 1.85], 'halfShaft', ['drive-detail', 'differential']);
    this.anchor('Piasta i hamulec', this.group, [0, 1.5, 3], 'wheelHub', ['drive-detail', 'differential']);
  }

  bevel(teeth, radius, depth, material, parent) {
    const group = this.subgroup(parent, [0, 0, 0], 'differential');
    this.mesh(new THREE.CylinderGeometry(radius * 0.55, radius, depth, teeth * 2), material, group);
    for (let n = 0; n < teeth; n++) {
      const a = n / teeth * Math.PI * 2;
      const tooth = this.box(0.1, depth * 0.92, 0.065, material, group, [Math.cos(a) * radius * 0.82, 0, Math.sin(a) * radius * 0.82], 'differential');
      tooth.rotation.y = -a;
      tooth.rotation.z = 0.42;
    }
    return group;
  }

  bounds() {
    this.group.updateMatrixWorld(true);
    return new THREE.Box3(vec(-4.2, -1.45, -3.4), vec(1.6, 1.85, 3.4)).applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway, dt = 0) {
    if (!this.group.visible) return;
    if (this.demo && !sim.paused) {
      this.demoAngle += dt * 1.4;
      this.demoOffset += dt * 1.4 * sim.turn * 0.5;
    }
    const angle = this.demo ? this.demoAngle : sim.outputAngle / 3.9;
    const offset = this.demo ? this.demoOffset : sim.differentialAngle;
    this.carrierSpeed = this.demo ? 1.4 * 30 / Math.PI : sim.speed / 0.31 * 30 / Math.PI;
    this.leftSpeed = this.carrierSpeed * (1 - sim.turn * 0.5);
    this.rightSpeed = this.carrierSpeed * (1 + sim.turn * 0.5);
    this.input.rotation.x = -angle * 3.9;
    this.carrier.rotation.z = -angle;
    this.axles[0].rotation.z = -(angle - offset);
    this.axles[1].rotation.z = -(angle + offset);
    this.planets.forEach(({planet,side}) => { planet.rotation.y = side * offset * 16 / 12; });
    this.housing.visible = !cutaway && !this.openCarrier;
    this.carrierFrame.forEach(part => { part.visible = !this.openCarrier; });
  }
}
