import * as THREE from 'three';
import { footprint, overlaps, roadRectangles } from './city-site.js';

function parkingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3d4041';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#b2b3aa';
  ctx.lineWidth = 3;
  for (const y of [12, 170]) {
    ctx.beginPath();
    ctx.moveTo(16, y === 12 ? 86 : 170);
    ctx.lineTo(496, y === 12 ? 86 : 170);
    for (let x = 16; x <= 496; x += 80) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 74);
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function addParking(group, site, materials, obstacles) {
  materials.parking = new THREE.MeshStandardMaterial({ map: parkingTexture(), roughness: 0.96 });
  const lotWidth = site.span * 0.38;
  const lotLength = Math.min(site.span * 0.3, site.size.z * 0.36);
  const geometry = new THREE.PlaneGeometry(lotWidth, lotLength);
  const driveGeometry = new THREE.PlaneGeometry(site.sidewalkWidth + 0.05, lotLength * 0.22);
  const lots = [];
  const lotMatrices = [];
  const driveMatrices = [];
  const transform = new THREE.Object3D();
  for (const [roadX, side] of [[site.west, -1], [site.east, 1]]) {
    for (const offset of [-0.24, 0.24]) {
      const x = roadX + side * (site.roadWidth / 2 + site.sidewalkWidth + lotWidth / 2);
      const z = site.center.z + offset * site.size.z;
      const rect = { minX: x - lotWidth / 2, maxX: x + lotWidth / 2,
        minZ: z - lotLength / 2, maxZ: z + lotLength / 2 };
      if (obstacles.some((obstacle) => overlaps(rect, obstacle))) continue;
      transform.rotation.x = -Math.PI / 2;
      transform.position.set(x, site.groundY + 0.012, z);
      transform.updateMatrix();
      lotMatrices.push(transform.matrix.clone());
      transform.position.set(roadX + side * (site.roadWidth / 2 + site.sidewalkWidth / 2), site.groundY + 0.013, z);
      transform.updateMatrix();
      driveMatrices.push(transform.matrix.clone());
      lots.push(rect);
    }
  }
  for (const [name, meshGeometry, material, matrices] of [
    ['cityParkingLots', geometry, materials.parking, lotMatrices],
    ['cityParkingDriveways', driveGeometry, materials.road, driveMatrices],
  ]) {
    const mesh = new THREE.InstancedMesh(meshGeometry, material, matrices.length);
    mesh.name = name;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return lots;
}

function addTrees(group, positions, site, materials) {
  if (!positions.length) return;
  materials.bark = new THREE.MeshStandardMaterial({ color: 0x51483e, roughness: 1 });
  materials.foliage = new THREE.MeshStandardMaterial({ color: 0x556651, roughness: 0.95 });
  materials.soil = new THREE.MeshStandardMaterial({ color: 0x454438, roughness: 1 });
  const trunkGeometry = new THREE.CylinderGeometry(0.035, 0.05, 0.7, 6);
  const crownGeometry = new THREE.SphereGeometry(1, 12, 9);
  const vertices = crownGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(vertices, i);
    // Coordinate-based perturbation keeps duplicated sphere seams coincident.
    const factor = 1 + 0.07 * Math.sin(point.x * 17 + point.y * 11 + point.z * 23);
    vertices.setXYZ(i, point.x * factor, point.y * factor, point.z * factor);
  }
  crownGeometry.computeVertexNormals();
  const trunks = new THREE.InstancedMesh(trunkGeometry, materials.bark, positions.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, materials.foliage, positions.length * 3);
  const beds = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.025, 12), materials.soil, positions.length);
  trunks.name = 'cityTreeTrunks';
  crowns.name = 'cityTreeCanopies';
  beds.name = 'cityTreeBeds';
  const transform = new THREE.Object3D();
  positions.forEach(([x, z], index) => {
    const height = site.span * (0.15 + (index % 5) * 0.009);
    transform.position.set(x, site.groundY + height * 0.28, z);
    transform.scale.set(height * 0.85, height * 0.8, height * 0.85);
    transform.updateMatrix();
    trunks.setMatrixAt(index, transform.matrix);
    transform.position.set(x, site.groundY + 0.014, z);
    transform.scale.set(height * 0.2, 1, height * 0.2);
    transform.updateMatrix();
    beds.setMatrixAt(index, transform.matrix);
    for (let lobe = 0; lobe < 3; lobe++) {
      const angle = index * 1.7 + lobe * 2.1;
      transform.position.set(x + Math.cos(angle) * height * 0.12,
        site.groundY + height * (0.68 + lobe * 0.05), z + Math.sin(angle) * height * 0.12);
      transform.scale.set(height * 0.26, height * 0.3, height * 0.25);
      transform.updateMatrix();
      crowns.setMatrixAt(index * 3 + lobe, transform.matrix);
      crowns.setColorAt(index * 3 + lobe, new THREE.Color().setHSL(0.27 + (index % 3) * 0.012, 0.17, 0.4 + lobe * 0.025));
    }
  });
  for (const mesh of [trunks, crowns, beds]) {
    mesh.castShadow = mesh !== beds;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

export function addSiteLandscaping(group, site, heroBox, cityBounds, materials) {
  const roads = roadRectangles(site);
  const buildings = [heroBox, ...cityBounds].map((box) => footprint(box, site.span * 0.015));
  const parking = addParking(group, site, materials, [...roads, ...buildings]);
  const obstacles = [...roads, ...buildings, ...parking];
  const positions = [];
  const radius = site.span * 0.072;
  function consider(x, z) {
    const canopy = { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius };
    if (obstacles.some((rect) => overlaps(canopy, rect))) return;
    if (positions.some(([px, pz]) => Math.hypot(px - x, pz - z) < radius * 2.2)) return;
    positions.push([x, z]);
  }
  for (const offset of [-0.36, -0.12, 0.12, 0.36]) {
    const z = site.center.z + site.size.z * offset;
    consider(heroBox.min.x - site.span * 0.1, z);
    consider(heroBox.max.x + site.span * 0.1, z);
  }
  for (const rect of parking) {
    for (const z of [rect.minZ - radius * 1.4, rect.maxZ + radius * 1.4]) {
      consider(rect.minX + radius, z);
      consider(rect.maxX - radius, z);
    }
  }
  for (const bounds of cityBounds) {
    const rect = footprint(bounds, site.span * 0.12);
    for (const x of [rect.minX, rect.maxX]) {
      for (const z of [rect.minZ, rect.maxZ]) consider(x, z);
    }
  }
  addTrees(group, positions, site, materials);
  group.userData.siteLayout = { roads, buildings, parking, trees: positions, treeClearanceRadius: radius };
}
