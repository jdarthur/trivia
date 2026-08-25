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
to the working directory. There is no `MONGO_HOST` / `MONGO_PORT` — the running
server is pure SQLite.

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

### Dev mode: mock login without Auth0

The editor normally signs in through Auth0. For local work without an Auth0
tenant, the API has a `--dev-mode` flag that runs against a **transient**
SQLite database (default `data/trivia-dev.db`, distinct from the real
`trivia.db`), seeds mock users, skips the Auth0 JWKS fetch, and accepts
unsigned mock JWTs:

```sh
cd server/go/src
go run . --dev-mode --addr 127.0.0.1:8080
```

It prints a loud `WARNING: running in dev mode, Auth0 verification disabled`
banner on boot. The dev database is a scratch file — safe to delete, and it
never touches the standard `trivia.db`.

**Security guardrail:** dev mode is only allowed on the loopback interface.
Because it disables Auth0 verification and accepts unsigned mock JWTs, the API
refuses to start with `--dev-mode` unless the listen address binds to
`127.0.0.1`, `localhost`, or `::1`. The default listen address is `:8080`
(all interfaces) — pass `--addr 127.0.0.1:8080` (or similar) when running in
dev mode, or the server exits with a refusal message. A production build never
enables dev mode, so `?mockUser` is inert against a real backend.

The seeded mock users are `alice`, `bob`, `carol`, and `dave` (subs
`dev|alice`, `dev|bob`, `dev|carol`, `dev|dave`). Log in as one by adding a
`?mockUser=<name>` query param to the editor URL:

```
https://localhost:3000/questions?mockUser=alice
```

The client skips Auth0, embeds `dev|<name>` and a future `exp` in an unsigned
JWT, and sends it on the normal `borttrivia-token` header. The mock avatar is a
placeholder; logging out just drops the token and the `?mockUser` param — there
is no Auth0 redirect.

**Security guardrail:** the server only accepts unsigned tokens when started
with `--dev-mode` (the `alg:none` path is gated behind the `--dev-mode` flag),
and only for `sub`s that exist in the seeded `user` table. A production build
never enables dev mode, so `?mockUser` is inert against a real backend.

### Deployment: one server

The API serves the built client itself, so there is no separate node process, no
database container, and no proxy in front of the two — a single Go binary plus a
SQLite file is the entire deployment. Build the client, build the server binary,
and run it:

```sh
cd client && npm run build
cd ../server/go/src && go build -o trivia-server .
CLIENT_DIR=../../../client/build ./trivia-server
```

For a one-shot full-stack build, the repo's root `Makefile` does it in one step:
`make build` compiles the server and builds the client, and `make run` does that
then serves the app on :8080 (see the Makefile header for `make check` / `make
clean`).

The app is then on <http://127.0.0.1:8080> — API under `/editor` and
`/gameplay`, uploaded images under `/images`, and everything else served from
the build, falling back to `index.html` so a deep link like `/game/abc` works on
a cold load.

The server reads three environment variables (all with defaults, so a plain
`go run .` works too):

| Variable    | Default          | Meaning                                     |
|-------------|------------------|---------------------------------------------|
| `DB_PATH`   | `data/trivia.db` | SQLite database file (created if missing)   |
| `CLIENT_DIR`| `client`         | Built client directory to serve             |
| `IMAGE_DIR` | `images`         | Directory for uploaded question images      |

`CLIENT_DIR` is optional: if it holds no `index.html` — an unbuilt client, or a
deployment that does not want one — the server logs that it is skipping the
client and serves the API alone.

### Serving HTTPS

The server can terminate TLS itself — no proxy in front. Pass it an x509
certificate and private key and it serves HTTPS instead of HTTP:

```sh
cd server/go/src && go build -o trivia-server .
CLIENT_DIR=../../../client/build ./trivia-server \
  --tls-cert /path/to/server-cert.pem --tls-key /path/to/server-key.pem
```

The two flags must be given together, and the files must exist, be readable,
and be a matching certificate/key pair. The server validates all of this at
startup and refuses to start with a clear error otherwise. With no `--tls-cert`,
the server listens on plain HTTP as before.

For a one-shot build-and-serve over HTTPS, the `make prod` target is `make run`
plus the TLS flags, using `server-cert.pem` / `server-key.pem` from the server
module directory — drop your production certificate and key under those names
and run it:

```sh
make prod
```

Because the database driver is pure Go (no CGO), the server cross-compiles to
any platform trivially — e.g. a static Linux/amd64 binary for a remote host:

```sh
cd server/go/src
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o trivia-server .
```

To move a deployment, copy the binary and the `data/` directory (see Backups)
to the target host; there is nothing else to install.

## Backups

The whole application lives in one SQLite file (`data/trivia.db` by default),
so a backup is a single-file copy. The server enables WAL journal mode
(`PRAGMA journal_mode=WAL`), which means a plain file copy of a **running**
database may miss writes still sitting in the WAL file. For a consistent
snapshot use SQLite's online backup, which works even while the server is up:

```sh
cd server/go/src
sqlite3 data/trivia.db ".backup 'trivia-YYYYMMDD.db'"
```

Restores are just the inverse: stop the server, copy the backup file back over
`data/trivia.db` (and delete any leftover `data/trivia.db-wal` /
`data/trivia.db-shm` files), then start it again. If you prefer a plain `cp`
instead of `.backup`, do it while the server is stopped so the WAL is fully
checkpointed.

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
