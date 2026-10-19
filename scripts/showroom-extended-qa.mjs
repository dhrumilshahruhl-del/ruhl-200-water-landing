import { chromium } from 'playwright';
import { writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const profile=await mkdtemp(path.join(tmpdir(),'ruhl-integration-qa-'));
const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:null,args:['--enable-unsafe-swiftshader','--window-size=1440,1000']});
const browser={close:()=>context.close()};
await context.addInitScript(()=>{
 window.__qa={contexts:[],raf:new Set()};
 const original=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args){const result=original.call(this,type,...args);if(result&&/^webgl/.test(type)&&!window.__qa.contexts.some(ref=>ref.deref()===result))window.__qa.contexts.push(new WeakRef(result));return result;};
 const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
 window.requestAnimationFrame=function(fn){let id=request(t=>{window.__qa.raf.delete(id);fn(t)});window.__qa.raf.add(id);return id;};
 window.cancelAnimationFrame=function(id){window.__qa.raf.delete(id);return cancel(id);};
});
const page=await context.newPage(), cdp=await context.newCDPSession(page);
const checks=[],cycles=[];
const assert=(pass,label,detail)=>{checks.push({pass:!!pass,label,detail});if(!pass)throw Error(label+' '+JSON.stringify(detail));};
const shell=()=>page.locator('dialog[aria-label="200 Water Street Rooftop Virtual Showroom"]');
const prepare=async()=>{await page.evaluate(()=>{const s=document.getElementById('building-scroll');scrollTo(0,s.offsetTop+(s.offsetHeight-innerHeight)*0.95)});await page.waitForTimeout(2500);};
const diagnostics=async()=>{await cdp.send('HeapProfiler.collectGarbage');return {...await page.evaluate(()=>({activeContexts:__qa.contexts.filter(ref=>{const gl=ref.deref();return gl&&!gl.isContextLost()}).length,raf:__qa.raf.size,canvases:document.querySelectorAll('canvas').length,focus:document.activeElement.id,entry:document.getElementById('building-rooftop-entry').className,scroll:scrollY})),...await cdp.send('Memory.getDOMCounters'),...await cdp.send('Runtime.getHeapUsage')};};
try {
 await page.goto('http://127.0.0.1:4180/',{waitUntil:'networkidle'});await page.waitForTimeout(2000);await prepare();
 const baseline=await diagnostics();
 for(let i=0;i<(process.env.VISUAL_ONLY?0:3);i++) {
  await page.locator('#building-rooftop-entry').click();await shell().locator('.flow-launch').waitFor({timeout:90000});await page.waitForTimeout(3500);
  assert(await page.evaluate(()=>__qa.contexts.filter(ref=>{const gl=ref.deref();return gl&&!gl.isContextLost()}).length)===baseline.activeContexts+1,'Exactly one added WebGL context '+i);
  await shell().locator('.showroom-exit').click();await page.waitForTimeout(1500);
  const result=await diagnostics();cycles.push(result);
  assert(result.activeContexts===baseline.activeContexts,'Showroom WebGL context released '+i,result);
  assert(result.raf===baseline.raf,'RAF count returns to baseline '+i,{baseline:baseline.raf,actual:result.raf});
  assert(Math.abs(result.scroll-baseline.scroll)<2,'Same page scroll '+i);
  assert(result.focus==='building-rooftop-entry','CTA receives focus '+i);
 }
 if(cycles.length) assert(cycles[2].jsEventListeners<=cycles[0].jsEventListeners+2,'DOM listener count stabilizes',cycles.map(c=>c.jsEventListeners));
 if(cycles.length) assert(cycles[2].usedSize<cycles[0].usedSize+8e6,'Collected JS heap stabilizes within 8 MB',cycles.map(c=>c.usedSize));
 const settings=await context.newPage();await settings.goto('chrome://settings/',{waitUntil:'domcontentloaded'});
 assert(await settings.evaluate(()=>typeof chrome.settingsPrivate?.setDefaultZoom)==='function','Actual browser zoom API available');
 await settings.evaluate(()=>new Promise(resolve=>chrome.settingsPrivate.setDefaultZoom(2,resolve)));
 await page.bringToFront();await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(1000);await prepare();
 const zoom=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 assert(zoom.dpr===2,'Actual browser zoom is 200%',zoom);
 await page.locator('#building-rooftop-entry').click();await shell().locator('.flow-launch').waitFor({timeout:90000});
 await shell().locator('.flow-launch').click();await page.waitForTimeout(1600);
 for(const selector of ['.showroom-exit','[data-flow="exit"]','.showroom__legal-link']) {
  await shell().locator(selector).scrollIntoViewIfNeeded();
  const r=await shell().locator(selector).boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=zoom.width+1&&r.y+r.height<=zoom.height+1,'200% zoom control '+selector,r);
 }
 await page.bringToFront();
 await page.waitForTimeout(1500);
 const image=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});
 await writeFile('scripts/integration-zoom-200.png',Buffer.from(image.data,'base64'));
 await shell().locator('[data-flow="exit"]').click();await page.waitForTimeout(1600);await shell().locator('.showroom-exit').click();
 await settings.evaluate(()=>new Promise(resolve=>chrome.settingsPrivate.setDefaultZoom(1,resolve)));await settings.close();
 // Compare unchanged page structure and typography with the original tracked HTML.
 const original=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'});
 const baselinePage=await context.newPage();await baselinePage.route('**/baseline.html',route=>route.fulfill({contentType:'text/html',body:original}));
 await baselinePage.goto('http://127.0.0.1:4180/baseline.html',{waitUntil:'networkidle'});
 const fingerprint=async(p)=>p.evaluate(()=>[...document.querySelector('main').querySelectorAll('h1,h2,h3,p,a,button,img')].map(e=>({tag:e.tagName,text:e.textContent.trim(),src:e.getAttribute('src'),href:e.getAttribute('href'),font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color})));
 for(const width of [1440,1280,1024,768,390]) {
  await page.setViewportSize({width,height:900});await baselinePage.setViewportSize({width,height:900});await page.waitForTimeout(700);
  assert(JSON.stringify(await fingerprint(page))===JSON.stringify(await fingerprint(baselinePage)),'Parent content and typography unchanged '+width);
 }
} catch(e){checks.push({pass:false,label:e.message});console.error(e);}
await writeFile(process.env.VISUAL_ONLY?'scripts/integration-visual-results.json':'scripts/integration-extended-results.json',JSON.stringify({checks,cycles},null,2));
console.log(JSON.stringify({checks,cycles},null,2));await browser.close();if(checks.some(c=>!c.pass))process.exitCode=1;
