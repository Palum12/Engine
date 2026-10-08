import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';
import { bevelGearGeometry, internalGearGeometry } from './mechanical-geometry.js';

export class TransferModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'transfer';
    this.open = this.subgroup(this.group, [0, 0, 0], 'centerDifferential');
    this.carrier = this.subgroup(this.open, [0, 0, 0], 'centerDifferential');
    this.openSides = [];
    this.openPlanets = [];
    for (const side of [-1, 1]) {
      const output = this.subgroup(this.open, [0, 0, 0], 'centerDifferential');
      const gear = this.subgroup(output, [0, 0, 0], 'centerDifferential');
      gear.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(side, 0, 0));
      this.mesh(bevelGearGeometry(16, 12, 0.065, 0.18, 0.11), side < 0 ? 'intake' : 'exhaust', gear);
      this.cylinder(0.105, 1.1, side < 0 ? 'intake' : 'exhaust', output, [side * 1.07, 0, 0], 'x', 'centerDifferential');
      this.openSides.push(output);
    }
    this.cylinder(0.05, 1.38, 'steel', this.carrier, [0, 0, 0], 'y', 'centerDifferential');
    for (const side of [-1, 1]) {
      const holder = this.subgroup(this.carrier, [0, 0, 0], 'centerDifferential');
      holder.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(0, side, 0));
      const planet = this.subgroup(holder);
      this.mesh(bevelGearGeometry(12, 16, 0.065, 0.18, 0.055), 'steel', planet);
      this.openPlanets.push({ planet, side });
    }
    for (const x of [-0.62, 0.62]) this.annulus(0.78, 0.65, 0.085, 'steel', this.carrier, [x, 0, 0], 'centerDifferential');
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2;
      this.box(1.24, 0.11, 0.11, 'dark', this.carrier, [0, Math.cos(a) * 0.72, Math.sin(a) * 0.72]);
    }
    this.lockSleeve = this.annulus(0.29, 0.115, 0.22, 'fuel', this.open, [-0.85, 0, 0], 'centerLock');
    this.quattro = this.subgroup(this.group, [0, 0, 0], 'quattro');
    this.quattroCarrier = this.subgroup(this.quattro, [0, 0, 0], 'quattro');
    this.sun = this.gear(24, 0.72, 0.23, 'intake', this.quattro, [0, 0, 0], 'quattro', 0.11);
    this.ringGear = this.mesh(internalGearGeometry(36, 1.08, 0.23, 1.23), 'exhaust', this.quattro, [0, 0, 0], 'quattro');
    this.twist(this.sun.userData.face, 0.08);
    this.twist(this.ringGear, -0.053);
    this.quattroPlanets = [];
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2;
      const y = Math.cos(a) * 0.9;
      const z = Math.sin(a) * 0.9;
      this.cylinder(0.026, 0.62, 'brass', this.quattroCarrier, [0, y, z], 'x', 'quattro');
      const gear = this.gear(6, 0.18, 0.23, 'steel', this.quattroCarrier, [0, y, z], 'quattro', 0.03);
      this.twist(gear.userData.face, -0.32);
      this.quattroPlanets.push({ gear, phase: a });
    }
    for (const x of [-0.3, 0.3]) this.annulus(1, 0.29, 0.05, 'dark', this.quattroCarrier, [x, 0, 0], 'quattro');
    this.cylinder(0.1, 1.1, 'intake', this.quattro, [-0.92, 0, 0], 'x', 'quattro');
    this.annulus(0.23, 0.14, 1.15, 'exhaust', this.quattro, [0.92, 0, 0], 'quattro');
    this.lockPacks = [];
    for (const side of [-1, 1]) {
      const pack = this.subgroup(this.quattro, [side * 0.85, 0, 0], 'quattro');
      for (let n = 0; n < 7; n++) this.annulus(0.6, 0.25, 0.025, n % 2 ? 'steel' : 'brass', pack, [(n - 3) * 0.035, 0, 0], 'quattro');
      this.lockPacks.push(pack);
    }
    // An offset pinion drives the carrier independently of either axle output.
    // Equal gears preserve the simulated 1:1 transfer ratio. This shared
    // educational pair is not an OEM transfer-case layout.
    for (const [carrier, sleeveLength, sleeveX] of [[this.carrier, 0.65, 0.92], [this.quattroCarrier, 0.95, 0.77]]) {
      // Extend the cage past the quattro lock pack without touching its discs.
      this.annulus(0.72, 0.65, sleeveLength, 'steel', carrier, [sleeveX, 0, 0], 'centerDifferential');
      this.gear(24, 0.8, 0.12, 'brass', carrier, [1.22, 0, 0], 'centerDifferential', 0.29);
    }
    this.inputDrive = this.subgroup(this.group, [0, 0, 1.6], 'transfer');
    this.inputPinion = this.gear(24, 0.8, 0.12, 'steel', this.inputDrive, [1.22, 0, 0], 'transfer', 0.11);
    this.inputPinion.rotation.x = Math.PI / 24;
    this.inputShaft = this.cylinder(0.105, 3.24, 'steel', this.inputDrive, [0, 0, 0], 'x', 'propShaft');
    this.partTime = this.subgroup(this.group, [0, 0, 0], 'transfer');
    this.mainShaft = this.cylinder(0.11, 3.1, 'brass', this.partTime, [0, 0, 0], 'x', 'transfer');
    this.frontShaft = this.cylinder(0.11, 2.8, 'intake', this.partTime, [-0.1, 0, -1.45], 'x', 'transfer');
    this.sprockets = [[0.3, 0, 0], [0.3, 0, -1.45]].map(p => this.gear(18, 0.35, 0.14, 'steel', this.partTime, p, 'transfer'));
    const chain = this.curve([[0.3, 0.35, 0], [0.3, 0.35, -1.45], [0.3, 0.25, -1.7], [0.3, 0, -1.8], [0.3, -0.35, -1.45], [0.3, -0.35, 0], [0.3, 0, 0.35], [0.3, 0.35, 0]]);
    this.chainCurve = chain;
    this.chain = this.instance(this.geometry('chain-link', () => new THREE.BoxGeometry(0.075, 0.05, 0.12)), this.materials.dark, 70);
    this.partTime.add(this.chain);
    this.coupler = this.annulus(0.25, 0.115, 0.23, 'fuel', this.partTime, [0.58, 0, -1.45], 'transfer');
    this.lowSun = this.gear(24, 0.48, 0.22, 'brass', this.partTime, [-0.7, 0, 0], 'transfer');
    this.lowRing = this.mesh(internalGearGeometry(36, 0.72, 0.23, 0.85), 'dark', this.partTime, [-0.7, 0, 0], 'transfer');
    this.lowCarrier = this.subgroup(this.partTime, [-0.7, 0, 0], 'transfer');
    this.lowPlanets = [];
    for (let n = 0; n < 4; n++) {
      const a = n * Math.PI / 2;
      const planet = this.gear(6, 0.12, 0.22, 'steel', this.lowCarrier, [0, Math.cos(a) * 0.6, Math.sin(a) * 0.6], 'transfer', 0.025);
      this.lowPlanets.push(planet);
    }
    this.annulus(0.67, 0.14, 0.05, 'steel', this.lowCarrier, [0.24, 0, 0], 'transfer');
    this.lowSelector = this.annulus(0.26, 0.12, 0.2, 'fuel', this.partTime, [-1.1, 0, 0], 'transfer');
    this.cover = this.box(3.5, 2.8, 5, this.material({ color: 0x6d8998, transparent: true, opacity: 0.22, depthWrite: false }), this.group, [0, 0, 0.05], 'transfer');
    this.anchor('Centralny mechanizm · przód / tył', this.open, [0, 1.25, 0], 'centerDifferential', ['transfer', 'drive', 'drive-detail']);
    this.anchor('quattro · 40% przód / 60% tył', this.quattro, [0, 1.65, 0], 'quattro', ['transfer', 'drive', 'drive-detail']);
    this.anchor('Zęby skośne → docisk pakietów', this.quattro, [0.8, -1, 0.8], 'quattro', ['transfer']);
    this.anchor('Reduktor · 1:1 / 2,5:1', this.partTime, [-0.8, 1.25, 0], 'transfer', ['transfer']);
    this.anchor('Sprzęgło kłowe · dołączanie przodu', this.partTime, [0.3, 0.7, -1.5], 'transfer', ['transfer']);
  }

  twist(mesh, angle) {
    const geometry = mesh.geometry.clone();
    const p = geometry.attributes.position;
    for (let n = 0; n < p.count; n++) {
      const t = p.getX(n) / 0.23 * angle;
      const y = p.getY(n), z = p.getZ(n);
      p.setXYZ(n, p.getX(n), y * Math.cos(t) - z * Math.sin(t), y * Math.sin(t) + z * Math.cos(t));
    }
    geometry.computeVertexNormals();
    this.geometries.add(geometry);
    mesh.geometry = geometry;
  }

  configure(layout) {
    this.open.visible = layout === 'awd';
    this.quattro.visible = layout === 'quattro';
    this.partTime.visible = layout === 'partTime';
    this.inputDrive.visible = ['awd', 'quattro'].includes(layout);
  }

  inputEndpoint(side) {
    this.group.updateWorldMatrix(true, true);
    const shaft = this.inputDrive.visible ? this.inputShaft : this.mainShaft;
    return shaft.localToWorld(vec(0, -side * shaft.geometry.parameters.height / 2, 0));
  }

  bounds() { this.group.updateMatrixWorld(true); return new THREE.Box3(vec(-1.9, -1.5, -2.5), vec(1.9, 1.8, 2.6)).applyMatrix4(this.group.matrixWorld); }

  update(sim, cutaway) {
    if (!this.group.visible) return;
    this.configure(sim.driveLayout);
    const front = sim.axleAngles[0] * 3.9;
    const rear = sim.axleAngles[1] * 3.9;
    const mean = (front + rear) / 2;
    this.carrier.rotation.x = mean;
    this.openSides[0].rotation.x = front;
    this.openSides[1].rotation.x = rear;
    this.openPlanets.forEach(({ planet, side }) => { planet.rotation.y = Math.PI / 12 + side * (rear - front) / 2 * 16 / 12; });
    this.lockSleeve.position.x = sim.centerLock ? -0.65 : -0.95;
    this.lockSleeve.rotation.x = front;
    const carrier = front * 0.4 + rear * 0.6;
    this.inputShaft.rotation.x = -(sim.driveLayout === 'quattro' ? carrier : mean);
    this.inputPinion.rotation.x = this.inputShaft.rotation.x + Math.PI / 24;
    this.quattroCarrier.rotation.x = carrier;
    this.sun.rotation.x = front;
    this.ringGear.rotation.x = rear;
    this.quattroPlanets.forEach(({ gear, phase }) => { gear.rotation.x = -(front - carrier) * 4 + phase; });
    this.lockPacks.forEach((pack, i) => { pack.rotation.x = i ? rear : front; });
    this.mainShaft.rotation.x = sim.outputAngle / sim.transferRatio;
    this.frontShaft.rotation.x = sim.driveMode === '2H' ? front : this.mainShaft.rotation.x;
    const chainAngle = this.frontShaft.rotation.x;
    this.sprockets.forEach(sprocket => { sprocket.rotation.x = chainAngle; });
    this.coupler.position.x = sim.driveMode === '2H' ? 0.78 : 0.5;
    this.lowSun.rotation.x = sim.outputAngle;
    this.lowRing.rotation.x = sim.driveMode === '4L' ? 0 : sim.outputAngle;
    this.lowCarrier.rotation.x = sim.outputAngle / sim.transferRatio;
    this.lowPlanets.forEach(gear => { gear.rotation.x = -(this.lowSun.rotation.x - this.lowCarrier.rotation.x) * 4; });
    this.lowSelector.position.x = sim.driveMode === '4L' ? -0.93 : -1.25;
    this.cover.visible = !cutaway;
    for (let n = 0; n < this.chain.count; n++) {
      const t = ((n / this.chain.count + chainAngle * 0.04) % 1 + 1) % 1;
      this.matrix.compose(this.chainCurve.getPointAt(t), new THREE.Quaternion().setFromUnitVectors(vec(0, 0, 1), this.chainCurve.getTangentAt(t)), vec(1, 1, 1));
      this.chain.setMatrixAt(n, this.matrix);
    }
    this.chain.instanceMatrix.needsUpdate = true;
  }
}
