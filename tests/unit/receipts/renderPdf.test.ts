import { describe, it, expect } from 'vitest';
import { renderReceiptPdf } from '../../../decap-oauth-worker/src/lib/renderPdf.js';
import { buildReceiptModel } from '../../../decap-oauth-worker/src/lib/receiptModel.js';

const model = buildReceiptModel(
  { donorName: 'Jane Donor', donorAddress: '12 King St', cityProvince: 'Windsor, ON',
    postalCode: 'N9A 1A1', amount: '50.00', dateReceived: '2026-05-28' },
  { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
);

describe('renderReceiptPdf', () => {
  it('produces a non-empty PDF byte stream', async () => {
    const bytes = await renderReceiptPdf(model, null);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(800);
    expect(bytes[0]).toBe(0x25);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x44);
    expect(bytes[3]).toBe(0x46);
  });
  it('still renders when no signature is supplied', async () => {
    const bytes = await renderReceiptPdf(model, null);
    expect(bytes.length).toBeGreaterThan(800);
  });
});
