import { expect, type APIRequestContext } from '@playwright/test';
import { categoriesTest } from '../fixtures/editor';

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

// Seed a category via the API (the question API takes a category ID).
async function createCategoryViaAPI(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/category', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Seed a question referencing the given category via the API.
async function createQuestion(
  request: APIRequestContext,
  category: string,
  question: string,
  answer: string,
): Promise<string> {
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: { category, question, answer },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

// Open the New category modal, optionally attach a scoring note (created
// inline via the note selector's "New" button), and submit. Then assert the
// category row appears in the list.
async function createCategory(
  page: import('@playwright/test').Page,
  name: string,
  note?: { name: string; description: string },
) {
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.ant-modal-title')).toHaveText('New category');
  await modal.locator('input[placeholder="Name"]').fill(name);

  if (note) {
    // Open the scoring-note selector and create a new note inline. The
    // dropdown's "New" button carries the plus-square icon, so its accessible
    // name is "plus-square New" — match loosely, scoped to the dropdown.
    await modal.locator('.ant-select').click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByRole('button', { name: /New/ })
      .click();
    const noteModal = page.locator('.ant-modal:has(.ant-modal-title)').filter({ hasText: 'New scoring note' });
    await expect(noteModal).toBeVisible();
    await noteModal.locator('input[placeholder="Name"]').fill(note.name);
    await noteModal.locator('textarea[placeholder="Description"]').fill(note.description);
    await noteModal.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(noteModal).toBeHidden();

    // Select the new note in the category modal's selector.
    await modal.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible').getByText(note.name, { exact: true }).click();
  }

  await modal.getByRole('button', { name: 'Create', exact: true }).click();
  // The (now closed) scoring-note modal stays mounted, so scope by title.
  await expect(page.locator('.ant-modal:has(.ant-modal-title)').filter({ hasText: 'New category' })).toBeHidden();
  await expect(page.locator('.category-list .ant-table-row').filter({ hasText: name })).toBeVisible();
}

categoriesTest.describe('categories CRUD', () => {
  categoriesTest('creates a category', async ({ categoriesPage }) => {
    const name = `e2e-cat-create-${unique()}`;
    await createCategory(categoriesPage, name);
    const card = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: name });
    await expect(card).toContainText('No scoring note');
  });

  categoriesTest('creates a category with a scoring note', async ({ categoriesPage }) => {
    const name = `e2e-cat-note-${unique()}`;
    await createCategory(categoriesPage, name, { name: 'Hint', description: `Hint text ${unique()}` });
    const card = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: name });
    await expect(card).toContainText(/Hint text/);
  });

  categoriesTest('edits a category (rename + scoring note)', async ({ categoriesPage }) => {
    const original = `e2e-cat-edit-${unique()}`;
    await createCategory(categoriesPage, original);

    const card = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: original });
    await card.locator('.anticon-edit').click();

    const modal = categoriesPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Edit category');

    const renamed = `e2e-cat-renamed-${unique()}`;
    await modal.locator('input[placeholder="Name"]').fill(renamed);

    // Attach a scoring note while editing.
    await modal.locator('.ant-select').click();
    await categoriesPage
      .locator('.ant-select-dropdown:visible')
      .getByRole('button', { name: /New/ })
      .click();
    const noteModal = categoriesPage.locator('.ant-modal:has(.ant-modal-title)').filter({ hasText: 'New scoring note' });
    await expect(noteModal).toBeVisible();
    await noteModal.locator('input[placeholder="Name"]').fill('Hint2');
    await noteModal.locator('textarea[placeholder="Description"]').fill(`Renamed hint ${unique()}`);
    await noteModal.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(noteModal).toBeHidden();
    await modal.locator('.ant-select').click();
    await categoriesPage.locator('.ant-select-dropdown:visible').getByText('Hint2', { exact: true }).click();

    await modal.getByRole('button', { name: 'Update', exact: true }).click();
    // The (now closed) scoring-note modal stays mounted, so scope by title.
    await expect(
      categoriesPage.locator('.ant-modal:has(.ant-modal-title)').filter({ hasText: 'Edit category' }),
    ).toBeHidden();

    const renamedCard = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: renamed });
    await expect(renamedCard).toBeVisible();
    await expect(renamedCard).toContainText(/Renamed hint/);
  });

  categoriesTest('deletes a category with confirmation', async ({ categoriesPage }) => {
    const name = `e2e-cat-delete-${unique()}`;
    await createCategory(categoriesPage, name);

    const card = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: name });
    await card.locator('.anticon-delete').click();
    const popover = categoriesPage.locator('.ant-popover:visible');
    await popover.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(card).toBeHidden();
  });
});

categoriesTest.describe('questions count popover', () => {
  // Ticket #272: clicking the "N questions" count Tag opens a popover with an
  // abbreviated question/answer preview. Seed a categorized question via the
  // API, then click the row's count Tag and assert the preview text appears.
  categoriesTest('opens a popover with the question/answer preview', async ({ categoriesPage, request }) => {
    const marker = `e2e-cat-pop-${unique()}`;
    const question = `Popover question ${marker}`;
    const answer = `Popover answer ${marker}`;
    const categoryId = await createCategoryViaAPI(request, `cat ${marker}`);
    await createQuestion(request, categoryId, question, answer);

    // Reload after seeding: the question list is cached client-side and only
    // invalidated by RTK mutations, so a raw API seed needs a fresh fetch before
    // the popover can resolve the question text.
    await categoriesPage.reload();
    await expect(categoriesPage.locator('.category-list')).toBeVisible();

    // Search so the freshly-created category lands on page 1.
    const input = categoriesPage.locator('input[placeholder="Search"]');
    await input.fill(`cat ${marker}`);
    await input.press('Enter');

    const row = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: `cat ${marker}` });
    await expect(row).toContainText('1 question');

    // Click the count Tag to open the preview popover.
    await row.locator('.ant-tag').click();
    const popover = categoriesPage.locator('.ant-popover:visible');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('1 question');
    await expect(popover).toContainText(question);
    await expect(popover).toContainText(answer);
  });
});
