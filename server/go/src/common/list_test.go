package common

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// Unit tests for the reusable list query params (ticket #195): parsing +
// validation of the query string, and the SQL each query renders to.

func init() {
	gin.SetMode(gin.TestMode)
}

// listRequest parses rawQuery as a GET request for ParseListQuery to read.
func listRequest(t *testing.T, rawQuery string) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/editor/questions?"+rawQuery, nil)
	return c
}

func TestParseListQueryDefaults(t *testing.T) {
	q, err := ParseListQuery(listRequest(t, ""), QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if q.UnusedOnly || q.TextFilter != "" || q.Sort != "" || q.Order != "" {
		t.Errorf("expected empty filters, got %+v", q)
	}
	// No page params means "no LIMIT/OFFSET": an endpoint returns its whole list.
	if q.Page != 0 || q.PageSize != 0 || q.HasPagination() {
		t.Errorf("expected unpaginated default, got %+v", q)
	}
}

func TestParseListQueryValues(t *testing.T) {
	q, err := ParseListQuery(listRequest(t,
		"unused_only=true&text_filter=hist&page=2&page_size=25&sort=-question&order=asc"),
		QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if !q.UnusedOnly {
		t.Error("unused_only=true not parsed")
	}
	if q.TextFilter != "hist" {
		t.Errorf("text_filter = %q, want hist", q.TextFilter)
	}
	if q.Page != 2 || q.PageSize != 25 || !q.HasPagination() {
		t.Errorf("page/page_size = %d/%d, want 2/25", q.Page, q.PageSize)
	}
	if q.Sort != "question" {
		t.Errorf("sort = %q, want question", q.Sort)
	}
	// The "-" prefix is a descending request, and wins over order=asc.
	if q.Order != "desc" {
		t.Errorf("order = %q, want desc", q.Order)
	}
}

func TestParseListQueryOrder(t *testing.T) {
	cases := []struct {
		query string
		sort  string
		order string
	}{
		{"sort=name", "name", ""},
		{"sort=name&order=desc", "name", "desc"},
		{"sort=name&order=asc", "name", "asc"},
		{"sort=-name&order=asc", "name", "desc"},
		{"order=desc", "", "desc"},
	}
	for _, tc := range cases {
		q, err := ParseListQuery(listRequest(t, tc.query), RoundTable)
		if err != nil {
			t.Fatalf("%s: %v", tc.query, err)
		}
		if q.Sort != tc.sort || q.Order != tc.order {
			t.Errorf("%s => sort=%q order=%q, want sort=%q order=%q",
				tc.query, q.Sort, q.Order, tc.sort, tc.order)
		}
	}
}

func TestParseListQueryUnusedOnlyVariants(t *testing.T) {
	for _, raw := range []string{"unused_only=TRUE", "unused_only=true", "unused_only=True"} {
		q, err := ParseListQuery(listRequest(t, raw), QuestionTable)
		if err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
		if !q.UnusedOnly {
			t.Errorf("%s not treated as true", raw)
		}
	}
	for _, raw := range []string{"", "unused_only=false", "unused_only=0"} {
		q, err := ParseListQuery(listRequest(t, raw), QuestionTable)
		if err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
		if q.UnusedOnly {
			t.Errorf("%s treated as true", raw)
		}
	}
}

func TestParseListQueryPageDefaults(t *testing.T) {
	// page without page_size still means "give me a page", so it gets the cap
	// rather than silently returning everything.
	q, err := ParseListQuery(listRequest(t, "page=1"), QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if q.Page != 1 || q.PageSize != MaxPageSize {
		t.Errorf("page=1 => %+v, want page 1 with default size %d", q, MaxPageSize)
	}
}

func TestParseListQueryPageSizeCap(t *testing.T) {
	q, err := ParseListQuery(listRequest(t, "page_size=100000"), QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if q.PageSize != MaxPageSize {
		t.Errorf("page_size = %d, want capped at %d", q.PageSize, MaxPageSize)
	}
}

func TestParseListQueryErrors(t *testing.T) {
	cases := []struct {
		query string
		field string
	}{
		{"page=abc", "page"},
		{"page=-1", "page"},
		{"page_size=0", "page_size"},
		{"page_size=-5", "page_size"},
		{"page_size=notanumber", "page_size"},
		{"order=sideways", "order"},
		{"unused_only=maybe", "unused_only"},
		// A column the table doesn't have is rejected rather than silently
		// ignored, so a typo surfaces as a 400.
		{"sort=nope", "sort"},
		{"search_columns=nope", "search_columns"},
	}
	for _, tc := range cases {
		_, err := ParseListQuery(listRequest(t, tc.query), QuestionTable)
		if err == nil {
			t.Errorf("%s: expected error", tc.query)
			continue
		}
		var invalid InvalidDataError
		if !errors.As(err, &invalid) {
			t.Errorf("%s: expected InvalidDataError, got %T: %v", tc.query, err, err)
			continue
		}
		if invalid.Field() != tc.field {
			t.Errorf("%s: error field = %q, want %q", tc.query, invalid.Field(), tc.field)
		}
	}
}

func TestParseListQuerySearchColumns(t *testing.T) {
	q, err := ParseListQuery(listRequest(t, "search_columns=question,%20category"), QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if len(q.SearchColumns) != 2 || q.SearchColumns[0] != "question" || q.SearchColumns[1] != "category" {
		t.Errorf("search_columns = %v, want [question category]", q.SearchColumns)
	}

	// A category filter is meaningful on question and category, not on round.
	if _, err := ParseListQuery(listRequest(t, "search_columns=category"), RoundTable); err == nil {
		t.Error("expected category search column to be rejected on round")
	}
	if _, err := ParseListQuery(listRequest(t, "search_columns=category"), CategoryTable); err != nil {
		t.Errorf("category search column rejected on category: %v", err)
	}
}

func TestBuildListWhere(t *testing.T) {
	cases := []struct {
		name       string
		objectType string
		query      ListQuery
		want       string
		wantArgs   int
	}{
		{
			name:       "empty",
			objectType: QuestionTable,
			query:      ListQuery{},
			want:       "",
			wantArgs:   0,
		},
		{
			name:       "owner only",
			objectType: QuestionTable,
			query:      ListQuery{UserId: "u1"},
			want:       " WHERE user_id = ?",
			wantArgs:   1,
		},
		{
			name:       "unused questions",
			objectType: QuestionTable,
			query:      ListQuery{UnusedOnly: true},
			want:       " WHERE NOT EXISTS (SELECT 1 FROM round_question rq WHERE rq.question_id = question.id)",
			wantArgs:   0,
		},
		{
			name:       "unused rounds",
			objectType: RoundTable,
			query:      ListQuery{UnusedOnly: true},
			want:       " WHERE NOT EXISTS (SELECT 1 FROM game_round gr WHERE gr.round_id = round.id)",
			wantArgs:   0,
		},
		{
			name:       "unused categories",
			objectType: CategoryTable,
			query:      ListQuery{UnusedOnly: true},
			want:       " WHERE NOT EXISTS (SELECT 1 FROM question q WHERE q.category_id = category.id)",
			wantArgs:   0,
		},
		{
			name:       "text filter uses default columns",
			objectType: QuestionTable,
			query:      ListQuery{TextFilter: "abc"},
			want: " WHERE (REGEXP_LIKE(question.question, ?) OR REGEXP_LIKE(question.answer, ?)" +
				" OR EXISTS (SELECT 1 FROM category WHERE category.id = question.category_id" +
				" AND REGEXP_LIKE(category.name, ?)))",
			wantArgs: 3,
		},
		{
			name:       "text filter on one column",
			objectType: RoundTable,
			query:      ListQuery{TextFilter: "abc"},
			want:       " WHERE (REGEXP_LIKE(round.name, ?))",
			wantArgs:   1,
		},
		{
			name:       "owner and unused compose",
			objectType: CategoryTable,
			query:      ListQuery{UserId: "u1", UnusedOnly: true},
			want: " WHERE user_id = ? AND NOT EXISTS" +
				" (SELECT 1 FROM question q WHERE q.category_id = category.id)",
			wantArgs: 1,
		},
		{
			// unused_only has no meaning for games (nothing references a game),
			// so it contributes no clause instead of broken SQL.
			name:       "unused ignored where undefined",
			objectType: GameTable,
			query:      ListQuery{UnusedOnly: true},
			want:       "",
			wantArgs:   0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			where, args := buildListWhere(tc.objectType, tc.query)
			if where != tc.want {
				t.Errorf("where =\n  %q\nwant\n  %q", where, tc.want)
			}
			if len(args) != tc.wantArgs {
				t.Errorf("got %d args, want %d: %v", len(args), tc.wantArgs, args)
			}
		})
	}
}

func TestBuildListWhereTextFilterIsCaseInsensitive(t *testing.T) {
	_, args := buildListWhere(QuestionTable, ListQuery{TextFilter: "Hello"})
	if len(args) != 3 {
		t.Fatalf("got %d args, want 3", len(args))
	}
	// regexp_like evaluates Go regexp, so case folding has to come from the
	// pattern (the mgo-era filters got it from the bson "i" option).
	if pattern, _ := args[0].(string); !strings.HasPrefix(pattern, "(?i)") {
		t.Errorf("pattern = %q, want a case-insensitive (?i) prefix", pattern)
	}
}

func TestOrderBy(t *testing.T) {
	cases := []struct {
		name       string
		objectType string
		query      ListQuery
		want       string
	}{
		{"default questions", QuestionTable, ListQuery{}, " ORDER BY question.create_date ASC, question.id ASC"},
		{"default rounds", RoundTable, ListQuery{}, " ORDER BY round.create_date ASC, round.id ASC"},
		{"default categories", CategoryTable, ListQuery{}, " ORDER BY category.name ASC, category.id ASC"},
		{"default scoring notes", ScoringNoteTable, ListQuery{},
			" ORDER BY scoring_note.last_used DESC, scoring_note.create_date DESC, scoring_note.id ASC"},
		{"sort name asc", RoundTable, ListQuery{Sort: "name", Order: "asc"}, " ORDER BY round.name ASC, round.id ASC"},
		{"sort name desc", RoundTable, ListQuery{Sort: "name", Order: "desc"}, " ORDER BY round.name DESC, round.id ASC"},
		{"sort date desc", QuestionTable, ListQuery{Sort: "create_date", Order: "desc"},
			" ORDER BY question.create_date DESC, question.id ASC"},
		// Sorting questions by category means the referenced category's name, not
		// the (nonexistent) question.category column.
		{"sort category", QuestionTable, ListQuery{Sort: "category"},
			" ORDER BY (SELECT category.name FROM category WHERE category.id = question.category_id) ASC, question.id ASC"},
		{"sort category desc", QuestionTable, ListQuery{Sort: "category", Order: "desc"},
			" ORDER BY (SELECT category.name FROM category WHERE category.id = question.category_id) DESC, question.id ASC"},
		{"sort own name on category", CategoryTable, ListQuery{Sort: "name"}, " ORDER BY category.name ASC, category.id ASC"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := orderBy(tc.objectType, tc.query); got != tc.want {
				t.Errorf("orderBy =\n  %q\nwant\n  %q", got, tc.want)
			}
		})
	}
}

// The ORDER BY clause is built from a whitelist of expressions, never from
// request text — a hostile sort value must be rejected at parse time, not
// interpolated.
func TestOrderByRejectsInjection(t *testing.T) {
	// url.ParseQuery rejects ';' in a query, so the payload avoids it: the point
	// is that anything outside the whitelist never reaches the ORDER BY clause.
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet,
		"/editor/questions?sort=create_date+DESC,+id+FROM+question--", nil)
	if _, err := ParseListQuery(c, QuestionTable); err == nil {
		t.Fatal("expected an unsupported-column error for a hostile sort value")
	}

	// A legal sort value reaches the clause as the whitelisted expression, not
	// as the raw request text.
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	c2.Request = httptest.NewRequest(http.MethodGet, "/editor/questions?sort=-answer", nil)
	q, err := ParseListQuery(c2, QuestionTable)
	if err != nil {
		t.Fatal(err)
	}
	if got := orderBy(QuestionTable, q); got != " ORDER BY question.answer DESC, question.id ASC" {
		t.Errorf("orderBy = %q", got)
	}
}
