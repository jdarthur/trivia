package questions

import (
	"context"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"strings"
	"time"
)

type Env common.Env

func (e *Env) GetAllQuestions(c *gin.Context) {
	filter := createFilters(c)
	questions, err := common.GetAll((*common.Env)(e), common.QuestionTable, filter)
	common.Respond(c, gin.H{"questions": questions}, err)
}

func (e *Env) GetOneQuestion(c *gin.Context) {
	//get 'id' path param from query
	questionId := c.Param("id")
	userId := common.GetUserId(c)

	question, err := GetOneQuestion(e, userId, questionId)

	common.Respond(c, question, err)
}

func (e *Env) CreateQuestion(c *gin.Context) {

	var data models.Question
	data.RoundsUsed = make([]string, 0)

	//bind JSON data from request to Question model
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}

	userId := common.GetUserId(c)

	question, err := CreateOneQuestion(e, userId, data)
	common.Respond(c, question, err)
}

func (e *Env) UpdateQuestion(c *gin.Context) {

	questionId := c.Param("id")
	var updateBody models.Question

	err := c.ShouldBind(&updateBody)
	if err != nil {
		common.Respond(c, updateBody, err)
		return
	}

	userId := common.GetUserId(c)
	question, err := UpdateOneQuestion(e, userId, questionId, updateBody)

	common.Respond(c, question, err)
}

func (e *Env) DeleteQuestion(c *gin.Context) {
	questionId := c.Param("id")
	userId := common.GetUserId(c)

	question, err := DeleteOneQuestion(e, userId, questionId)

	common.Respond(c, question, err)
}

func (e *Env) deleteFromCollections(userId, targetQuestionId string) error {
	filter := map[string]string{"user_id": userId}

	collections, err := common.GetAll((*common.Env)(e), common.CollectionTable, filter)
	for _, collection := range collections.([]*models.Collection) {
		for _, questionId := range collection.Questions {
			if questionId == targetQuestionId {

				collectionId := collection.ID

				if len(collection.Questions) == 1 {
					fmt.Println("no remaining questions... delete collection " + collectionId)
					err = common.Delete((*common.Env)(e), common.CollectionTable, collectionId)
					if err != nil {
						return err
					}
				} else {
					fmt.Println("remove question ID " + questionId + " from collection " + collectionId)
					err = common.Pull((*common.Env)(e), common.CollectionTable, collectionId, models.Questions, questionId)
				}
			}
		}
	}

	return nil
}

//Merge update body into existing question
func merge(update *models.Question, original *models.Question) {

	if update.Category != "" {
		original.Category = update.Category
	}
	if update.Question != "" {
		original.Question = update.Question
	}
	if update.Answer != "" {
		original.Answer = update.Answer
	}

	original.ScoringNote = update.ScoringNote

	// question_type defaults to freeform on input; children are replaced
	// wholesale from the update body (changing type drops the other table's
	// rows via the replace-wholesale write below).
	if update.QuestionType != "" {
		original.QuestionType = update.QuestionType
	}
	original.Choices = update.Choices
	original.Pairs = update.Pairs
}

type AttemptedToSetRoundsUsedError struct {
	RoundsUsed interface{}
}

func (e AttemptedToSetRoundsUsedError) Error() string {
	return "Attempted to set field: 'rounds_used'"
}

func (e AttemptedToSetRoundsUsedError) Field() string {
	return models.RoundsUsed
}

func (e AttemptedToSetRoundsUsedError) Data() interface{} {
	return e.RoundsUsed
}

// InvalidQuestionTypeError is returned when question_type is not one of
// freeform / multiple_choice / matching.
type InvalidQuestionTypeError struct {
	QuestionType string
}

func (e InvalidQuestionTypeError) Error() string {
	return "Invalid question type: '" + e.QuestionType + "' (expected freeform, multiple_choice, or matching)"
}

func (e InvalidQuestionTypeError) Field() string {
	return models.QuestionType
}

func (e InvalidQuestionTypeError) Data() interface{} {
	return e.QuestionType
}

// MissingCorrectChoiceError is returned when a multiple_choice question has no
// correct option (the DB enforces at most one via a partial unique index).
type MissingCorrectChoiceError struct {
	Choices []models.QuestionChoice
}

func (e MissingCorrectChoiceError) Error() string {
	return "multiple_choice question must have at least one correct choice"
}

func (e MissingCorrectChoiceError) Field() string {
	return models.QuestionType
}

func (e MissingCorrectChoiceError) Data() interface{} {
	return e.Choices
}

// MissingPairsError is returned when a matching question has no pairs.
type MissingPairsError struct {
	Pairs []models.QuestionPair
}

func (e MissingPairsError) Error() string {
	return "matching question must have at least one pair"
}

func (e MissingPairsError) Field() string {
	return models.QuestionType
}

func (e MissingPairsError) Data() interface{} {
	return e.Pairs
}

// MissingAnswerError is returned when a freeform question has no answer
// (freeform keeps the mod-written answer, unlike structured types).
type MissingAnswerError struct {
	Question string
}

func (e MissingAnswerError) Error() string {
	return "freeform question requires an answer"
}

func (e MissingAnswerError) Field() string {
	return "answer"
}

func (e MissingAnswerError) Data() interface{} {
	return e.Question
}

// FreeformChildRowsError is returned when a freeform question carries
// structured child rows (choices or pairs), which it must not.
type FreeformChildRowsError struct {
	FieldName string
	Rows      interface{}
}

func (e FreeformChildRowsError) Error() string {
	return "freeform question cannot have " + e.FieldName
}

func (e FreeformChildRowsError) Field() string {
	return e.FieldName
}

func (e FreeformChildRowsError) Data() interface{} {
	return e.Rows
}

// MultipleChoiceWithPairsError is returned when a multiple_choice question
// carries matching pairs (the two structured payloads are mutually exclusive).
type MultipleChoiceWithPairsError struct {
	Pairs []models.QuestionPair
}

func (e MultipleChoiceWithPairsError) Error() string {
	return "multiple_choice question cannot have pairs"
}

func (e MultipleChoiceWithPairsError) Field() string {
	return models.Pairs
}

func (e MultipleChoiceWithPairsError) Data() interface{} {
	return e.Pairs
}

// TooFewChoicesError is returned when a multiple_choice question has fewer than
// two options.
type TooFewChoicesError struct {
	Choices []models.QuestionChoice
}

func (e TooFewChoicesError) Error() string {
	return "multiple_choice question requires at least two choices"
}

func (e TooFewChoicesError) Field() string {
	return models.Choices
}

func (e TooFewChoicesError) Data() interface{} {
	return e.Choices
}

// DuplicateChoiceTextError is returned when a multiple_choice question has two
// options with the same text (ambiguous selection).
type DuplicateChoiceTextError struct {
	Text string
}

func (e DuplicateChoiceTextError) Error() string {
	return "multiple_choice question cannot have duplicate option text"
}

func (e DuplicateChoiceTextError) Field() string {
	return models.Choices
}

func (e DuplicateChoiceTextError) Data() interface{} {
	return e.Text
}

// MatchingWithChoicesError is returned when a matching question carries
// multiple_choice options (the two structured payloads are mutually exclusive).
type MatchingWithChoicesError struct {
	Choices []models.QuestionChoice
}

func (e MatchingWithChoicesError) Error() string {
	return "matching question cannot have choices"
}

func (e MatchingWithChoicesError) Field() string {
	return models.Choices
}

func (e MatchingWithChoicesError) Data() interface{} {
	return e.Choices
}

// DuplicatePairTextError is returned when a matching question has two pairs
// sharing a left text or a right text — an unambiguous mapping (and therefore
// the JSON-map answer) is impossible otherwise.
type DuplicatePairTextError struct {
	Side string
	Text string
}

func (e DuplicatePairTextError) Error() string {
	return "matching question cannot have duplicate " + e.Side + " text"
}

func (e DuplicatePairTextError) Field() string {
	return models.Pairs
}

func (e DuplicatePairTextError) Data() interface{} {
	return e.Text
}

// validateQuestionType enforces the per-type payload rules before the row and
// its children are written. The matrix (ticket #99):
//
//	freeform         answer required; choices/pairs empty
//	multiple_choice  derived answer; 2+ options; exactly one correct (app
//	                 enforces >=1, the DB partial unique index enforces <=1);
//	                 no duplicate option text; pairs empty
//	matching         derived answer; 1+ pairs; left texts unique; right texts
//	                 unique (unambiguous mapping, makes the JSON-map answer
//	                 safe); choices empty
func validateQuestionType(data models.Question) error {
	switch data.QuestionType {
	case "freeform":
		if data.Answer == "" {
			return MissingAnswerError{Question: data.Question}
		}
		if len(data.Choices) != 0 {
			return FreeformChildRowsError{FieldName: models.Choices, Rows: data.Choices}
		}
		if len(data.Pairs) != 0 {
			return FreeformChildRowsError{FieldName: models.Pairs, Rows: data.Pairs}
		}
		return nil
	case "multiple_choice":
		if len(data.Pairs) != 0 {
			return MultipleChoiceWithPairsError{Pairs: data.Pairs}
		}
		if len(data.Choices) < 2 {
			return TooFewChoicesError{Choices: data.Choices}
		}
		seen := make(map[string]bool)
		correct := 0
		for _, c := range data.Choices {
			if c.IsCorrect {
				correct++
			}
			text := strings.TrimSpace(c.Text)
			if seen[text] {
				return DuplicateChoiceTextError{Text: c.Text}
			}
			seen[text] = true
		}
		if correct < 1 {
			return MissingCorrectChoiceError{Choices: data.Choices}
		}
		return nil
	case "matching":
		if len(data.Choices) != 0 {
			return MatchingWithChoicesError{Choices: data.Choices}
		}
		if len(data.Pairs) < 1 {
			return MissingPairsError{Pairs: data.Pairs}
		}
		leftSeen := make(map[string]bool)
		rightSeen := make(map[string]bool)
		for _, p := range data.Pairs {
			left := strings.TrimSpace(p.Left)
			right := strings.TrimSpace(p.Right)
			if leftSeen[left] {
				return DuplicatePairTextError{Side: "left", Text: p.Left}
			}
			if rightSeen[right] {
				return DuplicatePairTextError{Side: "right", Text: p.Right}
			}
			leftSeen[left] = true
			rightSeen[right] = true
		}
		return nil
	default:
		return InvalidQuestionTypeError{QuestionType: data.QuestionType}
	}
}

// derivedAnswer renders the question's answer string from its structured child
// rows — MC = the correct option's text; matching = a "left -> right" string,
// one mapping per line. Used when writing the question row so the stored answer
// column (and everything that reads it, e.g. the score-time snapshot refresh)
// carries the derived value. freeform returns the caller-supplied answer.
func derivedAnswer(data models.Question) string {
	switch data.QuestionType {
	case "multiple_choice":
		for _, c := range data.Choices {
			if c.IsCorrect {
				return c.Text
			}
		}
		return ""
	case "matching":
		var sb strings.Builder
		for i, p := range data.Pairs {
			if i > 0 {
				sb.WriteString("\n")
			}
			fmt.Fprintf(&sb, "%s -> %s", p.Left, p.Right)
		}
		return sb.String()
	default:
		return data.Answer
	}
}

// nilOrEmpty maps an empty scoring note to NULL, the "no note" sentinel for the
// nullable question.scoring_note_id FK column (ticket #85). Mirrors
// common's nilIfEmpty for handlers that write the question row themselves.
func nilOrEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// replaceQuestionChildren deletes and re-inserts a question's structured child
// rows wholesale inside the caller's write transaction. position comes from the
// slice index. Rows for the type the question is not using are dropped.
func replaceQuestionChildren(q common.Queryer, ctx context.Context, data models.Question) error {
	if _, err := q.ExecContext(ctx, `DELETE FROM question_choice WHERE question_id = ?`, data.ID); err != nil {
		return err
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM question_match WHERE question_id = ?`, data.ID); err != nil {
		return err
	}

	if data.QuestionType == "multiple_choice" {
		for i, c := range data.Choices {
			correct := 0
			if c.IsCorrect {
				correct = 1
			}
			if _, err := q.ExecContext(ctx,
				`INSERT INTO question_choice (question_id, position, text, is_correct) VALUES (?, ?, ?, ?)`,
				data.ID, i, c.Text, correct); err != nil {
				return err
			}
		}
	} else if data.QuestionType == "matching" {
		for i, p := range data.Pairs {
			if _, err := q.ExecContext(ctx,
				`INSERT INTO question_match (question_id, position, left_text, right_text) VALUES (?, ?, ?, ?)`,
				data.ID, i, p.Left, p.Right); err != nil {
				return err
			}
		}
	}
	return nil
}

func GetAllQuestions(e *Env, userId string) ([]*models.Question, error) {
	filter := map[string]string{"user_id": userId}
	data, err := common.GetAll((*common.Env)(e), common.QuestionTable, filter)
	if err != nil {
		return nil, err
	}

	questions := data.([]*models.Question)
	return questions, nil
}

//create unused_only and text_filter mongodb queries from request
func createFilters(c *gin.Context) map[string]interface{} {
	filter := make(map[string]interface{})
	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		filter["user_id"] = userId
	}

	//unused_only means that rounds_used = []
	unusedOnly := c.DefaultQuery("unused_only", "false")
	if strings.ToLower(unusedOnly) == "true" {
		filter[models.RoundsUsed+".0"] = common.M{"$exists": false}
	}

	//text_filter means that the search string appears in category/question/answer (case-insensitive)
	textFilter := c.Query("text_filter")
	if textFilter != "" {
		search := common.M{"$regex": common.RegEx{Pattern: ".*" + textFilter + ".*", Options: "i"}}
		filter["$or"] = []common.M{{"question": search}, {"answer": search}, {"category": search}}
	}
	return filter
}

func GetOneQuestion(e *Env, userId, questionId string) (models.Question, error) {
	var data models.Question
	err := common.GetOne((*common.Env)(e), common.QuestionTable, questionId, &data)
	if err != nil {
		return models.Question{}, err
	}

	err = common.AssertUserId(userId, data.UserId)
	if err != nil {
		return models.Question{}, err
	}

	return data, nil
}

func DeleteOneQuestion(e *Env, userId, questionId string) (models.Question, error) {
	question, err := GetOneQuestion(e, userId, questionId)
	if err != nil {
		return models.Question{}, err
	}

	err = common.AssertUserId(userId, question.UserId)
	if err != nil {
		return models.Question{}, err
	}

	err = common.Delete((*common.Env)(e), common.QuestionTable, questionId)
	if err != nil {
		return models.Question{}, err
	}

	for _, roundId := range question.RoundsUsed {
		fmt.Println("remove question ID " + question.ID + " from round " + roundId)
		err = common.Pull((*common.Env)(e), common.RoundTable, roundId, models.Questions, question.ID)
		if err != nil {
			return models.Question{}, err
		}
	}

	return question, e.deleteFromCollections(userId, questionId)
}

func CreateOneQuestion(e *Env, userId string, data models.Question) (models.Question, error) {

	data.UserId = userId

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		return models.Question{}, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed}
	}

	// empty question_type on input defaults to freeform (current behavior)
	if data.QuestionType == "" {
		data.QuestionType = "freeform"
	}

	// validate per type before writing the row and its children
	if err := validateQuestionType(data); err != nil {
		return models.Question{}, err
	}

	// scoring_note must reference a note this user owns; the FK on
	// question.scoring_note_id enforces existence, this check keeps the
	// ownership rule and surfaces a clean NonexistentIdError (same as update).
	if data.ScoringNote != "" {
		_, err := GetOneScoringNote(e, userId, data.ScoringNote)
		if err != nil {
			return models.Question{}, err
		}
	}

	id := uuid.New().String()
	createDate := time.Now()
	data.ID = id
	data.CreateDate = createDate

	// write the question row and replace its child rows wholesale in one
	// transaction so the row and its children never diverge.
	err := common.WithWriteTx(e.Db, func(q common.Queryer) error {
		ctx := context.Background()
		if _, err := q.ExecContext(ctx,
			`INSERT INTO question (id, create_date, category, question, answer, user_id, scoring_note_id, question_type)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, common.FormatTime(createDate), data.Category, data.Question, derivedAnswer(data),
			data.UserId, nilOrEmpty(data.ScoringNote), data.QuestionType); err != nil {
			return err
		}
		return replaceQuestionChildren(q, ctx, data)
	})
	if err != nil {
		return models.Question{}, err
	}

	if data.ScoringNote != "" {
		err = UpdateLastUsedForScoringNote(e, userId, data.ScoringNote)
	}

	return data, err
}

func UpdateOneQuestion(e *Env, userId, questionId string, data models.Question) (models.Question, error) {

	data.UserId = userId

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		return models.Question{}, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed}
	}

	if data.ScoringNote != "" {
		_, err := GetOneScoringNote(e, userId, data.ScoringNote)
		if err != nil {
			return models.Question{}, err
		}
	}

	question, err := GetOneQuestion(e, userId, questionId)
	if err != nil {
		return models.Question{}, err
	}

	merge(&data, &question)

	// validate the merged question per type before writing
	if err := validateQuestionType(question); err != nil {
		return models.Question{}, err
	}

	// write the question row and replace its child rows wholesale in one
	// transaction so the row and its children never diverge.
	err = common.WithWriteTx(e.Db, func(q common.Queryer) error {
		ctx := context.Background()
		if _, err := q.ExecContext(ctx,
			`UPDATE question SET category = ?, question = ?, answer = ?, user_id = ?,
				scoring_note_id = ?, question_type = ? WHERE id = ?`,
			question.Category, question.Question, derivedAnswer(question), question.UserId,
			nilOrEmpty(question.ScoringNote), question.QuestionType, questionId); err != nil {
			return err
		}
		return replaceQuestionChildren(q, ctx, question)
	})
	if err != nil {
		return models.Question{}, err
	}

	if data.ScoringNote != "" {
		err = UpdateLastUsedForScoringNote(e, userId, data.ScoringNote)
	}

	return data, err
}

func UpdateLastUsedForScoringNote(e *Env, userId, scoringNoteId string) error {
	note, err := GetOneScoringNote(e, userId, scoringNoteId)
	if err != nil {
		return err
	}

	note.LastUsed = time.Now()

	return common.Set((*common.Env)(e), common.ScoringNoteTable, scoringNoteId, note)
}
