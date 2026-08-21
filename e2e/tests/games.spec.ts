import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { gamesTest } from '../fixtures/editor';

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
// Save, and wait for the game card to appear in the list.
async function createGameViaUI(page: Page, name: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  await expect(page.locator('.round-name')).toBeVisible();
  await page.locator('.round-name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.round-name')).toBeHidden();
  await expect(page.locator('.ant-card').filter({ hasText: name })).toBeVisible();
}

// Open a game's Edit Game modal by clicking its card's Edit icon.
async function openGame(page: Page, name: string) {
  const card = page.locator('.ant-card').filter({ hasText: name });
  await card.locator('.anticon-edit').click();
  await expect(page.locator('.ant-modal:has(.ant-modal-title)')).toBeVisible();
  await expect(page.locator('.ant-modal-title')).toHaveText('Edit Game');
  await expect(page.locator('.round-name')).toBeVisible();
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

    await expect(gamesPage.locator('.ant-card').filter({ hasText: name })).toContainText('0 Rounds');

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
    await expect(gamesPage.locator('.ant-card').filter({ hasText: name })).toBeHidden();
  });
});
