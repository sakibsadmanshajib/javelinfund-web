// Walk a few pages on the deployed site and report any image that fails to load.
import { chromium } from '@playwright/test';

const SITE = 'https://javelinfund-web.sakibsadmanshajib.workers.dev';
const pages = [
  '/',
  '/about',
  '/stories',
  '/team',
  '/donate',
  '/contact',
  '/stories/meet-marie-carline',
];

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const all404 = [];
const allOK = [];

for (const path of pages) {
  const url = `${SITE}${path}`;
  const broken = [];
  const seen = new Set();
  page.removeAllListeners('response');
  page.on('response', async (resp) => {
    const u = resp.url();
    if (seen.has(u)) return;
    if (!/\.(webp|avif|jpg|jpeg|png|svg|gif)(\?|$)/i.test(u)) return;
    seen.add(u);
    if (resp.status() >= 400) broken.push({ status: resp.status(), url: u });
  });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (e) {
    broken.push({ status: 'GOTO_FAIL', url: e.message });
  }
  // Also check for <img> tags that ended up with naturalWidth 0 (loaded but invalid)
  const broken_imgs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    return imgs
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => ({ src: i.currentSrc || i.src, alt: i.alt }));
  });
  if (broken.length || broken_imgs.length) {
    all404.push({ path, broken, broken_imgs });
  } else {
    allOK.push(path);
  }
}

console.log('=== PAGES WITH BROKEN IMAGES ===');
console.log(JSON.stringify(all404, null, 2));
console.log('=== PAGES OK ===');
console.log(allOK.join(', '));

await browser.close();
