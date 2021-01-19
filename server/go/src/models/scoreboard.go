package models

type PlayerScore struct {
	Icon     string `bson:"icon" json:"icon,omitempty"`
	Score    []int  `bson:"score" json:"score"`
	TeamName string `bson:"team_name" json:"team_name"`
	PlayerId string `json:"player_id,omitempty"`
}

type PlayerScoreboard struct {
	Scores   []PlayerScore `json:"scores"`
}
