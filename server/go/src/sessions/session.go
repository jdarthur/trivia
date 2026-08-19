package sessions

import (
	"github.com/jdarthur/trivia/common"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/models"
	"time"
)

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

	if models.PlayerId(playerId) != moderator {
		session = getSessionAsPlayer(&session, playerId)
	}

	common.Respond(c, session, err)
}

func (e *Env) CreateSession(c *gin.Context) {

	var session models.Session
	err := c.ShouldBind(&session)
	if err != nil {
		common.Respond(c, session, err)
		return
	}

	//verify that this session's game is startable, otherwise just return error before we do anything else
	_, err = gameIsStartable(e, session.GameId)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	err = checkLegalSetFields(session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//create a Player record for this session's moderator
	var moderator models.Player
	moderator.TeamName = "mod"
	moderator.RealName = "mod"

	moderatorId, _, err := common.Create((*common.Env)(e), common.PlayerTable, &moderator)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	session.Moderator = models.PlayerId(moderatorId)
	sessionId, createDate, err := common.Create((*common.Env)(e), common.SessionTable, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	session.ID = sessionId
	session.CreateDate = createDate

	err = common.IncrementState((*common.Env)(e), sessionId)
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

	err = checkLegalSetFields(requestBody)
	if err != nil {
		common.Respond(c, nil, err)
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

	if models.PlayerId(moderatorId) != existingSession.Moderator {
		common.Respond(c, existingSession, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: models.PlayerId(moderatorId)})
		return
	}

	err = common.Delete((*common.Env)(e), common.SessionTable, sessionId)
	common.Respond(c, existingSession, err)
}

type SessionActionRequest struct {
	ModeratorId string `json:"player_id"`
}

func (e *Env) StartSession(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody SessionActionRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	var existingSession models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	if err != nil {
		common.Respond(c, existingSession, err)
		return
	}

	if models.PlayerId(requestBody.ModeratorId) != existingSession.Moderator {
		common.Respond(c, existingSession, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: models.PlayerId(requestBody.ModeratorId)})
		return
	}

	if existingSession.Started {
		common.Respond(c, existingSession, SessionAlreadyStartedError{SessionId: sessionId})
		return
	}

	_, err = gameIsStartable(e, existingSession.GameId)
	if err != nil {
		common.Respond(c, existingSession, err)
		return
	}

	//session reads derive the rounds from the game + session_question tables,
	//so starting just flips the flag and snapshots the first question
	existingSession.Started = true

	err = common.Set((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	if err != nil {
		common.Respond(c, existingSession, err)
		return
	}

	err = _setCurrentRound(e, &existingSession, 0, 0)

	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, existingSession, err)
}

func getSessionAsPlayer(session *models.Session, playerId string) models.Session {
	session.GameId = ""
	session.Moderator = ""
	session.Players = nil
	session.Rounds = nil
	session.Scoreboard = nil
	return *session
}

func gameIsStartable(e *Env, gameId string) (*models.Game, error) {
	//make sure this game ID is valid
	var game models.Game
	err := common.GetOne((*common.Env)(e), common.GameTable, gameId, &game)
	if err != nil {
		return &game, InvalidGameIdError{GameId: gameId}
	}

	if len(game.Rounds) == 0 {
		return &game, GameWithoutRoundsError{GameId: game.ID}
	}

	for _, roundId := range game.Rounds {
		var round models.Round
		err = common.GetOne((*common.Env)(e), common.RoundTable, roundId, &round)
		if err != nil {
			return &game, InvalidRoundIdInGameError{RoundId: roundId, GameId: game.ID}
		}

		if len(round.Questions) == 0 {
			return &game, RoundWithoutQuestionsError{GameId: game.ID, RoundId: roundId}
		}
	}

	return &game, nil
}

func checkLegalSetFields(requestBody models.Session) error {
	if requestBody.Started == true {
		return models.AttemptedToSetError{Value: requestBody.Started, IllegalField: models.Started}
	}

	if len(requestBody.Players) != 0 {
		return models.AttemptedToSetError{Value: requestBody.Players, IllegalField: models.Players}
	}

	if requestBody.Rounds != nil {
		return models.AttemptedToSetError{Value: requestBody.Rounds, IllegalField: models.Rounds}
	}

	if requestBody.CurrentRound != nil {
		return models.AttemptedToSetError{Value: requestBody.CurrentRound, IllegalField: models.CurrentRound}
	}

	if requestBody.CurrentQuestion != nil {
		return models.AttemptedToSetError{Value: requestBody.CurrentQuestion, IllegalField: models.CurrentQuestion}
	}

	if len(requestBody.Scoreboard) != 0 {
		return models.AttemptedToSetError{Value: requestBody.Scoreboard, IllegalField: models.Scoreboard}
	}

	return nil
}

func (e *Env) GetPlayersInSession(c *gin.Context) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")

	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	players, err := getPlayersInSession(e, sessionId)

	//strip playerIds if called by non-mod
	if models.PlayerId(callerPlayerId) != session.Moderator {
		for i := range players {
			if callerPlayerId != players[i].ID {
				players[i].ID = ""
			}
		}
	}
	common.Respond(c, gin.H{"players": players}, err)
}

// getPlayersInSession returns the session's players, in join order, from the
// session_player membership join — the canonical membership list.
func getPlayersInSession(e *Env, sessionId string) ([]models.Player, error) {
	rows, err := e.Db.Query(`SELECT p.id, p.create_date, p.team_name, p.real_name, p.icon
		FROM session_player sp
		JOIN player p ON p.id = sp.player_id
		WHERE sp.session_id = ?
		ORDER BY sp.position`, sessionId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessionPlayers := make([]models.Player, 0)
	for rows.Next() {
		var player models.Player
		var createDate string
		if err := rows.Scan(&player.ID, &createDate, &player.TeamName, &player.RealName, &player.Icon); err != nil {
			return nil, err
		}
		player.CreateDate = common.ParseTime(createDate)
		sessionPlayers = append(sessionPlayers, player)
	}
	return sessionPlayers, rows.Err()
}

func (e *Env) GetSessionState(c *gin.Context) {
	sessionId := c.Param("id")
	requestState := c.Query("current")
	if requestState == "" {
		time.Sleep(3 * time.Second)
	}

	sleepTime := 500 * time.Millisecond
	timeout := 90 * time.Second
	totalAttempts := timeout.Milliseconds() / sleepTime.Milliseconds()

	attempts := int64(0)
	for attempts < totalAttempts {

		dbState, err := common.GetState((*common.Env)(e), sessionId)
		if err != nil {
			common.Respond(c, nil, err)
			return
		}

		if requestState != dbState {
			common.Respond(c, gin.H{"state": dbState, "wait_ms": attempts * sleepTime.Milliseconds()}, nil)
			return
		}

		time.Sleep(sleepTime)
		attempts += 1
	}
	common.Respond(c, gin.H{"state": requestState}, nil)
}
