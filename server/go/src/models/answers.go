package models

import (
	"encoding/json"
	"time"
)

var Correct = "correct"
var PlayerIdParam = "player_id"
var Wager = "wager"
var AnswerIdParam = "answer_id"
var Emoji = "emoji"

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
	Wager         int            `json:"wager"`
	UseMoneyball  bool           `json:"use_moneyball"`
	Correct       bool           `json:"correct"`
	PointsAwarded float64        `json:"points_awarded"`
	Answer        string         `json:"answer"`
	// AnswerId lets clients target a reaction at a specific answer (a player
	// may have submitted more than one for a question). Reactions are the
	// emoji counts on that answer; MyReaction is the caller's own emoji, so
	// the UI can highlight their selection without broadcasting who reacted
	// (the scored view only ever exposes the caller's own player_id).
	AnswerId   string         `json:"answer_id"`
	Reactions  map[string]int `json:"reactions"`
	MyReaction string         `json:"my_reaction,omitempty"`
}

// AnswerReaction is one emoji reaction by one player to one answer. The
// answer_reaction table's UNIQUE(answer_id, player_id) constraint guarantees
// at most one row per (answer, player), so modifying is an UPDATE on the same
// row and removing is a DELETE.
type AnswerReaction struct {
	ID         string    `json:"id"`
	CreateDate time.Time `json:"create_date"`
	AnswerId   string    `json:"answer_id"`
	PlayerId   PlayerId  `json:"player_id"`
	Emoji      string    `json:"emoji"`
}

func (r AnswerReaction) SetCreateDate(createDate time.Time) Object {
	r.CreateDate = createDate
	return r
}

func (r AnswerReaction) SetId(objectId string) Object {
	r.ID = objectId
	return r
}

func (r AnswerReaction) MarshalJSON() ([]byte, error) {
	type Alias AnswerReaction
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(r.CreateDate),
		Alias:      Alias(r),
	})
}
