import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],failed=[],requests=[],checks=[];
await page.addInitScript(() => {
 for (const target of [window, document]) {
  const records = new Map(); target.__listeners = records;
  const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
  target.addEventListener = (type, callback, options) => { if(!type.startsWith('__playwright') && !String(callback).includes('_hitTargetInterceptor') && !records.has(callback)) records.set(callback,type); return add(type,callback,options); };
  target.removeEventListener = (type, callback, options) => { records.delete(callback); return remove(type,callback,options); };
 }
});
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>requests.push(r.url()));
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
page.on('response',r=>{if(r.status()>=400)failed.push({url:r.url(),status:r.status()});});
const assert=(pass,label,detail)=>{checks.push({pass:!!pass,label,detail});if(!pass)throw Error(label+' '+JSON.stringify(detail));};
const shadow=()=>page.locator('dialog[aria-label="200 Water Street Rooftop Virtual Showroom"]');
const waitReady=()=>shadow().locator('.flow-launch').waitFor({state:'visible',timeout:90000});
try {
 await page.goto('http://127.0.0.1:4180/',{waitUntil:'networkidle',timeout:90000});
 await page.waitForTimeout(3000);
 assert(!requests.some(u=>u.includes('/virtual-showroom/')),'No showroom download before CTA');
 await page.screenshot({path:'scripts/integration-parent.png',fullPage:true});
 await page.evaluate(() => {
   const section=document.getElementById('building-scroll');
   window.scrollTo(0,section.offsetTop+(section.offsetHeight-innerHeight)*0.95);
 });
 await page.waitForTimeout(4000);
 const initialListeners=await page.evaluate(()=>({window:window.__listeners?.size,document:document.__listeners?.size}));
 for(let cycle=0;cycle<3;cycle++) {
  const start=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  await page.evaluate(()=>(()=>{const button=document.getElementById('building-rooftop-entry');button.classList.add('is-visible');button.setAttribute('aria-hidden','false');button.click();})());
  await waitReady();
  await page.waitForTimeout(3000);
  assert(await shadow().locator('canvas.showroom__canvas').count()===1,'One showroom canvas '+cycle);
  assert(await shadow().locator('.flow-panel').count()===1,'One flow panel '+cycle);
  assert(await page.locator('body').evaluate(e=>getComputedStyle(e).overflow)==='hidden','Scroll lock '+cycle);
  if(cycle===0 && !process.env.LIFECYCLE_ONLY) {
   await shadow().locator('canvas.showroom__canvas').focus();
   await page.keyboard.press('ArrowLeft'); await page.keyboard.press('+'); await page.keyboard.press('r');
   await shadow().locator('.flow-launch').click();
   await page.waitForTimeout(1600);
   await shadow().locator('[data-flow="pause"]').click();
   assert(await shadow().locator('[data-flow="pause"]').textContent()==='Resume','Pause works');
   await shadow().locator('[data-flow="pause"]').click();
   await shadow().locator('[data-flow="restart"]').click();
   const names=[];
   for(let i=0;i<6;i++) {
    await page.waitForTimeout(1800);
    names.push(await shadow().locator('.flow-panel h2').textContent());
    if(i===1) { await shadow().locator('[data-flow="previous"]').click();await page.waitForTimeout(1800);await shadow().locator('[data-flow="next"]').click();await page.waitForTimeout(1800); }
    await shadow().locator('[data-flow="next"]').click();
   }
   assert(names.join('|')==='Return Air|Energy Recovery|Exhaust|Fresh Outdoor Air|Heat Pump|Supply Air','Six flow steps',names);
   await page.waitForTimeout(1800);
   await shadow().locator('.equipment-menu summary').click();
   for(const equipment of ['supply','heat-pump']) {
    await shadow().locator(`[data-equipment="${equipment}"]`).click();
    assert(await shadow().locator('.equipment-modal:not(.legal-modal)').evaluate(e=>e.open),'Equipment modal '+equipment);
    await page.keyboard.press('Escape');
   }
   await shadow().locator('.equipment-menu summary').click();
   await shadow().locator('.showroom__legal-link').click();
   assert(await shadow().locator('.legal-modal').evaluate(e=>e.open),'Legal modal');
   const href=await shadow().getByText('View full Third-Party Notices').getAttribute('href');
   assert((await page.request.get(href)).ok(),'Third-party notices available');
   await page.keyboard.press('Escape');
   await page.emulateMedia({reducedMotion:'reduce'});
   await shadow().locator('.flow-launch').click();
   await page.keyboard.press('Escape');await page.waitForTimeout(1700);
   await page.emulateMedia({reducedMotion:'no-preference'});
   for(const width of [1440,1280,1024,768,390]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(500);
    await shadow().locator('.flow-launch').click();await page.waitForTimeout(1600);
    const clipped=await shadow().locator('.showroom-exit, .flow-panel button, .showroom__legal-link').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.left<0||r.right>innerWidth+1||r.top<0||r.bottom>innerHeight+1)}).map(e=>e.outerHTML));
    assert(!clipped.length,'Visible controls fit '+width,clipped);
    await page.screenshot({path:`scripts/integration-showroom-${width}.png`});
    await shadow().locator('[data-flow="exit"]').click();await page.waitForTimeout(1600);
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForTimeout(800);
  await shadow().locator('.showroom-exit').click();
  await page.waitForTimeout(500);
  assert(await shadow().count()===0,'Showroom DOM removed '+cycle);
  assert(await page.evaluate(()=>document.activeElement.id)==='building-rooftop-entry','Focus restored '+cycle,await page.evaluate(()=>({focus:document.activeElement.outerHTML.slice(0,200),entry:document.getElementById('building-rooftop-entry').outerHTML,scroll:scrollY,triggers:ScrollTrigger.getAll().map(t=>({progress:t.progress,start:t.start,end:t.end}))})));
  assert(await page.evaluate(()=>document.body.style.overflow)==='','Scroll unlocked '+cycle);
  const listeners=await page.evaluate(()=>({window:window.__listeners.size,document:document.__listeners.size,details:[...window.__listeners].map(([f,t])=>({type:t,source:String(f).slice(0,200)}))}));
  assert(listeners.window===initialListeners.window && listeners.document===initialListeners.document,'Global listeners return to baseline '+cycle,{initialListeners,listeners});
  const end=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  if(cycle>0) assert(Math.abs(start.y-end.y)<2,'Scroll restored '+cycle,{start,end});
 }
 assert(!requests.some(u=>u.includes('Roof%20Only')||u.includes('rooftop-labels')||u.includes('building-rooftop-mode')),'Old rooftop assets not requested');
 assert(!failed.filter(x=>x.url.includes('127.0.0.1')).length,'No local asset failures',failed);
 assert(!errors.length,'No page errors',errors);
} catch(e) { checks.push({pass:false,label:e.message}); console.error(e); }
await writeFile('scripts/integration-qa-results.json',JSON.stringify({checks,errors,failed,origins:[...new Set(requests.map(u=>new URL(u).origin))],showroomRequests:requests.filter(u=>u.includes('/virtual-showroom/')).length},null,2));
console.log(JSON.stringify({checks,errors,failed},null,2));
await browser.close();
if(checks.some(c=>!c.pass))process.exitCode=1;
