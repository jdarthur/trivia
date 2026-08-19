package models

type PlayerScore struct {
	Icon     string    `json:"icon,omitempty"`
	Score    []float64 `json:"score"`
	TeamName string    `json:"team_name"`
	PlayerId PlayerId  `json:"player_id,omitempty"`
}

type PlayerScoreboard struct {
	Scores   []PlayerScore `json:"scores"`
}
