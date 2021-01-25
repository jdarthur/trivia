package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var Correct = "correct"
var PlayerIdParam = "player_id"
var Wager = "wager"

type Answer struct {
	ID            bson.Binary `bson:"_id" json:"id"`
	CreateDate    time.Time   `bson:"create_date" json:"create_date"`
	QuestionIndex *int        `bson:"-" json:"question_id" binding:"required"`
	RoundIndex    *int        `bson:"-" json:"round_id" binding:"required"`
	PlayerId      string      `bson:"player_id" json:"player_id" binding:"required"`
	Answer        string      `bson:"answer" json:"answer" binding:"required"`
	Wager         int         `bson:"wager" json:"wager" binding:"required"`
	Correct       bool        `bson:"correct" json:"correct,omitempty"`
	PointsAwarded float64 `bson:"points_awarded" json:"points_awarded,omitempty"`
}

func (a Answer) SetCreateDate(createDate time.Time) Object {
	a.CreateDate = createDate
	return a
}

func (a Answer) SetId(objectId bson.Binary) Object {
	a.ID = objectId
	return a
}

func (a Answer) MarshalJSON() ([]byte, error) {
	type Alias Answer
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(a.ID),
		CreateDate: dateFormat(a.CreateDate),
		Alias:      (Alias)(a),
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
}

type AnswersResponseScored struct {
	Scored  bool         `json:"scored"`
	Answers []ScoredTeam `json:"answers"`
}

type ScoredTeam struct {
	TeamName string   `json:"team_name"`
	Icon     string   `json:"icon"`
	PlayerId PlayerId `json:"player_id,omitempty"`
	Answers  []ScoredAnswer
}

type ScoredAnswer struct {
	Wager         int         `json:"wager"`
	Correct       bool        `json:"correct"`
	PointsAwarded float64 `json:"points_awarded"`
}
