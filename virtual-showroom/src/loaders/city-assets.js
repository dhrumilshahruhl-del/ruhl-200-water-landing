import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BASE = new URL("../../assets/city-context/", import.meta.url).href;
const FILES = ['Building_Large_2.gltf', 'Building_Medium_2_001.gltf', 'Building_Small_1.gltf'];
const filters = { 9728: THREE.NearestFilter, 9729: THREE.LinearFilter,
  9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter };
const wraps = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
let active = null;

// Source URL alone is insufficient: UV transforms, channels, sampling and color
// interpretation must all agree before two material slots can share a Texture.
function textureKey(texture) {
  return JSON.stringify([texture.userData.citySource, texture.colorSpace, texture.flipY,
    texture.wrapS, texture.wrapT, texture.repeat.toArray(), texture.offset.toArray(),
    texture.rotation, texture.center.toArray(), texture.minFilter, texture.magFilter,
    texture.anisotropy, texture.channel, texture.matrixAutoUpdate, texture.matrix.elements,
    texture.generateMipmaps, texture.mapping, texture.format, texture.type,
    texture.premultiplyAlpha, texture.unpackAlignment, texture.internalFormat,
    texture.compareFunction]);
}

function createState() {
  const state = { refs: 0, images: new Map(), textures: new Set(), materials: new Set(),
    geometries: new Set(), canonical: new Map(), promise: null, discarded: 0 };
  const manager = new THREE.LoadingManager();
  const imageLoader = new THREE.ImageLoader(manager);
  const loader = new GLTFLoader(manager);
  // This city export uses ordinary external PNGs and glTF samplers. Load images
  // once per asset bundle, before any GPU upload, rather than decoding the same
  // source independently in three GLTFParser instances. assignTexture still
  // applies glTF color spaces, channels and KHR_texture_transform normally.
  loader.register(parser => ({
    name: 'CITY_SHARED_IMAGES',
    loadTexture(index) {
      const def = parser.json.textures[index];
      const image = parser.json.images[def.source];
      if (!image?.uri || def.extensions) throw new Error('Unsupported city texture definition');
      const url = new URL(image.uri, new URL(BASE, document.baseURI)).href;
      if (!state.images.has(url)) state.images.set(url, imageLoader.loadAsync(url));
      return state.images.get(url).then(source => {
        const texture = new THREE.Texture(source);
        state.textures.add(texture);
        texture.name = image.uri;
        texture.userData.citySource = url;
        texture.flipY = false;
        const sampler = parser.json.samplers?.[def.sampler] || {};
        texture.magFilter = filters[sampler.magFilter] || THREE.LinearFilter;
        texture.minFilter = filters[sampler.minFilter] || THREE.LinearMipmapLinearFilter;
        texture.wrapS = wraps[sampler.wrapS] || THREE.RepeatWrapping;
        texture.wrapT = wraps[sampler.wrapT] || THREE.RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
      });
    },
  }));
  state.promise = Promise.allSettled(FILES.map(file => loader.loadAsync(BASE + file))).then(async results => {
    await Promise.allSettled(state.images.values());
    // Keep ownership of every successful parse, even when a sibling load fails.
    const scenes = [];
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const scene = result.value.scene;
      scenes.push(scene);
      scene.traverse(node => {
        if (!node.isMesh) return;
        state.geometries.add(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          state.materials.add(material);
          for (const [slot, texture] of Object.entries(material)) {
            if (!texture?.isTexture) continue;
            state.textures.add(texture);
            const key = textureKey(texture);
            if (!state.canonical.has(key)) state.canonical.set(key, texture);
            material[slot] = state.canonical.get(key);
          }
        }
      });
    }
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    const kept = new Set(state.canonical.values());
    for (const texture of state.textures) if (!kept.has(texture)) {
      texture.dispose(); state.textures.delete(texture); state.discarded++;
    }
    return scenes;
  });
  return state;
}

function release(state) {
  if (--state.refs) return;
  for (const resource of [...state.materials, ...state.geometries, ...state.textures]) resource.dispose();
  state.materials.clear(); state.geometries.clear(); state.textures.clear();
  state.canonical.clear(); state.images.clear(); state.promise = null;
  if (active === state) active = null;
}

export async function acquireCityAssets() {
  const state = active || (active = createState());
  state.refs++;
  try {
    const scenes = await state.promise;
    let released = false;
    // One material clone per source material per city context: permanent city
    // treatment never mutates a cached template or another showroom instance.
    const materials = new Map();
    const assets = scenes.map(scene => {
      const clone = scene.clone(true);
      clone.traverse(node => {
        if (!node.isMesh) return;
        const cloneMaterial = source => {
          if (!materials.has(source)) materials.set(source, source.clone());
          return materials.get(source);
        };
        node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
      });
      return clone;
    });
    return { assets, geometries: state.geometries, textures: state.textures, materials: new Set(materials.values()),
      release() {
        if (released) return;
        released = true;
        for (const material of materials.values()) material.dispose();
        materials.clear();
        release(state);
      } };
  } catch (error) { release(state); throw error; }
}

// Read-only lifecycle diagnostics; no scene traversal or per-frame work.
export function getCityAssetStats() {
  return active ? { consumers: active.refs, images: active.images.size,
    textures: active.textures.size, canonicalTextures: active.canonical.size,
    discardedTextures: active.discarded } : { consumers: 0, images: 0, textures: 0, canonicalTextures: 0, discardedTextures: 0 };
}
