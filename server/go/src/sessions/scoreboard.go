package sessions

import (
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

func (e *Env) GetSessionScoreboard(c *gin.Context) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")
	scoreboard, err := getSessionScoreboard(e, sessionId, callerPlayerId)
	common.Respond(c, scoreboard, err)
}

// getSessionScoreboard builds the scoreboard from the session_score rows
// (one per player per round) plus session_player for players with no points
// yet, instead of reading a denormalized scoreboard document.
//
// Players who scored but were later removed from the session still appear —
// matching the old document behavior, where the scoreboard outlived the
// membership list.
func getSessionScoreboard(e *Env, sessionId string, callerPlayerId string) (models.PlayerScoreboard, error) {
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.PlayerScoreboard{}, err
	}

	// Everyone currently in the session, in join order (covers zero-score players).
	players, err := getPlayersInSession(e, session.ID)
	if err != nil {
		return models.PlayerScoreboard{}, err
	}

	// Points per player, in round order.
	scores := make(map[models.PlayerId][]float64)
	rows, err := e.Db.Query(`SELECT player_id, points FROM session_score
		WHERE session_id = ? ORDER BY player_id, round_index`, sessionId)
	if err != nil {
		return models.PlayerScoreboard{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var playerId string
		var points float64
		if err := rows.Scan(&playerId, &points); err != nil {
			return models.PlayerScoreboard{}, err
		}
		scores[models.PlayerId(playerId)] = append(scores[models.PlayerId(playerId)], points)
	}
	if err := rows.Err(); err != nil {
		return models.PlayerScoreboard{}, err
	}

	// Players with points who are no longer in the session.
	scoreOnly := make([]models.Player, 0)
	seen := make(map[models.PlayerId]bool, len(players))
	for _, p := range players {
		seen[models.PlayerId(p.ID)] = true
	}
	for playerId := range scores {
		if seen[playerId] {
			continue
		}
		var p models.Player
		if err := common.GetOne((*common.Env)(e), common.PlayerTable, string(playerId), &p); err != nil {
			continue // player record is gone; nothing left to show
		}
		scoreOnly = append(scoreOnly, p)
	}
	sort.Slice(scoreOnly, func(i, j int) bool { return scoreOnly[i].ID < scoreOnly[j].ID })

	scoreboard := models.PlayerScoreboard{Scores: make([]models.PlayerScore, 0, len(players)+len(scoreOnly))}
	appendPlayer := func(player models.Player) {
		playerId := models.PlayerId(player.ID)
		var playerScore models.PlayerScore
		playerScore.Icon = player.Icon
		playerScore.TeamName = player.TeamName
		playerScore.Score = scores[playerId]
		if playerScore.Score == nil {
			playerScore.Score = make([]float64, 0)
		}

		//add playerId for the caller (or everyone if called as mod)
		if callerPlayerId == player.ID || models.PlayerId(callerPlayerId) == session.Moderator {
			playerScore.PlayerId = playerId
		}
		scoreboard.Scores = append(scoreboard.Scores, playerScore)
	}

	for _, player := range players {
		appendPlayer(player)
	}
	for _, player := range scoreOnly {
		appendPlayer(player)
	}

	return scoreboard, nil
}
