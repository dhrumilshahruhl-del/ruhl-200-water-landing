import * as THREE from 'three';

// The optimized model merges walls and equipment into one palette mesh.
// Isolate the front enclosure wall in building-local coordinates, including
// both sides of its thickness, without changing the shared palette material.
export function makeHeatPumpWallTranslucent(building, root) {
  const progress = { value: 0 };
  const revealOpacity = { value: 0.28 };
  let target = 0;
  let guided = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  building.updateWorldMatrix(true, true);
  const inverse = building.matrixWorld.clone().invert();
  const resources = [];
  const meshes = [];
  building.traverse((node) => { if (node.isMesh && !node.isInstancedMesh) meshes.push(node); });
  for (const node of meshes) {
    const geometry = node.geometry;
    const positions = geometry.attributes.position;
    const index = geometry.index;
    if (!positions || !index) continue;
    const transform = inverse.clone().multiply(node.matrixWorld);
    const vertices = Array.from({ length: positions.count }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform));
    const onWall = (v) => v.x >= 3.65 && v.x <= 16.4 &&
      v.y >= 2.95 && v.y <= 11.8 && v.z >= -37.3 && v.z <= -24.5 &&
      Math.abs(v.x + v.z + 21.06) < 0.28;
    const opaque = [];
    const wall = [];
    const seen = new Set();
    for (let i = 0; i < index.count; i += 3) {
      const triangle = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      if (!triangle.every((j) => onWall(vertices[j]))) {
        opaque.push(...triangle);
        continue;
      }
      // Coincident duplicate faces in the export would stack transparency.
      const key = triangle.map((j) => vertices[j].toArray().map((n) => n.toFixed(3)).join(',')).sort().join('|');
      if (!seen.has(key)) { seen.add(key); wall.push(...triangle); }
    }
    if (!wall.length) continue;
    const opaqueGeometry = geometry.clone();
    opaqueGeometry.clearGroups();
    opaqueGeometry.setIndex(opaque);
    node.geometry = opaqueGeometry;
    const wallGeometry = geometry.clone();
    wallGeometry.clearGroups();
    wallGeometry.setIndex(wall);
    const material = (Array.isArray(node.material) ? node.material[0] : node.material).clone();
    material.transparent = true;
    material.opacity = 1;
    material.depthWrite = true;
    wallGeometry.setAttribute('wallRevealPosition', new THREE.Float32BufferAttribute(
      vertices.map((v) => THREE.MathUtils.clamp((v.x - 3.7) / 12.6, 0, 1)), 1));
    material.onBeforeCompile = (shader) => {
      shader.uniforms.wallRevealProgress = progress;
      shader.uniforms.wallRevealOpacity = revealOpacity;
      shader.vertexShader = 'attribute float wallRevealPosition;\nvarying float vWallRevealPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvWallRevealPosition = wallRevealPosition;');
      shader.fragmentShader = 'uniform float wallRevealProgress;\nuniform float wallRevealOpacity;\nvarying float vWallRevealPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float revealed = wallRevealProgress <= 0.0 ? 0.0 : wallRevealProgress >= 1.0 ? 1.0 :
          smoothstep(1.0 - wallRevealProgress - 0.04, 1.0 - wallRevealProgress + 0.04, vWallRevealPosition);
        diffuseColor.a *= mix(1.0, wallRevealOpacity, revealed);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'heat-pump-wall-wipe-v1';
    material.side = THREE.DoubleSide;
    const wallMesh = new THREE.Mesh(wallGeometry, material);
    wallMesh.name = 'heatPumpEnclosureWall';
    wallMesh.receiveShadow = true;
    wallMesh.castShadow = true;
    // Retain the room's structural outline as its infill becomes translucent.
    const edgeGeometry = new THREE.EdgesGeometry(wallGeometry, 35);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x607381, transparent: true, opacity: 0.35 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    wallMesh.add(edges);
    node.add(wallMesh);
    resources.push({ node, geometry, opaqueGeometry, wallGeometry, material, wallMesh, edgeGeometry, edgeMaterial });
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'showroom__wall-toggle';
  Object.assign(button.style, { position: 'absolute', zIndex: '10', display: 'none' });
  button.textContent = 'Reveal';
  button.setAttribute('aria-label', 'Make heat pump wall translucent');
  button.setAttribute('aria-pressed', 'false');
  root.append(button);
  function setTranslucent(value) {
    target = value ? 1 : 0;
    button.textContent = target ? 'Solid' : 'Reveal';
    button.setAttribute('aria-pressed', String(Boolean(target)));
    button.setAttribute('aria-label', target ? 'Make heat pump wall solid' : 'Make heat pump wall translucent');
  }
  button.addEventListener('click', () => setTranslucent(!target));
  const anchor = new THREE.Vector3(14.85, 7.15, -35.70);
  const world = new THREE.Vector3();
  return {
    get translucent() { return Boolean(target); },
    get settled() { return progress.value === target; },
    setTranslucent,
    setGuided(value) { guided = value; button.disabled = value; revealOpacity.value = value ? 0.20 : 0.28; },
    update(camera, dt) {
      progress.value = reducedMotion.matches ? target : THREE.MathUtils.clamp(
        progress.value + Math.sign(target - progress.value) * dt / 0.7, 0, 1);
      // Prevent overshoot when reversing the wipe midway.
      if ((target === 1 && progress.value > target) || (target === 0 && progress.value < target)) progress.value = target;
      for (const { material } of resources) {
        material.depthWrite = progress.value === 0;
        // Keep the original wall shadow and PBR reflections throughout the reveal.
      }
      world.copy(anchor);
      building.localToWorld(world);
      world.project(camera);
      const visible = world.z >= -1 && world.z <= 1 && Math.abs(world.x) <= 1 && Math.abs(world.y) <= 1;
      button.style.display = visible && !guided ? 'inline-flex' : 'none';
      if (visible) {
        button.style.left = `${(world.x + 1) * 0.5 * root.clientWidth}px`;
        button.style.top = `${(1 - world.y) * 0.5 * root.clientHeight}px`;
      }
      return false;
    },
    dispose() {
      button.remove();
      for (const resource of resources) {
        resource.wallMesh.removeFromParent();
        resource.node.geometry = resource.geometry;
        resource.opaqueGeometry.dispose();
        resource.wallGeometry.dispose();
        resource.material.dispose();
        resource.edgeGeometry.dispose();
        resource.edgeMaterial.dispose();
      }
    },
  };
}
