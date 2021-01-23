package sessions

import (
	"models"
)

//Error when trying to create/start a session which is composed of an empty game
type GameWithoutRoundsError struct {
	GameId string
}

func (e GameWithoutRoundsError) Error() string {
	return "Game " + e.GameId + " cannot be used for a session because it does not have any rounds"
}
func (e GameWithoutRoundsError) Field() string {
	return models.GameId
}
func (e GameWithoutRoundsError) Data() interface{} {
	return e.GameId
}


//Error when trying to create/start a game which contains an empty round
type RoundWithoutQuestionsError struct {
	GameId string
	RoundId string
}

func (e RoundWithoutQuestionsError) Error() string {
	return "Game " + e.GameId + " cannot be used for a session because it contains round " + e.RoundId + " which has no questions"
}
func (e RoundWithoutQuestionsError) Field() string {
	return models.GameId
}
func (e RoundWithoutQuestionsError) Data() interface{} {
	return e.GameId
}


//Error when trying to create/start a session with a game ID that is not valid
type InvalidGameIdError struct {
	GameId string
}
func (e InvalidGameIdError) Error() string {
	return e.GameId + " is not a valid game ID"
}
func (e InvalidGameIdError) Field() string {
	return models.GameId
}
func (e InvalidGameIdError) Data() interface{} {
	return e.GameId
}


//Error when trying to create/start a session with a round ID in the game that is not valid
type InvalidRoundIdInGameError struct {
	GameId string
	RoundId string
}
func (e InvalidRoundIdInGameError) Error() string {
	return "Round " + e.RoundId + " in game " + e.GameId + "is not a valid round ID"
}
func (e InvalidRoundIdInGameError) Field() string {
	return models.GameId
}
func (e InvalidRoundIdInGameError) Data() interface{} {
	return e.RoundId
}


//Error when trying to do some action in a session without the proper moderator ID
type UnauthorizedSessionActionError struct {
	SessionId string
	ModeratorId string
}
func (e UnauthorizedSessionActionError) Error() string {
	return "Forbidden: ID '" + e.ModeratorId + "' is not the moderator of session " + e.SessionId
}
func (e UnauthorizedSessionActionError) Field() string {
	return models.ModeratorId
}
func (e UnauthorizedSessionActionError) Data() interface{} {
	return e.ModeratorId
}

//Error when trying to start a session that is already started
type SessionAlreadyStartedError struct {
	SessionId string
}
func (e SessionAlreadyStartedError) Error() string {
	return "Session " + e.SessionId + " is already started"
}
func (e SessionAlreadyStartedError) Field() string {
	return "id"
}
func (e SessionAlreadyStartedError) Data() interface{} {
	return e.SessionId
}
