package models

import (
	"encoding/json"
	"time"
)

var RoundsUsed = "rounds_used"
var QuestionType = "question_type"
var Choices = "choices"
var Pairs = "pairs"

type Question struct {
	ID          string    `json:"id"`
	CreateDate  time.Time `json:"create_date"`
	Category    string    `json:"category" form:"category"`
	Question    string    `json:"question" form:"question"`
	Answer      string    `json:"answer" form:"answer"`
	RoundsUsed  []string  `json:"rounds_used" form:"rounds_used"`
	UserId      string    `json:"user_id"`
	ScoringNote string    `json:"scoring_note" form:"scoring_note"`

	QuestionType string           `json:"question_type" form:"question_type"` // freeform|multiple_choice|matching
	Choices      []QuestionChoice `json:"choices,omitempty"`                 // multiple_choice
	Pairs        []QuestionPair   `json:"pairs,omitempty"`                   // matching
}

type QuestionChoice struct {
	Text      string `json:"text"`
	IsCorrect bool   `json:"is_correct"`
}

type QuestionPair struct {
	Left  string `json:"left"`
	Right string `json:"right"`
}

func (q Question) SetCreateDate(createDate time.Time) Object {
	q.CreateDate = createDate
	return q
}

func (q Question) SetId(objectId string) Object {
	q.ID = objectId
	return q
}

func (q Question) MarshalJSON() ([]byte, error) {
	type Alias Question
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(q.CreateDate),
		Alias:      Alias(q),
	})
}
