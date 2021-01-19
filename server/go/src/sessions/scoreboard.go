package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
)

func (e *Env) GetSessionScoreboard(c *gin.Context) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")

	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)

	var scoreboard models.PlayerScoreboard

	for playerId, scores := range session.Scoreboard {

		var player models.Player
		err = common.GetOne((*common.Env)(e), common.PlayerTable, playerId, &player)
		if err != nil {
			common.Respond(c, scoreboard, err)
			return
		}

		var playerScore models.PlayerScore
		playerScore.Icon = player.Icon
		playerScore.TeamName = player.TeamName
		playerScore.Score = scores
		if callerPlayerId == playerId {
			playerScore.PlayerId = callerPlayerId
		}

		scoreboard.Scores = append(scoreboard.Scores, playerScore)
	}

	common.Respond(c, scoreboard, err)
}

