package models

import (
	"encoding/json"
	"time"
)

var Players = "players"
var GameId = "game_id"
var ModeratorId = "mod"
var Started = "started"
var CurrentRound = "current_round"
var CurrentQuestion = "current_question"
var Scoreboard = "scoreboard"
var QuestionIndex = "question_id"
var RoundIndex = "round_id"

type Session struct {
	ID              string                 `json:"id"`
	CreateDate      time.Time              `json:"create_date"`
	Name            string                 `json:"name"`
	GameId          string                 `json:"game_id,omitempty"`
	Moderator       PlayerId               `json:"mod,omitempty"`
	Started         bool                   `json:"started"`
	Rounds          []RoundInGame          `json:"rounds,omitempty"`
	CurrentRound    *int                   `json:"current_round,omitempty"`
	CurrentQuestion *int                   `json:"current_question,omitempty"`
	Scoreboard      map[PlayerId][]float64 `json:"scoreboard,omitempty"`
	Players         []PlayerId             `json:"players,omitempty"`
}

func (s Session) SetCreateDate(createDate time.Time) Object {
	s.CreateDate = createDate
	return s
}

func (s Session) SetId(objectId string) Object {
	s.ID = objectId
	return s
}

func (s Session) MarshalJSON() ([]byte, error) {
	type Alias Session
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(s.CreateDate),
		Alias:      Alias(s),
	})
}

type RoundInGame struct {
	RoundId   string            `json:"round_id,omitempty"`
	Wagers    []int             `json:"wagers,omitempty"`
	Questions []QuestionInRound `json:"questions,omitempty"`
}

type PlayerId string

func (p PlayerId) String() string {
	return string(p)
}

type QuestionInRound struct {
	Category      string   `json:"category,omitempty"`
	Question      string   `json:"question,omitempty"`
	Answer        string   `json:"answer,omitempty"`
	Scored        bool     `json:"scored,omitempty"`
	Index         int      `json:"id"`
	QuestionId    string   `json:"-"`
	ScoringNote   string   `json:"scoring_note"`
	ScoringNoteId string   `json:"scoring_note_id"`
	QuestionType  string   `json:"question_type"`
	Choices       []string `json:"choices,omitempty"` // MC: option texts, NO is_correct
	Lefts         []string `json:"lefts,omitempty"`   // matching: column A
	Rights        []string `json:"rights,omitempty"`  // matching: column B
	Buckets       []string `json:"buckets,omitempty"` // bucketing: bucket names
	Items         []string `json:"items,omitempty"`   // bucketing: item texts
	// ItemBuckets is the item -> bucket mapping, parallel to Items (same
	// index). It is the bucketing answer key: hidden from players pre-score
	// (like Answer), served to the mod and to everyone once scored.
	ItemBuckets []string `json:"item_buckets,omitempty"`
	Ordered     []string `json:"ordered,omitempty"` // ordering: canonical order (shuffled pre-score)
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
