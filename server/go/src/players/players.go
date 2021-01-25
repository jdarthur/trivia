package players

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
	"sessions"
)

type Env common.Env

func (e *Env) GetOnePlayer(c *gin.Context) {
	playerId := c.Param("id")

	var player models.Player
	err := common.GetOne((*common.Env)(e), common.PlayerTable, playerId, &player)
	common.Respond(c, player, err)
}

func (e *Env) CreatePlayer(c *gin.Context) {
	var data models.Player

	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	playerId, createDate, err := common.Create((*common.Env)(e), common.PlayerTable, &data)
	data.ID = playerId
	data.CreateDate = createDate

	common.Respond(c, data, err)
}

type AddToSession struct {
	PlayerId  models.PlayerId `json:"player_id"`
	SessionId string          `json:"session_id"`
}

func (e *Env) AddPlayerToSession(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody AddToSession
	requestBody.SessionId = sessionId

	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	//can't add a player to an already-started session
	if session.Started {
		common.Respond(c, requestBody, SessionAlreadyStartedError{SessionId: sessionId})
		return
	}

	//can't add a player that's already in a session
	for _, playerId := range session.Players {
		if playerId == requestBody.PlayerId {
			common.Respond(c, requestBody, AlreadyInSessionError{SessionId: sessionId, PlayerId: requestBody.PlayerId})
			return
		}
	}

	//verify that player is an actual player ID
	var player models.Player
	err = common.GetOne((*common.Env)(e), common.PlayerTable, string(requestBody.PlayerId), &player)
	if err != nil {
		common.Respond(c, requestBody, InvalidPlayerIdError{PlayerId: requestBody.PlayerId})
		return
	}

	err = common.Push((*common.Env)(e), common.SessionTable, sessionId, models.Players, requestBody.PlayerId)
	common.Respond(c, requestBody, err)

	//TODO: increment session state when player is added
	//TODO (maybe): update player.session_id when player is added to session
}

type RemoveFromSession struct {
	PlayerId  string          `json:"player_id"`
	AdminId   models.PlayerId `json:"admin_id"`
	SessionId string          `json:"session_id"`
}

func (e *Env) RemovePlayerFromSession(c *gin.Context) {

	sessionId := c.Param("id")

	var requestBody RemoveFromSession
	requestBody.SessionId = sessionId

	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, session, err)
		return
	}

	//return error if caller didn't pass the correct admin_id for this session
	if requestBody.AdminId != session.Moderator {
		common.Respond(c, requestBody, sessions.UnauthorizedSessionActionError{ModeratorId: requestBody.AdminId})
		return
	}

	err = common.Pull((*common.Env)(e), common.SessionTable, sessionId, models.Players, requestBody.PlayerId)
	common.Respond(c, requestBody, err)

	//TODO: increment session state when player is removed
}

func (e *Env) UpdatePlayer(c *gin.Context) {

	playerId := c.Param("id")

	var requestBody models.Player
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	//TODO: should we prevent player updates after session starts?

	var original models.Player
	err = common.GetOne((*common.Env)(e), common.PlayerTable, playerId, &original)
	if err != nil {
		common.Respond(c, requestBody, err)
	}

	//merge(&requestBody, &original)
	err = common.Set((*common.Env)(e), common.PlayerTable, playerId, &original)

	common.Respond(c, requestBody, err)
	//TODO: update session state after player update (if session not started)
}

func (e *Env) DeletePlayer(c *gin.Context) {
	playerId := c.Param("id")

	var original models.Player
	err := common.GetOne((*common.Env)(e), common.PlayerTable, playerId, &original)
	if err != nil {
		common.Respond(c, nil, err)
	}

	err = common.Delete((*common.Env)(e), common.PlayerTable, playerId)

	common.Respond(c, original, err)
}
