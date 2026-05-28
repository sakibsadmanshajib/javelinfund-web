// decap-oauth-worker/src/lib/appsScript.js
// Calls the Apps Script web app with the shared secret. action e.g. 'receipt.reserve'.
export async function callAppsScript(env, action, payload) {
  const body = JSON.stringify({ action, secret: env.APPS_SCRIPT_SHARED_SECRET, ...payload });
  const res = await fetch(env.APPS_SCRIPT_RECEIPTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal: AbortSignal.timeout(25000),
  });
  const json = await res.json().catch(() => ({ ok: false, error: 'bad json' }));
  if (!json.ok) throw new Error(json.error || `apps script ${action} failed`);
  return json;
}
