package store

import (
	"context"
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
	// disableForeignKeys runs the migration on a dedicated connection with
	// PRAGMA foreign_keys = OFF (restored afterwards). Needed for table
	// rebuilds: SQLite's DROP TABLE performs an implicit DELETE whose ON
	// DELETE CASCADE would wipe referencing child rows, and PRAGMA
	// foreign_keys is a no-op inside a transaction, so the pragma must be
	// toggled on the connection outside the BEGIN/COMMIT.
	disableForeignKeys bool
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
	{
		version: 11,
		name:    "answer reaction table",
		statements: []string{
			// ticket #154: emoji reactions on scored answers. One row is one
			// reaction by one player to one answer; UNIQUE(answer_id,
			// player_id) enforces "react once" at the DB level, so modifying
			// is an UPDATE on the same row and removing is a DELETE. Reads
			// join answer_reaction -> answer on (session_id, round_index,
			// question_index), which answer already carries, so no
			// denormalized session/round/question columns are stored here.
			`CREATE TABLE answer_reaction (
				id          TEXT PRIMARY KEY,
				create_date TEXT NOT NULL,
				answer_id   TEXT NOT NULL REFERENCES answer(id) ON DELETE CASCADE,
				player_id   TEXT NOT NULL REFERENCES player(id) ON DELETE CASCADE,
				emoji       TEXT NOT NULL DEFAULT '',
				UNIQUE (answer_id, player_id)
			)`,
		},
	},
	{
		version: 12,
		name:    "bucketing question type",
		// ticket #164: questions gain a "bucketing" type — X items sorted
		// into Y buckets (many-to-one), e.g. "which type of animal is each
		// of these". The payload lives in two normalized child tables (the
		// bucket list, and each item with its correct bucket), mirrored into
		// the session snapshot like choice/match.
		//
		// Adding a value to the question_type CHECK requires rebuilding the
		// question and session_question tables (SQLite cannot alter a CHECK
		// constraint). The rebuild drops the old table, so it runs with
		// foreign_keys off — otherwise the implicit DELETE would cascade
		// through round_question / session_question_choice / _match and
		// wipe live data. The index on session_question is recreated after
		// the rename (DROP TABLE removes it with the table).
		disableForeignKeys: true,
		statements: []string{
			`CREATE TABLE question_bucketing_new (
				id              TEXT PRIMARY KEY,
				create_date     TEXT NOT NULL,
				category        TEXT NOT NULL DEFAULT '',
				question        TEXT NOT NULL DEFAULT '',
				answer          TEXT NOT NULL DEFAULT '',
				user_id         TEXT NOT NULL DEFAULT '',
				scoring_note_id TEXT REFERENCES scoring_note(id) ON DELETE SET NULL,
				question_type   TEXT NOT NULL DEFAULT 'freeform'
					CHECK (question_type IN ('freeform', 'multiple_choice', 'matching', 'bucketing'))
			)`,
			`INSERT INTO question_bucketing_new (id, create_date, category, question, answer, user_id, scoring_note_id, question_type)
				SELECT id, create_date, category, question, answer, user_id, scoring_note_id, question_type FROM question`,
			`DROP TABLE question`,
			`ALTER TABLE question_bucketing_new RENAME TO question`,

			`CREATE TABLE session_question_bucketing_new (
				session_id      TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index     INTEGER NOT NULL,
				question_index  INTEGER NOT NULL,
				question_id     TEXT NOT NULL DEFAULT '',
				category        TEXT NOT NULL DEFAULT '',
				question        TEXT NOT NULL DEFAULT '',
				answer          TEXT NOT NULL DEFAULT '',
				scoring_note_id TEXT NOT NULL DEFAULT '',
				scored          INTEGER NOT NULL DEFAULT 0,
				scoring_note    TEXT NOT NULL DEFAULT '',
				question_type   TEXT NOT NULL DEFAULT 'freeform'
					CHECK (question_type IN ('freeform', 'multiple_choice', 'matching', 'bucketing')),
				PRIMARY KEY (session_id, round_index, question_index)
			)`,
			`INSERT INTO session_question_bucketing_new (session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scored, scoring_note, question_type)
				SELECT session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scored, scoring_note, question_type FROM session_question`,
			`DROP TABLE session_question`,
			`ALTER TABLE session_question_bucketing_new RENAME TO session_question`,
			`CREATE INDEX idx_session_question_session ON session_question(session_id)`,

			`CREATE TABLE question_bucket (
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				text        TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (question_id, position)
			)`,
			`CREATE TABLE question_bucket_item (
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				text        TEXT NOT NULL DEFAULT '',
				bucket_text TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (question_id, position)
			)`,

			`CREATE TABLE session_question_bucket (
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				position       INTEGER NOT NULL,
				text           TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (session_id, round_index, question_index, position)
			)`,
			`CREATE TABLE session_question_bucket_item (
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				position       INTEGER NOT NULL,
				text           TEXT NOT NULL DEFAULT '',
				bucket_text    TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (session_id, round_index, question_index, position)
			)`,
		},
	},
	{
		version: 13,
		name:    "category table and question category_id",
		// ticket #178 (part of #167): Category becomes a root model. The new
		// category table carries the optional scoring note that used to live
		// per-question, and question gains a category_id FK.
		//
		// Deliberately additive: the legacy question.category text column and
		// question.scoring_note_id stay in place so existing code keeps
		// working unchanged. The API ticket (#179) switches question writes to
		// category_id and drops the legacy columns in its own migration. No
		// table rebuild is needed — ALTER TABLE ADD COLUMN with a REFERENCES
		// clause is legal because the column is nullable (default NULL).
		statements: []string{
			`CREATE TABLE category (
				id              TEXT PRIMARY KEY,
				user_id         TEXT NOT NULL DEFAULT '',
				create_date     TEXT NOT NULL,
				name            TEXT NOT NULL DEFAULT '',
				scoring_note_id TEXT REFERENCES scoring_note(id) ON DELETE SET NULL
			)`,

			// Backfill one category row per distinct (category text, user) in
			// use today. create_date comes from the oldest question in the
			// group, so it is already in the API's wire/storage format. IDs
			// are opaque random hex (nothing parses them).
			`INSERT INTO category (id, user_id, create_date, name)
				SELECT lower(hex(randomblob(16))), user_id, MIN(create_date), category
				FROM question WHERE category != '' GROUP BY category, user_id`,

			// A category inherits a scoring note only when every question
			// using it references the same note; mixed or absent notes leave
			// it NULL (the "no note" sentinel).
			`UPDATE category SET scoring_note_id = (
				SELECT MIN(q.scoring_note_id) FROM question q
				WHERE q.category = category.name AND q.user_id = category.user_id
				  AND q.scoring_note_id IS NOT NULL
				  AND (SELECT COUNT(DISTINCT q2.scoring_note_id) FROM question q2
					   WHERE q2.category = category.name AND q2.user_id = category.user_id
						 AND q2.scoring_note_id IS NOT NULL) = 1
			)`,

			`ALTER TABLE question ADD COLUMN category_id TEXT REFERENCES category(id) ON DELETE SET NULL`,

			// Point each question at its backfilled category row.
			`UPDATE question SET category_id = (
				SELECT c.id FROM category c
				WHERE c.name = question.category AND c.user_id = question.user_id
			) WHERE category != ''`,
		},
	},
	{
		version: 14,
		name:    "drop legacy question category columns",
		// ticket #179 (part of #167): question writes now carry category_id
		// (the category's ID, wired through as the historical `category` field)
		// and the per-question scoring note is gone — a question's note comes
		// from its category. The legacy question.category text column
		// (superseded by category_id in migration 13) and question.scoring_note_id
		// (moved to category.scoring_note_id) are dropped.
		statements: []string{
			`ALTER TABLE question DROP COLUMN category`,
			`ALTER TABLE question DROP COLUMN scoring_note_id`,
		},
	},
	{
		version: 15,
		name:    "ordering question type",
		// ticket #207: questions gain an "ordering" type — the answer is the
		// question's items in their correct order (e.g. "rank these states by
		// population (ascending)"). The payload is a list of item texts whose
		// position IS the correct order; it lives in a normalized child table
		// (question_ordered) mirrored into the session snapshot like
		// choice/match/bucket.
		//
		// Adding a value to the question_type CHECK requires rebuilding the
		// question and session_question tables (SQLite cannot alter a CHECK
		// constraint). The rebuild drops the old table, so it runs with
		// foreign_keys off — otherwise the implicit DELETE would cascade
		// through round_question / session_question_choice / _match / _bucket
		// and wipe live data. The index on session_question is recreated after
		// the rename (DROP TABLE removes it with the table).
		//
		// The rebuilt question keeps the post-migration-14 columns
		// (category_id, no legacy category/scoring_note_id text columns).
		disableForeignKeys: true,
		statements: []string{
			`CREATE TABLE question_ordering_new (
				id              TEXT PRIMARY KEY,
				create_date     TEXT NOT NULL,
				category_id     TEXT REFERENCES category(id) ON DELETE SET NULL,
				question        TEXT NOT NULL DEFAULT '',
				answer          TEXT NOT NULL DEFAULT '',
				user_id         TEXT NOT NULL DEFAULT '',
				question_type   TEXT NOT NULL DEFAULT 'freeform'
					CHECK (question_type IN ('freeform', 'multiple_choice', 'matching', 'bucketing', 'ordering'))
			)`,
			`INSERT INTO question_ordering_new (id, create_date, category_id, question, answer, user_id, question_type)
				SELECT id, create_date, category_id, question, answer, user_id, question_type FROM question`,
			`DROP TABLE question`,
			`ALTER TABLE question_ordering_new RENAME TO question`,

			`CREATE TABLE session_question_ordering_new (
				session_id      TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index     INTEGER NOT NULL,
				question_index  INTEGER NOT NULL,
				question_id     TEXT NOT NULL DEFAULT '',
				category        TEXT NOT NULL DEFAULT '',
				question        TEXT NOT NULL DEFAULT '',
				answer          TEXT NOT NULL DEFAULT '',
				scoring_note_id TEXT NOT NULL DEFAULT '',
				scored          INTEGER NOT NULL DEFAULT 0,
				scoring_note    TEXT NOT NULL DEFAULT '',
				question_type   TEXT NOT NULL DEFAULT 'freeform'
					CHECK (question_type IN ('freeform', 'multiple_choice', 'matching', 'bucketing', 'ordering')),
				PRIMARY KEY (session_id, round_index, question_index)
			)`,
			`INSERT INTO session_question_ordering_new (session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scored, scoring_note, question_type)
				SELECT session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scored, scoring_note, question_type FROM session_question`,
			`DROP TABLE session_question`,
			`ALTER TABLE session_question_ordering_new RENAME TO session_question`,
			`CREATE INDEX idx_session_question_session ON session_question(session_id)`,

			`CREATE TABLE question_ordered (
				question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
				position    INTEGER NOT NULL,
				text        TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (question_id, position)
			)`,

			`CREATE TABLE session_question_ordered (
				session_id     TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
				round_index    INTEGER NOT NULL,
				question_index INTEGER NOT NULL,
				position       INTEGER NOT NULL,
				text           TEXT NOT NULL DEFAULT '',
				PRIMARY KEY (session_id, round_index, question_index, position)
			)`,
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
	if m.disableForeignKeys {
		return applyWithForeignKeysOff(db, m)
	}
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

// applyWithForeignKeysOff applies a migration whose DDL drops a table other
// tables still reference. SQLite's DROP TABLE performs an implicit DELETE
// whose ON DELETE CASCADE actions fire under foreign_keys = 1, so the
// rebuild would wipe referencing child rows; and PRAGMA foreign_keys is a
// no-op inside a transaction. A dedicated connection is pinned, the pragma
// is toggled outside the BEGIN/COMMIT, and the migration runs as a normal
// transaction in between. The stored child-table FK clauses survive the
// rebuild (they reference the table by name, which the rename restores), so
// enforcement is re-established when the pragma is turned back on.
func applyWithForeignKeysOff(db *sql.DB, m migration) error {
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		return fmt.Errorf("migration %d (%s): conn: %w", m.version, m.name, err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys = OFF"); err != nil {
		return fmt.Errorf("migration %d (%s): disable foreign keys: %w", m.version, m.name, err)
	}
	//nolint:errcheck // best-effort restore on the way out; the connection is closed anyway
	defer conn.ExecContext(ctx, "PRAGMA foreign_keys = ON")

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("migration %d (%s): begin: %w", m.version, m.name, err)
	}
	defer tx.Rollback() //nolint:errcheck // no-op after a successful Commit

	for _, stmt := range m.statements {
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("migration %d (%s): %w", m.version, m.name, err)
		}
	}

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
