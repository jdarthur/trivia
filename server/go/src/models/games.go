package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

var Rounds = "rounds"
var RoundNames = "round_names"

type Game struct {
	ID         bson.Binary       `bson:"_id" json:"id"`
	CreateDate time.Time         `bson:"create_date" json:"create_date"`
	Name       string            `json:"name"`
	Rounds     []string          `json:"rounds"`
	RoundNames map[string]string `bson:"round_names" json:"round_names"`
	UserId     string            `bson:"user_id"`
}

func (g Game) SetCreateDate(createDate time.Time) Object {
	g.CreateDate = createDate
	return g
}

func (g Game) SetId(objectId bson.Binary) Object {
	g.ID = objectId
	return g
}

func (g Game) MarshalJSON() ([]byte, error) {
	type Alias Game
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(g.ID),
		CreateDate: dateFormat(g.CreateDate),
		Alias:      (Alias)(g),
	})
}
