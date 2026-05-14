// src/lib/featured.ts
export interface FeaturedItem {
  data: { featured: boolean; priority: number };
}

export function pickFeatured<T extends FeaturedItem>(items: T[]): T | undefined {
  return items
    .filter((i) => i.data.featured)
    .sort((a, b) => b.data.priority - a.data.priority)[0];
}

export function pickFeaturedAll<T extends FeaturedItem>(items: T[]): T[] {
  return items.filter((i) => i.data.featured).sort((a, b) => b.data.priority - a.data.priority);
}
