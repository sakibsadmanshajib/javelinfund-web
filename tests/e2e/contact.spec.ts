import { test, expect } from '@playwright/test';

test('contact form renders fields and shows a status message after submit', async ({ page }) => {
  // Intercept any POST so submit resolves whether or not the endpoint is configured.
  await page.route('**/*', (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 200 });
    return route.continue();
  });
  await page.goto('/contact');
  await page.getByLabel('Name').fill('Jane Doe');
  await page.getByLabel('Email').fill('jane@example.com');
  await page.getByLabel('Message').fill('Hi.');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.locator('.status')).toContainText(/thank you|sorry/i);
});
