import { launchShowroom } from './src/showroom.js';
import { createMobileSheet } from './src/ui/mobile-sheet.js';

// The tested runtime stays inside a native modal and a CSS-isolated shadow tree.
export async function mountShowroom(host) {
  const surface = document.createElement('div');
  surface.className = 'showroom-surface';
  const shadow = surface.attachShadow({ mode: 'open' });
  host.append(surface);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('./src/ui/showroom.css', import.meta.url).href;
  const styled = new Promise((resolve, reject) => { css.onload = resolve; css.onerror = reject; });
  shadow.append(css);
  const response = await fetch(new URL('./shell.html', import.meta.url));
  if (!response.ok) throw new Error('Showroom shell could not load.');
  const template = document.createElement('template');
  template.innerHTML = await response.text();
  // Resolve shell URLs relative to this module, including subdirectory hosting.
  const root = template.content.querySelector('.showroom');
  root.dataset.buildingModel = new URL('./assets/models/200-water-building.opt.glb', import.meta.url).href;
  const events = new AbortController();
  const close = document.createElement('button');
  close.className = 'showroom-exit';
  close.type = 'button';
  close.setAttribute('aria-label', 'Back to building tour');
  close.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M5 12h14"/></svg><span>Back to building tour</span>';
  close.addEventListener('click', () => host.close(), { signal: events.signal });
  const controls = document.createElement('div');
  controls.className = 'showroom-controls';
  const toolbar = root.querySelector('.showroom__toolbar');
  toolbar.before(controls);
  controls.append(close, toolbar);
  shadow.append(template.content);
  await styled;
  if (!host.isConnected || !host.open) return null;
  const legalTrigger = shadow.querySelector('.showroom__legal-link');
  const legal = shadow.querySelector('#legal-credits');
  const legalClose = legal.querySelector('.equipment-modal__close');
  const notices = document.createElement('a');
  notices.href = new URL('./THIRD-PARTY-NOTICES.txt', import.meta.url).href;
  notices.target = '_blank';
  notices.rel = 'noopener';
  notices.textContent = 'View full Third-Party Notices';
  legal.querySelector('.equipment-modal__content').append(notices);
  legalTrigger.addEventListener('click', () => {
    if (!legal.open) { legal.showModal(); legal.scrollTop = 0; legalClose.focus({ preventScroll: true }); }
  }, { signal: events.signal });
  legalClose.addEventListener('click', () => legal.close(), { signal: events.signal });
  legal.addEventListener('close', () => legalTrigger.focus({ preventScroll: true }), { signal: events.signal });
  const observer = new MutationObserver(() => {
    surface.dataset.flowActive = root.dataset.flowActive || 'false';
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-flow-active'] });
  const showroom = await launchShowroom({ root });
  const mobileSheet = createMobileSheet(root, legalTrigger);
  root.querySelector('canvas').focus({ preventScroll: true });
  return { showroom, dispose() { mobileSheet.dispose(); events.abort(); observer.disconnect(); legal.close(); showroom.dispose(); shadow.replaceChildren(); } };
}
