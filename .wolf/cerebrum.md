# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-14

## User Preferences

- Caveman ultra mode in user-facing replies (telegraphic, no filler).
- Atomic git commits (one logical change per commit). Conventional Commits style.
- Use superpowers (brainstorming, plans, TDD), ECC reviewers/builders, claude-mem, graphify, OpenWolf in concert.
- Static-site stack preference: **Astro + Markdown + Decap CMS + Cloudflare Pages**.
- Forms via Google Apps Script → Google Sheets. No PayPal in new build; use CanadaHelps + Interac e-Transfer.
- Charity president name = "Glen Jackson" (ONE n, not "Glenn"). Use on all receipts/docs. (2026-05-28)

## Key Learnings

- **Project:** javelinefund — static site for Javelin Fund, a Canadian registered charity (BN 755722097 RR0001) for Northern Haiti, on the ground since 2016.
- **Brand voice:** Bold Activist. Palette = Haitian flag (Navy/Red/Gold + ivory). Type = Archivo Black + Playfair Display italic + Inter.
- **Content language:** English only for phase 1. Keep "L'union fait la force" motto band as cultural anchor; everything else English.
- **Current stat:** 325 children in school.
- **Featured donate tiers:** $400 / year — Sponsor a child · $1,500 / month — Feed the orphans.
- Worker `/api/receipts` routes live in `decap-oauth-worker/src/api/receipts.js`, wired in `index.js` before the `/auth` branch (reuses existing `url`). Auth via `verifyGitHubIdentity` + `RECEIPTS_ALLOWLIST`. CORS echoes Origin from `SITE_ORIGINS`. (2026-05-28)
- Worker route tests must use `// @vitest-environment node` (not happy-dom) because happy-dom strips the Origin request header. (2026-05-28)
- Root-run vitest importing `decap-oauth-worker/src` needs any worker runtime dep (e.g. pdf-lib) ALSO in ROOT package.json devDependencies — CI runs `npm ci` only at repo root; the sub-package node_modules is never installed in CI. Verify by hiding decap-oauth-worker/node_modules and running the test. (2026-05-28)

## Do-Not-Repeat

- **[2026-05-14] NEVER use stock photos.** Stock images destroy trust on a charity site. Use only Javelin Fund's own photos from `public/uploads/` and `public/assets/images/` in the legacy archive. If a needed photo is missing, ASK the user before substituting anything else.
- **[2026-05-14] Do not use Haitian Creole or French copy for body content.** Donors are Canadian; everything reader-facing is English. Exception: the single "L'union fait la force" motto band, kept verbatim as the Haitian national motto.
- **[2026-05-14] Do not introduce PayPal in the new build.** Payment rails are CanadaHelps (cards + receipts) + Interac e-Transfer only.

## Decision Log

See [`docs/DECISIONS.md`](../docs/DECISIONS.md) for the full table of 15 brainstorm decisions captured 2026-05-14. Highlights:

- **Stack:** Astro static + Decap CMS + Cloudflare Pages (GitHub-hosted repo, `javelinfund.ca` cutover).
- **Receipts:** CanadaHelps is the *only* card processor — issues CRA-compliant tax receipts automatically. Direct Stripe rejected to avoid building a receipt issuer.
- **Featured content mechanic:** Markdown files in `src/content/stories/` and `src/content/donate-tiers/` with `featured: true` + `priority` frontmatter; homepage auto-renders highest-priority featured.
- **Page scope:** 5 — home, about (incl. programs), stories, team, donate.
