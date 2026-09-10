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

	if err := AssertMod(c, session); err != nil {
		common.Respond(c, session, err)
		c.Abort()
		return
	}
	c.Next()
}

// AssertMod reports whether the authenticated caller (the server-verified
// player in the gin context, set by common.WithPlayer) is the session's
// moderator. It is the single shared moderator check — the old scattered
// `requestBody.AdminId != session.Moderator` comparisons collapse into it.
// The caller's player_id is never read from the request body/query: identity
// comes from the context value, so a client can no longer claim to be the mod.
func AssertMod(c *gin.Context, session models.Session) error {
	playerId := models.PlayerId(common.GetPlayerId(c))
	if playerId != session.Moderator {
		return UnauthorizedSessionActionError{SessionId: session.ID, ModeratorId: playerId}
	}
	return nil
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
