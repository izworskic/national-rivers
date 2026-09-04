#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT=path.join(process.cwd(),'public');
const ID='G-Y5D2V2W7HN';
const TAG=`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${ID}');
</script>`;
let scanned=0,injected=0,alreadyTagged=0;
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()){await walk(f);continue;}if(!e.isFile()||!e.name.toLowerCase().endsWith('.html'))continue;scanned++;const h=await readFile(f,'utf8');if(h.includes(ID)){alreadyTagged++;continue;}if(!/<\/head>/i.test(h))throw new Error(`Missing </head> in ${path.relative(ROOT,f)}`);await writeFile(f,h.replace(/<\/head>/i,`${TAG}\n</head>`));injected++;}}
await walk(ROOT);
console.log(JSON.stringify({measurementId:ID,scanned,injected,alreadyTagged,root:'public'}));
