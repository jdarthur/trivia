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