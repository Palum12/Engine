import * as THREE from 'three';

export function bevelGearGeometry(teeth, mateTeeth, module, faceWidth, bore = 0.1) {
  const delta = Math.atan(teeth / mateTeeth);
  const outerDistance = module * Math.hypot(teeth, mateTeeth) / 2;
  const innerDistance = outerDistance - faceWidth;
  const root = module * 0.65;
  const back = module * 1.8;
  const sections = [];
  const count = teeth * 8;
  for (let n = 0; n <= count; n++) {
    const a = n / count * Math.PI * 2;
    const profile = [-1, -1, 0.75, 1, 1, 0.75, -1, -1][n % 8];
    const at = s => {
      const h = profile * root * s / outerDistance;
      return [s * Math.sin(delta) + h * Math.cos(delta), s * Math.cos(delta) - h * Math.sin(delta)];
    };
    const inner = at(innerDistance);
    const outer = at(outerDistance);
    const points = [[bore, innerDistance * Math.cos(delta) + back * 0.2], inner, outer, [outerDistance * Math.sin(delta) - root, outerDistance * Math.cos(delta) + back], [bore, outerDistance * Math.cos(delta) + back]];
    sections.push(points.map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]));
  }
  const positions = [];
  const triangle = (a, b, c) => positions.push(...a, ...c, ...b);
  for (let n = 0; n < count; n++) for (let k = 0; k < 5; k++) {
    const next = (k + 1) % 5;
    triangle(sections[n][k], sections[n + 1][k], sections[n][next]);
    triangle(sections[n + 1][k], sections[n + 1][next], sections[n][next]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.userData = { teeth, mateTeeth, module, bore, delta, outerDistance, innerDistance, pitchRadius: teeth * module / 2 };
  return geometry;
}

export function internalGearGeometry(teeth, radius, thickness, outer = radius + 0.2) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  const depth = Math.min(0.055, radius * 2 / teeth * 0.8);
  for (let i = 0; i <= teeth * 4; i++) {
    const a = -i / (teeth * 4) * Math.PI * 2;
    const r = radius + (i % 4 === 1 || i % 4 === 2 ? -depth : depth);
    if (!i) hole.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else hole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  hole.closePath();
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateY(Math.PI / 2);
  return geometry;
}
