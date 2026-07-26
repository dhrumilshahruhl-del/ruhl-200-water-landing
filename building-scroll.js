import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  rooftopRetrofitConfig,
  createRooftopRetrofitGroup,
  createFlowSystem,
  updateFlowPaths,
  setFlowVisibility,
  tickFlows,
  tickFans,
  disposeRooftopResources,
  getLabelDefinitions,
  getFlowLabelDefinitions,
  FLOW_PALETTE,
  PRIMARY_FLOW_IDS,
} from './rooftop-retrofit.js';

const LEGACY_TIMELINE_END = 0.52;
const FLOW_LEGEND_ITEMS = PRIMARY_FLOW_IDS.map((id) => ({
  id,
  label: FLOW_PALETTE[id].legend,
  color: FLOW_PALETTE[id].hex,
}));

const section = document.getElementById('building-scroll');
const canvas = document.getElementById('building-scroll-canvas');
const sticky = section?.querySelector('.building-scroll-sticky');
const statusEl = document.getElementById('building-scroll-status');
const rooftopUi = document.getElementById('building-scroll-rooftop-ui');
const labelLayer = document.getElementById('rooftop-label-layer');
const flowLabelLayer = document.getElementById('rooftop-flow-label-layer');
const flowLegend = document.getElementById('rooftop-flow-legend');
const howItWorksPanel = document.getElementById('rooftop-how-it-works');

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
  const rooftopPhase = { equipment: 0, flows: 0, labels: 0, drift: 0 };
  let rooftopRetrofitGroup = null;
  let rooftopFlows = null;
  let rooftopRevealMeshes = [];
  let rooftopSpinMeshes = [];
  let rooftopAnchors = {};
  let labelElements = [];
  let flowLabelElements = [];
  let labelLeaderSvg = null;
  let labelCustomPos = {};
  let labelDrag = null;
  let labelDragListenersBound = false;
  let debugControls = null;
  let debugHelpers = null;
  let lastTickTime = performance.now();
  let flowsActive = false;
  let buildingScene = null;
  const debugRooftop = new URLSearchParams(window.location.search).get('debugRooftop') === 'true';

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
    updateRooftopLabels();
    updateFlowLabels();
    renderer.render(scene, camera);
  }

  function tickRender() {
    if (!modelReady || !sectionVisible) return;
    const now = performance.now();
    const dt = Math.min((now - lastTickTime) / 1000, 0.05);
    lastTickTime = now;

    if (timeline && !reduceMotionMq.matches) {
      playhead.progress += (targetProgress - playhead.progress) * 0.075;
      timeline.progress(playhead.progress);
    }

    if (rooftopFlows && flowsActive) {
      tickFlows(rooftopFlows, dt, sectionVisible, reduceMotionMq.matches);
      tickFans(rooftopSpinMeshes, dt, sectionVisible && !reduceMotionMq.matches);
    } else if (rooftopSpinMeshes.length && flowsActive && reduceMotionMq.matches) {
      tickFans(rooftopSpinMeshes, dt * 0.2, true);
    }

    if (debugControls) debugControls.update();
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

  function estimatePenthouseExclusion(object, roofTopY, fittedSize) {
    const roofBandMin = roofTopY - fittedSize.y * 0.06;
    const merged = new THREE.Box3();
    let found = false;

    object.traverse((node) => {
      if (!node.isMesh) return;
      const box = new THREE.Box3().setFromObject(node);
      if (box.max.y < roofBandMin) return;
      const size = box.getSize(new THREE.Vector3());
      if (size.y > fittedSize.y * 0.12) return;
      if (size.x > fittedSize.x * 0.92 && size.z > fittedSize.z * 0.92) return;
      if (box.min.y < roofTopY - fittedSize.y * 0.04) return;
      if (!found) {
        merged.copy(box);
        found = true;
      } else {
        merged.union(box);
      }
    });

    if (!found) {
      return {
        halfX: fittedSize.x * 0.14,
        halfZ: fittedSize.z * 0.22,
        centerX: 0,
        centerZ: 0,
      };
    }

    const center = merged.getCenter(new THREE.Vector3());
    const size = merged.getSize(new THREE.Vector3());
    return {
      halfX: size.x / 2 + fittedSize.x * 0.03,
      halfZ: size.z / 2 + fittedSize.z * 0.03,
      centerX: center.x,
      centerZ: center.z,
    };
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

    const roofTopY = fittedSize.y * 0.5 - 0.03;
    state.roofTopY = roofTopY;
    state.fittedSize = fittedSize;
    state.penthouseExclusion = estimatePenthouseExclusion(object, roofTopY, fittedSize);

    state.retrofitCenter = new THREE.Vector3(lateralOffset * 0.35, roofTopY + 0.35, 0);

    const inspectDir = new THREE.Vector3().subVectors(roofLook, roofPos).normalize();
    state.inspectLook = state.retrofitCenter.clone();
    const inspectDistance = fittedSize.y * (mobileMq.matches ? 0.062 : 0.082);
    state.inspectPos = roofPos.clone().addScaledVector(inspectDir, -inspectDistance);
    state.inspectPos.y -= fittedSize.y * 0.018;
    state.finalInspectPos = state.inspectPos.clone();
    state.finalInspectPos.x += fittedSize.x * 0.018;
    state.finalInspectPos.y += fittedSize.y * 0.012;
    state.finalInspectPos.z += fittedSize.z * 0.022;
    state.finalInspectLook = state.inspectLook.clone();
    state.rooftopInspectFov = Math.max(26, state.endFov - 11);

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

  function setupRooftopUI() {
    if (!labelLayer || !flowLegend) return;
    labelLayer.innerHTML = '';
    if (flowLabelLayer) flowLabelLayer.innerHTML = '';
    const svgNS = 'http://www.w3.org/2000/svg';

    labelLeaderSvg = document.createElementNS(svgNS, 'svg');
    labelLeaderSvg.setAttribute('class', 'rooftop-label-leaders');
    labelLeaderSvg.setAttribute('aria-hidden', 'true');
    labelLeaderSvg.innerHTML = `
      <defs>
        <marker id="rooftop-label-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#00375a"></path>
        </marker>
      </defs>
    `;
    labelLayer.appendChild(labelLeaderSvg);

    const defs = [...getLabelDefinitions()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    labelElements = defs.map((def) => {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('class', 'rooftop-label-line');
      line.setAttribute('marker-end', 'url(#rooftop-label-arrow)');
      labelLeaderSvg.appendChild(line);

      const el = document.createElement('div');
      el.className = 'rooftop-label-callout';
      el.dataset.labelId = def.id;
      el.title = 'Drag to reposition';
      el.innerHTML = `
        <div class="rooftop-label-card">
          <strong>${def.title}</strong>
          <span class="rooftop-label-body">${def.body}</span>
        </div>
      `;
      labelLayer.appendChild(el);
      return { ...def, el, line };
    });

    flowLabelElements = getFlowLabelDefinitions().map((def) => {
      const el = document.createElement('div');
      el.className = 'rooftop-flow-tag';
      el.dataset.flowId = def.id;
      el.style.setProperty('--flow-color', def.color);
      el.style.background = def.tagBg || def.color;
      el.style.color = def.tagFg || '#ffffff';
      el.style.borderColor = 'rgba(255,255,255,0.35)';
      el.textContent = def.label;
      flowLabelLayer?.appendChild(el);
      return { ...def, el };
    });

    const list = flowLegend.querySelector('ul');
    if (list) {
      list.innerHTML = FLOW_LEGEND_ITEMS.map(
        (item) =>
          `<li><span class="rooftop-flow-swatch" style="background:${item.color}"></span>${item.label}</li>`
      ).join('');
    }

    bindLabelDragHandlers();
  }

  function bindLabelDragHandlers() {
    if (!labelLayer || labelDragListenersBound) return;
    labelDragListenersBound = true;

    labelLayer.addEventListener('pointerdown', (e) => {
      const callout = e.target.closest('.rooftop-label-callout.is-visible');
      if (!callout) return;
      const item = labelElements.find((entry) => entry.el === callout);
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      const layerRect = sticky.getBoundingClientRect();
      const left = parseFloat(callout.style.left) || 0;
      const top = parseFloat(callout.style.top) || 0;

      labelDrag = {
        item,
        pointerId: e.pointerId,
        offsetX: e.clientX - layerRect.left - left,
        offsetY: e.clientY - layerRect.top - top,
      };

      callout.classList.add('is-dragging');
      callout.setPointerCapture(e.pointerId);

      const onDocMove = (moveEvent) => {
        if (!labelDrag || moveEvent.pointerId !== labelDrag.pointerId) return;
        moveEvent.preventDefault();

        const layerRect = sticky.getBoundingClientRect();
        const el = labelDrag.item.el;
        const cardW = el.offsetWidth || LABEL_CARD_W;
        const cardH = el.offsetHeight || LABEL_CARD_H;

        let left = moveEvent.clientX - layerRect.left - labelDrag.offsetX;
        let top = moveEvent.clientY - layerRect.top - labelDrag.offsetY;
        left = Math.max(LABEL_PAD, Math.min(layerRect.width - cardW - LABEL_PAD, left));
        top = Math.max(LABEL_PAD, Math.min(layerRect.height - cardH - LABEL_PAD, top));

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        labelCustomPos[labelDrag.item.id] = { left, top };

        syncLabelLeaderForItem(labelDrag.item, layerRect.width, layerRect.height);
      };

      const onDocUp = (upEvent) => {
        if (!labelDrag || upEvent.pointerId !== labelDrag.pointerId) return;
        labelDrag.item.el.classList.remove('is-dragging');
        try {
          labelDrag.item.el.releasePointerCapture(upEvent.pointerId);
        } catch {
          /* already released */
        }
        labelDrag = null;
        document.removeEventListener('pointermove', onDocMove);
        document.removeEventListener('pointerup', onDocUp);
        document.removeEventListener('pointercancel', onDocUp);
      };

      document.addEventListener('pointermove', onDocMove);
      document.addEventListener('pointerup', onDocUp);
      document.addEventListener('pointercancel', onDocUp);
    });
  }

  function syncLabelLeaderForItem(item, viewW, viewH) {
    const anchorObj = rooftopAnchors[item.anchor];
    if (!anchorObj || !item.line) return;

    const temp = new THREE.Vector3();
    temp.copy(anchorObj.userData.anchor || new THREE.Vector3());
    anchorObj.localToWorld(temp);
    temp.project(camera);
    if (temp.z > 1) return;

    const ax = (temp.x * 0.5 + 0.5) * viewW;
    const ay = (-temp.y * 0.5 + 0.5) * viewH;
    const el = item.el;
    const box = {
      left: parseFloat(el.style.left) || 0,
      top: parseFloat(el.style.top) || 0,
      width: el.offsetWidth || LABEL_CARD_W,
      height: el.offsetHeight || LABEL_CARD_H,
    };
    const leader = leaderOnRect(box, ax, ay);
    item.line.setAttribute('x1', String(leader.x));
    item.line.setAttribute('y1', String(leader.y));
    item.line.setAttribute('x2', String(ax));
    item.line.setAttribute('y2', String(ay));
    item.line.style.opacity = '1';
  }

  const LABEL_CARD_W = 138;
  const LABEL_CARD_H = 78;
  const LABEL_PAD = 12;
  const LABEL_GAP = 12;

  function clampLabelBox(box, viewW, viewH) {
    const next = { ...box };
    next.left = Math.max(LABEL_PAD, Math.min(viewW - next.width - LABEL_PAD, next.left));
    next.top = Math.max(LABEL_PAD, Math.min(viewH - next.height - LABEL_PAD, next.top));
    return next;
  }

  function rectsOverlap(a, b, gap = LABEL_GAP) {
    return !(
      a.left + a.width + gap < b.left ||
      b.left + b.width + gap < a.left ||
      a.top + a.height + gap < b.top ||
      b.top + b.height + gap < a.top
    );
  }

  function presetLabelBox(item, viewW, viewH, cardW, cardH, placed) {
    const pos = item.defaultPos || { nx: 0.5, ny: 0.5 };
    const usableW = Math.max(0, viewW - cardW - LABEL_PAD * 2);
    const usableH = Math.max(0, viewH - cardH - LABEL_PAD * 2);
    const baseLeft = LABEL_PAD + pos.nx * usableW;
    const baseTop = LABEL_PAD + pos.ny * usableH;
    const nudges = [
      [0, 0],
      [0, -14],
      [0, 14],
      [16, 0],
      [-16, 0],
      [0, -28],
      [16, -14],
      [-16, -14],
    ];

    for (const [dx, dy] of nudges) {
      const box = clampLabelBox(
        { left: baseLeft + dx, top: baseTop + dy, width: cardW, height: cardH },
        viewW,
        viewH
      );
      if (!placed.some((p) => rectsOverlap(box, p))) return box;
    }

    return clampLabelBox({ left: baseLeft, top: baseTop, width: cardW, height: cardH }, viewW, viewH);
  }

  function leaderOnRect(rect, ax, ay) {
    const cx = Math.max(rect.left, Math.min(ax, rect.left + rect.width));
    const cy = Math.max(rect.top, Math.min(ay, rect.top + rect.height));
    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.left + rect.width, y: rect.top },
      { x: rect.left, y: rect.top + rect.height },
      { x: rect.left + rect.width, y: rect.top + rect.height },
    ];
    let best = corners[0];
    let bestD = Infinity;
    corners.forEach((c) => {
      const d = (c.x - ax) ** 2 + (c.y - ay) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    });
    if (Math.abs(ax - cx) > Math.abs(ay - cy)) {
      return { x: ax > cx ? rect.left + rect.width : rect.left, y: cy };
    }
    return { x: cx, y: ay > cy ? rect.top + rect.height : rect.top };
  }

  function updateRooftopLabels() {
    if (!labelElements.length || !rooftopRetrofitGroup) return;
    const rect = sticky.getBoundingClientRect();
    const temp = new THREE.Vector3();
    const labelsActive = rooftopPhase.labels > 0.08;
    const placed = [];

    if (!labelsActive) {
      labelElements.forEach((item) => {
        item.el.classList.remove('is-visible');
        if (item.line) item.line.style.opacity = '0';
      });
      return;
    }

    const sortedLabels = [...labelElements].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    sortedLabels.forEach((item) => {
      const hide = () => {
        item.el.classList.remove('is-visible');
        if (item.line) item.line.style.opacity = '0';
      };

      const anchorObj = rooftopAnchors[item.anchor];
      const revealAt = item.order * 0.14;
      if (!anchorObj || rooftopPhase.labels < revealAt) {
        hide();
        return;
      }

      temp.copy(anchorObj.userData.anchor || new THREE.Vector3());
      anchorObj.localToWorld(temp);
      temp.project(camera);
      if (temp.z > 1) {
        hide();
        return;
      }

      const ax = (temp.x * 0.5 + 0.5) * rect.width;
      const ay = (-temp.y * 0.5 + 0.5) * rect.height;
      const fullyVisible = rooftopPhase.labels >= revealAt + 0.1;
      if (!fullyVisible) {
        hide();
        return;
      }

      const custom = labelCustomPos[item.id];
      const isDragging = labelDrag?.item.id === item.id;
      const cardW = item.el.offsetWidth || LABEL_CARD_W;
      const cardH = item.el.offsetHeight || LABEL_CARD_H;

      let box;
      if (custom) {
        box = clampLabelBox(
          { left: custom.left, top: custom.top, width: cardW, height: cardH },
          rect.width,
          rect.height
        );
        labelCustomPos[item.id] = { left: box.left, top: box.top };
      } else if (!isDragging) {
        box = presetLabelBox(item, rect.width, rect.height, cardW, cardH, placed);
      } else {
        box = {
          left: parseFloat(item.el.style.left) || 0,
          top: parseFloat(item.el.style.top) || 0,
          width: cardW,
          height: cardH,
        };
      }

      if (!isDragging) {
        item.el.style.left = `${box.left}px`;
        item.el.style.top = `${box.top}px`;
      }
      item.el.classList.add('is-visible');

      const measuredH = item.el.offsetHeight || LABEL_CARD_H;
      box = { ...box, height: measuredH };
      placed.push(box);

      const leader = leaderOnRect(box, ax, ay);
      if (item.line) {
        item.line.setAttribute('x1', String(leader.x));
        item.line.setAttribute('y1', String(leader.y));
        item.line.setAttribute('x2', String(ax));
        item.line.setAttribute('y2', String(ay));
        item.line.style.opacity = '1';
      }
    });
  }

  function buildRooftopRetrofit() {
    if (!state.roofTopY || !state.fittedSize) return;
    disposeRooftopResources(rooftopFlows, rooftopRetrofitGroup);
    if (rooftopRetrofitGroup) modelRoot.remove(rooftopRetrofitGroup);

    const particleCount = mobileMq.matches ? 3 : 4;
    const built = createRooftopRetrofitGroup(THREE, state.roofTopY, state.fittedSize, state.penthouseExclusion);
    rooftopRetrofitGroup = built.rooftopRetrofitGroup;
    rooftopAnchors = built.anchors;
    rooftopRevealMeshes = built.revealMeshes;
    rooftopSpinMeshes = built.spinMeshes;
    modelRoot.add(rooftopRetrofitGroup);

    rooftopFlows = createFlowSystem(THREE, rooftopRetrofitGroup, { particleCount });
    rooftopFlows.forEach((flow) => {
      scene.add(flow.pipe);
      if (flow.pipeLiner) scene.add(flow.pipeLiner);
      if (flow.startCap) scene.add(flow.startCap);
      if (flow.endCap) scene.add(flow.endCap);
      if (flow.line) scene.add(flow.line);
      flow.particles.forEach((p) => scene.add(p));
    });

    if (debugRooftop) setupDebugMode();
    if (debugRooftop) {
      console.info('[rooftopRetrofitGroup]', {
        position: rooftopRetrofitGroup.position,
        rotation: rooftopRetrofitGroup.rotation,
        scale: rooftopRetrofitGroup.scale,
        config: rooftopRetrofitConfig,
      });
    }
  }

  function applyEquipmentReveal(progress) {
    const flowMix = Math.max(0, Math.min(1, (rooftopPhase.flows - 0.08) / 0.55));
    const equipOpacityCap = THREE.MathUtils.lerp(0.96, 0.52, flowMix);

    rooftopRevealMeshes.forEach((mesh) => {
      let order = 3;
      let p = mesh;
      while (p) {
        if (p.userData.revealOrder) {
          order = p.userData.revealOrder;
          break;
        }
        p = p.parent;
      }
      const threshold = order * 0.18;
      const local = Math.max(0, Math.min(1, (progress - (threshold - 0.12)) / 0.22));
      const peak = local * equipOpacityCap;
      mesh.material.opacity = peak;
      mesh.userData.revealPeak = peak;
      const baseY = mesh.userData.baseY ?? mesh.position.y;
      mesh.position.y = baseY + (1 - local) * 0.08;
    });
  }

  function updateFlowLabels() {
    if (!flowLabelElements.length || !rooftopFlows?.length || !sticky) return;
    const rect = sticky.getBoundingClientRect();
    const temp = new THREE.Vector3();
    const show = rooftopPhase.flows > 0.22;

    flowLabelElements.forEach((item) => {
      const flow = rooftopFlows.find((f) => f.id === item.id);
      if (!flow || !show) {
        item.el.classList.remove('is-visible');
        return;
      }

      const reveal = rooftopPhase.flows;
      if (reveal < 0.15) {
        item.el.classList.remove('is-visible');
        return;
      }

      flow.curve.getPointAt(item.t ?? 0.35, temp);
      temp.project(camera);
      if (temp.z > 1) {
        item.el.classList.remove('is-visible');
        return;
      }

      const x = (temp.x * 0.5 + 0.5) * rect.width + (item.offsetX ?? 0);
      const y = (-temp.y * 0.5 + 0.5) * rect.height + (item.offsetY ?? 0);
      item.el.style.left = `${x}px`;
      item.el.style.top = `${y}px`;
      item.el.classList.add('is-visible');
    });
  }

  function updateApproachUI() {
    if (flowLegend) flowLegend.hidden = rooftopPhase.flows < 0.15;
    if (howItWorksPanel) howItWorksPanel.hidden = true;
    if (flowLabelLayer) flowLabelLayer.hidden = rooftopPhase.flows < 0.12;
  }

  async function setupDebugMode() {
    if (!debugRooftop || debugHelpers) return;
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    debugHelpers = new THREE.Group();
    debugHelpers.add(new THREE.AxesHelper(2));
    if (rooftopRetrofitGroup) {
      const box = new THREE.Box3().setFromObject(rooftopRetrofitGroup);
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z),
        new THREE.MeshBasicMaterial({ color: 0xfcbe00, wireframe: true, transparent: true, opacity: 0.35 })
      );
      box.getCenter(boxMesh.position);
      debugHelpers.add(boxMesh);
      rooftopRetrofitGroup.traverse((obj) => {
        if (obj.userData.anchor) {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xfcbe00 })
          );
          m.position.copy(obj.userData.anchor);
          obj.add(m);
          console.info('[rooftop anchor]', obj.name, obj.userData.anchor);
        }
      });
    }
    scene.add(debugHelpers);
    debugControls = new OrbitControls(camera, canvas);
    debugControls.enableDamping = true;
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
      flowsActive = true;
      rooftopPhase.equipment = 1;
      rooftopPhase.flows = 1;
      rooftopPhase.labels = 1;
      applyEquipmentReveal(1);
      if (rooftopFlows) {
        setFlowVisibility(rooftopFlows, 0.85, PRIMARY_FLOW_IDS);
      }
      if (state.inspectPos) {
        camPos.x = state.inspectPos.x;
        camPos.y = state.inspectPos.y;
        camPos.z = state.inspectPos.z;
        camLook.x = state.inspectLook.x;
        camLook.y = state.inspectLook.y;
        camLook.z = state.inspectLook.z;
      }
      updateApproachUI();
      renderScene();
      showStatus('', 'hidden');
      return;
    }

    timeline?.scrollTrigger?.kill();
    timeline?.kill();
    timeline = null;
    flowsActive = false;
    rooftopPhase.equipment = 0;
    rooftopPhase.flows = 0;
    rooftopPhase.labels = 0;
    rooftopPhase.drift = 0;

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
    const L = LEGACY_TIMELINE_END;

    timeline
      .addLabel('phase1', 0)
      .to(
        orbitRig,
        {
          azimuth: state.entryAzimuth,
          elevation: state.entryElevation,
          radius: state.entryRadius,
          duration: 0.1 * L,
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
          duration: 0.55 * L,
          ease: 'power2.out',
          onUpdate: syncCameraFromOrbit,
        },
        0.1 * L
      )
      .to(
        camera,
        {
          fov: state.midFov,
          duration: 0.3 * L,
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
          duration: 0.3 * L,
          ease: 'power1.inOut',
        },
        'phase1'
      )
      .addLabel('phase2', 0.3 * L)
      .to(
        camera,
        {
          fov: state.midFov - 2,
          duration: 0.35 * L,
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
          duration: 0.35 * L,
          ease: 'power1.inOut',
        },
        'phase2'
      )
      .addLabel('phase3', 0.65 * L)
      .to(
        camPos,
        {
          x: state.roofPos.x,
          y: state.roofPos.y,
          z: state.roofPos.z,
          duration: 0.35 * L,
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
          duration: 0.35 * L,
          ease: 'power2.out',
        },
        'phase3'
      )
      .to(
        camera,
        {
          fov: state.endFov,
          duration: 0.35 * L,
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
          duration: 0.35 * L,
          ease: 'power2.out',
        },
        'phase3'
      )
      .addLabel('phase4', L)
      .to(
        camPos,
        {
          x: state.inspectPos.x,
          y: state.inspectPos.y,
          z: state.inspectPos.z,
          duration: 0.14,
          ease: 'power2.inOut',
        },
        'phase4'
      )
      .to(
        camLook,
        {
          x: state.inspectLook.x,
          y: state.inspectLook.y,
          z: state.inspectLook.z,
          duration: 0.14,
          ease: 'power2.inOut',
        },
        'phase4'
      )
      .to(
        camera,
        {
          fov: state.rooftopInspectFov ?? state.endFov - 11,
          duration: 0.14,
          ease: 'power2.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        'phase4'
      )
      .addLabel('phase5', L + 0.14)
      .to(
        rooftopPhase,
        {
          equipment: 1,
          duration: 0.12,
          ease: 'power2.inOut',
          onUpdate: () => applyEquipmentReveal(rooftopPhase.equipment),
        },
        'phase5'
      )
      .addLabel('phase6', L + 0.26)
      .to(
        rooftopPhase,
        {
          flows: 1,
          labels: 1,
          duration: 0.11,
          ease: 'power2.inOut',
          onStart: () => {
            flowsActive = true;
          },
          onUpdate: () => {
            setFlowVisibility(rooftopFlows, rooftopPhase.flows, PRIMARY_FLOW_IDS);
            applyEquipmentReveal(rooftopPhase.equipment);
          },
        },
        'phase6'
      )
      .addLabel('phase7', L + 0.37)
      .to(
        camPos,
        {
          x: state.finalInspectPos.x,
          y: state.finalInspectPos.y,
          z: state.finalInspectPos.z,
          duration: 0.11,
          ease: 'power3.inOut',
        },
        'phase7'
      )
      .to(
        camLook,
        {
          x: state.finalInspectLook.x,
          y: state.finalInspectLook.y,
          z: state.finalInspectLook.z,
          duration: 0.11,
          ease: 'power3.inOut',
        },
        'phase7'
      )
      .to(
        camera,
        {
          fov: (state.rooftopInspectFov ?? state.endFov - 11) - 1,
          duration: 0.11,
          ease: 'power2.inOut',
          onUpdate: () => camera.updateProjectionMatrix(),
        },
        'phase7'
      )
      .to(
        rooftopPhase,
        {
          drift: 1,
          duration: 0.11,
          ease: 'power2.inOut',
        },
        'phase7'
      );

    timeline.eventCallback('onUpdate', () => {
      const p = timeline.progress();
      updateApproachUI();
      if (rooftopPhase.equipment > 0) applyEquipmentReveal(rooftopPhase.equipment);
      flowsActive = rooftopPhase.flows > 0.08;
      if (rooftopFlows && flowsActive) {
        setFlowVisibility(rooftopFlows, rooftopPhase.flows, PRIMARY_FLOW_IDS);
      }
    });

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
      gsap.killTweensOf([camPos, camLook, camera, lightRig, orbitRig, rooftopPhase]);
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
    try {
      buildingScene = gltf.scene;
      modelRoot.add(buildingScene);
      fitModel(buildingScene);
      setupRooftopUI();
      buildRooftopRetrofit();
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
      buildRooftopRetrofit();
      if (rooftopFlows && rooftopRetrofitGroup) updateFlowPaths(rooftopFlows, rooftopRetrofitGroup, THREE);
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
      disposeRooftopResources(rooftopFlows, rooftopRetrofitGroup);
      debugControls?.dispose();
    },
    { once: true }
  );
}
