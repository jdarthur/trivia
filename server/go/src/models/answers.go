package models

import (
	"encoding/json"
	"time"
)

var Correct = "correct"
var PlayerIdParam = "player_id"
var Wager = "wager"

type Answer struct {
	ID            string    `json:"id"`
	CreateDate    time.Time `json:"create_date"`
	QuestionIndex *int      `json:"question_id,omitempty" binding:"required"`
	RoundIndex    *int      `json:"round_id,omitempty" binding:"required"`
	PlayerId      PlayerId  `json:"player_id" binding:"required"`
	Answer        string    `json:"answer" binding:"required"`
	Wager         int       `json:"wager" binding:"required"`
	UseMoneyball  bool      `json:"use_moneyball,omitempty"`
	Correct       bool      `json:"correct,omitempty"`
	PointsAwarded float64   `json:"points_awarded,omitempty"`
	// SessionId is set server-side on create; it is not part of the API.
	SessionId string `json:"-"`
}

func (a Answer) SetCreateDate(createDate time.Time) Object {
	a.CreateDate = createDate
	return a
}

func (a Answer) SetId(objectId string) Object {
	a.ID = objectId
	return a
}

func (a Answer) MarshalJSON() ([]byte, error) {
	type Alias Answer
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(a.CreateDate),
		Alias:      Alias(a),
	})
}

type AnswersResponseUnscored struct {
	Scored  bool             `json:"scored"`
	Answers []AnswerUnscored `json:"answers"`
}

type AnswerUnscored struct {
	TeamName string   `json:"team_name"`
	Icon     string   `json:"icon"`
	Answered bool     `json:"answered"`
	PlayerId PlayerId `json:"player_id,omitempty"`
	Active   bool     `json:"active,omitempty"`
}

type AnswersResponseScored struct {
	Scored  bool         `json:"scored"`
	Answers []ScoredTeam `json:"answers"`
}

type ScoredTeam struct {
	TeamName string         `json:"team_name"`
	Icon     string         `json:"icon"`
	PlayerId PlayerId       `json:"player_id,omitempty"`
	Active   bool           `json:"active,omitempty"`
	Answers  []ScoredAnswer `json:"answers"`
}

type ScoredAnswer struct {
	Wager         int     `json:"wager"`
	UseMoneyball  bool    `json:"use_moneyball"`
	Correct       bool    `json:"correct"`
	PointsAwarded float64 `json:"points_awarded"`
	Answer        string  `json:"answer"`
}
