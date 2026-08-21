# Full-stack build helpers for the trivia app.
#
#   make build   # compile the Go server + build the React client (default)
#   make run     # build both, then run the server serving the built client
#   make check   # go vet + go test + npm audit (mirrors CI)
#   make clean   # remove generated artifacts
#
# The server is a single Go binary that also serves the built client, so
# "build the stack" is just these two steps. No Docker, no database service.

.PHONY: build build-server build-client run check clean

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

clean:
	rm -f server/go/src/trivia-server
	rm -rf client/build
