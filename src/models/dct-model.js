import * as THREE from 'three';
import { DCT_RATIOS } from '../powertrain.js';
import { ModelGeometry, vec } from './geometry.js';
import { makeFlow, updateFlow } from './flow-path.js';

const PAIRS = [[20, 72], [30, 66], [25, 38], [40, 46], [50, 45], [50, 37]];
const GEAR_X = [6.9, 2.4, 8.4, 3.9, 9.9, 5.4];
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };

export class DctModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'dct';
    this.exploded = 0;
    this.clock = 0;
    this.section = 'all';
    this.isolate = false;
    this.showFlow = true;
    this.packs = [];
    this.paths = [];
    this.clutches = this.subgroup(this.group, [0, 0, 0], 'dctClutches');
    this.gearbox = this.subgroup(this.group, [0, 0, 0], 'dctGearbox');
    this.control = this.subgroup(this.group, [0, 0, 0], 'mechatronics');
    this.structure = this.subgroup(this.gearbox);
    this.selector = this.subgroup(this.gearbox, [0, 0, 0], 'dctSelector');
    this.buildClutches();
    this.buildGearbox();
    this.buildHydraulics();
    this.housing = this.box(12.7, 7.2, 3.3, this.material({ color: 0x77909c, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }), this.group, [6, -0.35, 0], 'dct');
    this.anchor('K1 wewnątrz rurowego K2', this.gearbox, [4.5, 0.65, 0.3], 'dctShafts', ['gearbox']);
    this.anchor('Siłownik → wodzik → widełki → tuleja', this.selector, [7.8, 3.05, 0.6], 'dctSelector', ['gearbox']);
    this.anchor('Wspólne wyjście do napędu', this.finalOutput, [0, 1.45, 0], 'outputShaft', ['gearbox']);
    this.anchor('Mechatronika · zawory i olej', this.control, [4.1, -3.5, 0], 'mechatronics', ['gearbox', 'drive-detail']);
    this.anchor('DCT · dwie gałęzie napędu', this.group, [5, 3.5, 0], 'dct', ['drive', 'drive-detail']);
  }

  buildClutches() {
    this.flywheel = this.gear(84, 1.45, 0.18, 'dark', this.clutches, [-0.3, 0, 0], 'flywheel');
    this.inputBasket = this.subgroup(this.clutches, [0, 0, 0], 'dctClutches');
    // An open basket makes its mechanical connection visible around both packs.
    this.annulus(1.44, 0.13, 0.07, 'steel', this.inputBasket, [-0.19, 0, 0], 'dctClutches');
    this.basketRibs = [];
    for (let n = 0; n < 8; n++) {
      const angle = n * Math.PI / 4;
      const rib = this.box(1, 0.055, 0.09, 'steel', this.inputBasket, [0, Math.cos(angle) * 1.415, Math.sin(angle) * 1.415], 'dctClutches');
      rib.rotation.x = angle;
      this.basketRibs.push(rib);
    }
    for (let branch = 0; branch < 2; branch++) {
      const part = branch ? 'k2' : 'k1';
      const pack = this.subgroup(this.clutches, [0, 0, 0], part);
      const outer = branch ? 0.83 : 1.35;
      const inner = branch ? 0.31 : 0.9;
      const base = branch ? 1.22 : 0.1;
      const color = branch ? 'exhaust' : 'intake';
      const plates = [];
      for (let n = 0; n < 9; n++) {
        const plate = this.annulus(n % 2 ? outer - 0.055 : outer, n % 2 ? inner : inner + 0.06, 0.042, n % 2 ? color : 'steel', pack, [base + n * 0.042, 0, 0], part);
        plate.userData.owner = n % 2 ? part : 'engine';
        plates.push(plate);
        for (let lug = 0; lug < 10; lug++) {
          const angle = lug * Math.PI / 5;
          const radius = n % 2 ? inner : outer;
          const tab = this.box(0.042, 0.045, 0.07, n % 2 ? color : 'steel', plate, [0, Math.cos(angle) * radius, Math.sin(angle) * radius]);
          tab.rotation.x = angle;
        }
      }
      const piston = this.annulus(outer + 0.02, inner, 0.09, color, pack, [base + 0.55, 0, 0], 'dctPiston');
      const hub = this.subgroup(pack, [0, 0, 0], part);
      const web = this.annulus(inner + 0.045, branch ? 0.235 : 0.115, 0.045, color, hub, [base + 0.83, 0, 0], part);
      const carrierRibs = [];
      for (let n = 0; n < 10; n++) {
        const angle = n * Math.PI / 5;
        const rib = this.box(1, 0.025, 0.045, color, hub, [0, Math.cos(angle) * (inner + 0.008), Math.sin(angle) * (inner + 0.008)], part);
        rib.rotation.x = angle;
        carrierRibs.push(rib);
      }
      const inputCarrier = this.subgroup(pack, [0, 0, 0], part);
      const inputWeb = this.annulus(1.44, outer + 0.012, 0.045, 'steel', inputCarrier, [base - 0.1, 0, 0], part);
      const inputRibs = [];
      for (let n = 0; n < 10; n++) {
        const angle = n * Math.PI / 5;
        const rib = this.box(1, 0.025, 0.05, 'steel', inputCarrier, [0, Math.cos(angle) * (outer + 0.008), Math.sin(angle) * (outer + 0.008)], part);
        rib.rotation.x = angle;
        inputRibs.push(rib);
      }
      this.packs.push({ pack, plates, piston, hub, web, carrierRibs, inputCarrier, inputWeb, inputRibs, outer, inner, base });
      this.anchor(branch ? 'K2 · parzyste 2 / 4 / 6' : 'K1 · nieparzyste 1 / 3 / 5', pack, [base + 0.3, branch ? -1.35 : 1.8, 0], part, ['clutch', 'gearbox', 'drive-detail']);
    }
    // Clutch inspection tails continue on the same axes as the gearbox shafts.
    this.clutchInnerTail = this.cylinder(0.12, 1, 'intake', this.clutches, [0, 0, 0], 'x', 'dctShafts');
    this.clutchOuterTail = this.annulus(0.25, 0.16, 1, 'exhaust', this.clutches, [0, 0, 0], 'dctShafts');
  }

  buildGearbox() {
    this.innerShaft = this.cylinder(0.12, 10.95, 'intake', this.gearbox, [5.325, 0, 0], 'x', 'dctShafts');
    this.outerShaftMaterial = this.material({ color: this.materials.exhaust.color, metalness: 0.65, roughness: 0.34, transparent: true, opacity: 0.4, depthWrite: false });
    this.outerShaft = this.annulus(0.25, 0.16, 3.935, this.outerShaftMaterial, this.gearbox, [3.9825, 0, 0], 'dctShafts');
    this.outputShafts = [1.8, -1.8].map(y => this.cylinder(0.12, 11.5, 'steel', this.gearbox, [6.2, y, 0], 'x', 'outputShaft'));
    this.gears = [];
    for (let gear = 1; gear <= 6; gear++) {
      const x = GEAR_X[gear - 1];
      const ratio = DCT_RATIOS[gear];
      const branch = gear % 2 ? 0 : 1;
      const y = gear <= 4 ? 1.8 : -1.8;
      const radius = 1.8 / (1 + ratio);
      const pair = this.subgroup(this.gearbox);
      const input = this.gear(PAIRS[gear - 1][0], radius, 0.26, branch ? 'exhaust' : 'intake', pair, [x, 0, 0], 'dctGearPair', branch ? 0.255 : 0.125);
      const output = this.gear(PAIRS[gear - 1][1], 1.8 - radius, 0.26, 'steel', pair, [x, y, 0], 'dctGearPair', 0.18);
      this.annulus(0.18, 0.125, 0.3, 'dark', output, [0, 0, 0], 'bearing');
      const hub = this.gear(20, 0.26, 0.26, 'dark', pair, [x + 0.53, y, 0], 'synchronizer', 0.125);
      const sleeve = this.annulus(0.36, 0.27, 0.24, 'brass', pair, [x + 0.53, y, 0], 'synchronizer');
      const dog = this.gear(20, 0.26, 0.08, 'brass', pair, [x + 0.22, y, 0], 'synchronizer', 0.18);
      const fork = this.subgroup(this.selector, [x + 0.53, y, 0], 'shiftFork');
      const sign = Math.sign(y);
      this.pipe(this.curve([[0, -0.26 * sign, 0.2], [0, 0, 0.39], [0, 0.26 * sign, 0.2], [0, 0.57 * sign, 0.48]]), 0.04, 'exhaust', fork, 'shiftFork');
      const railY = y + sign * 0.58;
      this.cylinder(0.055, 0.95, 'steel', fork, [0.38, sign * 0.58, 0.48], 'x', 'dctSelector');
      const actuator = this.annulus(0.14, 0.06, 0.62, 'block', this.selector, [x + 1.00, railY, 0.48], 'dctSelector');
      this.cylinder(0.135, 0.035, 'exhaust', this.selector, [x + 1.33, railY, 0.48], 'x', 'dctSelector');
      const piston = this.cylinder(0.105, 0.035, 'brass', this.selector, [x + 1.09, railY, 0.48], 'x', 'dctSelector');
      const sync = this.annulus(0.39, 0.35, 0.03, this.material({ color: 0xffa757, toneMapped: false }, true), pair, [x + 0.28, y, 0], 'synchroCone');
      this.gears.push({ gear, branch, x, y, pair, input, output, hub, sleeve, dog, fork, actuator, piston, railY, sync });
      const route = makeFlow(this, [[1.05, 0, 0.65], [x - 0.4, 0, 0.65], [x, y, 0.65], [11.6, y, 0.65], [11.6, 0, 0.65], [12.85, 0, 0.65]], branch ? 0xee9477 : 0x61d0f2, pair, 'dctGearPair', 7, 0.018);
      this.paths.push({ path: route, gear, branch });
      const anchor = this.anchor(`${gear} · ${branch ? 'K2' : 'K1'} · ${ratio.toFixed(2)}:1`, output, [0, sign * 0.95, 0.2], 'dctGearPair', ['gearbox', 'drive-detail']);
      anchor.userData.gear = gear;
    }
    this.outputGears = [];
    for (const y of [-1.8, 1.8]) {
      this.outputGears.push(this.gear(30, 0.9, 0.25, 'brass', this.gearbox, [11.6, y, 0], 'outputShaft'));
      for (const x of [1.3, 11]) this.annulus(0.25, 0.14, 0.15, 'block', this.structure, [x, y, 0], 'bearing');
    }
    this.finalOutput = this.gear(30, 0.9, 0.25, 'steel', this.gearbox, [11.6, 0, 0], 'outputShaft');
    this.outputStub = this.cylinder(0.13, 1.5, 'brass', this.gearbox, [12.1, 0, 0], 'x', 'outputShaft');
    for (const z of [-1.22, 1.22]) this.box(11.8, 0.1, 0.1, 'block', this.structure, [6.05, -2.65, z], 'dct');
    for (const x of [1.3, 11]) {
      this.box(0.12, 4.8, 0.12, 'block', this.structure, [x, 0, -1.22], 'dct');
      for (const y of [-1.8, 1.8]) this.box(0.12, 0.12, 1.1, 'block', this.structure, [x, y, -0.65], 'bearing');
    }
  }

  buildHydraulics() {
    this.sump = this.box(9.8, 0.16, 2.4, 'dark', this.control, [6.0, -2.79, 0], 'dctOil');
    this.box(3.8, 0.5, 1.15, 'block', this.control, [4, -3.07, 0], 'mechatronics');
    for (let n = 0; n < 6; n++) {
      this.cylinder(0.11, 0.35, n % 2 ? 'exhaust' : 'intake', this.control, [2.5 + n * 0.58, -2.88, 0.6], 'y', 'mechatronics');
      this.box(0.19, 0.12, 0.22, 'black', this.control, [2.5 + n * 0.58, -2.65, 0.6], 'mechatronics');
    }
    this.pump = this.gear(12, 0.22, 0.12, 'brass', this.control, [7.2, -3.04, 0], 'dctOil');
    this.idler = this.gear(12, 0.22, 0.12, 'steel', this.control, [7.2, -3.48, 0], 'dctOil');
    this.box(0.8, 0.73, 0.65, this.material({ color: 0x627985, transparent: true, opacity: 0.24, depthWrite: false }), this.control, [7.2, -3.26, 0], 'dctOil');
    this.cylinder(0.22, 0.6, 'dark', this.control, [8.2, -3.06, 0], 'x', 'dctOil');
    this.box(1.1, 0.58, 0.6, 'intake', this.control, [9.55, -3.08, 0], 'dctOil');
    for (let n = 0; n < 6; n++) this.box(0.025, 0.56, 0.64, 'steel', this.control, [9.22 + n * 0.13, -3.08, 0], 'dctOil');
    this.pipe(this.curve([[4.3, -3.1, 0.65], [6.2, -3.1, 0.65], [7.2, -3.1, 0.25], [8.2, -3.05, 0.25], [9.5, -3.05, 0.25]]), 0.04, 'brass', this.control, 'dctOil');
    this.hydraulicLines = [];
    this.gears.forEach(({ gear, x, railY }) => {
      const pipe = this.pipe(this.curve([[4.1, -3.05, -0.7], [x + 1.1, -2.65, -0.7], [x + 1.1, railY, -0.7], [x + 1.1, railY, 0.48]]), 0.022, 'brass', this.selector, 'dctSelector');
      this.hydraulicLines.push({ pipe, gear });
    });
    for (let branch = 0; branch < 2; branch++) {
      const path = makeFlow(this, [[3.3, -3.1, 0.85], [0.7 + branch * 1.15, -2.65, 0.85], [0.7 + branch * 1.15, -0.8, 0.2]], 0x76d5ac, this.control, 'dctOil', 3, 0.018);
      this.paths.push({ path, branch, oil: true });
    }
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    this.isolate = isolate;
    this.applySection();
  }

  applySection() {
    const section = this.section;
    const isolate = this.isolate;
    const clutchOnly = ['clutch', 'dctClutches', 'k1', 'k2'].includes(section);
    const branchOnly = section === 'dctOdd' ? 0 : section === 'dctEven' ? 1 : -1;
    this.clutches.visible = !isolate || section === 'all' || clutchOnly || branchOnly >= 0;
    this.gearbox.visible = !isolate || section === 'all' || ['gearbox', 'dctGearbox', 'dctShafts', 'dctSelector'].includes(section) || branchOnly >= 0;
    this.control.visible = !isolate || ['all', 'mechatronics', 'dctOil', 'dctSelector'].includes(section);
    this.selector.visible = !isolate || ['all', 'gearbox', 'dctGearbox', 'dctSelector'].includes(section);
    this.structure.visible = !isolate || ['all', 'gearbox', 'dctGearbox', 'dctSelector'].includes(section);
    this.packs.forEach(({ pack }, branch) => {
      pack.visible = !isolate || !['k1', 'k2', 'dctOdd', 'dctEven'].includes(section) || (section === 'k1' || section === 'dctOdd' ? branch === 0 : branch === 1);
    });
    this.gears.forEach(({ pair, fork, actuator, piston, branch }) => {
      pair.visible = !isolate || section !== 'dctShafts' && (branchOnly < 0 || branchOnly === branch);
      for (const object of [fork, actuator, piston]) object.visible = !isolate || branchOnly < 0 || branchOnly === branch;
    });
    this.clutchInnerTail.visible = this.clutchOuterTail.visible = this.clutches.visible && !this.gearbox.visible;
    this.outputShafts.forEach(shaft => { shaft.visible = section !== 'dctShafts' || !isolate; });
    this.outputGears.forEach(gear => { gear.visible = section !== 'dctShafts' || !isolate; });
    this.finalOutput.visible = this.outputStub.visible = section !== 'dctShafts' || !isolate;
  }

  bounds(section = this.section) {
    this.group.updateMatrixWorld(true);
    const selected = ['clutch', 'dctClutches', 'k1', 'k2'].includes(section) ? [this.clutches]
      : section === 'dctShafts' ? [this.innerShaft, this.outerShaft]
        : ['mechatronics', 'dctOil'].includes(section) ? [this.control]
          : [this.clutches, this.gearbox, this.control];
    const box = new THREE.Box3();
    selected.forEach(group => group.traverseVisible(object => {
      if (!object.isMesh || object.isInstancedMesh || object.userData.ignorePick) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
    }));
    if (this.housing.visible && section === 'all') {
      if (!this.housing.geometry.boundingBox) this.housing.geometry.computeBoundingBox();
      box.union(this.housing.geometry.boundingBox.clone().applyMatrix4(this.housing.matrixWorld));
    }
    return box.isEmpty() ? new THREE.Box3(vec(-0.6, -3.8, -1.7), vec(13, 3, 1.7)).applyMatrix4(this.group.matrixWorld) : box.expandByScalar(0.14);
  }

  selectorTravel(sim, gear, selected) {
    if (sim.shiftTarget !== null && sim.shiftFrom && sim.shiftTarget && sim.shiftFrom % 2 === sim.shiftTarget % 2) {
      if (gear === sim.shiftFrom) return 0.24 * (1 - smooth(sim.shiftProgress / 0.3));
      if (gear === sim.shiftTarget) return 0.24 * smooth((sim.shiftProgress - 0.5) / 0.15);
    }
    return selected ? 0.24 : 0;
  }

  update(sim, cutaway, dt = 0) {
    if (!this.group.visible) return;
    if (!sim.paused) this.clock += dt;
    const state = sim.dct;
    const engineAngle = sim.angle * Math.PI / 180;
    const e = ['clutch', 'dctClutches', 'k1', 'k2'].includes(this.section) ? clamp(this.exploded) : 0;
    this.flywheel.rotation.x = this.inputBasket.rotation.x = engineAngle;
    this.innerShaft.rotation.x = state.angles[0];
    this.outerShaft.rotation.x = state.angles[1];
    this.outerShaftMaterial.opacity = cutaway || this.section === 'dctShafts' ? 0.32 : 1;
    this.outerShaftMaterial.depthWrite = this.outerShaftMaterial.opacity === 1;
    let basketEnd = 0;
    this.packs.forEach(({ plates, piston, hub, web, carrierRibs, inputCarrier, inputWeb, inputRibs, base }, branch) => {
      const engagement = state.engagement[branch];
      const start = base + branch * e * 1.6;
      const spacing = 0.042 + (1 - engagement) * 0.03 + e * 0.13;
      plates.forEach((plate, i) => {
        plate.position.x = start + i * spacing;
        plate.rotation.x = i % 2 ? state.angles[branch] : engineAngle;
      });
      const last = start + 8 * spacing;
      piston.position.x = last + 0.066 + (1 - engagement) * 0.1;
      web.position.x = Math.max(base + 0.83 + branch * e * 1.6, piston.position.x + 0.17);
      const end = web.position.x;
      carrierRibs.forEach(rib => { rib.position.x = (start + end) / 2; rib.scale.x = end - start; });
      inputRibs.forEach(rib => { rib.position.x = (start - 0.1 + piston.position.x + 0.07) / 2; rib.scale.x = piston.position.x + 0.07 - start + 0.1; });
      if (inputWeb) inputWeb.position.x = start - 0.1;
      hub.rotation.x = state.angles[branch];
      inputCarrier.rotation.x = engineAngle;
      basketEnd = Math.max(basketEnd, piston.position.x + 0.14);
      if (branch === 1) {
        const tailEnd = end + 0.7;
        this.clutchOuterTail.position.x = (end + tailEnd) / 2;
        this.clutchOuterTail.scale.x = tailEnd - end;
        this.clutchOuterTail.rotation.x = state.angles[branch];
        this.clutchInnerTail.position.x = (tailEnd + 0.15) / 2;
        this.clutchInnerTail.scale.y = tailEnd + 0.45;
        this.clutchInnerTail.rotation.x = state.angles[0];
      }
    });
    this.basketRibs.forEach(rib => { rib.position.x = (basketEnd - 0.19) / 2; rib.scale.x = basketEnd + 0.19; });
    const active = state.engagement.indexOf(Math.max(...state.engagement));
    this.mechanismState = {
      activeBranch: state.engagement[active] > 0 ? active : -1,
      activeGear: state.engagement[active] > 0 ? state.selected[active] : 0,
      preparedGear: state.selected[1 - active],
      engagement: [...state.engagement],
      selected: [...state.selected],
      phase: sim.shiftTarget === null ? 'selected' : sim.shiftStage
    };
    this.gears.forEach(({ gear, branch, x, input, output, hub, sleeve, dog, fork, piston, sync }) => {
      const selected = state.selected[branch] === gear;
      const transmitting = selected && Math.abs(state.torques[branch]) > 0.2;
      const travel = this.selectorTravel(sim, gear, selected);
      input.rotation.x = state.angles[branch];
      output.rotation.x = -state.angles[branch] / DCT_RATIOS[gear] + Math.PI / PAIRS[gear - 1][1];
      hub.rotation.x = sleeve.rotation.x = -sim.outputAngle;
      dog.rotation.x = output.rotation.x;
      sleeve.position.x = fork.position.x = x + 0.53 - travel;
      piston.position.x = x + 1.09 - travel;
      output.userData.face.material = transmitting ? this.materials.fuel : selected ? this.materials[branch ? 'exhaust' : 'intake'] : this.materials.steel;
      sync.visible = travel > 0 && travel < 0.235;
      output.userData.connection = selected ? transmitting ? 'transmitting' : 'prepared' : 'free';
    });
    this.outputShafts.forEach(shaft => { shaft.rotation.x = -sim.outputAngle; });
    this.outputGears.forEach(gear => { gear.rotation.x = -sim.outputAngle + Math.PI / 30; });
    this.finalOutput.rotation.x = sim.outputAngle;
    this.pump.rotation.x = engineAngle;
    this.idler.rotation.x = -engineAngle;
    this.housing.visible = !cutaway && this.section === 'all';
    this.paths.forEach(({ path, gear, branch, oil }) => {
      const value = oil ? state.engagement[branch] * 100 : state.selected[branch] === gear ? state.torques[branch] : 0;
      updateFlow(path, value, this.clock, this.showFlow);
      // A prepared branch with an open clutch carries no engine torque.
      if (!oil && Math.abs(value) <= 0.5) path.tube.visible = false;
    });
    this.applySection();
  }
}
