import * as THREE from 'three';
import { acquireCityAssets } from '../loaders/city-assets.js';
import { createCitySite, positionCityBuilding } from './city-site.js';
import { addSiteLandscaping } from './site-landscaping.js';
import { addCityInfill } from './city-infill.js';
import { refineBrickFacades } from './city-facades.js';

const CITY_LAYOUT = [
  { asset: 0, x: -1.55, z: -0.9, scale: 0.78, rotation: 0 },
  { asset: 1, x: 1.55, z: -0.95, scale: 0.72, rotation: Math.PI / 2 },
  { asset: 2, x: -1.6, z: 0.95, scale: 0.65, rotation: Math.PI },
  { asset: 0, x: 1.65, z: 1.0, scale: 0.62, rotation: Math.PI / 2 },
  { asset: 1, x: -0.3, z: -1.9, scale: 0.65, rotation: 0 },
  { asset: 2, x: 0.4, z: 1.9, scale: 0.58, rotation: Math.PI },
];

function prepareCityMaterials(object) {
  const prepared = new Set();
  object.traverse((node) => {
    if (!node.isMesh) return;
    const oldMaterials = Array.isArray(node.material) ? node.material : [node.material];
    // Preserve primitive material slots and the kit's brick, trim and normal maps.
    oldMaterials.forEach((material) => {
      if (!material || prepared.has(material)) return;
      prepared.add(material);
      material.envMapIntensity = 0.48;
      material.normalScale?.multiplyScalar(0.45);
      const name = material.name.toLowerCase();
      if (name.includes('glass')) {
        material.color.set(0x53666f);
        material.roughness = 0.25;
        material.metalness = 0.15;
        material.opacity = 0.9;
        material.depthWrite = false;
      } else {
        material.roughness = Math.max(material.roughness, 0.68);
        material.metalness = Math.min(material.metalness, 0.25);
      }
    });
    node.castShadow = false;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.renderOrder = -4;
  });
}

function surfaceTexture(color, variation, repeat, joints = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(256, 256);
  let seed = 913;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = ((seed / 4294967296) - 0.5) * variation;
    for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = color[channel] + noise;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  if (joints) {
    context.strokeStyle = 'rgba(45, 48, 46, 0.22)';
    context.lineWidth = 1;
    context.strokeRect(0.5, 0.5, 255, 255);
    context.beginPath();
    context.moveTo(128, 0);
    context.lineTo(128, 256);
    context.moveTo(0, 128);
    context.lineTo(256, 128);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 4;
  return texture;
}

function createSharedCityMaterials() {
  return {
    ground: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: surfaceTexture([126, 128, 124], 10, 40, true),
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.08,
    }),
    road: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: surfaceTexture([49, 51, 53], 12, 32),
      roughness: 0.88,
      metalness: 0,
      envMapIntensity: 0.06,
    }),
  };
}

function addGroundContext(group, site, materials) {
  const { groundSize, groundY, size: heroSize } = site;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), materials.ground);
  ground.name = 'cityContextGround';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(
    site.center.x,
    groundY,
    site.center.z
  );
  ground.renderOrder = -12;
  ground.receiveShadow = true;
  group.add(ground);

  const roadWidth = site.roadWidth;
  const roadLength = groundSize * 0.92;
  const roadA = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadLength), materials.road);
  roadA.name = 'cityContextRoadNorthSouth';
  roadA.rotation.x = -Math.PI / 2;
  roadA.position.set(site.west, groundY + 0.003, ground.position.z);
  roadA.renderOrder = -11;
  roadA.receiveShadow = true;
  group.add(roadA);

  const roadB = new THREE.Mesh(new THREE.PlaneGeometry(roadLength, roadWidth), materials.road);
  roadB.name = 'cityContextRoadEastWest';
  roadB.rotation.x = -Math.PI / 2;
  roadB.position.set(ground.position.x, groundY + 0.004, site.south);
  roadB.renderOrder = -11;
  roadB.receiveShadow = true;
  group.add(roadB);
  const roadC = roadA.clone();
  roadC.position.x = site.east;
  group.add(roadC);
  const roadD = roadB.clone();
  roadD.position.z = site.north;
  group.add(roadD);

  const sidewalk = new THREE.MeshStandardMaterial({ color: 0xa7a8a2, roughness: 0.92 });
  materials.sidewalk = sidewalk;
  const pavement = new THREE.Mesh(
    new THREE.BoxGeometry(heroSize.x + 0.5, 0.06, heroSize.z + 0.5), sidewalk
  );
  pavement.position.set(ground.position.x, groundY + 0.03, ground.position.z);
  pavement.receiveShadow = true;
  group.add(pavement);
  const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xbfc0b0, roughness: 0.95 });
  materials.marking = markingMaterial;
  const dashGeometry = new THREE.PlaneGeometry(0.025, 0.22);
  const transform = new THREE.Object3D();
  for (const [road, northSouth] of [[roadA, true], [roadC, true], [roadB, false], [roadD, false]]) {
    const positions = [];
    for (let offset = -roadLength / 2; offset < roadLength / 2; offset += 0.5) {
      const x = northSouth ? road.position.x : ground.position.x + offset;
      const z = northSouth ? ground.position.z + offset : road.position.z;
      const crossings = northSouth ? [roadB.position.z, roadD.position.z] : [roadA.position.x, roadC.position.x];
      if (crossings.some((value) => Math.abs((northSouth ? z : x) - value) < roadWidth * 0.6)) continue;
      positions.push([x, z]);
    }
    const markings = new THREE.InstancedMesh(dashGeometry, markingMaterial, positions.length);
    positions.forEach(([x, z], index) => {
      transform.rotation.set(-Math.PI / 2, 0, northSouth ? 0 : Math.PI / 2);
      transform.position.set(x, groundY + 0.008, z);
      transform.updateMatrix();
      markings.setMatrixAt(index, transform.matrix);
    });
    markings.computeBoundingSphere();
    group.add(markings);
  }
}

export async function createCityContext(heroBox) {
  // Do not allocate procedural GPU resources until optional downloads succeed.
  const lease = await acquireCityAssets();
  const { assets } = lease;
  const heroSize = heroBox.getSize(new THREE.Vector3());
  const site = createCitySite(heroBox);
  const baseScale = Math.max(0.075, Math.min(0.28, (heroSize.y / 28) * 1.05));
  const group = new THREE.Group();
  group.name = 'cityContext';
  group.renderOrder = -10;

  const materials = {};
  let disposed = false;
  group.userData.dispose = () => {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), textures = new Set();
    const usedMaterials = new Set(Object.values(materials));
    group.traverse((node) => {
      if (!node.isMesh) return;
      geometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => usedMaterials.add(m));
    });
    for (const geometry of geometries) if (!lease.geometries.has(geometry)) geometry.dispose();
    for (const material of usedMaterials) {
      if (lease.materials.has(material)) continue;
      for (const value of Object.values(material)) if (value?.isTexture && !lease.textures.has(value)) textures.add(value);
      material.dispose();
    }
    textures.forEach(texture => texture.dispose());
    lease.release();
  };
  try {
    Object.assign(materials, createSharedCityMaterials());
    addGroundContext(group, site, materials);

    assets.forEach(prepareCityMaterials);

    const cityBounds = [];
    CITY_LAYOUT.forEach((item, index) => {
      const instance = assets[item.asset].clone(true);
      instance.name = `cityContextBuilding_${index + 1}`;
      if (item.asset === 0 || item.asset === 1) refineBrickFacades(instance);
      instance.scale.setScalar(baseScale * item.scale);
      instance.rotation.y = item.rotation;
      const placedBounds = positionCityBuilding(instance, item, site, heroBox);
      group.add(instance);
      cityBounds.push(placedBounds);
      const footprint = placedBounds.getSize(new THREE.Vector3());
      const placedCenter = placedBounds.getCenter(new THREE.Vector3());
      const sidewalk = new THREE.Mesh(
        new THREE.BoxGeometry(footprint.x + 0.24, 0.04, footprint.z + 0.24), materials.sidewalk
      );
      sidewalk.position.set(placedCenter.x, site.groundY, placedCenter.z);
      sidewalk.receiveShadow = true;
      group.add(sidewalk);
    });
    addSiteLandscaping(group, site, heroBox, cityBounds, materials);
    addCityInfill(group, site, materials);
    // Context receives shadows, but never contributes to the hero shadow map.
    group.traverse((node) => { if (node.isMesh) node.castShadow = false; });

    return group;
  } catch (error) {
    group.userData.dispose();
    throw error;
  }
}
