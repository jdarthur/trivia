package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
)

func (e *Env) WithValidSession(c *gin.Context) {
	sessionId := c.Param("id")

	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, session, err)
		return
	}

	c.Set("session", session)
	c.Next()
}

func (e *Env) AsMod(c *gin.Context) {
	value, ok := c.Get("session")
	if ok {
		session := value.(models.Session)
		c.Set("session", session)

		playerId := models.PlayerId(c.Query("player_id"))
		if playerId != session.Moderator {
			common.Respond(c, session, UnauthorizedSessionActionError{SessionId: models.IdAsString(session.ID), ModeratorId: playerId})
			return
		}
		c.Next()
	}
}

func checkValidRoundAndQuestionIndex(session models.Session, roundIndex int, questionIndex int) error {
	if len(session.Rounds) <= roundIndex {
		return InvalidRoundIndexError{RoundIndex: roundIndex}
	}

	r := session.Rounds[roundIndex]

	if len(r.Questions) <= questionIndex {
		return InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}
	return nil
}
