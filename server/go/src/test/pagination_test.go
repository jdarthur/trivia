package test

import (
	"fmt"
	"testing"

	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/questions"
)

// Integration tests for the reusable filtering/pagination layer (ticket #195)
// against the real schema: page slicing, totals under filters, sort/order, and
// the unused_only filter for questions, rounds and categories — including the
// requirement that common's SQL definition of "unused" agrees with
// models.InUse.

// seedQuestions creates n questions owned by userId and returns their IDs in
// creation order (which is also the default create_date order).
func seedQuestions(t *testing.T, env *questions.Env, userId string, n int) []string {
	t.Helper()
	ids := make([]string, 0, n)
	for i := 0; i < n; i++ {
		q, err := questions.CreateOneQuestion(env, userId, models.Question{
			Question: fmt.Sprintf("question-%02d", i),
			Answer:   "answer",
		})
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, q.ID)
	}
	return ids
}

func questionIds(items interface{}) []string {
	ids := make([]string, 0)
	for _, q := range items.([]*models.Question) {
		ids = append(ids, q.ID)
	}
	return ids
}

func TestPaginationSlicesAndTotals(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"
	ids := seedQuestions(t, qenv, userId, 7)

	// page 0 of 3: the first three, oldest first.
	result, err := common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Page: 0, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 7 || result.TotalPages != 3 || result.Page != 0 || result.PageSize != 3 {
		t.Fatalf("page 0 metadata = %+v, want total 7 / pages 3", result)
	}
	if got := questionIds(result.Items); len(got) != 3 || got[0] != ids[0] || got[2] != ids[2] {
		t.Fatalf("page 0 = %v, want the first three %v", got, ids[:3])
	}

	// the middle page
	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Page: 1, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if got := questionIds(result.Items); len(got) != 3 || got[0] != ids[3] {
		t.Fatalf("page 1 = %v, want %v", got, ids[3:6])
	}

	// the last page is short, not empty
	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Page: 2, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if got := questionIds(result.Items); len(got) != 1 || got[0] != ids[6] {
		t.Fatalf("last page = %v, want %v", got, ids[6:])
	}

	// a page past the end is empty but still reports the true total
	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Page: 9, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if got := questionIds(result.Items); len(got) != 0 {
		t.Fatalf("page past the end = %v, want none", got)
	}
	if result.Total != 7 || result.TotalPages != 3 {
		t.Fatalf("metadata past the end = %+v, want total 7 / pages 3", result)
	}

	// no page params: the whole list, PageSize 0 (unpaginated)
	result, err = common.GetAllPaged(env, common.QuestionTable, common.ListQuery{UserId: userId})
	if err != nil {
		t.Fatal(err)
	}
	if got := questionIds(result.Items); len(got) != 7 {
		t.Fatalf("unpaginated list = %d records, want 7", len(got))
	}
	if result.PageSize != 0 || result.TotalPages != 1 || result.Total != 7 {
		t.Fatalf("unpaginated metadata = %+v", result)
	}

	// pages cover the set exactly once, in order
	seen := make([]string, 0, 7)
	for page := 0; page < 3; page++ {
		result, err := common.GetAllPaged(env, common.QuestionTable,
			common.ListQuery{UserId: userId, Page: page, PageSize: 3})
		if err != nil {
			t.Fatal(err)
		}
		seen = append(seen, questionIds(result.Items)...)
	}
	if len(seen) != 7 {
		t.Fatalf("paging visited %d records, want 7", len(seen))
	}
	for i := range seen {
		if seen[i] != ids[i] {
			t.Fatalf("paged order %v, want creation order %v", seen, ids)
		}
	}
}

// The total must be the size of the *filtered* set, so pagination controls
// describe what the user actually filtered on.
func TestPaginationTotalRespectsFilters(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	// 4 questions matching "needle", 3 that don't
	for i := 0; i < 4; i++ {
		if _, err := questions.CreateOneQuestion(qenv, userId,
			models.Question{Question: "find the needle " + fmt.Sprint(i), Answer: "a"}); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 3; i++ {
		if _, err := questions.CreateOneQuestion(qenv, userId,
			models.Question{Question: "haystack " + fmt.Sprint(i), Answer: "a"}); err != nil {
			t.Fatal(err)
		}
	}

	result, err := common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, TextFilter: "NEEDLE", Page: 0, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 4 || result.TotalPages != 2 {
		t.Fatalf("filtered metadata = %+v, want total 4 / pages 2", result)
	}
	if got := questionIds(result.Items); len(got) != 3 {
		t.Fatalf("filtered page 0 = %d records, want 3", len(got))
	}

	// second filtered page holds the remainder
	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, TextFilter: "NEEDLE", Page: 1, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if got := questionIds(result.Items); len(got) != 1 {
		t.Fatalf("filtered page 1 = %d records, want 1", len(got))
	}
}

func TestPaginationSortAndOrder(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	for _, text := range []string{"delta", "alpha", "charlie", "bravo"} {
		if _, err := questions.CreateOneQuestion(qenv, userId,
			models.Question{Question: text, Answer: "a"}); err != nil {
			t.Fatal(err)
		}
	}

	result, err := common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Sort: "question", Order: "asc"})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"alpha", "bravo", "charlie", "delta"}
	got := make([]string, 0)
	for _, q := range result.Items.([]*models.Question) {
		got = append(got, q.Question)
	}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ascending sort = %v, want %v", got, want)
		}
	}

	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Sort: "question", Order: "desc", Page: 0, PageSize: 2})
	if err != nil {
		t.Fatal(err)
	}
	got = make([]string, 0)
	for _, q := range result.Items.([]*models.Question) {
		got = append(got, q.Question)
	}
	if len(got) != 2 || got[0] != "delta" || got[1] != "charlie" {
		t.Fatalf("descending page 0 = %v, want [delta charlie]", got)
	}
}

// Sorting questions by category orders them by the referenced category's name
// (there is no question.category column any more).
func TestSortQuestionsByCategory(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	catNames := []string{"Zebra", "Apple", "Mango"}
	for _, name := range catNames {
		category := models.Category{UserId: userId, Name: name}
		catId, _, err := common.Create(env, common.CategoryTable, &category)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := questions.CreateOneQuestion(qenv, userId, models.Question{
			Question: "q in " + name, Answer: "a", Category: catId,
		}); err != nil {
			t.Fatal(err)
		}
	}

	result, err := common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, Sort: "category", Order: "asc"})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"q in Apple", "q in Mango", "q in Zebra"}
	got := make([]string, 0)
	for _, q := range result.Items.([]*models.Question) {
		got = append(got, q.Question)
	}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("category sort = %v, want %v", got, want)
		}
	}
}

// unused_only for questions, paged: the filter is applied in SQL before
// LIMIT/OFFSET, so the total and the pages describe the unused subset.
func TestUnusedOnlyQuestionsPaged(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	all := seedQuestions(t, qenv, userId, 6)

	// put questions 0 and 1 into a round => used
	round := models.Round{Name: "R", UserId: userId, Questions: all[:2], Wagers: []int{100, 100}}
	if _, _, err := common.Create(env, common.RoundTable, &round); err != nil {
		t.Fatal(err)
	}

	unused := common.ListQuery{UserId: userId, UnusedOnly: true}
	result, err := common.GetAllPaged(env, common.QuestionTable, unused)
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 4 {
		t.Fatalf("unused total = %d, want 4", result.Total)
	}

	result, err = common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: userId, UnusedOnly: true, Page: 0, PageSize: 3})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 4 || result.TotalPages != 2 {
		t.Fatalf("unused paged metadata = %+v, want total 4 / pages 2", result)
	}
	got := questionIds(result.Items)
	if len(got) != 3 {
		t.Fatalf("unused page 0 = %d records, want 3", len(got))
	}
	for _, id := range got {
		if id == all[0] || id == all[1] {
			t.Fatalf("used question %s appeared in unused_only results", id)
		}
	}
}

func TestUnusedOnlyRoundsPaged(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	userId := "user-1"

	roundIds := make([]string, 0, 4)
	for i := 0; i < 4; i++ {
		round := models.Round{Name: fmt.Sprintf("R%d", i), UserId: userId, Questions: []string{}, Wagers: []int{}}
		id, _, err := common.Create(env, common.RoundTable, &round)
		if err != nil {
			t.Fatal(err)
		}
		roundIds = append(roundIds, id)
	}

	// put the first round in a game
	game := models.Game{Name: "G", UserId: userId, Rounds: roundIds[:1],
		RoundNames: map[string]string{roundIds[0]: "R0"}}
	if _, _, err := common.Create(env, common.GameTable, &game); err != nil {
		t.Fatal(err)
	}

	result, err := common.GetAllPaged(env, common.RoundTable,
		common.ListQuery{UserId: userId, UnusedOnly: true, Page: 0, PageSize: 2})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 3 || result.TotalPages != 2 {
		t.Fatalf("unused rounds metadata = %+v, want total 3 / pages 2", result)
	}
	for _, r := range result.Items.([]*models.Round) {
		if r.ID == roundIds[0] {
			t.Fatal("used round appeared in unused_only results")
		}
	}
}

// Categories are "unused" when no question references them (ticket #196 wants
// this on the categories page).
func TestUnusedOnlyCategories(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	catIds := make([]string, 0, 3)
	for _, name := range []string{"Used", "Empty", "AlsoEmpty"} {
		category := models.Category{UserId: userId, Name: name}
		id, _, err := common.Create(env, common.CategoryTable, &category)
		if err != nil {
			t.Fatal(err)
		}
		catIds = append(catIds, id)
	}

	// one question in the first category
	if _, err := questions.CreateOneQuestion(qenv, userId, models.Question{
		Question: "in a category", Answer: "a", Category: catIds[0],
	}); err != nil {
		t.Fatal(err)
	}

	// the list carries the derived usage count...
	all, err := common.GetAllOwned(env, common.CategoryTable, userId)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, c := range all.([]*models.Category) {
		counts[c.ID] = c.QuestionsUsed
	}
	if counts[catIds[0]] != 1 || counts[catIds[1]] != 0 || counts[catIds[2]] != 0 {
		t.Fatalf("questions_used = %v, want used category with 1 and the rest 0", counts)
	}

	// ...and unused_only returns exactly the empty ones
	result, err := common.GetAllPaged(env, common.CategoryTable,
		common.ListQuery{UserId: userId, UnusedOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 2 {
		t.Fatalf("unused categories total = %d, want 2", result.Total)
	}
	for _, c := range result.Items.([]*models.Category) {
		if c.ID == catIds[0] {
			t.Fatal("used category appeared in unused_only results")
		}
	}

	// paging over unused categories reports the filtered total
	result, err = common.GetAllPaged(env, common.CategoryTable,
		common.ListQuery{UserId: userId, UnusedOnly: true, Page: 0, PageSize: 1})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 2 || result.TotalPages != 2 {
		t.Fatalf("unused categories paged metadata = %+v, want total 2 / pages 2", result)
	}
	if got := result.Items.([]*models.Category); len(got) != 1 {
		t.Fatalf("unused categories page 0 = %d records, want 1", len(got))
	}
}

// Deleting the referencing record makes a record unused again — the filter reads
// live membership, not a cached flag.
func TestUnusedOnlyReflectsMembershipChanges(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	q, err := questions.CreateOneQuestion(qenv, userId, models.Question{Question: "solo", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	countUnused := func() int {
		result, err := common.GetAllPaged(env, common.QuestionTable,
			common.ListQuery{UserId: userId, UnusedOnly: true})
		if err != nil {
			t.Fatal(err)
		}
		return result.Total
	}
	if n := countUnused(); n != 1 {
		t.Fatalf("fresh question not reported unused: %d", n)
	}

	round := models.Round{Name: "R", UserId: userId, Questions: []string{q.ID}, Wagers: []int{100}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	if n := countUnused(); n != 0 {
		t.Fatalf("question in a round still reported unused: %d", n)
	}

	if err := common.Delete(env, common.RoundTable, roundId); err != nil {
		t.Fatal(err)
	}
	if n := countUnused(); n != 1 {
		t.Fatalf("question not unused again after round delete: %d", n)
	}
}

// The list layer must scope by owner, so one user's page/totals never include
// another user's records.
func TestPaginationScopesByOwner(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}

	if _, err := questions.CreateOneQuestion(qenv, "user-1", models.Question{Question: "mine", Answer: "a"}); err != nil {
		t.Fatal(err)
	}
	if _, err := questions.CreateOneQuestion(&questions.Env{Db: db}, "user-2", models.Question{Question: "theirs", Answer: "a"}); err != nil {
		t.Fatal(err)
	}

	result, err := common.GetAllPaged(env, common.QuestionTable,
		common.ListQuery{UserId: "user-1", Page: 0, PageSize: 10})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 {
		t.Fatalf("total for user-1 = %d, want 1", result.Total)
	}
	for _, q := range result.Items.([]*models.Question) {
		if q.UserId != "user-1" {
			t.Fatalf("another user's record leaked into the list: %+v", q)
		}
	}
}

// models.InUse and common's SQL unused_only clause must agree: filtering the
// full list in memory with the model method gives exactly what the paged query
// returns. (This is the guard against the two definitions drifting.)
func TestInUseInterfaceMatchesSqlFilter(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	qenv := &questions.Env{Db: db}
	userId := "user-1"

	ids := seedQuestions(t, qenv, userId, 5)
	round := models.Round{Name: "R", UserId: userId, Questions: ids[:2], Wagers: []int{100, 100}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "G", UserId: userId, Rounds: []string{roundId},
		RoundNames: map[string]string{roundId: "R"}}
	if _, _, err := common.Create(env, common.GameTable, &game); err != nil {
		t.Fatal(err)
	}

	// questions
	all, err := common.GetAllOwned(env, common.QuestionTable, userId)
	if err != nil {
		t.Fatal(err)
	}
	questionsAll := all.([]*models.Question)
	fromModel := models.FilterUnused(questionsAll)
	fromSql, err := common.GetAll(env, common.QuestionTable, common.ListQuery{UserId: userId, UnusedOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(fromModel) != len(fromSql.([]*models.Question)) {
		t.Fatalf("FilterUnused gave %d, SQL unused_only gave %d",
			len(fromModel), len(fromSql.([]*models.Question)))
	}
	for _, q := range fromModel {
		if q.IsRecordInUse() {
			t.Fatalf("FilterUnused returned an in-use question: %+v", q)
		}
	}
	if len(fromModel) != 3 {
		t.Fatalf("expected 3 unused questions, got %d", len(fromModel))
	}

	// rounds
	allRounds, err := common.GetAllOwned(env, common.RoundTable, userId)
	if err != nil {
		t.Fatal(err)
	}
	roundsAll := allRounds.([]*models.Round)
	if len(models.FilterUnused(roundsAll)) != 0 {
		t.Fatal("the only round is in a game, so nothing should be unused")
	}

	// categories
	cat := models.Category{UserId: userId, Name: "Referenced"}
	catId, _, err := common.Create(env, common.CategoryTable, &cat)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := common.Create(env, common.CategoryTable, &models.Category{UserId: userId, Name: "Orphan"}); err != nil {
		t.Fatal(err)
	}
	if _, err := questions.CreateOneQuestion(qenv, userId, models.Question{
		Question: "refs a category", Answer: "a", Category: catId,
	}); err != nil {
		t.Fatal(err)
	}
	allCats, err := common.GetAllOwned(env, common.CategoryTable, userId)
	if err != nil {
		t.Fatal(err)
	}
	catsAll := allCats.([]*models.Category)
	unusedCats := models.FilterUnused(catsAll)
	if len(unusedCats) != 1 || unusedCats[0].Name != "Orphan" {
		t.Fatalf("FilterUnused categories = %v, want just Orphan", unusedCats)
	}
	sqlCats, err := common.GetAll(env, common.CategoryTable, common.ListQuery{UserId: userId, UnusedOnly: true})
	if err != nil {
		t.Fatal(err)
	}
	if got := sqlCats.([]*models.Category); len(got) != 1 || got[0].Name != "Orphan" {
		t.Fatalf("SQL unused_only categories = %v, want just Orphan", got)
	}
}
