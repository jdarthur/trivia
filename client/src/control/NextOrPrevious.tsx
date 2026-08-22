import React from 'react';
import "./control.css"
import SetQuestion from "./SetQuestion"
import SetRound from "./SetRound"
import {Button} from "antd"
import type {RoundInGame} from "../types/models"

interface Props {
    questions?: number[]
    rounds: number[]
    active_question: number | string
    active_round: number | string
    session_id: string
    player_id: string
    fullRounds: RoundInGame[]
}

/**
 * mod controller for next/previous question,
 * next/previous round, and end game.
 *
 * This class controls the logic of what buttons
 * should be visible based on current app state.
 *
 * The actions themselves are defined in their own
 * target sub-components.
 */
class NextOrPrevious extends React.Component<Props> {

    render() {
        const qind = this.props.questions?.indexOf(this.props.active_question as number)
        const qindSafe = qind ?? -1
        const rind = this.props.rounds?.indexOf(this.props.active_round as number)

        console.log(this.props)

        const prev_q = qindSafe > 0 && this.props.questions ? this.props.questions[qindSafe - 1] : null
        const next_q = qindSafe + 1 < (this.props.questions?.length ?? 0) && this.props.questions ? this.props.questions[qindSafe + 1] : null

        const prev_r = rind > 0 ? this.props.rounds[rind - 1] : null
        const next_r = rind + 1 < this.props.rounds.length ? this.props.rounds[rind + 1] : null

        const show_pq = prev_q !== null //show 'Previous question' if not first q in round
        const show_pr = !show_pq && prev_r !== null //show 'Previous round' if not showing prev q and not in first round
        const show_nq = next_q !== null //show 'Next question' if not last q in round
        const show_nr = !show_nq && next_r !== null //show 'Next round' if not showing next q & not in last round
        const show_end = !show_nq && !show_nr //show end game if last q in round and last round in game

        const spacer = prev_q === null && prev_r === null ? <div></div> : null //left spacer to fix alignment in first round

        let last_q_in_prev_r = 0
        if (show_pr && prev_r !== null) {
            const qLen = this.props.fullRounds[prev_r]?.questions?.length
            last_q_in_prev_r = (qLen === undefined ? 0 : qLen - 1) || 0
            console.log(last_q_in_prev_r)
        }

        return (
            <div className="next-or-previous">
                {show_pq ? <SetQuestion target={prev_q as number} label="Previous Question" round_id={this.props.active_round}
                                        session_id={this.props.session_id} player_id={this.props.player_id}/> : spacer}
                {show_pr ? <SetRound target={prev_r as number} label="Previous Round" question_target={last_q_in_prev_r}
                                     session_id={this.props.session_id} player_id={this.props.player_id}/> : spacer}

                {show_nq ? <SetQuestion target={next_q as number} label="Next Question" round_id={this.props.active_round}
                                        session_id={this.props.session_id} player_id={this.props.player_id}/> : null}
                {show_nr ? <SetRound target={next_r as number} label="Next Round"
                                     session_id={this.props.session_id} player_id={this.props.player_id}/> : null}

                {show_end ? <Button type="primary"> End game </Button> : null}
            </div>
        );
    }
}

export default NextOrPrevious;
