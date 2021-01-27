package models

import (
	"encoding/json"
	"github.com/globalsign/mgo/bson"
	"time"
)

type PlayerList struct {
	PlayerIds []string `bson:"players"`
}

type Player struct {
	ID         bson.Binary `bson:"_id" json:"id,omitempty"`
	CreateDate time.Time   `bson:"create_date" json:"create_date"`
	TeamName   string      `bson:"team_name" json:"team_name"`
	RealName   string      `bson:"real_name" json:"real_name"`
	Icon       string      `bson:"icon" json:"icon"`
	SessionId  string      `bson:"session_id" json:"session_id"`
}

func (p Player) SetCreateDate(createDate time.Time) Object {
	p.CreateDate = createDate
	return p
}

func (p Player) SetId(objectId bson.Binary) Object {
	p.ID = objectId
	return p
}

func (p Player) MarshalJSON() ([]byte, error) {
	type Alias Player
	return json.Marshal(&struct {
		ID         string `json:"id"`
		CreateDate string `json:"create_date"`
		Alias
	}{
		ID:         IdAsString(p.ID),
		CreateDate: dateFormat(p.CreateDate),
		Alias:      (Alias)(p),
	})
}
