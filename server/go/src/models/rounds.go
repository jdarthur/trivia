package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var Questions = "questions"
var Games = "games"
var Wagers = "wagers"

type Round struct {
	ID         bson.Binary `bson:"_id" json:"id"`
	CreateDate time.Time   `bson:"create_date" json:"create_date"`
	Name       string      `json:"name"`
	Questions  []string    `json:"questions"`
	Wagers     []int       `json:"wagers"`
	Games      []string    `json:"games"`
}

func (r Round) SetCreateDate(createDate time.Time) Object {
	r.CreateDate = createDate
	return r
}

func (r Round) SetId(objectId bson.Binary) Object {
	r.ID = objectId
	return r
}

func (r Round) MarshalJSON() ([]byte, error) {
	type Alias Round
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(r.ID),
		CreateDate: dateFormat(r.CreateDate),
		Alias:      (Alias)(r),
	})
}
