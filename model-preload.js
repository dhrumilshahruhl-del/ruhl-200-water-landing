import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const loads = new Map();

function resolveUrl(path) {
  try {
    return new URL(path, document.baseURI).href;
  } catch {
    return path;
  }
}

export function preloadGltf(path) {
  const url = resolveUrl(path);
  if (!loads.has(url)) {
    loads.set(
      url,
      loader.loadAsync(url).catch((error) => {
        loads.delete(url);
        throw error;
      })
    );
  }
  return loads.get(url);
}

export function cloneSceneFromGltf(gltf) {
  return gltf.scene.clone(true);
}

// Only the shared building tour remains. The retired roof is never preloaded.
const modelPath = document.getElementById('building-scroll')?.getAttribute('data-model-path') || './logos/200_water.glb';
export const buildingGltfPromise = preloadGltf(modelPath);
