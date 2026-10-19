import * as THREE from 'three';
import { overlaps, roadRectangles } from './city-site.js';

function facadeMaterial(index) {
  const palettes = [
    { wall: '#7e746d', trim: '#94928b', glass: '#4e5b60' },
    { wall: '#939794', trim: '#a9aca8', glass: '#5b6970' },
    { wall: '#73787b', trim: '#8b9192', glass: '#4e5e66' },
  ];
  const palette = palettes[index];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const roughnessCanvas = document.createElement('canvas');
  roughnessCanvas.width = roughnessCanvas.height = 512;
  const roughness = roughnessCanvas.getContext('2d');
  ctx.fillStyle = palette.wall;
  ctx.fillRect(0, 0, 512, 512);
  roughness.fillStyle = '#dddddd';
  roughness.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 12; row++) {
    const y = 12 + row * 40;
    ctx.fillStyle = palette.trim;
    ctx.fillRect(0, y + 31, 512, 3);
    for (let col = 0; col < 8; col++) {
      const x = 8 + col * 64;
      ctx.fillStyle = palette.trim;
      ctx.fillRect(x - 2, y - 2, 48, 29);
      ctx.fillStyle = (row * 7 + col * 3 + index) % 13 === 0 ? '#797d76' : palette.glass;
      ctx.fillRect(x, y, 44, 25);
      ctx.fillStyle = 'rgba(174, 193, 196, 0.16)';
      ctx.fillRect(x, y, 44, 6);
      ctx.fillStyle = palette.trim;
      ctx.fillRect(x + 21, y, 1, 25);
      roughness.fillStyle = '#777777';
      roughness.fillRect(x, y, 44, 25);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  return new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 1,
    metalness: 0, envMapIntensity: 0.45 });
}

export function addCityInfill(group, site, materials) {
  const layout = group.userData.siteLayout;
  const clearance = site.span * 0.035;
  const occupied = [...layout.buildings, ...layout.parking,
    ...layout.trees.map(([x, z]) => ({ minX: x - layout.treeClearanceRadius,
      maxX: x + layout.treeClearanceRadius, minZ: z - layout.treeClearanceRadius,
      maxZ: z + layout.treeClearanceRadius }))];
  const roads = roadRectangles(site);
  const halfRoad = site.roadWidth / 2 + site.sidewalkWidth;
  const radius = site.span * 3.2;
  const xBlocks = [
    [site.center.x - radius, site.west - halfRoad],
    [site.west + halfRoad, site.east - halfRoad],
    [site.east + halfRoad, site.center.x + radius],
  ];
  const zBlocks = [
    [site.center.z - radius, site.north - halfRoad],
    [site.north + halfRoad, site.south - halfRoad],
    [site.south + halfRoad, site.center.z + radius],
  ];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  // Batch four facade faces together instead of issuing a draw per cube face.
  const indices = Array.from(boxGeometry.index.array);
  boxGeometry.setIndex([0, 1, 4, 5, 2, 3].flatMap((face) => indices.slice(face * 6, face * 6 + 6)));
  boxGeometry.clearGroups();
  boxGeometry.addGroup(0, 24, 0);
  boxGeometry.addGroup(24, 12, 1);
  materials.infillRoof = new THREE.MeshStandardMaterial({ color: 0x535959, roughness: 0.93 });
  materials.infillTrim = new THREE.MeshStandardMaterial({ color: 0x92968f, roughness: 0.8 });
  const facades = [0, 1, 2].map((index) => {
    const material = facadeMaterial(index);
    materials[`infillFacade${index}`] = material;
    return material;
  });
  const transform = new THREE.Object3D();
  const placements = [];
  let candidate = 0;
  xBlocks.forEach(([minX, maxX], bx) => {
    zBlocks.forEach(([minZ, maxZ], bz) => {
      if (bx === 1 && bz === 1) return;
      const columns = Math.max(1, Math.floor((maxX - minX) / (site.span * 0.4)));
      const rows = Math.max(1, Math.floor((maxZ - minZ) / (site.span * 0.4)));
      const cellWidth = (maxX - minX) / columns;
      const cellDepth = (maxZ - minZ) / rows;
      const batches = [[], [], []];
      const parapets = [];
      for (let col = 0; col < columns; col++) {
        for (let row = 0; row < rows; row++) {
          const id = candidate++;
          const variant = (col + row * 2 + bx + bz) % 3;
          let width = cellWidth * (0.66 + (id % 3) * 0.07);
          let depth = cellDepth * (0.66 + ((id + 1) % 3) * 0.07);
          const cellX = minX + (col + 0.5) * cellWidth;
          const cellZ = minZ + (row + 0.5) * cellDepth;
          let x = cellX;
          let z = cellZ;
          const height = site.size.y * (0.22 + (id % 6) * 0.043);
          const blockers = [...roads, ...occupied];
          const rectangle = () => ({ minX: x - width / 2 - clearance, maxX: x + width / 2 + clearance,
            minZ: z - depth / 2 - clearance, maxZ: z + depth / 2 + clearance });
          let rect = rectangle();
          if (blockers.some((obstacle) => overlaps(rect, obstacle))) {
            // Fit smaller frontage buildings into partially occupied parking/tree plots.
            width *= 0.62;
            depth *= 0.62;
            let found = false;
            for (const dx of [0, -0.22, 0.22]) {
              for (const dz of [0, -0.22, 0.22]) {
                x = cellX + dx * cellWidth;
                z = cellZ + dz * cellDepth;
                rect = rectangle();
                if (!blockers.some((obstacle) => overlaps(rect, obstacle))) {
                  found = true;
                  break;
                }
              }
              if (found) break;
            }
            if (!found) continue;
          }
          occupied.push(rect);
          placements.push(rect);
          transform.position.set(x, site.groundY + height / 2, z);
          transform.scale.set(width, height, depth);
          transform.updateMatrix();
          batches[variant].push(transform.matrix.clone());
          for (const [px, pz, sx, sz] of [
            [x - width / 2, z, 0.035, depth], [x + width / 2, z, 0.035, depth],
            [x, z - depth / 2, width, 0.035], [x, z + depth / 2, width, 0.035],
          ]) {
            transform.position.set(px, site.groundY + height + 0.025, pz);
            transform.scale.set(sx, 0.05, sz);
            transform.updateMatrix();
            parapets.push(transform.matrix.clone());
          }
        }
      }
      // Separate batches per street block retain useful frustum culling.
      batches.forEach((matrices, variant) => {
        if (!matrices.length) return;
        const facade = facades[variant];
        const mesh = new THREE.InstancedMesh(boxGeometry,
          [facade, materials.infillRoof], matrices.length);
        mesh.name = `cityInfill_${bx}_${bz}_${variant}`;
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      });
      if (parapets.length) {
        const mesh = new THREE.InstancedMesh(boxGeometry, materials.infillTrim, parapets.length);
        mesh.name = `cityInfillParapets_${bx}_${bz}`;
        parapets.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    });
  });
  layout.buildings.push(...placements);
  layout.infillCount = placements.length;
}
