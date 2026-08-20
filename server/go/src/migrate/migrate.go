// Package migrate imports the legacy MongoDB database into the SQLite store.
//
// This is the one-off companion to the engine swap (ticket #75): existing
// questions/rounds/games/sessions live in Mongo and must survive the move to
// SQLite. It reads every collection the mgo-era server wrote — question,
// round, game, session, player, answer, session_state, collection,
// scoring_note — and writes the equivalent rows into the SQLite schema,
// preserving UUIDs (bson.Binary subtype 3) and create_date. Nested session
// documents are flattened into session_player / session_question rows,
// answers are placed into (session, round, question) using the session
// document's PlayerAnswers map (the mgo-era answer documents never stored
// their indices), and session_score per-round totals are derived from the
// scored answers' points_awarded.
//
// The import runs inside a single transaction: any failure rolls the whole
// thing back, so the target database is never left half-populated. Rows whose
// parent is missing (dangling references that Mongo tolerated but the SQLite
// foreign keys forbid) are skipped and counted in the Summary instead of
// failing the run; a question pointing at a missing scoring note is imported
// with the reference cleared, exactly as migration 6 does for pre-existing
// data.
//
// The command lives at cmd/migrate; this package exists so the SQLite write
// side can be tested without a live MongoDB (the importers take a raw BSON
// document, not a *mongo.Collection).
//
// This is the only place that speaks Mongo after the engine swap; the official
// driver is used rather than the mgo fork, so it works with any MongoDB.
package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	sqlite "modernc.org/sqlite"
)

// timeFormat is the API's historical timestamp wire format — a UTC-naive
// "2006-01-02T15:04:05.000000" string — which the SQLite columns store.
const timeFormat = "2006-01-02T15:04:05.000000"

// fkConstraint is SQLITE_CONSTRAINT_FOREIGNKEY, the extended result code
// modernc.org/sqlite returns when an INSERT violates a REFERENCES clause.
// The public sqlite package does not export it, so it is spelled out here.
const fkConstraint = 787

// formatTime renders t in the storage format. Mongo datetimes decode as UTC,
// so the explicit .UTC() is a no-op on real data but keeps the output honest.
func formatTime(t time.Time) string {
	return t.UTC().Format(timeFormat)
}

// uuidFromBinary decodes a bson.Binary subtype-3 UUID (the ID shape the
// mgo-era models.NewId wrote) into its canonical string form.
func uuidFromBinary(b bson.Binary) (string, error) {
	if b.Subtype != 3 {
		return "", fmt.Errorf("expected bson.Binary subtype 3 (UUID), got subtype %d", b.Subtype)
	}
	u, err := uuid.FromBytes(b.Data)
	if err != nil {
		return "", fmt.Errorf("invalid UUID bytes (%d bytes): %w", len(b.Data), err)
	}
	return u.String(), nil
}

// ---------------------------------------------------------------------------
// Mongo document shapes. These mirror the mgo-era models (see the engine-swap
// commit) so the official driver can decode the stored documents unchanged;
// the JSON wire fields are irrelevant here, only the bson tags matter.
// ---------------------------------------------------------------------------

type mongoQuestion struct {
	ID          bson.Binary `bson:"_id"`
	CreateDate  time.Time   `bson:"create_date"`
	Category    string      `bson:"category"`
	Question    string      `bson:"question"`
	Answer      string      `bson:"answer"`
	RoundsUsed  []string    `bson:"rounds_used"` // mirror dropped in SQLite (migration 4); membership derives from round_question
	UserId      string      `bson:"user_id"`
	ScoringNote string      `bson:"scoring_note"`
}

type mongoRound struct {
	ID         bson.Binary `bson:"_id"`
	CreateDate time.Time   `bson:"create_date"`
	Name       string      `bson:"name"`
	Questions  []string    `bson:"questions"`
	Wagers     []int       `bson:"wagers"`
	Games      []string    `bson:"games"` // read-only mirror; derives from game_round in SQLite
	UserId     string      `bson:"user_id"`
}

type mongoGame struct {
	ID         bson.Binary       `bson:"_id"`
	CreateDate time.Time         `bson:"create_date"`
	Name       string            `bson:"name"`
	Rounds     []string          `bson:"rounds"`
	RoundNames map[string]string `bson:"round_names"`
	UserId     string            `bson:"user_id"`
}

type mongoCollection struct {
	ID         bson.Binary `bson:"_id"`
	CreateDate time.Time   `bson:"create_date"`
	Name       string      `bson:"name"`
	Questions  []string    `bson:"questions"`
	UserId     string      `bson:"user_id"`
}

type mongoScoringNote struct {
	ID          bson.Binary `bson:"_id"`
	UserId      string      `bson:"user_id"`
	CreateDate  time.Time   `bson:"create_date"`
	LastUsed    time.Time   `bson:"last_used"`
	Name        string      `bson:"name"`
	Description string      `bson:"description"`
}

type mongoPlayer struct {
	ID         bson.Binary `bson:"_id"`
	CreateDate time.Time   `bson:"create_date"`
	TeamName   string      `bson:"team_name"`
	RealName   string      `bson:"real_name"`
	Icon       string      `bson:"icon"`
	SessionId  string      `bson:"session_id"` // mirror dropped in SQLite (migration 5); membership derives from session_player
}

type mongoSession struct {
	ID              bson.Binary          `bson:"_id"`
	CreateDate      time.Time            `bson:"create_date"`
	Name            string               `bson:"name"`
	GameId          string               `bson:"game_id"`
	Moderator       string               `bson:"mod"`
	Started         bool                 `bson:"started"`
	Rounds          []mongoRoundInGame   `bson:"rounds"`
	CurrentRound    *int                 `bson:"current_round"`
	CurrentQuestion *int                 `bson:"current_question"`
	Scoreboard      map[string][]float64 `bson:"scoreboard"` // key: player UUID; decoded for completeness, points derive from the answers (see importSessionScores)
	Players         []string             `bson:"players"`    // player UUIDs, join order
}

type mongoRoundInGame struct {
	RoundId   string                 `bson:"round_id"`
	Wagers    []int                  `bson:"wagers"`
	Questions []mongoQuestionInRound `bson:"questions"`
}

type mongoQuestionInRound struct {
	Category      string              `bson:"category"`
	Question      string              `bson:"question"`
	Answer        string              `bson:"answer"`
	PlayerAnswers map[string][]string `bson:"answers"` // key: player UUID -> answer UUIDs
	Scored        bool                `bson:"scored"`
	QuestionId    string              `bson:"question_id"`
	ScoringNote   string              `bson:"scoring_note"`    // description snapshot
	ScoringNoteId string              `bson:"scoring_note_id"` // note UUID
}

type mongoAnswer struct {
	ID            bson.Binary `bson:"_id"`
	CreateDate    time.Time   `bson:"create_date"`
	PlayerId      string      `bson:"player_id"`
	Answer        string      `bson:"answer"`
	Wager         int         `bson:"wager"`
	Correct       bool        `bson:"correct"`
	PointsAwarded float64     `bson:"points_awarded"`
}

type mongoSessionState struct {
	SessionId string      `bson:"session_id"` // plain UUID string, not binary
	State     bson.Binary `bson:"state"`      // subtype-3 UUID
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

// Summary reports what the import wrote. Skipped counts rows that could not
// be inserted because a referenced parent row was missing (something Mongo
// tolerated but the SQLite foreign keys forbid).
type Summary struct {
	Questions        int
	Rounds           int
	Games            int
	Collections      int
	ScoringNotes     int
	Players          int
	Sessions         int
	SessionPlayers   int
	SessionQuestions int
	SessionScores    int
	Answers          int
	SessionStates    int

	// ClearedNoteRefs counts question rows whose scoring_note pointed at a
	// missing note; the reference was imported as NULL (migration 6 behavior).
	ClearedNoteRefs int
	// OrphanAnswers counts answer documents not referenced by any session
	// document; they have no (session, round, question) to attach to.
	OrphanAnswers int
	// Skipped maps a table name to the number of rows dropped because their
	// FK parent was missing.
	Skipped map[string]int
}

// String renders the summary for the command's output.
func (s Summary) String() string {
	var b strings.Builder
	fmt.Fprintf(&b, "imported %d questions, %d rounds, %d games, %d collections, %d scoring notes\n",
		s.Questions, s.Rounds, s.Games, s.Collections, s.ScoringNotes)
	fmt.Fprintf(&b, "         %d players, %d sessions (%d session_players, %d session_questions, %d session_scores), %d answers, %d session states\n",
		s.Players, s.Sessions, s.SessionPlayers, s.SessionQuestions, s.SessionScores, s.Answers, s.SessionStates)
	if s.ClearedNoteRefs > 0 {
		fmt.Fprintf(&b, "cleared %d question->scoring_note reference(s) pointing at missing notes\n", s.ClearedNoteRefs)
	}
	if s.OrphanAnswers > 0 {
		fmt.Fprintf(&b, "skipped %d answer(s) not referenced by any session document\n", s.OrphanAnswers)
	}
	if len(s.Skipped) > 0 {
		tables := make([]string, 0, len(s.Skipped))
		for t := range s.Skipped {
			tables = append(tables, t)
		}
		sort.Strings(tables)
		for _, t := range tables {
			fmt.Fprintf(&b, "skipped %d %s row(s) referencing a missing parent\n", s.Skipped[t], t)
		}
	}
	return b.String()
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

// execer is the subset of *sql.Tx the importers write with (also satisfied by
// *sql.DB and *sql.Conn).
type execer interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
}

// docCursor is the subset of *mongo.Cursor the importers iterate, so tests can
// feed synthetic documents without a live MongoDB.
type docCursor interface {
	Next(ctx context.Context) bool
	Decode(v interface{}) error
	Err() error
}

// answerPlacement is where a session document's PlayerAnswers map says an
// answer document belongs — the (session, round, question, player) the
// mgo-era answer document itself never stored. last marks the final answer a
// player gave for a question (the one the scorer awarded points to); scored
// records whether the question was ever scored (only scored questions earn
// points).
type answerPlacement struct {
	sessionID string
	round     int
	question  int
	player    string
	last      bool
	scored    bool
}

// importer carries the per-run state: the running Summary, the answer
// placement map built while flattening sessions (answers import after
// sessions so the map is complete), and the per-round point totals derived
// from the scored answers (written after all answers are imported).
type importer struct {
	summary     Summary
	placement   map[string]answerPlacement
	roundPoints map[string]map[string]map[int]float64 // sessionID -> playerID -> round -> points
}

// importFn imports one raw document.
type importFn func(ctx context.Context, q execer, raw bson.Raw) error

// run iterates every document of a Mongo collection, feeding each to fn.
func (im *importer) run(ctx context.Context, tx *sql.Tx, coll *mongo.Collection, fn importFn) error {
	cur, err := coll.Find(ctx, bson.D{})
	if err != nil {
		return err
	}
	defer cur.Close(ctx)
	return eachDoc(ctx, cur, func(raw bson.Raw) error { return fn(ctx, tx, raw) })
}

func eachDoc(ctx context.Context, cur docCursor, fn func(bson.Raw) error) error {
	for cur.Next(ctx) {
		var raw bson.Raw
		if err := cur.Decode(&raw); err != nil {
			return err
		}
		if err := fn(raw); err != nil {
			return err
		}
	}
	return cur.Err()
}

// isFKViolation reports whether err is a SQLite FOREIGN KEY constraint
// failure (the only error the importers treat as "skip this row").
func isFKViolation(err error) bool {
	var se *sqlite.Error
	return errors.As(err, &se) && se.Code() == fkConstraint
}

// execSkipFK runs stmt; on an FK violation it records a skipped row for table
// and returns ok=false, so the caller can skip its bookkeeping. Any other
// error is returned as-is.
func execSkipFK(ctx context.Context, q execer, table string, s *Summary, stmt string, args ...interface{}) (bool, error) {
	if _, err := q.ExecContext(ctx, stmt, args...); err != nil {
		if isFKViolation(err) {
			s.Skipped[table]++
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Import copies every collection of the Mongo database src into db inside a
// single transaction. The target database must be empty (run CheckEmpty
// first); the import is all-or-nothing.
//
// Parent tables are imported before the rows that reference them, so the
// SQLite foreign keys resolve:
//
//	scoring_note, question, round, game, collection, player
//	then session (flattened into session / session_player /
//	session_question), answer, session_state,
//	then session_score (per-round totals derived from the scored answers).
func Import(ctx context.Context, db *sql.DB, src *mongo.Database) (Summary, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return Summary{}, err
	}
	defer tx.Rollback() //nolint:errcheck // no-op after a successful Commit

	im := &importer{
		summary:     Summary{Skipped: map[string]int{}},
		placement:   map[string]answerPlacement{},
		roundPoints: map[string]map[string]map[int]float64{},
	}

	for _, step := range []struct {
		collection string
		fn         importFn
	}{
		{"scoring_note", im.importScoringNote},
		{"question", im.importQuestion},
		{"round", im.importRound},
		{"game", im.importGame},
		{"collection", im.importCollectionRow},
		{"player", im.importPlayer},
		{"session", im.importSession},
		{"answer", im.importAnswer},
		{"session_state", im.importSessionState},
	} {
		if err := im.run(ctx, tx, src.Collection(step.collection), step.fn); err != nil {
			return im.summary, fmt.Errorf("import %s collection: %w", step.collection, err)
		}
	}

	// session_score is not a Mongo collection: the rows are derived from the
	// answers' points_awarded, so they are written after every answer lands.
	if err := im.importSessionScores(ctx, tx); err != nil {
		return im.summary, fmt.Errorf("import session_score: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return im.summary, err
	}
	return im.summary, nil
}

// ---------------------------------------------------------------------------
// Per-type importers
// ---------------------------------------------------------------------------

func (im *importer) importScoringNote(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoScoringNote
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("scoring_note: %w", err)
	}
	if _, err := q.ExecContext(ctx, `INSERT INTO scoring_note (id, user_id, create_date, last_used, name, description)
		VALUES (?, ?, ?, ?, ?, ?)`,
		id, d.UserId, formatTime(d.CreateDate), formatTime(d.LastUsed), d.Name, d.Description); err != nil {
		return err
	}
	im.summary.ScoringNotes++
	return nil
}

func (im *importer) importQuestion(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoQuestion
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("question: %w", err)
	}

	// scoring_note_id is a nullable FK column where NULL — not '' — is the
	// "no note" sentinel. If the note is missing (dangling reference the old
	// Mongo tolerated), import the question with the reference cleared —
	// exactly what migration 6 does for pre-existing SQLite data.
	note := interface{}(nil)
	if d.ScoringNote != "" {
		note = d.ScoringNote
	}
	_, err = q.ExecContext(ctx, `INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.Category, d.Question, d.Answer, d.UserId, note)
	if err != nil {
		if !isFKViolation(err) {
			return err
		}
		if _, err := q.ExecContext(ctx, `INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note_id)
			VALUES (?, ?, ?, ?, ?, ?, NULL)`,
			id, formatTime(d.CreateDate), d.Category, d.Question, d.Answer, d.UserId); err != nil {
			return err
		}
		im.summary.ClearedNoteRefs++
	}
	im.summary.Questions++
	return nil
}

func (im *importer) importRound(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoRound
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("round: %w", err)
	}
	if _, err := q.ExecContext(ctx, `INSERT INTO round (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.Name, d.UserId); err != nil {
		return err
	}
	for i, questionId := range d.Questions {
		if _, err := execSkipFK(ctx, q, "round_question", &im.summary,
			`INSERT INTO round_question (round_id, question_id, position) VALUES (?, ?, ?)`,
			id, questionId, i); err != nil {
			return err
		}
	}
	for i, wager := range d.Wagers {
		if _, err := q.ExecContext(ctx, `INSERT INTO round_wager (round_id, position, wager) VALUES (?, ?, ?)`,
			id, i, wager); err != nil {
			return err
		}
	}
	im.summary.Rounds++
	return nil
}

func (im *importer) importGame(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoGame
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("game: %w", err)
	}
	if _, err := q.ExecContext(ctx, `INSERT INTO game (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.Name, d.UserId); err != nil {
		return err
	}
	for i, roundId := range d.Rounds {
		if _, err := execSkipFK(ctx, q, "game_round", &im.summary,
			`INSERT INTO game_round (game_id, round_id, position) VALUES (?, ?, ?)`,
			id, roundId, i); err != nil {
			return err
		}
	}
	// RoundNames is a map: no ordering to preserve, and the PK is
	// (game_id, round_id).
	for roundId, name := range d.RoundNames {
		if _, err := execSkipFK(ctx, q, "game_round_name", &im.summary,
			`INSERT INTO game_round_name (game_id, round_id, name) VALUES (?, ?, ?)`,
			id, roundId, name); err != nil {
			return err
		}
	}
	im.summary.Games++
	return nil
}

func (im *importer) importCollectionRow(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoCollection
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("collection: %w", err)
	}
	if _, err := q.ExecContext(ctx, `INSERT INTO collection (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.Name, d.UserId); err != nil {
		return err
	}
	for i, questionId := range d.Questions {
		if _, err := execSkipFK(ctx, q, "collection_question", &im.summary,
			`INSERT INTO collection_question (collection_id, question_id, position) VALUES (?, ?, ?)`,
			id, questionId, i); err != nil {
			return err
		}
	}
	im.summary.Collections++
	return nil
}

func (im *importer) importPlayer(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoPlayer
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("player: %w", err)
	}
	if _, err := q.ExecContext(ctx, `INSERT INTO player (id, create_date, team_name, real_name, icon)
		VALUES (?, ?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.TeamName, d.RealName, d.Icon); err != nil {
		return err
	}
	im.summary.Players++
	return nil
}

// importSession flattens one session document into the session,
// session_player, and session_question tables, and records where each of its
// answers belongs (for importAnswer). session_score rows are derived from the
// answers by importSessionScores, which runs after every answer lands.
func (im *importer) importSession(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoSession
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("session: %w", err)
	}

	var currentRound, currentQuestion interface{}
	if d.CurrentRound != nil {
		currentRound = *d.CurrentRound
	}
	if d.CurrentQuestion != nil {
		currentQuestion = *d.CurrentQuestion
	}
	// session.game_id and session.moderator_id deliberately have no
	// REFERENCES clause (gameplay data must survive editor deletions), so
	// this insert cannot fail on a missing game or moderator.
	if _, err := q.ExecContext(ctx, `INSERT INTO session (id, create_date, name, game_id, moderator_id, started,
		current_round, current_question)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), d.Name, d.GameId, d.Moderator, boolToInt(d.Started),
		currentRound, currentQuestion); err != nil {
		return err
	}

	// session_player: the session's Players list, in join order. (The
	// moderator is a player record but not a member of the session.)
	for i, playerId := range d.Players {
		ok, err := execSkipFK(ctx, q, "session_player", &im.summary,
			`INSERT INTO session_player (session_id, player_id, position) VALUES (?, ?, ?)`,
			id, playerId, i)
		if err != nil {
			return err
		}
		if ok {
			im.summary.SessionPlayers++
		}
	}

	// session_question snapshots + answer placement. The Mongo document only
	// holds questions that were materialized when the round was set; every one
	// of them becomes a snapshot row, exactly as the SQLite-era server writes
	// when a question is set. The final answer each player gave for a scored
	// question is what earned points (see importAnswer / importSessionScores).
	for r, round := range d.Rounds {
		for qi, qInRound := range round.Questions {
			ok, err := execSkipFK(ctx, q, "session_question", &im.summary,
				`INSERT INTO session_question (session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scored, scoring_note)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				id, r, qi, qInRound.QuestionId, qInRound.Category, qInRound.Question,
				qInRound.Answer, qInRound.ScoringNoteId, boolToInt(qInRound.Scored), qInRound.ScoringNote)
			if err != nil {
				return err
			}
			if ok {
				im.summary.SessionQuestions++
			}
			for playerId, answerIds := range qInRound.PlayerAnswers {
				for i, answerId := range answerIds {
					im.placement[answerId] = answerPlacement{
						sessionID: id, round: r, question: qi, player: playerId,
						last:   i == len(answerIds)-1,
						scored: qInRound.Scored,
					}
				}
			}
		}
	}

	im.summary.Sessions++
	return nil
}

// importAnswer places one answer document using the placement recorded from
// the session documents (the mgo-era answer never stored its session or
// indices). An answer not referenced by any session is an orphan — its
// session was deleted — and cannot be attached to anything, so it is counted
// and skipped.
//
// The final answer each player gave for a scored question carries that
// question's points (the scorer wrote them onto the answer document), so it
// is accumulated here into the player's round total for importSessionScores.
func (im *importer) importAnswer(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoAnswer
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	id, err := uuidFromBinary(d.ID)
	if err != nil {
		return fmt.Errorf("answer: %w", err)
	}
	p, ok := im.placement[id]
	if !ok {
		im.summary.OrphanAnswers++
		return nil
	}
	ok2, err := execSkipFK(ctx, q, "answer", &im.summary,
		`INSERT INTO answer (id, create_date, session_id, round_index, question_index,
		player_id, answer, wager, correct, points_awarded)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, formatTime(d.CreateDate), p.sessionID, p.round, p.question,
		p.player, d.Answer, d.Wager, boolToInt(d.Correct), d.PointsAwarded)
	if err != nil {
		return err
	}
	if ok2 {
		im.summary.Answers++
		if p.last && p.scored {
			if im.roundPoints[p.sessionID] == nil {
				im.roundPoints[p.sessionID] = map[string]map[int]float64{}
			}
			if im.roundPoints[p.sessionID][p.player] == nil {
				im.roundPoints[p.sessionID][p.player] = map[int]float64{}
			}
			im.roundPoints[p.sessionID][p.player][p.round] += d.PointsAwarded
		}
	}
	return nil
}

// importSessionScores writes the session_score rows (one per player per
// scored round) from the per-round totals accumulated in importAnswer.
//
// The Mongo scoreboard document stored one entry per *scored* question,
// appended in scoring order, so it has no slot for a question the moderator
// skipped — position in that array is not a reliable question index. The
// answers are exact: each scored question's final answer holds its
// points_awarded, so per-round totals are derived from them instead. A round
// only gets a row once at least one of its questions was scored (an all-wrong
// round still earns a zero row, matching the old scoreboard, which recorded a
// zero for every player on every scored question).
func (im *importer) importSessionScores(ctx context.Context, q execer) error {
	for sessionID, byPlayer := range im.roundPoints {
		for player, byRound := range byPlayer {
			for round, points := range byRound {
				ok, err := execSkipFK(ctx, q, "session_score", &im.summary,
					`INSERT INTO session_score (session_id, player_id, round_index, points) VALUES (?, ?, ?, ?)`,
					sessionID, player, round, points)
				if err != nil {
					return err
				}
				if ok {
					im.summary.SessionScores++
				}
			}
		}
	}
	return nil
}

func (im *importer) importSessionState(ctx context.Context, q execer, raw bson.Raw) error {
	var d mongoSessionState
	if err := bson.Unmarshal(raw, &d); err != nil {
		return err
	}
	state, err := uuidFromBinary(d.State)
	if err != nil {
		return fmt.Errorf("session_state: %w", err)
	}
	ok, err := execSkipFK(ctx, q, "session_state", &im.summary,
		`INSERT INTO session_state (session_id, state) VALUES (?, ?)`, d.SessionId, state)
	if err != nil {
		return err
	}
	if ok {
		im.summary.SessionStates++
	}
	return nil
}

// ---------------------------------------------------------------------------
// Empty-target guard
// ---------------------------------------------------------------------------

// allTables lists every table the import writes. The empty check covers them
// all so a database that has any trivia data at all — even a lone player — is
// refused rather than merged into.
var allTables = []string{
	"question", "round", "round_question", "round_wager",
	"game", "game_round", "game_round_name",
	"collection", "collection_question",
	"scoring_note", "player",
	"session", "session_player", "session_question", "session_score",
	"answer", "session_state",
}

// CheckEmpty returns an error if any table in db already holds rows. The
// import refuses to run against such a database — no silent merge.
func CheckEmpty(db *sql.DB) error {
	for _, table := range allTables {
		var n int
		if err := db.QueryRow("SELECT COUNT(*) FROM " + table).Scan(&n); err != nil {
			return fmt.Errorf("check %s: %w", table, err)
		}
		if n > 0 {
			return fmt.Errorf("target database is not empty: table %q already has %d row(s); refusing to merge", table, n)
		}
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
