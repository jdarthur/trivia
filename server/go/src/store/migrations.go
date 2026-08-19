package store

import (
	"database/sql"
	"fmt"
)

// Timestamps (create_date, last_used) are stored as TEXT in the same format
// the API emits today — 2006-01-02T15:04:05.000000 — so reads can round-trip
// without conversion. Booleans are stored as INTEGER 0/1.
//
// The baseline schema maps the current Mongo document model onto relations.
// Where a column deliberately has no REFERENCES clause (player.session_id,
// session.game_id, session.moderator_id), it is a denormalized mirror whose
// canonical form lives in a join table, or gameplay data that must not be
// cascade-deleted by editor changes.

// migration is one versioned step of the schema. Its statements are applied
// atomically inside a single transaction.
type migration struct {
	version    int
	name       string
	statements []string
}

// migrations is the ordered list of schema migrations. Never edit an applied
// migration — append a new one instead.
var migrations = []migration{
	{
		version: 1,
		name:    "baseline",
		statements: []string{
			`CREATE TABLE question (
				id           TEXT PRIMARY KEY,
				create_date  TEXT NOT NULL,
				category     TEXT NOT NULL DEFAULT '',
				question     TEXT NOT NULL DEFAULT '',
				answer       TEXT NOT NULL DEFAULT '',
				user_id      TEXT NOT NULL DEFAULT '',
				scoring_note TEXT NOT NULL DEFAULT '',
				-- Denormalized mirror of round_question, kept as a JSON array
				-- of round IDs because the editor reads it back whole. Revisit
				-- when the editor logic is ported.
				rounds_used  TEXT NOT NULL DEFAULT '[]'
			)`,

			`CREATE TABLE round (
				id          TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				name        TEXT NOT NULL DEFAULT '',
				user_id     TEXT NOT NULL DEFAULT ''
			)`,

			`CREATE TABLE round_question (
				round_id    TEXT NOT NULL REFERENCES round(id) ON DELETE CASCADE,
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				PRIMARY KEY (round_id, question_id)
			)`,

			`CREATE TABLE round_wager (
				round_id TEXT NOT NULL REFERENCES round(id) ON DELETE CASCADE,
				position INTEGER NOT NULL,
				wager    INTEGER NOT NULL,
				PRIMARY KEY (round_id, position)
			)`,

			`CREATE TABLE game (
				id          TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				name        TEXT NOT NULL DEFAULT '',
				user_id     TEXT NOT NULL DEFAULT ''
			)`,

			`CREATE TABLE game_round (
				game_id  TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
				round_id TEXT NOT NULL REFERENCES round(id) ON DELETE CASCADE,
				position INTEGER NOT NULL,
				PRIMARY KEY (game_id, round_id)
			)`,

			`CREATE TABLE game_round_name (
				game_id  TEXT NOT NULL REFERENCES game(id) ON DELETE CASCADE,
				round_id TEXT NOT NULL REFERENCES round(id) ON DELETE CASCADE,
				name     TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (game_id, round_id)
			)`,

			`CREATE TABLE collection (
				id          TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				name        TEXT NOT NULL DEFAULT '',
				user_id     TEXT NOT NULL DEFAULT ''
			)`,

			`CREATE TABLE collection_question (
				collection_id TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE,
				question_id   TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position      INTEGER NOT NULL,
				PRIMARY KEY (collection_id, question_id)
			)`,

			`CREATE TABLE scoring_note (
				id          TEXT PRIMARY KEY,
				user_id     TEXT NOT NULL DEFAULT '',
				create_date TEXT NOT NULL,
				last_used   TEXT NOT NULL DEFAULT '',
				name        TEXT NOT NULL DEFAULT '',
				description TEXT NOT NULL DEFAULT ''
			)`,

			`CREATE TABLE player (
				id          TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				team_name   TEXT NOT NULL DEFAULT '',
				real_name   TEXT NOT NULL DEFAULT '',
				icon        TEXT NOT NULL DEFAULT '',
				-- Denormalized: membership is canonical in session_player.
				session_id  TEXT NOT NULL DEFAULT ''
			)`,

			`CREATE TABLE session (
				id               TEXT PRIMARY KEY,
				create_date      TEXT NOT NULL,
				name             TEXT NOT NULL DEFAULT '',
				-- No REFERENCES clause: deleting an editor game must neither
				-- cascade into nor be blocked by gameplay data.
				game_id          TEXT NOT NULL DEFAULT '',
				moderator_id     TEXT NOT NULL DEFAULT '',
				started          INTEGER NOT NULL DEFAULT 0,
				current_round    INTEGER,
				current_question INTEGER
			)`,

			`CREATE TABLE session_player (
				session_id TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				player_id  TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
				position   INTEGER NOT NULL,
				PRIMARY KEY (session_id, player_id)
			)`,

			`CREATE TABLE session_question (
				session_id      TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index     INTEGER NOT NULL,
				question_index  INTEGER NOT NULL,
				question_id     TEXT NOT NULL DEFAULT '',
				category        TEXT NOT NULL DEFAULT '',
				question        TEXT NOT NULL DEFAULT '',
				answer          TEXT NOT NULL DEFAULT '',
				scoring_note_id TEXT NOT NULL DEFAULT '',
				scored          INTEGER NOT NULL DEFAULT 0,
				PRIMARY KEY (session_id, round_index, question_index)
			)`,

			`CREATE TABLE answer (
				id             TEXT PRIMARY KEY,
				create_date    TEXT NOT NULL,
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				player_id      TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
				answer         TEXT NOT NULL DEFAULT '',
				wager          INTEGER NOT NULL DEFAULT 0,
				correct        INTEGER NOT NULL DEFAULT 0,
				points_awarded REAL NOT NULL DEFAULT 0
			)`,

			`CREATE TABLE session_score (
				session_id  TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				player_id   TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
				round_index INTEGER NOT NULL,
				points      REAL NOT NULL DEFAULT 0,
				PRIMARY KEY (session_id, player_id, round_index)
			)`,

			`CREATE TABLE session_state (
				session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
				state      TEXT NOT NULL DEFAULT ''
			)`,

			// Lookups the handlers actually make.
			`CREATE INDEX idx_round_question_question ON round_question(question_id)`,
			`CREATE INDEX idx_game_round_game ON game_round(game_id)`,
			`CREATE INDEX idx_collection_question_collection ON collection_question(collection_id)`,
			`CREATE INDEX idx_session_player_session ON session_player(session_id)`,
			`CREATE INDEX idx_session_question_session ON session_question(session_id)`,
			`CREATE INDEX idx_answer_session ON answer(session_id, round_index, question_index)`,
		},
	},
	{
		version: 2,
		name:    "session json columns",
		statements: []string{
			// The engine swap (#75) keeps session's document-shaped fields as
			// JSON columns; the session-port ticket (#76) replaces these with
			// the session_question / session_score / session_player tables.
			`ALTER TABLE session ADD COLUMN rounds TEXT NOT NULL DEFAULT '[]'`,
			`ALTER TABLE session ADD COLUMN scoreboard TEXT NOT NULL DEFAULT '{}'`,
			`ALTER TABLE session ADD COLUMN players TEXT NOT NULL DEFAULT '[]'`,
		},
	},
}

// Migrate brings db up to the latest schema version, applying each pending
// migration inside its own transaction. It is idempotent: running it against
// an already-migrated database is a no-op.
func Migrate(db *sql.DB) error {
	current, err := Version(db)
	if err != nil {
		return err
	}

	for _, m := range migrations {
		if m.version <= current {
			continue
		}
		if err := apply(db, m); err != nil {
			return err
		}
	}
	return nil
}

func apply(db *sql.DB, m migration) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("migration %d (%s): begin: %w", m.version, m.name, err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after a successful Commit

	for _, stmt := range m.statements {
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("migration %d (%s): %w", m.version, m.name, err)
		}
	}

	// user_version lives in the database header, so this bump is committed or
	// rolled back together with the DDL above.
	if _, err := tx.Exec(fmt.Sprintf("PRAGMA user_version = %d", m.version)); err != nil {
		return fmt.Errorf("migration %d (%s): set user_version: %w", m.version, m.name, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("migration %d (%s): commit: %w", m.version, m.name, err)
	}
	return nil
}

// Version returns the current schema version (PRAGMA user_version) of db.
func Version(db *sql.DB) (int, error) {
	var v int
	if err := db.QueryRow("PRAGMA user_version").Scan(&v); err != nil {
		return 0, fmt.Errorf("read user_version: %w", err)
	}
	return v, nil
}
