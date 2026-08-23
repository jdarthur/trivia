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
	if v != 8 {
		t.Fatalf("user_version = %d, want 8", v)
	}

	tables := []string{
		"question", "round", "round_question", "round_wager",
		"game", "game_round", "game_round_name",
		"collection", "collection_question",
		"scoring_note", "player", "session", "session_player",
		"session_question", "answer", "session_score", "session_state",
		"user",
		"question_choice", "question_match",
		"session_question_choice", "session_question_match",
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
	if v != 8 {
		t.Fatalf("user_version = %d after re-migrate, want 8", v)
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
// outside freeform / multiple_choice / matching (ticket #99).
func TestQuestionTypeCheckConstraint(t *testing.T) {
	db := openTestDB(t)

	// question table rejects a bad type
	if _, err := db.Exec(
		`INSERT INTO question (id, create_date, question_type) VALUES ('q1', '2026-01-01T00:00:00.000000', 'bogus')`,
	); err == nil {
		t.Error("expected CHECK violation inserting bad question_type on question")
	}
	// the three valid values are accepted
	for _, typ := range []string{"freeform", "multiple_choice", "matching"} {
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
// normalized question_choice / question_match child rows.
func TestQuestionDeleteCascadesChildren(t *testing.T) {
	db := openTestDB(t)
	mustExec(t, db, `INSERT INTO question (id, create_date) VALUES ('q1', '2026-01-01T00:00:00.000000')`)
	mustExec(t, db,
		`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES ('q1', 0, 'A', 1)`)
	mustExec(t, db,
		`INSERT INTO question_match (question_id, position, left_text, right_text) VALUES ('q1', 0, 'L', 'R')`)

	mustExec(t, db, `DELETE FROM question WHERE id = 'q1'`)

	var n int
	if err := db.QueryRow(`SELECT count(*) FROM question_choice WHERE question_id = 'q1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("question_choice rows survived question delete: %d", n)
	}
	if err := db.QueryRow(`SELECT count(*) FROM question_match WHERE question_id = 'q1'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("question_match rows survived question delete: %d", n)
	}
}

// TestSessionDeleteCascadesSnapshotChildren verifies deleting a session removes
// its session_question_choice / session_question_match snapshot rows.
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

	mustExec(t, db, `DELETE FROM session WHERE id = 's1'`)

	var n int
	if err := db.QueryRow(
		`SELECT count(*) FROM session_question_choice WHERE session_id = 's1'`,
	).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("session_question_choice rows survived session delete: %d", n)
	}
	if err := db.QueryRow(
		`SELECT count(*) FROM session_question_match WHERE session_id = 's1'`,
	).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("session_question_match rows survived session delete: %d", n)
	}
}
