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
	"log"
	"os"
)

func main() {

	client, err := common.GetDatabaseConnection()

	err = common.LoadCerts()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%+v\n", common.JwtKeys)

	imageDir := os.Getenv("IMAGE_DIR")
	if len(imageDir) == 0 {
		imageDir = "images"
	}
	_ = os.Mkdir(imageDir, os.ModeDir)

	router := gin.Default()
	router.Static("/images", imageDir)

	auth := common.Env{Db: client}

	fmt.Println("\nQuestions API:")
	q := questions.Env{Db: client}
	router.GET("/editor/questions", auth.AsUser, q.GetAllQuestions)
	router.GET("/editor/question/:id", auth.AsUser, q.GetOneQuestion)
	router.POST("/editor/question", auth.AsUser, q.CreateQuestion)
	router.PUT("/editor/question/:id", auth.AsUser, q.UpdateQuestion)
	router.DELETE("/editor/question/:id", auth.AsUser, q.DeleteQuestion)
	router.POST("/editor/file", q.UploadFile)

	fmt.Println("\nRounds API:")
	r := rounds.Env{Db: client}
	router.GET("/editor/rounds", auth.AsUser, r.GetAllRounds)
	router.GET("/editor/round/:id", auth.AsUser, r.GetOneRound)
	router.POST("/editor/round", auth.AsUser, r.CreateRound)
	router.PUT("/editor/round/:id", auth.AsUser, r.UpdateRound)
	router.DELETE("/editor/round/:id", auth.AsUser, r.DeleteRound)

	fmt.Println("\nGames API:")
	g := games.Env{Db: client}
	router.GET("/editor/games", auth.AsUser, g.GetAllGames)
	router.GET("/editor/game/:id", auth.AsUser, g.GetOneGame)
	router.POST("/editor/game", auth.AsUser, g.CreateGame)
	router.PUT("/editor/game/:id", auth.AsUser, g.UpdateGame)
	router.DELETE("/editor/game/:id", auth.AsUser, g.DeleteGame)

	fmt.Println("\nSession API:")
	s := sessions.Env{Db: client}
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
	p := players.Env{Db: client}
	router.GET("/gameplay/player/:id", p.GetOnePlayer)
	router.POST("/gameplay/player", p.CreatePlayer)
	router.PUT("/gameplay/player/:id", p.UpdatePlayer)
	router.POST("/gameplay/session/:id/add", p.AddPlayerToSession)
	router.POST("/gameplay/session/:id/remove", p.RemovePlayerFromSession)
	router.DELETE("/gameplay/player/:id", p.DeletePlayer)

	fmt.Println("\nCollection API:")
	coll := collections.Env{Db: client}
	router.GET("/editor/collections", auth.AsUser, coll.GetAllCollections)
	router.GET("/editor/collections/:id", auth.AsUser, coll.GetOneCollection)
	router.POST("/editor/collections", auth.AsUser, coll.CreateCollection)
	router.DELETE("/editor/collections/:id", auth.AsUser, coll.DeleteCollection)
	router.POST("/editor/collections/:id/import", auth.AsUser, coll.ImportCollection)

	router.GET("/editor/scoring_notes", auth.AsUser, q.GetAllScoringNotes)
	router.GET("/editor/scoring_notes/:id", auth.AsUser, q.GetOneScoringNote)
	router.POST("/editor/scoring_notes", auth.AsUser, q.CreateScoringNote)
	router.DELETE("/editor/scoring_notes/:id", auth.AsUser, q.DeleteScoringNote)

	fmt.Println()
	router.Run()
}
