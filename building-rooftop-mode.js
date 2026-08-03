import * as THREE from 'three';
import { loadRoofGltf, cloneSceneFromGltf } from './model-preload.js';
import { createRooftopLabels } from './rooftop-labels.js';
import {
  alignRoofOnlyToBuildingInspect,
  applyStudioAtmosphere,
  getObjectPivot,
  panObjectScreenDelta,
} from './rooftop-camera.js';

const ROOF_DRAG_YAW_SENS = 0.008;
const ROOF_DRAG_PITCH_SENS = 0.005;
const ROOF_DRAG_PITCH_LIMIT = 0.55;
const ROOF_DRAG_RESET_DURATION = 0.32;

export function createBuildingRooftopMode({
  scene,
  camera,
  canvas,
  sticky,
  modelRoot,
  getBuildingScene,
  getInspectState,
  onResizeRenderer,
  mobileMq,
}) {
  const overlay = document.getElementById('rooftop-detail');
  const labelHost = overlay?.querySelector('.rooftop-detail-sticky');
  const backBtn = overlay?.querySelector('.rooftop-detail-back-link');
  const resetBtn = overlay?.querySelector('.rooftop-detail-reset-btn');
  const entryBtn = document.getElementById('building-rooftop-entry');

  let open = false;
  let disposed = false;
  let roofScene = null;
  let roofLoadStarted = false;
  let roofModelReady = false;
  let layoutReady = false;
  let rooftopLabels = null;
  let cachedLayout = null;

  const lookTarget = new THREE.Vector3();
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
  let roofBase = null;
  let roofPivot = new THREE.Vector3();

  function updateDragControls() {
    const hasRotation = Math.abs(roofDrag.yaw) > 1e-4 || Math.abs(roofDrag.pitch) > 1e-4;
    if (resetBtn) resetBtn.hidden = !hasRotation;
    canvas?.classList.toggle('is-roof-draggable', Boolean(open && roofScene && !roofDrag.resetTween));
  }

  function centerRoofBetweenLabelCards() {
    const inspect = getInspectState();
    const offsetPx = rooftopLabels?.getLabelGutterCenterOffset?.();
    if (!roofScene || !inspect?.roofPos || offsetPx == null || Math.abs(offsetPx) < 2) return;

    const rect = (sticky ?? labelHost)?.getBoundingClientRect();
    if (!rect?.width) return;

    panObjectScreenDelta(
      roofScene,
      camera.position,
      lookTarget,
      camera.fov,
      camera.aspect,
      (offsetPx / rect.width) * 2,
      0
    );
  }

  function finalizeRoofPresentation() {
    applyRoofTransform();
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
    rooftopLabels?.update();
    for (let pass = 0; pass < 2; pass += 1) {
      centerRoofBetweenLabelCards();
      rooftopLabels?.update();
    }
    captureRoofBaseTransform();
    const inspect = getInspectState();
    if (inspect && roofScene) storeLayoutCache(inspect);
    rooftopLabels?.update();
    updateDragControls();
  }

  function resetRoofDrag(animated = true) {
    roofDrag.resetTween?.kill();
    roofDrag.resetTween = null;

    if (!animated || (Math.abs(roofDrag.yaw) < 1e-6 && Math.abs(roofDrag.pitch) < 1e-6)) {
      roofDrag.yaw = 0;
      roofDrag.pitch = 0;
      applyRoofTransform();
      updateDragControls();
      return;
    }

    const gsap = window.gsap;
    if (!gsap) {
      roofDrag.yaw = 0;
      roofDrag.pitch = 0;
      applyRoofTransform();
      updateDragControls();
      return;
    }

    roofDragReset.yaw = roofDrag.yaw;
    roofDragReset.pitch = roofDrag.pitch;
    updateDragControls();
    roofDrag.resetTween = gsap.to(roofDragReset, {
      yaw: 0,
      pitch: 0,
      duration: ROOF_DRAG_RESET_DURATION,
      ease: 'power2.out',
      onUpdate: () => {
        roofDrag.yaw = roofDragReset.yaw;
        roofDrag.pitch = roofDragReset.pitch;
        applyRoofTransform();
        rooftopLabels?.update();
      },
      onComplete: () => {
        roofDrag.resetTween = null;
        roofDrag.yaw = 0;
        roofDrag.pitch = 0;
        applyRoofTransform();
        updateDragControls();
      },
    });
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
    roofDrag.yaw = 0;
    roofDrag.pitch = 0;
    updateDragControls();
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

  function storeLayoutCache(inspect) {
    cachedLayout = {
      aspect: camera.aspect,
      cameraFov: inspect.inspectFov,
      cameraPos: inspect.roofPos.clone(),
      lookTarget: inspect.roofLook.clone(),
      roofPosition: roofScene.position.clone(),
      roofQuaternion: roofScene.quaternion.clone(),
      roofScale: roofScene.scale.clone(),
      fogNear: scene.fog?.near ?? 0,
      fogFar: scene.fog?.far ?? 0,
    };
  }

  function applyCachedLayout() {
    if (!cachedLayout || !roofScene) return false;
    camera.fov = cachedLayout.cameraFov;
    camera.position.copy(cachedLayout.cameraPos);
    lookTarget.copy(cachedLayout.lookTarget);
    camera.updateProjectionMatrix();
    roofScene.position.copy(cachedLayout.roofPosition);
    roofScene.quaternion.copy(cachedLayout.roofQuaternion);
    roofScene.scale.copy(cachedLayout.roofScale);
    roofScene.updateMatrixWorld(true);
    if (scene.fog) {
      scene.fog.near = cachedLayout.fogNear;
      scene.fog.far = cachedLayout.fogFar;
    }
    captureRoofBaseTransform();
    layoutReady = true;
    rooftopLabels?.rebuild();
    return true;
  }

  function applyRoofLayout(force = false) {
    const buildingScene = getBuildingScene();
    const inspect = getInspectState();
    if (!roofScene || !buildingScene || !inspect?.buildingFit || !inspect.roofPos) return false;

    const aspect = camera.aspect;
    if (!force && cachedLayout && Math.abs(cachedLayout.aspect - aspect) < 0.02) {
      return applyCachedLayout();
    }

    alignRoofOnlyToBuildingInspect(
      roofScene,
      buildingScene,
      inspect.buildingFit,
      inspect.roofPos,
      inspect.roofLook,
      inspect.inspectFov,
      aspect,
      { current: null }
    );

    camera.fov = inspect.inspectFov;
    camera.position.copy(inspect.roofPos);
    lookTarget.copy(inspect.roofLook);
    camera.updateProjectionMatrix();
    applyStudioAtmosphere(scene, inspect.roofPos.distanceTo(inspect.roofLook) * 2.4);
    captureRoofBaseTransform();
    storeLayoutCache(inspect);
    layoutReady = true;
    rooftopLabels?.rebuild();
    return true;
  }

  function ensureLabels() {
    if (rooftopLabels || !labelHost) return;
    rooftopLabels = createRooftopLabels({
      host: labelHost,
      projectionHost: sticky ?? labelHost,
      camera,
      getRoofOnly: () => roofScene,
      getAlpha: () => (open ? 1 : 0),
    });
  }

  function syncViewportAndLayout() {
    onResizeRenderer?.();
    applyRoofLayout(true);
    finalizeRoofPresentation();
  }

  function prewarm() {
    if (!roofModelReady || layoutReady) return;
    if (!applyRoofLayout(false)) return;
    applyRoofTransform();
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
    rooftopLabels?.update();
  }

  function ensureRoofLoaded() {
    if (roofLoadStarted) return loadRoofGltf();
    roofLoadStarted = true;
    return loadRoofGltf()
      .then((gltf) => {
        if (disposed || roofScene) return;
        roofScene = cloneSceneFromGltf(gltf);
        roofScene.visible = false;
        modelRoot.add(roofScene);
        roofModelReady = true;
        ensureLabels();
        prewarm();
      })
      .catch((error) => {
        roofLoadStarted = false;
        console.error('Roof model failed to load:', error);
        throw error;
      });
  }

  function applyOpenState() {
    const buildingScene = getBuildingScene();
    if (buildingScene) buildingScene.visible = false;
    if (roofScene) roofScene.visible = true;
    sticky?.classList.add('is-rooftop-mode');
    canvas?.classList.add('is-rooftop-mode');
    overlay.hidden = false;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-rooftop-detail-open');
    open = true;
    updateDragControls();
  }

  function openDetail() {
    if (open || !overlay) return;

    const finishOpen = () => {
      applyOpenState();
      syncViewportAndLayout();
    };

    if (roofModelReady) {
      finishOpen();
      return;
    }

    applyOpenState();
    ensureRoofLoaded().then(finishOpen);
  }

  function closeDetail() {
    if (!open || !overlay) return;
    roofDrag.resetTween?.kill();
    roofDrag.resetTween = null;
    const buildingScene = getBuildingScene();
    if (buildingScene) buildingScene.visible = true;
    if (roofScene) roofScene.visible = false;
    sticky?.classList.remove('is-rooftop-mode');
    canvas?.classList.remove('is-rooftop-mode');
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.hidden = true;
    document.body.classList.remove('is-rooftop-detail-open');
    roofDrag.active = false;
    roofDrag.pointerId = null;
    roofDrag.yaw = 0;
    roofDrag.pitch = 0;
    canvas?.classList.remove('is-roof-dragging', 'is-roof-draggable');
    open = false;
  }

  function updateCamera() {
    if (!open || !layoutReady) return;
    applyRoofTransform();
    camera.up.set(0, 1, 0);
    camera.lookAt(lookTarget);
    rooftopLabels?.update();
  }

  function onPointerDown(event) {
    if (!open || !roofScene || roofDrag.active || roofDrag.resetTween) return;
    if (event.button !== 0) return;
    roofDrag.active = true;
    roofDrag.pointerId = event.pointerId;
    roofDrag.lastX = event.clientX;
    roofDrag.lastY = event.clientY;
    canvas?.classList.add('is-roof-dragging');
    canvas?.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event) {
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
    rooftopLabels?.update();
    updateDragControls();
    event.preventDefault();
  }

  function onPointerEnd(event) {
    if (!roofDrag.active || event.pointerId !== roofDrag.pointerId) return;
    roofDrag.active = false;
    roofDrag.pointerId = null;
    canvas?.classList.remove('is-roof-dragging');
    updateDragControls();
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  entryBtn?.addEventListener('click', openDetail);
  backBtn?.addEventListener('click', closeDetail);
  resetBtn?.addEventListener('click', () => resetRoofDrag(true));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });
  canvas?.addEventListener('pointerdown', onPointerDown);
  canvas?.addEventListener('pointermove', onPointerMove);
  canvas?.addEventListener('pointerup', onPointerEnd);
  canvas?.addEventListener('pointercancel', onPointerEnd);

  ensureLabels();

  return {
    isOpen: () => open,
    maybePrefetch: (scrollProgress = 0) => {
      if (scrollProgress >= 0.5 || open) ensureRoofLoaded();
    },
    onBuildingInspectReady: () => {
      if (roofModelReady) prewarm();
      else ensureRoofLoaded();
    },
    onResize: () => {
      if (!open || !roofModelReady) return;
      onResizeRenderer?.();
      applyRoofLayout(true);
      finalizeRoofPresentation();
    },
    updateCamera,
    openDetail,
    closeDetail,
    dispose: () => {
      disposed = true;
      roofDrag.resetTween?.kill();
      closeDetail();
      rooftopLabels?.dispose();
      canvas?.removeEventListener('pointerdown', onPointerDown);
      canvas?.removeEventListener('pointermove', onPointerMove);
      canvas?.removeEventListener('pointerup', onPointerEnd);
      canvas?.removeEventListener('pointercancel', onPointerEnd);
    },
  };
}
