package sessions

import (
	"path/filepath"
	"sync"
	"testing"

	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/store"
)

// These tests exercise the session-port logic (#76) directly: scoring runs in
// a transaction over session_question / answer / session_score, the scoreboard
// is built from session_score + session_player, and wagers / answers read the
// answer table.

func openSessionTestDB(t *testing.T) *Env {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(db); err != nil {
		t.Fatal(err)
	}
	return &Env{Db: db}
}

func createQuestion(t *testing.T, env *Env, text, answer, category string) string {
	t.Helper()
	id, _, err := common.Create((*common.Env)(env), common.QuestionTable,
		&models.Question{Question: text, Answer: answer, Category: category})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func createPlayer(t *testing.T, env *Env, teamName string) models.PlayerId {
	t.Helper()
	id, _, err := common.Create((*common.Env)(env), common.PlayerTable, &models.Player{TeamName: teamName})
	if err != nil {
		t.Fatal(err)
	}
	return models.PlayerId(id)
}

// newScoredFixture builds a session with one round of two questions (wagers
// 100 and 200), two players, the (0,0) snapshot set, and one answer per
// player for question 0 (player 1 wagers 100, player 2 wagers 200).
func newScoredFixture(t *testing.T, env *Env) (session models.Session, p1 models.PlayerId, p2 models.PlayerId) {
	t.Helper()

	q1 := createQuestion(t, env, "q1?", "a1", "Cat A")
	q2 := createQuestion(t, env, "q2?", "a2", "Cat B")
	round := models.Round{Name: "R", Questions: []string{q1, q2}, Wagers: []int{100, 200}}
	roundId, _, err := common.Create((*common.Env)(env), common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "G", Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}}
	gameId, _, err := common.Create((*common.Env)(env), common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}

	mod := createPlayer(t, env, "mod")
	p1 = createPlayer(t, env, "team-1")
	p2 = createPlayer(t, env, "team-2")

	sessionId, _, err := common.Create((*common.Env)(env), common.SessionTable,
		&models.Session{Name: "S", GameId: gameId, Moderator: mod})
	if err != nil {
		t.Fatal(err)
	}
	// CreateSession bumps the state token right after inserting, which creates
	// the session_state row the scoring transaction upserts.
	if err := common.IncrementState((*common.Env)(env), sessionId); err != nil {
		t.Fatal(err)
	}
	for _, p := range []models.PlayerId{p1, p2} {
		if err := common.Push((*common.Env)(env), common.SessionTable, sessionId, models.Players, p); err != nil {
			t.Fatal(err)
		}
	}

	if err := common.GetOne((*common.Env)(env), common.SessionTable, sessionId, &session); err != nil {
		t.Fatal(err)
	}
	if err := _setCurrentRound(env, &session, 0, 0); err != nil {
		t.Fatal(err)
	}

	answer := func(player models.PlayerId, wager int) {
		w := wager
		r := 0
		q := 0
		if _, _, err := common.Create((*common.Env)(env), common.AnswerTable, &models.Answer{
			SessionId: sessionId, RoundIndex: &r, QuestionIndex: &q, PlayerId: player,
			Answer: "guess", Wager: w,
		}); err != nil {
			t.Fatal(err)
		}
	}
	answer(p1, 100)
	answer(p2, 200)

	if err := common.GetOne((*common.Env)(env), common.SessionTable, sessionId, &session); err != nil {
		t.Fatal(err)
	}
	return session, p1, p2
}

func scoreRequest(p1 models.PlayerId, p2 models.PlayerId) models.ScoreRequest {
	return models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true},
			p2: {Correct: false},
		},
	}
}

func TestScoreQuestionWritesAnswersScoresAndState(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	if err := scoreQuestionTx(env, session, scoreRequest(p1, p2), 0, 0); err != nil {
		t.Fatal(err)
	}

	// answers carry the correct flag and awarded points
	answers, err := latestAnswersForQuestion(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	got := map[models.PlayerId]models.Answer{}
	for _, a := range answers {
		got[a.PlayerId] = a
	}
	if !got[p1].Correct || got[p1].PointsAwarded != 100 {
		t.Fatalf("player 1 answer = %+v, want correct with 100 points", got[p1])
	}
	if got[p2].Correct || got[p2].PointsAwarded != 0 {
		t.Fatalf("player 2 answer = %+v, want incorrect with 0 points", got[p2])
	}

	// session_score holds the round totals
	var roundTotal float64
	if err := env.Db.QueryRow(`SELECT points FROM session_score
		WHERE session_id = ? AND player_id = ? AND round_index = 0`, session.ID, string(p1)).Scan(&roundTotal); err != nil {
		t.Fatal(err)
	}
	if roundTotal != 100 {
		t.Fatalf("player 1 round total = %v, want 100", roundTotal)
	}
	if err := env.Db.QueryRow(`SELECT points FROM session_score
		WHERE session_id = ? AND player_id = ? AND round_index = 0`, session.ID, string(p2)).Scan(&roundTotal); err != nil {
		t.Fatal(err)
	}
	if roundTotal != 0 {
		t.Fatalf("player 2 round total = %v, want 0", roundTotal)
	}

	// the snapshot is marked scored and the state token moved in the same commit
	snapshot, err := sessionQuestionSnapshot(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !snapshot.Scored {
		t.Error("question not marked scored")
	}
	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Error("state token did not change on scoring")
	}

	// a rescore adjusts the round total instead of doubling it
	override := 50.0
	rescore := models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true, ScoreOverride: &override},
			p2: {Correct: false},
		},
	}
	if err := scoreQuestionTx(env, session, rescore, 0, 0); err != nil {
		t.Fatal(err)
	}
	if err := env.Db.QueryRow(`SELECT points FROM session_score
		WHERE session_id = ? AND player_id = ? AND round_index = 0`, session.ID, string(p1)).Scan(&roundTotal); err != nil {
		t.Fatal(err)
	}
	if roundTotal != 50 {
		t.Fatalf("player 1 round total after rescore = %v, want 50", roundTotal)
	}
}

func TestScoreQuestionRollsBackOnMissingAnswer(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	// p3 never answered: scoring must fail and change nothing
	p3 := createPlayer(t, env, "team-3")
	if err := common.Push((*common.Env)(env), common.SessionTable, session.ID, models.Players, p3); err != nil {
		t.Fatal(err)
	}
	request := models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true},
			p2: {Correct: false},
			p3: {Correct: false},
		},
	}
	if err := scoreQuestionTx(env, session, request, 0, 0); err == nil {
		t.Fatal("expected IllegalScoreError for unanswered player")
	} else if _, ok := err.(IllegalScoreError); !ok {
		t.Fatalf("expected IllegalScoreError, got %T: %v", err, err)
	}

	// nothing was written: answers unscored, no session_score rows, snapshot
	// not scored, state unchanged
	answers, err := latestAnswersForQuestion(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range answers {
		if a.Correct || a.PointsAwarded != 0 {
			t.Fatalf("answer %s was written despite rollback: %+v", a.ID, a)
		}
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM session_score WHERE session_id = ?`, session.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("session_score rows written despite rollback: %d", n)
	}
	snapshot, err := sessionQuestionSnapshot(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Scored {
		t.Error("snapshot marked scored despite rollback")
	}
	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore != stateAfter {
		t.Error("state token changed despite rollback")
	}
}

// Scoring is serialized by BEGIN IMMEDIATE: two concurrent scorers cannot
// interleave, so the final state is exactly one scorer's full outcome — the
// round total always equals the last-written answer's points, never a mix.
func TestConcurrentScoringSerializes(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	override := 75.0
	scorerA := models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true},
			p2: {Correct: false},
		},
	}
	scorerB := models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true, ScoreOverride: &override},
			p2: {Correct: true},
		},
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 2)
	for _, request := range []models.ScoreRequest{scorerA, scorerB} {
		wg.Add(1)
		go func(request models.ScoreRequest) {
			defer wg.Done()
			if err := scoreQuestionTx(env, session, request, 0, 0); err != nil {
				errCh <- err
			}
		}(request)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}

	answers, err := latestAnswersForQuestion(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	got := map[models.PlayerId]models.Answer{}
	for _, a := range answers {
		got[a.PlayerId] = a
	}

	// whichever scorer committed last, the round totals must equal that
	// scorer's outcome exactly (never a blend of the two)
	var roundTotal float64
	if err := env.Db.QueryRow(`SELECT points FROM session_score
		WHERE session_id = ? AND player_id = ? AND round_index = 0`, session.ID, string(p1)).Scan(&roundTotal); err != nil {
		t.Fatal(err)
	}
	if roundTotal != got[p1].PointsAwarded {
		t.Fatalf("player 1 round total %v != last answer points %v", roundTotal, got[p1].PointsAwarded)
	}
	if err := env.Db.QueryRow(`SELECT points FROM session_score
		WHERE session_id = ? AND player_id = ? AND round_index = 0`, session.ID, string(p2)).Scan(&roundTotal); err != nil {
		t.Fatal(err)
	}
	if roundTotal != got[p2].PointsAwarded {
		t.Fatalf("player 2 round total %v != last answer points %v", roundTotal, got[p2].PointsAwarded)
	}
	if roundTotal != 0 && roundTotal != 200 {
		t.Fatalf("player 2 round total %v, want exactly one scorer's outcome (0 or 200)", roundTotal)
	}
}

func TestScoreboardFromSessionScore(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	// before scoring: every player present with an empty score list
	board, err := getSessionScoreboard(env, session.ID, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(board.Scores) != 2 {
		t.Fatalf("scoreboard has %d entries, want 2: %+v", len(board.Scores), board.Scores)
	}
	for _, s := range board.Scores {
		if len(s.Score) != 0 {
			t.Fatalf("expected empty score before scoring: %+v", s)
		}
	}

	if err := scoreQuestionTx(env, session, scoreRequest(p1, p2), 0, 0); err != nil {
		t.Fatal(err)
	}

	// a non-mod caller only sees their own player_id
	board, err = getSessionScoreboard(env, session.ID, string(p1))
	if err != nil {
		t.Fatal(err)
	}
	if len(board.Scores) != 2 {
		t.Fatalf("scoreboard has %d entries, want 2: %+v", len(board.Scores), board.Scores)
	}
	byTeam := map[string]models.PlayerScore{}
	for _, s := range board.Scores {
		byTeam[s.TeamName] = s
	}
	if got := byTeam["team-1"].Score; len(got) != 1 || got[0] != 100 {
		t.Fatalf("team-1 score = %v, want [100]", got)
	}
	if got := byTeam["team-2"].Score; len(got) != 1 || got[0] != 0 {
		t.Fatalf("team-2 score = %v, want [0]", got)
	}
	if byTeam["team-1"].PlayerId != p1 {
		t.Fatalf("caller's player_id not exposed: %+v", byTeam["team-1"])
	}
	if byTeam["team-2"].PlayerId != "" {
		t.Fatalf("other player's id leaked: %+v", byTeam["team-2"])
	}
}

func TestAnswersUnscoredAndScored(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	// unscored view derives team/answered from session_player + answer table
	unscored, err := getAnswersUnscored(env, session, 0, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(unscored.Answers) != 2 {
		t.Fatalf("unscored answers = %+v, want 2 teams", unscored.Answers)
	}
	byTeam := map[string]models.AnswerUnscored{}
	for _, a := range unscored.Answers {
		byTeam[a.TeamName] = a
	}
	if !byTeam["team-1"].Answered || !byTeam["team-2"].Answered {
		t.Fatalf("answered flags = %+v", unscored.Answers)
	}
	if byTeam["team-1"].PlayerId != p1 {
		t.Fatalf("caller player_id not exposed: %+v", byTeam["team-1"])
	}
	if byTeam["team-2"].PlayerId != "" {
		t.Fatalf("other player's id leaked: %+v", byTeam["team-2"])
	}

	// a team that has not answered shows answered=false
	var third models.PlayerId = createPlayer(t, env, "team-3")
	if err := common.Push((*common.Env)(env), common.SessionTable, session.ID, models.Players, third); err != nil {
		t.Fatal(err)
	}
	var session2 models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, session.ID, &session2); err != nil {
		t.Fatal(err)
	}
	unscored, err = getAnswersUnscored(env, session2, 0, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(unscored.Answers) != 3 {
		t.Fatalf("unscored answers = %+v, want 3 teams", unscored.Answers)
	}
	for _, a := range unscored.Answers {
		if a.TeamName == "team-3" && a.Answered {
			t.Fatal("team-3 should show unanswered")
		}
	}

	// team-3 answers, then scoring covers everyone in the session
	r := 0
	q := 0
	if _, _, err := common.Create((*common.Env)(env), common.AnswerTable, &models.Answer{
		SessionId: session.ID, RoundIndex: &r, QuestionIndex: &q, PlayerId: third,
		Answer: "guess", Wager: 100,
	}); err != nil {
		t.Fatal(err)
	}

	// scored view returns the awarded points per team
	if err := scoreQuestionTx(env, session2, models.ScoreRequest{
		RoundIndex: 0, QuestionIndex: 0,
		Players: map[models.PlayerId]models.CorrectorNot{
			p1: {Correct: true},
			p2: {Correct: false},
			third: {Correct: false},
		},
	}, 0, 0); err != nil {
		t.Fatal(err)
	}
	scored, err := getAnswersScored(env, session2, 0, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	if !scored.Scored {
		t.Fatal("scored flag not set")
	}
	byTeam2 := map[string]models.ScoredTeam{}
	for _, a := range scored.Answers {
		byTeam2[a.TeamName] = a
	}
	if len(byTeam2["team-1"].Answers) != 1 || byTeam2["team-1"].Answers[0].PointsAwarded != 100 {
		t.Fatalf("team-1 scored answers = %+v", byTeam2["team-1"].Answers)
	}
	if len(byTeam2["team-3"].Answers) != 1 || byTeam2["team-3"].Answers[0].PointsAwarded != 0 {
		t.Fatalf("team-3 scored answers = %+v", byTeam2["team-3"].Answers)
	}
}

func TestGetWagersDeductsUsedWagers(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	// before the question is scored, both wagers are available
	wagers, err := getWagers(env, session, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(wagers) != 2 || wagers[0] != 100 || wagers[1] != 200 {
		t.Fatalf("available wagers = %v, want [100 200]", wagers)
	}

	// after scoring, the player's used wager (100) is no longer available
	if err := scoreQuestionTx(env, session, scoreRequest(p1, p2), 0, 0); err != nil {
		t.Fatal(err)
	}
	var session2 models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, session.ID, &session2); err != nil {
		t.Fatal(err)
	}
	wagers, err = getWagers(env, session2, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(wagers) != 1 || wagers[0] != 200 {
		t.Fatalf("available wagers after scoring = %v, want [200]", wagers)
	}
}
