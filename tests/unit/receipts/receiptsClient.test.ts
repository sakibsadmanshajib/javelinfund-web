import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  parseOAuthMessage,
  downloadBlobName,
  listReceipts,
  createReceipt,
  setToken,
  clearToken,
} from '../../../src/lib/receiptsClient';

describe('parseOAuthMessage', () => {
  it('extracts the token from a Decap success message', () => {
    const msg =
      'authorization:github:success:' + JSON.stringify({ token: 'abc', provider: 'github' });
    expect(parseOAuthMessage(msg)).toBe('abc');
  });
  it('returns null for unrelated messages', () => {
    expect(parseOAuthMessage('authorizing:github')).toBeNull();
    expect(parseOAuthMessage('garbage')).toBeNull();
  });
});

describe('downloadBlobName', () => {
  it('builds a filename from the serial', () => {
    expect(downloadBlobName('2026-0001')).toBe('receipt-2026-0001.pdf');
  });
});

describe('listReceipts/createReceipt network', () => {
  beforeEach(() => setToken('tok'));
  afterEach(() => {
    clearToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('listReceipts throws "not signed in" when no token', async () => {
    clearToken();
    await expect(listReceipts()).rejects.toThrow('not signed in');
  });
  it('listReceipts returns rows on ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, receipts: [{ serial: '2026-0001' }] }),
      })),
    );
    const rows = await listReceipts();
    expect(rows[0].serial).toBe('2026-0001');
  });
  it('listReceipts clears token + throws on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    );
    await expect(listReceipts()).rejects.toThrow('not authorized');
  });
  it('createReceipt throws on non-ok with server error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ ok: false, error: 'invalid amount' }),
      })),
    );
    await expect(createReceipt({ amount: 'x' })).rejects.toThrow('invalid amount');
  });
});
