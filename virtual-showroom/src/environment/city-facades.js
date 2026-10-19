import * as THREE from 'three';

// Add relief to the kit's large, uninterrupted brick elevations. Keep the
// authored front windows, cornices, masonry, and rooftop geometry intact.
export function refineBrickFacades(building) {
  const parts = [];
  building.traverse((node) => {
    if (node.isMesh && node.material?.name === 'MI_RedBrick') parts.push(node);
  });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const frame = new THREE.MeshStandardMaterial({ color: 0x969c99, roughness: 0.78 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x405764, roughness: 0.38,
    metalness: 0.12, envMapIntensity: 0.4 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb0ada3, roughness: 0.86 });
  const batches = [[], [], []];
  const transform = new THREE.Object3D();
  const add = (batch, x, y, z, width, height, depth, axis, sign) => {
    transform.position.set(x, y, z);
    transform.rotation.set(0, axis === 0 ? sign * Math.PI / 2 : sign < 0 ? Math.PI : 0, 0);
    transform.scale.set(width, height, depth);
    transform.updateMatrix();
    batches[batch].push(transform.matrix.clone());
  };
  // Work in building coordinates, so details follow each rotated placement.
  building.updateWorldMatrix(true, true);
  const inverse = building.matrixWorld.clone().invert();
  const buildingBounds = new THREE.Box3();
  building.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes.position) return;
    const positions = node.geometry.attributes.position;
    const matrix = inverse.clone().multiply(node.matrixWorld);
    for (let i = 0; i < positions.count; i++) {
      buildingBounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  });
  const point = new THREE.Vector3();
  for (const mesh of parts) {
    const g = mesh.geometry, p = g.attributes.position;
    const matrix = inverse.clone().multiply(mesh.matrixWorld);
    const planes = new Map();
    for (let i = 0; i < g.index.count; i += 3) {
      const vertices = [0, 1, 2].map((j) => new THREE.Vector3()
        .fromBufferAttribute(p, g.index.getX(i + j)).applyMatrix4(matrix));
      const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
      const area = normal.length() / 2;
      normal.normalize();
      const axis = Math.abs(normal.x) > 0.99 ? 0 : Math.abs(normal.z) > 0.99 ? 2 : -1;
      if (axis < 0) continue;
      const coordinate = vertices[0].getComponent(axis);
      const sign = Math.sign(normal.getComponent(axis));
      const key = `${axis}:${coordinate.toFixed(2)}:${sign}`;
      let plane = planes.get(key);
      if (!plane) { plane = { axis, sign, coordinate, area: 0, box: new THREE.Box3() }; planes.set(key, plane); }
      plane.area += area;
      vertices.forEach((v) => plane.box.expandByPoint(v));
    }
    for (const { axis, sign, coordinate, area, box } of planes.values()) {
      const horizontal = axis === 0 ? 2 : 0;
      const width = box.max.getComponent(horizontal) - box.min.getComponent(horizontal);
      const height = box.max.y - box.min.y;
      // A punched facade has less coverage; only dress the solid blank walls.
      if (width < 5 || height < 9 || area < width * height * 0.85) continue;
      const columns = Math.max(2, Math.floor(width / 2.5));
      const floors = Math.max(2, Math.floor(height / 2.8));
      const bay = width / columns, floor = height / floors;
      const place = (batch, across, y, w, h, depth, offset) => {
        point.set(0, y, 0);
        point.setComponent(horizontal, across);
        point.setComponent(axis, coordinate + sign * offset);
        add(batch, point.x, point.y, point.z, w, h, depth, axis, sign);
      };
      const center = (box.min.getComponent(horizontal) + box.max.getComponent(horizontal)) / 2;
      const firstRow = box.min.y - buildingBounds.min.y > 3 ? 0 : 1;
      for (let row = firstRow; row < floors; row++) {
        const y = box.min.y + (row + 0.5) * floor;
        for (let col = 0; col < columns; col++) {
          const x = box.min.getComponent(horizontal) + (col + 0.5) * bay;
          const w = Math.min(1.35, bay * 0.60), h = Math.min(1.7, floor * 0.62);
          place(0, x, y, w + 0.20, h + 0.20, 0.13, 0.075);
          place(1, x, y, w, h, 0.035, 0.155);
          place(0, x, y, 0.045, h, 0.045, 0.185);
          place(0, x, y - h * 0.1, w, 0.045, 0.045, 0.185);
          place(2, x, y - h / 2 - 0.12, w + 0.34, 0.13, 0.30, 0.13);
        }
      }
      const ground = buildingBounds.min.y;
      place(2, center, ground + 1.2, 2.30, 2.40, 0.18, 0.10);
      place(0, center, ground + 1.13, 1.98, 2.18, 0.10, 0.22);
      place(1, center, ground + 1.17, 1.72, 1.96, 0.035, 0.29);
      place(0, center, ground + 1.17, 0.065, 1.96, 0.06, 0.33);
      place(2, center, ground + 0.04, 2.5, 0.08, 0.65, 0.25);
      place(0, center, ground + 2.48, 2.65, 0.12, 0.9, 0.35);
    }
  }
  [frame, glass, stone].forEach((material, index) => {
    if (!batches[index].length) { material.dispose(); return; }
    const mesh = new THREE.InstancedMesh(geometry, material, batches[index].length);
    mesh.name = `cityBrickFacade_${index}`;
    batches[index].forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    building.add(mesh);
  });
  if (!batches.some((batch) => batch.length)) geometry.dispose();
}
