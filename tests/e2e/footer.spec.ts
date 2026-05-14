import { test, expect } from '@playwright/test';

test('footer lists charity number and motto', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('BN 755722097 RR0001')).toBeVisible();
  await expect(page.getByText("L'union fait la force.")).toBeVisible();
});
