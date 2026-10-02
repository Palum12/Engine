import { vec } from './geometry.js';

export function flowPath(model, points, color, parent, part, count = 5, radius = 0.035) {
  const curve = model.curve(points);
  const material = model.material({ color, metalness: 0.15, roughness: 0.6, transparent: true, opacity: 0.55 });
  const tube = model.pipe(curve, radius, material, parent, part);
  const arrows = model.arrows(count, color, parent, 0.23);
  return { curve, tube, arrows, model, value: 0, direction: 1 };
}

export function updateFlow(path, value, clock, enabled = true, threshold = 0.5) {
  path.value = value;
  path.direction = Math.sign(value) || 1;
  path.arrows.visible = enabled && Math.abs(value) > threshold;
  path.tube.visible = enabled;
  path.tube.material.opacity = Math.abs(value) > threshold ? 0.75 : 0.18;
  if (!path.arrows.visible) return;
  const rate = 0.08 + Math.min(0.16, Math.abs(value) / 200000);
  for (let i = 0; i < path.arrows.count; i++) {
    const t = ((i / path.arrows.count + clock * rate * path.direction) % 1 + 1) % 1;
    path.arrows.userData.ignorePick = true;
    const direction = path.curve.getTangentAt(t).multiplyScalar(path.direction);
    const matrix = path.arrows.instanceMatrix;
    const p = path.curve.getPointAt(t);
    path.arrows.userData.flowDirection = path.direction;
    const axis = vec(0, 1, 0);
    path.model.arrow(path.arrows, i, p, direction.lengthSq() > 0 ? direction : axis);
    matrix.needsUpdate = true;
  }
}

export function makeFlow(model, points, color, parent, part, count = 5, radius = 0.035) {
  const path = flowPath(model, points, color, parent, part, count, radius);
  return path;
}
