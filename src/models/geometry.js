import * as THREE from 'three';

export const vec = (x, y, z) => new THREE.Vector3(x, y, z);
export const UP = vec(0, 1, 0);
export const PHASE_COLORS = [0x68c9ed, 0xbd9aff, 0xffb34c, 0xed7e77];

export class ModelGeometry {
  constructor(materials) {
    this.materials = materials;
    this.group = new THREE.Group();
    this.geometries = new Set();
    this.ownedMaterials = new Set();
    this.cache = new Map();
    this.anchors = [];
    this.matrix = new THREE.Matrix4();
  }

  material(options, basic = false) {
    const result = basic ? new THREE.MeshBasicMaterial(options) : new THREE.MeshStandardMaterial(options);
    this.ownedMaterials.add(result);
    return result;
  }

  geometry(key, factory) {
    if (!this.cache.has(key)) {
      const geometry = factory();
      this.geometries.add(geometry);
      this.cache.set(key, geometry);
    }
    return this.cache.get(key);
  }

  mesh(geometry, material, parent, position = [0, 0, 0], part) {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? this.materials[material] : material);
    mesh.position.set(...position);
    if (part) mesh.userData.part = part;
    parent.add(mesh);
    return mesh;
  }

  subgroup(parent = this.group, position = [0, 0, 0], part) {
    const group = new THREE.Group();
    group.position.set(...position);
    if (part) group.userData.part = part;
    parent.add(group);
    return group;
  }

  box(w, h, d, material, parent, position, part) {
    return this.mesh(this.geometry(`b:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)), material, parent, position, part);
  }

  cylinder(r, height, material, parent, position, axis = 'y', part, segments = 32) {
    const mesh = this.mesh(this.geometry(`c:${r}:${height}:${segments}`, () => new THREE.CylinderGeometry(r, r, height, segments)), material, parent, position, part);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  ring(radius, tube, material, parent, position, axis = 'x', part) {
    const mesh = this.mesh(this.geometry(`r:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 8, 40)), material, parent, position, part);
    if (axis === 'x') mesh.rotation.y = Math.PI / 2;
    if (axis === 'y') mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  annulus(outer, inner, thickness, material, parent, position, part) {
    const geometry = this.geometry(`a:${outer}:${inner}:${thickness}`, () => {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const result = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 40 });
      result.translate(0, 0, -thickness / 2);
      result.rotateY(Math.PI / 2);
      return result;
    });
    return this.mesh(geometry, material, parent, position, part);
  }

  gear(teeth, radius, thickness, material, parent, position = [0, 0, 0], part = 'gearbox') {
    const group = this.subgroup(parent, position, part);
    const geometry = this.geometry(`g:${teeth}:${radius}:${thickness}`, () => {
      const shape = new THREE.Shape();
      const toothDepth = Math.min(0.075, radius * 2 / teeth * 0.7);
      for (let i = 0; i <= teeth * 4; i++) {
        const a = i / (teeth * 4) * Math.PI * 2;
        const r = radius + (i % 4 === 1 || i % 4 === 2 ? toothDepth : -toothDepth);
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape.closePath();
      const hole = new THREE.Path();
      hole.absarc(0, 0, Math.min(0.16, radius * 0.33), 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 16 });
      geometry.translate(0, 0, -thickness / 2);
      geometry.rotateY(Math.PI / 2);
      return geometry;
    });
    group.userData.face = this.mesh(geometry, material, group);
    this.annulus(radius * 0.7, radius * 0.6, thickness + 0.035, 'dark', group);
    this.annulus(Math.min(0.27, radius * 0.45), Math.min(0.15, radius * 0.3), thickness + 0.09, 'steel', group);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      this.cylinder(Math.min(0.07, radius * 0.1), thickness + 0.025, 'black', group, [0, Math.cos(a) * radius * 0.43, Math.sin(a) * radius * 0.43], 'x');
    }
    return group;
  }

  curve(points) { return new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? vec(...p) : p.clone())); }

  pipe(curve, radius, material, parent, part) {
    return this.mesh(new THREE.TubeGeometry(curve, 32, radius, 12, false), material, parent, [0, 0, 0], part);
  }

  between(mesh, from, to) {
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.scale.y = from.distanceTo(to);
    mesh.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
  }

  particles(count, color, radius, parent) {
    const geometry = this.geometry(`p:${radius}`, () => new THREE.SphereGeometry(radius, 7, 5));
    const material = this.material({ color, toneMapped: false }, true);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.userData.ignorePick = true;
    parent.add(mesh);
    return mesh;
  }

  particle(mesh, i, p) {
    this.matrix.makeTranslation(p.x, p.y, p.z);
    mesh.setMatrixAt(i, this.matrix);
  }

  arrows(count, color, parent, size = 0.16) {
    const geometry = this.geometry(`arrow:${size}`, () => new THREE.ConeGeometry(size * 0.36, size, 8));
    const mesh = new THREE.InstancedMesh(geometry, this.material({ color, toneMapped: false }, true), count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.userData.ignorePick = true;
    parent.add(mesh);
    return mesh;
  }

  arrow(mesh, index, point, direction) {
    this.matrix.compose(point, new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize()), vec(1, 1, 1));
    mesh.setMatrixAt(index, this.matrix);
  }

  anchor(text, parent, position, part, views, cylinder) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...position);
    anchor.userData.part = part;
    parent.add(anchor);
    this.anchors.push({ text, anchor, part, views, cylinder });
    return anchor;
  }

  dispose() {
    this.group.removeFromParent();
    this.geometries.forEach(g => g.dispose());
    this.ownedMaterials.forEach(m => m.dispose());
  }
}
