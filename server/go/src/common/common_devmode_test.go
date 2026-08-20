package common

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jdarthur/trivia/store"
)

// openSeededDevDB opens a fresh SQLite database, migrates it, and seeds the
// dev-mode mock users — the same shape the API's --dev-mode path produces.
func openSeededDevDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := store.Open(filepath.Join(t.TempDir(), "trivia-dev.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	if err := store.SeedUsers(db); err != nil {
		t.Fatalf("SeedUsers: %v", err)
	}
	return db
}

// unsignedDevToken builds an unsigned (alg "none") mock JWT, the same shape
// the client produces for ?mockUser login.
func unsignedDevToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("signing unsigned token: %v", err)
	}
	return signed
}

// devClaims is a mock token that should pass every dev-mode check.
func devClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"sub": "dev|alice",
		"exp": time.Now().Add(time.Hour).Unix(),
	}
}

// withDevMode sets common.DevMode and restores it after the test.
func withDevMode(t *testing.T, dev bool) {
	t.Helper()
	previous := DevMode
	DevMode = dev
	t.Cleanup(func() { DevMode = previous })
}

func TestDecodeDevTokenAcceptsSeededUser(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	claims, err := decodeDevToken(unsignedDevToken(t, devClaims()), db)
	if err != nil {
		t.Fatalf("expected seeded dev token to be accepted, got %v", err)
	}
	if claims["sub"] != "dev|alice" {
		t.Errorf("expected sub claim to survive decoding, got %v", claims["sub"])
	}
}

// Every mock user in MockUsers is seeded, so each should be accepted by its
// own sub.
func TestDecodeDevTokenAcceptsEveryMockUser(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	for _, u := range store.MockUsers {
		claims := devClaims()
		claims["sub"] = u.Sub
		if _, err := decodeDevToken(unsignedDevToken(t, claims), db); err != nil {
			t.Errorf("expected seeded user %q to be accepted, got %v", u.Sub, err)
		}
	}
}

// An unseeded sub must be rejected even when DevMode is true.
func TestDecodeDevTokenRejectsUnseededUser(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	claims := devClaims()
	claims["sub"] = "dev|eve"

	if _, err := decodeDevToken(unsignedDevToken(t, claims), db); err == nil {
		t.Fatal("expected unseeded user to be rejected, got no error")
	} else if _, ok := err.(InvalidUserError); !ok {
		t.Errorf("expected InvalidUserError, got %T: %v", err, err)
	}
}

func TestDecodeDevTokenRejectsExpired(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	claims := devClaims()
	claims["exp"] = time.Now().Add(-time.Hour).Unix()

	if _, err := decodeDevToken(unsignedDevToken(t, claims), db); err == nil {
		t.Fatal("expected expired token to be rejected, got no error")
	} else if _, ok := err.(InvalidTokenError); !ok {
		t.Errorf("expected InvalidTokenError, got %T: %v", err, err)
	}
}

func TestDecodeDevTokenRejectsMissingSub(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	claims := devClaims()
	delete(claims, "sub")

	if _, err := decodeDevToken(unsignedDevToken(t, claims), db); err == nil {
		t.Fatal("expected token without sub to be rejected, got no error")
	} else if _, ok := err.(InvalidUserError); !ok {
		t.Errorf("expected InvalidUserError, got %T: %v", err, err)
	}
}

// DevMode gates the unsigned path entirely: with DevMode false, AsUser routes
// to the normal RS256 path, which rejects the unsigned mock token.
func TestAsUserRejectsDevTokenWhenDevModeOff(t *testing.T) {
	withDevMode(t, false)
	db := openSeededDevDB(t)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("borttrivia-token", unsignedDevToken(t, devClaims()))

	env := Env{Db: db}
	env.AsUser(c)

	if !c.IsAborted() {
		t.Fatal("expected request to be aborted when DevMode is off, got no abort")
	}
	if got := GetUserId(c); got != "" {
		t.Errorf("userId = %q, want empty when DevMode is off", got)
	}
}

// With DevMode true, AsUser accepts a seeded user's unsigned token and stores
// the sub as the userId.
func TestAsUserAcceptsDevToken(t *testing.T) {
	withDevMode(t, true)
	db := openSeededDevDB(t)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Request.Header.Set("borttrivia-token", unsignedDevToken(t, devClaims()))

	env := Env{Db: db}
	env.AsUser(c)

	if c.IsAborted() {
		t.Fatal("expected request to pass when DevMode is on, got abort")
	}
	if got := GetUserId(c); got != "dev|alice" {
		t.Errorf("userId = %q, want dev|alice", got)
	}
}
