package sessions

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

func (e *Env) WithValidSession(c *gin.Context) {
	sessionId := c.Param("id")

	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, session, err)
		c.Abort()
		return
	}

	c.Set("session", session)
	c.Next()
}

func (e *Env) AsMod(c *gin.Context) {
	value, ok := c.Get("session")
	if !ok {
		// No session in context: fail closed rather than letting the protected
		// handler run (gin continues the chain when a middleware returns
		// without Next/Abort). common.Respond can't map this type (import
		// cycle), so write the 4xx directly.
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"errors": MissingSessionContextError{}.Error()})
		return
	}

	session := value.(models.Session)

	playerId := models.PlayerId(c.Query("player_id"))
	if playerId != session.Moderator {
		common.Respond(c, session, UnauthorizedSessionActionError{SessionId: session.ID, ModeratorId: playerId})
		c.Abort()
		return
	}
	c.Next()
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
