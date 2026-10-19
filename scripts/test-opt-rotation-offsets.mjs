import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = 'scripts/opt-offset-shots';
await mkdir(outDir, { recursive: true });

const html = (await readFile('index.html', 'utf8'))
  .replaceAll('./logos/200_water.glb', './logos/200_water.opt.glb')
  .replaceAll('./logos/200 water Roof Only.glb', './logos/200 water Roof Only.opt.glb');
const js = await readFile('building-scroll.js', 'utf8');

const offsets = {
  minus90: '-Math.PI / 2',
  plus90: 'Math.PI / 2',
  plus180: 'Math.PI',
  minus180: '-Math.PI',
};

const results = {};

for (const [name, expression] of Object.entries(offsets)) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const logs = [];
  page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: err.message }));

  const patchedJs = js.replace(
    'state.buildingFit.finalRotationY = object.rotation.y;',
    `if (modelPath.includes('.opt.glb')) {
      object.rotation.y += ${expression};
      object.updateMatrixWorld(true);
      rebuildRoofVertexCache(object);
    }
    state.buildingFit.finalRotationY = object.rotation.y;`
  );

  await page.route('http://localhost:8080/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
  );
  await page.route('http://localhost:8080/building-scroll.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: patchedJs })
  );

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () =>
      window.ScrollTrigger?.getAll?.().length &&
      document.getElementById('building-scroll-status')?.classList.contains('is-hidden'),
    null,
    { timeout: 60000 }
  );
  const info = await page.evaluate(() => ({
    top: document.getElementById('building-scroll').offsetTop,
    height: document.getElementById('building-scroll').offsetHeight,
    vh: innerHeight,
  }));

  for (const progress of [0.2, 0.975]) {
    const y = Math.round(info.top + (info.height - info.vh) * progress);
    await page.evaluate((scrollY) => scrollTo(0, scrollY), y);
    await page.waitForTimeout(1700);
    await page.screenshot({
      path: join(outDir, `${name}-${String(progress).replace('.', 'p')}.png`),
      fullPage: false,
    });
  }

  results[name] = {
    info,
    logs,
    final: await page.evaluate(() => ({
      scrollY,
      status: document.getElementById('building-scroll-status')?.textContent,
      progress: window.ScrollTrigger?.getAll?.()[0]?.progress ?? null,
      sectionTop: Math.round(document.getElementById('building-scroll').getBoundingClientRect().top),
    })),
  };
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
