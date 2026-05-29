export async function verifyGitHubIdentity(token, allowlist) {
  if (!token) return { ok: false, error: 'no token' };
  let res;
  try {
    res = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${token}`,
        'user-agent': 'javelinfund-receipts',
        accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    return { ok: false, error: 'github unreachable' };
  }
  if (!res.ok) return { ok: false, error: `github ${res.status}` };
  let user;
  try {
    user = await res.json();
  } catch (e) {
    return { ok: false, error: 'github bad response' };
  }
  const login = (user && user.login ? String(user.login) : '').toLowerCase();
  const allowed = (Array.isArray(allowlist) ? allowlist : []).map((s) => String(s).toLowerCase());
  if (!login || !allowed.includes(login)) return { ok: false, error: 'not authorized' };
  return { ok: true, login };
}

export function parseAllowlist(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
