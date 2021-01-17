package models

import (
	"encoding/hex"
	"fmt"
	"github.com/globalsign/mgo/bson"
	"github.com/google/uuid"
	"strings"
	"time"
)

type Object interface {
	SetId(objectId bson.Binary) Object
	SetCreateDate(createDate time.Time) Object
}

// convert bson.Binary (subType 3) into a UUID
func IdAsString(objectId bson.Binary) string {
	if objectId.Kind == 3 {
		str123 := hex.EncodeToString(objectId.Data)
		u, _ := uuid.Parse(str123)
		return u.String()
	}
	return ""
}
func NewId() (bson.Binary, error) {
	id := bson.Binary{}
	newUUID := strings.Replace(uuid.New().String(), "-", "", -1)
	str123, err := hex.DecodeString(newUUID)
	if err != nil {
		return id, err
	}

	id.Kind = 3
	id.Data = str123
	return id, nil
}

func dateFormat(time time.Time) string {
	return time.Format("2006-01-02T15:04:05.000000")
}

//Error when you attempt to set a read-only array in this API
type AttemptedToSetError struct {
	IllegalField string
	Value interface{}
}

func (e AttemptedToSetError) Error() string {
	return "Attempted to set field: " + e.IllegalField + "(value: " + fmt.Sprintf("%v", e.Value) + ")"
}

func (e AttemptedToSetError) Field() string {
	return Games
}

func (e AttemptedToSetError) Data() interface{} {
	return e.Value
}
