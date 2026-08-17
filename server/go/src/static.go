package main

import (
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// apiPrefixes are the paths the API owns. A request under one of these that
// matched no route is a real 404, not a client-side route, so the fallback below
// has to leave them alone. Otherwise a typo'd endpoint answers 200 with a page
// of HTML, which is a miserable thing to debug against.
var apiPrefixes = []string{"/editor/", "/gameplay/", "/images/"}

// serveClient serves the built client out of dir: real files where they exist,
// index.html everywhere else, so react-router can handle a cold load of a deep
// link like /game/abc.
//
// This registers as NoRoute rather than router.Static because NoRoute is layout
// agnostic. Create React App wrote its hashed bundles to build/static and Vite
// writes them to build/assets, and top-level files like favicon.ico sit beside
// both; matching on "nothing else claimed this" covers all of it without naming
// any of it. NoRoute only runs when no other route matched, so it cannot shadow
// the API even before the prefix check.
//
// A missing dir is not an error. The server runs without a client in front of it
// during development, and CI never builds one.
func serveClient(router *gin.Engine, dir string) {
	if dir == "" {
		log.Println("client dir is unset, not serving the client")
		return
	}

	root, err := filepath.Abs(dir)
	if err != nil {
		log.Printf("resolving client dir %q: %v, not serving the client", dir, err)
		return
	}

	// Keying off index.html rather than the directory keeps an empty dir from
	// looking like a working deployment. Docker creates the host side of a bind
	// mount if it is missing, so a compose up before npm run build lands here
	// with an empty dir rather than no dir at all.
	index := filepath.Join(root, "index.html")
	if _, err := os.Stat(index); err != nil {
		log.Printf("no index.html under %s, not serving the client", root)
		return
	}

	log.Printf("serving the client from %s", root)
	router.NoRoute(clientHandler(root, index))
}

// clientHandler resolves a request against the built client, falling back to
// index.html so client-side routes survive a page load.
func clientHandler(root, index string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// The fallback only makes sense for a browser fetching a page or an
		// asset. A POST that matched no route is a 404 whatever the path.
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusNotFound)
			return
		}

		for _, prefix := range apiPrefixes {
			if strings.HasPrefix(c.Request.URL.Path, prefix) {
				c.Status(http.StatusNotFound)
				return
			}
		}

		if file, ok := resolve(root, c.Request.URL.Path); ok {
			c.File(file)
			return
		}

		c.File(index)
	}
}

// resolve maps a request path onto a regular file inside root, reporting false
// if it does not name one. Cleaning the path before the join is what removes
// ../ segments; the containment check afterwards is belt and braces in case a
// symlink or an odd encoding gets one through.
func resolve(root, urlPath string) (string, bool) {
	clean := path.Clean("/" + urlPath)
	file := filepath.Join(root, filepath.FromSlash(clean))

	rel, err := filepath.Rel(root, file)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}

	// Directories fall through to index.html rather than producing a listing.
	info, err := os.Stat(file)
	if err != nil || !info.Mode().IsRegular() {
		return "", false
	}

	return file, true
}
