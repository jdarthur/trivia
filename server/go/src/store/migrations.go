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
// Where a column deliberately has no REFERENCES clause (session.game_id,
// session.moderator_id), it is gameplay data that must not be cascade-deleted
// by editor changes. Denormalized mirrors (question.rounds_used,
// player.session_id) were dropped once membership reads moved to the join
// tables.

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
	{
		version: 3,
		name:    "session relational port",
		statements: []string{
			// The session-port ticket (#76) moves session's document-shaped
			// fields into the session_question / session_score / session_player
			// tables. The JSON columns added by migration 2 are dropped; the
			// session_question table gains a scoring-note description snapshot
			// (the API returns the description text, and the old code snapshotted
			// it into the session document at set time).
			`ALTER TABLE session DROP COLUMN rounds`,
			`ALTER TABLE session DROP COLUMN scoreboard`,
			`ALTER TABLE session DROP COLUMN players`,
			`ALTER TABLE session_question ADD COLUMN scoring_note TEXT NOT NULL DEFAULT ''`,
		},
	},
	{
		version: 4,
		name:    "drop question rounds_used mirror",
		statements: []string{
			// The rounds_used JSON column was a denormalized mirror of
			// round_question, kept in sync by the editor write path. The editor
			// logic is ported and the client never reads it, so the mirror is
			// dropped (ticket #83): reads derive a question's rounds_used from
			// round_question, exactly as loadRound derives Round.Games from
			// game_round.
			`ALTER TABLE question DROP COLUMN rounds_used`,
		},
	},
	{
		version: 5,
		name:    "drop player session_id mirror",
		statements: []string{
			// player.session_id was a denormalized mirror of the
			// session_player membership join, written on join but never
			// cleared on leave and un-FK'd. Membership is canonical in
			// session_player, so the mirror is dropped (ticket #84); reads
			// derive a player's session from session_player, and updates bump
			// the state token of the sessions the player actually belongs to.
			`ALTER TABLE player DROP COLUMN session_id`,
		},
	},
	{
		version: 6,
		name:    "question scoring_note foreign key",
		statements: []string{
			// ticket #85: question.scoring_note held a scoring_note UUID with
			// no REFERENCES clause, so a question could point at a missing or
			// deleted note and cleanup depended on an app-side scan in
			// DeleteScoringNote. Rename the column to scoring_note_id and
			// enforce the reference.
			//
			// The column stays nullable: NULL (not '') is the "no note"
			// sentinel, and ON DELETE SET NULL clears the reference when a
			// note is deleted — matching the old app-side clearing, atomically.
			// Dangling references that predate the constraint are nulled
			// rather than failing the migration.
			//
			// The API wire format keeps the historical field name
			// "scoring_note"; only the column is renamed.
			`ALTER TABLE question ADD COLUMN scoring_note_id TEXT REFERENCES scoring_note(id) ON DELETE SET NULL`,
			`UPDATE question SET scoring_note_id = scoring_note
				WHERE scoring_note != '' AND scoring_note IN (SELECT id FROM scoring_note)`,
			`ALTER TABLE question DROP COLUMN scoring_note`,
		},
	},
	{
		version: 7,
		name:    "user table",
		statements: []string{
			// ticket #102: the editor's auth is Auth0 (sub from the token),
			// but dev mode authenticates mock users whose identity lives here.
			// sub is the Auth0 subject / dev-mode "dev|<username>" identifier.
			`CREATE TABLE user (
				sub          TEXT PRIMARY KEY,
				username     TEXT NOT NULL DEFAULT '',
				display_name TEXT NOT NULL DEFAULT '',
				create_date  TEXT NOT NULL,
				avatar_url   TEXT NOT NULL DEFAULT ''
			)`,
		},
	},
	{
		version: 8,
		name:    "question types",
		statements: []string{
			// ticket #98: questions gain a question_type (freeform by default —
			// current behavior) plus multiple_choice and matching. Structured
			// payloads live in normalized child tables, not embedded columns.
			// The type and child rows travel into the session via the
			// session_question snapshot so auto-scoring can use the snapshot.
			`ALTER TABLE question ADD COLUMN question_type TEXT NOT NULL DEFAULT 'freeform'
				CHECK (question_type IN ('freeform', 'multiple_choice', 'matching'))`,

			`CREATE TABLE question_choice (
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				text        TEXT NOT NULL DEFAULT '',
				is_correct  INTEGER NOT NULL DEFAULT 0,
				PRIMARY KEY (question_id, position)
			)`,
			// at most one correct option per question (the app also enforces
			// at least one on write).
			`CREATE UNIQUE INDEX idx_question_choice_one_correct
				ON question_choice(question_id) WHERE is_correct = 1`,

			`CREATE TABLE question_match (
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				left_text   TEXT NOT NULL DEFAULT '',
				right_text  TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (question_id, position)
			)`,

			`ALTER TABLE session_question ADD COLUMN question_type TEXT NOT NULL DEFAULT 'freeform'
				CHECK (question_type IN ('freeform', 'multiple_choice', 'matching'))`,

			`CREATE TABLE session_question_choice (
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				position       INTEGER NOT NULL,
				text           TEXT NOT NULL DEFAULT '',
				is_correct     INTEGER NOT NULL DEFAULT 0,
				PRIMARY KEY (session_id, round_index, question_index, position)
			)`,

			`CREATE TABLE session_question_match (
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				position       INTEGER NOT NULL,
				left_text      TEXT NOT NULL DEFAULT '',
				right_text     TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (session_id, round_index, question_index, position)
			)`,
		},
	},
	{
		version: 9,
		name:    "session player active flag",
		statements: []string{
			// ticket #5: an explicit "inactive" state on the per-(session,player)
			// membership row so the game continues when someone leaves or is
			// booted without hand-answering their questions. Inactive players
			// stay on the roster/scoreboard (greyed, score frozen), are excluded
			// from the scoreQuestion requirement, and can no longer submit.
			`ALTER TABLE session_player ADD COLUMN active INTEGER NOT NULL DEFAULT 1`,
		},
	},
	{
		version: 10,
		name:    "answer moneyball flag",
		statements: []string{
			// ticket #3: the Moneyball mechanic. A player opts in per answer;
			// at score time the backend awards 2X for a lone correct answer,
			// normal points with one other correct, 0 with two or more others
			// correct, and -1X for an incorrect answer. Old rows (no flag)
			// read back as not-moneyball.
			`ALTER TABLE answer ADD COLUMN use_moneyball INTEGER NOT NULL DEFAULT 0`,
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
