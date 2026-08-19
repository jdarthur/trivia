package models

import (
	"encoding/json"
	"time"
)

var RoundsUsed = "rounds_used"

type Question struct {
	ID          string    `json:"id"`
	CreateDate  time.Time `json:"create_date"`
	Category    string    `json:"category" form:"category"`
	Question    string    `json:"question" form:"question"`
	Answer      string    `json:"answer" form:"answer"`
	RoundsUsed  []string  `json:"rounds_used" form:"rounds_used"`
	UserId      string    `json:"user_id"`
	ScoringNote string    `json:"scoring_note" form:"scoring_note"`
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
