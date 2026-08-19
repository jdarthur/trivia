package models

import (
	"encoding/json"
	"time"
)

type ScoringNote struct {
	ID          string    `json:"id"`
	UserId      string    `json:"-"`
	CreateDate  time.Time `json:"create_date"`
	LastUsed    time.Time `json:"last_used"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
}

func (s ScoringNote) SetCreateDate(createDate time.Time) Object {
	s.CreateDate = createDate
	return s
}

func (s ScoringNote) SetId(objectId string) Object {
	s.ID = objectId
	return s
}

func (s ScoringNote) MarshalJSON() ([]byte, error) {
	type Alias ScoringNote
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		LastUsed   string `json:"last_used"`
		Alias
	}{
		CreateDate: dateFormat(s.CreateDate),
		LastUsed:   dateFormat(s.LastUsed),
		Alias:      Alias(s),
	})
}
