package models

import (
	"encoding/json"
	"time"
)

type PlayerList struct {
	PlayerIds []string `json:"players"`
}

type Player struct {
	ID         string    `json:"id,omitempty"`
	CreateDate time.Time `json:"create_date"`
	TeamName   string    `json:"team_name"`
	RealName   string    `json:"real_name"`
	Icon       string    `json:"icon"`
	// Active is populated on session-roster reads only (session_player.active);
	// the global player table has no such column, so editor reads leave it false
	// and omitempty keeps it off the wire.
	Active bool `json:"active,omitempty"`
}

func (p Player) SetCreateDate(createDate time.Time) Object {
	p.CreateDate = createDate
	return p
}

func (p Player) SetId(objectId string) Object {
	p.ID = objectId
	return p
}

func (p Player) MarshalJSON() ([]byte, error) {
	type Alias Player
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(p.CreateDate),
		Alias:      Alias(p),
	})
}
