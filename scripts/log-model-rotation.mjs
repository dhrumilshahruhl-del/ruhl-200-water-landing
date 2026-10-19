import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const js = await readFile('building-scroll.js', 'utf8');

const variants = {
  original: html,
  opt: html
    .replaceAll('./logos/200_water.glb', './logos/200_water.opt.glb')
    .replaceAll('./logos/200 water Roof Only.glb', './logos/200 water Roof Only.opt.glb'),
};

const patchedJs = js.replace(
  'state.buildingFit.finalRotationY = object.rotation.y;',
  `console.log('RUHL_FINAL_ROTATION', modelPath, object.rotation.y);
  state.buildingFit.finalRotationY = object.rotation.y;`
);

for (const [name, body] of Object.entries(variants)) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  await page.route('http://localhost:8080/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body })
  );
  await page.route('http://localhost:8080/building-scroll.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: patchedJs })
  );
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => document.getElementById('building-scroll-status')?.classList.contains('is-hidden'),
    null,
    { timeout: 60000 }
  );
  await page.waitForTimeout(2500);
  console.log(name, logs.filter((line) => line.includes('RUHL_FINAL_ROTATION')).join('\n'));
  await browser.close();
}
