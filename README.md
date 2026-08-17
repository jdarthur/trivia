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
| Database | MongoDB |
| Auth | Auth0 (editor endpoints only — gameplay is anonymous) |

## Layout

```
client/          React app
server/go/src/   Go API server
  common/          auth middleware, DB helpers, shared errors
  models/          data models
  questions/ rounds/ games/ collections/    editor endpoints
  sessions/ players/                        gameplay endpoints
archive/         past games, kept for reference
```

## Running it

The server needs a MongoDB to talk to. `server/go/src/docker-compose.yml` will
start one:

```sh
cd server/go/src
docker compose up -d mongo
```

> **Note:** the database driver is `globalsign/mgo`, a 2018 fork that cannot
> complete server selection against MongoDB 6.0 or newer. Pin the image to
> `mongo:5.0` until the driver is replaced.

Then the API, which listens on `:8080`:

```sh
cd server/go/src
go run .
```

It reads `MONGO_HOST` and `MONGO_PORT` from `server/go/src/.env` (both default
to `localhost:27017`) and `IMAGE_DIR` for uploaded question images, which
defaults to `images` relative to the working directory.

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

## Checks

CI runs on every pull request. To run the same checks locally:

```sh
cd server/go/src && go build ./... && go vet ./... && go test ./...
cd client && npm ci && npm run build && npm audit
```
