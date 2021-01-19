package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
)

var GameId = "Game"

type Env common.Env

func (e *Env) GetAllSessions(c *gin.Context) {
	sessions, err := common.GetAll((*common.Env)(e), common.SessionTable, nil)
	common.Respond(c, gin.H{"sessions": sessions}, err)
}


func (e *Env) GetOneSession(c *gin.Context) {
	sessionId := c.Param("id")
	playerId := c.Query("player_id")

	var session models.Session

	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, session, err)
		return
	}

	moderator := session.Moderator

	if playerId != moderator {
		session = getSessionAsPlayer(&session, playerId)
	}

	common.Respond(c, session, err)
}

func (e *Env) CreateSession(c *gin.Context) {

	var requestBody models.Session
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	//make sure this game ID is valid
	var game models.Game
	err = common.GetOne((*common.Env)(e), common.GameTable, requestBody.GameId, &game)
	if err != nil {
		common.Respond(c, nil, InvalidGameIdError{GameId: models.IdAsString(game.ID)})
		return
	}

	//verify that this game is startable, otherwise just return error before we do anything else
	err = gameIsStartable(e, game)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//create a Player record for this session's moderator
	var moderator models.Player
	moderator.TeamName = "mod"
	moderator.RealName = "mod"

	moderatorId, _, err := common.Create((*common.Env)(e), common.PlayerTable, moderator)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	var session models.Session
	session.Moderator = models.IdAsString(moderatorId)
	sessionId, createDate, err := common.Create((*common.Env)(e), common.SessionTable, session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	session.ID = sessionId
	session.CreateDate = createDate

	common.Respond(c, session, err)
}

func (e *Env) UpdateSession(c *gin.Context) {

	sessionId := c.Param("id")

	var requestBody models.Session
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//verify that session is valid
	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//only moderator can do updates on a session
	if requestBody.Moderator != session.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: requestBody.Moderator})
		return
	}

	//name is the only updatable field on created sessions
	if requestBody.Name != "" {
		session.Name = requestBody.Name
	}

	err = common.Set((*common.Env)(e), common.SessionTable, sessionId, &session)
	common.Respond(c, session, err)
}


func (e *Env) DeleteSession(c *gin.Context) {
	sessionId := c.Param("id")
	moderatorId := c.Query("mod")

	var existingSession models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	if err != nil {
		common.Respond(c, existingSession, err)
		return
	}

	if moderatorId != existingSession.Moderator {
		common.Respond(c, existingSession, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: moderatorId})
		return
	}

	err = common.Delete((*common.Env)(e), common.SessionTable, sessionId)
	common.Respond(c, existingSession, err)
}




func getSessionAsPlayer(session *models.Session, playerId string) models.Session {
	session.GameId = ""
	session.Moderator = ""
	return *session
}

func gameIsStartable(e *Env, game models.Game) error {
	if len(game.Rounds) == 0 {
		return GameWithoutRoundsError{GameId: models.IdAsString(game.ID)}
	}

	for _, roundId := range game.Rounds {
		var round models.Round
		err := common.GetOne((*common.Env)(e), common.RoundTable, roundId, &round)
		if err != nil {
			return InvalidRoundIdInGameError{RoundId: roundId, GameId: models.IdAsString(game.ID)}
		}

		if len(round.Questions) == 0 {
			return RoundWithoutQuestionsError{GameId: models.IdAsString(game.ID), RoundId: roundId}
		}
	}

	return nil
}


