// Wait for the new build to emit pre-baked image URLs (no /_image), then
// re-scan a few pages for broken images.
import { chromium } from '@playwright/test';

const SITE = 'https://javelinfund-web.sakibsadmanshajib.workers.dev';

async function waitForFreshBuild() {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${SITE}/team`, { cache: 'no-store' });
    const t = await r.text();
    const hasImageEndpoint = t.includes('_image?');
    if (!hasImageEndpoint) {
      console.log(`fresh build live after try ${i + 1}`);
      return true;
    }
    console.log(`try ${i + 1}: still old build (_image present)`);
    await new Promise((s) => setTimeout(s, 10_000));
  }
  return false;
}

async function check() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const pages = ['/', '/team', '/stories', '/stories/meet-marie-carline'];
  const report = [];

  for (const p of pages) {
    page.removeAllListeners('response');
    const failed = [];
    const seen = new Set();
    page.on('response', (resp) => {
      const u = resp.url();
      if (seen.has(u)) return;
      if (!/\.(webp|avif|jpg|jpeg|png|svg)(\?|$)/i.test(u)) return;
      seen.add(u);
      if (resp.status() >= 400) failed.push({ status: resp.status(), url: u });
    });
    await page.goto(`${SITE}${p}`, { waitUntil: 'networkidle', timeout: 30_000 });
    const brokenImgs = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt })),
    );
    report.push({ path: p, failed, brokenImgs });
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  const anyFail = report.some((r) => r.failed.length || r.brokenImgs.length);
  process.exit(anyFail ? 2 : 0);
}

const ok = await waitForFreshBuild();
if (!ok) {
  console.log('Build did NOT propagate in 6.5 min — aborting.');
  process.exit(1);
}
await check();
