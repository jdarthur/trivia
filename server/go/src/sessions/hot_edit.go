package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
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
