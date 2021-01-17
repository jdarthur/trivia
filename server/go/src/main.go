package main

import (
	"fmt"
	"games"
	"github.com/gin-gonic/gin"
	"github.com/globalsign/mgo"
	"github.com/joho/godotenv"
	"log"
	"os"
	"questions"
	"rounds"
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


	client, err := mgo.Dial("mongodb://" + mongoHost + ":" + mongoPort)
	if err != nil {
		fmt.Println("Unable to connect to mongodb")
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

	fmt.Println()
	router.Run()
}
