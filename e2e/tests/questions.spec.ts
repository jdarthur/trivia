import { expect } from '@playwright/test';
import { editorTest } from '../fixtures/editor';
import type { Page } from '@playwright/test';

// A unique-ish suffix keeps every test's data distinct from anything left in
// the shared dev DB, so tests don't collide with each other or with leftovers.
const unique = () => String(Date.now());

// Open the "Add question" modal, fill category/question/answer, save, and wait
// for the new row to appear in the list.
async function createQuestion(page: Page, category: string, question: string, answer: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await modal.locator('#category').fill(category);
  await modal.locator('#question').fill(question);
  await modal.locator('#answer').fill(answer);
  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.ant-table-tbody tr').filter({ hasText: category })).toBeVisible();
}

// Delete the row whose text matches `category` via its delete-confirm control.
async function deleteQuestion(page: Page, category: string) {
  const row = page.locator('.ant-table-tbody tr').filter({ hasText: category });
  await row.locator('.anticon-delete').click();
  const popover = page.locator('.ant-popover:visible');
  await popover.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toBeHidden();
}

editorTest.describe('questions CRUD', () => {
  editorTest('list renders', async ({ editorPage }) => {
    // The dev DB is a scratch file recreated per webServer boot, so the list is
    // empty here. Asserting the list shell renders (empty state is acceptable).
    await expect(editorPage.locator('.question-list')).toBeVisible();
    await expect(editorPage.getByRole('button', { name: /New/ })).toBeVisible();
  });

  editorTest('creates a question', async ({ editorPage }) => {
    const cat = `e2e-create-${unique()}`;
    await createQuestion(editorPage, cat, 'What is 2+2?', 'Four');
    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat });
    await expect(row).toContainText('What is 2+2?');
    await expect(row).toContainText('Four');

    await deleteQuestion(editorPage, cat);
  });

  editorTest('edits a question', async ({ editorPage }) => {
    const cat = `e2e-edit-${unique()}`;
    await createQuestion(editorPage, cat, 'Original question', 'Original answer');

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat });
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Edit question');
    await modal.locator('#question').fill('Updated question');
    await modal.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(modal).toBeHidden();

    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat })).toContainText('Updated question');

    await deleteQuestion(editorPage, cat);
  });

  editorTest('deletes a question', async ({ editorPage }) => {
    const cat = `e2e-delete-${unique()}`;
    await createQuestion(editorPage, cat, 'Question to delete', 'Answer');
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat })).toBeVisible();

    await deleteQuestion(editorPage, cat);
  });
});
