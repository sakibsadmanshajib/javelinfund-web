# Decap CMS OAuth proxy — Cloudflare Worker

A tiny Cloudflare Worker that completes GitHub's OAuth authorization-code flow
for Decap CMS. The browser opens it as a popup, the user signs in to GitHub,
and the Worker posts the resulting access token back to the CMS window via
`postMessage` — exactly the message shape Decap expects.

## One-time setup

### 1. Create the GitHub OAuth App

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. **Application name:** `Javelin Fund CMS`
3. **Homepage URL:** `https://javelinfund.ca`
4. **Authorization callback URL:** `https://javelinfund-decap-oauth.<your-account>.workers.dev/callback` (placeholder for now — we'll get the real URL from the first deploy and come back to update it).
5. **Register application**.
6. Note the **Client ID**. Click **Generate a new client secret** → note the **Client Secret**. You will paste both into Wrangler in step 3.

### 2. Install Wrangler and authenticate to Cloudflare

```bash
cd decap-oauth-worker
npm install
npx wrangler login            # opens a browser, signs you into your Cloudflare account
```

### 3. Deploy

```bash
npx wrangler deploy
```

Wrangler prints the live URL, e.g. `https://javelinfund-decap-oauth.<your-account>.workers.dev`. Copy it. **Go back to the GitHub OAuth App settings and replace the placeholder callback URL with `<that-url>/callback`. Save.**

### 4. Set the secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
# paste the Client ID from step 1, press Enter

npx wrangler secret put GITHUB_CLIENT_SECRET
# paste the Client Secret from step 1, press Enter
```

### 5. Point Decap at the Worker

Edit `../public/admin/config.yml`:

```yaml
backend:
  name: github
  repo: sakibsadmanshajib/javelinfund-web
  branch: main
  base_url: https://javelinfund-decap-oauth.<your-account>.workers.dev
  auth_endpoint: auth
```

Commit + push. Cloudflare Pages rebuilds the site. Visit
`https://javelinfund.ca/admin/` (or `*.pages.dev/admin/` until the custom
domain is live). Click **Login with GitHub** → popup → authorize → window
closes → CMS UI appears.

### 6. Optional: custom domain for the Worker

In Cloudflare → Workers & Pages → your Worker → **Triggers** → **Add Custom
Domain** → set `oauth.javelinfund.ca` (or anything you prefer). Update the
GitHub OAuth App's callback URL and Decap's `base_url` to use the custom
domain.

## How it works

```
1. Visit https://javelinfund.ca/admin/
2. Click "Login with GitHub" → Decap opens
   <worker>/auth in a popup.
3. /auth redirects the popup to GitHub's authorize page with
   client_id, scope=repo,user, state, redirect_uri=<worker>/callback.
4. User approves on GitHub.
5. GitHub redirects the popup to <worker>/callback?code=…&state=…
6. The Worker POSTs to https://github.com/login/oauth/access_token
   with the client_id, client_secret, and code → receives an
   access_token.
7. The Worker returns HTML that calls
   window.opener.postMessage(
     'authorization:github:success:{"token":"…","provider":"github"}',
     '*'
   )
   and closes the popup.
8. Decap receives the postMessage, stores the token in localStorage,
   and opens the CMS.
```

## Local development

```bash
npx wrangler dev               # runs the Worker on http://localhost:8787
```

To test the OAuth dance you need a Decap install pointing at the dev URL.
The `local_backend` mode in Decap is simpler for editing-only flows — use
this Worker dev mode only when iterating on the Worker itself.

## Cost / limits

- Worker free tier: 100k requests/day. Decap auth is a few requests per
  editor session; this is comfortably free.
- No KV / Durable Objects used.

## Rotating the secret

```bash
npx wrangler secret put GITHUB_CLIENT_SECRET
# paste new secret
```

Then update the secret on the GitHub OAuth App in the same dashboard.
