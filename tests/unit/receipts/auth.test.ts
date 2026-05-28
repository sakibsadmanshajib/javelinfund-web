import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyGitHubIdentity } from '../../../decap-oauth-worker/src/lib/auth.js';

afterEach(() => vi.restoreAllMocks());

function mockUser(login: string, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: status === 200, status,
    json: async () => ({ login }),
  })));
}

describe('verifyGitHubIdentity', () => {
  it('returns login when token valid and login is allowlisted', async () => {
    mockUser('glenjackson');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r).toEqual({ ok: true, login: 'glenjackson' });
  });
  it('rejects a login not on the allowlist', async () => {
    mockUser('randouser');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r.ok).toBe(false);
  });
  it('rejects when GitHub returns non-200', async () => {
    mockUser('x', 401);
    const r = await verifyGitHubIdentity('bad', ['glenjackson']);
    expect(r.ok).toBe(false);
  });
  it('is case-insensitive on login', async () => {
    mockUser('GlenJackson');
    const r = await verifyGitHubIdentity('tok', ['glenjackson']);
    expect(r.ok).toBe(true);
  });
});
