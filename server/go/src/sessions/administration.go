package sessions

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

type CurrentQuestionRequest struct {
	QuestionIndex int    `json:"question_id"`
	RoundIndex    int    `json:"round_id"`
	ModeratorId   string `json:"player_id"`
}

func (e *Env) SetCurrentQuestion(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody CurrentQuestionRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	//get the session in question
	var existingSession models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &existingSession)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if models.PlayerId(requestBody.ModeratorId) != existingSession.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: models.PlayerId(requestBody.ModeratorId), SessionId: sessionId})
		return
	}

	//can't set current question if we passed the wrong round index
	if requestBody.RoundIndex != *existingSession.CurrentRound {
		common.Respond(c, nil, SetCurrentQuestionWithIncorrectRoundError{RoundIndex: requestBody.RoundIndex})
		return
	}

	roundInSession := existingSession.Rounds[requestBody.RoundIndex]
	var roundObject models.Round
	err = common.GetOne((*common.Env)(e), common.RoundTable, roundInSession.RoundId, &roundObject)
	if err != nil {
		common.Respond(c, nil, InvalidRoundIdInGameError{RoundId: roundInSession.RoundId})
		return
	}

	err = _setCurrentQuestion(e, &existingSession, requestBody.QuestionIndex, roundObject, &roundInSession)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, existingSession, err)
}

func _setCurrentQuestion(e *Env, session *models.Session, questionIndex int, round models.Round, roundInSession *models.RoundInGame) error {

	//error if question index is out of range for this round
	if questionIndex >= len(roundInSession.Questions) {
		fmt.Println("qIndex > Questions.length")
		return InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	//retrieve question from DB to get the question text
	var questionObject models.Question
	questionId := round.Questions[questionIndex]
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &questionObject)
	if err != nil {
		fmt.Println("failed to retrieve question by ID inside of SetCurrentQuestion")
		return InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	//get question object inside this round
	questionInRound := roundInSession.Questions[questionIndex]

	//if playerAnswers is already there, don't overwrite it
	if len(questionInRound.PlayerAnswers) == 0 {
		questionInRound.PlayerAnswers = make(map[models.PlayerId][]models.AnswerId)
	}

	//set current question field & question text inside this session
	session.CurrentQuestion = &questionIndex
	questionInRound.Question = questionObject.Question
	questionInRound.Answer = questionObject.Answer
	questionInRound.QuestionId = questionId

	roundInSession.Questions[questionIndex] = questionInRound

	return common.Set((*common.Env)(e), common.SessionTable, models.IdAsString(session.ID), &session)
}

type CurrentRoundRequest struct {
	RoundIndex    int    `json:"round_id"`
	QuestionIndex int    `json:"question_id"`
	ModeratorId   string `json:"player_id"`
}

func (e *Env) SetCurrentRound(c *gin.Context) {
	sessionId := c.Param("id")

	var requestBody CurrentRoundRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		common.Respond(c, requestBody, err)
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	//can't do this if you aren't the mod
	if models.PlayerId(requestBody.ModeratorId) != session.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: models.PlayerId(requestBody.ModeratorId), SessionId: sessionId})
		return
	}

	err = _setCurrentRound(e, &session, requestBody.RoundIndex, requestBody.QuestionIndex)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	common.Respond(c, session, err)
}

func _setCurrentRound(e *Env, session *models.Session, roundIndex int, questionIndex int) error {

	//can't set round index larger than session.Rounds length
	if roundIndex >= len(session.Rounds) {
		return InvalidRoundIndexError{RoundIndex: roundIndex}
	}

	roundInSession := session.Rounds[roundIndex]

	var round models.Round
	err := common.GetOne((*common.Env)(e), common.RoundTable, roundInSession.RoundId, &round)
	if err != nil {
		return err
	}

	roundInSession.Wagers = round.Wagers
	session.CurrentRound = &roundIndex
	if len(roundInSession.Questions) == 0 {
		fmt.Println("setting question categories in round")
		//for each question, set the category in this session.Rounds.Questions array
		for _, questionId := range round.Questions {
			var question models.Question
			err = common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &question)
			if err != nil {
				return err
			}

			var questionInRound models.QuestionInRound
			questionInRound.Category = question.Category
			roundInSession.Questions = append(roundInSession.Questions, questionInRound)
		}
	}

	session.Rounds[roundIndex] = roundInSession
	return _setCurrentQuestion(e, session, questionIndex, round, &roundInSession)
}

func (e *Env) GetCurrentQuestion(c *gin.Context) {
	question, err := getCurrentQuestion(e, c)
	common.Respond(c, question, err)
}
func getCurrentQuestion(e *Env, c *gin.Context) (models.QuestionInRound, error) {

	sessionId := c.Param("id")
	playerId := c.Query("player_id")
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.QuestionInRound{}, err
	}

	//these won't have been set yet before the session is started
	if session.CurrentRound != nil && session.CurrentQuestion != nil {
		currentRound := *session.CurrentRound
		currentQuestion := *session.CurrentQuestion

		question := session.Rounds[currentRound].Questions[currentQuestion]
		question.Index = currentQuestion

		if models.PlayerId(playerId) != session.Moderator && !question.Scored {
			question.Answer = ""
			question.QuestionId = ""
		}

		return question, err
	}

	return models.QuestionInRound{}, err
}

type CurrentRoundResponse struct {
	RoundIndex int      `json:"id"`
	RoundName  string   `json:"name"`
	Categories []string `json:"categories"`
	Wagers     []int    `json:"wagers"`
}

func (e *Env) GetCurrentRound(c *gin.Context) {
	round, err := getCurrentRound(e, c)
	common.Respond(c, round, err)
}
func getCurrentRound(e *Env, c *gin.Context) (CurrentRoundResponse, error) {
	sessionId := c.Param("id")
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return CurrentRoundResponse{}, err
	}

	//won't have been set yet before the session is started
	if session.CurrentRound != nil {
		currentRound := *session.CurrentRound
		roundInGame := session.Rounds[currentRound]

		var game models.Game
		err = common.GetOne((*common.Env)(e), common.GameTable, session.GameId, &game)
		if err != nil {
			return CurrentRoundResponse{}, InvalidGameIdError{GameId: session.GameId}
		}

		var response CurrentRoundResponse
		response.RoundIndex = currentRound
		response.RoundName = game.RoundNames[roundInGame.RoundId]
		response.Categories = make([]string, 0)
		response.Wagers = roundInGame.Wagers
		for _, question := range roundInGame.Questions {
			response.Categories = append(response.Categories, question.Category)
		}

		return response, nil
	}

	return CurrentRoundResponse{}, nil

}

func (e *Env) ScoreQuestion(c *gin.Context) {
	response, err := scoreQuestion(e, c)
	common.Respond(c, response, err)
}

func scoreQuestion(e *Env, c *gin.Context) (models.ScoreRequest, error) {
	sessionId := c.Param("id")

	var requestBody models.ScoreRequest
	err := c.ShouldBind(&requestBody)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	if requestBody.ModeratorId != session.Moderator {
		return models.ScoreRequest{}, UnauthorizedSessionActionError{SessionId: sessionId, ModeratorId: requestBody.ModeratorId}
	}

	for _, playerId := range session.Players {
		if _, ok := requestBody.Players[playerId]; !ok {
			return models.ScoreRequest{}, UnscoredPlayerError{PlayerId: playerId}
		}
	}

	roundIndex := requestBody.RoundIndex
	questionIndex := requestBody.QuestionIndex

	questionIndexOverall, err := getQuestionIndex(session, roundIndex, questionIndex)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	questionInRound := session.Rounds[roundIndex].Questions[questionIndex]
	rescore := questionInRound.Scored

	for playerId, correctOrNot := range requestBody.Players {
		answerCount := len(session.Rounds[roundIndex].Questions[questionIndex].PlayerAnswers[playerId])
		if answerCount == 0 {
			return models.ScoreRequest{}, IllegalScoreError{PlayerId: playerId, RoundIndex: requestBody.RoundIndex, QuestionIndex: requestBody.RoundIndex}
		}

		lastAnswerId := session.Rounds[roundIndex].Questions[questionIndex].PlayerAnswers[playerId][answerCount-1]

		var answer models.Answer
		err = common.GetOne((*common.Env)(e), common.AnswerTable, string(lastAnswerId), &answer)
		if err != nil {
			return models.ScoreRequest{}, err
		}

		//override wager if score override is provided.
		//award 0 points if answer is correct
		var pointsToAward float64
		if correctOrNot.Correct {
			if correctOrNot.ScoreOverride != nil {
				pointsToAward = *correctOrNot.ScoreOverride
			} else {
				pointsToAward = float64(answer.Wager)
			}
		} else {
			pointsToAward = 0
		}

		answer.PointsAwarded = pointsToAward
		answer.Correct = correctOrNot.Correct

		err = common.Set((*common.Env)(e), common.AnswerTable, string(lastAnswerId), &answer)
		if err != nil {
			return models.ScoreRequest{}, err
		}

		//award points in scoreboard
		session.Scoreboard[playerId] = splicePoints(session.Scoreboard[playerId], pointsToAward, questionIndexOverall, rescore)
		fmt.Println(session.Scoreboard[playerId])
	}

	questionInRound.Scored = true

	var question models.Question
	err = common.GetOne((*common.Env)(e), common.QuestionTable, questionInRound.QuestionId, &question)
	if err != nil {
		return models.ScoreRequest{}, err
	}

	questionInRound.Answer = question.Answer
	session.Rounds[roundIndex].Questions[questionIndex] = questionInRound

	err = common.Set((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}
	return requestBody, err

}

//get this overall index of this question withing the game
//e.g. 5x5 game: round 1 question1 is 0, round 2 question 1 is 5, round 5, question  5 is 24
func getQuestionIndex(session models.Session, roundIndex int, questionIndex int) (int, error) {

	fmt.Println(roundIndex, questionIndex)

	if len(session.Rounds) <= roundIndex {
		return 0, InvalidRoundIndexError{RoundIndex: roundIndex}
	}

	r := session.Rounds[roundIndex]

	if len(r.Questions) <= questionIndex {
		return 0, InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	incr := 0
	for i := 0; i <= roundIndex; i++ {
		round := session.Rounds[i]
		for j, _ := range round.Questions {
			if roundIndex == i && questionIndex == j {
				return incr, nil
			}
			incr++
		}
	}

	return incr, nil
}

func splicePoints(pointsArray []float64, pointValue float64, index int, rescore bool) []float64 {
	if !rescore && index >= (len(pointsArray)-1) {
		return append(pointsArray, pointValue)
	}
	pointsArray[index] = pointValue
	return pointsArray
}
