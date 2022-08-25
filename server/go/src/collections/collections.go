package collections

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type Env common.Env

func (e *Env) GetAllCollections(c *gin.Context) {
	filter := make(map[string]interface{})
	userId, err := common.AssertHasUserId(c)
	if err != nil {
		common.Respond(c, nil, err)
	} else {
		filter["user_id"] = userId
		collections, err := common.GetAll((*common.Env)(e), common.CollectionTable, filter)
		common.Respond(c, gin.H{"collections": collections}, err)
	}
}

func (e *Env) GetOneCollection(c *gin.Context) {
	//get 'id' path param from query
	collectionId := c.Param("id")

	var data models.Collection
	data.QuestionData = make([]models.Question, 0)
	err := common.GetOne((*common.Env)(e), common.CollectionTable, collectionId, &data)

	//load all the question data since another user would be able to query these question IDs
	for _, questionId := range data.Questions {
		var question models.Question
		err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
		if err != nil {
			common.Respond(c, nil, err)
			return
		}
		data.QuestionData = append(data.QuestionData, question)
	}

	//don't need to assert user ID is correct.
	//Collections are designed to be created and shared with another user

	common.Respond(c, data, err)
}

func (e *Env) CreateCollection(c *gin.Context) {

	var data models.Collection

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	userId, err := common.AssertHasUserId(c)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if len(data.Questions) == 0 {
		common.Respond(c, data, EmptyCollectionError{data})
		return
	}

	for _, questionId := range data.Questions {
		question, err := e.questionIdExists(questionId)
		if err != nil {
			common.Respond(c, data, err)
			return
		}

		err = common.AssertUser(c, question.UserId)
		if err != nil {
			common.Respond(c, nil, err)
			return
		}

	}

	//set userId parsed from token
	data.UserId = userId

	//set MongoDB database & record type
	id, createDate, err := common.Create((*common.Env)(e), common.CollectionTable, &data)

	data.ID = id
	data.CreateDate = createDate

	common.Respond(c, data, err)
}

func (e *Env) DeleteCollection(c *gin.Context) {

	collectionId := c.Param("id")

	var existingCollection models.Collection
	err := common.GetOne((*common.Env)(e), common.CollectionTable, collectionId, &existingCollection)
	if err != nil {
		common.Respond(c, existingCollection, err)
		return
	}

	err = common.AssertUser(c, existingCollection.UserId)
	if err != nil {
		common.Respond(c, existingCollection, err)
		return
	}

	err = common.Delete((*common.Env)(e), common.CollectionTable, collectionId)
	if err != nil {
		common.Respond(c, existingCollection, err)
		return
	}

	common.Respond(c, existingCollection, err)
}

func (e *Env) ImportCollection(c *gin.Context) {

	collectionId := c.Param("id")

	userId, err := common.AssertHasUserId(c)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	var existingCollection models.Collection
	err = common.GetOne((*common.Env)(e), common.CollectionTable, collectionId, &existingCollection)
	if err != nil {
		common.Respond(c, existingCollection, err)
		return
	}

	questions := make([]models.Question, 0)

	for _, id := range existingCollection.Questions {
		var question models.Question
		err := common.GetOne((*common.Env)(e), common.QuestionTable, id, &question)
		if err != nil {
			common.Respond(c, existingCollection, err)
			return
		}

		fmt.Println("copy question: ", question)

		question.UserId = userId
		question.RoundsUsed = make([]string, 0)
		id, createDate, err := common.Create((*common.Env)(e), common.QuestionTable, &question)

		question.ID = id
		question.CreateDate = createDate

		questions = append(questions, question)
	}

	common.Respond(c, gin.H{"questions": questions}, err)
}

func (e *Env) questionIdExists(questionId string) (models.Question, error) {
	var question models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
	return question, err
}
