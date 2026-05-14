import { test, expect } from '@playwright/test';

test('donate page lists featured tiers and Interac instructions', async ({ page }) => {
  await page.goto('/donate');
  const donate = page.locator('section.donate-page');
  await expect(donate.getByText('$400').first()).toBeVisible();
  await expect(donate.getByText('$1,500').first()).toBeVisible();
  await expect(donate.getByText('Sponsor a child', { exact: true })).toBeVisible();
  await expect(donate.getByText('Feed the orphans', { exact: true })).toBeVisible();
  await expect(donate.getByText(/donate@javelinfund\.ca/i).first()).toBeVisible();
});
