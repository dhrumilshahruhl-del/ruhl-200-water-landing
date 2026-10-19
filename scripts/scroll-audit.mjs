import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] || 'http://localhost:8080/';
const viewportWidth = Number(process.argv[3] || 1440);
const viewportHeight = Number(process.argv[4] || 1000);
const screenshotDir = process.argv[5] || '';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: viewportWidth, height: viewportHeight },
  deviceScaleFactor: 1,
});

const logs = [];
page.on('console', (msg) => logs.push({ type: msg.type(), text: msg.text() }));
page.on('pageerror', (err) => logs.push({ type: 'pageerror', text: err.message }));
page.on('requestfailed', (req) =>
  logs.push({
    type: 'requestfailed',
    text: `${req.url()} :: ${req.failure()?.errorText || ''}`,
  })
);

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(22000);

const initial = await page.evaluate(() => {
  const section = document.getElementById('building-scroll');
  const canvas = document.getElementById('building-scroll-canvas');
  const status = document.getElementById('building-scroll-status');
  const rect = canvas?.getBoundingClientRect();
  return {
    bodyHeight: document.documentElement.scrollHeight,
    sectionTop: section?.offsetTop,
    sectionHeight: section?.offsetHeight,
    sectionClasses: section?.className,
    gsap: Boolean(window.gsap),
    scrollTrigger: Boolean(window.ScrollTrigger),
    triggers: window.ScrollTrigger?.getAll?.().map((trigger) => ({
      progress: trigger.progress,
      start: trigger.start,
      end: trigger.end,
      isActive: trigger.isActive,
    })) || [],
    statusText: status?.textContent,
    statusClass: status?.className,
    canvas: canvas && {
      width: canvas.width,
      height: canvas.height,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    },
  };
});

const sectionTop = initial.sectionTop;
const sectionHeight = initial.sectionHeight;
const viewport = initial.canvas?.rect?.h || viewportHeight;
const positions = [0, 0.025, 0.05, 0.1, 0.2, 0.35, 0.58, 0.85, 0.975, 1, 0.85, 0.58, 0.35, 0.2, 0.05, 0];
const samples = [];
const screenshotFiles = [];

if (screenshotDir) {
  await mkdir(screenshotDir, { recursive: true });
}

for (let index = 0; index < positions.length; index += 1) {
  const progress = positions[index];
  const y = Math.round(sectionTop + (sectionHeight - viewport) * progress);
  await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
  await page.waitForTimeout(1500);
  samples.push(
    await page.evaluate((requested) => {
      const section = document.getElementById('building-scroll');
      const sticky = document.querySelector('.building-scroll-sticky');
      const canvas = document.getElementById('building-scroll-canvas');
      const btn = document.getElementById('building-rooftop-entry');
      const side = document.getElementById('building-scroll-side-story');
      const status = document.getElementById('building-scroll-status');
      const sectionRect = section.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const buttonRect = btn.getBoundingClientRect();
      const trigger = window.ScrollTrigger?.getAll?.()[0];
      return {
        requested,
        scrollY: Math.round(window.scrollY),
        triggerProgress: trigger?.progress ?? null,
        triggerActive: trigger?.isActive ?? null,
        sectionRect: {
          top: Math.round(sectionRect.top),
          bottom: Math.round(sectionRect.bottom),
          height: Math.round(sectionRect.height),
        },
        stickyPosition: getComputedStyle(sticky).position,
        canvasRect: {
          x: Math.round(canvasRect.x),
          y: Math.round(canvasRect.y),
          w: Math.round(canvasRect.width),
          h: Math.round(canvasRect.height),
        },
        buttonVisible: btn.classList.contains('is-visible'),
        buttonAria: btn.getAttribute('aria-hidden'),
        buttonRect: {
          x: Math.round(buttonRect.x),
          y: Math.round(buttonRect.y),
          w: Math.round(buttonRect.width),
          h: Math.round(buttonRect.height),
        },
        sideOpacity: getComputedStyle(side).opacity,
        sideVisibility: getComputedStyle(side).visibility,
        statusText: status.textContent,
        statusClass: status.className,
        sectionClasses: section.className,
      };
    }, progress)
  );

  if (screenshotDir && [4, 6, 8, 9, 10, 12, 15].includes(index)) {
    const name = `${String(index).padStart(2, '0')}-${String(progress).replace('.', 'p')}.png`;
    const file = join(screenshotDir, name);
    await writeFile(file, await page.screenshot({ fullPage: false }));
    screenshotFiles.push(file);
  }
}

const png = await page.screenshot({ fullPage: false });
await browser.close();

console.log(
  JSON.stringify(
    {
      url,
      viewport: { width: viewportWidth, height: viewportHeight },
      initial,
      samples,
      logs,
      screenshotBytes: png.length,
      screenshotFiles,
    },
    null,
    2
  )
);
