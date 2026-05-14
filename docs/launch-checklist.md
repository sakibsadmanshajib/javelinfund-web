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
