package sessions

import (
	"github.com/jdarthur/trivia/common"
	"github.com/gin-gonic/gin"
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

		//update question in session
		questionInRound := session.Rounds[request.RoundIndex].Questions[request.QuestionIndex]
		questionInRound.Question = request.Question.Question
		questionInRound.Answer = request.Question.Answer
		questionInRound.Category = request.Question.Category

		session.Rounds[request.RoundIndex].Questions[request.QuestionIndex] = questionInRound
		err = common.Set((*common.Env)(e), common.SessionTable, sessionId, &session)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		//update question in question table
		questionId := questionInRound.QuestionId

		var question models.Question
		err = common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
		if err != nil {
			common.Respond(c, question, err)
			return
		}

		question.Question = request.Question.Question
		question.Answer = request.Question.Answer
		question.Category = request.Question.Category

		err = common.Set((*common.Env)(e), common.QuestionTable, questionId, &question)
		if err != nil {
			common.Respond(c, request, err)
			return
		}

		err = common.IncrementState((*common.Env)(e), sessionId)
		common.Respond(c, request, err)
	}
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
