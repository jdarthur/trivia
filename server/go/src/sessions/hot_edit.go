package sessions

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type EditQuestionRequest struct {
	QuestionIndex int             `json:"question_index"`
	RoundIndex    int             `json:"round_index"`
	Question      models.Question `json:"question"`
}

func (e *Env) HotEditQuestion(c *gin.Context) {
	sessionId := c.Param("id")

	value, ok := c.Get("session")
	if ok {
		session := value.(models.Session)
		var request EditQuestionRequest
		err := c.ShouldBind(&request)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		err = checkValidRoundAndQuestionIndex(session, request.RoundIndex, request.QuestionIndex)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		//update the snapshot in session_question
		questionInRound := session.Rounds[request.RoundIndex].Questions[request.QuestionIndex]
		questionId := questionInRound.QuestionId

		// request.Question.Category is the category's ID (ticket #179); the
		// snapshot carries the category name and the scoring note resolved
		// through the category (a question no longer has its own note).
		//
		// An empty category means "leave the category unchanged" (ticket #184):
		// the snapshot's name can't always be mapped back to an ID — the mod
		// page is anonymous, or the category was renamed/deleted since the
		// game started — so preserve the snapshot's current category/note and
		// the question row's existing category_id below instead of clearing
		// them (this mirrors the editor update path, where an empty category
		// is "no change").
		categoryName := questionInRound.Category
		scoringNoteId := questionInRound.ScoringNoteId
		scoringNote := questionInRound.ScoringNote
		if request.Question.Category != "" {
			var category models.Category
			err := common.GetOne((*common.Env)(e), common.CategoryTable, request.Question.Category, &category)
			if err != nil {
				common.Respond(c, request, errors.New("unable to get category by ID"))
				return
			}
			categoryName = category.Name
			if category.ScoringNote != "" {
				var note models.ScoringNote
				err := common.GetOne((*common.Env)(e), common.ScoringNoteTable, category.ScoringNote, &note)
				if err != nil {
					common.Respond(c, request, errors.New("unable to get scoring note by ID"))
					return
				}
				scoringNoteId = category.ScoringNote
				scoringNote = note.Description
			}
		}

		err = updateSessionQuestionSnapshot(e, sessionId, request.RoundIndex, request.QuestionIndex,
			questionId, categoryName, request.Question.Question, request.Question.Answer,
			scoringNoteId, scoringNote, request.Question.QuestionType)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		//update question in question table
		var question models.Question
		err = common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
		if err != nil {
			common.Respond(c, question, err)
			return
		}

		question.Question = request.Question.Question
		question.Answer = request.Question.Answer
		// empty category = "no change" (ticket #184): keep the row's existing
		// category_id so an unresolvable category can't clear it.
		if request.Question.Category != "" {
			question.Category = request.Question.Category
		}

		err = common.Set((*common.Env)(e), common.QuestionTable, questionId, &question)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		err = common.IncrementState((*common.Env)(e), sessionId)
		common.Respond(c, request, err)
	}
}

// updateSessionQuestionSnapshot rewrites the session_question snapshot row for
// (round, question) with the hot-edited text, including the question_type and
// the canonical choice/match child rows copied into the snapshot child tables.
// A missing row (question never set) is created as a safety net. The scored
// flag is preserved.
func updateSessionQuestionSnapshot(e *Env, sessionId string, roundIndex int, questionIndex int, questionId string, category string, question string, answer string, scoringNoteId string, scoringNote string, questionType string) error {
	// empty question_type defaults to freeform (the column's CHECK constraint
	// rejects anything else).
	if questionType == "" {
		questionType = "freeform"
	}
	res, err := e.Db.Exec(`UPDATE session_question SET question = ?, answer = ?, category = ?,
		scoring_note_id = ?, scoring_note = ?, question_type = ?
		WHERE session_id = ? AND round_index = ? AND question_index = ?`,
		question, answer, category, scoringNoteId, scoringNote, questionType, sessionId, roundIndex, questionIndex)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if err := replaceSnapshotChildren(e, sessionId, roundIndex, questionIndex, questionId); err != nil {
		return err
	}

	if n > 0 {
		return nil
	}

	_, err = e.Db.Exec(`INSERT INTO session_question
		(session_id, round_index, question_index, question_id, category, question, answer, scoring_note_id, scoring_note, scored, question_type)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
		sessionId, roundIndex, questionIndex, questionId, category, question, answer, scoringNoteId, scoringNote, questionType)
	return err
}

type EditRoundNameRequest struct {
	RoundIndex int    `json:"round_index"`
	RoundName  string `json:"round_name"`
}

func (e *Env) HotEditRoundName(c *gin.Context) {
	sessionId := c.Param("id")

	value, ok := c.Get("session")
	if ok {
		session := value.(models.Session)
		var request EditRoundNameRequest
		err := c.ShouldBind(&request)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		if request.RoundIndex >= len(session.Rounds) {
			common.Respond(c, request, InvalidRoundIndexError{RoundIndex: request.RoundIndex})
			return
		}

		//update RoundName in game
		roundId := session.Rounds[request.RoundIndex].RoundId
		gameId := session.GameId

		var game models.Game
		err = common.GetOne((*common.Env)(e), common.GameTable, gameId, &game)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		game.RoundNames[roundId] = request.RoundName

		err = common.Set((*common.Env)(e), common.GameTable, gameId, &game)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		err = common.IncrementState((*common.Env)(e), sessionId)
		common.Respond(c, request, err)
	}

}
