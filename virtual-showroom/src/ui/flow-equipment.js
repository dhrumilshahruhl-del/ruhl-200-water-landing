import * as THREE from 'three';
import { ROOFTOP_MARKERS } from '../hotspots/rooftop-markers.js';

export const FLOW_EQUIPMENT = {
  ahu: { id: 'ahu', name: 'AHU', alt: 'Air handling unit', image: new URL("../../assets/equipments/ahu-popup.webp", import.meta.url).href, preferredAnchor: 'upper-unit-1' },
  'heat-pump': { id: 'heat-pump', name: 'Heat Pump', alt: 'Heat pump equipment illustration', image: new URL("../../assets/equipments/heat_pump-popup.webp", import.meta.url).href, preferredAnchor: 'central-structure' },
};
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// One reusable HTML callout; all positions come from existing equipment markers.
// Project cached surface cells only on layout events/camera settling.
export function createFlowEquipment({ root, building, camera, bounds, activeBounds }) {
  const popup = document.createElement('div');
  popup.className = 'flow-equipment';
  popup.hidden = true;
  popup.setAttribute('role', 'group');
  popup.setAttribute('aria-label', 'Equipment in this step');
  root.append(popup);
  const leaders = Array.from({ length: 2 }, () => {
    const leader = document.createElement('div');
    leader.className = 'flow-equipment-leader';
    leader.hidden = true;
    leader.setAttribute('aria-hidden', 'true');
    root.append(leader);
    return leader;
  });
  const hideLeaders = () => leaders.forEach(leader => { leader.hidden = true; });
  let current = null;
  let sourceIndex = 0;
  const point = new THREE.Vector3();
  const anchors = new Map(ROOFTOP_MARKERS.map(anchor => [anchor.id,
    new THREE.Vector3(...anchor.position).addScaledVector(new THREE.Vector3(...anchor.normal), anchor.offset ?? 0.3)]));

  function project(local) {
    point.copy(local);
    building.localToWorld(point).project(camera);
    return { x: (point.x + 1) * root.clientWidth / 2, y: (1 - point.y) * root.clientHeight / 2, z: point.z };
  }
  function layout() {
    if (!current) return;
    popup.hidden = true;
    hideLeaders();
    const linkedIds = current.anchors.slice(0, leaders.length);
    const linkedPoints = linkedIds.map(id => ({ ...project(anchors.get(id)), id }));
    const origin = root.getBoundingClientRect();
    const tablet = root.clientWidth >= 601 && root.clientWidth <= 1024;
    const sheet = tablet ? root.querySelector('.tablet-sheet') : null;
    const exposedBottom = sheet ? sheet.getBoundingClientRect().top - origin.top - 12 : root.clientHeight - 10;
    const blocked = [...(tablet ? root.getRootNode().querySelectorAll('.tablet-sheet, .showroom-controls, .showroom__legal-link') : root.querySelectorAll('.flow-panel, .flow-impact, .showroom__toolbar'))]
      .filter(node => !node.hidden && !node.closest('[data-tablet-camera-layout]') && node.getClientRects().length)
      .map(node => { const r = node.getBoundingClientRect(); return {
        left: r.left - origin.left - 8, right: r.right - origin.left + 8,
        top: r.top - origin.top - 8, bottom: r.bottom - origin.top + 8,
      }; });
    for (const box of bounds[sourceIndex]) {
      if (tablet && activeBounds && !box.intersectsBox(activeBounds[sourceIndex]) &&
        !current.anchors.some(id => box.distanceToPoint(anchors.get(id)) < 5)) continue;
      const points = [];
      if (!box.isEmpty()) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        points.push(project(new THREE.Vector3(x, y, z)));
      }
      if (points.length) blocked.push({
        left: Math.min(...points.map(p => p.x)) - 10, right: Math.max(...points.map(p => p.x)) + 10,
        top: Math.min(...points.map(p => p.y)) - 10, bottom: Math.max(...points.map(p => p.y)) + 10,
      });
    }
    const candidatesAtMarkers = current.anchors.map(id => ({ ...project(anchors.get(id)), id }));
    if (linkedPoints.length === 2) candidatesAtMarkers.unshift({
      x: (linkedPoints[0].x + linkedPoints[1].x) / 2,
      y: (linkedPoints[0].y + linkedPoints[1].y) / 2,
      z: (linkedPoints[0].z + linkedPoints[1].z) / 2,
      id: linkedIds.join(' '),
    });
    for (const gap of (tablet ? [16, 24, 40, 56, 72, 96, 112] : [16, 24, 40, 56, 72, 96, 112, 144, 160, 192])) {
      for (const compact of [false, true]) {
        popup.classList.toggle('is-compact', compact);
        popup.hidden = false;
        const { width, height } = popup.getBoundingClientRect();
        popup.hidden = true;
        for (const p of candidatesAtMarkers) {
          if (p.z < -1 || p.z > 1) continue;
          // Try a shared position between the two markers before side positions.
          const candidates = [
            [p.x - width / 2, p.y - gap - height], [p.x + gap, p.y - height / 2],
            [p.x - gap - width, p.y - height / 2], [p.x - width / 2, p.y + gap],
            [p.x + gap, p.y - gap - height], [p.x - gap - width, p.y - gap - height],
            [p.x + gap, p.y + gap], [p.x - gap - width, p.y + gap],
          ];
          for (const [left, top] of candidates) {
            const rect = { left, top, right: left + width, bottom: top + height };
            if (left < 10 || top < (tablet ? 76 : 10) || rect.right > root.clientWidth - 10 || rect.bottom > exposedBottom || blocked.some(b => overlaps(rect, b))) continue;
            popup.style.left = `${left}px`;
            popup.style.top = `${top}px`;
            popup.dataset.anchor = p.id;
            popup.dataset.gap = gap;
            popup.dataset.linkedAnchors = linkedIds.join(' ');
            linkedPoints.forEach((marker, index) => {
              const leader = leaders[index];
              if (marker.z < -1 || marker.z > 1) return;
              const fraction = (index + 1) / (linkedPoints.length + 1);
              let endX = Math.max(left, Math.min(marker.x, rect.right));
              let endY = Math.max(top, Math.min(marker.y, rect.bottom));
              // Separate attachment points keep both lines readable even when
              // the two units project onto the same horizontal or vertical axis.
              if (marker.x < left || marker.x > rect.right) endY = top + height * fraction;
              else if (marker.y < top || marker.y > rect.bottom) endX = left + width * fraction;
              leader.dataset.anchor = marker.id;
              leader.style.left = `${marker.x}px`;
              leader.style.top = `${marker.y}px`;
              leader.style.width = `${Math.hypot(endX - marker.x, endY - marker.y)}px`;
              leader.style.transform = `rotate(${Math.atan2(endY - marker.y, endX - marker.x)}rad)`;
              leader.hidden = false;
            });
            popup.hidden = false;
            return;
          }
        }
      }
    }
    // Protect the active flow rather than cover it when no safe anchor fits.
    delete popup.dataset.anchor;
  }
  return {
    setStep(step, index) {
      current = step.identification;
      sourceIndex = index;
      popup.replaceChildren(...current.equipment.map(id => {
        const equipment = FLOW_EQUIPMENT[id];
        const item = document.createElement('figure');
        const image = document.createElement('img');
        image.src = equipment.image;
        image.alt = equipment.alt;
        image.width = 96;
        image.height = 68;
        const label = document.createElement('figcaption');
        label.textContent = equipment.name;
        item.append(image, label);
        return item;
      }));
      popup.dataset.equipment = current.equipment.join(' ');
      popup.hidden = true;
      hideLeaders();
    },
    layout,
    suspend() { popup.hidden = true; hideLeaders(); },
    clear() { current = null; popup.hidden = true; hideLeaders(); delete popup.dataset.anchor; },
    dispose() { popup.remove(); leaders.forEach(leader => leader.remove()); },
  };
}
