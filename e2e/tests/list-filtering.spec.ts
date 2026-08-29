import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { editorTest, categoriesTest, roundsTest } from '../fixtures/editor';

// End-to-end coverage for the shared filtering/pagination layer (tickets
// #195/#196). The list endpoints filter and slice server-side, so the pager's
// counts describe the *filtered* set rather than the rows currently mounted,
// and the unused-only toggle reflects live membership (question→rounds,
// category→questions).
//
// Every test searches for a unique marker so it sees exactly the rows it seeded:
// the dev DB is shared across the suite, and the list is ordered oldest-first,
// so an unfiltered list would page our rows out behind other tests' leftovers.

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

async function createQuestion(request: APIRequestContext, question: string): Promise<string> {
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: { question, answer: 'a' },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

async function createCategory(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/category', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return json.id;
}

async function seedQuestions(request: APIRequestContext, marker: string, count: number) {
  for (let i = 0; i < count; i++) {
    await createQuestion(request, `paged ${marker} ${i}`);
  }
}

// Count rendered data rows. antd's Table adds a hidden measurement row to the
// tbody when `scroll` is set (the questions list scrolls horizontally), so
// counting `.ant-table-tbody tr` would be one too many.
function dataRows(page: Page) {
  return page.locator('.ant-table-tbody tr.ant-table-row');
}

// Search the page's filter bar and run the search.
async function search(page: Page, text: string) {
  const input = page.locator('input[placeholder="Search"]');
  await input.fill(text);
  await input.press('Enter');
}

// Pick a page size from the pager's size changer (antd renders it as a select
// whose option labels read "10 / page").
async function choosePageSize(page: Page, size: number) {
  await page.locator('.ant-pagination .ant-pagination-options .ant-select').click();
  await page
    .locator('.ant-select-dropdown:visible')
    .getByText(`${size} / page`, { exact: true })
    .click();
}

editorTest.describe('questions filtering & pagination', () => {
  editorTest('pages through a filtered list and reports the filtered total', async ({ editorPage, request }) => {
    const marker = `e2e-page-${unique()}`;
    await seedQuestions(request, marker, 12);

    // Search for the marker: 12 matches, all fitting on the default page.
    await search(editorPage, marker);
    await expect(editorPage.locator('.ant-pagination')).toContainText('1-12 of 12');

    // Shrink the page size: the server returns 10 per page, so a second page
    // appears holding the remaining two.
    await choosePageSize(editorPage, 10);
    await expect(editorPage.locator('.ant-pagination')).toContainText('1-10 of 12');
    await expect(dataRows(editorPage)).toHaveCount(10);

    await editorPage.locator('.ant-pagination-item', { hasText: '2' }).click();
    await expect(editorPage.locator('.ant-pagination')).toContainText('11-12 of 12');
    await expect(dataRows(editorPage)).toHaveCount(2);
  });

  editorTest('a filter change resets to the first page', async ({ editorPage, request }) => {
    const marker = `e2e-reset-${unique()}`;
    await seedQuestions(request, marker, 12);

    await search(editorPage, marker);
    await choosePageSize(editorPage, 10);
    await editorPage.locator('.ant-pagination-item', { hasText: '2' }).click();
    await expect(editorPage.locator('.ant-pagination')).toContainText('11-12 of 12');

    // Narrowing the filter must not strand the user on a page that no longer
    // exists in the (smaller) filtered set.
    await search(editorPage, `${marker} 11`);
    await expect(editorPage.locator('.ant-pagination-item-active')).toHaveText('1');
    await expect(editorPage.locator('.ant-pagination')).toContainText('1-1 of 1');
  });

  // Deleting the last rows on a later page used to leave the user staring at an
  // empty list with no page button left to click back to; the page now falls
  // back to the first when the response says it no longer exists.
  editorTest('deleting the last page returns to the first page', async ({ editorPage, request }) => {
    const marker = `e2e-strand-${unique()}`;
    await seedQuestions(request, marker, 12);

    await search(editorPage, marker);
    await choosePageSize(editorPage, 10);
    await editorPage.locator('.ant-pagination-item', { hasText: '2' }).click();
    await expect(editorPage.locator('.ant-pagination')).toContainText('11-12 of 12');

    // Delete both rows on page 2 through the UI (which invalidates the query and
    // refetches page 2 — now empty, with only one page left). Capture the row
    // keys first: a live .first() locator would re-resolve to the *next* row as
    // soon as the current one is removed.
    const rows = editorPage.locator('.ant-table-tbody tr.ant-table-row');
    await expect(rows).toHaveCount(2);
    const keys = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-row-key')));

    for (const key of keys) {
      const row = editorPage.locator(`tr[data-row-key="${key}"]`);
      await row.locator('.anticon-delete').click();
      await editorPage.locator('.ant-popover:visible').getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(row).toHaveCount(0);
    }

    // Back on page 1 showing the ten remaining rows, not stranded on page 2.
    await expect(editorPage.locator('.ant-pagination-item-active')).toHaveText('1');
    await expect(editorPage.locator('.ant-pagination')).toContainText('1-10 of 10');
  });

  editorTest('the unused-only filter excludes questions a round contains', async ({ editorPage, request }) => {
    const marker = `e2e-unused-${unique()}`;
    const usedId = await createQuestion(request, `used ${marker}`);
    await createQuestion(request, `free ${marker}`);

    // Start with unused_only off so both rows are visible.
    const unusedOnly = editorPage.getByText('Unused only');
    if (await unusedOnly.isChecked()) {
      await unusedOnly.click();
    }
    await search(editorPage, marker);
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: `used ${marker}` })).toBeVisible();
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: `free ${marker}` })).toBeVisible();

    // Put the first question into a round through the API; the filter reads live
    // membership, so it disappears as soon as the round references it.
    const round = await request.post('/editor/round', {
      headers: { 'borttrivia-token': token },
      data: { name: `Round ${marker}`, questions: [usedId], wagers: [100] },
    });
    expect(round.ok()).toBeTruthy();

    await unusedOnly.click();
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: `free ${marker}` })).toBeVisible();
    await expect(editorPage.locator('.ant-table-tbody tr').filter({ hasText: `used ${marker}` })).toHaveCount(0);
  });
});

categoriesTest.describe('categories filtering & pagination', () => {
  // The categories page gained the same filter bar plus a per-row usage count.
  categoriesTest('searches categories by name and pages the results', async ({ categoriesPage, request }) => {
    const marker = `e2e-cat-page-${unique()}`;
    for (let i = 0; i < 4; i++) {
      await createCategory(request, `${marker} ${i}`);
    }

    await search(categoriesPage, marker);
    // The page-size default is 24, so all four show; shrink it to force a page 2.
    await expect(categoriesPage.locator('.ant-pagination')).toContainText('1-4 of 4');
    await choosePageSize(categoriesPage, 10);
    await expect(dataRows(categoriesPage)).toHaveCount(4);

    // A narrower search reports the smaller total.
    await search(categoriesPage, `${marker} 1`);
    await expect(categoriesPage.locator('.ant-pagination')).toContainText('1-1 of 1');
  });

  categoriesTest('shows each category\'s question count', async ({ categoriesPage, request }) => {
    const marker = `e2e-cat-used-${unique()}`;
    const categoryId = await createCategory(request, marker);

    // A question referencing the category bumps its count (questions_used comes
    // from the server, derived from question.category_id).
    const created = await request.post('/editor/question', {
      headers: { 'borttrivia-token': token },
      data: { category: categoryId, question: `refs ${marker}`, answer: 'a' },
    });
    expect(created.ok()).toBeTruthy();

    await search(categoriesPage, marker);
    const row = categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: marker });
    await expect(row).toContainText('1 question');
  });

  categoriesTest('the unused-only filter hides categories a question references', async ({ categoriesPage, request }) => {
    const marker = `e2e-cat-unused-${unique()}`;
    const usedId = await createCategory(request, `used ${marker}`);
    await createCategory(request, `free ${marker}`);

    const created = await request.post('/editor/question', {
      headers: { 'borttrivia-token': token },
      data: { category: usedId, question: `refs ${marker}`, answer: 'a' },
    });
    expect(created.ok()).toBeTruthy();

    await search(categoriesPage, marker);
    await expect(categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: `free ${marker}` })).toBeVisible();
    await expect(categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: `used ${marker}` })).toBeVisible();

    await categoriesPage.getByText('Unused only').click();
    await expect(categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: `free ${marker}` })).toBeVisible();
    await expect(categoriesPage.locator('.category-list .ant-table-row').filter({ hasText: `used ${marker}` })).toHaveCount(0);
  });
});

async function createRound(request: APIRequestContext, name: string) {
  const res = await request.post('/editor/round', {
    headers: { 'borttrivia-token': token },
    data: { name, questions: [], wagers: [] },
  });
  expect(res.ok()).toBeTruthy();
}

roundsTest.describe('rounds filtering & pagination', () => {
  // The rounds page carries the same filter bar and (like questions/categories)
  // pages server-side, so it needs its own coverage.
  roundsTest('pages through a filtered list of rounds', async ({ roundsPage, request }) => {
    const marker = `e2e-round-page-${unique()}`;
    for (let i = 0; i < 12; i++) {
      await createRound(request, `${marker} ${i}`);
    }

    await search(roundsPage, marker);
    await expect(roundsPage.locator('.ant-pagination')).toContainText('1-12 of 12');

    await choosePageSize(roundsPage, 10);
    await expect(roundsPage.locator('.ant-pagination')).toContainText('1-10 of 12');
    await expect(roundsPage.locator('.round_list .ant-table-row')).toHaveCount(10);

    await roundsPage.locator('.ant-pagination-item', { hasText: '2' }).click();
    await expect(roundsPage.locator('.ant-pagination')).toContainText('11-12 of 12');
    await expect(roundsPage.locator('.round_list .ant-table-row')).toHaveCount(2);
  });

  roundsTest('the unused-only filter excludes rounds a game contains', async ({ roundsPage, request }) => {
    const marker = `e2e-round-unused-${unique()}`;
    const usedName = `used ${marker}`;
    await createRound(request, usedName);
    await createRound(request, `free ${marker}`);

    const usedRes = await request.get('/editor/rounds?text_filter=' + encodeURIComponent(usedName), {
      headers: { 'borttrivia-token': token },
    });
    const { rounds } = await usedRes.json();
    const usedId = rounds[0].id;

    // Start with unused_only off so both rows render.
    const unusedOnly = roundsPage.getByText('Unused only');
    if (await unusedOnly.isChecked()) {
      await unusedOnly.click();
    }
    await search(roundsPage, marker);
    await expect(roundsPage.locator('.round_list .ant-table-row').filter({ hasText: usedName })).toBeVisible();

    const game = await request.post('/editor/game', {
      headers: { 'borttrivia-token': token },
      data: { name: `Game ${marker}`, rounds: [usedId], round_names: { [usedId]: usedName } },
    });
    expect(game.ok()).toBeTruthy();

    await unusedOnly.click();
    await expect(roundsPage.locator('.round_list .ant-table-row').filter({ hasText: `free ${marker}` })).toBeVisible();
    await expect(roundsPage.locator('.round_list .ant-table-row').filter({ hasText: usedName })).toHaveCount(0);
  });
});
