package test

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/sessions"
)

// Integration tests for GET /gameplay/session/:id/score-history (ticket #234).
// They drive the real route through common.Respond so the NonexistentIdError
// mapping is covered, against a temp-file SQLite DB with no external service.

// scoreHistoryFixture is a session with a moderator (a player record, not a
// member), two member teams, and a session_question axis of R0Q0, R0Q1, R1Q0 —
// enough to exercise a round boundary — served through the real route.
type scoreHistoryFixture struct {
	db        *sql.DB
	router    *gin.Engine
	sessionId string
	mod       string
	p1        string
	p2        string
}

func newScoreHistoryFixture(t *testing.T) *scoreHistoryFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := GetDb()
	env := &common.Env{Db: db}

	mod, _, err := common.Create(env, common.PlayerTable, &models.Player{TeamName: "mod", RealName: "mod"})
	if err != nil {
		t.Fatal(err)
	}
	sessionId, _, err := common.Create(env, common.SessionTable, &models.Session{
		Name: "S", Moderator: models.PlayerId(mod),
	})
	if err != nil {
		t.Fatal(err)
	}

	p1 := createPlayer(t, env, "team-1")
	p2 := createPlayer(t, env, "team-2")
	if err := common.Push(env, common.SessionTable, sessionId, models.Players, models.PlayerId(p1)); err != nil {
		t.Fatal(err)
	}
	if err := common.Push(env, common.SessionTable, sessionId, models.Players, models.PlayerId(p2)); err != nil {
		t.Fatal(err)
	}

	// the x-axis: the questions the game has reached, spanning a round boundary
	for _, rc := range [][2]int{{0, 0}, {0, 1}, {1, 0}} {
		if _, err := db.Exec(`INSERT INTO session_question (session_id, round_index, question_index)
			VALUES (?, ?, ?)`, sessionId, rc[0], rc[1]); err != nil {
			t.Fatal(err)
		}
	}

	router := gin.New()
	s := sessions.Env{Db: db}
	router.GET("/gameplay/session/:id/score-history", s.GetSessionScoreHistory)

	return &scoreHistoryFixture{
		db: db, router: router, sessionId: sessionId,
		mod: mod, p1: p1, p2: p2,
	}
}

// answer inserts an answer row with the given already-awarded points and
// returns its id (so a test can re-score it, as scoreQuestionTx would).
func (f *scoreHistoryFixture) answer(t *testing.T, player string, round, question int, points float64) string {
	t.Helper()
	r, q := round, question
	id, _, err := common.Create(&common.Env{Db: f.db}, common.AnswerTable, &models.Answer{
		SessionId: f.sessionId, RoundIndex: &r, QuestionIndex: &q,
		PlayerId: models.PlayerId(player), Answer: "a", Wager: 100,
		Correct: true, PointsAwarded: points,
	})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// get hits the score-history route as caller ("" for anonymous) and decodes
// the response; errBody is the parsed error JSON when status != 200.
func (f *scoreHistoryFixture) get(t *testing.T, caller string) (int, models.ScoreHistory, map[string]interface{}) {
	t.Helper()
	url := "/gameplay/session/" + f.sessionId + "/score-history"
	if caller != "" {
		url += "?player_id=" + caller
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	f.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		var errBody map[string]interface{}
		if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err != nil {
			t.Fatalf("status %d: bad error body %q: %v", rec.Code, rec.Body.String(), err)
		}
		return rec.Code, models.ScoreHistory{}, errBody
	}

	var history models.ScoreHistory
	if err := json.Unmarshal(rec.Body.Bytes(), &history); err != nil {
		t.Fatal(err)
	}
	return rec.Code, history, nil
}

// seriesByTeam maps a history's series by team name.
func seriesByTeam(t *testing.T, h models.ScoreHistory) map[string]models.ScoreHistorySeries {
	t.Helper()
	byTeam := make(map[string]models.ScoreHistorySeries, len(h.Series))
	for _, s := range h.Series {
		byTeam[s.TeamName] = s
	}
	return byTeam
}

func eqCumulative(t *testing.T, got []float64, want ...float64) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("cumulative = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("cumulative = %v, want %v", got, want)
		}
	}
}

// The axis comes from session_question in game order, labelled R{r+1}Q{q+1}
// across a round boundary; a skipped question keeps the line flat, and a
// player with no points appears zero-filled.
func TestScoreHistoryAxisAndRunningSum(t *testing.T) {
	f := newScoreHistoryFixture(t)

	// team-1 answers R0Q0 (+100) and R1Q0 (+50), skipping R0Q1.
	f.answer(t, f.p1, 0, 0, 100)
	f.answer(t, f.p1, 1, 0, 50)

	_, history, _ := f.get(t, "")
	wantLabels := []string{"R1Q1", "R1Q2", "R2Q1"}
	if len(history.PointsPerQuestion) != len(wantLabels) {
		t.Fatalf("axis = %v, want %v", history.PointsPerQuestion, wantLabels)
	}
	for i, label := range wantLabels {
		if history.PointsPerQuestion[i] != label {
			t.Fatalf("axis = %v, want %v", history.PointsPerQuestion, wantLabels)
		}
	}

	byTeam := seriesByTeam(t, history)
	eqCumulative(t, byTeam["team-1"].Cumulative, 100, 100, 150) // flat at R1Q2
	eqCumulative(t, byTeam["team-2"].Cumulative, 0, 0, 0)       // zero-filled
}

// Re-scoring a question (scoreQuestionTx UPDATEs the same answer row) replaces
// the contribution instead of double-counting.
func TestScoreHistoryRescoreReplaces(t *testing.T) {
	f := newScoreHistoryFixture(t)
	id := f.answer(t, f.p1, 0, 0, 100)
	f.answer(t, f.p1, 0, 1, 50)

	if _, err := f.db.Exec(`UPDATE answer SET points_awarded = 200 WHERE id = ?`, id); err != nil {
		t.Fatal(err)
	}

	_, history, _ := f.get(t, "")
	eqCumulative(t, seriesByTeam(t, history)["team-1"].Cumulative, 200, 250, 250)
}

// Only the latest answer row per (player, question) counts when a player
// re-answers.
func TestScoreHistoryLatestAnswerWins(t *testing.T) {
	f := newScoreHistoryFixture(t)
	f.answer(t, f.p1, 0, 0, 100)
	f.answer(t, f.p1, 0, 0, 40) // re-answer supersedes
	f.answer(t, f.p1, 0, 0, 25) // and again

	_, history, _ := f.get(t, "")
	eqCumulative(t, seriesByTeam(t, history)["team-1"].Cumulative, 25, 25, 25)
}

// Moneyball results flow through, including a negative cumulative.
func TestScoreHistoryMoneyballNegative(t *testing.T) {
	f := newScoreHistoryFixture(t)
	f.answer(t, f.p1, 0, 0, -100) // moneyball miss: -1X
	f.answer(t, f.p1, 0, 1, 200)  // lone correct: 2X
	f.answer(t, f.p1, 1, 0, 50)

	_, history, _ := f.get(t, "")
	eqCumulative(t, seriesByTeam(t, history)["team-1"].Cumulative, -100, 100, 150)
}

// A player who scored then left the session still appears.
func TestScoreHistoryRemovedPlayerStillAppears(t *testing.T) {
	f := newScoreHistoryFixture(t)
	p3 := createPlayer(t, &common.Env{Db: f.db}, "team-3")
	if err := common.Push(&common.Env{Db: f.db}, common.SessionTable, f.sessionId, models.Players, models.PlayerId(p3)); err != nil {
		t.Fatal(err)
	}
	f.answer(t, p3, 0, 0, 100)

	// leave the session
	if err := common.Pull(&common.Env{Db: f.db}, common.SessionTable, f.sessionId, models.Players, p3); err != nil {
		t.Fatal(err)
	}

	_, history, _ := f.get(t, "")
	byTeam := seriesByTeam(t, history)
	if _, ok := byTeam["team-3"]; !ok {
		t.Fatalf("removed player missing from history: %+v", history.Series)
	}
	eqCumulative(t, byTeam["team-3"].Cumulative, 100, 100, 100)
}

// player_id is masked: a caller sees only their own id, a moderator sees
// everyone's, an anonymous caller sees none.
func TestScoreHistoryPlayerIdMasking(t *testing.T) {
	f := newScoreHistoryFixture(t)
	f.answer(t, f.p1, 0, 0, 100)
	f.answer(t, f.p2, 0, 1, 50)

	// as team-1: own id exposed, team-2's omitted
	_, history, _ := f.get(t, f.p1)
	byTeam := seriesByTeam(t, history)
	if byTeam["team-1"].PlayerId != models.PlayerId(f.p1) {
		t.Fatalf("caller player_id not exposed: %+v", byTeam["team-1"])
	}
	if byTeam["team-2"].PlayerId != "" {
		t.Fatalf("other player's id leaked: %+v", byTeam["team-2"])
	}

	// as the moderator: everyone's id exposed
	_, history, _ = f.get(t, f.mod)
	byTeam = seriesByTeam(t, history)
	if byTeam["team-1"].PlayerId != models.PlayerId(f.p1) || byTeam["team-2"].PlayerId != models.PlayerId(f.p2) {
		t.Fatalf("moderator should see all player ids: %+v", history.Series)
	}

	// anonymous: no ids
	_, history, _ = f.get(t, "")
	byTeam = seriesByTeam(t, history)
	if byTeam["team-1"].PlayerId != "" || byTeam["team-2"].PlayerId != "" {
		t.Fatalf("anonymous caller leaked ids: %+v", history.Series)
	}
}

// Unknown session id maps to the standard NonexistentIdError 404 via
// common.Respond.
func TestScoreHistoryUnknownSession(t *testing.T) {
	f := newScoreHistoryFixture(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/gameplay/session/not-a-real-id/score-history", nil)
	f.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	var errBody map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &errBody); err != nil {
		t.Fatal(err)
	}
	if _, ok := errBody["errors"]; !ok {
		t.Fatalf("expected an errors key, got %v", errBody)
	}
}
