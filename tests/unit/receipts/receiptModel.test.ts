import { describe, it, expect } from 'vitest';
import { buildReceiptModel, CHARITY } from '../../../decap-oauth-worker/src/lib/receiptModel.js';

const good = {
  donorName: 'Jane Donor',
  donorAddress: '12 King St',
  cityProvince: 'Windsor, ON',
  postalCode: 'N9A 1A1',
  amount: '50.00',
  dateReceived: '2026-05-28',
};

describe('buildReceiptModel', () => {
  it('normalises a valid donation and carries fixed charity data', () => {
    const m = buildReceiptModel(good, {
      serial: '2026-0001',
      dateIssued: '2026-05-28T00:00:00.000Z',
    });
    expect(m.donorName).toBe('Jane Donor');
    expect(m.amount).toBe('50.00');
    expect(m.serial).toBe('2026-0001');
    expect(CHARITY.regNumber).toBe('75572 2097 RR0001');
    expect(CHARITY.address).toContain('N8L 0Z2');
  });
  it('rejects empty donor name', () => {
    expect(() =>
      buildReceiptModel(
        { ...good, donorName: '' },
        { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
      ),
    ).toThrow();
  });
  it('rejects non-numeric amount', () => {
    expect(() =>
      buildReceiptModel(
        { ...good, amount: 'abc' },
        { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
      ),
    ).toThrow();
  });
  it('formats amount to two decimals', () => {
    const m = buildReceiptModel(
      { ...good, amount: '50' },
      { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
    );
    expect(m.amount).toBe('50.00');
  });
  it('rejects scientific / hex / over-precise amounts', () => {
    for (const bad of ['1e2', '0x10', '10.999', 'abc', '']) {
      expect(() =>
        buildReceiptModel(
          { ...good, amount: bad },
          { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
        ),
      ).toThrow();
    }
  });
  it('accepts comma-grouped amounts', () => {
    expect(
      buildReceiptModel(
        { ...good, amount: '1,000.50' },
        { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
      ).amount,
    ).toBe('1000.50');
  });
  it('rejects malformed or far-future dates', () => {
    for (const bad of ['not-a-date', '2026-13-99', '3026-01-01']) {
      expect(() =>
        buildReceiptModel(
          { ...good, dateReceived: bad },
          { serial: '2026-0001', dateIssued: '2026-05-28T00:00:00.000Z' },
        ),
      ).toThrow();
    }
  });
  it('rejects an invalid issued dateIssued', () => {
    expect(() =>
      buildReceiptModel(good, { serial: '2026-0001', dateIssued: 'not-a-date' }),
    ).toThrow();
  });
});
