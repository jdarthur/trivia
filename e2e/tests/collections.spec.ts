import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { collectionsTest } from '../fixtures/editor';

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

// Seed a question via the API (the create/import/transfer flows need questions).
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

// Seed a collection via the API. Returns the created collection's id.
async function createCollection(
  request: APIRequestContext,
  name: string,
  questionIds: string[],
): Promise<string> {
  const res = await request.post('/editor/collections', {
    headers: { 'borttrivia-token': token },
    data: { name, questions: questionIds },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Delete a collection by name via the API (test cleanup). Safe no-op if not found.
async function deleteCollectionByName(request: APIRequestContext, name: string) {
  const res = await request.get('/editor/collections', { headers: { 'borttrivia-token': token } });
  expect(res.ok()).toBeTruthy();
  const { collections } = await res.json();
  const collection = collections.find((c: { name: string }) => c.name === name);
  if (collection) {
    const del = await request.delete(`/editor/collections/${collection.id}`, {
      headers: { 'borttrivia-token': token },
    });
    expect(del.ok()).toBeTruthy();
  }
}

// Wait for the dev-mode mock token to be applied before interacting. A direct
// editor load can render the list shell (`.round_list`) before App's token effect
// runs; opening New Collection in that window makes NewCollection's
// useGetQuestionsQuery 401 (short-circuited by the client's fetchFn, so no
// network request) and cache an empty transfer. The "Editor menu enabled" signal
// loginToGamesEditor uses confirms the token is set.
async function waitForMockToken(page: Page) {
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const editor = items.find((e) => (e.textContent || '').includes('Editor'));
    return !!editor && editor.getAttribute('aria-disabled') !== 'true';
  });
}

// Move a single question (matched by its unique text) from the Transfer's LEFT
// (source) list into the RIGHT (target) list inside the New Collection modal.
// Leftover questions accumulate in the shared dev DB across the whole run, so the
// target may not be on page 1: paginate the left list's .ant-pagination (bounded)
// until the item is visible, then check its checkbox and click the move-right arrow.
// Selectors target antd v6's Transfer DOM (`.ant-transfer-section`,
// `.ant-transfer-list-checkbox`, `.ant-transfer-actions`).
async function moveQuestionToTarget(page: Page, questionText: string) {
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  const leftList = modal.locator('.ant-transfer-section').first();
  const item = (q: string) =>
    leftList.locator('.ant-transfer-list-content-item').filter({ hasText: q });

  let found = false;
  for (let i = 0; i < 10; i++) {
    if (await item(questionText).isVisible()) {
      found = true;
      break;
    }
    const next = leftList.locator('.ant-pagination-next button');
    if (await next.isDisabled()) break;
    await next.click();
  }
  expect(found).toBeTruthy();

  const checkbox = item(questionText).locator('.ant-transfer-list-checkbox');
  await checkbox.click();
  await expect(checkbox).toHaveClass(/ant-checkbox-wrapper-checked/);

  // Click the move-right arrow in the transfer's actions column.
  await modal.locator('.ant-transfer-actions button:has(.anticon-right)').click();
  await expect(
    modal
      .locator('.ant-transfer-section')
      .last()
      .locator('.ant-transfer-list-content-item')
      .filter({ hasText: questionText }),
  ).toBeVisible();
}

// Create a collection through the UI: open the New Collection modal, type the
// name, move the given questions into the target list, and click Create.
async function createCollectionViaUI(page: Page, name: string, questionTexts: string[]) {
  await waitForMockToken(page);
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.ant-modal-title')).toHaveText('New Collection');

  await modal.locator('input[placeholder="Collection name"]').fill(name);

  for (const q of questionTexts) {
    await moveQuestionToTarget(page, q);
  }

  await modal.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.ant-card').filter({ hasText: name })).toBeVisible();
}

collectionsTest.describe('collections CRUD', () => {
  collectionsTest('creates a collection', async ({ collectionsPage, request }) => {
    const suffix = unique();
    const name = `e2e-col-create-${suffix}`;
    const category = `e2e-qcat-${suffix}`;
    const q1 = `Collection question A ${suffix}`;
    const q2 = `Collection question B ${suffix}`;
    await createQuestion(request, category, q1, 'Answer A');
    await createQuestion(request, category, q2, 'Answer B');

    // Re-navigate so the mock token is reliably applied before we interact. On a
    // fresh context the first load races with redux-persist rehydration (auth is
    // persisted), which can wipe the token the App effect just set; NewCollection's
    // useGetQuestionsQuery then 401-short-circuits and caches an empty transfer.
    // A reload restores the persisted token. (delete/import re-goto for the same
    // reason; rounds reloads before opening its questions modal.)
    await collectionsPage.goto('/collections?mockUser=alice');
    await expect(collectionsPage.locator('.round_list')).toBeVisible();

    await createCollectionViaUI(collectionsPage, name, [q1, q2]);

    const card = collectionsPage.locator('.ant-card').filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText('2 Questions');

    await deleteCollectionByName(request, name);
  });

  collectionsTest('imports a collection', async ({ collectionsPage, request }) => {
    const suffix = unique();
    const name = `e2e-col-import-${suffix}`;
    const category = `e2e-qcat-${suffix}`;
    const q1 = `Import question A ${suffix}`;
    const q2 = `Import question B ${suffix}`;
    const id1 = await createQuestion(request, category, q1, 'Answer A');
    const id2 = await createQuestion(request, category, q2, 'Answer B');
    const collectionId = await createCollection(request, name, [id1, id2]);

    // Navigate straight to the import URL, keeping `?mockUser` on it (a
    // param-less navigation would drop the mock token and show the login guard).
    await collectionsPage.goto(`/collections?import=${collectionId}&mockUser=alice`);

    const modal = collectionsPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toContainText('Import Collection');
    for (const q of [q1, q2]) {
      await expect(modal.locator('.ant-card').filter({ hasText: q })).toBeVisible();
    }

    await modal.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(modal).toContainText('Successfully imported collection');

    await deleteCollectionByName(request, name);
  });

  collectionsTest('deletes a collection', async ({ collectionsPage, request }) => {
    const suffix = unique();
    const name = `e2e-col-delete-${suffix}`;
    const category = `e2e-qcat-${suffix}`;
    const id1 = await createQuestion(request, category, `Delete question A ${suffix}`, 'Answer A');
    const id2 = await createQuestion(request, category, `Delete question B ${suffix}`, 'Answer B');
    await createCollection(request, name, [id1, id2]);

    // Reload the collections editor for a clean list state.
    await collectionsPage.goto('/collections?mockUser=alice');
    const card = collectionsPage.locator('.ant-card').filter({ hasText: name });
    await expect(card).toBeVisible();

    await card.locator('.anticon-delete').click();
    const popover = collectionsPage.locator('.ant-popover:visible');
    await popover.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(card).toBeHidden();
  });
});
