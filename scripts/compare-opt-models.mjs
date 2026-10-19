import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = 'scripts/opt-compare-shots';
await mkdir(outDir, { recursive: true });

const html = await readFile('index.html', 'utf8');
const variants = {
  original: html,
  opt: html
    .replaceAll('./logos/200_water.glb', './logos/200_water.opt.glb')
    .replaceAll('./logos/200 water Roof Only.glb', './logos/200 water Roof Only.opt.glb'),
};

const results = {};

for (const [name, body] of Object.entries(variants)) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const logs = [];
  page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: err.message }));

  await page.route('http://localhost:8080/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body })
  );

  const startedAt = Date.now();
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () =>
      window.gsap &&
      window.ScrollTrigger &&
      document.getElementById('building-scroll-status')?.classList.contains('is-hidden'),
    null,
    { timeout: 60000 }
  );
  const readyMs = Date.now() - startedAt;

  const info = await page.evaluate(() => ({
    top: document.getElementById('building-scroll').offsetTop,
    height: document.getElementById('building-scroll').offsetHeight,
    vh: innerHeight,
    paths: {
      model: document.getElementById('building-scroll').dataset.modelPath,
      roof: document.getElementById('building-scroll').dataset.roofModelPath,
      rooftopDetailRoof: document.getElementById('rooftop-detail').dataset.roofModelPath,
    },
  }));

  const samples = [];
  for (const progress of [0, 0.2, 0.58, 0.975, 1]) {
    const y = Math.round(info.top + (info.height - info.vh) * progress);
    await page.evaluate((scrollY) => scrollTo(0, scrollY), y);
    await page.waitForTimeout(1700);
    const file = join(outDir, `${name}-${String(progress).replace('.', 'p')}.png`);
    await page.screenshot({ path: file, fullPage: false });
    samples.push(
      await page.evaluate((requested) => {
        const trigger = window.ScrollTrigger?.getAll?.()[0];
        const sticky = document.querySelector('.building-scroll-sticky');
        return {
          requested,
          progress: trigger?.progress ?? null,
          stickyTop: Math.round(sticky.getBoundingClientRect().top),
          status: document.getElementById('building-scroll-status')?.textContent,
        };
      }, progress)
    );
  }

  results[name] = { readyMs, info, samples, logs };
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
