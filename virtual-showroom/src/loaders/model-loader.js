import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();

export function resolveAssetUrl(path) {
  return new URL(path, document.baseURI).href;
}

export function loadGltf(path, onProgress) {
  const url = resolveAssetUrl(path);
  if (!cache.has(url)) {
    cache.set(url, loader.loadAsync(url, onProgress).catch((error) => {
      cache.delete(url);
      throw error;
    }));
  }
  return cache.get(url);
}

export function cloneSceneFromGltf(gltf) {
  return gltf.scene.clone(true);
}

export async function releaseModelCache() {
  const loads = [...cache.values()];
  cache.clear();
  for (const load of loads) {
    try { const gltf = await load; disposeObject(gltf.scene); } catch { /* failed load has no resources */ }
  }
}
export function disposeObject(object) {
  const resources = new Set();
  object.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of (Array.isArray(node.material) ? node.material : [node.material])) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  resources.forEach(resource => resource.dispose());
}
