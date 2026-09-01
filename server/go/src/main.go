package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jdarthur/trivia/collections"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/games"
	"github.com/jdarthur/trivia/players"
	"github.com/jdarthur/trivia/questions"
	"github.com/jdarthur/trivia/rounds"
	"github.com/jdarthur/trivia/sessions"
	"github.com/jdarthur/trivia/store"
	"github.com/joho/godotenv"
	"log"
	"net"
	"os"
)

func main() {

	// Dev mode must be enabled explicitly with --dev-mode. It runs against a
	// transient SQLite database, seeds mock users, skips the Auth0 JWKS fetch
	// (which hard-fails offline), and accepts unsigned mock JWTs. It is never
	// turned on silently via the environment.
	devMode := flag.Bool("dev-mode", false, "run against a transient SQLite DB with seeded mock users and no Auth0 verification")
	addr := flag.String("addr", ":8080", "address to listen on (host:port), e.g. 127.0.0.1:8080")
	tlsCert := flag.String("tls-cert", "", "path to an x509 TLS certificate file (PEM). When set, the server listens on HTTPS and --tls-key must also be set")
	tlsKey := flag.String("tls-key", "", "path to the TLS private key file (PEM) matching --tls-cert. When set, --tls-cert must also be set")
	flag.Parse()

	tlsOpts := tlsOptions{certFile: *tlsCert, keyFile: *tlsKey}
	if err := tlsOpts.validate(); err != nil {
		log.Fatalf("invalid TLS configuration: %v", err)
	}

	// Dev mode disables Auth0 and accepts unsigned mock JWTs, so it must never
	// be exposed beyond the loopback interface. Refuse to start rather than
	// silently serving unauthenticated editor endpoints to the network.
	if *devMode && !listenOnLoopback(*addr) {
		log.Fatalf("refusing to enable --dev-mode: it disables Auth0 verification and accepts unsigned mock JWTs, so it may only listen on the loopback interface (127.0.0.1, localhost, or ::1); got %q. Bind to a loopback address (e.g. --addr 127.0.0.1:8080).", *addr)
	}

	err := godotenv.Load()
	if err != nil {
		fmt.Println("Unable to load .env")
	}

	// Dev mode uses a scratch database file, distinct from the standard one.
	var dbPath = store.DBPath()
	if *devMode {
		dbPath = store.DefaultDevDBPath
	}
	db, err := store.Open(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err = store.Migrate(db); err != nil {
		log.Fatal(err)
	}

	if *devMode {
		common.DevMode = true
		fmt.Println("\nWARNING: running in dev mode, Auth0 verification disabled")
		fmt.Printf("dev database: %s (scratch file, safe to delete)\n", dbPath)
		if err = store.SeedUsers(db); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("seeded %d mock user(s)\n", len(store.MockUsers))
	} else {
		err = common.LoadCerts()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Printf("loaded %d Auth0 signing key(s)\n", len(common.JwtKeys.Keys))
	}

	imageDir := os.Getenv("IMAGE_DIR")
	if len(imageDir) == 0 {
		imageDir = "images"
	}
	_ = os.Mkdir(imageDir, os.ModeDir)

	router := gin.Default()
	router.Static("/images", imageDir)

	auth := common.Env{Db: db}

	fmt.Println("\nQuestions API:")
	q := questions.Env{Db: db}
	router.GET("/editor/questions", auth.AsUser, q.GetAllQuestions)
	router.GET("/editor/question/:id", auth.AsUser, q.GetOneQuestion)
	router.POST("/editor/question", auth.AsUser, q.CreateQuestion)
	router.PUT("/editor/question/:id", auth.AsUser, q.UpdateQuestion)
	router.DELETE("/editor/question/:id", auth.AsUser, q.DeleteQuestion)
	router.POST("/editor/file", q.UploadFile)

	fmt.Println("\nRounds API:")
	r := rounds.Env{Db: db}
	router.GET("/editor/rounds", auth.AsUser, r.GetAllRounds)
	router.GET("/editor/round/:id", auth.AsUser, r.GetOneRound)
	router.POST("/editor/round", auth.AsUser, r.CreateRound)
	router.PUT("/editor/round/:id", auth.AsUser, r.UpdateRound)
	router.DELETE("/editor/round/:id", auth.AsUser, r.DeleteRound)

	fmt.Println("\nGames API:")
	g := games.Env{Db: db}
	router.GET("/editor/games", auth.AsUser, g.GetAllGames)
	router.GET("/editor/game/:id", auth.AsUser, g.GetOneGame)
	router.POST("/editor/game", auth.AsUser, g.CreateGame)
	router.PUT("/editor/game/:id", auth.AsUser, g.UpdateGame)
	router.DELETE("/editor/game/:id", auth.AsUser, g.DeleteGame)

	fmt.Println("\nSession API:")
	s := sessions.Env{Db: db}
	//router.GET("/gameplay/sessions",s.GetAllSessions)
	router.GET("/gameplay/session/:id", s.GetOneSession)
	router.GET("/gameplay/session/:id/scoreboard", s.GetSessionScoreboard)
	router.GET("/gameplay/session/:id/score-history", s.GetSessionScoreHistory)
	router.POST("/gameplay/session", s.CreateSession)
	router.PUT("/gameplay/session/:id", s.UpdateSession)
	router.DELETE("/gameplay/session/:id", s.DeleteSession)
	router.GET("/gameplay/session/:id/players", s.GetPlayersInSession)

	fmt.Println("\nAdministration API:")
	router.POST("/gameplay/session/:id/start", s.StartSession)
	router.PUT("/gameplay/session/:id/current-round", s.SetCurrentRound)
	router.GET("/gameplay/session/:id/current-round", s.GetCurrentRound)
	router.PUT("/gameplay/session/:id/current-question", s.SetCurrentQuestion)
	router.GET("/gameplay/session/:id/current-question", s.GetCurrentQuestion)
	router.PUT("/gameplay/session/:id/score", s.ScoreQuestion)
	router.GET("/gameplay/session/:id/wagers", s.GetWagers)
	router.GET("/gameplay/session/:id/state", s.GetSessionState)

	fmt.Println("\nAnswer API:")
	router.POST("/gameplay/session/:id/answer", s.AnswerQuestion)
	router.GET("/gameplay/session/:id/answers", s.GetAnswers)

	fmt.Println("\nReaction API:")
	router.PUT("/gameplay/session/:id/reaction", s.SetReaction)
	router.DELETE("/gameplay/session/:id/reaction", s.RemoveReaction)

	fmt.Println("\nHot-edit API:")
	router.PUT("/gameplay/session/:id/hot-edit-question", s.WithValidSession, s.AsMod, s.HotEditQuestion)
	router.PUT("/gameplay/session/:id/hot-edit-round-name", s.WithValidSession, s.AsMod, s.HotEditRoundName)

	fmt.Println("\nPlayer API:")
	p := players.Env{Db: db}
	router.GET("/gameplay/player/:id", p.GetOnePlayer)
	router.POST("/gameplay/player", p.CreatePlayer)
	router.PUT("/gameplay/player/:id", p.UpdatePlayer)
	router.POST("/gameplay/session/:id/add", p.AddPlayerToSession)
	router.POST("/gameplay/session/:id/remove", p.RemovePlayerFromSession)
	router.POST("/gameplay/session/:id/leave", p.LeaveSession)
	router.POST("/gameplay/session/:id/inactivate", p.InactivatePlayer)
	router.DELETE("/gameplay/player/:id", p.DeletePlayer)

	fmt.Println("\nCollection API:")
	coll := collections.Env{Db: db}
	router.GET("/editor/collections", auth.AsUser, coll.GetAllCollections)
	router.GET("/editor/collections/:id", auth.AsUser, coll.GetOneCollection)
	router.POST("/editor/collections", auth.AsUser, coll.CreateCollection)
	router.DELETE("/editor/collections/:id", auth.AsUser, coll.DeleteCollection)
	router.POST("/editor/collections/:id/import", auth.AsUser, coll.ImportCollection)

	router.GET("/editor/scoring_notes", auth.AsUser, q.GetAllScoringNotes)
	router.GET("/editor/scoring_notes/:id", auth.AsUser, q.GetOneScoringNote)
	router.POST("/editor/scoring_notes", auth.AsUser, q.CreateScoringNote)
	router.DELETE("/editor/scoring_notes/:id", auth.AsUser, q.DeleteScoringNote)

	router.GET("/editor/categories", auth.AsUser, q.GetAllCategories)
	router.GET("/editor/category/:id", auth.AsUser, q.GetOneCategory)
	router.POST("/editor/category", auth.AsUser, q.CreateCategory)
	router.PUT("/editor/category/:id", auth.AsUser, q.UpdateCategory)
	router.DELETE("/editor/category/:id", auth.AsUser, q.DeleteCategory)

	// Registered last because it claims everything the routes above did not.
	// CLIENT_DIR is relative to the working directory, which is /go/src in the
	// image, and docker-compose mounts the client build there.
	clientDir := os.Getenv("CLIENT_DIR")
	if len(clientDir) == 0 {
		clientDir = "client"
	}
	fmt.Println()
	serveClient(router, clientDir)

	fmt.Println()
	if err := serve(router, *addr, tlsOpts); err != nil {
		log.Fatal(err)
	}
}

// listenOnLoopback reports whether addr binds to the loopback interface only.
// It is the guard for --dev-mode, which disables Auth0 verification and
// accepts unsigned mock JWTs and therefore must never be reachable off-box.
//
// addr is a Gin/Go listen address of the form "host:port" (e.g. ":8080",
// "127.0.0.1:8080", "[::1]:8080"). A missing host (":8080") means "all
// interfaces", which is NOT loopback; "localhost" and any loopback IP are.
func listenOnLoopback(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		// Not "host:port" (e.g. a bare port) — treat as non-loopback rather
		// than guessing and accidentally allowing a network exposure.
		return false
	}
	if host == "" {
		// ":8080" binds to all interfaces.
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// tlsOptions carries the optional x509 certificate and private key file paths
// used to serve HTTPS. An empty certFile means the server serves plain HTTP.
type tlsOptions struct {
	certFile string
	keyFile  string
}

// validate checks that the TLS options form a consistent, loadable pair.
// Either both files are empty (plain HTTP), or both are set and name existing,
// regular, readable files that parse as a matching x509 certificate + private
// key. A certificate without a key (or vice versa) is a configuration error.
func (o tlsOptions) validate() error {
	switch {
	case o.certFile == "" && o.keyFile == "":
		return nil
	case o.certFile == "":
		return fmt.Errorf("--tls-key is set but --tls-cert is not: a certificate is required to serve TLS")
	case o.keyFile == "":
		return fmt.Errorf("--tls-cert is set but --tls-key is not: a private key is required to serve TLS")
	}
	for _, f := range []struct {
		path string
		kind string
	}{
		{o.certFile, "certificate"},
		{o.keyFile, "key"},
	} {
		if err := checkTLSFile(f.path, f.kind); err != nil {
			return err
		}
	}
	if _, err := tls.LoadX509KeyPair(o.certFile, o.keyFile); err != nil {
		return fmt.Errorf("invalid TLS certificate/key pair: %w", err)
	}
	return nil
}

// checkTLSFile verifies that path names an existing, regular, readable file.
func checkTLSFile(path, kind string) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("TLS %s file %q does not exist", kind, path)
		}
		return fmt.Errorf("cannot access TLS %s file %q: %w", kind, path, err)
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("TLS %s path %q is not a regular file", kind, path)
	}
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("TLS %s file %q is not readable: %w", kind, path, err)
	}
	f.Close()
	return nil
}

// serve starts the Gin router on addr. If TLS options are set it serves HTTPS
// via RunTLS; otherwise it serves plain HTTP via Run.
func serve(router *gin.Engine, addr string, opts tlsOptions) error {
	if opts.certFile != "" {
		return router.RunTLS(addr, opts.certFile, opts.keyFile)
	}
	return router.Run(addr)
}
