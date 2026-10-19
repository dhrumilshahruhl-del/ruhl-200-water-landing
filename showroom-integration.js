const entry = document.getElementById('building-rooftop-entry');
let current = null;

export function isShowroomOpen() { return Boolean(current); }

export async function openShowroom() {
  if (current) return;
  const host = document.createElement('dialog');
  host.setAttribute('aria-label', '200 Water Street Rooftop Virtual Showroom');
  host.style.cssText = 'all:initial;position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;background:#edf2f4;color:#0b1724;';
  const loading = document.createElement('p');
  loading.textContent = 'Loading Rooftop Showroom…';
  loading.setAttribute('role', 'status');
  host.append(loading);
  const scroll = { x: window.scrollX, y: window.scrollY };
  const overflow = document.body.style.overflow;
  const state = { host, mounted: null, closed: false };
  current = state;
  document.documentElement.setAttribute('data-showroom-open', '');
  document.body.style.overflow = 'hidden';
  document.body.append(host);
  function close() {
    if (state.closed) return;
    state.closed = true;
    state.mounted?.dispose();
    state.mounted = null;
    host.remove();
    document.body.style.overflow = overflow;
    document.documentElement.removeAttribute('data-showroom-open');
    current = null;
    window.scrollTo({ left: scroll.x, top: scroll.y, behavior: 'instant' });
    window.dispatchEvent(new Event('rooftop-showroom-closed'));
    entry?.focus({ preventScroll: true });
    // Let the parent scroll controller update its CTA after viewport changes.
    requestAnimationFrame(() => {
      if (!current) entry?.focus({ preventScroll: true });
    });
  }
  host.addEventListener('close', close, { once: true });
  host.addEventListener('cancel', event => {
    const root = host.querySelector('.showroom-surface')?.shadowRoot?.querySelector('.showroom');
    // Let Escape retain its established nested-dialog / flow meaning.
    if (root?.querySelector('dialog[open]') || root?.dataset.flowActive === 'true') event.preventDefault();
  });
  host.showModal();
  try {
    const { mountShowroom } = await import('./virtual-showroom/mount.js');
    if (state.closed) return;
    state.mounted = await mountShowroom(host);
    loading.remove();
    if (state.closed) state.mounted?.dispose();
  } catch (error) {
    console.error('Rooftop showroom could not open.', error);
    if (state.closed) return;
    host.querySelector('.showroom-surface')?.remove();
    loading.textContent = 'Unable to load the Rooftop Showroom. Close and try again.';
    const back = document.createElement('button');
    back.textContent = 'Back to building tour';
    back.addEventListener('click', () => host.close());
    host.append(back);
    back.focus();
  }
}
entry?.addEventListener('click', openShowroom);
