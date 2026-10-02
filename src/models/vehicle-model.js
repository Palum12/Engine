import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';
import { FinalDriveModel } from './final-drive-model.js';
import { makeFlow, updateFlow } from './flow-path.js';

export class VehicleModel extends ModelGeometry {
  constructor(materials, models) {
    super(materials);
    this.models = models;
    this.clock = 0;
    this.layer = 'mechanical';
    this.detail = 'auto';
    this.section = 'all';
    this.front = new FinalDriveModel(materials);
    this.rear = new FinalDriveModel(materials);
    this.front.group.position.set(-7, 0, 0);
    this.rear.group.position.set(7, 0, 0);
    this.group.add(this.front.group, this.rear.group);
    this.chassis = this.subgroup(this.group, [0, 0, 0], 'vehicle');
    const ghost = this.material({ color: 0x8da6b9, transparent: true, opacity: 0.09, depthWrite: false });
    const outline = this.material({ color: 0x567485, metalness: 0.4, roughness: 0.7 });
    this.box(18.8, 0.025, 4.5, ghost, this.chassis, [0, -0.65, 0]);
    for (const z of [-2.25, 2.25]) this.box(18.8, 0.055, 0.055, outline, this.chassis, [0, -0.55, z]);
    for (const x of [-9.4, -3.6, 3.6, 9.4]) this.box(0.055, 0.055, 4.5, outline, this.chassis, [x, -0.55, 0]);
    this.pipe(this.curve([[-9.4, -0.5, -2.25], [-9.7, -0.4, 0], [-9.4, -0.5, 2.25]]), 0.035, outline, this.chassis);
    this.wheels = [];
    for (const [axle, x] of [[0, -7], [1, 7]]) for (const [side, z] of [[0, -3], [1, 3]]) {
      const steering = this.subgroup(this.group, [x, 0, z], 'wheelHub');
      const wheel = this.subgroup(steering, [0, 0, 0], 'wheelHub');
      this.ring(1.05, 0.22, 'black', wheel, [0, 0, 0], 'z', 'wheelHub');
      const rim = this.annulus(0.88, 0.7, 0.25, 'steel', wheel, [0, 0, 0], 'wheelHub');
      rim.rotation.y = Math.PI / 2;
      this.cylinder(0.18, 0.45, side ? 'brass' : 'intake', wheel, [0, 0, 0], 'z', 'wheelHub');
      const brake = this.annulus(0.62, 0.22, 0.05, 'steel', wheel, [0, 0, side ? -0.2 : 0.2], 'wheelHub');
      brake.rotation.y = Math.PI / 2;
      for (let n = 0; n < 6; n++) {
        const a = n * Math.PI / 3;
        const spoke = this.box(0.65, 0.08, 0.14, 'steel', wheel, [Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0]);
        spoke.rotation.z = a;
      }
      this.box(0.24, 0.39, 0.16, 'exhaust', steering, [0.43, 0.15, side ? -0.23 : 0.23], 'wheelHub');
      const surface = this.box(2.5, 0.03, 0.85, this.material({ color: 0x394548, transparent: true, opacity: 0.6 }), this.group, [x, -1.31, z], 'wheelHub');
      this.wheels.push({ wheel, steering, surface, axle, side });
    }
    this.assembly = this.subgroup(this.group);
    this.routing = new ModelGeometry(materials);
    this.group.add(this.routing.group);
    this.anchor('PRZÓD', this.chassis, [-9.25, 0.7, -2.1], 'vehicle', ['drive', 'drive-detail']);
    this.anchor('TYŁ', this.chassis, [9.25, 0.7, -2.1], 'vehicle', ['drive', 'drive-detail']);
    this.anchor('Przednia oś', this.group, [-7, 1.7, 1.6], 'frontAxle', ['drive', 'drive-detail']);
    this.anchor('Tylna oś', this.group, [7, 1.7, 1.6], 'rearAxle', ['drive', 'drive-detail']);
    this.engineAnchor = this.anchor('Silnik benzynowy', this.group, [-5.8, 3.0, 0], 'block', ['drive', 'drive-detail']);
    this.transmissionAnchor = this.anchor('Sprzęgło i skrzynia', this.group, [-2.5, 2, 0], 'gearbox', ['drive', 'drive-detail']);
  }

  attach() {
    for (const model of Object.values(this.models)) this.assembly.add(model.group);
    this.group.visible = true;
  }

  configure(sim, section = 'all', isolate = false) {
    this.sim = sim;
    this.section = section;
    this.isolate = isolate;
    const { engine, drive, dct, hybrid, transfer, systems, turbo, connections } = this.models;
    const transverse = sim.driveLayout === 'fwd';
    const engineScale = Math.min(0.42, 3.5 / (engine.length + 1));
    const shaftY = 0.9 + 0.8 * engineScale;
    const enginePosition = transverse ? [-6.8, 0.9, 0.15 - engine.shaftEnd * engineScale] : [-4.6 - engine.shaftEnd * engineScale, 0.9, 0];
    const rotation = transverse ? -Math.PI / 2 : 0;
    const pose = (model, p, scale, angle = rotation) => { model.group.position.set(...p); model.group.scale.setScalar(scale); model.group.rotation.set(0, angle, 0); };
    pose(engine, enginePosition, engineScale);
    pose(systems, enginePosition, engineScale);
    pose(connections, enginePosition, engineScale);
    engine.setView('drive-detail', 0);
    const drivetrainPosition = transverse ? [-6.8, shaftY, 0.15] : [-4.6, shaftY, 0];
    const gearboxScale = transverse ? 0.18 : 0.33;
    pose(drive, drivetrainPosition, gearboxScale);
    drive.setView('drive-detail');
    drive.exploded = 0;
    drive.wheel.visible = false;
    pose(dct, drivetrainPosition, gearboxScale);
    dct.setSection('all');
    pose(hybrid, drivetrainPosition, 0.28);
    hybrid.setLayout(true, 0.28, ...drivetrainPosition);
    hybrid.setSection('all');
    pose(transfer, [0.8, 0.65, 0], 0.62, 0);
    transfer.configure(sim.driveLayout);
    turbo.group.position.copy(engine.group.position).add(vec(0, 2 * engineScale, -7.2 * engineScale).applyAxisAngle(vec(0, 1, 0), rotation));
    turbo.group.rotation.copy(engine.group.rotation);
    turbo.group.scale.setScalar(engineScale);
    turbo.setSection('all');
    const key = `${sim.transmission}:${sim.driveLayout}:${engine.id}`;
    if (key !== this.key) {
      this.key = key;
      this.buildRouting(sim, drivetrainPosition, gearboxScale);
    }
    this.front.group.rotation.z = transverse ? 0 : Math.PI;
    this.front.input.visible = !transverse && !['rwd'].includes(sim.driveLayout);
    this.front.crown.visible = !transverse;
    this.frontDriveSpur?.removeFromParent();
    if (transverse) {
      this.frontDriveSpur = this.frontSpur;
      this.front.carrier.add(this.frontSpur);
      this.frontSpur.position.set(0, 0, 2.1);
    }
    this.front.wheels.forEach(wheel => { wheel.visible = false; });
    this.rear.wheels.forEach(wheel => { wheel.visible = false; });
    this.front.housing.visible = this.rear.housing.visible = false;
    this.engineAnchor.position.copy(engine.group.position).add(vec(0, 2.6, 0));
    this.transmissionAnchor.position.copy(vec(...drivetrainPosition)).add(transverse ? vec(0.8, 1.1, 1) : vec(2.1, 1.1, 0));
    this.transmissionAnchor.userData.label = sim.transmission === 'hybrid' ? 'e-CVT · MG1 / planeta / MG2' : sim.transmission === 'dct' ? 'DCT · sprzęgła K1 / K2' : 'Manual · sprzęgło i skrzynia';
    this.applyVisibility(sim);
  }

  buildRouting(sim, position, scale) {
    this.frontSpur?.removeFromParent();
    this.routing.dispose();
    this.routing = new ModelGeometry(this.materials);
    this.group.add(this.routing.group);
    const g = this.routing;
    const transverse = sim.driveLayout === 'fwd';
    const output = transverse ? vec(position[0], position[1] - (sim.transmission === 'manual' ? 1.8 * scale : 0), position[2] + (sim.transmission === 'hybrid' ? 6.3 * 0.28 : 12 * scale)) : vec(position[0] + 12 * scale, position[1] - (sim.transmission === 'manual' ? 1.8 * scale : 0), 0);
    this.paths = [];
    const path = (points, key, color = 0xffc35a) => this.paths.push({ path: makeFlow(g, points, color, g.group, 'propShaft', 7, 0.032), key });
    if (transverse) {
      const distance = Math.hypot(position[0] + 7, output.y);
      this.frontSpur = g.subgroup(g.group, [0, 0, 0], 'finalDrive');
      const gear = g.gear(39, distance * 3.9 / 4.9, 0.15, 'brass', this.frontSpur, [0, 0, 0], 'finalDrive', 0.13);
      gear.rotation.y = -Math.PI / 2;
      const cup = g.annulus(0.23, 0.13, 1.65, 'steel', this.frontSpur, [0, 0, -0.95], 'finalDrive');
      cup.rotation.y = -Math.PI / 2;
      this.frontPinion = g.subgroup(g.group, [output.x, output.y, 2.1], 'finalDrive');
      this.frontPinion.rotation.y = -Math.PI / 2;
      this.frontPinionRotor = g.gear(10, distance / 4.9, 0.15, 'intake', this.frontPinion, [0, 0, 0], 'finalDrive', 0.055);
      const stub = g.cylinder(0.055, Math.max(0.15, output.z - 2.1), 'steel', g.group, [output.x, output.y, (output.z + 2.1) / 2], 'z', 'outputShaft');
      stub.userData.ignorePick = false;
      path([[position[0], position[1], position[2]], [output.x, output.y + 0.18, 1.2], [output.x, output.y, 2.1], [-7, 0.4, 2.1]], 'input');
    } else {
      this.frontPinion = null;
      const both = ['awd', 'quattro', 'partTime'].includes(sim.driveLayout);
      const center = vec(0.8, 0.65, 0);
      this.shaft(g, output, both ? center.clone().add(vec(-1.05, 0, 0)) : vec(3.25, 0, -1.02));
      path([output.toArray(), [0.3, output.y + 0.3, 0], [3.1, 0.4, -0.95], [6.2, 0.4, -0.95]], 'rear');
      if (both) {
        this.shaft(g, center.clone().add(vec(1.05, 0, 0)), vec(3.25, 0, -1.02));
        this.shaft(g, center.clone().add(vec(-1.05, 0, -0.9)), vec(-3.25, 0, 1.02));
        path([[0.6, 0.8, -0.9], [-2.1, 0.4, 0.95], [-6.2, 0.4, 0.95]], 'front', 0x68c9ed);
      }
      path([[position[0], position[1] + 0.18, 0.7], [output.x, output.y + 0.3, 0.7]], 'input');
    }
    for (let axle = 0; axle < 2; axle++) for (const side of [-1, 1]) path([[(axle ? 7 : -7), 0.27, side * 0.75], [(axle ? 7 : -7), 0.27, side * 2.75]], axle ? 'rear' : 'front', side < 0 ? 0x68c9ed : 0xf5be4f);
  }

  shaft(g, from, to) {
    const shaft = g.cylinder(0.095, 1, 'steel', g.group, [0, 0, 0], 'y', 'propShaft');
    g.between(shaft, from, to);
    for (const p of [from, to]) {
      const joint = g.mesh(new THREE.SphereGeometry(0.15, 10, 8), 'brass', g.group, p.toArray(), 'propShaft');
      joint.scale.y = 0.7;
    }
  }

  applyVisibility(sim) {
    const section = this.isolate ? this.section : 'all';
    const { engine, drive, dct, hybrid, systems, turbo, connections, transfer } = this.models;
    engine.group.visible = ['all', 'engine', 'timing', 'oil', 'fuel', 'turbo'].includes(section);
    drive.group.visible = sim.transmission === 'manual' && ['all', 'clutch', 'gearbox'].includes(section);
    drive.clutch.visible = section !== 'gearbox';
    drive.gearbox.visible = section !== 'clutch';
    dct.group.visible = sim.transmission === 'dct' && ['all', 'clutch', 'gearbox', 'mechatronics'].includes(section);
    dct.setSection(section, this.isolate);
    hybrid.group.visible = sim.transmission === 'hybrid' && ['all', 'hybrid', 'psd', 'mg1', 'mg2', 'battery', 'inverter'].includes(section);
    hybrid.setSection(section === 'hybrid' ? 'all' : section, this.isolate);
    hybrid.electrical.visible = hybrid.electrical.visible && (this.layer === 'electric' || this.section !== 'all');
    this.front.group.visible = sim.driveLayout !== 'rwd' && ['all', 'frontAxle', 'finalDrive'].includes(section);
    this.rear.group.visible = sim.driveLayout !== 'fwd' && ['all', 'rearAxle', 'finalDrive'].includes(section);
    this.front.input.visible = !['fwd', 'rwd'].includes(sim.driveLayout);
    this.rear.input.visible = sim.driveLayout !== 'fwd';
    this.front.crown.visible = sim.driveLayout !== 'fwd';
    this.front.carrier.visible = sim.driveLayout !== 'rwd';
    this.rear.carrier.visible = sim.driveLayout !== 'fwd';
    if (this.frontSpur) this.frontSpur.visible = sim.driveLayout === 'fwd';
    transfer.group.visible = ['awd', 'quattro', 'partTime'].includes(sim.driveLayout) && ['all', 'transfer'].includes(section);
    systems.group.visible = ['all', 'engine', 'timing', 'oil', 'fuel'].includes(section);
    systems.timing.visible = section === 'timing' || this.section === 'engine' || this.detail === 'service' && section === 'all';
    systems.oil.visible = section === 'oil' || this.layer === 'oil' && section === 'all';
    systems.fuel.visible = section === 'fuel' || this.layer === 'fuel' && section === 'all';
    turbo.group.visible = section === 'turbo' || this.layer === 'gases' && section === 'all' && sim.turbo;
    connections.group.visible = turbo.group.visible;
    this.chassis.visible = !this.isolate;
    this.wheels.forEach(({ steering, axle }) => { steering.visible = section === 'all' || section === (axle ? 'rearAxle' : 'frontAxle') || section === 'finalDrive'; });
    this.routing.group.visible = !this.isolate || ['all', 'transfer', 'gearbox'].includes(section);
  }

  bounds(section = this.section) {
    const { engine, drive, dct, hybrid, systems, turbo, transfer } = this.models;
    this.group.updateMatrixWorld(true);
    if (section === 'engine') return new THREE.Box3().setFromObject(engine.group).expandByScalar(0.25);
    if (['clutch', 'gearbox', 'mechatronics'].includes(section)) return this.sim.transmission === 'dct' ? dct.bounds(section) : drive.bounds(section);
    if (['hybrid', 'psd', 'mg1', 'mg2', 'battery', 'inverter'].includes(section)) return hybrid.bounds(section === 'hybrid' ? 'psd' : section);
    if (['frontAxle', 'rearAxle', 'finalDrive'].includes(section)) {
      const front = section === 'frontAxle' || section === 'finalDrive' && this.sim.driveLayout === 'fwd';
      return new THREE.Box3(vec(front ? -8.5 : 5.5, -1.5, -3.3), vec(front ? -5.5 : 8.5, 1.7, 3.3));
    }
    if (section === 'transfer') return transfer.bounds();
    if (['oil', 'fuel', 'timing'].includes(section)) return systems.bounds(section);
    if (section === 'turbo') return turbo.bounds();
    return new THREE.Box3(vec(-10.2, -1.45, -3.5), vec(10, 3.6, 3.5));
  }

  update(sim, cutaway, dt, camera) {
    if (!this.group.visible) return;
    if (!sim.paused) this.clock += dt;
    this.front.update(sim, cutaway, dt, 0);
    this.rear.update(sim, cutaway, dt, 1);
    this.front.crown.visible = sim.driveLayout !== 'fwd';
    this.front.wheels.forEach(wheel => { wheel.visible = false; });
    this.rear.wheels.forEach(wheel => { wheel.visible = false; });
    this.wheels.forEach(({ wheel, steering, surface, axle, side }, i) => {
      steering.rotation.y = axle ? 0 : sim.turn * (side ? 0.24 : 0.29);
      wheel.rotation.z = -sim.wheelAngles[i];
      surface.material.color.setHex({ asphalt: 0x394548, wet: 0x375d78, ice: 0x9fcbd6, air: 0x18232b }[sim.surfaces[i]]);
      surface.visible = sim.surfaces[i] !== 'air' && steering.visible;
    });
    if (this.frontPinion) this.frontPinionRotor.rotation.x = sim.transmission === 'hybrid' ? sim.hybrid.mg2Angle : sim.outputAngle;
    const flow = this.layer === 'mechanical' && this.models.drive.showFlow;
    this.paths.forEach(({ path, key }) => updateFlow(path, key === 'input' ? sim.transmittedTorque : sim.traction.axleTorques[key === 'front' ? 0 : 1], this.clock, flow));
    this.applyVisibility(sim);
    const level = this.detail === 'auto' ? camera.position.distanceTo(camera.userData.target || vec()) > 18 && this.section === 'all' ? 'overview' : 'mechanics' : this.detail;
    const threshold = level === 'overview' ? 0.16 : level === 'mechanics' ? 0.07 : 0;
    if (this.lodLevel !== level) {
      this.lodLevel = level;
      this.assembly.traverse(object => {
        if (!object.isMesh || object.isInstancedMesh || object.userData.lodHidden === undefined && object.visible === false) return;
        object.geometry.computeBoundingBox();
        const size = object.geometry.boundingBox.getSize(vec());
        const s = object.getWorldScale(vec()).x;
        const hide = threshold > 0 && Math.max(size.x, size.y, size.z) * s < threshold;
        if (object.userData.lodHidden && !hide) object.visible = true;
        object.userData.lodHidden = hide;
      });
    }
    this.assembly.traverse(object => { if (object.userData.lodHidden) object.visible = false; });
  }

  restoreDetail() {
    this.assembly.traverse(object => { if (object.userData.lodHidden) object.visible = true; delete object.userData.lodHidden; });
    this.lodLevel = null;
  }

  dispose() { this.frontSpur?.removeFromParent(); this.front.dispose(); this.rear.dispose(); this.routing.dispose(); super.dispose(); }
}
