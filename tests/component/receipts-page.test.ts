import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('receipts page', () => {
  const src = fs.readFileSync('src/pages/admin/receipts.astro', 'utf8');
  it('has a sign-in button and the donation form fields', () => {
    expect(src).toMatch(/id="signin"/);
    expect(src).toMatch(/name="donorName"/);
    expect(src).toMatch(/name="amount"/);
    expect(src).toMatch(/name="dateReceived"/);
  });
  it('imports the receipts client', () => {
    expect(src).toMatch(/receiptsClient/);
  });
  it('is noindex (not crawlable)', () => {
    expect(src).toMatch(/noindex/);
  });
});
