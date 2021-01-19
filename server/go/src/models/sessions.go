package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var Players = "players"
var GameId = "game_id"
var ModeratorId = "moderator_id"

type Session struct {
	ID              bson.Binary      `bson:"_id" json:"id"`
	CreateDate      time.Time        `bson:"create_date" json:"create_date"`
	Name            string           `json:"name"`
	GameId          string           `bson:"game_id" json:"game_id,omitempty"`
	Moderator       string           `bson:"mod" json:"mod,omitempty"`
	Started         bool             `json:"started"`
	Rounds          []RoundInGame    `json:"rounds,omitempty"`
	CurrentRound    int              `bson:"current_round" json:"current_round,omitempty"`
	CurrentQuestion int              `bson:"current_question" json:"current_question,omitempty"`
	Scoreboard      map[string][]int `bson:"scoreboard" json:"scoreboard,omitempty"` //map[PlayerId][...PointsAwarded]
	Players			[]string		 `bson:"players" json:"players,omitempty"` //[]PlayerId
}

func (s Session) SetCreateDate(createDate time.Time) Object {
	s.CreateDate = createDate
	return s
}

func (s Session) SetId(objectId bson.Binary) Object {
	s.ID = objectId
	return s
}

func (s Session) MarshalJSON() ([]byte, error) {
	type Alias Session
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(s.ID),
		CreateDate: dateFormat(s.CreateDate),
		Alias:      (Alias)(s),
	})
}

type RoundInGame struct {
	RoundId   string            `bson:"round_id" json:"round_id,omitempty"`
	Wagers    []int             `json:"wagers,omitempty"`
	Questions []QuestionInRound `json:"questions,omitempty"`
}

type QuestionInRound struct {
	Category      string              `json:"category,omitempty"`
	Question      string              `json:"question,omitempty"`
	Answer        string              `json:"answer,omitempty"`
	PlayerAnswers map[string][]string `bson:"answers" json:"answers,omitempty"` //map[PlayerId][...AnswerIds]
	Scored        bool                `json:"scored,omitempty"`
}

type UnauthorizedSession struct {
	ID              bson.Binary      `bson:"_id" json:"id"`
	CreateDate      time.Time        `bson:"create_date" json:"create_date"`
	Name            string           `json:"name"`
	Started         bool             `json:"started"`
	Rounds          []RoundInGame    `json:"rounds,omitempty"`
	CurrentRound    int              `bson:"current_round" json:"current_round,omitempty"`
	CurrentQuestion int              `bson:"current_question" json:"current_question,omitempty"`
	Scoreboard      map[string][]int `bson:"scoreboard" json:"scoreboard,omitempty"`
}
