package models

import (
	"fmt"
	"time"
)

type Object interface {
	SetId(objectId string) Object
	SetCreateDate(createDate time.Time) Object
}

// dateFormat is the API's historical timestamp wire format — a UTC-naive
// "2006-01-02T15:04:05.000000" string. The SQLite columns store the same
// format (common.formatTime), so the wire and storage formats stay identical
// and clients keep receiving the timestamps they got from the mgo era.
func dateFormat(t time.Time) string {
	return t.Format("2006-01-02T15:04:05.000000")
}

//Error when you attempt to set a read-only array in this API
type AttemptedToSetError struct {
	IllegalField string
	Value interface{}
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
