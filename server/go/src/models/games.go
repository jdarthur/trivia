package models

import (
	"encoding/json"
	"time"
)

var Rounds = "rounds"
var RoundNames = "round_names"

type Game struct {
	ID         string            `json:"id"`
	CreateDate time.Time         `json:"create_date"`
	Name       string            `json:"name"`
	Rounds     []string          `json:"rounds"`
	RoundNames map[string]string `json:"round_names"`
	UserId     string            `json:"user_id"`
}

func (g Game) SetCreateDate(createDate time.Time) Object {
	g.CreateDate = createDate
	return g
}

func (g Game) SetId(objectId string) Object {
	g.ID = objectId
	return g
}

func (g Game) MarshalJSON() ([]byte, error) {
	type Alias Game
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(g.CreateDate),
		Alias:      Alias(g),
	})
}
