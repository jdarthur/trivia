import { test as base, expect, type Page } from '@playwright/test';

// Dev-mode editor login helper, shared by editor suites (questions, rounds,
// games, collections). It logs the page in as the seeded dev-mode editor user
// "alice" against the --dev-mode backend and lands on a given editor route,
// waiting for that route's list shell to render.
//
// Why we navigate straight to the editor route with `?mockUser=<name>` instead
// of logging in on "/" and then navigating to the editor: the mock token is only
// applied while the URL carries the `?mockUser` param. App.jsx dispatches logout
// whenever the URL has no param and there is no Auth0 session, so a second full
// navigation to an editor route (without the param) would drop the token and
// show the "You must be logged in" guard. Keeping the param on every editor URL
// is the deterministic, self-contained login path the dev-mode mock supports.
export async function loginToEditor(page: Page, route: string, readySelector: string) {
  await page.goto(`/${route}?mockUser=alice`);
  await expect(page.locator(readySelector)).toBeVisible();
}

// editorTest / editorPage land on the Questions editor. Used by questions.spec.ts.
export const editorTest = base.extend<{ editorPage: Page }>({
  editorPage: async ({ page }, use) => {
    await loginToEditor(page, 'questions', '.question-list');
    await use(page);
  },
});

// roundsTest / roundsPage land on the Rounds editor.
export const roundsTest = base.extend<{ roundsPage: Page }>({
  roundsPage: async ({ page }, use) => {
    await loginToEditor(page, 'rounds', '.round_list');
    await use(page);
  },
});
