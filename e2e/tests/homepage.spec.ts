import { test, expect } from '@playwright/test';

// Minimal smoke test proving the harness works end-to-end: the client is built,
// the Go API is booted against a temp SQLite DB, and the API serves the built
// client from /. The editor routes require Auth0, so this only asserts that the
// anonymous homepage shell renders.
test('homepage renders', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Bort Trivia');
  await expect(page.getByRole('button', { name: 'New Game' })).toBeVisible();
});
