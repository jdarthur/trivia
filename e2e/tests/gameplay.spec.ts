import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

// Gameplay e2e (ticket #109): lobby + session start, first slice of the
// single-session suite. Unlike the editor suites, gameplay is anonymous and
// involves multiple actors, so each test drives a separate browser context per
// actor (mod + players) through the real invite-link/join flow, instead of the
// editorTest/editorPage fixtures.

// The dev DB is one shared SQLite file for the whole `playwright test` run, so
// every test uses a unique prefix and cleans up what it created.
const unique = () => String(Date.now());

const BASE_URL = 'http://localhost:8080/';
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

async function createQuestion(
  request: APIRequestContext,
  category: string,
  question: string,
  answer: string,
): Promise<string> {
  const res = await request.post('/editor/question', {
    headers: { 'borttrivia-token': token },
    data: { category, question, answer, scoring_note: '' },
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
  await request.delete(`/editor/round/${seeded.roundId}`);
  for (const qid of seeded.qids) await request.delete(`/editor/question/${qid}`);
}

// --- Actor helpers ---------------------------------------------------------

// Open the mod's lobby from the invite URL plus its own player_id.
async function openModLobby(browser: { newContext: (o?: object) => Promise<BrowserContext> }, sessionId: string, modId: string) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto(`/?session_id=${sessionId}&player_id=${modId}`);
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

// Full setup for a scoring test: seed a game, open a session, start it with a
// joined player, and return every handle plus the unique team name.
async function setupActiveGame(
  browser: { newContext: (o?: object) => Promise<BrowserContext> },
  request: APIRequestContext,
  prefix: string,
) {
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
});
