package store

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

// openTestDB opens a fresh SQLite database in a temp dir and migrates it to
// the latest schema.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return db
}

func mustExec(t *testing.T, db *sql.DB, stmt string, args ...any) {
	t.Helper()
	if _, err := db.Exec(stmt, args...); err != nil {
		t.Fatalf("exec %q: %v", stmt, err)
	}
}

func TestMigrateCreatesBaselineSchema(t *testing.T) {
	db := openTestDB(t)

	v, err := Version(db)
	if err != nil {
		t.Fatalf("Version: %v", err)
	}
	if v != 13 {
		t.Fatalf("user_version = %d, want 13", v)
	}

	tables := []string{
		"question", "round", "round_question", "round_wager",
		"game", "game_round", "game_round_name",
		"collection", "collection_question",
		"scoring_note", "player", "session", "session_player",
		"session_question", "answer", "answer_reaction", "session_score", "session_state",
		"user",
		"question_choice", "question_match",
		"session_question_choice", "session_question_match",
		// migration 12 (ticket #164): bucketing child tables
		"question_bucket", "question_bucket_item",
		"session_question_bucket", "session_question_bucket_item",
		// migration 13 (ticket #178): category root model
		"category",
	}
	for _, name := range tables {
		var n int
		if err := db.QueryRow(
			"SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?", name,
		).Scan(&n); err != nil {
			t.Fatalf("query sqlite_master for %s: %v", name, err)
		}
		if n != 1 {
			t.Errorf("table %q not created by baseline migration", name)
		}
	}

	// migration 9 (ticket #5) adds the session_player.active membership flag
	rows, err := db.Query("PRAGMA table_info(session_player)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	found := false
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		if name == "active" {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
	if !found {
		t.Error("session_player.active column missing after migration")
	}

	// migration 10 (ticket #3) adds the answer.use_moneyball opt-in flag
	rows, err = db.Query("PRAGMA table_info(answer)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	found = false
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		if name == "use_moneyball" {
			found = true
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
	if !found {
		t.Error("answer.use_moneyball column missing after migration")
	}
}

func TestMigrateDropsQuestionRoundsUsed(t *testing.T) {
	db := openTestDB(t)

	// Migration 4 (ticket #83) drops the rounds_used JSON mirror; membership
	// now lives only in round_question.
	rows, err := db.Query("PRAGMA table_info(question)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		if name == "rounds_used" {
			t.Error("question.rounds_used column still present after migration")
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
}

func TestMigrateDropsPlayerSessionId(t *testing.T) {
	db := openTestDB(t)

	// Migration 5 (ticket #84) drops the player.session_id mirror;
	// membership now lives only in session_player.
	rows, err := db.Query("PRAGMA table_info(player)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		if name == "session_id" {
			t.Error("player.session_id column still present after migration")
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
}

func TestMigrateScoringNoteForeignKey(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	// Migration 6 (ticket #85) turns question.scoring_note into the enforced
	// scoring_note_id FK. Migrate to version 5 first and seed both a valid
	// reference and a dangling one (possible only because the old column had
	// no REFERENCES clause).
	var m6 migration
	for _, m := range migrations {
		if m.version == 6 {
			m6 = m
			break
		}
		if err := apply(db, m); err != nil {
			t.Fatalf("apply migration %d: %v", m.version, err)
		}
	}

	mustExec(t, db, "INSERT INTO scoring_note (id, user_id, create_date, last_used, name, description) VALUES ('n1', '', '2026-01-01T00:00:00.000000', '', 'name', 'desc')")
	mustExec(t, db, "INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note) VALUES ('q1', '2026-01-01T00:00:00.000000', '', 'q1', '', '', 'n1')")
	mustExec(t, db, "INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note) VALUES ('q2', '2026-01-01T00:00:00.000000', '', 'q2', '', '', 'missing')")

	if err := apply(db, m6); err != nil {
		t.Fatalf("apply migration 6: %v", err)
	}

	// valid reference copied across, dangling reference nulled rather than
	// failing the migration
	var got sql.NullString
	if err := db.QueryRow("SELECT scoring_note_id FROM question WHERE id = 'q1'").Scan(&got); err != nil {
		t.Fatalf("read q1 scoring_note_id: %v", err)
	}
	if !got.Valid || got.String != "n1" {
		t.Errorf("q1 scoring_note_id = %+v, want 'n1'", got)
	}
	if err := db.QueryRow("SELECT scoring_note_id FROM question WHERE id = 'q2'").Scan(&got); err != nil {
		t.Fatalf("read q2 scoring_note_id: %v", err)
	}
	if got.Valid {
		t.Errorf("q2 scoring_note_id = %q, want NULL (dangling reference nulled)", got.String)
	}

	// the old column is gone
	rows, err := db.Query("PRAGMA table_info(question)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		if name == "scoring_note" {
			t.Error("question.scoring_note column still present after migration")
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}

	// FK enforced: a question referencing an unknown note is rejected
	if _, err := db.Exec("INSERT INTO question (id, create_date, scoring_note_id) VALUES ('q3', '2026-01-01T00:00:00.000000', 'nope')"); err == nil {
		t.Error("expected FK violation inserting question with unknown scoring_note_id")
	}

	// ON DELETE SET NULL: deleting the note clears referencing questions
	mustExec(t, db, "DELETE FROM scoring_note WHERE id = 'n1'")
	if err := db.QueryRow("SELECT scoring_note_id FROM question WHERE id = 'q1'").Scan(&got); err != nil {
		t.Fatalf("read q1 scoring_note_id after note delete: %v", err)
	}
	if got.Valid {
		t.Errorf("q1 scoring_note_id = %q after note delete, want NULL", got.String)
	}
}

func TestSeedUsers(t *testing.T) {
	db := openTestDB(t)

	if err := SeedUsers(db); err != nil {
		t.Fatalf("SeedUsers: %v", err)
	}

	// every mock user is present with its sub and display name
	for _, u := range MockUsers {
		var displayName string
		if err := db.QueryRow(
			"SELECT display_name FROM user WHERE sub = ?", u.Sub,
		).Scan(&displayName); err != nil {
			t.Fatalf("read seeded user %s: %v", u.Sub, err)
		}
		if displayName != u.DisplayName {
			t.Errorf("user %s display_name = %q, want %q", u.Sub, displayName, u.DisplayName)
		}
	}

	// idempotent: re-running is a no-op and doesn't duplicate rows
	if err := SeedUsers(db); err != nil {
		t.Fatalf("second SeedUsers: %v", err)
	}
	var n int
	if err := db.QueryRow("SELECT count(*) FROM user").Scan(&n); err != nil {
		t.Fatalf("count user: %v", err)
	}
	if n != len(MockUsers) {
		t.Errorf("user rows = %d after re-seed, want %d", n, len(MockUsers))
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	db := openTestDB(t)

	if err := Migrate(db); err != nil {
		t.Fatalf("second Migrate: %v", err)
	}
	v, err := Version(db)
	if err != nil {
		t.Fatalf("Version: %v", err)
	}
	if v != 13 {
		t.Fatalf("user_version = %d after re-migrate, want 13", v)
	}
}

func TestOpenCreatesParentDirectories(t *testing.T) {
	path := filepath.Join(t.TempDir(), "a", "b", "trivia.db")

	db, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	db.Close()

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("database file not created at %s: %v", path, err)
	}
}

func TestOpenConfiguresPragmas(t *testing.T) {
	db := openTestDB(t)

	var fk int
	if err := db.QueryRow("PRAGMA foreign_keys").Scan(&fk); err != nil {
		t.Fatalf("read foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("foreign_keys = %d, want 1", fk)
	}

	var mode string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&mode); err != nil {
		t.Fatalf("read journal_mode: %v", err)
	}
	if mode != "wal" {
		t.Errorf("journal_mode = %q, want wal", mode)
	}
}

func TestForeignKeysAreEnforced(t *testing.T) {
	db := openTestDB(t)

	// A cascading delete: dropping a round removes its round_question rows.
	mustExec(t, db, "INSERT INTO round (id, create_date, name, user_id) VALUES ('r1', '2026-01-01T00:00:00.000000', 'R', '')")
	mustExec(t, db, "INSERT INTO question (id, create_date) VALUES ('q1', '2026-01-01T00:00:00.000000')")
	mustExec(t, db, "INSERT INTO round_question (round_id, question_id, position) VALUES ('r1', 'q1', 0)")

	mustExec(t, db, "DELETE FROM round WHERE id = 'r1'")

	var n int
	if err := db.QueryRow("SELECT count(*) FROM round_question WHERE round_id = 'r1'").Scan(&n); err != nil {
		t.Fatalf("count round_question: %v", err)
	}
	if n != 0 {
		t.Errorf("round_question rows survived round delete: %d", n)
	}
}

func TestDBPathUsesEnvOrDefault(t *testing.T) {
	old, had := os.LookupEnv("DB_PATH")
	t.Cleanup(func() {
		if had {
			os.Setenv("DB_PATH", old)
		} else {
			os.Unsetenv("DB_PATH")
		}
	})

	os.Unsetenv("DB_PATH")
	if got := DBPath(); got != DefaultDBPath {
		t.Errorf("DBPath() = %q, want default %q", got, DefaultDBPath)
	}

	os.Setenv("DB_PATH", "/tmp/trivia.db")
	if got := DBPath(); got != "/tmp/trivia.db" {
		t.Errorf("DBPath() = %q, want /tmp/trivia.db", got)
	}
}

// TestQuestionTypeCheckConstraint verifies the CHECK constraint on
// question.question_type and session_question.question_type rejects values
// outside freeform / multiple_choice / matching / bucketing (ticket #99,
// extended by #164).
func TestQuestionTypeCheckConstraint(t *testing.T) {
	db := openTestDB(t)

	// question table rejects a bad type
	if _, err := db.Exec(
		`INSERT INTO question (id, create_date, question_type) VALUES ('q1', '2026-01-01T00:00:00.000000', 'bogus')`,
	); err == nil {
		t.Error("expected CHECK violation inserting bad question_type on question")
	}
	// the four valid values are accepted
	for _, typ := range []string{"freeform", "multiple_choice", "matching", "bucketing"} {
		mustExec(t, db,
			`INSERT INTO question (id, create_date, question_type) VALUES (?, '2026-01-01T00:00:00.000000', ?)`,
			"q-"+typ, typ)
	}

	// session_question rejects a bad type too
	mustExec(t, db, `INSERT INTO session (id, create_date) VALUES ('s1', '2026-01-01T00:00:00.000000')`)
	if _, err := db.Exec(
		`INSERT INTO session_question (session_id, round_index, question_index, question_type)
		 VALUES ('s1', 0, 0, 'bogus')`,
	); err == nil {
		t.Error("expected CHECK violation inserting bad question_type on session_question")
	}
	// ... and accepts bucketing
	mustExec(t, db,
		`INSERT INTO session_question (session_id, round_index, question_index, question_type)
		 VALUES ('s1', 1, 0, 'bucketing')`)
}

// TestMigrateRebuildsQuestionTypePreservesData verifies migration 12's table
// rebuild (widening the question_type CHECK for bucketing) preserves existing
// question / session_question rows and their referencing children, with
// foreign keys still enforced afterwards (ticket #164). It migrates a scratch
// DB to version 11, seeds v11-era data, then migrates to 12.
func TestMigrateRebuildsQuestionTypePreservesData(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	// forward-only Migrate can't stop at 11, so apply migrations 1..11
	// directly (the test is in the store package and can see the list).
	for _, m := range migrations {
		if m.version > 11 {
			break
		}
		if err := apply(db, m); err != nil {
			t.Fatalf("apply migration %d: %v", m.version, err)
		}
	}

	mustExec(t, db, `INSERT INTO question (id, create_date, category, question, answer, user_id, question_type)
		VALUES ('q1', '2026-01-01T00:00:00.000000', 'cat', 'q?', 'a', 'u1', 'matching')`)
	mustExec(t, db, `INSERT INTO round (id, create_date, name, user_id)
		VALUES ('r1', '2026-01-01T00:00:00.000000', 'R', 'u1')`)
	mustExec(t, db, `INSERT INTO round_question (round_id, question_id, position) VALUES ('r1', 'q1', 0)`)
	mustExec(t, db, `INSERT INTO question_match (question_id, position, left_text, right_text)
		VALUES ('q1', 0, 'L', 'R')`)
	mustExec(t, db, `INSERT INTO session (id, create_date) VALUES ('s1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db, `INSERT INTO session_question (session_id, round_index, question_index, question_type)
		VALUES ('s1', 0, 0, 'matching')`)
	mustExec(t, db, `INSERT INTO session_question_match (session_id, round_index, question_index, position, left_text, right_text)
		VALUES ('s1', 0, 0, 0, 'L', 'R')`)

	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate to 12: %v", err)
	}

	var n int
	for _, tc := range []struct {
		name  string
		query string
	}{
		{"question", `SELECT count(*) FROM question WHERE id = 'q1'`},
		{"round_question", `SELECT count(*) FROM round_question WHERE question_id = 'q1'`},
		{"question_match", `SELECT count(*) FROM question_match WHERE question_id = 'q1'`},
		{"session_question", `SELECT count(*) FROM session_question WHERE session_id = 's1'`},
		{"session_question_match", `SELECT count(*) FROM session_question_match WHERE session_id = 's1'`},
	} {
		if err := db.QueryRow(tc.query).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 1 {
			t.Errorf("%s rows lost by migration 12 rebuild: %d", tc.name, n)
		}
	}

	// the widened CHECK accepts bucketing on the rebuilt tables
	mustExec(t, db, `INSERT INTO question (id, create_date, question_type) VALUES ('q2', '2026-01-01T00:00:00.000000', 'bucketing')`)
	mustExec(t, db, `INSERT INTO session_question (session_id, round_index, question_index, question_type)
		VALUES ('s1', 1, 0, 'bucketing')`)

	// foreign keys still enforced against the rebuilt tables
	if _, err := db.Exec(`INSERT INTO round_question (round_id, question_id, position) VALUES ('r1', 'nope', 0)`); err == nil {
		t.Error("expected FK violation on round_question.question_id after rebuild")
	}
}

// TestMigrateAddsCategoryBackfill verifies migration 13 (ticket #178): the
// category table and question.category_id are added additively, existing
// free-text categories are backfilled into rows (one per distinct (category,
// user)), a scoring note shared by every question of a category is preserved
// onto the category, the legacy columns stay in place, and the new FK is
// enforced (unknown category_id rejected, category delete nulls references).
func TestMigrateAddsCategoryBackfill(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	// forward-only Migrate can't stop at 12, so apply migrations 1..12
	// directly (the test is in the store package and can see the list).
	for _, m := range migrations {
		if m.version > 12 {
			break
		}
		if err := apply(db, m); err != nil {
			t.Fatalf("apply migration %d: %v", m.version, err)
		}
	}

	// scoring notes referenced by the seeded questions
	for _, n := range []struct{ id, user string }{
		{"n1", "u1"}, {"n2", "u1"}, {"n3", "u1"},
	} {
		mustExec(t, db, `INSERT INTO scoring_note (id, user_id, create_date, last_used, name, description)
			VALUES (?, ?, '2026-01-01T00:00:00.000000', '', 'name', 'desc')`, n.id, n.user)
	}

	// v12-era questions: two categories for u1 (History shares note n1,
	// Science mixes n2/n3), one category for u2 (categories are per-user),
	// and one question with no category at all.
	seed := []struct {
		id, user, category, note, createDate string
	}{
		{"q1", "u1", "History", "n1", "2026-01-01T00:00:00.000000"},
		{"q2", "u1", "History", "n1", "2026-01-02T00:00:00.000000"},
		{"q5", "u1", "History", "", "2026-01-03T00:00:00.000000"},
		{"q3", "u1", "Science", "n2", "2026-01-04T00:00:00.000000"},
		{"q4", "u1", "Science", "n3", "2026-01-05T00:00:00.000000"},
		{"q6", "u2", "History", "n1", "2026-01-06T00:00:00.000000"},
		{"q7", "u1", "", "", "2026-01-07T00:00:00.000000"},
	}
	for _, q := range seed {
		var note interface{}
		if q.note != "" {
			note = q.note
		}
		mustExec(t, db, `INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note_id)
			VALUES (?, ?, ?, '', '', ?, ?)`, q.id, q.createDate, q.category, q.user, note)
	}

	// a session snapshot row must pass through untouched
	mustExec(t, db, `INSERT INTO session (id, create_date) VALUES ('s1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db, `INSERT INTO session_question (session_id, round_index, question_index, category)
		VALUES ('s1', 0, 0, 'History')`)

	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate to 13: %v", err)
	}

	// one category row per distinct (category, user)
	var n int
	if err := db.QueryRow("SELECT count(*) FROM category").Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 3 {
		t.Errorf("category rows = %d, want 3", n)
	}

	catID := func(name, user string) string {
		t.Helper()
		var id string
		if err := db.QueryRow("SELECT id FROM category WHERE name = ? AND user_id = ?", name, user).Scan(&id); err != nil {
			t.Fatalf("category %q/%q: %v", name, user, err)
		}
		return id
	}
	histU1 := catID("History", "u1")
	sciU1 := catID("Science", "u1")
	histU2 := catID("History", "u2")

	// create_date is the oldest question's timestamp; a note shared by all of
	// a category's questions is preserved, mixed notes stay NULL
	check := func(name, user, wantDate string, wantNote sql.NullString) {
		t.Helper()
		var date string
		var note sql.NullString
		if err := db.QueryRow("SELECT create_date, scoring_note_id FROM category WHERE name = ? AND user_id = ?", name, user).Scan(&date, &note); err != nil {
			t.Fatal(err)
		}
		if date != wantDate {
			t.Errorf("category %q/%q create_date = %q, want %q", name, user, date, wantDate)
		}
		if !note.Valid != !wantNote.Valid || (note.Valid && note.String != wantNote.String) {
			t.Errorf("category %q/%q scoring_note_id = %+v, want %+v", name, user, note, wantNote)
		}
	}
	check("History", "u1", "2026-01-01T00:00:00.000000", sql.NullString{String: "n1", Valid: true})
	check("Science", "u1", "2026-01-04T00:00:00.000000", sql.NullString{})
	check("History", "u2", "2026-01-06T00:00:00.000000", sql.NullString{String: "n1", Valid: true})

	// questions point at their backfilled category; the uncategorized one is NULL
	for _, q := range []struct {
		id   string
		want string
	}{
		{"q1", histU1}, {"q2", histU1}, {"q5", histU1},
		{"q3", sciU1}, {"q4", sciU1},
		{"q6", histU2},
		{"q7", ""},
	} {
		var got sql.NullString
		if err := db.QueryRow("SELECT category_id FROM question WHERE id = ?", q.id).Scan(&got); err != nil {
			t.Fatal(err)
		}
		gotStr := ""
		if got.Valid {
			gotStr = got.String
		}
		if gotStr != q.want {
			t.Errorf("question %s category_id = %q, want %q", q.id, gotStr, q.want)
		}
	}

	// legacy columns still present alongside category_id
	rows, err := db.Query("PRAGMA table_info(question)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		cols[name] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
	for _, want := range []string{"category", "scoring_note_id", "category_id"} {
		if !cols[want] {
			t.Errorf("question missing column %q after migration 13", want)
		}
	}

	// FK enforced: a question referencing an unknown category is rejected
	if _, err := db.Exec("INSERT INTO question (id, create_date, category_id) VALUES ('qx', '2026-01-01T00:00:00.000000', 'nope')"); err == nil {
		t.Error("expected FK violation inserting question with unknown category_id")
	}

	// ON DELETE SET NULL: deleting a category clears referencing questions
	mustExec(t, db, "DELETE FROM category WHERE id = ?", sciU1)
	var got sql.NullString
	if err := db.QueryRow("SELECT category_id FROM question WHERE id = 'q3'").Scan(&got); err != nil {
		t.Fatal(err)
	}
	if got.Valid {
		t.Errorf("q3 category_id = %q after category delete, want NULL", got.String)
	}

	// session snapshot untouched
	var cat string
	if err := db.QueryRow("SELECT category FROM session_question WHERE session_id = 's1'").Scan(&cat); err != nil {
		t.Fatal(err)
	}
	if cat != "History" {
		t.Errorf("session_question category = %q, want 'History'", cat)
	}
}

// TestQuestionChoicePartialUniqueIndex verifies the partial unique index
// idx_question_choice_one_correct allows at most one is_correct = 1 row per
// question (the app enforces at least one; the DB enforces at most one).
func TestQuestionChoicePartialUniqueIndex(t *testing.T) {
	db := openTestDB(t)
	mustExec(t, db, `INSERT INTO question (id, create_date) VALUES ('q1', '2026-01-01T00:00:00.000000')`)

	// first correct option is fine
	mustExec(t, db,
		`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES ('q1', 0, 'A', 1)`)
	// an incorrect option is fine
	mustExec(t, db,
		`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES ('q1', 1, 'B', 0)`)
	// a second correct option violates the partial unique index
	if _, err := db.Exec(
		`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES ('q1', 2, 'C', 1)`,
	); err == nil {
		t.Error("expected partial unique index to reject a second correct choice")
	}
}

// TestQuestionDeleteCascadesChildren verifies deleting a question removes its
// normalized question_choice / question_match / question_bucket /
// question_bucket_item child rows.
func TestQuestionDeleteCascadesChildren(t *testing.T) {
	db := openTestDB(t)
	mustExec(t, db, `INSERT INTO question (id, create_date) VALUES ('q1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db,
		`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES ('q1', 0, 'A', 1)`)
	mustExec(t, db,
		`INSERT INTO question_match (question_id, position, left_text, right_text) VALUES ('q1', 0, 'L', 'R')`)
	mustExec(t, db,
		`INSERT INTO question_bucket (question_id, position, text) VALUES ('q1', 0, 'B')`)
	mustExec(t, db,
		`INSERT INTO question_bucket_item (question_id, position, text, bucket_text) VALUES ('q1', 0, 'I', 'B')`)

	mustExec(t, db, `DELETE FROM question WHERE id = 'q1'`)

	var n int
	for _, tc := range []struct {
		name  string
		query string
	}{
		{"question_choice", `SELECT count(*) FROM question_choice WHERE question_id = 'q1'`},
		{"question_match", `SELECT count(*) FROM question_match WHERE question_id = 'q1'`},
		{"question_bucket", `SELECT count(*) FROM question_bucket WHERE question_id = 'q1'`},
		{"question_bucket_item", `SELECT count(*) FROM question_bucket_item WHERE question_id = 'q1'`},
	} {
		if err := db.QueryRow(tc.query).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Errorf("%s rows survived question delete: %d", tc.name, n)
		}
	}
}

// TestSessionDeleteCascadesSnapshotChildren verifies deleting a session removes
// its session_question_choice / session_question_match / session_question_bucket
// / session_question_bucket_item snapshot rows.
func TestSessionDeleteCascadesSnapshotChildren(t *testing.T) {
	db := openTestDB(t)
	mustExec(t, db, `INSERT INTO session (id, create_date) VALUES ('s1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db,
		`INSERT INTO session_question (session_id, round_index, question_index) VALUES ('s1', 0, 0)`)
	mustExec(t, db,
		`INSERT INTO session_question_choice (session_id, round_index, question_index, position, text, is_correct)
		 VALUES ('s1', 0, 0, 0, 'A', 1)`)
	mustExec(t, db,
		`INSERT INTO session_question_match (session_id, round_index, question_index, position, left_text, right_text)
		 VALUES ('s1', 0, 0, 0, 'L', 'R')`)
	mustExec(t, db,
		`INSERT INTO session_question_bucket (session_id, round_index, question_index, position, text)
		 VALUES ('s1', 0, 0, 0, 'B')`)
	mustExec(t, db,
		`INSERT INTO session_question_bucket_item (session_id, round_index, question_index, position, text, bucket_text)
		 VALUES ('s1', 0, 0, 0, 'I', 'B')`)

	mustExec(t, db, `DELETE FROM session WHERE id = 's1'`)

	var n int
	for _, tc := range []struct {
		name  string
		query string
	}{
		{"session_question_choice", `SELECT count(*) FROM session_question_choice WHERE session_id = 's1'`},
		{"session_question_match", `SELECT count(*) FROM session_question_match WHERE session_id = 's1'`},
		{"session_question_bucket", `SELECT count(*) FROM session_question_bucket WHERE session_id = 's1'`},
		{"session_question_bucket_item", `SELECT count(*) FROM session_question_bucket_item WHERE session_id = 's1'`},
	} {
		if err := db.QueryRow(tc.query).Scan(&n); err != nil {
			t.Fatal(err)
		}
		if n != 0 {
			t.Errorf("%s rows survived session delete: %d", tc.name, n)
		}
	}
}

// TestAnswerReactionTable verifies migration 11 (ticket #154): the
// answer_reaction table enforces one reaction per (answer, player) via a
// UNIQUE constraint, rejects unknown answer/player FKs, and cascades deletes
// from answer and player.
func TestAnswerReactionTable(t *testing.T) {
	db := openTestDB(t)

	// schema: the table exposes the expected columns
	rows, err := db.Query("PRAGMA table_info(answer_reaction)")
	if err != nil {
		t.Fatalf("query table_info: %v", err)
	}
	defer rows.Close()
	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan table_info row: %v", err)
		}
		cols[name] = true
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate table_info: %v", err)
	}
	for _, want := range []string{"id", "create_date", "answer_id", "player_id", "emoji"} {
		if !cols[want] {
			t.Errorf("answer_reaction missing column %q", want)
		}
	}

	mustExec(t, db, `INSERT INTO session (id, create_date) VALUES ('s1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db, `INSERT INTO player (id, create_date) VALUES ('p1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db, `INSERT INTO player (id, create_date) VALUES ('p2', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db, `INSERT INTO answer (id, create_date, session_id, round_index, question_index, player_id)
		VALUES ('a1', '2026-01-01T00:00:00.000000', 's1', 0, 0, 'p1')`)

	// a first reaction is fine
	mustExec(t, db, `INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r1', '2026-01-01T00:00:00.000000', 'a1', 'p2', '👍')`)

	// a second reaction from the same player on the same answer violates UNIQUE
	if _, err := db.Exec(`INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r2', '2026-01-01T00:00:00.000000', 'a1', 'p2', '❤️')`); err == nil {
		t.Error("expected UNIQUE violation for a second reaction by the same player on the same answer")
	}
	// a different player may react to the same answer
	mustExec(t, db, `INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r3', '2026-01-01T00:00:00.000000', 'a1', 'p1', '😂')`)

	// unknown answer / player FKs are rejected
	if _, err := db.Exec(`INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r4', '2026-01-01T00:00:00.000000', 'nope', 'p2', '👍')`); err == nil {
		t.Error("expected FK violation for unknown answer_id")
	}
	if _, err := db.Exec(`INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r5', '2026-01-01T00:00:00.000000', 'a1', 'nope', '👍')`); err == nil {
		t.Error("expected FK violation for unknown player_id")
	}

	// deleting the answer cascades to its reactions
	mustExec(t, db, `DELETE FROM answer WHERE id = 'a1'`)
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM answer_reaction WHERE answer_id = 'a1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("answer_reaction rows survived answer delete: %d", n)
	}

	// deleting the player cascades to their reactions
	mustExec(t, db, `INSERT INTO answer (id, create_date, session_id, round_index, question_index, player_id)
		VALUES ('a2', '2026-01-01T00:00:00.000000', 's1', 0, 1, 'p1')`)
	mustExec(t, db, `INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES ('r6', '2026-01-01T00:00:00.000000', 'a2', 'p2', '😂')`)
	mustExec(t, db, `DELETE FROM player WHERE id = 'p2'`)
	if err := db.QueryRow(`SELECT count(*) FROM answer_reaction WHERE player_id = 'p2'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("answer_reaction rows survived player delete: %d", n)
	}
}
