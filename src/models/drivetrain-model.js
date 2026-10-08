import * as THREE from 'three';
import { GEAR_RATIOS } from '../simulation.js';
import { getEngine } from '../engines.js';
import { manualClutchState } from '../manual-clutch.js';
import { ModelGeometry, vec } from './geometry.js';

const TEETH = [[20, 70], [30, 63], [40, 56], [60, 63], [50, 41]];
const DOG_TOOTH_PITCH = Math.PI * 2 / 36;
// These offsets separate the layers for inspection, independently of pedal travel.
const CLUTCH_EXPLOSION = Object.freeze({ disc: 1.6, pressure: 3.2, diaphragm: 4.8, cover: 6.4, bearing: 8, actuator: 9.6 });
const CLUTCH_LAYOUT = Object.freeze({ disc: 0.2, pressure: 0.3075, diaphragm: 0.92, cover: 1.08, actuator: 1.62 });
const CLUTCH_SECTION = Object.freeze({ start: 2, end: Math.PI * 2 - 0.35 });
const samePose = (object, values, i) => values[i] === object.position.x && values[i + 1] === object.position.y && values[i + 2] === object.position.z
  && values[i + 3] === object.quaternion.x && values[i + 4] === object.quaternion.y && values[i + 5] === object.quaternion.z && values[i + 6] === object.quaternion.w
  && values[i + 7] === object.scale.x && values[i + 8] === object.scale.y && values[i + 9] === object.scale.z;
const rememberPose = (object, values, i) => {
  values[i] = object.position.x; values[i + 1] = object.position.y; values[i + 2] = object.position.z;
  values[i + 3] = object.quaternion.x; values[i + 4] = object.quaternion.y; values[i + 5] = object.quaternion.z; values[i + 6] = object.quaternion.w;
  values[i + 7] = object.scale.x; values[i + 8] = object.scale.y; values[i + 9] = object.scale.z;
};
const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const visibleBounds = (...parts) => {
  const result = new THREE.Box3();
  parts.forEach(part => part.traverseVisible(mesh => {
    if (!mesh.geometry) return;
    mesh.geometry.computeBoundingBox();
    result.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }));
  return result;
};

export class DrivetrainModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.exploded = 0;
    this.mode = 'drive';
    this.section = 'all';
    this.isolate = false;
    this.synchronizerGear = 2;
    this.clutch = this.subgroup(this.group, [0, 0, 0], 'clutch');
    this.gearbox = this.subgroup(this.group, [3.8, 0, 0], 'gearbox');
    this.buildClutch();
    this.buildGearbox();
    this.showFlow = true;
    this.flow = this.arrows(8, 0xffc35a, this.group, 0.14);
  }

  get explodedGearboxOffset() {
    return Math.max(0, Math.min(1, this.exploded)) * CLUTCH_EXPLOSION.actuator;
  }

  buildClutch() {
    this.clutchSections = [];
    this.clutchRotatingDetails = [];
    this.clutchRotorPlanes = new WeakMap();
    this.flywheel = this.gear(84, 1.27, 0.23, 'dark', this.clutch, [0, 0, 0], 'flywheel', 0.32);
    this.clutchRing(0.4, 0.14, 0.11, 'steel', this.flywheel, [-0.14, 0, 0], 'flywheel');
    this.clutchRing(1.02, 0.38, 0.025, 'steel', this.flywheel, [0.14, 0, 0], 'flywheel');
    const friction = this.material({ color: 0x69534a, roughness: 0.9, metalness: 0.05, emissive: 0xe7561c, emissiveIntensity: 0 });
    this.frictionMaterial = friction;
    this.disc = this.subgroup(this.clutch, [0.29, 0, 0], 'friction');
    // Both lining faces meet the flywheel/pressure plate at pedal=0.
    // The fixed section reveals those faces without an artificial axial gap.
    this.clutchRing(1.02, 0.69, 0.035, friction, this.disc, [-0.03, 0, 0], 'friction');
    this.clutchRing(1.02, 0.69, 0.035, friction, this.disc, [0.03, 0, 0], 'friction');
    this.clutchRing(1.00, 0.64, 0.025, 'dark', this.disc, [0, 0, 0], 'friction');
    this.discCarrier = this.clutchRing(0.77, 0.64, 0.055, 'steel', this.disc, [0, 0, 0], 'discHub');
    this.hubFlange = this.clutchRing(0.34, 0.24, 0.07, 'steel', this.disc, [0.02, 0, 0], 'discHub');
    this.discHub = this.clutchRing(0.29, 0.173, 0.23, 'brass', this.disc, [0, 0, 0], 'discHub');
    this.hubTeeth = [];
    for (let i = 0; i < 20; i++) {
      const a = (i + 0.5) / 20 * Math.PI * 2;
      const tooth = this.box(0.23, 0.047, 0.023, 'brass', this.disc, [0, Math.cos(a) * 0.171, Math.sin(a) * 0.171], 'discHub');
      tooth.rotation.x = a;
      this.hubTeeth.push(tooth);
      this.clutchRotatingDetails.push({ object: tooth, a, rotor: this.disc });
    }
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const rivet = this.cylinder(0.021, 0.084, 'brass', this.disc, [0, Math.cos(a) * 0.83, Math.sin(a) * 0.83], 'x', 'friction', 8);
      const groove = this.box(0.096, 0.27, 0.015, 'black', this.disc, [0, Math.cos(a) * 0.86, Math.sin(a) * 0.86], 'friction');
      groove.rotation.x = a;
      this.clutchRotatingDetails.push({ object: rivet, a, rotor: this.disc }, { object: groove, a, rotor: this.disc });
    }
    this.damperWindows = [];
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2;
      const window = this.subgroup(this.disc, [0, 0, 0], 'torsionSprings');
      window.rotation.x = a;
      // Open damper windows: radial webs connect both end seats to the hub and
      // lining carrier. The coil is retained at its ends, rather than laid over
      // a solid plate or left visible after that plate has been sectioned away.
      const seats = [-1, 1].map(side => this.box(0.15, 0.18, 0.04, 'steel', window, [0.03, 0.48, side * 0.19], 'torsionSprings'));
      const webs = [-1, 1].map(side => {
        const angle = side * 0.38;
        const web = this.box(0.055, 1, 0.075, 'steel', window, [0, 0, 0], 'discHub');
        this.betweenRadial(web, vec(0.02, Math.cos(angle) * 0.30, Math.sin(angle) * 0.30), vec(0.02, Math.cos(angle) * 0.74, Math.sin(angle) * 0.74), angle);
        return web;
      });
      const spring = this.subgroup(window, [0.04, 0.48, 0], 'torsionSprings');
      spring.rotation.x = Math.PI / 2;
      const coilGeometry = this.geometry('clutch-damper-coil', () => {
        const points = Array.from({ length: 61 }, (_, n) => vec(Math.sin(n / 60 * Math.PI * 10) * 0.055, (n / 60 - 0.5) * 0.34, Math.cos(n / 60 * Math.PI * 10) * 0.055));
        return new THREE.TubeGeometry(this.curve(points), 60, 0.012, 6, false);
      });
      const coil = this.mesh(coilGeometry, 'intake', spring, [0, 0, 0], 'torsionSprings');
      this.damperWindows.push({ window, coil, seats, webs });
      [...seats, ...webs, coil].forEach(object => this.clutchRotatingDetails.push({ object, a, rotor: this.disc }));
    }
    this.pressure = this.subgroup(this.clutch, [0.48, 0, 0], 'pressurePlate');
    this.pressureFace = this.clutchRing(1.05, 0.62, 0.12, 'steel', this.pressure, [0, 0, 0], 'pressurePlate');
    // The cover surrounds the plate. Its central opening and rearward fulcrum
    // leave clearance through the entire exaggerated release stroke.
    this.cover = this.subgroup(this.clutch, [CLUTCH_LAYOUT.cover, 0, 0], 'clutchCover');
    this.coverRing = this.clutchRing(1.24, 1.11, 0.14, 'intake', this.cover, [0, 0, 0], 'clutchCover');
    this.coverCup = this.clutchRing(1.24, 1.12, 0.94, 'intake', this.cover, [-0.47, 0, 0], 'clutchCover');
    this.coverFlange = this.clutchRing(1.245, 1.04, 0.05, 'intake', this.cover, [-0.94, 0, 0], 'clutchCover');
    this.coverBolts = [];
    this.coverSupports = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      for (const supportX of [-0.195, -0.125]) {
        const rib = this.box(0.025, 1, 0.085, 'intake', this.cover, [0, 0, 0], 'clutchCover');
        this.betweenRadial(rib, vec(supportX, Math.cos(a) * 0.79, Math.sin(a) * 0.79), vec(0, Math.cos(a) * 1.17, Math.sin(a) * 1.17), a);
        this.coverSupports.push(rib);
        this.clutchRotatingDetails.push({ object: rib, a, rotor: this.cover });
      }
      const bolt = this.cylinder(0.046, 0.13, 'steel', this.cover, [-0.95, Math.cos(a) * 1.17, Math.sin(a) * 1.17], 'x', 'clutchCover', 6);
      this.coverBolts.push(bolt);
      this.clutchRotatingDetails.push({ object: bolt, a, rotor: this.cover });
    }
    this.fulcrumRings = [-0.195, -0.125].map(x => this.clutchRing(0.809, 0.771, 0.038, 'steel', this.cover, [x, 0, 0], 'clutchCover'));
    this.pressureStraps = this.subgroup(this.clutch, [0, 0, 0], 'pressurePlate');
    this.straps = [];
    for (let n = 0; n < 6; n++) {
      const angle = n * Math.PI / 3;
      const segments = Array.from({ length: 3 }, () => this.box(0.022, 1, 0.075, 'exhaust', this.pressureStraps, [0, 0, 0], 'pressurePlate'));
      this.straps.push({ angle, segments });
    }
    this.diaphragm = this.subgroup(this.clutch, [CLUTCH_LAYOUT.diaphragm, 0, 0], 'diaphragm');
    this.diaphragmRing = this.clutchRing(0.80, 0.76, 0.035, 'brass', this.diaphragm, [0, 0, 0], 'diaphragm');
    this.diaphragmWeb = this.conicalDiaphragm(this.diaphragm);
    this.fingers = [];
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const finger = this.box(0.035, 1, 0.075, 'brass', this.diaphragm, [0, 0, 0], 'diaphragm');
      this.fingers.push({ finger, a });
      this.clutchRotatingDetails.push({ object: finger, a, rotor: this.diaphragm });
    }
    this.bearing = this.subgroup(this.clutch, [1.13, 0, 0], 'releaseBearing');
    this.bearingRace = this.subgroup(this.bearing, [0, 0, 0], 'releaseBearing');
    this.clutchRing(0.33, 0.2, 0.04, 'steel', this.bearingRace, [-0.065, 0, 0], 'releaseBearing');
    this.clutchRing(0.3, 0.2, 0.12, 'dark', this.bearing, [0.035, 0, 0], 'releaseBearing');
    this.bearingRollers = this.subgroup(this.bearing, [-0.035, 0, 0], 'releaseBearing');
    for (let n = 0; n < 12; n++) {
      const angle = n * Math.PI / 6;
      const ball = this.mesh(this.geometry('release-ball', () => new THREE.SphereGeometry(0.024, 8, 6)), 'steel', this.bearingRollers, [0, Math.cos(angle) * 0.265, Math.sin(angle) * 0.265], 'releaseBearing');
      this.clutchRotatingDetails.push({ object: ball, a: angle, rotor: this.bearingRollers });
    }
    // A concentric slave cylinder directly advances the bearing. A freestanding
    // release fork has no pivot/actuator and looked like an unexplained tongue.
    this.releaseActuator = this.subgroup(this.clutch, [CLUTCH_LAYOUT.actuator, 0, 0], 'releaseActuator');
    this.fork = this.releaseActuator; // Existing scene inspection/bounds alias.
    this.actuatorHousing = this.clutchRing(0.43, 0.335, 0.60, 'intake', this.releaseActuator, [0.17, 0, 0], 'releaseActuator');
    this.actuatorPiston = this.clutchRing(0.27, 0.2, 1, 'steel', this.releaseActuator, [0, 0, 0], 'releaseActuator');
    this.ring(0.365, 0.025, 'dark', this.releaseActuator, [-0.13, 0, 0], 'x', 'releaseActuator');
    this.clutchRing(0.35, 0.27, 0.055, 'dark', this.releaseActuator, [-0.13, 0, 0], 'releaseActuator');
    this.cylinder(0.046, 0.12, 'brass', this.releaseActuator, [0.03, 0.44, 0], 'y', 'releaseActuator');
    this.pipe(this.curve([[0.03, 0.47, 0], [0.14, 0.6, -0.15], [0.35, 0.7, -0.22]]), 0.022, 'dark', this.releaseActuator, 'releaseActuator');
    // A fixed input bearing carrier carries the CSC, guide sleeve and feed
    // line. The sliding sleeve never rotates together with the input shaft.
    this.releaseSupport = this.subgroup(this.clutch, [CLUTCH_LAYOUT.actuator, 0, 0], 'releaseActuator');
    this.inputCarrier = this.clutchRing(0.78, 0.15, 0.11, 'block', this.releaseSupport, [0.50, 0, 0], 'releaseActuator');
    this.guideSleeve = this.clutchRing(0.195, 0.15, 1.55, 'steel', this.releaseSupport, [-0.24, 0, 0], 'releaseActuator');
    this.clutchRing(0.43, 0.195, 0.08, 'intake', this.releaseSupport, [0.48, 0, 0], 'releaseActuator');
    this.clutchRing(0.265, 0.145, 0.10, 'steel', this.releaseSupport, [0.54, 0, 0], 'inputShaft');
    this.actuatorMounts = [];
    for (let n = 0; n < 3; n++) {
      const angle = n * Math.PI * 2 / 3;
      const mount = this.box(0.10, 0.28, 0.10, 'intake', this.releaseSupport, [0.45, Math.cos(angle) * 0.52, Math.sin(angle) * 0.52], 'releaseActuator');
      mount.rotation.x = angle;
      const bolt = this.cylinder(0.04, 0.18, 'steel', this.releaseSupport, [0.50, Math.cos(angle) * 0.61, Math.sin(angle) * 0.61], 'x', 'releaseActuator', 6);
      this.actuatorMounts.push(mount, bolt);
    }
    this.stub = this.cylinder(0.145, 3.2, 'brass', this.clutch, [1.65, 0, 0], 'x', 'inputShaft');
    this.inputSplines = this.subgroup(this.clutch, [0, 0, 0], 'discHub');
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      const spline = this.box(0.48, 0.027, 0.023, 'steel', this.inputSplines, [0.265, Math.cos(a) * 0.148, Math.sin(a) * 0.148], 'discHub');
      spline.rotation.x = a;
      this.clutchRotatingDetails.push({ object: spline, a, rotor: this.inputSplines });
    }
    this.assemblyGuides = this.subgroup(this.clutch);
    this.assemblyGuides.userData.ignorePick = true;
    this.assemblyGuides.visible = false;
    this.guideMaterial = new THREE.LineDashedMaterial({ color: 0x91a7b1, transparent: true, opacity: 0.34, dashSize: 0.12, gapSize: 0.08, depthWrite: false });
    this.ownedMaterials.add(this.guideMaterial);
    const guideGeometry = this.geometry('clutch-assembly-guide', () => new THREE.BufferGeometry().setFromPoints([vec(0, 0, 0), vec(1, 0, 0)]));
    this.guideLines = [-0.7, 0.7].map(y => {
      const line = new THREE.Line(guideGeometry, this.guideMaterial);
      line.position.set(-0.08, y, -1.04);
      line.userData.ignorePick = true;
      line.computeLineDistances();
      this.assemblyGuides.add(line);
      return line;
    });
    const contact = this.material({ color: 0x75efad, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }, true);
    this.contacts = [-0.0488, 0.0488].map(x => this.clutchRing(1.022, 0.70, 0.0018, contact, this.disc, [x, 0, 0], 'friction'));
    this.anchor('1 · Koło zamachowe', this.clutch, [0, 1.45, 0], 'flywheel', ['clutch', 'drive-detail']);
    this.anchor('2 · Tarcza cierna', this.clutch, [0, -1.42, 0], 'friction', ['clutch']).userData.followX = this.disc;
    this.anchor('Sprężyny tłumiące', this.clutch, [0, 0.48, 1.25], 'torsionSprings', ['clutch']).userData.followX = this.disc;
    this.anchor('3 · Docisk', this.clutch, [0, 1.45, 0], 'pressurePlate', ['clutch']).userData.followX = this.pressure;
    this.anchor('4 · Sprężyna talerzowa', this.clutch, [0, -1.42, 0], 'diaphragm', ['clutch']).userData.followX = this.diaphragm;
    this.anchor('5 · Pokrywa i podparcie sprężyny', this.clutch, [0, 1.5, 0], 'clutchCover', ['clutch']).userData.followX = this.cover;
    this.anchor('6 · Łożysko wyciskowe', this.clutch, [0, -1.42, 0], 'releaseBearing', ['clutch']).userData.followX = this.bearing;
    this.anchor('Wysprzęglik hydrauliczny', this.clutch, [0, 0.95, 0.55], 'releaseActuator', ['clutch']).userData.followX = this.releaseActuator;
    this.anchor('Stała pokrywa skrzyni · tuleja prowadząca', this.clutch, [0, -1.05, 0.30], 'releaseActuator', ['clutch']).userData.followX = this.releaseSupport;
    this.anchor('Sprzęgło', this.clutch, [0.7, 1.7, 0], 'clutch', ['drive', 'drive-detail']);
  }

  clutchRing(outer, inner, thickness, material, parent, position, part) {
    const mesh = this.annulus(outer, inner, thickness, material, parent, position, part);
    const sectionGeometry = this.geometry(`clutch-section:${outer}:${inner}:${thickness}`, () => {
      const vertices = [], indices = [], count = 64;
      // Remove the near-side upper sector, leaving an actual radial section
      // through both friction faces and the diaphragm/bearing load path.
      for (let i = 0; i <= count; i++) {
        const a = 2.0 + i / count * (Math.PI * 2 - 0.35 - 2.0);
        for (const [x, r] of [[-thickness / 2, outer], [-thickness / 2, inner], [thickness / 2, outer], [thickness / 2, inner]]) vertices.push(x, Math.cos(a) * r, Math.sin(a) * r);
        if (i < count) {
          const j = i * 4, k = j + 4;
          indices.push(j, j + 1, k, j + 1, k + 1, k, j + 2, k + 2, j + 3, j + 3, k + 2, k + 3);
          indices.push(j, k, j + 2, j + 2, k, k + 2, j + 1, j + 3, k + 1, j + 3, k + 3, k + 1);
        }
      }
      indices.push(0, 2, 1, 1, 2, 3);
      const end = count * 4;
      indices.push(end, end + 1, end + 2, end + 1, end + 3, end + 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      flat.computeVertexNormals();
      return flat;
    });
    this.clutchSections.push({ mesh, fullGeometry: mesh.geometry, sectionGeometry, rotor: parent });
    return mesh;
  }

  conicalDiaphragm(parent) {
    const make = (start, end) => {
      const positions = [], indices = [], count = 48;
      for (let n = 0; n <= count; n++) {
        const a = start + (end - start) * n / count;
        for (const [x, radius] of [[-0.018, 0.80], [0.018, 0.80], [-1.018, 0.99], [-0.982, 0.99]]) positions.push(x, Math.cos(a) * radius, Math.sin(a) * radius);
        if (n < count) {
          const i = n * 4, j = i + 4;
          indices.push(i, j, i + 2, i + 2, j, j + 2, i + 1, i + 3, j + 1, i + 3, j + 3, j + 1);
          indices.push(i, i + 1, j, i + 1, j + 1, j, i + 2, j + 2, i + 3, i + 3, j + 2, j + 3);
        }
      }
      indices.push(0, 2, 1, 1, 2, 3);
      const i = count * 4;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
      return flat;
    };
    const fullGeometry = this.geometry('diaphragm-cone:full', () => make(0, Math.PI * 2));
    const sectionGeometry = this.geometry('diaphragm-cone:section', () => make(CLUTCH_SECTION.start, CLUTCH_SECTION.end));
    const mesh = this.mesh(fullGeometry, 'brass', parent, [0, 0, 0], 'diaphragm');
    this.clutchSections.push({ mesh, fullGeometry, sectionGeometry, rotor: parent });
    return mesh;
  }

  // A rectangular strip needs a stable radial/tangential frame. A shortest-arc
  // UP quaternion twists its wide corners differently around the shaft.
  betweenRadial(mesh, from, to, angle, widthIsRadial = false) {
    const y = to.clone().sub(from).normalize();
    const z = widthIsRadial ? vec(0, Math.cos(angle), Math.sin(angle)) : vec(0, -Math.sin(angle), Math.cos(angle));
    const x = y.clone().cross(z).normalize();
    z.copy(x).cross(y).normalize();
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.y = from.distanceTo(to);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  }

  sectionClutchDetail(mesh, rotor, cutaway) {
    let data = mesh.userData.clutchSection;
    if (!data && !cutaway) { mesh.visible = true; mesh.userData.sectionVisible = true; return; }
    if (!data) {
      const full = mesh.geometry;
      const capacity = (full.index?.count ?? full.attributes.position.count) * 5;
      const clipped = new THREE.BufferGeometry();
      clipped.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
      clipped.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage));
      this.geometries.add(clipped);
      const chain = [];
      for (let object = mesh; object !== rotor; object = object.parent) chain.push(object);
      data = mesh.userData.clutchSection = {
        full, clipped, phase: NaN, visible: true, chain,
        poses: new Float64Array(chain.length * 10).fill(NaN), relative: new THREE.Matrix4(),
        planes: [new Float64Array(4), new Float64Array(4)], ranges: [new Float64Array(2), new Float64Array(2)],
        classes: new Uint8Array(full.attributes.position.count)
      };
      // A changing boundary mesh uses its original envelope for culling.
      full.computeBoundingSphere(); full.computeBoundingBox(); clipped.boundingSphere = full.boundingSphere.clone();
      data.center = full.boundingBox.getCenter(vec(0, 0, 0));
      data.half = full.boundingBox.getSize(vec(0, 0, 0)).multiplyScalar(0.5);
    }
    if (!cutaway) { mesh.geometry = data.full; mesh.visible = true; mesh.userData.sectionVisible = true; return; }
    let poseChanged = false;
    for (let n = 0; n < data.chain.length; n++) {
      const object = data.chain[n];
      if (!samePose(object, data.poses, n * 10)) {
        rememberPose(object, data.poses, n * 10); object.updateMatrix(); poseChanged = true;
      }
    }
    const phase = rotor.rotation.x;
    if (data.phase === phase && !poseChanged) {
      mesh.geometry = data.selected ?? data.full; mesh.visible = data.visible; mesh.userData.sectionVisible = data.visible;
      return;
    }
    data.phase = phase;
    if (poseChanged) {
      data.relative.copy(mesh.matrix);
      for (let n = 1; n < data.chain.length; n++) data.relative.premultiply(data.chain[n].matrix);
    }
    let rotorPlanes = this.clutchRotorPlanes.get(rotor);
    if (!rotorPlanes) { rotorPlanes = { phase: NaN, normals: new Float64Array(4) }; this.clutchRotorPlanes.set(rotor, rotorPlanes); }
    if (rotorPlanes.phase !== phase) {
      rotorPlanes.phase = phase;
      const c = Math.cos(phase), s = Math.sin(phase);
      for (let n = 0; n < 2; n++) {
        const angle = n ? CLUTCH_SECTION.end : CLUTCH_SECTION.start;
        const ny = (n ? 1 : -1) * Math.sin(angle), nz = (n ? -1 : 1) * Math.cos(angle);
        rotorPlanes.normals[n * 2] = ny * c + nz * s;
        rotorPlanes.normals[n * 2 + 1] = -ny * s + nz * c;
      }
    }
    const elements = data.relative.elements, planes = data.planes;
    for (let n = 0; n < 2; n++) {
      const ny = rotorPlanes.normals[n * 2], nz = rotorPlanes.normals[n * 2 + 1], plane = planes[n];
      plane[0] = ny * elements[1] + nz * elements[2]; plane[1] = ny * elements[5] + nz * elements[6];
      plane[2] = ny * elements[9] + nz * elements[10]; plane[3] = ny * elements[13] + nz * elements[14];
    }
    const distance = (point, plane) => point[0] * plane[0] + point[1] * plane[1] + point[2] * plane[2] + plane[3];
    const source = data.full.attributes.position, normals = data.full.attributes.normal, indices = data.full.index;
    const center = data.center, half = data.half, ranges = data.ranges;
    for (let n = 0; n < 2; n++) {
      const plane = planes[n];
      const middle = center.x * plane[0] + center.y * plane[1] + center.z * plane[2] + plane[3];
      const radius = Math.abs(plane[0]) * half.x + Math.abs(plane[1]) * half.y + Math.abs(plane[2]) * half.z;
      ranges[n][0] = middle - radius; ranges[n][1] = middle + radius;
    }
    if (ranges[0][0] >= -1e-8 || ranges[1][0] >= -1e-8) { data.selected = mesh.geometry = data.full; data.visible = mesh.visible = true; mesh.userData.sectionVisible = true; return; }
    if (ranges[0][1] < 0 && ranges[1][1] < 0) { data.visible = mesh.visible = false; mesh.userData.sectionVisible = false; return; }
    let inside = 0, outside = 0;
    for (let n = 0; n < source.count; n++) {
      const x = source.getX(n), y = source.getY(n), z = source.getZ(n);
      const first = x * planes[0][0] + y * planes[0][1] + z * planes[0][2] + planes[0][3];
      const second = x * planes[1][0] + y * planes[1][1] + z * planes[1][2] + planes[1][3];
      const bits = data.classes[n] = (first >= 0 ? 1 : 0) | (second >= 0 ? 2 : 0);
      if (bits) inside++;
      else outside++;
    }
    if (!outside) { data.selected = mesh.geometry = data.full; data.visible = mesh.visible = true; mesh.userData.sectionVisible = true; return; }
    if (!inside) { data.visible = mesh.visible = false; mesh.userData.sectionVisible = false; return; }
    const clip = (polygon, plane, sign = 1) => {
      const result = [];
      polygon.forEach((point, n) => {
        const next = polygon[(n + 1) % polygon.length];
        const a = distance(point, plane) * sign, b = distance(next, plane) * sign;
        if (a >= 0) result.push(point);
        if ((a >= 0) !== (b >= 0)) {
          const t = a / (a - b);
          result.push(point.map((value, i) => value + (next[i] - value) * t));
        }
      });
      return result;
    };
    const positions = data.clipped.attributes.position.array, outNormals = data.clipped.attributes.normal.array;
    let count = 0;
    const write = point => {
      const i = count++ * 3;
      positions[i] = point[0]; positions[i + 1] = point[1]; positions[i + 2] = point[2];
      outNormals[i] = point[3]; outNormals[i + 1] = point[4]; outNormals[i + 2] = point[5];
    };
    const emit = polygon => {
      for (let n = 1; n + 1 < polygon.length; n++) { write(polygon[0]); write(polygon[n]); write(polygon[n + 1]); }
    };
    const length = indices?.count ?? source.count;
    const pointAt = i => [source.getX(i), source.getY(i), source.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)];
    if (data.full.type === 'BoxGeometry') {
      const faces = Array.from({ length: 6 }, (_, n) => [0, 2, 3, 1].map(offset => pointAt(n * 4 + offset)));
      const clipSolid = (input, plane, sign = 1) => {
        const faces = [], intersections = [];
        input.forEach(face => {
          const clipped = clip(face, plane, sign);
          if (clipped.length >= 3) faces.push(clipped);
          clipped.forEach(point => {
            if (Math.abs(distance(point, plane)) < 1e-7 && !intersections.some(other => point.slice(0, 3).every((value, i) => Math.abs(value - other[i]) < 1e-7))) intersections.push(point);
          });
        });
        if (intersections.length >= 3) {
          const normal = vec(...plane.slice(0, 3)).normalize().multiplyScalar(-sign);
          const u = normal.clone().cross(Math.abs(normal.x) < 0.9 ? vec(1, 0, 0) : vec(0, 1, 0)).normalize(), v = normal.clone().cross(u);
          const center = intersections.reduce((sum, point) => sum.add(vec(...point.slice(0, 3))), vec(0, 0, 0)).multiplyScalar(1 / intersections.length);
          intersections.sort((a, b) => {
            const pa = vec(...a.slice(0, 3)).sub(center), pb = vec(...b.slice(0, 3)).sub(center);
            return Math.atan2(pa.dot(v), pa.dot(u)) - Math.atan2(pb.dot(v), pb.dot(u));
          });
          faces.push(intersections.map(point => [...point.slice(0, 3), ...normal.toArray()]));
        }
        return faces;
      };
      if (ranges[0][1] < 0) clipSolid(faces, planes[1]).forEach(emit);
      else if (ranges[1][1] < 0) clipSolid(faces, planes[0]).forEach(emit);
      else {
        clipSolid(faces, planes[0]).forEach(emit);
        clipSolid(clipSolid(faces, planes[0], -1), planes[1]).forEach(emit);
      }
    } else for (let n = 0; n < length; n += 3) {
      const first = indices ? indices.getX(n) : n, second = indices ? indices.getX(n + 1) : n + 1, third = indices ? indices.getX(n + 2) : n + 2;
      if (data.classes[first] & data.classes[second] & data.classes[third]) {
        for (let corner = 0; corner < 3; corner++) {
          const i = corner === 0 ? first : corner === 1 ? second : third, out = count++ * 3;
          positions[out] = source.getX(i); positions[out + 1] = source.getY(i); positions[out + 2] = source.getZ(i);
          outNormals[out] = normals.getX(i); outNormals[out + 1] = normals.getY(i); outNormals[out + 2] = normals.getZ(i);
        }
        continue;
      }
      if (!(data.classes[first] | data.classes[second] | data.classes[third])) continue;
      const triangle = [0, 1, 2].map(offset => {
        const i = indices ? indices.getX(n + offset) : n + offset;
        return [source.getX(i), source.getY(i), source.getZ(i), normals.getX(i), normals.getY(i), normals.getZ(i)];
      });
      // The retained sector is wider than pi: split its union into disjoint
      // half-plane pieces, so no triangle crosses the removed wedge.
      emit(clip(triangle, planes[0]));
      emit(clip(clip(triangle, planes[0], -1), planes[1]));
    }
    data.clipped.setDrawRange(0, count);
    data.clipped.attributes.position.needsUpdate = data.clipped.attributes.normal.needsUpdate = true;
    data.selected = mesh.geometry = data.clipped; data.visible = mesh.visible = count > 0; mesh.userData.sectionVisible = mesh.visible;
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
    });
    this.selectorSupports = this.subgroup(this.gearbox, [0, 0, 0], 'gearSelector');
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
      const cutGearCone = this.taperedRing(0.38, 0.325, 0.04, 0.16, 'steel', bottom, [0.37, 0, 0], 'synchroCone', true);
      const detailGearRing = this.partialAnnulus(0.68, 0.285, 0.28, 'steel', bottom, 'gearPair');
      const fullGearChildren = bottom.children.filter(child => ![needleBearing, gearCone, cutGearCone, detailGearRing].includes(child));
      const hub = this.gear(36, 0.357, 0.46, 'intake', this.gearbox, [x + 0.84, -1.8, 0], 'synchronizerHub', 0.151);
      const fullHubChildren = [...hub.children];
      const cutHubFace = this.partialAnnulus(0.333, 0.151, 0.46, 'intake', hub, 'synchronizerHub');
      const cutHubTeeth = [];
      for (let n = 0; n < 36; n++) {
        const angle = (n + 0.375) * Math.PI / 18;
        const tooth = this.box(0.46, 0.05, 0.035, 'intake', hub, [0, Math.cos(angle) * 0.357, Math.sin(angle) * 0.357], 'synchronizerHub');
        tooth.rotation.x = angle;
        cutHubTeeth.push({ tooth, angle });
      }
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
      const sleeveRims = [], cutSleeveRims = [];
      for (const side of [-0.12, 0.12]) {
        sleeveRims.push(this.ring(0.503, 0.017, 'steel', sleeve, [side, 0, 0], 'x', 'synchronizerSleeve'));
        const rimGeometry = this.geometry('sleeve-cut-rim', () => {
          const result = new THREE.TorusGeometry(0.503, 0.017, 8, 40, Math.PI * 2 - 1.4);
          result.rotateZ(Math.PI + 0.7);
          result.rotateY(Math.PI / 2);
          return result;
        });
        cutSleeveRims.push(this.mesh(rimGeometry, 'steel', sleeve, [side, 0, 0], 'synchronizerSleeve'));
      }
      const cone = this.subgroup(this.gearbox, [x + 0.49, -1.8, 0], 'synchroCone');
      const ringFace = this.taperedRing(0.42, 0.365, 0.04, 0.16, 'brass', cone, [0, 0, 0], 'synchroCone');
      const cutRingFace = this.taperedRing(0.42, 0.365, 0.04, 0.16, 'brass', cone, [0, 0, 0], 'synchroCone', true);
      const blockerTeeth = this.gear(36, 0.357, 0.07, 'brass', cone, [0.0125, 0, 0], 'synchroCone', 0.31);
      blockerTeeth.children.filter(child => child.isMesh && child.material === this.materials.dark).forEach(child => child.removeFromParent());
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
      const forkGrip = this.pipe(this.curve([[0, -0.2, 0.47], [0, 0.24, 0.47], [0, 0.52, 0], [0, 0.24, -0.47], [0, -0.2, -0.47]]), 0.038, 'exhaust', shiftFork, 'shiftFork');
      const railZ = 1.65 + i * 0.22;
      const forkStem = this.pipe(this.curve([[0, 0.49, 0], [0, 0.78, 0.65], [0, 1.25, railZ]]), 0.042, 'exhaust', shiftFork, 'shiftFork');
      const forkCollar = this.annulus(0.095, 0.045, 0.16, 'exhaust', shiftFork, [0, 1.25, railZ], 'shiftFork');
      const shiftRail = this.subgroup(this.gearbox, [0, -0.55, railZ], 'shiftRail');
      const rail = this.cylinder(0.034, 7.8, 'steel', shiftRail, [3.3, 0, 0], 'x', 'shiftRail');
      const railStub = this.cylinder(0.034, 1.35, 'steel', this.gearbox, [x + 0.675, -0.55, railZ], 'x', 'shiftRail');
      const selectorSlot = this.subgroup(shiftRail, [-0.25, 0, 0], 'gearSelector');
      for (const side of [-1, 1]) this.box(0.06, 0.43, 0.13, 'exhaust', selectorSlot, [side * 0.07, 0, 0], 'gearSelector');
      this.box(0.2, 0.045, 0.13, 'exhaust', selectorSlot, [0, -0.23, 0], 'gearSelector');
      [-0.55, 7.25].forEach(supportX => this.annulus(0.074, 0.037, 0.13, 'block', this.selectorSupports, [supportX, -0.55, railZ], 'shiftRail'));
      const gearMarker = this.box(0.022, 0.13, 0.045, 'white', bottom, [0.151, bottomRadius * 0.8, 0], 'gearPair');
      const shaftMarker = this.box(0.025, 0.15, 0.04, 'fuel', hub, [0.26, 0.28, 0], 'synchronizerHub');
      this.gears.push({ top, bottom, sleeve, hub, fullHubChildren, cutHubFace, cutHubTeeth, sleeveRims, cutSleeveRims, cone, gearCone, cutGearCone, detailGearRing, fullGearChildren, ringFace, cutRingFace, blockerTeeth, syncGlow, dog, shiftFork, forkGrip, forkStem, forkCollar, shiftRail, rail, railStub, railZ, selectorSlot, needleBearing, needleCage, cutFace, sleeveTeeth, keys, gearMarker, shaftMarker, x, ratio, topRadius, bottomRadius });
      this.anchor(`${i + 1} · ${ratio.toFixed(2).replace('.', ',')}:1`, this.gearbox, [x, 1.12, 0], 'gearPair', ['gearbox', 'drive-detail']).userData.gear = i + 1;
      this.anchor('Przesuwka · przesuwa się, obraca z wałem', sleeve, [0.1,-0.65,0.5], 'synchronizerSleeve', ['gearbox']).userData.gear = i + 1;
      this.anchor('Stożek i pierścień · wyrównanie obrotów', cone, [0,-0.4,0.6], 'synchroCone', ['gearbox']).userData.gear = i + 1;
      this.anchor('Piasta · stale połączona z wałem', hub, [0.1,-0.65,-0.55], 'synchronizerHub', ['gearbox']).userData.gear = i + 1;
    }
    this.buildSelector();
    this.detailOutputShaft = this.cylinder(0.14, 1.7, 'brass', this.gearbox, [0, -1.8, 0], 'x', 'outputShaft');
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

  buildSelector() {
    // One rail per gear is an explicit teaching simplification. The driver's
    // lever selects a rail across Z; its lower tip then slides that rail in X.
    this.selector = this.subgroup(this.gearbox, [-0.25, 0.3, 1.87], 'gearSelector');
    this.selectorPivot = this.mesh(this.geometry('selector-pivot', () => new THREE.SphereGeometry(0.12, 16, 12)), 'dark', this.selector, [0, 0, 0], 'gearSelector');
    this.selectorLever = this.cylinder(0.042, 1, 'steel', this.selector, [0, 0, 0], 'y', 'gearSelector');
    this.selectorLower = this.cylinder(0.037, 1, 'steel', this.selector, [0, 0, 0], 'y', 'gearSelector');
    this.selectorKnob = this.mesh(this.geometry('selector-knob', () => new THREE.SphereGeometry(0.13, 16, 12)), 'black', this.selector, [0, 1.3, 0], 'gearSelector');
    this.selectorPin = this.mesh(this.geometry('selector-pin', () => new THREE.SphereGeometry(0.044, 12, 8)), 'brass', this.selector, [0, -1, 0], 'gearSelector');
    this.cylinder(0.045, 1.2, 'steel', this.selectorSupports, [-0.25, 0.3, 2.09], 'z', 'gearSelector');
    this.box(0.1, 0.95, 0.1, 'dark', this.selectorSupports, [-0.25, -0.17, 1.5], 'gearSelector');
    this.box(0.1, 0.95, 0.1, 'dark', this.selectorSupports, [-0.25, -0.17, 2.68], 'gearSelector');
    this.anchor('Dźwignia → wybór wodzika', this.selector, [0.1, 1.55, 0], 'gearSelector', ['gearbox']);
    this.anchor('Wodzik → widełki → tuleja', this.gearbox, [4.7, -0.15, 2.65], 'shiftRail', ['gearbox']);
  }

  taperedRing(front, back, wall, width, material, parent, position, part, cut = false) {
    const geometry = this.geometry(`cone:${front}:${back}:${wall}:${width}:${cut}`, () => {
      const points = [[front, -width / 2], [back, width / 2], [back - wall, width / 2], [front - wall, -width / 2], [front, -width / 2]].map(([r, y]) => new THREE.Vector2(r, y));
      const shape = new THREE.LatheGeometry(points, 48, cut ? 0.7 : 0, cut ? Math.PI * 2 - 1.4 : Math.PI * 2);
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

  setSynchronizerGear(number = 2) {
    this.synchronizerGear = Math.max(1, Math.min(5, Math.round(number) || 2));
    this.applySection();
  }

  applySection() {
    if (this.mode === 'engine') return;
    const context = {
      flywheel: [this.flywheel],
      friction: [this.disc, this.inputSplines, this.stub],
      discHub: [this.disc, this.inputSplines, this.stub],
      pressurePlate: [this.flywheel, this.disc, this.pressure, this.cover, this.pressureStraps, this.diaphragm],
      clutchCover: [this.cover],
      diaphragm: [this.diaphragm, this.pressure, this.cover, this.pressureStraps, this.bearing, this.fork, this.releaseSupport],
      releaseBearing: [this.bearing, this.fork, this.releaseSupport, this.diaphragm, this.stub],
      releaseActuator: [this.releaseActuator, this.releaseSupport, this.bearing, this.stub]
    };
    const selected = context[this.section];
    this.clutch.children.forEach(child => {
      if (this.isolate && selected) child.visible = selected.includes(child);
      else if (child !== this.cover) child.visible = true;
    });
    // Metal attachments remain physical when assembled. In an exploded drawing
    // they would stretch into a cage; dashed guides indicate the assembly axis.
    const separated = ['clutch', 'drive-detail'].includes(this.mode) && this.exploded > 0.001;
    this.pressureStraps.visible &&= !separated;
    this.assemblyGuides.visible = separated && !(this.isolate && selected);
    const match = /^gear([1-5])$/.exec(this.section);
    const detail = this.mode === 'gearbox' && this.section === 'synchronizer';
    this.case.visible = !detail;
    this.topShaft.visible = this.bottomShaft.visible = !detail;
    this.detailOutputShaft.visible = detail;
    this.detailOutputShaft.position.x = this.gears[this.synchronizerGear - 1].x + 0.7;
    this.selector.visible = this.selectorSupports.visible = !detail && !match;
    this.gears.forEach((gear, i) => {
      const visible = detail ? i + 1 === this.synchronizerGear : !match || i + 1 === Number(match[1]);
      for (const part of ['bottom', 'sleeve', 'hub', 'cone', 'dog', 'shiftFork', 'rail']) gear[part].visible = visible;
      gear.top.visible = visible && !detail;
      gear.shiftRail.visible = visible && !detail && !match;
      gear.railStub.visible = visible && Boolean(match);
      gear.forkStem.visible = gear.forkCollar.visible = !detail;
      gear.fullGearChildren.forEach(child => { child.visible = !detail; });
      gear.fullHubChildren.forEach(child => { child.visible = !detail; });
      gear.cutHubFace.visible = detail;
      gear.cutHubTeeth.forEach(({ tooth, angle }) => { tooth.visible = detail && Math.sin(angle + gear.hub.rotation.x) < 0.75; });
      gear.sleeveRims.forEach(rim => { rim.visible = !detail; });
      gear.cutSleeveRims.forEach(rim => { rim.visible = detail; });
      gear.shaftMarker.visible = !detail;
      gear.gearMarker.visible = !detail;
      gear.detailGearRing.visible = detail;
      gear.gearCone.visible = gear.ringFace.visible = !detail;
      gear.cutGearCone.visible = gear.cutRingFace.visible = detail;
      if (detail) {
        gear.sleeve.userData.face.visible = false;
        gear.cutFace.visible = true;
      }
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
    if (mode === 'selector') return visibleBounds(this.gearbox).expandByScalar(0.2);
    if (mode === 'synchronizer') {
      const gear = this.gears[this.synchronizerGear - 1];
      return visibleBounds(gear.bottom, gear.sleeve, gear.hub, gear.cone, gear.dog, gear.shiftFork, this.detailOutputShaft).expandByScalar(0.12);
    }
    const clutchParts = {
      flywheel: [this.flywheel], friction: [this.disc], discHub: [this.disc],
      pressurePlate: [this.pressure, this.cover, this.pressureStraps],
      clutchCover: [this.cover],
      diaphragm: [this.diaphragm, this.pressure, this.cover, this.pressureStraps, this.bearing, this.fork, this.releaseSupport],
      releaseBearing: [this.bearing, this.fork, this.releaseSupport, this.diaphragm],
      releaseActuator: [this.releaseActuator, this.releaseSupport, this.bearing]
    }[mode];
    if (clutchParts) return clutchParts.reduce((box, part) => box.union(new THREE.Box3().setFromObject(part)), new THREE.Box3()).expandByScalar(0.22);
    const match = /^gear([1-5])$/.exec(mode);
    if (match) {
      const gear = this.gears[Number(match[1]) - 1];
      return visibleBounds(gear.top, gear.bottom, gear.sleeve, gear.hub, gear.cone, gear.dog, gear.shiftFork, gear.railStub).expandByScalar(0.2);
    }
    const local = mode === 'clutch'
      ? new THREE.Box3(vec(-0.3, -1.45, -1.3), vec(2.2 + this.explodedGearboxOffset, 1.55, 1.3))
      : mode === 'gearbox'
        ? new THREE.Box3(vec(3.1, -3.4, -1.5), vec(12.2, 1.4, 2.0))
        : new THREE.Box3(vec(-0.3, -3.4, -1.5), vec(13.4 + (this.mode === 'drive-detail' ? this.explodedGearboxOffset : 0), 1.6, 2.0));
    if (mode === 'gearbox' && this.mode === 'drive-detail') local.translate(vec(this.explodedGearboxOffset, 0, 0));
    const result = local.applyMatrix4(this.group.matrixWorld);
    // Rotating rings, spring fingers and the fork can exceed the nominal envelope.
    // Include their current geometry as well as the next exploded layout above.
    if (mode !== 'gearbox') result.union(new THREE.Box3().setFromObject(this.clutch));
    if (mode !== 'clutch') result.union(new THREE.Box3().setFromObject(this.gearbox));
    return result.expandByScalar(0.05);
  }

  update(sim, cutaway, updateMatrices = true) {
    if (!this.group.visible) return;
    const e = ['clutch', 'drive-detail'].includes(this.mode) ? Math.max(0, Math.min(1, this.exploded)) : 0;
    const clutchCutaway = this.clutch.visible && cutaway && e < 0.001;
    // Disassembly is a static inspection drawing. Once assembled, crank and
    // input phases again come directly from Simulation.
    const a = e > 0.001 ? 0 : sim.angle * Math.PI / 180;
    const inputAngle = e > 0.001 ? 0 : sim.inputAngle;
    this.gearbox.position.x = this.mode === 'drive-detail' ? 3.8 + this.explodedGearboxOffset : 3.8;
    this.flywheel.rotation.x = a;
    const state = manualClutchState(sim.clutch, getEngine(sim.engineId).torque, sim.shiftTarget !== null);
    const relativeOmega = Math.abs(sim.rpm * Math.PI / 30 - sim.inputOmega);
    const displayPower = Math.min(Math.abs(sim.transmittedTorque), state.capacity) * relativeOmega;
    this.clutchState = { ...state, slipPower: displayPower, slipRpm: relativeOmega * 30 / Math.PI };
    this.disc.position.x = CLUTCH_LAYOUT.disc + e * CLUTCH_EXPLOSION.disc + state.discFloat;
    this.contacts.forEach(contact => {
      contact.visible = state.contact && e < 0.001;
      contact.material.opacity = 0.12 + 0.76 * Math.sqrt(state.clampFactor);
      contact.material.color.setHex(displayPower > 80 ? 0xffa24f : 0x75efad);
    });
    this.frictionMaterial.emissiveIntensity = Math.min(0.65, displayPower / 12000);
    this.disc.rotation.x = inputAngle;
    this.inputSplines.rotation.x = inputAngle;
    this.pressure.position.x = CLUTCH_LAYOUT.pressure + e * CLUTCH_EXPLOSION.pressure + state.plateGap;
    this.pressure.rotation.x = a;
    this.cover.position.x = CLUTCH_LAYOUT.cover + e * CLUTCH_EXPLOSION.cover;
    this.cover.rotation.x = a;
    this.diaphragm.position.x = CLUTCH_LAYOUT.diaphragm + e * CLUTCH_EXPLOSION.diaphragm;
    this.diaphragm.rotation.x = a;
    const fingerTip = 0.28 - state.fingerTravel;
    this.bearing.position.x = this.diaphragm.position.x + fingerTip + 0.085 + state.bearingClearance + e * (CLUTCH_EXPLOSION.bearing - CLUTCH_EXPLOSION.diaphragm);
    this.bearing.rotation.x = 0;
    this.bearingRace.rotation.x = state.bearingClearance > 0 ? 0 : a;
    this.bearingRollers.rotation.x = this.bearingRace.rotation.x / 2;
    this.releaseActuator.position.x = CLUTCH_LAYOUT.actuator + e * CLUTCH_EXPLOSION.actuator;
    this.releaseActuator.rotation.x = 0;
    this.releaseSupport.position.x = this.releaseActuator.position.x;
    this.releaseSupport.rotation.x = 0;
    // The inspection drawing separates the cylinder as a component rather than
    // stretching a solid piston across the artificial inter-component gap.
    const pistonFront = e > 0.15 ? this.releaseActuator.position.x - 0.23 : this.bearing.position.x + 0.085;
    const pistonBack = this.releaseActuator.position.x + 0.28;
    this.actuatorPiston.position.x = (pistonFront + pistonBack) / 2 - this.releaseActuator.position.x;
    this.actuatorPiston.scale.x = Math.max(0.025, pistonBack - pistonFront);
    const webStroke = e > 0.001 ? CLUTCH_LAYOUT.diaphragm - CLUTCH_LAYOUT.pressure - 0.06 : this.diaphragm.position.x - this.pressure.position.x - 0.06;
    this.diaphragmWeb.scale.x = webStroke;
    this.fingers.forEach(({ finger, a }) => {
      const pivot = vec(0, Math.cos(a) * 0.78, Math.sin(a) * 0.78);
      this.betweenRadial(finger, pivot, vec(fingerTip, Math.cos(a) * 0.22, Math.sin(a) * 0.22), a);
    });
    this.pressureStraps.rotation.x = a;
    this.straps.forEach(({ angle, segments }) => {
      const from = vec(this.pressure.position.x + 0.045, Math.cos(angle) * 1.04, Math.sin(angle) * 1.04);
      const to = vec(this.cover.position.x - 0.05, Math.cos(angle + 0.3) * 1.17, Math.sin(angle + 0.3) * 1.17);
      const bend = vec(0, -Math.sin(angle) * state.pedal * 0.12, Math.cos(angle) * state.pedal * 0.12);
      const points = [from, from.clone().lerp(to, 1 / 3).add(bend), from.clone().lerp(to, 2 / 3).add(bend), to];
      segments.forEach((segment, n) => {
        this.betweenRadial(segment, points[n], points[n + 1], angle, true);
        this.sectionClutchDetail(segment, this.pressureStraps, clutchCutaway);
      });
    });
    this.clutchSections.forEach(({ mesh, fullGeometry, sectionGeometry, rotor }) => {
      mesh.geometry = clutchCutaway ? sectionGeometry : fullGeometry;
      mesh.rotation.x = clutchCutaway ? -rotor.rotation.x : 0;
    });
    this.clutchRotatingDetails.forEach(({ object, rotor }) => this.sectionClutchDetail(object, rotor, clutchCutaway));
    this.cover.visible = this.mode !== 'engine' && (!cutaway || ['clutch', 'drive-detail'].includes(this.mode));
    // In the clutch bench the gearbox is hidden; stop beyond the release bearing.
    // In a complete detailed drive the same shaft reaches the gearbox input.
    const shaftEnd = this.mode === 'clutch' ? this.releaseActuator.position.x + 0.6 : this.gearbox.position.x - 0.5;
    const shaftLength = Math.max(1.45, shaftEnd - 0.1);
    this.stub.scale.y = shaftLength / 3.2;
    this.stub.position.x = shaftLength / 2 + 0.1;
    this.inputSplines.position.x = e * CLUTCH_EXPLOSION.disc;
    const guideLength = this.releaseActuator.position.x + 0.4;
    this.guideLines.forEach(line => { line.scale.x = guideLength; });
    this.guideMaterial.dashSize = 0.12 / guideLength;
    this.guideMaterial.gapSize = 0.08 / guideLength;
    this.caseFront.visible = !cutaway;
    if (this.gearbox.visible) {
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
      gear.shiftRail.position.x = -engagement * 0.35;
      gear.railStub.position.x = gear.x + 0.675 - engagement * 0.35;
      const sleeveMaterial = active ? this.materials.fuel : sim.shiftTarget === i + 1 ? this.materials.brass : this.materials.steel;
      gear.sleeve.userData.face.material = sleeveMaterial;
      gear.cutFace.material = sleeveMaterial;
      const detail = this.mode === 'gearbox' && this.section === 'synchronizer';
      // Keep the drawing's opening toward local +Z while real spline teeth,
      // needle rollers and dog teeth continue to follow their shaft phases.
      gear.cutFace.rotation.x = -gear.sleeve.rotation.x;
      gear.cutHubFace.rotation.x = -gear.hub.rotation.x;
      gear.cutSleeveRims.forEach(rim => { rim.rotation.x = -gear.sleeve.rotation.x; });
      gear.cutGearCone.rotation.x = -gear.bottom.rotation.x;
      gear.detailGearRing.rotation.x = -gear.bottom.rotation.x;
      gear.cutRingFace.rotation.x = -gear.cone.rotation.x;
      gear.sleeve.userData.face.visible = !cutaway && !detail;
      gear.cutFace.visible = cutaway || detail;
      gear.sleeveTeeth.forEach(({ tooth, angle }) => { tooth.visible = !(cutaway || detail) || Math.sin(angle - sim.outputAngle) < 0.75; tooth.material = sleeveMaterial; });
      gear.bottom.userData.lockedToShaft = active;
      gear.bottom.userData.rpm = sim.inputOmega / gear.ratio * 30 / Math.PI;
      gear.hub.userData.rpm = sim.outputOmega * 30 / Math.PI;
    });
    let selectorGear = sim.shiftTarget || sim.gear || this.synchronizerGear;
    if (sim.shiftTarget !== null && sim.shiftStage === 'release' && sim.shiftFrom) selectorGear = sim.shiftFrom;
    const selectedRail = this.gears[selectorGear - 1] || this.gears[1];
    const selectorTravel = selectedRail.engagement * 0.35;
    const pivotHeight = Math.sqrt(1 - selectorTravel ** 2);
    this.selector.position.z = selectedRail.railZ;
    this.between(this.selectorLower, vec(0, 0, 0), vec(-selectorTravel, -pivotHeight, 0));
    this.between(this.selectorLever, vec(0, 0, 0), vec(selectorTravel * 1.3, pivotHeight * 1.3, 0));
    this.selectorKnob.position.set(selectorTravel * 1.3, pivotHeight * 1.3, 0);
    this.selectorPin.position.set(-selectorTravel, -pivotHeight, 0);
    this.selector.userData.gear = selectorGear;
    this.gears.forEach(gear => { gear.rail.material = gear === selectedRail ? this.materials.brass : this.materials.steel; });
    this.topShaft.rotation.x = sim.inputAngle;
    this.bottomShaft.rotation.x = -sim.outputAngle;
    this.wheel.rotation.x = -sim.outputAngle / 3.9;
    }
    this.stub.rotation.x = inputAngle;
    this.flow.visible = this.showFlow && e < 0.001 && ['drive', 'drive-detail', 'clutch', 'gearbox'].includes(this.mode) && Math.abs(sim.transmittedTorque) > 0.2 && state.contact && sim.shiftTarget === null && (this.mode !== 'gearbox' || sim.gear !== 0);
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
    if (updateMatrices) this.group.updateMatrixWorld(true);
  }
}
