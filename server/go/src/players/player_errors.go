package players

import (
	"fmt"
	"models"
)

var id = "player_id"
var adminId = "admin_id"

//Error when you try to add a player to a session that is already started
type SessionAlreadyStartedError struct {
	SessionId string
}

func (e SessionAlreadyStartedError) Error() string {
	return "Session " + e.SessionId + " is already started"
}
func (e SessionAlreadyStartedError) Field() string {
	return "session_id"
}
func (e SessionAlreadyStartedError) Data() interface{} {
	return e.SessionId
}



//Error when you try to add a player to a session that the player is already in
type AlreadyInSessionError struct {
	SessionId string
	PlayerId  models.PlayerId
}

func (e AlreadyInSessionError) Error() string {
	return fmt.Sprintf("Player %v is already in session %v", e.PlayerId, e.SessionId)
}
func (e AlreadyInSessionError) Field() string {
	return id
}
func (e AlreadyInSessionError) Data() interface{} {
	return e.PlayerId
}



//Error when you try to add an invalid player ID to a session
type InvalidPlayerIdError struct {
	PlayerId  models.PlayerId
}

func (e InvalidPlayerIdError) Error() string {
	return fmt.Sprintf("%v is not a valid player ID", e.PlayerId)
}
func (e InvalidPlayerIdError) Field() string {
	return id
}
func (e InvalidPlayerIdError) Data() interface{} {
	return e.PlayerId
}
