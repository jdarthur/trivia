# Full-stack build helpers for the trivia app.
#
#   make build   # compile the Go server + build the React client (default)
#   make run     # build both, then run the server serving the built client
#   make check   # go vet + go test + npm audit (mirrors CI)
#   make e2e     # run the Playwright end-to-end suite (e2e/)
#   make clean   # remove generated artifacts
#
# The server is a single Go binary that also serves the built client, so
# "build the stack" is just these two steps. No Docker, no database service.

.PHONY: build build-server build-client run check e2e clean

# Default: compile both halves of the stack.
build: build-server build-client

build-server:
	cd server/go/src && go build ./...

build-client:
	cd client && (test -d node_modules || npm ci) && npm run build

# Build the server into a runnable binary next to its sources.
server-bin:
	cd server/go/src && go build -o trivia-server .

# Build the client + server binary, then run the server serving the built
# client on :8080 (DB_PATH/IMAGE_DIR default under server/go/src).
run: build-client server-bin
	cd server/go/src && CLIENT_DIR=../../../client/build ./trivia-server

# Same checks CI runs (server build/vet/test, client audit).
check:
	cd server/go/src && go build ./... && go vet ./... && go test ./...
	cd client && npm audit

# Run the Playwright end-to-end suite (e2e/). The playwright webServer config
# builds the client and boots the Go API against a scratch SQLite DB itself, so
# this single target drives the whole harness. Browsers are installed once:
# `cd e2e && npx playwright install chromium` (CI uses --with-deps).
e2e:
	cd e2e && (test -d node_modules || npm ci) && npx playwright test

clean:
	rm -f server/go/src/trivia-server
	rm -rf client/build
