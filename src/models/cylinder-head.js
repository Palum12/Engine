import * as THREE from 'three';

// A cutaway casting around the existing valves and ports, not a floating cover.
export function buildCylinderHead(g, unit) {
  const group = g.subgroup(unit, [0, 0, 0], 'cylinderHead');
  const alloy = g.headAlloy;
  const deck = new THREE.Shape();
  deck.moveTo(-0.79, -0.72); deck.lineTo(0.79, -0.72);
  deck.lineTo(0.79, 0.72); deck.lineTo(-0.79, 0.72); deck.closePath();
  for (const x of [-0.27, 0.27]) for (const z of [-0.21, 0.21]) {
    const hole = new THREE.Path(); hole.absarc(x, z, 0.155, 0, Math.PI * 2, true); deck.holes.push(hole);
    const seat = g.annulus(0.172, 0.14, 0.026, 'steel', group, [x, 4.22, z], 'valveSeat');
    seat.rotation.z = Math.PI / 2;
    const guide = g.annulus(0.065, 0.033, 0.21, 'brass', group, [x, 4.66, z], 'valveGuide');
    guide.rotation.z = Math.PI / 2;
  }
  const plugHole = new THREE.Path(); plugHole.absarc(0, 0.3, 0.078, 0, Math.PI * 2, true); deck.holes.push(plugHole);
  const deckGeometry = g.geometry('headDeck', () => {
    const geometry = new THREE.ExtrudeGeometry(deck, { depth: 0.11, bevelEnabled: false, curveSegments: 20 });
    geometry.rotateX(Math.PI / 2); return geometry;
  });
  const deckMesh = g.mesh(deckGeometry, alloy, group, [0, 4.36, 0], 'cylinderHead');
  const gasket = g.annulus(0.78, 0.56, 0.025, 'exhaust', group, [0, 4.245, 0], 'headGasket');
  gasket.rotation.z = Math.PI / 2;
  const panels = [g.box(1.58, 0.66, 0.14, alloy, group, [0, 4.64, -0.72], 'cylinderHead')];
  // Split side walls leave the intake/exhaust channels visible in the cutaway.
  for (const x of [-0.74, 0.74]) for (const z of [-0.53, 0.53]) {
    panels.push(g.box(0.13, 0.66, 0.28, alloy, group, [x, 4.64, z], 'cylinderHead'));
  }
  const front = g.box(1.58, 0.66, 0.14, alloy, group, [0, 4.64, 0.72], 'cylinderHead');
  panels.forEach(panel => { panel.visible = false; });
  const chamberRim = g.mesh(g.geometry('headChamberRim', () => new THREE.CylinderGeometry(0.56, 0.61, 0.1, 40, 1, true, Math.PI / 2, Math.PI)), alloy, group, [0, 4.19, 0], 'cylinderHead');
  const coolant = g.material({ color: 0x448a9b, metalness: 0.25, roughness: 0.6 });
  g.box(1.3, 0.08, 0.1, coolant, group, [0, 4.7, -0.635], 'coolantJacket');
  for (const x of [-0.62, 0.62]) {
    g.cylinder(0.045, 0.68, 'steel', group, [x, 4.59, -0.51], 'y', 'headBolt', 12);
    g.cylinder(0.08, 0.06, 'dark', group, [x, 4.96, -0.51], 'y', 'headBolt', 6);
  }
  g.anchor('Głowica · komora, zawory i kanały', group, [0, 5.25, 0.8], 'cylinderHead', ['cylinder']);
  return { group, front, panels, deck: deckMesh, gasket, chamberRim };
}

// One continuous casting joins the cylinder chambers. Its open front is a cut
// through the same body, so the guides and coloured ports remain identifiable.
export function buildContinuousHead(g, root, cylinders) {
  g.group.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  for (const c of cylinders) for (const x of [-0.79, 0.79]) for (const y of [4.31, 4.97]) for (const z of [-0.79, 0.79]) {
    bounds.expandByPoint(root.worldToLocal(c.unit.localToWorld(new THREE.Vector3(x, y, z))));
  }
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const group = g.subgroup(root, [0, 0, 0], 'cylinderHead');
  group.userData.continuousCasting = true;
  const rear = g.box(size.x, size.y, 0.2, g.headAlloy, group, [center.x, center.y, bounds.min.z + 0.1], 'cylinderHead');
  const front = g.box(size.x, size.y, 0.2, g.headAlloy, group, [center.x, center.y, bounds.max.z - 0.1], 'cylinderHead');
  const rim = g.box(size.x, 0.11, 0.2, g.headCutFace, group, [center.x, bounds.min.y + 0.055, bounds.max.z - 0.1], 'cylinderHead');
  const endWalls = [bounds.min.x + 0.09, bounds.max.x - 0.09].map(x => {
    const wall = g.box(0.18, size.y, size.z, g.headAlloy, group, [x, center.y, center.z], 'cylinderHead');
    // A brighter machined edge makes the cut surface readable from the front.
    g.box(0.18, size.y, 0.045, g.headCutFace, group, [x, center.y, bounds.max.z + 0.005], 'cylinderHead');
    return wall;
  });
  // The rear flange and ribs give the open casting thickness without placing a
  // lid in front of the valve springs or cam lobes.
  g.box(size.x, 0.1, 0.35, g.headAlloy, group, [center.x, bounds.max.y - 0.05, bounds.min.z + 0.175], 'cylinderHead');
  cylinders.forEach(c => {
    const p = root.worldToLocal(c.unit.localToWorld(new THREE.Vector3(0, 4.64, 0)));
    g.box(0.08, size.y - 0.12, 0.08, g.headAlloy, group, [p.x, center.y, bounds.min.z + 0.22], 'cylinderHead');
  });
  group.traverse(object => { if (object.isMesh) object.userData.lodEssential = true; });
  return { group, rear, front, rim, endWalls, bounds, center, cylinders };
}
