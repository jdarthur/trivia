package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
)

// These tests build a router the same shape as main's -- a couple of real API
// routes plus the client fallback -- so they cover the interaction between them
// rather than the fallback in isolation. That interaction is the whole risk
// here: a fallback that is slightly too greedy silently turns API 404s into
// pages of HTML.

func init() {
	gin.SetMode(gin.TestMode)
}

// clientDir writes a minimal build output and returns its path.
func clientDir(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	files := map[string]string{
		"index.html":             "<!doctype html>index",
		"favicon.ico":            "icon",
		"assets/index-abc123.js": "bundle",
	}

	for name, body := range files {
		file := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
			t.Fatalf("creating %s: %v", filepath.Dir(file), err)
		}
		if err := os.WriteFile(file, []byte(body), 0o644); err != nil {
			t.Fatalf("writing %s: %v", file, err)
		}
	}

	return root
}

// testRouter mirrors main's registration order: API routes, then the fallback.
func testRouter(t *testing.T, dir string) *gin.Engine {
	t.Helper()

	router := gin.New()
	router.GET("/editor/questions", func(c *gin.Context) { c.String(http.StatusOK, "questions") })
	router.GET("/gameplay/player/:id", func(c *gin.Context) { c.String(http.StatusOK, "player") })
	serveClient(router, dir)

	return router
}

func get(t *testing.T, router *gin.Engine, method, target string) *httptest.ResponseRecorder {
	t.Helper()

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(method, target, nil))

	return w
}

func TestServeClientServesRealFiles(t *testing.T) {
	router := testRouter(t, clientDir(t))

	cases := map[string]string{
		"/favicon.ico":            "icon",
		"/assets/index-abc123.js": "bundle",
	}

	for target, want := range cases {
		w := get(t, router, http.MethodGet, target)
		if w.Code != http.StatusOK {
			t.Errorf("GET %s: status = %d, want 200", target, w.Code)
		}
		if w.Body.String() != want {
			t.Errorf("GET %s: body = %q, want %q", target, w.Body.String(), want)
		}
	}
}

func TestServeClientFallsBackToIndex(t *testing.T) {
	router := testRouter(t, clientDir(t))

	// The deep links react-router owns, plus the bare root, plus a path that
	// looks like an asset but is not one.
	for _, target := range []string{"/", "/game/abc", "/collections", "/assets", "/assets/missing.js"} {
		w := get(t, router, http.MethodGet, target)
		if w.Code != http.StatusOK {
			t.Errorf("GET %s: status = %d, want 200", target, w.Code)
		}
		if w.Body.String() != "<!doctype html>index" {
			t.Errorf("GET %s: body = %q, want the index", target, w.Body.String())
		}
	}
}

func TestServeClientLeavesTheAPIAlone(t *testing.T) {
	router := testRouter(t, clientDir(t))

	// Routes that exist still answer.
	for _, target := range []string{"/editor/questions", "/gameplay/player/7"} {
		if w := get(t, router, http.MethodGet, target); w.Code != http.StatusOK {
			t.Errorf("GET %s: status = %d, want 200", target, w.Code)
		}
	}

	// Routes that do not exist 404 instead of returning the index. /images is
	// registered by main via router.Static, so it is absent here and stands in
	// for an unmounted image dir.
	//
	// The body is gin's own default 404, which is what these paths returned
	// before the fallback existed: setting a status without writing leaves
	// serveError to fill the body in. Asserting on it is asserting that the
	// fallback did not touch the response.
	for _, target := range []string{"/editor/nope", "/gameplay/session/1/nope", "/images/missing.png"} {
		w := get(t, router, http.MethodGet, target)
		if w.Code != http.StatusNotFound {
			t.Errorf("GET %s: status = %d, want 404", target, w.Code)
		}
		if w.Body.String() != "404 page not found" {
			t.Errorf("GET %s: body = %q, want gin's default 404", target, w.Body.String())
		}
	}
}

func TestServeClientOnlyFallsBackForReads(t *testing.T) {
	router := testRouter(t, clientDir(t))

	// A write to an unrouted path is a 404, not a page. POST /editor/questions
	// is included because the route exists for GET only, and gin sends method
	// mismatches to NoRoute by default.
	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete} {
		for _, target := range []string{"/game/abc", "/editor/questions"} {
			if w := get(t, router, method, target); w.Code != http.StatusNotFound {
				t.Errorf("%s %s: status = %d, want 404", method, target, w.Code)
			}
		}
	}

	if w := get(t, router, http.MethodHead, "/game/abc"); w.Code != http.StatusOK {
		t.Errorf("HEAD /game/abc: status = %d, want 200", w.Code)
	}
}

func TestServeClientRejectsTraversal(t *testing.T) {
	root := clientDir(t)

	// A file next to the build dir, i.e. what an escape would be reaching for.
	secret := filepath.Join(filepath.Dir(root), "secret.env")
	if err := os.WriteFile(secret, []byte("MONGO_HOST=nope"), 0o644); err != nil {
		t.Fatalf("writing %s: %v", secret, err)
	}

	// resolve is checked directly as well as through the router, because gin and
	// net/http both clean the path before a handler ever sees it. That cleaning
	// is the reason the router cases pass, and it is not something this package
	// controls, so the unit-level check is what actually pins the behaviour.
	for _, urlPath := range []string{
		"/../secret.env",
		"/../../secret.env",
		"/assets/../../secret.env",
		"/..%2Fsecret.env",
	} {
		if file, ok := resolve(root, urlPath); ok {
			t.Errorf("resolve(%q) = %q, true; want false", urlPath, file)
		}
	}

	router := testRouter(t, root)
	for _, target := range []string{"/../secret.env", "/assets/../../secret.env"} {
		w := get(t, router, http.MethodGet, target)
		if w.Body.String() == "MONGO_HOST=nope" {
			t.Errorf("GET %s served the file outside the build dir", target)
		}
	}
}

func TestServeClientSkipsWithoutABuild(t *testing.T) {
	// Each of these has to leave the router without a fallback, so that a
	// server deployed with no client keeps answering 404 for unknown paths
	// rather than 500ing on a missing index.html.
	empty := t.TempDir()

	cases := map[string]string{
		"unset":    "",
		"missing":  filepath.Join(t.TempDir(), "no-such-dir"),
		"no index": empty,
	}

	for name, dir := range cases {
		t.Run(name, func(t *testing.T) {
			router := testRouter(t, dir)

			w := get(t, router, http.MethodGet, "/game/abc")
			if w.Code != http.StatusNotFound {
				t.Errorf("GET /game/abc: status = %d, want 404", w.Code)
			}

			// The API still works, which is the point of tolerating this.
			if w := get(t, router, http.MethodGet, "/editor/questions"); w.Code != http.StatusOK {
				t.Errorf("GET /editor/questions: status = %d, want 200", w.Code)
			}
		})
	}
}
