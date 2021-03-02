package sessions

import (
	"github.com/jdarthur/trivia/common"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/models"
	"strconv"
)

func (e *Env) AnswerQuestion(c *gin.Context) {
	sessionId := c.Param("id")

	var answer models.Answer
	err := c.ShouldBind(&answer)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if answer.Correct == true {
		common.Respond(c, nil, models.AttemptedToSetError{IllegalField: models.Correct, Value: answer.Correct})
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		common.Respond(c, nil, err)
	}

	if !playerInSession(session, answer.PlayerId) {
		common.Respond(c, nil, PlayerNotInSessionError{PlayerId: answer.PlayerId, SessionId: sessionId})
		return
	}


	availableWagers, err := getWagers(e, session, *answer.RoundIndex, models.PlayerId(answer.PlayerId))
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if !wagerIsLegal(availableWagers, answer.Wager) {
		common.Respond(c, nil, IllegalWagerError{Wager: answer.Wager, PlayerId: answer.PlayerId, AvailableWagers: availableWagers})
		return
	}

	answerId, createDate, err := common.Create((*common.Env)(e), common.AnswerTable, &answer)
	if err != nil {
		fmt.Println(err)
	}
	//set these new items so that they appear in the API response
	answer.ID = answerId
	answer.CreateDate = createDate

	fmt.Printf("created answer %+v\n", answer)


	spot := fmt.Sprintf("%v.%v.%v.%v.%v.%v", models.Rounds, *answer.RoundIndex, models.Questions, *answer.QuestionIndex, models.Answers, answer.PlayerId)
	err = common.Push((*common.Env)(e), common.SessionTable, sessionId, spot, models.IdAsString(answerId))

	if err == nil {
		err = common.IncrementState((*common.Env)(e), sessionId)
	}

	common.Respond(c, answer, err)
}


func (e *Env) GetWagers(c *gin.Context) {
	sessionId := c.Param("id")
	playerId := c.Query("player_id")
	r := c.Query("round_id")

	roundIndex, err := strconv.Atoi(r)
	if err != nil {
		common.Respond(c, nil, InvalidRoundIndexError{RoundIndex: r})
		return
	}

	var session models.Session
	err = common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {

	}

	wagers, err := getWagers(e, session, roundIndex, models.PlayerId(playerId))
	common.Respond(c, wagers, err)
}

func getWagers(e *Env, session models.Session, roundIndex int, playerId models.PlayerId) ([]int, error) {
	if !playerInSession(session, playerId) {

	}

	round := session.Rounds[roundIndex]
	allWagers := round.Wagers
	for _, question := range round.Questions {
		answerCount := len(question.PlayerAnswers[playerId])

		if question.Scored && answerCount > 0 {
			answerId := question.PlayerAnswers[playerId][answerCount - 1]
			var lastAnswer models.Answer
			err := common.GetOne((*common.Env)(e), common.AnswerTable, string(answerId), &lastAnswer)
			if err != nil {
				return nil, err
			}
			allWagers = remove(allWagers, lastAnswer.Wager)
		}
	}
	return allWagers, nil
}

func (e *Env) GetAnswers(c *gin.Context) {
	answers, err := getAnswers(e, c)
	common.Respond(c, answers, err)
}

func getAnswers(e *Env, c *gin.Context) (interface{}, error) {
	sessionId := c.Param("id")
	callerPlayerId := c.Query("player_id")
	roundIndex, questionIndex, err := parseRoundAndQuestion(c)
	if err != nil {
		return nil, err
	}

	var session models.Session
	err =  common.GetOne((*common.Env)(e), common.SessionTable, sessionId, &session)
	if err != nil {
		return nil, err
	}

	//error on out-of-range round/question index
	if roundIndex >= len(session.Rounds) {
		return nil, InvalidRoundIndexError{RoundIndex: roundIndex}
	}
	if questionIndex >= len(session.Rounds[roundIndex].Questions) {
		return nil, InvalidQuestionIndexError{QuestionIndex: questionIndex}
	}

	if models.PlayerId(callerPlayerId) == session.Moderator {
		return getAnswersAsMod(e, session, roundIndex, questionIndex)
	}

	question := session.Rounds[roundIndex].Questions[questionIndex]
	if question.Scored {
		return getAnswersScored(e, session, roundIndex, questionIndex, models.PlayerId(callerPlayerId))
	}

	return getAnswersUnscored(e, session, roundIndex, questionIndex, models.PlayerId(callerPlayerId))
}

func parseRoundAndQuestion(c *gin.Context) (roundIndex int, questionIndex int, err error) {
	r := c.Query("round_id")
	q := c.Query("question_id")

	roundIndex, err = strconv.Atoi(r)
	if err != nil {
		return 0, 0, InvalidRoundIndexError{RoundIndex: r}
	}

	questionIndex, err = strconv.Atoi(q)
	if err != nil {
		return 0, 0, InvalidQuestionIndexError{QuestionIndex: q}
	}
	return roundIndex, questionIndex, nil
}

func getAnswersUnscored(e *Env, session models.Session, roundIndex int, questionIndex int, callerPlayerId models.PlayerId) (models.AnswersResponseUnscored, error) {
	players, err := getPlayersInSession(e, session)
	if err != nil {
		return models.AnswersResponseUnscored{}, err
	}

	var answers models.AnswersResponseUnscored
	playerAnswers := session.Rounds[roundIndex].Questions[questionIndex].PlayerAnswers
	for _, player := range players {

		thisPlayerId := models.PlayerId(models.IdAsString(player.ID))

		var p models.AnswerUnscored
		if thisPlayerId == callerPlayerId {
			p.PlayerId = thisPlayerId
		}
		p.TeamName = player.TeamName
		p.Icon = player.Icon

		if _, ok := playerAnswers[thisPlayerId]; ok {
			p.Answered = true
		}

		answers.Answers = append(answers.Answers, p)
	}

	return answers, nil
}

func getAnswersScored(e *Env, session models.Session, roundIndex int, questionIndex int, callerPlayerId models.PlayerId) (models.AnswersResponseScored, error) {
	players, err := getPlayersInSession(e, session)
	if err != nil {
		return models.AnswersResponseScored{}, err
	}
	var response models.AnswersResponseScored
	response.Scored = true
	for _, player := range players {
		var team models.ScoredTeam
		playerId := models.PlayerId(models.IdAsString(player.ID))

		if callerPlayerId == playerId {
			team.PlayerId = playerId
		}

		team.Icon = player.Icon
		team.TeamName = player.TeamName

		answerIds :=  session.Rounds[roundIndex].Questions[questionIndex].PlayerAnswers[playerId]

		thisPlayersAnswers, err := retrieveAnswersForPlayer(e, answerIds)
		if err != nil {
			return models.AnswersResponseScored{}, err
		}

		for _, answer := range thisPlayersAnswers {
			var a models.ScoredAnswer
			a.Answer = answer.Answer
			a.Wager = answer.Wager
			a.Correct = answer.Correct
			a.PointsAwarded = answer.PointsAwarded
			team.Answers = append(team.Answers, a)
		}

		response.Answers = append(response.Answers, team)

	}

	return response, nil
}

type AnswersAsMod struct {
	Scored bool `json:"scored"`
	Answers []IndividualAnswerAsMod `json:"answers"`
}

type IndividualAnswerAsMod struct {
	PlayerId models.PlayerId `json:"player_id"`
	TeamName string `json:"team_name"`
	Answered bool `json:"answered"`
	Answers []models.Answer `json:"answers"`
}

func getAnswersAsMod(e *Env, session models.Session, roundIndex int, questionIndex int) (AnswersAsMod, error) {
	var answers AnswersAsMod
	answers.Answers = make([]IndividualAnswerAsMod, 0)
	players, err := getPlayersInSession(e, session)
	if err != nil {
		return answers, err
	}

	for _, player := range players {
		playerId := models.PlayerId(models.IdAsString(player.ID))

		var teamAnswer IndividualAnswerAsMod
		teamAnswer.PlayerId = playerId
		teamAnswer.TeamName = player.TeamName
		teamAnswer.Answers = make([]models.Answer, 0)

		fmt.Printf("player ID inside get answers: %v\n", playerId)
		playerAnswers := session.Rounds[roundIndex].Questions[questionIndex].PlayerAnswers

		if answerIds, ok := playerAnswers[playerId]; ok {
			answerContents, err := retrieveAnswersForPlayer(e, answerIds)
			if err != nil {
				return AnswersAsMod{}, nil
			}
			teamAnswer.Answered = len(answerContents) > 0
			for _, individualAnswer := range answerContents {
				teamAnswer.Answers = append(teamAnswer.Answers, individualAnswer)
				fmt.Println(answers)
			}
		}

		answers.Answers = append(answers.Answers, teamAnswer)
	}

	return answers, nil
}

func retrieveAnswersForPlayer(e *Env, answerIds []models.AnswerId) ([]models.Answer, error) {
	answers := make([]models.Answer, 0)
	for _, answerId := range answerIds {
		var answer models.Answer
		err := common.GetOne((*common.Env)(e), common.AnswerTable, string(answerId), &answer)
		if err != nil {
			return nil, err
		}
		answers = append(answers, answer)
	}
	return answers, nil
}

func playerInSession(session models.Session, target models.PlayerId) bool {
	for _, playerId := range session.Players {
		if playerId == target {
			return true
		}
	}
	return false
}

func wagerIsLegal(legalWagers []int, wager int) bool {
	for _, legalWager := range legalWagers {
		if legalWager == wager {
			return true
		}
	}
	return false
}

//remove wager from slice by value
func remove(slice []int, valueToRemove int) []int {
	for i, value := range slice {
		if value == valueToRemove {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

