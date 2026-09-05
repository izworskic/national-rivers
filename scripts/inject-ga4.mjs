#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'public');
const MEASUREMENT_ID = 'G-Y5D2V2W7HN';
const ADSENSE_PUBLISHER_ID = 'ca-pub-8222782620788075';
const GA4_TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${MEASUREMENT_ID}');
</script>`;
const ADSENSE_TAG = `<meta name="google-adsense-account" content="${ADSENSE_PUBLISHER_ID}">`;

let scanned = 0;
let ga4Injected = 0;
let ga4AlreadyTagged = 0;
let adsenseInjected = 0;
let adsenseAlreadyTagged = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;
    scanned += 1;
    const html = await readFile(fullPath, 'utf8');
    const needsGa4 = !html.includes(MEASUREMENT_ID);
    const needsAdsense = !html.includes(ADSENSE_PUBLISHER_ID);

    if (!needsGa4) ga4AlreadyTagged += 1;
    if (!needsAdsense) adsenseAlreadyTagged += 1;
    if (!needsGa4 && !needsAdsense) continue;

    if (!/<\/head>/i.test(html)) {
      throw new Error(`Cannot inject site tags: missing </head> in ${path.relative(ROOT, fullPath)}`);
    }

    const tags = [];
    if (needsGa4) {
      tags.push(GA4_TAG);
      ga4Injected += 1;
    }
    if (needsAdsense) {
      tags.push(ADSENSE_TAG);
      adsenseInjected += 1;
    }

    await writeFile(fullPath, html.replace(/<\/head>/i, `${tags.join('\n')}\n</head>`));
  }
}

await walk(ROOT);
console.log(JSON.stringify({
  measurementId: MEASUREMENT_ID,
  adsensePublisherId: ADSENSE_PUBLISHER_ID,
  scanned,
  ga4Injected,
  ga4AlreadyTagged,
  adsenseInjected,
  adsenseAlreadyTagged,
  root: 'public',
}));
