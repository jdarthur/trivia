# AGENTS.md

Full-stack trivia web app — multi-user, anonymous, responsive. An editor side
for writing questions, grouping them into rounds and assembling rounds into
games, and a gameplay side where a host runs a live session and players answer
from their own devices. React client + Go/Gin API. Work in progress — see
`client/features.md` and `client/trivia.md` for the intended feature surface.

## Project
- Server: Go + [Gin](https://github.com/gin-gonic/gin) REST API in
  `server/go/src/`; entry point `main.go` (route wiring per domain package).
- Client: React / Ant Design / Redux Toolkit / React Router, built with Vite,
  in `client/`; proxies `/editor`, `/gameplay`, `/images` to the API.
- Auth: Auth0 (editor endpoints only — gameplay is anonymous). JWT signing keys
  loaded from cert files by `common.LoadCerts()`.
- Storage: SQLite via `store/` (`modernc.org/sqlite`, pure Go, no CGO).
  Connection from `DB_PATH` (default `data/trivia.db`); schema migrations are
  applied on startup. All handlers read/write through the `store` connection
  via the `common` helpers over `*sql.DB`. Old MongoDB data can be imported
  once with `cmd/migrate` (see README "Migrating from MongoDB").
- Deployment: the API serves the built client itself (`CLIENT_DIR`, default
  `client`); no proxy in front. Missing `index.html` → API-only mode. Deep links
  fall back to `index.html` (see `static.go`).
- Docs: `README.md` (run/deploy), `client/features.md` + `client/trivia.md`
  (intended behavior), `archive/` (past games, reference only).

## Commands
There is no Makefile; CI (`.github/workflows/ci.yml`) is the source of truth
for checks.
```sh
cd server/go/src && go build ./...          # build
cd server/go/src && go vet ./...            # vet
cd server/go/src && go test ./...           # tests (temp-file SQLite, no external service)
cd server/go/src && go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...   # CI only

cd client && npm ci && npm run build        # client build
cd client && npm audit                      # strict: any finding blocks CI
```
Local dev (two servers):
```sh
cd server/go/src && go run .                      # API on :8080
cd client && npm install
cd client && PORT=3000 npm start                  # Vite dev server (default 443 needs privileges)
```
`npm start` serves over HTTPS using the self-signed cert in `client/cert/`;
it falls back to HTTP if the cert is missing (fresh clone). Client config in
`client/.env`: `REACT_APP_EDITOR_HOST/PORT`, `REACT_APP_GAMEPLAY_HOST/PORT`.

Verify: `cd server/go/src && go build ./...` succeeds.

## Verification for UI changes
- The client has no unit tests. A UI change is "done" when `npm run build`
  passes and `npm audit` is clean — CI treats `npm audit` as a **blocking** step
  (no `--audit-level`, so even a low in a dev-only transitive dependency blocks
  the merge; see the CI workflow comment).
- Server changes must pass `go build ./... && go vet ./... && go test ./...`.
  The integration tests in `test/` run against a temp-file SQLite DB with no
  external service.

## Architecture
- `server/go/src/` — Go/Gin. `main.go` wires routes per domain.
  - `common/` — `Env{Db *sql.DB}` passed into each domain's handlers;
    DB helpers (`GetOne`/`GetAll`/`Create`/`Set`/`Push`/`Pull`/`Delete`),
    shared error types (`InvalidDataError`, `NonexistentIdError`,
    `InvalidUUIDError`, token errors), `Respond` (error→HTTP mapping), Auth0
    middleware (`AsUser`).
  - `models/` — data structs implementing the `models.Object` interface
    (questions, rounds, games, sessions, players, answers, collections,
    scoring notes, scoreboard).
  - `questions/ rounds/ games/ collections/ sessions/ players/` — one package
    per domain: handlers + a `X_errors.go` with domain-specific errors.
  - `store/` — SQLite connection, pragmas, and schema migrations; used by all
    handlers.
  - `static.go` — serves the built client; `test/` — SQLite-backed integration
    tests.
- `client/src/` — feature folders: `editor/` (questions/rounds/games),
  `game/` (gameplay), `lobby/`, `players/`, `scoreboard/`, `admin-scorer/`,
  `control/`, `answer/`, `question/`, `round/`, `collections/`, `homepage/`,
  `active/`, `modal/`, plus `api/` (fetch layer) and `common/`.
- `images/` and `server/go/src/images/` — uploaded question media (`IMAGE_DIR`).

## Conventions
- **One domain per package** on the server (`questions/`, `rounds/`, …), models
  in `models/`, domain errors in `X_errors.go` beside the handlers.
- **DB access through `common` helpers**, not raw SQL: handlers hold an
  `Env{Db}` and call `common.GetOne`/`common.GetAll`/`common.Create`/
  `common.Set`/`common.Push`/`common.Pull`/`common.Delete`.
- **Respond via `common.Respond(c, data, err)`** — it maps shared error types
  to HTTP statuses; don't hand-roll error JSON.
- IDs are UUID strings (`models.NewId`); `NonexistentIdError`
  for missing records.
- Authz split: editor endpoints behind `auth.AsUser` (Auth0); gameplay/session
  endpoints are anonymous.
- The SQLite port is complete — new code uses `store` + the `common` helpers
  over `*sql.DB`; there is no mgo/Mongo dependency anymore.
- Tests: `_test.go` beside the code; SQLite-backed integration tests in `test/`.
- Don't commit secrets; `client/cert/` is the self-signed local HTTPS keypair.

## Notes
- Tickets/issues are tracked **upstream on GitHub** (`jdarthur/trivia`).
- All changes must land on **`master`** (the default branch) **through a pull
  request** — no direct pushes to `master`.
- **Always create a PR when marking a work item complete.** Do not mark a work
  item (ticket, task, or checklist item) as finished until the change has been
  opened as a pull request via `gh pr create`. A merged PR is what actually
  completes the work; an un-merged local branch is not "done". Always provide a
  link to the upstream PR if you create one, and always put "Closes #XYZ" in
  the PR body in order to auto-link to the related ticket on PR merge. This
  only applies if the current task is scoped from a GitHub ticket.
- `gh` CLI (v2.97.0) is available and authorized for read/write against
  `origin` (`git@github.com:jdarthur/trivia.git`) — use it for issue/PR
  workflows. Existing topic branches follow `jarthur/<topic>`.
