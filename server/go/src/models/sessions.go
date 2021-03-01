package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var Players = "players"
var Answers = "answers"
var GameId = "game_id"
var ModeratorId = "mod"
var Started = "started"
var CurrentRound = "current_round"
var CurrentQuestion = "current_question"
var Scoreboard = "scoreboard"
var QuestionIndex = "question_id"
var RoundIndex = "round_id"

type Session struct {
	ID              bson.Binary            `bson:"_id" json:"id"`
	CreateDate      time.Time              `bson:"create_date" json:"create_date"`
	Name            string                 `json:"name"`
	GameId          string                 `bson:"game_id" json:"game_id,omitempty"`
	Moderator       PlayerId               `bson:"mod" json:"mod,omitempty"`
	Started         bool                   `json:"started"`
	Rounds          []RoundInGame          `json:"rounds,omitempty"`
	CurrentRound    *int                   `bson:"current_round" json:"current_round,omitempty"`
	CurrentQuestion *int                   `bson:"current_question" json:"current_question,omitempty"`
	Scoreboard      map[PlayerId][]float64 `bson:"scoreboard" json:"scoreboard,omitempty"`
	Players         []PlayerId             `bson:"players" json:"players,omitempty"`
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

type PlayerId string
type AnswerId string

func (p PlayerId) String() string {
	return string(p)
}

type QuestionInRound struct {
	Category      string                  `json:"category,omitempty"`
	Question      string                  `json:"question,omitempty"`
	Answer        string                  `json:"answer,omitempty"`
	PlayerAnswers map[PlayerId][]AnswerId `bson:"answers" json:"answers,omitempty"`
	Scored        bool                    `json:"scored,omitempty"`
	Index         int                     `bson:"-" json:"id"`
	QuestionId    string                  `bson:"question_id" json:"-"`
}

type ScoreRequest struct {
	QuestionIndex int                       `json:"question_index"`
	RoundIndex    int                       `json:"round_index"`
	ModeratorId   PlayerId                  `json:"player_id"`
	Players       map[PlayerId]CorrectorNot `json:"players"`
}

type CorrectorNot struct {
	Correct       bool     `json:"correct"`
	ScoreOverride *float64 `json:"score_override"`
}
