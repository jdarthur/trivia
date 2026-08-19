package main

import (
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
	"os"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		fmt.Println("Unable to load .env")
	}

	db, err := store.OpenDefault()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err = store.Migrate(db); err != nil {
		log.Fatal(err)
	}

	err = common.LoadCerts()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("loaded %d Auth0 signing key(s)\n", len(common.JwtKeys.Keys))

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
	router.Run()
}
