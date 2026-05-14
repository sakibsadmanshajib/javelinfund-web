import { test, expect } from '@playwright/test';

test('stories index lists Marie-Carline story', async ({ page }) => {
  await page.goto('/stories');
  await expect(page.getByRole('heading', { name: /from the north/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /the week that changed everything/i })).toBeVisible();
});

test('individual story renders content', async ({ page }) => {
  await page.goto('/stories');
  await page.getByRole('link', { name: /the week that changed everything/i }).click();
  await expect(
    page.getByRole('heading', { name: /the week that changed everything/i }),
  ).toBeVisible();
});
