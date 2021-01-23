package sessions

import (
	"common"
	"github.com/gin-gonic/gin"
	"models"
	"fmt"
)

type CurrentQuestionRequest struct {
	QuestionIndex int `json:"question_id"`
	RoundIndex    int `json:"round_id"`
	ModeratorId string `json:"player_id"`
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

	if requestBody.ModeratorId != existingSession.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: requestBody.ModeratorId, SessionId: sessionId})
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

	//TODO: increment session state
	err = _setCurrentQuestion(e, &existingSession, requestBody.QuestionIndex,roundObject, &roundInSession)
	common.Respond(c, existingSession, err)
}

func _setCurrentQuestion(e *Env, session *models.Session, questionIndex int, round models.Round, roundInSession *models.RoundInGame) error {

	//error if question index is out of range for this round
	if questionIndex >= len(roundInSession.Questions) {
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

	fmt.Println("inside _setCurrentQuestion")
	fmt.Println(roundInSession)
	//get question object inside this round
	questionInRound := roundInSession.Questions[questionIndex]

	//if playerAnswers is already there, don't overwrite it
	if len(questionInRound.PlayerAnswers) == 0 {
		questionInRound.PlayerAnswers = make(map[string][]string)
	}

	//set current question field & question text inside this session
	session.CurrentQuestion = &questionIndex
	questionInRound.Question = questionObject.Question

	roundInSession.Questions[questionIndex] = questionInRound

	return common.Set((*common.Env)(e), common.SessionTable, models.IdAsString(session.ID), &session)
}



type CurrentRoundRequest struct {
	RoundIndex    int `json:"round_id"`
	ModeratorId string `json:"player_id"`
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
	if requestBody.ModeratorId != session.Moderator {
		common.Respond(c, nil, UnauthorizedSessionActionError{ModeratorId: requestBody.ModeratorId, SessionId: sessionId})
		return
	}

	err = _setCurrentRound(e, &session, requestBody.RoundIndex)
	common.Respond(c, session, err)
}

func _setCurrentRound(e *Env, session *models.Session, roundIndex int) error {

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
	fmt.Println(roundInSession)
	if roundInSession.Questions == nil {
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


	//err = common.Set((*common.Env)(e), common.SessionTable, models.IdAsString(session.ID), &session)
	//if err != nil {
		//return err
	//}
	fmt.Println("roundInSession after q update ")
	fmt.Println(roundInSession)


	session.Rounds[roundIndex] = roundInSession
	fmt.Printf("%+v\n", session)

	return _setCurrentQuestion(e, session, 0, round, &roundInSession)
}

func (e * Env) GetCurrentQuestion(c *gin.Context) {
	sessionId := c.Param("id")
	var session models.Session
	err := common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	currentRound := session.CurrentRound
	currentQuestion := session.CurrentQuestion
	if len(session.Rounds) == 0 {
		fmt.Println("")
	}
	common.Respond(c, session.Rounds[*currentRound].Questions[*currentQuestion], err)

}


func (e *Env) ScoreQuestion(c *gin.Context) {

}
