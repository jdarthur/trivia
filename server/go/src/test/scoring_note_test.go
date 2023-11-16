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

	noteId := models.IdAsString(note.ID)

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

		_, err = questions.DeleteScoringNote(env, userId, models.IdAsString(note.ID))
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

	question := models.Question{
		Category:    "test category",
		Question:    "test question",
		Answer:      "answer111",
		UserId:      userId,
		ScoringNote: models.IdAsString(note.ID),
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	noteAfter, err := questions.GetOneScoringNote(env, userId, models.IdAsString(note.ID))
	if err != nil {
		t.Error(err)
	}

	if noteAfter.LastUsed.Equal(note.LastUsed) {
		t.Error("Expected 'Last used' field to be updated after setting on question")
	}

	_, err = questions.DeleteOneQuestion(env, userId, models.IdAsString(question.ID))
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

	question := models.Question{
		Category: "test category",
		Question: "test question",
		Answer:   "answer111",
		UserId:   userId,
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	questionUpdate := models.Question{
		ScoringNote: models.IdAsString(note.ID),
	}

	_, err = questions.UpdateOneQuestion(env, userId, models.IdAsString(question.ID), questionUpdate)
	if err != nil {
		t.Error(err)
	}

	noteAfter, err := questions.GetOneScoringNote(env, userId, models.IdAsString(note.ID))
	if err != nil {
		t.Error(err)
	}

	if noteAfter.LastUsed.Equal(note.LastUsed) {
		t.Error("Expected 'Last used' field to be updated after setting on question")
	}

	_, err = questions.DeleteOneQuestion(env, userId, models.IdAsString(question.ID))
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

	question := models.Question{
		Category:    "test category",
		Question:    "test question",
		Answer:      "answer111",
		UserId:      userId,
		ScoringNote: models.IdAsString(note.ID),
	}

	question, err = questions.CreateOneQuestion(env, userId, question)
	if err != nil {
		t.Fatal(err)
	}

	_, err = questions.DeleteScoringNote(env, userId, models.IdAsString(note.ID))
	if err != nil {
		t.Error(err)
	}

	question, err = questions.GetOneQuestion(env, userId, models.IdAsString(question.ID))
	if err != nil {
		t.Fatal(err)
	}

	if question.ScoringNote != "" {
		t.Error("Expected scoring note field to be cleared out on question after deleting scoring note")
	}

	_, err = questions.DeleteOneQuestion(env, userId, models.IdAsString(question.ID))
	if err != nil {
		t.Error(err)
	}
}

func deleteAllNotes(e *questions.Env, userId string) error {
	notes, err := questions.GetAllScoringNotes(e, userId)
	if err != nil {
		return err
	}

	for _, note := range notes {
		_, err = questions.DeleteScoringNote(e, userId, models.IdAsString(note.ID))
		if err != nil {
			return err
		}
	}

	return nil
}
