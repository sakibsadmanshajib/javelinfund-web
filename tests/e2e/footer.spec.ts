import { test, expect } from '@playwright/test';

test('footer lists charity number and motto', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer.footer');
  await expect(footer.getByText('BN 755722097 RR0001')).toBeVisible();
  await expect(footer.getByText("L'union fait la force.")).toBeVisible();
});
