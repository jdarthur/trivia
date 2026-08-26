import { expect } from '@playwright/test';
import { editorTest } from '../fixtures/editor';
import type { Page } from '@playwright/test';

// A unique-ish suffix keeps every test's data distinct from anything left in
// the shared dev DB, so tests don't collide with each other or with leftovers.
const unique = () => String(Date.now());

// Open the "Add question" modal, walk the three-step flow, save, and wait for
// the new row to appear in the list. (Ticket #166: multi-step form.)
async function createQuestion(page: Page, category: string, question: string, answer: string) {
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();

  // Step 1: Basic info — fill the category, then advance.
  await modal.locator('#category').fill(category);
  await modal.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: Question editor — fill question + answer, then advance.
  await modal.locator('#question').fill(question);
  await modal.locator('#answer').fill(answer);
  await modal.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: Preview — submit.
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

    // Advance to step 2 (Question editor) to edit the question text.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await modal.locator('#question').fill('Updated question');

    // Advance to step 3 (Preview) and submit.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
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

// Ticket #166: changing the question type is gated by a confirmation tooltip
// and clears the question + answer values on confirm.
editorTest.describe('question type change (ticket #166)', () => {
  editorTest('changing the type clears question + answer after confirmation', async ({ editorPage }) => {
    const cat = `e2e-type-${unique()}`;
    await createQuestion(editorPage, cat, 'Original question', 'Original answer');

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat });
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Edit question');

    // Step 1 (Basic info): switch the type to "Multiple choice".
    await modal.locator('.ant-radio-button-wrapper', { hasText: 'Multiple choice' }).click();

    // The confirmation tooltip appears.
    const confirm = editorPage.locator('.ant-popover:visible');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Change', exact: true }).click();

    // Advance to step 2 (Question editor): the question is cleared and the
    // choices view replaces the freeform answer box.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.locator('#question')).toHaveValue('');
    await expect(modal.locator('#answer')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: /Add choice/ })).toBeVisible();

    // Dismiss without saving: go back to step 1 and clear the category so the
    // form is empty (the modal's X button saves when any field is filled).
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await modal.locator('#category').fill('');
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();

    await deleteQuestion(editorPage, cat);
  });

  editorTest('canceling the type-change confirmation keeps the original type', async ({ editorPage }) => {
    const cat = `e2e-type-cancel-${unique()}`;
    await createQuestion(editorPage, cat, 'Original question', 'Original answer');

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: cat });
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();

    // Step 1: attempt to switch to "Multiple choice", then cancel.
    await modal.locator('.ant-radio-button-wrapper', { hasText: 'Multiple choice' }).click();
    const confirm = editorPage.locator('.ant-popover:visible');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Advance to step 2: the type is still freeform, so the answer box is present.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.locator('#answer')).toBeVisible();
    await expect(modal.locator('#question')).toHaveValue('Original question');

    // Dismiss the modal without saving.
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();

    await deleteQuestion(editorPage, cat);
  });

  editorTest('no confirmation when the question has no content yet', async ({ editorPage }) => {
    // Opening "Add question" — nothing is filled in, so switching the type
    // should change immediately with no confirmation tooltip.
    await editorPage.getByRole('button', { name: /New/ }).first().click();
    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Add question');

    // Step 1 (Basic info): switch the type to "Multiple choice".
    await modal.locator('.ant-radio-button-wrapper', { hasText: 'Multiple choice' }).click();

    // No confirmation tooltip appears.
    await expect(editorPage.locator('.ant-popover:visible')).toHaveCount(0);

    // Advance to step 2: the type is already multiple choice, so the choices
    // view (not the freeform answer box) is shown.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByRole('button', { name: /Add choice/ })).toBeVisible();
    await expect(modal.locator('#answer')).toHaveCount(0);

    // Dismiss without saving (the form is empty, so the X button just closes).
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();
  });
});
