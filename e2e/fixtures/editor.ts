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

// loginToGamesEditor lands on the Games editor. Unlike questions/rounds, a
// direct `goto('/games?mockUser=alice')` mounts GameList before App's mock-token
// effect has run, so GameList's single /editor/games fetch 401s and the list is
// never populated (state.games ends up undefined and the "New" button crashes).
// So we first land on "/" (with mockUser) to let the token get set, then navigate
// client-side to the games route so GameList mounts with the token already in hand.
export async function loginToGamesEditor(page: Page) {
  await page.goto('/?mockUser=alice');
  // Wait until the mock token is set: the Editor submenu is disabled until
  // App's token state is populated (showEditor = !!token).
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const editor = items.find((e) => (e.textContent || '').includes('Editor'));
    return !!editor && editor.getAttribute('aria-disabled') !== 'true';
  });
  await page.evaluate(() => {
    history.pushState({}, '', '/games?mockUser=alice');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.round_list')).toBeVisible();
}

// gamesTest / gamesPage land on the Games editor. The games list shares the
// `round_list` shell class with rounds (GameList.jsx passes class_name="round_list"
// to LoadingOrView).
export const gamesTest = base.extend<{ gamesPage: Page }>({
  gamesPage: async ({ page }, use) => {
    await loginToGamesEditor(page);
    await use(page);
  },
});

// collectionsTest / collectionsPage land on the Collections editor. Like rounds,
// a direct goto with `?mockUser` works (CollectionList.jsx renders the same
// `round_list` shell class); it is NOT the games special-case that needs the
// client-side navigation.
export const collectionsTest = base.extend<{ collectionsPage: Page }>({
  collectionsPage: async ({ page }, use) => {
    await loginToEditor(page, 'collections', '.round_list');
    await use(page);
  },
});
