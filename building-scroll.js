import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const LEGACY_TIMELINE_END = 0.36;
const ORBIT_SPIN_FRACTION = 0.2;
const ROOFTOP_APPROACH_FRACTION = 0.14;
/** Filled in after the scroll timeline is built — last ~10% of scroll progress. */
let rooftopEntryProgress = 0.95;
const ROOFTOP_END_FIT_MARGIN = 0.72;
const ROOFTOP_END_DISTANCE_SCALE = 0.96;

/** Site-matched studio sky (CSS + WebGL share these stops). */
const SKY_SITE_BOTTOM = 0xf7f8f8;

function createStudioSkyBackground(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#dce6ee');
  gradient.addColorStop(0.46, '#eef2f5');
  gradient.addColorStop(1, '#f7f8f8');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function applyStudioAtmosphere(scene, THREE, viewRadius) {
  const r = Math.max(viewRadius || 12, 8);
  scene.fog = new THREE.Fog(SKY_SITE_BOTTOM, r * 0.85, r * 3.15);
}

const section = document.getElementById('building-scroll');
const canvas = document.getElementById('building-scroll-canvas');
const sticky = section?.querySelector('.building-scroll-sticky');
const statusEl = document.getElementById('building-scroll-status');
const sideStoryEl = document.getElementById('building-scroll-side-story');
const rooftopEntryBtn = document.getElementById('building-rooftop-entry');

/** Side story visible through early orbit; fades before rooftop approach. */
const SIDE_STORY_FADE_START = 0.05;
const SIDE_STORY_FADE_END = 0.1;

boot();

function boot() {
  if (!section || !canvas || !sticky) return;

  if (window.location.protocol === 'file:') {
    showStatus(
      'The 3D model cannot load from a local file. Run a local web server and open http://localhost:PORT/.',
      'error'
    );
    section.classList.add('is-blocked');
    return;
  }

  if (!window.gsap || !window.ScrollTrigger) {
    window.setTimeout(boot, 16);
    return;
  }

  try {
    initBuildingScroll();
  } catch (error) {
    console.error('Building scroll init failed:', error);
    showStatus('3D viewer failed to start. Check the browser console for details.', 'error');
    section.classList.add('is-blocked');
  }
}

function showStatus(message, type = 'info') {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.classList.remove('is-hidden', 'is-error');
  if (type === 'error') statusEl.classList.add('is-error');
  if (type === 'hidden') statusEl.classList.add('is-hidden');
}

function resolveModelPath() {
  const attr = section.getAttribute('data-model-path') || 'logos/200_water.glb';
  try {
    return new URL(attr, document.baseURI).href;
  } catch {
    return attr;
  }
}

function initBuildingScroll() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileMq = window.matchMedia('(max-width: 767px)');

  if (reduceMotionMq.matches) {
    section.classList.add('is-reduced-motion');
  }

  let scrollTriggerInstance = null;
  let resizeObserver = null;
  let modelReady = false;
  let sectionVisible = false;
  let disposed = false;
  let timeline = null;
  let targetProgress = 0;
  const playhead = { progress: 0 };
  let buildingScene = null;
  let studioSkyBackground = null;
  let roofVertexCache = null;

  const modelPath = resolveModelPath();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobileMq.matches,
    alpha: false,
    powerPreference: 'high-performance',
  });

  if (!renderer.getContext()) {
    showStatus('WebGL is unavailable in this browser or device.', 'error');
    section.classList.add('is-blocked');
    return;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(SKY_SITE_BOTTOM, 1);

  const scene = new THREE.Scene();
  studioSkyBackground = createStudioSkyBackground(THREE);
  scene.background = studioSkyBackground;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  const lookTarget = new THREE.Vector3();

  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(6, 12, 8);
  const fillLight = new THREE.DirectionalLight(0xdce8f5, 0.75);
  fillLight.position.set(-8, 4, -6);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
  rimLight.position.set(0, 8, -10);

  const lightRig = {
    keyX: keyLight.position.x,
    keyY: keyLight.position.y,
    keyZ: keyLight.position.z,
    fillX: fillLight.position.x,
    fillY: fillLight.position.y,
    fillZ: fillLight.position.z,
    rimX: rimLight.position.x,
    rimY: rimLight.position.y,
    rimZ: rimLight.position.z,
  };

  scene.add(ambient, keyLight, fillLight, rimLight);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  const camPos = { x: 0, y: 0, z: 0 };
  const camLook = { x: 0, y: 0, z: 0 };
  const orbitRig = { azimuth: 0, elevation: 0, radius: 0 };
  const orbitScratch = new THREE.Vector3();

  const state = {
    startFov: 42,
    midFov: 38,
    endFov: 32,
    lightBase: {
      key: keyLight.position.clone(),
      fill: fillLight.position.clone(),
      rim: rimLight.position.clone(),
    },
  };

  function getPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, mobileMq.matches ? 1.35 : 2);
  }

  function resizeRenderer() {
    const { width, height } = sticky.getBoundingClientRect();
    if (!width || !height) return false;

    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    return true;
  }

  function applyCameraFromState() {
    if (camera.view) camera.clearViewOffset();
    camera.up.set(0, 1, 0);
    camera.position.set(camPos.x, camPos.y, camPos.z);
    lookTarget.set(camLook.x, camLook.y, camLook.z);
    camera.lookAt(lookTarget);
  }

  function syncCameraFromOrbit() {
    if (!state.focus) return;
    orbitPoint(orbitRig.azimuth, orbitRig.elevation, orbitRig.radius, state.focus, orbitScratch);
    camPos.x = orbitScratch.x;
    camPos.y = orbitScratch.y;
    camPos.z = orbitScratch.z;
    camLook.x = state.focus.x;
    camLook.y = state.focus.y;
    camLook.z = state.focus.z;
  }

  function applyLightParallax() {
    const dx = camPos.x - state.revealPos.x;
    const dy = camPos.y - state.revealPos.y;
    const dz = camPos.z - state.revealPos.z;

    keyLight.position.set(
      lightRig.keyX + dx * 0.12,
      lightRig.keyY + dy * 0.08,
      lightRig.keyZ + dz * 0.1
    );
    fillLight.position.set(
      lightRig.fillX + dx * 0.06,
      lightRig.fillY + dy * 0.05,
      lightRig.fillZ + dx * 0.04
    );
    rimLight.position.set(
      lightRig.rimX + dx * 0.04,
      lightRig.rimY + dy * 0.06,
      lightRig.rimZ + dz * 0.05
    );
  }

  function renderScene() {
    if (disposed || !modelReady) return;
    applyCameraFromState();
    applyLightParallax();
    renderer.render(scene, camera);
  }

  function updateRooftopEntryButton() {
    if (!rooftopEntryBtn) return;
    const progress = scrollTriggerInstance?.progress ?? targetProgress;
    const active = scrollTriggerInstance?.isActive ?? sectionVisible;
    const show =
      active &&
      !reduceMotionMq.matches &&
      progress >= rooftopEntryProgress - 0.001;
    rooftopEntryBtn.classList.toggle('is-visible', show);
    rooftopEntryBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function tickRender() {
    if (!modelReady) return;
    const active = scrollTriggerInstance?.isActive ?? sectionVisible;
    if (!active) return;
    if (scrollTriggerInstance) {
      targetProgress = scrollTriggerInstance.progress;
      playhead.progress = targetProgress;
    }
    updateRooftopEntryButton();
    renderScene();
  }

  function getCameraDistance(radius, fov, aspect, padding = 1.2) {
    const vFov = (fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distV = radius / Math.sin(vFov / 2);
    const distH = radius / Math.sin(hFov / 2);
    return Math.max(distV, distH) * padding;
  }

  function orbitPoint(azimuth, elevation, radius, target, out) {
    const cosEl = Math.cos(elevation);
    out.set(
      target.x + radius * cosEl * Math.sin(azimuth),
      target.y + radius * Math.sin(elevation),
      target.z + radius * cosEl * Math.cos(azimuth)
    );
    return out;
  }

  function prepareMaterials(object) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      node.frustumCulled = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!material) return;
        material.side = THREE.DoubleSide;
        if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
        material.needsUpdate = true;
      });
    });
  }

  function rebuildRoofVertexCache(object) {
    const localSamples = [];
    const vertex = new THREE.Vector3();
    const local = new THREE.Vector3();

    object.updateMatrixWorld(true);
    object.traverse((node) => {
      if (!node.isMesh || !node.geometry?.attributes?.position) return;
      const positions = node.geometry.attributes.position;
      const stride = Math.max(1, Math.floor(positions.count / 1200));

      for (let i = 0; i < positions.count; i += stride) {
        vertex.fromBufferAttribute(positions, i);
        local.copy(vertex);
        node.localToWorld(local);
        object.worldToLocal(local);
        localSamples.push(local.clone());
      }
    });

    if (!localSamples.length) {
      roofVertexCache = null;
      return;
    }

    const localBox = new THREE.Box3();
    localSamples.forEach((point) => localBox.expandByPoint(point));
    const roofBandMin = localBox.min.y + (localBox.max.y - localBox.min.y) * 0.82;
    roofVertexCache = {
      object,
      localVertices: localSamples.filter((point) => point.y >= roofBandMin),
    };
  }

  function getRooftopMeshBounds(object) {
    if (!roofVertexCache || roofVertexCache.object !== object) {
      rebuildRoofVertexCache(object);
    }

    if (roofVertexCache?.localVertices.length) {
      const roofBox = new THREE.Box3();
      const world = new THREE.Vector3();
      roofVertexCache.localVertices.forEach((local) => {
        world.copy(local);
        object.localToWorld(world);
        roofBox.expandByPoint(world);
      });
      if (!roofBox.isEmpty()) return roofBox;
    }

    return new THREE.Box3().setFromObject(object);
  }

  function getBoundsFramePoints(box) {
    const { min, max } = box;
    const height = Math.max(max.y - min.y, 0.001);
    const yLevels = [max.y, max.y - height * 0.35, max.y - height * 0.7];
    const points = [];

    yLevels.forEach((y) => {
      points.push(
        new THREE.Vector3(min.x, y, min.z),
        new THREE.Vector3(max.x, y, min.z),
        new THREE.Vector3(max.x, y, max.z),
        new THREE.Vector3(min.x, y, max.z)
      );
    });

    return points;
  }

  function getRooftopFramePoints(object) {
    return getBoundsFramePoints(getRooftopMeshBounds(object));
  }

  function estimateFootprintLongAxisAngle(object) {
    const box = new THREE.Box3().setFromObject(object);
    const bandTop = box.min.y + (box.max.y - box.min.y) * 0.2;
    const samples = [];
    const vertex = new THREE.Vector3();

    object.traverse((node) => {
      if (!node.isMesh || !node.geometry?.attributes?.position) return;
      const positions = node.geometry.attributes.position;
      const stride = Math.max(1, Math.floor(positions.count / 800));

      for (let i = 0; i < positions.count; i += stride) {
        vertex.fromBufferAttribute(positions, i);
        node.localToWorld(vertex);
        if (vertex.y <= bandTop) samples.push(new THREE.Vector2(vertex.x, vertex.z));
      }
    });

    if (samples.length < 8) return 0;

    let meanX = 0;
    let meanZ = 0;
    samples.forEach((point) => {
      meanX += point.x;
      meanZ += point.y;
    });
    meanX /= samples.length;
    meanZ /= samples.length;

    let covXX = 0;
    let covZZ = 0;
    let covXZ = 0;
    samples.forEach((point) => {
      const dx = point.x - meanX;
      const dz = point.y - meanZ;
      covXX += dx * dx;
      covZZ += dz * dz;
      covXZ += dx * dz;
    });

    return 0.5 * Math.atan2(2 * covXZ, covXX - covZZ);
  }

  function getLongFootprintEdges(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const { min, max } = box;
    const yBase = min.y + size.y * 0.06;
    const yRoof = max.y - size.y * 0.04;
    const longAxisX = size.x >= size.z;

    const edgesForY = (y) => {
      if (longAxisX) {
        return [
          [new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(max.x, y, min.z)],
          [new THREE.Vector3(min.x, y, max.z), new THREE.Vector3(max.x, y, max.z)],
        ];
      }
      return [
        [new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(min.x, y, max.z)],
        [new THREE.Vector3(max.x, y, min.z), new THREE.Vector3(max.x, y, max.z)],
      ];
    };

    return [...edgesForY(yBase), ...edgesForY(yRoof)];
  }

  function screenEdgeTiltFromHorizontal(start, end, cam) {
    const a = start.clone().project(cam);
    const b = end.clone().project(cam);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx * dx + dy * dy < 1e-8) return Math.PI / 2;

    let angle = Math.abs(Math.atan2(dy, dx));
    if (angle > Math.PI / 2) angle = Math.PI - angle;
    return angle;
  }

  function createRooftopAlignCamera(roofPos, roofLook, fov) {
    const alignCam = new THREE.PerspectiveCamera(fov, camera.aspect, 0.1, 500);
    alignCam.position.copy(roofPos);
    alignCam.up.set(0, 1, 0);
    alignCam.lookAt(roofLook);
    alignCam.updateMatrixWorld(true);
    return alignCam;
  }

  function measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov) {
    const alignCam = createRooftopAlignCamera(roofPos, roofLook, fov);

    let worst = 0;
    getLongFootprintEdges(object).forEach(([start, end]) => {
      worst = Math.max(worst, screenEdgeTiltFromHorizontal(start, end, alignCam));
    });
    return worst;
  }

  function snapRooftopLongEdgeHorizontal(object, fov) {
    rebuildRoofVertexCache(object);
    const pcaBase = -estimateFootprintLongAxisAngle(object);
    const roofPos = new THREE.Vector3();
    const roofLook = new THREE.Vector3();
    let bestRotation = pcaBase;
    let bestTilt = Infinity;

    for (let step = 0; step < 72; step += 1) {
      object.rotation.y = pcaBase + (step * Math.PI * 2) / 72;
      object.updateMatrixWorld(true);
      buildRooftopCameraVectors(object, roofPos, roofLook, fov);
      const tilt = measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov);
      if (tilt < bestTilt) {
        bestTilt = tilt;
        bestRotation = object.rotation.y;
      }
    }

    for (let step = -120; step <= 120; step += 1) {
      object.rotation.y = bestRotation + step / 1200;
      object.updateMatrixWorld(true);
      buildRooftopCameraVectors(object, roofPos, roofLook, fov);
      const tilt = measureLongFootprintEdgeTilt(object, roofPos, roofLook, fov);
      if (tilt < bestTilt) {
        bestTilt = tilt;
        bestRotation = object.rotation.y;
      }
    }

    object.rotation.y = bestRotation + Math.PI;
    object.updateMatrixWorld(true);
  }

  function buildRooftopCameraVectors(object, outPos, outLook, fov = state.rooftopInspectFov ?? state.endFov - 3) {
    const roofBox = getRooftopMeshBounds(object);
    const roofSize = roofBox.getSize(new THREE.Vector3());
    const roofCenter = roofBox.getCenter(new THREE.Vector3());
    const pitchDown = (52 * Math.PI) / 180;
    const compositionLift = roofSize.y * (mobileMq.matches ? 0.08 : 0.1);
    const roofSpan = Math.max(roofSize.x, roofSize.z, roofSize.y * 0.5);
    let horizontalDist = roofSpan * (mobileMq.matches ? 0.92 : 1.0);

    outLook.set(roofCenter.x, roofCenter.y - roofSize.y * 0.12 + compositionLift, roofCenter.z);

    const alignCam = createRooftopAlignCamera(outPos, outLook, fov);
    const corners = getRooftopFramePoints(object);

    for (let attempt = 0; attempt < 18; attempt += 1) {
      const verticalDist = horizontalDist * Math.tan(pitchDown);
      outPos.set(outLook.x, outLook.y + verticalDist, outLook.z + horizontalDist);
      alignCam.position.copy(outPos);
      alignCam.lookAt(outLook);
      alignCam.updateMatrixWorld(true);

      const projected = corners.map((corner) => corner.clone().project(alignCam));
      const maxExtent = projected.reduce(
        (peak, point) => Math.max(peak, Math.abs(point.x), Math.abs(point.y)),
        0
      );

      if (maxExtent <= ROOFTOP_END_FIT_MARGIN) break;
      horizontalDist *= 1.08;
    }

    horizontalDist *= ROOFTOP_END_DISTANCE_SCALE;
    const verticalDist = horizontalDist * Math.tan(pitchDown);
    outPos.set(outLook.x, outLook.y + verticalDist, outLook.z + horizontalDist);
  }

  function fitModel(object) {
    object.updateMatrixWorld(true);
    prepareMaterials(object);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const initialCenter = center.clone();

    object.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = mobileMq.matches ? 7.5 : 8.5;
    const fitScale = maxDim > 0 ? targetSize / maxDim : 1;
    object.scale.setScalar(fitScale);
    object.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3().setFromObject(object);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    const fittedCenterBeforeRecenter = fittedCenter.clone();
    object.position.sub(fittedCenter);
    object.updateMatrixWorld(true);

    fittedBox.setFromObject(object);
    const fittedSize = fittedBox.getSize(new THREE.Vector3());
    const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());

    if (fittedSize.z > fittedSize.x) {
      object.rotation.y = Math.PI / 2;
      object.updateMatrixWorld(true);
      fittedBox.setFromObject(object);
      fittedBox.getSize(fittedSize);
      fittedBox.getBoundingSphere(sphere);
    }

    state.rooftopInspectFov = Math.max(29, state.endFov - 3);
    snapRooftopLongEdgeHorizontal(object, state.endFov);

    state.buildingFit = {
      initialCenter,
      fittedCenter: fittedCenterBeforeRecenter,
      fitScale,
      finalRotationY: object.rotation.y,
    };

    fittedBox.setFromObject(object);
    fittedBox.getSize(fittedSize);
    fittedBox.getBoundingSphere(sphere);

    const focus = new THREE.Vector3(0, fittedSize.y * 0.115, 0);
    const orbitDistance = getCameraDistance(sphere.radius, state.startFov, camera.aspect, 1.22);

    const orbitSpan = (38 * Math.PI) / 180;
    const endAzimuth = 0.38;
    const startAzimuth = endAzimuth - orbitSpan;
    const startElevation = 0.32;
    const endElevation = 0.17;
    const startRadius = orbitDistance * 1.18;
    const endRadius = orbitDistance * 0.68;

    const revealPos = new THREE.Vector3();
    const phase2EndPos = new THREE.Vector3();
    const roofPos = new THREE.Vector3();
    const revealLook = new THREE.Vector3();
    const roofLook = new THREE.Vector3();

    orbitPoint(startAzimuth, startElevation, startRadius, focus, revealPos);
    orbitPoint(endAzimuth, endElevation, endRadius, focus, phase2EndPos);

    revealLook.copy(focus);

    state.focus = focus;
    state.startAzimuth = startAzimuth;
    state.endAzimuth = endAzimuth;
    state.startElevation = startElevation;
    state.endElevation = endElevation;
    state.startRadius = startRadius;
    state.endRadius = endRadius;

    orbitRig.azimuth = startAzimuth;
    orbitRig.elevation = startElevation;
    orbitRig.radius = startRadius;

    buildRooftopCameraVectors(object, roofPos, roofLook, state.rooftopInspectFov);

    state.entryAzimuth = startAzimuth + (endAzimuth - startAzimuth) * 0.025;
    state.entryElevation = startElevation + (endElevation - startElevation) * 0.02;
    state.entryRadius = startRadius + (endRadius - startRadius) * 0.015;

    state.revealPos = revealPos;
    state.phase2EndPos = phase2EndPos;
    state.roofPos = roofPos;
    state.revealLook = revealLook;
    state.roofLook = roofLook;

    const roofTopY = fittedSize.y * 0.5 - 0.03;
    state.roofTopY = roofTopY;
    state.fittedSize = fittedSize;

    syncCameraFromOrbit();

    camera.fov = state.startFov;
    camera.updateProjectionMatrix();

    lightRig.keyX = state.lightBase.key.x;
    lightRig.keyY = state.lightBase.key.y;
    lightRig.keyZ = state.lightBase.key.z;
    lightRig.fillX = state.lightBase.fill.x;
    lightRig.fillY = state.lightBase.fill.y;
    lightRig.fillZ = state.lightBase.fill.z;
    lightRig.rimX = state.lightBase.rim.x;
    lightRig.rimY = state.lightBase.rim.y;
    lightRig.rimZ = state.lightBase.rim.z;

    applyStudioAtmosphere(scene, THREE, Math.max(startRadius, endRadius, sphere.radius * 2.2));
  }

  function updateSideStoryUI(scrollProgress) {
    if (!sideStoryEl) return;
    if (reduceMotionMq.matches) {
      sideStoryEl.style.opacity = '0';
      sideStoryEl.style.visibility = 'hidden';
      sideStoryEl.setAttribute('aria-hidden', 'true');
      return;
    }

    const p = scrollProgress ?? targetProgress;
    let opacity = 1;
    if (p >= SIDE_STORY_FADE_END) {
      opacity = 0;
    } else if (p > SIDE_STORY_FADE_START) {
      opacity = 1 - (p - SIDE_STORY_FADE_START) / (SIDE_STORY_FADE_END - SIDE_STORY_FADE_START);
    }

    sideStoryEl.style.opacity = String(opacity);
    sideStoryEl.style.visibility = opacity < 0.04 ? 'hidden' : 'visible';
    sideStoryEl.setAttribute('aria-hidden', opacity < 0.08 ? 'true' : 'false');
  }

  function updateApproachUI() {
    updateSideStoryUI();
  }

  function syncTimeline(activeTimeline) {
    if (!activeTimeline?.scrollTrigger) return;
    const progress = activeTimeline.scrollTrigger.progress;
    targetProgress = progress;
    playhead.progress = progress;
    activeTimeline.progress(progress);
  }

  function setupScrollAnimation() {
    if (reduceMotionMq.matches) {
      if (state.roofPos) {
        camPos.x = state.roofPos.x;
        camPos.y = state.roofPos.y;
        camPos.z = state.roofPos.z;
        camLook.x = state.roofLook.x;
        camLook.y = state.roofLook.y;
        camLook.z = state.roofLook.z;
        camera.fov = state.rooftopInspectFov ?? state.endFov - 3;
        camera.updateProjectionMatrix();
      }
      updateApproachUI();
      updateSideStoryUI(0);
      updateRooftopEntryButton();
      renderScene();
      showStatus('', 'hidden');
      return;
    }

    timeline?.scrollTrigger?.kill();
    timeline?.kill();
    timeline = null;

    timeline = gsap.timeline({
      defaults: { ease: 'none' },
      paused: true,
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: sticky,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          sectionVisible = self.isActive;
          if (sectionVisible) renderScene();
        },
        onEnter: renderScene,
        onEnterBack: renderScene,
        onRefresh: (self) => {
          sectionVisible = self.isActive;
          targetProgress = self.progress;
          playhead.progress = self.progress;
          updateRooftopEntryButton();
          renderScene();
        },
        onUpdate: (self) => {
          targetProgress = self.progress;
          playhead.progress = self.progress;
        },
      },
    });

    scrollTriggerInstance = timeline.scrollTrigger;
    const L = LEGACY_TIMELINE_END;
    const orbitEnd = ORBIT_SPIN_FRACTION * L;
    const timelineDuration = orbitEnd + ROOFTOP_APPROACH_FRACTION * L;
    rooftopEntryProgress = 1 - (ROOFTOP_APPROACH_FRACTION * L / timelineDuration) * 0.1;

    timeline
      .addLabel('phase1', 0)
      .to(
        orbitRig,
        {
          azimuth: state.entryAzimuth,
          elevation: state.entryElevation,
          radius: state.entryRadius,
          duration: 0.035 * L,
          ease: 'power1.inOut',
          onUpdate: syncCameraFromOrbit,
        },
        0
      )
      .to(
        orbitRig,
        {
          azimuth: state.endAzimuth,
          elevation: state.endElevation,
          radius: state.endRadius,
          duration: ORBIT_SPIN_FRACTION * L,
          ease: 'power2.out',
          onUpdate: syncCameraFromOrbit,
        },
        0.035 * L
      )
      .to(
        camera,
        {
          fov: state.midFov,
          duration: ORBIT_SPIN_FRACTION * L,
          ease: 'power1.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        'phase1'
      )
      .to(
        lightRig,
        {
          keyX: state.lightBase.key.x + 0.6,
          keyY: state.lightBase.key.y + 0.35,
          keyZ: state.lightBase.key.z - 0.4,
          fillX: state.lightBase.fill.x - 0.5,
          fillY: state.lightBase.fill.y + 0.25,
          duration: ORBIT_SPIN_FRACTION * L,
          ease: 'power1.inOut',
        },
        'phase1'
      )
      .addLabel('phase3', orbitEnd)
      .to(
        camPos,
        {
          x: state.roofPos.x,
          y: state.roofPos.y,
          z: state.roofPos.z,
          duration: ROOFTOP_APPROACH_FRACTION * L,
          ease: 'power2.inOut',
          onStart: () => {
            orbitRig.azimuth = state.endAzimuth;
            orbitRig.elevation = state.endElevation;
            orbitRig.radius = state.endRadius;
            syncCameraFromOrbit();
          },
        },
        'phase3'
      )
      .to(
        camLook,
        {
          x: state.roofLook.x,
          y: state.roofLook.y,
          z: state.roofLook.z,
          duration: ROOFTOP_APPROACH_FRACTION * L,
          ease: 'power2.inOut',
        },
        'phase3'
      )
      .to(
        camera,
        {
          fov: state.rooftopInspectFov ?? state.endFov - 3,
          duration: ROOFTOP_APPROACH_FRACTION * L,
          ease: 'power2.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        'phase3'
      )
      .to(
        lightRig,
        {
          keyX: state.lightBase.key.x + 1.6,
          keyY: state.lightBase.key.y + 1.4,
          keyZ: state.lightBase.key.z - 1.2,
          fillX: state.lightBase.fill.x - 0.9,
          fillY: state.lightBase.fill.y + 0.55,
          rimY: state.lightBase.rim.y + 0.8,
          duration: ROOFTOP_APPROACH_FRACTION * L,
          ease: 'power2.inOut',
        },
        'phase3'
      );

    timeline.eventCallback('onUpdate', () => {
      updateApproachUI();
      updateSideStoryUI();
      updateRooftopEntryButton();
    });

    syncTimeline(timeline);
    scrollTriggerInstance = timeline.scrollTrigger;
    sectionVisible = scrollTriggerInstance?.isActive ?? false;
    targetProgress = scrollTriggerInstance?.progress ?? 0;
    playhead.progress = targetProgress;
    updateRooftopEntryButton();
    renderScene();
    showStatus('', 'hidden');
  }

  function handleReducedMotionChange(event) {
    if (event.matches) {
      section.classList.add('is-reduced-motion');
      scrollTriggerInstance?.kill();
      timeline?.kill();
      scrollTriggerInstance = null;
      timeline = null;
      gsap.killTweensOf([camPos, camLook, camera, lightRig, orbitRig]);
      targetProgress = 0;
      playhead.progress = 0;
      updateRooftopEntryButton();

      if (state.startAzimuth !== undefined) {
        orbitRig.azimuth = state.startAzimuth;
        orbitRig.elevation = state.startElevation;
        orbitRig.radius = state.startRadius;
        syncCameraFromOrbit();
      }

      camera.fov = state.startFov;
      camera.updateProjectionMatrix();
      renderScene();
      ScrollTrigger.refresh();
      return;
    }

    section.classList.remove('is-reduced-motion');
    setupScrollAnimation();
    ScrollTrigger.refresh();
  }

  function onModelLoaded(gltf) {
    try {
      buildingScene = gltf.scene;
      modelRoot.add(buildingScene);
      fitModel(buildingScene);
      modelReady = true;

      if (!resizeRenderer()) {
        window.requestAnimationFrame(() => {
          resizeRenderer();
          setupScrollAnimation();
          ScrollTrigger.refresh();
          renderScene();
        });
        return;
      }

      setupScrollAnimation();
      ScrollTrigger.refresh();
      if (window.lucide?.createIcons) window.lucide.createIcons();
      updateSideStoryUI();
      window.requestAnimationFrame(renderScene);
    } catch (error) {
      console.error('Building scene setup failed:', error);
      showStatus('3D scene failed to initialize. Check the browser console for details.', 'error');
      section.classList.add('is-blocked');
    }
  }

  function onModelError(error) {
    console.error('Building model failed to load:', error);
    showStatus(`Could not load 3D model (${modelPath}).`, 'error');
    section.classList.add('is-blocked');
  }

  resizeRenderer();
  gsap.ticker.add(tickRender);

  window.addEventListener('resize', () => {
    if (!resizeRenderer()) return;
    if (buildingScene) {
      fitModel(buildingScene);
    }
    setupScrollAnimation();
    ScrollTrigger.refresh();
    renderScene();
  });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRenderer()) renderScene();
    });
    resizeObserver.observe(sticky);
  }

  reduceMotionMq.addEventListener('change', handleReducedMotionChange);

  new GLTFLoader().load(modelPath, onModelLoaded, undefined, onModelError);

  window.addEventListener(
    'beforeunload',
    () => {
      disposed = true;
      gsap.ticker.remove(tickRender);
      resizeObserver?.disconnect();
      scrollTriggerInstance?.kill();
      timeline?.kill();
      renderer.dispose();
      studioSkyBackground?.dispose();
    },
    { once: true }
  );
}
