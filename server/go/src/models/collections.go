package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var QuestionIds = "questions"

type Collection struct {
	ID           bson.Binary `bson:"_id" json:"id"`
	Name         string      `json:"name"`
	CreateDate   time.Time   `bson:"create_date" json:"create_date"`
	Questions    []string    `json:"questions"`
	QuestionData []Question  `json:"question_data"`
	UserId       string      `json:"user_id" bson:"user_id"`
}

func (c Collection) SetCreateDate(createDate time.Time) Object {
	c.CreateDate = createDate
	return c
}

func (c Collection) SetId(objectId bson.Binary) Object {
	c.ID = objectId
	return c
}

func (c Collection) MarshalJSON() ([]byte, error) {
	type Alias Collection
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(c.ID),
		CreateDate: dateFormat(c.CreateDate),
		Alias:      (Alias)(c),
	})
}
