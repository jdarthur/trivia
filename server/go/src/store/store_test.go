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
	if v != 2 {
		t.Fatalf("user_version = %d, want 2", v)
	}

	tables := []string{
		"question", "round", "round_question", "round_wager",
		"game", "game_round", "game_round_name",
		"collection", "collection_question",
		"scoring_note", "player", "session", "session_player",
		"session_question", "answer", "session_score", "session_state",
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

func TestMigrateIsIdempotent(t *testing.T) {
	db := openTestDB(t)

	if err := Migrate(db); err != nil {
		t.Fatalf("second Migrate: %v", err)
	}
	v, err := Version(db)
	if err != nil {
		t.Fatalf("Version: %v", err)
	}
	if v != 2 {
		t.Fatalf("user_version = %d after re-migrate, want 2", v)
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
