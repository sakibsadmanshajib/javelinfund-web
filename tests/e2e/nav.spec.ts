import { test, expect } from '@playwright/test';

test('nav has logo and donate link', async ({ page }) => {
  await page.goto('/');
  const topNav = page.locator('nav.top');
  await expect(topNav.getByRole('link', { name: /javelin fund — home/i })).toBeVisible();
  await expect(topNav.getByRole('link', { name: /donate/i })).toBeVisible();
});
