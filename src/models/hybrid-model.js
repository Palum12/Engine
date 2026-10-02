import * as THREE from 'three';
import { PSD, psdPlanetOmega } from '../powertrain.js';
import { ModelGeometry, vec } from './geometry.js';
import { internalGearGeometry } from './mechanical-geometry.js';
import { makeFlow, updateFlow } from './flow-path.js';

export class HybridModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.clock = 0;
    this.showFlow = true;
    this.section = 'all';
    this.group.userData.part = 'hybrid';
    this.mechanics = this.subgroup(this.group, [0, 0, 0], 'hybrid');
    this.psd = this.subgroup(this.mechanics, [3.2, 0, 0], 'psd');
    this.sun = this.gear(PSD.sun, 0.6, 0.28, 'intake', this.psd, [0, 0, 0], 'sun', 0.115);
    this.ringGear = this.subgroup(this.psd, [0, 0, 0], 'ringGear');
    this.mesh(internalGearGeometry(PSD.ring, 1.56, 0.3, 1.76), 'brass', this.ringGear);
    this.carrier = this.subgroup(this.psd, [0, 0, 0], 'carrier');
    for (const x of [-0.38, 0.38]) {
      this.annulus(1.2, x > 0 ? 0.445 : 0.27, 0.065, 'dark', this.carrier, [x, 0, 0], 'carrier');
      this.annulus(x > 0 ? 0.51 : 0.34, x > 0 ? 0.445 : 0.225, 0.15, 'steel', this.carrier, [x, 0, 0], 'carrier');
    }
    this.planets = [];
    for (let n = 0; n < PSD.planets; n++) {
      const a = n / PSD.planets * Math.PI * 2;
      const y = Math.cos(a) * 1.08;
      const z = Math.sin(a) * 1.08;
      this.cylinder(0.09, 0.85, 'steel', this.carrier, [0, y, z], 'x', 'carrier');
      const planet = this.gear(PSD.planet, 0.48, 0.28, 'steel', this.carrier, [0, y, z], 'psd', 0.10);
      this.planets.push({ planet, phase: a + Math.PI / PSD.planet });
    }
    this.engineInput = this.annulus(0.22, 0.14, 2.75, 'brass', this.mechanics, [1.05, 0, 0], 'carrier');
    this.cylinder(0.11, 4.2, 'intake', this.mechanics, [1.2, 0, 0], 'x', 'sun');
    this.mg1 = this.buildMotor(1.15, 'mg1', 0x68c9ed, 0.235, 1.03);
    this.mg2 = this.buildMotor(5.1, 'mg2', 0x85e2b3, 0.44, 1.35);
    this.annulus(0.25, 0.225, 1.7, 'intake', this.mg1.rotor, [-0.8, 0, 0], 'mg1');
    this.annulus(0.29, 0.115, 0.06, 'intake', this.mg1.rotor, [-1.65, 0, 0], 'mg1');
    this.annulus(0.49, 0.425, 0.65, 'intake', this.mg2.rotor, [0, 0, 0], 'mg2');
    this.output = this.annulus(0.42, 0.34, 2.7, 'brass', this.mechanics, [4.9, 0, 0], 'ringGear');
    this.annulus(1.73, 0.425, 0.07, 'brass', this.ringGear, [0.57, 0, 0], 'ringGear');
    this.inverter = this.subgroup(this.group, [4.8, 2.7, -2.2], 'inverter');
    this.box(2.0, 0.25, 1.2, 'dark', this.inverter, [0, -0.4, 0], 'inverter');
    for (let n = 0; n < 8; n++) this.box(0.07, 0.3, 1.2, 'steel', this.inverter, [-0.85 + n * 0.24, -0.55, 0], 'inverter');
    for (let n = 0; n < 6; n++) {
      this.box(0.24, 0.25, 0.55, 'intake', this.inverter, [-0.7 + n % 3 * 0.65, 0, n < 3 ? -0.31 : 0.31], 'inverter');
      this.cylinder(0.1, 0.4, 'brass', this.inverter, [-0.7 + n % 3 * 0.65, 0.35, n < 3 ? -0.31 : 0.31], 'y', 'inverter');
    }
    this.battery = this.subgroup(this.group, [3.8, -3.2, -3.2], 'battery');
    this.box(5, 0.16, 2.25, 'dark', this.battery, [0, -0.58, 0], 'battery');
    this.cells = [];
    for (let row = 0; row < 2; row++) for (let n = 0; n < 14; n++) {
      const x = -2.28 + n * 0.35;
      const z = row ? 0.51 : -0.51;
      const material = this.material({ color: 0x70be96, metalness: 0.2, roughness: 0.6 });
      const cell = this.box(0.3, 0.95, 0.86, material, this.battery, [x, 0, z], 'battery');
      this.cells.push(cell);
      this.cylinder(0.042, 0.06, row ? 'steel' : 'brass', this.battery, [x - 0.075, 0.51, z], 'y', 'battery', 8);
      this.cylinder(0.042, 0.06, row ? 'brass' : 'steel', this.battery, [x + 0.075, 0.51, z], 'y', 'battery', 8);
      if (n < 13) this.box(0.35, 0.025, 0.09, 'brass', this.battery, [x + 0.175, 0.54, z], 'battery');
    }
    this.box(0.09, 0.025, 1.02, 'brass', this.battery, [2.345, 0.54, 0], 'battery');
    for (const z of [-0.51, 0.51]) this.pipe(this.curve([[-2.355, 0.55, z], [-2.5, 0.7, z], [1, 0.7, z], [2.7, 0.45, Math.sign(z) * 0.65]]), 0.025, z < 0 ? 'brass' : 'steel', this.battery, 'battery');
    this.contactors = this.subgroup(this.battery, [2.7, 0, 0], 'battery');
    this.box(0.45, 0.6, 1.8, 'block', this.contactors, [0, 0, 0], 'battery');
    this.box(0.46, 0.15, 0.45, 'fuel', this.contactors, [0, 0.4, 0], 'battery');
    this.batteryCover = this.box(5.9, 1.25, 2.5, this.material({ color: 0x688898, transparent: true, opacity: 0.24, depthWrite: false }), this.battery, [0.25, 0, 0], 'battery');
    this.mechanicalCover = this.box(7.1, 3.6, 3.7, this.material({ color: 0x6c8e9e, transparent: true, opacity: 0.2, depthWrite: false }), this.mechanics, [3, 0, 0], 'hybrid');
    this.electrical = this.subgroup(this.group, [0, 0, 0], 'inverter');
    this.refreshWires();
    this.anchor('MG1 · generator i rozrusznik', this.mg1.group, [0, 1.5, 0], 'mg1', ['hybrid', 'drive-detail']);
    this.anchor('Słońce · MG1', this.psd, [0, -0.8, 1.9], 'sun', ['hybrid']);
    this.anchor('Jarzmo · silnik benzynowy', this.psd, [-0.4, 1.7, 0], 'carrier', ['hybrid']);
    this.anchor('Wieniec · wyjście i MG2', this.psd, [0.6, -1.8, 0], 'ringGear', ['hybrid']);
    this.anchor('MG2 · napęd i rekuperacja', this.mg2.group, [0, 1.8, 0], 'mg2', ['hybrid', 'drive-detail']);
    this.anchor('Falownik · DC ↔ AC', this.inverter, [0, 0.9, 0], 'inverter', ['hybrid', 'drive-detail']);
    this.batteryAnchor = this.anchor('Bateria HV · 201,6 V', this.battery, [0, 0.9, 0], 'battery', ['hybrid', 'drive', 'drive-detail']);
  }

  buildMotor(x, part, color, bore, radius) {
    const group = this.subgroup(this.mechanics, [x, 0, 0], part);
    const rotor = this.subgroup(group, [0, 0, 0], part);
    this.annulus(radius - 0.22, bore, 0.65, 'dark', rotor, [0, 0, 0], part);
    for (let n = 0; n < 12; n++) {
      const a = n * Math.PI / 6;
      const magnet = this.box(0.6, 0.08, 0.19, n % 2 ? 'exhaust' : 'intake', rotor, [0, Math.cos(a) * (radius - 0.22), Math.sin(a) * (radius - 0.22)], part);
      magnet.rotation.x = a;
    }
    this.annulus(radius + 0.13, radius - 0.04, 0.85, 'steel', group, [0, 0, 0], part);
    for (let n = 0; n < 18; n++) {
      const a = n * Math.PI / 9;
      const winding = this.box(0.88, 0.085, 0.13, this.material({ color, metalness: 0.45, roughness: 0.3 }), group, [0, Math.cos(a) * (radius - 0.09), Math.sin(a) * (radius - 0.09)], part);
      winding.rotation.x = a;
    }
    return { group, rotor };
  }

  refreshWires() {
    this.wireGeometry?.dispose();
    this.wireGeometry = new ModelGeometry(this.materials);
    this.electrical.add(this.wireGeometry.group);
    const g = this.wireGeometry;
    const b = this.battery.position;
    const inv = this.inverter.position;
    const bs = this.battery.scale.x;
    const is = this.inverter.scale.x;
    const positive = makeFlow(g, [[b.x + 2.9 * bs, b.y + 0.3 * bs, b.z + 0.65 * bs], [b.x + 3.5 * bs, b.y + 0.9 * bs, b.z + bs], [inv.x + 1.3 * is, inv.y, inv.z - 0.8 * is], [inv.x + 0.7 * is, inv.y, inv.z]], 0xf5ae58, g.group, 'battery', 7, 0.065);
    const negative = makeFlow(g, [[b.x + 2.9 * bs, b.y + 0.3 * bs, b.z - 0.65 * bs], [b.x + 3.8 * bs, b.y + 0.5 * bs, b.z + 0.7 * bs], [inv.x + 1.7 * is, inv.y - 0.3 * is, inv.z - 0.8 * is], [inv.x + 0.7 * is, inv.y, inv.z - 0.3 * is]], 0xcabca9, g.group, 'battery', 7, 0.05);
    this.paths = [{ path: positive, key: 'batteryPower', sign: 1 }, { path: negative, key: 'batteryPower', sign: -1 }];
    for (const [key, x, color] of [['generatorPower', 1.15, 0x68c9ed], ['motorDcPower', 5.1, 0x85e2b3]]) {
      for (let phase = 0; phase < 3; phase++) {
        const start = [x + (phase - 1) * 0.17, 1.1, -0.18];
        const end = [inv.x + (-0.6 + phase * 0.22) * is, inv.y, inv.z + 0.6 * is];
        const path = makeFlow(g, [start, [x + (phase - 1) * 0.2, 2, -0.9], end], color, g.group, key === 'generatorPower' ? 'mg1' : 'mg2', 4, 0.028);
        this.paths.push({ path, key, sign: key === 'generatorPower' ? 1 : -1 });
      }
    }
  }

  setLayout(vehicle = false, scale = 0.28, x = -6.8, y = 1.2, z = 0.15) {
    const layout = vehicle ? `vehicle:${scale}:${x}:${y}:${z}` : 'bench';
    if (this.layout === layout) return;
    this.layout = layout;
    this.battery.scale.setScalar(vehicle ? 2.5 : 1);
    this.inverter.scale.setScalar(vehicle ? 2 : 1);
    this.battery.position.set(...(vehicle ? [ -z / scale, (0.35 - y) / scale, (x - 4.5) / scale ] : [3.8, -3.2, -3.2]));
    this.inverter.position.set(...(vehicle ? [(0.7 - z) / scale, (1.9 - y) / scale, (x + 6.1) / scale] : [4.8, 2.7, -2.2]));
    this.refreshWires();
  }

  setSection(section = 'all', isolate = false) {
    this.section = section;
    this.mechanics.visible = !isolate || !['battery', 'inverter'].includes(section);
    this.battery.visible = !isolate || section === 'all' || section === 'battery';
    this.inverter.visible = !isolate || section === 'all' || section === 'inverter';
    this.electrical.visible = !isolate || ['all', 'battery', 'inverter', 'mg1', 'mg2'].includes(section);
    this.psd.visible = !isolate || ['all', 'psd', 'carrier', 'sun', 'ringGear'].includes(section);
    this.mg1.group.visible = !isolate || ['all', 'mg1'].includes(section);
    this.mg2.group.visible = !isolate || ['all', 'mg2'].includes(section);
    this.engineInput.visible = !isolate || !['mg1', 'mg2'].includes(section);
    this.output.visible = this.engineInput.visible;
  }

  bounds(section = this.section) {
    this.group.updateMatrixWorld(true);
    if (['battery', 'inverter'].includes(section)) return new THREE.Box3().setFromObject(this[section]).expandByScalar(0.3);
    if (section === 'mg1' || section === 'mg2') return new THREE.Box3().setFromObject(this[section].group).expandByScalar(0.2);
    if (['psd', 'sun', 'carrier', 'ringGear'].includes(section)) return new THREE.Box3().setFromObject(this.psd).expandByScalar(0.2);
    return new THREE.Box3().setFromObject(this.group);
  }

  update(sim, cutaway, dt = 0) {
    if (!this.group.visible) return;
    if (!sim.paused) this.clock += dt;
    const h = sim.hybrid;
    this.sun.rotation.x = h.mg1Angle;
    this.carrier.rotation.x = h.carrierAngle;
    this.engineInput.rotation.x = h.carrierAngle;
    this.ringGear.rotation.x = h.mg2Angle;
    this.output.rotation.x = h.mg2Angle;
    this.mg1.rotor.rotation.x = h.mg1Angle;
    this.mg2.rotor.rotation.x = h.mg2Angle;
    this.planets.forEach(({ planet, phase }) => { planet.rotation.x = psdPlanetOmega(h.mg1Angle, h.carrierAngle) + phase; });
    this.batteryCover.visible = !cutaway;
    this.mechanicalCover.visible = !cutaway && this.section === 'all';
    this.cells.forEach((cell, i) => cell.material.color.setHex(i / this.cells.length < h.soc ? 0x73d6a5 : 0x354b50));
    this.batteryAnchor.userData.label = `Bateria · ${Math.round(h.soc * 100)}% · ${Math.abs(h.batteryCurrent).toFixed(0)} A ${h.batteryPower > 100 ? '→ napęd' : h.batteryPower < -100 ? '← ładowanie' : '· spoczynek'}`;
    this.paths.forEach(({ path, key, sign }) => updateFlow(path, (h[key] || 0) * sign, this.clock, this.showFlow, 50));
  }

  dispose() { this.wireGeometry.dispose(); super.dispose(); }
}
