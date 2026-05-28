/**
 * Decap CMS OAuth handler for Cloudflare Workers.
 *
 * Two routes:
 *   GET /auth      → redirect the user to GitHub's OAuth authorize page
 *   GET /callback  → GitHub returns here with ?code=…; we trade it for an
 *                    access_token and post it back to the Decap window via
 *                    window.opener.postMessage().
 *
 * Decap CMS calls `${base_url}/${auth_endpoint}` to start the flow, so
 * `base_url = https://<worker-host>` and `auth_endpoint = auth`.
 *
 * Secrets (set via `npx wrangler secret put <name>`):
 *   - GITHUB_CLIENT_ID
 *   - GITHUB_CLIENT_SECRET
 */

import { handleReceiptsRequest } from './api/receipts.js';

const ALLOWED_ORIGINS = [
  'https://javelinfund.ca',
  'https://www.javelinfund.ca',
  'https://javelinfund-web.sakibsadmanshajib.workers.dev',
  'https://javelinfund-web.pages.dev',
  // Pages preview deployments use *.javelinfund-web.pages.dev — match by suffix below.
  'http://localhost:4321',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.javelinfund-web.pages.dev')) return true;
  return false;
}

const SCOPE = 'repo,user';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/receipts' || url.pathname.startsWith('/api/receipts/')) {
      return handleReceiptsRequest(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/auth') {
      return startAuth(url, env);
    }
    if (request.method === 'GET' && url.pathname === '/callback') {
      return handleCallback(url, env);
    }
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response('Javelin Fund CMS OAuth handler — alive.\n', {
        headers: { 'content-type': 'text/plain' },
      });
    }
    return new Response('Not found', { status: 404 });
  },
};

async function startAuth(url, env) {
  const state = crypto.randomUUID();
  const redirectUri = `${url.origin}/callback`;
  const gh = new URL('https://github.com/login/oauth/authorize');
  gh.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  gh.searchParams.set('redirect_uri', redirectUri);
  gh.searchParams.set('scope', SCOPE);
  gh.searchParams.set('state', state);
  return Response.redirect(gh.toString(), 302);
}

async function handleCallback(url, env) {
  const code = url.searchParams.get('code');
  if (!code) return htmlError('Missing ?code in callback URL.');

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'javelinfund-decap-oauth',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (!tokenRes.ok) return htmlError(`GitHub token exchange failed: HTTP ${tokenRes.status}`);

  const tokenJson = await tokenRes.json();
  if (tokenJson.error) return htmlError(`GitHub OAuth error: ${tokenJson.error_description || tokenJson.error}`);

  const token = tokenJson.access_token;
  if (!token) return htmlError('No access_token returned by GitHub.');

  return htmlPostMessage(token);
}

function htmlPostMessage(token) {
  // Decap CMS protocol:
  //   1. popup announces with `authorizing:github`
  //   2. opener echoes the same string back to acknowledge
  //   3. popup replies with `authorization:github:success:<json>`
  // This handshake mirrors the well-known netlify-cms-github-oauth-provider
  // implementation and matches what Decap's auth page expects.
  const payload = JSON.stringify({ token, provider: 'github' });
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CMS sign-in</title></head>
<body>
<p>Signed in. You may close this window.</p>
<script>
(function () {
  var payload = ${JSON.stringify(payload)};
  function receive(e) {
    if (!e.data || typeof e.data !== 'string') return;
    if (e.data !== 'authorizing:github') return;
    (e.source || window.opener).postMessage(
      'authorization:github:success:' + payload,
      e.origin && e.origin !== 'null' ? e.origin : '*'
    );
  }
  window.addEventListener('message', receive, false);
  // Kick off the handshake.
  if (window.opener) {
    window.opener.postMessage('authorizing:github', '*');
  }
  // Failsafe: if the opener never echoes (legacy clients), push success
  // directly after a short delay so old Decap builds still work.
  setTimeout(function () {
    if (window.opener) window.opener.postMessage('authorization:github:success:' + payload, '*');
  }, 1200);
  setTimeout(function () { try { window.close(); } catch (_) {} }, 2200);
})();
</script>
</body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function htmlError(msg) {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>CMS sign-in error</title></head>
<body><h1>Sign-in failed</h1><p>${escapeHtml(msg)}</p>
<p>Close this window and try again. If it persists, contact the admin.</p></body></html>`;
  return new Response(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
