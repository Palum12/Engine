import * as THREE from 'three';
import { GEAR_RATIOS } from '../simulation.js';
import { getEngine } from '../engines.js';
import { manualClutchState } from '../manual-clutch.js';
import { ModelGeometry, vec } from './geometry.js';

const TEETH = [[20, 70], [30, 63], [40, 56], [60, 63], [50, 41]];
const DOG_TOOTH_PITCH = Math.PI * 2 / 36;
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

export class DrivetrainModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.exploded = 0;
    this.mode = 'drive';
    this.section = 'all';
    this.isolate = false;
    this.clutch = this.subgroup(this.group, [0, 0, 0], 'clutch');
    this.gearbox = this.subgroup(this.group, [3.8, 0, 0], 'gearbox');
    this.buildClutch();
    this.buildGearbox();
    this.showFlow = true;
    this.flow = this.arrows(8, 0xffc35a, this.group, 0.14);
  }

  buildClutch() {
    this.flywheel = this.gear(84, 1.12, 0.23, 'dark', this.clutch, [0, 0, 0], 'flywheel');
    this.annulus(1.02, 0.38, 0.025, 'steel', this.flywheel, [0.14, 0, 0], 'flywheel');
    const friction = this.material({ color: 0x69534a, roughness: 0.9, metalness: 0.05, emissive: 0xe7561c, emissiveIntensity: 0 });
    this.frictionMaterial = friction;
    this.disc = this.subgroup(this.clutch, [0.29, 0, 0], 'friction');
    this.annulus(1.02, 0.69, 0.095, friction, this.disc, [0, 0, 0], 'friction');
    this.annulus(0.77, 0.24, 0.055, 'steel', this.disc, [0, 0, 0], 'discHub');
    this.gear(20, 0.29, 0.23, 'brass', this.disc, [0, 0, 0], 'discHub', 0.173);
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
    this.pressureStraps = this.subgroup(this.clutch, [0, 0, 0], 'pressurePlate');
    this.straps = [];
    for (let n = 0; n < 6; n++) {
      const angle = n * Math.PI / 3;
      const segments = Array.from({ length: 3 }, () => this.box(0.022, 1, 0.075, 'exhaust', this.pressureStraps, [0, 0, 0], 'pressurePlate'));
      this.straps.push({ angle, segments });
    }
    this.diaphragm = this.subgroup(this.clutch, [0.57, 0, 0], 'diaphragm');
    this.ring(0.78, 0.035, 'brass', this.diaphragm, [0, 0, 0], 'x', 'diaphragm');
    this.fingers = [];
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const finger = this.box(0.035, 1, 0.075, 'brass', this.diaphragm, [0, 0, 0], 'diaphragm');
      const outer = this.box(0.022, 1, 0.1, 'brass', this.diaphragm, [0, 0, 0], 'diaphragm');
      this.fingers.push({ finger, outer, a });
    }
    this.bearing = this.subgroup(this.clutch, [1.13, 0, 0], 'releaseBearing');
    this.annulus(0.33, 0.17, 0.17, 'steel', this.bearing);
    this.annulus(0.3, 0.2, 0.19, 'dark', this.bearing);
    this.fork = this.subgroup(this.clutch, [1.13, 0, 0], 'releaseBearing');
    this.pipe(this.curve([[0, -0.3, 0.16], [0, -0.45, 0.42], [0, 0, 0.7], [0, 0.45, 0.42], [0, 0.3, 0.16]]), 0.055, 'intake', this.fork, 'releaseBearing');
    this.box(0.13, 0.95, 0.16, 'intake', this.fork, [0, 0.45, 0.7], 'releaseBearing');
    this.stub = this.cylinder(0.145, 3.2, 'brass', this.clutch, [1.65, 0, 0], 'x', 'inputShaft');
    this.inputSplines = this.subgroup(this.clutch, [0, 0, 0], 'discHub');
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const spline = this.box(1.25, 0.027, 0.023, 'steel', this.inputSplines, [0.6, Math.cos(a) * 0.148, Math.sin(a) * 0.148], 'discHub');
      spline.rotation.x = a;
    }
    const contact = this.material({ color: 0x75efad, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }, true);
    this.contacts = [-0.048, 0.048].map(x => this.annulus(1.08, 0.70, 0.008, contact, this.disc, [x, 0, 0], 'friction'));
    this.box(0.02, 0.3, 0.055, 'fuel', this.flywheel, [0.17, 0.77, 0], 'flywheel');
    this.box(0.02, 0.3, 0.055, 'intake', this.disc, [0.06, 0.77, 0], 'discHub');
    this.box(0.035, 0.23, 0.06, 'exhaust', this.pressure, [0.085, 0.91, 0], 'pressurePlate');
    this.anchor('1 · Koło zamachowe', this.clutch, [0, 1.45, 0], 'flywheel', ['clutch', 'drive-detail']);
    this.anchor('2 · Tarcza cierna', this.clutch, [0, -1.42, 0], 'friction', ['clutch']).userData.followX = this.disc;
    this.anchor('Sprężyny tłumiące', this.clutch, [0, 0.48, 1.25], 'torsionSprings', ['clutch']).userData.followX = this.disc;
    this.anchor('3 · Docisk', this.clutch, [0, 1.45, 0], 'pressurePlate', ['clutch']).userData.followX = this.pressure;
    this.anchor('4 · Sprężyna talerzowa', this.clutch, [0, -1.42, 0], 'diaphragm', ['clutch']).userData.followX = this.diaphragm;
    this.anchor('5 · Łożysko i widełki', this.clutch, [0, 1.4, 0.5], 'releaseBearing', ['clutch']).userData.followX = this.bearing;
    this.anchor('Sprzęgło', this.clutch, [0.7, 1.7, 0], 'clutch', ['drive', 'drive-detail']);
  }

  buildGearbox() {
    this.topShaft = this.cylinder(0.12, 7.2, 'intake', this.gearbox, [3.1, 0, 0], 'x', 'inputShaft');
    this.bottomShaft = this.cylinder(0.14, 8.8, 'brass', this.gearbox, [3.9, -1.8, 0], 'x', 'outputShaft');
    this.gears = [];
    this.case = this.subgroup(this.gearbox, [0, 0, 0], 'gearbox');
    this.caseFront = this.box(7.6, 3.8, 0.1, this.material({ color: 0x728d9a, transparent: true, opacity: 0.23, metalness: 0.6, roughness: 0.4, depthWrite: false }), this.case, [3.4, -1.05, 1.85]);
    this.box(7.0, 0.12, 0.16, 'dark', this.case, [3.15, 0.8, -1.4]);
    this.box(7.0, 0.12, 0.16, 'dark', this.case, [3.15, -2.8, -1.4]);
    [-0.25, 7.05].forEach(x => {
      [0, -1.8].forEach(y => {
        this.annulus(0.3, 0.16, 0.19, 'block', this.case, [x, y, 0], 'bearing');
        this.box(0.13, 0.11, 2.7, 'dark', this.case, [x, y, 0]);
      });
      this.box(0.13, 3.65, 0.13, 'dark', this.case, [x, -1, -1.4]);
      this.annulus(0.12, 0.05, 0.18, 'block', this.case, [x, -0.55, 1.55], 'shiftFork');
    });
    for (let i = 0; i < 5; i++) {
      const ratio = GEAR_RATIOS[i + 1];
      const x = 0.35 + i * 1.35;
      const topRadius = 1.8 / (1 + ratio);
      const bottomRadius = 1.8 - topRadius;
      const top = this.gear(TEETH[i][0], topRadius, 0.28, 'intake', this.gearbox, [x, 0, 0], 'gearPair');
      const bottom = this.gear(TEETH[i][1], bottomRadius, 0.28, 'steel', this.gearbox, [x, -1.8, 0], 'gearPair', 0.285);
      top.userData.gear = bottom.userData.gear = i + 1;
      const needleBearing = this.subgroup(bottom, [0, 0, 0], 'needleBearing');
      this.annulus(0.188, 0.145, 0.27, 'dark', needleBearing, [0, 0, 0], 'needleBearing');
      const needleCage = this.subgroup(needleBearing, [0, 0, 0], 'needleBearing');
      for (let n = 0; n < 16; n++) {
        const angle = n * Math.PI / 8;
        this.cylinder(0.037, 0.245, 'brass', needleCage, [0, Math.cos(angle) * 0.228, Math.sin(angle) * 0.228], 'x', 'needleBearing', 8);
      }
      this.annulus(0.28, 0.264, 0.25, 'steel', bottom, [0, 0, 0], 'needleBearing');
      this.annulus(0.315, 0.285, 0.045, 'steel', bottom, [0.16, 0, 0], 'dogTeeth');
      const dog = this.gear(36, 0.357, 0.12, 'steel', this.gearbox, [x + 0.235, -1.8, 0], 'dogTeeth', 0.285);
      // The generic gear's decorative face ring would close this large bore.
      dog.children.filter(child => child.isMesh && child.material === this.materials.dark).forEach(child => child.removeFromParent());
      const gearCone = this.taperedRing(0.38, 0.325, 0.04, 0.16, 'steel', bottom, [0.37, 0, 0], 'synchroCone');
      const hub = this.gear(36, 0.357, 0.46, 'intake', this.gearbox, [x + 0.84, -1.8, 0], 'synchronizerHub', 0.151);
      const sleeve = this.subgroup(this.gearbox, [x + 0.84, -1.8, 0], 'synchronizerSleeve');
      sleeve.userData.face = this.annulus(0.49, 0.395, 0.46, 'brass', sleeve, [0, 0, 0], 'synchronizerSleeve');
      const cutFace = this.partialAnnulus(0.49, 0.395, 0.46, 'brass', sleeve, 'synchronizerSleeve');
      const sleeveTeeth = [];
      for (let n = 0; n < 36; n++) {
        const a = (n - 0.125) * Math.PI / 18;
        const tooth = this.box(0.46, 0.042, 0.022, 'brass', sleeve, [0, Math.cos(a) * 0.376, Math.sin(a) * 0.376], 'synchronizerSleeve');
        tooth.rotation.x = a;
        sleeveTeeth.push({ tooth, angle: a });
      }
      for (const side of [-0.12, 0.12]) this.ring(0.503, 0.017, 'steel', sleeve, [side, 0, 0], 'x', 'synchronizerSleeve');
      const cone = this.subgroup(this.gearbox, [x + 0.49, -1.8, 0], 'synchroCone');
      this.taperedRing(0.42, 0.365, 0.04, 0.16, 'brass', cone, [0, 0, 0], 'synchroCone');
      const keys = [];
      for (let n = 0; n < 3; n++) {
        const angle = n * Math.PI * 2 / 3;
        const key = this.box(0.39, 0.065, 0.06, 'steel', hub, [-0.21, Math.cos(angle) * 0.325, Math.sin(angle) * 0.325], 'synchronizerHub');
        key.rotation.x = angle;
        keys.push(key);
        const lug = this.box(0.11, 0.055, 0.08, 'brass', cone, [0.07, Math.cos(angle) * 0.34, Math.sin(angle) * 0.34], 'synchroCone');
        lug.rotation.x = angle;
      }
      const syncGlow = this.annulus(0.443, 0.425, 0.015, this.material({ color: 0xff754d, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }, true), cone, [-0.04, 0, 0], 'synchroCone');
      const shiftFork = this.subgroup(this.gearbox, [x + 0.84, -1.8, 0], 'shiftFork');
      this.pipe(this.curve([[0, -0.2, 0.47], [0, 0.24, 0.47], [0, 0.52, 0], [0, 0.24, -0.47], [0, -0.2, -0.47]]), 0.038, 'exhaust', shiftFork, 'shiftFork');
      this.pipe(this.curve([[0, 0.49, 0], [0, 0.78, 0.65], [0, 1.25, 1.55]]), 0.042, 'exhaust', shiftFork, 'shiftFork');
      this.annulus(0.095, 0.045, 0.16, 'exhaust', shiftFork, [0, 1.25, 1.55], 'shiftFork');
      const rail = this.cylinder(0.04, 1.35, 'steel', this.gearbox, [x + 0.675, -0.55, 1.55], 'x', 'shiftFork');
      const gearMarker = this.box(0.022, 0.13, 0.045, 'white', bottom, [0.151, bottomRadius * 0.8, 0], 'gearPair');
      const shaftMarker = this.box(0.025, 0.15, 0.04, 'fuel', hub, [0.26, 0.28, 0], 'synchronizerHub');
      this.gears.push({ top, bottom, sleeve, hub, cone, gearCone, syncGlow, dog, shiftFork, rail, needleBearing, needleCage, cutFace, sleeveTeeth, keys, gearMarker, shaftMarker, x, ratio, topRadius, bottomRadius });
      this.anchor(`${i + 1} · ${ratio.toFixed(2).replace('.', ',')}:1`, this.gearbox, [x, 1.12, 0], 'gearPair', ['gearbox', 'drive-detail']).userData.gear = i + 1;
      this.anchor('Przesuwka · przesuwa się, obraca z wałem', sleeve, [0.1,-0.65,0.5], 'synchronizerSleeve', ['gearbox']).userData.gear = i + 1;
      this.anchor('Stożek i pierścień · wyrównanie obrotów', cone, [0,-0.4,0.6], 'synchroCone', ['gearbox']).userData.gear = i + 1;
      this.anchor('Piasta · stale połączona z wałem', hub, [0.1,-0.65,-0.55], 'synchronizerHub', ['gearbox']).userData.gear = i + 1;
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
    this.anchor('Wał wejściowy · od sprzęgła', this.gearbox, [-0.2, 0.36, 0.75], 'inputShaft', ['gearbox', 'drive-detail']);
    this.anchor('Wał wyjściowy · do kół', this.gearbox, [6.2, -2.35, 0.8], 'outputShaft', ['gearbox', 'drive-detail']);
    this.anchor('Przesuwka i widełki', this.gears[0].shiftFork, [0.4, 0.6, 0.9], 'synchronizer', ['gearbox', 'drive-detail']);
    this.anchor('Skrzynia biegów', this.gearbox, [3, 1.5, 0], 'gearbox', ['drive', 'drive-detail']);
    this.anchor('Koło · za przekładnią 3,9:1', this.group, [12.4, -0.4, 0], 'wheel', ['drive', 'drive-detail']);
  }

  taperedRing(front, back, wall, width, material, parent, position, part) {
    const geometry = this.geometry(`cone:${front}:${back}:${wall}:${width}`, () => {
      const points = [[front, -width / 2], [back, width / 2], [back - wall, width / 2], [front - wall, -width / 2], [front, -width / 2]].map(([r, y]) => new THREE.Vector2(r, y));
      const shape = new THREE.LatheGeometry(points, 48);
      shape.rotateZ(-Math.PI / 2);
      return shape;
    });
    return this.mesh(geometry, material, parent, position, part);
  }

  partialAnnulus(outer, inner, width, material, parent, part) {
    const geometry = this.geometry(`cut-ring:${outer}:${inner}:${width}`, () => {
      const start = Math.PI + 0.7, end = Math.PI + Math.PI * 2 - 0.7;
      const shape = new THREE.Shape();
      shape.moveTo(Math.cos(start) * outer, Math.sin(start) * outer);
      shape.absarc(0, 0, outer, start, end, false);
      shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
      shape.absarc(0, 0, inner, end, start, true);
      shape.closePath();
      const result = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 48 });
      result.translate(0, 0, -width / 2);
      result.rotateY(Math.PI / 2);
      return result;
    });
    return this.mesh(geometry, material, parent, [0, 0, 0], part);
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    this.isolate = isolate;
    this.applySection();
  }

  applySection() {
    if (this.mode === 'engine') return;
    const context = {
      flywheel: [this.flywheel],
      friction: [this.disc, this.inputSplines, this.stub],
      discHub: [this.disc, this.inputSplines, this.stub],
      pressurePlate: [this.flywheel, this.disc, this.pressure, this.cover, this.pressureStraps, this.diaphragm],
      diaphragm: [this.diaphragm, this.pressure, this.cover, this.pressureStraps, this.bearing, this.fork],
      releaseBearing: [this.bearing, this.fork, this.diaphragm, this.stub]
    };
    const selected = context[this.section];
    this.clutch.children.forEach(child => {
      if (this.isolate && selected) child.visible = selected.includes(child);
      else if (child !== this.cover) child.visible = true;
    });
    const match = /^gear([1-5])$/.exec(this.section);
    this.gears.forEach((gear, i) => {
      const visible = !match || i + 1 === Number(match[1]);
      for (const part of ['top', 'bottom', 'sleeve', 'hub', 'cone', 'dog', 'shiftFork', 'rail']) gear[part].visible = visible;
      gear.syncGlow.userData.focusVisible = visible;
    });
  }

  setView(mode) {
    this.mode = mode;
    this.group.visible = ['engine', 'drive', 'drive-detail', 'clutch', 'gearbox'].includes(mode);
    this.clutch.visible = mode !== 'gearbox';
    this.gearbox.visible = ['drive', 'drive-detail', 'gearbox'].includes(mode);
    this.wheel.visible = mode === 'drive';
    this.clutch.children.forEach(child => { child.visible = mode !== 'engine' || child === this.flywheel; });
  }

  bounds(mode) {
    this.group.updateMatrixWorld(true);
    const clutchParts = {
      flywheel: [this.flywheel], friction: [this.disc], discHub: [this.disc],
      pressurePlate: [this.pressure, this.cover, this.pressureStraps],
      diaphragm: [this.diaphragm, this.pressure, this.cover, this.pressureStraps, this.bearing, this.fork],
      releaseBearing: [this.bearing, this.fork, this.diaphragm]
    }[mode];
    if (clutchParts) return clutchParts.reduce((box, part) => box.union(new THREE.Box3().setFromObject(part)), new THREE.Box3()).expandByScalar(0.22);
    const match = /^gear([1-5])$/.exec(mode);
    if (match) {
      const gear = this.gears[Number(match[1]) - 1];
      return new THREE.Box3().setFromObject(gear.top).union(new THREE.Box3().setFromObject(gear.bottom)).union(new THREE.Box3().setFromObject(gear.sleeve)).union(new THREE.Box3().setFromObject(gear.hub)).union(new THREE.Box3().setFromObject(gear.shiftFork)).expandByScalar(0.2);
    }
    const local = mode === 'clutch'
      ? new THREE.Box3(vec(-0.3, -1.45, -1.3), vec(1.7 + this.exploded * 3.25, 1.55, 1.3))
      : mode === 'gearbox'
        ? new THREE.Box3(vec(3.1, -3.4, -1.5), vec(12.2, 1.4, 2.0))
        : new THREE.Box3(vec(-0.3, -3.4, -1.5), vec(13.4, 1.6, 2.0));
    if (mode === 'gearbox' && this.mode === 'drive-detail') local.translate(vec(this.exploded * 3.25, 0, 0));
    return local.applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway) {
    if (!this.group.visible) return;
    const a = sim.angle * Math.PI / 180;
    const e = ['clutch', 'drive-detail'].includes(this.mode) ? this.exploded : 0;
    this.gearbox.position.x = this.mode === 'drive-detail' ? 3.8 + e * 3.25 : 3.8;
    this.flywheel.rotation.x = a;
    const state = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
    const relativeOmega = Math.abs(sim.rpm * Math.PI / 30 - sim.inputOmega);
    const displayPower = Math.min(Math.abs(sim.transmittedTorque), state.capacity) * relativeOmega;
    this.clutchState = { ...state, slipPower: displayPower, slipRpm: relativeOmega * 30 / Math.PI };
    this.disc.position.x = 0.2 + e * 0.85 + state.discFloat;
    this.contacts.forEach(contact => {
      contact.visible = state.contact;
      contact.material.opacity = 0.12 + 0.76 * Math.sqrt(state.clampFactor);
      contact.material.color.setHex(displayPower > 80 ? 0xffa24f : 0x75efad);
    });
    this.frictionMaterial.emissiveIntensity = Math.min(0.65, displayPower / 12000);
    this.disc.rotation.x = sim.inputAngle;
    this.pressure.position.x = 0.3075 + e * 1.7 + state.plateGap;
    this.pressure.rotation.x = a;
    this.cover.position.x = 0.68 + e * 2.0;
    this.cover.rotation.x = a;
    this.diaphragm.position.x = 0.57 + e * 2.5;
    this.diaphragm.rotation.x = a;
    const fingerTip = 0.28 - state.fingerTravel;
    this.bearing.position.x = this.diaphragm.position.x + fingerTip + 0.085 + state.bearingClearance + e * 0.75;
    this.fork.position.x = this.bearing.position.x;
    this.fingers.forEach(({ finger, outer, a }) => {
      const pivot = vec(0, Math.cos(a) * 0.78, Math.sin(a) * 0.78);
      this.between(finger, pivot, vec(fingerTip, Math.cos(a) * 0.22, Math.sin(a) * 0.22));
      this.between(outer, pivot, vec(this.pressure.position.x + 0.06 - this.diaphragm.position.x, Math.cos(a) * 0.97, Math.sin(a) * 0.97));
    });
    this.pressureStraps.rotation.x = a;
    this.straps.forEach(({ angle, segments }) => {
      const from = vec(this.pressure.position.x + 0.045, Math.cos(angle) * 1.04, Math.sin(angle) * 1.04);
      const to = vec(this.cover.position.x - 0.05, Math.cos(angle) * 1.04, Math.sin(angle) * 1.04);
      const bend = vec(0, -Math.sin(angle) * state.pedal * 0.12, Math.cos(angle) * state.pedal * 0.12);
      const points = [from, from.clone().lerp(to, 1 / 3).add(bend), from.clone().lerp(to, 2 / 3).add(bend), to];
      segments.forEach((segment, n) => this.between(segment, points[n], points[n + 1]));
    });
    this.cover.visible = this.mode !== 'engine' && (!cutaway || ['clutch', 'drive-detail'].includes(this.mode));
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
      const freeDogAngle = -sim.inputAngle / gear.ratio;
      const p = sim.shiftProgress;
      let engagement = active ? 1 : 0;
      let indexing = active ? 1 : 0;
      if (sim.shiftTarget !== null) {
        if (sim.shiftFrom === i + 1) {
          engagement = Math.max(0, 1 - p / 0.25);
          indexing = 1 - smooth((p - 0.05) / 0.2);
        }
        if (sim.shiftTarget === i + 1 && p >= 0.25) {
          engagement = p < 0.75 ? 0.55 * Math.min(1, (p - 0.25) / 0.15) : 0.55 + (p - 0.75) / 0.25 * 0.45;
          indexing = smooth((p - 0.75) / 0.15);
        }
      }
      // The physics models speed synchronization, not tooth-by-tooth indexing.
      // Show the small final alignment before axial dog/sleeve overlap starts.
      // Free gears retain their own phase; this does not alter any shaft state.
      const indexedAngle = gear.sleeve.rotation.x + Math.round((freeDogAngle - gear.sleeve.rotation.x) / DOG_TOOTH_PITCH) * DOG_TOOTH_PITCH;
      gear.dog.rotation.x = freeDogAngle + (indexedAngle - freeDogAngle) * indexing;
      gear.engagement = engagement;
      gear.sleeve.position.x = gear.x + 0.84 - engagement * 0.35;
      gear.hub.rotation.x = -sim.outputAngle;
      gear.needleBearing.rotation.x = -sim.outputAngle - gear.bottom.rotation.x;
      gear.needleCage.rotation.x = (gear.bottom.rotation.x + sim.outputAngle) / 2;
      const synchronizing = sim.shiftTarget === i + 1 && sim.shiftStage === 'synchronize';
      const speedDifference = sim.inputOmega / gear.ratio - sim.outputOmega;
      gear.cone.position.x = gear.x + 0.49 - Math.min(1, engagement / 0.55) * 0.12;
      gear.cone.rotation.x = -sim.outputAngle + (synchronizing ? Math.sign(speedDifference) * Math.min(0.075, Math.abs(speedDifference) * 0.003) : 0);
      gear.syncGlow.visible = gear.syncGlow.userData.focusVisible !== false && sim.shiftTarget === i + 1 && sim.shiftStage === 'synchronize';
      gear.shiftFork.position.x = gear.sleeve.position.x;
      const sleeveMaterial = active ? this.materials.fuel : sim.shiftTarget === i + 1 ? this.materials.brass : this.materials.steel;
      gear.sleeve.userData.face.material = sleeveMaterial;
      gear.cutFace.material = sleeveMaterial;
      gear.sleeve.userData.face.visible = !cutaway;
      gear.cutFace.visible = cutaway;
      gear.sleeveTeeth.forEach(({ tooth, angle }) => { tooth.visible = !cutaway || Math.sin(angle - sim.outputAngle) < 0.75; tooth.material = sleeveMaterial; });
      gear.bottom.userData.lockedToShaft = active;
      gear.bottom.userData.rpm = sim.inputOmega / gear.ratio * 30 / Math.PI;
      gear.hub.userData.rpm = sim.outputOmega * 30 / Math.PI;
    });
    this.stub.rotation.x = sim.inputAngle;
    this.inputSplines.rotation.x = sim.inputAngle;
    this.topShaft.rotation.x = sim.inputAngle;
    this.bottomShaft.rotation.x = -sim.outputAngle;
    this.wheel.rotation.x = -sim.outputAngle / 3.9;
    this.flow.visible = this.showFlow && ['drive', 'drive-detail', 'clutch', 'gearbox'].includes(this.mode) && Math.abs(sim.transmittedTorque) > 0.2 && state.contact && sim.shiftTarget === null && (this.mode !== 'gearbox' || sim.gear !== 0);
    if (this.flow.visible) {
      const selected = sim.gear ? this.gears[sim.gear - 1] : null;
      const end = this.mode === 'clutch' ? this.bearing.position.x + 0.5 : selected ? this.gearbox.position.x + selected.x : 2.8;
      const points = this.mode === 'clutch' || !selected
        ? [[0.1, 0, 1.8], [end, 0, 1.8]]
        : [[this.mode === 'gearbox' ? 3.3 : 0.1, 0, 1.8], [end, 0, 1.8], [end, -1.8, 1.8], [this.gearbox.position.x + 8.1, -1.8, 1.8]];
      const lengths = points.slice(1).map((p, i) => vec(...p).distanceTo(vec(...points[i])));
      const total = lengths.reduce((a, b) => a + b, 0);
      this.flow.count = Math.min(8, Math.max(2, Math.floor(total / 1.7)));
      for (let n = 0; n < this.flow.count; n++) {
        const direction = Math.sign(sim.transmittedTorque);
        let distance = (((direction * sim.inputAngle / 3 + n / this.flow.count) % 1 + 1) % 1) * total;
        let segment = 0;
        while (segment < lengths.length - 1 && distance > lengths[segment]) { distance -= lengths[segment]; segment++; }
        const from = vec(...points[segment]);
        const to = vec(...points[segment + 1]);
        this.arrow(this.flow, n, from.clone().lerp(to, distance / lengths[segment]), to.sub(from).multiplyScalar(direction));
      }
      this.flow.instanceMatrix.needsUpdate = true;
    }
    this.anchors.forEach(({ anchor }) => { if (anchor.userData.followX) anchor.position.x = anchor.userData.followX.position.x; });
    this.applySection();
    this.group.updateMatrixWorld(true);
  }
}
