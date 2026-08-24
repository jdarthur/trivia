package players

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/store"
)

func openPlayersTestDB(t *testing.T) *Env {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(db); err != nil {
		t.Fatal(err)
	}
	return &Env{Db: db}
}

func createPlayerRow(t *testing.T, env *Env, teamName string) models.PlayerId {
	t.Helper()
	id, _, err := common.Create((*common.Env)(env), common.PlayerTable, &models.Player{TeamName: teamName})
	if err != nil {
		t.Fatal(err)
	}
	return models.PlayerId(id)
}

// newSessionWithPlayers builds a started session with a mod and one member.
func newSessionWithPlayers(t *testing.T, env *Env) (sessionId string, mod models.PlayerId, member models.PlayerId) {
	t.Helper()
	mod = createPlayerRow(t, env, "mod")
	member = createPlayerRow(t, env, "member")

	sessionId, _, err := common.Create((*common.Env)(env), common.SessionTable,
		&models.Session{Name: "S", Moderator: mod, Started: true})
	if err != nil {
		t.Fatal(err)
	}
	if err := common.IncrementState((*common.Env)(env), sessionId); err != nil {
		t.Fatal(err)
	}
	if err := common.Push((*common.Env)(env), common.SessionTable, sessionId, models.Players, member); err != nil {
		t.Fatal(err)
	}
	return sessionId, mod, member
}

func membershipActive(t *testing.T, env *Env, sessionId string, player models.PlayerId) int {
	t.Helper()
	var active int
	if err := env.Db.QueryRow(`SELECT active FROM session_player
		WHERE session_id = ? AND player_id = ?`, sessionId, string(player)).Scan(&active); err != nil {
		t.Fatal(err)
	}
	return active
}

// TestLeaveSessionDeactivatesAndBumpsState verifies a player can self-leave:
// active flips to 0 (row kept) and the state token is bumped.
func TestLeaveSessionDeactivatesAndBumpsState(t *testing.T) {
	env := openPlayersTestDB(t)
	sessionId, _, member := newSessionWithPlayers(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: sessionId}}
	body, err := json.Marshal(map[string]string{"player_id": string(member)})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/gameplay/session/"+sessionId+"/leave", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	env.LeaveSession(c)

	if c.IsAborted() || recorder.Code != http.StatusOK {
		t.Fatalf("LeaveSession failed with %d: %s", recorder.Code, recorder.Body.String())
	}
	if got := membershipActive(t, env, sessionId, member); got != 0 {
		t.Fatalf("member active = %d after leave, want 0", got)
	}
	stateAfter, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Fatal("state token did not change on leave")
	}
}

// TestInactivatePlayerModOnlyBumpsState verifies the mod can boot a member
// (active=0, row kept) and that a non-mod cannot.
func TestInactivatePlayerModOnlyBumpsState(t *testing.T) {
	env := openPlayersTestDB(t)
	sessionId, mod, member := newSessionWithPlayers(t, env)

	// a non-mod admin_id is rejected and changes nothing
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: sessionId}}
	body, err := json.Marshal(map[string]string{"player_id": string(member), "admin_id": string(member)})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/gameplay/session/"+sessionId+"/inactivate", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	env.InactivatePlayer(c)
	if got := membershipActive(t, env, sessionId, member); got != 1 {
		t.Fatalf("member active = %d after unauthorized boot, want 1", got)
	}

	// the mod's boot succeeds, keeps the row, and bumps the state token
	stateBefore, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}
	recorder = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(recorder)
	c.Params = gin.Params{{Key: "id", Value: sessionId}}
	body, err = json.Marshal(map[string]string{"player_id": string(member), "admin_id": string(mod)})
	if err != nil {
		t.Fatal(err)
	}
	c.Request = httptest.NewRequest(http.MethodPost, "/gameplay/session/"+sessionId+"/inactivate", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	env.InactivatePlayer(c)
	if c.IsAborted() || recorder.Code != http.StatusOK {
		t.Fatalf("InactivatePlayer failed with %d: %s", recorder.Code, recorder.Body.String())
	}
	if got := membershipActive(t, env, sessionId, member); got != 0 {
		t.Fatalf("member active = %d after boot, want 0", got)
	}
	stateAfter, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Fatal("state token did not change on inactivate")
	}
}
