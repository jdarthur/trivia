package test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/collections"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/games"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/questions"
	"github.com/jdarthur/trivia/rounds"
)

// HTTP-level tests for the list endpoints (ticket #195/#196): the shared query
// params are honored end-to-end and the response carries the page metadata
// alongside the domain key it has always used.

func init() { gin.SetMode(gin.TestMode) }

// listResponse is the envelope a list endpoint returns. The item structs carry
// only the fields these tests assert on: create_date is the API's historical
// UTC-naive wire format, which time.Time cannot unmarshal (see
// TestTimestampWireFormat), so it is deliberately not decoded here.
type listResponse struct {
	Questions  []listQuestion `json:"questions"`
	Rounds     []listRound    `json:"rounds"`
	Categories []listCategory `json:"categories"`
	Games      []listNamed    `json:"games"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

type listNamed struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listQuestion struct {
	ID       string `json:"id"`
	Question string `json:"question"`
	UserId   string `json:"user_id"`
}

type listRound struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type listCategory struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	QuestionsUsed int    `json:"questions_used"`
}

func getList(t *testing.T, router *gin.Engine, target string) (int, listResponse) {
	t.Helper()
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, target, nil)
	router.ServeHTTP(recorder, req)
	var body listResponse
	if recorder.Body.Len() > 0 {
		if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
			t.Fatalf("decode %s: %v (body: %s)", target, err, recorder.Body.String())
		}
	}
	return recorder.Code, body
}

func TestQuestionsEndpointEnvelope(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	router := gin.New()
	router.GET("/editor/questions", func(c *gin.Context) {
		c.Set(common.USER_ID, "user-1")
		(&questions.Env{Db: db}).GetAllQuestions(c)
	})

	for i := 0; i < 5; i++ {
		if _, err := questions.CreateOneQuestion(&questions.Env{Db: db}, "user-1",
			models.Question{Question: fmt.Sprintf("q%d", i), Answer: "a"}); err != nil {
			t.Fatal(err)
		}
	}
	// one question used by a round, so unused_only differs from the full list
	used, err := questions.CreateOneQuestion(&questions.Env{Db: db}, "user-1",
		models.Question{Question: "used one", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	round := models.Round{Name: "R", UserId: "user-1", Questions: []string{used.ID}, Wagers: []int{100}}
	if _, _, err := common.Create(env, common.RoundTable, &round); err != nil {
		t.Fatal(err)
	}

	status, body := getList(t, router, "/editor/questions?page=0&page_size=2")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if len(body.Questions) != 2 {
		t.Fatalf("page_size not honored: %d records", len(body.Questions))
	}
	if body.Total != 6 || body.TotalPages != 3 || body.PageSize != 2 || body.Page != 0 {
		t.Fatalf("metadata = %+v, want total 6 / pages 3 / size 2 / page 0", body)
	}

	// unused_only is applied before paging
	status, body = getList(t, router, "/editor/questions?unused_only=true&page=0&page_size=2")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if body.Total != 5 {
		t.Fatalf("unused total = %d, want 5", body.Total)
	}
	if len(body.Questions) != 2 {
		t.Fatalf("unused page = %d records, want 2", len(body.Questions))
	}

	// unpaginated: the whole list, page_size 0
	status, body = getList(t, router, "/editor/questions")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if len(body.Questions) != 6 || body.PageSize != 0 || body.TotalPages != 1 {
		t.Fatalf("unpaginated response = %+v", body)
	}

	// a bad param is a 400 naming the field, not a silent no-op
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/editor/questions?page_size=0", nil))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("page_size=0 status = %d, want 400 (body %s)", recorder.Code, recorder.Body.String())
	}
}

func TestRoundsCategoriesGamesEndpointsEnvelope(t *testing.T) {
	db := GetDb()
	env := &common.Env{Db: db}
	router := gin.New()
	router.GET("/editor/rounds", func(c *gin.Context) {
		c.Set(common.USER_ID, "user-1")
		(&rounds.Env{Db: db}).GetAllRounds(c)
	})
	router.GET("/editor/categories", func(c *gin.Context) {
		c.Set(common.USER_ID, "user-1")
		(&questions.Env{Db: db}).GetAllCategories(c)
	})
	router.GET("/editor/games", func(c *gin.Context) {
		c.Set(common.USER_ID, "user-1")
		(&games.Env{Db: db}).GetAllGames(c)
	})
	router.GET("/editor/collections", func(c *gin.Context) {
		c.Set(common.USER_ID, "user-1")
		(&collections.Env{Db: db}).GetAllCollections(c)
	})

	// a round in a game, so rounds' unused_only has something to exclude
	round := models.Round{Name: "Round A", UserId: "user-1", Questions: []string{}, Wagers: []int{}}
	roundId, _, err := common.Create(env, common.RoundTable, &round)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := common.Create(env, common.RoundTable, &models.Round{
		Name: "Round B", UserId: "user-1", Questions: []string{}, Wagers: []int{},
	}); err != nil {
		t.Fatal(err)
	}
	game := models.Game{Name: "Game 1", UserId: "user-1", Rounds: []string{roundId},
		RoundNames: map[string]string{roundId: "Round A"}}
	if _, _, err := common.Create(env, common.GameTable, &game); err != nil {
		t.Fatal(err)
	}
	cat := models.Category{UserId: "user-1", Name: "Category 1"}
	catId, _, err := common.Create(env, common.CategoryTable, &cat)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := common.Create(env, common.CollectionTable, &models.Collection{
		Name: "Collection 1", UserId: "user-1", Questions: []string{},
	}); err != nil {
		t.Fatal(err)
	}

	// rounds: unused_only + paging metadata
	_, body := getList(t, router, "/editor/rounds?unused_only=true&page=0&page_size=1")
	if body.Total != 1 || body.TotalPages != 1 || len(body.Rounds) != 1 {
		t.Fatalf("rounds unused_only = %+v, want 1 unused round", body)
	}
	if body.Rounds[0].Name != "Round B" {
		t.Fatalf("unused round = %q, want Round B", body.Rounds[0].Name)
	}

	// rounds: text_filter on name
	_, body = getList(t, router, "/editor/rounds?text_filter=round+a")
	if body.Total != 1 || len(body.Rounds) != 1 {
		t.Fatalf("rounds text_filter = %+v, want only Round A", body)
	}

	// categories: envelope + the derived usage count on the wire (ticket #196
	// shows/filters unused categories, which needs this to be visible).
	if _, err := questions.CreateOneQuestion(&questions.Env{Db: db}, "user-1",
		models.Question{Question: "in category 1", Answer: "a", Category: catId}); err != nil {
		t.Fatal(err)
	}
	_, body = getList(t, router, "/editor/categories?page=0&page_size=10")
	if body.Total != 1 || len(body.Categories) != 1 {
		t.Fatalf("categories = %+v, want 1 category", body)
	}
	if body.Categories[0].QuestionsUsed != 1 {
		t.Fatalf("questions_used = %d, want 1", body.Categories[0].QuestionsUsed)
	}

	// games and collections keep working and report totals
	_, body = getList(t, router, "/editor/games?page=0&page_size=1")
	if body.Total != 1 || len(body.Games) != 1 {
		t.Fatalf("games = %+v, want 1 game", body)
	}
	_, body = getList(t, router, "/editor/collections")
	if body.Total != 1 {
		t.Fatalf("collections total = %d, want 1", body.Total)
	}
}
