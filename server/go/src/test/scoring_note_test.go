package test

import (
	"fmt"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/questions"
	"testing"
	"time"
)

func TestScoringNoteCrud(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId:      userId,
		Name:        "test note",
		Description: "test scoring note with a desc",
	}

	note, err := questions.CreateScoringNote(env, scoringNote)
	if err != nil {
		t.Fatal(err)
	}

	noteId := note.ID

	_, err = questions.GetOneScoringNote(env, userId, noteId)
	if err != nil {
		t.Fatal(err)
	}

	_, err = questions.DeleteScoringNote(env, userId, noteId)
	if err != nil {
		t.Fatal(err)
	}

	_, err = questions.GetOneScoringNote(env, userId, noteId)
	if err == nil {
		t.Fatal(fmt.Sprintf("Expected GetOneScoringNote to fail after delete of note '%s'", noteId))
	}
}

func TestOrderByCreateDate(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	err := deleteAllNotes(env, userId)
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 3; i++ {
		scoringNote := models.ScoringNote{
			UserId:      userId,
			Name:        fmt.Sprintf("test note %d", i),
			Description: "test scoring note with a desc",
		}

		_, err := questions.CreateScoringNote(env, scoringNote)
		if err != nil {
			t.Fatal(err)
		}

		// sleep so that we have distinct create times
		time.Sleep(time.Millisecond)
	}

	notes, err := questions.GetAllScoringNotes(env, userId)
	if err != nil {
		t.Error(err)
	}

	for i, note := range notes {
		expectedName := fmt.Sprintf("test note %d", 2-i)

		if note.Name != expectedName {

			t.Errorf("Expected name %s at index %d, got name %s", expectedName, i, note.Name)
		}

		_, err = questions.DeleteScoringNote(env, userId, note.ID)
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestSetCreateDate(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId:     userId,
		CreateDate: time.Now(),
	}

	_, err := questions.CreateScoringNote(env, scoringNote)
	if err == nil {
		t.Error("Expected error when trying to set create date for scoring note")
	}
}

func TestEmptyName(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId: userId,
	}

	_, err := questions.CreateScoringNote(env, scoringNote)

	fmt.Printf("Error: %+v\n", err)

	if err == nil {
		t.Error("Expected error when sending empty name scoring note")
	}
}

func TestEmptyDescription(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId: userId,
		Name:   "test name",
	}

	_, err := questions.CreateScoringNote(env, scoringNote)

	fmt.Printf("Error: %+v\n", err)

	if err == nil {
		t.Error("Expected error when sending empty name scoring note")
	}
}

func TestUpdateLastUsed(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId:      userId,
		Name:        "test name",
		Description: "test description",
	}

	note, err := questions.CreateScoringNote(env, scoringNote)
	if err != nil {
		t.Fatal(err)
	}

	// The note rides on the category now (ticket #179): creating a question
	// in a category that carries a note bumps the note's last_used.
	category, err := questions.CreateCategory(env, models.Category{
		UserId:      userId,
		Name:        "test category",
		ScoringNote: note.ID,
	})
	if err != nil {
		t.Fatal(err)
	}

	question := models.Question{
		Category: category.ID,
		Question: "test question",
		Answer:   "answer111",
		UserId:   userId,
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	noteAfter, err := questions.GetOneScoringNote(env, userId, note.ID)
	if err != nil {
		t.Error(err)
	}

	if noteAfter.LastUsed.Equal(note.LastUsed) {
		t.Error("Expected 'Last used' field to be updated after creating a question in the category")
	}

	_, err = questions.DeleteOneQuestion(env, userId, question.ID)
	if err != nil {
		t.Error(err)
	}
	_, err = questions.DeleteCategory(env, userId, category.ID)
	if err != nil {
		t.Error(err)
	}
}

func TestUpdateLastUsedOnUpdate(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId:      userId,
		Name:        "test name",
		Description: "test description",
	}

	note, err := questions.CreateScoringNote(env, scoringNote)
	if err != nil {
		t.Fatal(err)
	}

	category, err := questions.CreateCategory(env, models.Category{
		UserId:      userId,
		Name:        "test category",
		ScoringNote: note.ID,
	})
	if err != nil {
		t.Fatal(err)
	}

	question := models.Question{
		Category: category.ID,
		Question: "test question",
		Answer:   "answer111",
		UserId:   userId,
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	// distinct timestamps so the bump from the update below is observable
	time.Sleep(time.Millisecond)
	noteAfterCreate, err := questions.GetOneScoringNote(env, userId, note.ID)
	if err != nil {
		t.Error(err)
	}

	questionUpdate := models.Question{
		Question: "updated question",
	}

	_, err = questions.UpdateOneQuestion(env, userId, question.ID, questionUpdate)
	if err != nil {
		t.Error(err)
	}

	noteAfter, err := questions.GetOneScoringNote(env, userId, note.ID)
	if err != nil {
		t.Error(err)
	}

	if noteAfter.LastUsed.Equal(noteAfterCreate.LastUsed) {
		t.Error("Expected 'Last used' field to be updated after updating a question in the category")
	}

	_, err = questions.DeleteOneQuestion(env, userId, question.ID)
	if err != nil {
		t.Error(err)
	}
	_, err = questions.DeleteCategory(env, userId, category.ID)
	if err != nil {
		t.Error(err)
	}
}

func TestClearScoringNoteOnDelete(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	scoringNote := models.ScoringNote{
		UserId:      userId,
		Name:        "test name",
		Description: "test description",
	}

	note, err := questions.CreateScoringNote(env, scoringNote)
	if err != nil {
		t.Fatal(err)
	}

	category, err := questions.CreateCategory(env, models.Category{
		UserId:      userId,
		Name:        "test category",
		ScoringNote: note.ID,
	})
	if err != nil {
		t.Fatal(err)
	}

	question := models.Question{
		Category: category.ID,
		Question: "test question",
		Answer:   "answer111",
		UserId:   userId,
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	_, err = questions.DeleteScoringNote(env, userId, note.ID)
	if err != nil {
		t.Error(err)
	}

	category, err = questions.GetOneCategory(env, userId, category.ID)
	if err != nil {
		t.Fatal(err)
	}

	if category.ScoringNote != "" {
		t.Error("Expected scoring note field to be cleared out on category after deleting scoring note")
	}

	_, err = questions.DeleteOneQuestion(env, userId, question.ID)
	if err != nil {
		t.Error(err)
	}
	_, err = questions.DeleteCategory(env, userId, category.ID)
	if err != nil {
		t.Error(err)
	}
}

func TestCreateCategoryWithUnknownScoringNoteFails(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	// category.scoring_note_id is a real FK (ticket #85 pattern): referencing
	// a note that does not exist must fail on create.
	category := models.Category{
		UserId:      userId,
		Name:        "test category",
		ScoringNote: "missing-note-id",
	}

	if _, err := questions.CreateCategory(env, category); err == nil {
		t.Error("Expected error when creating a category with an unknown scoring note ID")
	}
}

func TestCreateQuestionWithUnknownCategoryFails(t *testing.T) {
	conn := GetDb()
	env := &questions.Env{Db: conn}

	userId := "test"

	// question.category_id is a real FK (ticket #178): referencing a category
	// that does not exist must fail on create.
	question := models.Question{
		Category: "missing-category-id",
		Question: "test question",
		Answer:   "answer111",
		UserId:   userId,
	}

	if _, err := questions.CreateOneQuestion(env, userId, question); err == nil {
		t.Error("Expected error when creating a question with an unknown category ID")
	}
}

func deleteAllNotes(e *questions.Env, userId string) error {
	notes, err := questions.GetAllScoringNotes(e, userId)
	if err != nil {
		return err
	}

	for _, note := range notes {
		_, err = questions.DeleteScoringNote(e, userId, note.ID)
		if err != nil {
			return err
		}
	}

	return nil
}
