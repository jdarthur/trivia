package sessions

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type CurrentQuestionRequest struct {
	QuestionIndex int    `json:"question_id"`
	RoundIndex    int    `json:"round_id"`
	ModeratorId   string `json:"player_id"`
}

func (e *Env) SetCurrentQuestion(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody CurrentQuestionRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	//get the session in question
	var existingSession models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if models.PlayerId(requestBody.ModeratorId) != existingSession.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: models.PlayerId(requestBody.ModeratorId), SessionId: sessionId})
		return
	}

	//can't set current question if we passed the wrong round index
	if requestBody.RoundIndex != *existingSession.CurrentRound {
		common.Respond(c, nil, SetCurrentQuestionWithIncorrectRoundError{RoundIndex: requestBody.RoundIndex})
		return
	}

	roundInSession := existingSession.Rounds[requestBody.RoundIndex]
	var roundObject models.Round
	err = common.GetOne((*common.Env)(e), common.RoundTable, roundInSession.RoundId, &roundObject)
	if err != nil {
		common.Respond(c, nil, InvalidRoundIdInGameError{RoundId: roundInSession.RoundId})
		return
	}

	err = _setCurrentQuestion(e, &existingSession, requestBody.RoundIndex, requestBody.QuestionIndex, roundObject)
	if err == nil {
		err = common.Set((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	}
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, existingSession, err)
}

// _setCurrentQuestion snapshots the question into the session_question row for
// (round, question) — the text, answer, category, and scoring note as of when
// the question was set — and advances session.CurrentQuestion. Re-setting a
// question preserves its scored flag, matching the old document behavior.
func _setCurrentQuestion(e *Env, session *models.Session, roundIndex int, questionIndex int, round models.Round) error {

	//error if question index is out of range for this round
	if questionIndex >= len(round.Questions) {
		return InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	//retrieve question from DB to get the question text
	questionId := round.Questions[questionIndex]
	var questionObject models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &questionObject)
	if err != nil {
		return InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	scoringNote := ""
	if questionObject.ScoringNote != "" {
		var note models.ScoringNote
		err := common.GetOne((*common.Env)(e), common.ScoringNoteTable, questionObject.ScoringNote, &note)
		if err != nil {
			return InvalidQuestionIndexError{QuestionIndex: questionIndex}
		}
		scoringNote = note.Description
	}

	err = upsertSessionQuestion(e, session.ID, roundIndex, questionIndex, questionId,
		questionObject.Category, questionObject.Question, questionObject.Answer,
		questionObject.ScoringNote, scoringNote)
	if err != nil {
		return err
	}

	session.CurrentQuestion = &questionIndex
	return nil
}

// upsertSessionQuestion writes (or refreshes) one session_question snapshot
// row. scored is deliberately not updated on conflict — re-navigating to a
// scored question keeps it scored.
func upsertSessionQuestion(e *Env, sessionId string, roundIndex int, questionIndex int, questionId string, category string, question string, answer string, scoringNoteId string, scoringNote string) error {
	_, err := e.Db.Exec(`INSERT INTO session_question
		(session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scoring_note, scored)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
		ON CONFLICT(session_id, round_index, question_index) DO UPDATE SET
			question_id = excluded.question_id,
			category = excluded.category,
			question = excluded.question,
			answer = excluded.answer,
			scoring_note_id = excluded.scoring_note_id,
			scoring_note = excluded.scoring_note`,
		sessionId, roundIndex, questionIndex, questionId, category, question, answer, scoringNoteId, scoringNote)
	return err
}

type CurrentRoundRequest struct {
	RoundIndex    int    `json:"round_id"`
	QuestionIndex int    `json:"question_id"`
	ModeratorId   string `json:"player_id"`
}

func (e *Env) SetCurrentRound(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody CurrentRoundRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//can't do this if you aren't the mod
	if models.PlayerId(requestBody.ModeratorId) != session.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: models.PlayerId(requestBody.ModeratorId), SessionId: sessionId})
		return
	}

	err = _setCurrentRound(e, &session, requestBody.RoundIndex, requestBody.QuestionIndex)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, session, err)
}

func _setCurrentRound(e *Env, session *models.Session, roundIndex int, questionIndex int) error {

	//can't set round index larger than session.Rounds length
	if roundIndex >= len(session.Rounds) {
		return InvalidRoundIndexError{RoundIndex: roundIndex}
	}

	roundInSession := session.Rounds[roundIndex]

	var round models.Round
	err := common.GetOne((*common.Env)(e), common.RoundTable, roundInSession.RoundId, &round)
	if err != nil {
		return err
	}

	session.CurrentRound = &roundIndex
	if err := _setCurrentQuestion(e, session, roundIndex, questionIndex, round); err != nil {
		return err
	}
	return common.Set((*common.Env)(e), common.SessionTable, session.ID, session)
}

func (e *Env) GetCurrentQuestion(c *gin.Context) {
	question, err := getCurrentQuestion(e, c)
	common.Respond(c, question, err)
}
func getCurrentQuestion(e *Env, c *gin.Context) (models.QuestionInRound, error) {

	sessionId := c.Param("id")
	playerId := c.Query("player_id")
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.QuestionInRound{}, err
	}

	//these won't have been set yet before the session is started
	if session.CurrentRound != nil && session.CurrentQuestion != nil {
		currentRound := *session.CurrentRound
		currentQuestion := *session.CurrentQuestion

		question := session.Rounds[currentRound].Questions[currentQuestion]
		question.Index = currentQuestion

		if models.PlayerId(playerId) != session.Moderator && !question.Scored {
			question.Answer = ""
			question.QuestionId = ""
		}

		return question, err
	}

	return models.QuestionInRound{}, err
}

type CurrentRoundResponse struct {
	RoundIndex int      `json:"id"`
	RoundName  string   `json:"name"`
	Categories []string `json:"categories"`
	Wagers     []int    `json:"wagers"`
}

func (e *Env) GetCurrentRound(c *gin.Context) {
	round, err := getCurrentRound(e, c)
	common.Respond(c, round, err)
}
func getCurrentRound(e *Env, c *gin.Context) (CurrentRoundResponse, error) {
	sessionId := c.Param("id")
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return CurrentRoundResponse{}, err
	}

	//won't have been set yet before the session is started
	if session.CurrentRound != nil {
		currentRound := *session.CurrentRound
		roundInGame := session.Rounds[currentRound]

		var game models.Game
		err = common.GetOne((*common.Env)(e), common.GameTable, session.GameId, &game)
		if err != nil {
			return CurrentRoundResponse{}, InvalidGameIdError{GameId: session.GameId}
		}

		var response CurrentRoundResponse
		response.RoundIndex = currentRound
		response.RoundName = game.RoundNames[roundInGame.RoundId]
		response.Categories = make([]string, 0)
		response.Wagers = roundInGame.Wagers
		for _, question := range roundInGame.Questions {
			response.Categories = append(response.Categories, question.Category)
		}

		return response, nil
	}

	return CurrentRoundResponse{}, nil

}

func (e *Env) ScoreQuestion(c *gin.Context) {
	response, err := scoreQuestion(e, c)
	common.Respond(c, response, err)
}

func scoreQuestion(e *Env, c *gin.Context) (models.ScoreRequest, error) {
	sessionId := c.Param("id")

	var requestBody models.ScoreRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	if requestBody.ModeratorId != session.Moderator {
		return models.ScoreRequest{}, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: requestBody.ModeratorId}
	}

	for _, playerId := range session.Players {
		if _, ok := requestBody.Players[playerId]; !ok {
			return models.ScoreRequest{}, UnscoredPlayerError{PlayerId: playerId}
		}
	}

	roundIndex := requestBody.RoundIndex
	questionIndex := requestBody.QuestionIndex

	if roundIndex >= len(session.Rounds) {
		return models.ScoreRequest{}, InvalidRoundIndexError{RoundIndex: roundIndex}
	}
	if questionIndex >= len(session.Rounds[roundIndex].Questions) {
		return models.ScoreRequest{}, InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	err = scoreQuestionTx(e, session, requestBody, roundIndex, questionIndex)
	return requestBody, err
}

// scoreQuestionTx applies a ScoreRequest inside a single BEGIN IMMEDIATE
// transaction. Scoring is the one real write race in gameplay (5-6 players
// answer, the mod scores once), so the write lock serializes scorers, and
// answer.correct / answer.points_awarded, the session_score round totals, the
// question's scored flag, and the state-token bump commit (or roll back)
// together — a reader can never observe a half-scored question.
func scoreQuestionTx(e *Env, session models.Session, requestBody models.ScoreRequest, roundIndex int, questionIndex int) error {
	return common.WithWriteTx(e.Db, func(q common.Queryer) error {
		ctx := context.Background()

		//read the question snapshot inside the transaction, so the scored
		//check and the scored write cannot race
		var questionId, snapshotAnswer string
		var scored int
		err := q.QueryRowContext(ctx, `SELECT question_id, answer, scored FROM session_question
			WHERE session_id = ? AND round_index = ? AND question_index = ?`,
			session.ID, roundIndex, questionIndex).Scan(&questionId, &snapshotAnswer, &scored)
		if errors.Is(err, sql.ErrNoRows) {
			return InvalidQuestionIndexError{QuestionIndex: questionIndex}
		}
		if err != nil {
			return err
		}

		for playerId, correctOrNot := range requestBody.Players {
			//the player's latest answer for this question
			var answerId string
			var oldPoints float64
			var wager int
			err := q.QueryRowContext(ctx, `SELECT id, points_awarded, wager FROM answer
				WHERE session_id = ? AND round_index = ? AND question_index = ? AND player_id = ?
				ORDER BY rowid DESC LIMIT 1`,
				session.ID, roundIndex, questionIndex, string(playerId)).Scan(&answerId, &oldPoints, &wager)
			if errors.Is(err, sql.ErrNoRows) {
				return IllegalScoreError{PlayerId: playerId, RoundIndex: roundIndex, QuestionIndex: questionIndex}
			}
			if err != nil {
				return err
			}

			//override wager if score override is provided.
			//award 0 points if answer is incorrect
			var pointsToAward float64
			if correctOrNot.Correct {
				if correctOrNot.ScoreOverride != nil {
					pointsToAward = *correctOrNot.ScoreOverride
				} else {
					pointsToAward = float64(wager)
				}
			} else {
				pointsToAward = 0
			}

			correct := 0
			if correctOrNot.Correct {
				correct = 1
			}
			if _, err := q.ExecContext(ctx, `UPDATE answer SET correct = ?, points_awarded = ? WHERE id = ?`,
				correct, pointsToAward, answerId); err != nil {
				return err
			}

			//adjust the round total: drop this question's old contribution, add the new
			var roundTotal float64
			err = q.QueryRowContext(ctx, `SELECT points FROM session_score
				WHERE session_id = ? AND player_id = ? AND round_index = ?`,
				session.ID, string(playerId), roundIndex).Scan(&roundTotal)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			if errors.Is(err, sql.ErrNoRows) {
				roundTotal = 0
			}
			roundTotal = roundTotal - oldPoints + pointsToAward

			if _, err := q.ExecContext(ctx, `INSERT INTO session_score (session_id, player_id, round_index, points)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(session_id, player_id, round_index) DO UPDATE SET points = excluded.points`,
				session.ID, string(playerId), roundIndex, roundTotal); err != nil {
				return err
			}
		}

		//refresh the snapshot's answer text from the question table, as the
		//old code did at score time
		questionAnswer := snapshotAnswer
		if questionId != "" {
			err := q.QueryRowContext(ctx, `SELECT answer FROM question WHERE id = ?`, questionId).Scan(&questionAnswer)
			if err != nil && !errors.Is(err, sql.ErrNoRows) {
				return err
			}
		}

		if _, err := q.ExecContext(ctx, `UPDATE session_question SET scored = 1, answer = ?
			WHERE session_id = ? AND round_index = ? AND question_index = ?`,
			questionAnswer, session.ID, roundIndex, questionIndex); err != nil {
			return err
		}

		//bump the state token in the same transaction
		return common.IncrementStateTx(q, session.ID)
	})
}
