import { test, expect } from '@playwright/test';

test('nav has logo and donate link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /javelin fund — home/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /donate/i })).toBeVisible();
});
