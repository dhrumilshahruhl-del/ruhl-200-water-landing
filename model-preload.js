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

function readModelPaths() {
  const section = document.getElementById('building-scroll');
  const rooftop = document.getElementById('rooftop-detail');
  return {
    building:
      section?.getAttribute('data-model-path') ||
      rooftop?.getAttribute('data-building-model-path') ||
      './logos/200_water.glb',
    roof:
      section?.getAttribute('data-roof-model-path') ||
      rooftop?.getAttribute('data-roof-model-path') ||
      './logos/200 water Roof Only.glb',
  };
}

const paths = readModelPaths();

/** Building model — needed for scroll tour (priority). */
export const buildingGltfPromise = preloadGltf(paths.building);

/** Roof-only model — deferred until explicitly requested. */
let roofGltfPromise = null;

export function loadRoofGltf() {
  if (!roofGltfPromise) {
    roofGltfPromise = preloadGltf(paths.roof);
  }
  return roofGltfPromise;
}
