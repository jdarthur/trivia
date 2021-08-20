package games

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo/bson"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type Env common.Env

func (e *Env) GetAllGames(c *gin.Context) {

	filters := createFilters(c)

	questions, err := common.GetAll((*common.Env)(e), common.GameTable, filters)
	common.Respond(c, gin.H{"games": questions}, err)
}

//create unused_only and text_filter mongodb queries from request
func createFilters(c *gin.Context) map[string]interface{} {
	filter := make(map[string]interface{})
	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		filter["user_id"] = userId
	}

	//text_filter means that the search string appears in name (case-insensitive)
	textFilter := c.Query("text_filter")
	if textFilter != "" {
		search := bson.M{"$regex": bson.RegEx{Pattern: ".*" + textFilter + ".*", Options: "i"}}
		filter["name"] = search
	}
	return filter
}

func (e *Env) GetOneGame(c *gin.Context) {
	//get 'id' path param from query
	gameId := c.Param("id")

	var data models.Game
	err := common.GetOne((*common.Env)(e), common.GameTable, gameId, &data)

	if err != nil {
		value, ok := c.Get(common.USER_ID)
		if ok {
			userId := value.(string)
			if data.UserId != userId {
				err = common.InvalidUserError{UserId: userId}
			}
		}
	}

	common.Respond(c, data, err)
}

func (e *Env) CreateGame(c *gin.Context) {
	var data models.Game

	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		data.UserId = userId
	}

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	//fill Rounds and RoundNames with empty objects if they are not provided
	if data.Rounds == nil {
		data.Rounds = make([]string, 0)
	}
	if data.RoundNames == nil {
		data.RoundNames = make(map[string]string)
	}

	err = e.validateRoundNamesAndRoundIds(data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	gameId, createDate, err := common.Create((*common.Env)(e), common.GameTable, &data)

	//set these new items so that they appear in the API response
	data.ID = gameId
	data.CreateDate = createDate

	fmt.Println(data)

	//add this new gameId to each round's games list
	for _, roundId := range data.Rounds {
		//append gameId to rounds's games
		err = common.Push((*common.Env)(e), common.RoundTable, roundId, models.Games, models.IdAsString(gameId))
		if err != nil {
			common.Respond(c, data, err)
			return
		}
	}

	common.Respond(c, data, err)
}

func (e *Env) UpdateGame(c *gin.Context) {
	gameId := c.Param("id")
	var updateBody models.Game

	err := c.ShouldBind(&updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	err = e.validateRoundNamesAndRoundIds(updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	//get existing game from DB and return 404 if not found
	var existingGame models.Game
	err = common.GetOne((*common.Env)(e), common.GameTable, gameId, &existingGame)
	if err != nil {
		common.Respond(c, existingGame, err)
		return
	}

	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		if existingGame.UserId != userId {
			common.Respond(c, existingGame, common.InvalidUserError{UserId: userId})
			return
		}
	}

	//compose update body and games on rounds
	err = e.merge(&updateBody, &existingGame)
	if err != nil {
		common.Respond(c, existingGame, err)
		return
	}

	err = common.Set((*common.Env)(e), common.GameTable, gameId, existingGame)

	common.Respond(c, existingGame, err)
}

func (e *Env) DeleteGame(c *gin.Context) {
	gameId := c.Param("id")

	var existingGame models.Game
	err := common.GetOne((*common.Env)(e), common.GameTable, gameId, &existingGame)
	if err != nil {
		common.Respond(c, existingGame, err)
		return
	}

	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		if existingGame.UserId != userId {
			common.Respond(c, existingGame, common.InvalidUserError{UserId: userId})
			return
		}
	}

	err = common.Delete((*common.Env)(e), common.GameTable, gameId)
	if err != nil {
		common.Respond(c, existingGame, err)
		return
	}

	for _, roundId := range existingGame.Rounds {
		//append roundId to question's rounds_used
		fmt.Println("remove game ID " + gameId + " from round " + roundId)
		err = common.Pull((*common.Env)(e), common.RoundTable, roundId, models.Games, gameId)
		if err != nil {
			common.Respond(c, existingGame, err)
			return
		}
	}

	common.Respond(c, existingGame, err)
}

func (e *Env) validateRoundNamesAndRoundIds(updateBody models.Game) error {
	//wager and question length must be equal, error otherwise
	if len(updateBody.RoundNames) != len(updateBody.Rounds) {
		return InvalidRoundNameLengthError{RoundNameLength: len(updateBody.RoundNames), RoundsLength: len(updateBody.Rounds)}
	}

	//wagers cannot be 0 or negative
	for _, roundId := range updateBody.Rounds {

		if !roundIdInRoundNames(roundId, updateBody) {
			return InvalidRoundNamesError{RoundId: roundId}
		}

		if count(roundId, updateBody) > 1 {
			return DuplicateRoundIdError{RoundId: roundId}
		}

		//roundId must be a valid UUID and a valid round ID in database
		_, err := common.IsValidRound((*common.Env)(e), roundId)
		if err != nil {
			return InvalidRoundIdError{RoundId: roundId}
		}
	}
	return nil
}

func roundIdInRoundNames(roundId string, updateBody models.Game) bool {
	for id, _ := range updateBody.RoundNames {
		if id == roundId {
			return true
		}
	}
	return false
}

//how many times does this ID appear in updateBody.Rounds?
func count(roundId string, updateBody models.Game) int {
	idCount := 0
	for _, id := range updateBody.Rounds {
		if id == roundId {
			idCount++
		}
	}
	return idCount
}

//is roundId found in this models.Game.Rounds array?
func roundInGame(roundId string, existingRoundIds []string) bool {
	for _, id := range existingRoundIds {
		if id == roundId {
			return true
		}
	}
	return false
}

//Merge update body into existing round
func (e *Env) merge(update *models.Game, original *models.Game) error {

	if update.Name != "" {
		original.Name = update.Name
	}

	err := e.updateGamesInRounds(update.Rounds, original)
	if err != nil {
		return err
	}

	//we will always update Rounds and RoundNames at the same time.
	if len(update.Rounds) != 0 {
		original.Rounds = update.Rounds
		original.RoundNames = update.RoundNames
	}

	//if Rounds or RoundNames len is zero, clear out both fields.
	if len(update.Rounds) == 0 || len(update.RoundNames) == 0 {
		original.Rounds = make([]string, 0)
		original.RoundNames = make(map[string]string)
	}

	return nil
}

//for each roundId in update,
// if not in existing Rounds: [...], add it to round's Games: [...]
//for each roundId in existing,
// if not in update body, remove it from round's Games: [...]
func (e *Env) updateGamesInRounds(newRoundIds []string, original *models.Game) error {
	gameId := models.IdAsString(original.ID)

	//add this round_id to newly-added question's rounds_used
	for _, updateId := range newRoundIds {
		if !roundInGame(updateId, original.Rounds) {
			original.Rounds = append(original.Rounds, updateId)
			//append gameId to question's Games: [...]
			err := common.Push((*common.Env)(e), common.RoundTable, updateId, models.Games, gameId)
			if err != nil {
				return err
			}
		}
	}

	//remove this game from game.Rounds: [...] on deleted roundIds
	for _, existingId := range original.Rounds {
		if !roundInGame(existingId, newRoundIds) {
			original.Rounds = remove(original.Rounds, existingId)
			//remove gameId from question's Games: [...]
			err := common.Pull((*common.Env)(e), common.RoundTable, existingId, models.Games, gameId)
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
