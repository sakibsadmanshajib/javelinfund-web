// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const stories = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      excerpt: z.string(),
      date: z.coerce.date(),
      hero: image(),
      featured: z.boolean().default(false),
      priority: z.number().default(0),
      location: z.string().optional(),
      person: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }),
});

const team = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      role: z.string(),
      photo: image(),
      order: z.number().default(100),
      bio: z.string().optional(),
    }),
});

const donateTiers = defineCollection({
  type: 'data',
  schema: z.object({
    amount: z.union([z.number(), z.literal('custom')]),
    frequency: z.enum(['one-time', 'monthly', 'yearly', 'custom']),
    label: z.string(),
    sub: z.string(),
    featured: z.boolean().default(false),
    priority: z.number().default(0),
    ribbon: z.string().optional(),
    canada_helps_url: z.string().url().optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

export const collections = { stories, team, donateTiers, pages };
