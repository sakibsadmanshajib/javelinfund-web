import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('FlagBar', () => {
  it('renders three stripes in flag order (navy, red, gold)', () => {
    const src = fs.readFileSync('src/components/FlagBar.astro', 'utf8');
    expect(src).toMatch(/--navy/);
    expect(src).toMatch(/--red/);
    expect(src).toMatch(/--gold/);
    // Stripes appear in correct order — navy occurs before red occurs before gold.
    const idxNavy = src.indexOf('--navy');
    const idxRed = src.indexOf('--red');
    const idxGold = src.indexOf('--gold');
    expect(idxNavy).toBeLessThan(idxRed);
    expect(idxRed).toBeLessThan(idxGold);
  });
});
