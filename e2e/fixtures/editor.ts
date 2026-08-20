import { test as base, expect, type Page } from '@playwright/test';

// Dev-mode editor login fixture, shared by editor suites (questions, rounds,
// games, collections). It logs the page in as the seeded dev-mode editor user
// "alice" against the --dev-mode backend and lands on the Questions editor.
//
// Why we navigate straight to the editor route with `?mockUser=<name>` instead
// of logging in on "/" and then navigating to the editor: the mock token is only
// applied while the URL carries the `?mockUser` param. App.jsx dispatches logout
// whenever the URL has no param and there is no Auth0 session, so a second full
// navigation to `/questions` (without the param) would drop the token and show
// the "You must be logged in" guard. Keeping the param on every editor URL is
// the deterministic, self-contained login path the dev-mode mock supports.
export const editorTest = base.extend<{ editorPage: Page }>({
  editorPage: async ({ page }, use) => {
    await page.goto('/questions?mockUser=alice');
    await expect(page.locator('.question-list')).toBeVisible();
    await use(page);
  },
});
