package rounds

import (
	"github.com/jdarthur/trivia/models"
	"strconv"
)

//Error when you pass a wagers: [...] with a different length than questions: [...]
type InvalidWagerLengthError struct {
	WagerLength    int
	QuestionLength int
}

func (e InvalidWagerLengthError) Error() string {
	return "Wagers length (" + strconv.Itoa(e.WagerLength) + ") is different than questions length (" + strconv.Itoa(e.QuestionLength) + ")"
}
func (e InvalidWagerLengthError) Field() string {
	return models.Games
}
func (e InvalidWagerLengthError) Data() interface{} {
	return e.WagerLength
}

//Error when you pass a wager that is <= 0
type InvalidWagerError struct {
	Wager int
}

func (e InvalidWagerError) Error() string {
	return "Invalid wager (must be >0): " + strconv.Itoa(e.Wager)
}
func (e InvalidWagerError) Field() string {
	return models.Wagers
}
func (e InvalidWagerError) Data() interface{} {
	return e.Wager
}

//Error when you pass the same questionId multiple times in questions: [...]
type DuplicateQuestionIdError struct {
	QuestionId string
}

func (e DuplicateQuestionIdError) Error() string {
	return "Duplicate questionId: " + e.QuestionId
}
func (e DuplicateQuestionIdError) Field() string {
	return models.Questions
}
func (e DuplicateQuestionIdError) Data() interface{} {
	return e.QuestionId
}

//Error when you pass an invalid QuestionId inside of questions: [...]
type InvalidQuestionIdError struct {
	QuestionId string
}

func (e InvalidQuestionIdError) Error() string {
	return "Question ID '" + e.QuestionId + "' is invalid"
}
func (e InvalidQuestionIdError) Field() string {
	return models.Questions
}
func (e InvalidQuestionIdError) Data() interface{} {
	return e.QuestionId
}
