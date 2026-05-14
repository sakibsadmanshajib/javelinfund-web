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
