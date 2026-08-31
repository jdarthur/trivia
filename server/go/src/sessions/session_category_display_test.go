package sessions

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

// The gameplay category display must show the category's NAME, never its ID.
//
// Regression test: since ticket #180 a question row stores the category's ID,
// while the session wire format carries the resolved name (the session_question
// snapshot column stores a name, resolved at set-time). loadSessionRounds
// derived a session's rounds straight off the question rows, so every question
// the session had not snapshotted yet — the whole category strip at game start,
// and every question ahead of the host's position — carried the raw UUID into
// the UI until the host navigated to it and the snapshot filled the name in.
func TestCurrentRoundAndQuestionCarryCategoryNames(t *testing.T) {
	env := openSessionTestDB(t)

	// One round of two questions in two different categories, so the
	// never-snapshotted question (index 1) can be told apart from the one
	// StartSession snapshots (index 0).
	q1 := createQuestion(t, env, "q1?", "a1", "Cat A")
	q2 := createQuestion(t, env, "q2?", "a2", "Cat B")
	round := models.Round{Name: "R", Questions: []string{q1, q2}, Wagers: []int{100}}
	roundId, _, err := common.Create((*common.Env)(env), common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "G", Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}}
	gameId, _, err := common.Create((*common.Env)(env), common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}

	// Sanity: the fixture stores category IDs on the question rows, so the
	// assertions below can't pass vacuously.
	var qModel models.Question
	if err := common.GetOne((*common.Env)(env), common.QuestionTable, q2, &qModel); err != nil {
		t.Fatal(err)
	}
	if qModel.Category == "Cat B" || len(qModel.Category) < 20 {
		t.Fatalf("expected a category ID on the question row, got %q", qModel.Category)
	}

	gin.SetMode(gin.TestMode)

	// create + start the session through the handlers
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	body, err := json.Marshal(map[string]string{"name": "S", "game_id": gameId})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/gameplay/session", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	env.CreateSession(c)
	if c.IsAborted() {
		t.Fatalf("CreateSession aborted with %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID  string `json:"id"`
		Mod string `json:"mod"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad create response %q: %v", rec.Body.String(), err)
	}
	rec = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(rec)
	c.Params = gin.Params{{Key: "id", Value: created.ID}}
	startBody, err := json.Marshal(map[string]string{"player_id": created.Mod})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost,
		"/gameplay/session/"+created.ID+"/start", bytes.NewReader(startBody))
	c.Request.Header.Set("Content-Type", "application/json")
	env.StartSession(c)
	if c.IsAborted() {
		t.Fatalf("StartSession aborted with %d: %s", rec.Code, rec.Body.String())
	}

	// current-round: the category strip for the whole round, including the
	// question the host has not advanced to (no snapshot row for it yet).
	rec = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(rec)
	c.Params = gin.Params{{Key: "id", Value: created.ID}}
	c.Request = httptest.NewRequest(http.MethodGet,
		"/gameplay/session/"+created.ID+"/current-round", nil)
	env.GetCurrentRound(c)
	if c.IsAborted() {
		t.Fatalf("GetCurrentRound aborted with %d: %s", rec.Code, rec.Body.String())
	}
	var roundResp struct {
		Categories []string `json:"categories"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &roundResp); err != nil {
		t.Fatalf("bad current-round response %q: %v", rec.Body.String(), err)
	}
	if len(roundResp.Categories) != 2 {
		t.Fatalf("want 2 categories, got %d: %s", len(roundResp.Categories), rec.Body.String())
	}
	if roundResp.Categories[0] != "Cat A" || roundResp.Categories[1] != "Cat B" {
		t.Fatalf("current-round categories must be category names, got %#v", roundResp.Categories)
	}

	// The session document's derived rounds carry names for both the
	// snapshotted question (0) and the derived one (1).
	var session models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, created.ID, &session); err != nil {
		t.Fatal(err)
	}
	if got := session.Rounds[0].Questions[0].Category; got != "Cat A" {
		t.Fatalf("snapshotted session question category must be the name, got %q", got)
	}
	if got := session.Rounds[0].Questions[1].Category; got != "Cat B" {
		t.Fatalf("derived session question category must be the name, got %q", got)
	}

	// current-question: the breadcrumb for the question the host is on.
	rec = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(rec)
	c.Params = gin.Params{{Key: "id", Value: created.ID}}
	c.Request = httptest.NewRequest(http.MethodGet,
		"/gameplay/session/"+created.ID+"/current-question?player_id="+created.Mod, nil)
	env.GetCurrentQuestion(c)
	if c.IsAborted() {
		t.Fatalf("GetCurrentQuestion aborted with %d: %s", rec.Code, rec.Body.String())
	}
	var question struct {
		Category string `json:"category"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &question); err != nil {
		t.Fatalf("bad current-question response %q: %v", rec.Body.String(), err)
	}
	if question.Category != "Cat A" {
		t.Fatalf("current-question category must be the name, got %q", question.Category)
	}
}

// Deleting a category mid-game must not break the session read. The FK is
// ON DELETE SET NULL (migration 13), so the question's category clears and the
// gameplay display renders it as empty rather than erroring or showing junk.
func TestCurrentRoundAfterCategoryDeletion(t *testing.T) {
	env := openSessionTestDB(t)

	q := createQuestion(t, env, "q?", "a", "Doomed")
	var qModel models.Question
	if err := common.GetOne((*common.Env)(env), common.QuestionTable, q, &qModel); err != nil {
		t.Fatal(err)
	}
	categoryId := qModel.Category

	round := models.Round{Name: "R", Questions: []string{q}, Wagers: []int{100}}
	roundId, _, err := common.Create((*common.Env)(env), common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "G", Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}}
	gameId, _, err := common.Create((*common.Env)(env), common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}

	var session models.Session
	session.GameId = gameId
	sessionId, _, err := common.Create((*common.Env)(env), common.SessionTable, &session)
	if err != nil {
		t.Fatal(err)
	}

	// Drop the category now that the game references the question.
	if _, err := env.Db.Exec(`DELETE FROM category WHERE id = ?`, categoryId); err != nil {
		t.Fatal(err)
	}

	var loaded models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, sessionId, &loaded); err != nil {
		t.Fatal(err)
	}
	if len(loaded.Rounds) != 1 || len(loaded.Rounds[0].Questions) != 1 {
		t.Fatalf("expected one round with one question, got %#v", loaded.Rounds)
	}
	if got := loaded.Rounds[0].Questions[0].Category; got != "" {
		t.Fatalf("a question whose category was deleted should display as empty, got %q", got)
	}
}
