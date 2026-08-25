package sessions

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jdarthur/trivia/common"
	"github.com/jdarthur/trivia/models"
)

// ReactionRequest is the body for creating/updating or removing a reaction.
// Emoji is validated by the handlers: must be a single emoji on set, ignored
// on remove.
type ReactionRequest struct {
	AnswerId string          `json:"answer_id" binding:"required"`
	PlayerId models.PlayerId `json:"player_id" binding:"required"`
	Emoji    string          `json:"emoji"`
}

// SetReaction creates or updates one player's reaction on one answer (PUT).
// Because answer_reaction has a UNIQUE(answer_id, player_id) constraint, a
// second reaction from the same player on the same answer updates the emoji
// in place instead of inserting a duplicate — this is the "modify" half of
// add/remove/modify. Reactions are only allowed once the admin has scored the
// question.
func (e *Env) SetReaction(c *gin.Context) {
	sessionId := c.Param("id")

	var req ReactionRequest
	if err := c.ShouldBind(&req); err != nil {
		common.Respond(c, nil, err)
		return
	}
	req.Emoji = strings.TrimSpace(req.Emoji)
	if !isSingleEmoji(req.Emoji) {
		common.Respond(c, nil, InvalidEmojiError{Emoji: req.Emoji})
		return
	}

	answer, err := answerInSession(e, sessionId, req.AnswerId)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if !playerInSession(e, sessionId, req.PlayerId) {
		common.Respond(c, nil, PlayerNotInSessionError{PlayerId: req.PlayerId, SessionId: sessionId})
		return
	}
	active, err := playerIsActive(e, sessionId, req.PlayerId)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	if !active {
		common.Respond(c, nil, PlayerInactiveError{PlayerId: req.PlayerId, SessionId: sessionId})
		return
	}

	snapshot, err := sessionQuestionSnapshot(e, sessionId, answer.RoundIndex, answer.QuestionIndex)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	if !snapshot.Scored {
		common.Respond(c, nil, QuestionNotScoredError{QuestionIndex: answer.QuestionIndex, RoundIndex: answer.RoundIndex})
		return
	}

	now := time.Now()
	_, err = e.Db.Exec(`INSERT INTO answer_reaction (id, create_date, answer_id, player_id, emoji)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(answer_id, player_id) DO UPDATE SET emoji = excluded.emoji`,
		uuid.New().String(), common.FormatTime(now), answer.ID, string(req.PlayerId), req.Emoji)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	if err := common.IncrementState((*common.Env)(e), sessionId); err != nil {
		common.Respond(c, nil, err)
		return
	}

	reaction, err := getReaction(e, answer.ID, req.PlayerId)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	common.Respond(c, reaction, nil)
}

// RemoveReaction deletes a player's reaction on one answer (DELETE). Only the
// owner can remove their own reaction: the delete targets the (answer_id,
// player_id) row the caller names, and the answer must belong to this session
// so a caller cannot touch reactions on another session's answers by guessing
// IDs.
func (e *Env) RemoveReaction(c *gin.Context) {
	sessionId := c.Param("id")

	var req ReactionRequest
	if err := c.ShouldBind(&req); err != nil {
		common.Respond(c, nil, err)
		return
	}

	if _, err := answerInSession(e, sessionId, req.AnswerId); err != nil {
		common.Respond(c, nil, err)
		return
	}

	res, err := e.Db.Exec(`DELETE FROM answer_reaction WHERE answer_id = ? AND player_id = ?`,
		req.AnswerId, string(req.PlayerId))
	if err != nil {
		common.Respond(c, nil, err)
		return
	}
	if n, err := res.RowsAffected(); err != nil {
		common.Respond(c, nil, err)
		return
	} else if n == 0 {
		common.Respond(c, nil, ReactionNotFoundError{AnswerId: req.AnswerId, PlayerId: req.PlayerId})
		return
	}

	if err := common.IncrementState((*common.Env)(e), sessionId); err != nil {
		common.Respond(c, nil, err)
		return
	}

	common.Respond(c, nil, nil)
}

// answerRow is the subset of the answer table the reactions handlers need.
type answerRow struct {
	ID            string
	SessionId     string
	RoundIndex    int
	QuestionIndex int
}

// answerInSession fetches the answer by ID and verifies it belongs to the
// session, so reactions can only target answers in the session they are
// addressed to.
func answerInSession(e *Env, sessionId string, answerId string) (answerRow, error) {
	var row answerRow
	err := e.Db.QueryRow(`SELECT id, session_id, round_index, question_index
		FROM answer WHERE id = ?`, answerId).
		Scan(&row.ID, &row.SessionId, &row.RoundIndex, &row.QuestionIndex)
	if errors.Is(err, sql.ErrNoRows) {
		return row, InvalidAnswerIdError{AnswerId: answerId, SessionId: sessionId}
	}
	if err != nil {
		return row, err
	}
	if row.SessionId != sessionId {
		return row, InvalidAnswerIdError{AnswerId: answerId, SessionId: sessionId}
	}
	return row, nil
}

// getReaction reads back one player's reaction row on an answer.
func getReaction(e *Env, answerId string, playerId models.PlayerId) (models.AnswerReaction, error) {
	var m models.AnswerReaction
	var createDate string
	var scannedPlayerId string
	err := e.Db.QueryRow(`SELECT id, create_date, answer_id, player_id, emoji
		FROM answer_reaction WHERE answer_id = ? AND player_id = ?`,
		answerId, string(playerId)).
		Scan(&m.ID, &createDate, &m.AnswerId, &scannedPlayerId, &m.Emoji)
	if err != nil {
		return m, err
	}
	m.CreateDate = common.ParseTime(createDate)
	m.PlayerId = models.PlayerId(scannedPlayerId)
	return m, nil
}

// reactionsByAnswer is the aggregated reaction state of one answer: emoji
// counts plus the caller's own reaction.
type reactionsByAnswer struct {
	counts     map[string]int
	myReaction string
}

// reactionsForQuestion loads every reaction on the question's answers, keyed
// by answer ID, aggregated per emoji, with the caller's own reaction flagged
// so the UI can highlight their selection without broadcasting who reacted.
func reactionsForQuestion(e *Env, sessionId string, roundIndex int, questionIndex int, callerPlayerId models.PlayerId) (map[string]reactionsByAnswer, error) {
	rows, err := e.Db.Query(`SELECT ar.answer_id, ar.player_id, ar.emoji
		FROM answer_reaction ar
		JOIN answer a ON a.id = ar.answer_id
		WHERE a.session_id = ? AND a.round_index = ? AND a.question_index = ?`,
		sessionId, roundIndex, questionIndex)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]reactionsByAnswer)
	for rows.Next() {
		var answerId, playerId, emoji string
		if err := rows.Scan(&answerId, &playerId, &emoji); err != nil {
			return nil, err
		}
		ra := result[answerId]
		if ra.counts == nil {
			ra.counts = make(map[string]int)
		}
		ra.counts[emoji]++
		if playerId == string(callerPlayerId) {
			ra.myReaction = emoji
		}
		result[answerId] = ra
	}
	return result, rows.Err()
}

// isSingleEmoji reports whether s is exactly one emoji character. Emoji are
// often multi-codepoint (variation selectors, skin-tone modifiers, ZWJ-joined
// sequences like 👨👩👧👦, flags like 🇺🇸, keycaps like 1️⃣), so this validates
// structurally instead of counting runes: the string must start with one base
// emoji (or keycap) and continue with only allowed emoji codepoints. Plain
// text ("abc"), multiple emoji ("👍❤️"), and empty strings are rejected.
func isSingleEmoji(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	runes := []rune(s)

	i := 0
	if !isEmojiBase(runes[0]) {
		switch {
		case isRegionalIndicator(runes[0]):
			// A single regional indicator is not a flag: require a pair (🇺🇸).
			if i+1 >= len(runes) || !isRegionalIndicator(runes[i+1]) {
				return false
			}
			i += 2
		case isKeycapBase(runes[0]):
			// keycap sequence: digit, #, or * + optional variation selector +
			// combining enclosing keycap (e.g. 1️⃣)
			j := 1
			if j < len(runes) && runes[j] == '\ufe0f' {
				j++
			}
			if j >= len(runes) || runes[j] != '\u20e3' {
				return false
			}
			i = j + 1
		default:
			return false
		}
	} else {
		i = 1
	}

	// Then only emoji continuations: variation selectors, skin-tone
	// modifiers, tag characters, ZWJ-joined emoji, and the combining keycap.
	for i < len(runes) {
		r := runes[i]
		switch {
		case isEmojiContinuation(r):
			i++
		case r == '\u200d': // ZWJ: must join another emoji (👨👩👧👦)
			if i+1 >= len(runes) || !isEmojiBase(runes[i+1]) {
				return false
			}
			i += 2
		default:
			return false
		}
	}
	return true
}

// isEmojiContinuation reports whether r is a codepoint that extends an emoji
// without starting a new one: a variation selector (FE0E/FE0F), a skin-tone
// modifier, a tag character (subdivision flags), or the combining keycap.
func isEmojiContinuation(r rune) bool {
	switch {
	case r >= 0xfe00 && r <= 0xfe0f: // variation selectors
		return true
	case r >= 0x1f3fb && r <= 0x1f3ff: // skin-tone modifiers
		return true
	case r >= 0xe0020 && r <= 0xe007f: // tag characters
		return true
	case r == 0x20e3: // combining enclosing keycap
		return true
	}
	return false
}

// isRegionalIndicator reports whether r is a regional indicator (the pair of
// which forms a flag emoji).
func isRegionalIndicator(r rune) bool {
	return r >= 0x1f1e6 && r <= 0x1f1ff
}

func isKeycapBase(r rune) bool {
	return r == '#' || r == '*' || (r >= '0' && r <= '9')
}

// isEmojiBase reports whether r is a base emoji codepoint. The ranges cover
// the common emoji-presentation blocks of Unicode; symbols outside them are
// rejected.
func isEmojiBase(r rune) bool {
	switch {
	case r == 0x00a9 || r == 0x00ae: // © ®
		return true
	case r == 0x2122: // ™
		return true
	case r >= 0x2190 && r <= 0x21ff: // arrows
		return true
	case r >= 0x231a && r <= 0x23ff: // misc technical (watch, hourglass, ...)
		return true
	case r >= 0x25aa && r <= 0x25fe: // geometric shapes
		return true
	case r >= 0x2600 && r <= 0x27bf: // misc symbols and dingbats
		return true
	case r >= 0x2934 && r <= 0x2935: // arrows with tips
		return true
	case r >= 0x2b00 && r <= 0x2bff: // misc symbols and arrows
		return true
	case r >= 0x1f000 && r <= 0x1f0ff: // mahjong, dominoes, playing cards
		return true
	case r >= 0x1f100 && r <= 0x1f1e5: // enclosed alphanumerics
		return true
	case r >= 0x1f300 && r <= 0x1f5ff: // misc symbols and pictographs
		return true
	case r >= 0x1f600 && r <= 0x1f64f: // emoticons
		return true
	case r >= 0x1f680 && r <= 0x1f6ff: // transport and map symbols
		return true
	case r >= 0x1f700 && r <= 0x1f7ff: // alchemical + geometric shapes extended
		return true
	case r >= 0x1f900 && r <= 0x1f9ff: // supplemental symbols and pictographs
		return true
	case r >= 0x1fa70 && r <= 0x1faff: // symbols and pictographs extended-A
		return true
	}
	return false
}
