import * as THREE from 'three';
import { fromPlant } from '../flow/system-flow-data.js';
import { EQUIPMENT } from '../ui/equipment-modal.js';

export const ROOFTOP_MARKERS = [
  { id: 'left-equipment', position: [-17.29753, 5.33822, -13.98721], normal: [0, 1, 0] },
  { id: 'upper-unit-1', position: [3.02027, 13.095, -32.85433], normal: [0, 1, 0] },
  { id: 'upper-unit-2', position: [8.09217, 13.095, -37.95532], normal: [0, 1, 0] },
  { id: 'right-equipment', position: [13.42586, 5.33822, -44.07659], normal: [0, 1, 0] },
  // Centers of the two measured cabinet front panels (palette 3), not pipe ports.
  // Keep the offset small so identification dots stay attached to the faces.
  { id: 'central-structure', position: fromPlant(30.23516, -20.28151, 3.55185), normal: [Math.SQRT1_2, 0, Math.SQRT1_2], offset: 0.02 },
  { id: 'heat-pump-2', position: fromPlant(31.43937, -20.28151, 3.55185), normal: [Math.SQRT1_2, 0, Math.SQRT1_2], offset: 0.02, flowOnly: true },
];

export function createRooftopMarkers(building, { root, onActivate } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.beginPath();
  context.arc(64, 64, 44, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#37434b';
  context.lineWidth = 5;
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: true, depthWrite: false,
    toneMapped: false, fog: false,
  });
  const heatPumpMaterial = material.clone();
  heatPumpMaterial.depthTest = false;
  const group = new THREE.Group();
  group.name = 'rooftopMarkers';
  for (const anchor of ROOFTOP_MARKERS) {
    if (anchor.flowOnly) continue;
    const isHeatPump = anchor.id === 'central-structure';
    const marker = new THREE.Sprite(isHeatPump ? heatPumpMaterial : material);
    // Draw the heat pump hotspot over the enclosure, including its translucent wall.
    if (isHeatPump) marker.renderOrder = 10;
    marker.name = anchor.id;
    marker.userData.equipment = anchor.id.startsWith('upper-unit') ? 'supply' : anchor.id === 'central-structure' ? 'heat-pump' : 'extract';
    marker.position.fromArray(anchor.position);
    // A small local-space offset prevents intersection with the equipment surface.
    marker.position.addScaledVector(new THREE.Vector3(...anchor.normal), anchor.offset ?? 0.3);
    group.add(marker);
  }
  building.add(group);
  const events = new AbortController();
  const keyboardButtons = new Map();
  if (root && onActivate) for (const marker of group.children) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'showroom__equipment-marker';
    button.dataset.marker = marker.name;
    button.setAttribute('aria-label', `Open ${EQUIPMENT[marker.userData.equipment].title} details`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.hidden = true;
    button.addEventListener('click', () => onActivate(marker.userData.equipment, button), { signal: events.signal });
    root.append(button);
    keyboardButtons.set(marker, button);
  }
  const point = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return {
    setEnabled(enabled) {
      group.visible = enabled;
      if (!enabled) keyboardButtons.forEach(button => { button.hidden = true; });
    },
    update(camera, viewportHeight) {
      camera.updateMatrixWorld();
      group.updateWorldMatrix(true, true);
      group.getWorldScale(scale);
      const pixelsToWorld = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 26 / Math.max(1, viewportHeight);
      for (const marker of group.children) {
        marker.getWorldPosition(point).applyMatrix4(camera.matrixWorldInverse);
        const depth = -point.z;
        marker.visible = depth > camera.near;
        const size = Math.max(0, depth) * pixelsToWorld;
        marker.scale.set(size / scale.x, size / scale.y, 1);
        const button = keyboardButtons.get(marker);
        if (button) {
          point.applyMatrix4(camera.projectionMatrix);
          const hidden = !group.visible || !marker.visible || Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1;
          if (button.hidden !== hidden) button.hidden = hidden;
          if (!hidden && root.getRootNode().activeElement === button) {
            button.style.left = `${(point.x + 1) * root.clientWidth / 2}px`;
            button.style.top = `${(1 - point.y) * root.clientHeight / 2}px`;
          }
        }
      }
    },
    pick(camera, x, y) {
      if (!group.visible) return undefined;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hit = raycaster.intersectObjects(group.children).find(({ object, uv }) =>
        object.visible && uv && Math.hypot(uv.x - 0.5, uv.y - 0.5) <= 44 / 128);
      return hit?.object.userData.equipment;
    },
    dispose() {
      events.abort();
      keyboardButtons.forEach(button => button.remove());
      group.removeFromParent();
      material.dispose();
      heatPumpMaterial.dispose();
      texture.dispose();
    },
  };
}
