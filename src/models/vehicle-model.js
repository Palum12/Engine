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
    const { engine, drive, dct, automatic, hybrid, transfer, systems, turbo, connections } = this.models;
    const transverse = sim.engineOrientation === 'transverse';
    const placement = sim.enginePlacement || 'front';
    const axle = placement === 'front' ? 0 : 1;
    const engineScale = Math.min(0.42, (transverse ? 2.45 : 3.5) / (engine.length + 1));
    const shaftY = 0.9 + 0.8 * engineScale;
    const rotation = transverse ? -Math.PI / 2 : placement === 'front' ? 0 : Math.PI;
    const drivetrainPosition = transverse ? [placement === 'rear' ? 8 : placement === 'mid' ? 6 : -6.8, shaftY, -0.15] : [placement === 'rear' ? 6.3 : placement === 'mid' ? 3.5 : -4.6, shaftY, 0];
    // The crankshaft ends at local (shaftEnd, 0.8, 0); keep that point on
    // the transmission input for every mounting orientation and placement.
    const enginePosition = vec(...drivetrainPosition).sub(vec(engine.shaftEnd, 0.8, 0).multiplyScalar(engineScale).applyAxisAngle(vec(0, 1, 0), rotation)).toArray();
    const pose = (model, p, scale, angle = rotation) => { model.group.position.set(...p); model.group.scale.setScalar(scale); model.group.rotation.set(0, angle, 0); };
    pose(engine, enginePosition, engineScale);
    pose(systems, enginePosition, engineScale);
    pose(connections, enginePosition, engineScale);
    engine.setView('drive-detail', 0);
    const gearboxScale = sim.transmission === 'hybrid' ? 0.28 : sim.transmission === 'automatic' ? transverse ? 0.25 : 0.4 : transverse ? 0.18 : 0.33;
    pose(drive, drivetrainPosition, gearboxScale);
    drive.setView('drive-detail');
    drive.exploded = 0;
    drive.wheel.visible = false;
    pose(dct, drivetrainPosition, gearboxScale);
    dct.exploded = 0;
    dct.setSection('all');
    if (automatic) { pose(automatic, drivetrainPosition, gearboxScale); automatic.exploded = 0; automatic.setSection('all'); }
    pose(hybrid, drivetrainPosition, 0.28);
    hybrid.setLayout(true, 0.28, ...drivetrainPosition);
    hybrid.setSection('all');
    pose(transfer, [0.8, 0.65, 0], 0.62, 0);
    transfer.configure(sim.driveLayout);
    turbo.group.position.copy(engine.group.position).add(vec(0, 2 * engineScale, -7.2 * engineScale).applyAxisAngle(vec(0, 1, 0), rotation));
    turbo.group.rotation.copy(engine.group.rotation);
    turbo.group.scale.setScalar(engineScale);
    turbo.setSection('all');
    const key = `${sim.transmission}:${sim.driveLayout}:${engine.id}:${placement}:${sim.engineOrientation}`;
    if (key !== this.key) {
      this.key = key;
      this.buildRouting(sim, drivetrainPosition, gearboxScale, rotation);
    }
    this.front.group.rotation.z = Math.PI;
    this.rear.group.rotation.z = 0;
    if (this.axleSpur) {
      const finalDrive = axle ? this.rear : this.front;
      finalDrive.carrier.add(this.axleSpur);
      this.axleSpur.position.set(0, 0, 2.1);
    }
    this.front.wheels.forEach(wheel => { wheel.visible = false; });
    this.rear.wheels.forEach(wheel => { wheel.visible = false; });
    this.front.housing.visible = this.rear.housing.visible = false;
    this.engineAnchor.position.copy(engine.group.position).add(vec(0, 2.6, 0));
    this.transmissionAnchor.position.copy(vec(...drivetrainPosition)).add(vec(2.1, 1.1, 0).applyAxisAngle(vec(0, 1, 0), rotation));
    this.transmissionAnchor.userData.label = sim.transmission === 'hybrid' ? 'e-CVT · MG1 / planeta / MG2' : sim.transmission === 'dct' ? 'DCT · sprzęgła K1 / K2' : sim.transmission === 'automatic' ? 'Automat 8AT · konwerter i przekładnie planetarne' : 'Manual · sprzęgło i skrzynia';
    this.applyVisibility(sim);
  }

  buildRouting(sim, position, scale, rotation) {
    this.axleSpur?.removeFromParent();
    this.routing.dispose();
    this.routing = new ModelGeometry(this.materials);
    this.group.add(this.routing.group);
    const g = this.routing;
    const transverse = sim.engineOrientation === 'transverse';
    const axle = (sim.enginePlacement || 'front') === 'front' ? 0 : 1;
    const localOutput = sim.transmission === 'automatic' ? this.models.automatic?.outputPosition || vec(8.3, 0, 0) : sim.transmission === 'hybrid' ? vec(6.25, 0, 0) : sim.transmission === 'dct' ? vec(12.85, 0, 0) : vec(12.1, -1.8, 0);
    const output = (Array.isArray(localOutput) ? vec(...localOutput) : localOutput.clone()).multiplyScalar(scale).applyAxisAngle(vec(0, 1, 0), rotation).add(vec(...position));
    const both = ['awd', 'quattro', 'partTime'].includes(sim.driveLayout);
    const drivenAxles = [sim.driveLayout !== 'rwd', sim.driveLayout !== 'fwd'];
    const center = vec(0.8, 0.65, 0);
    const input = [vec(-3.25, 0, -1.02), vec(3.25, 0, -1.02)];
    this.paths = [];
    // Flow cones only describe the shafts between assemblies. Each transmission
    // owns its internal torque path, so there is no duplicate line through it.
    const path = (points, key, color = 0xffc35a, count = 3) => this.paths.push({ path: makeFlow(g, points, color, g.group, 'propShaft', count, 0.024), key });
    this.axleSpur = this.axlePinion = this.axlePinionRotor = null;
    this.spurAxle = transverse ? axle : null;
    if (transverse) {
      const axleX = axle ? 7 : -7;
      const distance = Math.hypot(position[0] - axleX, output.y);
      this.axleSpur = g.subgroup(g.group, [0, 0, 0], 'finalDrive');
      const gear = g.gear(39, distance * 3.9 / 4.9, 0.15, 'brass', this.axleSpur, [0, 0, 0], 'finalDrive', 0.13);
      gear.rotation.y = -Math.PI / 2;
      const cup = g.annulus(0.23, 0.13, 1.65, 'steel', this.axleSpur, [0, 0, -0.95], 'finalDrive');
      cup.rotation.y = -Math.PI / 2;
      this.axlePinion = g.subgroup(g.group, [output.x, output.y, 2.1], 'finalDrive');
      this.axlePinion.rotation.y = -Math.PI / 2;
      this.axlePinionRotor = g.gear(10, distance / 4.9, 0.15, 'intake', this.axlePinion, [0, 0, 0], 'finalDrive', 0.055);
      const finalInput = vec(output.x, output.y, 2.1);
      this.shaft(g, output, finalInput);
      path([output.toArray(), finalInput.toArray(), [axleX, 0.25, 2.1]], axle ? 'rear' : 'front', 0xffc35a, 2);
      if (both) {
        const branch = vec(axleX, 0.3, 1.35);
        const other = axle ? 0 : 1;
        const entry = center.clone().add(vec(axle ? 1.05 : -1.05, 0, 0));
        const exit = center.clone().add(vec(other ? 1.05 : -1.05, 0, 0));
        this.shaft(g, branch, entry);
        path([branch.toArray(), [axle ? 3.2 : -3.2, 0.45, 1.15], entry.toArray()], 'input', 0x68c9ed);
        this.shaft(g, exit, input[other]);
        path([exit.toArray(), input[other].toArray(), [other ? 6.2 : -6.2, 0.25, input[other].z]], other ? 'rear' : 'front');
      }
    } else {
      if (both) {
        const source = center.clone().add(vec((sim.enginePlacement || 'front') === 'front' ? -1.05 : 1.05, 0, 0));
        this.shaft(g, output, source);
        path([output.toArray(), source.toArray()], 'input', 0xffc35a, 2);
        for (let i = 0; i < 2; i++) {
          const from = center.clone().add(vec(i ? 1.05 : -1.05, 0, !i && sim.driveLayout === 'partTime' ? -0.9 : 0));
          this.shaft(g, from, input[i]);
          path([from.toArray(), input[i].toArray(), [i ? 6.2 : -6.2, 0.25, input[i].z]], i ? 'rear' : 'front', i ? 0xffc35a : 0x68c9ed);
        }
      } else {
        const i = drivenAxles[0] ? 0 : 1;
        this.shaft(g, output, input[i]);
        path([output.toArray(), input[i].toArray(), [i ? 6.2 : -6.2, 0.25, input[i].z]], i ? 'rear' : 'front');
      }
    }
    for (let i = 0; i < 2; i++) if (drivenAxles[i]) for (const side of [-1, 1]) path([[(i ? 7 : -7), 0.27, side * 0.75], [(i ? 7 : -7), 0.27, side * 2.75]], i ? 'rear' : 'front', side < 0 ? 0x68c9ed : 0xf5be4f, 2);
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
    const { engine, drive, dct, automatic, hybrid, systems, turbo, connections, transfer } = this.models;
    engine.group.visible = ['all', 'engine', 'timing', 'oil', 'fuel', 'turbo'].includes(section);
    drive.group.visible = sim.transmission === 'manual' && ['all', 'clutch', 'gearbox'].includes(section);
    drive.clutch.visible = section !== 'gearbox';
    drive.gearbox.visible = section !== 'clutch';
    drive.setSection(section, this.isolate);
    dct.group.visible = sim.transmission === 'dct' && ['all', 'clutch', 'gearbox', 'mechatronics'].includes(section);
    dct.setSection(section, this.isolate);
    if (automatic) {
      automatic.group.visible = sim.transmission === 'automatic' && ['all', 'clutch', 'gearbox', 'mechatronics', 'converter', 'pump', 'turbine', 'converterTurbine', 'stator', 'lockup', 'planetary', 'automaticClutches', 'valveBody', 'automaticOil'].includes(section);
      automatic.setSection(section, this.isolate);
    }
    hybrid.group.visible = sim.transmission === 'hybrid' && ['all', 'hybrid', 'psd', 'mg1', 'mg2', 'battery', 'inverter'].includes(section);
    hybrid.setSection(section === 'hybrid' ? 'all' : section, this.isolate);
    hybrid.electrical.visible = hybrid.electrical.visible && (this.layer === 'electric' || this.section !== 'all');
    this.front.group.visible = sim.driveLayout !== 'rwd' && ['all', 'frontAxle', 'finalDrive', ...(sim.driveLayout === 'fwd' ? ['differential'] : [])].includes(section);
    this.rear.group.visible = sim.driveLayout !== 'fwd' && ['all', 'rearAxle', 'finalDrive', 'differential'].includes(section);
    this.front.input.visible = sim.driveLayout !== 'rwd' && this.spurAxle !== 0;
    this.rear.input.visible = sim.driveLayout !== 'fwd' && this.spurAxle !== 1;
    this.front.crown.visible = this.spurAxle !== 0 && !this.front.openCarrier;
    this.rear.crown.visible = this.spurAxle !== 1 && !this.rear.openCarrier;
    this.front.carrier.visible = sim.driveLayout !== 'rwd';
    this.rear.carrier.visible = sim.driveLayout !== 'fwd';
    if (this.axleSpur) this.axleSpur.visible = !(this.spurAxle ? this.rear : this.front).openCarrier;
    this.front.housing.visible = this.rear.housing.visible = false;
    transfer.group.visible = ['awd', 'quattro', 'partTime'].includes(sim.driveLayout) && ['all', 'transfer'].includes(section);
    systems.group.visible = ['all', 'engine', 'timing', 'oil', 'fuel'].includes(section);
    systems.timing.visible = section === 'timing' || this.section === 'engine' || section === 'all';
    systems.oil.visible = section === 'oil' || this.layer === 'oil' && section === 'all';
    systems.fuel.visible = section === 'fuel' || this.layer === 'fuel' && section === 'all';
    turbo.group.visible = section === 'turbo' || this.layer === 'gases' && section === 'all' && sim.turbo;
    connections.group.visible = turbo.group.visible;
    this.chassis.visible = !this.isolate;
    this.wheels.forEach(({ steering, axle }) => { steering.visible = section === 'all' || section === (axle ? 'rearAxle' : 'frontAxle') || section === 'finalDrive'; });
    this.routing.group.visible = !this.isolate || ['all', 'transfer', 'gearbox'].includes(section);
  }

  bounds(section = this.section) {
    const { engine, drive, dct, automatic, hybrid, systems, turbo, transfer } = this.models;
    this.group.updateMatrixWorld(true);
    if (section === 'engine') return new THREE.Box3().setFromObject(engine.group).expandByScalar(0.25);
    if (['clutch', 'gearbox', 'mechatronics', 'converter', 'pump', 'turbine', 'converterTurbine', 'stator', 'lockup', 'planetary', 'automaticClutches', 'valveBody', 'automaticOil'].includes(section)) return this.sim.transmission === 'automatic' && automatic ? automatic.bounds(section) : this.sim.transmission === 'dct' ? dct.bounds(section) : drive.bounds(section);
    if (['hybrid', 'psd', 'mg1', 'mg2', 'battery', 'inverter'].includes(section)) return hybrid.bounds(section === 'hybrid' ? 'psd' : section);
    if (['frontAxle', 'rearAxle', 'finalDrive'].includes(section)) {
      const front = section === 'frontAxle' || section === 'finalDrive' && this.sim.driveLayout === 'fwd';
      return new THREE.Box3(vec(front ? -8.5 : 5.5, -1.5, -3.3), vec(front ? -5.5 : 8.5, 1.7, 3.3));
    }
    if (section === 'differential') {
      const x = this.sim.driveLayout === 'fwd' ? -7 : 7;
      return new THREE.Box3(vec(x - 0.95, -1.05, -1.15), vec(x + 0.95, 1.15, 1.15));
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
    this.front.wheels.forEach(wheel => { wheel.visible = false; });
    this.rear.wheels.forEach(wheel => { wheel.visible = false; });
    this.wheels.forEach(({ wheel, steering, surface, axle, side }, i) => {
      steering.rotation.y = axle ? 0 : sim.turn * (side ? 0.24 : 0.29);
      const diff = axle ? this.rear : this.front;
      wheel.rotation.z = diff.demo ? diff.axles[side].rotation.z : -sim.wheelAngles[i];
      surface.material.color.setHex({ asphalt: 0x394548, wet: 0x375d78, ice: 0x9fcbd6, air: 0x18232b }[sim.surfaces[i]]);
      surface.visible = sim.surfaces[i] !== 'air' && steering.visible;
    });
    if (this.axlePinion) this.axlePinionRotor.rotation.x = sim.transmission === 'hybrid' ? sim.hybrid.mg2Angle : sim.outputAngle;
    const flow = this.layer === 'mechanical' && this.models.drive.showFlow;
    this.paths.forEach(({ path, key }) => updateFlow(path, key === 'input' ? sim.transmittedTorque : sim.traction.axleTorques[key === 'front' ? 0 : 1], this.clock, flow));
    // An overview shows the external drive path; the internal manual overlay
    // appears when inspecting the clutch or gearbox, where it remains legible.
    this.models.drive.flow.visible &&= flow && ['clutch', 'gearbox'].includes(this.section);
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
        const hide = !object.userData.lodEssential && threshold > 0 && Math.max(size.x, size.y, size.z) * s < threshold;
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

  dispose() { this.axleSpur?.removeFromParent(); this.front.dispose(); this.rear.dispose(); this.routing.dispose(); super.dispose(); }
}
