package common

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// Reusable list query params (ticket #195), shared by every editor list
// endpoint:
//
//	unused_only=true     only records nothing else references (see models.InUse)
//	text_filter=<text>   case-insensitive substring match
//	search_columns=a,b   columns text_filter applies to (default: the table's
//	                     own searchable columns, see defaultSearchColumns)
//	sort=<col>           column to sort by; prefix with "-" for descending
//	order=asc|desc       sort direction (an explicit -prefix wins over this)
//	page=<n>             zero-based page index
//	page_size=<n>        records per page (see MaxPageSize)
//
// Page and PageSize stay 0 when the request sends neither, which means
// "no LIMIT/OFFSET": an endpoint keeps returning its whole list unless a caller
// asks for a page, so existing callers are unaffected.
//
// The filters are applied in SQL, before LIMIT/OFFSET, so a page is a page of
// the *filtered* set and Total is the size of that set — the reason the
// unused_only filter lives in the query (common.unusedClause) rather than in
// post-processing.

// MaxPageSize caps page_size so a request can't ask for an unbounded page.
const MaxPageSize = 500

// unusedClause is the SQL form of models.InUse (ticket #195): a record is
// unused when nothing else references it. Membership lives in the join tables
// and FK columns, so each table gets its own NOT EXISTS. This is the query-side
// twin of models.InUse.IsRecordInUse — a test cross-checks the two definitions
// (test/pagination_test.go) so they can't drift apart.
func unusedClause(objectType string) (string, bool) {
	switch objectType {
	case QuestionTable:
		return "NOT EXISTS (SELECT 1 FROM round_question rq WHERE rq.question_id = question.id)", true
	case RoundTable:
		return "NOT EXISTS (SELECT 1 FROM game_round gr WHERE gr.round_id = round.id)", true
	case CategoryTable:
		return "NOT EXISTS (SELECT 1 FROM question q WHERE q.category_id = category.id)", true
	default:
		return "", false
	}
}

// listColumnExpr maps a text_filter column name to the SQL expression that
// searches it, per table. A column the table doesn't have is dropped rather
// than emitting SQL that references a nonexistent column (the rule ticket #186
// established for `category`).
//
// "category" is a special case: on question it searches the name of the
// referenced category row (the legacy question.category text column is gone,
// ticket #181); on category it is the row's own name.
func listColumnExpr(objectType, column string) (string, bool) {
	switch column {
	case "category":
		switch objectType {
		case QuestionTable:
			return "EXISTS (SELECT 1 FROM category WHERE category.id = question.category_id" +
				" AND REGEXP_LIKE(category.name, ?))", true
		case CategoryTable:
			return "REGEXP_LIKE(category.name, ?)", true
		}
	case "question":
		if objectType == QuestionTable {
			return "REGEXP_LIKE(question.question, ?)", true
		}
	case "answer":
		if objectType == QuestionTable {
			return "REGEXP_LIKE(question.answer, ?)", true
		}
	case "name":
		switch objectType {
		case CategoryTable, RoundTable, GameTable, CollectionTable:
			return "REGEXP_LIKE(" + objectType + ".name, ?)", true
		}
	}
	return "", false
}

// defaultSearchColumns are the columns a text_filter searches when the request
// doesn't name any: question/answer/category for questions, name elsewhere.
func defaultSearchColumns(objectType string) []string {
	switch objectType {
	case QuestionTable:
		return []string{"question", "answer", "category"}
	case CategoryTable, RoundTable, GameTable, CollectionTable:
		return []string{"name"}
	default:
		return nil
	}
}

// ListQuery is the parsed, validated form of the list query params.
type ListQuery struct {
	// UserId scopes the list to one owner. Handlers set it from the auth
	// context; empty means no owner filter (e.g. the anonymous session list).
	UserId string

	UnusedOnly    bool
	TextFilter    string
	SearchColumns []string

	Sort  string // column name, "" = the table's default sort
	Order string // "asc" | "desc"

	Page     int // zero-based
	PageSize int // 0 = no pagination
}

// HasPagination reports whether the request asked for a page.
func (q ListQuery) HasPagination() bool {
	return q.PageSize > 0
}

// InvalidQueryError reports an unusable query param. It implements
// InvalidDataError, so Respond maps it to a 400 with the offending field.
type InvalidQueryError struct {
	ErrorField string
	ErrorData  interface{}
	Message    string
}

func (e InvalidQueryError) Error() string     { return InvalidDataErrorToString(e, e.Message) }
func (e InvalidQueryError) Field() string     { return e.ErrorField }
func (e InvalidQueryError) Data() interface{} { return e.ErrorData }

// ParseListQuery reads the list query params off the request and validates them
// against the columns the given table supports. Unknown sort/search columns are
// rejected (rather than silently ignored) so a typo surfaces as a 400 instead of
// a confusingly unfiltered list.
func ParseListQuery(c *gin.Context, objectType string) (ListQuery, error) {
	q := ListQuery{}

	q.UnusedOnly = strings.EqualFold(c.Query("unused_only"), "true")
	if raw := c.Query("unused_only"); raw != "" && !q.UnusedOnly {
		if _, err := parseBool("unused_only", raw); err != nil {
			return q, err
		}
	}

	q.TextFilter = c.Query("text_filter")
	if raw := c.Query("search_columns"); raw != "" {
		for _, column := range strings.Split(raw, ",") {
			column = strings.TrimSpace(column)
			if column == "" {
				continue
			}
			if _, ok := listColumnExpr(objectType, column); !ok {
				return q, unsupportedColumnError("search_columns", objectType, column)
			}
			q.SearchColumns = append(q.SearchColumns, column)
		}
	}

	if raw := c.Query("sort"); raw != "" {
		column, descending := strings.CutPrefix(raw, "-")
		if _, ok := sortColumnExpr(objectType, column); !ok {
			return q, unsupportedColumnError("sort", objectType, column)
		}
		q.Sort = column
		if descending {
			q.Order = "desc"
		}
	}

	if raw := c.Query("order"); raw != "" {
		direction := strings.ToLower(raw)
		if direction != "asc" && direction != "desc" {
			return q, InvalidQueryError{
				ErrorField: "order",
				ErrorData:  raw,
				Message:    "order must be 'asc' or 'desc'",
			}
		}
		// An explicit "-" prefix on sort is the caller's last word.
		if q.Order != "desc" {
			q.Order = direction
		}
	}

	if raw := c.Query("page"); raw != "" {
		page, err := parseInt("page", raw)
		if err != nil {
			return q, err
		}
		if page < 0 {
			return q, InvalidQueryError{
				ErrorField: "page",
				ErrorData:  raw,
				Message:    "page must be zero or greater",
			}
		}
		q.Page = page
	}

	if raw := c.Query("page_size"); raw != "" {
		size, err := parseInt("page_size", raw)
		if err != nil {
			return q, err
		}
		if size < 1 {
			return q, InvalidQueryError{
				ErrorField: "page_size",
				ErrorData:  raw,
				Message:    "page_size must be at least 1",
			}
		}
		if size > MaxPageSize {
			size = MaxPageSize
		}
		q.PageSize = size
	}

	// page without page_size would otherwise silently mean "page 0 of an
	// unpaginated list"; treat it as a request for the default page.
	if q.Page > 0 && q.PageSize == 0 {
		q.PageSize = MaxPageSize
	}

	return q, nil
}

func parseInt(field, raw string) (int, error) {
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, InvalidQueryError{
			ErrorField: field,
			ErrorData:  raw,
			Message:    field + " must be an integer",
		}
	}
	return value, nil
}

func parseBool(field, raw string) (bool, error) {
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, InvalidQueryError{
			ErrorField: field,
			ErrorData:  raw,
			Message:    field + " must be a boolean",
		}
	}
	return value, nil
}

func unsupportedColumnError(field, objectType, column string) error {
	return InvalidQueryError{
		ErrorField: field,
		ErrorData:  column,
		Message:    fmt.Sprintf("%s is not a filterable/sortable column of %s", column, objectType),
	}
}

// sortColumnExpr maps a sort column to the SQL expression to order by, per
// table. "category" sorts questions by the name of the category row they
// reference; on category itself it is the row's own name.
func sortColumnExpr(objectType, column string) (string, bool) {
	switch column {
	case "create_date":
		return objectType + ".create_date", true
	case "category":
		switch objectType {
		case QuestionTable:
			return "(SELECT category.name FROM category WHERE category.id = question.category_id)", true
		case CategoryTable:
			return "category.name", true
		}
	case "question":
		if objectType == QuestionTable {
			return "question.question", true
		}
	case "answer":
		if objectType == QuestionTable {
			return "question.answer", true
		}
	case "name":
		switch objectType {
		case CategoryTable, RoundTable, GameTable, CollectionTable:
			return objectType + ".name", true
		}
	case "last_used":
		if objectType == ScoringNoteTable {
			return "scoring_note.last_used", true
		}
	}
	return "", false
}

// defaultOrderBy preserves each list's historical ordering for requests that
// don't pass sort: categories alphabetically, scoring notes most-recently-used
// first, everything else oldest-first.
func defaultOrderBy(objectType string) string {
	switch objectType {
	case CategoryTable:
		return "category.name"
	case ScoringNoteTable:
		return "scoring_note.last_used DESC, scoring_note.create_date DESC"
	case QuestionTable, RoundTable, GameTable, CollectionTable, SessionTable:
		return objectType + ".create_date"
	default:
		return ""
	}
}

// orderBy renders the ORDER BY clause for a query. The expressions reaching
// here come from sortColumnExpr / defaultOrderBy — never from request text —
// so the clause is safe to interpolate.
//
// The id column is always appended as a final tiebreaker: timestamps collide
// (create_date has microsecond precision, and records created in one loop often
// share it), and LIMIT/OFFSET over a partially ordered set can repeat or skip
// rows between pages.
func orderBy(objectType string, q ListQuery) string {
	expression := ""
	if q.Sort != "" {
		expression, _ = sortColumnExpr(objectType, q.Sort)
	} else {
		expression = defaultOrderBy(objectType)
	}
	if expression == "" {
		return ""
	}

	// A multi-column default (scoring notes) states its own directions and is
	// authoritative; otherwise the requested direction is appended.
	upper := strings.ToUpper(expression)
	if !strings.Contains(upper, " ASC") && !strings.Contains(upper, " DESC") {
		if strings.EqualFold(q.Order, "desc") {
			expression += " DESC"
		} else {
			expression += " ASC"
		}
	}

	return " ORDER BY " + expression + ", " + objectType + ".id ASC"
}

// buildListWhere renders a ListQuery's filters for objectType into a SQL WHERE
// clause plus its bound args.
func buildListWhere(objectType string, q ListQuery) (string, []interface{}) {
	clauses := make([]string, 0, 3)
	args := make([]interface{}, 0, 4)

	if q.UserId != "" {
		clauses = append(clauses, "user_id = ?")
		args = append(args, q.UserId)
	}

	if q.UnusedOnly {
		if clause, ok := unusedClause(objectType); ok {
			clauses = append(clauses, clause)
		}
	}

	if q.TextFilter != "" {
		columns := q.SearchColumns
		if len(columns) == 0 {
			columns = defaultSearchColumns(objectType)
		}
		subs := make([]string, 0, len(columns))
		// (?i) keeps text_filter case-insensitive, matching the bson "i" option
		// the mgo-era filters carried (regexp_like evaluates Go regexp).
		pattern := "(?i).*" + q.TextFilter + ".*"
		for _, column := range columns {
			expression, ok := listColumnExpr(objectType, column)
			if !ok {
				continue
			}
			subs = append(subs, expression)
			args = append(args, pattern)
		}
		if len(subs) > 0 {
			clauses = append(clauses, "("+strings.Join(subs, " OR ")+")")
		}
	}

	if len(clauses) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

// ListResult is one page of records plus the metadata a client needs to render
// pagination controls. PageSize is 0 when the result is the whole (unpaginated)
// list, in which case TotalPages is 1 if there is anything at all.
type ListResult struct {
	Items      interface{} `json:"items"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	PageSize   int         `json:"page_size"`
	TotalPages int         `json:"total_pages"`
}

// GetAllPaged returns the page of objectType matching q, along with the total
// number of records matching q's filters (ignoring page/page_size).
//
// Filters and pagination both happen in SQL, so Total is the size of the
// filtered set and a page is a slice of it — a client can page through a
// filtered list without the server ever loading the records it won't return.
func GetAllPaged(e *Env, objectType string, q ListQuery) (*ListResult, error) {
	if _, ok := scanTable(objectType); !ok {
		return nil, errors.New("invalid get all table: " + objectType)
	}

	where, args := buildListWhere(objectType, q)

	total, err := countMatching(e, objectType, where, args)
	if err != nil {
		return nil, err
	}

	limit, offset := 0, 0
	if q.HasPagination() {
		limit, offset = q.PageSize, q.Page*q.PageSize
	}

	items, err := fetchAll(e, objectType, where, args, limit, offset, orderBy(objectType, q))
	if err != nil {
		return nil, err
	}

	totalPages := 1
	if q.HasPagination() {
		totalPages = (total + q.PageSize - 1) / q.PageSize
	}

	return &ListResult{
		Items:      items,
		Total:      total,
		Page:       q.Page,
		PageSize:   q.PageSize,
		TotalPages: totalPages,
	}, nil
}

// countMatching counts the rows a where clause selects, for the envelope's
// total. It counts the base table only — the derived child rows a fetch loads
// (rounds_used, questions, ...) don't affect the row count.
func countMatching(e *Env, objectType, where string, args []interface{}) (int, error) {
	var total int
	query := `SELECT count(*) FROM ` + objectType + where
	if err := e.Db.QueryRow(query, args...).Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

// RespondList writes a ListResult to the response under the domain key the
// endpoint has always used ("questions", "rounds", ...) plus the pagination
// metadata alongside it:
//
//	{"questions": [...], "total": 137, "page": 0, "page_size": 50, "total_pages": 3}
func RespondList(c *gin.Context, key string, result *ListResult, err error) {
	if err != nil {
		Respond(c, nil, err)
		return
	}
	if result == nil {
		result = &ListResult{Items: []interface{}{}}
	}
	Respond(c, gin.H{
		key:           result.Items,
		"total":       result.Total,
		"page":        result.Page,
		"page_size":   result.PageSize,
		"total_pages": result.TotalPages,
	}, nil)
}
