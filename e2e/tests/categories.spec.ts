import { expect } from '@playwright/test';
import { categoriesTest } from '../fixtures/editor';

// A unique-ish suffix keeps every test's data distinct from anything left in
// the shared dev DB, so tests don't collide with each other or with leftovers.
const unique = () => String(Date.now());

// Open the New category modal, optionally attach a scoring note (created
// inline via the note selector's "New" button), and submit. Then assert the
// category card appears in the list.
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
  await expect(page.locator('.category-list .ant-card').filter({ hasText: name })).toBeVisible();
}

categoriesTest.describe('categories CRUD', () => {
  categoriesTest('creates a category', async ({ categoriesPage }) => {
    const name = `e2e-cat-create-${unique()}`;
    await createCategory(categoriesPage, name);
    const card = categoriesPage.locator('.category-list .ant-card').filter({ hasText: name });
    await expect(card).toContainText('No scoring note');
  });

  categoriesTest('creates a category with a scoring note', async ({ categoriesPage }) => {
    const name = `e2e-cat-note-${unique()}`;
    await createCategory(categoriesPage, name, { name: 'Hint', description: `Hint text ${unique()}` });
    const card = categoriesPage.locator('.category-list .ant-card').filter({ hasText: name });
    await expect(card).toContainText(/Hint text/);
  });

  categoriesTest('edits a category (rename + scoring note)', async ({ categoriesPage }) => {
    const original = `e2e-cat-edit-${unique()}`;
    await createCategory(categoriesPage, original);

    const card = categoriesPage.locator('.category-list .ant-card').filter({ hasText: original });
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

    const renamedCard = categoriesPage.locator('.category-list .ant-card').filter({ hasText: renamed });
    await expect(renamedCard).toBeVisible();
    await expect(renamedCard).toContainText(/Renamed hint/);
  });

  categoriesTest('deletes a category with confirmation', async ({ categoriesPage }) => {
    const name = `e2e-cat-delete-${unique()}`;
    await createCategory(categoriesPage, name);

    const card = categoriesPage.locator('.category-list .ant-card').filter({ hasText: name });
    await card.locator('.anticon-delete').click();
    const popover = categoriesPage.locator('.ant-popover:visible');
    await popover.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(card).toBeHidden();
  });
});
