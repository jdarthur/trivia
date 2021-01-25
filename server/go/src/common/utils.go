package common

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo"
	"github.com/globalsign/mgo/bson"
	"github.com/go-playground/validator"
	"log"
	"models"
	"net/http"
	"reflect"
	"strings"
	"time"
)

var Database = "trivia"
var QuestionTable = "question"
var RoundTable = "round"
var GameTable = "game"
var SessionTable = "session"
var PlayerTable = "player"
var AnswerTable = "answer"

type Env struct {
	Db *mgo.Session
}

//=====================================
//=====================================
//           Custom Errors
//=====================================
//=====================================
type InvalidDataError interface {
	Field() string
	Data() interface{}
	Error() string
}

// Error thrown when record of type RecordType with ID is not found
type NonexistentIdError struct {
	ID         string // valid UUID
	RecordType string // record type, e.g. QuestionTable or RoundTable
}

func (e NonexistentIdError) Error() string {
	return "Invalid " + e.RecordType + " ID: " + e.ID
}

// Error thrown when attempting to
// convert an invalid UUID string to bson.Binary
type InvalidUUIDError struct {
	ID string // UUID that is invalid
}

func (e InvalidUUIDError) Error() string {
	return "Invalid UUID: " + e.ID
}

//=====================================
//=====================================
//           DB Methods
//=====================================
//=====================================

// Get one record of a certain type by ID
//
// args:
//	  e: Environment (i.e. mongo session)
//	  objectType: mongo collection (e.g. 'question' or 'round')
//	  objectId: id of record in UUID form
//	  model: struct representing data model e.g. models.Question
//		    --> this struct must be passed as pointer and is updated in place
// returns errors (if any):
//    InvalidUUIDError
//    NonexistentIdError: if record
func GetOne(e *Env, objectType string, objectId string, model models.Object) error {
	filter, err := byId(objectId)
	if err != nil {
		return err
	}

	//set MongoDB database & record type
	collection := e.Db.DB(Database).C(objectType)

	//find matching item
	err = collection.FindId(filter).One(model)
	if err != nil {
		if err == mgo.ErrNotFound {
			return NonexistentIdError{RecordType: objectType, ID: objectId}
		}
		return err
	}

	return nil
}

// Create a record
//
// args:
//	  e: Environment (i.e. mongo session)
//	  objectType: mongo collection (e.g. 'question' or 'round')
//	  model: struct representing data model e.g. models.Question
//		    --> this struct must be passed as pointer and is updated in place
// returns:
//    newly generated ID, create date, errors (if any)
func Create(e *Env, objectType string, data models.Object) (bson.Binary, time.Time, error) {

	//create date for this object is rn
	createDate := time.Now()

	//create a UUID for new object
	id, err := models.NewId()
	if err != nil {
		return id, time.Now(), err
	}
	data = data.SetId(id)
	data = data.SetCreateDate(createDate)

	//set MongoDB database & record type
	collection := e.Db.DB(Database).C(objectType)

	//find all items of this record type
	err = collection.Insert(&data)
	if err != nil {
		return bson.Binary{}, time.Time{}, err
	}
	return id, createDate, nil
}

// update a record by ID
//
// args:
//	  e: Environment (i.e. mongo session)
//	  objectType: mongo collection (e.g. 'question' or 'round')
//    objectId: ID of record in UUID form
//    data: map of fields&values to set on record
// returns:
//    newly generated ID, create date, errors (if any)
func Set(e *Env, objectType string, objectId string, data interface{}) error {
	change := bson.M{"$set": data}
	return update(e, objectType, objectId, change)
}

// Add an item to a list on a specific record
//	  objectType: mongo collection (e.g. 'question' or 'round')
//    objectId: ID of record in UUID form
//    array: name of array to append to
//    value: value to append
func Push(e *Env, objectType string, objectId string, array string, value interface{}) error {
	change := bson.M{"$push": bson.M{array: value}}
	return update(e, objectType, objectId, change)
}

func Pull(e *Env, objectType string, objectId string, array string, value interface{}) error {
	change := bson.M{"$pull": bson.M{array: value}}
	return update(e, objectType, objectId, change)
}

func update(e *Env, objectType string, objectId string, change bson.M) error {
	filter, err := byId(objectId)
	if err != nil {
		return err
	}

	//set MongoDB database & record type
	collection := e.Db.DB(Database).C(objectType)

	fmt.Println("update: " + fmt.Sprint("%v", change))

	//update a record by ID
	err = collection.UpdateId(filter, change)
	if err != nil {
		if err == mgo.ErrNotFound {
			return NonexistentIdError{RecordType: objectType, ID: objectId}
		}
		return err
	}
	return nil
}

// Get all records of a certain type
//
// args:
//	  e: Environment (i.e. mongo session)
//	  objectType: mongo collection (e.g. 'question' or 'round')
// returns:
//    slice of type from 'objectType' arg; errors (if any)
func GetAll(e *Env, objectType string, filters interface{}) (interface{}, error) {

	var slice interface{}
	switch objectType {
	case QuestionTable:
		slice = make([]*models.Question, 0, 0)
	case RoundTable:
		slice = make([]*models.Round, 0, 0)
	case GameTable:
		slice = make([]*models.Game, 0, 0)
	case SessionTable:
		slice = make([]*models.Session, 0, 0)

	default:
		return nil, errors.New("invalid get all table: " + objectType)
	}

	//set MongoDB database & record type
	collection := e.Db.DB(Database).C(objectType)

	//find all items of this record type
	err := collection.Find(filters).All(&slice)
	if err != nil {
		return nil, err
	}

	return slice, nil
}

func Delete(e *Env, objectType string, objectId string) error {
	filter, err := byId(objectId)
	if err != nil {
		return err
	}

	//set MongoDB database & record type
	collection := e.Db.DB(Database).C(objectType)

	//find matching item
	err = collection.RemoveId(filter)
	if err != nil {
		if err == mgo.ErrNotFound {
			return NonexistentIdError{RecordType: objectType, ID: objectId}
		}
		return err
	}

	return nil
}

//=====================================
//=====================================
//              Utils
//=====================================
//=====================================

// create mongo by ID filter from string UUID
//
// throws InvalidUUIDError
func byId(id string) (bson.Binary, error) {
	fmt.Println(id)

	q123 := strings.Replace(id, "-", "", -1)
	objectId, err := hex.DecodeString(q123)
	if err != nil {
		return bson.Binary{}, InvalidUUIDError{ID: id}
	}

	return bson.Binary{Kind: bson.BinaryUUIDOld, Data: objectId}, nil
}

// Respond with data or an error
// args:
//    c: gin context
//    data: data from DB calls
//    err: error from DB calls
// responds with:
//    200 and data, if found
//    404 and error message if not found
func Respond(c *gin.Context, data interface{}, err error) {
	if err != nil {
		fmt.Println(err)
		switch t := err.(type) {
		case InvalidUUIDError:
			c.JSON(http.StatusNotFound, gin.H{"errors": t.Error()})
		case NonexistentIdError:
			c.JSON(http.StatusNotFound, gin.H{"errors": t.Error()})
		case *json.UnmarshalTypeError:
			e := "Invalid value for field '" + t.Field + "' (got: " + t.Value + ", required: " + t.Type.String() + ")"
			c.JSON(http.StatusBadRequest, gin.H{"errors": []string{e}})
		case InvalidDataError:
			fmt.Println("invalid data error")
			c.JSON(http.StatusBadRequest, gin.H{"errors": t.Error(), "field": t.Field()})
		case validator.ValidationErrors:
			fields := requiredErrorFields(t)
			c.JSON(http.StatusBadRequest, gin.H{"errors": "Missing required fields", "field": fields})

		default:
			fmt.Println(reflect.TypeOf(err))
			log.Fatal(err)
		}
	} else {
		c.JSON(http.StatusOK, data)
	}
}

func requiredErrorFields(errors validator.ValidationErrors) []string {
	fields := make([]string, 0)
	for _, validationError := range errors {
		if validationError.Tag() == "required" {
			fields = append(fields, validationError.Field())
		}
	}
	return fields
}

func IsValidQuestion(e *Env, questionId string) (interface{}, error) {
	var data models.Question
	fmt.Println("is valid question? id: " + questionId)
	err := GetOne(e, QuestionTable, questionId, data)

	if err != nil {
		switch t := err.(type) {
		case InvalidUUIDError:
			return nil, InvalidUUIDError{ID: t.ID}
		case NonexistentIdError:
			return nil, t
		}
	}
	fmt.Println("good 2 go")
	return data, nil
}

func IsValidRound(e *Env, roundId string) (interface{}, error) {
	var data models.Question
	err := GetOne(e, RoundTable, roundId, &data)

	if err != nil {
		return nil, NonexistentIdError{ID: roundId, RecordType: RoundTable}
	}
	return data, nil
}
