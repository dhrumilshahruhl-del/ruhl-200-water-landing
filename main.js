document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }

  const compactMq = window.matchMedia('(max-width: 1023px)');
  const reduceMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isMobileViewport() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  function getCo2SvgFit() {
    if (isMobileViewport()) return 'xMinYMin meet';
    if (isCompactViewport()) return 'xMidYMid meet';
    return 'xMinYMin meet';
  }

  function isCompactViewport() {
    return compactMq.matches;
  }

  function prefersReducedMotion() {
    return reduceMotionMq.matches;
  }

  function getViewOpts(threshold = 0.2) {
    if (!isCompactViewport()) {
      return { threshold };
    }
    return {
      threshold: Math.min(threshold, 0.12),
      rootMargin: '0px 0px 6% 0px',
    };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatNumber(n) {
    return Math.round(n).toLocaleString();
  }

  function setWillChange(els, value) {
    els.forEach((el) => {
      if (value) el.style.willChange = value;
      else el.style.removeProperty('will-change');
    });
  }

  function whenStableLayout(el, callback, { minHeight = 48, timeoutMs = 800 } = {}) {
    if (!el) return;

    const ready = () => {
      const { height, width } = el.getBoundingClientRect();
      return height >= minHeight && width > 0;
    };

    if (!isCompactViewport() || ready()) {
      callback();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ro.disconnect();
      clearTimeout(timer);
      callback();
    };

    const ro = new ResizeObserver(() => {
      if (ready()) finish();
    });
    ro.observe(el);

    const timer = setTimeout(() => {
      if (ready()) finish();
    }, timeoutMs);
  }

  function prepareAnimatedNumbers(container) {
    if (!container) return;
    container.querySelectorAll('[data-animate-number][data-final]').forEach((el) => {
      el.style.fontVariantNumeric = 'tabular-nums';
    });
  }

  function animateWidthsAndNumbers(container, { durationMs = 1100 } = {}) {
    if (!container || container.dataset.animated === 'true') return;
    container.dataset.animated = 'true';

    prepareAnimatedNumbers(container);

    const widthEls = Array.from(container.querySelectorAll('[data-animate-width][data-final-width]'));
    const numEls = Array.from(container.querySelectorAll('[data-animate-number][data-final]'));

    const widths = widthEls.map((el) => {
      const finalWidth = String(el.getAttribute('data-final-width') || '').trim();
      const n = Number(finalWidth.replace('%', ''));
      el.style.width = '0%';
      return { el, finalWidth, n: Number.isFinite(n) ? n : 0 };
    });

    const numbers = numEls.map((el) => {
      const final = Number(el.getAttribute('data-final') || '0');
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = `0${suffix}`;
      return { el, final: Number.isFinite(final) ? final : 0, suffix };
    });

    const finalize = () => {
      widths.forEach(({ el, n }) => {
        el.style.width = `${n}%`;
      });
      numbers.forEach(({ el, final, suffix }) => {
        el.textContent = `${formatNumber(final)}${suffix}`;
      });
      setWillChange(widthEls, null);
    };

    if (prefersReducedMotion()) {
      finalize();
      return;
    }

    widths.forEach(({ el }) => void el.offsetWidth);
    if (isCompactViewport()) {
      setWillChange(widthEls, 'width');
    }

    let start = 0;
    function tick(now) {
      if (!start) start = now;
      const raw = Math.min(1, (now - start) / durationMs);
      const t = easeOutCubic(raw);

      widths.forEach(({ el, n }) => {
        el.style.width = `${n * t}%`;
      });
      numbers.forEach(({ el, final, suffix }) => {
        el.textContent = `${formatNumber(final * t)}${suffix}`;
      });

      if (raw < 1) requestAnimationFrame(tick);
      else finalize();
    }
    requestAnimationFrame(() => requestAnimationFrame(tick));
  }

  function animateWaterfall(container, { durationMs = 1100 } = {}) {
    if (!container || container.dataset.animated === 'true') return;
    container.dataset.animated = 'true';

    const bars = Array.from(container.querySelectorAll('.wf-bar'));
    const labels = Array.from(container.querySelectorAll('.wf-label[data-animate-number][data-final]'));

    prepareAnimatedNumbers(container);

    const finalize = () => {
      bars.forEach((bar) => {
        bar.style.transform = 'scaleY(1)';
        bar.classList.remove('is-animating');
      });
      labels.forEach((el) => {
        const final = Number(el.getAttribute('data-final') || '0');
        const suffix = el.getAttribute('data-suffix') || '';
        el.textContent = `${formatNumber(final)}${suffix}`;
      });
      setWillChange(bars, null);
    };

    bars.forEach((bar) => {
      bar.style.transformOrigin = 'bottom';
      bar.style.transform = 'scaleY(0)';
    });

    labels.forEach((el) => {
      const suffix = el.getAttribute('data-suffix') || '';
      el.textContent = `0${suffix}`;
    });

    if (prefersReducedMotion()) {
      finalize();
      return;
    }

    if (isCompactViewport()) {
      bars.forEach((bar) => bar.classList.add('is-animating'));
      setWillChange(bars, 'transform');
    }

    const start = performance.now();
    function tick(now) {
      const raw = Math.min(1, (now - start) / durationMs);
      const t = easeOutCubic(raw);

      bars.forEach((bar) => {
        bar.style.transform = `scaleY(${t})`;
      });
      labels.forEach((el) => {
        const final = Number(el.getAttribute('data-final') || '0');
        const suffix = el.getAttribute('data-suffix') || '';
        el.textContent = `${formatNumber((Number.isFinite(final) ? final : 0) * t)}${suffix}`;
      });

      if (raw < 1) requestAnimationFrame(tick);
      else finalize();
    }
    requestAnimationFrame(tick);
  }

  function triggerOnceInView(el, onEnter, { threshold = 0.2 } = {}) {
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      onEnter();
      return;
    }

    if (!('IntersectionObserver' in window)) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onEnter();
            obs.disconnect();
          }
        });
      },
      getViewOpts(threshold)
    );
    obs.observe(el);
  }

  function whenRevealReady(el, callback, { threshold = 0.2 } = {}) {
    if (!el) return;

    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      whenStableLayout(el, callback);
    };

    const revealHost = el.classList.contains('reveal') ? el : el.closest('.reveal');

    const canRun = () => {
      if (!isCompactViewport()) return true;
      if (!revealHost) return true;
      return revealHost.classList.contains('in-view');
    };

    const tryStart = () => {
      if (!canRun()) return;
      run();
    };

    if (canRun()) {
      triggerOnceInView(el, tryStart, { threshold });
      return;
    }

    const mo = new MutationObserver(() => {
      tryStart();
      if (started) mo.disconnect();
    });
    mo.observe(revealHost, { attributes: true, attributeFilter: ['class'] });

    triggerOnceInView(
      el,
      () => {
        tryStart();
        if (started) mo.disconnect();
      },
      { threshold }
    );
  }

  function renderAndAnimateCO2Chart(container) {
    if (!container || container.dataset.rendered === 'true') return;
    container.dataset.rendered = 'true';

    const data = {
      max: 4000,
      baseline: 3154,
      retrofit: 1586,
      ll97Future: 1801,
      ll97Current: 3658,
    };

    const vbW = 1200;
    const vbH = 585;
    const padL = 20;
    const padR = 0;
    const trackX = padL;
    const trackW = vbW - padL - padR;

    const x = (value) => trackX + (value / data.max) * trackW;

    const y1Title = 30;
    const y1Sub = 50;

    const y1Label = 116;
    const y1Track = 160;
    const y1Axis = 210;

    const y2Label = 368;
    const y2Track = 422;
    const y2Axis = 482;

    const trackH = 16;
    const trackR = 8;

    const labelFont = 'Roboto, Arial, sans-serif';
    const gold = '#fcbe00';
    const navy = '#00375a';
    const red = '#ef4444';
    const slate200 = '#e2e8f0';
    const slate400 = '#94a3b8';
    const slate600 = '#475569';

    const tickStepMinor = 200;
    const tickStepMajor = 1000;
    const minorTickLen = 8;
    const majorTickLen = 14;

    const tickLines = (yBase) => {
      const lines = [];
      for (let v = 0; v <= data.max; v += tickStepMinor) {
        const isMajor = v % tickStepMajor === 0;
        const len = isMajor ? majorTickLen : minorTickLen;
        const y1 = yBase;
        const y2 = yBase + len;
        lines.push(`<line x1="${x(v)}" y1="${y1}" x2="${x(v)}" y2="${y2}" stroke="${slate400}" stroke-width="${isMajor ? 1.5 : 1}" opacity="${isMajor ? 1 : 0.6}" />`);
      }
      return lines.join('');
    };

    const majorLabels = (yText) => `
      <text x="${trackX}" y="${yText}" font-family="${labelFont}" font-size="16" font-weight="700" fill="${slate600}">0</text>
      <text x="${x(1000)}" y="${yText}" text-anchor="middle" font-family="${labelFont}" font-size="16" font-weight="700" fill="${slate600}">1,000</text>
      <text x="${x(2000)}" y="${yText}" text-anchor="middle" font-family="${labelFont}" font-size="16" font-weight="700" fill="${slate600}">2,000</text>
      <text x="${x(3000)}" y="${yText}" text-anchor="middle" font-family="${labelFont}" font-size="16" font-weight="700" fill="${slate600}">3,000</text>
      <text x="${trackX + trackW}" y="${yText}" text-anchor="end" font-family="${labelFont}" font-size="16" font-weight="700" fill="${slate600}">4,000</text>
    `;

    const axisUnit = (yText) => `
      <text x="${trackX + trackW / 2}" y="${yText}" text-anchor="middle" font-family="${labelFont}" font-size="16" font-weight="500" fill="${slate600}">
        tCO₂e/year
      </text>
    `;

    const collisionPx = 120;
    const offsetPx = 20;

    const p1DeltaFuture = Math.abs(x(data.baseline) - x(data.ll97Future));
    const p2DeltaFuture = Math.abs(x(data.retrofit) - x(data.ll97Future));

    const p1BaselineAnchor = p1DeltaFuture < collisionPx ? 'end' : 'middle';
    const p1BaselineDx = p1DeltaFuture < collisionPx ? -offsetPx : 0;
    const p1FutureAnchor = p1DeltaFuture < collisionPx ? 'start' : 'middle';
    const p1FutureDx = p1DeltaFuture < collisionPx ? offsetPx : 0;

    const p2RetrofitAnchor = p2DeltaFuture < collisionPx ? 'end' : 'middle';
    const p2RetrofitDx = p2DeltaFuture < collisionPx ? -offsetPx : 0;
    const p2FutureAnchor = p2DeltaFuture < collisionPx ? 'start' : 'middle';
    const p2FutureDx = p2DeltaFuture < collisionPx ? offsetPx : 0;

    const limitLabelY1 = y1Label - 26;
    const limitNumY1 = y1Label - 4;
    const limitStemStartY1 = y1Label + 6;

    const limitLabelY2 = y2Label - 26;
    const limitNumY2 = y2Label - 4;
    const limitStemStartY2 = y2Label + 6;

    const svgFit = getCo2SvgFit();

    container.innerHTML = `
      <svg viewBox="0 0 ${vbW} ${vbH}" width="100%" height="100%" preserveAspectRatio="${svgFit}" role="img" aria-label="Projected CO₂ emissions vs permitted limits">
        <defs>
          <linearGradient id="co2RedGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#b91c1c" />
            <stop offset="100%" stop-color="${red}" />
          </linearGradient>
        </defs>

        <text x="${trackX}" y="${y1Title}" font-family="${labelFont}" font-size="28" font-weight="900" fill="${navy}">
          Projected CO₂ Emissions vs. Permitted Limits
        </text>
        <text x="${trackX}" y="${y1Sub}" font-family="${labelFont}" font-size="14" font-weight="500" fill="${slate600}">
          Comparison of baseline and post-retrofit emissions against Local Law 97 thresholds.
        </text>

        <text x="${trackX}" y="${y1Label}" font-family="${labelFont}" font-size="16" font-weight="800" fill="${navy}">Baseline CO₂ Emissions</text>

        <rect x="${trackX}" y="${y1Track}" width="${trackW}" height="${trackH}" rx="${trackR}" fill="${slate200}" />
        <rect id="co2-baseline-fill" x="${trackX}" y="${y1Track}" width="0" height="${trackH}" rx="${trackR}" fill="url(#co2RedGrad)" />

        <g id="co2-p1-limit-future" transform="translate(${x(data.ll97Future)} 0)" opacity="0">
          <text x="${p1FutureDx}" y="${limitLabelY1}" text-anchor="${p1FutureAnchor}" font-family="${labelFont}" font-size="12" font-weight="800" fill="${gold}">2030–2034 Limit</text>
          <text id="co2-p1-limit-future-num" x="${p1FutureDx}" y="${limitNumY1}" text-anchor="${p1FutureAnchor}" font-family="${labelFont}" font-size="22" font-weight="900" fill="${gold}">0</text>
          <line id="co2-p1-limit-future-stem" x1="0" y1="${limitStemStartY1}" x2="0" y2="${limitStemStartY1}" stroke="${gold}" stroke-width="2" />
          <circle cx="0" cy="${y1Track + trackH / 2}" r="9" fill="${gold}" stroke="#fff" stroke-width="4" />
        </g>

        <g id="co2-p1-baseline" transform="translate(${x(data.baseline)} 0)" opacity="0">
          <text id="co2-p1-baseline-num" x="-18" y="${y1Label + 2}" text-anchor="end" font-family="${labelFont}" font-size="24" font-weight="900" fill="#991b1b">0</text>
          <text x="-18" y="${y1Label + 24}" text-anchor="end" font-family="${labelFont}" font-size="13" font-weight="800" fill="#991b1b">Baseline</text>
          <line id="co2-p1-baseline-stem" x1="0" y1="${y1Label + 40}" x2="0" y2="${y1Label + 40}" stroke="#991b1b" stroke-width="2" />
          <circle cx="0" cy="${y1Track + trackH / 2}" r="9" fill="#991b1b" stroke="#fff" stroke-width="4" />
        </g>

        <g id="co2-p1-limit-current" transform="translate(${x(data.ll97Current)} 0)" opacity="0">
          <text x="0" y="${limitLabelY1}" text-anchor="middle" font-family="${labelFont}" font-size="12" font-weight="800" fill="${gold}">2024–2029 Limit</text>
          <text id="co2-p1-limit-current-num" x="0" y="${limitNumY1}" text-anchor="middle" font-family="${labelFont}" font-size="22" font-weight="900" fill="${gold}">0</text>
          <line id="co2-p1-limit-current-stem" x1="0" y1="${limitStemStartY1}" x2="0" y2="${limitStemStartY1}" stroke="${gold}" stroke-width="2" />
          <circle cx="0" cy="${y1Track + trackH / 2}" r="9" fill="${gold}" stroke="#fff" stroke-width="4" />
        </g>

        ${tickLines(y1Axis)}
        ${majorLabels(y1Axis + 42)}
        ${axisUnit(y1Axis + 78)}

        <text x="${trackX}" y="${y2Label}" font-family="${labelFont}" font-size="16" font-weight="800" fill="${navy}">Expected CO₂ After Retrofit</text>

        <rect x="${trackX}" y="${y2Track}" width="${trackW}" height="${trackH}" rx="${trackR}" fill="${slate200}" />
        <rect id="co2-retrofit-fill" x="${trackX}" y="${y2Track}" width="0" height="${trackH}" rx="${trackR}" fill="${navy}" />

        <g id="co2-p2-retrofit" transform="translate(${x(data.retrofit)} 0)" opacity="0">
          <text id="co2-p2-retrofit-num" x="${p2RetrofitDx}" y="${y2Label + 10}" text-anchor="${p2RetrofitAnchor}" font-family="${labelFont}" font-size="24" font-weight="900" fill="${navy}">0</text>
          <text x="${p2RetrofitDx}" y="${y2Label + 32}" text-anchor="${p2RetrofitAnchor}" font-family="${labelFont}" font-size="13" font-weight="800" fill="${navy}">After Retrofit</text>
          <line id="co2-p2-retrofit-stem" x1="0" y1="${y2Label + 40}" x2="0" y2="${y2Label + 40}" stroke="${navy}" stroke-width="2" />
          <circle cx="0" cy="${y2Track + trackH / 2}" r="9" fill="${navy}" stroke="#fff" stroke-width="4" />
        </g>

        <g id="co2-p2-limit-future" transform="translate(${x(data.ll97Future)} 0)" opacity="0">
          <text x="${p2FutureDx}" y="${limitLabelY2}" text-anchor="${p2FutureAnchor}" font-family="${labelFont}" font-size="12" font-weight="800" fill="${gold}">2030–2034 Limit</text>
          <text id="co2-p2-limit-future-num" x="${p2FutureDx}" y="${limitNumY2}" text-anchor="${p2FutureAnchor}" font-family="${labelFont}" font-size="22" font-weight="900" fill="${gold}">0</text>
          <line id="co2-p2-limit-future-stem" x1="0" y1="${limitStemStartY2}" x2="0" y2="${limitStemStartY2}" stroke="${gold}" stroke-width="2" />
          <circle cx="0" cy="${y2Track + trackH / 2}" r="9" fill="${gold}" stroke="#fff" stroke-width="4" />
        </g>

        <g id="co2-p2-limit-current" transform="translate(${x(data.ll97Current)} 0)" opacity="0">
          <text x="0" y="${limitLabelY2}" text-anchor="middle" font-family="${labelFont}" font-size="12" font-weight="800" fill="${gold}">2024–2029 Limit</text>
          <text id="co2-p2-limit-current-num" x="0" y="${limitNumY2}" text-anchor="middle" font-family="${labelFont}" font-size="22" font-weight="900" fill="${gold}">0</text>
          <line id="co2-p2-limit-current-stem" x1="0" y1="${limitStemStartY2}" x2="0" y2="${limitStemStartY2}" stroke="${gold}" stroke-width="2" />
          <circle cx="0" cy="${y2Track + trackH / 2}" r="9" fill="${gold}" stroke="#fff" stroke-width="4" />
        </g>

        ${tickLines(y2Axis)}
        ${majorLabels(y2Axis + 42)}
        ${axisUnit(y2Axis + 78)}

      </svg>
    `;

    const svg = container.querySelector('svg');
    const baselineFill = svg.querySelector('#co2-baseline-fill');
    const retrofitFill = svg.querySelector('#co2-retrofit-fill');

    const groups = {
      p1Future: svg.querySelector('#co2-p1-limit-future'),
      p1Current: svg.querySelector('#co2-p1-limit-current'),
      p1Baseline: svg.querySelector('#co2-p1-baseline'),
      p2Retrofit: svg.querySelector('#co2-p2-retrofit'),
      p2Future: svg.querySelector('#co2-p2-limit-future'),
      p2Current: svg.querySelector('#co2-p2-limit-current'),
    };

    const stems = {
      p1Future: svg.querySelector('#co2-p1-limit-future-stem'),
      p1Current: svg.querySelector('#co2-p1-limit-current-stem'),
      p1Baseline: svg.querySelector('#co2-p1-baseline-stem'),
      p2Retrofit: svg.querySelector('#co2-p2-retrofit-stem'),
      p2Future: svg.querySelector('#co2-p2-limit-future-stem'),
      p2Current: svg.querySelector('#co2-p2-limit-current-stem'),
    };

    const nums = {
      p1Future: svg.querySelector('#co2-p1-limit-future-num'),
      p1Current: svg.querySelector('#co2-p1-limit-current-num'),
      p1Baseline: svg.querySelector('#co2-p1-baseline-num'),
      p2Retrofit: svg.querySelector('#co2-p2-retrofit-num'),
      p2Future: svg.querySelector('#co2-p2-limit-future-num'),
      p2Current: svg.querySelector('#co2-p2-limit-current-num'),
    };

    const targets = {
      baselineW: x(data.baseline) - trackX,
      retrofitW: x(data.retrofit) - trackX,
      baseline: data.baseline,
      retrofit: data.retrofit,
      ll97Future: data.ll97Future,
      ll97Current: data.ll97Current,
    };

    const p1StemStart = limitStemStartY1;
    const p1StemEnd = y1Track + trackH / 2;
    const p2StemStart = limitStemStartY2;
    const p2StemEnd = y2Track + trackH / 2;

    const durationMs = 1200;

    function setStem(lineEl, y1, y2) {
      lineEl.setAttribute('y1', String(y1));
      lineEl.setAttribute('y2', String(y2));
    }

    const finalize = () => {
      baselineFill.setAttribute('width', String(targets.baselineW));
      retrofitFill.setAttribute('width', String(targets.retrofitW));
      Object.values(groups).forEach((g) => g && g.setAttribute('opacity', '1'));
      setStem(stems.p1Future, p1StemStart, p1StemEnd);
      setStem(stems.p1Baseline, p1StemStart, p1StemEnd);
      setStem(stems.p1Current, p1StemStart, p1StemEnd);
      setStem(stems.p2Retrofit, p2StemStart, p2StemEnd);
      setStem(stems.p2Future, p2StemStart, p2StemEnd);
      setStem(stems.p2Current, p2StemStart, p2StemEnd);
      nums.p1Future.textContent = formatNumber(targets.ll97Future);
      nums.p1Current.textContent = formatNumber(targets.ll97Current);
      nums.p1Baseline.textContent = formatNumber(targets.baseline);
      nums.p2Retrofit.textContent = formatNumber(targets.retrofit);
      nums.p2Future.textContent = formatNumber(targets.ll97Future);
      nums.p2Current.textContent = formatNumber(targets.ll97Current);
    };

    if (prefersReducedMotion()) {
      finalize();
      return;
    }

    const start = performance.now();

    function tick(now) {
      const raw = Math.min(1, (now - start) / durationMs);
      const t = easeOutCubic(raw);

      baselineFill.setAttribute('width', String(targets.baselineW * t));
      retrofitFill.setAttribute('width', String(targets.retrofitW * t));

      Object.values(groups).forEach((g) => g && g.setAttribute('opacity', String(Math.min(1, t * 1.1))));

      setStem(stems.p1Future, p1StemStart, p1StemStart + (p1StemEnd - p1StemStart) * t);
      setStem(stems.p1Baseline, p1StemStart, p1StemStart + (p1StemEnd - p1StemStart) * t);
      setStem(stems.p1Current, p1StemStart, p1StemStart + (p1StemEnd - p1StemStart) * t);

      setStem(stems.p2Retrofit, p2StemStart, p2StemStart + (p2StemEnd - p2StemStart) * t);
      setStem(stems.p2Future, p2StemStart, p2StemStart + (p2StemEnd - p2StemStart) * t);
      setStem(stems.p2Current, p2StemStart, p2StemStart + (p2StemEnd - p2StemStart) * t);

      nums.p1Future.textContent = formatNumber(targets.ll97Future * t);
      nums.p1Current.textContent = formatNumber(targets.ll97Current * t);
      nums.p1Baseline.textContent = formatNumber(targets.baseline * t);
      nums.p2Retrofit.textContent = formatNumber(targets.retrofit * t);
      nums.p2Future.textContent = formatNumber(targets.ll97Future * t);
      nums.p2Current.textContent = formatNumber(targets.ll97Current * t);

      if (raw < 1) requestAnimationFrame(tick);
      else finalize();
    }

    requestAnimationFrame(tick);
  }

  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  const revealThreshold = isCompactViewport() ? 0.1 : 0.14;

  if (!('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in-view'));
    const chart = document.getElementById('co2-chart');
    renderAndAnimateCO2Chart(chart);
    animateWidthsAndNumbers(document.getElementById('airflow-charts'));
    animateWidthsAndNumbers(document.getElementById('energy-chart'));
    animateWaterfall(document.getElementById('waterfall-chart'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    getViewOpts(revealThreshold)
  );

  revealEls.forEach((el) => observer.observe(el));

  const co2Chart = document.getElementById('co2-chart');
  if (co2Chart) {
    whenRevealReady(co2Chart, () => renderAndAnimateCO2Chart(co2Chart), { threshold: 0.2 });
  }

  const energyChart = document.getElementById('energy-chart');
  whenRevealReady(energyChart, () => animateWidthsAndNumbers(energyChart));

  const airflowCharts = document.getElementById('airflow-charts');
  whenRevealReady(airflowCharts, () => animateWidthsAndNumbers(airflowCharts));

  const waterfallChart = document.getElementById('waterfall-chart');
  whenRevealReady(waterfallChart, () => animateWaterfall(waterfallChart));
});
