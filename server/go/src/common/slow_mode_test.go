package common

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// TestSlowModeDelayMSBounds verifies the artificial latency always stays inside
// the documented 200-1000ms window.
func TestSlowModeDelayMSBounds(t *testing.T) {
	for i := 0; i < 1000; i++ {
		d := SlowModeDelayMS()
		if d < minSlowDelayMS || d > maxSlowDelayMS {
			t.Fatalf("SlowModeDelayMS() = %d, want in [%d, %d]", d, minSlowDelayMS, maxSlowDelayMS)
		}
	}
}

// TestSlowModeSlowsAPICalls verifies the middleware actually sleeps for API
// requests: the elapsed time around the request must be at least the minimum
// delay. The upper bound is deliberately generous to stay robust under load.
func TestSlowModeSlowsAPICalls(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SlowMode)
	r.GET("/editor/question/123", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/editor/question/123", nil)
	w := httptest.NewRecorder()

	start := time.Now()
	r.ServeHTTP(w, req)
	elapsed := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if elapsed < minSlowDelayMS*time.Millisecond {
		t.Errorf("API request took %v, want at least %v (slow-mode delay)", elapsed, minSlowDelayMS*time.Millisecond)
	}
	if elapsed > 2*time.Second {
		t.Errorf("API request took %v, want less than 2s", elapsed)
	}
}

// TestSlowModeLeavesStaticAssetsAlone verifies the middleware passes non-API
// requests through without sleeping, so a --slow-mode run does not slow the
// browser's asset downloads.
func TestSlowModeLeavesStaticAssetsAlone(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(SlowMode)
	r.GET("/assets/app.js", func(c *gin.Context) {
		c.String(http.StatusOK, "js")
	})

	req := httptest.NewRequest(http.MethodGet, "/assets/app.js", nil)
	w := httptest.NewRecorder()

	start := time.Now()
	r.ServeHTTP(w, req)
	elapsed := time.Since(start)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if elapsed >= minSlowDelayMS*time.Millisecond {
		t.Errorf("static asset request took %v, want no slow-mode delay", elapsed)
	}
}
