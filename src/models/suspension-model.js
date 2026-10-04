import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';
import { SuspensionSimulation } from '../suspension.js';

const SCALE = 4;
const WIDTH = 1.05;
const ROAD_STEPS = 112;

/** Axle demonstration. The dynamics belong to Simulation; this only places parts. */
export class SuspensionModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.section = 'all'; this.isolate = false;
    this.type = 'macpherson';
    this.linkMaterial = this.material({ color: 0x64c7d9, metalness: 0.6, roughness: 0.3 });
    this.springMaterial = this.material({ color: 0xf2bf57, metalness: 0.55, roughness: 0.3 });
    this.damperMaterial = this.material({ color: 0xdb8b72, metalness: 0.45, roughness: 0.35 });
    this.clearMaterial = this.material({ color: 0x77bacc, metalness: 0.15, roughness: 0.25, transparent: true, opacity: 0.23, depthWrite: false });
    this.rubber = this.material({ color: 0x24303a, metalness: 0, roughness: 0.9, transparent: true, opacity: 0.38, depthWrite: false });
    this.roadMaterial = this.material({ color: 0x405260, metalness: 0, roughness: 0.95, side: THREE.DoubleSide });
    this.body = this.subgroup(this.group, [0, 0, 0], 'suspensionBody');
    for (const z of [-2.45, 2.45]) this.box(6.6, 0.18, 0.2, 'steel', this.body, [0, 0, z], 'suspensionBody');
    for (const x of [-2.8, 0.45, 2.8]) this.box(0.18, 0.18, 5.1, 'steel', this.body, [x, 0, 0], 'suspensionBody');
    this.box(0.25, 0.2, 4.65, 'block', this.body, [0, -2.48, 0], 'suspensionBody');
    for (const z of [-2.32, 2.32]) this.box(0.14, 2.4, 0.14, 'dark', this.body, [0.45, -1.24, z], 'suspensionBody');
    this.box(3.3, 0.6, 3.2, this.clearMaterial, this.body, [1.3, 0.35, 0], 'suspensionBody');
    this.box(0.95, 0.65, 0.85, 'block', this.body, [1.5, -0.45, 0], 'suspensionDrive');
    this.cylinder(0.13, 1.05, 'steel', this.body, [0.55, -0.45, 0], 'x', 'suspensionDrive');
    this.box(0.3, 0.3, 0.3, 'dark', this.body, [0, -0.45, 0], 'suspensionDrive');
    this.driveShaft = this.rod('dark', 'suspensionDrive', 0.025);
    this.axle = this.subgroup(this.group, [0, 0, 0], 'suspensionLinks');
    this.axleBeam = this.box(0.28, 0.28, WIDTH * SCALE * 2, 'block', this.axle, [0, 0, 0], 'suspensionLinks');
    this.axleDrive = this.cylinder(0.45, 0.7, 'dark', this.axle, [0, 0, 0], 'x', 'suspensionDrive');
    this.halfshafts = [this.rod('steel', 'suspensionDrive', 0.065), this.rod('steel', 'suspensionDrive', 0.065)];
    this.corners = [-1, 1].map((sign, side) => this.buildCorner(sign, side));
    this.roads = [-1, 1].map(sign => this.buildRoad(sign));
    this.anchor('Nadwozie · masa resorowana', this.body, [2.1, 1.15, 0], 'suspensionBody', ['suspension']);
    this.roadAnchor = this.anchor('Nawierzchnia pod L/P', this.group, [-5.5, 0.3, 0], 'suspensionRoad', ['suspension']);
    this.update({ suspension: new SuspensionSimulation() });
  }

  point(x, y, z) { return vec(x * SCALE, y * SCALE, z * SCALE); }

  rod(material, part, radius = 0.035, parent = this.group) {
    const mesh = this.cylinder(radius * SCALE, 1, material, parent, [0, 0, 0], 'y', part, 12);
    return mesh;
  }

  joint(parent, material = 'steel', part = 'suspensionLinks') {
    return this.mesh(this.geometry('suspensionJoint', () => new THREE.SphereGeometry(0.1, 10, 8)), material, parent, [0, 0, 0], part);
  }

  buildCorner(sign, side) {
    const guidance = this.subgroup(this.group, [0, 0, 0], 'suspensionLinks');
    const upright = this.box(0.16, 1.1, 0.19, this.linkMaterial, guidance, [0, 0, 0], 'suspensionLinks');
    const rods = Array.from({ length: 6 }, () => this.rod(this.linkMaterial, 'suspensionLinks', 0.022, guidance));
    const joints = Array.from({ length: 12 }, () => this.joint(guidance));
    const wheel = this.subgroup(this.group, [0, 0, sign * WIDTH * SCALE], 'suspensionWheel');
    const tire = this.mesh(this.geometry('suspensionTire', () => new THREE.TorusGeometry(0.98, 0.34, 12, 40)), this.rubber, wheel, [0, 0, 0], 'suspensionWheel');
    this.cylinder(0.42, 0.38, 'steel', wheel, [0, 0, 0], 'z', 'suspensionWheel');
    this.ring(0.78, 0.045, 'steel', wheel, [0, 0, sign * 0.14], 'z', 'suspensionWheel');
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const spoke = this.rod('steel', 'suspensionWheel', 0.009, wheel);
      this.between(spoke, vec(0, 0, sign * 0.14), vec(Math.cos(angle) * 0.77, Math.sin(angle) * 0.77, sign * 0.14));
    }
    const coil = this.coil();
    const damper = this.damper();
    const actuation = this.subgroup(this.group, [0, 0, 0], 'suspensionRocker');
    const pushpull = this.rod('exhaust', 'suspensionRocker', 0.025, actuation);
    const rocker = this.box(0.14, 0.42, 0.44, this.damperMaterial, actuation, [0, 0, 0], 'suspensionRocker');
    const pivot = this.cylinder(0.095, 0.25, 'brass', actuation, [0, 0, 0], 'x', 'suspensionRocker');
    const leaf = this.buildLeaf();
    this.anchor(side ? 'Koło P' : 'Koło L', wheel, [0, -1.25, sign * 0.35], 'suspensionWheel', ['suspension']);
    const springAnchor = this.anchor('Sprężyna', coil, [0.42, 0.65, 0], 'suspensionSpring', ['suspension']);
    const damperAnchor = this.anchor('Amortyzator', damper.group, [0.55, 0.43, 0], 'suspensionDamper', ['suspension']);
    const linksAnchor = this.anchor('Wahacze / prowadzenie', guidance, [0, 0, 0], 'suspensionLinks', ['suspension']);
    const rockerAnchor = this.anchor('Dźwignia i popychacz / cięgno', actuation, [0, 0, 0], 'suspensionRocker', ['suspension']);
    const leafAnchor = this.anchor('Resor · pióra, obejmy i wieszak', leaf.group, [0.4, 0, 0], 'suspensionSpring', ['suspension']);
    // The far-side assembly remains selectable without repeating every label.
    if (side === 0) [springAnchor, damperAnchor, linksAnchor, rockerAnchor, leafAnchor].forEach(anchor => { anchor.userData.labelHidden = true; });
    return { sign, side, wheel, tire, guidance, rods, joints, upright, coil, damper, actuation, pushpull, rocker, pivot, leaf,
      springAnchor, linksAnchor, rockerAnchor, leafAnchor };
  }

  coil() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionSpring');
    const geometry = this.geometry('suspensionCoil', () => {
      const points = Array.from({ length: 181 }, (_, i) => {
        const progress = i / 180, angle = progress * Math.PI * 16;
        return vec(Math.cos(angle) * 0.29, progress, Math.sin(angle) * 0.29);
      });
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 180, 0.035, 7, false);
    });
    this.mesh(geometry, this.springMaterial, group, [0, 0, 0], 'suspensionSpring');
    for (const y of [0, 1]) this.cylinder(0.35, 0.025, 'dark', group, [0, y, 0], 'y', 'suspensionSpring');
    return group;
  }

  damper() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionDamper');
    const tube = this.cylinder(0.115, 1, this.damperMaterial, group, [0, 0, 0], 'y', 'suspensionDamper', 20);
    const rod = this.cylinder(0.045, 1, 'steel', group, [0, 0, 0], 'y', 'suspensionDamper', 12);
    const piston = this.cylinder(0.105, 0.07, 'brass', group, [0, 0, 0], 'y', 'suspensionDamper', 20);
    const window = this.box(0.18, 0.43, 0.09, this.clearMaterial, group, [0, 0.34, 0.1], 'suspensionDamper');
    return { group, tube, rod, piston, window };
  }

  buildLeaf() {
    const group = this.subgroup(this.group, [0, 0, 0], 'suspensionSpring');
    const layers = Array.from({ length: 4 }, (_, layer) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(25 * 2 * 3), 3));
      const indices = [];
      for (let i = 0; i < 24; i++) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      geometry.setIndex(indices);
      const material = this.springMaterial;
      material.side = THREE.DoubleSide;
      return this.mesh(geometry, material, group, [0, -layer * 0.035, 0], 'suspensionSpring');
    });
    const eyes = [-1, 1].map(() => this.ring(0.095, 0.025, 'steel', group, [0, 0, 0], 'z', 'suspensionSpring'));
    const shackle = this.rod('steel', 'suspensionSpring', 0.02, group);
    const hangers = [-1, 1].map(() => this.rod('block', 'suspensionSpring', 0.023, group));
    const clamps = [-0.1, 0.1].map(x => this.box(0.05, 0.24, 0.45, 'steel', group, [x, 0, 0], 'suspensionSpring'));
    return { group, layers, eyes, shackle, hangers, clamps };
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
    coil.position.copy(from);
    coil.quaternion.setFromUnitVectors(vec(0, 1, 0), to.clone().sub(from).normalize());
    coil.scale.set(1, length, 1);
  }

  damperBetween(damper, from, to) {
    const vector = to.clone().sub(from), length = Math.max(0.25, vector.length());
    damper.group.position.copy(from);
    damper.group.quaternion.setFromUnitVectors(vec(0, 1, 0), vector.normalize());
    const tubeLength = Math.min(1.35, length * 0.72);
    damper.tube.scale.y = tubeLength; damper.tube.position.y = tubeLength / 2;
    damper.rod.scale.y = length * 0.64; damper.rod.position.y = length * 0.68;
    damper.piston.position.y = Math.min(tubeLength - 0.1, length * 0.35);
    damper.window.position.y = tubeLength * 0.55;
  }

  update(sim) {
    const state = sim.suspension;
    if (!state) return;
    this.type = state.type;
    this.body.position.y = state.bodyHeight * SCALE;
    // The simulation defines positive roll as the positive-Z side rising.
    this.body.rotation.x = -state.roll;
    this.axle.position.y = (state.type === 'leaf' ? (state.wheels[0].height + state.wheels[1].height) / 2 : state.bodyHeight - 0.7) * SCALE;
    this.axle.rotation.x = state.type === 'leaf' ? -state.axleRoll : 0;
    this.axleBeam.visible = state.type === 'leaf';
    this.between(this.driveShaft, vec(0, state.bodyHeight * SCALE - 0.45, 0), vec(0, this.axle.position.y, 0));
    this.corners.forEach(corner => this.updateCorner(corner, state));
    this.roads.forEach(({ mesh, sign }, side) => {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i <= ROAD_STEPS; i++) {
        const x = -8 + 16 * i / ROAD_STEPS;
        const height = state.roadAt(state.distance - x / SCALE, side).height * SCALE;
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
    c.wheel.position.copy(wheel); c.wheel.rotation.z = -state.wheels[side].angle;
    c.wheel.rotation.x = state.type === 'leaf' ? -state.axleRoll : 0;
    c.upright.position.copy(this.point(0, height + 0.045, sign * 0.98));
    c.guidance.visible = state.type !== 'leaf';
    const bottom = this.point(0, height - 0.1, sign * 0.93);
    const top = this.point(0, height + 0.18, sign * 0.93);
    const pairs = [];
    const lowerA = this.bodyPoint(-0.22, -0.62, sign * 0.58, state);
    const lowerB = this.bodyPoint(0.22, -0.62, sign * 0.58, state);
    if (state.type === 'macpherson') pairs.push([lowerA, bottom], [lowerB, bottom], [lowerA, lowerB]);
    else if (state.type !== 'leaf') {
      const upperA = this.bodyPoint(-0.21, -0.3, sign * 0.57, state);
      const upperB = this.bodyPoint(0.21, -0.3, sign * 0.57, state);
      if (state.type === 'multilink') {
        pairs.push([lowerA, this.point(-0.06, height - 0.1, sign * 0.93)], [lowerB, this.point(0.07, height - 0.1, sign * 0.92)],
          [upperA, this.point(-0.07, height + 0.18, sign * 0.91)], [upperB, this.point(0.08, height + 0.18, sign * 0.91)],
          [this.bodyPoint(0.33, -0.47, sign * 0.59, state), this.point(0.12, height + 0.03, sign * 0.95)]);
      } else pairs.push([lowerA, bottom], [lowerB, bottom], [upperA, top], [upperB, top], [lowerA, lowerB], [upperA, upperB]);
    }
    c.rods.forEach((rod, i) => { rod.visible = i < pairs.length; if (pairs[i]) this.between(rod, ...pairs[i]); });
    c.joints.forEach((joint, i) => { const pair = pairs[Math.floor(i / 2)]; joint.visible = Boolean(pair); if (pair) joint.position.copy(pair[i % 2]); });
    c.linksAnchor.position.copy(bottom).add(vec(0, -0.45, 0));
    this.between(this.halfshafts[side], vec(0, this.axle.position.y, 0), wheel);
    c.actuation.visible = ['pushrod', 'pullrod'].includes(state.type);
    c.coil.visible = state.type !== 'leaf';
    c.leaf.group.visible = state.type === 'leaf';
    c.springAnchor.userData.labelHidden = side === 0 || state.type === 'leaf';
    c.leafAnchor.userData.labelHidden = side === 0 || state.type !== 'leaf';
    c.rockerAnchor.userData.labelHidden = side === 0 || !c.actuation.visible;
    let springFrom, springTo, damperFrom, damperTo;
    if (c.actuation.visible) {
      const push = state.type === 'pushrod';
      const pivot = this.bodyPoint(-0.25, push ? -0.08 : -0.62, sign * 0.47, state);
      const motion = state.wheels[side].travel;
      const rockerAngle = motion * 2.1;
      const rodJoint = pivot.clone().add(this.point(0, Math.sin(rockerAngle) * 0.14, sign * Math.cos(rockerAngle) * 0.14));
      const springJoint = pivot.clone().add(this.point(0, Math.cos(rockerAngle) * 0.14, -sign * Math.sin(rockerAngle) * 0.14));
      const wheelJoint = this.point(-0.25, height + (push ? -0.09 : 0.18), sign * 0.93);
      this.between(c.pushpull, wheelJoint, rodJoint);
      c.rocker.position.copy(pivot); c.rocker.rotation.x = -sign * rockerAngle;
      c.pivot.position.copy(pivot); c.rockerAnchor.position.copy(pivot).add(vec(-0.1, 0.5, 0));
      springFrom = springJoint; springTo = this.bodyPoint(-0.25, push ? 0.06 : -0.48, sign * 0.13, state);
      damperFrom = springFrom; damperTo = springTo;
    } else if (state.type === 'macpherson') {
      springFrom = this.point(0, height + 0.07, sign * 0.93);
      springTo = this.bodyPoint(0, 0.14, sign * 0.69, state);
      damperFrom = springFrom; damperTo = springTo;
    } else {
      springFrom = this.point(-0.15, height - 0.09, sign * 0.79);
      springTo = this.bodyPoint(-0.15, 0.02, sign * 0.65, state);
      damperFrom = this.point(0.28, height - 0.04, sign * 0.91);
      damperTo = this.bodyPoint(0.28, 0.09, sign * 0.72, state);
    }
    this.springBetween(c.coil, springFrom, springTo);
    this.damperBetween(c.damper, damperFrom, damperTo);
    if (state.type === 'leaf') this.updateLeaf(c.leaf, sign, height, state);
  }

  updateLeaf(leaf, sign, height, state) {
    const z = sign * 0.72;
    leaf.group.position.z = z * SCALE;
    const left = this.bodyPoint(-0.62, -0.45, z, state);
    const right = this.bodyPoint(0.62, -0.45, z, state);
    const middleY = (height - 0.055) * SCALE;
    leaf.layers.forEach((mesh, layer) => {
      const positions = mesh.geometry.attributes.position;
      const length = (1 - layer * 0.17) * 0.62 * SCALE;
      for (let i = 0; i <= 24; i++) {
        const fraction = -1 + i / 12, x = fraction * length;
        const endpointY = (left.y + right.y) / 2;
        const y = middleY + (endpointY - middleY) * fraction * fraction;
        positions.setXYZ(i * 2, x, y, -0.16); positions.setXYZ(i * 2 + 1, x, y, 0.16);
      }
      positions.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    });
    leaf.eyes[0].position.set(left.x, left.y, 0); leaf.eyes[1].position.set(right.x, right.y, 0);
    this.between(leaf.shackle, vec(right.x, right.y, 0), vec(right.x + 0.08, right.y + 0.35, 0));
    const leftMount = this.bodyPoint(-0.62, 0, z, state);
    const rightMount = this.bodyPoint(0.62, 0, z, state);
    this.between(leaf.hangers[0], vec(left.x, left.y, 0), vec(leftMount.x, leftMount.y, 0));
    this.between(leaf.hangers[1], vec(right.x + 0.08, right.y + 0.35, 0), vec(rightMount.x, rightMount.y, 0));
    leaf.clamps.forEach(clamp => { clamp.position.y = middleY - 0.07; });
  }

  setSection(section = 'all', isolate = false) {
    this.section = section; this.isolate = isolate;
    const focus = isolate && section !== 'all';
    this.body.visible = !focus || section === 'suspensionBody';
    this.axle.visible = !focus || section === 'suspensionLinks';
    this.axleDrive.visible = !focus;
    this.roadAnchor.userData.labelHidden = focus && !['suspensionRoad', 'suspensionWheel'].includes(section);
    this.driveShaft.visible = !focus;
    this.halfshafts.forEach(mesh => { mesh.visible = !focus; });
    this.roads.forEach(({ mesh }) => { mesh.visible = !focus || section === 'suspensionRoad'; });
    this.corners.forEach(c => {
      c.wheel.visible = !focus || section === 'suspensionWheel' || section === 'suspensionRoad';
      c.guidance.visible = this.type !== 'leaf' && (!focus || section === 'suspensionLinks');
      c.coil.visible = this.type !== 'leaf' && (!focus || section === 'suspensionSpring');
      c.leaf.group.visible = this.type === 'leaf' && (!focus || section === 'suspensionSpring' || section === 'suspensionLinks');
      c.damper.group.visible = !focus || section === 'suspensionDamper';
      c.actuation.visible = ['pushrod', 'pullrod'].includes(this.type) && (!focus || section === 'suspensionRocker' || section === 'suspensionSpring');
    });
  }

  bounds(section = 'all') {
    this.group.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const corner = this.corners[1];
    const closeups = {
      suspensionLinks: this.type === 'leaf' ? [corner.leaf.group] : [corner.guidance],
      suspensionSpring: this.type === 'leaf' ? [corner.leaf.group] : [corner.coil, corner.actuation],
      suspensionDamper: [corner.damper.group], suspensionRocker: [corner.actuation]
    };
    const targets = closeups[section] || [this.group];
    targets.forEach(target => target.traverseVisible(mesh => {
      if (!mesh.isMesh || !mesh.visible) return;
      if (!closeups[section] && section !== 'all' && mesh.userData.part !== section) return;
      box.expandByObject(mesh);
    }));
    if (box.isEmpty()) box.set(vec(-4, -0.5, -5.5), vec(4, 6, 5.5));
    return box.expandByScalar(0.18);
  }
}
