package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var RoundsUsed = "rounds_used"

type Question struct {
	ID         bson.Binary `bson:"_id" json:"id"`
	CreateDate time.Time   `bson:"create_date" json:"create_date""`
	Category   string      `json:"category" form:"category"`
	Question   string      `json:"question" form:"question"`
	Answer     string      `json:"answer" form:"answer"`
	RoundsUsed []string    `bson:"rounds_used" json:"rounds_used" form:"rounds_used"`
	UserId     string      `bson:"user_id"`
}

func (q Question) SetCreateDate(createDate time.Time) Object {
	q.CreateDate = createDate
	return q
}

func (q Question) SetId(objectId bson.Binary) Object {
	q.ID = objectId
	return q
}

func (q Question) MarshalJSON() ([]byte, error) {
	type Alias Question
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(q.ID),
		CreateDate: dateFormat(q.CreateDate),
		Alias:      (Alias)(q),
	})
}
