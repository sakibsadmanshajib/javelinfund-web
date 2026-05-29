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
- [ ] Resolve open axe-core `color-contrast` violations on `/`, `/about`, and `/donate`:
  - `.tier.featured .sub` text on red (`#d62828`) — bump to a brighter foreground (e.g. `#fff` or `#ffe7e7`).
  - Red `#d62828` text on navy / gold backgrounds — switch to gold on navy and navy on gold.
  - Body muted grey `#6a7489` on ivory is 4.49 : 1 (target 4.5). Darken to `#5d6678`.
  - Then re-run `npx playwright test tests/e2e/a11y.spec.ts` — all 6 pages must be green.

## Infra

- [ ] DNS for `javelinfund.ca` apex + `www` cut to Cloudflare.
- [ ] TLS issued, redirect from `http` → `https` works.
- [ ] `robots.txt` allows production, blocks staging.
- [ ] Sitemap reachable at `/sitemap-index.xml`.

## Post-launch

- [ ] Submit sitemap to Google Search Console.
- [ ] Take down legacy Laravel site OR redirect it to the new pages 1:1.
