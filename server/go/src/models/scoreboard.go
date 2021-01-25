package models

type PlayerScore struct {
	Icon     string `bson:"icon" json:"icon,omitempty"`
	Score    []float64  `bson:"score" json:"score"`
	TeamName string `bson:"team_name" json:"team_name"`
	PlayerId PlayerId	 `json:"player_id,omitempty"`
}

type PlayerScoreboard struct {
	Scores   []PlayerScore `json:"scores"`
}
