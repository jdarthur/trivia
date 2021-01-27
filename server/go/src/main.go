package main

import (
	"fmt"
	"games"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo"
	"github.com/joho/godotenv"
	"log"
	"os"
	"players"
	"questions"
	"rounds"
	"sessions"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		fmt.Println("Unable to load .env")
		log.Fatal(err)
	}

	mongoHost := os.Getenv("MONGO_HOST")
	if len(mongoHost) == 0 {
		mongoHost = "localhost"
	}

	mongoPort := os.Getenv("MONGO_PORT")
	if len(mongoPort) == 0 {
		mongoPort = "27017"
	}


	mongoAddress := "mongodb://" + mongoHost + ":" + mongoPort
	client, err := mgo.Dial(mongoAddress)
	if err != nil {
		fmt.Println("Unable to connect to mongodb server at " + mongoAddress)
		log.Fatal(err)
	}

	router := gin.Default()

	fmt.Println("\nQuestions API:")
	q := questions.Env{Db: client}
	router.GET("/editor/questions", q.GetAllQuestions)
	router.GET("/editor/question/:id", q.GetOneQuestion)
	router.POST("/editor/question", q.CreateQuestion)
	router.PUT("/editor/question/:id", q.UpdateQuestion)
	router.DELETE("/editor/question/:id", q.DeleteQuestion)

	fmt.Println("\nRounds API:")
	r := rounds.Env{Db: client}
	router.GET("/editor/rounds", r.GetAllRounds)
	router.GET("/editor/round/:id", r.GetOneRound)
	router.POST("/editor/round", r.CreateRound)
	router.PUT("/editor/round/:id", r.UpdateRound)
	router.DELETE("/editor/round/:id", r.DeleteRound)

	fmt.Println("\nGames API:")
	g := games.Env{Db: client}
	router.GET("/editor/games", g.GetAllGames)
	router.GET("/editor/game/:id", g.GetOneGame)
	router.POST("/editor/game", g.CreateGame)
	router.PUT("/editor/game/:id", g.UpdateGame)
	router.DELETE("/editor/game/:id", g.DeleteGame)

	fmt.Println("\nSession API:")
	s := sessions.Env{Db: client}
	//router.GET("/gameplay/sessions",s.GetAllSessions)
	router.GET("/gameplay/session/:id",s.GetOneSession)
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

	fmt.Println("\nPlayer API:")
	p := players.Env{Db: client}
	router.GET("/gameplay/player/:id", p.GetOnePlayer)
	router.POST("/gameplay/player", p.CreatePlayer)
	router.PUT("/gameplay/player/:id", p.UpdatePlayer)
	router.POST("/gameplay/session/:id/add", p.AddPlayerToSession)
	router.POST("/gameplay/session/:id/remove", p.RemovePlayerFromSession)
	router.DELETE("/gameplay/player/:id", p.DeletePlayer)

	fmt.Println()
	router.Run()
}
