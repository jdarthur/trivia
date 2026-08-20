# trivia

Full stack trivia web app — multi-user, anonymous, responsive.

An editor side for writing questions, grouping them into rounds and assembling
rounds into games, and a gameplay side where a host runs a live session and
players answer from their own devices.

## Stack

| Part | Built with |
|---|---|
| Client | React, Ant Design, Redux Toolkit, React Router |
| Server | Go, Gin |
| Database | SQLite (via `modernc.org/sqlite`, pure Go) |
| Auth | Auth0 (editor endpoints only — gameplay is anonymous) |

## Layout

```
client/          React app
server/go/src/   Go API server
  common/          auth middleware, DB helpers, shared errors
  models/          data models
  questions/ rounds/ games/ collections/    editor endpoints
  sessions/ players/                        gameplay endpoints
  store/           SQLite connection and schema migrations
  migrate/         MongoDB → SQLite import (run via cmd/migrate)
archive/         past games, kept for reference
```

## Running it

The server needs no external service — it stores everything in a SQLite
database. `server/go/src/store/` owns the connection (`DB_PATH`, default
`data/trivia.db`) and applies schema migrations on startup.

Then the API, which listens on `:8080`:

```sh
cd server/go/src
go run .
```

It reads `DB_PATH` from `server/go/src/.env` (default `data/trivia.db`) and
`IMAGE_DIR` for uploaded question images, which defaults to `images` relative
to the working directory.

### Development: two servers

The client runs its own dev server and proxies `/editor`, `/gameplay` and
`/images` through to the API:

```sh
cd client
npm install
npm start
```

`npm start` binds port 443, which needs privileges on most systems. Override it
for local work:

```sh
PORT=3000 npm start
```

Client configuration lives in `client/.env`: `REACT_APP_EDITOR_HOST` /
`REACT_APP_EDITOR_PORT` point at the API, with `REACT_APP_GAMEPLAY_HOST` /
`REACT_APP_GAMEPLAY_PORT` for the gameplay endpoints if they are served
separately.

`npm start` serves over HTTPS using the certificate in `client/cert/`, which is
self-signed — expect a browser warning on first load.

### Deployment: one server

The API can serve the built client itself, so there is no separate node process
and no proxy in front of the two. Build the client, then bring the stack up:

```sh
cd client && npm run build
cd ../server/go/src && docker compose up -d
```

The app is then on <http://127.0.0.1:8080> — API under `/editor` and
`/gameplay`, uploaded images under `/images`, and everything else served from
the build, falling back to `index.html` so a deep link like `/game/abc` works on
a cold load.

`docker-compose.yml` mounts `client/build` read-only at `/go/src/client` and
points `CLIENT_DIR` at it. The mount is deliberate rather than baked into the
image: the build context is `server/go/src`, so the Dockerfile cannot reach
`client/` to build it. Rebuilding the client is enough to pick up changes; the
container does not need a restart.

`CLIENT_DIR` defaults to `client` relative to the working directory and is
optional. If it holds no `index.html` — an unbuilt client, or a deployment that
does not want one — the server logs that it is skipping the client and serves
the API alone.

## Migrating from MongoDB

The SQLite store is new; if you have data in the old MongoDB database, import
it once with the migration command before switching the server over:

```sh
cd server/go/src
go run ./cmd/migrate
```

The command reads every collection the mgo-era server wrote — `question`,
`round`, `game`, `session`, `player`, `answer`, `session_state`,
`collection`, `scoring_note` — from the database named `trivia` and writes the
equivalent rows into the SQLite database at `DB_PATH` (default
`data/trivia.db`), preserving UUIDs and `create_date`. Nested session
documents are flattened into `session_player` / `session_question` rows,
answers are placed into their session/round/question using the session
document's answer map, and `session_score` per-round totals are derived from
the scored answers' points.

The Mongo connection comes from `MONGO_HOST` / `MONGO_PORT` (defaults
`localhost:27017`) and the database name from `MONGO_DB` (default `trivia`) —
the same variables the mgo-era server used. The command uses the official
Mongo driver, so it works with any MongoDB version (the `globalsign/mgo` fork
is only pinned to `mongo:5.0` in the old server code).

The command refuses to run against a non-empty SQLite database — no silent
merge — so point it at a fresh database or delete `data/trivia.db` first. The
whole import is one transaction: a failure rolls everything back. Rows whose
parent is missing (dangling references that Mongo tolerated but the SQLite
foreign keys forbid) are skipped, and a question pointing at a missing scoring
note is imported with the reference cleared; both are counted in the printed
summary.

Example:

```sh
cd server/go/src
MONGO_HOST=localhost MONGO_PORT=27017 DB_PATH=data/trivia.db go run ./cmd/migrate
```

## Checks

CI runs on every pull request. To run the same checks locally:

```sh
cd server/go/src && go build ./... && go vet ./... && go test ./...
cd client && npm ci && npm run build && npm audit
```
