import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRooftopLabels } from './rooftop-labels.js';
import {
  alignRoofOnlyToBuildingInspect,
  applyStudioAtmosphere,
  createStudioSkyBackground,
  fitBuildingForRooftopInspect,
  getObjectPivot,
  SKY_SITE_BOTTOM,
} from './rooftop-camera.js';

const ROOF_DRAG_YAW_SENS = 0.008;
const ROOF_DRAG_PITCH_SENS = 0.005;
const ROOF_DRAG_PITCH_LIMIT = 0.55;
const ROOF_DRAG_RESET_DURATION = 0.32;

const section = document.getElementById('rooftop-detail');
const canvas = document.getElementById('rooftop-detail-canvas');
const sticky = section?.querySelector('.rooftop-detail-sticky');
const statusEl = document.getElementById('rooftop-detail-status');
const backBtn = section?.querySelector('.rooftop-detail-back-link');
const entryBtn = document.getElementById('building-rooftop-entry');

boot();

function boot() {
  if (!section || !canvas || !sticky) return;

  if (window.location.protocol === 'file:') {
    showStatus(
      'The rooftop model cannot load from a local file. Run a local web server and open http://localhost:PORT/.',
      'error'
    );
    section.classList.add('is-blocked');
    return;
  }

  if (!window.gsap) {
    window.setTimeout(boot, 16);
    return;
  }

  try {
    initRooftopSection();
  } catch (error) {
    console.error('Rooftop section init failed:', error);
    showStatus('Rooftop viewer failed to start. Check the browser console for details.', 'error');
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

function resolveRoofModelPath() {
  const attr = section.getAttribute('data-roof-model-path') || './logos/200 water Roof Only.glb';
  try {
    return new URL(attr, document.baseURI).href;
  } catch {
    return attr;
  }
}

function resolveBuildingModelPath() {
  const buildingSection = document.getElementById('building-scroll');
  const attr = buildingSection?.getAttribute('data-model-path') || './logos/200_water.glb';
  try {
    return new URL(attr, document.baseURI).href;
  } catch {
    return attr;
  }
}

function initRooftopSection() {
  const gsap = window.gsap;
  const mobileMq = window.matchMedia('(max-width: 767px)');
  const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  let modelReady = false;
  let sectionVisible = false;
  let disposed = false;
  let roofScene = null;
  let buildingScene = null;
  let rooftopLabels = null;
  let resizeObserver = null;
  let layoutReady = false;
  let cachedInspectLayout = null;
  let labelsBuiltForLayout = false;
  let prewarmScheduled = false;

  const roofDrag = {
    yaw: 0,
    pitch: 0,
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    resetTween: null,
  };
  const roofDragReset = { yaw: 0, pitch: 0 };
  const roofDragQuat = new THREE.Quaternion();
  const roofDragEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const roofPivotScratch = new THREE.Vector3();
  const roofOffsetScratch = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  let roofBase = null;
  let roofPivot = new THREE.Vector3();

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
  const studioSkyBackground = createStudioSkyBackground();
  scene.background = studioSkyBackground;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  const ambient = new THREE.AmbientLight(0xffffff, 0.85);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(6, 12, 8);
  const fillLight = new THREE.DirectionalLight(0xdce8f5, 0.75);
  fillLight.position.set(-8, 4, -6);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
  rimLight.position.set(0, 8, -10);
  scene.add(ambient, keyLight, fillLight, rimLight);

  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  function getPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, mobileMq.matches ? 1.35 : 2);
  }

  function getLayoutSize() {
    const { width, height } = sticky.getBoundingClientRect();
    if (width > 0 && height > 0) return { width, height };
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  }

  function resizeRenderer() {
    const { width, height } = getLayoutSize();
    if (!width || !height) return false;

    renderer.setPixelRatio(getPixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    return true;
  }

  function scheduleLabelRebuild({ defer = false, force = false } = {}) {
    if (labelsBuiltForLayout && !force) return;

    const run = () => {
      rooftopLabels?.rebuild();
      labelsBuiltForLayout = true;
    };

    if (defer) requestAnimationFrame(run);
    else run();
  }

  function storeInspectLayoutCache() {
    cachedInspectLayout = {
      aspect: camera.aspect,
      cameraFov: camera.fov,
      cameraPos: camera.position.clone(),
      lookTarget: lookTarget.clone(),
      roofPosition: roofScene.position.clone(),
      roofQuaternion: roofScene.quaternion.clone(),
      roofScale: roofScene.scale.clone(),
      fogNear: scene.fog?.near ?? 0,
      fogFar: scene.fog?.far ?? 0,
    };
  }

  function applyCachedInspectLayout({ deferLabels = false } = {}) {
    if (!cachedInspectLayout || !roofScene) return false;

    const cache = cachedInspectLayout;
    camera.fov = cache.cameraFov;
    camera.position.copy(cache.cameraPos);
    lookTarget.copy(cache.lookTarget);
    camera.updateProjectionMatrix();

    roofScene.position.copy(cache.roofPosition);
    roofScene.quaternion.copy(cache.roofQuaternion);
    roofScene.scale.copy(cache.roofScale);
    roofScene.updateMatrixWorld(true);

    if (scene.fog) {
      scene.fog.near = cache.fogNear;
      scene.fog.far = cache.fogFar;
    }

    captureRoofBaseTransform();
    layoutReady = true;
    scheduleLabelRebuild({ defer: deferLabels });
    return true;
  }

  function applyInspectLayout({ deferLabels = false, force = false } = {}) {
    if (!roofScene || !buildingScene) return false;
    if (!resizeRenderer()) return false;

    const aspect = camera.aspect;
    if (
      !force &&
      cachedInspectLayout &&
      Math.abs(cachedInspectLayout.aspect - aspect) < 0.015
    ) {
      return applyCachedInspectLayout({ deferLabels });
    }

    const fit = fitBuildingForRooftopInspect(buildingScene, {
      mobile: mobileMq.matches,
      aspect: camera.aspect,
    });

    alignRoofOnlyToBuildingInspect(
      roofScene,
      buildingScene,
      fit.buildingFit,
      fit.roofPos,
      fit.roofLook,
      fit.inspectFov,
      camera.aspect,
      fit.cacheRef
    );

    camera.fov = fit.inspectFov;
    camera.position.copy(fit.roofPos);
    lookTarget.copy(fit.roofLook);
    camera.updateProjectionMatrix();
    applyStudioAtmosphere(scene, fit.roofPos.distanceTo(fit.roofLook) * 2.4);
    captureRoofBaseTransform();
    storeInspectLayoutCache();
    layoutReady = true;
    labelsBuiltForLayout = false;
    scheduleLabelRebuild({ defer: deferLabels, force: true });
    return true;
  }

  function prewarmInspectLayout() {
    if (!roofScene || !buildingScene || layoutReady) return;
    if (!applyInspectLayout()) return;
    renderScene();
  }

  function schedulePrewarmInspectLayout() {
    if (prewarmScheduled || layoutReady) return;
    prewarmScheduled = true;

    const run = () => {
      prewarmScheduled = false;
      if (disposed) return;
      prewarmInspectLayout();
      if (sectionVisible) renderScene();
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run);
    });
  }

  function tryFinalizeModels() {
    if (!buildingScene || !roofScene || modelReady) return;

    buildingScene.visible = false;
    modelRoot.add(buildingScene);
    modelRoot.add(roofScene);
    modelReady = true;
    showStatus('', 'hidden');

    schedulePrewarmInspectLayout();
  }

  function captureRoofBaseTransform() {
    if (!roofScene) return;
    roofScene.updateMatrixWorld(true);
    roofBase = {
      position: roofScene.position.clone(),
      quaternion: roofScene.quaternion.clone(),
      scale: roofScene.scale.clone(),
    };
    roofPivot = getObjectPivot(roofScene);
    resetRoofDrag(false);
  }

  function applyRoofTransform() {
    if (!roofScene || !roofBase) return;

    roofScene.position.copy(roofBase.position);
    roofScene.quaternion.copy(roofBase.quaternion);
    roofScene.scale.copy(roofBase.scale);

    if (Math.abs(roofDrag.yaw) > 1e-6 || Math.abs(roofDrag.pitch) > 1e-6) {
      roofDragEuler.set(roofDrag.pitch, roofDrag.yaw, 0);
      roofDragQuat.setFromEuler(roofDragEuler);

      roofPivotScratch.copy(roofPivot);
      roofOffsetScratch.copy(roofBase.position).sub(roofPivotScratch);
      roofOffsetScratch.applyQuaternion(roofDragQuat);
      roofScene.position.copy(roofPivotScratch).add(roofOffsetScratch);
      roofScene.quaternion.copy(roofDragQuat).multiply(roofBase.quaternion);
    }

    roofScene.updateMatrixWorld(true);
  }

  function updateRoofDragCursor() {
    canvas.classList.toggle('is-roof-draggable', Boolean(roofScene && !roofDrag.resetTween));
  }

  function resetRoofDrag(apply = true) {
    roofDrag.resetTween?.kill();
    roofDrag.resetTween = null;
    roofDrag.yaw = 0;
    roofDrag.pitch = 0;
    roofDrag.active = false;
    roofDrag.pointerId = null;
    if (apply) applyRoofTransform();
    updateRoofDragCursor();
  }

  function renderScene() {
    if (disposed || !modelReady || !layoutReady) return;
    applyRoofTransform();
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
    rooftopLabels?.update();
    renderer.render(scene, camera);
  }

  function tickRender() {
    if (!modelReady || !sectionVisible) return;
    renderScene();
  }

  function openRooftopDetail() {
    if (!section || section.classList.contains('is-open')) return;
    section.hidden = false;
    section.classList.add('is-open');
    section.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-rooftop-detail-open');
    sectionVisible = true;

    if (!modelReady) return;

    resizeRenderer();
    const aspectDrift =
      cachedInspectLayout &&
      Math.abs(camera.aspect - cachedInspectLayout.aspect) > 0.02;

    if (layoutReady && cachedInspectLayout && !aspectDrift) {
      applyCachedInspectLayout({ deferLabels: false });
    } else {
      applyInspectLayout({ deferLabels: true, force: true });
    }

    renderScene();
  }

  function closeRooftopDetail() {
    if (!section || !section.classList.contains('is-open')) return;
    section.classList.remove('is-open');
    section.setAttribute('aria-hidden', 'true');
    section.hidden = true;
    document.body.classList.remove('is-rooftop-detail-open');
    sectionVisible = false;
    if (roofDrag.active) {
      roofDrag.active = false;
      roofDrag.pointerId = null;
      canvas.classList.remove('is-roof-dragging');
    }
  }

  entryBtn?.addEventListener('click', openRooftopDetail);
  backBtn?.addEventListener('click', closeRooftopDetail);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeRooftopDetail();
  });

  function onRoofPointerDown(event) {
    if (!roofScene || roofDrag.active || roofDrag.resetTween) return;
    roofDrag.active = true;
    roofDrag.pointerId = event.pointerId;
    roofDrag.lastX = event.clientX;
    roofDrag.lastY = event.clientY;
    canvas.classList.add('is-roof-dragging');
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onRoofPointerMove(event) {
    if (!roofDrag.active || event.pointerId !== roofDrag.pointerId) return;

    const dx = event.clientX - roofDrag.lastX;
    const dy = event.clientY - roofDrag.lastY;
    roofDrag.lastX = event.clientX;
    roofDrag.lastY = event.clientY;

    roofDrag.yaw += dx * ROOF_DRAG_YAW_SENS;
    roofDrag.pitch = THREE.MathUtils.clamp(
      roofDrag.pitch + dy * ROOF_DRAG_PITCH_SENS,
      -ROOF_DRAG_PITCH_LIMIT,
      ROOF_DRAG_PITCH_LIMIT
    );

    applyRoofTransform();
    event.preventDefault();
  }

  function onRoofPointerEnd(event) {
    if (!roofDrag.active || event.pointerId !== roofDrag.pointerId) return;
    roofDrag.active = false;
    roofDrag.pointerId = null;
    canvas.classList.remove('is-roof-dragging');
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', onRoofPointerDown);
  canvas.addEventListener('pointermove', onRoofPointerMove);
  canvas.addEventListener('pointerup', onRoofPointerEnd);
  canvas.addEventListener('pointercancel', onRoofPointerEnd);

  function onRoofModelLoaded(gltf) {
    roofScene = gltf.scene;
    tryFinalizeModels();
  }

  function onBuildingModelLoaded(gltf) {
    buildingScene = gltf.scene;
    tryFinalizeModels();
  }

  resizeRenderer();
  rooftopLabels = createRooftopLabels({
    host: sticky,
    camera,
    getRoofOnly: () => roofScene,
    getAlpha: () => 1,
  });

  gsap.ticker.add(tickRender);

  window.addEventListener('resize', () => {
    if (!resizeRenderer()) return;
    if (modelReady && sectionVisible) {
      applyInspectLayout({
        deferLabels: true,
        force: true,
      });
    }
    renderScene();
  });

  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (!resizeRenderer()) return;
      if (modelReady && sectionVisible) {
        applyInspectLayout({
          deferLabels: true,
          force: true,
        });
      }
      if (sectionVisible) renderScene();
    });
    resizeObserver.observe(sticky);
  }

  sectionVisible = false;

  if (reduceMotionMq.matches) {
    section.classList.add('is-reduced-motion');
  }

  const loader = new GLTFLoader();
  loader.load(resolveBuildingModelPath(), onBuildingModelLoaded, undefined, (error) => {
    console.error('Building model failed to load for rooftop alignment:', error);
    showStatus('Could not load building model for rooftop alignment.', 'error');
    section.classList.add('is-blocked');
  });
  loader.load(resolveRoofModelPath(), onRoofModelLoaded, undefined, (error) => {
    console.error('Rooftop model failed to load:', error);
    showStatus('Could not load rooftop model.', 'error');
    section.classList.add('is-blocked');
  });

  window.addEventListener(
    'beforeunload',
    () => {
      disposed = true;
      roofDrag.resetTween?.kill();
      rooftopLabels?.dispose();
      canvas.removeEventListener('pointerdown', onRoofPointerDown);
      canvas.removeEventListener('pointermove', onRoofPointerMove);
      canvas.removeEventListener('pointerup', onRoofPointerEnd);
      canvas.removeEventListener('pointercancel', onRoofPointerEnd);
      gsap.ticker.remove(tickRender);
      resizeObserver?.disconnect();
      document.body.classList.remove('is-rooftop-detail-open');
      renderer.dispose();
      studioSkyBackground?.dispose();
    },
    { once: true }
  );
}
