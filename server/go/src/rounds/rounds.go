package rounds

import (
	"common"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo/bson"
	"models"
	"strings"
)

type Env common.Env

func (e *Env) GetAllRounds(c *gin.Context) {

	filters := createFilters(c)

	questions, err := common.GetAll((*common.Env)(e), common.RoundTable, filters)
	common.Respond(c, gin.H{"rounds": questions}, err)
}

//create unused_only and text_filter mongodb queries from request
func createFilters(c *gin.Context) map[string]interface{} {
	filter := make(map[string]interface{})

	//unused_only means that games = []
	unusedOnly := c.DefaultQuery("unused_only", "false")
	if strings.ToLower(unusedOnly) == "true" {
		filter[models.Games+".0"] = bson.M{"$exists": false}
	}

	//text_filter means that the search string appears in name (case-insensitive)
	textFilter := c.Query("text_filter")
	if textFilter != "" {
		search := bson.M{"$regex": bson.RegEx{Pattern: ".*" + textFilter + ".*", Options: "i"}}
		filter["name"] = search
	}
	return filter
}

func (e *Env) GetOneRound(c *gin.Context) {
	//get 'id' path param from query
	roundId := c.Param("id")

	var data models.Round
	err := common.GetOne((*common.Env)(e), common.RoundTable, roundId, &data)

	common.Respond(c, data, err)
}

func (e *Env) CreateRound(c *gin.Context) {
	var data models.Round
	data.Games = make([]string, 0)

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	//fil questions and wagers with empty lists if they are not provided
	if data.Questions == nil {
		data.Questions = make([]string, 0)
	}
	if data.Wagers == nil {
		data.Wagers = make([]int, 0)
	}

	//games: [...] cannot be set by this API (indirectly on a round in the games API)
	if len(data.Games) != 0 {
		common.Respond(c, data, models.AttemptedToSetError{IllegalField: models.Games, Value:  data.Games})
		return
	}

	err = e.validateWagersAndQuestionIds(data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	id, createDate, err := common.Create((*common.Env)(e), common.RoundTable, &data)

	//set these new items so that they appear in the API response
	data.ID = id
	data.CreateDate = createDate

	fmt.Println(data)

	//add this new roundId to each question's rounds_used list
	for _, questionId := range data.Questions {
		//append roundId to question's rounds_used
		err = common.Push((*common.Env)(e), common.QuestionTable, questionId, models.RoundsUsed, models.IdAsString(data.ID))
		if err != nil {
			common.Respond(c, data, err)
			return
		}
	}

	common.Respond(c, data, err)
}

func (e *Env) UpdateRound(c *gin.Context) {
	roundId := c.Param("id")
	var updateBody models.Round

	err := c.ShouldBind(&updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	//games: [...] cannot be set by this API (set indirectly on a round in the games API)
	if len(updateBody.Games) != 0 {
		common.Respond(c, updateBody, models.AttemptedToSetError{IllegalField: models.Games, Value: updateBody.Games})
		return
	}

	err = e.validateWagersAndQuestionIds(updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	//get existing round from DB and return 404 if not found
	var existingRound models.Round
	err = common.GetOne((*common.Env)(e), common.RoundTable, roundId, &existingRound)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	//compose update body and update rounds_used on questions
	err = e.merge(&updateBody, &existingRound)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	err = common.Set((*common.Env)(e), common.RoundTable, roundId, existingRound)

	common.Respond(c, existingRound, err)
}

func (e *Env) DeleteRound(c *gin.Context) {
	roundId := c.Param("id")

	var existingRound models.Round
	err := common.GetOne((*common.Env)(e), common.RoundTable, roundId, &existingRound)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	err = common.Delete((*common.Env)(e), common.RoundTable, roundId)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	for _, questionId := range existingRound.Questions {
		fmt.Println("remove round ID " + roundId + " from question " + questionId)
		err = common.Pull((*common.Env)(e), common.QuestionTable, questionId, models.RoundsUsed, roundId)
		if err != nil {
			common.Respond(c, existingRound, err)
			return
		}
	}

	for _, gameId := range existingRound.Games {
		fmt.Println("remove round ID " + roundId + " from game " + gameId)
		err = common.Pull((*common.Env)(e), common.GameTable, gameId, models.Rounds, roundId)
		if err != nil {
			common.Respond(c, existingRound, err)
			return
		}
	}


	//TODO: remove this roundId from rounds on all downstream games

	common.Respond(c, existingRound, err)
}

func (e *Env) validateWagersAndQuestionIds(updateBody models.Round) error {
	//wager and question length must be equal, error otherwise
	if len(updateBody.Questions) != len(updateBody.Wagers) {
		return InvalidWagerLengthError{WagerLength: len(updateBody.Wagers), QuestionLength: len(updateBody.Questions)}
	}

	//wagers cannot be 0 or negative
	for _, wager := range updateBody.Wagers {
		if wager <= 0 {
			return InvalidWagerError{Wager: wager}
		}
	}

	for _, wager := range updateBody.Wagers {
		if wager <= 0 {
			return InvalidWagerError{Wager: wager}
		}
	}

	//all questionIds in update must be valid, error otherwise
	for _, questionId := range updateBody.Questions {

		//questionId cannot appear multiple times in updateBody.Questions
		if count(questionId, updateBody) > 1 {
			return DuplicateQuestionIdError{QuestionId: questionId}
		}

		//questionId must be a valid UUID and a valid question ID in database
		_, err := common.IsValidQuestion((*common.Env)(e), questionId)
		if err != nil {
			return InvalidQuestionIdError{QuestionId: questionId}
		}
	}
	return nil
}

//how many times does this ID appear in updateBody.Questions?
func count(questionId string, updateBody models.Round) int {
	idCount := 0
	for _, id := range updateBody.Questions {
		if id == questionId {
			idCount++
		}
	}
	return idCount
}

//is questionId found in this models.Round.Questions array?
func questionInRound(questionId string, existingQuestionIds []string) bool {
	for _, id := range existingQuestionIds {
		if id == questionId {
			return true
		}
	}
	return false
}

//Merge update body into existing round
func (e *Env) merge(update *models.Round, original *models.Round) error {

	if update.Name != "" {
		original.Name = update.Name
	}

	if len(update.Wagers) != 0 {
		original.Wagers = update.Wagers
	}

	return e.updateRoundsUsedInQuestions(update.Questions, original)
}


//for each questionId in update,
// if not in existing questions list, add it to question's rounds_used
//for each questionId in existing,
// if not in update body, remove it from question's rounds_used
func (e *Env) updateRoundsUsedInQuestions(newQuestionIds []string, original *models.Round) error {
	roundId := models.IdAsString(original.ID)

	//add this round_id to newly-added question's rounds_used
	for _, updateId := range newQuestionIds {
		if !questionInRound(updateId, original.Questions) {
			original.Questions = append(original.Questions, updateId)
			//append roundId to question's rounds_used
			err := common.Push((*common.Env)(e), common.QuestionTable, updateId, models.RoundsUsed, roundId)
			if err != nil {
				return err
			}
		}
	}

	//remove this round from rounds_used on deleted questions
	for _, existingId := range original.Questions {
		if !questionInRound(existingId, newQuestionIds) {
			original.Questions = remove(original.Questions, existingId)
			//remove roundId from question's rounds_used
			err := common.Pull((*common.Env)(e), common.QuestionTable, existingId, models.RoundsUsed, roundId)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

//remove something from slice by value
func remove(slice []string, valueToRemove string) []string {
	for i, value := range slice {
		if value == valueToRemove {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}