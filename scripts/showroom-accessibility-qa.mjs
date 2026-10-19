import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}), checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const assert=(pass,label,detail)=>{checks.push({pass:!!pass,label,detail});if(!pass)throw Error(label+' '+JSON.stringify(detail));};
const base=path.resolve('dist');
await page.route('http://127.0.0.1:4180/200-water/**',async route=>{
 const name=decodeURIComponent(new URL(route.request().url()).pathname.slice('/200-water/'.length))||'index.html';
 const file=path.resolve(base,name);if(!file.startsWith(base+path.sep))return route.abort();
 const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.txt':'text/plain','.gltf':'model/gltf+json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream';
 try {let body=await readFile(file);if(name==='virtual-showroom/mount.js')body=Buffer.from(body.toString().replace('const showroom = await launchShowroom({ root });','const showroom = await launchShowroom({ root }); window.__qaShowroom=showroom;'));await route.fulfill({body,contentType:type});}catch{await route.fulfill({status:404,body:'missing'});}
});
const host=()=>page.locator('dialog[aria-label="200 Water Street Rooftop Virtual Showroom"]');
try {
 await page.goto('http://127.0.0.1:4180/200-water/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{const s=document.getElementById('building-scroll');scrollTo({top:s.offsetTop+(s.offsetHeight-innerHeight)*.95,behavior:'instant'})});await page.waitForTimeout(2500);
 await page.locator('#building-rooftop-entry').waitFor({state:'visible',timeout:15000});await page.locator('#building-rooftop-entry').focus();await page.keyboard.press('Enter');await host().locator('.flow-launch').waitFor({timeout:90000});await page.waitForTimeout(3500);
 const position=()=>page.evaluate(()=>__qaShowroom.camera.position.toArray());
 const a=await position();await page.keyboard.press('ArrowLeft');const b=await position();await page.keyboard.press('+');const c=await position();await page.keyboard.press('r');const d=await position();
 assert(JSON.stringify(a)!==JSON.stringify(b)&&JSON.stringify(b)!==JSON.stringify(c),'Keyboard rotates and zooms');
 assert(d.every((v,i)=>Math.abs(v-a[i])<.02),'Keyboard reset restores camera');
 await page.mouse.move(800,300);await page.mouse.down();await page.mouse.move(920,350,{steps:10});await page.mouse.up();await page.waitForTimeout(350);
 assert(JSON.stringify(await position())!==JSON.stringify(d),'OrbitControls drag changes camera');
 await host().locator('canvas.showroom__canvas').focus();await page.keyboard.press('r');
 assert(await page.evaluate(()=>!!__qaShowroom.scene.getObjectByName('cityContext')),'Progressive city loads under subdirectory');
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement===document.body||!!document.activeElement.closest('dialog[aria-label="200 Water Street Rooftop Virtual Showroom"]')),'Parent excluded from modal tab order');}
 const axe=await readFile('D:/RUHL realm/RUHL May 2026/Virtual showroom/Rooftop Virtual Showroom/docs/axe-qa.tmp.js','utf8');
 await page.evaluate(axe);
 const scan=async()=>page.evaluate(()=>axe.run(document.querySelector('dialog[aria-label="200 Water Street Rooftop Virtual Showroom"]'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))));
 assert(!(await scan()).length,'Integrated showroom WCAG scan',await scan());
 await host().locator('.flow-launch').focus();await page.keyboard.press('Enter');await page.waitForTimeout(1800);
 assert(!(await scan()).length,'Flow WCAG scan',await scan());
 assert(await host().locator('[data-flow="pause"]').evaluate(e=>e.getRootNode().activeElement===e),'Flow receives keyboard focus');
 await page.keyboard.press('Enter');assert(await host().locator('[data-flow="pause"]').textContent()==='Resume','Keyboard pauses');await page.keyboard.press('Enter');
 await page.keyboard.press('Escape');await page.waitForTimeout(1600);assert(await host().count()===1,'Escape exits flow and preserves showroom');
 await host().locator('.showroom__legal-link').focus();await page.keyboard.press('Enter');
 assert(await host().locator('.legal-modal').evaluate(e=>e.open),'Legal opens from keyboard');
 assert(!(await scan()).length,'Legal WCAG scan',await scan());
 await page.keyboard.press('Escape');
 // Headless Chrome keeps all tabs visible; exercise the native visibility handler directly.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const before=await page.evaluate(()=>__qaShowroom.renderer.info.render.frame);await page.waitForTimeout(500);const after=await page.evaluate(()=>__qaShowroom.renderer.info.render.frame);
 assert(before===after,'Hidden-tab visibility handler stops rendering',{before,after});
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(500);
 assert(await page.evaluate(()=>__qaShowroom.renderer.info.render.frame)>after,'Visible-tab visibility handler resumes rendering');
 await page.screenshot({path:'scripts/integration-subdirectory.png'});
 await page.keyboard.press('Escape');await page.waitForTimeout(500);assert(await host().count()===0,'Escape closes idle showroom');
 assert(await page.evaluate(()=>document.activeElement.id)==='building-rooftop-entry','Keyboard close restores CTA focus');
 assert(!errors.length,'No subdirectory page errors',errors);
}catch(e){checks.push({pass:false,label:e.message,debug:await page.evaluate(()=>({entry:document.getElementById('building-rooftop-entry')?.outerHTML,focus:document.activeElement.outerHTML.slice(0,300),scroll:scrollY,dialog:document.querySelector('dialog')?.outerHTML.slice(0,500),shadow:document.querySelector('.showroom-surface')?.shadowRoot?.innerHTML.slice(-800)}))});console.error(e);}
await writeFile('scripts/integration-accessibility-results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();if(checks.some(c=>!c.pass))process.exitCode=1;
