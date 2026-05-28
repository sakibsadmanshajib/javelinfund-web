import { describe, it, expect } from 'vitest';
import { parseOAuthMessage, downloadBlobName } from '../../../src/lib/receiptsClient';

describe('parseOAuthMessage', () => {
  it('extracts the token from a Decap success message', () => {
    const msg = 'authorization:github:success:' + JSON.stringify({ token: 'abc', provider: 'github' });
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
