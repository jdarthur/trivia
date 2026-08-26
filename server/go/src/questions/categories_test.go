package questions

import (
	"testing"
	"time"

	"github.com/jdarthur/trivia/models"
)

// Category CRUD + validation tests (ticket #179): Category is a root model
// with an optional associated scoring note, and question.category_id
// references it with ON DELETE SET NULL.

func TestCategoryCrud(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	created, err := CreateCategory(env, models.Category{UserId: userId, Name: "History"})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.CreateDate.IsZero() {
		t.Fatalf("category missing id/date: %+v", created)
	}

	got, err := GetOneCategory(env, userId, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "History" {
		t.Fatalf("category name = %q, want History", got.Name)
	}

	// another user cannot read it
	if _, err := GetOneCategory(env, "user-2", created.ID); err == nil {
		t.Error("expected ownership error reading another user's category")
	}

	// update the name
	updated, err := UpdateCategory(env, userId, created.ID, models.Category{Name: "Science"})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "Science" {
		t.Errorf("updated name = %q, want Science", updated.Name)
	}

	// delete
	if _, err := DeleteCategory(env, userId, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := GetOneCategory(env, userId, created.ID); err == nil {
		t.Error("expected error after delete")
	}
}

func TestCategoryValidation(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	// name required
	if _, err := CreateCategory(env, models.Category{UserId: userId}); err == nil {
		t.Error("expected error for empty category name")
	}

	// create_date cannot be set by the caller
	if _, err := CreateCategory(env, models.Category{UserId: userId, Name: "x", CreateDate: time.Now()}); err == nil {
		t.Error("expected error when setting create date on a category")
	}

	// unknown scoring note fails
	if _, err := CreateCategory(env, models.Category{UserId: userId, Name: "x", ScoringNote: "missing"}); err == nil {
		t.Error("expected error for unknown scoring note")
	}

	// another user's scoring note fails
	note, err := CreateScoringNote(env, models.ScoringNote{UserId: userId, Name: "n", Description: "d"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := CreateCategory(env, models.Category{UserId: "user-2", Name: "x", ScoringNote: note.ID}); err == nil {
		t.Error("expected ownership error using another user's scoring note")
	}
}

func TestUpdateCategoryClearsScoringNote(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	note, err := CreateScoringNote(env, models.ScoringNote{UserId: userId, Name: "n", Description: "d"})
	if err != nil {
		t.Fatal(err)
	}
	category, err := CreateCategory(env, models.Category{UserId: userId, Name: "History", ScoringNote: note.ID})
	if err != nil {
		t.Fatal(err)
	}

	// empty scoring_note on update clears the note; empty name leaves the
	// name alone (a category always has one)
	updated, err := UpdateCategory(env, userId, category.ID, models.Category{})
	if err != nil {
		t.Fatal(err)
	}
	if updated.ScoringNote != "" {
		t.Errorf("scoring note = %q after update, want cleared", updated.ScoringNote)
	}
	if updated.Name != "History" {
		t.Errorf("name = %q after update, want unchanged History", updated.Name)
	}
}

func TestGetAllCategoriesSorted(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	for _, name := range []string{"Zeta", "Alpha", "Mike"} {
		if _, err := CreateCategory(env, models.Category{UserId: userId, Name: name}); err != nil {
			t.Fatal(err)
		}
	}
	// another user's categories don't leak
	if _, err := CreateCategory(env, models.Category{UserId: "user-2", Name: "Other"}); err != nil {
		t.Fatal(err)
	}

	cats, err := GetAllCategories(env, userId)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"Alpha", "Mike", "Zeta"}
	if len(cats) != len(want) {
		t.Fatalf("categories = %d, want %d", len(cats), len(want))
	}
	for i, name := range want {
		if cats[i].Name != name {
			t.Errorf("categories[%d] = %q, want %q", i, cats[i].Name, name)
		}
	}
}

func TestDeleteCategoryNullsQuestionReferences(t *testing.T) {
	env := openQuestionsTestDB(t)
	userId := "user-1"

	category, err := CreateCategory(env, models.Category{UserId: userId, Name: "History"})
	if err != nil {
		t.Fatal(err)
	}
	question, err := CreateOneQuestion(env, userId, models.Question{
		Category: category.ID, Question: "q?", Answer: "a", UserId: userId,
	})
	if err != nil {
		t.Fatal(err)
	}

	// question.category_id references category(id) ON DELETE SET NULL
	// (migration 13), so deleting the category clears the question's
	// reference without an app-side scan.
	if _, err := DeleteCategory(env, userId, category.ID); err != nil {
		t.Fatal(err)
	}

	got, err := GetOneQuestion(env, userId, question.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Category != "" {
		t.Errorf("question category = %q after category delete, want cleared", got.Category)
	}
}
