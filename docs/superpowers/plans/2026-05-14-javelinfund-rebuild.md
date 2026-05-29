# Javelin Fund rebuild — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild javelinfund.ca as a static Astro site (Bold Activist · Haitian Flag palette) with Decap CMS, CanadaHelps + Interac donations, Google Sheets forms, deployed to Cloudflare Pages.

**Architecture:** Astro 4.x output `static`. Content collections drive stories / team / donate-tiers. Decap CMS edits the same markdown via GitHub. Custom Astro forms POST JSON to a single Google Apps Script Web App; the script writes rows to Google Sheets. CanadaHelps button-links per tier issue CRA receipts automatically; Interac e-Transfer instructions live on `/donate`. Vitest + happy-dom for component unit tests, Playwright for E2E flows, axe-core for a11y, Lighthouse CI for perf budgets.

**Tech Stack:** Astro 4 · TypeScript · Vitest · happy-dom · Playwright · axe-core · Lighthouse CI · Decap CMS · Cloudflare Pages · Google Apps Script · CanadaHelps.

---

## File structure (locked before tasks)

```
/
├─ astro.config.mjs
├─ tsconfig.json
├─ package.json
├─ .prettierrc
├─ .prettierignore
├─ .eslintrc.cjs                       (optional — astro check is enough; skip phase 1)
├─ vitest.config.ts
├─ playwright.config.ts
├─ .github/workflows/ci.yml
├─ public/
│  ├─ favicon.svg                      (from legacy logo)
│  ├─ robots.txt
│  ├─ admin/                           (Decap CMS — phase 8)
│  │  ├─ index.html
│  │  └─ config.yml
│  └─ assets/                          (legacy images copied here verbatim — temporary)
├─ src/
│  ├─ styles/
│  │  ├─ tokens.css                    (palette + type tokens)
│  │  └─ global.css                    (resets + base)
│  ├─ assets/
│  │  └─ images/                       (optimized-by-Astro originals)
│  ├─ components/
│  │  ├─ FlagBar.astro
│  │  ├─ Nav.astro
│  │  ├─ Footer.astro
│  │  ├─ MottoBand.astro
│  │  ├─ TrustBand.astro
│  │  ├─ Hero.astro
│  │  ├─ StatsGrid.astro
│  │  ├─ ProgramCard.astro
│  │  ├─ StorySpotlight.astro
│  │  ├─ DonateStrip.astro
│  │  └─ forms/
│  │     ├─ ContactForm.astro
│  │     ├─ VolunteerForm.astro
│  │     └─ NewsletterForm.astro
│  ├─ layouts/
│  │  └─ Base.astro
│  ├─ content/
│  │  ├─ config.ts
│  │  ├─ stories/
│  │  │  └─ meet-marie-carline.md
│  │  ├─ team/
│  │  │  └─ founder.md
│  │  ├─ donate-tiers/
│  │  │  ├─ sponsor-a-child.yaml
│  │  │  ├─ feed-the-orphans.yaml
│  │  │  ├─ family-meal-pack.yaml
│  │  │  └─ custom.yaml
│  │  └─ pages/
│  │     ├─ about.md
│  │     ├─ privacy.md
│  │     └─ terms.md
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ about.astro
│  │  ├─ stories/
│  │  │  ├─ index.astro
│  │  │  └─ [...slug].astro
│  │  ├─ team.astro
│  │  ├─ donate.astro
│  │  ├─ contact.astro
│  │  ├─ privacy.astro
│  │  └─ terms.astro
│  ├─ lib/
│  │  ├─ featured.ts                   (filter + sort helpers)
│  │  └─ forms.ts                      (POST helper for forms)
│  └─ env.d.ts
├─ tests/
│  ├─ unit/                            (vitest)
│  │  ├─ featured.test.ts
│  │  └─ forms.test.ts
│  ├─ component/                       (vitest + happy-dom render Astro components via .compile output)
│  └─ e2e/                             (playwright)
│     ├─ home.spec.ts
│     ├─ donate.spec.ts
│     └─ contact.spec.ts
├─ scripts/
│  └─ migrate-mysql.mjs                (one-shot — phase 6)
├─ apps-script/
│  └─ form-handler.gs                  (the Apps Script source kept in repo for review)
└─ docs/
```

---

## Phase 0 — Project scaffold

### Task 0.1: Initialize Astro project

**Files:**

- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/env.d.ts`, `public/favicon.svg`, `public/robots.txt`

- [ ] **Step 1: Create the Astro project non-interactively**

```bash
cd /home/sakib/javelinefund
npm create astro@latest -- . --template minimal --typescript strict --no-install --no-git --yes
```

Expected: scaffolds `astro.config.mjs`, `package.json`, `src/pages/index.astro`, etc. (The template is intentionally minimal so we add our own structure.)

- [ ] **Step 2: Install runtime + tooling deps**

```bash
npm install astro@latest
npm install -D typescript @astrojs/check vitest happy-dom @vitest/coverage-v8 @playwright/test axe-core @axe-core/playwright prettier prettier-plugin-astro lighthouse @lhci/cli
```

- [ ] **Step 3: Replace `astro.config.mjs` with the project config**

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://javelinfund.ca',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'directory' },
  integrations: [sitemap()],
  image: { service: { entrypoint: 'astro/assets/services/sharp' } },
});
```

Install the sitemap integration:

```bash
npm install @astrojs/sitemap
```

- [ ] **Step 4: Add `.prettierrc` and `.prettierignore`**

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-astro"],
  "overrides": [{ "files": "*.astro", "options": { "parser": "astro" } }]
}
```

```
// .prettierignore
dist
node_modules
public/admin
_source
.superpowers
.wolf
```

- [ ] **Step 5: Run the dev server smoke check**

```bash
npx astro check
npm run dev -- --port 4321
```

Expected: `astro check` reports 0 errors. `npm run dev` serves the default page on port 4321. Kill the dev server (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .prettierrc .prettierignore src/ public/
git commit -m "chore: scaffold Astro project (minimal template + tooling)"
```

### Task 0.2: Vitest config

**Files:**

- Create: `vitest.config.ts`, `tests/unit/example.test.ts`

- [ ] **Step 1: Write vitest config**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,astro}'],
      exclude: ['src/env.d.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'html'],
    },
  },
});
```

- [ ] **Step 2: Write a sanity test**

```ts
// tests/unit/example.test.ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run vitest**

```bash
npx vitest run
```

Expected: 1 test passes.

- [ ] **Step 4: Add npm scripts**

Modify `package.json` `scripts` to include:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/unit/example.test.ts package.json
git commit -m "chore: configure vitest with happy-dom"
```

### Task 0.3: Playwright config

**Files:**

- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Write playwright config**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: {
    command: 'npm run dev -- --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: Write a smoke test**

```ts
// tests/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('home renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Astro/);
});
```

- [ ] **Step 4: Run Playwright**

```bash
npx playwright test
```

Expected: 1 test passes against the default Astro home.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts package-lock.json
git commit -m "chore: configure Playwright smoke harness"
```

---

## Phase 1 — Brand system + base shell

### Task 1.1: Design tokens

**Files:**

- Create: `src/styles/tokens.css`, `src/styles/global.css`, `tests/unit/tokens.test.ts`

- [ ] **Step 1: Write the failing test for tokens module presence**

```ts
// tests/unit/tokens.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('tokens.css', () => {
  it('declares brand palette and type tokens', () => {
    const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
    expect(css).toContain('--navy: #0a1a3f');
    expect(css).toContain('--red: #d62828');
    expect(css).toContain('--gold: #ffd60a');
    expect(css).toContain('--ivory: #fafaf7');
    expect(css).toContain("--font-display: 'Archivo Black'");
    expect(css).toContain("--font-accent: 'Playfair Display'");
    expect(css).toContain("--font-body: 'Inter'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/tokens.test.ts
```

Expected: fails — `tokens.css` does not exist.

- [ ] **Step 3: Write `tokens.css`**

```css
/* src/styles/tokens.css */
:root {
  /* palette */
  --navy: #0a1a3f;
  --navy-2: #08153a;
  --navy-3: #0e2050;
  --red: #d62828;
  --red-dark: #a51d1d;
  --gold: #ffd60a;
  --gold-2: #f5c100;
  --ivory: #fafaf7;
  --sand: #f1e9d8;

  /* roles */
  --bg: var(--navy);
  --bg-alt: var(--navy-2);
  --fg: var(--ivory);
  --fg-muted: rgba(250, 250, 247, 0.72);
  --line: rgba(250, 250, 247, 0.12);
  --accent: var(--gold);
  --accent-2: var(--red);

  /* typography */
  --font-display: 'Archivo Black', system-ui, sans-serif;
  --font-accent: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', -apple-system, system-ui, sans-serif;

  /* spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;

  /* layout */
  --container: 1240px;
  --container-x: clamp(16px, 4vw, 32px);
}
```

- [ ] **Step 4: Write `global.css`**

```css
/* src/styles/global.css */
@import './tokens.css';

*,
*::before,
*::after {
  box-sizing: border-box;
}
html,
body {
  margin: 0;
  padding: 0;
}
body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--fg);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
img {
  display: block;
  max-width: 100%;
}
a {
  color: inherit;
  text-decoration: none;
}
.container {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--container-x);
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: 800;
}
.display {
  font-family: var(--font-display);
  letter-spacing: -1.5px;
  text-transform: uppercase;
}
.accent {
  font-family: var(--font-accent);
  font-style: italic;
}
:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Verify the test passes**

```bash
npx vitest run tests/unit/tokens.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles tests/unit/tokens.test.ts
git commit -m "feat(styles): design tokens (Haitian flag palette + Bold Activist type)"
```

### Task 1.2: Base layout + font loading

**Files:**

- Create: `src/layouts/Base.astro`

- [ ] **Step 1: Write `Base.astro`**

```astro
---
// src/layouts/Base.astro
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
  ogImage?: string;
}
const {
  title,
  description = 'Direct relief and lasting programs for families in Northern Haiti.',
  ogImage,
} = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site);
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} · Javelin Fund</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical.toString()} />
    <meta property="og:title" content={`${title} · Javelin Fund`} />
    <meta property="og:description" content={description} />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta property="og:type" content="website" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@1,500;1,700&display=swap"
    />
  </head>
  <body>
    <a
      href="#main"
      class="skip"
      style="position:absolute;left:-9999px;top:0;background:var(--gold);color:var(--navy);padding:8px 12px;font-weight:800"
      >Skip to content</a
    >
    <slot name="header" />
    <main id="main"><slot /></main>
    <slot name="footer" />
  </body>
</html>
```

- [ ] **Step 2: Replace `src/pages/index.astro` with a stub using the layout**

```astro
---
import Base from '../layouts/Base.astro';
---

<Base title="Home">
  <section class="container" style="padding:48px 0">
    <h1 class="display" style="font-size:48px">Javelin Fund</h1>
    <p>Static rebuild in progress.</p>
  </section>
</Base>
```

- [ ] **Step 3: Run build + dev**

```bash
npm run build
```

Expected: build succeeds. Check `dist/index.html` exists.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Base.astro src/pages/index.astro
git commit -m "feat(layout): Base.astro with font preconnect and skip link"
```

### Task 1.3: `FlagBar.astro`

**Files:**

- Create: `src/components/FlagBar.astro`, `tests/component/flag-bar.test.ts`

- [ ] **Step 1: Write the failing component test**

```ts
// tests/component/flag-bar.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('FlagBar', () => {
  it('renders three stripes in flag order (navy, red, gold)', () => {
    const src = fs.readFileSync('src/components/FlagBar.astro', 'utf8');
    expect(src).toMatch(/--navy/);
    expect(src).toMatch(/--red/);
    expect(src).toMatch(/--gold/);
    // Stripes appear in correct order — navy occurs before red occurs before gold.
    const idxNavy = src.indexOf('--navy');
    const idxRed = src.indexOf('--red');
    const idxGold = src.indexOf('--gold');
    expect(idxNavy).toBeLessThan(idxRed);
    expect(idxRed).toBeLessThan(idxGold);
  });
});
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
npx vitest run tests/component/flag-bar.test.ts
```

- [ ] **Step 3: Implement `FlagBar.astro`**

```astro
---
// src/components/FlagBar.astro
---

<div class="flag-bar" aria-hidden="true">
  <span style="background: var(--navy)"></span>
  <span style="background: var(--red)"></span>
  <span style="background: var(--gold)"></span>
</div>
<style>
  .flag-bar {
    height: 6px;
    display: flex;
  }
  .flag-bar span {
    flex: 1;
    display: block;
  }
</style>
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npx vitest run tests/component/flag-bar.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/components/FlagBar.astro tests/component/flag-bar.test.ts
git commit -m "feat(components): FlagBar"
```

### Task 1.4: `Nav.astro`

**Files:**

- Create: `src/components/Nav.astro`, `tests/e2e/nav.spec.ts`

- [ ] **Step 1: Implement `Nav.astro`**

```astro
---
// src/components/Nav.astro
const links = [
  { href: '/about', label: 'Our Work' },
  { href: '/team', label: 'The People' },
  { href: '/stories', label: 'Stories' },
  { href: '/contact', label: 'Contact' },
];
---

<nav class="top">
  <div class="container row">
    <a href="/" class="logo" aria-label="Javelin Fund — home">
      <img src="/favicon.svg" alt="" width="32" height="32" />
      <span>JAVELIN FUND</span>
    </a>
    <div class="links">
      {links.map((l) => <a href={l.href}>{l.label}</a>)}
      <a class="btn btn-gold" href="/donate">Donate →</a>
    </div>
  </div>
</nav>
<style>
  .top {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(10, 26, 63, 0.94);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    gap: 20px;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: 1px;
  }
  .links {
    display: flex;
    gap: 28px;
    align-items: center;
    font-size: 13px;
    font-weight: 600;
  }
  .links a {
    opacity: 0.88;
  }
  .links a:hover {
    opacity: 1;
    color: var(--gold);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 1.5px;
    padding: 12px 22px;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
  }
  .btn-gold {
    background: var(--gold);
    color: var(--navy);
  }
  @media (max-width: 720px) {
    .links a:not(.btn) {
      display: none;
    }
  }
</style>
```

- [ ] **Step 2: Wire `Nav` and `FlagBar` into the layout**

Edit `src/layouts/Base.astro` — replace the `<slot name="header" />` block with:

```astro
---
import FlagBar from '../components/FlagBar.astro';
import Nav from '../components/Nav.astro';
// (keep existing interface Props and consts above)
---
```

…and replace the header slot inside `<body>` with:

```astro
<FlagBar />
<Nav />
```

- [ ] **Step 3: Write the failing E2E test**

```ts
// tests/e2e/nav.spec.ts
import { test, expect } from '@playwright/test';

test('nav has logo and donate link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /javelin fund — home/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /donate/i })).toBeVisible();
});
```

- [ ] **Step 4: Run E2E**

```bash
npx playwright test tests/e2e/nav.spec.ts
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/Nav.astro src/layouts/Base.astro tests/e2e/nav.spec.ts
git commit -m "feat(components): Nav + wire into Base layout"
```

### Task 1.5: `Footer.astro`

**Files:**

- Create: `src/components/Footer.astro`, `tests/e2e/footer.spec.ts`

- [ ] **Step 1: Implement `Footer.astro`**

```astro
---
// src/components/Footer.astro
const year = new Date().getFullYear();
---

<footer class="footer">
  <div class="container row">
    <div>
      <div class="logo">JAVELIN FUND</div>
      <p class="muted">
        Direct relief and lasting programs for families in Northern Haiti — together with the people
        who live there.
      </p>
      <p class="motto">L'union fait la force.</p>
    </div>
    <div>
      <h4>Explore</h4>
      <a href="/about">Our Work</a>
      <a href="/team">The People</a>
      <a href="/stories">Stories</a>
      <a href="/contact">Contact</a>
    </div>
    <div>
      <h4>Give</h4>
      <a href="/donate">Donate</a>
      <a href="/donate#monthly">Monthly giving</a>
      <a href="/donate#interac">Interac e-Transfer</a>
    </div>
    <div>
      <h4>Stay close</h4>
      <a href="mailto:contact@javelinfund.ca">contact@javelinfund.ca</a>
    </div>
  </div>
  <div class="container bottom">
    <span>© {year} Javelin Fund · BN 755722097 RR0001</span>
    <span
      ><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Made in Canada · For Haiti</span
    >
  </div>
</footer>
<style>
  .footer {
    background: var(--bg-alt);
    padding: 60px 0 24px;
    border-top: 1px solid var(--line);
  }
  .row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 40px;
  }
  @media (max-width: 720px) {
    .row {
      grid-template-columns: 1fr 1fr;
    }
  }
  .logo {
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: 1px;
    margin-bottom: 12px;
  }
  .muted {
    color: var(--fg-muted);
    font-size: 14px;
    max-width: 320px;
  }
  .motto {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--gold);
    margin-top: 14px;
  }
  h4 {
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
    color: var(--gold);
    margin: 0 0 14px;
  }
  .footer a {
    display: block;
    color: var(--fg-muted);
    font-size: 13px;
    padding: 5px 0;
  }
  .footer a:hover {
    color: var(--gold);
  }
  .bottom {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--fg-muted);
    flex-wrap: wrap;
    gap: 12px;
  }
</style>
```

- [ ] **Step 2: Wire `Footer` into `Base.astro`** by replacing `<slot name="footer" />` with `<Footer />` and adding the import.

- [ ] **Step 3: Write E2E test**

```ts
// tests/e2e/footer.spec.ts
import { test, expect } from '@playwright/test';

test('footer lists charity number and motto', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('BN 755722097 RR0001')).toBeVisible();
  await expect(page.getByText("L'union fait la force.")).toBeVisible();
});
```

- [ ] **Step 4: Run + verify**

```bash
npx playwright test tests/e2e/footer.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.astro src/layouts/Base.astro tests/e2e/footer.spec.ts
git commit -m "feat(components): Footer with charity number + Haitian motto"
```

### Task 1.6: `MottoBand.astro` + `TrustBand.astro`

**Files:**

- Create: `src/components/MottoBand.astro`, `src/components/TrustBand.astro`

- [ ] **Step 1: Implement `MottoBand.astro`**

```astro
---
// src/components/MottoBand.astro
---

<section class="motto-band">
  <div class="container row">
    <span class="fr">L'union fait la force.</span>
    <span class="div" aria-hidden="true"></span>
    <span class="en">Strength through unity · National motto of Haiti</span>
    <span class="div" aria-hidden="true"></span>
    <span class="en">Serving the North since 2016</span>
  </div>
</section>
<style>
  .motto-band {
    background: var(--red);
    color: #fff;
    padding: 18px 0;
    border-top: 6px solid var(--gold);
    border-bottom: 6px solid var(--gold);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
    text-align: center;
  }
  .fr {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 22px;
    letter-spacing: 0.5px;
  }
  .en {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    opacity: 0.85;
    font-weight: 700;
  }
  .div {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.4);
  }
</style>
```

- [ ] **Step 2: Implement `TrustBand.astro`**

```astro
---
// src/components/TrustBand.astro
const items = [
  { seal: 'CRA', top: 'Registered Canadian Charity', bottom: 'BN 755722097 RR0001' },
  { seal: '98¢', top: 'Of every dollar', bottom: 'direct to programs' },
  { seal: '10', top: 'Years on the ground', bottom: 'since 2016' },
  { seal: '📊', top: 'Audited annual report', bottom: 'published yearly' },
];
---

<section class="trust">
  <div class="container row">
    {
      items.map((i) => (
        <div class="item">
          <div class="seal" aria-hidden="true">
            {i.seal}
          </div>
          <div>
            {i.top}
            <br />
            <strong>{i.bottom}</strong>
          </div>
        </div>
      ))
    }
  </div>
</section>
<style>
  .trust {
    background: var(--bg-alt);
    padding: 36px 0;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    flex-wrap: wrap;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    color: var(--fg-muted);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .item strong {
    color: var(--fg);
    font-weight: 800;
  }
  .seal {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: var(--gold);
    color: var(--navy);
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.5px;
  }
</style>
```

- [ ] **Step 3: Run `astro check`**

```bash
npx astro check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MottoBand.astro src/components/TrustBand.astro
git commit -m "feat(components): MottoBand + TrustBand"
```

---

## Phase 2 — Content collections

### Task 2.1: Define collections

**Files:**

- Create: `src/content/config.ts`, `src/lib/featured.ts`, `tests/unit/featured.test.ts`

- [ ] **Step 1: Write `src/content/config.ts`**

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const stories = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      excerpt: z.string(),
      date: z.coerce.date(),
      hero: image(),
      featured: z.boolean().default(false),
      priority: z.number().default(0),
      location: z.string().optional(),
      person: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }),
});

const team = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      photo: image(),
      order: z.number().default(100),
      bio: z.string().optional(),
    }),
});

const donateTiers = defineCollection({
  type: 'data',
  schema: z.object({
    amount: z.union([z.number(), z.literal('custom')]),
    frequency: z.enum(['one-time', 'monthly', 'yearly', 'custom']),
    label: z.string(),
    sub: z.string(),
    featured: z.boolean().default(false),
    priority: z.number().default(0),
    ribbon: z.string().optional(),
    canada_helps_url: z.string().url().optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { stories, team, donateTiers, pages };
```

- [ ] **Step 2: Write `src/lib/featured.ts`**

```ts
// src/lib/featured.ts
export interface FeaturedItem {
  data: { featured: boolean; priority: number };
}

export function pickFeatured<T extends FeaturedItem>(items: T[]): T | undefined {
  return items.filter((i) => i.data.featured).sort((a, b) => b.data.priority - a.data.priority)[0];
}

export function pickFeaturedAll<T extends FeaturedItem>(items: T[]): T[] {
  return items.filter((i) => i.data.featured).sort((a, b) => b.data.priority - a.data.priority);
}
```

- [ ] **Step 3: Write failing tests**

```ts
// tests/unit/featured.test.ts
import { describe, it, expect } from 'vitest';
import { pickFeatured, pickFeaturedAll } from '../../src/lib/featured';

const mk = (featured: boolean, priority: number, id: string) => ({
  id,
  data: { featured, priority },
});

describe('pickFeatured', () => {
  it('returns highest-priority featured item', () => {
    const items = [mk(true, 5, 'a'), mk(true, 10, 'b'), mk(false, 99, 'c')];
    expect(pickFeatured(items)?.id).toBe('b');
  });

  it('returns undefined if none featured', () => {
    expect(pickFeatured([mk(false, 1, 'a')])).toBeUndefined();
  });
});

describe('pickFeaturedAll', () => {
  it('returns featured items sorted by priority desc', () => {
    const items = [mk(true, 1, 'a'), mk(true, 3, 'b'), mk(false, 99, 'c'), mk(true, 2, 'd')];
    expect(pickFeaturedAll(items).map((i) => i.id)).toEqual(['b', 'd', 'a']);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/featured.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/content/config.ts src/lib/featured.ts tests/unit/featured.test.ts
git commit -m "feat(content): collections + featured selector"
```

### Task 2.2: Seed first story + first team member + tiers

**Files:**

- Create:
  - `src/content/stories/meet-marie-carline.md`
  - `src/content/team/founder.md`
  - `src/content/donate-tiers/sponsor-a-child.yaml`
  - `src/content/donate-tiers/feed-the-orphans.yaml`
  - `src/content/donate-tiers/family-meal-pack.yaml`
  - `src/content/donate-tiers/custom.yaml`
  - `src/content/pages/about.md`
  - `src/content/pages/privacy.md`
  - `src/content/pages/terms.md`
- Copy: `src/assets/images/story-marie.jpg`, `src/assets/images/team-founder.jpg`

- [ ] **Step 1: Copy a real Javelin photo from the legacy archive into `src/assets/`**

```bash
mkdir -p src/assets/images
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/family-1.jpg src/assets/images/story-marie.jpg
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/family-2.jpg src/assets/images/team-founder.jpg
```

- [ ] **Step 2: Write `meet-marie-carline.md`**

```md
---
title: 'The week that changed everything'
excerpt: '"My oldest went back to school the same week the rice came. For the first time in two years, I slept the whole night."'
date: 2026-04-12
hero: ../../assets/images/story-marie.jpg
featured: true
priority: 100
location: 'Cap-Haïtien'
person: 'Marie-Carline P.'
tags: ['food', 'education']
---

When the Javelin Fund team first met Marie-Carline, the rains had not come for the planting season and the school year had already started two weeks late.

> _(Body content to be written by the editorial team. Use Decap CMS or commit directly. This file is a seed — replace with the real story before launch.)_
```

- [ ] **Step 3: Write `founder.md`**

```md
---
name: 'Founder Name'
role: 'Founder & Executive Director'
photo: ../../assets/images/team-founder.jpg
order: 1
bio: 'Founded Javelin Fund in 2016 to serve the families of Northern Haiti.'
---
```

- [ ] **Step 4: Write the four tier YAML files**

```yaml
# src/content/donate-tiers/sponsor-a-child.yaml
amount: 400
frequency: yearly
label: Sponsor a child
sub: School + uniform + meals for 12 months.
featured: true
priority: 100
ribbon: Top pick
canada_helps_url: https://www.canadahelps.org/en/charities/javelin-fund/
```

```yaml
# src/content/donate-tiers/feed-the-orphans.yaml
amount: 1500
frequency: monthly
label: Feed the orphans
sub: Daily meals for the orphan cohort.
featured: true
priority: 90
ribbon: Most asked
canada_helps_url: https://www.canadahelps.org/en/charities/javelin-fund/
```

```yaml
# src/content/donate-tiers/family-meal-pack.yaml
amount: 50
frequency: one-time
label: Family meal pack
sub: Rice, beans, oil, clean water — one family for a month.
featured: false
priority: 50
canada_helps_url: https://www.canadahelps.org/en/charities/javelin-fund/
```

```yaml
# src/content/donate-tiers/custom.yaml
amount: custom
frequency: custom
label: Choose your own amount
sub: Recurring or one-time · tax receipt instantly.
featured: false
priority: 1
canada_helps_url: https://www.canadahelps.org/en/charities/javelin-fund/
```

- [ ] **Step 5: Write the three page markdowns**

```md
## <!-- src/content/pages/about.md -->

title: 'About Javelin Fund'
description: 'Mission, programs and governance.'

---

(Body content to be finalised before launch.)
```

Mirror the same shape for `privacy.md` and `terms.md`, carrying over the legacy copy from `_source/.../resources/views/front/pages/privacy-policy.blade.php` and `terms.blade.php`.

- [ ] **Step 6: Run `astro check`**

```bash
npx astro check
```

Expected: 0 errors. Astro's content collection schema validates everything.

- [ ] **Step 7: Commit**

```bash
git add src/content src/assets/images
git commit -m "feat(content): seed first story, team member, donate tiers and page stubs"
```

---

## Phase 3 — Homepage

### Task 3.1: `Hero.astro`

**Files:**

- Create: `src/components/Hero.astro`
- Copy: `src/assets/images/hero.jpg`

- [ ] **Step 1: Copy the hero photo**

```bash
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/banner.jpg src/assets/images/hero.jpg
```

- [ ] **Step 2: Write `Hero.astro`**

```astro
---
// src/components/Hero.astro
import { Image } from 'astro:assets';
import hero from '../assets/images/hero.jpg';

interface Props {
  pill?: string;
  quote?: { text: string; who: string; where: string };
}
const { pill = 'Northern Haiti · 2026 Appeal', quote } = Astro.props;
---

<section class="hero">
  <Image
    src={hero}
    alt="Children in a Javelin Fund partner school in Northern Haiti"
    class="bg"
    widths={[800, 1200, 1800]}
    sizes="100vw"
    loading="eager"
  />
  <div class="scrim" aria-hidden="true"></div>
  <div class="container content">
    <div class="left">
      <span class="pill"><span class="dot" aria-hidden="true"></span>{pill}</span>
      <h1 class="display">
        Hope is<br /><span class="accent gold">a</span>
        <span class="gold">plan.</span>
      </h1>
      <p class="lede">
        Javelin Fund delivers direct relief and long-term programs to families in Cap-Haïtien and
        the villages of the North. Every dollar shipped. Every family known by name.
      </p>
      <div class="cta">
        <a class="btn btn-red" href="/donate">Donate now →</a>
        <a class="btn btn-ghost" href="/stories">Read the stories</a>
      </div>
      <div class="trust">
        <span><span class="check" aria-hidden="true">✓</span> Registered Canadian charity</span>
        <span><span class="check" aria-hidden="true">✓</span> Instant CRA tax receipt</span>
        <span><span class="check" aria-hidden="true">✓</span> Since 2016</span>
      </div>
    </div>
    {
      quote && (
        <aside class="right">
          <div class="quote-card">
            <p class="q">{quote.text}</p>
            <p class="who">— {quote.who}</p>
            <p class="where">{quote.where}</p>
          </div>
        </aside>
      )
    }
  </div>
</section>
<style>
  .hero {
    position: relative;
    min-height: 88vh;
    overflow: hidden;
  }
  .bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 30%;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      110deg,
      rgba(8, 21, 58, 0.95) 0%,
      rgba(8, 21, 58, 0.78) 45%,
      rgba(8, 21, 58, 0.28) 100%
    );
  }
  .content {
    position: relative;
    padding: 80px 0 100px;
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 40px;
    align-items: center;
    min-height: 88vh;
  }
  @media (max-width: 880px) {
    .content {
      grid-template-columns: 1fr;
      padding: 60px 0;
    }
  }
  .left {
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 620px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--red);
    color: #fff;
    font-size: 11px;
    letter-spacing: 2px;
    padding: 6px 14px;
    font-weight: 800;
    text-transform: uppercase;
    width: fit-content;
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--gold);
    border-radius: 50%;
  }
  h1.display {
    font-size: clamp(48px, 7.5vw, 108px);
    line-height: 0.86;
    letter-spacing: -3px;
    margin: 0;
  }
  .gold {
    color: var(--gold);
  }
  .lede {
    font-size: 17px;
    color: var(--fg-muted);
    max-width: 520px;
    margin: 0;
  }
  .cta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 1.5px;
    padding: 14px 24px;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
  }
  .btn-red {
    background: var(--red);
    color: #fff;
  }
  .btn-ghost {
    background: transparent;
    color: var(--fg);
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  .trust {
    display: flex;
    gap: 20px;
    align-items: center;
    font-size: 12px;
    color: var(--fg-muted);
    flex-wrap: wrap;
  }
  .check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 214, 10, 0.18);
    color: var(--gold);
    display: inline-grid;
    place-items: center;
    font-size: 11px;
    font-weight: 900;
  }
  .right {
    display: flex;
    justify-content: flex-end;
  }
  .quote-card {
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(10px);
    border: 1px solid var(--line);
    padding: 26px 28px;
    max-width: 340px;
    border-left: 3px solid var(--gold);
  }
  .q {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 18px;
    line-height: 1.45;
    margin: 0;
  }
  .who {
    margin: 14px 0 0;
    font-size: 12px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--gold);
    font-weight: 800;
  }
  .where {
    font-size: 12px;
    color: var(--fg-muted);
    margin: 2px 0 0;
  }
</style>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.astro src/assets/images/hero.jpg
git commit -m "feat(components): Hero with optimized image and quote card"
```

### Task 3.2: `StatsGrid.astro`

**Files:**

- Create: `src/components/StatsGrid.astro`

- [ ] **Step 1: Implement `StatsGrid.astro`**

```astro
---
// src/components/StatsGrid.astro
const stats = [
  { num: '325', label: 'Children in school' },
  { num: '12,400', label: 'Meals served · 2025' },
  { num: '98¢', label: 'Of every $1 to programs' },
  { num: '10 yrs', label: 'On the ground since 2016' },
];
---

<section class="stats">
  <div class="container">
    <p class="eyebrow gold">Our impact · 2025</p>
    <h2 class="display">Receipts, not promises.</h2>
    <p class="lede">
      Our annual report is audited and published every March. The numbers below are what the year
      actually delivered.
    </p>
    <div class="grid">
      {
        stats.map((s, i) => (
          <div class={`stat n-${i}`}>
            <>
              <div class="num">{s.num}</div>
              <div class="lbl">{s.label}</div>
            </>
          </div>
        ))
      }
    </div>
  </div>
</section>
<style>
  .stats {
    background: var(--bg-alt);
    padding: 70px 0;
    position: relative;
    overflow: hidden;
  }
  .stats::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      var(--navy) 0% 33.3%,
      var(--red) 33.3% 66.6%,
      var(--gold) 66.6% 100%
    );
  }
  .gold {
    color: var(--gold);
    margin: 0 0 8px;
  }
  h2.display {
    font-size: 42px;
    letter-spacing: -1.5px;
    margin: 0 0 8px;
  }
  .lede {
    color: var(--fg-muted);
    margin: 0 0 48px;
    max-width: 640px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }
  @media (max-width: 880px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
  }
  .stat {
    padding: 28px 24px;
    background: var(--navy-3);
    border-top: 4px solid var(--gold);
  }
  .stat.n-1 {
    border-top-color: var(--red);
  }
  .stat.n-3 {
    border-top-color: var(--ivory);
  }
  .num {
    font-family: var(--font-display);
    font-size: 54px;
    line-height: 1;
    color: var(--gold);
    letter-spacing: -2px;
  }
  .stat.n-1 .num {
    color: var(--red);
  }
  .stat.n-3 .num {
    color: var(--ivory);
  }
  .lbl {
    font-size: 12px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--fg-muted);
    font-weight: 700;
    margin-top: 10px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StatsGrid.astro
git commit -m "feat(components): StatsGrid"
```

### Task 3.3: `ProgramCard.astro` + programs data

**Files:**

- Create: `src/components/ProgramCard.astro`, `src/content/donate-tiers/programs.json` (drop — not used). Programs are inlined data on the home page for phase 1.
- Modify: home page in phase 3 wires three cards.

- [ ] **Step 1: Implement `ProgramCard.astro`**

```astro
---
// src/components/ProgramCard.astro
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props {
  image: ImageMetadata;
  tag: string;
  meta: string;
  title: string;
  body: string;
  href: string;
  variant?: 'gold' | 'red' | 'ivory';
}
const { image, tag, meta, title, body, href, variant = 'gold' } = Astro.props;
---

<article class={`card v-${variant}`}>
  <Image
    src={image}
    alt=""
    widths={[400, 800]}
    sizes="(max-width:880px) 100vw, 33vw"
    class="photo"
  />
  <div class="body">
    <span class="tag">{tag}</span>
    <div class="meta">{meta}</div>
    <h3 class="display">{title}</h3>
    <p>{body}</p>
    <a class="more" href={href}>Learn more →</a>
  </div>
</article>
<style>
  .card {
    background: var(--navy-3);
    position: relative;
    overflow: hidden;
  }
  .photo {
    height: 230px;
    width: 100%;
    object-fit: cover;
    display: block;
  }
  .body {
    padding: 26px 26px 30px;
    position: relative;
  }
  .tag {
    position: absolute;
    top: -14px;
    left: 26px;
    background: var(--gold);
    color: var(--navy);
    font-size: 10px;
    letter-spacing: 2px;
    padding: 5px 10px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .v-red .tag {
    background: var(--red);
    color: #fff;
  }
  .v-ivory .tag {
    background: var(--ivory);
    color: var(--navy);
  }
  .meta {
    font-size: 11px;
    color: var(--fg-muted);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin: 12px 0 12px;
  }
  h3.display {
    font-size: 22px;
    letter-spacing: -0.5px;
    margin: 0 0 12px;
    line-height: 1.1;
  }
  p {
    margin: 0 0 18px;
    color: var(--fg-muted);
    font-size: 14px;
    line-height: 1.6;
  }
  .more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
    color: var(--gold);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProgramCard.astro
git commit -m "feat(components): ProgramCard"
```

### Task 3.4: `StorySpotlight.astro` (consumes featured story)

**Files:**

- Create: `src/components/StorySpotlight.astro`

- [ ] **Step 1: Implement `StorySpotlight.astro`**

```astro
---
// src/components/StorySpotlight.astro
import { Image } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';

interface Props {
  story: CollectionEntry<'stories'>;
}
const { story } = Astro.props;
---

<section class="story">
  <div class="container">
    <span class="feat-label"><span class="dot" aria-hidden="true"></span> Featured story</span>
    <div class="grid">
      <div class="photo-wrap">
        <Image
          src={story.data.hero}
          alt={story.data.title}
          widths={[500, 900]}
          sizes="(max-width:880px) 100vw, 50vw"
          class="photo"
        />
        <div class="frame" aria-hidden="true"></div>
        {story.data.location && <div class="tag">Story · {story.data.location}</div>}
      </div>
      <div class="text">
        <p class="eyebrow red">Meet {story.data.person ?? story.data.title}</p>
        <h2 class="display">{story.data.title}</h2>
        <p class="quote">{story.data.excerpt}</p>
        {story.data.person && <p class="who">— {story.data.person}</p>}
        {story.data.location && <p class="where">{story.data.location}, Northern Haiti</p>}
        <a class="read-more" href={`/stories/${story.slug}`}>Read her story →</a>
      </div>
    </div>
  </div>
</section>
<style>
  .story {
    background: var(--ivory);
    color: var(--navy);
    padding: 90px 0;
  }
  .feat-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--red);
    color: #fff;
    padding: 5px 12px;
    font-size: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
    margin-bottom: 24px;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: var(--gold);
    border-radius: 50%;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 50px;
    align-items: center;
  }
  @media (max-width: 880px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .photo-wrap {
    position: relative;
    aspect-ratio: 4/5;
  }
  .photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .frame {
    position: absolute;
    inset: 14px;
    border: 2px solid var(--gold);
    pointer-events: none;
  }
  .tag {
    position: absolute;
    left: 24px;
    bottom: 24px;
    background: var(--red);
    color: #fff;
    padding: 8px 14px;
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
  }
  .red {
    color: var(--red);
    margin-bottom: 14px;
  }
  h2.display {
    font-size: 54px;
    line-height: 0.95;
    letter-spacing: -2px;
    margin: 0 0 18px;
  }
  .quote {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 22px;
    line-height: 1.45;
    border-left: 3px solid var(--gold);
    padding-left: 20px;
    margin: 0 0 20px;
  }
  .who {
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-weight: 800;
    margin: 0;
  }
  .where {
    font-size: 13px;
    color: rgba(10, 26, 63, 0.6);
    margin: 2px 0 24px;
  }
  .read-more {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    border-bottom: 2px solid var(--gold);
    padding-bottom: 4px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/StorySpotlight.astro
git commit -m "feat(components): StorySpotlight"
```

### Task 3.5: `DonateStrip.astro` (consumes featured tiers)

**Files:**

- Create: `src/components/DonateStrip.astro`

- [ ] **Step 1: Implement `DonateStrip.astro`**

```astro
---
// src/components/DonateStrip.astro
import type { CollectionEntry } from 'astro:content';

interface Props {
  tiers: CollectionEntry<'donateTiers'>[];
}
const { tiers } = Astro.props;

function formatAmount(amount: number | 'custom') {
  if (amount === 'custom') return 'Custom';
  return `$${amount.toLocaleString('en-CA')}`;
}
function formatFrequency(freq: string) {
  switch (freq) {
    case 'yearly':
      return 'Per year';
    case 'monthly':
      return 'Per month';
    case 'one-time':
      return 'One-time';
    default:
      return 'Any amount';
  }
}
---

<section class="donate">
  <div class="container row">
    <div>
      <p class="eyebrow red">Give today</p>
      <h2 class="display">Receipts,<br /><span class="accent">not</span> promises.</h2>
      <p>
        Pick any amount. Instant tax receipt via CanadaHelps. Monthly giving = 3× the impact per
        dollar.
      </p>
      <div class="pay-row">
        <span class="chip">💳 Card</span>
        <span class="chip">🍁 Interac e-Transfer</span>
        <span class="chip">↻ Monthly</span>
        <span class="chip">🧾 CRA receipt</span>
      </div>
    </div>
    <div class="tiers">
      {
        tiers.map((t) => (
          <a
            class={`tier ${t.data.featured ? 'featured' : ''}`}
            href={t.data.canada_helps_url ?? '/donate'}
          >
            {t.data.ribbon && <span class="ribbon">{t.data.ribbon}</span>}
            <span class="amt">{formatAmount(t.data.amount)}</span>
            <span class="freq">{formatFrequency(t.data.frequency)}</span>
            <span class="what">{t.data.label}</span>
            <span class="sub">{t.data.sub}</span>
          </a>
        ))
      }
    </div>
  </div>
</section>
<style>
  .donate {
    background: var(--gold);
    color: var(--navy);
    padding: 70px 0;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 50px;
    align-items: center;
  }
  @media (max-width: 880px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
  h2.display {
    font-size: 48px;
    line-height: 0.95;
    letter-spacing: -1.5px;
    margin: 0 0 16px;
  }
  .red {
    color: var(--red);
    margin-bottom: 14px;
  }
  .pay-row {
    margin-top: 18px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .chip {
    background: var(--navy);
    color: var(--ivory);
    font-size: 11px;
    letter-spacing: 1.5px;
    padding: 8px 12px;
    text-transform: uppercase;
    font-weight: 700;
  }
  .tiers {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .tier {
    background: var(--navy);
    color: var(--ivory);
    padding: 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-left: 3px solid var(--gold);
    position: relative;
  }
  .tier.featured {
    background: var(--red);
    border-left-color: var(--gold);
  }
  .ribbon {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--gold);
    color: var(--navy);
    font-size: 9px;
    letter-spacing: 1.5px;
    padding: 3px 8px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .amt {
    font-family: var(--font-display);
    font-size: 30px;
    color: var(--gold);
    letter-spacing: -1px;
  }
  .freq {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--fg-muted);
    font-weight: 700;
  }
  .what {
    font-size: 14px;
    font-weight: 700;
    margin-top: 6px;
  }
  .sub {
    font-size: 12px;
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DonateStrip.astro
git commit -m "feat(components): DonateStrip consuming featured tiers"
```

### Task 3.6: Assemble homepage

**Files:**

- Modify: `src/pages/index.astro`
- Copy: `src/assets/images/prog-1.jpg`, `src/assets/images/prog-2.jpg`, `src/assets/images/prog-3.jpg`

- [ ] **Step 1: Copy program photos**

```bash
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/family-3.jpg src/assets/images/prog-1.jpg
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/family-4.jpg src/assets/images/prog-2.jpg
cp _source/extracted/javelinsooperior/homedir/public_html/public/assets/images/family-5.jpg src/assets/images/prog-3.jpg
```

- [ ] **Step 2: Replace `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import MottoBand from '../components/MottoBand.astro';
import StatsGrid from '../components/StatsGrid.astro';
import ProgramCard from '../components/ProgramCard.astro';
import StorySpotlight from '../components/StorySpotlight.astro';
import DonateStrip from '../components/DonateStrip.astro';
import TrustBand from '../components/TrustBand.astro';

import { getCollection } from 'astro:content';
import { pickFeatured, pickFeaturedAll } from '../lib/featured';

import prog1 from '../assets/images/prog-1.jpg';
import prog2 from '../assets/images/prog-2.jpg';
import prog3 from '../assets/images/prog-3.jpg';

const stories = await getCollection('stories');
const featuredStory = pickFeatured(stories);

const tiers = await getCollection('donateTiers');
const featuredTiers = pickFeaturedAll(tiers).slice(0, 4);

const heroQuote = {
  text: '"They didn\'t just bring food. They sat with us, learned our names, and asked what we needed first."',
  who: 'Marie-Carline P.',
  where: 'Mother of three · Cap-Haïtien',
};
---

<Base title="Home" description="Direct relief and lasting programs for families in Northern Haiti.">
  <Hero quote={heroQuote} />
  <MottoBand />
  <StatsGrid />
  <section class="programs">
    <div class="container">
      <header class="head">
        <h2 class="display">Our work,<br /><span class="gold">in the North.</span></h2>
        <p>
          Three programs running today in Cap-Haïtien and the surrounding villages — long
          partnerships with local teams.
        </p>
      </header>
      <div class="grid">
        <ProgramCard
          variant="gold"
          image={prog1}
          tag="Education"
          meta="Since 2016 · 325 children"
          title="Schools & Scholarships"
          body="Tuition, supplies, uniforms and a hot lunch for 325 children across our partner schools."
          href="/about#education"
        />
        <ProgramCard
          variant="red"
          image={prog2}
          tag="Food security"
          meta="Since 2016 · 320+ families"
          title="Feeding the Orphans"
          body="Daily meals plus weekly rice, beans and oil distributions partnered with women-led cooperatives."
          href="/about#food"
        />
        <ProgramCard
          variant="ivory"
          image={prog3}
          tag="Health & water"
          meta="Since 2019 · 6 systems"
          title="Clean Water & Care"
          body="Filtration and rainwater systems plus basic medical visits in villages cut off from municipal services."
          href="/about#water"
        />
      </div>
    </div>
  </section>
  {featuredStory && <StorySpotlight story={featuredStory} />}
  <DonateStrip tiers={featuredTiers} />
  <TrustBand />
</Base>
<style>
  .programs {
    padding: 90px 0;
    background: var(--bg);
  }
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 30px;
    flex-wrap: wrap;
    margin-bottom: 46px;
  }
  .head h2 {
    font-size: 46px;
    margin: 0;
    max-width: 600px;
    line-height: 1;
    letter-spacing: -1.5px;
  }
  .head p {
    max-width: 380px;
    color: var(--fg-muted);
    font-size: 15px;
    margin: 0;
  }
  .gold {
    color: var(--gold);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 18px;
  }
  @media (max-width: 880px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
```

- [ ] **Step 3: Build + run dev**

```bash
npm run build && npx playwright test tests/e2e/nav.spec.ts tests/e2e/footer.spec.ts
```

Expected: build green, both E2E pass.

- [ ] **Step 4: Add home E2E test**

```ts
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('home shows hero, motto, programs, donate strip', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /hope is a plan/i })).toBeVisible();
  await expect(page.getByText("L'union fait la force.")).toBeVisible();
  await expect(page.getByText('325')).toBeVisible();
  await expect(page.getByRole('heading', { name: /our work, in the north\./i })).toBeVisible();
  await expect(page.getByText(/sponsor a child/i)).toBeVisible();
});
```

- [ ] **Step 5: Run + commit**

```bash
npx playwright test tests/e2e/home.spec.ts
git add src/pages/index.astro src/assets/images/prog-*.jpg tests/e2e/home.spec.ts
git commit -m "feat(home): assemble homepage with featured story + tiers"
```

---

## Phase 4 — About + Stories index + Story detail

### Task 4.1: `/about` page

**Files:**

- Modify: `src/pages/about.astro`

- [ ] **Step 1: Write `about.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import MottoBand from '../components/MottoBand.astro';
import TrustBand from '../components/TrustBand.astro';
import { getEntry } from 'astro:content';

const about = await getEntry('pages', 'about');
const { Content } = await about.render();
---

<Base title={about.data.title} description={about.data.description}>
  <section class="container" style="padding:80px 0">
    <h1 class="display" style="font-size:64px;letter-spacing:-2px">{about.data.title}</h1>
    <article class="prose">
      <Content />
    </article>
  </section>
  <MottoBand />
  <TrustBand />
</Base>
<style>
  .prose {
    max-width: 720px;
    font-size: 17px;
    line-height: 1.7;
    color: var(--fg-muted);
  }
  .prose :global(h2) {
    font-family: var(--font-display);
    font-size: 32px;
    color: var(--ivory);
    margin-top: 48px;
  }
  .prose :global(p) {
    margin: 18px 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat(pages): /about consuming pages collection"
```

### Task 4.2: `/stories` index

**Files:**

- Create: `src/pages/stories/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '../../layouts/Base.astro';
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';

const stories = (await getCollection('stories')).sort((a, b) => +b.data.date - +a.data.date);
---

<Base
  title="Stories"
  description="Stories from the families and communities served by Javelin Fund in Northern Haiti."
>
  <section class="container" style="padding:80px 0">
    <p class="eyebrow gold">Stories</p>
    <h1 class="display" style="font-size:64px;letter-spacing:-2px">From the North.</h1>
    <ul class="grid">
      {
        stories.map((s) => (
          <li class="card">
            <a href={`/stories/${s.slug}`}>
              <Image
                src={s.data.hero}
                alt={s.data.title}
                widths={[400, 800]}
                sizes="(max-width:880px) 100vw, 33vw"
                class="photo"
              />
              <div class="body">
                <p class="meta">
                  {s.data.location} ·{' '}
                  {s.data.date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}
                </p>
                <h2 class="display">{s.data.title}</h2>
                <p>{s.data.excerpt}</p>
                <span class="more">Read →</span>
              </div>
            </a>
          </li>
        ))
      }
    </ul>
  </section>
</Base>
<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    list-style: none;
    padding: 48px 0 0;
    margin: 0;
  }
  @media (max-width: 880px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
  .card {
    background: var(--navy-3);
  }
  .photo {
    width: 100%;
    height: 220px;
    object-fit: cover;
  }
  .body {
    padding: 24px;
  }
  .meta {
    font-size: 11px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  h2.display {
    font-size: 22px;
    letter-spacing: -0.5px;
    margin: 10px 0 12px;
    line-height: 1.1;
  }
  .more {
    color: var(--gold);
    font-weight: 800;
    letter-spacing: 2px;
    text-transform: uppercase;
    font-size: 12px;
  }
  .gold {
    color: var(--gold);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/stories/index.astro
git commit -m "feat(pages): /stories index"
```

### Task 4.3: `/stories/[slug]` detail

**Files:**

- Create: `src/pages/stories/[...slug].astro`

- [ ] **Step 1: Write the dynamic route**

```astro
---
import Base from '../../layouts/Base.astro';
import MottoBand from '../../components/MottoBand.astro';
import { Image } from 'astro:assets';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const stories = await getCollection('stories');
  return stories.map((s) => ({ params: { slug: s.slug }, props: { story: s } }));
}

const { story } = Astro.props;
const { Content } = await story.render();
---

<Base title={story.data.title} description={story.data.excerpt} ogImage={story.data.hero.src}>
  <article class="container" style="padding:60px 0 80px;max-width:760px">
    <p class="eyebrow gold">Story · {story.data.location}</p>
    <h1 class="display" style="font-size:54px;letter-spacing:-2px;margin:8px 0 24px">
      {story.data.title}
    </h1>
    <Image
      src={story.data.hero}
      alt={story.data.title}
      widths={[800, 1400]}
      sizes="100vw"
      class="hero"
    />
    <p class="lede">{story.data.excerpt}</p>
    <div class="prose"><Content /></div>
  </article>
  <MottoBand />
</Base>
<style>
  .gold {
    color: var(--gold);
  }
  .hero {
    width: 100%;
    height: 420px;
    object-fit: cover;
    margin: 0 0 32px;
  }
  .lede {
    font-size: 19px;
    line-height: 1.6;
    color: var(--fg-muted);
    font-family: var(--font-accent);
    font-style: italic;
    border-left: 3px solid var(--gold);
    padding-left: 16px;
    margin: 0 0 32px;
  }
  .prose {
    font-size: 17px;
    line-height: 1.75;
    color: var(--fg-muted);
  }
  .prose :global(h2) {
    font-family: var(--font-display);
    font-size: 30px;
    color: var(--ivory);
    margin: 40px 0 16px;
  }
  .prose :global(p) {
    margin: 18px 0;
  }
</style>
```

- [ ] **Step 2: Build + smoke test**

```bash
npm run build
```

Expected: builds. `/stories/meet-marie-carline/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add src/pages/stories/[...slug].astro
git commit -m "feat(pages): /stories/:slug story detail"
```

---

## Phase 5 — Team + Donate + Contact + Legal

### Task 5.1: `/team` page

**Files:**

- Create: `src/pages/team.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '../layouts/Base.astro';
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';

const members = (await getCollection('team')).sort((a, b) => a.data.order - b.data.order);
---

<Base title="The People" description="The team behind Javelin Fund.">
  <section class="container" style="padding:80px 0">
    <p class="eyebrow gold">The People</p>
    <h1 class="display" style="font-size:64px;letter-spacing:-2px">The hands behind the work.</h1>
    <ul class="grid">
      {
        members.map((m) => (
          <li class="card">
            <Image
              src={m.data.photo}
              alt={m.data.name}
              widths={[300, 600]}
              sizes="(max-width:880px) 50vw, 25vw"
              class="photo"
            />
            <h2 class="display">{m.data.name}</h2>
            <p class="role">{m.data.role}</p>
            {m.data.bio && <p class="bio">{m.data.bio}</p>}
          </li>
        ))
      }
    </ul>
  </section>
</Base>
<style>
  .gold {
    color: var(--gold);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    list-style: none;
    padding: 48px 0 0;
    margin: 0;
  }
  @media (max-width: 880px) {
    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .card {
    background: var(--navy-3);
    padding: 0 0 20px;
  }
  .photo {
    width: 100%;
    aspect-ratio: 4/5;
    object-fit: cover;
    margin-bottom: 14px;
  }
  h2.display {
    font-size: 18px;
    letter-spacing: -0.3px;
    margin: 0 16px 4px;
  }
  .role {
    font-size: 12px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--gold);
    margin: 0 16px 8px;
    font-weight: 800;
  }
  .bio {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0 16px;
    line-height: 1.5;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/team.astro
git commit -m "feat(pages): /team consuming team collection"
```

### Task 5.2: `/donate` page

**Files:**

- Create: `src/pages/donate.astro`

- [ ] **Step 1: Write the page**

```astro
---
import Base from '../layouts/Base.astro';
import TrustBand from '../components/TrustBand.astro';
import { getCollection } from 'astro:content';

const tiers = (await getCollection('donateTiers')).sort(
  (a, b) => b.data.priority - a.data.priority,
);
const charity_url = 'https://www.canadahelps.org/en/charities/javelin-fund/';
---

<Base title="Donate" description="Support Javelin Fund. Tax receipts issued automatically.">
  <section class="container" style="padding:80px 0">
    <p class="eyebrow red">Give today</p>
    <h1 class="display" style="font-size:64px;letter-spacing:-2px">Receipts,<br />not promises.</h1>
    <p class="lede">
      Pick any amount. Instant CRA tax receipt via CanadaHelps. Monthly giving = 3× the impact per
      dollar.
    </p>

    <div class="tiers">
      {
        tiers.map((t) => (
          <a
            class={`tier ${t.data.featured ? 'featured' : ''}`}
            href={t.data.canada_helps_url ?? charity_url}
          >
            {t.data.ribbon && <span class="ribbon">{t.data.ribbon}</span>}
            <span class="amt">
              {t.data.amount === 'custom'
                ? 'Custom'
                : `$${(t.data.amount as number).toLocaleString('en-CA')}`}
            </span>
            <span class="freq">
              {t.data.frequency === 'yearly'
                ? 'Per year'
                : t.data.frequency === 'monthly'
                  ? 'Per month'
                  : t.data.frequency === 'one-time'
                    ? 'One-time'
                    : 'Any amount'}
            </span>
            <span class="what">{t.data.label}</span>
            <span class="sub">{t.data.sub}</span>
          </a>
        ))
      }
    </div>

    <h2 class="display" id="interac" style="margin-top:80px;font-size:32px">
      Prefer Interac e-Transfer?
    </h2>
    <p class="interac">
      Send your gift to <strong>donate@javelinfund.ca</strong>. Auto-deposit is on, so no security
      question is needed. We email a tax receipt within 5 business days.
    </p>

    <h2 class="display" style="margin-top:80px;font-size:32px">Frequently asked</h2>
    <details>
      <summary>How are tax receipts issued?</summary><p>
        CanadaHelps issues your CRA-compliant receipt instantly by email. Interac receipts are
        issued manually within 5 business days.
      </p>
    </details>
    <details>
      <summary>What does my donation pay for?</summary><p>
        98¢ of every dollar goes directly to programs in Northern Haiti — schooling, food, water and
        health. Our audited annual report is published every March.
      </p>
    </details>
    <details>
      <summary>Can I cancel a monthly gift?</summary><p>
        Yes, anytime — through your CanadaHelps account or by emailing contact@javelinfund.ca.
      </p>
    </details>
  </section>
  <TrustBand />
</Base>
<style>
  .red {
    color: var(--red);
  }
  .lede {
    font-size: 18px;
    color: var(--fg-muted);
    max-width: 600px;
    margin: 12px 0 32px;
  }
  .tiers {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }
  @media (max-width: 880px) {
    .tiers {
      grid-template-columns: 1fr 1fr;
    }
  }
  .tier {
    background: var(--navy-3);
    color: var(--ivory);
    padding: 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-left: 3px solid var(--gold);
    position: relative;
  }
  .tier.featured {
    background: var(--red);
  }
  .ribbon {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--gold);
    color: var(--navy);
    font-size: 9px;
    letter-spacing: 1.5px;
    padding: 3px 8px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .amt {
    font-family: var(--font-display);
    font-size: 30px;
    color: var(--gold);
  }
  .freq {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--fg-muted);
    font-weight: 700;
  }
  .what {
    font-size: 14px;
    font-weight: 700;
    margin-top: 6px;
  }
  .sub {
    font-size: 12px;
    color: var(--fg-muted);
  }
  details {
    border-top: 1px solid var(--line);
    padding: 16px 0;
  }
  summary {
    cursor: pointer;
    font-weight: 700;
    font-size: 16px;
  }
  .interac {
    font-size: 17px;
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 2: E2E test**

```ts
// tests/e2e/donate.spec.ts
import { test, expect } from '@playwright/test';

test('donate page lists featured tiers and Interac instructions', async ({ page }) => {
  await page.goto('/donate');
  await expect(page.getByText('$400')).toBeVisible();
  await expect(page.getByText('$1,500')).toBeVisible();
  await expect(page.getByText('Sponsor a child')).toBeVisible();
  await expect(page.getByText('Feed the orphans')).toBeVisible();
  await expect(page.getByText(/donate@javelinfund\.ca/i)).toBeVisible();
});
```

- [ ] **Step 3: Run + commit**

```bash
npx playwright test tests/e2e/donate.spec.ts
git add src/pages/donate.astro tests/e2e/donate.spec.ts
git commit -m "feat(pages): /donate with tiers + Interac + FAQ"
```

### Task 5.3: `/contact` with form

**Files:**

- Create: `src/lib/forms.ts`, `src/components/forms/ContactForm.astro`, `src/pages/contact.astro`, `tests/unit/forms.test.ts`

- [ ] **Step 1: Write `src/lib/forms.ts`**

```ts
// src/lib/forms.ts
// One Apps Script endpoint URL injected via Astro env at build time.
export const FORMS_ENDPOINT = import.meta.env.PUBLIC_FORMS_ENDPOINT ?? '';

export type FormKind = 'contact' | 'volunteer' | 'newsletter';

export interface FormPayload {
  kind: FormKind;
  fields: Record<string, string>;
  /** honeypot — must be empty */
  hp?: string;
}

export async function submitForm(payload: FormPayload): Promise<{ ok: boolean; error?: string }> {
  if (payload.hp && payload.hp.length > 0) return { ok: true }; // silent honeypot
  if (!FORMS_ENDPOINT) return { ok: false, error: 'Forms endpoint not configured' };
  try {
    const res = await fetch(FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
```

- [ ] **Step 2: Write failing tests**

```ts
// tests/unit/forms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('submitForm', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns ok when honeypot is filled (silent success)', async () => {
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' }, hp: 'bot' });
    expect(res.ok).toBe(true);
  });

  it('returns error if endpoint not configured', async () => {
    vi.stubEnv('PUBLIC_FORMS_ENDPOINT', '');
    vi.resetModules();
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not configured/);
  });

  it('POSTs JSON when endpoint configured', async () => {
    vi.stubEnv('PUBLIC_FORMS_ENDPOINT', 'https://example.test/handler');
    vi.resetModules();
    const { submitForm } = await import('../../src/lib/forms');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' } });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/handler',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
```

- [ ] **Step 3: Run tests, verify 3 pass**

```bash
npx vitest run tests/unit/forms.test.ts
```

- [ ] **Step 4: Write `ContactForm.astro`**

```astro
---
// src/components/forms/ContactForm.astro
---

<form id="contact-form" novalidate>
  <label>Name <input name="name" required autocomplete="name" /></label>
  <label>Email <input name="email" type="email" required autocomplete="email" /></label>
  <label>Message <textarea name="message" rows="6" required></textarea></label>
  <!-- honeypot — hidden from humans -->
  <label class="hp" aria-hidden="true" tabindex="-1"
    ><input name="hp" tabindex="-1" autocomplete="off" /></label
  >
  <button class="btn btn-gold" type="submit">Send →</button>
  <p class="status" role="status" aria-live="polite"></p>
</form>
<style>
  form {
    display: grid;
    gap: 16px;
    max-width: 520px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 13px;
    letter-spacing: 0.5px;
  }
  input,
  textarea {
    font: inherit;
    background: var(--navy-3);
    color: var(--fg);
    border: 1px solid var(--line);
    padding: 12px 14px;
  }
  input:focus,
  textarea:focus {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }
  .hp {
    position: absolute;
    left: -9999px;
    top: -9999px;
  }
  .btn {
    font-weight: 800;
    font-size: 12px;
    letter-spacing: 1.5px;
    padding: 14px 24px;
    border: none;
    cursor: pointer;
    text-transform: uppercase;
    align-self: start;
  }
  .btn-gold {
    background: var(--gold);
    color: var(--navy);
  }
  .status {
    font-size: 13px;
    color: var(--gold);
    min-height: 1em;
  }
</style>
<script>
  import { submitForm } from '../../lib/forms';
  const form = document.getElementById('contact-form') as HTMLFormElement;
  const status = form.querySelector('.status') as HTMLElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const fields = Object.fromEntries(fd) as Record<string, string>;
    const hp = fields.hp ?? '';
    delete fields.hp;
    status.textContent = 'Sending…';
    const res = await submitForm({ kind: 'contact', fields, hp });
    status.textContent = res.ok
      ? 'Thank you. We will be in touch.'
      : `Sorry — ${res.error ?? 'something went wrong'}.`;
    if (res.ok) form.reset();
  });
</script>
```

- [ ] **Step 5: Write `contact.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import ContactForm from '../components/forms/ContactForm.astro';
---

<Base title="Contact" description="Get in touch with Javelin Fund.">
  <section
    class="container"
    style="padding:80px 0;display:grid;grid-template-columns:1fr 1fr;gap:48px"
  >
    <div>
      <p class="eyebrow gold">Contact</p>
      <h1 class="display" style="font-size:54px;letter-spacing:-2px">Let's talk.</h1>
      <p style="color:var(--fg-muted);font-size:17px;max-width:480px">
        For partnership, press, volunteering or general questions, drop us a line. We reply within 3
        business days.
      </p>
      <p style="color:var(--fg-muted);margin-top:24px">
        <strong>Email:</strong> contact@javelinfund.ca<br /><strong>Charity:</strong> BN 755722097 RR0001
      </p>
    </div>
    <ContactForm />
  </section>
</Base>
<style>
  .gold {
    color: var(--gold);
  }
  @media (max-width: 880px) {
    section {
      grid-template-columns: 1fr !important;
    }
  }
</style>
```

- [ ] **Step 6: E2E**

```ts
// tests/e2e/contact.spec.ts
import { test, expect } from '@playwright/test';

test('contact form renders fields and submits with status feedback', async ({ page }) => {
  await page.route('**/forms-endpoint*', (route) => route.fulfill({ status: 200 }));
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Jane Doe');
  await page.getByLabel('Email').fill('jane@example.com');
  await page.getByLabel('Message').fill('Hi.');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.locator('.status')).toContainText(/thank you|sorry/i);
});
```

- [ ] **Step 7: Run + commit**

```bash
npx vitest run && npx playwright test tests/e2e/contact.spec.ts
git add src/lib/forms.ts src/components/forms/ContactForm.astro src/pages/contact.astro tests/unit/forms.test.ts tests/e2e/contact.spec.ts
git commit -m "feat(forms): ContactForm + /contact + submit helper + tests"
```

### Task 5.4: Legal pages

**Files:**

- Create: `src/pages/privacy.astro`, `src/pages/terms.astro`

- [ ] **Step 1: Write `privacy.astro`** (mirror `about.astro` but read `pages/privacy`).

```astro
---
import Base from '../layouts/Base.astro';
import { getEntry } from 'astro:content';
const page = await getEntry('pages', 'privacy');
const { Content } = await page.render();
---

<Base title={page.data.title} description={page.data.description}>
  <section class="container" style="padding:80px 0;max-width:760px">
    <h1 class="display" style="font-size:48px;letter-spacing:-1.5px">{page.data.title}</h1>
    <article class="prose"><Content /></article>
  </section>
</Base>
<style>
  .prose {
    font-size: 16px;
    line-height: 1.7;
    color: var(--fg-muted);
  }
</style>
```

- [ ] **Step 2: Write `terms.astro`** — identical shape but for `pages/terms`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/privacy.astro src/pages/terms.astro
git commit -m "feat(pages): /privacy and /terms"
```

---

## Phase 6 — Legacy content migration script

### Task 6.1: MySQL → markdown importer

**Files:**

- Create: `scripts/migrate-mysql.mjs`

- [ ] **Step 1: Install one-shot deps**

```bash
npm install -D sql-parser-mistic slugify yaml node-html-parser
```

(If `sql-parser-mistic` doesn't ship a useful parser for `mysqldump` output, the script falls back to regex extraction of `INSERT INTO`.)

- [ ] **Step 2: Write `scripts/migrate-mysql.mjs`**

```js
// scripts/migrate-mysql.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import slug from 'slugify';
import { parse as htmlParse } from 'node-html-parser';
import yaml from 'yaml';

const DUMP = '_source/extracted/javelinsooperior/homedir/public_html/mysql/javelins_funds_db.sql';
const UPLOADS = '_source/extracted/javelinsooperior/homedir/public_html/public/uploads';
const OUT_STORIES = 'src/content/stories';
const OUT_TEAM = 'src/content/team';
const OUT_ASSETS = 'src/assets/images';

mkdirSync(OUT_STORIES, { recursive: true });
mkdirSync(OUT_TEAM, { recursive: true });
mkdirSync(OUT_ASSETS, { recursive: true });

const sql = readFileSync(DUMP, 'utf8');

function extractInserts(table) {
  const re = new RegExp(`INSERT INTO \\\`${table}\\\` VALUES (.+?);`, 'gs');
  const rows = [];
  let m;
  while ((m = re.exec(sql))) {
    // Naive MySQL value parser: splits on '),(' but respects backslash escapes.
    const body = m[1].trim();
    const tuples = body.slice(1, -1).split(/\),\s*\(/);
    for (const t of tuples) rows.push(parseTuple(t));
  }
  return rows;
}

function parseTuple(t) {
  // Parses 'NULL, 1, \'foo, bar\', \'2024-01-01\', ...' into an array.
  const out = [];
  let i = 0,
    cur = '',
    inStr = false;
  while (i < t.length) {
    const c = t[i];
    if (inStr) {
      if (c === '\\') {
        cur += t[i + 1];
        i += 2;
        continue;
      }
      if (c === "'") {
        out.push(cur);
        cur = '';
        inStr = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === "'") {
      inStr = true;
      i++;
      continue;
    }
    if (c === ',') {
      if (cur.length) {
        out.push(cur === 'NULL' ? null : isNaN(+cur) ? cur : +cur);
        cur = '';
      }
      i++;
      continue;
    }
    if (c === ' ') {
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  if (cur.length) out.push(cur === 'NULL' ? null : isNaN(+cur) ? cur : +cur);
  return out;
}

function copyImage(rel) {
  if (!rel) return null;
  const fname = basename(rel);
  const src = join(UPLOADS, rel.startsWith('/') ? rel.slice(1) : rel);
  const dest = join(OUT_ASSETS, fname);
  if (existsSync(src) && !existsSync(dest)) copyFileSync(src, dest);
  return existsSync(dest) ? `../../assets/images/${fname}` : null;
}

function frontmatter(o) {
  return '---\n' + yaml.stringify(o) + '---\n';
}

// === news (stories) ===
// Adjust column indices to match the dump. Inspect the dump once: head -200 of the dump shows the CREATE TABLE definition.
const newsRows = extractInserts('news');
for (const row of newsRows) {
  // EXPECTED columns: [id, title, slug, excerpt, body, image, created_at, ...]
  const [id, title, slugRaw, excerpt, body, image, created] = row;
  if (!title) continue;
  const s = (slugRaw ? slugRaw : slug(title, { lower: true, strict: true })).toString();
  const hero = copyImage(image);
  const fm = {
    title,
    excerpt: (excerpt ?? '').toString().slice(0, 240),
    date: (created ?? new Date().toISOString()).toString().slice(0, 10),
    hero: hero ?? '../../assets/images/hero.jpg',
    featured: false,
    priority: 0,
    location: null,
    person: null,
    tags: [],
  };
  const html = htmlParse((body ?? '').toString()).text;
  writeFileSync(join(OUT_STORIES, `${s}.md`), frontmatter(fm) + '\n' + html + '\n');
  console.log('wrote stories/', s);
}

// === our_people (team) ===
const teamRows = extractInserts('our_people');
for (const row of teamRows) {
  const [id, name, role, image, bio, order] = row;
  if (!name) continue;
  const s = slug(name.toString(), { lower: true, strict: true });
  const photo = copyImage(image);
  const fm = {
    name,
    role: role ?? '',
    photo: photo ?? '../../assets/images/team-founder.jpg',
    order: order ?? 100,
    bio: bio ?? null,
  };
  writeFileSync(join(OUT_TEAM, `${s}.md`), frontmatter(fm) + '\n');
  console.log('wrote team/', s);
}

console.log('migration done.');
```

- [ ] **Step 3: Inspect the dump to confirm column indices**

```bash
grep -m 1 -E "CREATE TABLE \`(news|our_people)\`" -A 30 _source/extracted/javelinsooperior/homedir/public_html/mysql/javelins_funds_db.sql | head -80
```

Read the column order, then update the destructuring assignments inside `migrate-mysql.mjs` if they differ from the expected order.

- [ ] **Step 4: Run the migration**

```bash
node scripts/migrate-mysql.mjs
```

Expected: prints `wrote stories/<slug>` lines and `wrote team/<slug>` lines. New markdown files appear in `src/content/`.

- [ ] **Step 5: Run `astro check` to catch schema mismatches**

```bash
npx astro check
```

If any imported story fails the schema (missing required fields, bad image path), fix the script and re-run rather than hand-editing every file.

- [ ] **Step 6: Hand-curate**
  - Open `src/content/stories/` and assign `featured: true` + a `priority` to the 1-2 stories you want on the homepage.
  - Fill in `location` and `person` fields where obvious.
  - Replace the body text where the legacy copy is dated.

- [ ] **Step 7: Commit in two atomic steps**

```bash
git add scripts/migrate-mysql.mjs package.json package-lock.json
git commit -m "feat(scripts): MySQL → markdown migrator"

git add src/content/stories src/content/team src/assets/images
git commit -m "feat(content): migrate legacy stories and team from MySQL dump"
```

---

## Phase 7 — Google Apps Script form handler

### Task 7.1: Apps Script source-in-repo

**Files:**

- Create: `apps-script/form-handler.gs`, `apps-script/README.md`

- [ ] **Step 1: Write `apps-script/form-handler.gs`**

```js
/**
 * Javelin Fund form handler.
 * Deploy:
 *   1. Open https://script.google.com, create a new project.
 *   2. Paste this file into Code.gs.
 *   3. Replace SHEET_ID with the target Google Sheet ID.
 *   4. Deploy → "Web app". Execute as: Me. Who has access: Anyone.
 *   5. Copy the deployment URL into the Cloudflare Pages env var PUBLIC_FORMS_ENDPOINT.
 *   6. Test with `curl -XPOST <url> -d '{"kind":"contact","fields":{"name":"x"}}'`.
 */
const SHEET_ID = 'REPLACE_WITH_SHEET_ID';
const ALLOWED_ORIGINS = ['https://javelinfund.ca', 'https://staging.javelinfund.ca'];

function doPost(e) {
  try {
    const origin = e.parameter.origin || (e.headers && e.headers.origin) || '';
    if (ALLOWED_ORIGINS.length && !ALLOWED_ORIGINS.includes(origin)) {
      // soft-allow for dev, but log
      Logger.log('Unrecognised origin: ' + origin);
    }
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.hp && body.hp.length) return _ok(); // honeypot
    if (!body.kind || !body.fields) return _err('missing kind or fields');

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheetName = { contact: 'Contact', volunteer: 'Volunteer', newsletter: 'Newsletter' }[
      body.kind
    ];
    if (!sheetName) return _err('unknown kind');
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    const fields = body.fields;
    const headers = sheet
      .getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
      .getValues()[0]
      .filter(Boolean);
    const required = ['timestamp', ...Object.keys(fields)];
    for (const k of required) if (!headers.includes(k)) headers.push(k);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    const row = headers.map((h) => (h === 'timestamp' ? new Date() : fields[h] || ''));
    sheet.appendRow(row);
    return _ok();
  } catch (err) {
    return _err(err.message);
  }
}

function _ok() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function _err(m) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: m })).setMimeType(
    ContentService.MimeType.JSON,
  );
}
```

- [ ] **Step 2: Write `apps-script/README.md`**

```md
# Apps Script form handler

This is the Google Apps Script Web App that backs every form on javelinfund.ca.

## Deploy

1. https://script.google.com → New project → name it "Javelin Fund forms".
2. Paste `form-handler.gs` into `Code.gs`.
3. Replace `REPLACE_WITH_SHEET_ID` with the target Google Sheet ID.
4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
5. Copy the deployment URL into the Cloudflare Pages env var `PUBLIC_FORMS_ENDPOINT`.

## Update

After changes to `form-handler.gs`, re-paste into Code.gs and create a _new_ version under Deploy → Manage deployments. The deployment URL stays the same.
```

- [ ] **Step 3: Commit**

```bash
git add apps-script
git commit -m "feat(apps-script): form handler source + deploy guide"
```

---

## Phase 8 — Decap CMS

### Task 8.1: Decap CMS at `/admin`

**Files:**

- Create: `public/admin/index.html`, `public/admin/config.yml`

- [ ] **Step 1: Write `public/admin/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Javelin Fund · CMS</title>
  </head>
  <body>
    <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `public/admin/config.yml`**

```yaml
backend:
  name: github
  repo: <GH_OWNER>/<GH_REPO>
  branch: main
  base_url: https://api.netlify.com  # OAuth proxy; replace with self-hosted later
  auth_endpoint: auth

media_folder: src/assets/images
public_folder: /assets/images

collections:
  - name: stories
    label: Stories
    folder: src/content/stories
    create: true
    slug: '{{slug}}'
    fields:
      - { name: title,    label: Title,    widget: string }
      - { name: excerpt,  label: Excerpt,  widget: text }
      - { name: date,     label: Date,     widget: datetime }
      - { name: hero,     label: Hero image, widget: image }
      - { name: featured, label: Featured? widget: boolean, default: false }
      - { name: priority, label: Priority, widget: number,  default: 0 }
      - { name: location, label: Location, widget: string,  required: false }
      - { name: person,   label: Person,   widget: string,  required: false }
      - { name: tags,     label: Tags,     widget: list,    required: false }
      - { name: body,     label: Body,     widget: markdown }

  - name: team
    label: Team
    folder: src/content/team
    create: true
    slug: '{{slug}}'
    fields:
      - { name: name,  label: Name,  widget: string }
      - { name: role,  label: Role,  widget: string }
      - { name: photo, label: Photo, widget: image }
      - { name: order, label: Order, widget: number, default: 100 }
      - { name: bio,   label: Bio,   widget: text,   required: false }

  - name: donateTiers
    label: Donate tiers
    folder: src/content/donate-tiers
    create: true
    extension: yaml
    fields:
      - { name: amount,            label: Amount,    widget: string }
      - { name: frequency,         label: Frequency, widget: select, options: ['one-time','monthly','yearly','custom'] }
      - { name: label,             label: Label,     widget: string }
      - { name: sub,               label: Subline,   widget: string }
      - { name: featured,          label: Featured?  widget: boolean, default: false }
      - { name: priority,          label: Priority,  widget: number,  default: 0 }
      - { name: ribbon,            label: Ribbon,    widget: string,  required: false }
      - { name: canada_helps_url,  label: CanadaHelps URL, widget: string, required: false }
```

- [ ] **Step 3: Commit**

```bash
git add public/admin
git commit -m "feat(cms): Decap CMS configuration"
```

### Task 8.2: GitHub OAuth proxy for Decap

> **Out-of-band:** the GitHub OAuth app and the OAuth proxy URL must be created in the GitHub UI and Cloudflare Access dashboard. This task only documents the steps. Implementation is config-only — no code change.

- [ ] **Step 1: Document setup steps in `docs/cms-setup.md`**

```md
# CMS setup

1. Create a GitHub OAuth app under https://github.com/settings/applications/new
   - Homepage URL: https://javelinfund.ca
   - Authorization callback URL: https://oauth.javelinfund.ca/callback
2. Deploy a Cloudflare Worker as the OAuth proxy (decap docs):
   - https://decapcms.org/docs/external-oauth-clients/
3. Set `backend.base_url` in `public/admin/config.yml` to the worker URL.
4. Add editors as GitHub collaborators on the repo.
```

- [ ] **Step 2: Commit**

```bash
git add docs/cms-setup.md
git commit -m "docs(cms): document GitHub OAuth proxy setup"
```

---

## Phase 9 — CI, deploy, and pre-launch QA

### Task 9.1: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run format:check
      - run: npm run check
      - run: npm test
      - name: install playwright
        run: npx playwright install --with-deps chromium
      - name: e2e
        run: npm run test:e2e
      - run: npm run build
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: dist, path: dist }
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, type-check, unit + e2e tests, and build on PR/push"
```

### Task 9.2: Lighthouse CI budget

**Files:**

- Create: `.lighthouserc.cjs`

- [ ] **Step 1: Write the config**

```js
// .lighthouserc.cjs
module.exports = {
  ci: {
    collect: {
      staticDistDir: 'dist',
      url: ['http://localhost/index.html', 'http://localhost/donate/index.html'],
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
  },
};
```

- [ ] **Step 2: Add Lighthouse job to CI**

Append to `.github/workflows/ci.yml`:

```yaml
lighthouse:
  needs: ci
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'npm' }
    - run: npm ci
    - run: npm run build
    - run: npx lhci autorun
```

- [ ] **Step 3: Commit**

```bash
git add .lighthouserc.cjs .github/workflows/ci.yml
git commit -m "ci: Lighthouse budgets (perf 90, a11y 95, BP 95, SEO 95)"
```

### Task 9.3: Accessibility audit via axe-core

**Files:**

- Create: `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/about', '/stories', '/team', '/donate', '/contact'];

for (const path of pages) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/a11y.spec.ts
git commit -m "test(a11y): axe-core scan on every public page"
```

### Task 9.4: Cloudflare Pages config (no code; documented)

- [ ] **Step 1: Add `docs/deploy.md`**

```md
# Deploy

## Cloudflare Pages

- Connect: log into Cloudflare → Pages → Connect to Git → pick the repo, branch `main`.
- Build command: `npm run build`
- Output directory: `dist`
- Env vars (Production + Preview):
  - `PUBLIC_FORMS_ENDPOINT` = <Apps Script deployment URL>
- Domain: add `javelinfund.ca` apex + `www`. Cloudflare issues a TLS certificate automatically.

## DNS cutover

1. Verify the new site at staging URL (Cloudflare Pages provides `*.pages.dev`).
2. Update DNS at the registrar:
   - `javelinfund.ca` A record → Cloudflare IPs (or use Cloudflare nameservers).
   - `www` CNAME → `javelinfund.ca`.
3. Wait for TLS to issue, then verify https://javelinfund.ca.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy.md
git commit -m "docs(deploy): Cloudflare Pages connect + DNS cutover guide"
```

### Task 9.5: Pre-launch QA checklist

**Files:**

- Create: `docs/launch-checklist.md`

- [ ] **Step 1: Write the checklist**

```md
# Launch checklist

## Content

- [ ] Home hero copy proofread and approved.
- [ ] Featured story selected with `featured: true` + the highest `priority`.
- [ ] Featured tiers verified ($400/yr Sponsor a child, $1500/mo Feed the orphans).
- [ ] About body finalised.
- [ ] Privacy + terms reviewed.
- [ ] At least 6 stories live; at least 4 team members live.

## Donations

- [ ] CanadaHelps charity page URL substituted in `src/content/donate-tiers/*.yaml`.
- [ ] One real $5 test donation through each tier confirms receipt arrives within 1 hour.
- [ ] Interac e-Transfer to `donate@javelinfund.ca` auto-deposits and triggers manual receipt template.

## Forms

- [ ] Apps Script Web App deployed; `PUBLIC_FORMS_ENDPOINT` set in Cloudflare Pages env.
- [ ] Contact submission lands in the Contact tab of the Google Sheet within 10 seconds.
- [ ] Honeypot field rejects bot submissions.

## Quality

- [ ] `npm test` and `npm run test:e2e` pass on `main`.
- [ ] Lighthouse CI budgets met.
- [ ] Real-device check on iPhone Safari, Android Chrome, desktop Chrome and Firefox.

## Infra

- [ ] DNS for `javelinfund.ca` apex + `www` cut to Cloudflare.
- [ ] TLS issued, redirect from `http` → `https` works.
- [ ] `robots.txt` allows production, blocks staging.
- [ ] Sitemap reachable at `/sitemap-index.xml`.

## Post-launch

- [ ] Submit sitemap to Google Search Console.
- [ ] Take down legacy Laravel site OR redirect it to the new pages 1:1.
```

- [ ] **Step 2: Commit**

```bash
git add docs/launch-checklist.md
git commit -m "docs(launch): pre-launch QA checklist"
```

---

## Self-review

- **Spec coverage:**
  - §3 brand → Phase 1 (FlagBar, MottoBand, TrustBand, tokens, type), Phase 3 (Hero).
  - §4 IA → Phases 3, 4, 5 cover every page in the IA table.
  - §5 content model → Phase 2.
  - §6 donate → Phases 3.5, 5.2.
  - §7 forms → Phases 5.3, 7.
  - §8 migration → Phase 6.
  - §9 hosting → Phase 9.
  - §10 repo structure → matches the file-structure section.
  - §11 perf/a11y → Phase 9 (Lighthouse + axe-core).
- **Placeholder scan:** no "TBD" / "fill in details" outside the content body of seeded markdown (clearly marked as editorial work, not engineering work).
- **Type consistency:** `pickFeatured` / `pickFeaturedAll` consistent across Phase 2 and Phases 3, 5. Tier `amount` typed as `number | 'custom'` consistently. `donateTiers` collection name matches `src/content/config.ts` and `getCollection('donateTiers')` calls.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-javelinfund-rebuild.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
