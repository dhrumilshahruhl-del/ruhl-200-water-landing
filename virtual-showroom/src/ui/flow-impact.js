import { SHOW_APPROVED_IMPACT_CLAIMS } from '../config.js';

// Keys are the existing zero-based System Flow indices; no engineering steps
// are renamed. Final metrics describe the ventilation retrofit as a whole.
export const IMPACT_CONFIG = Object.freeze(SHOW_APPROVED_IMPACT_CLAIMS ? {
  1: { type: 'balance', title: 'Airflow rebalanced' },
  2: { type: 'recovery', title: 'Recover energy, not air' },
  5: { type: 'final', title: 'Ventilation impact' },
} : {});

const svg = (content, viewBox = '0 0 248 72', className = '', label = '') =>
  `<svg class="${className}" viewBox="${viewBox}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} focusable="false">${content}</svg>`;
const band = (width, y, height) =>
  `<path d="M0 ${y}H${width - 10}V${y - 4}L${width} ${y + height / 2}L${width - 10} ${y + height + 4}V${y + height}H0Z"/>`;

function pressureGraphic(balanced) {
  const building = '<path class="impact-building" d="M28 72V22H68V72M36 32H42M54 32H60M36 44H42M54 44H60M36 56H42M54 56H60M20 72H76"/>';
  const arrows = balanced
    ? '<path class="impact-blue" d="M38 4V19M34 15L38 19L42 15"/><path class="impact-orange" d="M58 19V4M54 8L58 4L62 8"/>'
    : '<path class="impact-orange" stroke-width="4" d="M48 19V3M42 9L48 3L54 9"/><path class="impact-infiltration" d="M6 35H24M20 31L24 35L20 39M6 58H24M20 54L24 58L20 62M90 46H72M76 42L72 46L76 50"/>';
  return svg(building + arrows, '0 0 96 80', '', balanced
    ? 'After: coordinated outdoor supply and exhaust, without exaggerated side infiltration.'
    : 'Before: excessive exhaust pulls air inward through the building sides.');
}

function exhaustComparisonGraphic() {
  const afterWidth = 248 * 21480 / 74780;
  return `<div class="impact-comparison">
    <div class="impact-row-label"><span>Before</span><strong>74,780 <small>CFM</small></strong></div>
    ${svg(band(248, 9, 14), '0 0 248 36', 'impact-band impact-band--before')}
    <div class="impact-row-label"><span>After</span><strong>21,480 <small>CFM</small></strong></div>
    ${svg(band(afterWidth, 11, 8), '0 0 248 30', 'impact-band impact-band--after')}
    <p class="impact-callout"><strong>53,300 CFM</strong> less exhaust</p>
  </div>
  <section class="impact-pressure" aria-label="Building pressure improvement">
    <h3>Building pressure</h3>
    <div class="impact-pressure__states">
      <div><span class="impact-state-label">Before</span>${pressureGraphic(false)}<strong>284% negative</strong><span>pressure</span></div>
      <div class="impact-pressure__after"><span class="impact-state-label">After</span>${pressureGraphic(true)}<strong>Balanced /</strong><span>slight positive</span></div>
    </div>
  </section>`;
}

function heatRecoveryGraphic() {
  return `${svg(`
    <text x="8" y="18">EXHAUST AIR</text>
    <path class="impact-air-track impact-orange" d="M8 32H238M230 26L238 32L230 38"/>
    <path class="impact-stream impact-orange" d="M20 32H60"/>
    <path class="impact-energy-track" d="M122 44V84"/>
    <path class="impact-energy-pulse" d="M122 44V84"/>
    <text class="impact-energy-label" x="137" y="60">ENERGY</text><text class="impact-energy-label" x="137" y="73">ONLY</text>
    <path class="impact-air-track impact-blue" d="M238 98H8M16 92L8 98L16 104"/>
    <path class="impact-stream impact-stream--fresh impact-blue" d="M224 98H184"/>
    <text x="8" y="125">OUTDOOR AIR</text>`, '0 0 248 136', 'impact-recovery-diagram',
    'Exhaust air and outdoor air remain separate. Cyan represents energy transfer only.')}
    <div class="impact-metric"><strong>~72%</strong><span>Heat-recovery effectiveness</span></div>
    <p class="impact-consequence">Air stays separate. Only energy is recovered.</p>`;
}

function finalImpactGraphic() {
  return `<div class="impact-metric impact-metric--hero"><strong>26%</strong><span>Ventilation energy reduction</span></div>
    <div class="impact-energy-bars" role="group" aria-label="Energy use before and after the ventilation retrofit: 26% less energy">
      <h3>Energy use</h3>
      <div class="impact-row-label"><span>Before</span></div><div class="impact-bar" aria-hidden="true"><span></span></div>
      <div class="impact-row-label"><span>After</span></div><div class="impact-bar impact-bar--after" aria-hidden="true"><span></span><i></i></div>
      <span class="impact-reduction-note">26% LESS</span>
    </div>
    <div class="impact-support">
      <div>${svg('<path class="impact-mini-baseline" d="M4 10V34H13V10ZM24 16.24V34H33V16.24Z"/><path class="impact-mini-energy" d="M42 15L36 23H42L38 31"/>', '0 0 52 40')}<p><strong>11.9M <small>kBtu/yr</small></strong><span>Ventilation energy saved</span></p></div>
      <div>${svg('<g class="impact-emissions"><rect x="4" y="12" width="7" height="7" rx="2"/><rect x="15" y="12" width="7" height="7" rx="2"/><rect x="4" y="23" width="7" height="7" rx="2"/><rect x="15" y="23" width="7" height="7" rx="2"/></g><g class="impact-emissions-avoided"><rect x="28" y="12" width="7" height="7" rx="2"/><rect x="39" y="12" width="7" height="7" rx="2"/><rect x="28" y="23" width="7" height="7" rx="2"/></g>', '0 0 52 40')}<p><strong>664 <small>tCO₂e/yr</small></strong><span>Avoided annually</span></p></div>
    </div>
    <p class="impact-consequence">Annual impact of the ventilation retrofit as a whole.</p>`;
}

const graphics = { balance: exhaustComparisonGraphic, recovery: heatRecoveryGraphic, final: finalImpactGraphic };

export function createFlowImpact(root, flowPanel, onLayoutChange) {
  const panel = document.createElement('details');
  panel.className = 'flow-impact';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Ventilation project impact');
  const desktop = window.matchMedia('(min-width: 1200px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = null, pending = null, paused = false;

  function place() {
    if (desktop.matches) root.append(panel);
    else flowPanel.querySelector('.flow-panel__navigation').before(panel);
    panel.open = desktop.matches;
  }
  function clear() {
    current = pending = null;
    panel.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    panel.hidden = true;
    panel.replaceChildren();
    panel.classList.remove('is-paused');
    delete panel.dataset.phase;
    delete panel.dataset.type;
  }
  function mount(config) {
    // Each entry replaces the content of one container. CSS animations have
    // finite iteration counts; there are no timers or animation-frame callbacks.
    panel.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    current = config; pending = null;
    if (!config) { clear(); return; }
    panel.dataset.type = config.type;
    panel.innerHTML = `<summary><span>Impact</span> ${config.title}<i aria-hidden="true"></i></summary>
      <div class="flow-impact__content" tabindex="0" role="region" aria-label="Impact explanation"><p class="flow-impact__eyebrow">Why it matters</p>
      <h2>${config.title}</h2>${graphics[config.type]()}</div>`;
    panel.open = desktop.matches;
    panel.hidden = false;
    panel.dataset.phase = 'enter';
    panel.classList.toggle('is-paused', paused);
  }
  function setStep(index) {
    const config = IMPACT_CONFIG[index] || null;
    if (reducedMotion.matches || panel.hidden || !panel.open) { mount(config); return; }
    pending = config;
    if (panel.dataset.phase !== 'leave') panel.dataset.phase = 'leave';
  }
  function onAnimationEnd(event) {
    if (event.target === panel && event.animationName === 'impact-exit' && panel.dataset.phase === 'leave') {
      mount(pending); onLayoutChange();
    }
  }
  function onMediaChange() {
    if (panel.dataset.phase === 'leave') mount(pending);
    place(); onLayoutChange();
  }
  function onReducedMotion() {
    if (reducedMotion.matches && panel.dataset.phase === 'leave') { mount(pending); onLayoutChange(); }
  }
  function onToggle() {
    if (!desktop.matches && panel.open && !panel.hidden) {
      const navigation = flowPanel.querySelector('.flow-panel__navigation').getBoundingClientRect();
      const overlap = panel.getBoundingClientRect().bottom - navigation.top;
      if (overlap > 0) flowPanel.scrollTop += overlap + 8;
    }
    onLayoutChange();
  }
  place();
  panel.addEventListener('animationend', onAnimationEnd);
  panel.addEventListener('toggle', onToggle);
  desktop.addEventListener('change', onMediaChange);
  reducedMotion.addEventListener('change', onReducedMotion);
  return {
    setStep,
    clear,
    setPaused(value) { paused = value; panel.classList.toggle('is-paused', value); },
    // Layout reads happen only at step changes/resize/toggle, never on a new loop.
    measure() {
      return { right: desktop.matches && current && !panel.hidden
        ? root.getBoundingClientRect().right - panel.getBoundingClientRect().left + 24 : 0 };
    },
    dispose() {
      panel.removeEventListener('animationend', onAnimationEnd);
      panel.removeEventListener('toggle', onToggle);
      desktop.removeEventListener('change', onMediaChange);
      reducedMotion.removeEventListener('change', onReducedMotion);
      clear(); panel.remove();
    },
  };
}
