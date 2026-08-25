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

// reactionRequest drives a reaction handler (SetReaction / RemoveReaction)
// over an in-process HTTP request and returns the recorder.
func reactionRequest(t *testing.T, env *Env, handler func(*gin.Context), method string, sessionId string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: sessionId}}
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(method, "/gameplay/session/"+sessionId+"/reaction", bytes.NewReader(payload))
	c.Request.Header.Set("Content-Type", "application/json")
	handler(c)
	return recorder
}

// answerIdFor returns the answer ID of the given player for question (0,0) of
// the fixture (each fixture player answers exactly once).
func answerIdFor(t *testing.T, env *Env, sessionId string, player models.PlayerId) string {
	t.Helper()
	answers, err := answersForQuestion(env, sessionId, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range answers {
		if a.PlayerId == player {
			return a.ID
		}
	}
	t.Fatalf("no answer for player %v", player)
	return ""
}

// scoredFixture scores question (0,0) of a fresh newScoredFixture session.
func scoredFixture(t *testing.T, env *Env) (models.Session, models.PlayerId, models.PlayerId) {
	t.Helper()
	session, p1, p2 := newScoredFixture(t, env)
	if err := scoreQuestionTx(env, session, scoreRequest(p1, p2), 0, 0); err != nil {
		t.Fatal(err)
	}
	return session, p1, p2
}

func TestSetReactionCreatesAndUpdates(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		AnswerId   string `json:"answer_id"`
		PlayerId   string `json:"player_id"`
		Emoji      string `json:"emoji"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad reaction response %q: %v", rec.Body.String(), err)
	}
	if created.ID == "" || created.CreateDate == "" || created.AnswerId != p1Answer || created.PlayerId != string(p2) || created.Emoji != "👍" {
		t.Errorf("reaction response = %+v", created)
	}

	// the mutation bumped the state token so clients refetch
	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Error("state token did not change on reaction")
	}

	// a second PUT from the same player on the same answer updates in place
	// (react-once: still exactly one row)
	rec = reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "❤️"})
	if rec.Code != http.StatusOK {
		t.Fatalf("second PUT reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM answer_reaction
		WHERE answer_id = ? AND player_id = ?`, p1Answer, string(p2)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("answer_reaction rows = %d after update, want 1", n)
	}
	var emoji string
	if err := env.Db.QueryRow(`SELECT emoji FROM answer_reaction
		WHERE answer_id = ? AND player_id = ?`, p1Answer, string(p2)).Scan(&emoji); err != nil {
		t.Fatal(err)
	}
	if emoji != "❤️" {
		t.Errorf("emoji after update = %q, want ❤️", emoji)
	}
}

func TestSetReactionRequiresScoredQuestion(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := newScoredFixture(t, env) // not scored
	p1Answer := answerIdFor(t, env, session.ID, p1)

	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction before score = %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Errors string `json:"errors"`
		Field  string `json:"field"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Field != models.QuestionIndex {
		t.Errorf("field = %q, want %q", resp.Field, models.QuestionIndex)
	}
}

func TestSetReactionRejectsInvalidEmoji(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	for _, emoji := range []string{"abc", "👍❤️", "", "  ", "a👍", "💩💩"} {
		rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
			models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: emoji})
		if rec.Code != http.StatusBadRequest {
			t.Errorf("emoji %q: PUT reaction = %d: %s", emoji, rec.Code, rec.Body.String())
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

func TestSetReactionRejectsUnknownOrForeignAnswer(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := scoredFixture(t, env)

	// unknown answer ID
	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: "nope", PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction on unknown answer = %d: %s", rec.Code, rec.Body.String())
	}

	// an answer from a different session
	otherSession, otherP1, _ := scoredFixture(t, env)
	otherP1Answer := answerIdFor(t, env, otherSession.ID, otherP1)
	rec = reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: otherP1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction on foreign answer = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetReactionRejectsNonMemberAndInactivePlayers(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	// a player who is not in the session
	stranger := createPlayer(t, env, "stranger")
	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: stranger, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction by non-member = %d: %s", rec.Code, rec.Body.String())
	}

	// an inactive (left/booted) member
	if _, err := env.Db.Exec(`UPDATE session_player SET active = 0
		WHERE session_id = ? AND player_id = ?`, session.ID, string(p2)); err != nil {
		t.Fatal(err)
	}
	rec = reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction by inactive player = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRemoveReaction(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT reaction = %d: %s", rec.Code, rec.Body.String())
	}

	stateBefore, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	rec = reactionRequest(t, env, env.RemoveReaction, http.MethodDelete, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2})
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE reaction = %d: %s", rec.Code, rec.Body.String())
	}
	var n int
	if err := env.Db.QueryRow(`SELECT count(*) FROM answer_reaction
		WHERE answer_id = ? AND player_id = ?`, p1Answer, string(p2)).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("answer_reaction rows after delete = %d, want 0", n)
	}

	stateAfter, err := common.GetState((*common.Env)(env), session.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Error("state token did not change on reaction delete")
	}

	// deleting a reaction the player does not have is an error
	rec = reactionRequest(t, env, env.RemoveReaction, http.MethodDelete, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("second DELETE reaction = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestRemoveReactionRejectsForeignAnswer(t *testing.T) {
	env := openSessionTestDB(t)
	session, _, p2 := scoredFixture(t, env)
	otherSession, otherP1, _ := scoredFixture(t, env)
	otherP1Answer := answerIdFor(t, env, otherSession.ID, otherP1)

	rec := reactionRequest(t, env, env.RemoveReaction, http.MethodDelete, session.ID,
		models.AnswerReaction{AnswerId: otherP1Answer, PlayerId: p2})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("DELETE reaction on foreign answer = %d: %s", rec.Code, rec.Body.String())
	}
}

// advanceCurrentQuestion moves the session's current question to (0,1) via
// the SetCurrentQuestion handler, so the scored (0,0) question is no longer
// the one everyone is looking at.
func advanceCurrentQuestion(t *testing.T, env *Env, session models.Session) {
	t.Helper()
	rec := reactionRequest(t, env, env.SetCurrentQuestion, http.MethodPut, session.ID,
		map[string]interface{}{"question_id": 1, "round_id": 0, "player_id": string(session.Moderator)})
	if rec.Code != http.StatusOK {
		t.Fatalf("SetCurrentQuestion = %d: %s", rec.Code, rec.Body.String())
	}
}

func TestSetReactionRequiresCurrentQuestion(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	// a reaction is fine while the scored question is the current one
	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT reaction on current question = %d: %s", rec.Code, rec.Body.String())
	}

	// once the moderator advances, the same reaction is rejected
	advanceCurrentQuestion(t, env, session)
	rec = reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("PUT reaction on past question = %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Field string `json:"field"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Field != models.QuestionIndex {
		t.Errorf("field = %q, want %q", resp.Field, models.QuestionIndex)
	}
}

func TestRemoveReactionGatesMatchSet(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)

	rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2, Emoji: "👍"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT reaction = %d: %s", rec.Code, rec.Body.String())
	}

	// once the question is no longer current, the owner cannot remove either
	advanceCurrentQuestion(t, env, session)
	rec = reactionRequest(t, env, env.RemoveReaction, http.MethodDelete, session.ID,
		models.AnswerReaction{AnswerId: p1Answer, PlayerId: p2})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("DELETE reaction on past question = %d: %s", rec.Code, rec.Body.String())
	}

	// and an inactivated player cannot remove their reaction
	session2, p3, p4 := scoredFixture(t, env)
	p3Answer := answerIdFor(t, env, session2.ID, p3)
	rec = reactionRequest(t, env, env.SetReaction, http.MethodPut, session2.ID,
		models.AnswerReaction{AnswerId: p3Answer, PlayerId: p4, Emoji: "😂"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT reaction = %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := env.Db.Exec(`UPDATE session_player SET active = 0
		WHERE session_id = ? AND player_id = ?`, session2.ID, string(p4)); err != nil {
		t.Fatal(err)
	}
	rec = reactionRequest(t, env, env.RemoveReaction, http.MethodDelete, session2.ID,
		models.AnswerReaction{AnswerId: p3Answer, PlayerId: p4})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("DELETE reaction by inactive player = %d: %s", rec.Code, rec.Body.String())
	}
}

// teamByName finds a scored team by its team name.
func teamByName(t *testing.T, resp models.AnswersResponseScored, name string) models.ScoredTeam {
	t.Helper()
	for _, team := range resp.Answers {
		if team.TeamName == name {
			return team
		}
	}
	t.Fatalf("no team %q in %+v", name, resp.Answers)
	return models.ScoredTeam{}
}

func TestGetAnswersScoredIncludesReactions(t *testing.T) {
	env := openSessionTestDB(t)
	session, p1, p2 := scoredFixture(t, env)
	p1Answer := answerIdFor(t, env, session.ID, p1)
	p2Answer := answerIdFor(t, env, session.ID, p2)

	// a third member reacts to p1's answer too, so the count is > 1
	p3 := createPlayer(t, env, "team-3")
	if err := common.Push((*common.Env)(env), common.SessionTable, session.ID, models.Players, p3); err != nil {
		t.Fatal(err)
	}

	react := func(player models.PlayerId, answerId, emoji string) {
		t.Helper()
		rec := reactionRequest(t, env, env.SetReaction, http.MethodPut, session.ID,
			models.AnswerReaction{AnswerId: answerId, PlayerId: player, Emoji: emoji})
		if rec.Code != http.StatusOK {
			t.Fatalf("PUT reaction = %d: %s", rec.Code, rec.Body.String())
		}
	}
	react(p2, p1Answer, "👍")
	react(p3, p1Answer, "👍")
	react(p1, p2Answer, "😂")

	// viewed as p1: counts on both answers, my_reaction only where p1 reacted
	scored, err := getAnswersScored(env, session, 0, 0, p1)
	if err != nil {
		t.Fatal(err)
	}
	team1 := teamByName(t, scored, "team-1")
	if len(team1.Answers) != 1 {
		t.Fatalf("team-1 answers = %+v, want 1", team1.Answers)
	}
	a1 := team1.Answers[0]
	if a1.AnswerId != p1Answer {
		t.Errorf("answer_id = %q, want %q", a1.AnswerId, p1Answer)
	}
	if a1.Reactions["👍"] != 2 {
		t.Errorf("👍 count = %d, want 2 (%+v)", a1.Reactions["👍"], a1.Reactions)
	}
	if a1.MyReaction != "" {
		t.Errorf("p1 my_reaction on own answer = %q, want empty", a1.MyReaction)
	}

	team2 := teamByName(t, scored, "team-2")
	if len(team2.Answers) != 1 {
		t.Fatalf("team-2 answers = %+v, want 1", team2.Answers)
	}
	a2 := team2.Answers[0]
	if a2.AnswerId != p2Answer {
		t.Errorf("answer_id = %q, want %q", a2.AnswerId, p2Answer)
	}
	if a2.Reactions["😂"] != 1 {
		t.Errorf("😂 count = %d, want 1 (%+v)", a2.Reactions["😂"], a2.Reactions)
	}
	if a2.MyReaction != "😂" {
		t.Errorf("p1 my_reaction on p2's answer = %q, want 😂", a2.MyReaction)
	}

	// viewed as p2: my_reaction reflects p2's own 👍 on p1's answer
	scored2, err := getAnswersScored(env, session, 0, 0, p2)
	if err != nil {
		t.Fatal(err)
	}
	a1AsP2 := teamByName(t, scored2, "team-1").Answers[0]
	if a1AsP2.MyReaction != "👍" {
		t.Errorf("p2 my_reaction on p1's answer = %q, want 👍", a1AsP2.MyReaction)
	}
}

func TestIsSingleEmoji(t *testing.T) {
	valid := []string{
		"👍", "😀", "❤️", "👍🏽",
		// family emoji written with explicit escapes: the ZWJ (U+200D) does
		// not survive copy/paste round-trips reliably
		"\U0001F468\u200D\U0001F469\u200D\U0001F467\u200D\U0001F466",
		"🇺🇸", "1️⃣", " 😀 ", "🤑", "🎉",
		// enclosed ideographic supplement (🈷️) and chess symbols (🨀)
		"\U0001F237\uFE0F", "\U0001FA00",
	}
	for _, emoji := range valid {
		if !isSingleEmoji(emoji) {
			t.Errorf("isSingleEmoji(%q) = false, want true", emoji)
		}
	}

	invalid := []string{
		"", "   ", "abc", "12", "a👍", "👍❤️", "👍🏽👍", "💩💩", "😀😀", "hello 😀",
	}
	for _, emoji := range invalid {
		if isSingleEmoji(emoji) {
			t.Errorf("isSingleEmoji(%q) = true, want false", emoji)
		}
	}
}
