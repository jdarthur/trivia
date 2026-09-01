import React from 'react';
import "./control.css"
import SetQuestion from "./SetQuestion"
import SetRound from "./SetRound"
import {Button, Card} from "antd"
import {
    CheckCircleOutlined,
    DoubleLeftOutlined,
    DoubleRightOutlined,
    LeftOutlined,
    RightOutlined,
    TrophyOutlined,
} from "@ant-design/icons"
import type {RoundInGame} from "../types/models"

interface Props {
    questions?: number[]
    rounds: number[]
    active_question: number | string
    active_round: number | string
    session_id: string
    player_id: string
    fullRounds: RoundInGame[]
    /**
     * Scoring stays in PlayerScorer — it holds every player's judgment — so
     * this card only renders the trigger: `on_score` submits, and
     * `score_disabled` mirrors whether the scorer has judged every active
     * player yet.
     */
    score_disabled?: boolean
    on_score: () => void
}

/**
 * The moderator's control strip: previous / score / next in a single card.
 *
 * This component owns the visibility logic — what "previous" and "next" mean
 * depends on where in the game we are:
 *   - mid-round          -> previous / next question
 *   - first question     -> previous round, landing on its last question
 *   - last question      -> next round
 *   - last of last round -> end game
 *
 * The navigation actions live in SetQuestion / SetRound; scoring is delegated
 * back to the parent (see `on_score`).
 */
export default function GameControlCard(props: Props) {
    const {questions, rounds, active_question, active_round, fullRounds} = props

    const qind = questions?.indexOf(active_question as number) ?? -1
    const rind = rounds.indexOf(active_round as number)

    const prev_q = qind > 0 ? questions![qind - 1] : null
    const next_q = qind + 1 < (questions?.length ?? 0) ? questions![qind + 1] : null

    const prev_r = rind > 0 ? rounds[rind - 1] : null
    const next_r = rind + 1 < rounds.length ? rounds[rind + 1] : null

    const show_pq = prev_q !== null //show 'Previous question' if not first q in round
    const show_pr = !show_pq && prev_r !== null //show 'Previous round' if not showing prev q and not in first round
    const show_nq = next_q !== null //show 'Next question' if not last q in round
    const show_nr = !show_nq && next_r !== null //show 'Next round' if not showing next q & not in last round
    const show_end = !show_nq && !show_nr //show end game if last q in round and last round in game

    // Stepping back into a round lands on that round's last question.
    let last_q_in_prev_r = 0
    if (show_pr && prev_r !== null) {
        const qLen = fullRounds[prev_r]?.questions?.length
        last_q_in_prev_r = (qLen === undefined ? 0 : qLen - 1) || 0
    }

    const session = {session_id: props.session_id, player_id: props.player_id}

    // A round step skips a whole round, so it reads as a double chevron.
    const back = show_pq ?
        <SetQuestion target={prev_q as number} label="Previous Question" round_id={active_round}
                     icon={<LeftOutlined/>} {...session}/> :
        show_pr ?
            <SetRound target={prev_r as number} label="Previous Round" question_target={last_q_in_prev_r}
                      icon={<DoubleLeftOutlined/>} {...session}/> :
            null

    const forward = show_nq ?
        <SetQuestion target={next_q as number} label="Next Question" round_id={active_round}
                     icon={<RightOutlined/>} {...session}/> :
        show_nr ?
            <SetRound target={next_r as number} label="Next Round" icon={<DoubleRightOutlined/>} {...session}/> :
            null

    return (
        <Card size="small" className="game-control-card" bodyStyle={{padding: '8px 12px'}}>
            <div className="game-control-row">
                <div className="game-control-slot"> {back} </div>

                <div className="game-control-slot game-control-slot-center">
                    <Button type="primary" icon={<CheckCircleOutlined/>} aria-label="Score"
                            disabled={props.score_disabled} onClick={props.on_score}>
                        Score
                    </Button>
                </div>

                <div className="game-control-slot game-control-slot-end">
                    {show_end ?
                        <Button danger icon={<TrophyOutlined/>} aria-label="End game"> End game </Button> :
                        forward}
                </div>
            </div>
        </Card>
    );
}
