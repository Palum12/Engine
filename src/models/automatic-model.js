import * as THREE from 'three';
import { AUTOMATIC_PLANETARIES } from '../powertrain.js';
import { ModelGeometry, vec } from './geometry.js';
import { internalGearGeometry } from './mechanical-geometry.js';
import { makeFlow, updateFlow } from './flow-path.js';

// A readable modular planetary demonstration, not a factory AISIN cutaway.
export class AutomaticModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.userData.part = 'automatic';
    this.outputPosition = [8.3, 0, 0];
    this.outputX = 8.3;
    this.outputY = 0;
    this.section = 'all';
    this.exploded = 0;
    this.clock = 0;
    this.showFlow = true;
    this.converter = this.subgroup(this.group, [0, 0, 0], 'converter');
    this.clutches = this.converter;
    this.gearbox = this.subgroup(this.group, [0, 0, 0], 'planetary');
    this.control = this.subgroup(this.group, [0, 0, 0], 'valveBody');
    this.flywheel = this.gear(78, 1.6, 0.12, 'dark', this.converter, [-0.18, 0, 0], 'flywheel');
    this.pump = this.buildImpeller(0.12, 1.43, 0.48, 'intake', 'pump', 24, 0.22);
    this.turbine = this.buildImpeller(1.02, 1.43, 0.48, 'brass', 'converterTurbine', 24, -0.22);
    this.stator = this.buildImpeller(0.58, 0.91, 0.28, 'exhaust', 'stator', 14, 0.45);
    this.statorHub = this.annulus(0.29, 0.15, 1.4, 'dark', this.converter, [0.67, 0, 0], 'stator');
    this.inputShaft = this.cylinder(0.12, 2.9, 'brass', this.converter, [1.2, 0, 0], 'x', 'converterTurbine');
    this.lockup = this.subgroup(this.converter, [0, 0, 0], 'lockup');
    this.lockupPlate = this.annulus(1.3, 0.58, 0.06, 'fuel', this.lockup, [-0.03, 0, 0], 'lockup');
    this.lockupPiston = this.annulus(1.31, 0.55, 0.065, 'steel', this.lockup, [0.03, 0, 0], 'lockup');
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4;
      const spring = this.cylinder(0.065, 0.2, 'brass', this.lockupPlate, [0, 0.8 * Math.cos(a), 0.8 * Math.sin(a)], 'z', 'lockup');
      spring.rotation.x = a;
    }
    this.converterCover = this.annulus(1.6, 0.17, 1.43, this.material({ color: 0x7595a5, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), this.converter, [0.59, 0, 0], 'converter');

    this.stages = AUTOMATIC_PLANETARIES.map((set, index) => this.buildStage(set, 2.7 + index * 1.35, index));
    this.output = this.cylinder(0.13, 1.55, 'brass', this.gearbox, [7.525, 0, 0], 'x', 'outputShaft');
    this.gearboxCover = this.annulus(1.67, 1.53, 5.85, this.material({ color: 0x718c9b, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }), this.gearbox, [5.12, 0, 0], 'automatic');
    this.box(5.3, 0.45, 1.9, 'block', this.control, [4.9, -1.95, 0], 'valveBody');
    this.box(5.55, 0.1, 2.1, 'dark', this.control, [4.9, -2.23, 0], 'valveBody');
    for (let n = 0; n < 7; n++) {
      this.cylinder(0.11, 0.63, n % 2 ? 'intake' : 'exhaust', this.control, [2.75 + n * 0.7, -1.66, 0.35], 'x', 'valveBody');
      this.box(0.2, 0.17, 0.32, 'black', this.control, [2.75 + n * 0.7, -1.48, 0.35], 'valveBody');
      this.pipe(this.curve([[2.75 + n * 0.7, -1.63, -0.45], [2.9 + n * 0.7, -1.63, -0.15], [3.05 + n * 0.7, -1.63, -0.45]]), 0.04, 'brass', this.control, 'valveBody');
    }
    this.paths = [];
    // Small arrows remain inside the converter and denote circulation of oil.
    for (let n = 0; n < 3; n++) {
      const a = n * Math.PI * 2 / 3;
      const yz = radius => [Math.cos(a) * radius, Math.sin(a) * radius];
      const points = [[0.17, ...yz(0.69)], [0.25, ...yz(1.24)], [0.83, ...yz(1.24)], [0.94, ...yz(0.72)], [0.6, ...yz(0.55)], [0.17, ...yz(0.69)]];
      this.paths.push(makeFlow(this, points, 0x72d3e6, this.converter, 'converter', 4, 0.022));
    }
    this.anchor('Pompa · obraca się z silnikiem', this.pump, [0, 1.85, 0], 'pump', ['clutch', 'drive-detail']);
    this.anchor('Turbina · wejście skrzyni', this.turbine, [0.2, -1.7, 0.35], 'converterTurbine', ['clutch', 'drive-detail']);
    this.anchor('Kierownica · sprzęgło jednokierunkowe', this.stator, [0.3, 0.3, 1.6], 'stator', ['clutch']);
    this.anchor('Lock-up · mechaniczne spięcie pompy i turbiny', this.lockup, [-0.25, 1, -1.7], 'lockup', ['clutch']);
    this.anchor('Planetarne · 8 przełożeń · schemat dydaktyczny', this.gearbox, [5, 2.15, 0], 'planetary', ['gearbox', 'drive-detail']);
    this.anchor('Blok zaworowy · hydrauliczne sterowanie sprzęgłami', this.control, [4.9, -2.65, 0], 'valveBody', ['gearbox', 'drive-detail']);
    this.anchor('Pakiety sprzęgieł i hamulców', this.gearbox, [3.3, -1.7, 0], 'automaticClutches', ['gearbox', 'drive-detail']);
  }

  buildImpeller(x, outer, inner, material, part, blades, pitch) {
    const impeller = this.subgroup(this.converter, [x, 0, 0], part);
    this.ring(outer, 0.055, material, impeller, [0, 0, 0], 'x', part);
    this.ring(inner, 0.06, material, impeller, [0, 0, 0], 'x', part);
    this.annulus(inner + 0.035, inner - 0.1, 0.1, 'steel', impeller, [0, 0, 0], part);
    for (let n = 0; n < blades; n++) {
      const angle = n * Math.PI * 2 / blades;
      const radial = this.subgroup(impeller, [0, 0, 0], part);
      radial.rotation.x = angle;
      const vane = this.box(0.23, outer - inner - 0.06, 0.04, material, radial, [0, (outer + inner) / 2, 0], part);
      vane.rotation.y = pitch;
    }
    return impeller;
  }

  buildStage(set, x, index) {
    const group = this.subgroup(this.gearbox, [x, 0, 0], 'planetary');
    const module = 0.016;
    const sun = this.gear(set.sun, set.sun * module, 0.25, 'intake', group, [0, 0, 0], 'planetary', 0.135);
    const ring = this.subgroup(group, [0, 0, 0], 'planetary');
    this.mesh(internalGearGeometry(set.ring, set.ring * module, 0.29, 1.42), 'brass', ring, [0, 0, 0], 'planetary');
    const carrier = this.subgroup(group, [0, 0, 0], 'planetary');
    this.annulus(0.26, 0.14, 0.7, 'steel', carrier, [0, 0, 0], 'planetary');
    const planets = [];
    // Four equally spaced planets satisfy (Ns+Nr)/4 being an integer for all
    // four sets. Individual phases keep both external/internal meshes aligned.
    for (let n = 0; n < 4; n++) {
      const phase = n * Math.PI / 2;
      const radius = (set.sun + set.planet) * module;
      const y = Math.cos(phase) * radius;
      const z = Math.sin(phase) * radius;
      this.cylinder(0.064, 0.8, 'steel', carrier, [0, y, z], 'x', 'planetary');
      for (const side of [-0.35, 0.35]) {
        const arm = this.box(0.065, radius, 0.115, 'dark', carrier, [side, y / 2, z / 2], 'planetary');
        arm.rotation.x = phase;
      }
      const planet = this.gear(set.planet, set.planet * module, 0.25, 'steel', carrier, [0, y, z], 'planetary', 0.07);
      planets.push({ planet, phase: phase * (1 + set.sun / set.planet) + Math.PI / set.planet });
    }
    const pack = this.subgroup(group, [0, 0, 0], 'automaticClutches');
    const plates = [];
    for (let n = 0; n < 5; n++) plates.push(this.annulus(1.5, 1.44, 0.034, n % 2 ? 'steel' : 'exhaust', pack, [-0.54 + n * 0.047, 0, 0], 'automaticClutches'));
    const piston = this.annulus(1.52, 1.44, 0.06, 'block', pack, [-0.64, 0, 0], 'automaticClutches');
    pack.visible = index !== 3;
    const brake = this.annulus(index === 0 ? 1.54 : 0.38, index === 0 ? 1.46 : 0.3, 0.11, 'exhaust', group, [0.46, 0, 0], 'automaticClutches');
    this.anchor(index === 3 ? 'D · stały nadbieg 0,67:1' : `${String.fromCharCode(65 + index)} · redukcja ${set.reduction.toFixed(2)}:1 / spięcie 1:1`, group, [0, 1.9, 0], 'planetary', ['gearbox']);
    return { group, sun, ring, carrier, planets, pack, plates, piston, brake, index };
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    const converterParts = ['clutch', 'converter', 'pump', 'turbine', 'converterTurbine', 'stator', 'lockup'];
    this.converter.visible = !isolate || section === 'all' || converterParts.includes(section);
    this.gearbox.visible = !isolate || ['all', 'gearbox', 'planetary', 'automaticClutches'].includes(section);
    this.control.visible = !isolate || ['all', 'gearbox', 'valveBody'].includes(section);
    const packsOnly = isolate && section === 'automaticClutches';
    const gearsOnly = isolate && section === 'planetary';
    this.output.visible = !packsOnly;
    this.stages.forEach(stage => {
      stage.sun.visible = stage.ring.visible = stage.carrier.visible = !packsOnly;
      stage.pack.visible = stage.index !== 3 && !gearsOnly;
      stage.brake.visible = !gearsOnly;
    });
    for (const [key, aliases] of [['pump', ['pump']], ['turbine', ['turbine', 'converterTurbine']], ['stator', ['stator']], ['lockup', ['lockup']]]) {
      this[key].visible = !isolate || ['all', 'clutch', 'converter'].includes(section) || aliases.includes(section);
    }
    this.flywheel.visible = !isolate || ['all', 'clutch', 'converter', 'pump', 'lockup'].includes(section);
    this.inputShaft.visible = !isolate || ['all', 'clutch', 'converter', 'turbine', 'converterTurbine'].includes(section);
    this.statorHub.visible = !isolate || ['all', 'clutch', 'converter', 'stator'].includes(section);
  }

  bounds(section = this.section) {
    this.group.updateMatrixWorld(true);
    const object = ['clutch', 'converter', 'pump', 'turbine', 'converterTurbine', 'stator', 'lockup'].includes(section)
      ? this.converter : section === 'valveBody' ? this.control : ['gearbox', 'planetary', 'automaticClutches'].includes(section) ? this.gearbox : this.group;
    return new THREE.Box3().setFromObject(object).expandByScalar(0.25);
  }

  update(sim, cutaway, dt = 0) {
    if (!this.group.visible) return;
    if (!sim.paused) this.clock += dt;
    const state = sim.automatic;
    this.flywheel.rotation.x = state.pumpAngle;
    this.pump.rotation.x = state.pumpAngle;
    this.turbine.rotation.x = state.turbineAngle;
    this.stator.rotation.x = state.statorAngle;
    this.inputShaft.rotation.x = state.turbineAngle;
    this.lockupPlate.rotation.x = state.turbineAngle;
    this.lockupPiston.rotation.x = state.pumpAngle;
    this.lockupPlate.position.x = -0.03 + (1 - state.lockup) * 0.11 + this.exploded * 0.75;
    this.turbine.position.x = 1.02 + this.exploded * 1.1;
    this.stator.position.x = 0.58 + this.exploded * 0.5;
    this.statorHub.material = state.statorLocked ? this.materials.exhaust : this.materials.steel;
    this.stages.forEach(stage => {
      const angles = state.stageAngles[stage.index];
      stage.sun.rotation.x = angles.sun;
      stage.ring.rotation.x = angles.ring;
      stage.carrier.rotation.x = angles.carrier;
      stage.planets.forEach(({ planet, phase }) => { planet.rotation.x = angles.planet + phase; });
      const reduction = stage.index === 3 ? 1 : state.stageReductions[stage.index];
      stage.plates.forEach((plate, n) => {
        plate.position.x = -0.54 + n * (0.034 + 0.03 * reduction + this.exploded * 0.045);
        plate.rotation.x = n % 2 ? angles.carrier : stage.index === 0 ? angles.sun : angles.ring;
      });
      stage.brake.material = reduction > 0.5 ? this.materials.fuel : this.materials.dark;
      stage.piston.material = reduction < 0.5 && state.gearboxEngagement > 0 ? this.materials.intake : this.materials.block;
    });
    this.output.rotation.x = sim.outputAngle;
    this.converterCover.visible = !cutaway && ['all', 'converter', 'clutch'].includes(this.section);
    this.gearboxCover.visible = !cutaway && ['all', 'gearbox'].includes(this.section);
    this.paths.forEach(path => updateFlow(path, state.pumpOmega, this.clock, this.showFlow && ['all', 'converter', 'clutch'].includes(this.section), 20));
  }
}
