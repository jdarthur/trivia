// Package store owns the SQLite database: the connection (configured from
// DB_PATH), the connection pragmas, and the versioned schema migrations.
//
// Nothing in the handlers uses this package yet — it lands as the storage
// foundation that the data-access layer is ported onto.
package store

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite" // registers the "sqlite" database/sql driver
)

// DefaultDBPath is the database file used when DB_PATH is not set. Like
// IMAGE_DIR it is relative to the working directory.
const DefaultDBPath = "./data/trivia.db"

// DBPath returns the SQLite database path from the DB_PATH environment
// variable, falling back to DefaultDBPath when unset.
func DBPath() string {
	if p := os.Getenv("DB_PATH"); p != "" {
		return p
	}
	return DefaultDBPath
}

// Open opens (creating if necessary) the SQLite database at path, creating any
// missing parent directories. The connection is configured for the server's
// workload:
//
//   - foreign keys enforced — the baseline schema declares REFERENCES clauses
//   - a 5s busy timeout, so concurrent readers/writers wait instead of failing
//   - WAL journal mode, so gameplay reads don't block the writer
//
// Callers should run Migrate before using the database.
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create database directory %s: %w", dir, err)
		}
	}

	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("resolve database path %s: %w", path, err)
	}

	dsn := "file:" + abs +
		"?_pragma=foreign_keys(1)" +
		"&_pragma=busy_timeout(5000)" +
		"&_pragma=journal_mode(WAL)"

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping %s: %w", path, err)
	}
	return db, nil
}

// OpenDefault opens the database at DBPath().
func OpenDefault() (*sql.DB, error) {
	return Open(DBPath())
}
