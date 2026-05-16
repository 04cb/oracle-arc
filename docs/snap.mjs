import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.SNAP_BASE_URL ?? 'http://localhost:3737';
const outDir = '/home/layla/code/arc/docs/screenshots/';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

const targets = [
  { path: '/', name: 'home.png', fullPage: true },
  { path: '/agent/0x48188D27d765559C89ed0969157F8d463b64B14e', name: 'agent.png', fullPage: true },
  { path: '/place/4', name: 'place.png', fullPage: false },
  { path: '/wallet', name: 'wallet.png', fullPage: true },
];

for (const t of targets) {
  console.log(`→ ${base}${t.path}`);
  try {
    await page.goto(base + t.path, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.warn(`   warn: ${e.message.split('\n')[0]}`);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: outDir + t.name,
    fullPage: t.fullPage,
  });
  console.log(`  saved ${t.name}`);
}

await browser.close();
