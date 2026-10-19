import {chromium} from 'playwright';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
const profile=await mkdtemp(path.join(tmpdir(),'ruhl-zoom-'));
const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:null,args:['--window-size=1440,1000']});
const p=await c.newPage();await p.goto('chrome://settings/',{waitUntil:'domcontentloaded'});console.log(await p.evaluate(()=>({api:typeof chrome.settingsPrivate?.setDefaultZoom})));await c.close();
