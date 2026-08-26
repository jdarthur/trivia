import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { roundsTest } from '../fixtures/editor';

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

// Categories are a root model (ticket #179): the editor question API takes a
// category ID, so seed a category first.
async function createCategory(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/category', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Seed a question via the API (the AddQuestionsModal needs questions to exist).
// Returns the created question's id.
async function createQuestion(
  request: APIRequestContext,
  category: string,
  question: string,
  answer: string,
): Promise<string> {
  const categoryId = await createCategory(request, category);
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: { category: categoryId, question, answer },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Wait for a round to be persisted server-side. The rounds editor optimistically
// shows the new card before the create POST completes; a full-page reload before
// that POST settles would abort it and lose the round, so tests that reload after
// creating must first confirm the round actually exists via the API.
async function waitForRoundPersisted(request: APIRequestContext, name: string) {
  await expect
    .poll(
      async () => {
        const res = await request.get('/editor/rounds', { headers: { 'borttrivia-token': token } });
        const { rounds } = await res.json();
        return rounds.some((r: { name: string }) => r.name === name);
      },
      { timeout: 10000 },
    )
    .toBeTruthy();
}

// Create a round through the UI: click New, type the name into .round-name,
// click Save, wait for the round card to appear in the list, and confirm it is
// persisted server-side (see waitForRoundPersisted).
async function createRoundViaUI(page: Page, request: APIRequestContext, name: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  await expect(page.locator('.round-name')).toBeVisible();
  await page.locator('.round-name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.ant-card').filter({ hasText: name })).toBeVisible();
  await waitForRoundPersisted(request, name);
}

// Reload the rounds editor for a clean state (the create flow leaves the round
// open/selected; a fresh load drops any transient selection).
async function reloadRounds(page: Page) {
  await page.goto('/rounds?mockUser=alice');
  await expect(page.locator('.round_list')).toBeVisible();
}

// Open a round's editor by clicking its card's Edit icon.
async function openRound(page: Page, name: string) {
  const card = page.locator('.ant-card').filter({ hasText: name });
  await card.locator('.anticon-edit').click();
  await expect(page.locator('.open-header')).toHaveText('Edit Round');
  await expect(page.locator('.round-name')).toBeVisible();
}

// Open the AddQuestionsModal, filter to `filterText` (the unique category
// prefix) so leftover questions from other tests don't page out our rows, select
// the rows matching each of `questionTexts`, and click Add.
async function addQuestions(page: Page, filterText: string, questionTexts: string[]) {
  await page.getByRole('button', { name: 'Add questions', exact: true }).click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();

  const search = modal.locator('input[placeholder="Search"]');
  await search.fill(filterText);
  await search.press('Enter');

  for (const q of questionTexts) {
    const row = modal.locator('.ant-table-tbody tr').filter({ hasText: q });
    await expect(row).toBeVisible();
    await row.locator('.ant-checkbox-wrapper').click();
    await expect(row.locator('.ant-checkbox-wrapper')).toHaveClass(/ant-checkbox-wrapper-checked/);
  }

  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(modal).toBeHidden();
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

roundsTest.describe('rounds CRUD', () => {
  roundsTest('creates a round', async ({ roundsPage, request }) => {
    const name = `e2e-round-create-${unique()}`;
    await createRoundViaUI(roundsPage, request, name);
    await expect(roundsPage.locator('.ant-card').filter({ hasText: name })).toContainText('Questions');

    await deleteRoundByName(request, name);
  });

  roundsTest('adds questions and sets the category title', async ({ roundsPage, request }) => {
    const suffix = unique();
    const name = `e2e-round-title-${suffix}`;
    const category = `e2e-qcat-${suffix}`;
    const q1 = `Round question A ${suffix}`;
    const q2 = `Round question B ${suffix}`;
    await createQuestion(request, category, q1, 'Answer A');
    await createQuestion(request, category, q2, 'Answer B');

    await createRoundViaUI(roundsPage, request, name);
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);

    // Update the round name (the category title).
    await roundsPage.locator('.round-name').fill(name);
    await addQuestions(roundsPage, category, [q1, q2]);

    // Both questions show under the Questions collapse panel.
    for (const q of [q1, q2]) {
      await expect(roundsPage.locator('.actionable-question').filter({ hasText: q })).toBeVisible();
    }

    // Persist and verify the category title survives a fresh load.
    await roundsPage.getByRole('button', { name: 'Save', exact: true }).click();
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);
    await expect(roundsPage.locator('.round-name')).toHaveValue(name);

    await deleteRoundByName(request, name);
  });

  roundsTest('removes a question', async ({ roundsPage, request }) => {
    const suffix = unique();
    const name = `e2e-round-remove-${suffix}`;
    const category = `e2e-qcat-${suffix}`;
    const q1 = `Remove question one ${suffix}`;
    const q2 = `Remove question two ${suffix}`;
    await createQuestion(request, category, q1, 'Answer one');
    await createQuestion(request, category, q2, 'Answer two');

    await createRoundViaUI(roundsPage, request, name);
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);
    await addQuestions(roundsPage, category, [q1, q2]);

    // Select one question and remove it.
    const target = roundsPage.locator('.actionable-question').filter({ hasText: q1 });
    await expect(target).toBeVisible();
    await target.click();
    await roundsPage.getByRole('button', { name: /Remove selected/ }).click();

    await expect(roundsPage.locator('.actionable-question').filter({ hasText: q1 })).toBeHidden();
    await expect(roundsPage.locator('.actionable-question').filter({ hasText: q2 })).toBeVisible();

    await deleteRoundByName(request, name);
  });

  roundsTest('opens the round view', async ({ roundsPage, request }) => {
    const name = `e2e-round-open-${unique()}`;
    await createRoundViaUI(roundsPage, request, name);
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);
    await expect(roundsPage.locator('.round-name')).toHaveValue(name);

    await deleteRoundByName(request, name);
  });

  roundsTest('deletes a round', async ({ roundsPage, request }) => {
    const name = `e2e-round-delete-${unique()}`;
    await createRoundViaUI(roundsPage, request, name);
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);

    await roundsPage.getByRole('button', { name: /Delete round/ }).click();
    await expect(roundsPage.locator('.ant-card').filter({ hasText: name })).toBeHidden();
  });
});
