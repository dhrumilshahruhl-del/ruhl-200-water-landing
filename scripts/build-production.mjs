import { mkdir, rm, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
if (path.resolve(out) !== path.resolve(root, 'dist')) throw Error('Invalid output directory');
await rm(out, {recursive:true, force:true});
await mkdir(out, { recursive: true });
const files = ['index.html','styles.css','main.js','building-scroll.js','model-preload.js','showroom-integration.js'];
for (const file of files) await cp(path.join(root,file),path.join(out,file));
await mkdir(path.join(out,'logos'),{recursive:true});
for(const file of ['200_water.opt.glb','ruhl.jpg','rockrose.png','nyserda.png','dena_logo.png']) {
 await cp(path.join(root,'logos',file),path.join(out,'logos',file));
}
await cp(path.join(root,'virtual-showroom'),path.join(out,'virtual-showroom'),{recursive:true});
// Build into a fresh directory to avoid stale artifacts being deployed.
const runtime = [];
async function walk(dir) { for(const e of await readdir(dir,{withFileTypes:true})) {
 const full=path.join(dir,e.name); if(e.isDirectory()) await walk(full); else runtime.push(path.relative(out,full).replaceAll('\\','/'));
}}
await walk(out);
for(const name of runtime) {
 if(/\.(js|css|html|gltf)$/.test(name)) {
  const text=await readFile(path.join(out,name),'utf8');
  if(/localhost:\d+|[CD]:\\\\Users\\\\|vercel\.app/.test(text)) throw Error('Nonportable runtime path: '+name);
 }
}
await writeFile(path.join(out,'production-files.json'),JSON.stringify(runtime.sort(),null,2)+'\n');
console.log(`Built ${runtime.length} runtime files in dist/`);
