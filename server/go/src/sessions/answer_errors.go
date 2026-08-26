package sessions

import (
	"fmt"
	"github.com/jdarthur/trivia/models"
)

//Error when try to answer a question thats already scored
type QuestionAlreadyScoredError struct {
	QuestionIndex int
	RoundIndex int
}
func (e QuestionAlreadyScoredError) Error() string {
	return fmt.Sprintf("Round %v Question %v is already scored", e.RoundIndex, e.QuestionIndex)
}
func (e QuestionAlreadyScoredError) Field() string {
	return models.QuestionIndex
}
func (e QuestionAlreadyScoredError) Data() interface{} {
	return e.QuestionIndex
}

//Error when you try to answer a question as a player that's not in this session
type PlayerNotInSessionError struct {
	PlayerId models.PlayerId
	SessionId string
}
func (e PlayerNotInSessionError) Error() string {
	return fmt.Sprintf("Player %v is not in session %v", e.PlayerId, e.SessionId)
}
func (e PlayerNotInSessionError) Field() string {
	return models.PlayerIdParam
}
func (e PlayerNotInSessionError) Data() interface{} {
	return e.PlayerId
}

//Error when an inactive (left/booted) player tries to submit an answer
type PlayerInactiveError struct {
	PlayerId models.PlayerId
	SessionId string
}
func (e PlayerInactiveError) Error() string {
	return fmt.Sprintf("Player %v is inactive in session %v", e.PlayerId, e.SessionId)
}
func (e PlayerInactiveError) Field() string {
	return models.PlayerIdParam
}
func (e PlayerInactiveError) Data() interface{} {
	return e.PlayerId
}

// InvalidMatchingAnswerError is returned when a matching answer violates the
// one-to-one shape of the question (ticket #163): the answer must be a JSON
// object with exactly one entry per left, each value must be one of the
// question's rights, and no right may be chosen more than once. Matching is
// one-to-one by design, so a malformed or duplicate-right answer is rejected
// at submit time instead of being stored as a certain miss.
type InvalidMatchingAnswerError struct {
	Answer string
	Reason string
}
func (e InvalidMatchingAnswerError) Error() string {
	return "invalid matching answer: " + e.Reason
}
func (e InvalidMatchingAnswerError) Field() string {
	return "answer"
}
func (e InvalidMatchingAnswerError) Data() interface{} {
	return e.Answer
}