export function measureFlowPanel(panel) {
  return panel.getBoundingClientRect();
}

// Reparent existing UI at phone/tablet breakpoints; restore exact slots on exit.
export function createMobileSheet(root, legal) {
  let mounted;
  const ready = new MutationObserver(() => {
    if (!root.querySelector('.flow-panel')) return;
    ready.disconnect();
    mounted = attachMobileSheet(root, legal);
  });
  if (root.querySelector('.flow-panel')) mounted = attachMobileSheet(root, legal);
  else ready.observe(root, { childList: true });
  return { dispose() { ready.disconnect(); mounted?.dispose(); } };
}

function attachMobileSheet(root, legal) {
  const mobile = matchMedia('(max-width: 600px)');
  const tablet = matchMedia('(min-width: 601px) and (max-width: 1024px)');
  const events = new AbortController();
  const sheet = document.createElement('section');
  sheet.className = 'mobile-sheet';
  sheet.setAttribute('aria-label', 'Showroom actions');
  sheet.innerHTML = '<button class="mobile-sheet__handle" type="button" aria-expanded="false" aria-controls="mobile-sheet-content"><i aria-hidden="true"></i><span>Expand controls</span></button><div id="mobile-sheet-content" class="mobile-sheet__content"></div>';
  const handle = sheet.firstElementChild;
  const content = sheet.lastElementChild;
  const toolbar = root.querySelector('.showroom__toolbar');
  const panel = root.querySelector('.flow-panel');
  const equipment = root.querySelector('.equipment-modal:not(.legal-modal)');
  const equipmentSlot = document.createComment('equipment restore slot');
  equipment.before(equipmentSlot);
  const nodes = [toolbar, panel, legal];
  const slots = nodes.map(node => {
    const slot = document.createComment('mobile sheet restore slot');
    node.before(slot);
    return slot;
  });
  let expanded = false, startY = null, dragged = false;
  function setExpanded(value) {
    expanded = value;
    sheet.dataset.expanded = String(value);
    handle.setAttribute('aria-expanded', String(value));
    handle.lastElementChild.textContent = value ? 'Collapse controls' : 'Expand controls';
    const impact = panel.querySelector('.flow-impact:not([hidden])');
    if (value && mobile.matches && impact) impact.open = true;
    if (!value && tablet.matches && impact) impact.open = false;
    if (mobile.matches) root.dispatchEvent(new Event('showroom-sheet-layout'));
    if (tablet.matches) root.dispatchEvent(new Event('showroom-tablet-sheet-layout'));
  }
  panel.addEventListener('toggle', event => {
    if (tablet.matches && event.target.matches('.flow-impact') && event.target.open && !expanded) setExpanded(true);
  }, { capture: true, signal: events.signal });
  // Observe actual content-driven sheet height, including step and Impact changes.
  let layoutTimer;
  const resizeObserver = new ResizeObserver(() => {
    if (!tablet.matches || panel.hidden) return;
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => root.dispatchEvent(new Event('showroom-tablet-sheet-layout')), 40);
  });
  resizeObserver.observe(sheet);
  function syncFlow() {
    sheet.dataset.flow = String(!panel.hidden);
    sheet.dataset.equipment = String(tablet.matches && equipment.open);
    if (mobile.matches || tablet.matches) {
      toolbar.hidden = !panel.hidden || (tablet.matches && equipment.open);
      setExpanded(false);
    }
  }
  const observer = new MutationObserver(syncFlow);
  observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  // A top-layer equipment dialog must not resize or replace the sheet beneath it.
  const equipmentObserver = new MutationObserver(() => {
    if (tablet.matches && ((equipment.open && !equipment.matches(':modal')) || sheet.dataset.equipment === 'true')) syncFlow();
  });
  equipmentObserver.observe(equipment, { attributes: true, attributeFilter: ['open'] });
  function place() {
    if (sheet.className === 'tablet-sheet' && equipment.open) equipment.close();
    nodes.forEach((node, index) => slots[index].after(node));
    equipmentSlot.after(equipment);
    if (mobile.matches || tablet.matches) {
      sheet.className = mobile.matches ? 'mobile-sheet' : 'tablet-sheet';
      root.append(sheet);
      content.append(toolbar, panel);
      if (mobile.matches) content.append(legal);
      else {
        if (equipment.open) equipment.close();
        content.append(equipment);
      }
      syncFlow();
    } else {
      nodes.forEach((node, index) => slots[index].after(node));
      toolbar.hidden = false;
      sheet.remove();
    }
  }
  handle.addEventListener('click', () => { if (!dragged) setExpanded(!expanded); dragged = false; }, { signal: events.signal });
  handle.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setExpanded(event.key === 'ArrowUp' || event.key === 'End');
    }
  }, { signal: events.signal });
  handle.addEventListener('pointerdown', event => {
    startY = event.clientY; dragged = false; handle.setPointerCapture(event.pointerId);
  }, { signal: events.signal });
  handle.addEventListener('pointerup', event => {
    if (startY !== null && Math.abs(event.clientY - startY) > 24) {
      dragged = true; setExpanded(event.clientY < startY);
    }
    startY = null;
  }, { signal: events.signal });
  handle.addEventListener('pointercancel', () => { startY = null; }, { signal: events.signal });
  mobile.addEventListener('change', place);
  tablet.addEventListener('change', place);
  place();
  return { dispose() {
    observer.disconnect(); equipmentObserver.disconnect(); resizeObserver.disconnect(); clearTimeout(layoutTimer);
    equipmentSlot.after(equipment); equipmentSlot.remove();
    events.abort(); mobile.removeEventListener('change', place); tablet.removeEventListener('change', place);
    nodes.forEach((node, index) => slots[index].after(node));
    slots.forEach(slot => slot.remove()); sheet.remove();
  } };
}
