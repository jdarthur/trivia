package sessions

import "strconv"

//Error when you set the current question with a round index that is not hre current round index
type SetCurrentQuestionWithIncorrectRoundError struct {
	RoundIndex int
}
func (e SetCurrentQuestionWithIncorrectRoundError) Error() string {
	return "Round " + strconv.Itoa(e.RoundIndex) + " is not the current round"
}
func (e SetCurrentQuestionWithIncorrectRoundError) Field() string {
	return "round_id"
}
func (e SetCurrentQuestionWithIncorrectRoundError) Data() interface{} {
	return e.RoundIndex
}

//Error when you set the current question with a question index >= round.Questions.length
type InvalidQuestionIndexError struct {
	QuestionIndex int
}
func (e InvalidQuestionIndexError) Error() string {
	return "Question " + strconv.Itoa(e.QuestionIndex) + " is not a valid question"
}
func (e InvalidQuestionIndexError) Field() string {
	return "question_id"
}
func (e InvalidQuestionIndexError) Data() interface{} {
	return e.QuestionIndex
}

//Error when you set the current round with a round index >= session.Rounds.length
type InvalidRoundIndexError struct {
	RoundIndex int
}
func (e InvalidRoundIndexError) Error() string {
	return "Round " + strconv.Itoa(e.RoundIndex) + " is not a valid round"
}
func (e InvalidRoundIndexError) Field() string {
	return "round_id"
}
func (e InvalidRoundIndexError) Data() interface{} {
	return e.RoundIndex
}
