import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';

// Gameplay e2e (ticket #109): lobby + session start, first slice of the
// single-session suite. Unlike the editor suites, gameplay is anonymous and
// involves multiple actors, so each test drives a separate browser context per
// actor (mod + players) through the real invite-link/join flow, instead of the
// editorTest/editorPage fixtures.

// The dev DB is one shared SQLite file for the whole `playwright test` run, so
// every test uses a unique prefix and cleans up what it created.
const unique = () => String(Date.now());

const BASE_URL = 'http://localhost:8081/';
const DEV_USER = 'alice';

// Build the same unsigned (alg "none") dev-mode mock JWT the client produces
// for ?mockUser login. Editor data is seeded via the API with this token; the
// gameplay endpoints themselves are anonymous.
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

// --- Editor seeding (via API, dev JWT) ------------------------------------

// Categories are a root model (ticket #179): the editor question API takes a
// category ID, so seed a category first.
async function createCategory(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post('/editor/category', {
    headers: { 'borttrivia-token': token },
    data: { name },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

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
  return (await res.json()).id;
}

// A question with NO category (ticket #184: hot-edit must not be blocked for
// these — the old free-text category was optional).
async function createNoCategoryQuestion(request: APIRequestContext, question: string, answer: string): Promise<string> {
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: { question, answer },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

async function createRound(
  request: APIRequestContext,
  name: string,
  questionIds: string[],
  wagers: number[],
): Promise<string> {
  const res = await request.post('/editor/round', {
    headers: { 'borttrivia-token': token },
    data: { name, questions: questionIds, wagers },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

async function createGame(request: APIRequestContext, name: string, roundId: string): Promise<string> {
  const res = await request.post('/editor/game', {
    headers: { 'borttrivia-token': token },
    data: { name, rounds: [roundId], round_names: { [roundId]: name } },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

// Seed a startable game (one round with two questions) and return its ids.
async function seedStartableGame(request: APIRequestContext, prefix: string) {
  const q1 = await createQuestion(request, `e2e-cat-${prefix}`, `First question ${prefix}`, 'Answer one');
  const q2 = await createQuestion(request, `e2e-cat-${prefix}`, `Second question ${prefix}`, 'Answer two');
  const roundId = await createRound(request, `e2e-round-${prefix}`, [q1, q2], [100, 200]);
  const gameId = await createGame(request, `e2e-game-${prefix}`, roundId);
  return { gameId, roundId, qids: [q1, q2] };
}

// Create a multiple-choice question whose options are Answer A / B / C with C
// correct (the stored answer is derived from the correct option, ticket #160).
async function createMCQuestion(request: APIRequestContext, category: string, question: string): Promise<string> {
  const categoryId = await createCategory(request, category);
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: {
      category: categoryId,
      question,
      answer: '',
      question_type: 'multiple_choice',
      choices: [
        { text: 'Answer A', is_correct: false },
        { text: 'Answer B', is_correct: false },
        { text: 'Answer C', is_correct: true },
      ],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

// Seed a startable game whose first question is multiple choice (ticket #160).
async function seedStartableMCGame(request: APIRequestContext, prefix: string) {
  const q1 = await createMCQuestion(request, `e2e-cat-${prefix}`, `MC question ${prefix}`);
  const q2 = await createQuestion(request, `e2e-cat-${prefix}`, `Second question ${prefix}`, 'Answer two');
  const roundId = await createRound(request, `e2e-round-${prefix}`, [q1, q2], [100, 200]);
  const gameId = await createGame(request, `e2e-game-${prefix}`, roundId);
  return { gameId, roundId, qids: [q1, q2] };
}

// Create a bucketing question (ticket #164): items sorted into buckets, e.g.
// frog/lion/human into Amphibian/Mammal.
async function createBucketingQuestion(request: APIRequestContext, category: string, question: string): Promise<string> {
  const categoryId = await createCategory(request, category);
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: {
      category: categoryId,
      question,
      answer: '',
      question_type: 'bucketing',
      buckets: [{ text: 'Amphibian' }, { text: 'Mammal' }],
      items: [
        { text: 'frog', bucket: 'Amphibian' },
        { text: 'lion', bucket: 'Mammal' },
        { text: 'human', bucket: 'Mammal' },
      ],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

// Seed a startable game whose first question is bucketing (ticket #164).
async function seedStartableBucketingGame(request: APIRequestContext, prefix: string) {
  const q1 = await createBucketingQuestion(request, `e2e-cat-${prefix}`, `Bucketing question ${prefix}`);
  const q2 = await createQuestion(request, `e2e-cat-${prefix}`, `Second question ${prefix}`, 'Answer two');
  const roundId = await createRound(request, `e2e-round-${prefix}`, [q1, q2], [100, 200]);
  const gameId = await createGame(request, `e2e-game-${prefix}`, roundId);
  return { gameId, roundId, qids: [q1, q2] };
}

// Create an ordering question (ticket #213): the author's entry order is the
// correct order; the player-facing `ordered` column is shuffled pre-score
// (ticket #211).
async function createOrderingQuestion(request: APIRequestContext, category: string, question: string, orderedTexts: string[]): Promise<string> {
  const categoryId = await createCategory(request, category);
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: {
      category: categoryId,
      question,
      answer: '',
      question_type: 'ordering',
      ordered: orderedTexts.map(text => ({ text })),
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).id;
}

// Seed a startable game whose first question is ordering (ticket #214).
async function seedStartableOrderingGame(request: APIRequestContext, prefix: string) {
  const q1 = await createOrderingQuestion(request, `e2e-cat-${prefix}`, `Ordering question ${prefix}`, ['First', 'Second', 'Third']);
  const q2 = await createQuestion(request, `e2e-cat-${prefix}`, `Second question ${prefix}`, 'Answer two');
  const roundId = await createRound(request, `e2e-round-${prefix}`, [q1, q2], [100, 200]);
  const gameId = await createGame(request, `e2e-game-${prefix}`, roundId);
  return { gameId, roundId, qids: [q1, q2] };
}

// Create a session for the game; the response carries the mod's player id.
async function createSession(request: APIRequestContext, name: string, gameId: string) {
  const res = await request.post('/gameplay/session', { data: { name, game_id: gameId } });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  return { sessionId: json.id, modId: json.mod };
}

// Remove everything a test created so it doesn't leak into the shared dev DB.
async function cleanup(
  request: APIRequestContext,
  seeded: { gameId: string; roundId: string; qids: string[] },
  opts: { sessionId?: string; modId?: string; playerIds?: string[] },
) {
  const { sessionId, modId, playerIds = [] } = opts;
  if (sessionId && modId) {
    await request.delete(`/gameplay/session/${sessionId}?mod=${modId}`);
  }
  for (const pid of [modId, ...playerIds]) {
    if (pid) await request.delete(`/gameplay/player/${pid}`);
  }
  await request.delete(`/editor/game/${seeded.gameId}`);
  const roundIds = seeded.roundIds ?? [seeded.roundId];
  for (const rid of roundIds) await request.delete(`/editor/round/${rid}`);
  for (const qid of seeded.qids) await request.delete(`/editor/question/${qid}`);
}

// --- Actor helpers ---------------------------------------------------------

// Open the mod's lobby from the invite URL plus its own player_id. Pass
// mockUser to also log the mod page into the editor (dev-mode mock token), which
// the hot-edit modal needs to load the user's categories (ticket #180).
async function openModLobby(browser: { newContext: (o?: object) => Promise<BrowserContext> }, sessionId: string, modId: string, mockUser?: string) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  const params = `session_id=${sessionId}&player_id=${modId}${mockUser ? `&mockUser=${mockUser}` : ''}`;
  await page.goto(`/?${params}`);
  await expect(page.locator('.invite-link')).toBeVisible();
  return { context, page };
}

// Drive a player through the real join flow from the invite link: fill team
// name + real name, pick an icon, click "Join game", and wait for the reload
// that adds `player_id` to the URL. Returns the player page and its player id.
async function joinPlayer(
  browser: { newContext: (o?: object) => Promise<BrowserContext> },
  sessionId: string,
  teamName: string,
  realName: string,
) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto(`/?session_id=${sessionId}`);

  const teamInput = page.locator('input[placeholder="e.g. TriviaLover69"]');
  const realInput = page.locator('input[placeholder="e.g. Jim Bibby"]');
  await expect(teamInput).toBeVisible();
  await teamInput.fill(teamName);
  await realInput.fill(realName);

  // Pick an icon via the SelectIcon dropdown.
  await page.locator('.ant-select').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').first().click();

  const joinButton = page.getByRole('button', { name: 'Join game', exact: true });
  await expect(joinButton).toBeEnabled();
  await joinButton.click();

  // Join triggers a full page reload that appends `&player_id=`.
  await page.waitForURL(/[?&]player_id=/);
  const playerId = new URL(page.url()).searchParams.get('player_id');
  expect(playerId).toBeTruthy();

  // The reloaded card now shows "Update".
  await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeVisible();

  return { context, page, playerId };
}

test.describe('gameplay lobby & session start', () => {
  test('mod lobby shows invite link, start button and roster title', async ({ browser, request }) => {
    test.setTimeout(60000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context, page } = await openModLobby(browser, sessionId, modId);

    await expect(page.locator('.invite-link')).toHaveValue(`${BASE_URL}?session_id=${sessionId}`);
    await expect(page.locator('.start-button')).toBeVisible();
    await expect(page.getByText('Players:', { exact: true })).toBeVisible();

    await context.close();
    await cleanup(request, seeded, { sessionId, modId });
  });

  test('player joins via invite link, edits team/icon and appears in mod roster', async ({ browser, request }) => {
    test.setTimeout(60000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);

    const teamName = `Team ${prefix}`;
    const renamed = `Renamed ${prefix}`;
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      teamName,
      `Player ${prefix}`,
    );

    // The mod roster picks up the joined player (state bump -> refetch).
    await expect(modPage.locator('.ant-card').filter({ hasText: teamName })).toBeVisible({ timeout: 30000 });

    // A non-mod player sees the "Other Players:" roster title.
    await expect(playerPage.getByText('Other Players:', { exact: true })).toBeVisible();

    // Editing the team name and clicking Update is reflected in the mod roster.
    await playerPage.locator('input[placeholder="e.g. TriviaLover69"]').fill(renamed);
    await expect(playerPage.getByRole('button', { name: 'Update', exact: true })).toBeEnabled();
    await playerPage.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(modPage.locator('.ant-card').filter({ hasText: renamed })).toBeVisible({ timeout: 30000 });

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });

  test('session start flips both contexts to the active game and the mod can advance', async ({ browser, request }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    await expect(modPage.locator('.start-button')).toBeVisible();

    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );

    // Start the game.
    await modPage.locator('.start-button').click();

    // Both the mod and the player transition lobby -> active game.
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // The active question starts at the first question.
    await expect(modPage.locator('.active-question-box')).toContainText(`First question ${prefix}`, {
      timeout: 30000,
    });

    // The mod advances to the next question and the active question changes.
    await modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`Second question ${prefix}`, {
      timeout: 30000,
    });

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });
});

// --- Ticket #110: question flow, answering & wagering ---------------------

// The player's answer card: the Card wrapping the "Your answer" textarea.
function playerAnswerCard(page: Page) {
  return page.locator('.ant-card').filter({ has: page.locator('textarea[placeholder="Your answer"]') });
}

// Drive the ordering reorder grid (ticket #214) to a target order: for each
// position, find the item that belongs there and keep clicking its row's up
// button until it lands at that position. The grid always holds a permutation
// of the items, so the target is always reachable. If the shuffle already
// matched the target (no moves needed), nudge the first item down and back so
// the answer counts as edited and the submit button enables.
async function reorderGridTo(card: Locator, target: string[]) {
  const rows = card.locator('.ordered-answer-row');
  let moved = false;
  for (let pos = 0; pos < target.length; pos++) {
    const wanted = target[pos];
    for (;;) {
      const texts = (await rows.locator('.ordered-answer-text').allTextContents()).map((t) => t.trim());
      const idx = texts.indexOf(wanted);
      if (idx === pos) break;
      expect(idx).toBeGreaterThan(pos);
      await rows.nth(idx).getByRole('button', { name: `Move ${wanted} up` }).click();
      moved = true;
    }
  }
  if (!moved) {
    const texts = (await rows.locator('.ordered-answer-text').allTextContents()).map((t) => t.trim());
    await rows.nth(0).getByRole('button', { name: `Move ${texts[0]} down` }).click();
    await rows.nth(1).getByRole('button', { name: `Move ${texts[0]} up` }).click();
  }
}

// Read the mod's view of answers for one question (round/question indices).
async function getAnswersAsMod(
  request: APIRequestContext,
  sessionId: string,
  modId: string,
  roundIndex: number,
  questionIndex: number,
): Promise<any> {
  const res = await request.get(
    `/gameplay/session/${sessionId}/answers?player_id=${modId}&round_id=${roundIndex}&question_id=${questionIndex}`,
  );
  expect(res.ok()).toBeTruthy();
  return await res.json();
}

// Answers a player has submitted for one question, oldest first.
async function playerAnswers(
  request: APIRequestContext,
  sessionId: string,
  modId: string,
  playerId: string,
  roundIndex: number,
  questionIndex: number,
): Promise<any[]> {
  const data = await getAnswersAsMod(request, sessionId, modId, roundIndex, questionIndex);
  const team = data.answers.find((a: any) => a.player_id === playerId);
  return team?.answers ?? [];
}

test.describe('gameplay question flow, answering & wagering', () => {
  test('mod advances, player sees question/category, submits and edits/resends an answer', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );

    // Start the game; both contexts enter the active game.
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // Mod advances to the second question (NextOrPrevious -> SetQuestion).
    await modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`Second question ${prefix}`, {
      timeout: 30000,
    });

    // The player sees the advanced question text and its category.
    await expect(playerPage.locator('.active-question-box')).toContainText(`Second question ${prefix}`, {
      timeout: 30000,
    });
    await expect(
      playerPage.locator('.ant-breadcrumb').getByText(`e2e-cat-${prefix}`, { exact: true }),
    ).toBeVisible({ timeout: 30000 });

    // Player submits an answer (wager 100 + text).
    const card = playerAnswerCard(playerPage);
    await card.locator('textarea[placeholder="Your answer"]').fill('First answer');
    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();

    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 1)).length)
      .toBe(1);
    expect((await playerAnswers(request, sessionId, modId, playerId, 0, 1))[0].answer).toBe('First answer');

    // Edit & resend: the submit button flips to "Update".
    await card.locator('textarea[placeholder="Your answer"]').fill('Edited answer');
    const updateButton = card.getByRole('button', { name: 'Update', exact: true });
    await expect(updateButton).toBeEnabled();
    await updateButton.click();

    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 1)).length)
      .toBe(2);
    const resent = await playerAnswers(request, sessionId, modId, playerId, 0, 1);
    expect(resent[resent.length - 1].answer).toBe('Edited answer');

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });

  test('wagering: a player picks a wager via WagerManager and it is recorded on the answer', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );

    await modPage.locator('.start-button').click();
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    const card = playerAnswerCard(playerPage);

    // WagerManager exposes the round's wager options as selectable radio buttons.
    await expect(card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' })).toBeVisible({
      timeout: 30000,
    });
    await expect(card.locator('.ant-radio-button-wrapper').filter({ hasText: '200' })).toBeVisible();

    // A wager is required: with only an answer typed the submit button stays disabled.
    await card.locator('textarea[placeholder="Your answer"]').fill('Wagered answer');
    await expect(card.getByRole('button', { name: 'Answer', exact: true })).toBeDisabled();

    // Select wager 200 and submit.
    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '200' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();

    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(1);
    const recorded = await playerAnswers(request, sessionId, modId, playerId, 0, 0);
    expect(recorded[0].wager).toBe(200);

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });
});

// --- Ticket #111: scoring, scoreboard & statuses --------------------------

// Drive the player's answer card to submit an answer with a wager.
async function answerQuestion(page: Page, wager: number, answer: string) {
  const card = playerAnswerCard(page);
  // Wait for the answer card to settle into a fresh state (empty textarea).
  // AnswerQuestion's componentDidUpdate resets answer/wager/dirty whenever the
  // question/round prop changes, so if we interact before the player's long-poll
  // has received the advanced question, the reset wipes our input and the Answer
  // button stays disabled. Waiting for the empty textarea closes that race.
  await expect(card.locator('textarea[placeholder="Your answer"]')).toHaveValue('');
  await card.locator('textarea[placeholder="Your answer"]').fill(answer);
  await card.locator('.ant-radio-button-wrapper').filter({ hasText: String(wager) }).click();
  const button = card.getByRole('button', { name: 'Answer', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
}

// Mark every joined player correct/incorrect in the mod's scorer and submit.
async function scoreCurrentQuestion(modPage: Page, correct: boolean) {
  const scorer = modPage.locator('.player-scorer');
  await scorer.locator(`button:has(.anticon-${correct ? 'check' : 'close'})`).click();
  const scoreButton = scorer.getByRole('button', { name: 'Score', exact: true });
  await expect(scoreButton).toBeEnabled();
  await scoreButton.click();
}

// Pick an emoji from the open reaction picker popover. The picker virtualizes
// its emoji grid (only the in-viewport emojis are in the DOM), so search first
// to narrow the results to the target, then click its button by unified code.
async function pickEmoji(page: Page, search: string, unified: string) {
  const popover = page.locator('.ant-popover:visible');
  // Regression guard (ticket #156): the picker's preview strip (a 70px-tall,
  // top-bordered bar rendered by emoji-picker-react) must be disabled via
  // previewConfig.showPreview=false — the top-level showPreview prop is
  // ignored in v4.19.1, so this catches that silently doing nothing.
  const previewCount = await popover.evaluate((el) =>
    Array.from(el.querySelectorAll('div')).filter((d) => {
      const cs = getComputedStyle(d);
      return parseFloat(cs.borderTopWidth) > 0 && Math.round(d.getBoundingClientRect().height) === 70;
    }).length,
  );
  expect(previewCount).toBe(0);
  await popover.getByLabel('Type to search for an emoji').fill(search);
  await popover.locator(`button[data-unified="${unified}"]`).click();
}

// Full setup for a scoring test: seed a game, open a session, start it with a
// joined player, and return every handle plus the unique team name.
async function setupActiveGame(
  browser: { newContext: (o?: object) => Promise<BrowserContext> },
  request: APIRequestContext,
  prefix: string,
) {
  const seeded = await seedStartableGame(request, prefix);
  const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);
  // The mod page logs into the editor (dev-mode mock token) so the hot-edit
  // modal can load the user's categories (ticket #180).
  const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId, DEV_USER);
  const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
    browser,
    sessionId,
    `Team ${prefix}`,
    `Player ${prefix}`,
  );
  await modPage.locator('.start-button').click();
  await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
  await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
  return {
    seeded,
    sessionId,
    modId,
    modContext,
    modPage,
    playerContext,
    playerPage,
    playerId,
    teamName: `Team ${prefix}`,
  };
}

// Seed a two-round game where every question has a distinct category, so the
// category grid can visibly track the active question across navigation.
async function seedNavGame(request: APIRequestContext, prefix: string) {
  const q1 = await createQuestion(request, `cat-a-${prefix}`, `R1Q1 ${prefix}`, 'A1');
  const q2 = await createQuestion(request, `cat-b-${prefix}`, `R1Q2 ${prefix}`, 'A2');
  const q3 = await createQuestion(request, `cat-c-${prefix}`, `R2Q1 ${prefix}`, 'A3');
  const q4 = await createQuestion(request, `cat-d-${prefix}`, `R2Q2 ${prefix}`, 'A4');
  const r1 = await createRound(request, `round-one-${prefix}`, [q1, q2], [100, 200]);
  const r2 = await createRound(request, `round-two-${prefix}`, [q3, q4], [100, 200]);
  const res = await request.post('/editor/game', {
    headers: { 'borttrivia-token': token },
    data: {
      name: `e2e-game-${prefix}`,
      rounds: [r1, r2],
      round_names: { [r1]: `round-one-${prefix}`, [r2]: `round-two-${prefix}` },
    },
  });
  expect(res.ok()).toBeTruthy();
  const gameId = (await res.json()).id;
  return { gameId, roundIds: [r1, r2], qids: [q1, q2, q3, q4] };
}

test.describe('gameplay scoring, scoreboard & statuses', () => {
  test('a correct answer pushes to the scoreboard for all actors and the player status turns green', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // Player has not answered yet -> grey "not answered" status.
    await expect(g.playerPage.locator('.player-status-bar .anticon-minus')).toBeVisible({ timeout: 30000 });

    // Player answers the first question (wager 100).
    await answerQuestion(g.playerPage, 100, 'First answer');
    // Player status flips to "answered" (yellow/check).
    await expect(g.playerPage.locator('.player-status-bar .anticon-check')).toBeVisible({ timeout: 30000 });

    // Mod marks the answer correct and scores it.
    await scoreCurrentQuestion(g.modPage, true);

    // Scoreboard updates for the mod...
    await expect(
      g.modPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('100', { timeout: 30000 });
    // ...and for the player.
    await expect(
      g.playerPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('100', { timeout: 30000 });

    // Player status turns green (correct) after scoring.
    await expect(g.playerPage.locator('.player-status-bar .anticon-check-square')).toBeVisible({
      timeout: 30000,
    });

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });

  test('an incorrect answer turns the player status red and awards no points', async ({ browser, request }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // Player answers the first question (wager 200).
    await answerQuestion(g.playerPage, 200, 'Wrong answer');
    await expect(g.playerPage.locator('.player-status-bar .anticon-check')).toBeVisible({ timeout: 30000 });

    // Mod marks the answer incorrect and scores it.
    await scoreCurrentQuestion(g.modPage, false);

    // Player status turns red (incorrect) after scoring.
    await expect(g.playerPage.locator('.player-status-bar .anticon-close-square')).toBeVisible({
      timeout: 30000,
    });

    // No points awarded: the scoreboard stays 0 for both actors.
    await expect(
      g.modPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('0', { timeout: 30000 });
    await expect(
      g.playerPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('0', { timeout: 30000 });

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });

  test('the scorer clears between questions (regression #7/#8) and scores accumulate', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // Round 1: correct answer worth 100.
    await answerQuestion(g.playerPage, 100, 'First answer');
    await scoreCurrentQuestion(g.modPage, true);
    await expect(
      g.modPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('100', { timeout: 30000 });

    // Mod advances to the second question.
    await g.modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(g.modPage.locator('.active-question-box')).toContainText(`Second question ${prefix}`, {
      timeout: 30000,
    });

    // The player answers the new question (only wager 200 remains available).
    await answerQuestion(g.playerPage, 200, 'Second answer');

    // Regression guard: the previous question's marks were cleared, so even
    // though the new answer is loaded, the Score button stays disabled.
    const scorer = g.modPage.locator('.player-scorer');
    await expect(scorer.locator('button:has(.anticon-check)')).toBeVisible({ timeout: 30000 });
    await expect(scorer.getByRole('button', { name: 'Score', exact: true })).toBeDisabled();

    // Score the second question correct for 200 -> total 300.
    await scoreCurrentQuestion(g.modPage, true);
    await expect(
      g.modPage.locator('.scoreboard .ant-card').filter({ hasText: g.teamName }),
    ).toContainText('300', { timeout: 30000 });

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });

  test('emoji reactions: players and mod add, modify and remove reactions on a scored answer', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // Reactions only exist once the question is scored: neither the player's
    // status bar nor the mod's scorer renders the control before that.
    await expect(g.playerPage.locator('.reaction-control')).toHaveCount(0);
    await expect(g.modPage.locator('.reaction-control')).toHaveCount(0);

    await answerQuestion(g.playerPage, 100, 'First answer');
    await scoreCurrentQuestion(g.modPage, true);
    await expect(g.playerPage.locator('.player-status-bar .anticon-check-square')).toBeVisible({
      timeout: 30000,
    });

    // The player adds a 👍 reaction on their team's answer card. The mod's
    // own card has no answer, so exactly one control exists per page.
    const playerControl = g.playerPage.locator('.player-status-bar .reaction-control');
    await expect(playerControl).toHaveCount(1, { timeout: 30000 });
    await playerControl.locator('.reaction-add-button').click();
    await pickEmoji(g.playerPage, 'thumbs up', '1f44d');
    await expect(playerControl.locator('.reaction-chip.mine').filter({ hasText: '👍' })).toContainText('1', {
      timeout: 30000,
    });

    // The reaction appears on the mod's page after the session-state refetch.
    const modControl = g.modPage.locator('.player-scorer .reaction-control');
    await expect(modControl).toHaveCount(1, { timeout: 30000 });
    await expect(modControl.locator('.reaction-chip').filter({ hasText: '👍' })).toContainText('1', {
      timeout: 30000,
    });

    // The mod (also a player) adds their own ❤️ reaction.
    await modControl.locator('.reaction-add-button').click();
    await pickEmoji(g.modPage, 'red heart', '2764-fe0f');
    await expect(modControl.locator('.reaction-chip.mine').filter({ hasText: '❤️' })).toContainText('1', {
      timeout: 30000,
    });

    // The player modifies their reaction from 👍 to 😂.
    await playerControl.locator('.reaction-add-button').click();
    await pickEmoji(g.playerPage, 'face with tears of joy', '1f602');
    await expect(playerControl.locator('.reaction-chip.mine').filter({ hasText: '😂' })).toContainText('1', {
      timeout: 30000,
    });
    await expect(playerControl.locator('.reaction-chip').filter({ hasText: '👍' })).toHaveCount(0, {
      timeout: 30000,
    });

    // Tapping the highlighted chip removes the player's reaction; the mod's
    // ❤️ remains.
    await playerControl.locator('.reaction-chip.mine').click();
    await expect(playerControl.locator('.reaction-chip')).toHaveCount(1, { timeout: 30000 });
    await expect(playerControl.locator('.reaction-chip').filter({ hasText: '😂' })).toHaveCount(0);

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });
});

// --- Ticket #112: navigation, hot-edit, spectator & edge cases ------------

test.describe('gameplay navigation, hot-edit, spectator & edge cases', () => {
  test('mod navigates next/previous question and next round; the category grid tracks the active question', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const seeded = await seedNavGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // Round 1, question 1: grid shows two categories with cat-a active.
    // Every tile must show a category NAME, including the not-yet-visited ones:
    // only the active question has a session_question snapshot, so before the
    // round's categories were resolved server-side the un-visited tiles rendered
    // the raw category UUID (the active one looked fine, which hid the bug).
    await expect(modPage.locator('.active-question-box')).toContainText(`R1Q1 ${prefix}`, { timeout: 30000 });
    await expect(modPage.locator('.round-category')).toHaveCount(2);
    await expect(modPage.locator('.round-category')).toHaveText([`cat-a-${prefix}`, `cat-b-${prefix}`]);
    await expect(modPage.locator('.round-category.active')).toHaveText(`cat-a-${prefix}`);

    // Next question -> R1Q2, and the grid tracks cat-b.
    await modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`R1Q2 ${prefix}`, { timeout: 30000 });
    await expect(modPage.locator('.round-category.active')).toHaveText(`cat-b-${prefix}`);

    // Previous question -> back to R1Q1.
    await modPage.getByRole('button', { name: 'Previous Question', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`R1Q1 ${prefix}`, { timeout: 30000 });
    await expect(modPage.locator('.round-category.active')).toHaveText(`cat-a-${prefix}`);

    // On R1Q2 (last of round 1) "Next Round" appears; it moves to R2Q1.
    await modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`R1Q2 ${prefix}`, { timeout: 30000 });
    await modPage.getByRole('button', { name: 'Next Round', exact: true }).click();
    await expect(modPage.locator('.active-question-box')).toContainText(`R2Q1 ${prefix}`, { timeout: 30000 });
    await expect(modPage.locator('.round-category')).toHaveCount(2);
    await expect(modPage.locator('.round-category')).toHaveText([`cat-c-${prefix}`, `cat-d-${prefix}`]);
    await expect(modPage.locator('.round-category.active')).toHaveText(`cat-c-${prefix}`);
    // Round name reflects round two.
    await expect(modPage.locator('.ant-breadcrumb')).toContainText(`round-two-${prefix}`);

    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId });
  });

  // The hot-edit modal rewrites the session snapshot mid-game. It needs the
  // category selector (ticket #180), so the mod page is logged into the
  // editor (dev-mode mock token) to load the user's categories.
  test('mod hot-edits the question text and round name mid-session and players see the change', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // Mod opens the question editor and rewrites the question text.
    const questionEdit = g.modPage.locator('.active-game .ant-card .anticon-edit').last();
    await questionEdit.click();
    const qModal = g.modPage.locator('.ant-modal');
    const newQuestion = `Hot-edited question ${prefix}`;
    await qModal.locator('textarea[placeholder="Question"]').fill(newQuestion);
    await qModal.getByRole('button', { name: 'Update', exact: true }).click();

    // The player sees the edited question text.
    await expect(g.playerPage.locator('.active-question-box')).toContainText(newQuestion, { timeout: 30000 });

    // Mod renames the round via the inline round-name editor.
    await g.modPage.locator('.ant-breadcrumb .anticon-edit').click();
    const newRoundName = `Renamed round ${prefix}`;
    const roundInput = g.modPage.locator('input[placeholder="Round name"]');
    await expect(roundInput).toBeVisible();
    await roundInput.fill(newRoundName);
    await roundInput.press('Enter');

    // The player sees the new round name in the breadcrumb.
    await expect(g.playerPage.locator('.ant-breadcrumb')).toContainText(newRoundName, { timeout: 30000 });

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });

  // Ticket #184: the mod page is anonymous, so the hot-edit modal cannot load
  // the user's categories (/editor/categories 401s). Update must stay enabled
  // for the text edit, and saving must preserve the category instead of
  // clearing it.
  test('mod hot-edits the question text on an anonymous mod page; the category is preserved', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    // NO mockUser: the mod page is anonymous, so categories never load.
    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(modPage.locator('.ant-breadcrumb')).toContainText(`e2e-cat-${prefix}`, { timeout: 30000 });

    // The modal explains that the category can't be changed here, but Update
    // is enabled for the text edit.
    await modPage.locator('.active-game .ant-card .anticon-edit').last().click();
    const qModal = modPage.locator('.ant-modal');
    await expect(qModal).toContainText('unchanged');
    const updateButton = qModal.getByRole('button', { name: 'Update', exact: true });
    await expect(updateButton).toBeEnabled();

    const newQuestion = `Hot-edited anonymously ${prefix}`;
    await qModal.locator('textarea[placeholder="Question"]').fill(newQuestion);
    await updateButton.click();

    // The edited text shows, and the category name survived the save.
    await expect(modPage.locator('.active-question-box')).toContainText(newQuestion, { timeout: 30000 });
    await expect(modPage.locator('.ant-breadcrumb')).toContainText(`e2e-cat-${prefix}`);

    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId });
  });

  // Ticket #184: a question with NO category must still be hot-editable —
  // Update used to be dead because the category never resolves.
  test('mod hot-edits a question that has no category', async ({ browser, request }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const q1 = await createNoCategoryQuestion(request, `No-category question ${prefix}`, 'Answer one');
    const q2 = await createNoCategoryQuestion(request, `Second question ${prefix}`, 'Answer two');
    const roundId = await createRound(request, `e2e-round-${prefix}`, [q1, q2], [100, 200]);
    const res = await request.post('/editor/game', {
      headers: { 'borttrivia-token': token },
      data: { name: `e2e-game-${prefix}`, rounds: [roundId], round_names: { [roundId]: `e2e-round-${prefix}` } },
    });
    expect(res.ok()).toBeTruthy();
    const gameId = (await res.json()).id;
    const seeded = { gameId, roundId, qids: [q1, q2] };

    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, gameId);
    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    await modPage.locator('.active-game .ant-card .anticon-edit').last().click();
    const qModal = modPage.locator('.ant-modal');
    const updateButton = qModal.getByRole('button', { name: 'Update', exact: true });
    await expect(updateButton).toBeEnabled();

    const newQuestion = `Hot-edited no-category ${prefix}`;
    await qModal.locator('textarea[placeholder="Question"]').fill(newQuestion);
    await updateButton.click();
    await expect(modPage.locator('.active-question-box')).toContainText(newQuestion, { timeout: 30000 });

    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId });
  });

  test('a spectator context (no player_id) sees the game without the answer/wager UI', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // A spectator opens the session URL with NO player_id.
    const specContext = await browser.newContext({ baseURL: BASE_URL });
    const specPage = await specContext.newPage();
    await specPage.goto(`/?session_id=${sessionId}`);

    // The spectator sees the active game and the current question text...
    await expect(specPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(specPage.locator('.active-question-box')).toContainText(`First question ${prefix}`, {
      timeout: 30000,
    });

    // ...but no answer input and no wager UI.
    await expect(specPage.locator('textarea[placeholder="Your answer"]')).toHaveCount(0);
    await expect(specPage.locator('.ant-radio-button-wrapper')).toHaveCount(0);

    await specContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId });
  });

  test('a player answers the current question after the mod advanced, and cannot submit after scoring', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const g = await setupActiveGame(browser, request, prefix);

    // The mod advances past the first question; the already-joined player can
    // still answer the current (second) question mid-session. (The server
    // rejects brand-new joins after start, so this is the supported form.)
    await g.modPage.getByRole('button', { name: 'Next Question', exact: true }).click();
    await expect(g.playerPage.locator('.active-question-box')).toContainText(`Second question ${prefix}`, {
      timeout: 30000,
    });

    await answerQuestion(g.playerPage, 200, 'Late answer');
    await expect
      .poll(async () => (await playerAnswers(request, g.sessionId, g.modId, g.playerId, 0, 1)).length)
      .toBe(1);

    // Score the question; wait for the player to observe it scored (green).
    await scoreCurrentQuestion(g.modPage, true);
    await expect(g.playerPage.locator('.player-status-bar .anticon-check-square')).toBeVisible({
      timeout: 30000,
    });

    // After scoring, the answer card ignores further input: even after typing
    // new text, the submit ("Update") button stays disabled.
    const card = playerAnswerCard(g.playerPage);
    await card.locator('textarea[placeholder="Your answer"]').fill('Ignored after scoring');
    await expect(card.getByRole('button', { name: 'Update', exact: true })).toBeDisabled();

    await g.playerContext.close();
    await g.modContext.close();
    await cleanup(request, g.seeded, { sessionId: g.sessionId, modId: g.modId, playerIds: [g.playerId] });
  });

  test('scoring a multiple-choice question bolds the correct answer and marks ✅/❌ options', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableMCGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);
    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // Pre-score: the options render as a plain list (no ✅/❌ yet).
    const modBox = modPage.locator('.active-question-box');
    await expect(modBox.locator('li').first()).not.toContainText('❌', { timeout: 30000 });

    // The player picks the correct option (a Radio, not the freeform textarea)
    // and submits with a wager.
    const card = playerPage.locator('.ant-card').filter({
      has: playerPage.getByRole('button', { name: 'Answer', exact: true }),
    });
    await expect(card.locator('.ant-radio-wrapper').filter({ hasText: 'Answer C' })).toBeVisible({ timeout: 30000 });
    await card.locator('.ant-radio-wrapper').filter({ hasText: 'Answer C' }).click();
    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();

    // Wait for the player's answer to be recorded server-side.
    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(1);

    // Multiple choice is auto-scored by the backend, so the mod's scorer has
    // no manual correct/incorrect buttons — the Score button is all that's
    // needed (see PlayerAnswers' !auto_scored guard).
    const scoreButton = modPage.locator('.player-scorer').getByRole('button', { name: 'Score', exact: true });
    await expect(scoreButton).toBeEnabled({ timeout: 30000 });
    await scoreButton.click();

    // The scored question box marks the correct option ✅ (bold) and the other
    // options ❌, for both the mod and the player (ticket #160).
    const correctOption = (box: ReturnType<Page['locator']>) =>
      box.locator('li').filter({ hasText: 'Answer C' });
    await expect(correctOption(modBox)).toContainText('✅', { timeout: 30000 });
    await expect(modBox.locator('li').filter({ hasText: 'Answer A' })).toContainText('❌');
    await expect(modBox.locator('li').filter({ hasText: 'Answer B' })).toContainText('❌');
    const fontWeight = await correctOption(modBox).evaluate((el) => getComputedStyle(el).fontWeight);
    // Chrome reports the resolved weight as "700" (bold normalizes to numeric).
    expect(['bold', '700']).toContain(fontWeight);

    // The standalone answer line is hidden — the option list already shows the
    // correct answer, so no paragraph duplicates "Answer C".
    await expect(modBox.locator('p').filter({ hasText: 'Answer C' })).toHaveCount(0);

    await expect(correctOption(playerPage.locator('.active-question-box'))).toContainText('✅', {
      timeout: 30000,
    });
    await expect(playerPage.locator('.active-question-box').locator('p').filter({ hasText: 'Answer C' })).toHaveCount(0);

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });

  test('bucketing: a player sorts items into buckets and the answer is auto-scored', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableBucketingGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);
    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // The mod's question box shows the items and buckets side by side (the
    // buckets are shuffled for players, canonical for the mod).
    const modBox = modPage.locator('.active-question-box');
    await expect(modBox.locator('li').filter({ hasText: 'frog' })).toBeVisible({ timeout: 30000 });
    await expect(modBox.locator('li').filter({ hasText: 'Amphibian' })).toBeVisible();

    // The player's answer card lists each item with a Bucket select.
    const card = playerPage.locator('.ant-card').filter({
      has: playerPage.getByRole('button', { name: 'Answer', exact: true }),
    });
    const itemRows = card.locator('.ant-select');
    await expect(itemRows).toHaveCount(3, { timeout: 30000 });

    // Assign frog -> Amphibian, lion -> Mammal, human -> Mammal. After each
    // selection wait for the antd dropdown to fully close, so the next
    // select never opens while a stale dropdown is still overlapping.
    const pick = async (rowIndex: number, bucket: string) => {
      await itemRows.nth(rowIndex).click();
      const option = playerPage
        .locator('.ant-select-dropdown:visible .ant-select-item-option')
        .filter({ hasText: bucket });
      await expect(option.first()).toBeVisible();
      await option.first().click();
      await expect(playerPage.locator('.ant-select-dropdown:visible')).toHaveCount(0);
    };
    await pick(0, 'Amphibian');
    await pick(1, 'Mammal');
    await pick(2, 'Mammal');

    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();

    // The stored answer is the item -> bucket JSON map.
    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(1);
    const submitted = (await playerAnswers(request, sessionId, modId, playerId, 0, 0))[0].answer;
    expect(JSON.parse(submitted)).toEqual({ frog: 'Amphibian', lion: 'Mammal', human: 'Mammal' });

    // Bucketing is auto-scored by the backend, so the mod's scorer has no
    // manual correct/incorrect buttons — the Score button is all that's needed.
    const scoreButton = modPage.locator('.player-scorer').getByRole('button', { name: 'Score', exact: true });
    await expect(scoreButton).toBeEnabled({ timeout: 30000 });
    await scoreButton.click();

    // The complete correct mapping scores.
    await expect
      .poll(async () => {
        const answers = await playerAnswers(request, sessionId, modId, playerId, 0, 0);
        return answers[answers.length - 1]?.correct;
      })
      .toBe(true);

    // Once scored, the mod's question box reveals the answer key: the item
    // list is replaced by items tagged with the bucket they belong to (dark
    // tag background, white text — same view as the editor preview's "Show
    // answer").
    await expect(modBox.locator('.ant-tag')).toHaveCount(3, { timeout: 30000 });
    await expect(modBox.locator('li', { hasText: 'frog' }).locator('.ant-tag')).toHaveText('Amphibian');
    await expect(modBox.locator('li', { hasText: 'lion' }).locator('.ant-tag')).toHaveText('Mammal');
    await expect(modBox.locator('li', { hasText: 'human' }).locator('.ant-tag')).toHaveText('Mammal');
    await expect(modBox.locator('li', { hasText: 'frog' }).locator('.ant-tag')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(modBox.locator('li', { hasText: 'frog' }).locator('.ant-tag')).toHaveCSS('background-color', 'rgb(35, 120, 4)'); // #237804 for "Amphibian"

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });

  test('ordering: a player reorders the shuffled items and the answer posts as a JSON array', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableOrderingGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    // The player's answer card shows the reorder grid, seeded from the
    // (deterministically) shuffled order of the canonical First/Second/Third.
    const card = playerPage.locator('.answer-card');
    const rows = card.locator('.ordered-answer-row');
    await expect(rows).toHaveCount(3, { timeout: 30000 });

    const rowTexts = () => rows.locator('.ordered-answer-text').allTextContents();
    const initial = await rowTexts();
    expect(new Set(initial)).toEqual(new Set(['First', 'Second', 'Third']));

    // Move the second row up: it swaps with the first row (whatever the
    // shuffle produced), and the row that reaches the top loses its (now
    // pointless) up button.
    const movedUp = initial[1];
    await rows.nth(1).getByRole('button', { name: `Move ${movedUp} up` }).click();
    const afterSwap = await rowTexts();
    expect(afterSwap[0]).toBe(movedUp);
    expect(afterSwap[1]).toBe(initial[0]);
    await expect(rows.nth(0).getByRole('button', { name: `Move ${movedUp} up` })).toBeDisabled();
    await expect(rows.nth(0).getByRole('button', { name: `Move ${movedUp} down` })).toBeEnabled();

    // Pick a wager and submit.
    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();

    // The stored answer is the player's final order as a JSON array.
    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(1);
    const submitted = (await playerAnswers(request, sessionId, modId, playerId, 0, 0))[0].answer;
    expect(JSON.parse(submitted)).toEqual(afterSwap);

    // Re-submitting updates the answer: move the last row up, then Update.
    const lastText = ((await rows.nth(2).locator('.ordered-answer-text').textContent()) ?? '').trim();
    await rows.nth(2).getByRole('button', { name: `Move ${lastText} up` }).click();
    const reordered = await rowTexts();
    const updateButton = card.getByRole('button', { name: 'Update', exact: true });
    await expect(updateButton).toBeEnabled();
    await updateButton.click();

    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(2);
    const updated = (await playerAnswers(request, sessionId, modId, playerId, 0, 0))[1].answer;
    expect(JSON.parse(updated)).toEqual(reordered);

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });

  test('ordering: canonical, reversed and wrong orders auto-score correctly', async ({ browser, request }) => {
    test.setTimeout(120000);
    const prefix = unique();
    const seeded = await seedStartableOrderingGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const p1 = await joinPlayer(browser, sessionId, `Team A ${prefix}`, `Player A ${prefix}`);
    const p2 = await joinPlayer(browser, sessionId, `Team B ${prefix}`, `Player B ${prefix}`);
    const p3 = await joinPlayer(browser, sessionId, `Team C ${prefix}`, `Player C ${prefix}`);

    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    for (const p of [p1, p2, p3]) {
      await expect(p.page.locator('.active-game')).toBeVisible({ timeout: 30000 });
    }

    // Each player reorders the (shuffled) grid to their chosen answer, picks a
    // wager and submits: canonical, reversed (accepted per ticket #212) and a
    // wrong order.
    const submit = async (player: { page: Page; playerId: string }, order: string[]) => {
      const card = player.page.locator('.answer-card');
      await reorderGridTo(card, order);
      await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
      const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
      await expect(answerButton).toBeEnabled();
      await answerButton.click();

      await expect
        .poll(async () => (await playerAnswers(request, sessionId, modId, player.playerId, 0, 0)).length)
        .toBe(1);
      const stored = (await playerAnswers(request, sessionId, modId, player.playerId, 0, 0))[0].answer;
      expect(JSON.parse(stored)).toEqual(order);
    };

    await submit(p1, ['First', 'Second', 'Third']); // canonical
    await submit(p2, ['Third', 'Second', 'First']); // reversed
    await submit(p3, ['Second', 'First', 'Third']); // wrong

    // Ordering is auto-scored by the backend (ticket #212), so the mod's
    // scorer has no manual correct/incorrect buttons — the Score button is
    // all that's needed.
    const scoreButton = modPage.locator('.player-scorer').getByRole('button', { name: 'Score', exact: true });
    await expect(scoreButton).toBeEnabled({ timeout: 30000 });
    await scoreButton.click();

    // Scoring commits atomically; the canonical player's wager (100) landing
    // confirms it finished. correct=false is omitted by the answers API
    // (models.Answer), so correctness is asserted via the awarded points:
    // canonical and reversed orders score their wager, a wrong order scores 0.
    const latestPoints = async (playerId: string) => {
      const answers = await playerAnswers(request, sessionId, modId, playerId, 0, 0);
      const latest = answers[answers.length - 1];
      return latest ? (latest.points_awarded ?? 0) : undefined;
    };
    await expect.poll(() => latestPoints(p1.playerId)).toBe(100); // canonical order correct
    await expect.poll(() => latestPoints(p2.playerId)).toBe(100); // reversed order correct

    // Wrong order: the scoreboard stays at 0 for that team (the end-to-end
    // check, mirroring the freeform incorrect-answer test).
    await expect(
      modPage.locator('.scoreboard .ant-card').filter({ hasText: `Team C ${prefix}` }),
    ).toContainText('0', { timeout: 30000 });

    await p1.context.close();
    await p2.context.close();
    await p3.context.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [p1.playerId, p2.playerId, p3.playerId] });
  });

  test('ordering: mod sees a shuffled list pre-score, canonical post-score, and numbered scorer answers', async ({
    browser,
    request,
  }) => {
    test.setTimeout(90000);
    const prefix = unique();
    const seeded = await seedStartableOrderingGame(request, prefix);
    const { sessionId, modId } = await createSession(request, `e2e-session-${prefix}`, seeded.gameId);

    const { context: modContext, page: modPage } = await openModLobby(browser, sessionId, modId);
    const { context: playerContext, page: playerPage, playerId } = await joinPlayer(
      browser,
      sessionId,
      `Team ${prefix}`,
      `Player ${prefix}`,
    );
    await modPage.locator('.start-button').click();
    await expect(modPage.locator('.active-game')).toBeVisible({ timeout: 30000 });
    await expect(playerPage.locator('.active-game')).toBeVisible({ timeout: 30000 });

    const modBox = modPage.locator('.active-question-box');

    // Pre-score (ticket #215): the mod's question box lists the ordering items
    // in a shuffled order — the server serves the mod the canonical order, so
    // the client shows a deterministic shuffle, always a permutation.
    const modItems = modBox.locator('ol li');
    await expect(modItems).toHaveCount(3, { timeout: 30000 });
    const preScore = (await modItems.allTextContents()).map((t) => t.trim());
    expect(new Set(preScore)).toEqual(new Set(['First', 'Second', 'Third']));

    // The player submits the canonical order.
    const card = playerPage.locator('.answer-card');
    await reorderGridTo(card, ['First', 'Second', 'Third']);
    await card.locator('.ant-radio-button-wrapper').filter({ hasText: '100' }).click();
    const answerButton = card.getByRole('button', { name: 'Answer', exact: true });
    await expect(answerButton).toBeEnabled();
    await answerButton.click();
    await expect
      .poll(async () => (await playerAnswers(request, sessionId, modId, playerId, 0, 0)).length)
      .toBe(1);

    // The mod's scorer renders the submitted JSON array as a numbered list,
    // not raw JSON (ticket #215).
    const scorerList = modPage.locator('.answered-or-not ol');
    await expect(scorerList).toHaveCount(1, { timeout: 30000 });
    await expect
      .poll(async () => (await scorerList.locator('li').allTextContents()).map((t) => t.trim()), { timeout: 30000 })
      .toEqual(['First', 'Second', 'Third']);

    // Score, then the mod's question box reveals the canonical order.
    const scoreButton = modPage.locator('.player-scorer').getByRole('button', { name: 'Score', exact: true });
    await expect(scoreButton).toBeEnabled({ timeout: 30000 });
    await scoreButton.click();
    await expect.poll(async () => {
      const answers = await playerAnswers(request, sessionId, modId, playerId, 0, 0);
      return answers[answers.length - 1]?.correct;
    }).toBe(true);

    await expect
      .poll(async () => (await modBox.locator('ol li').allTextContents()).map((t) => t.trim()), { timeout: 30000 })
      .toEqual(['First', 'Second', 'Third']);

    await playerContext.close();
    await modContext.close();
    await cleanup(request, seeded, { sessionId, modId, playerIds: [playerId] });
  });
});
