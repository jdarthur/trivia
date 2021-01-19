package players

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
	PlayerId  string
}

func (e AlreadyInSessionError) Error() string {
	return "Player " + e.PlayerId + " is already in session " + e.SessionId
}
func (e AlreadyInSessionError) Field() string {
	return id
}
func (e AlreadyInSessionError) Data() interface{} {
	return e.PlayerId
}



//Error when you try to add an invalid player ID to a session
type InvalidPlayerIdError struct {
	PlayerId  string
}

func (e InvalidPlayerIdError) Error() string {
	return e.PlayerId + " is not a valid player ID"
}
func (e InvalidPlayerIdError) Field() string {
	return id
}
func (e InvalidPlayerIdError) Data() interface{} {
	return e.PlayerId
}



//Error when you try to remove a player from a session, but don't pass the correct mod ID for the session
type UnauthorizedRemoveError struct {
	AdminId  string
}

func (e UnauthorizedRemoveError) Error() string {
	return e.AdminId + " is not the moderator of this session, cannot remove a player"
}
func (e UnauthorizedRemoveError) Field() string {
	return adminId
}
func (e UnauthorizedRemoveError) Data() interface{} {
	return e.AdminId
}
