package questions

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo/bson"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"strings"
)

type Env common.Env

//Get all questions
func (e *Env) GetAllQuestions(c *gin.Context) {
	filter := createFilters(c)
	questions, err := common.GetAll((*common.Env)(e), common.QuestionTable, filter)
	common.Respond(c, gin.H{"questions": questions}, err)
}

//create unused_only and text_filter mongodb queries from request
func createFilters(c *gin.Context) map[string]interface{} {
	filter := make(map[string]interface{})

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

//Get one question by ID
func (e *Env) GetOneQuestion(c *gin.Context) {
	//get 'id' path param from query
	questionId := c.Param("id")

	//make a copy of the data model struct
	var data models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &data)

	common.Respond(c, data, err)
}

//create a new question
func (e *Env) CreateQuestion(c *gin.Context) {

	var data models.Question
	data.RoundsUsed = make([]string, 0)

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		common.Respond(c, data, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed})
		return
	}

	//set MongoDB database & record type
	id, createDate, err := common.Create((*common.Env)(e), common.QuestionTable, &data)

	//set these new items so that they appear in the API response
	data.ID = id
	data.CreateDate = createDate

	common.Respond(c, data, err)
}

func (e *Env) UpdateQuestion(c *gin.Context) {

	questionId := c.Param("id")
	var updateBody models.Question

	err := c.ShouldBind(&updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(updateBody.RoundsUsed) != 0 {
		common.Respond(c, updateBody, AttemptedToSetRoundsUsedError{RoundsUsed: updateBody.RoundsUsed})
		return
	}

	//get existing question from DB and return 404 if not found
	var question models.Question
	err = common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
	if err != nil {
		common.Respond(c, question, err)
		return
	}

	merge(&updateBody, &question)
	err = common.Set((*common.Env)(e), common.QuestionTable, questionId, question)

	common.Respond(c, question, err)
}

func (e *Env) DeleteQuestion(c *gin.Context) {
	questionId := c.Param("id")

	var existingQuestion models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &existingQuestion)
	if err != nil {
		common.Respond(c, existingQuestion, err)
		return
	}

	err = common.Delete((*common.Env)(e), common.QuestionTable, questionId)
	if err != nil {
		common.Respond(c, existingQuestion, err)
		return
	}

	for _, roundId := range existingQuestion.RoundsUsed {
		fmt.Println("remove question ID " + models.IdAsString(existingQuestion.ID) + " from round " + roundId)
		err = common.Pull((*common.Env)(e), common.RoundTable, roundId, models.Questions, models.IdAsString(existingQuestion.ID))
		if err != nil {
			common.Respond(c, existingQuestion, err)
			return
		}
	}

	common.Respond(c, existingQuestion, err)
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
