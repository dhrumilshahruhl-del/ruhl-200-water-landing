import * as THREE from 'three';

export function createStudioLights() {
  const group = new THREE.Group();
  const key = new THREE.DirectionalLight(0xfff5e8, 1.35);

  key.position.set(4, 7, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15;
  key.shadow.camera.right = 15;
  key.shadow.camera.top = 15;
  key.shadow.camera.bottom = -15;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 60;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 3;
  group.add(key, key.target);
  return group;
}
