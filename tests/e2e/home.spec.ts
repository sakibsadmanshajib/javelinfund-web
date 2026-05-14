import { test, expect } from '@playwright/test';

test('home shows hero, motto, programs, donate strip', async ({ page }) => {
  await page.goto('/');

  // Hero headline (only on home)
  await expect(page.getByRole('heading', { name: /hope is a plan/i })).toBeVisible();

  // Motto appears in both MottoBand and Footer — scope to the motto band
  await expect(
    page.locator('section.motto-band').getByText("L'union fait la force."),
  ).toBeVisible();

  // Stat "325" — scope to the stats section (avoid matching program meta "325 children")
  await expect(page.locator('section.stats').getByText('325', { exact: true })).toBeVisible();

  // Programs section heading
  await expect(
    page.getByRole('heading', { name: /our work,\s*in the north\./i }),
  ).toBeVisible();

  // Sponsor-a-child tier — scope to the donate strip
  await expect(
    page.locator('section.donate').getByText(/sponsor a child/i),
  ).toBeVisible();
});
