package rounds

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type Env common.Env

// GetAllRounds lists rounds, honoring the shared list query params of ticket
// #195: unused_only (no game contains the round), text_filter on name,
// sort/order, and page/page_size.
func (e *Env) GetAllRounds(c *gin.Context) {
	query, err := common.ParseListQuery(c, common.RoundTable)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	query.UserId = common.GetUserId(c)

	result, err := common.GetAllPaged((*common.Env)(e), common.RoundTable, query)
	common.RespondList(c, "rounds", result, err)
}

func (e *Env) GetOneRound(c *gin.Context) {
	//get 'id' path param from query
	roundId := c.Param("id")

	var data models.Round
	err := common.GetOne((*common.Env)(e), common.RoundTable, roundId, &data)

	if err == nil {
		err = common.AssertUser(c, data.UserId)
	}

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

	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		data.UserId = userId
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
		common.Respond(c, data, models.AttemptedToSetError{IllegalField: models.Games, Value: data.Games})
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

	err = common.AssertUser(c, existingRound.UserId)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	//compose update body into existing round
	e.merge(&updateBody, &existingRound)

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

	err = common.AssertUser(c, existingRound.UserId)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
	}

	err = common.Delete((*common.Env)(e), common.RoundTable, roundId)
	if err != nil {
		common.Respond(c, existingRound, err)
		return
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

//Merge update body into existing round. The question list is merged in
//place; common.Set then rewrites the round_question join wholesale, so no
//rounds_used mirror bookkeeping is needed (ticket #83).
func (e *Env) merge(update *models.Round, original *models.Round) {
	if update.Name != "" {
		original.Name = update.Name
	}
	if len(update.Wagers) != 0 {
		original.Wagers = update.Wagers
	}
	mergeQuestions(update.Questions, original)
}

//mergeQuestions reconciles original.Questions with newQuestionIds: add any
//id missing from the round, drop any id no longer present in the update.
func mergeQuestions(newQuestionIds []string, original *models.Round) {
	for _, updateId := range newQuestionIds {
		if !questionInRound(updateId, original.Questions) {
			original.Questions = append(original.Questions, updateId)
		}
	}
	for _, existingId := range original.Questions {
		if !questionInRound(existingId, newQuestionIds) {
			original.Questions = remove(original.Questions, existingId)
		}
	}
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
