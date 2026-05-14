// tests/unit/featured.test.ts
import { describe, it, expect } from 'vitest';
import { pickFeatured, pickFeaturedAll } from '../../src/lib/featured';

const mk = (featured: boolean, priority: number, id: string) => ({
  id,
  data: { featured, priority },
});

describe('pickFeatured', () => {
  it('returns highest-priority featured item', () => {
    const items = [mk(true, 5, 'a'), mk(true, 10, 'b'), mk(false, 99, 'c')];
    expect(pickFeatured(items)?.id).toBe('b');
  });

  it('returns undefined if none featured', () => {
    expect(pickFeatured([mk(false, 1, 'a')])).toBeUndefined();
  });
});

describe('pickFeaturedAll', () => {
  it('returns featured items sorted by priority desc', () => {
    const items = [mk(true, 1, 'a'), mk(true, 3, 'b'), mk(false, 99, 'c'), mk(true, 2, 'd')];
    expect(pickFeaturedAll(items).map((i) => i.id)).toEqual(['b', 'd', 'a']);
  });

  it('returns empty array when no items are featured', () => {
    expect(pickFeaturedAll([mk(false, 99, 'a')])).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(pickFeaturedAll([])).toEqual([]);
  });
});
