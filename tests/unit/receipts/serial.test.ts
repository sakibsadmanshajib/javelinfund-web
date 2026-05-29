import { describe, it, expect } from 'vitest';
import { formatSerial, parseSerial } from '../../../decap-oauth-worker/src/lib/serial.js';

describe('formatSerial', () => {
  it('zero-pads to 4 digits with year prefix', () => {
    expect(formatSerial(2026, 1)).toBe('2026-0001');
    expect(formatSerial(2026, 42)).toBe('2026-0042');
    expect(formatSerial(2026, 9999)).toBe('2026-9999');
  });
  it('throws if the number exceeds 9999', () => {
    expect(() => formatSerial(2026, 10000)).toThrow();
  });
});

describe('parseSerial', () => {
  it('round-trips', () => {
    expect(parseSerial('2026-0042')).toEqual({ year: 2026, num: 42 });
  });
  it('rejects an out-of-range serial number', () => {
    expect(() => parseSerial('2026-0000')).toThrow();
  });
});
