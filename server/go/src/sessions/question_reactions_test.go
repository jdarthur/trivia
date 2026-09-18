package sessions

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

// questionReactionRequest drives a question-reaction handler
// (SetQuestionReaction / RemoveQuestionReaction) over an in-process HTTP
// request. The acting player is derived from the body's player_id and set as
// the server-verified caller, mirroring common.WithPlayer.
func questionReactionRequest(t *testing.T, env *Env, handler func(*gin.Context), method string, sessionId string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	return reactionRequest(t, env, handler, method, sessionId, body)
}

// newUnstartedSession builds a session that has never been started — no
// current round/question — so a question reaction must be rejected.
func newUnstartedSession(t *testing.T, env *Env) (models.Session, models.PlayerId) {
	t.Helper()
	mod := createPlayer(t, env, "mod")
	gameId, _, err := common.Create((*common.Env)(env), common.GameTable, &models.Game{Name: "G"})
	if err != nil {
		t.Fatal(err)
	}
	sessionId, _, err := common.Create((*common.Env)(env), common.SessionTable,
		&models.Session{Name: "S", GameId: gameId, Moderator: mod})
	if err != nil {
		t.Fatal(err)
	}
	if err := common.IncrementState((*common.Env)(env), sessionId); err != nil {
		t.Fatal(err)
	}
	var session models.Session
	if err := common.GetOne((*common.Env)(env), common.SessionTable, sessionId, &session); err != nil {
		t.Fatal(err)
	}
	return session, mod
}

// currentQuestion drives GetCurrentQuestion and returns the parsed payload.
func currentQuestion(t *testing.T, env *Env, sessionId string, caller models.PlayerId) models.QuestionInRound {
	t.Helper()
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Params = gin.Params{{Key: "id", Value: sessionId}}
	c.Request = httptest.NewRequest(http.MethodGet,
		"/gameplay/session/"+sessionId+"/current-question", nil)
	setPlayer(c, caller)
	env.GetCurrentQuestion(c)
	var q models.QuestionInRound
	if err := json.Unmarshal(rec.Body.Bytes(), &q); err != nil {
		t.Fatalf("bad current-question response %q: %v", rec.Body.String(), err)
	}
	return q
}

func TestSetQuestionReactionCreatesAndUpdates(t *testing.T) {
	env := openSessionTestDB(t)
	// newScoredFixture leaves (0,0) as the current question but unscored —
	// question reactions are allowed before scoring (ticket #293).
	session, _, p2 := newScoredFixture(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT question reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID            string `json:"id"`
		CreateDate    string `json:"create_date"`
		SessionId     string `json:"session_id"`
		RoundIndex    int    `json:"round_index"`
		QuestionIndex int    `json:"question_index"`
		PlayerId      string `json:"player_id"`
		Emoji         string `json:"emoji"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad question reaction response %q: %v", rec.Body.String(), err)
	}
	if created.ID == "" || created.CreateDate == "" || created.SessionId != session.ID ||
		created.RoundIndex != 0 || created.QuestionIndex != 0 || created.PlayerId != string(p2) || created.Emoji != "👍" {
		t.Errorf("question reaction response = %+v", created)
	}

	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Error("state token did not change on question reaction")
	}

	// a second PUT from the same player updates in place (react-once)
	rec = questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "❤️"})
	if rec.Code != http.StatusOK {
		t.Fatalf("second PUT question reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM question_reaction
		WHERE session_id = ? AND player_id = ?`, session.ID, string(p2)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("question_reaction rows = %d after update, want 1", n)
	}
	var emoji string
	if err := env.Db.QueryRow(`SELECT emoji FROM question_reaction
		WHERE session_id = ? AND player_id = ?`, session.ID, string(p2)).Scan(&emoji); err != nil {
		t.Fatal(err)
	}
	if emoji != "❤️" {
		t.Errorf("emoji after update = %q, want ❤️", emoji)
	}
}

func TestSetQuestionReactionAllowedBeforeScoring(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := newScoredFixture(t, env)

	// the current question is not scored, but a question reaction is fine
	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "😂"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT question reaction before score = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetQuestionReactionRejectsInvalidEmoji(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := newScoredFixture(t, env)

	for _, emoji := range []string{"abc", "👍❤️", "", "  ", "a👍", "💩💩"} {
		rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
			map[string]interface{}{"player_id": string(p2), "emoji": emoji})
		if rec.Code != http.StatusBadRequest {
			t.Errorf("emoji %q: PUT question reaction = %d: %s", emoji, rec.Code, rec.Body.String())
			continue
		}
		var resp struct {
			Field string `json:"field"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatal(err)
		}
		if resp.Field != models.Emoji {
			t.Errorf("emoji %q: field = %q, want %q", emoji, resp.Field, models.Emoji)
		}
	}
}

func TestSetQuestionReactionRejectsNonMemberAndInactivePlayers(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := newScoredFixture(t, env)

	// a player who is not in the session
	stranger := createPlayer(t, env, "stranger")
	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(stranger), "emoji": "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT question reaction by non-member = %d: %s", rec.Code, rec.Body.String())
	}

	// an inactive (left/booted) member
	if _, err := env.Db.Exec(`UPDATE session_player SET active = 0
		WHERE session_id = ? AND player_id = ?`, session.ID, string(p2)); err != nil {
		t.Fatal(err)
	}
	rec = questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT question reaction by inactive player = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetQuestionReactionRejectsUnstartedSession(t *testing.T) {
	env := openSessionTestDB(t)
	session, mod := newUnstartedSession(t, env)

	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(mod), "emoji": "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT question reaction on unstarted session = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRemoveQuestionReaction(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := newScoredFixture(t, env)

	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT question reaction = %d: %s", rec.Code, rec.Body.String())
	}

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	rec = questionReactionRequest(t, env, env.RemoveQuestionReaction, http.MethodDelete, session.ID,
		map[string]interface{}{"player_id": string(p2)})
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE question reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM question_reaction
		WHERE session_id = ? AND player_id = ?`, session.ID, string(p2)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("question_reaction rows after delete = %d, want 0", n)
	}

	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Error("state token did not change on question reaction delete")
	}

	// deleting a reaction the player does not have is an error
	rec = questionReactionRequest(t, env, env.RemoveQuestionReaction, http.MethodDelete, session.ID,
		map[string]interface{}{"player_id": string(p2)})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("second DELETE question reaction = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestQuestionReactionTargetsNewCurrentQuestion(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := newScoredFixture(t, env)

	// react on (0,0) — the current question
	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT question reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM question_reaction
		WHERE session_id = ? AND question_index = 0`, session.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("question_reaction rows on (0,0) = %d, want 1", n)
	}

	// advance to (0,1): a reaction now targets the new current question, and
	// the old one is untouched (a player can react to a new question)
	advanceCurrentQuestion(t, env, session)
	rec = questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(p2), "emoji": "🔥"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT question reaction on advanced question = %d: %s", rec.Code, rec.Body.String())
	}
	var q0, q1 int
	if err := env.Db.QueryRow(`SELECT count(*) FROM question_reaction
		WHERE session_id = ? AND question_index = 0`, session.ID).Scan(&q0); err != nil {
		t.Fatal(err)
	}
	if err := env.Db.QueryRow(`SELECT count(*) FROM question_reaction
		WHERE session_id = ? AND question_index = 1`, session.ID).Scan(&q1); err != nil {
		t.Fatal(err)
	}
	if q0 != 1 || q1 != 1 {
		t.Errorf("question_reaction rows = (q0=%d, q1=%d), want (1,1)", q0, q1)
	}
}

func TestModeratorCanReactToQuestionWithoutJoinRow(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, _ := newScoredFixture(t, env)

	rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
		map[string]interface{}{"player_id": string(session.Moderator), "emoji": "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("mod PUT question reaction = %d: %s", rec.Code, rec.Body.String())
	}
	rec = questionReactionRequest(t, env, env.RemoveQuestionReaction, http.MethodDelete, session.ID,
		map[string]interface{}{"player_id": string(session.Moderator)})
	if rec.Code != http.StatusOK {
		t.Fatalf("mod DELETE question reaction = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetCurrentQuestionIncludesReactions(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env)

	// two members react to the question; p1's is 👍, p2's is 😂
	react := func(player models.PlayerId, emoji string) {
		t.Helper()
		rec := questionReactionRequest(t, env, env.SetQuestionReaction, http.MethodPut, session.ID,
			map[string]interface{}{"player_id": string(player), "emoji": emoji})
		if rec.Code != http.StatusOK {
			t.Fatalf("PUT question reaction = %d: %s", rec.Code, rec.Body.String())
		}
	}
	react(p1, "👍")
	react(p2, "😂")

	// viewed as p1: both counts, and p1's own reaction flagged
	q := currentQuestion(t, env, session.ID, p1)
	if q.Reactions["👍"].Count != 1 || q.Reactions["😂"].Count != 1 {
		t.Errorf("reactions = %+v, want 👍=1 😂=1", q.Reactions)
	}
	if !hasTeam(q.Reactions["👍"].Players, "team-1") || !hasTeam(q.Reactions["😂"].Players, "team-2") {
		t.Errorf("reactions players = %v, want team-1 and team-2", q.Reactions)
	}
	if q.MyReaction != "👍" {
		t.Errorf("p1 my_reaction = %q, want 👍", q.MyReaction)
	}

	// viewed as p2: my_reaction reflects p2's own 😂
	q2 := currentQuestion(t, env, session.ID, p2)
	if q2.MyReaction != "😂" {
		t.Errorf("p2 my_reaction = %q, want 😂", q2.MyReaction)
	}

	// viewed as the moderator: counts visible, no own reaction
	qMod := currentQuestion(t, env, session.ID, session.Moderator)
	if qMod.Reactions["👍"].Count != 1 || qMod.MyReaction != "" {
		t.Errorf("mod reactions = %+v, my_reaction = %q", qMod.Reactions, qMod.MyReaction)
	}
}
