import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Simulation, GEAR_RATIOS } from '../src/simulation.js';
import { EngineModel } from '../src/models/engine-model.js';
import { SystemsModel } from '../src/models/systems-model.js';
import { DrivetrainModel } from '../src/models/drivetrain-model.js';
import { FinalDriveModel } from '../src/models/final-drive-model.js';

const materials = () => Object.fromEntries(['steel','dark','block','brass','black','intake','exhaust','fuel','white'].map(name => [name,new THREE.MeshStandardMaterial()]));
const advance = (sim,seconds) => { for(let t=0;t<seconds;t+=0.01) sim.update(0.01); };

test('shifting passes through neutral and synchronization before locking a single ratio', () => {
  const sim = new Simulation();
  sim.speed = 10;
  sim.clutch = 1;
  sim.shift(3);
  assert.equal(sim.gear,0);
  assert.equal(sim.shiftStage,'release');
  assert.equal(sim.shift(2),false);
  advance(sim,1.5);
  assert.equal(sim.shiftStage,'synchronize');
  assert.equal(sim.gear,0);
  assert.equal(sim.transmittedTorque,0);
  const target = sim.speed / 0.31 * GEAR_RATIOS[3] * 3.9;
  assert.ok(Math.abs(sim.inputOmega - target) < 1);
  advance(sim,0.5);
  assert.equal(sim.shiftStage,'engage');
  advance(sim,0.5);
  assert.equal(sim.gear,3);
  assert.equal(sim.shiftTarget,null);
  sim.shift(0);
  advance(sim,2.5);
  assert.equal(sim.gear,0);
});

test('pause freezes the shift and reset clears all pending and cornering state', () => {
  const sim = new Simulation();
  sim.clutch = 1;
  sim.shift(2);
  sim.paused = true;
  advance(sim,4);
  assert.equal(sim.shiftProgress,0);
  sim.turn = 1;
  sim.reset();
  assert.equal(sim.shiftTarget,null);
  assert.equal(sim.turn,0);
});

test('clutch friction faces touch when released and separate on both sides when pressed', () => {
  const m=materials(), model=new DrivetrainModel(m), sim=new Simulation();
  model.setView('clutch');
  model.update(sim,true);
  assert.ok(Math.abs(model.disc.position.x - 0.0475 - 0.1525)<1e-8);
  assert.ok(Math.abs(model.pressure.position.x - 0.06 - model.disc.position.x - 0.0475)<1e-8);
  sim.clutch=1; model.update(sim,true);
  assert.ok(model.disc.position.x - 0.0475 > 0.1525);
  assert.ok(model.pressure.position.x - 0.06 > model.disc.position.x + 0.0475);
  assert.ok(model.contacts.every(contact=>!contact.visible));
  model.dispose();Object.values(m).forEach(m=>m.dispose());
});

test('differential conserves mean wheel speed, spins satellites on turns and pauses the bench', () => {
  const m=materials(), model=new FinalDriveModel(m), sim=new Simulation();
  model.demo=true;
  sim.turn=1;
  model.update(sim,true,1);
  assert.ok(model.leftSpeed<model.rightSpeed);
  assert.equal((model.leftSpeed+model.rightSpeed)/2,model.carrierSpeed);
  assert.ok(model.planets.every(({planet})=>Math.abs(planet.rotation.y)>0));
  const a=model.axles.map(axle=>axle.rotation.z);
  sim.paused=true;model.update(sim,true,1);
  assert.deepEqual(model.axles.map(axle=>axle.rotation.z),a);
  sim.paused=false;sim.turn=-1;model.update(sim,true,1);
  assert.ok(model.leftSpeed>model.rightSpeed);
  model.dispose();Object.values(m).forEach(m=>m.dispose());
});

for(const id of ['r4','v6','v12']) test(`${id}: crank journals clear rod planes; fuel and flame stay above the piston; timing is 2:1`,()=>{
  const m=materials(),engine=new EngineModel(m,id),systems=new SystemsModel(m,engine),sim=new Simulation();
  sim.setEngine(id);
  engine.cylinders.forEach(c=>{
    engine.crankshaft.children.filter(child=>child.isMesh && child.geometry.type==='CylinderGeometry').forEach(journal=>{
      const half=journal.geometry.parameters.height/2;
      assert.ok(c.layout.x<journal.position.x-half || c.layout.x>journal.position.x+half);
    });
  });
  for(const angle of [30,270,365,410,450,550,630]){
    sim.angle=angle;sim.injection='carb';engine.update(sim,true);systems.update(sim);
    engine.cylinders.forEach(c=>{
      assert.equal(c.mpi.visible,false);assert.equal(c.gdi.visible,false);
      const matrix=new THREE.Matrix4();
      for(let n=0;n<c.fuel.count;n++){
        c.fuel.getMatrixAt(n,matrix);
        assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).y>c.piston.position.y+0.25);
      }
      if(c.flames.visible)c.flames.children.forEach(plume=>assert.ok(plume.position.y-plume.scale.y/2>=c.piston.position.y+0.25));
    });
    assert.equal(systems.timingWheels[0].wheel.rotation.x,2*systems.timingWheels[1].wheel.rotation.x);
  }
  sim.injection='gdi';systems.update(sim);assert.equal(systems.highPump.visible,true);assert.equal(systems.carb.visible,false);
  sim.injection='carb';systems.update(sim);assert.equal(systems.highPump.visible,false);assert.equal(systems.carb.visible,true);
  systems.dispose();engine.dispose();Object.values(m).forEach(m=>m.dispose());
});
