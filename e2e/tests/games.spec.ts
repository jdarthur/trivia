import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { gamesTest, loginToGamesEditor } from '../fixtures/editor';

// A unique-ish suffix keeps every test's data distinct from anything left in
// the shared dev DB, so tests don't collide with each other or with leftovers.
const unique = () => String(Date.now());

const DEV_USER = 'alice';

// Build the same unsigned (alg "none") dev-mode mock JWT the client produces for
// ?mockUser login (client/src/common/mockUser.js). The --dev-mode backend accepts
// it on the `borttrivia-token` header for the seeded dev user.
function b64url(s: string): string {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function buildMockToken(name: string): string {
  const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ sub: `dev|${name}`, exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  );
  return `${header}.${payload}.`;
}
const token = buildMockToken(DEV_USER);

// Seed a round via the API. Returns the created round's id.
async function createRound(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/round', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Create a game through the UI: click New, rename it in the Edit Game modal (the
// default name is today's date, so we always rename to a unique name), click
// Save, then search for it and wait for its table row to appear. Search is
// needed because the list is ordered oldest-first, so a freshly-created game
// (and any game created by an earlier test) can sit below the fold; searching
// brings the row we care about into view regardless of how many rows accumulated.
async function createGameViaUI(page: Page, name: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  await expect(page.locator('.round-name')).toBeVisible();
  await page.locator('.round-name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.round-name')).toBeHidden();
  await search(page, name);
  await expect(gameRow(page, name)).toBeVisible();
}

// Narrow the list to rows whose text matches `text` via the filter bar.
async function search(page: Page, text: string) {
  const input = page.locator('.filter_holder input[placeholder="Search"]');
  await input.fill(text);
  await input.press('Enter');
}

// The table row for a game whose row text matches `name`.
function gameRow(page: Page, name: string) {
  return page.locator('.round_list .ant-table-row').filter({ hasText: name });
}

// Open a game's Edit Game modal by clicking its table row's Edit icon.
async function openGame(page: Page, name: string) {
  await search(page, name);
  const row = gameRow(page, name);
  await expect(row).toBeVisible();
  await row.locator('.anticon-edit').click();
  await expect(page.locator('.ant-modal:has(.ant-modal-title)')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toHaveText('Edit Game');
  await expect(page.locator('.round-name')).toBeVisible();
}

// Create a game directly through the API (faster than the UI when a test just
// needs a known number of rows to exist). Returns the created game's id.
async function createGameViaApi(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/game', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

// Delete a game by name via the API (test cleanup). Safe no-op if not found.
async function deleteGameByName(request: APIRequestContext, name: string) {
  const res = await request.get('/editor/games', { headers: { 'borttrivia-token': token } });
  expect(res.ok()).toBeTruthy();
  const { games } = await res.json();
  const game = games.find((g: { name: string }) => g.name === name);
  if (game) {
    const del = await request.delete(`/editor/game/${game.id}`, {
      headers: { 'borttrivia-token': token },
    });
    expect(del.ok()).toBeTruthy();
  }
}

// Delete a round by name via the API (test cleanup). Safe no-op if not found.
async function deleteRoundByName(request: APIRequestContext, name: string) {
  const res = await request.get('/editor/rounds', { headers: { 'borttrivia-token': token } });
  expect(res.ok()).toBeTruthy();
  const { rounds } = await res.json();
  const round = rounds.find((r: { name: string }) => r.name === name);
  if (round) {
    const del = await request.delete(`/editor/round/${round.id}`, {
      headers: { 'borttrivia-token': token },
    });
    expect(del.ok()).toBeTruthy();
  }
}

gamesTest.describe('games CRUD', () => {
  gamesTest('creates a game', async ({ gamesPage, request }) => {
    const name = `e2e-game-create-${unique()}`;
    await createGameViaUI(gamesPage, name);

    await expect(gameRow(gamesPage, name).locator('.ant-table-cell').nth(2)).toContainText('0');

    await deleteGameByName(request, name);
  });

  gamesTest('adds a round', async ({ gamesPage, request }) => {
    const suffix = unique();
    const roundName = `e2e-game-round-${suffix}`;
    const gameName = `e2e-game-rounds-${suffix}`;
    await createRound(request, roundName);

    await createGameViaUI(gamesPage, gameName);
    await openGame(gamesPage, gameName);

    // Go to the "Add Rounds" tab and select the seeded (unused) round.
    await gamesPage.getByRole('tab', { name: 'Add Rounds', exact: true }).click();
    const roundCard = gamesPage.locator('.ant-card').filter({ hasText: roundName });
    await expect(roundCard).toBeVisible();
    await roundCard.locator('.anticon-plus-square').click();

    // Switching back to the "Edit" tab commits the selected rounds into the game.
    await gamesPage.getByRole('tab', { name: 'Edit', exact: true }).click();
    await gamesPage.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(gamesPage.locator('.round-name')).toBeHidden();

    // Re-open the game and verify the round shows under the rounds list. The
    // committed round gets a game-specific name "Round 1" (the RemovableRound Input).
    await openGame(gamesPage, gameName);
    await expect(gamesPage.locator('.removable-round input')).toHaveValue('Round 1');

    await deleteGameByName(request, gameName);
    await deleteRoundByName(request, roundName);
  });

  gamesTest('opens the game view', async ({ gamesPage, request }) => {
    const name = `e2e-game-open-${unique()}`;
    await createGameViaUI(gamesPage, name);
    await openGame(gamesPage, name);
    await expect(gamesPage.locator('.round-name')).toHaveValue(name);

    await deleteGameByName(request, name);
  });

  gamesTest('deletes a game', async ({ gamesPage }) => {
    const name = `e2e-game-delete-${unique()}`;
    await createGameViaUI(gamesPage, name);
    await openGame(gamesPage, name);

    await gamesPage.getByRole('button', { name: /Delete game/ }).click();
    await expect(gameRow(gamesPage, name)).toHaveCount(0);
  });

  // Ticket #288: a games list longer than one page must show the shared footer
  // pager and cap the rendered rows at the page size (the table scrolls inside
  // its container), instead of sprawling past the bottom of the viewport. The
  // other games tests always search down to a single row, so none of them
  // exercised the multi-page path.
  gamesTest('paginates a long games list with a footer pager', async ({ gamesPage, request }) => {
    const marker = unique();
    const created: string[] = [];
    for (let i = 0; i < 12; i++) {
      created.push(await createGameViaApi(request, `e2e-pager-${marker}-${i}`));
    }

    try {
      // Remount GameList so it refetches and sees the freshly seeded games.
      await loginToGamesEditor(gamesPage);
      await search(gamesPage, `e2e-pager-${marker}`);

      const pager = gamesPage.locator('.list-pagination');
      await expect(pager).toBeVisible();
      await expect(pager).toContainText('1-10 of 12');
      await expect(gamesPage.locator('.round_list .ant-table-row')).toHaveCount(10);

      // Page 2 holds the remainder.
      await pager.locator('.ant-pagination-item-2').click();
      await expect(gamesPage.locator('.round_list .ant-table-row')).toHaveCount(2);
      await expect(pager).toContainText('11-12 of 12');
    } finally {
      for (const id of created) {
        await request.delete(`/editor/game/${id}`, { headers: { 'borttrivia-token': token } });
      }
    }
  });
});
