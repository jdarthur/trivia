package models

import (
	"encoding/json"
	"time"
)

var Questions = "questions"
var Games = "games"
var Wagers = "wagers"

type Round struct {
	ID         string    `json:"id"`
	CreateDate time.Time `json:"create_date"`
	Name       string    `json:"name"`
	Questions  []string  `json:"questions"`
	Wagers     []int     `json:"wagers"`
	Games      []string  `json:"games"`
	UserId     string    `json:"user_id"`
}

func (r Round) SetCreateDate(createDate time.Time) Object {
	r.CreateDate = createDate
	return r
}

func (r Round) SetId(objectId string) Object {
	r.ID = objectId
	return r
}

// IsRecordInUse reports whether any game contains this round (models.InUse).
// Games is derived from the game_round join table, so this is the same rule the
// list API applies in SQL (common.unusedClause).
func (r Round) IsRecordInUse() bool {
	return len(r.Games) > 0
}

func (r Round) MarshalJSON() ([]byte, error) {
	type Alias Round
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(r.CreateDate),
		Alias:      Alias(r),
	})
}
