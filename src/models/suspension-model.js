import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';
import { SuspensionSimulation } from '../suspension.js';

const SCALE = 4;
const WIDTH = 1.05;
const ROAD_STEPS = 112;
const FLOOR_Y = -1.8;
const ROCKER_RADIUS = 0.3;
const SPRING_ARM = 0.14;

/** A cutaway axle bay. Physics prescribes wheel heave; this is educational guidance geometry. */
export class SuspensionModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.section = 'all'; this.isolate = false; this.type = 'macpherson';
    this.linkMaterial = this.material({ color: 0x64c7d9, metalness: 0.6, roughness: 0.3 });
    this.springMaterial = this.material({ color: 0xf2bf57, metalness: 0.55, roughness: 0.3, side: THREE.DoubleSide });
    this.damperMaterial = this.material({ color: 0xdb8b72, metalness: 0.45, roughness: 0.35 });
    this.clearMaterial = this.material({ color: 0x77bacc, metalness: 0.1, roughness: 0.5, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    this.rubber = this.material({ color: 0x24303a, metalness: 0, roughness: 0.9, transparent: true, opacity: 0.38, depthWrite: false });
    this.roadMaterial = this.material({ color: 0x405260, metalness: 0, roughness: 0.95, side: THREE.DoubleSide });
    this.body = this.subgroup(this.group, [0, 0, 0], 'suspensionBody');
    this.buildBody();
    this.bodyShell = [...this.body.children];
    this.driveShaft = this.rod('steel', 'suspensionDrive', 0.03);
    this.axle = this.subgroup(this.group, [0, 0, 0], 'suspensionLinks');
    this.axleBeam = this.box(0.25, 0.25, WIDTH * SCALE * 2, 'block', this.axle, [0, 0, 0], 'suspensionLinks');
    this.axleDrive = this.cylinder(0.36, 0.58, 'dark', this.axle, [0, 0, 0], 'x', 'suspensionDrive');
    this.halfshafts = [this.rod('steel', 'suspensionDrive', 0.034), this.rod('steel', 'suspensionDrive', 0.034)];
    this.innerCV = [-1, 1].map(sign => this.cylinder(0.14, 0.25, 'dark', this.axle, [0, 0, sign * 0.36], 'z', 'suspensionDrive'));
    this.corners = [-1, 1].map((sign, side) => this.buildCorner(sign, side));
    this.roads = [-1, 1].map(sign => this.buildRoad(sign));
    this.bodyAnchor = this.anchor('Nadwozie i mocowania', this.body, [2.7, -0.7, -2.8], 'suspensionBody', ['suspension']);
    this.roadAnchor = this.anchor('Nawierzchnia', this.group, [-5.5, 0.3, 0], 'suspensionRoad', ['suspension']);
    this.roadAnchor.userData.labelHidden = true;
    this.update({ suspension: new SuspensionSimulation() });
  }

  point(x, y, z) { return vec(x * SCALE, y * SCALE, z * SCALE); }

  rod(material, part, radius = 0.035, parent = this.group) {
    return this.cylinder(radius * SCALE, 1, material, parent, [0, 0, 0], 'y', part, 12);
  }

  joint(parent, material = 'steel', part = 'suspensionLinks', radius = 0.115) {
    return this.mesh(this.geometry(`suspensionJoint:${radius}`, () => new THREE.SphereGeometry(radius, 10, 8)), material, parent, [0, 0, 0], part);
  }

  context(mesh) { mesh.userData.ignorePick = true; return mesh; }

  buildBody() {
    // Floor, sills and inner wheelhouses replace the old unexplained overhead rectangle.
    this.context(this.box(6.4, 0.075, 5.5, this.clearMaterial, this.body, [0.3, FLOOR_Y, 0], 'suspensionBody'));
    for (const z of [-2.9, 2.9]) this.box(6.4, 0.22, 0.19, 'block', this.body, [0.3, FLOOR_Y - 0.08, z], 'suspensionBody');
    for (const x of [-2.7, 2.7]) this.box(0.15, 0.18, 5.85, 'steel', this.body, [x, FLOOR_Y - 0.08, 0], 'suspensionBody');
    this.context(this.box(0.08, 1.25, 5.5, this.clearMaterial, this.body, [2.7, FLOOR_Y + 0.64, 0], 'suspensionBody'));
    this.context(this.box(3.4, 0.35, 0.72, this.clearMaterial, this.body, [1, FLOOR_Y + 0.19, 0], 'suspensionBody'));
    this.subframe = this.subgroup(this.body, [0, 0, 0], 'suspensionBody');
    for (const x of [-0.88, 0.88, 1.32]) this.box(0.16, 0.18, 5, 'block', this.subframe, [x, -2.48, 0], 'suspensionBody');
    for (const z of [-2.4, 2.4]) {
      this.box(2.5, 0.18, 0.18, 'block', this.subframe, [0.22, -2.48, z], 'suspensionBody');
      for (const x of [-0.88, 1.32]) {
        const support = this.rod('steel', 'suspensionBody', 0.022, this.body);
        this.between(support, vec(x, -2.48, z), vec(x, FLOOR_Y - 0.08, z));
        this.cylinder(0.15, 0.12, 'dark', this.body, [x, FLOOR_Y - 0.08, z], 'y', 'suspensionBody');
      }
    }
    for (const sign of [-1, 1]) {
      const curve = this.curve(Array.from({ length: 25 }, (_, i) => {
        const angle = i * Math.PI / 24;
        return vec(Math.cos(angle) * 1.65, -2.95 + Math.sin(angle) * 1.65, sign * 4.35);
      }));
      this.pipe(curve, 0.055, 'steel', this.body, 'suspensionBody');
      const arch = new THREE.BufferGeometry(), points = [], indices = [];
      for (let i = 0; i <= 32; i++) {
        const angle = i * Math.PI / 32;
        for (const z of [sign * 4.35, sign * 2.95]) points.push(Math.cos(angle) * 1.65, -2.95 + Math.sin(angle) * 1.65, z);
        if (i < 32) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      arch.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); arch.setIndex(indices); arch.computeVertexNormals();
      this.context(this.mesh(arch, this.clearMaterial, this.body, [0, 0, 0], 'suspensionBody'));
      for (const x of [-1.65, 1.65]) {
        const brace = this.rod('steel', 'suspensionBody', 0.015, this.body);
        this.between(brace, vec(x, -2.95, sign * 4.35), vec(x, FLOOR_Y - 0.08, sign * 2.9));
      }
    }
    // Small transmission/differential context, attached below the floor.
    this.box(0.8, 0.43, 0.58, 'block', this.body, [1.6, -2.72, 0], 'suspensionDrive');
    for (const z of [-0.22, 0.22]) {
      const mount = this.rod('dark', 'suspensionBody', 0.013, this.body);
      this.between(mount, vec(1.6, -2.72, z), vec(1.6, FLOOR_Y, z));
    }
  }

  buildCorner(sign, side) {
    const guidance = this.subgroup(this.group, [0, 0, 0], 'suspensionLinks');
    const upright = this.box(0.28, 1.32, 0.28, this.linkMaterial, guidance, [0, 0, 0], 'suspensionLinks');
    const hub = this.rod('steel', 'suspensionLinks', 0.055, guidance);
    const rods = Array.from({ length: 6 }, () => this.rod(this.linkMaterial, 'suspensionLinks', 0.022, guidance));
    const joints = Array.from({ length: 12 }, () => this.joint(guidance));
    const tabs = Array.from({ length: 8 }, () => this.rod(this.linkMaterial, 'suspensionLinks', 0.032, guidance));
    const mounts = this.subgroup(this.body, [0, 0, 0], 'suspensionBody');
    const bodyPins = Array.from({ length: 8 }, () => this.joint(mounts, 'brass', 'suspensionBody', 0.13));
    const supports = Array.from({ length: 8 }, () => this.rod('steel', 'suspensionBody', 0.025, mounts));
    const wheel = this.subgroup(this.group, [0, 0, sign * WIDTH * SCALE], 'suspensionWheel');
    const tire = this.mesh(this.geometry('suspensionTire', () => new THREE.TorusGeometry(0.98, 0.34, 12, 40)), this.rubber, wheel, [0, 0, 0], 'suspensionWheel');
    this.cylinder(0.36, 0.38, 'steel', wheel, [0, 0, 0], 'z', 'suspensionWheel');
    this.ring(0.78, 0.045, 'steel', wheel, [0, 0, sign * 0.14], 'z', 'suspensionWheel');
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const spoke = this.rod('steel', 'suspensionWheel', 0.009, wheel);
      this.between(spoke, vec(0, 0, sign * 0.14), vec(Math.cos(angle) * 0.77, Math.sin(angle) * 0.77, sign * 0.14));
    }
    const coil = this.coil(), damper = this.damper();
    const springLowerSeat = this.cylinder(0.34, 0.06, 'dark', guidance, [0, 0, 0], 'y', 'suspensionSpring');
    const springUpperSeat = this.cylinder(0.34, 0.06, 'dark', guidance, [0, 0, 0], 'y', 'suspensionSpring');
    const springUpperStalk = this.rod('steel', 'suspensionSpring', 0.028, guidance);
    const tower = this.subgroup(mounts, [0, 0, 0], 'suspensionBody');
    const towerGeometry = this.geometry('suspensionStrutTower', () => new THREE.CylinderGeometry(0.48, 0.55, 2.36, 22, 1, true, -0.6, Math.PI * 1.4));
    this.context(this.mesh(towerGeometry, this.clearMaterial, tower, [0, -0.62, sign * 2.76], 'suspensionBody'));
    this.ring(0.34, 0.045, 'block', tower, [0, 0.56, sign * 2.76], 'y', 'suspensionBody');
    const actuation = this.subgroup(this.group, [0, 0, 0], 'suspensionRocker');
    const pushpull = this.rod('exhaust', 'suspensionRocker', 0.025, actuation);
    const rocker = this.subgroup(actuation, [0, 0, 0], 'suspensionRocker');
    const rockerArms = Array.from({ length: 3 }, () => this.rod(this.damperMaterial, 'suspensionRocker', 0.027, rocker));
    const rockerPins = Array.from({ length: 3 }, () => this.joint(rocker, 'brass', 'suspensionRocker', 0.13));
    const pivot = this.cylinder(0.11, 0.38, 'steel', actuation, [0, 0, 0], 'x', 'suspensionRocker');
    const rockerBracket = this.subgroup(mounts, [0, 0, 0], 'suspensionBody');
    for (const x of [-0.2, 0.2]) this.box(0.08, 0.42, 0.42, 'block', rockerBracket, [x, 0, 0], 'suspensionBody');
    const leaf = this.buildLeaf();
    const wheelAnchor = this.anchor('Koło', wheel, [0, -1.25, sign * 0.35], 'suspensionWheel', ['suspension']);
    wheelAnchor.userData.labelHidden = true;
    const springAnchor = this.anchor('Sprężyna', coil, [0.42, 0.55, 0], 'suspensionSpring', ['suspension']);
    const damperAnchor = this.anchor('Amortyzator', damper.group, [0.42, 0.4, 0], 'suspensionDamper', ['suspension']);
    const linksAnchor = this.anchor('Wahacze', guidance, [0, 0, 0], 'suspensionLinks', ['suspension']);
    const rockerAnchor = this.anchor('Dźwignia', actuation, [0, 0, 0], 'suspensionRocker', ['suspension']);
    const leafAnchor = this.anchor('Resor', leaf.group, [0, 0, 0], 'suspensionSpring', ['suspension']);
    if (side === 0) [springAnchor, damperAnchor, linksAnchor, rockerAnchor, leafAnchor].forEach(anchor => { anchor.userData.labelHidden = true; });
    return { sign, side, wheel, tire, wheelAnchor, guidance, rods, joints, tabs, upright, hub, mounts, bodyPins, supports,
      coil, damper, springLowerSeat, springUpperSeat, springUpperStalk, tower, actuation, pushpull, rocker, rockerArms, rockerPins, pivot, rockerBracket, leaf,
      springAnchor, damperAnchor, linksAnchor, rockerAnchor, leafAnchor, connections: [] };
  }

  coil() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionSpring');
    const geometry = this.geometry('suspensionCoil', () => {
      const points = Array.from({ length: 141 }, (_, i) => {
        const progress = i / 140, angle = progress * Math.PI * 12;
        return vec(Math.cos(angle) * 0.25, progress, Math.sin(angle) * 0.25);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 140, 0.035, 7, false);
    });
    this.mesh(geometry, this.springMaterial, group, [0, 0, 0], 'suspensionSpring');
    for (const y of [0, 1]) this.cylinder(0.31, 0.025, 'dark', group, [0, y, 0], 'y', 'suspensionSpring');
    return group;
  }

  damper() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionDamper');
    const tube = this.cylinder(0.115, 1, this.damperMaterial, group, [0, 0, 0], 'y', 'suspensionDamper', 20);
    const rod = this.cylinder(0.045, 1, 'steel', group, [0, 0, 0], 'y', 'suspensionDamper', 12);
    const piston = this.cylinder(0.105, 0.07, 'brass', group, [0, 0, 0], 'y', 'suspensionDamper', 20);
    const stems = [0, 1].map(() => this.cylinder(0.07, 1, 'steel', group, [0, 0, 0], 'y', 'suspensionDamper', 12));
    const eyes = [0, 1].map(() => this.ring(0.115, 0.028, 'steel', group, [0, 0, 0], 'x', 'suspensionDamper'));
    return { group, tube, rod, piston, stems, eyes, barrelLength: 1.8 };
  }

  buildLeaf() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionSpring');
    const layers = Array.from({ length: 4 }, () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 2 * 3), 3));
      const indices = [];
      for (let i = 0; i < 24; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geometry.setIndex(indices);
      return this.mesh(geometry, this.springMaterial, group, [0, 0, 0], 'suspensionSpring');
    });
    const eyes = [0, 1].map(() => this.ring(0.105, 0.03, 'steel', group, [0, 0, 0], 'z', 'suspensionSpring'));
    const shackle = this.rod('steel', 'suspensionSpring', 0.024, group);
    const hangers = [0, 1].map(() => this.rod('block', 'suspensionSpring', 0.027, group));
    const clamps = Array.from({ length: 4 }, () => this.rod('steel', 'suspensionSpring', 0.01, group));
    const clampBridges = [0, 1].map(() => this.rod('steel', 'suspensionSpring', 0.01, group));
    const plate = this.box(0.34, 0.06, 0.45, 'steel', group, [0, 0, 0], 'suspensionSpring');
    return { group, layers, eyes, shackle, hangers, clamps, clampBridges, plate };
  }

  buildRoad(sign) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ROAD_STEPS + 1) * 2 * 3), 3));
    const indices = [];
    for (let i = 0; i < ROAD_STEPS; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geometry.setIndex(indices);
    const mesh = this.mesh(geometry, this.roadMaterial, this.group, [0, 0, 0], 'suspensionRoad');
    mesh.frustumCulled = false;
    return { mesh, sign };
  }

  bodyPoint(x, y, z, state) {
    const angle = state.roll;
    return this.point(x, state.bodyHeight + y * Math.cos(angle) + z * Math.sin(angle), -y * Math.sin(angle) + z * Math.cos(angle));
  }

  springBetween(coil, from, to) {
    const length = Math.max(0.15, from.distanceTo(to));
    coil.position.copy(from); coil.quaternion.setFromUnitVectors(vec(0, 1, 0), to.clone().sub(from).normalize());
    coil.scale.set(1, length, 1);
  }

  damperBetween(damper, from, to) {
    const vector = to.clone().sub(from), length = Math.max(0.35, vector.length());
    damper.group.position.copy(from); damper.group.quaternion.setFromUnitVectors(vec(0, 1, 0), vector.normalize());
    const tubeLength = Math.min(damper.barrelLength, length - 0.24), rodBottom = 0.14 + tubeLength * 0.35, rodTop = length - 0.12;
    damper.tube.scale.y = tubeLength; damper.tube.position.y = 0.14 + tubeLength / 2;
    // The rod always reaches inside the barrel, including maximum rebound.
    damper.rod.scale.y = rodTop - rodBottom; damper.rod.position.y = (rodTop + rodBottom) / 2;
    damper.piston.position.y = rodBottom + 0.04;
    damper.stems[0].scale.y = 0.14; damper.stems[0].position.y = 0.07;
    damper.stems[1].scale.y = 0.12; damper.stems[1].position.y = length - 0.06;
    damper.eyes[0].position.y = 0; damper.eyes[1].position.y = length;
  }

  update(sim) {
    const state = sim.suspension;
    if (!state) return;
    this.type = state.type;
    this.body.position.y = state.bodyHeight * SCALE; this.body.rotation.x = -state.roll;
    this.axle.position.copy(state.type === 'leaf' ? this.point(0, state.axleHeight, 0) : this.bodyPoint(0, -0.68, 0, state));
    this.axle.rotation.x = state.type === 'leaf' ? -state.axleRoll : -state.roll;
    this.axleBeam.visible = state.type === 'leaf';
    this.between(this.driveShaft, this.bodyPoint(0.4, -0.68, 0, state), this.axle.position);
    this.corners.forEach(corner => this.updateCorner(corner, state));
    this.roads.forEach(({ mesh }, side) => {
      const position = mesh.geometry.attributes.position, sign = side ? 1 : -1;
      for (let i = 0; i <= ROAD_STEPS; i++) {
        const x = -8 + 16 * i / ROAD_STEPS, height = state.roadAt(state.distance - x / SCALE, side).height * SCALE;
        position.setXYZ(i * 2, x, height - 0.03, sign * WIDTH * SCALE - 0.76);
        position.setXYZ(i * 2 + 1, x, height - 0.03, sign * WIDTH * SCALE + 0.76);
      }
      position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox();
    });
    this.setSection(this.section, this.isolate);
  }

  updateCorner(c, state) {
    const { sign, side } = c, height = state.wheels[side].height;
    const wheel = this.point(0, height, sign * WIDTH * (state.type === 'leaf' ? Math.cos(state.axleRoll) : 1));
    c.wheel.position.copy(wheel); c.wheel.rotation.z = -state.wheels[side].angle; c.wheel.rotation.x = state.type === 'leaf' ? -state.axleRoll : 0;
    const uprightCentre = this.point(0, height + 0.045, sign * 0.97);
    c.upright.position.copy(uprightCentre); this.between(c.hub, this.point(0, height, sign * 0.97), wheel);
    const bottom = this.point(0, height - 0.1, sign * 0.94), top = this.point(0, height + 0.18, sign * 0.94);
    const locals = [[-0.22, -0.62, sign * 0.58], [0.22, -0.62, sign * 0.58], [-0.21, -0.3, sign * 0.57], [0.21, -0.3, sign * 0.57], [0.33, -0.47, sign * 0.59]];
    const inner = locals.map(p => this.bodyPoint(...p, state));
    let pairs = [];
    if (state.type === 'macpherson') pairs = [[inner[0], bottom], [inner[1], bottom], [inner[0], inner[1]]];
    else if (state.type === 'multilink') pairs = [
      [inner[0], this.point(-0.07, height - 0.1, sign * 0.94)], [inner[1], this.point(0.08, height - 0.1, sign * 0.94)],
      [inner[2], this.point(-0.07, height + 0.18, sign * 0.94)], [inner[3], this.point(0.08, height + 0.18, sign * 0.94)],
      [inner[4], this.point(0.12, height + 0.03, sign * 0.94)]
    ];
    else if (state.type !== 'leaf') pairs = [[inner[0], bottom], [inner[1], bottom], [inner[2], top], [inner[3], top], [inner[0], inner[1]], [inner[2], inner[3]]];
    c.connections = [];
    c.rods.forEach((rod, i) => {
      rod.visible = i < pairs.length;
      if (pairs[i]) { this.between(rod, ...pairs[i]); c.connections.push({ mesh: rod, pins: [c.joints[i * 2], c.joints[i * 2 + 1]], role: 'guidance' }); }
    });
    c.joints.forEach((joint, i) => { const pair = pairs[Math.floor(i / 2)]; joint.visible = Boolean(pair); if (pair) joint.position.copy(pair[i % 2]); });
    const tabTargets = state.type === 'macpherson' ? [bottom] : state.type === 'multilink' ? pairs.map(pair => pair[1]) : state.type === 'leaf' ? [] : [bottom, top];
    const bodyMounts = state.type === 'leaf' ? [] : locals.slice(0, state.type === 'macpherson' ? 2 : state.type === 'multilink' ? 5 : 4);
    const activeRod = ['pushrod', 'pullrod'].includes(state.type);
    c.actuation.visible = activeRod;
    let springFrom, springTo, damperFrom, damperTo;
    if (activeRod) {
      const push = state.type === 'pushrod', rockerRadius = push ? 0.35 : ROCKER_RADIUS;
      const pivotZ = 0.55, pivotLocal = [-0.25, push ? -0.2 : -0.76, sign * pivotZ];
      const pivot = this.bodyPoint(...pivotLocal, state), wheelJoint = this.point(-0.25, height + (push ? -0.1 : 0.19), sign * 0.94);
      // Circle intersection keeps the actuation rod rigid. The guidance itself follows the 1D lesson's wheel travel.
      const delta = wheelJoint.clone().sub(pivot).applyAxisAngle(vec(1, 0, 0), state.roll).divideScalar(SCALE);
      const dy = delta.y, dz = delta.z * sign, distance = Math.hypot(dy, dz);
      const initialAngle = push ? Math.PI / 9 : -Math.PI / 6;
      const initialDY = state.staticWheelHeight + (push ? -0.1 : 0.19) - 1.05 - pivotLocal[1];
      const rodLength = Math.hypot(initialDY - rockerRadius * Math.sin(initialAngle), 0.94 - pivotZ - rockerRadius * Math.cos(initialAngle));
      const cosine = (distance * distance + rockerRadius * rockerRadius - rodLength * rodLength) / (2 * Math.max(distance, 1e-6) * rockerRadius);
      const rockerAngle = Math.atan2(dy, dz) + (push ? 1 : -1) * Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
      const rodLocal = this.point(0, Math.sin(rockerAngle) * rockerRadius, sign * Math.cos(rockerAngle) * rockerRadius);
      const springLocal = this.point(0, Math.sin(rockerAngle + Math.PI / 2) * SPRING_ARM, sign * Math.cos(rockerAngle + Math.PI / 2) * SPRING_ARM);
      const rodJoint = pivot.clone().add(rodLocal.clone().applyAxisAngle(vec(1, 0, 0), -state.roll));
      const springJoint = pivot.clone().add(springLocal.clone().applyAxisAngle(vec(1, 0, 0), -state.roll));
      const pins = [pivot, rodJoint, springJoint];
      c.rockerPins.forEach((pin, i) => { pin.position.copy(pins[i]); });
      [[0, 1], [0, 2], [1, 2]].forEach(([a, b], i) => {
        this.between(c.rockerArms[i], pins[a], pins[b]); c.connections.push({ mesh: c.rockerArms[i], pins: [c.rockerPins[a], c.rockerPins[b]], role: 'rocker' });
      });
      this.between(c.pushpull, wheelJoint, rodJoint); c.pivot.position.copy(pivot);
      c.rockerBracket.position.copy(this.point(...pivotLocal)); c.rockerBracket.visible = true;
      c.rockerAnchor.position.copy(pivot).add(vec(0.1, 0.35, 0));
      bodyMounts.push(pivotLocal, [-0.25, pivotLocal[1], sign * 0.1]);
      springFrom = springJoint; springTo = this.bodyPoint(-0.25, pivotLocal[1], sign * 0.1, state);
      damperFrom = springFrom; damperTo = springTo;
      tabTargets.push(wheelJoint); c.actuationRodLength = rodLength * SCALE; c.rockerAngle = rockerAngle;
      c.kinematicLimit = Math.abs(cosine) > 1; c.actuationEnds = [wheelJoint, rodJoint];
      c.damper.barrelLength = push ? 0.75 : 1.15;
    } else if (state.type === 'macpherson') {
      springFrom = this.point(0, height + 0.07, sign * 0.94); springTo = this.bodyPoint(0, 0.14, sign * 0.69, state);
      damperFrom = springFrom; damperTo = springTo; bodyMounts.push([0, 0.14, sign * 0.69]); tabTargets.push(springFrom);
      c.rockerBracket.visible = false; c.damper.barrelLength = 1.8;
    } else if (state.type === 'multilink') {
      springFrom = pairs[0][0].clone().lerp(pairs[0][1], 0.64); springTo = this.bodyPoint(-0.124, 0.02, sign * 0.76, state);
      damperFrom = this.point(0.13, height - 0.02, sign * 0.94); damperTo = this.bodyPoint(0.28, 0.09, sign * 0.72, state);
      bodyMounts.push([-0.124, 0.02, sign * 0.76], [0.28, 0.09, sign * 0.72]); tabTargets.push(damperFrom);
      c.rockerBracket.visible = false; c.damper.barrelLength = 1.8;
    } else {
      damperFrom = this.point(0.16, state.axleHeight + sign * 0.72 * Math.sin(state.axleRoll), sign * 0.72 * Math.cos(state.axleRoll));
      damperTo = this.bodyPoint(0.28, -0.11, sign * 0.72, state);
      springFrom = damperFrom; springTo = damperTo; bodyMounts.push([0.28, -0.11, sign * 0.72]);
      c.rockerBracket.visible = false; c.damper.barrelLength = 1.7;
      this.updateLeaf(c.leaf, sign, state);
      const axleTab = this.point(0, state.axleHeight + sign * 0.72 * Math.sin(state.axleRoll), sign * 0.72 * Math.cos(state.axleRoll));
      tabTargets.push(damperFrom); this.between(c.tabs[0], axleTab, damperFrom);
    }
    c.tabs.forEach((tab, i) => {
      tab.visible = i < tabTargets.length;
      if (tabTargets[i] && state.type !== 'leaf') {
        const centre = uprightCentre.clone(); centre.y = THREE.MathUtils.clamp(tabTargets[i].y, uprightCentre.y - 0.58, uprightCentre.y + 0.58);
        this.between(tab, centre, tabTargets[i]);
      }
    });
    c.bodyPins.forEach((pin, i) => {
      pin.visible = i < bodyMounts.length; c.supports[i].visible = pin.visible;
      if (!pin.visible) return;
      const position = this.point(...bodyMounts[i]); pin.position.copy(position);
      // A bracket links every body-side pin to a floor rail or the supported subframe.
      const supportedY = position.y < FLOOR_Y ? -2.48 : FLOOR_Y;
      this.between(c.supports[i], position, vec(position.x, supportedY, position.z));
    });
    c.damperEnds = [damperFrom.clone(), damperTo.clone()];
    this.damperBetween(c.damper, damperFrom, damperTo);
    const axis = springTo.clone().sub(springFrom).normalize(), bottomOffset = activeRod ? 0.18 : state.type === 'macpherson' ? 0.6 : 0.08;
    const coilFrom = springFrom.clone().addScaledVector(axis, bottomOffset), coilTo = springTo.clone().addScaledVector(axis, -0.18);
    this.springBetween(c.coil, coilFrom, coilTo);
    c.springLowerSeat.position.copy(springFrom); c.springLowerSeat.quaternion.setFromUnitVectors(vec(0, 1, 0), axis);
    c.springLowerSeat.visible = state.type === 'multilink';
    c.springUpperSeat.position.copy(springTo); c.springUpperSeat.quaternion.copy(c.springLowerSeat.quaternion);
    c.springUpperSeat.visible = state.type === 'multilink';
    this.between(c.springUpperStalk, coilTo, springTo); c.springUpperStalk.visible = state.type === 'multilink';
    c.tower.visible = state.type === 'macpherson';
    c.springEnds = [coilFrom, coilTo];
    if (state.type === 'multilink') {
      // The separated coil has a short lower stalk and an upper body seat.
      this.between(c.tabs[7], springFrom, coilFrom); c.tabs[7].visible = true;
    }
    const shaftFrom = vec(0, 0, sign * 0.36).applyAxisAngle(vec(1, 0, 0), this.axle.rotation.x).add(this.axle.position);
    this.between(this.halfshafts[side], shaftFrom, wheel);
    c.linksAnchor.position.copy(bottom).add(vec(0.6, -0.28, 0));
    c.leafAnchor.position.copy(state.type === 'leaf' ? c.leaf.plate.position : bottom).add(vec(-0.6, -0.25, 0));
    c.springAnchor.userData.labelHidden = side === 0 || state.type === 'leaf';
    c.damperAnchor.userData.labelHidden = side === 0;
    c.linksAnchor.userData.labelHidden = side === 0 || state.type === 'leaf';
    c.leafAnchor.userData.labelHidden = side === 0 || state.type !== 'leaf';
    c.rockerAnchor.userData.labelHidden = side === 0 || !activeRod;
  }

  updateLeaf(leaf, sign, state) {
    const z = sign * 0.72, left = this.bodyPoint(-0.62, -0.63, z, state), right = this.bodyPoint(0.69, -0.63, z, state);
    const middle = this.point(0, state.axleHeight + z * Math.sin(state.axleRoll) - 0.065, z * Math.cos(state.axleRoll));
    leaf.group.position.set(0, 0, 0);
    leaf.layers.forEach((mesh, layer) => {
      const positions = mesh.geometry.attributes.position, span = 1 - layer * 0.17;
      for (let i = 0; i <= 24; i++) {
        const t = (-1 + i / 12) * span, endpoint = t < 0 ? left : right, fraction = t * t;
        const centre = middle.clone().lerp(endpoint, fraction); centre.x = t < 0 ? left.x * -t : right.x * t; centre.y -= layer * 0.038;
        positions.setXYZ(i * 2, centre.x, centre.y, centre.z - 0.16); positions.setXYZ(i * 2 + 1, centre.x, centre.y, centre.z + 0.16);
      }
      positions.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    });
    leaf.eyes[0].position.copy(left); leaf.eyes[1].position.copy(right);
    leaf.eyes.forEach(eye => { eye.rotation.x = -state.roll; });
    const frontMount = this.bodyPoint(-0.62, -0.45, z, state), rearMount = this.bodyPoint(0.62, -0.45, z, state);
    this.between(leaf.hangers[0], left, frontMount); this.between(leaf.shackle, right, rearMount);
    // Small floor brackets are supported by the sill, retaining every rolled Z coordinate.
    this.between(leaf.hangers[1], rearMount, this.bodyPoint(0.62, -0.45, sign * 0.725, state));
    leaf.plate.position.copy(middle).add(vec(0, -0.14, 0)); leaf.plate.rotation.x = -state.axleRoll;
    for (let i = 0; i < 4; i++) {
      const x = i < 2 ? -0.13 : 0.13, offsetZ = i % 2 ? 0.19 : -0.19;
      const bottom = middle.clone().add(vec(x, -0.13, offsetZ).applyAxisAngle(vec(1, 0, 0), -state.axleRoll));
      const top = middle.clone().add(vec(x, 0.43, offsetZ).applyAxisAngle(vec(1, 0, 0), -state.axleRoll));
      this.between(leaf.clamps[i], bottom, top);
    }
    leaf.clampBridges.forEach((bridge, i) => {
      const x = i ? 0.13 : -0.13;
      this.between(bridge, middle.clone().add(vec(x, 0.43, -0.19).applyAxisAngle(vec(1, 0, 0), -state.axleRoll)),
        middle.clone().add(vec(x, 0.43, 0.19).applyAxisAngle(vec(1, 0, 0), -state.axleRoll)));
    });
    leaf.mountEnds = [frontMount, rearMount]; leaf.eyeEnds = [left, right]; leaf.middle = middle;
  }

  setSection(section = 'all', isolate = false) {
    this.section = section; this.isolate = isolate;
    const focus = isolate && section !== 'all';
    const mechanicalFocus = ['suspensionLinks', 'suspensionSpring', 'suspensionDamper', 'suspensionRocker'].includes(section);
    this.body.visible = !focus || section === 'suspensionBody' || mechanicalFocus;
    this.bodyAnchor.userData.labelHidden = focus && section !== 'suspensionBody';
    this.bodyShell.forEach(mesh => { mesh.visible = !focus || section === 'suspensionBody'; });
    this.axle.visible = !focus || section === 'suspensionLinks' || (this.type === 'leaf' && mechanicalFocus); this.axleDrive.visible = !focus;
    this.roadAnchor.userData.labelHidden = true;
    this.driveShaft.visible = !focus; this.halfshafts.forEach(mesh => { mesh.visible = !focus; });
    this.innerCV.forEach(mesh => { mesh.visible = !focus; });
    this.roads.forEach(({ mesh }) => { mesh.visible = !focus || section === 'suspensionRoad'; });
    this.corners.forEach(c => {
      c.mounts.visible = !focus || section === 'suspensionBody' || mechanicalFocus;
      c.wheel.visible = !focus || section === 'suspensionWheel' || section === 'suspensionRoad';
      // Keep the mounting skeleton beside an isolated spring/damper: an unsupported part teaches nothing.
      c.guidance.visible = !focus || ['suspensionLinks', 'suspensionSpring', 'suspensionDamper', 'suspensionRocker'].includes(section);
      c.upright.visible = this.type !== 'leaf'; c.hub.visible = this.type !== 'leaf';
      c.rods.forEach(mesh => { if (this.type === 'leaf') mesh.visible = false; });
      c.joints.forEach(mesh => { if (this.type === 'leaf') mesh.visible = false; });
      c.coil.visible = this.type !== 'leaf' && (!focus || section === 'suspensionSpring' || (section === 'suspensionRocker' && ['pushrod', 'pullrod'].includes(this.type)));
      c.leaf.group.visible = this.type === 'leaf' && (!focus || section === 'suspensionSpring' || section === 'suspensionLinks');
      c.damper.group.visible = !focus || section === 'suspensionDamper' || (['suspensionSpring', 'suspensionRocker'].includes(section) && ['macpherson', 'pushrod', 'pullrod'].includes(this.type));
      c.actuation.visible = ['pushrod', 'pullrod'].includes(this.type) && (!focus || section === 'suspensionRocker' || section === 'suspensionSpring' || section === 'suspensionDamper');
      c.wheelAnchor.userData.labelHidden = true;
    });
  }

  bounds(section = 'all') {
    this.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3(), corner = this.corners[1];
    const closeups = {
      suspensionLinks: this.type === 'leaf' ? [corner.leaf.group, this.axle] : [corner.guidance],
      suspensionSpring: this.type === 'leaf' ? [corner.leaf.group, this.axle] : [corner.coil, corner.actuation],
      suspensionDamper: this.type === 'leaf' ? [corner.damper.group, this.axle] : [corner.damper.group],
      suspensionRocker: [corner.actuation, corner.damper.group, corner.coil]
    };
    const targets = closeups[section] || [this.group];
    targets.forEach(target => target.traverseVisible(mesh => {
      if (!mesh.isMesh || !mesh.visible) return;
      if (section === 'all' && mesh.userData.part === 'suspensionRoad') {
        // Keep the long moving road rendered, but fit the axle and nearby road
        // so its length does not reduce the mechanical details to a thumbnail.
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          if (Math.abs(positions.getX(i)) > 4) continue;
          box.expandByPoint(vec(positions.getX(i), positions.getY(i), positions.getZ(i)).applyMatrix4(mesh.matrixWorld));
        }
        return;
      }
      if (!closeups[section] && section !== 'all' && mesh.userData.part !== section) return;
      box.expandByObject(mesh);
    }));
    if (box.isEmpty()) box.set(vec(-4, -0.5, -5.5), vec(4, 6, 5.5));
    return box.expandByScalar(0.18);
  }
}
