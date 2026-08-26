import { expect } from '@playwright/test';
import { editorTest } from '../fixtures/editor';
import type { Page } from '@playwright/test';

// A unique-ish suffix keeps every test's data distinct from anything left in
// the shared dev DB, so tests don't collide with each other or with leftovers.
const unique = () => String(Date.now());

// Create a category through the categories editor UI, then return to the
// questions editor. Ticket #180: the question editor no longer has a
// free-text category input — the question stores the selected category's ID.
async function createCategory(page: Page, name: string) {
  await page.goto('/categories?mockUser=alice');
  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();
  await modal.locator('input[placeholder="Name"]').fill(name);
  await modal.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(modal).toBeHidden();

  await page.goto('/questions?mockUser=alice');
  await expect(page.locator('.question-list')).toBeVisible();
}

// Open the "Add question" modal, walk the three-step flow, save, and wait for
// the new row to appear in the list. (Ticket #166: multi-step form.) When a
// category name is given, create it first and select it on step 1 (Basic
// info); otherwise the question is created without a category.
async function createQuestion(page: Page, question: string, answer: string, category?: string) {
  if (category) {
    await createCategory(page, category);
  }

  await page.getByRole('button', { name: /New/ }).first().click();
  const modal = page.locator('.ant-modal:has(.ant-modal-title)');
  await expect(modal).toBeVisible();

  // Step 1: Basic info — pick the category (selector of the user's
  // categories), then advance.
  if (category) {
    await modal.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown:visible').getByText(category, { exact: true }).click();
  }
  await modal.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: Question editor — fill question + answer, then advance.
  await modal.locator('#question').fill(question);
  await modal.locator('#answer').fill(answer);
  await modal.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: Preview — submit.
  await modal.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('.ant-table-tbody tr').filter({ hasText: question })).toBeVisible();
}

// Delete the row whose text matches `question` via its delete-confirm control.
async function deleteQuestion(page: Page, question: string) {
  const row = page.locator('.ant-table-tbody tr').filter({ hasText: question });
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
    const question = `What is 2+2? ${unique()}`;
    const category = `General ${unique()}`;
    await createQuestion(editorPage, question, 'Four', category);
    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: question });
    await expect(row).toContainText('What is 2+2?');
    await expect(row).toContainText('Four');
    // The category column shows the category's name, resolved from its ID
    // (ticket #180).
    await expect(row).toContainText(category);

    await deleteQuestion(editorPage, question);
  });

  editorTest('edits a question', async ({ editorPage }) => {
    const question = `Original question ${unique()}`;
    const category = `Editable ${unique()}`;
    const updated = `Updated question ${unique()}`;
    await createQuestion(editorPage, question, 'Original answer', category);

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: question });
    await expect(row).toContainText(category);
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Edit question');

    // Editing an existing question opens on step 2 (Question editor) directly.
    await expect(modal.locator('#question')).toBeVisible();
    await modal.locator('#question').fill(updated);

    // Advance to step 3 (Preview) and submit.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await modal.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(modal).toBeHidden();

    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: updated })).toContainText(updated);

    await deleteQuestion(editorPage, updated);
  });

  editorTest('deletes a question', async ({ editorPage }) => {
    const question = `Question to delete ${unique()}`;
    await createQuestion(editorPage, question, 'Answer');
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: question })).toBeVisible();

    await deleteQuestion(editorPage, question);
  });
});

// Ticket #166: changing the question type is gated by a confirmation tooltip
// and clears the question + answer values on confirm.
editorTest.describe('question type change (ticket #166)', () => {
  editorTest('changing the type clears question + answer after confirmation', async ({ editorPage }) => {
    const question = `Original question ${unique()}`;
    await createQuestion(editorPage, question, 'Original answer');

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: question });
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Edit question');

    // Editing an existing question opens on step 2; go back to step 1 (Basic
    // info) to change the type.
    await modal.getByRole('button', { name: 'Back', exact: true }).click();

    // Step 1 (Basic info): switch the type to "Multiple choice".
    await modal.locator('.ant-radio-wrapper', { hasText: 'Multiple choice' }).click();

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

    // Dismiss without saving: go back to step 1 — the form is empty (no
    // category, cleared question/answer), so the modal's X button just closes.
    await modal.getByRole('button', { name: 'Back', exact: true }).click();
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();

    await deleteQuestion(editorPage, question);
  });

  editorTest('canceling the type-change confirmation keeps the original type', async ({ editorPage }) => {
    const question = `Original question ${unique()}`;
    await createQuestion(editorPage, question, 'Original answer');

    const row = editorPage.locator('.ant-table-tbody tr').filter({ hasText: question });
    await row.locator('.anticon-edit').click();

    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();

    // Editing an existing question opens on step 2; go back to step 1 to
    // change the type.
    await modal.getByRole('button', { name: 'Back', exact: true }).click();

    // Step 1: attempt to switch to "Multiple choice", then cancel.
    await modal.locator('.ant-radio-wrapper', { hasText: 'Multiple choice' }).click();
    const confirm = editorPage.locator('.ant-popover:visible');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Advance to step 2: the type is still freeform, so the answer box is present.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.locator('#answer')).toBeVisible();
    await expect(modal.locator('#question')).toHaveValue(question);

    // Dismiss the modal without saving.
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();

    await deleteQuestion(editorPage, question);
  });

  editorTest('no confirmation when the question has no content yet', async ({ editorPage }) => {
    // Opening "Add question" — nothing is filled in, so switching the type
    // should change immediately with no confirmation tooltip.
    await editorPage.getByRole('button', { name: /New/ }).first().click();
    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Add question');

    // Step 1 (Basic info): switch the type to "Multiple choice".
    await modal.locator('.ant-radio-wrapper', { hasText: 'Multiple choice' }).click();

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

  editorTest('multiple-choice requires a correct answer before advancing to Preview', async ({ editorPage }) => {
    await editorPage.getByRole('button', { name: /New/ }).first().click();
    const modal = editorPage.locator('.ant-modal:has(.ant-modal-title)');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.ant-modal-title')).toHaveText('Add question');

    // Step 1 (Basic info): switch to Multiple choice, then advance.
    await modal.locator('.ant-radio-wrapper', { hasText: 'Multiple choice' }).click();
    await modal.getByRole('button', { name: 'Next', exact: true }).click();

    // Step 2 (Question editor): add two choices.
    const addChoice = modal.getByRole('button', { name: /Add choice/ });
    await addChoice.click();
    await addChoice.click();
    await modal.locator('input[placeholder="Choice"]').first().fill('Option A');
    await modal.locator('input[placeholder="Choice"]').nth(1).fill('Option B');

    // No correct answer selected: Next shows the validation error and stays on
    // the Question step.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByText('Please select a correct answer')).toBeVisible();
    await expect(addChoice).toBeVisible();

    // Select the first choice as correct: the error clears.
    await modal.locator('.ant-radio-wrapper').first().click();
    await expect(modal.getByText('Please select a correct answer')).toBeHidden();

    // Now Next advances to the Preview step.
    await modal.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Add', exact: true })).toBeVisible();

    // Dismiss without saving (the form is empty, so the X button just closes).
    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden();
  });
});
