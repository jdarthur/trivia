package test

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/jdarthur/trivia/store"
)

// GetDb opens a fresh, migrated SQLite database in a temp dir. No external
// service is needed — each call returns an isolated database.
func GetDb() *sql.DB {
	path := filepath.Join(os.TempDir(), fmt.Sprintf("trivia-test-%d.db", time.Now().UnixNano()))

	db, err := store.Open(path)
	if err != nil {
		panic(err)
	}

	if err := store.Migrate(db); err != nil {
		panic(err)
	}

	return db
}
