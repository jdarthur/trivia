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

// Seed a question via the API (the round editor's Transfer needs questions to
// exist). Returns the created question's id.
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

// Wait for a round to be persisted server-side. The rounds editor creates via a
// mutation and refetches the list, but a full-page reload before that POST
// settles would abort it and lose the round, so tests that reload after
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

// Create a round through the UI (ticket #199): click New, type the name on the
// Details step, advance to the Questions step, and click Add. Wait for the new
// row to appear in the table and confirm it is persisted server-side (see
// waitForRoundPersisted).
async function createRoundViaUI(page: Page, request: APIRequestContext, name: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.ant-modal-title')).toHaveText('Add round');
  await expect(page.locator('.round-name')).toBeVisible();
  await page.locator('.round-name').fill(name);
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(roundRow(page, name)).toBeVisible();
  await waitForRoundPersisted(request, name);
}

// Reload the rounds editor for a clean state (the create flow leaves the modal
// closed; a fresh load drops any transient selection).
async function reloadRounds(page: Page) {
  await page.goto('/rounds?mockUser=alice');
  await expect(page.locator('.round_list')).toBeVisible();
}

// The table row for a round whose row text matches `name`.
function roundRow(page: Page, name: string) {
  return page.locator('.round_list .ant-table-row').filter({ hasText: name });
}

// Open a round's editor modal by clicking its table row's Edit icon. The modal
// always starts on the Details step.
async function openRound(page: Page, name: string) {
  await expect(roundRow(page, name)).toBeVisible();
  await roundRow(page, name).locator('.anticon-edit').click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.ant-modal-title')).toHaveText('Edit round');
  await expect(page.locator('.round-name')).toBeVisible();
}

// Move a single question (matched by its unique text) from the Transfer's LEFT
// (source) list into the RIGHT (target) list inside the round modal's Questions
// step. Leftover questions accumulate in the shared dev DB across the whole run,
// so the target may not be on page 1: paginate the left list's .ant-pagination
// (bounded) until the item is visible, then check its checkbox and click the
// move-right arrow. Selectors target antd v6's Transfer DOM
// (`.ant-transfer-section`, `.ant-transfer-list-checkbox`, `.ant-transfer-actions`).
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

// The round editor opens on the Details step; advance to the Questions step and
// move each of `questionTexts` into the Transfer's target list, then save.
async function addQuestions(page: Page, questionTexts: string[]) {
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await modal.getByRole('button', { name: 'Next', exact: true }).click();
  for (const q of questionTexts) {
    await moveQuestionToTarget(page, q);
  }
  await modal.getByRole('button', { name: 'Update', exact: true }).click();
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
    await expect(roundRow(roundsPage, name)).toContainText('0 questions');

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

    // Update the round name (the category title) and add both questions via the
    // Transfer on the Questions step.
    await roundsPage.locator('.round-name').fill(name);
    await addQuestions(roundsPage, [q1, q2]);

    // The row's question count reflects the two added questions.
    await expect(roundRow(roundsPage, name)).toContainText('2 questions');

    // Persist and verify the category title survives a fresh load.
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);
    await expect(roundsPage.locator('.round-name')).toHaveValue(name);

    // Both questions are still in the Transfer's target list.
    await roundsPage.getByRole('button', { name: 'Next', exact: true }).click();
    const rightList = roundsPage.locator('.ant-modal:has(.ant-modal-title) .ant-transfer-section').last();
    for (const q of [q1, q2]) {
      await expect(rightList.locator('.ant-transfer-list-content-item').filter({ hasText: q })).toBeVisible();
    }

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
    await addQuestions(roundsPage, [q1, q2]);

    // Reopen and move q1 back out of the target list on the Questions step.
    await reloadRounds(roundsPage);
    await openRound(roundsPage, name);
    const modal = roundsPage.locator('.ant-modal:has(.ant-modal-title)');
    await modal.getByRole('button', { name: 'Next', exact: true }).click();

    const rightList = modal.locator('.ant-transfer-section').last();
    const target = rightList.locator('.ant-transfer-list-content-item').filter({ hasText: q1 });
    await expect(target).toBeVisible();
    await target.locator('.ant-transfer-list-checkbox').click();
    await modal.locator('.ant-transfer-actions button:has(.anticon-left)').click();
    await expect(
      rightList.locator('.ant-transfer-list-content-item').filter({ hasText: q1 }),
    ).toHaveCount(0);
    await expect(
      rightList.locator('.ant-transfer-list-content-item').filter({ hasText: q2 }),
    ).toBeVisible();

    // Save and confirm the row now shows one question.
    await modal.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(roundRow(roundsPage, name)).toContainText('1 question');

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

    await roundsPage.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(roundRow(roundsPage, name)).toHaveCount(0);
  });
});
