package sessions

import (
	"database/sql"
	"errors"
	"fmt"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

func (e *Env) AnswerQuestion(c *gin.Context) {
	sessionId := c.Param("id")

	var answer models.Answer
	err := c.ShouldBind(&answer)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if answer.Correct == true {
		common.Respond(c, nil, models.AttemptedToSetError{IllegalField: models.Correct, Value: answer.Correct})
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if !playerInSession(e, sessionId, answer.PlayerId) {
		common.Respond(c, nil, PlayerNotInSessionError{PlayerId: answer.PlayerId, SessionId: sessionId})
		return
	}

	err = checkValidRoundAndQuestionIndex(session, *answer.RoundIndex, *answer.QuestionIndex)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if session.Rounds[*answer.RoundIndex].Questions[*answer.QuestionIndex].Scored {
		common.Respond(c, nil, QuestionAlreadyScoredError{QuestionIndex: *answer.QuestionIndex, RoundIndex: *answer.RoundIndex})
		return
	}

	availableWagers, err := getWagers(e, session, *answer.RoundIndex, answer.PlayerId)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if !wagerIsLegal(availableWagers, answer.Wager) {
		common.Respond(c, nil, IllegalWagerError{Wager: answer.Wager, PlayerId: answer.PlayerId, AvailableWagers: availableWagers})
		return
	}

	answer.SessionId = sessionId
	answerId, createDate, err := common.Create((*common.Env)(e), common.AnswerTable, &answer)
	if err != nil {
		fmt.Println(err)
	}
	//set these new items so that they appear in the API response
	answer.ID = answerId
	answer.CreateDate = createDate

	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}

	common.Respond(c, answer, err)
}

func (e *Env) GetWagers(c *gin.Context) {
	sessionId := c.Param("id")
	playerId := c.Query("player_id")
	r := c.Query("round_id")

	roundIndex, err := strconv.Atoi(r)
	if err != nil {
		common.Respond(c, nil, InvalidRoundIndexError{RoundIndex: r})
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	wagers, err := getWagers(e, session, roundIndex, models.PlayerId(playerId))
	common.Respond(c, wagers, err)
}

// getWagers returns the wagers a player may still choose from for a round:
// the round's wager list minus the wager of the player's latest answer to
// each already-scored question in that round. Scored questions are the
// session_question rows flagged scored; answers live in the answer table.
func getWagers(e *Env, session models.Session, roundIndex int, playerId models.PlayerId) ([]int, error) {
	if roundIndex >= len(session.Rounds) {
		return nil, InvalidRoundIndexError{RoundIndex: roundIndex}
	}

	round := session.Rounds[roundIndex]
	allWagers := make([]int, len(round.Wagers))
	copy(allWagers, round.Wagers)

	rows, err := e.Db.Query(`SELECT a.wager
		FROM session_question sq
		JOIN answer a ON a.session_id = sq.session_id
			AND a.round_index = sq.round_index
			AND a.question_index = sq.question_index
		WHERE sq.session_id = ? AND sq.round_index = ? AND sq.scored = 1
			AND a.player_id = ?
			AND a.id = (
				SELECT a2.id FROM answer a2
				WHERE a2.session_id = a.session_id
					AND a2.round_index = a.round_index
					AND a2.question_index = a.question_index
					AND a2.player_id = a.player_id
				ORDER BY a2.rowid DESC LIMIT 1
			)`,
		session.ID, roundIndex, string(playerId))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var wager int
		if err := rows.Scan(&wager); err != nil {
			return nil, err
		}
		allWagers = remove(allWagers, wager)
	}
	return allWagers, rows.Err()
}

func (e *Env) GetAnswers(c *gin.Context) {
	answers, err := getAnswers(e, c)
	common.Respond(c, answers, err)
}

func getAnswers(e *Env, c *gin.Context) (interface{}, error) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")
	roundIndex, questionIndex, err := parseRoundAndQuestion(c)
	if err != nil {
		return nil, err
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return nil, err
	}

	//error on out-of-range round/question index
	if roundIndex >= len(session.Rounds) {
		return nil, InvalidRoundIndexError{RoundIndex: roundIndex}
	}
	if questionIndex >= len(session.Rounds[roundIndex].Questions) {
		return nil, InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	if models.PlayerId(callerPlayerId) == session.Moderator {
		return getAnswersAsMod(e, session, roundIndex, questionIndex)
	}

	question := session.Rounds[roundIndex].Questions[questionIndex]
	if question.Scored {
		return getAnswersScored(e, session, roundIndex, questionIndex, models.PlayerId(callerPlayerId))
	}

	return getAnswersUnscored(e, session, roundIndex, questionIndex, models.PlayerId(callerPlayerId))
}

func parseRoundAndQuestion(c *gin.Context) (roundIndex int, questionIndex int, err error) {
	r := c.Query("round_id")
	q := c.Query("question_id")

	roundIndex, err = strconv.Atoi(r)
	if err != nil {
		return 0, 0, InvalidRoundIndexError{RoundIndex: r}
	}

	questionIndex, err = strconv.Atoi(q)
	if err != nil {
		return 0, 0, InvalidQuestionIndexError{QuestionIndex: q}
	}
	return roundIndex, questionIndex, nil
}

// playerAnsweredQuestion reports whether the player has submitted any answer
// for this question.
func playerAnsweredQuestion(e *Env, sessionId string, roundIndex int, questionIndex int, playerId models.PlayerId) (bool, error) {
	var n int
	err := e.Db.QueryRow(`SELECT count(*) FROM answer
		WHERE session_id = ? AND round_index = ? AND question_index = ? AND player_id = ?`,
		sessionId, roundIndex, questionIndex, string(playerId)).Scan(&n)
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

// scanAnswerRow scans one row of the answer table into a models.Answer.
func scanAnswerRow(s rowScanner) (models.Answer, error) {
	var m models.Answer
	var createDate string
	var roundIndex, questionIndex sql.NullInt64
	var playerId string
	var correct int
	err := s.Scan(&m.ID, &createDate, &m.SessionId, &roundIndex, &questionIndex, &playerId,
		&m.Answer, &m.Wager, &correct, &m.PointsAwarded)
	if err != nil {
		return m, err
	}
	m.CreateDate = common.ParseTime(createDate)
	m.RoundIndex = intPtr(roundIndex)
	m.QuestionIndex = intPtr(questionIndex)
	m.PlayerId = models.PlayerId(playerId)
	m.Correct = correct == 1
	return m, nil
}

// rowScanner is satisfied by *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...interface{}) error
}

func intPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

// answersForQuestion returns every answer submitted for this question,
// oldest first.
func answersForQuestion(e *Env, sessionId string, roundIndex int, questionIndex int) ([]models.Answer, error) {
	rows, err := e.Db.Query(`SELECT id, create_date, session_id, round_index, question_index,
		player_id, answer, wager, correct, points_awarded
		FROM answer
		WHERE session_id = ? AND round_index = ? AND question_index = ?
		ORDER BY rowid`, sessionId, roundIndex, questionIndex)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	answers := make([]models.Answer, 0)
	for rows.Next() {
		a, err := scanAnswerRow(rows)
		if err != nil {
			return nil, err
		}
		answers = append(answers, a)
	}
	return answers, rows.Err()
}

// latestAnswersForQuestion returns the newest answer per player for this
// question — the one scoring reads and wagers deduct from.
func latestAnswersForQuestion(e *Env, sessionId string, roundIndex int, questionIndex int) ([]models.Answer, error) {
	rows, err := e.Db.Query(`SELECT a.id, a.create_date, a.session_id, a.round_index, a.question_index,
		a.player_id, a.answer, a.wager, a.correct, a.points_awarded
		FROM answer a
		WHERE a.session_id = ? AND a.round_index = ? AND a.question_index = ?
			AND a.id = (
				SELECT a2.id FROM answer a2
				WHERE a2.session_id = a.session_id
					AND a2.round_index = a.round_index
					AND a2.question_index = a.question_index
					AND a2.player_id = a.player_id
				ORDER BY a2.rowid DESC LIMIT 1
			)
		ORDER BY a.player_id`, sessionId, roundIndex, questionIndex)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	answers := make([]models.Answer, 0)
	for rows.Next() {
		a, err := scanAnswerRow(rows)
		if err != nil {
			return nil, err
		}
		answers = append(answers, a)
	}
	return answers, rows.Err()
}

func getAnswersUnscored(e *Env, session models.Session, roundIndex int, questionIndex int, callerPlayerId models.PlayerId) (models.AnswersResponseUnscored, error) {
	players, err := getPlayersInSession(e, session.ID)
	if err != nil {
		return models.AnswersResponseUnscored{}, err
	}

	var answers models.AnswersResponseUnscored
	for _, player := range players {

		thisPlayerId := models.PlayerId(player.ID)

		var p models.AnswerUnscored
		if thisPlayerId == callerPlayerId {
			p.PlayerId = thisPlayerId
		}
		p.TeamName = player.TeamName
		p.Icon = player.Icon

		answered, err := playerAnsweredQuestion(e, session.ID, roundIndex, questionIndex, thisPlayerId)
		if err != nil {
			return models.AnswersResponseUnscored{}, err
		}
		p.Answered = answered

		answers.Answers = append(answers.Answers, p)
	}

	return answers, nil
}

func getAnswersScored(e *Env, session models.Session, roundIndex int, questionIndex int, callerPlayerId models.PlayerId) (models.AnswersResponseScored, error) {
	players, err := getPlayersInSession(e, session.ID)
	if err != nil {
		return models.AnswersResponseScored{}, err
	}
	allAnswers, err := answersForQuestion(e, session.ID, roundIndex, questionIndex)
	if err != nil {
		return models.AnswersResponseScored{}, err
	}
	var response models.AnswersResponseScored
	response.Scored = true
	for _, player := range players {
		var team models.ScoredTeam
		playerId := models.PlayerId(player.ID)

		if callerPlayerId == playerId {
			team.PlayerId = playerId
		}

		team.Icon = player.Icon
		team.TeamName = player.TeamName

		for _, answer := range allAnswers {
			if answer.PlayerId != playerId {
				continue
			}
			var a models.ScoredAnswer
			a.Answer = answer.Answer
			a.Wager = answer.Wager
			a.Correct = answer.Correct
			a.PointsAwarded = answer.PointsAwarded
			team.Answers = append(team.Answers, a)
		}

		response.Answers = append(response.Answers, team)

	}

	return response, nil
}

type AnswersAsMod struct {
	Scored  bool                    `json:"scored"`
	Answers []IndividualAnswerAsMod `json:"answers"`
}

type IndividualAnswerAsMod struct {
	PlayerId models.PlayerId `json:"player_id"`
	TeamName string          `json:"team_name"`
	Answered bool            `json:"answered"`
	Answers  []models.Answer `json:"answers"`
}

func getAnswersAsMod(e *Env, session models.Session, roundIndex int, questionIndex int) (AnswersAsMod, error) {
	var answers AnswersAsMod
	answers.Answers = make([]IndividualAnswerAsMod, 0)

	snapshot, err := sessionQuestionSnapshot(e, session.ID, roundIndex, questionIndex)
	if err != nil {
		return answers, err
	}
	answers.Scored = snapshot.Scored

	players, err := getPlayersInSession(e, session.ID)
	if err != nil {
		return answers, err
	}

	allAnswers, err := answersForQuestion(e, session.ID, roundIndex, questionIndex)
	if err != nil {
		return answers, err
	}

	for _, player := range players {
		playerId := models.PlayerId(player.ID)

		var teamAnswer IndividualAnswerAsMod
		teamAnswer.PlayerId = playerId
		teamAnswer.TeamName = player.TeamName
		teamAnswer.Answers = make([]models.Answer, 0)

		for _, individualAnswer := range allAnswers {
			if individualAnswer.PlayerId != playerId {
				continue
			}
			teamAnswer.Answers = append(teamAnswer.Answers, individualAnswer)
		}
		teamAnswer.Answered = len(teamAnswer.Answers) > 0

		answers.Answers = append(answers.Answers, teamAnswer)
	}

	return answers, nil
}

func playerInSession(e *Env, sessionId string, target models.PlayerId) bool {
	var n int
	err := e.Db.QueryRow(`SELECT count(*) FROM session_player
		WHERE session_id = ? AND player_id = ?`, sessionId, string(target)).Scan(&n)
	if err != nil {
		return false
	}
	return n > 0
}

func wagerIsLegal(legalWagers []int, wager int) bool {
	for _, legalWager := range legalWagers {
		if legalWager == wager {
			return true
		}
	}
	return false
}

// remove wager from slice by value
func remove(slice []int, valueToRemove int) []int {
	for i, value := range slice {
		if value == valueToRemove {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

// questionSnapshot is the session_question row for one question.
type questionSnapshot struct {
	QuestionId    string
	Category      string
	Question      string
	Answer        string
	ScoringNoteId string
	ScoringNote   string
	Scored        bool
}

func sessionQuestionSnapshot(e *Env, sessionId string, roundIndex int, questionIndex int) (questionSnapshot, error) {
	var s questionSnapshot
	var scored int
	err := e.Db.QueryRow(`SELECT question_id, category, question, answer, scoring_note_id,
		scoring_note, scored FROM session_question
		WHERE session_id = ? AND round_index = ? AND question_index = ?`,
		sessionId, roundIndex, questionIndex).Scan(
		&s.QuestionId, &s.Category, &s.Question, &s.Answer, &s.ScoringNoteId, &s.ScoringNote, &scored)
	if errors.Is(err, sql.ErrNoRows) {
		return s, InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}
	if err != nil {
		return s, err
	}
	s.Scored = scored == 1
	return s, nil
}
