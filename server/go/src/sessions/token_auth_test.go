package sessions_test

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
	"github.com/jdarthur/trivia/players"
	"github.com/jdarthur/trivia/sessions"
	"github.com/jdarthur/trivia/store"
)

// Ticket #256 coverage: gameplay auth is a per-player bearer token in the
// borttrivia-player-token header. player_id is a public identifier, never a
// credential; identity always comes from the server-verified context.

func newTokenTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func sha256hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

func createStartableGame(t *testing.T, db *sql.DB) string {
	t.Helper()
	env := &common.Env{Db: db}
	qid, _, err := common.Create(env, common.QuestionTable, &models.Question{Question: "q?", Answer: "a"})
	if err != nil {
		t.Fatal(err)
	}
	roundId, _, err := common.Create(env, common.RoundTable,
		&models.Round{Name: "R", Questions: []string{qid}, Wagers: []int{100}})
	if err != nil {
		t.Fatal(err)
	}
	gameId, _, err := common.Create(env, common.GameTable,
		&models.Game{Name: "G", Rounds: []string{roundId}, RoundNames: map[string]string{roundId: "R"}})
	if err != nil {
		t.Fatal(err)
	}
	return gameId
}

// newRouter wires the gameplay routes the way main.go does.
func newRouter(db *sql.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	auth := common.Env{Db: db}
	s := sessions.Env{Db: db}
	p := players.Env{Db: db}
	r.POST("/gameplay/session", s.CreateSession)
	r.POST("/gameplay/player", p.CreatePlayer)
	r.POST("/gameplay/session/:id/answer", auth.WithPlayer, s.AnswerQuestion)
	r.POST("/gameplay/session/:id/leave", auth.WithPlayer, p.LeaveSession)
	r.PUT("/gameplay/session/:id/reaction", auth.WithPlayer, s.SetReaction)
	r.POST("/gameplay/session/:id/start", s.WithValidSession, auth.WithPlayer, s.AsMod, s.StartSession)
	r.PUT("/gameplay/session/:id/current-round", s.WithValidSession, auth.WithPlayer, s.AsMod, s.SetCurrentRound)
	r.GET("/gameplay/session/:id/players", auth.WithPlayer, s.GetPlayersInSession)
	r.GET("/gameplay/session/:id/scoreboard", auth.WithPlayer, s.GetSessionScoreboard)
	return r
}

// do sends a request with an optional player token header and returns the
// recorder.
func do(r *gin.Engine, method, path string, token string, body interface{}) *httptest.ResponseRecorder {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set(common.PlayerTokenHeader, token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// createSessionViaHandler creates a session through the real handler and
// returns the session id and the moderator's one-time token.
func createSessionViaHandler(t *testing.T, r *gin.Engine, db *sql.DB) (string, string) {
	t.Helper()
	gameId := createStartableGame(t, db)
	rec := do(r, http.MethodPost, "/gameplay/session", "", map[string]string{"name": "S", "game_id": gameId})
	if rec.Code != http.StatusOK {
		t.Fatalf("create session = %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID          string `json:"id"`
		PlayerToken string `json:"player_token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad create-session response %q: %v", rec.Body.String(), err)
	}
	if created.PlayerToken == "" {
		t.Fatalf("create-session response did not include player_token: %s", rec.Body.String())
	}
	return created.ID, created.PlayerToken
}

func createPlayerViaHandler(t *testing.T, r *gin.Engine, teamName string) (string, string) {
	t.Helper()
	rec := do(r, http.MethodPost, "/gameplay/player", "", map[string]string{"team_name": teamName})
	if rec.Code != http.StatusOK {
		t.Fatalf("create player = %d: %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID          string `json:"id"`
		PlayerToken string `json:"player_token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("bad create-player response %q: %v", rec.Body.String(), err)
	}
	if created.PlayerToken == "" {
		t.Fatalf("create-player response did not include player_token: %s", rec.Body.String())
	}
	return created.ID, created.PlayerToken
}

func addPlayerToSession(t *testing.T, db *sql.DB, sessionId, playerId string) {
	t.Helper()
	if err := common.Push(&common.Env{Db: db}, common.SessionTable, sessionId, models.Players, models.PlayerId(playerId)); err != nil {
		t.Fatal(err)
	}
}

// TestPlayerTokenIssuedOnceAndOnlyHashPersisted verifies the token is returned
// at create, only its hash is stored, and the plaintext token appears nowhere
// in the player table.
func TestPlayerTokenIssuedOnceAndOnlyHashPersisted(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	playerId, token := createPlayerViaHandler(t, r, "team-1")

	var tokenHash string
	if err := db.QueryRow(`SELECT token_hash FROM player WHERE id = ?`, playerId).Scan(&tokenHash); err != nil {
		t.Fatal(err)
	}
	if tokenHash == "" {
		t.Fatal("token_hash not persisted")
	}
	if tokenHash == token {
		t.Fatal("plaintext token stored in token_hash")
	}
	if tokenHash != sha256hex(token) {
		t.Fatalf("token_hash = %q, want sha256(token)", tokenHash)
	}

	// the plaintext token never appears anywhere in the player table
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM player WHERE token_hash = ?`, token).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("plaintext token found in token_hash column (%d rows)", n)
	}
}

// TestCreateSessionIssuesModeratorToken verifies the moderator's credential is
// returned once and only its hash is persisted.
func TestCreateSessionIssuesModeratorToken(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	_, modToken := createSessionViaHandler(t, r, db)

	var tokenHash string
	if err := db.QueryRow(`SELECT token_hash FROM player WHERE token_hash = ?`, sha256hex(modToken)).Scan(&tokenHash); err != nil {
		t.Fatalf("moderator token hash not found: %v", err)
	}
	if tokenHash != sha256hex(modToken) {
		t.Fatalf("moderator token_hash = %q", tokenHash)
	}
}

// TestModeratorEndpointsRequireToken drives the mod-gated routes: correct
// token -> 200, a valid non-mod token -> 4xx, absent header -> 4xx, garbage
// token -> 4xx.
func TestModeratorEndpointsRequireToken(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	sessionId, modToken := createSessionViaHandler(t, r, db)
	nonModId, nonModToken := createPlayerViaHandler(t, r, "team-1")
	addPlayerToSession(t, db, sessionId, nonModId)

	start := func(token string) *httptest.ResponseRecorder {
		return do(r, http.MethodPost, "/gameplay/session/"+sessionId+"/start", token, map[string]string{})
	}

	if rec := start(modToken); rec.Code != http.StatusOK {
		t.Fatalf("mod start = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	if rec := start(nonModToken); rec.Code < http.StatusBadRequest || rec.Code >= http.StatusInternalServerError {
		t.Fatalf("non-mod start = %d, want 4xx: %s", rec.Code, rec.Body.String())
	}
	if rec := start(""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("absent-token start = %d, want 401: %s", rec.Code, rec.Body.String())
	}
	if rec := start("garbage-token"); rec.Code != http.StatusForbidden {
		t.Fatalf("garbage-token start = %d, want 403: %s", rec.Code, rec.Body.String())
	}
}

// TestAnswerImpersonationRejected verifies a caller cannot submit an answer on
// behalf of another player: the handler attributes the answer to the
// server-verified caller, ignoring the body's player_id.
func TestAnswerImpersonationRejected(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	sessionId, modToken := createSessionViaHandler(t, r, db)
	modId, _ := sessionModeratorId(t, db, sessionId)
	nonModId, nonModToken := createPlayerViaHandler(t, r, "team-1")
	addPlayerToSession(t, db, sessionId, nonModId)
	if rec := do(r, http.MethodPost, "/gameplay/session/"+sessionId+"/start", modToken, map[string]string{}); rec.Code != http.StatusOK {
		t.Fatalf("start = %d: %s", rec.Code, rec.Body.String())
	}

	// player A tries to answer as the mod (body player_id = mod id)
	body := map[string]interface{}{
		"answer": "guess", "wager": 100, "round_id": 0, "question_id": 0,
		"player_id": modId, // impersonation attempt: names the mod
	}
	rec := do(r, http.MethodPost, "/gameplay/session/"+sessionId+"/answer", nonModToken, body)
	if rec.Code != http.StatusOK {
		t.Fatalf("answer = %d: %s", rec.Code, rec.Body.String())
	}

	// the stored answer belongs to the caller (nonModId), not the mod
	var playerId string
	if err := db.QueryRow(`SELECT player_id FROM answer WHERE session_id = ? ORDER BY rowid DESC LIMIT 1`, sessionId).Scan(&playerId); err != nil {
		t.Fatal(err)
	}
	if playerId != nonModId {
		t.Fatalf("answer attributed to %q, want caller %q", playerId, nonModId)
	}
}

// TestLeaveImpersonationRejected verifies a caller cannot force another player
// out: only the caller's own membership is deactivated.
func TestLeaveImpersonationRejected(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	sessionId, modToken := createSessionViaHandler(t, r, db)
	memberA, tokenA := createPlayerViaHandler(t, r, "team-a")
	memberB, _ := createPlayerViaHandler(t, r, "team-b")
	addPlayerToSession(t, db, sessionId, memberA)
	addPlayerToSession(t, db, sessionId, memberB)
	if rec := do(r, http.MethodPost, "/gameplay/session/"+sessionId+"/start", modToken, map[string]string{}); rec.Code != http.StatusOK {
		t.Fatalf("start = %d: %s", rec.Code, rec.Body.String())
	}

	// member A tries to leave as member B (body player_id = B)
	rec := do(r, http.MethodPost, "/gameplay/session/"+sessionId+"/leave", tokenA, map[string]string{"player_id": memberB})
	if rec.Code != http.StatusOK {
		t.Fatalf("leave = %d: %s", rec.Code, rec.Body.String())
	}

	// A (the caller) is deactivated; B (the target) is untouched
	if got := membershipActive(t, db, sessionId, memberA); got != 0 {
		t.Fatalf("caller active = %d after self-leave, want 0", got)
	}
	if got := membershipActive(t, db, sessionId, memberB); got != 1 {
		t.Fatalf("target active = %d after impersonated leave, want 1", got)
	}
}

// TestPlayerTokenNeverAppearsInReads verifies the credential is never exposed
// on the read paths that hand out player records (roster / scoreboard): neither
// player_token nor token_hash appears in those payloads.
func TestPlayerTokenNeverAppearsInReads(t *testing.T) {
	db := newTokenTestDB(t)
	r := newRouter(db)
	sessionId, modToken := createSessionViaHandler(t, r, db)
	playerId, _ := createPlayerViaHandler(t, r, "team-1")
	addPlayerToSession(t, db, sessionId, playerId)

	for _, path := range []string{
		"/gameplay/session/" + sessionId + "/players",
		"/gameplay/session/" + sessionId + "/scoreboard",
	} {
		rec := do(r, http.MethodGet, path, modToken, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s = %d: %s", path, rec.Code, rec.Body.String())
		}
		body := rec.Body.String()
		if body == "" {
			t.Fatalf("GET %s returned an empty body", path)
		}
		for _, secret := range []string{"player_token", "token_hash"} {
			if bytes.Contains([]byte(body), []byte(secret)) {
				t.Fatalf("GET %s leaked %q in body: %s", path, secret, body)
			}
		}
	}
}

func sessionModeratorId(t *testing.T, db *sql.DB, sessionId string) (string, error) {
	t.Helper()
	var mod string
	err := db.QueryRow(`SELECT moderator_id FROM session WHERE id = ?`, sessionId).Scan(&mod)
	return mod, err
}

func membershipActive(t *testing.T, db *sql.DB, sessionId string, player string) int {
	t.Helper()
	var active int
	if err := db.QueryRow(`SELECT active FROM session_player WHERE session_id = ? AND player_id = ?`,
		sessionId, player).Scan(&active); err != nil {
		t.Fatal(err)
	}
	return active
}
