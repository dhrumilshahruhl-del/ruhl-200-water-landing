import * as THREE from 'three';
import { FLOW_STEPS } from './system-flow-data.js';
import { createFlowVisuals } from './flow-visuals.js';
import { FLOW_FOCUS } from './flow-focus.js';
import { createFlowImpact } from '../ui/flow-impact.js';
import { createFlowEquipment } from '../ui/flow-equipment.js';
import { measureFlowPanel } from '../ui/mobile-sheet.js';

const CAMERA_DURATION = 1.5;
// Presentation order refers to stable engineering indices used by focus,
// topology, smoke, and impact content: previous steps 2, 3, 6, 1, 4, 5.
const STEP_ORDER = [1, 2, 5, 0, 3, 4];
const ORDERED_STEPS = STEP_ORDER.map((index) => FLOW_STEPS[index]);
const ORDERED_FOCUS = STEP_ORDER.map((index) => FLOW_FOCUS[index]);
const ease = (t) => t * t * (3 - 2 * t);

export function createSystemFlow({ root, building, city, camera, controls, wall, markers, modal }) {
  const visuals = createFlowVisuals(building, city);
  const equipment = createFlowEquipment({ root, building, camera, bounds: visuals.identificationBounds, activeBounds: visuals.bounds });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tablet = window.matchMedia('(min-width: 601px) and (max-width: 1024px)');
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'flow-launch';
  launch.innerHTML = '<span aria-hidden="true">▶</span> Explore System Flow';
  const panel = document.createElement('section');
  panel.className = 'flow-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Guided system flow');
  panel.innerHTML = `
    <div class="flow-panel__top"><span class="flow-panel__eyebrow">System Flow</span><span class="flow-panel__count"></span></div>
    <nav class="flow-panel__steps" aria-label="System flow steps">${ORDERED_STEPS.map((step, i) =>
      `<button type="button" data-step="${i}" aria-label="Step ${i + 1}: ${step.title}" title="${step.title}">${i + 1}</button>`).join('')}</nav>
    <div class="flow-panel__copy" aria-live="polite" aria-atomic="true"><h2></h2><p></p></div>
    <p class="flow-panel__detail"></p>
    <div class="flow-panel__navigation"><button type="button" data-flow="previous">Previous</button><button type="button" data-flow="next">Next step</button></div>
    <div class="flow-panel__controls"><button type="button" data-flow="pause">Pause</button><button type="button" data-flow="restart">Restart</button><button type="button" data-flow="exit">Exit Flow</button></div>`;
  root.querySelector('.showroom__toolbar').append(launch);
  root.append(panel);
  const impact = createFlowImpact(root, panel, handleImpactLayout);
  const heading = panel.querySelector('h2');
  const description = panel.querySelector('.flow-panel__copy p');
  const count = panel.querySelector('.flow-panel__count');
  const pauseButton = panel.querySelector('[data-flow="pause"]');
  const detail = panel.querySelector('.flow-panel__detail');
  const previousButton = panel.querySelector('[data-flow="previous"]');
  const nextButton = panel.querySelector('[data-flow="next"]');
  const stepButtons = [...panel.querySelectorAll('[data-step]')];
  const reset = root.querySelector('[data-action="reset"]');
  let mode = 'idle';
  let paused = false;
  let stepIndex = 0;
  let transition = null;
  let snapshot = null;
  let pendingStep = null;
  const visitedSteps = new Set();
  const projected = new THREE.Vector3();
  const target = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const direction = new THREE.Vector3(1, 1.25, 1).normalize();
  const cameraMove = { from: new THREE.Vector3(), to: new THREE.Vector3(), targetFrom: new THREE.Vector3(),
    targetTo: new THREE.Vector3(), elapsed: 0, duration: CAMERA_DURATION };
  const framing = { x: 0, y: 0 };
  let impactInset = 0;
  let equipmentLayoutTimer;
  let tabletLayoutPending = false;
  let tabletTopInset = 80;
  let tabletExpandedBottom = null;
  function tabletViewport() {
    const origin = root.getBoundingClientRect();
    const sheet = root.querySelector('.tablet-sheet');
    const actualBottom = (sheet ? sheet.getBoundingClientRect().top - origin.top : root.clientHeight) - 16;
    const bottom = tabletExpandedBottom === null ? actualBottom : Math.min(actualBottom, tabletExpandedBottom);
    return { top: tabletTopInset, bottom, width: Math.max(1, root.clientWidth - 48), height: Math.max(1, bottom - tabletTopInset) };
  }
  function handleTabletLayout() {
    if (!tablet.matches) return;
    const back = root.querySelector('.showroom-controls');
    tabletTopInset = Math.max(80, back ? back.getBoundingClientRect().bottom - root.getBoundingClientRect().top + 12 : 80);
    const sheet = root.querySelector('.tablet-sheet');
    tabletExpandedBottom = null;
    if (sheet?.dataset.expanded === 'true') {
      const content = sheet.querySelector('.mobile-sheet__content');
      const handle = sheet.querySelector('.mobile-sheet__handle');
      const height = Math.max(root.clientHeight * 0.5, Math.min(root.clientHeight * 0.6, content.scrollHeight + handle.offsetHeight + 2));
      // Anticipate the sheet's end size so framing moves with its CSS transition.
      tabletExpandedBottom = sheet.getBoundingClientRect().bottom - root.getBoundingClientRect().top - height - 16;
    }
    if (mode !== 'playing') return;
    if (transition && !transition.layoutOnly) { tabletLayoutPending = true; return; }
    tabletLayoutPending = false;
    frameStep(ORDERED_FOCUS[stepIndex].camera, STEP_ORDER[stepIndex], true);
    equipment.suspend();
    scheduleEquipmentLayout();
  }
  function scheduleEquipmentLayout() {
    clearTimeout(equipmentLayoutTimer);
    equipmentLayoutTimer = setTimeout(() => { if (mode === 'playing' && (!transition || paused) && !(tablet.matches && transition?.layoutOnly)) equipment.layout(); }, 240);
  }

  function handleImpactLayout() {
    if (tablet.matches) { handleTabletLayout(); return; }
    impactInset = impact.measure().right;
    // Reuse the existing camera fit only when overlay layout changes. The
    // impact diagrams have no animation-frame or per-frame update function.
    if (mode === 'playing') {
      frameStep(ORDERED_FOCUS[stepIndex].camera, STEP_ORDER[stepIndex]);
      if (!paused) equipment.suspend();
    }
    scheduleEquipmentLayout();
  }
  window.addEventListener('resize', handleImpactLayout);
  root.addEventListener('showroom-sheet-layout', handleImpactLayout);
  root.addEventListener('showroom-tablet-sheet-layout', handleTabletLayout);

  function frameBesidePanel(dt) {
    const bounds = tablet.matches ? null : root.getBoundingClientRect();
    const rect = tablet.matches ? null : measureFlowPanel(panel);
    let x = 0, y = 0;
    if (mode === 'playing') {
      if (tablet.matches) {
        const area = tabletViewport();
        y = root.clientHeight / 2 - (area.top + area.bottom) / 2;
      }
      else if (root.clientWidth <= 600) y = (root.clientHeight - (rect.top - bounds.top - 16)) / 2;
      else x = (impactInset - (rect.right - bounds.left + 24)) / 2;
    }
    const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 8);
    framing.x = THREE.MathUtils.lerp(framing.x, x, amount);
    framing.y = THREE.MathUtils.lerp(framing.y, y, amount);
    camera.setViewOffset(root.clientWidth, root.clientHeight, framing.x, framing.y, root.clientWidth, root.clientHeight);
  }

  function moveCamera(position, lookAt, duration, layoutOnly = false) {
    cameraMove.from.copy(camera.position);
    cameraMove.to.copy(position);
    cameraMove.targetFrom.copy(controls.target);
    cameraMove.targetTo.copy(lookAt);
    cameraMove.elapsed = 0;
    cameraMove.duration = reducedMotion.matches ? 0 : duration;
    cameraMove.layoutOnly = layoutOnly;
    transition = cameraMove;
  }

  function frameStep(step, index, layoutOnly = false) {
    target.fromArray(step.focus);
    const box = visuals.bounds[index];
    if (!box.isEmpty()) box.getCenter(target);
    building.localToWorld(target);
    // Fit both active units even on portrait screens; camera remains outside
    // the room and views its interior through the translucent front wall.
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const scale = building.getWorldScale(projected).x;
    const panelRect = tablet.matches ? null : measureFlowPanel(panel);
    const area = tablet.matches ? tabletViewport() : null;
    const usableWidth = area ? area.width : root.clientWidth <= 600 ? root.clientWidth : Math.max(1, root.clientWidth - panelRect.width - 48 - impactInset);
    const usableHeight = area ? area.height : root.clientWidth <= 600 ? Math.max(1, root.clientHeight - panelRect.height - 48) : root.clientHeight;
    const usableAspect = usableWidth / usableHeight;
    const frameFill = area ? 0.78 : step.frameFill ?? 0.72;
    let distance = step.span * scale * 0.65 / Math.tan(halfFov) / Math.min(1, usableAspect);
    direction.fromArray(step.viewDirection || [1, 1.25, 1]).normalize();
    // Fit the actual selected surfaces, including both ends of split extract
    // networks. A temporary camera avoids changing the live transition pose.
    const fitCamera = camera.clone();
    fitCamera.clearViewOffset();
    const corners = [];
    if (!box.isEmpty()) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      corners.push(building.localToWorld(new THREE.Vector3(x, y, z)));
    }
    const worldDirection = direction.clone().transformDirection(building.matrixWorld);
    if (area && corners.length) distance = 0.5;
    let nearDistance = 0;
    const fitsAtDistance = (value) => {
      fitCamera.position.copy(worldDirection).multiplyScalar(value).add(target);
      fitCamera.lookAt(target);
      fitCamera.updateMatrixWorld();
      return corners.every((p) => {
        projected.copy(p).project(fitCamera);
        return projected.z >= -1 && projected.z <= 1 &&
          Math.abs(projected.x) < frameFill * usableWidth / root.clientWidth &&
          Math.abs(projected.y) < frameFill * usableHeight / root.clientHeight;
      });
    };
    for (let attempt = 0; attempt < 24; attempt++) {
      if (fitsAtDistance(distance)) break;
      nearDistance = distance;
      distance *= area ? 1.35 : 1.10;
    }
    if (area && corners.length) for (let attempt = 0; attempt < 14; attempt++) {
      const middle = (nearDistance + distance) / 2;
      if (fitsAtDistance(middle)) distance = middle;
      else nearDistance = middle;
    }
    destination.copy(direction);
    destination.transformDirection(building.matrixWorld).multiplyScalar(distance);
    destination.add(target);
    moveCamera(destination, target, layoutOnly ? 0.32 : CAMERA_DURATION, layoutOnly);
  }

  function showStep(index) {
    stepIndex = index;
    visitedSteps.add(index);
    pendingStep = null;
    const sourceIndex = STEP_ORDER[index];
    const step = ORDERED_STEPS[index];
    equipment.setStep(step, sourceIndex);
    impact.setPaused(false);
    impact.setStep(sourceIndex);
    impactInset = impact.measure().right;
    wall.setTranslucent(ORDERED_FOCUS[index].obstruction);
    visuals.setStep(step, sourceIndex);
    frameStep(ORDERED_FOCUS[index].camera, sourceIndex);
    heading.textContent = step.title;
    description.textContent = step.description;
    detail.textContent = step.detail;
    previousButton.disabled = index === 0;
    nextButton.textContent = index === FLOW_STEPS.length - 1 ? 'Finish' : 'Next step';
    count.textContent = `${index + 1} / 6`;
    pauseButton.disabled = false;
    pauseButton.textContent = paused ? 'Resume' : 'Pause';
    stepButtons.forEach((button, i) => {
      button.dataset.state = i === index ? 'active' : visitedSteps.has(i) ? 'done' : 'upcoming';
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  function goTo(index) {
    if (mode !== 'playing' || index < 0 || index >= FLOW_STEPS.length) return;
    impact.setPaused(false);
    // Close only when the next focus no longer needs the lower-room cutaway.
    if (ORDERED_FOCUS[stepIndex].obstruction && !ORDERED_FOCUS[index].obstruction && !wall.settled) {
      wall.setTranslucent(false);
      pendingStep = index;
    } else if (ORDERED_FOCUS[stepIndex].obstruction && !ORDERED_FOCUS[index].obstruction && wall.translucent) {
      wall.setTranslucent(false);
      pendingStep = index;
    } else showStep(index);
  }

  function start() {
    if (mode !== 'idle') return;
    snapshot = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov,
      controlsEnabled: controls.enabled, wallTranslucent: wall.translucent,
      view: camera.view?.enabled ? { ...camera.view } : null };
    // Drain any remaining orbit damping before taking over the camera.
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = true;
    controls.enabled = false;
    modal.close();
    markers.setEnabled(false);
    wall.setGuided(true);
    if (reset) reset.disabled = true;
    root.dataset.flowActive = 'true';
    mode = 'playing';
    paused = false;
    visitedSteps.clear();
    visuals.setVisible(true);
    launch.disabled = true;
    panel.hidden = false;
    showStep(0);
    (window.matchMedia('(max-width: 1024px)').matches ? stepButtons[0] : pauseButton).focus({ preventScroll: true });
  }

  function exit() {
    if (mode !== 'playing') return;
    mode = 'returning';
    tabletLayoutPending = false;
    paused = false;
    pendingStep = null;
    visuals.setVisible(false);
    clearTimeout(equipmentLayoutTimer);
    equipment.clear();
    impact.clear();
    impactInset = 0;
    wall.setTranslucent(snapshot.wallTranslucent);
    moveCamera(snapshot.position, snapshot.target, 1.2);
    panel.hidden = true;
  }

  launch.addEventListener('click', start);
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.step !== undefined) {
      paused = false;
      pauseButton.textContent = 'Pause';
      goTo(Number(button.dataset.step));
    }
    else if (button.dataset.flow === 'previous' || button.dataset.flow === 'next') {
      paused = false;
      const requested = pendingStep ?? stepIndex;
      if (button.dataset.flow === 'next' && requested === FLOW_STEPS.length - 1) exit();
      else goTo(requested + (button.dataset.flow === 'next' ? 1 : -1));
    }
    else if (button.dataset.flow === 'pause') {
      paused = !paused;
      impact.setPaused(paused);
      if (!paused && transition) equipment.suspend();
      else equipment.layout();
      pauseButton.textContent = paused ? 'Resume' : 'Pause';
    } else if (button.dataset.flow === 'restart') {
      paused = false;
      visitedSteps.clear();
      visuals.restartAirflow();
      goTo(0);
    } else if (button.dataset.flow === 'exit') exit();
  });
  function onKey(event) { if (event.key === 'Escape' && mode === 'playing' && !root.querySelector('dialog[open]')) exit(); }
  window.addEventListener('keydown', onKey);

  return {
    addCity(city) { visuals.addCity(city); },
    get active() { return mode !== 'idle'; },
    get state() { return { mode, paused, step: stepIndex, pendingStep, transitioning: Boolean(transition) }; },
    get topology() { return visuals.summary; },
    get airflow() { return visuals.airflow; },
    update(dt) {
      if (mode === 'idle') return;
      // Focus settles even while motion is paused; pause freezes camera, waves and reveal.
      visuals.update(dt, reducedMotion.matches, paused);
      if (paused) {
        if (!tablet.matches) return;
        frameBesidePanel(dt);
        if (!transition?.layoutOnly) return;
      }
      if (!paused) frameBesidePanel(dt);
      if (transition) {
        transition.elapsed += dt;
        const t = transition.duration ? Math.min(1, transition.elapsed / transition.duration) : 1;
        const eased = ease(t);
        camera.position.lerpVectors(transition.from, transition.to, eased);
        // Lift the middle of the move slightly to pass above roof details.
        if (!reducedMotion.matches && mode !== 'returning' && !transition.layoutOnly) camera.position.y += Math.sin(Math.PI * t) * 0.22;
        controls.target.lerpVectors(transition.targetFrom, transition.targetTo, eased);
        camera.lookAt(controls.target);
        camera.updateMatrixWorld();
        if (t === 1) {
          transition = null;
          if (mode === 'playing') { equipment.layout(); scheduleEquipmentLayout(); }
          if (mode === 'playing' && tablet.matches && tabletLayoutPending) handleTabletLayout();
          if (mode === 'returning') {
            camera.fov = snapshot.fov;
            if (snapshot.view) {
              const v = snapshot.view;
              camera.setViewOffset(v.fullWidth, v.fullHeight, v.offsetX, v.offsetY, v.width, v.height);
            } else camera.clearViewOffset();
            framing.x = framing.y = 0;
            camera.updateProjectionMatrix();
            controls.enabled = snapshot.controlsEnabled;
            markers.setEnabled(true);
            wall.setGuided(false);
            if (reset) reset.disabled = false;
            delete root.dataset.flowActive;
            mode = 'idle';
            visuals.restore();
            launch.disabled = false;
            launch.focus({ preventScroll: true });
            return;
          }
        }
      }
      if (mode !== 'playing') return;
      if (pendingStep !== null) {
        if (wall.settled) showStep(pendingStep);
        return;
      }
    },
    wallDelta(dt) { return mode === 'playing' && paused ? 0 : dt; },
    dispose() {
      clearTimeout(equipmentLayoutTimer);
      equipment.dispose();
      window.removeEventListener('resize', handleImpactLayout);
      root.removeEventListener('showroom-sheet-layout', handleImpactLayout);
      root.removeEventListener('showroom-tablet-sheet-layout', handleTabletLayout);
      impact.dispose();
      window.removeEventListener('keydown', onKey);
      launch.remove();
      panel.remove();
      visuals.dispose();
      if (snapshot && mode !== 'idle') {
        controls.enabled = snapshot.controlsEnabled;
        wall.setTranslucent(snapshot.wallTranslucent);
        wall.setGuided(false);
        markers.setEnabled(true);
        if (reset) reset.disabled = false;
        delete root.dataset.flowActive;
      }
    },
  };
}
