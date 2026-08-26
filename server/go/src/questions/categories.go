package questions

import (
	"errors"
	"fmt"
	"sort"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

// Category CRUD (ticket #179, part of #167): Category is a root model with an
// optional associated scoring note. question.category_id references
// category(id) ON DELETE SET NULL, so deleting a category atomically clears
// the reference on every question that used it — no app-side scan needed
// (same pattern as #85 for scoring notes).

func (e *Env) GetOneCategory(c *gin.Context) {
	categoryId := c.Param("id")
	userId := common.GetUserId(c)
	data, err := GetOneCategory(e, userId, categoryId)
	common.Respond(c, data, err)
}

func (e *Env) GetAllCategories(c *gin.Context) {
	value, ok := c.Get(common.USER_ID)
	if ok {
		userId := value.(string)
		categories, err := GetAllCategories(e, userId)
		common.Respond(c, categories, err)
	} else {
		common.Respond(c, nil, errors.New("missing user ID"))
	}
}

func (e *Env) CreateCategory(c *gin.Context) {
	var data models.Category
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
	data, err = CreateCategory(e, data)
	common.Respond(c, data, err)
}

func (e *Env) UpdateCategory(c *gin.Context) {
	categoryId := c.Param("id")
	userId := common.GetUserId(c)
	var data models.Category
	err := c.ShouldBind(&data)
	if err != nil {
		common.Respond(c, data, err)
		return
	}
	data, err = UpdateCategory(e, userId, categoryId, data)
	common.Respond(c, data, err)
}

func (e *Env) DeleteCategory(c *gin.Context) {
	categoryId := c.Param("id")
	userId := common.GetUserId(c)
	data, err := DeleteCategory(e, userId, categoryId)
	common.Respond(c, data, err)
}

func CreateCategory(e *Env, data models.Category) (models.Category, error) {
	err := validateCategory(data)
	if err != nil {
		return models.Category{}, err
	}

	// scoring_note must reference a note this user owns; the FK on
	// category.scoring_note_id enforces existence, this check keeps the
	// ownership rule and surfaces a clean NonexistentIdError.
	if data.ScoringNote != "" {
		_, err := GetOneScoringNote(e, data.UserId, data.ScoringNote)
		if err != nil {
			return models.Category{}, err
		}
	}

	id, createDate, err := common.Create((*common.Env)(e), common.CategoryTable, &data)
	if err != nil {
		return models.Category{}, err
	}
	data.ID = id
	data.CreateDate = createDate
	return data, nil
}

func UpdateCategory(e *Env, userId, categoryId string, data models.Category) (models.Category, error) {
	// the request body must not set create_date (the stored value wins)
	if !data.CreateDate.IsZero() {
		return models.Category{}, CategoryFieldError{
			ErrorData:  data.CreateDate,
			ErrorField: "create_date",
			Message:    fmt.Sprintf("Category 'create date' field cannot be set in request"),
		}
	}

	// make sure this category exists and is owned by this user
	category, err := GetOneCategory(e, userId, categoryId)
	if err != nil {
		return models.Category{}, err
	}

	// name cannot be cleared (it is required — the merged category always has
	// one); scoring_note is replaced wholesale so it can be cleared.
	if data.Name != "" {
		category.Name = data.Name
	}
	category.ScoringNote = data.ScoringNote

	if category.ScoringNote != "" {
		if _, err := GetOneScoringNote(e, userId, category.ScoringNote); err != nil {
			return models.Category{}, err
		}
	}

	err = common.Set((*common.Env)(e), common.CategoryTable, categoryId, &category)
	if err != nil {
		return models.Category{}, err
	}
	return category, nil
}

func DeleteCategory(e *Env, userId, categoryId string) (models.Category, error) {
	category, err := GetOneCategory(e, userId, categoryId)
	if err != nil {
		return models.Category{}, err
	}

	// question.category_id references category(id) ON DELETE SET NULL
	// (migration 13), so deleting the category atomically clears the
	// reference on every question that used it.
	err = common.Delete((*common.Env)(e), common.CategoryTable, categoryId)
	if err != nil {
		return models.Category{}, err
	}
	return category, nil
}

func GetOneCategory(e *Env, userId, categoryId string) (models.Category, error) {
	var data models.Category
	err := common.GetOne((*common.Env)(e), common.CategoryTable, categoryId, &data)
	if err != nil {
		return models.Category{}, err
	}

	err = common.AssertUserId(userId, data.UserId)
	if err != nil {
		return models.Category{}, err
	}
	return data, nil
}

func GetAllCategories(e *Env, userId string) ([]*models.Category, error) {
	filter := map[string]string{"user_id": userId}
	data, err := common.GetAll((*common.Env)(e), common.CategoryTable, filter)
	if err != nil {
		return nil, err
	}

	categories := data.([]*models.Category)

	// alphabetical, for the editor's category selector
	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Name < categories[j].Name
	})

	return categories, nil
}

func validateCategory(category models.Category) error {
	if !category.CreateDate.IsZero() {
		return CategoryFieldError{
			ErrorData:  category.CreateDate,
			ErrorField: "create_date",
			Message:    fmt.Sprintf("Category 'create date' field cannot be set in request"),
		}
	}

	// make sure we have a name for this category
	if category.Name == "" {
		return CategoryFieldError{
			ErrorData:  category.Name,
			ErrorField: "name",
			Message:    fmt.Sprintf("Category name must not be empty"),
		}
	}

	return nil
}

type CategoryFieldError struct {
	ErrorData  interface{}
	ErrorField string
	Message    string
}

func (e CategoryFieldError) Error() string {
	return common.InvalidDataErrorToString(e, e.Message)
}

func (e CategoryFieldError) Field() string {
	return e.ErrorField
}

func (e CategoryFieldError) Data() interface{} {
	return e.ErrorData
}
