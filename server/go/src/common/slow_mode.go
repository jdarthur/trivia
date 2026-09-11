package common

import (
	"math/rand"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// slow-mode artificial latency bounds, in milliseconds. SlowMode sleeps a
// random amount in [minSlowDelayMS, maxSlowDelayMS] on each API request.
const (
	minSlowDelayMS = 200
	maxSlowDelayMS = 1000
)

// apiPathPrefixes are the URL prefixes the data API owns. SlowMode only sleeps
// for requests under these, so static client assets and uploaded images are not
// slowed during a --slow-mode run: the point of slow mode is to expose slow
// data fetches (page-loading problems, missing skeleton loaders), not to make
// the browser's asset downloads crawl.
var apiPathPrefixes = []string{"/editor/", "/gameplay/"}

// SlowModeDelayMS returns the artificial latency, in milliseconds, that
// SlowMode applies to a single request. It is a random value in
// [minSlowDelayMS, maxSlowDelayMS]. Split out from the handler so tests can
// exercise the bounds without actually sleeping.
func SlowModeDelayMS() int {
	return minSlowDelayMS + rand.Intn(maxSlowDelayMS-minSlowDelayMS+1)
}

// SlowMode adds artificial latency to each API call. It is enabled only by the
// --slow-mode CLI flag (see main.go) and is intended for local performance / UX
// testing: making the data API respond 200-1000ms late makes page-loading
// problems and places that need skeleton loaders visible. It sleeps only for
// requests under an API prefix and leaves static client / image serving alone.
func SlowMode(c *gin.Context) {
	if !isAPIPath(c.Request.URL.Path) {
		c.Next()
		return
	}
	time.Sleep(time.Duration(SlowModeDelayMS()) * time.Millisecond)
	c.Next()
}

// isAPIPath reports whether path is under one of the API prefixes that SlowMode
// slows down.
func isAPIPath(path string) bool {
	for _, prefix := range apiPathPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}
