package models

import (
	"encoding/json"
	"time"
)

var QuestionIds = "questions"

type Collection struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	CreateDate   time.Time  `json:"create_date"`
	Questions    []string   `json:"questions"`
	QuestionData []Question `json:"question_data"`
	UserId       string     `json:"user_id"`
}

func (c Collection) SetCreateDate(createDate time.Time) Object {
	c.CreateDate = createDate
	return c
}

func (c Collection) SetId(objectId string) Object {
	c.ID = objectId
	return c
}

func (c Collection) MarshalJSON() ([]byte, error) {
	type Alias Collection
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(c.CreateDate),
		Alias:      Alias(c),
	})
}
