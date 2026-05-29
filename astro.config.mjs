import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://javelinfund.ca',
  output: 'static',
  trailingSlash: 'never',
  // Inline all CSS into <style> tags to remove render-blocking stylesheet
  // requests and the external CSS request chain (Lighthouse perf wins).
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
});
