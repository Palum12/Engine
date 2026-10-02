import * as THREE from 'three';
import { DCT_RATIOS } from '../powertrain.js';
import { ModelGeometry, vec } from './geometry.js';
import { makeFlow, updateFlow } from './flow-path.js';

const PAIRS = [[20, 72], [30, 66], [25, 38], [40, 46], [50, 45], [50, 37]];
const GEAR_X = [6.9, 2.4, 8.4, 3.9, 9.9, 5.4];

export class DctModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'dct';
    this.exploded = 0;
    this.clock = 0;
    this.section = 'all';
    this.showFlow = true;
    this.packs = [];
    this.clutches = this.subgroup(this.group, [0, 0, 0], 'dctClutches');
    this.gearbox = this.subgroup(this.group, [0, 0, 0], 'dctGearbox');
    this.control = this.subgroup(this.group, [0, 0, 0], 'mechatronics');
    this.paths = [];
    this.flywheel = this.gear(84, 1.45, 0.18, 'dark', this.clutches, [-0.3, 0, 0], 'flywheel');
    for (let branch = 0; branch < 2; branch++) {
      const pack = this.subgroup(this.clutches, [0, 0, 0], branch ? 'k2' : 'k1');
      const outer = branch ? 0.83 : 1.35;
      const inner = branch ? 0.31 : 0.9;
      const color = branch ? this.materials.exhaust : this.materials.intake;
      const plates = [];
      for (let n = 0; n < 9; n++) {
        const plate = this.annulus(n % 2 ? outer - 0.055 : outer, n % 2 ? inner : inner + 0.06, 0.042, n % 2 ? 'steel' : color, pack, [0.12 + n * 0.042, 0, 0], branch ? 'k2' : 'k1');
        plates.push(plate);
        for (let lug = 0; lug < 10; lug++) {
          const a = lug * Math.PI / 5;
          const r = n % 2 ? inner : outer;
          const tab = this.box(0.042, 0.065, 0.09, n % 2 ? 'steel' : color, plate, [0, Math.cos(a) * r, Math.sin(a) * r]);
          tab.rotation.x = a;
        }
      }
      const piston = this.annulus(outer + 0.02, inner, 0.09, color, pack, [0.85, 0, 0], 'dctPiston');
      const hub = this.subgroup(pack, [0, 0, 0], branch ? 'k2' : 'k1');
      this.annulus(inner + 0.04, inner - 0.015, 0.7, color, hub, [0.4, 0, 0]);
      this.annulus(inner + 0.04, branch ? 0.255 : 0.125, 0.045, color, hub, [branch ? 0.95 : -0.06, 0, 0]);
      const oil = makeFlow(this, [[3.3, -3.1, 0.9], [0.8, -2.6, 0.9], [0.8, -outer - 0.2, 0.2], [0.8, -outer + 0.12, 0]], 0x76d5ac, this.control, 'dctOil', 4);
      this.paths.push({ path: oil, branch, oil: true });
      this.packs.push({ pack, plates, piston, hub, outer, inner });
      this.anchor(branch ? 'K2 · biegi 2 / 4 / 6' : 'K1 · biegi 1 / 3 / 5', pack, [0.5, branch ? -1.1 : 1.8, branch ? 1.1 : 0], branch ? 'k2' : 'k1', ['clutch', 'gearbox', 'drive-detail']);
    }
    this.innerShaft = this.cylinder(0.12, 10.8, 'intake', this.gearbox, [5.4, 0, 0], 'x', 'dctShafts');
    this.outerShaft = this.annulus(0.25, 0.16, 5.0, 'exhaust', this.gearbox, [3.45, 0, 0], 'dctShafts');
    this.outputShafts = [1.8, -1.8].map(y => this.cylinder(0.12, 11.5, 'steel', this.gearbox, [6.2, y, 0], 'x', 'outputShaft'));
    this.gears = [];
    for (let gear = 1; gear <= 6; gear++) {
      const x = GEAR_X[gear - 1];
      const ratio = DCT_RATIOS[gear];
      const branch = gear % 2 ? 0 : 1;
      const y = gear <= 4 ? 1.8 : -1.8;
      const inputRadius = 1.8 / (1 + ratio);
      const input = this.gear(PAIRS[gear - 1][0], inputRadius, 0.26, branch ? 'exhaust' : 'intake', this.gearbox, [x, 0, 0], 'dctGearPair', branch ? 0.255 : 0.125);
      const output = this.gear(PAIRS[gear - 1][1], 1.8 - inputRadius, 0.26, 'steel', this.gearbox, [x, y, 0], 'dctGearPair');
      const hub = this.gear(20, 0.26, 0.26, 'dark', this.gearbox, [x + 0.53, y, 0], 'synchronizer');
      const sleeve = this.annulus(0.36, 0.27, 0.24, 'brass', this.gearbox, [x + 0.53, y, 0], 'synchronizer');
      const dog = this.gear(20, 0.26, 0.08, 'brass', this.gearbox, [x + 0.22, y, 0], 'synchronizer');
      const fork = this.subgroup(this.gearbox, [x + 0.53, y, 0], 'shiftFork');
      this.pipe(this.curve([[0, -0.1, 0.34], [0, 0.34, 0.34], [0, 0.4, 0], [0, 0.34, -0.34]]), 0.035, 'exhaust', fork, 'shiftFork');
      this.box(0.07, 0.65, 0.07, 'exhaust', fork, [0, 0.67, -0.34], 'shiftFork');
      const sync = this.annulus(0.39, 0.35, 0.03, this.material({ color: 0xffa757, toneMapped: false }, true), this.gearbox, [x + 0.28, y, 0], 'synchroCone');
      this.gears.push({ gear, branch, x, y, input, output, hub, sleeve, dog, fork, sync });
      const route = makeFlow(this, [[0.35, branch ? -0.9 : 1.35, 0.8], [1.5, 0, 1.15], [x, 0, 1.15], [x, y, 1.15], [11.5, y, 1.15]], branch ? 0xee9477 : 0x61d0f2, this.gearbox, 'dctGearPair', 9);
      this.paths.push({ path: route, gear, branch });
      this.anchor(`${gear} · ${ratio.toFixed(2)}:1`, output, [0, Math.sign(y) * 1.3, 0.2], 'dctGearPair', ['gearbox', 'drive-detail']);
    }
    this.outputGears = [];
    for (const y of [-1.8, 1.8]) {
      this.outputGears.push(this.gear(30, 0.9, 0.25, 'brass', this.gearbox, [11.6, y, 0], 'outputShaft'));
      for (const x of [1.3, 11]) this.annulus(0.25, 0.14, 0.15, 'block', this.gearbox, [x, y, 0], 'bearing');
    }
    this.finalOutput = this.gear(30, 0.9, 0.25, 'steel', this.gearbox, [11.6, 0, 0], 'outputShaft');
    this.cylinder(0.13, 1.5, 'brass', this.gearbox, [12.1, 0, 0], 'x', 'outputShaft');
    this.box(3.8, 0.65, 1.35, 'block', this.control, [4, -3.15, 0], 'mechatronics');
    for (let n = 0; n < 6; n++) {
      this.cylinder(0.13, 0.5, n % 2 ? 'exhaust' : 'intake', this.control, [2.5 + n * 0.58, -2.78, 0.2], 'y', 'mechatronics');
      this.box(0.23, 0.15, 0.27, 'black', this.control, [2.5 + n * 0.58, -2.48, 0.2], 'mechatronics');
    }
    this.pump = this.gear(12, 0.26, 0.17, 'brass', this.control, [7.2, -3.15, 0], 'dctOil');
    this.idler = this.gear(12, 0.26, 0.17, 'steel', this.control, [7.2, -3.67, 0], 'dctOil');
    this.cylinder(0.25, 0.85, 'dark', this.control, [8.1, -3.2, 0], 'x', 'dctOil');
    this.box(1.1, 0.7, 0.6, 'intake', this.control, [9.4, -3.2, 0], 'dctOil');
    for (let n = 0; n < 7; n++) this.box(0.03, 0.7, 0.68, 'steel', this.control, [9 + n * 0.13, -3.2, 0], 'dctOil');
    this.housing = this.box(12.7, 5.6, 3.3, this.material({ color: 0x77909c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), this.group, [6, -0.5, 0], 'dct');
    this.anchor('Wały współosiowe · wewnętrzny K1 / rurowy K2', this.gearbox, [3.3, 0.6, 1.4], 'dctShafts', ['gearbox']);
    this.anchor('Mechatronika · ciśnienie docisku', this.control, [4, -4, 0], 'mechatronics', ['gearbox', 'drive-detail']);
    this.anchor('Pompa · filtr · chłodnica oleju', this.control, [8.5, -4, 0], 'dctOil', ['gearbox']);
    this.anchor('DCT · dwa sprzęgła, dwie drogi napędu', this.group, [5, 3.5, 0], 'dct', ['drive', 'drive-detail']);
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    this.clutches.visible = !isolate || ['all', 'clutch', 'dctClutches', 'k1', 'k2'].includes(section);
    this.gearbox.visible = !isolate || ['all', 'gearbox', 'dctGearbox', 'dctShafts'].includes(section);
    this.control.visible = !isolate || ['all', 'mechatronics', 'dctOil'].includes(section);
    this.packs.forEach(({ pack }, i) => { pack.visible = !isolate || !['k1', 'k2'].includes(section) || section === (i ? 'k2' : 'k1'); });
  }

  bounds(section = this.section) {
    this.group.updateMatrixWorld(true);
    const box = ['clutch', 'dctClutches', 'k1', 'k2'].includes(section)
      ? new THREE.Box3(vec(-0.6, -1.8, -1.8), vec(2 + this.exploded * 3, 1.8, 1.8))
      : section === 'mechatronics' || section === 'dctOil' ? new THREE.Box3(vec(1.6, -4.1, -1), vec(10.1, -2.3, 1))
        : new THREE.Box3(vec(-0.7, -4.2, -1.8), vec(13, 3.4, 1.8));
    return box.applyMatrix4(this.group.matrixWorld);
  }

  update(sim, cutaway, dt = 0) {
    if (!this.group.visible) return;
    if (!sim.paused) this.clock += dt;
    const state = sim.dct;
    const engineAngle = sim.angle * Math.PI / 180;
    this.flywheel.rotation.x = engineAngle;
    this.innerShaft.rotation.x = state.angles[0];
    this.outerShaft.rotation.x = state.angles[1];
    this.packs.forEach(({ plates, piston, hub }, branch) => {
      const engagement = state.engagement[branch];
      plates.forEach((plate, i) => {
        plate.position.x = 0.12 + i * (0.042 + (1 - engagement) * 0.03 + this.exploded * 0.13);
        plate.rotation.x = i % 2 ? state.angles[branch] : engineAngle;
      });
      piston.position.x = 0.12 + 8 * (0.042 + (1 - engagement) * 0.03 + this.exploded * 0.13) + 0.066 + (1 - engagement) * 0.1;
      hub.rotation.x = state.angles[branch];
    });
    this.gears.forEach(({ gear, branch, x, input, output, hub, sleeve, dog, fork, sync }) => {
      const selected = state.selected[branch] === gear;
      const transmitting = selected && Math.abs(state.torques[branch]) > 0.2;
      input.rotation.x = state.angles[branch];
      output.rotation.x = -state.angles[branch] / DCT_RATIOS[gear] + Math.PI / PAIRS[gear - 1][1];
      hub.rotation.x = sleeve.rotation.x = -sim.outputAngle;
      dog.rotation.x = output.rotation.x;
      sleeve.position.x = x + 0.53 - (selected ? 0.24 : 0);
      fork.position.x = sleeve.position.x;
      output.userData.face.material = transmitting ? this.materials.fuel : selected ? this.materials.intake : this.materials.steel;
      sync.visible = selected && sim.shiftTarget === gear && sim.shiftStage === 'preselect';
    });
    this.outputShafts.forEach(shaft => { shaft.rotation.x = -sim.outputAngle; });
    this.outputGears.forEach(gear => { gear.rotation.x = -sim.outputAngle + Math.PI / 30; });
    this.finalOutput.rotation.x = sim.outputAngle;
    this.pump.rotation.x = engineAngle;
    this.idler.rotation.x = -engineAngle;
    this.housing.visible = !cutaway && this.section === 'all';
    this.paths.forEach(({ path, gear, branch, oil }) => updateFlow(path, oil ? state.engagement[branch] * 100 : state.selected[branch] === gear ? state.torques[branch] : 0, this.clock, this.showFlow));
  }
}
