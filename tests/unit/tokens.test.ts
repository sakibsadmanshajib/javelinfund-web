import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('tokens.css', () => {
  it('declares brand palette and type tokens', () => {
    const css = fs.readFileSync('src/styles/tokens.css', 'utf8');
    expect(css).toContain('--navy: #0a1a3f');
    expect(css).toContain('--red: #d62828');
    expect(css).toContain('--gold: #ffd60a');
    expect(css).toContain('--ivory: #fafaf7');
    expect(css).toContain("--font-display: 'Archivo Black'");
    expect(css).toContain("--font-accent: 'Playfair Display'");
    expect(css).toContain("--font-body: 'Inter'");
  });
});
