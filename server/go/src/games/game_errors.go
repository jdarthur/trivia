package games

import (
	"models"
	"strconv"
)

//Error when you pass a RoundNames: {...} with a different key length than Rounds: [...]
type InvalidRoundNameLengthError struct {
	RoundNameLength    int
	RoundsLength int
}
func (e InvalidRoundNameLengthError) Error() string {
	return "RoundNames length (" + strconv.Itoa(e.RoundNameLength) + ") is different than Rounds length (" + strconv.Itoa(e.RoundsLength) + ")"
}
func (e InvalidRoundNameLengthError) Field() string {
	return models.RoundNames
}
func (e InvalidRoundNameLengthError) Data() interface{} {
	return e.RoundNameLength
}

//Error when you pass a RoundNames: {...} that doesn't have all roundIds in Rounds [...]
type InvalidRoundNamesError struct {
	RoundId    string
}
func (e InvalidRoundNamesError) Error() string {
	return "Missing round ID " + e.RoundId + " in round names"
}
func (e InvalidRoundNamesError) Field() string {
	return models.RoundNames
}
func (e InvalidRoundNamesError) Data() interface{} {
	return e.RoundId
}


//Error when you pass the same roundId multiple times in Rounds: [...]
type DuplicateRoundIdError struct {
	RoundId string
}
func (e DuplicateRoundIdError) Error() string {
	return "Duplicate roundId: " + e.RoundId
}
func (e DuplicateRoundIdError) Field() string {
	return models.Rounds
}
func (e DuplicateRoundIdError) Data() interface{} {
	return e.RoundId
}


//Error when you pass an invalid RoundId inside of Rounds: [...]
type InvalidRoundIdError struct {
	RoundId string
}
func (e InvalidRoundIdError) Error() string {
	return "Round ID '" + e.RoundId + "' is invalid"
}
func (e InvalidRoundIdError) Field() string {
	return models.Rounds
}
func (e InvalidRoundIdError) Data() interface{} {
	return e.RoundId
}