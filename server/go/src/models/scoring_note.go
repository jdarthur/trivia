package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

type ScoringNote struct {
	ID          bson.Binary `bson:"_id" json:"id"`
	UserId      string      `bson:"user_id" json:"-"`
	CreateDate  time.Time   `bson:"create_date" json:"create_date"`
	LastUsed    time.Time   `bson:"last_used" json:"last_used"`
	Name        string      `bson:"name" json:"name"`
	Description string      `bson:"description" json:"description"`
}

func (s ScoringNote) SetCreateDate(createDate time.Time) Object {
	s.CreateDate = createDate
	return s
}

func (s ScoringNote) SetId(objectId bson.Binary) Object {
	s.ID = objectId
	return s
}

func (s ScoringNote) MarshalJSON() ([]byte, error) {
	type Alias ScoringNote
	return json.Marshal(&struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
		CreateDate  string `json:"create_date"`
		LastUsed    string `json:"last_used"`
		Alias
	}{
		ID:          IdAsString(s.ID),
		Name:        s.Name,
		Description: s.Description,
		CreateDate:  dateFormat(s.CreateDate),
		LastUsed:    dateFormat(s.LastUsed),
		Alias:       (Alias)(s),
	})
}
