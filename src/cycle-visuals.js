export const smooth = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const cycleVisuals = angle => {
  const degrees = ((angle % 720) + 720) % 720;
  const burned = smooth(348, 405, degrees);
  return {
    degrees, burned,
    intake: smooth(0, 22, degrees) * (1 - smooth(154, 180, degrees)),
    injection: smooth(230, 250, degrees) * (1 - smooth(320, 345, degrees)),
    exhaust: smooth(540, 566, degrees) * (1 - smooth(695, 720, degrees)),
    flame: smooth(348, 365, degrees) * (1 - smooth(385, 430, degrees)),
    heat: smooth(348, 385, degrees) * (1 - smooth(430, 620, degrees)),
    charge: smooth(0, 150, degrees) * (1 - smooth(555, 720, degrees)),
    spark: smooth(345, 351, degrees) * (1 - smooth(357, 366, degrees))
  };
};

const fraction = value => value - Math.floor(value);
const noise = seed => fraction(Math.sin(seed * 127.1 + 311.7) * 43758.5453);

export const chargeSample = (angle, index, count = 64) => {
  const state = cycleVisuals(angle);
  const a = noise(index + 1) * Math.PI * 2 + 0.18 * Math.sin(state.degrees * Math.PI / 360 + index * 0.61);
  const radius = 0.45 * Math.sqrt(0.05 + 0.95 * noise(index + 101));
  const level = 0.07 + 0.86 * noise(index + 251);
  const enter = smooth(index / count * 120, index / count * 120 + 32, state.degrees);
  const leave = smooth(550 + index / count * 120, 590 + index / count * 120, state.degrees);
  const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
  const distance = Math.min(1, Math.hypot(x, (1 - level) * 0.8, z - 0.3) / 1.3);
  return { x, z, level, visibility: enter * (1 - leave),
    burned: smooth(348 + distance * 23, 370 + distance * 32, state.degrees) };
};
