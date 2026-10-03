import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';
import { bevelGearGeometry } from './mechanical-geometry.js';

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
    this.input = this.subgroup(this.group, [0, 0, -1.02], 'propShaft');
    this.cylinder(0.09, 2.6, 'steel', this.input, [-2.45, 0, 0], 'x', 'propShaft');
    this.pinion = this.subgroup(this.input, [0, 0, 0], 'finalDrive');
    this.pinion.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(-1, 0, 0));
    this.mesh(bevelGearGeometry(10, 39, 0.06, 0.25, 0.10), 'brass', this.pinion);
    [-1.5, -2.9].forEach(x => {
      this.annulus(0.23, 0.14, 0.12, 'dark', this.input, [x, 0, 0], 'propShaft');
      this.box(0.12, 0.52, 0.15, 'steel', this.input, [x, 0, 0], 'propShaft');
      this.box(0.12, 0.15, 0.52, 'steel', this.input, [x, 0, 0], 'propShaft');
    });
    this.carrier = this.subgroup(this.group, [0, 0, 0], 'differential');
    this.crown = this.subgroup(this.carrier, [0, 0, -1.02], 'finalDrive');
    this.crown.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(0, 0, 1));
    this.mesh(bevelGearGeometry(39, 10, 0.06, 0.25, 0.25), 'brass', this.crown);
    this.sideGears = [];
    this.sideHolders = [];
    this.coreScale = 1;
    this.shafts = [];
    this.innerJoints = [];
    this.bearings = [];
    for (const z of [-0.65, 0.65]) {
      const ring = this.annulus(0.82, 0.66, 0.09, 'steel', this.carrier, [0, 0, z], 'differential');
      ring.rotation.y = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const rib = this.box(0.12, 0.12, 1.3, 'steel', this.carrier, [Math.cos(a) * 0.74, Math.sin(a) * 0.74, 0], 'differential');
      rib.rotation.z = a;
    }
    this.carrierFrame = this.carrier.children.slice();
    this.cylinder(0.055, 1.48, 'dark', this.carrier, [0, 0, 0], 'y', 'differential');
    this.planets = [];
    for (const side of [-1, 1]) {
      const holder = this.subgroup(this.carrier, [0, 0, 0], 'differential');
      holder.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(0, side, 0));
      const planet = this.subgroup(holder, [0, 0, 0], 'differential');
      this.mesh(bevelGearGeometry(12, 16, 0.07, 0.20, 0.06), 'exhaust', planet);
      this.box(0.18, 0.012, 0.025, 'white', planet, [0.17, 0.69, 0], 'differential');
      const washer = this.annulus(0.30, 0.07, 0.04, 'brass', holder, [0, 0.72, 0], 'differential');
      washer.rotation.z = Math.PI / 2;
      this.planets.push({ planet, holder, side });
    }
    this.coreParts = this.carrier.children.slice();
    this.wheels = [];
    this.axles = [];
    for (const side of [-1, 1]) {
      const axle = this.subgroup(this.group, [0, 0, 0], 'halfShaft');
      this.shafts.push(this.cylinder(0.095, 2.98, side < 0 ? this.leftMaterial : this.rightMaterial, axle, [0, 0, side * 1.70], 'z', 'halfShaft'));
      const holder = this.subgroup(axle, [0, 0, 0], 'differential');
      holder.quaternion.setFromUnitVectors(vec(0,1,0),vec(0,0,side));
      const sideGear = this.mesh(bevelGearGeometry(16, 12, 0.07, 0.20, 0.105), side < 0 ? this.leftMaterial : this.rightMaterial, holder);
      this.sideGears.push(sideGear);
      this.sideHolders.push(holder);
      const washer = this.annulus(0.42, 0.11, 0.025, 'brass', holder, [0, 0.57, 0], 'differential');
      washer.rotation.z = Math.PI / 2;
      const bearing = this.annulus(0.22, 0.105, 0.12, 'dark', this.group, [0, 0, side * 0.9], 'bearing');
      bearing.rotation.y = Math.PI / 2;
      this.bearings.push(bearing);
      for (const z of [0.95, 2.65]) {
        const joint = this.subgroup(axle, [0, 0, side * z], 'halfShaft');
        this.cylinder(0.23, 0.35, 'dark', joint, [0, 0, 0], 'z', 'halfShaft');
        for (let n = 0; n < 4; n++) this.ring(0.225, 0.022, 'black', joint, [0, 0, side * (-0.12 + n * 0.08)], 'z', 'halfShaft');
        if (z === 0.95) this.innerJoints.push(joint);
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
    this.finalDriveAnchor = this.anchor('Przekładnia główna · 3,9:1', this.group, [-1.4, 1.6, 0], 'finalDrive', ['drive-detail', 'differential']);
    this.carrierAnchor = this.anchor('Kosz i satelity', this.group, [0, 1.25, 0.7], 'differential', ['drive-detail', 'differential']);
    this.anchor('Półosie i przeguby', this.group, [0, 0.5, 1.85], 'halfShaft', ['drive-detail', 'differential']);
    this.anchor('Piasta i hamulec', this.group, [0, 1.5, 3], 'wheelHub', ['drive-detail', 'differential']);
  }

  // The bench magnifies the gears for teaching. In a car only the central
  // mechanism shrinks; the halfshafts must still reach the wheel hubs.
  setCoreScale(scale = 1) {
    this.coreScale = scale;
    this.carrier.scale.setScalar(scale);
    this.input.scale.setScalar(scale);
    this.input.position.z = -1.02 * scale;
    this.housing.scale.set(scale, scale, 0.55 * scale);
    this.sideHolders.forEach(holder => holder.scale.setScalar(scale));
    this.bearings.forEach((bearing, index) => {
      bearing.scale.setScalar(scale);
      bearing.position.z = (index ? 1 : -1) * 0.9 * scale;
    });
    this.innerJoints.forEach((joint, index) => {
      joint.scale.setScalar(scale);
      joint.position.z = (index ? 1 : -1) * 0.95 * scale;
    });
    this.shafts.forEach((shaft, index) => {
      const inside = 0.21 * scale, outside = 3.19;
      shaft.position.z = (index ? 1 : -1) * (inside + outside) / 2;
      // Cylinder height is local Y, rotated onto the halfshaft's Z axis.
      shaft.scale.set(scale, (outside - inside) / 2.98, scale);
    });
    this.finalDriveAnchor.position.set(-1.4 * scale, 1.6 * scale, 0);
    this.carrierAnchor.position.set(0, 1.25 * scale, 0.7 * scale);
  }

  inputEndpoint() {
    this.group.updateWorldMatrix(true, true);
    return this.input.localToWorld(vec(-3.75, 0, 0));
  }

  coreBounds() {
    this.group.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    for (const part of [...this.coreParts, ...this.sideHolders]) {
      if (part.visible) bounds.union(new THREE.Box3().setFromObject(part));
    }
    return bounds.expandByScalar(0.08 * this.coreScale);
  }

  bounds() {
    this.group.updateMatrixWorld(true);
    return new THREE.Box3(vec(-4.2, -1.45, -3.4), vec(1.6, 1.85, 3.4)).applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway, dt = 0, axleIndex) {
    if (!this.group.visible) return;
    const locked = axleIndex === 0 ? sim.frontLock : sim.rearLock;
    const turn = locked ? 0 : sim.turn;
    if (this.demo && !sim.paused) {
      this.demoAngle += dt * 1.4;
      this.demoOffset += dt * 1.4 * turn * 0.5;
    }
    const angle = this.demo ? this.demoAngle : axleIndex === undefined ? sim.outputAngle / 3.9 : sim.axleAngles[axleIndex];
    const offset = this.demo ? this.demoOffset : axleIndex === undefined ? sim.differentialAngle : (sim.wheelAngles[axleIndex * 2 + 1] - sim.wheelAngles[axleIndex * 2]) / 2;
    this.carrierSpeed = this.demo ? 1.4 * 30 / Math.PI : axleIndex === undefined ? sim.speed / 0.31 * 30 / Math.PI : sim.traction.carrierOmega[axleIndex] * 30 / Math.PI;
    this.leftSpeed = this.demo || axleIndex === undefined ? this.carrierSpeed * (1 - turn * 0.5) : sim.traction.wheels[axleIndex * 2].rpm;
    this.rightSpeed = this.demo || axleIndex === undefined ? this.carrierSpeed * (1 + turn * 0.5) : sim.traction.wheels[axleIndex * 2 + 1].rpm;
    this.input.rotation.x = -angle * 3.9;
    this.carrier.rotation.z = -angle;
    this.axles[0].rotation.z = -(angle - offset);
    this.axles[1].rotation.z = -(angle + offset);
    this.planets.forEach(({planet,holder,side}) => { planet.rotation.y = Math.PI / 12 + side * offset * 16 / 12; holder.position.y = side * (this.exploded || 0) * 0.5; });
    this.sideHolders.forEach((holder, i) => { holder.position.z = (i ? 1 : -1) * (this.exploded || 0) * 0.7 * this.coreScale; });
    this.housing.visible = !cutaway && !this.openCarrier;
    this.carrierFrame.forEach((part, i) => { part.visible = !this.openCarrier || i === 1 || i > 2 && part.position.y < -0.3; });
  }
}
