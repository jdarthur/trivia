// Command migrate imports the legacy MongoDB database into the SQLite store.
//
// It is the one-off companion to the engine swap (ticket #75): existing
// questions/rounds/games/sessions live in Mongo and must survive the move to
// SQLite. Run it once against the old database before switching the server
// over; see the README section "Migrating from MongoDB".
//
// Usage:
//
//	cd server/go/src
//	go run ./cmd/migrate
//
// The Mongo connection comes from MONGO_HOST / MONGO_PORT (defaults
// localhost:27017), and the database name from MONGO_DB (default trivia) —
// the same variables the mgo-era server used. The SQLite database is written
// at DB_PATH (default ./data/trivia.db). The command refuses to run against
// a non-empty SQLite database — no silent merge — so point it at a fresh
// database (or delete data/trivia.db first).
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jdarthur/trivia/migrate"
	"github.com/jdarthur/trivia/store"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func main() {
	// server/go/src/.env may hold MONGO_HOST / MONGO_PORT / DB_PATH; loading
	// it is optional, exactly as the server does.
	if err := godotenv.Load(); err != nil {
		fmt.Println("Unable to load .env")
	}

	host := envOr("MONGO_HOST", "localhost")
	port := envOr("MONGO_PORT", "27017")
	dbName := envOr("MONGO_DB", "trivia")
	uri := "mongodb://" + host + ":" + port

	// Short timeout for the connection check only; the import itself uses an
	// unbounded context so large databases can take as long as they need.
	pingCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("connect to Mongo at %s: %v", uri, err)
	}
	defer client.Disconnect(context.Background()) //nolint:errcheck // process is exiting anyway

	if err := client.Ping(pingCtx, nil); err != nil {
		log.Fatalf("Mongo at %s is not reachable: %v", uri, err)
	}
	src := client.Database(dbName)

	db, err := store.OpenDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := store.Migrate(db); err != nil {
		log.Fatalf("migrate SQLite schema: %v", err)
	}

	if err := migrate.CheckEmpty(db); err != nil {
		log.Fatalf("refusing to import: %v", err)
	}

	fmt.Printf("importing MongoDB database %q at %s into %s\n", dbName, uri, store.DBPath())
	summary, err := migrate.Import(context.Background(), db, src)
	if err != nil {
		log.Fatalf("import failed (rolled back): %v", err)
	}

	fmt.Println(summary)
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
