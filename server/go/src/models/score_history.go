package models

// ScoreHistorySeries is one team's line on the score-history chart: a running
// sum of the player's latest points_awarded per question, in axis order. A
// question the player skipped (or that hasn't been scored yet) keeps the line
// flat rather than shifting it left.
type ScoreHistorySeries struct {
	TeamName   string    `json:"team_name"`
	Icon       string    `json:"icon,omitempty"`
	PlayerId   PlayerId  `json:"player_id,omitempty"`
	Active     bool      `json:"active,omitempty"`
	Cumulative []float64 `json:"cumulative"`
}

// ScoreHistory is the response of GET /gameplay/session/:id/score-history
// (ticket #234). PointsPerQuestion labels the shared x-axis ("R1Q1", "R1Q2",
// ...); every series covers exactly those points so the lines stay comparable.
type ScoreHistory struct {
	PointsPerQuestion []string             `json:"points_per_question"`
	Series            []ScoreHistorySeries `json:"series"`
}
