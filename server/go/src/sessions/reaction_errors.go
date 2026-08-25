package sessions

import (
	"fmt"

	"github.com/jdarthur/trivia/models"
)

// Error when a reaction references an answer that does not exist or that
// belongs to a different session.
type InvalidAnswerIdError struct {
	AnswerId  string
	SessionId string
}

func (e InvalidAnswerIdError) Error() string {
	return fmt.Sprintf("Answer %v is not in session %v", e.AnswerId, e.SessionId)
}
func (e InvalidAnswerIdError) Field() string {
	return models.AnswerIdParam
}
func (e InvalidAnswerIdError) Data() interface{} {
	return e.AnswerId
}

// Error when a reaction's emoji is not a single emoji character (ticket
// #155): plain text, multiple emoji, or an empty string are all rejected.
type InvalidEmojiError struct {
	Emoji string
}

func (e InvalidEmojiError) Error() string {
	return fmt.Sprintf("%q is not a single emoji character", e.Emoji)
}
func (e InvalidEmojiError) Field() string {
	return models.Emoji
}
func (e InvalidEmojiError) Data() interface{} {
	return e.Emoji
}

// Error when trying to react to a question that has not been scored yet —
// reactions are only allowed once the admin has scored the question.
type QuestionNotScoredError struct {
	QuestionIndex int
	RoundIndex    int
}

func (e QuestionNotScoredError) Error() string {
	return fmt.Sprintf("Round %v Question %v has not been scored yet", e.RoundIndex, e.QuestionIndex)
}
func (e QuestionNotScoredError) Field() string {
	return models.QuestionIndex
}
func (e QuestionNotScoredError) Data() interface{} {
	return e.QuestionIndex
}

// Error when trying to remove a reaction the player does not have on an
// answer.
type ReactionNotFoundError struct {
	AnswerId string
	PlayerId models.PlayerId
}

func (e ReactionNotFoundError) Error() string {
	return fmt.Sprintf("Player %v has no reaction on answer %v", e.PlayerId, e.AnswerId)
}
func (e ReactionNotFoundError) Field() string {
	return models.PlayerIdParam
}
func (e ReactionNotFoundError) Data() interface{} {
	return e.PlayerId
}
