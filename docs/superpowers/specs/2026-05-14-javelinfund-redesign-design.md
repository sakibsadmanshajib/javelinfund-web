# Javelin Fund redesign — design spec

**Date:** 2026-05-14
**Author:** Sakib + Claude (brainstorm session)
**Status:** Draft → awaiting user review before implementation planning
**Branch:** `main`
**Repo:** `/home/sakib/javelinefund` (GitHub repo to be created)

---

## 1. Context

Javelin Fund is a registered Canadian charity (BN **755722097 RR0001**) that has delivered direct relief and long-term programs to families in Northern Haiti since **2016**. The existing site is a Laravel + MySQL application with PayPal donations and a custom admin CMS. The application is heavy, slow to update, and visually dated. We are replacing it with a modern static site that:

- Loads fast on the mobile networks our donors actually use.
- Communicates the mission with a Bold Activist visual voice rooted in Haitian iconography.
- Issues CRA-compliant tax receipts on every donation.
- Stays inexpensive to host and trivial to update without a server.

The current site stays online until the new site is content-complete and rails are verified, then we cut the `javelinfund.ca` DNS to Cloudflare Pages.

## 2. Goals

1. Modern, trust-building website that converts visitors to donors.
2. Five focused pages (home, about, stories, team, donate) — no 12-page sprawl.
3. CRA receipts via CanadaHelps; Interac e-Transfer as a Canadian-native alternative.
4. Non-technical editors can publish stories without code (Decap CMS over the same GitHub repo).
5. All copy in English; one cultural anchor (French national motto) retained.
6. Imagery sourced exclusively from Javelin Fund's own photography.

## 3. Non-goals (phase 1)

- French / Haitian Creole translations.
- Direct Stripe integration (would require us to build a CRA-compliant receipt issuer).
- Donor CRM (Kindful / Keela). Deferred until donor volume justifies it.
- Multi-user role-based CMS — Decap with GitHub identity is enough.
- Native apps, push notifications, AI chat — out of scope.

## 4. Brand and visual system

- **Direction:** Bold Activist. Inspired by charity:water and WaterAid, anchored to Haitian iconography.
- **Palette:** Navy `#0a1a3f` · Red `#d62828` · Gold `#ffd60a` · Ivory `#fafaf7` · plus `#08153a` and `#0e2050` as navy tints.
- **Typography:**
  - Display: **Archivo Black** (uppercase, condensed feel).
  - Accent: **Playfair Display** italic (for "of/the/a" connectors and pull-quotes).
  - Body: **Inter** 400/600/800.
- **Motifs:**
  - Three-stripe flag bar at the very top of every page (Navy → Red → Gold).
  - A single, subtle vèvè-inspired SVG ornament in the hero (low opacity, decorative only — not literal vodou symbology).
  - One motto band per page: *"L'union fait la force."* in Playfair italic + small English gloss + serving-since-2016 line.
- **Imagery rules:**
  - Only Javelin Fund's own photos. Sourced from the legacy archive's `public/uploads/` and `public/assets/images/`.
  - If no photo exists for a section, leave a clearly marked placeholder and surface the gap to the user — never fall back to stock.
  - Photo treatment: cover-fit, scrim gradient (navy 95% → 25%) on hero overlays so headlines stay legible without sacrificing the image.

## 5. Information architecture

| Slug | Page | Notes |
| --- | --- | --- |
| `/` | Home | Hero, motto band, impact stats, programs preview (3), featured story, donate strip, trust band. |
| `/about` | About | Mission, story of the founders, programs (long-form), governance, financials link. Folds `/our-programs` and `/northern-haiti` from the legacy site. |
| `/stories` | Stories | Index of all stories. Renamed from `/news`. Folds `/media` from the legacy site. |
| `/stories/[slug]` | Story detail | Long-form post with hero image, body markdown, related stories. |
| `/team` | Team | Roster of board + program leads. Renamed from `/the-people`. Detail pages collapse into the index (no per-person URL in phase 1 — defer until needed). |
| `/donate` | Donate | All tiers, CanadaHelps embed/button, Interac instructions, receipt info, FAQ. |
| `/contact` | Contact | Address, email, custom Astro form → Google Apps Script → Sheet. |
| `/privacy` and `/terms` | Legal | Carried over from legacy. |

## 6. Content model (Astro content collections)

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const stories = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    excerpt: z.string(),
    date: z.coerce.date(),
    hero: image(),
    featured: z.boolean().default(false),
    priority: z.number().default(0),
    location: z.string().optional(),     // e.g. "Cap-Haïtien"
    person: z.string().optional(),       // e.g. "Marie-Carline P."
    tags: z.array(z.string()).default([]),
  }),
});

const team = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
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
    amount: z.number(),
    frequency: z.enum(['one-time', 'monthly', 'yearly']),
    label: z.string(),               // "Sponsor a child"
    sub: z.string(),                 // helper line
    featured: z.boolean().default(false),
    priority: z.number().default(0),
    ribbon: z.string().optional(),   // "Top pick" / "Most asked"
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

export const collections = { stories, team, donateTiers: donateTiers, pages };
```

Featured items live in the same collection — the homepage filters `featured: true`, sorts by `priority desc`, and renders the first. Toggling a feature is a one-line frontmatter edit.

## 7. Donation flow

### 7.1 Donate page (`/donate`)

- **Tier grid.** All tiers rendered from the `donateTiers` collection. Featured tiers carry a ribbon.
- **CanadaHelps button.** Each tier deep-links to a CanadaHelps amount; e.g. `https://www.canadahelps.org/en/charities/javelin-fund/?amount=400&recurring=yearly`. CanadaHelps issues CRA receipts automatically.
- **Interac instructions card.**
  - Send Interac e-Transfer to `donate@javelinfund.ca` (auto-deposit on).
  - Security question / answer is not needed when auto-deposit is on.
  - We email a manual receipt within 5 business days using a CanadaHelps custom-receipt template or a Google Apps Script.
- **FAQ.** "How are receipts issued?", "What's my donation used for?", "Is monthly giving better?".

### 7.2 Homepage donate strip

- Two featured tiers prominently (current: $400/yr Sponsor a child, $1,500/mo Feed the orphans).
- One boilerplate tier (e.g. $50 family meal pack).
- "Custom amount" tile linking to CanadaHelps' free-amount page.

### 7.3 Why we are NOT integrating Stripe directly

A registered Canadian charity must issue CRA-compliant receipts for every cash donation. Stripe does not issue these receipts; we would need to build:

- a webhook handler,
- a sequential receipt-number store,
- a templated PDF generator,
- a transactional email pipeline,
- and a CRA-clean audit trail.

CanadaHelps does all of this for us at a fee that is comparable to Stripe + a receipt service. Phase 1 ships with CanadaHelps; we re-evaluate if donor volume or branding pressure warrants a custom rail.

## 8. Forms

- Three forms: **Contact**, **Volunteer**, **Newsletter signup**.
- All three are native Astro components, styled on-brand.
- Submissions `POST` JSON to a single Google Apps Script Web App endpoint (one endpoint, `form_kind` field discriminates).
- The Apps Script appends a row to the appropriate tab in one Google Sheet (`Contact`, `Volunteer`, `Newsletter`).
- Newsletter signup additionally calls Mailchimp or Resend audiences in a later phase — phase 1 just collects the email in the sheet.
- Rate-limit and honeypot field on the client; the Apps Script also rejects requests without the expected origin.

## 9. Migration plan

1. **Parse `_source/extracted/.../mysql/javelins_funds_db.sql`** with a one-shot Node script:
   - Identify `news`, `our_people`, `pages` tables.
   - Convert each row to a markdown file with the schema above.
   - Resolve image references to files in `public/uploads/` and copy them to `src/assets/<collection>/<slug>/`.
2. **Manually rewrite** hero copy, programs intro, donate FAQs in the new Bold Activist voice.
3. **Spot-check** every migrated story against the original page rendered locally, then commit each batch atomically.

## 10. Hosting and CI

- **Repo:** new GitHub repo `javelinfund/javelinfund-web` (or under personal account → transfer later).
- **Branches:** `main` deploys to production. PRs to `main` deploy preview builds on Cloudflare Pages.
- **Build:** `npm run build` produces `dist/`. Cloudflare Pages handles SSL, CDN, redirects.
- **Workflow:** GitHub Action runs `astro check` and `prettier --check` on every PR. Cloudflare Pages handles the build/deploy.
- **DNS:** at cutover, point `javelinfund.ca` apex + `www` to Cloudflare Pages.
- **Secrets:** none required in build. Apps Script endpoint URL is public (rate-limited server-side). CanadaHelps charity URL is public.

## 11. Repo structure (target)

```
/
├─ astro.config.mjs
├─ package.json
├─ public/
│  ├─ favicon.svg
│  ├─ robots.txt
│  └─ sitemap.xml         (Astro plugin generates)
├─ src/
│  ├─ assets/             (optimized originals)
│  ├─ components/
│  │  ├─ Nav.astro
│  │  ├─ Hero.astro
│  │  ├─ MottoBand.astro
│  │  ├─ StatsGrid.astro
│  │  ├─ ProgramCard.astro
│  │  ├─ StorySpotlight.astro
│  │  ├─ DonateStrip.astro
│  │  ├─ TrustBand.astro
│  │  ├─ Footer.astro
│  │  └─ forms/
│  ├─ content/
│  │  ├─ config.ts
│  │  ├─ stories/
│  │  ├─ team/
│  │  ├─ donate-tiers/
│  │  └─ pages/
│  ├─ layouts/
│  │  └─ Base.astro
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ about.astro
│  │  ├─ stories/
│  │  ├─ team.astro
│  │  ├─ donate.astro
│  │  ├─ contact.astro
│  │  ├─ privacy.astro
│  │  └─ terms.astro
│  └─ styles/
├─ public/admin/          (Decap CMS index.html + config.yml)
├─ scripts/
│  └─ migrate-mysql.mjs   (one-shot importer)
└─ docs/
```

## 12. Performance and accessibility targets

- Lighthouse: 95+ on Performance, Accessibility, Best Practices, SEO on the home page on a mobile profile.
- Total page weight < 800 KB for home (real photos optimized via Astro's `<Image>` to AVIF/WebP).
- All photographs carry meaningful `alt` text. No `alt=""` on substantive imagery.
- Colour contrast: navy/ivory and gold/navy pairs verified AA at minimum.
- Keyboard navigation order matches visual order; focus rings retained.
- Skip-to-content link in the layout.

## 13. Risks and open questions

| Risk | Mitigation |
| --- | --- |
| CanadaHelps charity URL slug not yet known | Confirm before launch; until then donate buttons link to a coming-soon page. |
| Interac auto-deposit not yet active on `donate@javelinfund.ca` | Confirm with treasurer before launch. |
| Newer Javelin Fund photos may exist outside the cPanel archive | Ask the user for a Google Drive share before final QA. |
| Some legacy stories were written in informal voice that is dated | Hand-edit during migration; do not bulk-rewrite. |
| Decap CMS needs GitHub OAuth app + Netlify Identity (or Cloudflare Access) for editor auth | Use Cloudflare Access free tier; document in `docs/cms-setup.md`. |

## 14. Out-of-band requests for the user

- [ ] CanadaHelps charity page URL (and an admin invite to the dashboard).
- [ ] Confirmation that Interac auto-deposit is enabled on `donate@javelinfund.ca`.
- [ ] Google account for Apps Script / Sheets ownership.
- [ ] Decision on GitHub repo location: personal or org? Public or private?
- [ ] Photo top-up: any newer photos beyond the 2023 cPanel snapshot?

## 15. Implementation plan

This spec is the design contract. Once approved, the implementation plan will be written via `superpowers:writing-plans` and broken into atomic phases:

1. Astro scaffold + base layout + flag bar + nav + footer + motto band component.
2. Content collections + Decap CMS wiring.
3. Home page (hero → motto → stats → programs → featured story → donate strip → trust).
4. About, Stories index, Story detail.
5. Team, Donate, Contact, Privacy, Terms.
6. Migration script (MySQL → markdown).
7. CI workflow + Cloudflare Pages connect.
8. Pre-launch QA: Lighthouse, accessibility audit, CanadaHelps + Interac live tests.
9. DNS cutover.

Each phase ships behind its own atomic commit(s) and review.
