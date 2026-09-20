import * as THREE from 'three';
import { ModelGeometry, vec } from './geometry.js';

export class SystemsModel extends ModelGeometry {
  constructor(materials, engine) {
    super(materials);
    this.engine = engine;
    this.paths = [];
    this.showFlow = true;
    this.timing = this.subgroup(this.group, [0, 0, 0], 'timing');
    this.oil = this.subgroup(this.group, [0, 0, 0], 'oilPump');
    this.fuel = this.subgroup(this.group, [0, 0, 0], 'fuelPump');
    this.buildTiming();
    this.buildOil();
    this.buildFuel();
  }

  path(points, color, parent, part, enabled = () => true, radius = 0.045) {
    const curve = this.curve(points);
    const material = this.material({ color, transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.5 });
    const tube = this.pipe(curve, radius, material, parent, part);
    const arrows = this.arrows(Math.max(4, Math.min(22, Math.floor(curve.getLength() * 2))), color, parent, 0.14);
    this.paths.push({ curve, tube, arrows, enabled });
  }

  buildTiming() {
    const x = -this.engine.shaftEnd - 0.3;
    this.timingWheels = [];
    const centers = [{ y: 0.8, z: 0, r: 0.42, teeth: 24, speed: 1 }];
    this.engine.group.updateMatrixWorld(true);
    this.engine.camshafts.forEach(shaft => {
      const p = shaft.getWorldPosition(vec(0, 0, 0));
      centers.push({ y: p.y, z: p.z, r: 0.84, teeth: 48, speed: 0.5 });
    });
    centers.forEach(c => {
      const wheel = this.gear(c.teeth, c.r, 0.16, c.speed === 1 ? 'fuel' : 'intake', this.timing, [x, c.y, c.z], 'timing');
      this.cylinder(0.075, 0.75, 'steel', this.timing, [x + 0.4, c.y, c.z], 'x', 'timing');
      this.box(0.02, c.r * 0.7, 0.065, 'white', wheel, [-0.1, c.r * 0.5, 0], 'timing');
      this.timingWheels.push({ wheel, speed: c.speed });
    });
    const points = centers.flatMap(c => Array.from({ length: 64 }, (_, n) => {
      const a = n * Math.PI / 32;
      return { y: c.y + (c.r + 0.055) * Math.cos(a), z: c.z + (c.r + 0.055) * Math.sin(a) };
    })).sort((a, b) => a.y - b.y || a.z - b.z);
    const cross = (a, b, c) => (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y);
    const hull = sequence => {
      const result = [];
      for (const p of sequence) { while (result.length > 1 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop(); result.push(p); }
      return result.slice(0, -1);
    };
    const outline = [...hull(points), ...hull([...points].reverse())];
    this.timingCurve = new THREE.CurvePath();
    outline.forEach((p, i) => {
      const q = outline[(i + 1) % outline.length];
      this.timingCurve.add(new THREE.LineCurve3(vec(x, p.y, p.z), vec(x, q.y, q.z)));
    });
    this.belt = this.mesh(new THREE.TubeGeometry(this.timingCurve, 200, 0.06, 8, true), 'black', this.timing, [0, 0, 0], 'timing');
    this.links = new THREE.InstancedMesh(this.geometry('timingLink', () => new THREE.BoxGeometry(0.19, 0.10, 0.065)), this.material({ color: 0x758897, metalness: 0.65, roughness: 0.4 }), 100);
    this.links.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.links.frustumCulled = false;
    this.links.userData.part = 'timing';
    this.timing.add(this.links);
    const tensioner = this.cylinder(0.23, 0.20, 'steel', this.timing, [x, 2.5, 0.35], 'x', 'tensioner');
    this.box(0.12, 0.65, 0.10, 'dark', this.timing, [x + 0.18, 2.25, 0.35], 'tensioner');
    this.tensioner = tensioner;
    this.anchor('Wał korbowy · 24 zęby', this.timing, [x - 0.2, 0.15, 0.45], 'timing', ['timing', 'drive-detail']);
    this.anchor('Wałek rozrządu · 48 zębów', this.timing, [x - 0.2, centers[1].y + 1, centers[1].z], 'timing', ['timing', 'drive-detail']);
    this.anchor('Napinacz', this.timing, [x - 0.1, 2.5, 0.7], 'tensioner', ['timing']);
  }

  buildOil() {
    const h = this.engine.length / 2;
    const oilMaterial = this.material({ color: 0x53d9a0, transparent: true, opacity: 0.45, depthWrite: false });
    this.box(this.engine.length + 0.4, 0.16, 1.75, 'dark', this.oil, [0, -0.62, 0], 'sump');
    this.box(this.engine.length + 0.2, 0.24, 1.55, oilMaterial, this.oil, [0, -0.42, 0], 'sump');
    const pickup = this.cylinder(0.23, 0.08, 'steel', this.oil, [-h + 0.4, -0.24, 0], 'y', 'oilPump');
    for (let n = -2; n <= 2; n++) this.box(0.4, 0.012, 0.017, 'black', pickup, [0, 0.048, n * 0.06], 'oilPump');
    this.oilRotor = this.gear(12, 0.26, 0.16, 'fuel', this.oil, [-h - 0.8, 0.5, 0.85], 'oilPump');
    this.oilIdler = this.gear(12, 0.26, 0.16, 'steel', this.oil, [-h - 0.8, 0.5, 1.36], 'oilPump');
    this.cylinder(0.3, 0.68, 'intake', this.oil, [-h - 0.5, 1.5, 1.65], 'y', 'oilFilter');
    this.path([[-h + 0.4, -0.24, 0], [-h - 0.6, -0.15, 0.3], [-h - 0.8, 0.5, 0.85]], 0x70edb1, this.oil, 'oilPump');
    this.path([[-h - 0.8, 0.5, 1.36], [-h - 0.5, 0.7, 1.65], [-h - 0.5, 1.5, 1.65], [-h, 1.5, 1.2], [h, 1.5, 1.2]], 0x70edb1, this.oil, 'oilFilter');
    for (let n = 0; n <= this.engine.length / 1.8; n++) {
      const x = -h + n * 1.8;
      this.path([[x, 1.5, 1.2], [x, 0.8, 0.8], [x, 0.8, 0]], 0x70edb1, this.oil, 'oilGallery');
    }
    this.engine.camshafts.forEach(shaft => {
      const p = shaft.getWorldPosition(vec(0, 0, 0));
      this.path([[-h, 1.5, 1.2], [-h, p.y, p.z], [h, p.y, p.z]], 0x70edb1, this.oil, 'oilGallery');
      this.path([[h, p.y, p.z], [h + 0.55, 2.5, 0.8], [h + 0.55, -0.25, 0.8], [h, -0.42, 0]], 0x319b74, this.oil, 'oilReturn');
    });
    this.anchor('1 · Miska i smok olejowy', this.oil, [-h + 0.4, -0.9, 0.7], 'sump', ['oil', 'drive-detail']);
    this.anchor('2 · Pompa oleju', this.oil, [-h - 0.8, 0.3, 1.8], 'oilPump', ['oil']);
    this.anchor('3 · Filtr → magistrala', this.oil, [-h - 0.5, 2.1, 1.65], 'oilFilter', ['oil']);
    this.anchor('4 · Łożyska wału i rozrządu', this.oil, [1, 1.6, 1.4], 'oilGallery', ['oil']);
    this.anchor('5 · Spływ do miski', this.oil, [h + 0.55, 2.8, 0.8], 'oilReturn', ['oil']);
  }

  buildFuel() {
    const h = this.engine.length / 2;
    const x = -h - 2.3;
    this.box(1.6, 1.05, 1.1, this.material({ color: 0x7a909d, transparent: true, opacity: 0.23, depthWrite: false }), this.fuel, [x, 0.3, 1], 'fuelTank');
    this.box(1.4, 0.3, 0.9, this.material({ color: 0xf5c64f, transparent: true, opacity: 0.5, depthWrite: false }), this.fuel, [x, 0.02, 1], 'fuelTank');
    this.cylinder(0.15, 0.65, 'steel', this.fuel, [x, 0.25, 1], 'y', 'fuelPump');
    this.cylinder(0.16, 0.45, 'fuel', this.fuel, [x, 1.5, 1], 'y', 'fuelFilter');
    this.highPump = this.subgroup(this.fuel, [x, 4.8, 1], 'highPressurePump');
    this.box(0.45, 0.48, 0.45, 'steel', this.highPump, [0, 0, 0]);
    this.highPlunger = this.cylinder(0.08, 0.35, 'brass', this.highPump, [0, -0.34, 0]);
    this.carb = this.subgroup(this.fuel, [x, 3.1, 1], 'carburetor');
    const profile = [[0.33,-0.6],[0.33,-0.3],[0.16,0],[0.33,0.3],[0.33,0.6]].map(([r,y]) => new THREE.Vector2(r,y));
    this.mesh(new THREE.LatheGeometry(profile, 32, Math.PI / 2, Math.PI), this.material({ color: 0x8ba5b3, side: THREE.DoubleSide, metalness: 0.65, roughness: 0.4 }), this.carb, [0,0,0], 'carburetor');
    this.box(0.55, 0.6, 0.55, this.material({ color: 0x92a1a9, transparent: true, opacity: 0.22, depthWrite: false }), this.carb, [0.65, -0.15, 0], 'carburetor');
    this.box(0.43, 0.2, 0.43, 'fuel', this.carb, [0.65, -0.3, 0], 'carburetor');
    this.cylinder(0.15, 0.08, 'brass', this.carb, [0.65, -0.13, 0], 'y', 'carburetor');
    this.cylinder(0.025, 0.3, 'steel', this.carb, [0.75, 0.08, 0], 'y', 'carburetor');
    this.box(0.19,0.025,0.03,'steel',this.carb,[0.69,-0.06,0],'carburetor');
    this.anchor('Dysza paliwa',this.carb,[0.06,0.03,0.4],'carburetor',['fuel']);
    this.anchor('Pływak i zawór iglicowy',this.carb,[0.95,-0.15,0.3],'carburetor',['fuel']);
    this.anchor('Przepustnica · regulacja gazem',this.carb,[0,-0.65,0.35],'throttleBody',['fuel']);
    this.path([[0.65,-0.3,0],[0.45,0,0],[0.03,0,0]], 0xffcf49, this.carb, 'carburetor', sim => sim.injection === 'carb');
    this.carbThrottle = this.cylinder(0.29, 0.025, 'intake', this.carb, [0, -0.36, 0], 'y', 'throttleBody');
    this.throttleHousing = this.subgroup(this.fuel, [x,3.1,1], 'throttleBody');
    this.mesh(new THREE.CylinderGeometry(0.34,0.34,0.8,24,1,true,Math.PI/2,Math.PI),this.material({color:0x7896a5,side:THREE.DoubleSide,metalness:0.6,roughness:0.4}),this.throttleHousing);
    this.throttle = this.cylinder(0.31,0.035,'intake',this.throttleHousing,[0,0,0],'y','throttleBody');
    this.airFilter = this.cylinder(0.48, 0.35, 'white', this.fuel, [x, 4.0, 1], 'y', 'airFilter');
    this.path([[x,4,1],[x,3.4,1],[x,3.1,1],[x,2.5,1]], 0x69d5ff, this.fuel, 'airFilter');
    this.path([[x,0.3,1],[x,1.5,1],[x,2.2,1],[x+0.65,2.8,1]], 0xffcf49, this.fuel, 'fuelPump', sim => sim.injection === 'carb');
    this.path([[x,0.3,1],[x,1.5,1],[x,4.8,1],[-h,5.6,0.65],[h,5.6,0.65]], 0xffcf49, this.fuel, 'fuelPump', sim => sim.injection !== 'carb');
    this.path([[x,2.5,1],[x-0.6,2.3,0], [x-0.6,5.8,-0.8], [-h,5.8,-0.8],[h,5.8,-0.8]], 0x69d5ff, this.fuel, 'intake');
    this.path([[x,3.1,1],[x,2.5,1],[x-0.6,2.3,0],[x-0.6,5.8,-0.8],[-h,5.8,-0.8],[h,5.8,-0.8]], 0xffcf49, this.fuel, 'carburetor', sim => sim.injection === 'carb', 0.018);
    this.engine.cylinders.forEach(c => {
      const inlet = c.unit.localToWorld(vec(-0.87,4.71,-0.03));
      this.path([[c.layout.x,5.8,-0.8], inlet], 0x69d5ff, this.fuel, 'intake');
      const mpi = c.unit.localToWorld(c.mpiTip.clone());
      const gdi = c.unit.localToWorld(c.gdiTip.clone());
      this.path([[c.layout.x,5.6,0.65],mpi],0xffcf49,this.fuel,'injection',sim=>sim.injection==='mpi');
      this.path([[c.layout.x,5.6,0.65],gdi],0xffac40,this.fuel,'injection',sim=>sim.injection==='gdi');
      this.path([[c.layout.x,5.8,-0.8],inlet],0xffcf49,this.fuel,'carburetor',sim=>sim.injection==='carb',0.018);
    });
    this.anchor('1 · Zbiornik i pompa paliwa',this.fuel,[x,-0.55,1],'fuelPump',['fuel','drive-detail']);
    this.anchor('2 · Filtr paliwa',this.fuel,[x,1.6,1.4],'fuelFilter',['fuel']);
    this.anchor('Pompa wysokiego ciśnienia · GDI',this.highPump,[0,0.65,0],'highPressurePump',['fuel']);
    this.anchor('Gaźnik · zwężka, dysza, pływak',this.carb,[0.6,0.7,0.3],'carburetor',['fuel']);
    this.anchor('Filtr powietrza',this.fuel,[x-0.5,4.3,1],'airFilter',['fuel']);
    this.anchor('Kolektor → zawory',this.fuel,[0,6.2,-0.8],'intake',['fuel']);
  }

  setView(mode, section = 'all', isolate = false) {
    this.group.visible = ['engine','drive-detail','timing','oil','fuel'].includes(mode);
    this.timing.visible = mode === 'engine' || mode === 'timing' || mode === 'drive-detail' && (!isolate || ['engine','timing','all'].includes(section));
    this.oil.visible = mode === 'oil' || mode === 'drive-detail' && (!isolate || ['oil','all'].includes(section));
    this.fuel.visible = mode === 'fuel' || mode === 'drive-detail' && (!isolate || ['fuel','all'].includes(section));
  }

  bounds(section) {
    this.group.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(this[section] || this.group);
  }

  update(sim) {
    if (!this.group.visible) return;
    const a = sim.angle * Math.PI / 180;
    this.timingWheels.forEach(({wheel,speed}) => { wheel.rotation.x = a * speed; });
    this.belt.visible = sim.timing === 'belt';
    this.links.material.color.setHex(sim.timing === 'chain' ? 0xb5c8d6 : 0x607382);
    const length = this.timingCurve.getLength();
    for (let n = 0; n < 100; n++) {
      const t = ((n / 100 + a * 0.475 / length) % 1 + 1) % 1;
      const p = this.timingCurve.getPoint(t);
      const tangent = this.timingCurve.getTangent(t);
      this.matrix.compose(p,new THREE.Quaternion().setFromUnitVectors(vec(0,1,0),tangent),vec(1,sim.timing === 'belt' ? 0.45 : 1,1));
      this.links.setMatrixAt(n,this.matrix);
    }
    this.links.instanceMatrix.needsUpdate = true;
    this.oilRotor.rotation.x = a;
    this.oilIdler.rotation.x = -a;
    this.highPump.visible = sim.injection === 'gdi';
    this.highPlunger.position.y = -0.34 + Math.sin(a * 0.5) * 0.07;
    this.carb.visible = sim.injection === 'carb';
    this.throttleHousing.visible = sim.injection !== 'carb';
    this.throttle.rotation.z = sim.throttle * Math.PI / 2;
    this.carbThrottle.rotation.z = sim.throttle * Math.PI / 2;
    this.paths.forEach(({curve,tube,arrows,enabled}) => {
      tube.visible = enabled(sim);
      arrows.visible = tube.visible && sim.running && this.showFlow;
      if (!arrows.visible) return;
      const length = curve.getLength();
      for (let n = 0; n < arrows.count; n++) {
        const t = ((n / arrows.count + a / (length * 3)) % 1 + 1) % 1;
        this.arrow(arrows,n,curve.getPointAt(t),curve.getTangentAt(t));
      }
      arrows.instanceMatrix.needsUpdate = true;
    });
  }
}
