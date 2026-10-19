import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const DEFAULT_ENVIRONMENT = {
  hdriPath: new URL("../../assets/canary_wharf_4k.hdr", import.meta.url).href,
  backgroundIntensity: 0.72,
  backgroundBlurriness: 0.035,
  environmentIntensity: 0.65,
};

export class EnvironmentManager {
  constructor(renderer, scene, config = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.config = { ...DEFAULT_ENVIRONMENT, ...config };
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.environmentMap = null;
    this.backgroundTexture = null;
    this.pmremTarget = null;
    this.disposed = false;
  }

  async load(onProgress) {
    const texture = await new RGBELoader().loadAsync(this.config.hdriPath, onProgress);
    if (this.disposed) { texture.dispose(); return null; }
    texture.mapping = THREE.EquirectangularReflectionMapping;

    this.pmremTarget = this.pmremGenerator.fromEquirectangular(texture);
    this.environmentMap = this.pmremTarget.texture;
    this.backgroundTexture = texture;
    this.scene.environment = this.environmentMap;
    this.scene.background = this.backgroundTexture;

    if ('backgroundIntensity' in this.scene) {
      this.scene.backgroundIntensity = this.config.backgroundIntensity;
    }
    if ('backgroundBlurriness' in this.scene) {
      this.scene.backgroundBlurriness = this.config.backgroundBlurriness;
    }
    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity = this.config.environmentIntensity;
    }

    return this.environmentMap;
  }

  dispose() {
    this.disposed = true;
    this.backgroundTexture?.dispose();
    this.pmremTarget?.dispose();
    this.pmremGenerator?.dispose();
  }
}
