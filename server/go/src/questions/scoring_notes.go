package questions

import (
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"sort"
)

func (e *Env) GetOneScoringNote(c *gin.Context) {
	scoringNoteId := c.Param("id")

	userId := common.GetUserId(c)

	data, err := GetOneScoringNote(e, userId, scoringNoteId)
	common.Respond(c, data, err)
}

func (e *Env) GetAllScoringNotes(c *gin.Context) {
	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		notes, err := GetAllScoringNotes(e, userId)
		common.Respond(c, notes, err)
	} else {
		common.Respond(c, nil, errors.New("missing user ID"))
	}
}

func (e *Env) CreateScoringNote(c *gin.Context) {
	var data models.ScoringNote

	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		data.UserId = userId
	}

	data, err = CreateScoringNote(e, data)

	common.Respond(c, data, err)

}

func (e *Env) DeleteScoringNote(c *gin.Context) {
	scoringNoteId := c.Param("id")

	userId := common.GetUserId(c)

	data, err := DeleteScoringNote(e, userId, scoringNoteId)
	common.Respond(c, data, err)
}

func CreateScoringNote(e *Env, data models.ScoringNote) (models.ScoringNote, error) {

	err := validateScoringNote(data)
	if err != nil {
		return models.ScoringNote{}, err
	}

	id, createDate, err := common.Create((*common.Env)(e), common.ScoringNoteTable, &data)

	if err != nil {
		return models.ScoringNote{}, err
	}

	data.ID = id
	data.CreateDate = createDate

	return data, nil
}

func DeleteScoringNote(e *Env, userId, noteId string) (models.ScoringNote, error) {

	// make sure this scoring note exists
	note, err := GetOneScoringNote(e, userId, noteId)
	if err != nil {
		return note, err
	}

	// make sure this user owns this particular scoring note
	err = common.AssertUserId(userId, note.UserId)
	if err != nil {
		return note, err
	}

	err = common.Delete((*common.Env)(e), common.ScoringNoteTable, noteId)
	if err != nil {
		return models.ScoringNote{}, err
	}

	questions, err := GetAllQuestions(e, userId)
	for _, question := range questions {
		if question.ScoringNote == noteId {

			question.ScoringNote = ""
			_, err = UpdateOneQuestion(e, userId, models.IdAsString(question.ID), *question)
			if err != nil {
				return models.ScoringNote{}, err
			}
		}
	}

	return note, nil
}

func GetOneScoringNote(e *Env, userId, noteId string) (models.ScoringNote, error) {
	var data models.ScoringNote
	err := common.GetOne((*common.Env)(e), common.ScoringNoteTable, noteId, &data)
	if err != nil {
		return models.ScoringNote{}, err
	}

	err = common.AssertUserId(userId, data.UserId)
	if err != nil {
		return models.ScoringNote{}, err
	}

	return data, nil
}

func GetAllScoringNotes(e *Env, userId string) ([]*models.ScoringNote, error) {
	filter := map[string]string{"user_id": userId}
	data, err := common.GetAll((*common.Env)(e), common.ScoringNoteTable, filter)
	if err != nil {
		return nil, err
	}

	notes := data.([]*models.ScoringNote)

	// sort the scoring notes by most-recently-used
	sort.Slice(notes, func(i, j int) bool {
		if notes[i].LastUsed.Equal(notes[j].LastUsed) {
			return notes[i].CreateDate.After(notes[j].CreateDate)
		}
		return notes[i].LastUsed.After(notes[j].LastUsed)
	})

	return notes, nil
}

func validateScoringNote(note models.ScoringNote) error {

	if !note.CreateDate.IsZero() {
		return ScoringNoteFieldError{
			ErrorData:  note.CreateDate,
			ErrorField: "create_date",
			Message:    fmt.Sprintf("Scoring note 'create date' field cannot be set in request"),
		}
	}

	if !note.LastUsed.IsZero() {
		return ScoringNoteFieldError{
			ErrorData:  note.LastUsed,
			ErrorField: "last_used",
			Message:    fmt.Sprintf("Scoring note 'last used' field cannot be set in request"),
		}
	}

	// make sure we have a name for this scoring note
	if note.Name == "" {
		return ScoringNoteFieldError{
			ErrorData:  note.Name,
			ErrorField: "name",
			Message:    fmt.Sprintf("Scoring note name must not be empty"),
		}
	}

	// make sure the description is not empty
	if note.Description == "" {
		return ScoringNoteFieldError{
			ErrorData:  note.Description,
			ErrorField: "description",
			Message:    fmt.Sprintf("Scoring note description must not be empty"),
		}
	}

	return nil
}

type ScoringNoteFieldError struct {
	ErrorData  interface{}
	ErrorField string
	Message    string
}

func (e ScoringNoteFieldError) Error() string {
	return common.InvalidDataErrorToString(e, e.Message)
}

func (e ScoringNoteFieldError) Field() string {
	return e.ErrorField
}

func (e ScoringNoteFieldError) Data() interface{} {
	return e.ErrorData
}
