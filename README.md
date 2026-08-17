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

The client proxies `/editor`, `/gameplay` and `/images` through to the API:

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

## Checks

CI runs on every pull request. To run the same checks locally:

```sh
cd server/go/src && go build ./... && go vet ./... && go test ./...
cd client && npm ci && npm run build && npm audit
```
