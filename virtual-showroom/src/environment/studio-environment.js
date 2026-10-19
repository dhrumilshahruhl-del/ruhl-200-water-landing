import * as THREE from 'three';

export function applyStudioEnvironment(scene, viewRadius = 12) {
  // Keep nearby architecture clear; haze belongs beyond the city blocks.
  scene.fog = new THREE.Fog(0xb9c6ce, 60, 140);
}

export function createGroundPlane(size = 28) {
  const geometry = new THREE.CircleGeometry(size, 96);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe8edf0,
    roughness: 0.82,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  return ground;
}
