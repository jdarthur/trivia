package test

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/questions"
)

// These tests exercise the SQLite data-access layer directly (the engine swap
// in #75): CRUD per table, join-table maintenance, session relational state,
// and the session_state upsert.

func newEnv(t *testing.T) *common.Env {
	t.Helper()
	return &common.Env{Db: GetDb()}
}

// createPlayer inserts a player record and returns its ID. session_player
// rows carry a foreign key to player, so membership tests need real players.
func createPlayer(t *testing.T, env *common.Env, teamName string) string {
	t.Helper()
	playerId, _, err := common.Create(env, common.PlayerTable, &models.Player{TeamName: teamName})
	if err != nil {
		t.Fatal(err)
	}
	return playerId
}

func TestQuestionCrud(t *testing.T) {
	env := &questions.Env{Db: GetDb()}
	userId := "user-1"

	// categories are a root model now (ticket #179); a question's category
	// field carries the category's ID
	category, err := questions.CreateCategory(env, models.Category{
		UserId: userId,
		Name:   "cat",
	})
	if err != nil {
		t.Fatal(err)
	}

	created, err := questions.CreateOneQuestion(env, userId, models.Question{
		Category: category.ID, Question: "q?", Answer: "a", UserId: userId,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID == "" {
		t.Fatal("expected a generated ID")
	}

	got, err := questions.GetOneQuestion(env, userId, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Category != category.ID || got.Question != "q?" || got.Answer != "a" {
		t.Fatalf("got %+v", got)
	}
	if got.CreateDate.IsZero() {
		t.Error("expected create date to be set")
	}

	if _, err := questions.UpdateOneQuestion(env, userId, created.ID, questions.QuestionUpdate{
		Question: "q2", Answer: "a2",
	}); err != nil {
		t.Fatal(err)
	}
	got, err = questions.GetOneQuestion(env, userId, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Question != "q2" || got.Answer != "a2" || got.Category != category.ID {
		t.Fatalf("question not merged on update: %+v", got)
	}

	if _, err := questions.DeleteOneQuestion(env, userId, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := questions.DeleteCategory(env, userId, category.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := questions.GetOneQuestion(env, userId, created.ID); err == nil {
		t.Error("expected error after delete")
	}
}

func TestRoundQuestionJoinAndRoundsUsed(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	createQuestion := func(text string) string {
		q, err := questions.CreateOneQuestion(qenv, userId, models.Question{Question: text, Answer: "a"})
		if err != nil {
			t.Fatal(err)
		}
		return q.ID
	}
	q1 := createQuestion("q1")
	q2 := createQuestion("q2")
	q3 := createQuestion("q3")

	// create round with questions and wagers (mimics rounds.CreateRound);
	// membership lives in round_question, no rounds_used mirror to update
	round := models.Round{Name: "R", UserId: userId, Questions: []string{q1, q2}, Wagers: []int{100, 200}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}

	var got models.Round
	if err := common.GetOne(env, common.RoundTable, roundId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 2 || got.Questions[0] != q1 || got.Questions[1] != q2 {
		t.Fatalf("round questions = %v", got.Questions)
	}
	if len(got.Wagers) != 2 || got.Wagers[0] != 100 || got.Wagers[1] != 200 {
		t.Fatalf("round wagers = %v", got.Wagers)
	}

	// rounds_used is derived from round_question on read
	var q models.Question
	if err := common.GetOne(env, common.QuestionTable, q1, &q); err != nil {
		t.Fatal(err)
	}
	if len(q.RoundsUsed) != 1 || q.RoundsUsed[0] != roundId {
		t.Fatalf("question rounds_used = %v", q.RoundsUsed)
	}

	// update the round to [q2, q3] with new wagers (mimics rounds.UpdateRound);
	// Set rewrites round_question wholesale
	updated := models.Round{Name: "R2", UserId: userId, Questions: []string{q2, q3}, Wagers: []int{300}}
	if err := common.Set(env, common.RoundTable, roundId, updated); err != nil {
		t.Fatal(err)
	}

	if err := common.GetOne(env, common.RoundTable, roundId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 2 || got.Questions[0] != q2 || got.Questions[1] != q3 {
		t.Fatalf("round questions after update = %v", got.Questions)
	}
	if len(got.Wagers) != 1 || got.Wagers[0] != 300 {
		t.Fatalf("round wagers after update = %v", got.Wagers)
	}

	// derived rounds_used follows the membership change: q3 adopted, q1 released
	if err := common.GetOne(env, common.QuestionTable, q1, &q); err != nil {
		t.Fatal(err)
	}
	if len(q.RoundsUsed) != 0 {
		t.Fatalf("question rounds_used after update = %v", q.RoundsUsed)
	}
	if err := common.GetOne(env, common.QuestionTable, q3, &q); err != nil {
		t.Fatal(err)
	}
	if len(q.RoundsUsed) != 1 || q.RoundsUsed[0] != roundId {
		t.Fatalf("question rounds_used after update = %v", q.RoundsUsed)
	}

	// delete the round (mimics rounds.DeleteRound); the FK cascade removes
	// the round_question rows, so the derived rounds_used empties
	if err := common.Delete(env, common.RoundTable, roundId); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.QuestionTable, q2, &q); err != nil {
		t.Fatal(err)
	}
	if len(q.RoundsUsed) != 0 {
		t.Fatalf("question rounds_used after round delete = %v", q.RoundsUsed)
	}
}

func TestGameRoundJoinAndRoundNames(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"

	roundIds := make([]string, 2)
	for i := 0; i < 2; i++ {
		round := models.Round{Name: fmt.Sprintf("R%d", i), UserId: userId}
		id, _, err := common.Create(env, common.RoundTable, &round)
		if err != nil {
			t.Fatal(err)
		}
		roundIds[i] = id
	}

	game := models.Game{
		Name: "G", UserId: userId,
		Rounds:     roundIds,
		RoundNames: map[string]string{roundIds[0]: "Alpha", roundIds[1]: "Beta"},
	}
	gameId, _, err := common.Create(env, common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}
	// mirror the handler's games bookkeeping on the rounds
	for _, roundId := range game.Rounds {
		if err := common.Push(env, common.RoundTable, roundId, models.Games, gameId); err != nil {
			t.Fatal(err)
		}
	}

	var got models.Game
	if err := common.GetOne(env, common.GameTable, gameId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Rounds) != 2 || got.Rounds[0] != roundIds[0] || got.Rounds[1] != roundIds[1] {
		t.Fatalf("game rounds = %v", got.Rounds)
	}
	if got.RoundNames[roundIds[0]] != "Alpha" || got.RoundNames[roundIds[1]] != "Beta" {
		t.Fatalf("game round names = %v", got.RoundNames)
	}

	var round models.Round
	if err := common.GetOne(env, common.RoundTable, roundIds[0], &round); err != nil {
		t.Fatal(err)
	}
	if len(round.Games) != 1 || round.Games[0] != gameId {
		t.Fatalf("round games = %v", round.Games)
	}

	// delete the game and confirm rounds no longer list it
	if err := common.Delete(env, common.GameTable, gameId); err != nil {
		t.Fatal(err)
	}
	if err := common.Pull(env, common.RoundTable, roundIds[0], models.Games, gameId); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.RoundTable, roundIds[0], &round); err != nil {
		t.Fatal(err)
	}
	if len(round.Games) != 0 {
		t.Fatalf("round games after game delete = %v", round.Games)
	}
}

func TestSessionRelationalState(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"

	category, err := questions.CreateCategory(&questions.Env{Db: db}, models.Category{UserId: userId, Name: "cat"})
	if err != nil {
		t.Fatal(err)
	}
	question, err := questions.CreateOneQuestion(&questions.Env{Db: db}, userId, models.Question{Question: "q", Answer: "a", Category: category.ID})
	if err != nil {
		t.Fatal(err)
	}
	round := models.Round{Name: "R", UserId: userId, Questions: []string{question.ID}, Wagers: []int{100}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "G", UserId: userId, Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}}
	gameId, _, err := common.Create(env, common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}

	session := models.Session{Name: "S", GameId: gameId, Moderator: models.PlayerId("mod")}
	sessionId, _, err := common.Create(env, common.SessionTable, &session)
	if err != nil {
		t.Fatal(err)
	}

	// state token upserts
	if err := common.IncrementState(env, sessionId); err != nil {
		t.Fatal(err)
	}
	state1, err := common.GetState(env, sessionId)
	if err != nil {
		t.Fatal(err)
	}
	if state1 == "" {
		t.Error("expected a state token")
	}
	if err := common.IncrementState(env, sessionId); err != nil {
		t.Fatal(err)
	}
	state2, err := common.GetState(env, sessionId)
	if err != nil {
		t.Fatal(err)
	}
	if state1 == state2 {
		t.Error("expected state to change on increment")
	}

	// players push/pull maintain the session_player join
	p1 := createPlayer(t, env, "team-1")
	p2 := createPlayer(t, env, "team-2")
	if err := common.Push(env, common.SessionTable, sessionId, models.Players, models.PlayerId(p1)); err != nil {
		t.Fatal(err)
	}
	if err := common.Push(env, common.SessionTable, sessionId, models.Players, p2); err != nil {
		t.Fatal(err)
	}
	var got models.Session
	if err := common.GetOne(env, common.SessionTable, sessionId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Players) != 2 || got.Players[0] != models.PlayerId(p1) || got.Players[1] != models.PlayerId(p2) {
		t.Fatalf("session players = %v", got.Players)
	}
	if err := common.Pull(env, common.SessionTable, sessionId, models.Players, p1); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.SessionTable, sessionId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Players) != 1 || got.Players[0] != models.PlayerId(p2) {
		t.Fatalf("session players after pull = %v", got.Players)
	}

	// session reads reconstruct rounds from the game structure
	if len(got.Rounds) != 1 || got.Rounds[0].RoundId != roundId {
		t.Fatalf("session rounds = %+v", got.Rounds)
	}
	if len(got.Rounds[0].Wagers) != 1 || got.Rounds[0].Wagers[0] != 100 {
		t.Fatalf("session round wagers = %v", got.Rounds[0].Wagers)
	}
	if len(got.Rounds[0].Questions) != 1 || got.Rounds[0].Questions[0].Category != category.ID {
		t.Fatalf("session round questions = %+v", got.Rounds[0].Questions)
	}
	// the question id must survive the relational round-trip
	if got.Rounds[0].Questions[0].QuestionId != question.ID {
		t.Fatalf("question id lost in session read: %q", got.Rounds[0].Questions[0].QuestionId)
	}

	// a session_question snapshot overlays the question text and scored flag
	// (this is what _setCurrentQuestion / scoring write)
	if _, err := db.Exec(`INSERT INTO session_question
		(session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scoring_note, scored)
		VALUES (?, 0, 0, ?, 'cat', 'q', 'a', '', '', 1)`, sessionId, question.ID); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.SessionTable, sessionId, &got); err != nil {
		t.Fatal(err)
	}
	q := got.Rounds[0].Questions[0]
	if q.Question != "q" || q.Answer != "a" || !q.Scored {
		t.Fatalf("session_question overlay not applied: %+v", q)
	}

	// scoreboard reads come from session_score
	if _, err := db.Exec(`INSERT INTO session_score (session_id, player_id, round_index, points)
		VALUES (?, ?, 0, 100)`, sessionId, p2); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.SessionTable, sessionId, &got); err != nil {
		t.Fatal(err)
	}
	scores := got.Scoreboard[models.PlayerId(p2)]
	if len(scores) != 1 || scores[0] != 100 {
		t.Fatalf("session scoreboard = %v", got.Scoreboard)
	}

	// delete the session cascades its state, membership, snapshot, and score rows
	if err := common.Delete(env, common.SessionTable, sessionId); err != nil {
		t.Fatal(err)
	}
	if _, err := common.GetState(env, sessionId); err == nil {
		t.Error("expected state row to be cascade-deleted with session")
	}
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM session_player WHERE session_id = ?`, sessionId).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("session_player rows survived session delete: %d", n)
	}
	if err := db.QueryRow(`SELECT count(*) FROM session_question WHERE session_id = ?`, sessionId).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("session_question rows survived session delete: %d", n)
	}
	if err := db.QueryRow(`SELECT count(*) FROM session_score WHERE session_id = ?`, sessionId).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("session_score rows survived session delete: %d", n)
	}
}

func TestGetAllFilters(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"

	createQuestion := func(text string) string {
		q, err := questions.CreateOneQuestion(&questions.Env{Db: db}, userId, models.Question{Question: text, Answer: "a"})
		if err != nil {
			t.Fatal(err)
		}
		return q.ID
	}
	q1 := createQuestion("alpha question")
	q2 := createQuestion("beta question")
	createQuestion("gamma question")

	// user_id equality
	all, err := common.GetAll(env, common.QuestionTable, map[string]string{"user_id": userId})
	if err != nil {
		t.Fatal(err)
	}
	if len(all.([]*models.Question)) != 3 {
		t.Fatalf("expected 3 questions, got %d", len(all.([]*models.Question)))
	}

	// text_filter ($or regex)
	textFilter := map[string]interface{}{
		"user_id": userId,
		"$or": []common.M{
			{"question": common.M{"$regex": common.RegEx{Pattern: ".*BETA.*", Options: "i"}}},
		},
	}
	all, err = common.GetAll(env, common.QuestionTable, textFilter)
	if err != nil {
		t.Fatal(err)
	}
	questions := all.([]*models.Question)
	if len(questions) != 1 || questions[0].ID != q2 {
		t.Fatalf("text filter returned %v", questions)
	}

	// unused_only (rounds_used.0 $exists:false) — all questions unused
	unusedFilter := map[string]interface{}{"user_id": userId, models.RoundsUsed + ".0": common.M{"$exists": false}}
	all, err = common.GetAll(env, common.QuestionTable, unusedFilter)
	if err != nil {
		t.Fatal(err)
	}
	if len(all.([]*models.Question)) != 3 {
		t.Fatalf("expected 3 unused questions, got %d", len(all.([]*models.Question)))
	}

	// mark q1 as used (round_question row), then it should drop out of unused_only
	round := models.Round{Name: "R", UserId: userId, Questions: []string{q1}, Wagers: []int{100}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	all, err = common.GetAll(env, common.QuestionTable, unusedFilter)
	if err != nil {
		t.Fatal(err)
	}
	if len(all.([]*models.Question)) != 2 {
		t.Fatalf("expected 2 unused questions, got %d", len(all.([]*models.Question)))
	}

	// rounds unused_only (games.0 $exists:false)
	roundsUnused := map[string]interface{}{"user_id": userId, models.Games + ".0": common.M{"$exists": false}}
	allRounds, err := common.GetAll(env, common.RoundTable, roundsUnused)
	if err != nil {
		t.Fatal(err)
	}
	if len(allRounds.([]*models.Round)) != 1 {
		t.Fatalf("expected 1 unused round, got %d", len(allRounds.([]*models.Round)))
	}

	game := models.Game{Name: "G", UserId: userId, Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}}
	gameId, _, err := common.Create(env, common.GameTable, &game)
	if err != nil {
		t.Fatal(err)
	}
	if err := common.Push(env, common.RoundTable, roundId, models.Games, gameId); err != nil {
		t.Fatal(err)
	}
	allRounds, err = common.GetAll(env, common.RoundTable, roundsUnused)
	if err != nil {
		t.Fatal(err)
	}
	if len(allRounds.([]*models.Round)) != 0 {
		t.Fatalf("expected 0 unused rounds, got %d", len(allRounds.([]*models.Round)))
	}
}

func TestNonexistentIdAndCollectionCrud(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"

	var q models.Question
	if err := common.GetOne(env, common.QuestionTable, "not-a-real-id", &q); err == nil {
		t.Error("expected NonexistentIdError")
	} else if _, ok := err.(common.NonexistentIdError); !ok {
		t.Errorf("expected NonexistentIdError, got %T", err)
	}

	// collection with questions
	q1, err := questions.CreateOneQuestion(&questions.Env{Db: db}, userId, models.Question{Question: "q1", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	q2, err := questions.CreateOneQuestion(&questions.Env{Db: db}, userId, models.Question{Question: "q2", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}

	collection := models.Collection{Name: "C", UserId: userId, Questions: []string{q1.ID, q2.ID}}
	collectionId, _, err := common.Create(env, common.CollectionTable, &collection)
	if err != nil {
		t.Fatal(err)
	}
	var got models.Collection
	if err := common.GetOne(env, common.CollectionTable, collectionId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 2 || got.Questions[0] != q1.ID || got.Questions[1] != q2.ID {
		t.Fatalf("collection questions = %v", got.Questions)
	}

	// deleting one question cascades it out of the collection
	if err := common.Delete(env, common.QuestionTable, q1.ID); err != nil {
		t.Fatal(err)
	}
	if err := common.GetOne(env, common.CollectionTable, collectionId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 1 || got.Questions[0] != q2.ID {
		t.Fatalf("collection questions after question delete = %v", got.Questions)
	}
}

// The session_player membership join is maintained by a read-modify-write
// transaction. Concurrent writers must not lose updates: each push runs in a
// BEGIN IMMEDIATE transaction, so the second writer waits for the first
// instead of overwriting it.
func TestConcurrentSessionPlayersPush(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	sessionId, _, err := common.Create(env, common.SessionTable, &models.Session{Name: "S"})
	if err != nil {
		t.Fatal(err)
	}
	playerIds := make([]string, 0, 16)
	for i := 0; i < 16; i++ {
		playerIds = append(playerIds, createPlayer(t, env, fmt.Sprintf("team-%d", i)))
	}
	const n = 16
	var wg sync.WaitGroup
	errCh := make(chan error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			if err := common.Push(env, common.SessionTable, sessionId, models.Players, models.PlayerId(playerIds[i])); err != nil {
				errCh <- err
			}
		}(i)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		t.Fatal(err)
	}
	var got models.Session
	if err := common.GetOne(env, common.SessionTable, sessionId, &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Players) != n {
		t.Fatalf("expected %d players, got %d: %v", n, len(got.Players), got.Players)
	}
}

// The text filter is backed by a Go-regexp scalar function (regexp_like) so it
// keeps the mgo-era bson regex semantics: Unicode-aware case folding, and no
// wildcard interpretation of '%' or '_' in the search text.
func TestTextFilterRegexpSemantics(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"
	createQuestion := func(text string) string {
		q, err := questions.CreateOneQuestion(&questions.Env{Db: db}, userId, models.Question{Question: text, Answer: "a"})
		if err != nil {
			t.Fatal(err)
		}
		return q.ID
	}
	q1 := createQuestion("Café au lait")
	q2 := createQuestion("100% pure")
	q3 := createQuestion("alpha_beta")

	search := func(pattern string) []string {
		filter := map[string]interface{}{
			"user_id": userId,
			"$or": []common.M{
				{"question": common.M{"$regex": common.RegEx{Pattern: ".*" + pattern + ".*", Options: "i"}}},
			},
		}
		all, err := common.GetAll(env, common.QuestionTable, filter)
		if err != nil {
			t.Fatal(err)
		}
		ids := make([]string, 0)
		for _, q := range all.([]*models.Question) {
			ids = append(ids, q.ID)
		}
		return ids
	}

	// Unicode case folding: É matches é (SQLite LIKE is ASCII-only).
	if ids := search("CAFÉ"); len(ids) != 1 || ids[0] != q1 {
		t.Fatalf("Unicode case-insensitive search matched %v, want [%s]", ids, q1)
	}
	// '%' and '_' are literal characters, not LIKE wildcards.
	if ids := search("100%"); len(ids) != 1 || ids[0] != q2 {
		t.Fatalf("literal %% search matched %v, want [%s]", ids, q2)
	}
	if ids := search("alpha_beta"); len(ids) != 1 || ids[0] != q3 {
		t.Fatalf("literal _ search matched %v, want [%s]", ids, q3)
	}
	// an unparseable pattern matches nothing instead of failing the query
	if ids := search("("); len(ids) != 0 {
		t.Fatalf("invalid pattern matched %v, want none", ids)
	}
}

// The API must keep emitting timestamps in the historical wire format
// (UTC-naive "2006-01-02T15:04:05.000000"), matching what the mgo era sent
// and what the SQLite columns store.
func TestTimestampWireFormat(t *testing.T) {
	db := GetDb()
	env := &questions.Env{Db: db}
	created, err := questions.CreateOneQuestion(env, "user-1", models.Question{Question: "q", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	got, err := questions.GetOneQuestion(env, "user-1", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	wire, err := json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	var decoded struct {
		CreateDate string `json:"create_date"`
	}
	if err := json.Unmarshal(wire, &decoded); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(decoded.CreateDate, "Z") || strings.Contains(decoded.CreateDate, "+") {
		t.Fatalf("create_date gained a timezone suffix: %q", decoded.CreateDate)
	}
	if _, err := time.Parse("2006-01-02T15:04:05.000000", decoded.CreateDate); err != nil {
		t.Fatalf("create_date not in historical format: %q: %v", decoded.CreateDate, err)
	}
}
