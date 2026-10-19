import * as THREE from 'three';
import { FLOW_STEPS } from './system-flow-data.js';

// Masks and zones refer exclusively to classifyFlowVertex, not mesh proximity.
// Camera focus/span/direction remain the measured values in FLOW_STEPS.
export const FLOW_FOCUS = [
  { active: ['supply intake hoods and housings'], relatedZones: [1, 3], obstruction: false },
  { active: ['extract-left', 'extract-right: branches and housings'], relatedZones: [2], obstruction: false },
  { active: ['upper and lower recovery pipe circuits'], relatedZones: [1, 4], obstruction: true },
  { active: ['lower assistance circuits', 'room-equipment'], relatedZones: [3], obstruction: true },
  { active: ['supply housings, branches, header and outlet'], relatedZones: [1, 3], obstruction: false },
  { active: ['extract-left', 'extract-right: housings and discharge hoods'], relatedZones: [2], obstruction: false },
].map((focus, index) => ({ ...focus, pathMask: 1 << index,
  camera: { focus: FLOW_STEPS[index].focus, span: FLOW_STEPS[index].span,
    frameFill: FLOW_STEPS[index].frameFill,
    viewDirection: FLOW_STEPS[index].viewDirection } }));

// Cache one independent material per source material in each context group.
// Restore the exact original references; never mutate shared source materials.
export function createContextFocus(building, city) {
  const entries = [];
  let amount = 0;
  let attached = false;
  function addRoot(root, brightness) {
    if (!root) return;
    const cache = new Map();
    root.traverse((node) => {
      if (!node.isMesh || node.geometry?.getAttribute('flowSurface') || node.name === 'heatPumpEnclosureWall') return;
      const original = node.material;
      const materials = (Array.isArray(original) ? original : [original]).map((source) => {
        if (!cache.has(source)) {
          const material = source.clone();
          const dimColor = source.color?.clone();
          if (dimColor) {
            const gray = dimColor.r * 0.2126 + dimColor.g * 0.7152 + dimColor.b * 0.0722;
            dimColor.lerp(new THREE.Color(gray, gray, gray), 0.12).multiplyScalar(brightness);
          }
          cache.set(source, { source, material, dimColor });
        }
        return cache.get(source).material;
      });
      entries.push({ node, original, focused: Array.isArray(original) ? materials : materials[0] });
      if (attached) node.material = entries[entries.length - 1].focused;
    });
    entries.push({ cache, brightness });
    const current = amount;
    amount = -1;
    api.update(current);
  }
  const api = {
    addCity(root) { addRoot(root, 0.30); },
    attach() { attached = true; for (const e of entries) if (e.node) e.node.material = e.focused; },
    update(value) {
      if (value === amount) return;
      amount = value;
      for (const e of entries) if (e.cache) for (const { source, material, dimColor } of e.cache.values()) {
        if (source.color) {
          material.color.lerpColors(source.color, dimColor, value);
        }
        if (source.emissive) material.emissive.copy(source.emissive).multiplyScalar(1 - value * 0.7);
      }
    },
    restore() { attached = false; for (const e of entries) if (e.node) e.node.material = e.original; amount = -1; this.update(0); },
    dispose() { this.restore(); for (const e of entries) if (e.cache) for (const { material } of e.cache.values()) material.dispose(); },
  };
  addRoot(building, 0.52);
  addRoot(city, 0.30);
  return api;
}
