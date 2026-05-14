// tests/unit/forms.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('submitForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns ok when honeypot is filled (silent success)', async () => {
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' }, hp: 'bot' });
    expect(res.ok).toBe(true);
  });

  it('returns error if endpoint not configured', async () => {
    vi.stubEnv('PUBLIC_FORMS_ENDPOINT', '');
    vi.resetModules();
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not configured/);
  });

  it('POSTs JSON when endpoint configured', async () => {
    vi.stubEnv('PUBLIC_FORMS_ENDPOINT', 'https://example.test/handler');
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' } });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/handler',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns error string on non-2xx HTTP response', async () => {
    vi.stubEnv('PUBLIC_FORMS_ENDPOINT', 'https://example.test/handler');
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { submitForm } = await import('../../src/lib/forms');
    const res = await submitForm({ kind: 'contact', fields: { name: 'x' } });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/500/);
  });
});
