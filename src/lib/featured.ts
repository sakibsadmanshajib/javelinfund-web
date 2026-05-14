// src/lib/featured.ts

/** Minimal contract for items consumed by featured selectors — any object with `data.featured` (boolean) and `data.priority` (number). */
export interface FeaturedItem {
  data: { featured: boolean; priority: number };
}

/** Pick the highest-priority featured item, or `undefined` if none are featured. */
export function pickFeatured<T extends FeaturedItem>(items: T[]): T | undefined {
  return items.filter((i) => i.data.featured).sort((a, b) => b.data.priority - a.data.priority)[0];
}

/** All featured items, sorted by `priority` descending. Returns `[]` if none are featured. */
export function pickFeaturedAll<T extends FeaturedItem>(items: T[]): T[] {
  return items.filter((i) => i.data.featured).sort((a, b) => b.data.priority - a.data.priority);
}
