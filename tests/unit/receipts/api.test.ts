// @vitest-environment node
// Node's undici preserves the Origin header that scripts set; happy-dom strips it
// (per fetch spec's forbidden-header rule), which would mask the CORS echo this
// suite asserts. The Worker runtime does not strip Origin, so node matches prod.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleReceiptsRequest } from '../../../decap-oauth-worker/src/api/receipts.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const env = {
  RECEIPTS_ALLOWLIST: 'glenjackson',
  APPS_SCRIPT_RECEIPTS_URL: 'https://script.example/exec',
  APPS_SCRIPT_SHARED_SECRET: 's3cret',
  SIGNATURE_PNG_B64:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

function req(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: {
      origin: 'https://javelinfund.ca',
      authorization: 'Bearer tok',
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

describe('handleReceiptsRequest', () => {
  it('answers CORS preflight (OPTIONS) with allow headers', async () => {
    const res = await handleReceiptsRequest(req('OPTIONS', '/api/receipts'), env);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://javelinfund.ca');
  });

  it('returns 401 when the GitHub identity is not authorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ login: 'stranger' }) })),
    );
    const res = await handleReceiptsRequest(req('GET', '/api/receipts'), env);
    expect(res.status).toBe(401);
  });

  it('lists receipts for an authorized user', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, receipts: [{ serial: '2026-0001' }] }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleReceiptsRequest(req('GET', '/api/receipts'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.receipts[0].serial).toBe('2026-0001');
  });

  it('creates a receipt: reserves serial, renders pdf, stores, returns pdfBase64', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          serial: '2026-0001',
          dateIssued: '2026-05-28T00:00:00.000Z',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, driveFileId: 'drv1' }) });
    vi.stubGlobal('fetch', fetchMock);
    const body = {
      donorName: 'Jane',
      donorAddress: '12 King',
      cityProvince: 'Windsor, ON',
      postalCode: 'N9A1A1',
      amount: '50',
      dateReceived: '2026-05-28',
    };
    const res = await handleReceiptsRequest(req('POST', '/api/receipts', { body }), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.serial).toBe('2026-0001');
    expect(typeof json.pdfBase64).toBe('string');
    expect(json.pdfBase64.length).toBeGreaterThan(100);
  });

  it('rejects creation with 500 when no signature is configured', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          serial: '2026-0001',
          dateIssued: '2026-05-28T00:00:00.000Z',
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const body = {
      donorName: 'Jane',
      donorAddress: '12 King',
      cityProvince: 'Windsor, ON',
      postalCode: 'N9A1A1',
      amount: '50',
      dateReceived: '2026-05-28',
    };
    const res = await handleReceiptsRequest(req('POST', '/api/receipts', { body }), {
      ...env,
      SIGNATURE_PNG_B64: '',
    });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('signature not configured');
  });

  it('cancels a receipt for an authorized user', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleReceiptsRequest(req('POST', '/api/receipts/2026-0001/cancel'), env);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('refuses a cancelled receipt PDF with 410', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          status: 'cancelled',
          driveFileId: '',
          pdfBase64: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleReceiptsRequest(req('GET', '/api/receipts/2026-0001/pdf'), env);
    expect(res.status).toBe(410);
  });

  it('serves the archived Drive PDF bytes on re-download (no regenerate)', async () => {
    const archived = env.SIGNATURE_PNG_B64; // any valid base64 payload stands in for stored PDF bytes
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ login: 'glenjackson' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          status: 'active',
          driveFileId: 'drv1',
          pdfBase64: archived,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const res = await handleReceiptsRequest(req('GET', '/api/receipts/2026-0001/pdf'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    const expected = Uint8Array.from(atob(archived), (c) => c.charCodeAt(0));
    expect(bytes).toEqual(expected);
  });

  it('omits access-control-allow-origin for a non-allowlisted origin', async () => {
    const res = await handleReceiptsRequest(
      req('OPTIONS', '/api/receipts', { headers: { origin: 'https://evil.example' } }),
      env,
    );
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
