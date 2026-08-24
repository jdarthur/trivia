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

// hotEditFixture builds a session with one round of one question whose (0,0)
// snapshot has been set, plus a scoring note to attach. The session is created
// through the real CreateSession handler so the moderator player and the
// session_state row exist exactly as they do in production.
func hotEditFixture(t *testing.T, env *Env) (session models.Session, questionId string, noteId string) {
	t.Helper()
	gameId := createStartableGame(t, env)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	body, err := json.Marshal(map[string]string{"name": "S", "game_id": gameId})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/gameplay/session", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	env.CreateSession(c)
	if c.IsAborted() {
		t.Fatalf("CreateSession aborted with %d: %s", recorder.Code, recorder.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad create response %q: %v", recorder.Body.String(), err)
	}

	noteId, _, err = common.Create((*common.Env)(env), common.ScoringNoteTable,
		&models.ScoringNote{Name: "N", Description: "the hint text"})
	if err != nil {
		t.Fatal(err)
	}

	if err := common.GetOne((*common.Env)(env), common.SessionTable, created.ID, &session); err != nil {
		t.Fatal(err)
	}
	questionId = session.Rounds[0].Questions[0].QuestionId
	if err := _setCurrentRound(env, &session, 0, 0); err != nil {
		t.Fatal(err)
	}
	return session, questionId, noteId
}

// hotEditQuestion invokes the HotEditQuestion handler exactly as the route
// does after the WithValidSession / AsMod middleware have put the session in
// the context.
func hotEditQuestion(t *testing.T, env *Env, session models.Session, category, question, answer, scoringNote string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: session.ID}}
	c.Set("session", session)
	body, err := json.Marshal(map[string]interface{}{
		"round_index":    0,
		"question_index": 0,
		"question": map[string]string{
			"category":     category,
			"question":     question,
			"answer":       answer,
			"scoring_note": scoringNote,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPut,
		"/gameplay/session/"+session.ID+"/hot-edit-question", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	env.HotEditQuestion(c)
	return recorder
}

// HotEditQuestion is the API a moderator uses to rewrite a question mid-game.
// Rewriting the scoring note must update both the session_question snapshot
// (the text served to clients) and the canonical question row, and bump the
// session_state token so every connected client re-fetches the session.
func TestHotEditQuestionScoringNoteBumpsState(t *testing.T) {
	env := openSessionTestDB(t)
	session, questionId, noteId := hotEditFixture(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	recorder := hotEditQuestion(t, env, session, "Cat A", "rewritten q?", "rewritten a", noteId)
	if c := recorder.Code; c != http.StatusOK {
		t.Fatalf("HotEditQuestion returned %d: %s", c, recorder.Body.String())
	}

	// the state token moved, so clients long-polling /state re-fetch the session
	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateAfter == stateBefore {
		t.Error("state token did not change on hot-edit")
	}

	// the session_question snapshot carries the new text and the resolved note
	snapshot, err := sessionQuestionSnapshot(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Question != "rewritten q?" || snapshot.Answer != "rewritten a" {
		t.Errorf("snapshot = %q / %q, want rewritten text", snapshot.Question, snapshot.Answer)
	}
	if snapshot.ScoringNoteId != noteId {
		t.Errorf("snapshot scoring_note_id = %q, want %q", snapshot.ScoringNoteId, noteId)
	}
	if snapshot.ScoringNote != "the hint text" {
		t.Errorf("snapshot scoring_note = %q, want %q (resolved description)", snapshot.ScoringNote, "the hint text")
	}

	// the canonical question row follows
	var question models.Question
	if err := common.GetOne((*common.Env)(env), common.QuestionTable, questionId, &question); err != nil {
		t.Fatal(err)
	}
	if question.ScoringNote != noteId {
		t.Errorf("question scoring_note = %q, want %q", question.ScoringNote, noteId)
	}

	// the client-facing session read overlays the snapshot's note text
	var reloaded models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, session.ID, &reloaded); err != nil {
		t.Fatal(err)
	}
	got := reloaded.Rounds[0].Questions[0]
	if got.ScoringNote != "the hint text" {
		t.Errorf("session read scoring_note = %q, want %q", got.ScoringNote, "the hint text")
	}
	if got.ScoringNoteId != noteId {
		t.Errorf("session read scoring_note_id = %q, want %q", got.ScoringNoteId, noteId)
	}
}

// Clearing the scoring note in a hot-edit must clear both the snapshot and the
// question row (NULL in the FK column) and still bump the state token.
func TestHotEditQuestionClearsScoringNote(t *testing.T) {
	env := openSessionTestDB(t)
	session, questionId, noteId := hotEditFixture(t, env)

	// attach the note first
	if recorder := hotEditQuestion(t, env, session, "Cat A", "q?", "a", noteId); recorder.Code != http.StatusOK {
		t.Fatalf("HotEditQuestion returned %d: %s", recorder.Code, recorder.Body.String())
	}

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	// now clear it
	if recorder := hotEditQuestion(t, env, session, "Cat A", "q?", "a", ""); recorder.Code != http.StatusOK {
		t.Fatalf("HotEditQuestion returned %d: %s", recorder.Code, recorder.Body.String())
	}

	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateAfter == stateBefore {
		t.Error("state token did not change when clearing the scoring note")
	}

	snapshot, err := sessionQuestionSnapshot(env, session.ID, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.ScoringNoteId != "" || snapshot.ScoringNote != "" {
		t.Errorf("snapshot scoring note = %q / %q, want cleared", snapshot.ScoringNoteId, snapshot.ScoringNote)
	}

	var question models.Question
	if err := common.GetOne((*common.Env)(env), common.QuestionTable, questionId, &question); err != nil {
		t.Fatal(err)
	}
	if question.ScoringNote != "" {
		t.Errorf("question scoring_note = %q, want cleared", question.ScoringNote)
	}
}
