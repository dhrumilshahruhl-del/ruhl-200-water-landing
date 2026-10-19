import { chromium } from 'playwright';

const files = [
  './logos/200_water.glb',
  './logos/200_water.opt.glb',
  './logos/200 water Roof Only.glb',
  './logos/200 water Roof Only.opt.glb',
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async (paths) => {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);

  const summarize = async (path) => {
    const gltf = await loader.loadAsync(new URL(path, document.baseURI).href);
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    let meshes = 0;
    let vertices = 0;
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      meshes += 1;
      vertices += node.geometry?.attributes?.position?.count || 0;
    });
    return {
      path,
      min: box.min.toArray(),
      max: box.max.toArray(),
      size: size.toArray(),
      center: center.toArray(),
      meshes,
      vertices,
    };
  };

  return Promise.all(paths.map(summarize));
}, files);

await browser.close();
console.log(JSON.stringify(result, null, 2));
