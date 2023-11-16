package test

import (
	"github.com/globalsign/mgo"
	"github.com/jdarthur/trivia/common"
)

func GetDb() *mgo.Session {

	dbClient, err := common.GetDatabaseConnection()
	if err != nil {
		panic(err)
	}

	return dbClient
}
