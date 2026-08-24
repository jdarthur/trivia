package players

import (
	"github.com/jdarthur/trivia/common"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/sessions"
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
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}

	common.Respond(c, requestBody, err)
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
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, requestBody, err)
}

type LeaveSession struct {
	PlayerId  models.PlayerId `json:"player_id"`
	SessionId string          `json:"session_id"`
}

// LeaveSession sets the caller's own session_player.active to 0 (self-leave).
// No moderator is required. The membership row (and any score / answers) is
// kept; the player just stops being scored and can no longer submit.
func (e *Env) LeaveSession(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody LeaveSession
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

	if !playerInSession(e, sessionId, requestBody.PlayerId) {
		common.Respond(c, requestBody, sessions.PlayerNotInSessionError{PlayerId: requestBody.PlayerId, SessionId: sessionId})
		return
	}

	err = deactivatePlayer(e, sessionId, requestBody.PlayerId)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, requestBody, err)
}

type InactivatePlayer struct {
	PlayerId  models.PlayerId `json:"player_id"`
	AdminId   models.PlayerId `json:"admin_id"`
	SessionId string          `json:"session_id"`
}

// InactivatePlayer is a moderator-only boot: it sets the target's
// session_player.active to 0 while keeping the row and score — distinct from
// the pre-start hard remove (RemovePlayerFromSession), which drops membership.
func (e *Env) InactivatePlayer(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody InactivatePlayer
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

	// moderator-only action
	if requestBody.AdminId != session.Moderator {
		common.Respond(c, requestBody, sessions.UnauthorizedSessionActionError{ModeratorId: requestBody.AdminId})
		return
	}

	if !playerInSession(e, sessionId, requestBody.PlayerId) {
		common.Respond(c, requestBody, sessions.PlayerNotInSessionError{PlayerId: requestBody.PlayerId, SessionId: sessionId})
		return
	}

	err = deactivatePlayer(e, sessionId, requestBody.PlayerId)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, requestBody, err)
}

// playerInSession reports whether the player has a membership row in the
// session (active or not).
func playerInSession(e *Env, sessionId string, target models.PlayerId) bool {
	var n int
	err := e.Db.QueryRow(`SELECT count(*) FROM session_player
		WHERE session_id = ? AND player_id = ?`, sessionId, string(target)).Scan(&n)
	if err != nil {
		return false
	}
	return n > 0
}

// deactivatePlayer flips a session_player membership row's active flag to 0,
// keeping the row and any accumulated score / answers (ticket #5).
func deactivatePlayer(e *Env, sessionId string, playerId models.PlayerId) error {
	_, err := e.Db.Exec(`UPDATE session_player SET active = 0
		WHERE session_id = ? AND player_id = ?`, sessionId, string(playerId))
	return err
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
		return
	}

	original.TeamName = requestBody.TeamName
	original.Icon = requestBody.Icon
	original.RealName = requestBody.RealName
	err = common.Set((*common.Env)(e), common.PlayerTable, playerId, original)
	if err == nil {
		err = bumpPlayerSessions((*common.Env)(e), playerId)
	}

	common.Respond(c, requestBody, err)
}

// bumpPlayerSessions bumps the state token of every session the player is
// currently a member of. Membership is canonical in session_player (there is
// no player.session_id mirror), so the sessions are derived from the join —
// a player removed from one session and re-added elsewhere only bumps the
// sessions they actually belong to.
func bumpPlayerSessions(e *common.Env, playerId string) error {
	rows, err := e.Db.Query(`SELECT session_id FROM session_player WHERE player_id = ?`, playerId)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var sessionId string
		if err := rows.Scan(&sessionId); err != nil {
			return err
		}
		if err := common.IncrementState(e, sessionId); err != nil {
			return err
		}
	}
	return rows.Err()
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
