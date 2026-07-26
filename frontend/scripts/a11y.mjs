// Automated accessibility gate: runs axe-core against every built route and
// fails on any WCAG 2.0/2.1/2.2 A or AA violation.
//
// Serves ./out the same way CloudFront does (appending .html to clean paths),
// so what we test is what ships.
//
// IMPORTANT: the page's scroll-reveal animation starts every [data-reveal]
// section at opacity:0, and axe SKIPS invisible elements. Without the
// force-reveal step below this script reports a false pass — that is exactly how
// 15 real contrast violations hid from the first audit. Do not remove it.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const OUT = new URL('../out/', import.meta.url).pathname;
const ROUTES = ['/', '/browse', '/recommend', '/signin', '/privacy', '/terms'];
const PORT = 4178;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml',
};

const server = createServer(async (req, res) => {
  let uri = decodeURIComponent(req.url.split('?')[0]);
  if (uri === '/') uri = '/index.html';
  else if (!extname(uri)) uri += '.html'; // mirrors the CloudFront rewrite
  const file = join(OUT, uri);
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});

await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage();
const axeSource = await readFile(axePath, 'utf8');
let total = 0;

for (const route of ROUTES) {
  await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'networkidle' });
  // See the note at the top: axe ignores opacity:0 nodes. `transition: none` is
  // essential — without it the 0.7s reveal is still in flight when axe samples,
  // and it composites the half-faded text against the background, reporting
  // bogus contrast failures (e.g. #5f6d64 read as #c5c8c0).
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.style.transition = 'none';
      el.classList.add('is-revealed');
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  });
  // Let the style recalc settle before sampling computed colours.
  await page.waitForTimeout(150);
  await page.addScriptTag({ content: axeSource });
  const { violations } = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }),
  );

  if (violations.length === 0) {
    console.log(`PASS  ${route}`);
    continue;
  }
  for (const v of violations) {
    total += v.nodes.length;
    console.error(`FAIL  ${route}  ${v.id} (${v.impact}) x${v.nodes.length}`);
    for (const node of v.nodes.slice(0, 5)) {
      const msg = (node.any[0] ?? node.all[0] ?? node.none[0])?.message ?? v.help;
      console.error(`        ${node.target.join(' ')}\n        ${msg}`);
    }
  }
}

await browser.close();
server.close();

if (total > 0) {
  console.error(`\n${total} accessibility violation(s). See above.`);
  process.exit(1);
}
console.log('\nNo WCAG A/AA violations found.');
