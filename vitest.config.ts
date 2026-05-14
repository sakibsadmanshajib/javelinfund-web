import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,astro}'],
      exclude: ['src/env.d.ts', 'src/**/*.test.ts'],
      reporter: ['text', 'html'],
    },
  },
});
