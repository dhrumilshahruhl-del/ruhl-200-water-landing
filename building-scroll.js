import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const section = document.getElementById('building-scroll');
const canvas = document.getElementById('building-scroll-canvas');
const sticky = section?.querySelector('.building-scroll-sticky');
const statusEl = document.getElementById('building-scroll-status');

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
  const attr = section.getAttribute('data-model-path') || 'logos/Untitled.glb';
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
  let visibilityObserver = null;
  let modelReady = false;
  let sectionVisible = false;
  let disposed = false;
  let timeline = null;
  let targetProgress = 0;
  const playhead = { progress: 0 };

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
  renderer.setClearColor(0xf3f6f8, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f6f8);

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

  function tickRender() {
    if (!modelReady || !sectionVisible) return;
    if (timeline && !reduceMotionMq.matches) {
      playhead.progress += (targetProgress - playhead.progress) * 0.075;
      timeline.progress(playhead.progress);
    }
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

  function fitModel(object) {
    object.updateMatrixWorld(true);
    prepareMaterials(object);

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    object.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = mobileMq.matches ? 7.5 : 8.5;
    const fitScale = maxDim > 0 ? targetSize / maxDim : 1;
    object.scale.setScalar(fitScale);
    object.updateMatrixWorld(true);

    const fittedBox = new THREE.Box3().setFromObject(object);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
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

    const focus = new THREE.Vector3(0, fittedSize.y * 0.06, 0);
    const orbitDistance = getCameraDistance(sphere.radius, state.startFov, camera.aspect, 1.22);

    const orbitSpan = (130 * Math.PI) / 180;
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

    const roofCenterY = fittedSize.y * 0.34;
    const pitchDown = (52 * Math.PI) / 180;
    const horizontalDist = fittedSize.y * (mobileMq.matches ? 0.38 : 0.42);
    const verticalDist = horizontalDist * Math.tan(pitchDown);
    const lateralOffset = fittedSize.x * 0.11;

    roofLook.set(lateralOffset, roofCenterY, 0);
    roofPos.set(lateralOffset, roofCenterY + verticalDist, horizontalDist);

    const compositionLift = fittedSize.y * (mobileMq.matches ? 0.07 : 0.1);
    roofLook.y += compositionLift;
    roofPos.y += compositionLift;

    state.entryAzimuth = startAzimuth + (endAzimuth - startAzimuth) * 0.025;
    state.entryElevation = startElevation + (endElevation - startElevation) * 0.02;
    state.entryRadius = startRadius + (endRadius - startRadius) * 0.015;

    state.revealPos = revealPos;
    state.phase2EndPos = phase2EndPos;
    state.roofPos = roofPos;
    state.revealLook = revealLook;
    state.roofLook = roofLook;

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
        scrub: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: renderScene,
        onEnterBack: renderScene,
        onRefresh: (self) => {
          targetProgress = self.progress;
          playhead.progress = self.progress;
          renderScene();
        },
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
      },
    });

    scrollTriggerInstance = timeline.scrollTrigger;

    timeline
      .addLabel('phase1', 0)
      .to(
        orbitRig,
        {
          azimuth: state.entryAzimuth,
          elevation: state.entryElevation,
          radius: state.entryRadius,
          duration: 0.1,
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
          duration: 0.55,
          ease: 'power2.out',
          onUpdate: syncCameraFromOrbit,
        },
        0.1
      )
      .to(
        camera,
        {
          fov: state.midFov,
          duration: 0.3,
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
          duration: 0.3,
          ease: 'power1.inOut',
        },
        'phase1'
      )
      .addLabel('phase2', 0.3)
      .to(
        camera,
        {
          fov: state.midFov - 2,
          duration: 0.35,
          ease: 'power1.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        'phase2'
      )
      .to(
        lightRig,
        {
          keyX: state.lightBase.key.x + 1.1,
          keyY: state.lightBase.key.y + 0.15,
          keyZ: state.lightBase.key.z - 0.85,
          fillX: state.lightBase.fill.x - 0.5,
          fillY: state.lightBase.fill.y + 0.25,
          duration: 0.35,
          ease: 'power1.inOut',
        },
        'phase2'
      )
      .addLabel('phase3', 0.65)
      .to(
        camPos,
        {
          x: state.roofPos.x,
          y: state.roofPos.y,
          z: state.roofPos.z,
          duration: 0.35,
          ease: 'power2.out',
        },
        'phase3'
      )
      .to(
        camLook,
        {
          x: state.roofLook.x,
          y: state.roofLook.y,
          z: state.roofLook.z,
          duration: 0.35,
          ease: 'power2.out',
        },
        'phase3'
      )
      .to(
        camera,
        {
          fov: state.endFov,
          duration: 0.35,
          ease: 'power2.out',
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
          duration: 0.35,
          ease: 'power2.out',
        },
        'phase3'
      );

    syncTimeline(timeline);
    targetProgress = timeline.scrollTrigger?.progress ?? 0;
    playhead.progress = targetProgress;
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
    modelRoot.add(gltf.scene);
    fitModel(gltf.scene);
    modelReady = true;

    if (!resizeRenderer()) {
      window.requestAnimationFrame(() => {
        resizeRenderer();
        setupScrollAnimation();
        ScrollTrigger.refresh();
      });
      return;
    }

    setupScrollAnimation();
    ScrollTrigger.refresh();
    window.requestAnimationFrame(renderScene);
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
    if (modelRoot.children.length) fitModel(modelRoot.children[0]);
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

  if ('IntersectionObserver' in window) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        sectionVisible = entries.some((entry) => entry.isIntersecting);
        if (sectionVisible) renderScene();
      },
      { threshold: [0, 0.05, 0.2] }
    );
    visibilityObserver.observe(section);
  } else {
    sectionVisible = true;
  }

  reduceMotionMq.addEventListener('change', handleReducedMotionChange);

  new GLTFLoader().load(modelPath, onModelLoaded, undefined, onModelError);

  window.addEventListener(
    'beforeunload',
    () => {
      disposed = true;
      gsap.ticker.remove(tickRender);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      scrollTriggerInstance?.kill();
      timeline?.kill();
      renderer.dispose();
    },
    { once: true }
  );
}
