package questions

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/store"
)

// These tests exercise the question-type validation matrix (ticket #99): the
// per-type payload rules enforced before a question row and its normalized
// child rows are written, the derived answer, and type-change behavior.

func openQuestionsTestDB(t *testing.T) *Env {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return &Env{Db: db}
}

// countChildren returns the number of normalized child rows (question_choice or
// question_match) for a question.
func countChildren(t *testing.T, db *sql.DB, table, questionId string) int {
	t.Helper()
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM `+table+` WHERE question_id = ?`, questionId).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

// TestCreateQuestionValidationMatrix covers every row of the ticket #99 matrix:
//
//	freeform         answer required; choices/pairs empty
//	multiple_choice  derived answer; 2+ options; exactly one correct; no
//	                 duplicate option text; pairs empty
//	matching         derived answer; 1+ pairs; left texts unique; right texts
//	                 unique; choices empty
func TestCreateQuestionValidationMatrix(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	// freeform: answer required
	if _, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", QuestionType: "freeform"}); err == nil {
		t.Error("expected MissingAnswerError for freeform without answer")
	} else if _, ok := err.(MissingAnswerError); !ok {
		t.Errorf("expected MissingAnswerError, got %T: %v", err, err)
	}
	// freeform: choices rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", Answer: "a", QuestionType: "freeform",
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}},
	}); err == nil {
		t.Error("expected FreeformChildRowsError for freeform with choices")
	} else if _, ok := err.(FreeformChildRowsError); !ok {
		t.Errorf("expected FreeformChildRowsError, got %T: %v", err, err)
	}
	// freeform: pairs rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", Answer: "a", QuestionType: "freeform",
		Pairs: []models.QuestionPair{{Left: "L", Right: "R"}},
	}); err == nil {
		t.Error("expected FreeformChildRowsError for freeform with pairs")
	}
	// freeform: valid
	if _, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", Answer: "a", QuestionType: "freeform"}); err != nil {
		t.Fatalf("freeform create: %v", err)
	}

	// multiple_choice: fewer than two options rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}},
	}); err == nil {
		t.Error("expected TooFewChoicesError for a single choice")
	} else if _, ok := err.(TooFewChoicesError); !ok {
		t.Errorf("expected TooFewChoicesError, got %T: %v", err, err)
	}
	// multiple_choice: no correct option rejected (app enforces >=1)
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{{Text: "A"}, {Text: "B"}},
	}); err == nil {
		t.Error("expected MissingCorrectChoiceError")
	} else if _, ok := err.(MissingCorrectChoiceError); !ok {
		t.Errorf("expected MissingCorrectChoiceError, got %T: %v", err, err)
	}
	// multiple_choice: duplicate option text rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}, {Text: "A"}},
	}); err == nil {
		t.Error("expected DuplicateChoiceTextError")
	} else if _, ok := err.(DuplicateChoiceTextError); !ok {
		t.Errorf("expected DuplicateChoiceTextError, got %T: %v", err, err)
	}
	// multiple_choice: pairs rejected (mutually exclusive payloads)
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}, {Text: "B"}},
		Pairs:   []models.QuestionPair{{Left: "L", Right: "R"}},
	}); err == nil {
		t.Error("expected MultipleChoiceWithPairsError")
	} else if _, ok := err.(MultipleChoiceWithPairsError); !ok {
		t.Errorf("expected MultipleChoiceWithPairsError, got %T: %v", err, err)
	}
	// multiple_choice: valid
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}, {Text: "B"}},
	}); err != nil {
		t.Fatalf("multiple_choice create: %v", err)
	}

	// matching: no pairs rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", QuestionType: "matching"}); err == nil {
		t.Error("expected MissingPairsError for matching without pairs")
	} else if _, ok := err.(MissingPairsError); !ok {
		t.Errorf("expected MissingPairsError, got %T: %v", err, err)
	}
	// matching: duplicate left text rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "matching",
		Pairs: []models.QuestionPair{{Left: "L", Right: "A"}, {Left: "L", Right: "B"}},
	}); err == nil {
		t.Error("expected DuplicatePairTextError for duplicate left")
	} else if _, ok := err.(DuplicatePairTextError); !ok {
		t.Errorf("expected DuplicatePairTextError, got %T: %v", err, err)
	}
	// matching: duplicate right text rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "matching",
		Pairs: []models.QuestionPair{{Left: "L1", Right: "A"}, {Left: "L2", Right: "A"}},
	}); err == nil {
		t.Error("expected DuplicatePairTextError for duplicate right")
	}
	// matching: choices rejected (mutually exclusive payloads)
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "matching",
		Pairs:   []models.QuestionPair{{Left: "L", Right: "R"}},
		Choices: []models.QuestionChoice{{Text: "A", IsCorrect: true}},
	}); err == nil {
		t.Error("expected MatchingWithChoicesError")
	} else if _, ok := err.(MatchingWithChoicesError); !ok {
		t.Errorf("expected MatchingWithChoicesError, got %T: %v", err, err)
	}
	// matching: valid
	if _, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "matching",
		Pairs: []models.QuestionPair{{Left: "L", Right: "R"}},
	}); err != nil {
		t.Fatalf("matching create: %v", err)
	}

	// invalid question_type rejected
	if _, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", Answer: "a", QuestionType: "bogus"}); err == nil {
		t.Error("expected InvalidQuestionTypeError")
	} else if _, ok := err.(InvalidQuestionTypeError); !ok {
		t.Errorf("expected InvalidQuestionTypeError, got %T: %v", err, err)
	}

	// empty question_type on input defaults to freeform (old clients keep working)
	q, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	if q.QuestionType != "freeform" {
		t.Errorf("empty question_type defaulted to %q, want freeform", q.QuestionType)
	}
}

// TestCreateQuestionDerivedAnswer verifies the stored answer is derived from the
// structured child rows — MC = the correct option's text; matching = rendered
// "left -> right" pairs.
func TestCreateQuestionDerivedAnswer(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	mc, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "multiple_choice",
		Choices: []models.QuestionChoice{
			{Text: "A"}, {Text: "Paris", IsCorrect: true}, {Text: "C"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := GetOneQuestion(env, userId, mc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Answer != "Paris" {
		t.Errorf("MC derived answer = %q, want 'Paris'", got.Answer)
	}
	if len(got.Choices) != 3 || !got.Choices[1].IsCorrect {
		t.Errorf("MC choices not loaded: %+v", got.Choices)
	}
	if len(got.Pairs) != 0 {
		t.Errorf("MC should have no pairs, got %+v", got.Pairs)
	}

	mt, err := CreateOneQuestion(env, userId, models.Question{
		Question: "q?", QuestionType: "matching",
		Pairs: []models.QuestionPair{{Left: "1", Right: "A"}, {Left: "2", Right: "B"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err = GetOneQuestion(env, userId, mt.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := "1 -> A\n2 -> B"
	if got.Answer != want {
		t.Errorf("matching derived answer = %q, want %q", got.Answer, want)
	}
	if len(got.Pairs) != 2 {
		t.Errorf("matching pairs not loaded: %+v", got.Pairs)
	}
	if len(got.Choices) != 0 {
		t.Errorf("matching should have no choices, got %+v", got.Choices)
	}
}

// TestUpdateQuestionTypeChangeReplacesChildren verifies changing a question's
// type replaces the child rows wholesale and clears the other table.
func TestUpdateQuestionTypeChangeReplacesChildren(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	q, err := CreateOneQuestion(env, userId, models.Question{Question: "q?", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}

	// freeform -> multiple_choice
	if _, err := UpdateOneQuestion(env, userId, q.ID, models.Question{
		QuestionType: "multiple_choice",
		Choices:      []models.QuestionChoice{{Text: "A", IsCorrect: true}, {Text: "B"}},
	}); err != nil {
		t.Fatal(err)
	}
	if n := countChildren(t, env.Db, "question_choice", q.ID); n != 2 {
		t.Errorf("after MC update, choices = %d, want 2", n)
	}
	if n := countChildren(t, env.Db, "question_match", q.ID); n != 0 {
		t.Errorf("after MC update, matches = %d, want 0", n)
	}
	got, _ := GetOneQuestion(env, userId, q.ID)
	if got.QuestionType != "multiple_choice" || got.Answer != "A" {
		t.Errorf("MC update readback: type=%s answer=%q", got.QuestionType, got.Answer)
	}

	// multiple_choice -> matching: pairs written, choices cleared
	if _, err := UpdateOneQuestion(env, userId, q.ID, models.Question{
		QuestionType: "matching",
		Pairs:        []models.QuestionPair{{Left: "1", Right: "A"}, {Left: "2", Right: "B"}},
	}); err != nil {
		t.Fatal(err)
	}
	if n := countChildren(t, env.Db, "question_match", q.ID); n != 2 {
		t.Errorf("after matching update, matches = %d, want 2", n)
	}
	if n := countChildren(t, env.Db, "question_choice", q.ID); n != 0 {
		t.Errorf("after matching update, choices = %d, want 0", n)
	}
	got, _ = GetOneQuestion(env, userId, q.ID)
	if got.QuestionType != "matching" || got.Answer != "1 -> A\n2 -> B" {
		t.Errorf("matching update readback: type=%s answer=%q", got.QuestionType, got.Answer)
	}

	// matching -> freeform: both cleared, answer set
	if _, err := UpdateOneQuestion(env, userId, q.ID, models.Question{
		QuestionType: "freeform", Question: "q2", Answer: "new answer",
	}); err != nil {
		t.Fatal(err)
	}
	if n := countChildren(t, env.Db, "question_choice", q.ID); n != 0 {
		t.Errorf("after freeform update, choices = %d, want 0", n)
	}
	if n := countChildren(t, env.Db, "question_match", q.ID); n != 0 {
		t.Errorf("after freeform update, matches = %d, want 0", n)
	}
	got, _ = GetOneQuestion(env, userId, q.ID)
	if got.QuestionType != "freeform" || got.Answer != "new answer" {
		t.Errorf("freeform update readback: type=%s answer=%q", got.QuestionType, got.Answer)
	}
}

// TestOldQuestionReadsBackAsFreeform verifies a pre-question-type question row
// (no question_type column value) reads back as freeform with no children.
func TestOldQuestionReadsBackAsFreeform(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	if _, err := env.Db.Exec(
		`INSERT INTO question (id, create_date, category, question, answer, user_id)
		 VALUES ('old-1', '2026-01-01T00:00:00.000000', 'cat', 'old?', 'a', ?)`, userId); err != nil {
		t.Fatal(err)
	}

	got, err := GetOneQuestion(env, userId, "old-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.QuestionType != "freeform" {
		t.Errorf("old question type = %q, want freeform", got.QuestionType)
	}
	if len(got.Choices) != 0 || len(got.Pairs) != 0 {
		t.Errorf("old question should have no children: %+v %+v", got.Choices, got.Pairs)
	}
}
