// TypeScript mirrors of the Go API models (server/go/src/models/*.go).
//
// These are hand-maintained to match the wire format exactly — every field
// name corresponds to the `json:"..."` tag on the Go struct. When the backend
// model changes, update these types in lockstep.
//
// Wire timestamp format: the Go API serializes all timestamps as a UTC-naive
// "2006-01-02T15:04:05.000000" string (models.dateFormat). It is NOT a real
// ISO-8601 timestamp, so don't hand it to `new Date(...)` and expect a parsed
// timezone-aware value. Treat it as an opaque string.
export type WireTimestamp = string;

/** models.Question */
export interface Question {
  id: string;
  create_date: WireTimestamp;
  category: string;
  question: string;
  answer: string;
  rounds_used: string[];
  user_id: string;
  question_type?: string;
  choices?: QuestionChoice[];
  pairs?: QuestionPair[];
  buckets?: QuestionBucket[];
  items?: QuestionBucketItem[];
  ordered?: QuestionOrderedItem[];
}

export interface QuestionChoice {
  text: string;
  is_correct: boolean;
}

export interface QuestionPair {
  left: string;
  right: string;
}

/** models.QuestionBucket — one bucket in a bucketing question */
export interface QuestionBucket {
  text: string;
}

/** models.QuestionBucketItem — one item plus the bucket it belongs to */
export interface QuestionBucketItem {
  text: string;
  bucket: string;
}

/**
 * models.QuestionOrderedItem — one entry in an ordering question. The correct
 * order is the position of the entry in Question.ordered (index 0 = first).
 */
export interface QuestionOrderedItem {
  text: string;
}

/** models.Round */
export interface Round {
  id: string;
  create_date: WireTimestamp;
  name: string;
  questions: string[];
  wagers: number[];
  games: string[];
  user_id: string;
}

/** models.Game */
export interface Game {
  id: string;
  create_date: WireTimestamp;
  name: string;
  rounds: string[];
  round_names: Record<string, string>;
  user_id: string;
}

/** models.Collection */
export interface Collection {
  id: string;
  create_date: WireTimestamp;
  name: string;
  questions: string[];
  question_data: Question[];
  user_id: string;
}

/** models.ScoringNote (user_id is `json:"-"`, never serialized) */
export interface ScoringNote {
  id: string;
  create_date: WireTimestamp;
  last_used: WireTimestamp;
  name: string;
  description: string;
}

/** models.Category (user_id is `json:"-"`, never serialized) */
export interface Category {
  id: string;
  create_date: WireTimestamp;
  name: string;
  scoring_note: string;
  /** Derived server-side: how many questions reference this category (ticket #195). */
  questions_used: number;
}

/** models.PlayerId — a branded string used as a map key (e.g. scoreboard). */
export type PlayerId = string;

/** models.Player (id is `json:"id,omitempty"`; active is session-roster-only) */
export interface Player {
  id?: string;
  create_date: WireTimestamp;
  team_name: string;
  real_name: string;
  icon: string;
  active?: boolean;
}

/**
 * models.QuestionInRound.
 * NOTE: the Go `Index` field serializes as `json:"id"`, and `QuestionId` is
 * `json:"-"` (never sent). The `id` here is a round-local index, NOT a
 * question UUID.
 */
export interface QuestionInRound {
  category?: string;
  question?: string;
  answer?: string;
  scored?: boolean;
  id: number;
  scoring_note: string;
  scoring_note_id: string;
  question_type?: string;
  choices?: string[];
  lefts?: string[];
  rights?: string[];
  buckets?: string[];
  items?: string[];
  ordered?: string[];
}

/** models.RoundInGame */
export interface RoundInGame {
  round_id?: string;
  wagers?: number[];
  questions?: QuestionInRound[];
}

/** models.Session */
export interface Session {
  id: string;
  create_date: WireTimestamp;
  name: string;
  game_id?: string;
  mod?: PlayerId;
  started: boolean;
  rounds?: RoundInGame[];
  current_round?: number;
  current_question?: number;
  scoreboard?: Record<PlayerId, number[]>;
  players?: PlayerId[];
}

/** models.PlayerScore */
export interface PlayerScore {
  icon?: string;
  score: number[];
  team_name: string;
  player_id?: PlayerId;
  active?: boolean;
}

/** models.PlayerScoreboard */
export interface PlayerScoreboard {
  scores: PlayerScore[];
}

/** models.CorrectorNot */
export interface CorrectorNot {
  correct: boolean;
  score_override?: number;
}

/** models.ScoreRequest */
export interface ScoreRequest {
  question_index: number;
  round_index: number;
  player_id: PlayerId;
  players: Record<PlayerId, CorrectorNot>;
}

/** models.AnswerUnscored */
export interface AnswerUnscored {
  team_name: string;
  icon: string;
  answered: boolean;
  player_id?: PlayerId;
  active?: boolean;
}

/** models.ScoredTeam (one entry per player in an AnswersResponseScored) */
export interface ScoredTeam {
  team_name: string;
  icon: string;
  player_id?: PlayerId;
  active?: boolean;
  answers: ScoredAnswer[];
}

/** models.ReactionSummary — aggregated state of one emoji on one answer */
export interface ReactionSummary {
  count: number;
  /** team names of the players who reacted with this emoji */
  players: string[];
}

/** models.ScoredAnswer */
export interface ScoredAnswer {
  wager: number;
  use_moneyball: boolean;
  correct: boolean;
  points_awarded: number;
  answer: string;
  answer_id: string;
  reactions: Record<string, ReactionSummary>;
  my_reaction?: string;
}

/** models.AnswerReaction — one emoji reaction by one player to one answer */
export interface AnswerReaction {
  id: string;
  create_date: WireTimestamp;
  answer_id: string;
  player_id: PlayerId;
  emoji: string;
}

/** models.Answer (session_id is `json:"-"`, never serialized) */
export interface Answer {
  id: string;
  create_date: WireTimestamp;
  question_id?: number;
  round_id?: number;
  player_id: PlayerId;
  answer: string;
  wager: number;
  use_moneyball?: boolean;
  correct?: boolean;
  points_awarded?: number;
  /** answers-as-mod view: reaction targeting + aggregated state */
  answer_id?: string;
  reactions?: Record<string, ReactionSummary>;
  my_reaction?: string;
}

/** sessions.IndividualAnswerAsMod (one entry per player in the mod's AnswersAsMod) */
export interface IndividualAnswerAsMod {
  player_id: PlayerId;
  team_name: string;
  answered: boolean;
  active?: boolean;
  answers: Answer[];
}
