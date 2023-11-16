package collections

import (
	"fmt"
	"github.com/jdarthur/trivia/models"
)

type EmptyCollectionError struct {
	Questions models.Collection
}

func (e EmptyCollectionError) Error() string {
	return "Attempted to create empty collection"
}

func (e EmptyCollectionError) Field() string {
	return models.QuestionIds
}

func (e EmptyCollectionError) Data() interface{} {
	return e.Questions
}

type QuestionInCollectionDoesNotBelongToUserError struct {
	QuestionId string
	UserId     string
}

func (e QuestionInCollectionDoesNotBelongToUserError) Error() string {
	return fmt.Sprintf("Question id '%s' does not belong to user '%s", e.QuestionId, e.UserId)
}

func (e QuestionInCollectionDoesNotBelongToUserError) Field() string {
	return models.QuestionIds
}

func (e QuestionInCollectionDoesNotBelongToUserError) Data() interface{} {
	return e.QuestionId
}
