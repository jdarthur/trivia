package common

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/jdarthur/trivia/models"
	"net/http"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"time"

	sqlite "modernc.org/sqlite"
)

var QuestionTable = "question"
var RoundTable = "round"
var GameTable = "game"
var SessionTable = "session"
var PlayerTable = "player"
var AnswerTable = "answer"
var SessionStateTable = "session_state"
var CollectionTable = "collection"
var ScoringNoteTable = "scoring_note"

type Env struct {
	Db *sql.DB
}

//=====================================
//=====================================
//           Custom Errors
//=====================================
//=====================================

// InvalidDataError is an interface to implement when a particular
// record type has to enforce specific rules on its own fields.
//
// For example, indirectly-set fields (such as models.Question's
// RoundsUsed) are not able to be set in the create/update endpoints
// for that data type (instead, that RoundsUsed field is derived from
// the question's round_question membership rows)
type InvalidDataError interface {
	Field() string
	Data() interface{}
	Error() string
}

func InvalidDataErrorToString(e InvalidDataError, message string) string {
	return fmt.Sprintf("Invalid data error: field: %s, data: %v, error: %s", e.Field(), e.Data(), message)
}

// NonexistentIdError is thrown when record of type RecordType with ID is not found
type NonexistentIdError struct {
	ID         string // valid UUID
	RecordType string // record type, e.g. QuestionTable or RoundTable
}

func (e NonexistentIdError) Error() string {
	return "Invalid " + e.RecordType + " ID: " + e.ID
}

// InvalidUUIDError is thrown when attempting to
// convert an invalid UUID string to a binary ID.
// Retained for API compatibility: with UUIDs stored as plain strings,
// an invalid UUID simply fails the lookup instead.
type InvalidUUIDError struct {
	ID string // UUID that is invalid
}

func (e InvalidUUIDError) Error() string {
	return "Invalid UUID: " + e.ID
}

// M is a filter map, the SQLite-era replacement for bson.M in handlers.
type M map[string]interface{}

// RegEx is a case-insensitive substring match, the SQLite-era replacement
// for bson.RegEx in handlers (evaluated by the regexp_like SQL function,
// preserving Go regexp semantics).
type RegEx struct {
	Pattern string
	Options string
}

//=====================================
//=====================================
//           DB Methods
//=====================================
//=====================================

// timestamps are stored as TEXT in the API's historical output format
const timeFormat = "2006-01-02T15:04:05.000000"

func formatTime(t time.Time) string {
	return t.Format(timeFormat)
}

// ParseTime converts a stored timestamp string (the API's historical
// UTC-naive "2006-01-02T15:04:05.000000" format) back into a time.Time. It
// tolerates RFC3339 timestamps in case a column ever holds one, otherwise
// falls back to the zero time.
func ParseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse(timeFormat, s); err == nil {
		return t
	}
	// Tolerate RFC3339 timestamps (Go's default JSON marshal format) in case
	// the column ever holds one; otherwise fall back to the zero time.
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	return time.Time{}
}

func intPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// stringValue converts a Push/Pull value (a plain string or a defined
// string type such as models.PlayerId) to a string.
func stringValue(v interface{}) string {
	rv := reflect.ValueOf(v)
	for rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}
	if rv.Kind() == reflect.String {
		return rv.String()
	}
	return fmt.Sprintf("%v", v)
}

// nilIfEmpty maps an empty string to NULL. question.scoring_note_id is a
// nullable FK column (ticket #85) where NULL — not '' — is the "no note"
// sentinel; the API wire format keeps the historical empty string.
func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// deref returns the value behind any pointer chain.
func deref(data interface{}) interface{} {
	v := reflect.ValueOf(data)
	for v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	return v.Interface()
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

// GetOne record of a certain type by ID
//
// args:
//	  e: Environment (i.e. SQLite database)
//	  objectType: table (e.g. 'question' or 'round')
//	  objectId: id of record in UUID form
//	  model: struct representing data model e.g. models.Question
//		    --> this struct must be passed as pointer and is updated in place
// returns errors (if any):
//    NonexistentIdError: if record
func GetOne(e *Env, objectType string, objectId string, model models.Object) error {
	switch m := model.(type) {
	case *models.Question:
		return getQuestion(e.Db, objectId, m)
	case *models.Round:
		return getRound(e.Db, objectId, m)
	case *models.Game:
		return getGame(e.Db, objectId, m)
	case *models.Session:
		return getSession(e.Db, objectId, m)
	case *models.Player:
		return getPlayer(e.Db, objectId, m)
	case *models.Answer:
		return getAnswer(e.Db, objectId, m)
	case *models.Collection:
		return getCollection(e.Db, objectId, m)
	case *models.ScoringNote:
		return getScoringNote(e.Db, objectId, m)
	default:
		return errors.New("invalid get one type: " + objectType)
	}
}

func scanQuestion(s rowScanner) (models.Question, error) {
	var m models.Question
	var createDate string
	var scoringNoteId sql.NullString
	err := s.Scan(&m.ID, &createDate, &m.Category, &m.Question, &m.Answer, &m.UserId, &scoringNoteId)
	if err != nil {
		return m, err
	}
	m.CreateDate = ParseTime(createDate)
	m.RoundsUsed = make([]string, 0)
	// scoring_note_id is a nullable FK column; NULL surfaces as the
	// wire-format empty string.
	if scoringNoteId.Valid {
		m.ScoringNote = scoringNoteId.String
	}
	return m, nil
}

// loadQuestionRoundsUsed fills a question's derived RoundsUsed from the
// round_question join table — the rounds_used JSON mirror is gone (migration
// 4, ticket #83). Same pattern as loadRound deriving Round.Games from
// game_round.
func loadQuestionRoundsUsed(db *sql.DB, m *models.Question) error {
	m.RoundsUsed = make([]string, 0)
	rows, err := db.Query(`SELECT round_id FROM round_question WHERE question_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var roundId string
		if err := rows.Scan(&roundId); err != nil {
			return err
		}
		m.RoundsUsed = append(m.RoundsUsed, roundId)
	}
	return rows.Err()
}

func getQuestion(db *sql.DB, id string, m *models.Question) error {
	row := db.QueryRow(`SELECT id, create_date, category, question, answer, user_id, scoring_note_id
		FROM question WHERE id = ?`, id)
	got, err := scanQuestion(row)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: QuestionTable, ID: id}
	}
	if err != nil {
		return err
	}
	if err := loadQuestionRoundsUsed(db, &got); err != nil {
		return err
	}
	*m = got
	return nil
}

// loadRound fills a round's derived lists (questions, wagers, games) from the
// join tables. Round.Games is read-only here — it is maintained by the games API.
func loadRound(db *sql.DB, m *models.Round) error {
	m.Questions = make([]string, 0)
	rows, err := db.Query(`SELECT question_id FROM round_question WHERE round_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var q string
		if err := rows.Scan(&q); err != nil {
			return err
		}
		m.Questions = append(m.Questions, q)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	m.Wagers = make([]int, 0)
	rows, err = db.Query(`SELECT wager FROM round_wager WHERE round_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var w int
		if err := rows.Scan(&w); err != nil {
			return err
		}
		m.Wagers = append(m.Wagers, w)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	m.Games = make([]string, 0)
	rows, err = db.Query(`SELECT game_id FROM game_round WHERE round_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var g string
		if err := rows.Scan(&g); err != nil {
			return err
		}
		m.Games = append(m.Games, g)
	}
	return rows.Err()
}

func getRound(db *sql.DB, id string, m *models.Round) error {
	var createDate string
	err := db.QueryRow(`SELECT id, create_date, name, user_id FROM round WHERE id = ?`, id).
		Scan(&m.ID, &createDate, &m.Name, &m.UserId)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: RoundTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	return loadRound(db, m)
}

func loadGame(db *sql.DB, m *models.Game) error {
	m.Rounds = make([]string, 0)
	rows, err := db.Query(`SELECT round_id FROM game_round WHERE game_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var r string
		if err := rows.Scan(&r); err != nil {
			return err
		}
		m.Rounds = append(m.Rounds, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	m.RoundNames = make(map[string]string)
	rows, err = db.Query(`SELECT round_id, name FROM game_round_name WHERE game_id = ?`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var roundId, name string
		if err := rows.Scan(&roundId, &name); err != nil {
			return err
		}
		m.RoundNames[roundId] = name
	}
	return rows.Err()
}

func getGame(db *sql.DB, id string, m *models.Game) error {
	var createDate string
	err := db.QueryRow(`SELECT id, create_date, name, user_id FROM game WHERE id = ?`, id).
		Scan(&m.ID, &createDate, &m.Name, &m.UserId)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: GameTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	return loadGame(db, m)
}

func scanSession(s rowScanner) (models.Session, error) {
	var m models.Session
	var createDate, moderatorId string
	var started int
	var curRound, curQuestion sql.NullInt64
	err := s.Scan(&m.ID, &createDate, &m.Name, &m.GameId, &moderatorId, &started,
		&curRound, &curQuestion)
	if err != nil {
		return m, err
	}
	m.CreateDate = ParseTime(createDate)
	m.Moderator = models.PlayerId(moderatorId)
	m.Started = started == 1
	m.CurrentRound = intPtr(curRound)
	m.CurrentQuestion = intPtr(curQuestion)
	return m, nil
}

// loadSessionRelations fills a session's derived lists from the relational
// tables (the session-port ticket #76):
//
//   - Rounds: the game's round/question structure (round ids, wagers,
//     categories) with the session_question snapshot rows overlaid, so a
//     session read returns the same shape the old JSON document held.
//   - Players: the session_player membership join, ordered by position.
//   - Scoreboard: the session_score rows, grouped per player by round index.
//
// A missing game, round, or question does not fail the session read — the
// session is returned with whatever structure can still be derived (the old
// document stored this structure denormalized, so it survived editor
// deletions; the relational view degrades gracefully instead of 404ing).
func loadSessionRelations(db *sql.DB, m *models.Session) error {
	if err := loadSessionRounds(db, m); err != nil {
		return err
	}
	if err := loadSessionPlayers(db, m); err != nil {
		return err
	}
	return loadSessionScoreboard(db, m)
}

func loadSessionRounds(db *sql.DB, m *models.Session) error {
	m.Rounds = make([]models.RoundInGame, 0)
	if m.GameId == "" {
		return nil
	}

	var game models.Game
	if err := getGame(db, m.GameId, &game); err != nil {
		// No game (deleted or dangling game_id): nothing to derive.
		return nil
	}

	for _, roundId := range game.Rounds {
		var round models.Round
		if err := getRound(db, roundId, &round); err != nil {
			continue
		}

		roundInGame := models.RoundInGame{
			RoundId:   roundId,
			Wagers:    round.Wagers,
			Questions: make([]models.QuestionInRound, 0, len(round.Questions)),
		}
		for i, questionId := range round.Questions {
			var q models.Question
			if err := getQuestion(db, questionId, &q); err != nil {
				continue
			}
			roundInGame.Questions = append(roundInGame.Questions, models.QuestionInRound{
				Category:   q.Category,
				QuestionId: questionId,
				Index:      i,
			})
		}
		m.Rounds = append(m.Rounds, roundInGame)
	}

	// Overlay the per-question snapshots taken at set/score/hot-edit time.
	rows, err := db.Query(`SELECT round_index, question_index, question_id, category,
		question, answer, scoring_note_id, scoring_note, scored
		FROM session_question WHERE session_id = ?`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var roundIndex, questionIndex int
		var questionId, category, question, answer, scoringNoteId, scoringNote string
		var scored int
		if err := rows.Scan(&roundIndex, &questionIndex, &questionId, &category,
			&question, &answer, &scoringNoteId, &scoringNote, &scored); err != nil {
			return err
		}
		if roundIndex >= len(m.Rounds) || questionIndex >= len(m.Rounds[roundIndex].Questions) {
			continue
		}
		q := &m.Rounds[roundIndex].Questions[questionIndex]
		q.QuestionId = questionId
		q.Category = category
		q.Question = question
		q.Answer = answer
		q.ScoringNoteId = scoringNoteId
		q.ScoringNote = scoringNote
		q.Scored = scored == 1
	}
	return rows.Err()
}

func loadSessionPlayers(db *sql.DB, m *models.Session) error {
	m.Players = make([]models.PlayerId, 0)
	rows, err := db.Query(`SELECT player_id FROM session_player
		WHERE session_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var playerId string
		if err := rows.Scan(&playerId); err != nil {
			return err
		}
		m.Players = append(m.Players, models.PlayerId(playerId))
	}
	return rows.Err()
}

func loadSessionScoreboard(db *sql.DB, m *models.Session) error {
	m.Scoreboard = make(map[models.PlayerId][]float64)
	rows, err := db.Query(`SELECT player_id, points FROM session_score
		WHERE session_id = ? ORDER BY player_id, round_index`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var playerId string
		var points float64
		if err := rows.Scan(&playerId, &points); err != nil {
			return err
		}
		m.Scoreboard[models.PlayerId(playerId)] = append(m.Scoreboard[models.PlayerId(playerId)], points)
	}
	return rows.Err()
}

func getSession(db *sql.DB, id string, m *models.Session) error {
	row := db.QueryRow(`SELECT id, create_date, name, game_id, moderator_id, started,
		current_round, current_question
		FROM session WHERE id = ?`, id)
	got, err := scanSession(row)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: SessionTable, ID: id}
	}
	if err != nil {
		return err
	}
	if err := loadSessionRelations(db, &got); err != nil {
		return err
	}
	*m = got
	return nil
}

func getPlayer(db *sql.DB, id string, m *models.Player) error {
	var createDate string
	err := db.QueryRow(`SELECT id, create_date, team_name, real_name, icon
		FROM player WHERE id = ?`, id).
		Scan(&m.ID, &createDate, &m.TeamName, &m.RealName, &m.Icon)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: PlayerTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	return nil
}

func getAnswer(db *sql.DB, id string, m *models.Answer) error {
	var createDate string
	var roundIndex, questionIndex sql.NullInt64
	var playerId string
	var correct int
	err := db.QueryRow(`SELECT id, create_date, session_id, round_index, question_index, player_id,
		answer, wager, correct, points_awarded FROM answer WHERE id = ?`, id).
		Scan(&m.ID, &createDate, &m.SessionId, &roundIndex, &questionIndex, &playerId,
			&m.Answer, &m.Wager, &correct, &m.PointsAwarded)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: AnswerTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	m.RoundIndex = intPtr(roundIndex)
	m.QuestionIndex = intPtr(questionIndex)
	m.PlayerId = models.PlayerId(playerId)
	m.Correct = correct == 1
	return nil
}

func loadCollection(db *sql.DB, m *models.Collection) error {
	m.Questions = make([]string, 0)
	rows, err := db.Query(`SELECT question_id FROM collection_question WHERE collection_id = ? ORDER BY position`, m.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var q string
		if err := rows.Scan(&q); err != nil {
			return err
		}
		m.Questions = append(m.Questions, q)
	}
	return rows.Err()
}

func getCollection(db *sql.DB, id string, m *models.Collection) error {
	var createDate string
	err := db.QueryRow(`SELECT id, create_date, name, user_id FROM collection WHERE id = ?`, id).
		Scan(&m.ID, &createDate, &m.Name, &m.UserId)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: CollectionTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	return loadCollection(db, m)
}

func getScoringNote(db *sql.DB, id string, m *models.ScoringNote) error {
	var createDate, lastUsed string
	err := db.QueryRow(`SELECT id, user_id, create_date, last_used, name, description
		FROM scoring_note WHERE id = ?`, id).
		Scan(&m.ID, &m.UserId, &createDate, &lastUsed, &m.Name, &m.Description)
	if errors.Is(err, sql.ErrNoRows) {
		return NonexistentIdError{RecordType: ScoringNoteTable, ID: id}
	}
	if err != nil {
		return err
	}
	m.CreateDate = ParseTime(createDate)
	m.LastUsed = ParseTime(lastUsed)
	return nil
}

// Create a record
//
// args:
//	  e: Environment (i.e. SQLite database)
//	  objectType: table (e.g. 'question' or 'round')
//	  model: struct representing data model e.g. models.Question
//		    --> this struct must be passed as pointer and is updated in place
// returns:
//    newly generated ID, create date, errors (if any)
func Create(e *Env, objectType string, data models.Object) (string, time.Time, error) {

	//create date for this object is rn
	createDate := time.Now()

	//create a UUID for new object
	id := uuid.New().String()
	data = data.SetId(id)
	data = data.SetCreateDate(createDate)

	var err error
	switch m := deref(data).(type) {
	case models.Question:
		err = insertQuestion(e.Db, m)
	case models.Round:
		err = insertRound(e.Db, m)
	case models.Game:
		err = insertGame(e.Db, m)
	case models.Session:
		err = insertSession(e.Db, m)
	case models.Player:
		err = insertPlayer(e.Db, m)
	case models.Answer:
		err = insertAnswer(e.Db, m)
	case models.Collection:
		err = insertCollection(e.Db, m)
	case models.ScoringNote:
		err = insertScoringNote(e.Db, m)
	default:
		err = errors.New("invalid create type: " + objectType)
	}
	if err != nil {
		return "", time.Time{}, err
	}
	return id, createDate, nil
}

func insertQuestion(db *sql.DB, m models.Question) error {
	_, err := db.Exec(`INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.Category, m.Question, m.Answer, m.UserId, nilIfEmpty(m.ScoringNote))
	return err
}

func insertRound(db *sql.DB, m models.Round) error {
	if _, err := db.Exec(`INSERT INTO round (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.Name, m.UserId); err != nil {
		return err
	}
	for i, questionId := range m.Questions {
		if _, err := db.Exec(`INSERT INTO round_question (round_id, question_id, position) VALUES (?, ?, ?)`,
			m.ID, questionId, i); err != nil {
			return err
		}
	}
	for i, wager := range m.Wagers {
		if _, err := db.Exec(`INSERT INTO round_wager (round_id, position, wager) VALUES (?, ?, ?)`,
			m.ID, i, wager); err != nil {
			return err
		}
	}
	return nil
}

func insertGame(db *sql.DB, m models.Game) error {
	if _, err := db.Exec(`INSERT INTO game (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.Name, m.UserId); err != nil {
		return err
	}
	for i, roundId := range m.Rounds {
		if _, err := db.Exec(`INSERT INTO game_round (game_id, round_id, position) VALUES (?, ?, ?)`,
			m.ID, roundId, i); err != nil {
			return err
		}
	}
	for roundId, name := range m.RoundNames {
		if _, err := db.Exec(`INSERT INTO game_round_name (game_id, round_id, name) VALUES (?, ?, ?)`,
			m.ID, roundId, name); err != nil {
			return err
		}
	}
	return nil
}

func insertSession(db *sql.DB, m models.Session) error {
	var currentRound, currentQuestion interface{}
	if m.CurrentRound != nil {
		currentRound = *m.CurrentRound
	}
	if m.CurrentQuestion != nil {
		currentQuestion = *m.CurrentQuestion
	}
	_, err := db.Exec(`INSERT INTO session (id, create_date, name, game_id, moderator_id, started,
		current_round, current_question)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.Name, m.GameId, string(m.Moderator), boolToInt(m.Started),
		currentRound, currentQuestion)
	return err
}

func insertPlayer(db *sql.DB, m models.Player) error {
	_, err := db.Exec(`INSERT INTO player (id, create_date, team_name, real_name, icon)
		VALUES (?, ?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.TeamName, m.RealName, m.Icon)
	return err
}

func insertAnswer(db *sql.DB, m models.Answer) error {
	var roundIndex, questionIndex interface{}
	if m.RoundIndex != nil {
		roundIndex = *m.RoundIndex
	}
	if m.QuestionIndex != nil {
		questionIndex = *m.QuestionIndex
	}
	_, err := db.Exec(`INSERT INTO answer (id, create_date, session_id, round_index, question_index,
		player_id, answer, wager, correct, points_awarded)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.SessionId, roundIndex, questionIndex,
		string(m.PlayerId), m.Answer, m.Wager, boolToInt(m.Correct), m.PointsAwarded)
	return err
}

func insertCollection(db *sql.DB, m models.Collection) error {
	if _, err := db.Exec(`INSERT INTO collection (id, create_date, name, user_id) VALUES (?, ?, ?, ?)`,
		m.ID, formatTime(m.CreateDate), m.Name, m.UserId); err != nil {
		return err
	}
	for i, questionId := range m.Questions {
		if _, err := db.Exec(`INSERT INTO collection_question (collection_id, question_id, position) VALUES (?, ?, ?)`,
			m.ID, questionId, i); err != nil {
			return err
		}
	}
	return nil
}

func insertScoringNote(db *sql.DB, m models.ScoringNote) error {
	_, err := db.Exec(`INSERT INTO scoring_note (id, user_id, create_date, last_used, name, description)
		VALUES (?, ?, ?, ?, ?, ?)`,
		m.ID, m.UserId, formatTime(m.CreateDate), formatTime(m.LastUsed), m.Name, m.Description)
	return err
}

// update a record by ID
//
// args:
//	  e: Environment (i.e. SQLite database)
//	  objectType: table (e.g. 'question' or 'round')
//    objectId: ID of record in UUID form
//    data: struct whose fields to set on record
// returns:
//    errors (if any)
func Set(e *Env, objectType string, objectId string, data interface{}) error {
	var err error
	switch m := deref(data).(type) {
	case models.Question:
		err = updateQuestion(e.Db, objectId, m)
	case models.Round:
		err = updateRound(e.Db, objectId, m)
	case models.Game:
		err = updateGame(e.Db, objectId, m)
	case models.Session:
		err = updateSession(e.Db, objectId, m)
	case models.Player:
		err = updatePlayer(e.Db, objectId, m)
	case models.Answer:
		err = updateAnswer(e.Db, objectId, m)
	case models.Collection:
		err = updateCollection(e.Db, objectId, m)
	case models.ScoringNote:
		err = updateScoringNote(e.Db, objectId, m)
	default:
		err = errors.New("invalid set type: " + objectType)
	}
	return err
}

// rowsAffected reports whether the UPDATE/DELETE matched a row, mapping a miss
// to NonexistentIdError like mgo's UpdateId/RemoveId did.
func rowsAffected(res sql.Result, err error, objectType string, objectId string) error {
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return NonexistentIdError{RecordType: objectType, ID: objectId}
	}
	return nil
}

func updateQuestion(db *sql.DB, id string, m models.Question) error {
	res, err := db.Exec(`UPDATE question SET category = ?, question = ?, answer = ?, user_id = ?,
		scoring_note_id = ? WHERE id = ?`,
		m.Category, m.Question, m.Answer, m.UserId, nilIfEmpty(m.ScoringNote), id)
	return rowsAffected(res, err, QuestionTable, id)
}

func updateRound(db *sql.DB, id string, m models.Round) error {
	res, err := db.Exec(`UPDATE round SET name = ?, user_id = ? WHERE id = ?`, m.Name, m.UserId, id)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return rowsAffected(res, err, RoundTable, id)
	}

	//questions and wagers are replaced wholesale from the model
	if _, err := db.Exec(`DELETE FROM round_question WHERE round_id = ?`, id); err != nil {
		return err
	}
	for i, questionId := range m.Questions {
		if _, err := db.Exec(`INSERT INTO round_question (round_id, question_id, position) VALUES (?, ?, ?)`,
			id, questionId, i); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`DELETE FROM round_wager WHERE round_id = ?`, id); err != nil {
		return err
	}
	for i, wager := range m.Wagers {
		if _, err := db.Exec(`INSERT INTO round_wager (round_id, position, wager) VALUES (?, ?, ?)`,
			id, i, wager); err != nil {
			return err
		}
	}
	return nil
}

func updateGame(db *sql.DB, id string, m models.Game) error {
	res, err := db.Exec(`UPDATE game SET name = ?, user_id = ? WHERE id = ?`, m.Name, m.UserId, id)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return rowsAffected(res, err, GameTable, id)
	}

	if _, err := db.Exec(`DELETE FROM game_round WHERE game_id = ?`, id); err != nil {
		return err
	}
	for i, roundId := range m.Rounds {
		if _, err := db.Exec(`INSERT INTO game_round (game_id, round_id, position) VALUES (?, ?, ?)`,
			id, roundId, i); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`DELETE FROM game_round_name WHERE game_id = ?`, id); err != nil {
		return err
	}
	for roundId, name := range m.RoundNames {
		if _, err := db.Exec(`INSERT INTO game_round_name (game_id, round_id, name) VALUES (?, ?, ?)`,
			id, roundId, name); err != nil {
			return err
		}
	}
	return nil
}

func updateSession(db *sql.DB, id string, m models.Session) error {
	var currentRound, currentQuestion interface{}
	if m.CurrentRound != nil {
		currentRound = *m.CurrentRound
	}
	if m.CurrentQuestion != nil {
		currentQuestion = *m.CurrentQuestion
	}
	res, err := db.Exec(`UPDATE session SET name = ?, game_id = ?, moderator_id = ?, started = ?,
		current_round = ?, current_question = ? WHERE id = ?`,
		m.Name, m.GameId, string(m.Moderator), boolToInt(m.Started),
		currentRound, currentQuestion, id)
	return rowsAffected(res, err, SessionTable, id)
}

func updatePlayer(db *sql.DB, id string, m models.Player) error {
	res, err := db.Exec(`UPDATE player SET team_name = ?, real_name = ?, icon = ? WHERE id = ?`,
		m.TeamName, m.RealName, m.Icon, id)
	return rowsAffected(res, err, PlayerTable, id)
}

func updateAnswer(db *sql.DB, id string, m models.Answer) error {
	var roundIndex, questionIndex interface{}
	if m.RoundIndex != nil {
		roundIndex = *m.RoundIndex
	}
	if m.QuestionIndex != nil {
		questionIndex = *m.QuestionIndex
	}
	res, err := db.Exec(`UPDATE answer SET player_id = ?, answer = ?, wager = ?, correct = ?,
		points_awarded = ?, round_index = ?, question_index = ? WHERE id = ?`,
		string(m.PlayerId), m.Answer, m.Wager, boolToInt(m.Correct), m.PointsAwarded,
		roundIndex, questionIndex, id)
	return rowsAffected(res, err, AnswerTable, id)
}

func updateCollection(db *sql.DB, id string, m models.Collection) error {
	res, err := db.Exec(`UPDATE collection SET name = ?, user_id = ? WHERE id = ?`, m.Name, m.UserId, id)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return rowsAffected(res, err, CollectionTable, id)
	}

	if _, err := db.Exec(`DELETE FROM collection_question WHERE collection_id = ?`, id); err != nil {
		return err
	}
	for i, questionId := range m.Questions {
		if _, err := db.Exec(`INSERT INTO collection_question (collection_id, question_id, position) VALUES (?, ?, ?)`,
			id, questionId, i); err != nil {
			return err
		}
	}
	return nil
}

func updateScoringNote(db *sql.DB, id string, m models.ScoringNote) error {
	res, err := db.Exec(`UPDATE scoring_note SET user_id = ?, last_used = ?, name = ?, description = ? WHERE id = ?`,
		m.UserId, formatTime(m.LastUsed), m.Name, m.Description, id)
	return rowsAffected(res, err, ScoringNoteTable, id)
}

// insertJoin appends childId to a parent's list in a (parent, child, position)
// join table, using the next position. The insert is a no-op when the pair
// already exists: games/rounds handlers both write the row (Create writes the
// whole document, then pushes the mirror), so the second write must not clash.
// The position read and insert run in one write transaction, so concurrent
// pushes to the same parent cannot compute the same position.
func insertJoin(db *sql.DB, table, parentCol, childCol, parentId, childId string) error {
	return WithWriteTx(db, func(q Queryer) error {
		ctx := context.Background()
		var pos int
		err := q.QueryRowContext(ctx, fmt.Sprintf("SELECT COALESCE(MAX(position)+1, 0) FROM %s WHERE %s = ?", table, parentCol), parentId).Scan(&pos)
		if err != nil {
			return err
		}
		conflict := "(" + parentCol + ", " + childCol + ")"
		_, err = q.ExecContext(ctx, fmt.Sprintf(
			"INSERT INTO %s (%s, %s, position) VALUES (?, ?, ?) ON CONFLICT %s DO NOTHING",
			table, parentCol, childCol, conflict),
			parentId, childId, pos)
		return err
	})
}

func deleteJoin(db *sql.DB, table, parentCol, childCol, parentId, childId string) error {
	_, err := db.Exec(fmt.Sprintf("DELETE FROM %s WHERE %s = ? AND %s = ?", table, parentCol, childCol),
		parentId, childId)
	return err
}

// Add an item to a list on a specific record
//	  objectType: table (e.g. 'question' or 'round')
//    objectId: ID of record in UUID form
//    array: name of array to append to
//    value: value to append
func Push(e *Env, objectType string, objectId string, array string, value interface{}) error {
	valueString := stringValue(value)

	switch {
	case objectType == RoundTable && array == models.Questions:
		return insertJoin(e.Db, "round_question", "round_id", "question_id", objectId, valueString)

	case objectType == RoundTable && array == models.Games:
		return insertJoin(e.Db, "game_round", "round_id", "game_id", objectId, valueString)

	case objectType == GameTable && array == models.Rounds:
		return insertJoin(e.Db, "game_round", "game_id", "round_id", objectId, valueString)

	case objectType == CollectionTable && array == models.Questions:
		return insertJoin(e.Db, "collection_question", "collection_id", "question_id", objectId, valueString)

	case objectType == SessionTable && array == models.Players:
		return insertJoin(e.Db, "session_player", "session_id", "player_id", objectId, valueString)

	default:
		return errors.New("invalid push: " + objectType + "." + array)
	}
}

// Pull an item from a list on a specific record
func Pull(e *Env, objectType string, objectId string, array string, value interface{}) error {
	valueString := stringValue(value)

	switch {
	case objectType == RoundTable && array == models.Questions:
		return deleteJoin(e.Db, "round_question", "round_id", "question_id", objectId, valueString)

	case objectType == RoundTable && array == models.Games:
		return deleteJoin(e.Db, "game_round", "round_id", "game_id", objectId, valueString)

	case objectType == GameTable && array == models.Rounds:
		return deleteJoin(e.Db, "game_round", "game_id", "round_id", objectId, valueString)

	case objectType == CollectionTable && array == models.Questions:
		return deleteJoin(e.Db, "collection_question", "collection_id", "question_id", objectId, valueString)

	case objectType == SessionTable && array == models.Players:
		return deleteJoin(e.Db, "session_player", "session_id", "player_id", objectId, valueString)

	default:
		return errors.New("invalid pull: " + objectType + "." + array)
	}
}

// Queryer is the subset of *sql.DB / *sql.Tx / *sql.Conn used by the
// transaction helper and by handlers running their own write transactions.
type Queryer interface {
	ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
}

// WithWriteTx runs fn inside a BEGIN IMMEDIATE transaction on one pinned
// connection. Taking SQLite's write lock at BEGIN — rather than at the first
// write, as a deferred transaction would — serializes read-modify-write
// sequences: a concurrent writer blocks on the busy timeout until the first
// commits, instead of both reading the same value and the last writer
// silently dropping the other's update.
func WithWriteTx(db *sql.DB, fn func(q Queryer) error) error {
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, "BEGIN IMMEDIATE"); err != nil {
		return err
	}
	committed := false
	defer func() {
		if !committed {
			_, _ = conn.ExecContext(ctx, "ROLLBACK")
		}
	}()

	if err := fn(conn); err != nil {
		return err
	}
	if _, err := conn.ExecContext(ctx, "COMMIT"); err != nil {
		return err
	}
	committed = true
	return nil
}

// GetAll records of a certain type
//
// args:
//	  e: Environment (i.e. SQLite database)
//	  objectType: table (e.g. 'question' or 'round')
// returns:
//    slice of type from 'objectType' arg; errors (if any)
func GetAll(e *Env, objectType string, filters interface{}) (interface{}, error) {
	where, args := buildWhere(objectType, filters)

	switch objectType {
	case QuestionTable:
		rows, err := e.Db.Query(`SELECT id, create_date, category, question, answer, user_id, scoring_note_id
			FROM question`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.Question, 0)
		for rows.Next() {
			m, err := scanQuestion(rows)
			if err != nil {
				return nil, err
			}
			if err := loadQuestionRoundsUsed(e.Db, &m); err != nil {
				return nil, err
			}
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	case RoundTable:
		rows, err := e.Db.Query(`SELECT id, create_date, name, user_id FROM round`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.Round, 0)
		for rows.Next() {
			var m models.Round
			var createDate string
			if err := rows.Scan(&m.ID, &createDate, &m.Name, &m.UserId); err != nil {
				return nil, err
			}
			m.CreateDate = ParseTime(createDate)
			if err := loadRound(e.Db, &m); err != nil {
				return nil, err
			}
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	case GameTable:
		rows, err := e.Db.Query(`SELECT id, create_date, name, user_id FROM game`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.Game, 0)
		for rows.Next() {
			var m models.Game
			var createDate string
			if err := rows.Scan(&m.ID, &createDate, &m.Name, &m.UserId); err != nil {
				return nil, err
			}
			m.CreateDate = ParseTime(createDate)
			if err := loadGame(e.Db, &m); err != nil {
				return nil, err
			}
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	case SessionTable:
		rows, err := e.Db.Query(`SELECT id, create_date, name, game_id, moderator_id, started,
			current_round, current_question
			FROM session`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.Session, 0)
		for rows.Next() {
			m, err := scanSession(rows)
			if err != nil {
				return nil, err
			}
			if err := loadSessionRelations(e.Db, &m); err != nil {
				return nil, err
			}
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	case CollectionTable:
		rows, err := e.Db.Query(`SELECT id, create_date, name, user_id FROM collection`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.Collection, 0)
		for rows.Next() {
			var m models.Collection
			var createDate string
			if err := rows.Scan(&m.ID, &createDate, &m.Name, &m.UserId); err != nil {
				return nil, err
			}
			m.CreateDate = ParseTime(createDate)
			if err := loadCollection(e.Db, &m); err != nil {
				return nil, err
			}
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	case ScoringNoteTable:
		rows, err := e.Db.Query(`SELECT id, user_id, create_date, last_used, name, description
			FROM scoring_note`+where+` ORDER BY create_date`, args...)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		slice := make([]*models.ScoringNote, 0)
		for rows.Next() {
			var m models.ScoringNote
			var createDate, lastUsed string
			if err := rows.Scan(&m.ID, &m.UserId, &createDate, &lastUsed, &m.Name, &m.Description); err != nil {
				return nil, err
			}
			m.CreateDate = ParseTime(createDate)
			m.LastUsed = ParseTime(lastUsed)
			slice = append(slice, &m)
		}
		return slice, rows.Err()

	default:
		return nil, errors.New("invalid get all table: " + objectType)
	}
}

// regexp_like is a SQLite scalar function mirroring the mgo-era bson regex
// filters that handlers express as common.RegEx. Using Go's regexp preserves
// the old semantics exactly: Unicode-aware case folding for the "i" option,
// and no wildcard interpretation of the search text (LIKE would treat a
// literal '%' or '_' as a wildcard).
func init() {
	// Registered at package init, before store.Open creates any connection,
	// so every connection in the pool has the function.
	sqlite.MustRegisterScalarFunction("regexp_like", 2, regexpLike)
}

func regexpLike(ctx *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
	text, ok := sqlValueString(args, 0)
	if !ok {
		return nil, nil
	}
	pattern, ok := sqlValueString(args, 1)
	if !ok {
		return nil, nil
	}
	matched, err := regexp.MatchString(pattern, text)
	if err != nil {
		// An unparseable pattern (e.g. search text with a stray regexp
		// metacharacter) matches nothing rather than failing the query.
		return int64(0), nil
	}
	if matched {
		return int64(1), nil
	}
	return int64(0), nil
}

// sqlValueString extracts a string from a driver.Value that may arrive as a
// string, []byte, or nil.
func sqlValueString(args []driver.Value, i int) (string, bool) {
	if i >= len(args) || args[i] == nil {
		return "", false
	}
	switch v := args[i].(type) {
	case string:
		return v, true
	case []byte:
		return string(v), true
	default:
		return "", false
	}
}

// regexPattern applies a handler regex's bson options (case-insensitive "i")
// to the pattern for regexp_like.
func regexPattern(re RegEx) string {
	pattern := re.Pattern
	if strings.Contains(re.Options, "i") && !strings.HasPrefix(pattern, "(?") {
		pattern = "(?i)" + pattern
	}
	return pattern
}

// buildWhere translates the handler filters (equality maps and the
// unused_only / text_filter shapes from createFilters) into a SQL WHERE clause.
// Filters arrive either as map[string]string (user_id equality) or
// map[string]interface{} with common.M / common.RegEx values.
func buildWhere(table string, filters interface{}) (string, []interface{}) {
	clauses := make([]string, 0)
	args := make([]interface{}, 0)
	add := func(clause string, arg interface{}) {
		clauses = append(clauses, clause)
		args = append(args, arg)
	}

	var keys []string
	var lookup func(string) interface{}
	switch f := filters.(type) {
	case nil:
		return "", nil
	case map[string]string:
		keys = make([]string, 0, len(f))
		for k := range f {
			keys = append(keys, k)
		}
		lookup = func(k string) interface{} { return f[k] }
	case map[string]interface{}:
		keys = make([]string, 0, len(f))
		for k := range f {
			keys = append(keys, k)
		}
		lookup = func(k string) interface{} { return f[k] }
	default:
		return "", nil
	}

	sort.Strings(keys)
	for _, k := range keys {
		v := lookup(k)
		switch k {
		case "user_id":
			add("user_id = ?", v)

		case "$or":
			if ors, ok := v.([]M); ok {
				subs := make([]string, 0)
				for _, or := range ors {
					for col, cond := range or {
						if m, ok := cond.(M); ok {
							if re, ok := m["$regex"].(RegEx); ok {
								subs = append(subs, "REGEXP_LIKE("+col+", ?)")
								args = append(args, regexPattern(re))
							}
						}
					}
				}
				if len(subs) > 0 {
					clauses = append(clauses, "("+strings.Join(subs, " OR ")+")")
				}
			}

		default:
			if m, ok := v.(M); ok {
				if re, ok := m["$regex"].(RegEx); ok {
					add("REGEXP_LIKE("+k+", ?)", regexPattern(re))
					continue
				}
				if exists, ok := m["$exists"].(bool); ok && !exists {
					// unused_only: membership lives in the join tables, so a
					// question (or round) is unused when it has no rows there.
					if k == models.RoundsUsed+".0" {
						clauses = append(clauses,
							"NOT EXISTS (SELECT 1 FROM round_question WHERE round_question.question_id = question.id)")
					} else if k == models.Games+".0" {
						clauses = append(clauses,
							"NOT EXISTS (SELECT 1 FROM game_round WHERE game_round.round_id = round.id)")
					}
				}
			}
		}
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

func Delete(e *Env, objectType string, objectId string) error {
	res, err := e.Db.Exec(`DELETE FROM `+objectType+` WHERE id = ?`, objectId)
	return rowsAffected(res, err, objectType, objectId)
}

//=====================================
//=====================================
//           Session state
//=====================================
//=====================================

func GetState(e *Env, sessionId string) (sessionState string, err error) {
	var state string
	err = e.Db.QueryRow(`SELECT state FROM session_state WHERE session_id = ?`, sessionId).Scan(&state)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", NonexistentIdError{RecordType: SessionStateTable, ID: sessionId}
		}
		return "", err
	}
	return state, nil
}

// IncrementStateTx is IncrementState's upsert, runnable inside a caller's
// transaction — the scoring path bumps the token atomically with the score
// writes so readers never observe a half-scored question.
func IncrementStateTx(q Queryer, sessionId string) error {
	state := uuid.New().String()
	_, err := q.ExecContext(context.Background(),
		`INSERT INTO session_state (session_id, state) VALUES (?, ?)
		ON CONFLICT(session_id) DO UPDATE SET state = excluded.state`, sessionId, state)
	return err
}

func IncrementState(e *Env, sessionId string) error {
	return IncrementStateTx(e.Db, sessionId)
}

//=====================================
//=====================================
//              Utils
//=====================================
//=====================================

// Respond with data or an error
// args:
//    c: gin context
//    data: data from DB calls
//    err: error from DB calls
// responds with:
//    200 and data, if found
//    404 and error message if not found
func Respond(c *gin.Context, data interface{}, err error) {
	if err != nil {
		fmt.Println(err)
		switch t := err.(type) {
		case InvalidUUIDError:
			c.JSON(http.StatusNotFound, gin.H{"errors": t.Error()})
		case NonexistentIdError:
			c.JSON(http.StatusNotFound, gin.H{"errors": t.Error()})
		case *json.UnmarshalTypeError:
			e := "Invalid value for field '" + t.Field + "' (got: " + t.Value + ", required: " + t.Type.String() + ")"
			c.JSON(http.StatusBadRequest, gin.H{"errors": []string{e}})
		case InvalidDataError:
			fmt.Println("invalid data error")
			c.JSON(http.StatusBadRequest, gin.H{"errors": t.Error(), "field": t.Field()})
		case validator.ValidationErrors:
			fields := requiredErrorFields(t)
			c.JSON(http.StatusBadRequest, gin.H{"errors": "Missing required fields", "field": fields})
		case InvalidTokenError:
			c.JSON(http.StatusUnauthorized, gin.H{"errors": t.Error()})
		case InvalidUserError:
			c.JSON(http.StatusUnauthorized, gin.H{"errors": t.Error()})
		case MissingTokenError:
			c.JSON(http.StatusUnauthorized, gin.H{"errors": t.Error()})

		default:
			fmt.Println(reflect.TypeOf(err))
			fmt.Printf("ERROR: %+v", err)
		}
	} else {
		c.JSON(http.StatusOK, data)
	}
}

func requiredErrorFields(errors validator.ValidationErrors) []string {
	fields := make([]string, 0)
	for _, validationError := range errors {
		if validationError.Tag() == "required" {
			fields = append(fields, validationError.Field())
		}
	}
	return fields
}

func IsValidQuestion(e *Env, questionId string) (interface{}, error) {
	var data models.Question
	err := GetOne(e, QuestionTable, questionId, &data)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func IsValidRound(e *Env, roundId string) (interface{}, error) {
	var data models.Round
	err := GetOne(e, RoundTable, roundId, &data)
	if err != nil {
		return nil, err
	}
	return data, nil
}
