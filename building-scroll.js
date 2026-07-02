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

  scene.add(ambient, keyLight, fillLight, rimLight);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const state = {
    startRotationY: -Math.PI * 0.5,
    sideCamera: new THREE.Vector3(),
    roofCamera: new THREE.Vector3(),
    sideLook: new THREE.Vector3(),
    roofLook: new THREE.Vector3(),
    startFov: 42,
    endFov: 34,
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

  function renderScene() {
    if (disposed || !modelReady) return;
    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
  }

  function tickRender() {
    if (!modelReady || !sectionVisible) return;
    renderScene();
  }

  function getCameraDistance(radius, fov, aspect, padding = 1.2) {
    const vFov = (fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distV = radius / Math.sin(vFov / 2);
    const distH = radius / Math.sin(hFov / 2);
    return Math.max(distV, distH) * padding;
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

    const focusY = sphere.center.y + fittedSize.y * 0.08;
    const orbitDistance = getCameraDistance(sphere.radius, state.startFov, camera.aspect, 1.18);

    state.sideCamera.set(sphere.center.x + orbitDistance, focusY, sphere.center.z + 0.001);
    state.sideLook.set(sphere.center.x, focusY - fittedSize.y * 0.04, sphere.center.z);

    state.roofCamera.set(
      sphere.center.x + sphere.radius * 0.42,
      sphere.center.y + fittedSize.y * 0.58,
      sphere.center.z + sphere.radius * 0.72
    );
    state.roofLook.set(
      sphere.center.x,
      sphere.center.y + fittedSize.y * 0.34,
      sphere.center.z
    );

    pivot.rotation.set(0, state.startRotationY, 0);
    camera.position.copy(state.sideCamera);
    lookTarget.copy(state.sideLook);
    camera.fov = state.startFov;
    camera.updateProjectionMatrix();
  }

  function syncTimeline(timeline) {
    if (!timeline?.scrollTrigger) return;
    timeline.progress(timeline.scrollTrigger.progress);
  }

  function setupScrollAnimation() {
    if (reduceMotionMq.matches) {
      renderScene();
      showStatus('', 'hidden');
      return;
    }

    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: sticky,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onEnter: renderScene,
        onEnterBack: renderScene,
        onRefresh: renderScene,
        onUpdate: renderScene,
      },
    });

    scrollTriggerInstance = timeline.scrollTrigger;

    timeline.to(
      pivot.rotation,
      {
        y: state.startRotationY + Math.PI * 2,
        duration: 0.62,
        ease: 'none',
      },
      0
    );

    timeline.to(
      camera.position,
      {
        x: state.roofCamera.x,
        y: state.roofCamera.y,
        z: state.roofCamera.z,
        duration: 0.38,
        ease: 'power2.inOut',
      },
      0.62
    );

    timeline.to(
      lookTarget,
      {
        x: state.roofLook.x,
        y: state.roofLook.y,
        z: state.roofLook.z,
        duration: 0.38,
        ease: 'power2.inOut',
      },
      0.62
    );

    timeline.to(
      camera,
      {
        fov: state.endFov,
        duration: 0.38,
        ease: 'power2.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
      },
      0.62
    );

    syncTimeline(timeline);
    renderScene();
    showStatus('', 'hidden');
  }

  function handleReducedMotionChange(event) {
    if (event.matches) {
      section.classList.add('is-reduced-motion');
      scrollTriggerInstance?.kill();
      scrollTriggerInstance = null;
      gsap.killTweensOf([pivot.rotation, camera.position, lookTarget, camera]);
      camera.position.copy(state.sideCamera);
      lookTarget.copy(state.sideLook);
      camera.fov = state.startFov;
      camera.updateProjectionMatrix();
      pivot.rotation.y = state.startRotationY;
      renderScene();
      ScrollTrigger.refresh();
      return;
    }

    section.classList.remove('is-reduced-motion');
    setupScrollAnimation();
    ScrollTrigger.refresh();
  }

  function onModelLoaded(gltf) {
    pivot.add(gltf.scene);
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
    if (pivot.children.length) fitModel(pivot.children[0]);
    renderScene();
    ScrollTrigger.refresh();
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
      renderer.dispose();
    },
    { once: true }
  );
}
