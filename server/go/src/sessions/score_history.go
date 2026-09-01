package sessions

import (
	"fmt"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

func (e *Env) GetSessionScoreHistory(c *gin.Context) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")
	history, err := getSessionScoreHistory(e, sessionId, callerPlayerId)
	common.Respond(c, history, err)
}

// getSessionScoreHistory builds the per-question cumulative score history
// (ticket #234).
//
// The x-axis comes from session_question — the questions the game has actually
// reached — ordered by round_index, question_index, so every series shares one
// axis and a skipped question produces a flat point instead of shifting the
// line left. Values come from each player's latest answer row per question
// (ORDER BY rowid DESC, as scoreQuestionTx reads), already-awarded
// points_awarded; the series is the running sum in axis order. Re-scoring is
// idempotent here because scoreQuestionTx UPDATEs the same answer row rather
// than appending, so it can never double-count.
//
// The player set mirrors getSessionScoreboard: everyone currently in the
// session (zero-filled when they have no points), plus anyone with answers who
// was later removed from the session. player_id is masked the same way too.
func getSessionScoreHistory(e *Env, sessionId string, callerPlayerId string) (models.ScoreHistory, error) {
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.ScoreHistory{}, err
	}

	// The shared x-axis: every session_question row in game order.
	type axisPoint struct {
		roundIndex    int
		questionIndex int
	}
	axis := make([]axisPoint, 0)
	rows, err := e.Db.Query(`SELECT round_index, question_index FROM session_question
		WHERE session_id = ? ORDER BY round_index, question_index`, sessionId)
	if err != nil {
		return models.ScoreHistory{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var p axisPoint
		if err := rows.Scan(&p.roundIndex, &p.questionIndex); err != nil {
			return models.ScoreHistory{}, err
		}
		axis = append(axis, p)
	}
	if err := rows.Err(); err != nil {
		return models.ScoreHistory{}, err
	}

	axisIndex := make(map[[2]int]int, len(axis))
	labels := make([]string, len(axis))
	for i, p := range axis {
		axisIndex[[2]int{p.roundIndex, p.questionIndex}] = i
		labels[i] = fmt.Sprintf("R%dQ%d", p.roundIndex+1, p.questionIndex+1)
	}

	// Everyone currently in the session, in join order (covers zero-score players).
	players, err := getPlayersInSession(e, session.ID)
	if err != nil {
		return models.ScoreHistory{}, err
	}

	// The latest answer row per (player, question), carrying the already-awarded
	// points — the same rowid DESC rule scoreQuestionTx uses to score.
	points := make(map[models.PlayerId]map[int]float64)
	rows, err = e.Db.Query(`SELECT player_id, round_index, question_index, points_awarded FROM answer
		WHERE session_id = ?
		  AND rowid IN (
			SELECT MAX(rowid) FROM answer
			WHERE session_id = ?
			GROUP BY player_id, round_index, question_index
		  )`, sessionId, sessionId)
	if err != nil {
		return models.ScoreHistory{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var playerId string
		var p axisPoint
		var awarded float64
		if err := rows.Scan(&playerId, &p.roundIndex, &p.questionIndex, &awarded); err != nil {
			return models.ScoreHistory{}, err
		}
		idx, ok := axisIndex[[2]int{p.roundIndex, p.questionIndex}]
		if !ok {
			continue // an answer for a question the axis doesn't cover; ignore
		}
		pid := models.PlayerId(playerId)
		if points[pid] == nil {
			points[pid] = make(map[int]float64)
		}
		points[pid][idx] = awarded
	}
	if err := rows.Err(); err != nil {
		return models.ScoreHistory{}, err
	}

	// Players with answers who are no longer in the session.
	scoreOnly := make([]models.Player, 0)
	seen := make(map[models.PlayerId]bool, len(players))
	for _, p := range players {
		seen[models.PlayerId(p.ID)] = true
	}
	for playerId := range points {
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

	history := models.ScoreHistory{
		PointsPerQuestion: labels,
		Series:            make([]models.ScoreHistorySeries, 0, len(players)+len(scoreOnly)),
	}
	appendSeries := func(player models.Player) {
		playerId := models.PlayerId(player.ID)
		cumulative := make([]float64, len(axis))
		run := 0.0
		for i := range axis {
			run += points[playerId][i]
			cumulative[i] = run
		}

		var series models.ScoreHistorySeries
		series.TeamName = player.TeamName
		series.Icon = player.Icon
		series.Active = player.Active
		series.Cumulative = cumulative

		// add playerId for the caller (or everyone if called as mod)
		if callerPlayerId == player.ID || models.PlayerId(callerPlayerId) == session.Moderator {
			series.PlayerId = playerId
		}
		history.Series = append(history.Series, series)
	}

	for _, player := range players {
		appendSeries(player)
	}
	for _, player := range scoreOnly {
		appendSeries(player)
	}

	return history, nil
}
