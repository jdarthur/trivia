package sessions

import (
	"fmt"
	"models"
)

//Error when you set the current question with a round index that is not hre current round index
type SetCurrentQuestionWithIncorrectRoundError struct {
	RoundIndex int
}
func (e SetCurrentQuestionWithIncorrectRoundError) Error() string {
	return fmt.Sprintf("Round %v is not the current round", e.RoundIndex)
}
func (e SetCurrentQuestionWithIncorrectRoundError) Field() string {
	return models.RoundIndex
}
func (e SetCurrentQuestionWithIncorrectRoundError) Data() interface{} {
	return e.RoundIndex
}

//Error when you set the current question with a question index >= round.Questions.length
type InvalidQuestionIndexError struct {
	QuestionIndex interface{}
}
func (e InvalidQuestionIndexError) Error() string {
	return fmt.Sprintf("Question %v is not a valid question", e.QuestionIndex)
}
func (e InvalidQuestionIndexError) Field() string {
	return models.QuestionIndex
}
func (e InvalidQuestionIndexError) Data() interface{} {
	return e.QuestionIndex
}

//Error when you set the current round with a round index >= session.Rounds.length
type InvalidRoundIndexError struct {
	RoundIndex interface{}
}
func (e InvalidRoundIndexError) Error() string {
	return fmt.Sprintf("Round %v is not a valid round", e.RoundIndex)
}
func (e InvalidRoundIndexError) Field() string {
	return models.RoundIndex
}
func (e InvalidRoundIndexError) Data() interface{} {
	return e.RoundIndex
}

//Error when you set the current round with a round index >= session.Rounds.length
type IllegalWagerError struct {
	Wager int
	PlayerId string
	AvailableWagers []int
}
func (e IllegalWagerError) Error() string {
	return fmt.Sprintf("Illegal wager %v for player %v (available %v)", e.Wager, e.PlayerId, e.AvailableWagers)
}
func (e IllegalWagerError) Field() string {
	return models.Wager
}
func (e IllegalWagerError) Data() interface{} {
	return e.Wager
}



type UnscoredPlayerError struct {
	PlayerId models.PlayerId
}
func (e UnscoredPlayerError) Error() string {
	return fmt.Sprintf("Did not provide score answers for player %v", e.PlayerId)
}
func (e UnscoredPlayerError) Field() string {
	return models.PlayerIdParam
}
func (e UnscoredPlayerError) Data() interface{} {
	return e.PlayerId
}

//Error when you score a question which hasn';'t been answered by a player
type IllegalScoreError struct {
	PlayerId models.PlayerId
	RoundIndex int
	QuestionIndex int
}
func (e IllegalScoreError) Error() string {
	return fmt.Sprintf("Attemping to score answer for player %v, who hasn't answered round %v question %v", e.PlayerId, e.RoundIndex, e.QuestionIndex)
}
func (e IllegalScoreError) Field() string {
	return models.PlayerIdParam
}
func (e IllegalScoreError) Data() interface{} {
	return e.PlayerId
}


