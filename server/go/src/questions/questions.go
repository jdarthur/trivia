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

// GetAllQuestions lists questions, honoring the shared list query params of
// ticket #195: unused_only (no round contains the question), text_filter across
// question/answer/category, sort/order, and page/page_size.
func (e *Env) GetAllQuestions(c *gin.Context) {
	query, err := common.ParseListQuery(c, common.QuestionTable)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	// Assert, don't just read: an unset user would drop the user_id clause and
	// list every user's records.
	userId, err := common.AssertHasUserId(c)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	query.UserId = userId

	result, err := common.GetAllPaged((*common.Env)(e), common.QuestionTable, query)
	common.RespondList(c, "questions", result, err)
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
	var updateBody QuestionUpdate

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
	collections, err := common.GetAllOwned((*common.Env)(e), common.CollectionTable, userId)
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

// QuestionUpdate is the wire shape for PUT /editor/question/:id. It mirrors
// models.Question's editable fields, except Category is a *string so the
// editor can distinguish "field absent" (nil = leave the question's category
// unchanged) from an explicit clear ("" = the "None" option) — ticket #185.
// The other fields keep their existing merge semantics (empty = no change;
// child rows are replaced wholesale).
type QuestionUpdate struct {
	Category     *string                      `json:"category"`
	Question     string                       `json:"question"`
	Answer       string                       `json:"answer"`
	RoundsUsed   []string                     `json:"rounds_used"`
	QuestionType string                       `json:"question_type"`
	Choices      []models.QuestionChoice      `json:"choices"`
	Pairs        []models.QuestionPair        `json:"pairs"`
	Buckets      []models.QuestionBucket      `json:"buckets"`
	Items        []models.QuestionBucketItem  `json:"items"`
	Ordered      []models.QuestionOrderedItem `json:"ordered"`
}

// Merge update body into existing question
func merge(update *QuestionUpdate, original *models.Question) {

	// nil = field absent (leave unchanged); "" = the editor's "None" option
	// (clear the category).
	if update.Category != nil {
		original.Category = *update.Category
	}
	if update.Question != "" {
		original.Question = update.Question
	}
	if update.Answer != "" {
		original.Answer = update.Answer
	}

	// question_type defaults to freeform on input; children are replaced
	// wholesale from the update body (changing type drops the other table's
	// rows via the replace-wholesale write below).
	if update.QuestionType != "" {
		original.QuestionType = update.QuestionType
	}
	original.Choices = update.Choices
	original.Pairs = update.Pairs
	original.Buckets = update.Buckets
	original.Items = update.Items
	original.Ordered = update.Ordered
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
// freeform / multiple_choice / matching / bucketing.
type InvalidQuestionTypeError struct {
	QuestionType string
}

func (e InvalidQuestionTypeError) Error() string {
	return "Invalid question type: '" + e.QuestionType + "' (expected freeform, multiple_choice, matching, or bucketing)"
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

// MissingBucketsError is returned when a bucketing question has fewer than two
// buckets (a single bucket would make the question trivial).
type MissingBucketsError struct {
	Buckets []models.QuestionBucket
}

func (e MissingBucketsError) Error() string {
	return "bucketing question must have at least two buckets"
}

func (e MissingBucketsError) Field() string {
	return models.Buckets
}

func (e MissingBucketsError) Data() interface{} {
	return e.Buckets
}

// MissingItemsError is returned when a bucketing question has no items.
type MissingItemsError struct {
	Items []models.QuestionBucketItem
}

func (e MissingItemsError) Error() string {
	return "bucketing question must have at least one item"
}

func (e MissingItemsError) Field() string {
	return models.Items
}

func (e MissingItemsError) Data() interface{} {
	return e.Items
}

// DuplicateBucketTextError is returned when a bucketing question has two
// buckets with the same text (ambiguous categorization).
type DuplicateBucketTextError struct {
	Text string
}

func (e DuplicateBucketTextError) Error() string {
	return "bucketing question cannot have duplicate bucket text"
}

func (e DuplicateBucketTextError) Field() string {
	return models.Buckets
}

func (e DuplicateBucketTextError) Data() interface{} {
	return e.Text
}

// DuplicateItemTextError is returned when a bucketing question has two items
// with the same text (ambiguous categorization).
type DuplicateItemTextError struct {
	Text string
}

func (e DuplicateItemTextError) Error() string {
	return "bucketing question cannot have duplicate item text"
}

func (e DuplicateItemTextError) Field() string {
	return models.Items
}

func (e DuplicateItemTextError) Data() interface{} {
	return e.Text
}

// UnknownBucketError is returned when a bucketing question assigns an item to
// a bucket that is not in the question's bucket list.
type UnknownBucketError struct {
	Item   string
	Bucket string
}

func (e UnknownBucketError) Error() string {
	return "item '" + e.Item + "' is assigned to unknown bucket '" + e.Bucket + "'"
}

func (e UnknownBucketError) Field() string {
	return models.Items
}

func (e UnknownBucketError) Data() interface{} {
	return e.Bucket
}

// BucketingWithChoicesError is returned when a bucketing question carries
// multiple_choice options (the structured payloads are mutually exclusive).
type BucketingWithChoicesError struct {
	Choices []models.QuestionChoice
}

func (e BucketingWithChoicesError) Error() string {
	return "bucketing question cannot have choices"
}

func (e BucketingWithChoicesError) Field() string {
	return models.Choices
}

func (e BucketingWithChoicesError) Data() interface{} {
	return e.Choices
}

// BucketingWithPairsError is returned when a bucketing question carries
// matching pairs (the structured payloads are mutually exclusive).
type BucketingWithPairsError struct {
	Pairs []models.QuestionPair
}

func (e BucketingWithPairsError) Error() string {
	return "bucketing question cannot have pairs"
}

func (e BucketingWithPairsError) Field() string {
	return models.Pairs
}

func (e BucketingWithPairsError) Data() interface{} {
	return e.Pairs
}

// MatchingWithBucketsError is returned when a matching question carries
// bucketing child rows (the structured payloads are mutually exclusive).
type MatchingWithBucketsError struct {
	Buckets []models.QuestionBucket
	Items   []models.QuestionBucketItem
}

func (e MatchingWithBucketsError) Error() string {
	return "matching question cannot have buckets or items"
}

func (e MatchingWithBucketsError) Field() string {
	return models.Buckets
}

func (e MatchingWithBucketsError) Data() interface{} {
	return e.Buckets
}

// MultipleChoiceWithBucketsError is returned when a multiple_choice question
// carries bucketing child rows (the structured payloads are mutually
// exclusive).
type MultipleChoiceWithBucketsError struct {
	Buckets []models.QuestionBucket
	Items   []models.QuestionBucketItem
}

func (e MultipleChoiceWithBucketsError) Error() string {
	return "multiple_choice question cannot have buckets or items"
}

func (e MultipleChoiceWithBucketsError) Field() string {
	return models.Buckets
}

func (e MultipleChoiceWithBucketsError) Data() interface{} {
	return e.Buckets
}

// MissingOrderingPromptError is returned when an ordering question has no
// prompt (the ordering instruction).
type MissingOrderingPromptError struct {
	Question string
}

func (e MissingOrderingPromptError) Error() string {
	return "ordering question requires a prompt (the ordering instruction)"
}

func (e MissingOrderingPromptError) Field() string {
	return "question"
}

func (e MissingOrderingPromptError) Data() interface{} {
	return e.Question
}

// MissingOrderedItemsError is returned when an ordering question has fewer than
// two items (a single item would make the question trivial).
type MissingOrderedItemsError struct {
	Ordered []models.QuestionOrderedItem
}

func (e MissingOrderedItemsError) Error() string {
	return "ordering question must have at least two items"
}

func (e MissingOrderedItemsError) Field() string {
	return models.Ordered
}

func (e MissingOrderedItemsError) Data() interface{} {
	return e.Ordered
}

// DuplicateOrderedItemTextError is returned when an ordering question has two
// items with the same text (ambiguous order).
type DuplicateOrderedItemTextError struct {
	Text string
}

func (e DuplicateOrderedItemTextError) Error() string {
	return "ordering question cannot have duplicate item text"
}

func (e DuplicateOrderedItemTextError) Field() string {
	return models.Ordered
}

func (e DuplicateOrderedItemTextError) Data() interface{} {
	return e.Text
}

// OrderingWithChoicesError is returned when an ordering question carries
// multiple_choice options (the structured payloads are mutually exclusive).
type OrderingWithChoicesError struct {
	Choices []models.QuestionChoice
}

func (e OrderingWithChoicesError) Error() string {
	return "ordering question cannot have choices"
}

func (e OrderingWithChoicesError) Field() string {
	return models.Choices
}

func (e OrderingWithChoicesError) Data() interface{} {
	return e.Choices
}

// OrderingWithPairsError is returned when an ordering question carries matching
// pairs (the structured payloads are mutually exclusive).
type OrderingWithPairsError struct {
	Pairs []models.QuestionPair
}

func (e OrderingWithPairsError) Error() string {
	return "ordering question cannot have pairs"
}

func (e OrderingWithPairsError) Field() string {
	return models.Pairs
}

func (e OrderingWithPairsError) Data() interface{} {
	return e.Pairs
}

// OrderingWithBucketsError is returned when an ordering question carries
// bucketing child rows (the structured payloads are mutually exclusive).
type OrderingWithBucketsError struct {
	Rows      interface{}
	FieldName string
}

func (e OrderingWithBucketsError) Error() string {
	return "ordering question cannot have " + e.FieldName
}

func (e OrderingWithBucketsError) Field() string {
	return e.FieldName
}

func (e OrderingWithBucketsError) Data() interface{} {
	return e.Rows
}

// validateQuestionType enforces the per-type payload rules before the row and
// its children are written. The matrix (tickets #99, #164):
//
//	freeform         answer required; choices/pairs/buckets/items empty
//	multiple_choice  derived answer; 2+ options; exactly one correct (app
//	                 enforces >=1, the DB partial unique index enforces <=1);
//	                 no duplicate option text; pairs/buckets/items empty
//	matching         derived answer; 1+ pairs; left texts unique; right texts
//	                 unique (unambiguous mapping, makes the JSON-map answer
//	                 safe); choices/buckets/items empty
//	bucketing        derived answer; 2+ buckets; 1+ items; bucket texts
//	                 unique; item texts unique; every item assigned to a
//	                 declared bucket; choices/pairs empty
//	ordering         derived answer; prompt required; 2+ items; item texts
//	                 unique; choices/pairs/buckets/items empty
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
		if len(data.Buckets) != 0 {
			return FreeformChildRowsError{FieldName: models.Buckets, Rows: data.Buckets}
		}
		if len(data.Items) != 0 {
			return FreeformChildRowsError{FieldName: models.Items, Rows: data.Items}
		}
		return nil
	case "multiple_choice":
		if len(data.Pairs) != 0 {
			return MultipleChoiceWithPairsError{Pairs: data.Pairs}
		}
		if len(data.Buckets) != 0 || len(data.Items) != 0 {
			return MultipleChoiceWithBucketsError{Buckets: data.Buckets, Items: data.Items}
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
		if len(data.Buckets) != 0 || len(data.Items) != 0 {
			return MatchingWithBucketsError{Buckets: data.Buckets, Items: data.Items}
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
	case "bucketing":
		if len(data.Choices) != 0 {
			return BucketingWithChoicesError{Choices: data.Choices}
		}
		if len(data.Pairs) != 0 {
			return BucketingWithPairsError{Pairs: data.Pairs}
		}
		if len(data.Buckets) < 2 {
			return MissingBucketsError{Buckets: data.Buckets}
		}
		if len(data.Items) < 1 {
			return MissingItemsError{Items: data.Items}
		}
		bucketSeen := make(map[string]bool)
		for _, b := range data.Buckets {
			text := strings.TrimSpace(b.Text)
			if bucketSeen[text] {
				return DuplicateBucketTextError{Text: b.Text}
			}
			bucketSeen[text] = true
		}
		itemSeen := make(map[string]bool)
		for _, item := range data.Items {
			text := strings.TrimSpace(item.Text)
			if itemSeen[text] {
				return DuplicateItemTextError{Text: item.Text}
			}
			itemSeen[text] = true
			if !bucketSeen[strings.TrimSpace(item.Bucket)] {
				return UnknownBucketError{Item: item.Text, Bucket: item.Bucket}
			}
		}
		return nil
	case "ordering":
		if data.Question == "" {
			return MissingOrderingPromptError{Question: data.Question}
		}
		if len(data.Choices) != 0 {
			return OrderingWithChoicesError{Choices: data.Choices}
		}
		if len(data.Pairs) != 0 {
			return OrderingWithPairsError{Pairs: data.Pairs}
		}
		if len(data.Buckets) != 0 {
			return OrderingWithBucketsError{FieldName: models.Buckets, Rows: data.Buckets}
		}
		if len(data.Items) != 0 {
			return OrderingWithBucketsError{FieldName: models.Items, Rows: data.Items}
		}
		if len(data.Ordered) < 2 {
			return MissingOrderedItemsError{Ordered: data.Ordered}
		}
		seen := make(map[string]bool)
		for _, item := range data.Ordered {
			text := strings.TrimSpace(item.Text)
			if seen[text] {
				return DuplicateOrderedItemTextError{Text: item.Text}
			}
			seen[text] = true
		}
		return nil
	default:
		return InvalidQuestionTypeError{QuestionType: data.QuestionType}
	}
}

// derivedAnswer renders the question's answer string from its structured child
// rows — MC = the correct option's text; matching = a "left -> right" string,
// one mapping per line; bucketing = an "item -> bucket" string, one mapping
// per line; ordering = the canonical item order, one item per line. Used when
// writing the question row so the stored answer column (and everything that
// reads it, e.g. the score-time snapshot refresh) carries the derived value.
// freeform returns the caller-supplied answer.
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
	case "bucketing":
		var sb strings.Builder
		for i, item := range data.Items {
			if i > 0 {
				sb.WriteString("\n")
			}
			fmt.Fprintf(&sb, "%s -> %s", item.Text, item.Bucket)
		}
		return sb.String()
	case "ordering":
		var sb strings.Builder
		for i, item := range data.Ordered {
			if i > 0 {
				sb.WriteString("\n")
			}
			sb.WriteString(item.Text)
		}
		return sb.String()
	default:
		return data.Answer
	}
}

// nilOrEmpty maps an empty category to NULL, the "no category" sentinel for
// the nullable question.category_id FK column (ticket #178). Mirrors common's
// nilIfEmpty for handlers that write the question row themselves.
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
	if _, err := q.ExecContext(ctx, `DELETE FROM question_bucket WHERE question_id = ?`, data.ID); err != nil {
		return err
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM question_bucket_item WHERE question_id = ?`, data.ID); err != nil {
		return err
	}
	if _, err := q.ExecContext(ctx, `DELETE FROM question_ordered WHERE question_id = ?`, data.ID); err != nil {
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
	} else if data.QuestionType == "bucketing" {
		for i, b := range data.Buckets {
			if _, err := q.ExecContext(ctx,
				`INSERT INTO question_bucket (question_id, position, text) VALUES (?, ?, ?)`,
				data.ID, i, b.Text); err != nil {
				return err
			}
		}
		for i, item := range data.Items {
			if _, err := q.ExecContext(ctx,
				`INSERT INTO question_bucket_item (question_id, position, text, bucket_text) VALUES (?, ?, ?, ?)`,
				data.ID, i, item.Text, item.Bucket); err != nil {
				return err
			}
		}
	} else if data.QuestionType == "ordering" {
		for i, item := range data.Ordered {
			if _, err := q.ExecContext(ctx,
				`INSERT INTO question_ordered (question_id, position, text) VALUES (?, ?, ?)`,
				data.ID, i, item.Text); err != nil {
				return err
			}
		}
	}
	return nil
}

func GetAllQuestions(e *Env, userId string) ([]*models.Question, error) {
	data, err := common.GetAllOwned((*common.Env)(e), common.QuestionTable, userId)
	if err != nil {
		return nil, err
	}

	questions := data.([]*models.Question)
	return questions, nil
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

	// category must reference a category this user owns; the FK on
	// question.category_id enforces existence, this check keeps the ownership
	// rule and surfaces a clean NonexistentIdError (same as update).
	if data.Category != "" {
		_, err := GetOneCategory(e, userId, data.Category)
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
			`INSERT INTO question (id, create_date, category_id, question, answer, user_id, question_type)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id, common.FormatTime(createDate), nilOrEmpty(data.Category), data.Question, derivedAnswer(data),
			data.UserId, data.QuestionType); err != nil {
			return err
		}
		return replaceQuestionChildren(q, ctx, data)
	})
	if err != nil {
		return models.Question{}, err
	}

	// The category carries the scoring note now (ticket #179): using a
	// category bumps its note's last_used so recently-used notes float to
	// the top of the picker.
	if data.Category != "" {
		category, err := GetOneCategory(e, userId, data.Category)
		if err != nil {
			return models.Question{}, err
		}
		if category.ScoringNote != "" {
			err = UpdateLastUsedForScoringNote(e, userId, category.ScoringNote)
		}
	}

	return data, err
}

func UpdateOneQuestion(e *Env, userId, questionId string, data QuestionUpdate) (models.Question, error) {

	//rounds_used cannot be set by this API (it is set indirectly on a question in the rounds API)
	if len(data.RoundsUsed) != 0 {
		return models.Question{}, AttemptedToSetRoundsUsedError{RoundsUsed: data.RoundsUsed}
	}

	question, err := GetOneQuestion(e, userId, questionId)
	if err != nil {
		return models.Question{}, err
	}

	// capture the category before the merge so the last_used bump below only
	// fires when this edit actually changed it (ticket #188)
	oldCategory := question.Category

	merge(&data, &question)

	// category must reference a category this user owns (empty = no category,
	// which is fine); the FK on question.category_id enforces existence, this
	// check keeps the ownership rule and surfaces a clean NonexistentIdError.
	if question.Category != "" {
		_, err := GetOneCategory(e, userId, question.Category)
		if err != nil {
			return models.Question{}, err
		}
	}

	// validate the merged question per type before writing
	if err := validateQuestionType(question); err != nil {
		return models.Question{}, err
	}

	// write the question row and replace its child rows wholesale in one
	// transaction so the row and its children never diverge.
	err = common.WithWriteTx(e.Db, func(q common.Queryer) error {
		ctx := context.Background()
		if _, err := q.ExecContext(ctx,
			`UPDATE question SET category_id = ?, question = ?, answer = ?, user_id = ?,
				question_type = ? WHERE id = ?`,
			nilOrEmpty(question.Category), question.Question, derivedAnswer(question), question.UserId,
			question.QuestionType, questionId); err != nil {
			return err
		}
		return replaceQuestionChildren(q, ctx, question)
	})
	if err != nil {
		return models.Question{}, err
	}

	// The category carries the scoring note now (ticket #179): assigning a
	// *different* category bumps its note's last_used so recently-used notes
	// float to the top of the picker. An edit that keeps the category (or
	// clears it) must not bump the note — pre-#179 only bumped when the note
	// was actually part of the update (ticket #188).
	if question.Category != "" && question.Category != oldCategory {
		category, err := GetOneCategory(e, userId, question.Category)
		if err != nil {
			return models.Question{}, err
		}
		if category.ScoringNote != "" {
			err = UpdateLastUsedForScoringNote(e, userId, category.ScoringNote)
		}
	}

	return question, err
}

func UpdateLastUsedForScoringNote(e *Env, userId, scoringNoteId string) error {
	note, err := GetOneScoringNote(e, userId, scoringNoteId)
	if err != nil {
		return err
	}

	note.LastUsed = time.Now()

	return common.Set((*common.Env)(e), common.ScoringNoteTable, scoringNoteId, note)
}
