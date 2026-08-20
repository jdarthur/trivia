package store

import (
	"database/sql"
	"fmt"
	"time"
)

// MockUsers are the users seeded into the dev-mode database so the editor can
// be exercised without an Auth0 tenant. Their `sub`s are the `dev|<username>`
// identifiers the client embeds in its unsigned mock JWTs.
var MockUsers = []MockUser{
	{Sub: "dev|alice", Username: "alice", DisplayName: "Alice"},
	{Sub: "dev|bob", Username: "bob", DisplayName: "Bob"},
	{Sub: "dev|carol", Username: "carol", DisplayName: "Carol"},
	{Sub: "dev|dave", Username: "dave", DisplayName: "Dave"},
}

// MockUser is one dev-mode identity.
type MockUser struct {
	Sub         string
	Username    string
	DisplayName string
}

// SeedUsers idempotently inserts the dev-mode mock users. Re-running it (e.g.
// on a restart against an already-seeded scratch database) is a no-op.
func SeedUsers(db *sql.DB) error {
	stmt, err := db.Prepare(`INSERT INTO user (sub, username, display_name, create_date, avatar_url)
		VALUES (?, ?, ?, ?, '')
		ON CONFLICT(sub) DO NOTHING`)
	if err != nil {
		return fmt.Errorf("prepare seed user: %w", err)
	}
	defer stmt.Close()

	for _, u := range MockUsers {
		createDate := time.Now().Format("2006-01-02T15:04:05.000000")
		if _, err := stmt.Exec(u.Sub, u.Username, u.DisplayName, createDate); err != nil {
			return fmt.Errorf("seed user %s: %w", u.Sub, err)
		}
	}
	return nil
}
