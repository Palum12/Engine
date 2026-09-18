import * as THREE from 'three';
import { GEAR_RATIOS } from '../simulation.js';
import { ModelGeometry, vec } from './geometry.js';

const TEETH = [[20, 70], [30, 63], [40, 56], [60, 63], [50, 41]];

export class DrivetrainModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.exploded = 0.65;
    this.mode = 'drive';
    this.clutch = this.subgroup(this.group, [0, 0, 0], 'clutch');
    this.gearbox = this.subgroup(this.group, [3.8, 0, 0], 'gearbox');
    this.buildClutch();
    this.buildGearbox();
    this.flow = this.particles(32, 0xffc35a, 0.075, this.group);
  }

  buildClutch() {
    this.flywheel = this.gear(84, 1.12, 0.23, 'dark', this.clutch, [0, 0, 0], 'flywheel');
    this.annulus(1.02, 0.38, 0.025, 'steel', this.flywheel, [0.14, 0, 0], 'flywheel');
    const friction = this.material({ color: 0x69534a, roughness: 0.9, metalness: 0.05 });
    this.disc = this.subgroup(this.clutch, [0.29, 0, 0], 'friction');
    this.annulus(1.02, 0.69, 0.095, friction, this.disc, [0, 0, 0], 'friction');
    this.annulus(0.77, 0.24, 0.055, 'steel', this.disc, [0, 0, 0], 'discHub');
    this.gear(20, 0.29, 0.23, 'brass', this.disc, [0, 0, 0], 'discHub');
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      this.cylinder(0.021, 0.11, 'brass', this.disc, [0, Math.cos(a) * 0.83, Math.sin(a) * 0.83], 'x', 'friction', 8);
      const groove = this.box(0.1, 0.27, 0.015, 'black', this.disc, [0, Math.cos(a) * 0.86, Math.sin(a) * 0.86], 'friction');
      groove.rotation.x = a;
    }
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      const spring = this.subgroup(this.disc, [0.08, Math.cos(a) * 0.48, Math.sin(a) * 0.48], 'torsionSprings');
      spring.quaternion.setFromUnitVectors(vec(0, 1, 0), vec(0, -Math.sin(a), Math.cos(a)));
      const points = Array.from({ length: 81 }, (_, n) => vec(Math.sin(n / 80 * Math.PI * 16) * 0.067, (n / 80 - 0.5) * 0.34, Math.cos(n / 80 * Math.PI * 16) * 0.067));
      this.pipe(this.curve(points), 0.016, 'intake', spring, 'torsionSprings');
    }
    this.pressure = this.subgroup(this.clutch, [0.48, 0, 0], 'pressurePlate');
    this.annulus(1.05, 0.45, 0.12, 'steel', this.pressure, [0, 0, 0], 'pressurePlate');
    this.cover = this.subgroup(this.clutch, [0.68, 0, 0], 'pressurePlate');
    this.annulus(1.13, 0.99, 0.22, 'intake', this.cover);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const rib = this.box(0.32, 0.34, 0.12, 'intake', this.cover, [0, Math.cos(a) * 0.86, Math.sin(a) * 0.86]);
      rib.rotation.x = a;
      this.cylinder(0.052, 0.34, 'steel', this.cover, [0, Math.cos(a) * 1.05, Math.sin(a) * 1.05], 'x', 'pressurePlate', 6);
    }
    this.diaphragm = this.subgroup(this.clutch, [0.85, 0, 0], 'diaphragm');
    this.annulus(0.91, 0.73, 0.035, 'brass', this.diaphragm);
    this.fingers = [];
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const finger = this.cylinder(0.025, 1, 'brass', this.diaphragm, [0, 0, 0], 'y', 'diaphragm', 6);
      this.fingers.push({ finger, a });
    }
    this.bearing = this.subgroup(this.clutch, [1.13, 0, 0], 'releaseBearing');
    this.annulus(0.33, 0.17, 0.17, 'steel', this.bearing);
    this.annulus(0.3, 0.2, 0.19, 'dark', this.bearing);
    this.fork = this.subgroup(this.clutch, [1.13, 0, 0], 'releaseBearing');
    this.pipe(this.curve([[0, -0.3, 0.16], [0, -0.45, 0.42], [0, 0, 0.7], [0, 0.45, 0.42], [0, 0.3, 0.16]]), 0.055, 'intake', this.fork, 'releaseBearing');
    this.box(0.13, 0.95, 0.16, 'intake', this.fork, [0, 0.45, 0.7], 'releaseBearing');
    this.stub = this.cylinder(0.145, 3.2, 'brass', this.clutch, [1.65, 0, 0], 'x', 'inputShaft');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      this.box(0.4, 0.027, 0.027, 'steel', this.stub, [Math.cos(a) * 0.147, 0, Math.sin(a) * 0.147]);
    }
    this.anchor('1 · Koło zamachowe', this.clutch, [0, 1.45, 0], 'flywheel', ['clutch']);
    this.anchor('2 · Tarcza cierna', this.clutch, [0, -1.42, 0], 'friction', ['clutch']).userData.followX = this.disc;
    this.anchor('Sprężyny tłumiące', this.clutch, [0, 0.48, 1.25], 'torsionSprings', ['clutch']).userData.followX = this.disc;
    this.anchor('3 · Docisk', this.clutch, [0, 1.45, 0], 'pressurePlate', ['clutch']).userData.followX = this.pressure;
    this.anchor('4 · Sprężyna talerzowa', this.clutch, [0, -1.42, 0], 'diaphragm', ['clutch']).userData.followX = this.diaphragm;
    this.anchor('5 · Łożysko i widełki', this.clutch, [0, 1.4, 0.5], 'releaseBearing', ['clutch']).userData.followX = this.bearing;
    this.anchor('Sprzęgło', this.clutch, [0.7, 1.7, 0], 'clutch', ['drive']);
  }

  buildGearbox() {
    this.topShaft = this.cylinder(0.12, 7.2, 'intake', this.gearbox, [3.1, 0, 0], 'x', 'inputShaft');
    this.bottomShaft = this.cylinder(0.14, 8.8, 'brass', this.gearbox, [3.9, -1.8, 0], 'x', 'outputShaft');
    this.gears = [];
    this.case = this.subgroup(this.gearbox, [0, 0, 0], 'gearbox');
    this.caseFront = this.box(7.0, 3.8, 0.1, this.material({ color: 0x728d9a, transparent: true, opacity: 0.33, metalness: 0.6, roughness: 0.4, depthWrite: false }), this.case, [3.15, -1.05, 1.45]);
    this.box(7.0, 0.12, 0.16, 'dark', this.case, [3.15, 0.8, -1.4]);
    this.box(7.0, 0.12, 0.16, 'dark', this.case, [3.15, -2.8, -1.4]);
    [-0.25, 6.5].forEach(x => {
      [0, -1.8].forEach(y => {
        this.annulus(0.3, 0.16, 0.19, 'block', this.case, [x, y, 0], 'bearing');
        this.box(0.13, 0.11, 2.7, 'dark', this.case, [x, y, 0]);
      });
      this.box(0.13, 3.65, 0.13, 'dark', this.case, [x, -1, -1.4]);
    });
    for (let i = 0; i < 5; i++) {
      const ratio = GEAR_RATIOS[i + 1];
      const x = 0.35 + i * 1.35;
      const topRadius = 1.8 / (1 + ratio);
      const bottomRadius = 1.8 - topRadius;
      const top = this.gear(TEETH[i][0], topRadius, 0.28, 'intake', this.gearbox, [x, 0, 0], 'gearPair');
      const bottom = this.gear(TEETH[i][1], bottomRadius, 0.28, 'steel', this.gearbox, [x, -1.8, 0], 'gearPair');
      top.userData.gear = bottom.userData.gear = i + 1;
      const dog = this.gear(24, 0.3, 0.11, 'dark', this.gearbox, [x + 0.24, -1.8, 0], 'synchronizer');
      const sleeve = this.gear(24, 0.34, 0.17, 'brass', this.gearbox, [x + 0.6, -1.8, 0], 'synchronizer');
      const shiftFork = this.subgroup(this.gearbox, [x + 0.6, -1.8, 0], 'shiftFork');
      this.pipe(this.curve([[0, -0.18, 0.3], [0, 0.16, 0.38], [0, 0.38, 0], [0, 0.16, -0.38], [0, -0.18, -0.3]]), 0.04, 'exhaust', shiftFork, 'shiftFork');
      this.box(0.08, 1.0, 0.08, 'exhaust', shiftFork, [0, 0.8, 0], 'shiftFork');
      const rail = this.cylinder(0.04, 0.95, 'steel', this.gearbox, [x + 0.45, -0.5, 0], 'x', 'shiftFork');
      this.gears.push({ top, bottom, sleeve, dog, shiftFork, rail, x, ratio, topRadius, bottomRadius });
      this.anchor(`${i + 1} · ${ratio.toFixed(2).replace('.', ',')}:1`, this.gearbox, [x, 1.12, 0], 'gearPair', ['gearbox']);
    }
    this.wheel = this.subgroup(this.group, [12.4, -1.8, 0], 'wheel');
    this.ring(0.82, 0.2, 'black', this.wheel, [0, 0, 0]);
    this.annulus(0.68, 0.53, 0.22, 'steel', this.wheel);
    this.cylinder(0.16, 0.35, 'brass', this.wheel, [0, 0, 0], 'x');
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const spoke = this.box(0.18, 0.54, 0.08, 'steel', this.wheel, [0, Math.cos(a) * 0.3, Math.sin(a) * 0.3]);
      spoke.rotation.x = a;
    }
    this.anchor('Wał wejściowy · od sprzęgła', this.gearbox, [-0.2, 0.36, 0.75], 'inputShaft', ['gearbox']);
    this.anchor('Wał wyjściowy · do kół', this.gearbox, [6.2, -2.35, 0.8], 'outputShaft', ['gearbox']);
    this.anchor('Przesuwka i widełki', this.gears[0].shiftFork, [0.4, 0.6, 0.9], 'synchronizer', ['gearbox']);
    this.anchor('Skrzynia biegów', this.gearbox, [3, 1.5, 0], 'gearbox', ['drive']);
    this.anchor('Koło · za przekładnią 3,9:1', this.group, [12.4, -0.4, 0], 'wheel', ['drive']);
  }

  setView(mode) {
    this.mode = mode;
    this.group.visible = ['engine', 'drive', 'clutch', 'gearbox'].includes(mode);
    this.clutch.visible = mode !== 'gearbox';
    this.gearbox.visible = ['drive', 'gearbox'].includes(mode);
    this.wheel.visible = mode === 'drive';
    this.clutch.children.forEach(child => { child.visible = mode !== 'engine' || child === this.flywheel; });
  }

  bounds(mode) {
    this.group.updateMatrixWorld(true);
    const local = mode === 'clutch'
      ? new THREE.Box3(vec(-0.3, -1.45, -1.3), vec(5.0, 1.55, 1.3))
      : mode === 'gearbox'
        ? new THREE.Box3(vec(3.1, -3.4, -1.5), vec(11, 1.4, 1.5))
        : new THREE.Box3(vec(-0.3, -3.4, -1.5), vec(13.4, 1.6, 1.5));
    return local.applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway) {
    const a = sim.angle * Math.PI / 180;
    const e = this.mode === 'clutch' ? this.exploded : 0;
    this.flywheel.rotation.x = a;
    this.disc.position.x = 0.29 + e * 0.85;
    this.disc.rotation.x = sim.inputAngle;
    this.pressure.position.x = 0.48 + e * 1.7 + sim.clutch * 0.16;
    this.pressure.rotation.x = a;
    this.cover.position.x = 0.68 + e * 2.0;
    this.cover.rotation.x = a;
    this.diaphragm.position.x = 0.85 + e * 2.5;
    this.diaphragm.rotation.x = a;
    this.bearing.position.x = 1.13 + e * 3.25 - sim.clutch * 0.15;
    this.fork.position.x = this.bearing.position.x;
    this.fingers.forEach(({ finger, a }) => {
      this.between(finger, vec(0, Math.cos(a) * 0.78, Math.sin(a) * 0.78), vec(0.16 - sim.clutch * 0.23, Math.cos(a) * 0.22, Math.sin(a) * 0.22));
    });
    this.cover.visible = this.mode !== 'engine' && (!cutaway || this.mode === 'clutch');
    this.stub.scale.y = (3.2 + e * 3.25) / 3.2;
    this.stub.position.x = (3.2 + e * 3.25) / 2 + 0.1;
    this.caseFront.visible = !cutaway;
    this.gears.forEach((gear, i) => {
      const active = sim.gear === i + 1;
      gear.top.rotation.x = sim.inputAngle;
      gear.bottom.rotation.x = -sim.inputAngle / gear.ratio + Math.PI / TEETH[i][1];
      gear.bottom.userData.face.material = active ? this.materials.brass : this.materials.steel;
      gear.top.userData.face.material = active ? this.materials.fuel : this.materials.intake;
      gear.sleeve.rotation.x = -sim.outputAngle;
      gear.dog.rotation.x = -sim.inputAngle / gear.ratio;
      gear.sleeve.position.x = gear.x + (active ? 0.33 : 0.68);
      gear.shiftFork.position.x = gear.sleeve.position.x;
      gear.sleeve.userData.face.material = active ? this.materials.fuel : this.materials.dark;
    });
    this.wheel.rotation.x = -sim.outputAngle / 3.9;
    this.flow.visible = ['drive', 'clutch', 'gearbox'].includes(this.mode) && Math.abs(sim.transmittedTorque) > 0.2 && sim.clutch < 0.98 && (this.mode !== 'gearbox' || sim.gear !== 0);
    if (this.flow.visible) {
      const selected = sim.gear ? this.gears[sim.gear - 1] : null;
      const end = this.mode === 'clutch' ? this.bearing.position.x + 0.5 : selected ? 3.8 + selected.x : 2.8;
      const points = this.mode === 'clutch' || !selected
        ? [[0.1, 0, 1.26], [end, 0, 1.26]]
        : [[this.mode === 'gearbox' ? 3.3 : 0.1, 0, 1.26], [end, 0, 1.26], [end, -1.8, 1.26], [this.mode === 'gearbox' ? 11.8 : 12, -1.8, 1.26]];
      const lengths = points.slice(1).map((p, i) => vec(...p).distanceTo(vec(...points[i])));
      const total = lengths.reduce((a, b) => a + b, 0);
      for (let n = 0; n < this.flow.count; n++) {
        let distance = ((sim.inputAngle / 3 + n / this.flow.count) % 1) * total;
        let segment = 0;
        while (segment < lengths.length - 1 && distance > lengths[segment]) { distance -= lengths[segment]; segment++; }
        this.particle(this.flow, n, vec(...points[segment]).lerp(vec(...points[segment + 1]), distance / lengths[segment]));
      }
      this.flow.instanceMatrix.needsUpdate = true;
    }
    this.anchors.forEach(({ anchor }) => { if (anchor.userData.followX) anchor.position.x = anchor.userData.followX.position.x; });
    this.group.updateMatrixWorld(true);
  }
}
