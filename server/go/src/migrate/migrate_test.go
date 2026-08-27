package migrate

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/store"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// testDB opens a fresh, migrated SQLite database in a temp dir.
func testDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(db); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// binID builds a subtype-3 bson.Binary UUID, the shape the mgo-era models
// wrote into Mongo.
func binID(t *testing.T, s string) bson.Binary {
	t.Helper()
	u, err := uuid.Parse(s)
	if err != nil {
		t.Fatal(err)
	}
	return bson.Binary{Subtype: 3, Data: u[:]}
}

// rawDoc marshals a typed document into raw BSON, as the driver would hand it
// to the importers.
func rawDoc(t *testing.T, v interface{}) bson.Raw {
	t.Helper()
	b, err := bson.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func newImporter() *importer {
	return &importer{
		summary:       Summary{Skipped: map[string]int{}},
		placement:     map[string]answerPlacement{},
		roundPoints:   map[string]map[string]map[int]float64{},
		categories:    map[string]string{},
		categoryNotes: map[string]map[string]int{},
	}
}

func ptr(n int) *int { return &n }

func TestUUIDFromBinary(t *testing.T) {
	const id = "20000000-0000-0000-0000-000000000001"
	got, err := uuidFromBinary(binID(t, id))
	if err != nil {
		t.Fatal(err)
	}
	if got != id {
		t.Fatalf("uuidFromBinary = %q, want %q", got, id)
	}

	if _, err := uuidFromBinary(bson.Binary{Subtype: 4, Data: make([]byte, 16)}); err == nil {
		t.Error("expected error for subtype 4 (not a legacy UUID)")
	}
	if _, err := uuidFromBinary(bson.Binary{Subtype: 3, Data: []byte{1, 2, 3}}); err == nil {
		t.Error("expected error for 3-byte UUID data")
	}
}

func TestImportEditorData(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	const (
		noteID = "10000000-0000-0000-0000-000000000001"
		q1ID   = "20000000-0000-0000-0000-000000000001"
		q2ID   = "20000000-0000-0000-0000-000000000002"
		r1ID   = "30000000-0000-0000-0000-000000000001"
		g1ID   = "40000000-0000-0000-0000-000000000001"
		c1ID   = "50000000-0000-0000-0000-000000000001"
	)
	created := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)

	im := newImporter()

	note := mongoScoringNote{
		ID: binID(t, noteID), UserId: "user1", CreateDate: created,
		LastUsed: created.Add(time.Hour), Name: "note", Description: "desc",
	}
	if err := im.importScoringNote(ctx, tx, rawDoc(t, note)); err != nil {
		t.Fatal(err)
	}

	q1 := mongoQuestion{
		ID: binID(t, q1ID), CreateDate: created, Category: "History",
		Question: "Q1?", Answer: "A1", UserId: "user1", ScoringNote: noteID,
	}
	q2 := mongoQuestion{
		ID: binID(t, q2ID), CreateDate: created.Add(time.Minute), Category: "Science",
		Question: "Q2?", Answer: "A2", UserId: "user1",
	}
	for _, q := range []mongoQuestion{q1, q2} {
		if err := im.importQuestion(ctx, tx, rawDoc(t, q)); err != nil {
			t.Fatal(err)
		}
	}

	r1 := mongoRound{
		ID: binID(t, r1ID), CreateDate: created, Name: "Round 1",
		Questions: []string{q1ID, q2ID}, Wagers: []int{100, 200}, UserId: "user1",
	}
	if err := im.importRound(ctx, tx, rawDoc(t, r1)); err != nil {
		t.Fatal(err)
	}

	g1 := mongoGame{
		ID: binID(t, g1ID), CreateDate: created, Name: "Game 1",
		Rounds: []string{r1ID}, RoundNames: map[string]string{r1ID: "Round One"}, UserId: "user1",
	}
	if err := im.importGame(ctx, tx, rawDoc(t, g1)); err != nil {
		t.Fatal(err)
	}

	c1 := mongoCollection{
		ID: binID(t, c1ID), CreateDate: created, Name: "Coll", Questions: []string{q1ID}, UserId: "user1",
	}
	if err := im.importCollectionRow(ctx, tx, rawDoc(t, c1)); err != nil {
		t.Fatal(err)
	}

	// categories inherit their scoring note only after every question lands
	if err := im.importCategoryNotes(ctx, tx); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// question rows link to their category; create_date in the historical
	// wire format
	var qid string
	var catRef sql.NullString
	if err := db.QueryRow(`SELECT id, category_id FROM question WHERE id = ?`, q1ID).
		Scan(&qid, &catRef); err != nil {
		t.Fatal(err)
	}
	if qid != q1ID || !catRef.Valid {
		t.Fatalf("question %s = category %v", qid, catRef)
	}
	var createdStr string
	if err := db.QueryRow(`SELECT create_date FROM question WHERE id = ?`, q1ID).Scan(&createdStr); err != nil {
		t.Fatal(err)
	}
	if createdStr != "2024-01-02T03:04:05.000000" {
		t.Fatalf("create_date = %q, want the historical wire format", createdStr)
	}

	// categories: one row per distinct (user, category); History inherits the
	// scoring note shared by its questions, Science (no notes) stays NULL
	var historyID string
	if err := db.QueryRow(`SELECT id FROM category WHERE name = 'History' AND user_id = 'user1'`).Scan(&historyID); err != nil {
		t.Fatal(err)
	}
	if catRef.String != historyID {
		t.Fatalf("q1 category_id = %q, want %q", catRef.String, historyID)
	}
	var catNote sql.NullString
	if err := db.QueryRow(`SELECT scoring_note_id FROM category WHERE id = ?`, historyID).Scan(&catNote); err != nil {
		t.Fatal(err)
	}
	if !catNote.Valid || catNote.String != noteID {
		t.Fatalf("History scoring_note_id = %v, want %s", catNote, noteID)
	}
	var cat2 sql.NullString
	if err := db.QueryRow(`SELECT category_id FROM question WHERE id = ?`, q2ID).Scan(&cat2); err != nil {
		t.Fatal(err)
	}
	if !cat2.Valid {
		t.Fatalf("q2 category_id = %v, want the Science category", cat2)
	}
	var scienceNote sql.NullString
	if err := db.QueryRow(`SELECT scoring_note_id FROM category WHERE id = ?`, cat2.String).Scan(&scienceNote); err != nil {
		t.Fatal(err)
	}
	if scienceNote.Valid {
		t.Fatalf("Science scoring_note_id = %q, want NULL", scienceNote.String)
	}

	// round + joins
	assertRows(t, db, []interface{}{"Round 1"}, `SELECT name FROM round WHERE id = ?`, r1ID)
	assertRows(t, db, []interface{}{q1ID, q2ID}, `SELECT question_id FROM round_question WHERE round_id = ? ORDER BY position`, r1ID)
	assertRows(t, db, []interface{}{100, 200}, `SELECT wager FROM round_wager WHERE round_id = ? ORDER BY position`, r1ID)

	// game + joins
	assertRows(t, db, []interface{}{"Game 1"}, `SELECT name FROM game WHERE id = ?`, g1ID)
	assertRows(t, db, []interface{}{r1ID}, `SELECT round_id FROM game_round WHERE game_id = ? ORDER BY position`, g1ID)
	assertRows(t, db, []interface{}{"Round One"}, `SELECT name FROM game_round_name WHERE game_id = ? AND round_id = ?`, g1ID, r1ID)

	// collection + joins, scoring note
	assertRows(t, db, []interface{}{q1ID}, `SELECT question_id FROM collection_question WHERE collection_id = ? ORDER BY position`, c1ID)
	assertRows(t, db, []interface{}{"note"}, `SELECT name FROM scoring_note WHERE id = ?`, noteID)
	assertRows(t, db, []interface{}{"desc"}, `SELECT description FROM scoring_note WHERE id = ?`, noteID)

	// summary counts
	if im.summary.Questions != 2 || im.summary.Categories != 2 || im.summary.Rounds != 1 || im.summary.Games != 1 ||
		im.summary.Collections != 1 || im.summary.ScoringNotes != 1 {
		t.Fatalf("summary = %+v", im.summary)
	}
}

func TestImportSessionFlattening(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	const (
		p1ID  = "60000000-0000-0000-0000-000000000001"
		p2ID  = "60000000-0000-0000-0000-000000000002"
		modID = "60000000-0000-0000-0000-000000000003"
		sID   = "70000000-0000-0000-0000-000000000001"
		a1ID  = "80000000-0000-0000-0000-000000000001"
		a2ID  = "80000000-0000-0000-0000-000000000002"
		a3ID  = "80000000-0000-0000-0000-000000000003"
		a4ID  = "80000000-0000-0000-0000-000000000004"
		stID  = "90000000-0000-0000-0000-000000000001"
	)
	created := time.Date(2024, 2, 3, 4, 5, 6, 0, time.UTC)

	im := newImporter()

	// players, including the moderator (a player record, not a session member)
	for _, p := range []mongoPlayer{
		{ID: binID(t, p1ID), CreateDate: created, TeamName: "Team A", Icon: "a"},
		{ID: binID(t, p2ID), CreateDate: created, TeamName: "Team B", Icon: "b"},
		{ID: binID(t, modID), CreateDate: created, TeamName: "mod", RealName: "mod"},
	} {
		if err := im.importPlayer(ctx, tx, rawDoc(t, p)); err != nil {
			t.Fatal(err)
		}
	}

	session := mongoSession{
		ID: binID(t, sID), CreateDate: created, Name: "Session 1",
		GameId: "40000000-0000-0000-0000-000000000001", Moderator: modID, Started: true,
		CurrentRound: ptr(1), CurrentQuestion: ptr(0),
		Rounds: []mongoRoundInGame{
			{
				RoundId: "30000000-0000-0000-0000-000000000001", Wagers: []int{100, 200},
				Questions: []mongoQuestionInRound{
					{
						Category: "Cat0", Question: "Q0", Answer: "A0",
						QuestionId:  "20000000-0000-0000-0000-000000000001",
						ScoringNote: "note desc", ScoringNoteId: "10000000-0000-0000-0000-000000000001",
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a1ID}, p2ID: {a2ID}},
					},
					{
						Category: "Cat1", Question: "Q1", Answer: "A1",
						QuestionId:    "20000000-0000-0000-0000-000000000002",
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a3ID}, p2ID: {a4ID}},
					},
				},
			},
			{
				// never scored: no answers, no session_score rows
				RoundId: "30000000-0000-0000-0000-000000000002", Wagers: []int{},
				Questions: []mongoQuestionInRound{
					{Category: "Cat2"},
					{Category: "Cat3"},
				},
			},
		},
		// per-question points keyed by the overall question index; kept in the
		// document for realism, but the import derives totals from the answers
		Scoreboard: map[string][]float64{p1ID: {10, 0}, p2ID: {7, 0}},
		Players:    []string{p1ID, p2ID},
	}
	if err := im.importSession(ctx, tx, rawDoc(t, session)); err != nil {
		t.Fatal(err)
	}

	for _, a := range []mongoAnswer{
		{ID: binID(t, a1ID), CreateDate: created, PlayerId: p1ID, Answer: "A0", Wager: 10, Correct: true, PointsAwarded: 10},
		{ID: binID(t, a2ID), CreateDate: created, PlayerId: p2ID, Answer: "A0?", Wager: 7, Correct: true, PointsAwarded: 7},
		{ID: binID(t, a3ID), CreateDate: created, PlayerId: p1ID, Answer: "A1", Wager: 5, Correct: false, PointsAwarded: 0},
		{ID: binID(t, a4ID), CreateDate: created, PlayerId: p2ID, Answer: "A1?", Wager: 3, Correct: false, PointsAwarded: 0},
	} {
		if err := im.importAnswer(ctx, tx, rawDoc(t, a)); err != nil {
			t.Fatal(err)
		}
	}

	state := mongoSessionState{SessionId: sID, State: binID(t, stID)}
	if err := im.importSessionState(ctx, tx, rawDoc(t, state)); err != nil {
		t.Fatal(err)
	}

	if err := im.importSessionScores(ctx, tx); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// session row
	var sid, gameId, moderator string
	var started int
	var curRound, curQuestion *int
	if err := db.QueryRow(`SELECT id, game_id, moderator_id, started, current_round, current_question
		FROM session WHERE id = ?`, sID).Scan(&sid, &gameId, &moderator, &started, &curRound, &curQuestion); err != nil {
		t.Fatal(err)
	}
	if sid != sID || gameId != "40000000-0000-0000-0000-000000000001" || moderator != modID ||
		started != 1 || curRound == nil || *curRound != 1 || curQuestion == nil || *curQuestion != 0 {
		t.Fatalf("session row = %q %q %q %d %v %v", sid, gameId, moderator, started, curRound, curQuestion)
	}

	// session_player, join order preserved
	assertRows(t, db, []interface{}{p1ID, p2ID}, `SELECT player_id FROM session_player WHERE session_id = ? ORDER BY position`, sID)

	// session_question snapshots
	assertRows(t, db, []interface{}{"20000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000002"}, `SELECT question_id FROM session_question WHERE session_id = ? AND round_index = 0 ORDER BY question_index`, sID)
	var scored int
	var noteRef, noteDesc string
	err = db.QueryRow(`SELECT scored, scoring_note_id, scoring_note FROM session_question
		WHERE session_id = ? AND round_index = 0 AND question_index = 0`, sID).Scan(&scored, &noteRef, &noteDesc)
	if err != nil {
		t.Fatal(err)
	}
	if scored != 1 || noteRef != "10000000-0000-0000-0000-000000000001" || noteDesc != "note desc" {
		t.Fatalf("session_question(0,0) = scored %d note %q desc %q", scored, noteRef, noteDesc)
	}
	var cat string
	err = db.QueryRow(`SELECT category FROM session_question
		WHERE session_id = ? AND round_index = 1 AND question_index = 1`, sID).Scan(&cat)
	if err != nil {
		t.Fatal(err)
	}
	if cat != "Cat3" {
		t.Fatalf("session_question(1,1) category = %q", cat)
	}
	var qCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM session_question WHERE session_id = ?`, sID).Scan(&qCount); err != nil {
		t.Fatal(err)
	}
	if qCount != 4 {
		t.Fatalf("session_question count = %d, want 4", qCount)
	}

	// session_score: per-round totals derived from the scored answers; round 1
	// was never scored, so it has no rows
	type scoreRow struct {
		player string
		round  int
		points float64
	}
	var scores []scoreRow
	rows, err := db.Query(`SELECT player_id, round_index, points FROM session_score WHERE session_id = ? ORDER BY player_id, round_index`, sID)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var sr scoreRow
		if err := rows.Scan(&sr.player, &sr.round, &sr.points); err != nil {
			t.Fatal(err)
		}
		scores = append(scores, sr)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	want := []scoreRow{
		{p1ID, 0, 10},
		{p2ID, 0, 7},
	}
	if len(scores) != len(want) {
		t.Fatalf("session_score rows = %d, want %d: %+v", len(scores), len(want), scores)
	}
	for i := range want {
		if scores[i] != want[i] {
			t.Fatalf("session_score[%d] = %+v, want %+v", i, scores[i], want[i])
		}
	}

	// answers placed from the session document's PlayerAnswers map
	assertRows(t, db, []interface{}{sID}, `SELECT session_id FROM answer WHERE id = ?`, a1ID)
	assertRows(t, db, []interface{}{0}, `SELECT round_index FROM answer WHERE id = ?`, a1ID)
	assertRows(t, db, []interface{}{0}, `SELECT question_index FROM answer WHERE id = ?`, a1ID)
	assertRows(t, db, []interface{}{p1ID}, `SELECT player_id FROM answer WHERE id = ?`, a1ID)
	assertRows(t, db, []interface{}{p1ID}, `SELECT player_id FROM answer WHERE id = ?`, a3ID)
	var wager int
	var correct int
	var points float64
	if err := db.QueryRow(`SELECT wager, correct, points_awarded FROM answer WHERE id = ?`, a1ID).
		Scan(&wager, &correct, &points); err != nil {
		t.Fatal(err)
	}
	if wager != 10 || correct != 1 || points != 10 {
		t.Fatalf("answer a1 = wager %d correct %d points %v", wager, correct, points)
	}

	// session_state
	assertRows(t, db, []interface{}{stID}, `SELECT state FROM session_state WHERE session_id = ?`, sID)

	// summary counts
	if im.summary.Sessions != 1 || im.summary.SessionPlayers != 2 ||
		im.summary.SessionQuestions != 4 || im.summary.SessionScores != 2 ||
		im.summary.Answers != 4 || im.summary.SessionStates != 1 || im.summary.Players != 3 {
		t.Fatalf("summary = %+v", im.summary)
	}
}

func TestImportDanglingReferences(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	im := newImporter()

	// a question whose scoring_note points at a missing note: the reference
	// must be imported as NULL, not fail the import (migration 6 behavior)
	q := mongoQuestion{
		ID:         binID(t, "20000000-0000-0000-0000-000000000001"),
		CreateDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Question:   "Q?", Answer: "A", ScoringNote: "10000000-0000-0000-0000-00000000DEAD",
	}
	if err := im.importQuestion(ctx, tx, rawDoc(t, q)); err != nil {
		t.Fatal(err)
	}

	// a round referencing a question that does not exist: the join row is
	// skipped, the round still imports
	r := mongoRound{
		ID:         binID(t, "30000000-0000-0000-0000-000000000001"),
		CreateDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Questions:  []string{"20000000-0000-0000-0000-00000000DEAD"},
	}
	if err := im.importRound(ctx, tx, rawDoc(t, r)); err != nil {
		t.Fatal(err)
	}

	// a session whose players list references a missing player
	s := mongoSession{
		ID:         binID(t, "70000000-0000-0000-0000-000000000001"),
		CreateDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Started:    true,
		Players:    []string{"60000000-0000-0000-0000-00000000DEAD"},
	}
	if err := im.importSession(ctx, tx, rawDoc(t, s)); err != nil {
		t.Fatal(err)
	}

	// an answer not referenced by any session document (its session was
	// deleted): counted, not imported
	orphan := mongoAnswer{
		ID:         binID(t, "80000000-0000-0000-0000-000000000001"),
		CreateDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		PlayerId:   "60000000-0000-0000-0000-000000000001",
		Answer:     "orphaned",
	}
	if err := im.importAnswer(ctx, tx, rawDoc(t, orphan)); err != nil {
		t.Fatal(err)
	}

	// a session_state whose session is missing
	st := mongoSessionState{
		SessionId: "70000000-0000-0000-0000-00000000DEAD",
		State:     binID(t, "90000000-0000-0000-0000-000000000001"),
	}
	if err := im.importSessionState(ctx, tx, rawDoc(t, st)); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// the question imported with no category (its scoring note — dangling or
	// not — is dropped: the note lives on the category now) and reported
	var cat sql.NullString
	if err := db.QueryRow(`SELECT category_id FROM question WHERE id = ?`, "20000000-0000-0000-0000-000000000001").
		Scan(&cat); err != nil {
		t.Fatal(err)
	}
	if cat.Valid {
		t.Fatalf("question category_id = %q, want NULL", cat.String)
	}

	// the round imported with no join rows
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM round_question`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("round_question rows = %d, want 0", n)
	}

	// the session imported with no session_player rows
	if err := db.QueryRow(`SELECT COUNT(*) FROM session_player`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("session_player rows = %d, want 0", n)
	}

	// orphan answer and orphan session_state not imported
	if err := db.QueryRow(`SELECT COUNT(*) FROM answer`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("answer rows = %d, want 0", n)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM session_state`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("session_state rows = %d, want 0", n)
	}

	if im.summary.OrphanAnswers != 1 || im.summary.DroppedNoteRefs != 1 {
		t.Fatalf("summary = %+v", im.summary)
	}
	if im.summary.Skipped["round_question"] != 1 ||
		im.summary.Skipped["session_player"] != 1 ||
		im.summary.Skipped["session_state"] != 1 {
		t.Fatalf("skipped = %+v", im.summary.Skipped)
	}
}

// TestImportDropsNoteOnCategoryLessQuestion covers ticket #187: a legacy
// question that has a scoring note but no category cannot keep it — the note
// is resolved through the category now — so the reference is dropped and
// reported in the summary instead of vanishing silently.
func TestImportDropsNoteOnCategoryLessQuestion(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	const (
		noteID = "10000000-0000-0000-0000-000000000001"
		q1ID   = "20000000-0000-0000-0000-000000000001"
		q2ID   = "20000000-0000-0000-0000-000000000002"
	)
	created := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)

	im := newImporter()

	// the scoring note itself exists — the drop is about the missing category,
	// not a dangling reference
	if err := im.importScoringNote(ctx, tx, rawDoc(t, mongoScoringNote{
		ID: binID(t, noteID), UserId: "user1", CreateDate: created,
		LastUsed: created.Add(time.Hour), Name: "note", Description: "desc",
	})); err != nil {
		t.Fatal(err)
	}

	// category-less question with a scoring note
	if err := im.importQuestion(ctx, tx, rawDoc(t, mongoQuestion{
		ID: binID(t, q1ID), CreateDate: created, Question: "Q1?", Answer: "A1",
		UserId: "user1", ScoringNote: noteID,
	})); err != nil {
		t.Fatal(err)
	}
	// category-less question without a scoring note: nothing to drop
	if err := im.importQuestion(ctx, tx, rawDoc(t, mongoQuestion{
		ID: binID(t, q2ID), CreateDate: created, Question: "Q2?", Answer: "A2",
		UserId: "user1",
	})); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// both questions imported, neither attached to a category
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM question`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("question rows = %d, want 2", n)
	}
	var cat sql.NullString
	if err := db.QueryRow(`SELECT category_id FROM question WHERE id = ?`, q1ID).Scan(&cat); err != nil {
		t.Fatal(err)
	}
	if cat.Valid {
		t.Fatalf("q1 category_id = %q, want NULL", cat.String)
	}

	// the dropped reference is counted once and shown in the summary output
	if im.summary.DroppedNoteRefs != 1 {
		t.Fatalf("DroppedNoteRefs = %d, want 1", im.summary.DroppedNoteRefs)
	}
	if got := im.summary.String(); !strings.Contains(got, "dropped 1 question->scoring_note reference(s) on questions without a category") {
		t.Fatalf("summary output missing the dropped-note line:\n%s", got)
	}
}

func TestImportRollsBackOnError(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	im := newImporter()
	// a document that decodes but has no valid UUID _id must abort the import
	bad := rawDoc(t, map[string]interface{}{"question": "no id"})

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	// a valid question imported first, so a rollback leaves it gone
	good := mongoQuestion{
		ID:         binID(t, "20000000-0000-0000-0000-000000000001"),
		CreateDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	if err := im.importQuestion(ctx, tx, rawDoc(t, good)); err != nil {
		t.Fatal(err)
	}
	if err := im.importQuestion(ctx, tx, bad); err == nil {
		tx.Rollback()
		t.Fatal("expected the malformed document to fail the import")
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}

	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM question`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("question rows after failed import = %d, want 0 (rolled back)", n)
	}
}

func TestCheckEmpty(t *testing.T) {
	db := testDB(t)

	if err := CheckEmpty(db); err != nil {
		t.Fatalf("fresh database should be empty: %v", err)
	}

	if _, err := db.Exec(`INSERT INTO player (id, create_date) VALUES ('x', '2024-01-01T00:00:00.000000')`); err != nil {
		t.Fatal(err)
	}
	if err := CheckEmpty(db); err == nil {
		t.Fatal("expected CheckEmpty to reject a database with rows")
	}
}

// assertRows runs a single-column query and compares the results, in order,
// with want. Values are compared by their %v rendering so SQLite's
// int64/float64 scan types match the plain Go literals in the test.
func assertRows(t *testing.T, db *sql.DB, want []interface{}, query string, args ...interface{}) {
	t.Helper()
	rows, err := db.Query(query, args...)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	got := make([]string, 0)
	for rows.Next() {
		var v interface{}
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		got = append(got, fmt.Sprintf("%v", v))
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	if len(got) != len(want) {
		t.Fatalf("%q: got %v, want %v", query, got, want)
	}
	for i := range want {
		if got[i] != fmt.Sprintf("%v", want[i]) {
			t.Fatalf("%q: got %v, want %v", query, got, want)
		}
	}
}

// TestImportedSessionReadsBack drives a full import of editor data, a session,
// answers, and session_state, then loads the session through the server's own
// read path (common.GetOne) and checks that a historical session opens with
// its rounds, scoreboard, and answers intact — acceptance criterion 2, at the
// data layer. It uses the same raw-BSON documents the importers consume, so
// no live MongoDB is needed.
func TestImportedSessionReadsBack(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()

	const (
		noteID = "10000000-0000-0000-0000-000000000001"
		q1ID   = "20000000-0000-0000-0000-000000000001"
		q2ID   = "20000000-0000-0000-0000-000000000002"
		q3ID   = "20000000-0000-0000-0000-000000000003"
		q4ID   = "20000000-0000-0000-0000-000000000004"
		r1ID   = "30000000-0000-0000-0000-000000000001"
		r2ID   = "30000000-0000-0000-0000-000000000002"
		g1ID   = "40000000-0000-0000-0000-000000000001"
		p1ID   = "60000000-0000-0000-0000-000000000001"
		p2ID   = "60000000-0000-0000-0000-000000000002"
		modID  = "60000000-0000-0000-0000-000000000003"
		sID    = "70000000-0000-0000-0000-000000000001"
		a1ID   = "80000000-0000-0000-0000-000000000001"
		a2ID   = "80000000-0000-0000-0000-000000000002"
		a3ID   = "80000000-0000-0000-0000-000000000003"
		a4ID   = "80000000-0000-0000-0000-000000000004"
	)
	created := time.Date(2024, 2, 3, 4, 5, 6, 0, time.UTC)

	im := newImporter()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	importAll := func(fn func(ctx context.Context, q execer, raw bson.Raw) error, docs ...interface{}) {
		t.Helper()
		for _, d := range docs {
			if err := fn(ctx, tx, rawDoc(t, d)); err != nil {
				t.Fatal(err)
			}
		}
	}

	importAll(im.importScoringNote, mongoScoringNote{
		ID: binID(t, noteID), CreateDate: created, Name: "note", Description: "desc",
	})
	importAll(im.importQuestion,
		mongoQuestion{ID: binID(t, q1ID), CreateDate: created, Category: "Cat0", Question: "Q0?", Answer: "A0", ScoringNote: noteID},
		mongoQuestion{ID: binID(t, q2ID), CreateDate: created, Category: "Cat1", Question: "Q1?", Answer: "A1"},
		mongoQuestion{ID: binID(t, q3ID), CreateDate: created, Category: "Cat2", Question: "Q2?", Answer: "A2"},
		mongoQuestion{ID: binID(t, q4ID), CreateDate: created, Category: "Cat3", Question: "Q3?", Answer: "A3"},
	)
	importAll(im.importRound,
		mongoRound{ID: binID(t, r1ID), CreateDate: created, Name: "R1", Questions: []string{q1ID, q2ID}, Wagers: []int{100, 200}},
		mongoRound{ID: binID(t, r2ID), CreateDate: created, Name: "R2", Questions: []string{q3ID, q4ID}, Wagers: []int{}},
	)
	importAll(im.importGame, mongoGame{
		ID: binID(t, g1ID), CreateDate: created, Name: "G1",
		Rounds: []string{r1ID, r2ID}, RoundNames: map[string]string{r1ID: "Round One", r2ID: "Round Two"},
	})
	importAll(im.importPlayer,
		mongoPlayer{ID: binID(t, p1ID), CreateDate: created, TeamName: "Team A", Icon: "a"},
		mongoPlayer{ID: binID(t, p2ID), CreateDate: created, TeamName: "Team B", Icon: "b"},
		mongoPlayer{ID: binID(t, modID), CreateDate: created, TeamName: "mod"},
	)
	importAll(im.importSession, mongoSession{
		ID: binID(t, sID), CreateDate: created, Name: "Session 1",
		GameId: g1ID, Moderator: modID, Started: true,
		CurrentRound: ptr(1), CurrentQuestion: ptr(0),
		Rounds: []mongoRoundInGame{
			{
				RoundId: r1ID, Wagers: []int{100, 200},
				Questions: []mongoQuestionInRound{
					{
						Category: "Cat0", Question: "Q0?", Answer: "A0",
						QuestionId: q1ID, ScoringNote: "desc", ScoringNoteId: noteID,
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a1ID}, p2ID: {a2ID}},
					},
					{
						Category: "Cat1", Question: "Q1?", Answer: "A1", QuestionId: q2ID,
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a3ID}, p2ID: {a4ID}},
					},
				},
			},
			{
				// never scored: no answers, no scoreboard rows
				RoundId: r2ID, Wagers: []int{},
				Questions: []mongoQuestionInRound{
					{Category: "Cat2", Question: "Q2?", Answer: "A2", QuestionId: q3ID},
					{Category: "Cat3", Question: "Q3?", Answer: "A3", QuestionId: q4ID},
				},
			},
		},
		Scoreboard: map[string][]float64{p1ID: {10, 0}, p2ID: {7, 0}},
		Players:    []string{p1ID, p2ID},
	})
	importAll(im.importAnswer,
		mongoAnswer{ID: binID(t, a1ID), CreateDate: created, PlayerId: p1ID, Answer: "A0", Wager: 10, Correct: true, PointsAwarded: 10},
		mongoAnswer{ID: binID(t, a2ID), CreateDate: created, PlayerId: p2ID, Answer: "A0?", Wager: 7, Correct: true, PointsAwarded: 7},
		mongoAnswer{ID: binID(t, a3ID), CreateDate: created, PlayerId: p1ID, Answer: "A1", Wager: 5, Correct: false, PointsAwarded: 0},
		mongoAnswer{ID: binID(t, a4ID), CreateDate: created, PlayerId: p2ID, Answer: "A1?", Wager: 3, Correct: false, PointsAwarded: 0},
	)
	importAll(im.importSessionState, mongoSessionState{
		SessionId: sID, State: binID(t, "90000000-0000-0000-0000-000000000001"),
	})

	if err := im.importSessionScores(ctx, tx); err != nil {
		t.Fatal(err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	// open the historical session through the server's read path
	env := &common.Env{Db: db}
	var session models.Session
	if err := common.GetOne(env, common.SessionTable, sID, &session); err != nil {
		t.Fatalf("open session: %v", err)
	}
	if session.Name != "Session 1" || session.GameId != g1ID || session.Moderator != models.PlayerId(modID) ||
		!session.Started || session.CurrentRound == nil || *session.CurrentRound != 1 ||
		session.CurrentQuestion == nil || *session.CurrentQuestion != 0 {
		t.Fatalf("session header = %+v", session)
	}

	// rounds derived from the game, overlaid with the snapshots
	if len(session.Rounds) != 2 {
		t.Fatalf("rounds = %d, want 2", len(session.Rounds))
	}
	first := session.Rounds[0].Questions[0]
	if first.Category != "Cat0" || first.Question != "Q0?" || first.Answer != "A0" ||
		first.QuestionId != q1ID || first.ScoringNoteId != noteID || first.ScoringNote != "desc" || !first.Scored {
		t.Fatalf("round 0 question 0 = %+v", first)
	}
	if last := session.Rounds[1].Questions[1]; last.Category != "Cat3" || last.Question != "Q3?" || last.Answer != "A3" {
		t.Fatalf("round 1 question 1 = %+v", last)
	}

	// players in join order
	if len(session.Players) != 2 || session.Players[0] != models.PlayerId(p1ID) || session.Players[1] != models.PlayerId(p2ID) {
		t.Fatalf("players = %v", session.Players)
	}

	// scoreboard as per-round totals, the shape the SQLite-era server serves;
	// only round 0 was scored, so each player has a single entry
	if got := session.Scoreboard[models.PlayerId(p1ID)]; len(got) != 1 || got[0] != 10 {
		t.Fatalf("p1 scoreboard = %v", got)
	}
	if got := session.Scoreboard[models.PlayerId(p2ID)]; len(got) != 1 || got[0] != 7 {
		t.Fatalf("p2 scoreboard = %v", got)
	}

	// answers open with their placement
	var answer models.Answer
	if err := common.GetOne(env, common.AnswerTable, a1ID, &answer); err != nil {
		t.Fatalf("open answer: %v", err)
	}
	if answer.SessionId != sID || answer.RoundIndex == nil || *answer.RoundIndex != 0 ||
		answer.QuestionIndex == nil || *answer.QuestionIndex != 0 ||
		answer.PlayerId != models.PlayerId(p1ID) || answer.Answer != "A0" ||
		answer.Wager != 10 || !answer.Correct || answer.PointsAwarded != 10 {
		t.Fatalf("answer = %+v", answer)
	}
}

// TestScoreboardSkipsUnscoredQuestion locks in the score attribution rule.
// The mgo-era scoreboard document appended one entry per *scored* question,
// so a question the moderator skipped leaves no slot: the array [10, 5] here
// looks dense but question 1 (round 0) was never scored and 5 belongs to
// round 1. Per-round totals must come from the answers, not from array
// position: round 0 = 10, round 1 = 5.
func TestScoreboardSkipsUnscoredQuestion(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after Commit

	const (
		p1ID = "60000000-0000-0000-0000-000000000001"
		sID  = "70000000-0000-0000-0000-000000000001"
		a1ID = "80000000-0000-0000-0000-000000000001"
		a2ID = "80000000-0000-0000-0000-000000000002"
	)
	created := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)

	im := newImporter()
	if err := im.importPlayer(ctx, tx, rawDoc(t, mongoPlayer{ID: binID(t, p1ID), CreateDate: created, TeamName: "Team A"})); err != nil {
		t.Fatal(err)
	}

	session := mongoSession{
		ID: binID(t, sID), CreateDate: created, Started: true,
		Rounds: []mongoRoundInGame{
			{
				RoundId: "30000000-0000-0000-0000-000000000001",
				Questions: []mongoQuestionInRound{
					{
						Category: "A", QuestionId: "20000000-0000-0000-0000-000000000001",
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a1ID}},
					},
					// skipped by the moderator: never scored
					{Category: "B", QuestionId: "20000000-0000-0000-0000-000000000002", Scored: false},
				},
			},
			{
				RoundId: "30000000-0000-0000-0000-000000000002",
				Questions: []mongoQuestionInRound{
					{
						Category: "C", QuestionId: "20000000-0000-0000-0000-000000000003",
						Scored:        true,
						PlayerAnswers: map[string][]string{p1ID: {a2ID}},
					},
				},
			},
		},
		// dense-looking, but q1 has no slot: 5 is round 1's points
		Scoreboard: map[string][]float64{p1ID: {10, 5}},
		Players:    []string{p1ID},
	}
	if err := im.importSession(ctx, tx, rawDoc(t, session)); err != nil {
		t.Fatal(err)
	}

	if err := im.importAnswer(ctx, tx, rawDoc(t, mongoAnswer{
		ID: binID(t, a1ID), CreateDate: created, PlayerId: p1ID,
		Answer: "x", Wager: 10, Correct: true, PointsAwarded: 10,
	})); err != nil {
		t.Fatal(err)
	}
	if err := im.importAnswer(ctx, tx, rawDoc(t, mongoAnswer{
		ID: binID(t, a2ID), CreateDate: created, PlayerId: p1ID,
		Answer: "y", Wager: 5, Correct: true, PointsAwarded: 5,
	})); err != nil {
		t.Fatal(err)
	}

	if err := im.importSessionScores(ctx, tx); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	assertRows(t, db, []interface{}{10}, `SELECT points FROM session_score WHERE session_id = ? AND round_index = 0`, sID)
	assertRows(t, db, []interface{}{5}, `SELECT points FROM session_score WHERE session_id = ? AND round_index = 1`, sID)

	if im.summary.SessionScores != 2 {
		t.Fatalf("SessionScores = %d, want 2", im.summary.SessionScores)
	}
}
