// A sprung axle: body heave/roll, two unsprung wheels, compliant unilateral tyres.
// All distances and forces are SI; the render model enlarges the assembly.
export const SUSPENSION_TYPES = Object.freeze({
  macpherson: { name: 'MacPherson', description: 'Dolny wahacz i kolumna prowadzą koło. Sprężyna otacza amortyzator w kolumnie.' },
  multilink: { name: 'Wielowahaczowe', description: 'Pięć oddzielnych łączników prowadzi zwrotnicę. Sprężyna i amortyzator podtrzymują nadwozie.' },
  leaf: { name: 'Resory piórowe · sztywna oś', description: 'Dwa resory utrzymują wspólną belkę osi. Ruch jednego koła przechyla całą oś.' },
  pushrod: { name: 'Pushrod · podwójne wahacze', description: 'Wahacze prowadzą koło. Popychacz ściskany przy ugięciu obraca dźwignię i naciska sprężynę wewnątrz nadwozia.' },
  pullrod: { name: 'Pullrod · podwójne wahacze', description: 'Wahacze prowadzą koło. Cięgno rozciągane przy ugięciu obraca nisko osadzoną dźwignię i naciska sprężynę.' }
});

export const ROAD_TYPES = Object.freeze({
  flat: 'Równa droga', bumps: 'Garby pod oboma kołami', holes: 'Dołki pod oboma kołami',
  waves: 'Falista nawierzchnia', split: 'Garby i dołki · osobno L/P'
});

const G = 9.81;
const MASS = 720;
const TRACK_HALF = 1.05;
const WHEEL_RADIUS = 0.33;
const BODY_HEIGHT = 1.05;
const TIRE_RATE = 190000;
const TIRE_DAMPING = 420;
const BASE_RATE = 25000;
const BASE_DAMPING = 1800;
const BODY_INERTIA = 490;
const AXLE_INERTIA = 110;
const BUMP_TRAVEL = 0.22;
const REBOUND_TRAVEL = 0.23;
const MAX_ROLL = 0.25;
const STEP = 1 / 600;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function hump(distance, center, width) {
  const phase = ((distance - center + 4.5) % 9 + 9) % 9 - 4.5;
  if (Math.abs(phase) >= width / 2) return [0, 0];
  const angle = phase * Math.PI * 2 / width;
  return [(1 + Math.cos(angle)) / 2, -Math.sin(angle) * Math.PI / width];
}

/** Height and slope of the same road profile used by tyres and visible mesh. */
export function suspensionRoad(distance, side, road = 'bumps', amplitude = 0.08) {
  if (road === 'flat') return { height: 0, slope: 0 };
  if (road === 'waves') {
    const angle = distance * Math.PI * 2 / 3 + (side ? Math.PI / 3 : 0);
    return { height: amplitude * Math.sin(angle), slope: amplitude * Math.PI * 2 / 3 * Math.cos(angle) };
  }
  const center = road === 'split' && side ? 4.4 : 3;
  const [height, slope] = hump(distance, center, road === 'holes' ? 1.1 : 1.45);
  const sign = road === 'holes' || road === 'split' && side ? -1 : 1;
  return { height: height * amplitude * sign, slope: slope * amplitude * sign };
}

export class SuspensionSimulation {
  constructor() {
    this.type = 'macpherson'; this.road = 'bumps'; this.speed = 18;
    this.spring = 1; this.damping = 1; this.amplitude = 0.08;
    this.paused = false;
    this.reset();
  }

  get wheelRadius() { return WHEEL_RADIUS; }
  get trackHalf() { return TRACK_HALF; }
  get wheelMass() { return this.type === 'leaf' ? 65 : 42; }
  get wheelRate() { return BASE_RATE * this.spring; }
  get dampingRate() { return BASE_DAMPING * this.damping; }
  get restLength() { return BODY_HEIGHT - this.staticWheelHeight + MASS * G / (2 * this.wheelRate); }
  get staticWheelHeight() { return WHEEL_RADIUS - (MASS / 2 + this.wheelMass) * G / TIRE_RATE; }

  setType(id) { if (!SUSPENSION_TYPES[id]) return false; this.type = id; this.reset(); return true; }
  setRoad(id) { if (!(id in ROAD_TYPES)) return false; this.road = id; this.reset(); return true; }
  setSpeed(value) { if (!Number.isFinite(+value)) return false; this.speed = clamp(+value, 0, 70); return true; }
  setSpring(value) { if (!Number.isFinite(+value)) return false; this.spring = clamp(+value, 0.4, 2.5); return true; }
  setDamping(value) { if (!Number.isFinite(+value)) return false; this.damping = clamp(+value, 0, 3); return true; }
  setAmplitude(value) { if (!Number.isFinite(+value)) return false; this.amplitude = clamp(+value, 0, 0.18); return true; }

  reset() {
    this.time = this.distance = this.roll = this.rollVelocity = this.bodyVelocity = 0;
    this.bodyHeight = BODY_HEIGHT;
    this.axleHeight = this.staticWheelHeight; this.axleVelocity = this.axleRoll = this.axleRollVelocity = 0;
    this.wheels = [0, 1].map(() => ({ height: this.staticWheelHeight, velocity: 0, roadHeight: 0,
      compression: MASS * G / (2 * this.wheelRate), travel: 0, springForce: MASS * G / 2,
      damperForce: 0, tireForce: (MASS / 2 + this.wheelMass) * G, contact: true, angle: 0 }));
    this.refreshTelemetry();
  }

  roadAt(distance, side = 0) { return suspensionRoad(distance, side, this.road, this.amplitude); }

  update(dt) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    const bounded = Math.min(dt, 0.25);
    const count = Math.ceil(bounded / STEP);
    const step = bounded / count;
    for (let index = 0; index < count; index++) this.integrate(step);
    this.refreshTelemetry();
  }

  forces(side) {
    const wheel = this.wheels[side], sign = side ? 1 : -1;
    const body = this.bodyHeight + sign * TRACK_HALF * Math.sin(this.roll);
    const velocity = this.bodyVelocity + sign * TRACK_HALF * Math.cos(this.roll) * this.rollVelocity;
    const length = body - wheel.height;
    const springForce = this.wheelRate * (this.restLength - length);
    const damperForce = this.dampingRate * (wheel.velocity - velocity);
    // Progressive bump/rebound stops. They prevent unlimited suspension travel.
    const relative = length - (BODY_HEIGHT - this.staticWheelHeight);
    const stops = relative < -BUMP_TRAVEL ? 160000 * (-BUMP_TRAVEL - relative) : relative > REBOUND_TRAVEL ? -100000 * (relative - REBOUND_TRAVEL) : 0;
    const road = this.roadAt(this.distance, side);
    const overlap = WHEEL_RADIUS + road.height - wheel.height;
    const tireForce = overlap > 0 ? Math.max(0, TIRE_RATE * overlap + TIRE_DAMPING * (road.slope * this.speed / 3.6 - wheel.velocity)) : 0;
    return { springForce, damperForce, support: springForce + damperForce + stops, tireForce, road, length };
  }

  integrate(dt) {
    const forces = [this.forces(0), this.forces(1)];
    this.bodyVelocity += ((forces[0].support + forces[1].support) / MASS - G) * dt;
    this.rollVelocity += ((forces[1].support - forces[0].support) * TRACK_HALF * Math.cos(this.roll) - 250 * this.rollVelocity) / BODY_INERTIA * dt;
    this.bodyHeight += this.bodyVelocity * dt;
    this.roll += this.rollVelocity * dt;
    if (this.type === 'leaf') {
      // One rigid axle has heave and roll DOFs; wheel centres remain on its beam.
      const net = forces.map(force => force.tireForce - force.support - this.wheelMass * G);
      this.axleVelocity += (net[0] + net[1]) / (this.wheelMass * 2) * dt;
      this.axleRollVelocity += (net[1] - net[0]) * TRACK_HALF * Math.cos(this.axleRoll) / AXLE_INERTIA * dt;
      this.axleHeight += this.axleVelocity * dt;
      this.axleRoll += this.axleRollVelocity * dt;
      this.refreshAxleWheels();
    } else this.wheels.forEach((wheel, side) => {
      wheel.velocity += (forces[side].tireForce - forces[side].support - this.wheelMass * G) / this.wheelMass * dt;
      wheel.height += wheel.velocity * dt;
    });
    this.constrainTravel();
    this.distance += this.speed / 3.6 * dt; this.time += dt;
    for (const wheel of this.wheels) wheel.angle += this.speed / 3.6 / WHEEL_RADIUS * dt;
  }

  refreshAxleWheels() {
    this.wheels.forEach((wheel, side) => {
      const sign = side ? 1 : -1;
      wheel.height = this.axleHeight + sign * TRACK_HALF * Math.sin(this.axleRoll);
      wheel.velocity = this.axleVelocity + sign * TRACK_HALF * Math.cos(this.axleRoll) * this.axleRollVelocity;
    });
  }

  constrainRoll() {
    let corrected = false;
    // This axle lesson has vertical wheel guides, not lateral motion or a
    // rollover model. Guide stops bound its body/axle roll to the linkage range.
    for (const [angle, velocity] of [['roll', 'rollVelocity'], ...(this.type === 'leaf' ? [['axleRoll', 'axleRollVelocity']] : [])]) {
      if (Math.abs(this[angle]) < MAX_ROLL - 1e-10) continue;
      if (Math.abs(this[angle]) > MAX_ROLL) {
        this[angle] = clamp(this[angle], -MAX_ROLL, MAX_ROLL);
        corrected = true;
      }
      if (this[angle] * this[velocity] > 0) { this[velocity] = 0; corrected = true; }
    }
    if (corrected && this.type === 'leaf') this.refreshAxleWheels();
    return corrected;
  }

  constrainTravel() {
    const rest = BODY_HEIGHT - this.staticWheelHeight;
    const minimum = rest - BUMP_TRAVEL, maximum = rest + REBOUND_TRAVEL;
    const rigid = this.type === 'leaf';
    // Mechanical travel stops act between the body and wheel/axle. Distribute
    // their reaction over both masses and roll inertias; never move a leaf wheel
    // separately from its rigid axle or create an upward road-contact force.
    for (let iteration = 0; iteration < 8; iteration++) {
      let corrected = this.constrainRoll();
      for (let side = 0; side < 2; side++) {
        const wheel = this.wheels[side], sign = side ? 1 : -1;
        let bodyLever = sign * TRACK_HALF * Math.cos(this.roll);
        let axleLever = sign * TRACK_HALF * Math.cos(this.axleRoll);
        const inverseWheelMass = rigid ? 1 / (this.wheelMass * 2) : 1 / this.wheelMass;
        let inverseMass = 1 / MASS + bodyLever * bodyLever / BODY_INERTIA + inverseWheelMass + (rigid ? axleLever * axleLever / AXLE_INERTIA : 0);
        const length = this.bodyHeight + sign * TRACK_HALF * Math.sin(this.roll) - wheel.height;
        const error = length < minimum ? length - minimum : length > maximum ? length - maximum : 0;
        if (Math.abs(error) > 1e-9) {
          const reaction = -error / inverseMass;
          this.bodyHeight += reaction / MASS;
          this.roll += reaction * bodyLever / BODY_INERTIA;
          if (rigid) {
            this.axleHeight -= reaction * inverseWheelMass;
            this.axleRoll -= reaction * axleLever / AXLE_INERTIA;
            this.refreshAxleWheels();
          } else wheel.height -= reaction * inverseWheelMass;
          bodyLever = sign * TRACK_HALF * Math.cos(this.roll);
          axleLever = sign * TRACK_HALF * Math.cos(this.axleRoll);
          inverseMass = 1 / MASS + bodyLever * bodyLever / BODY_INERTIA + inverseWheelMass + (rigid ? axleLever * axleLever / AXLE_INERTIA : 0);
          corrected = true;
        }
        const direction = length <= minimum + 1e-8 ? -1 : length >= maximum - 1e-8 ? 1 : 0;
        const relativeVelocity = this.bodyVelocity + bodyLever * this.rollVelocity - wheel.velocity;
        if (direction && direction * relativeVelocity > 0) {
          // Inelastic stop: remove only motion further into the limit. Motion
          // away from it remains free, preserving momentum without adding energy.
          const impulse = -relativeVelocity / inverseMass;
          this.bodyVelocity += impulse / MASS;
          this.rollVelocity += impulse * bodyLever / BODY_INERTIA;
          if (rigid) {
            this.axleVelocity -= impulse * inverseWheelMass;
            this.axleRollVelocity -= impulse * axleLever / AXLE_INERTIA;
            this.refreshAxleWheels();
          } else wheel.velocity -= impulse * inverseWheelMass;
        }
      }
      if (!corrected) break;
    }
    this.constrainRoll();
  }

  refreshTelemetry() {
    this.wheels.forEach((wheel, side) => {
      const force = this.forces(side);
      wheel.roadHeight = force.road.height;
      wheel.compression = this.restLength - force.length;
      wheel.travel = (BODY_HEIGHT - this.staticWheelHeight) - force.length;
      wheel.springForce = force.springForce; wheel.damperForce = force.damperForce;
      wheel.tireForce = force.tireForce; wheel.contact = force.tireForce > 1;
    });
  }
}
