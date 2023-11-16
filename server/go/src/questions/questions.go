package questions

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo/bson"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"strings"
	"time"
)

type Env common.Env

func (e *Env) GetAllQuestions(c *gin.Context) {
	filter := createFilters(c)
	questions, err := common.GetAll((*common.Env)(e), common.QuestionTable, filter)
	common.Respond(c, gin.H{"questions": questions}, err)
}

func (e *Env) GetOneQuestion(c *gin.Context) {
	//get 'id' path param from query
	questionId := c.Param("id")
	userId := common.GetUserId(c)

	question, err := GetOneQuestion(e, userId, questionId)

	common.Respond(c, question, err)
}

func (e *Env) CreateQuestion(c *gin.Context) {

	var data models.Question
	data.RoundsUsed = make([]string, 0)

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	userId := common.GetUserId(c)

	question, err := CreateOneQuestion(e, userId, data)
	common.Respond(c, question, err)
}

func (e *Env) UpdateQuestion(c *gin.Context) {

	questionId := c.Param("id")
	var updateBody models.Question

	err := c.ShouldBind(&updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	userId := common.GetUserId(c)
	question, err := UpdateOneQuestion(e, userId, questionId, updateBody)

	common.Respond(c, question, err)
}

func (e *Env) DeleteQuestion(c *gin.Context) {
	questionId := c.Param("id")
	userId := common.GetUserId(c)

	question, err := DeleteOneQuestion(e, userId, questionId)

	common.Respond(c, question, err)
}

func (e *Env) deleteFromCollections(userId, targetQuestionId string) error {
	filter := map[string]string{"user_id": userId}

	collections, err := common.GetAll((*common.Env)(e), common.CollectionTable, filter)
	for _, collection := range collections.([]*models.Collection) {
		for _, questionId := range collection.Questions {
			if questionId == targetQuestionId {

				collectionId := models.IdAsString(collection.ID)

				if len(collection.Questions) == 1 {
					fmt.Println("no remaining questions... delete collection " + collectionId)
					err = common.Delete((*common.Env)(e), common.CollectionTable, collectionId)
					if err != nil {
						return err
					}
				} else {
					fmt.Println("remove question ID " + questionId + " from collection " + collectionId)
					err = common.Pull((*common.Env)(e), common.CollectionTable, collectionId, models.Questions, questionId)
				}
			}
		}
	}

	return nil
}

//Merge update body into existing question
func merge(update *models.Question, original *models.Question) {

	if update.Category != "" {
		original.Category = update.Category
	}
	if update.Question != "" {
		original.Question = update.Question
	}
	if update.Answer != "" {
		original.Answer = update.Answer
	}

	original.ScoringNote = update.ScoringNote
}

type AttemptedToSetRoundsUsedError struct {
	RoundsUsed interface{}
}

func (e AttemptedToSetRoundsUsedError) Error() string {
	return "Attempted to set field: 'rounds_used'"
}

func (e AttemptedToSetRoundsUsedError) Field() string {
	return models.RoundsUsed
}

func (e AttemptedToSetRoundsUsedError) Data() interface{} {
	return e.RoundsUsed
}

func GetAllQuestions(e *Env, userId string) ([]*models.Question, error) {
	filter := map[string]string{"user_id": userId}
	data, err := common.GetAll((*common.Env)(e), common.QuestionTable, filter)
	if err != nil {
		return nil, err
	}

	questions := data.([]*models.Question)
	return questions, nil
}

//create unused_only and text_filter mongodb queries from request
func createFilters(c *gin.Context) map[string]interface{} {
	filter := make(map[string]interface{})
	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		filter["user_id"] = userId
	}

	//unused_only means that rounds_used = []
	unusedOnly := c.DefaultQuery("unused_only", "false")
	if strings.ToLower(unusedOnly) == "true" {
		filter[models.RoundsUsed+".0"] = bson.M{"$exists": false}
	}

	//text_filter means that the search string appears in category/question/answer (case-insensitive)
	textFilter := c.Query("text_filter")
	if textFilter != "" {
		search := bson.M{"$regex": bson.RegEx{Pattern: ".*" + textFilter + ".*", Options: "i"}}
		filter["$or"] = []bson.M{{"question": search}, {"answer": search}, {"category": search}}
	}
	return filter
}

func GetOneQuestion(e *Env, userId, questionId string) (models.Question, error) {
	var data models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &data)
	if err != nil {
		return models.Question{}, err
	}

	err = common.AssertUserId(userId, data.UserId)
	if err != nil {
		return models.Question{}, err
	}

	return data, nil
}

func DeleteOneQuestion(e *Env, userId, questionId string) (models.Question, error) {
	question, err := GetOneQuestion(e, userId, questionId)
	if err != nil {
		return models.Question{}, err
	}

	err = common.AssertUserId(userId, question.UserId)
	if err != nil {
		return models.Question{}, err
	}

	err = common.Delete((*common.Env)(e), common.QuestionTable, questionId)
	if err != nil {
		return models.Question{}, err
	}

	for _, roundId := range question.RoundsUsed {
		fmt.Println("remove question ID " + models.IdAsString(question.ID) + " from round " + roundId)
		err = common.Pull((*common.Env)(e), common.RoundTable, roundId, models.Questions, models.IdAsString(question.ID))
		if err != nil {
			return models.Question{}, err
		}
	}

	return question, e.deleteFromCollections(userId, questionId)
}

func CreateOneQuestion(e *Env, userId string, data models.Question) (models.Question, error) {

	data.UserId = userId

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		return models.Question{}, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed}
	}

	id, createDate, err := common.Create((*common.Env)(e), common.QuestionTable, &data)
	if err != nil {
		return models.Question{}, err
	}

	data.ID = id
	data.CreateDate = createDate

	if data.ScoringNote != "" {
		err = UpdateLastUsedForScoringNote(e, userId, data.ScoringNote)
	}

	return data, err
}

func UpdateOneQuestion(e *Env, userId, questionId string, data models.Question) (models.Question, error) {

	data.UserId = userId

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		return models.Question{}, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed}
	}

	if data.ScoringNote != "" {
		_, err := GetOneScoringNote(e, userId, data.ScoringNote)
		if err != nil {
			return models.Question{}, err
		}
	}

	question, err := GetOneQuestion(e, userId, questionId)
	if err != nil {
		return models.Question{}, err
	}

	merge(&data, &question)

	err = common.Set((*common.Env)(e), common.QuestionTable, questionId, question)
	if err != nil {
		return models.Question{}, err
	}

	if data.ScoringNote != "" {
		err = UpdateLastUsedForScoringNote(e, userId, data.ScoringNote)
	}

	return data, err
}

func UpdateLastUsedForScoringNote(e *Env, userId, scoringNoteId string) error {
	note, err := GetOneScoringNote(e, userId, scoringNoteId)
	if err != nil {
		return err
	}

	note.LastUsed = time.Now()

	return common.Set((*common.Env)(e), common.ScoringNoteTable, scoringNoteId, note)
}
