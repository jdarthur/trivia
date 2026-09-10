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
	"github.com/jdarthur/trivia/sessions"
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

// createPlayerRowWithToken creates a player with its bearer credential and
// returns the id and the plaintext token (ticket #256).
func createPlayerRowWithToken(t *testing.T, env *Env, teamName string) (models.PlayerId, string) {
	t.Helper()
	id, _, token, err := common.CreatePlayerWithToken((*common.Env)(env), models.Player{TeamName: teamName})
	if err != nil {
		t.Fatal(err)
	}
	return models.PlayerId(id), token
}

// newSessionWithPlayers builds a started session with a mod and one member,
// returning their player ids and bearer tokens.
func newSessionWithPlayers(t *testing.T, env *Env) (sessionId string, mod models.PlayerId, modToken string, member models.PlayerId, memberToken string) {
	t.Helper()
	mod, modToken = createPlayerRowWithToken(t, env, "mod")
	member, memberToken = createPlayerRowWithToken(t, env, "member")

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
	return sessionId, mod, modToken, member, memberToken
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

// newPlayerRouter builds a router wiring the player read / update / leave /
// inactivate routes the way main.go does (WithPlayer → handler, or
// WithValidSession → WithPlayer → AsMod → handler).
func newPlayerRouter(env *Env, s *sessions.Env) *gin.Engine {
	t := gin.New()
	auth := common.Env{Db: env.Db}
	t.GET("/gameplay/player/:id", auth.WithPlayer, env.GetOnePlayer)
	t.PUT("/gameplay/player/:id", auth.WithPlayer, env.UpdatePlayer)
	t.POST("/gameplay/session/:id/leave", auth.WithPlayer, env.LeaveSession)
	t.POST("/gameplay/session/:id/inactivate", s.WithValidSession, auth.WithPlayer, s.AsMod, env.InactivatePlayer)
	return t
}

// post sends a POST with the given player token header to path.
func post(t *testing.T, router *gin.Engine, path, token string, body map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(common.PlayerTokenHeader, token)
	}
	router.ServeHTTP(rec, req)
	return rec
}

// do sends a request of the given method with a player token header to path.
func do(t *testing.T, router *gin.Engine, method, path, token string, body map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	var req *http.Request
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		req = httptest.NewRequest(method, path, bytes.NewReader(payload))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(common.PlayerTokenHeader, token)
	}
	router.ServeHTTP(rec, req)
	return rec
}

// playerRow reads a player row back by id, failing the test on error.
func playerRow(t *testing.T, env *Env, id models.PlayerId) models.Player {
	t.Helper()
	var p models.Player
	if err := common.GetOne((*common.Env)(env), common.PlayerTable, string(id), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

// TestLeaveSessionDeactivatesAndBumpsState verifies a player can self-leave:
// active flips to 0 (row kept) and the state token is bumped.
func TestLeaveSessionDeactivatesAndBumpsState(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	sessionId, _, _, member, memberToken := newSessionWithPlayers(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}

	rec := post(t, router, "/gameplay/session/"+sessionId+"/leave", memberToken, map[string]string{})
	if rec.Code != http.StatusOK {
		t.Fatalf("LeaveSession failed with %d: %s", rec.Code, rec.Body.String())
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

// TestLeaveSessionRejectsImpersonation verifies a caller cannot force another
// player out: only the server-verified caller's own membership is deactivated.
func TestLeaveSessionRejectsImpersonation(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	sessionId, _, _, member, memberToken := newSessionWithPlayers(t, env)

	// member A leaves as themselves: OK
	if rec := post(t, router, "/gameplay/session/"+sessionId+"/leave", memberToken, map[string]string{}); rec.Code != http.StatusOK {
		t.Fatalf("self-leave status = %d: %s", rec.Code, rec.Body.String())
	}
	if got := membershipActive(t, env, sessionId, member); got != 0 {
		t.Fatalf("member active = %d, want 0", got)
	}
}

// TestInactivatePlayerModOnlyBumpsState verifies the mod can boot a member
// (active=0, row kept) and that a non-mod cannot.
func TestInactivatePlayerModOnlyBumpsState(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	sessionId, _, modToken, member, memberToken := newSessionWithPlayers(t, env)

	// a non-mod's token is rejected (AsMod) and changes nothing
	rec := post(t, router, "/gameplay/session/"+sessionId+"/inactivate", memberToken,
		map[string]string{"player_id": string(member)})
	if rec.Code < http.StatusBadRequest || rec.Code >= http.StatusInternalServerError {
		t.Fatalf("non-mod inactivate status = %d, want 4xx: %s", rec.Code, rec.Body.String())
	}
	if got := membershipActive(t, env, sessionId, member); got != 1 {
		t.Fatalf("member active = %d after unauthorized boot, want 1", got)
	}

	// the mod's boot succeeds, keeps the row, and bumps the state token
	stateBefore, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}
	rec = post(t, router, "/gameplay/session/"+sessionId+"/inactivate", modToken,
		map[string]string{"player_id": string(member)})
	if rec.Code != http.StatusOK {
		t.Fatalf("InactivatePlayer failed with %d: %s", rec.Code, rec.Body.String())
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

// TestUpdatePlayerOwnership verifies a player can update only their own record:
// Player A's credential cannot PUT Player B's row (4xx, and B's row unchanged),
// and A can update their own team_name / real_name / icon.
func TestUpdatePlayerOwnership(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	_, _, _, member, memberToken := newSessionWithPlayers(t, env)
	other, _ := createPlayerRowWithToken(t, env, "other")

	// Player A cannot overwrite Player B's record.
	rec := do(t, router, http.MethodPut, "/gameplay/player/"+string(other), memberToken,
		map[string]string{"team_name": "hacked", "real_name": "hacker", "icon": "😈"})
	if rec.Code < http.StatusBadRequest || rec.Code >= http.StatusInternalServerError {
		t.Fatalf("cross-player update status = %d, want 4xx: %s", rec.Code, rec.Body.String())
	}
	if got := playerRow(t, env, other).TeamName; got != "other" {
		t.Fatalf("other player team_name = %q after unauthorized update, want %q", got, "other")
	}

	// A player can update their own record, and it sticks.
	rec = do(t, router, http.MethodPut, "/gameplay/player/"+string(member), memberToken,
		map[string]string{"team_name": "Alpha", "real_name": "Alice", "icon": "🦄"})
	if rec.Code != http.StatusOK {
		t.Fatalf("self-update status = %d: %s", rec.Code, rec.Body.String())
	}
	p := playerRow(t, env, member)
	if p.TeamName != "Alpha" || p.RealName != "Alice" || p.Icon != "🦄" {
		t.Fatalf("self-update not persisted: %+v", p)
	}
}

// TestGetOnePlayerOwnership verifies a player can read only their own record:
// Player A's credential cannot GET Player B's row, but can read their own.
func TestGetOnePlayerOwnership(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	_, _, _, member, memberToken := newSessionWithPlayers(t, env)
	other, _ := createPlayerRowWithToken(t, env, "other")

	rec := do(t, router, http.MethodGet, "/gameplay/player/"+string(other), memberToken, nil)
	if rec.Code < http.StatusBadRequest || rec.Code >= http.StatusInternalServerError {
		t.Fatalf("cross-player read status = %d, want 4xx: %s", rec.Code, rec.Body.String())
	}

	rec = do(t, router, http.MethodGet, "/gameplay/player/"+string(member), memberToken, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("self-read status = %d: %s", rec.Code, rec.Body.String())
	}
}

// TestGetOnePlayerRequiresToken verifies the read is fail-closed: no token is
// rejected rather than treated as a spectator, since the response is the
// caller's own identity.
func TestGetOnePlayerRequiresToken(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	_, _, _, member, _ := newSessionWithPlayers(t, env)

	rec := do(t, router, http.MethodGet, "/gameplay/player/"+string(member), "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated read status = %d, want 401: %s", rec.Code, rec.Body.String())
	}
}

// TestUpdatePlayerBumpsSessions verifies that a self-update still bumps the
// state token of each session the player belongs to.
func TestUpdatePlayerBumpsSessions(t *testing.T) {
	env := openPlayersTestDB(t)
	router := newPlayerRouter(env, &sessions.Env{Db: env.Db})
	sessionId, _, _, member, memberToken := newSessionWithPlayers(t, env)

	stateBefore, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}

	rec := do(t, router, http.MethodPut, "/gameplay/player/"+string(member), memberToken,
		map[string]string{"team_name": "Alpha", "real_name": "Alice", "icon": "🦄"})
	if rec.Code != http.StatusOK {
		t.Fatalf("self-update status = %d: %s", rec.Code, rec.Body.String())
	}
	stateAfter, err := common.GetState((*common.Env)(env), sessionId)
	if err != nil {
		t.Fatal(err)
	}
	if stateBefore == stateAfter {
		t.Fatal("state token did not change on self-update")
	}
}
