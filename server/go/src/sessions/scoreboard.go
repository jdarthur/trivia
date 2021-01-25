package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
)

func (e *Env) GetSessionScoreboard(c *gin.Context) {
	scoreboard, err := getSessionScoreboard(e, c)
	common.Respond(c, scoreboard, err)
}

func getSessionScoreboard(e *Env, c *gin.Context) (models.PlayerScoreboard, error) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")

	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.PlayerScoreboard{}, err
	}

	var scoreboard models.PlayerScoreboard

	//if no scored questions, create a fake response
	if len(session.Scoreboard) == 0 {
		players, err := getPlayersInSession(e, session)
		if err != nil {
			return models.PlayerScoreboard{}, err
		}

		for _, player := range players {
			var playerScore models.PlayerScore
			playerScore.TeamName = player.TeamName
			playerScore.Icon = player.Icon
			playerScore.Score = make([]float64, 0)

			//add playerId for the caller (or everyone if called as mod)
			if callerPlayerId == models.IdAsString(player.ID) || models.PlayerId(callerPlayerId) == session.Moderator {
				playerScore.PlayerId = models.PlayerId(models.IdAsString(player.ID))
			}
			scoreboard.Scores = append(scoreboard.Scores, playerScore)
		}
	}

	for playerId, scores := range session.Scoreboard {

		var player models.Player
		err = common.GetOne((*common.Env)(e), common.PlayerTable, string(playerId), &player)
		if err != nil {
			return models.PlayerScoreboard{}, err
		}

		var playerScore models.PlayerScore
		playerScore.Icon = player.Icon
		playerScore.TeamName = player.TeamName
		playerScore.Score = scores

		//add playerId for the caller (or everyone if called as mod)
		if callerPlayerId == models.IdAsString(player.ID) || models.PlayerId(callerPlayerId) == session.Moderator {
			playerScore.PlayerId = models.PlayerId(models.IdAsString(player.ID))
		}

		scoreboard.Scores = append(scoreboard.Scores, playerScore)
	}

	return scoreboard, err
}

