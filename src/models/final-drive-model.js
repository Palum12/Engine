import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';

export class FinalDriveModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'finalDrive';
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
    this.cylinder(0.065, 1.25, 'dark', this.carrier, [0, 0, 0], 'y', 'differential');
    for (const y of [-0.43, 0.43]) {
      const planet = this.gear(12, 0.26, 0.16, 'steel', this.carrier, [0, y, 0], 'differential');
      planet.rotation.z = Math.PI / 2;
    }
    this.wheels = [];
    this.axles = [];
    for (const side of [-1, 1]) {
      const axle = this.subgroup(this.group, [0, 0, 0], 'halfShaft');
      this.cylinder(0.13, 2.95, 'brass', axle, [0, 0, side * 1.7], 'z', 'halfShaft');
      const sideGear = this.gear(16, 0.36, 0.15, 'steel', axle, [0, 0, side * 0.3], 'differential');
      sideGear.rotation.y = Math.PI / 2;
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
        const spoke = this.box(0.68, 0.09, 0.14, 'block', wheel, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], 'wheelHub');
        spoke.rotation.z = a;
        this.cylinder(0.042, 0.49, 'dark', wheel, [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0], 'z', 'wheelHub', 6);
      }
      this.box(0.29, 0.43, 0.2, 'exhaust', this.group, [0.48, 0, side * 2.73], 'wheelHub');
      this.axles.push(axle);
      this.wheels.push(wheel);
    }
    this.housing = this.mesh(new THREE.SphereGeometry(1.39, 28, 18), this.material({ color: 0x68828e, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.2, depthWrite: false }), this.group, [0, 0, 0], 'finalDrive');
    this.housing.scale.z = 0.55;
    this.anchor('Przekładnia główna · 3,9:1', this.group, [-1.4, 1.6, 0], 'finalDrive', ['drive-detail']);
    this.anchor('Kosz i satelity', this.group, [0, 1.25, 0.7], 'differential', ['drive-detail']);
    this.anchor('Półosie i przeguby', this.group, [0, 0.5, 1.85], 'halfShaft', ['drive-detail']);
    this.anchor('Piasta i hamulec', this.group, [0, 1.5, 3], 'wheelHub', ['drive-detail']);
  }

  bounds() {
    this.group.updateMatrixWorld(true);
    return new THREE.Box3(vec(-4.2, -1.45, -3.4), vec(1.6, 1.85, 3.4)).applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway) {
    if (!this.group.visible) return;
    this.input.rotation.x = -sim.outputAngle;
    this.carrier.rotation.z = -sim.outputAngle / 3.9;
    this.axles.forEach(axle => { axle.rotation.z = -sim.outputAngle / 3.9; });
    this.housing.visible = !cutaway;
  }
}
