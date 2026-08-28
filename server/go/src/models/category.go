package models

import (
	"encoding/json"
	"time"
)

// Category is a root model (ticket #179, part of #167): a named bucket a
// question belongs to, with an optional associated scoring note. The
// per-question scoring note is gone — a question's note comes from its
// category. Wire format keeps the historical `scoring_note` field name (a
// note ID, "" = none), consistent with the old Question.scoring_note; the
// column is scoring_note_id.
type Category struct {
	ID          string    `json:"id"`
	UserId      string    `json:"-"`
	CreateDate  time.Time `json:"create_date"`
	Name        string    `json:"name"`
	ScoringNote string    `json:"scoring_note"`

	// QuestionsUsed is derived from question.category_id (never settable): the
	// number of questions that reference this category. It backs
	// IsRecordInUse and lets the editor show/filter unused categories without a
	// second request per category.
	QuestionsUsed int `json:"questions_used"`
}

// IsRecordInUse reports whether any question references this category
// (models.InUse). The list API's unused_only param applies the same rule in SQL
// (common.unusedClause).
func (c Category) IsRecordInUse() bool {
	return c.QuestionsUsed > 0
}

func (c Category) SetCreateDate(createDate time.Time) Object {
	c.CreateDate = createDate
	return c
}

func (c Category) SetId(objectId string) Object {
	c.ID = objectId
	return c
}

func (c Category) MarshalJSON() ([]byte, error) {
	type Alias Category
	return json.Marshal(&struct {
		CreateDate string `json:"create_date"`
		Alias
	}{
		CreateDate: dateFormat(c.CreateDate),
		Alias:      Alias(c),
	})
}
