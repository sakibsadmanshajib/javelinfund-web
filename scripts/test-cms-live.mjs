// One-shot live check: wait for CF Pages to rebuild, then open /admin/ in
// headless chromium and verify Decap doesn't show a YAML / config error.
import { chromium } from '@playwright/test';

const SITE = 'https://javelinfund-web.sakibsadmanshajib.workers.dev';
const WANT = "label: 'Featured?'";

async function pollConfig() {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${SITE}/admin/config.yml`, { cache: 'no-store' });
    const t = await r.text();
    if (t.includes(WANT)) {
      console.log(`config propagated after ${i + 1} try(s)`);
      return true;
    }
    console.log(`try ${i + 1}: still old config`);
    await new Promise((s) => setTimeout(s, 10_000));
  }
  return false;
}

async function runBrowser() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console.error: ${m.text()}`);
  });

  await page.goto(`${SITE}/admin/`, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(3000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasYamlError = /YAMLSyntaxError|Error loading the CMS configuration/i.test(bodyText);
  const hasLoginBtn = /Login with GitHub/i.test(bodyText);

  console.log('--- /admin/ test ---');
  console.log('title:', await page.title());
  console.log('hasYamlError:', hasYamlError);
  console.log('hasLoginBtn:', hasLoginBtn);
  console.log('bodyText snippet:', bodyText.slice(0, 400).replace(/\s+/g, ' '));
  if (errs.length) errs.slice(0, 8).forEach((e) => console.log(e));

  await browser.close();
  return hasYamlError ? 2 : 0;
}

const ok = await pollConfig();
if (!ok) {
  console.log('CF did NOT propagate in 6.5 min — aborting');
  process.exit(1);
}
process.exit(await runBrowser());
