import { ModelGeometry } from './geometry.js';

export class TurboModel extends ModelGeometry {
  constructor(materials) {
    super(materials);
    this.group.position.y = 2;
    this.group.userData.part = 'turbo';
    this.rotors = [];
    [-1.3, 1.3].forEach((x, i) => {
      this.ring(0.96, 0.19, i ? 'intake' : 'exhaust', this.group, [x, 0, 0]);
      const rotor = this.subgroup(this.group, [x, 0, 0]);
      this.cylinder(0.22, 0.38, 'steel', rotor, [0, 0, 0], 'x');
      for (let j = 0; j < 12; j++) {
        const a = j / 12 * Math.PI * 2;
        const blade = this.box(0.24, 0.56, 0.06, 'steel', rotor, [0, Math.cos(a) * 0.51, Math.sin(a) * 0.51]);
        blade.rotation.set(a, 0, 0.3);
      }
      this.rotors.push(rotor);
    });
    this.cylinder(0.11, 2.9, 'brass', this.group, [0, 0, 0], 'x');
    this.paths = [
      this.curve([[-3.2, 1.4, 0], [-2.1, 1.4, 0], [-1.3, 0.85, 0]]),
      this.curve([[3.4, -0.65, 0], [2.3, 0, 0], [1.3, 0, 0]])
    ];
    this.paths.forEach((curve, i) => this.pipe(curve, 0.18, this.material({ color: i ? 0x69d5ee : 0xec886d, transparent: true, opacity: 0.25, depthWrite: false }), this.group));
    this.pipe(this.curve([[-1.3, 0, 0], [-2.3, 0, 0], [-3.3, -0.7, 0]]), 0.18, 'exhaust', this.group);
    this.pipe(this.curve([[1.3, 0.9, 0], [2.3, 1.5, 0], [3.4, 1.5, 0]]), 0.16, 'intake', this.group);
    this.puffs = [this.particles(15, 0xff9876, 0.048, this.group), this.particles(15, 0x6bdafa, 0.048, this.group)];
    this.anchor('Turbina · energia spalin', this.group, [-1.6, 1.65, 0], 'turbo', ['turbo']);
    this.anchor('Sprężarka · powietrze', this.group, [1.6, -1.4, 0], 'turbo', ['turbo']);
  }

  update(sim, dt) {
    this.rotors.forEach(rotor => { if (!sim.paused && sim.running && sim.turbo) rotor.rotation.x += dt * (1 + sim.boost * 28); });
    this.puffs.forEach((particles, i) => {
      particles.visible = sim.turbo && sim.running;
      for (let n = 0; n < 15; n++) this.particle(particles, n, this.paths[i].getPoint((sim.inputAngle / 3 + n / 15) % 1));
      particles.instanceMatrix.needsUpdate = true;
    });
  }
}
