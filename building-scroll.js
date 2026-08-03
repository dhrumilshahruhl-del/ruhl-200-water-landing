import * as THREE from 'three';
import { buildingGltfPromise, cloneSceneFromGltf } from './model-preload.js';
import { createBuildingRooftopMode } from './building-rooftop-mode.js';

const SCROLL_ENTRY_END = 0;
const SCROLL_ORBIT_END = 0.68;
const SCROLL_ROOFTOP_END = 1;
/** Show rooftop entry CTA only on the last ~2.5% of scroll (roof fully revealed). */
const ROOFTOP_ENTRY_SHOW_START = SCROLL_ROOFTOP_END - 0.025;
const BUILDING_SCALE_TOP_GUARD_PX = 110;
/** Playhead catch-up — higher = snappier scroll follow, lower = more cinematic lag. */
const PLAYHEAD_SMOOTHING = 0.16;
const PLAYHEAD_SMOOTHING_END = 0.24;
/** Preserve the established facade/camera choreography when using the optimized full-building GLB. */
const OPT_MODEL_ROTATION_COMPENSATION = 1.6876762151311447;
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
  rooftopEntryBtn?.classList.remove('is-visible');
  rooftopEntryBtn?.setAttribute('aria-hidden', 'true');

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
  let rooftopMode = null;

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
  const sizeRig = { progress: 0 };
  const orbitScratch = new THREE.Vector3();
  const framingPoint = new THREE.Vector3();
  const framingBounds = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  let framingOffsetCache = null;

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

  function getBuildingFramingRegion(stickyRect) {
    const leftCol = sideStoryEl?.querySelector('.building-scroll-side-col--left');
    const rightCol = sideStoryEl?.querySelector('.building-scroll-side-col--right');
    const header = sideStoryEl?.querySelector('.building-scroll-side-header');
    if (!leftCol || !rightCol) return null;

    const leftRect = leftCol.getBoundingClientRect();
    const rightRect = rightCol.getBoundingClientRect();
    const columnTop = Math.min(leftRect.top, rightRect.top) - stickyRect.top;
    const headerBottom = header ? header.getBoundingClientRect().bottom - stickyRect.top + 28 : columnTop;
    const top = Math.min(columnTop, headerBottom);
    const bottom = Math.max(leftRect.bottom, rightRect.bottom) - stickyRect.top;
    const left = leftRect.right - stickyRect.left;
    const right = rightRect.left - stickyRect.left;

    if (bottom <= top || right <= left) return null;

    return {
      left,
      right,
      top,
      bottom,
      cx: (left + right) * 0.5,
      cy: (top + bottom) * 0.5,
    };
  }

  function invalidateFramingOffset() {
    framingOffsetCache = null;
  }

  function measureBuildingScreenBounds(stickyRect) {
    if (!buildingScene) return null;

    buildingScene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(buildingScene);
    const { min, max } = box;

    framingBounds[0].set(min.x, min.y, min.z);
    framingBounds[1].set(max.x, min.y, min.z);
    framingBounds[2].set(min.x, max.y, min.z);
    framingBounds[3].set(max.x, max.y, min.z);
    framingBounds[4].set(min.x, min.y, max.z);
    framingBounds[5].set(max.x, min.y, max.z);
    framingBounds[6].set(min.x, max.y, max.z);
    framingBounds[7].set(max.x, max.y, max.z);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sampleCount = 0;

    for (let i = 0; i < 8; i += 1) {
      framingPoint.copy(framingBounds[i]);
      framingPoint.project(camera);
      if (framingPoint.z > 1) continue;

      const sx = (framingPoint.x * 0.5 + 0.5) * stickyRect.width;
      const sy = (-framingPoint.y * 0.5 + 0.5) * stickyRect.height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
      sampleCount += 1;
    }

    if (!sampleCount || !Number.isFinite(minX)) return null;

    return { minX, maxX, minY, maxY };
  }

  function computeFramingShift(region, bounds, opacity) {
    const gapLeft = bounds.minX - region.left;
    const gapRight = region.right - bounds.maxX;
    const gapTop = bounds.minY - region.top;
    const gapBottom = region.bottom - bounds.maxY;

    return {
      shiftX: ((gapRight - gapLeft) * 0.5) * opacity,
      shiftY: ((gapBottom - gapTop) * 0.5) * opacity,
    };
  }

  function computeFramingOffset(stickyRect, opacity) {
    const region = getBuildingFramingRegion(stickyRect);
    if (!region) return null;

    let totalShiftX = 0;
    let totalShiftY = 0;

    for (let pass = 0; pass < 3; pass += 1) {
      if (pass > 0) {
        camera.setViewOffset(
          stickyRect.width,
          stickyRect.height,
          -totalShiftX,
          -totalShiftY,
          stickyRect.width,
          stickyRect.height
        );
        camera.updateProjectionMatrix();
      }

      const bounds = measureBuildingScreenBounds(stickyRect);
      if (!bounds) return null;

      const { shiftX, shiftY } = computeFramingShift(region, bounds, opacity);
      totalShiftX += shiftX;
      totalShiftY += shiftY;
    }

    if (Math.abs(totalShiftX) < 0.5 && Math.abs(totalShiftY) < 0.5) {
      return { shiftX: 0, shiftY: 0 };
    }

    return { shiftX: totalShiftX, shiftY: totalShiftY };
  }

  function getBuildingViewOffsetWeight() {
    const progress = playhead.progress ?? targetProgress;
    if (progress <= SCROLL_ORBIT_END) return 1;
    const fadeEnd = ROOFTOP_ENTRY_SHOW_START;
    if (progress >= fadeEnd) return 0;

    const t = (progress - SCROLL_ORBIT_END) / (fadeEnd - SCROLL_ORBIT_END);
    return 0.5 + Math.cos(t * Math.PI) * 0.5;
  }

  function getScaleTopGuardShift() {
    const progress = playhead.progress ?? targetProgress;
    if (progress <= 0 || progress >= ROOFTOP_ENTRY_SHOW_START) return 0;

    const scaleIn = Math.min(progress / SCROLL_ORBIT_END, 1);
    const fadeOut =
      progress <= SCROLL_ORBIT_END
        ? 1
        : 1 - (progress - SCROLL_ORBIT_END) / (ROOFTOP_ENTRY_SHOW_START - SCROLL_ORBIT_END);
    return BUILDING_SCALE_TOP_GUARD_PX * gsap.parseEase('sine.inOut')(scaleIn) * Math.max(0, fadeOut);
  }

  function applyBuildingViewOffset() {
    if (camera.view) camera.clearViewOffset();

    if (rooftopMode?.isOpen?.() || !sideStoryEl || !sticky || !buildingScene || reduceMotionMq.matches) return;
    if (window.matchMedia('(max-width: 1100px)').matches) return;

    const opacity = getBuildingViewOffsetWeight();
    if (opacity < 0.001) return;

    const stickyRect = sticky.getBoundingClientRect();
    if (!stickyRect.width || !stickyRect.height) return;

    const cacheKey = [
      Math.round(opacity * 40),
      Math.round(stickyRect.width),
      Math.round(stickyRect.height),
      Math.round(camPos.x * 80),
      Math.round(camPos.y * 80),
      Math.round(camPos.z * 80),
      Math.round(camera.fov * 10),
    ].join(':');

    if (framingOffsetCache?.key !== cacheKey) {
      camera.updateProjectionMatrix();
      const offset = computeFramingOffset(stickyRect, opacity);
      framingOffsetCache = offset ? { key: cacheKey, ...offset } : null;
    }

    if (!framingOffsetCache) return;

    const { shiftX } = framingOffsetCache;
    const shiftY = framingOffsetCache.shiftY + getScaleTopGuardShift();
    if (Math.abs(shiftX) < 0.5 && Math.abs(shiftY) < 0.5) return;

    camera.setViewOffset(
      stickyRect.width,
      stickyRect.height,
      -shiftX,
      -shiftY,
      stickyRect.width,
      stickyRect.height
    );
    camera.updateProjectionMatrix();
  }

  function applyCameraFromState() {
    camera.up.set(0, 1, 0);
    camera.position.set(camPos.x, camPos.y, camPos.z);
    lookTarget.set(camLook.x, camLook.y, camLook.z);
    camera.lookAt(lookTarget);
    applyBuildingViewOffset();
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
    if (disposed) return;
    if (!modelReady) {
      camera.up.set(0, 1, 0);
      camera.lookAt(lookTarget);
      renderer.render(scene, camera);
      return;
    }
    if (rooftopMode?.isOpen()) {
      rooftopMode.updateCamera();
      renderer.render(scene, camera);
      return;
    }
    applyCameraFromState();
    applyLightParallax();
    renderer.render(scene, camera);
  }

  function updateRooftopEntryButton(scrollProgress) {
    if (!rooftopEntryBtn) return;
    const progress = scrollProgress ?? playhead.progress;
    const active = progress > 0.001 && (scrollTriggerInstance?.isActive ?? sectionVisible);
    const show =
      active &&
      !reduceMotionMq.matches &&
      progress >= ROOFTOP_ENTRY_SHOW_START;
    rooftopEntryBtn.classList.toggle('is-visible', show);
    rooftopEntryBtn.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function resetToScrollStart() {
    targetProgress = 0;
    playhead.progress = 0;
    sizeRig.progress = 0;
    if (timeline) {
      timeline.pause(0);
    }
    if (state.startAzimuth !== undefined) {
      orbitRig.azimuth = state.startAzimuth;
      orbitRig.elevation = state.startElevation;
      orbitRig.radius = state.startRadius;
      syncCameraFromOrbit();
    }
    camera.fov = state.startFov;
    camera.updateProjectionMatrix();
    if (state.lightBase) {
      lightRig.keyX = state.lightBase.key.x;
      lightRig.keyY = state.lightBase.key.y;
      lightRig.keyZ = state.lightBase.key.z;
      lightRig.fillX = state.lightBase.fill.x;
      lightRig.fillY = state.lightBase.fill.y;
      lightRig.fillZ = state.lightBase.fill.z;
      lightRig.rimX = state.lightBase.rim.x;
      lightRig.rimY = state.lightBase.rim.y;
      lightRig.rimZ = state.lightBase.rim.z;
    }
    updateSideStoryUI(0);
    updateRooftopEntryButton(0);
    renderScene();
  }

  function tickRender() {
    if (!modelReady) return;

    if (rooftopMode?.isOpen()) {
      renderScene();
      return;
    }

    if (!sectionVisible) return;

    if (timeline && !reduceMotionMq.matches) {
      const delta = targetProgress - playhead.progress;
      const smoothing = targetProgress > 0.9 ? PLAYHEAD_SMOOTHING_END : PLAYHEAD_SMOOTHING;
      playhead.progress += delta * smoothing;
      if (Math.abs(delta) < 0.0004) playhead.progress = targetProgress;
      timeline.progress(playhead.progress);
      updateSideStoryUI(playhead.progress);
      rooftopMode?.maybePrefetch(playhead.progress);
    }

    updateRooftopEntryButton(playhead.progress);
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

  function getFovScale(fov) {
    return Math.tan((fov * Math.PI) / 360);
  }

  function applySmoothSizeProgress(progress) {
    if (!state.sizeIncrementFactor) return;

    const easedProgress = gsap.parseEase('sine.inOut')(progress);
    const apparentScale = 1 + (state.sizeIncrementFactor - 1) * easedProgress;
    const fov = state.startFov + (state.midFov - state.startFov) * easedProgress;
    const startFrustum = state.startRadius * getFovScale(state.startFov);

    orbitRig.radius = startFrustum / (apparentScale * getFovScale(fov));
    camera.fov = fov;
    camera.updateProjectionMatrix();
    syncCameraFromOrbit();
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

  function getInspectState() {
    if (!state.buildingFit || !state.roofPos || !state.roofLook) return null;
    return {
      buildingFit: state.buildingFit,
      roofPos: state.roofPos,
      roofLook: state.roofLook,
      inspectFov: state.rooftopInspectFov ?? state.endFov - 3,
    };
  }

  function finalizeRooftopSnap(object) {
    state.rooftopInspectFov = Math.max(29, state.endFov - 3);
    snapRooftopLongEdgeHorizontal(object, state.endFov);
    if (modelPath.includes('.opt.glb')) {
      object.rotation.y += OPT_MODEL_ROTATION_COMPENSATION;
      object.updateMatrixWorld(true);
      rebuildRoofVertexCache(object);
    }
    state.buildingFit.finalRotationY = object.rotation.y;

    if (!state.roofPos) state.roofPos = new THREE.Vector3();
    if (!state.roofLook) state.roofLook = new THREE.Vector3();
    buildRooftopCameraVectors(object, state.roofPos, state.roofLook, state.rooftopInspectFov);
    rooftopMode?.onBuildingInspectReady();
  }

  function fitModelCore(object) {
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
    state.sizeIncrementFactor =
      (startRadius * getFovScale(state.startFov)) / (endRadius * getFovScale(state.midFov));

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

  function fitModel(object) {
    fitModelCore(object);
    finalizeRooftopSnap(object);
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
        scrub: false,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          sectionVisible = self.isActive;
          if (self.progress <= 0.001) {
            resetToScrollStart();
            return;
          }
          updateRooftopEntryButton(self.progress);
          if (sectionVisible) {
            targetProgress = self.progress;
            renderScene();
          }
        },
        onEnter: (self) => {
          sectionVisible = true;
          if (self.progress <= 0.001) {
            resetToScrollStart();
            return;
          }
          targetProgress = self.progress;
          playhead.progress = self.progress;
          updateRooftopEntryButton(self.progress);
          renderScene();
        },
        onEnterBack: (self) => {
          sectionVisible = true;
          if (self.progress <= 0.001) {
            resetToScrollStart();
            return;
          }
          targetProgress = self.progress;
          playhead.progress = self.progress;
          updateRooftopEntryButton(self.progress);
          renderScene();
        },
        onLeave: (self) => {
          sectionVisible = false;
          targetProgress = self.progress;
          playhead.progress = self.progress;
          if (timeline) timeline.progress(self.progress);
          updateSideStoryUI(self.progress);
          updateRooftopEntryButton(self.progress);
          renderScene();
        },
        onLeaveBack: (self) => {
          sectionVisible = false;
          resetToScrollStart();
        },
        onRefresh: (self) => {
          sectionVisible = self.isActive;
          if (self.progress <= 0.001) {
            resetToScrollStart();
            return;
          }
          targetProgress = self.progress;
          playhead.progress = self.progress;
          if (timeline) timeline.progress(self.progress);
          updateSideStoryUI(self.progress);
          updateRooftopEntryButton(self.progress);
          renderScene();
        },
        onUpdate: (self) => {
          targetProgress = self.progress;
          if (self.progress <= 0.001) {
            resetToScrollStart();
            return;
          }
          updateRooftopEntryButton(self.progress);
        },
      },
    });

    scrollTriggerInstance = timeline.scrollTrigger;
    const orbitDuration = SCROLL_ORBIT_END - SCROLL_ENTRY_END;
    const rooftopDuration = SCROLL_ROOFTOP_END - SCROLL_ORBIT_END;

    timeline
      .addLabel('phase1', 0)
      .to(
        sizeRig,
        {
          progress: 1,
          duration: orbitDuration,
          ease: 'none',
          onUpdate: () => applySmoothSizeProgress(sizeRig.progress),
        },
        SCROLL_ENTRY_END
      )
      .to(
        lightRig,
        {
          keyX: state.lightBase.key.x + 0.6,
          keyY: state.lightBase.key.y + 0.35,
          keyZ: state.lightBase.key.z - 0.4,
          fillX: state.lightBase.fill.x - 0.5,
          fillY: state.lightBase.fill.y + 0.25,
          duration: orbitDuration,
          ease: 'sine.inOut',
        },
        SCROLL_ENTRY_END
      )
      .addLabel('phase3', SCROLL_ORBIT_END)
      .to(
        camPos,
        {
          x: state.roofPos.x,
          y: state.roofPos.y,
          z: state.roofPos.z,
          duration: rooftopDuration,
          ease: 'sine.inOut',
        },
        SCROLL_ORBIT_END
      )
      .to(
        camLook,
        {
          x: state.roofLook.x,
          y: state.roofLook.y,
          z: state.roofLook.z,
          duration: rooftopDuration,
          ease: 'sine.inOut',
        },
        SCROLL_ORBIT_END
      )
      .to(
        camera,
        {
          fov: state.rooftopInspectFov ?? state.endFov - 3,
          duration: rooftopDuration,
          ease: 'sine.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        SCROLL_ORBIT_END
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
          duration: rooftopDuration,
          ease: 'sine.inOut',
        },
        SCROLL_ORBIT_END
      );

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
      buildingScene = cloneSceneFromGltf(gltf);
      modelRoot.add(buildingScene);
      fitModelCore(buildingScene);
      finalizeRooftopSnap(buildingScene);
      modelReady = true;
      invalidateFramingOffset();
      showStatus('', 'hidden');

      const finishSetup = () => {
        setupScrollAnimation();
        ScrollTrigger.refresh();
        if (scrollTriggerInstance && timeline) {
          targetProgress = scrollTriggerInstance.progress;
          playhead.progress = targetProgress;
          timeline.progress(targetProgress);
        }
        if (window.lucide?.createIcons) window.lucide.createIcons();
        updateSideStoryUI(playhead.progress);
        renderScene();
      };

      if (!resizeRenderer()) {
        window.requestAnimationFrame(() => {
          resizeRenderer();
          finishSetup();
        });
      } else {
        finishSetup();
      }
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
  showStatus('Loading 3D building…');
  renderScene();
  gsap.ticker.add(tickRender);
  ScrollTrigger.refresh();

  rooftopMode = createBuildingRooftopMode({
    scene,
    camera,
    canvas,
    sticky,
    modelRoot,
    getBuildingScene: () => buildingScene,
    getInspectState,
    onResizeRenderer: resizeRenderer,
    mobileMq,
  });

  window.addEventListener('resize', () => {
    if (!resizeRenderer()) return;
    invalidateFramingOffset();
    rooftopMode?.onResize();
    ScrollTrigger.refresh();
    renderScene();
  });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRenderer()) {
        invalidateFramingOffset();
        renderScene();
      }
    });
    resizeObserver.observe(sticky);
  }

  reduceMotionMq.addEventListener('change', handleReducedMotionChange);

  buildingGltfPromise.then(onModelLoaded).catch(onModelError);

  window.addEventListener(
    'beforeunload',
    () => {
      disposed = true;
      rooftopMode?.dispose();
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
