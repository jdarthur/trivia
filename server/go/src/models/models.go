package models

import (
	"fmt"
	"time"
)

type Object interface {
	SetId(objectId string) Object
	SetCreateDate(createDate time.Time) Object
}

// InUse is implemented by models that other records can reference, and whose
// "unused" state is therefore derivable from their membership fields:
// a question is used when some round contains it (Question.RoundsUsed), a
// round when some game contains it (Round.Games), and a category when some
// question points at it (Category.QuestionsUsed).
//
// This is the single definition of "in use" in the codebase. The list API
// filters unused records in SQL (common.unusedClause) so pagination stays
// correct, and that clause is kept in sync with these methods by a test that
// cross-checks the two definitions (test/pagination_test.go).
type InUse interface {
	IsRecordInUse() bool
}

// FilterUnused pares an already-loaded list down to the records that nothing
// else references — the in-memory counterpart of the API's unused_only query
// param (ticket #195). Use it when the list is in hand anyway; for a list you
// are about to fetch, filter in the query instead (common.GetAllPaged) so you
// don't load the records you're going to throw away.
func FilterUnused[T InUse](items []T) []T {
	unused := make([]T, 0, len(items))
	for _, item := range items {
		if !item.IsRecordInUse() {
			unused = append(unused, item)
		}
	}
	return unused
}

// dateFormat is the API's historical timestamp wire format — a UTC-naive
// "2006-01-02T15:04:05.000000" string. The SQLite columns store the same
// format (common.formatTime), so the wire and storage formats stay identical
// and clients keep receiving the timestamps they got from the mgo era.
func dateFormat(t time.Time) string {
	return t.Format("2006-01-02T15:04:05.000000")
}

// Error when you attempt to set a read-only array in this API
type AttemptedToSetError struct {
	IllegalField string
	Value        interface{}
}

func (e AttemptedToSetError) Error() string {
	return "Attempted to set field: " + e.IllegalField + " (value: " + fmt.Sprintf("%v", e.Value) + ")"
}

func (e AttemptedToSetError) Field() string {
	return e.IllegalField
}

func (e AttemptedToSetError) Data() interface{} {
	return e.Value
}
