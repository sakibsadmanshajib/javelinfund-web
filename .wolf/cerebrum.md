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
- **Receipts data flow:** browser → Worker `/api/receipts` → Apps Script web app (`receipt.reserve|store|list|cancel|getFile`) → Google Sheet + Drive. `store` archives the PDF to Drive folder `RECEIPTS_FOLDER_ID` (Apps Script Script Property). GET `receipt.list` working does NOT prove `store` works — `store` additionally needs the Drive OAuth scope. (2026-06-10)
- **Apps Script project:** "Javelin Fund forms", id `1D98w1L3M4h2XhMT13bimvlW1ig7CbPIIhiE51axWsGHIv5Y9yV4IuxNR`. Script Properties confirmed set: `RECEIPTS_FOLDER_ID`, `RECEIPTS_SECRET`, `serial_2026`. (2026-06-10)
- **Debugging the live Worker:** `wrangler tail javelinfund-decap-oauth` needs `CLOUDFLARE_ACCOUNT_ID=84ba1eecc7507fa92c15794d3cc04d06` + a Global API Key with `CLOUDFLARE_EMAIL=sakibsadmanshajib@gmail.com` (default wrangler OAuth token lacks account perms). Tail reveals the real error the Worker's generic catch was masking. (2026-06-10)
- **Astro scoped-style gotcha:** elements built at runtime via `document.createElement` do NOT get the `[data-astro-cid-*]` attribute, so scoped `<style>` rules silently miss them (render as default browser chrome). Fix: `<style is:global>` when every selector is class-namespaced on a leaf route. This was the "weird Download button" bug. (2026-06-10)
- **`receipts.astro` style block is now `is:global`.** The ONLY thing preventing site-wide CSS collisions is the `.rcpt-` class prefix. NEVER add a generic class (`.btn`, `.badge`, `.card`, `.table`) to that block, and do not reuse this page's `<style>` on another route. (2026-06-10)
- **Worker receipt issuance is now two-phase:** build+render failure → cancel serial + 500 with real error; `receipt.store` (Drive) failure → best-effort, receipt still issued with `archived:false` in the response. Re-download regenerates from the Sheet row. (2026-06-10)

## Do-Not-Repeat

- **[2026-05-14] NEVER use stock photos.** Stock images destroy trust on a charity site. Use only Javelin Fund's own photos from `public/uploads/` and `public/assets/images/` in the legacy archive. If a needed photo is missing, ASK the user before substituting anything else.
- **[2026-05-14] Do not use Haitian Creole or French copy for body content.** Donors are Canadian; everything reader-facing is English. Exception: the single "L'union fait la force" motto band, kept verbatim as the Haitian national motto.
- **[2026-05-14] Do not introduce PayPal in the new build.** Payment rails are CanadaHelps (cards + receipts) + Interac e-Transfer only.
- **[2026-06-10] After adding Drive/Gmail/etc. code to an Apps Script web app, you MUST re-deploy AND re-authorize.** Google grants OAuth scopes at consent time; code added after the first auth (e.g. `DriveApp.getFolderById`) throws "You do not have permission to call..." until the editing user runs a function touching that API (triggering consent) and redeploys the web app. Deploying new code alone does not grant new scopes.
- **[2026-06-10] Do not let a Worker's outer catch collapse every failure to a generic message** on an admin-only endpoint — it hid a Drive-scope error as "internal error" for days. Surface the real `e.message`. Also: do not cancel/void a reserved serial on a non-fatal downstream failure (Drive archival) — only void when there is genuinely no issuable artifact (render failure).

## Decision Log

See [`docs/DECISIONS.md`](../docs/DECISIONS.md) for the full table of 15 brainstorm decisions captured 2026-05-14. Highlights:

- **Stack:** Astro static + Decap CMS + Cloudflare Pages (GitHub-hosted repo, `javelinfund.ca` cutover).
- **Receipts:** CanadaHelps is the *only* card processor — issues CRA-compliant tax receipts automatically. Direct Stripe rejected to avoid building a receipt issuer.
- **Featured content mechanic:** Markdown files in `src/content/stories/` and `src/content/donate-tiers/` with `featured: true` + `priority` frontmatter; homepage auto-renders highest-priority featured.
- **Page scope:** 5 — home, about (incl. programs), stories, team, donate.
