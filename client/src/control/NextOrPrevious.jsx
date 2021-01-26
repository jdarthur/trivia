import React from 'react';
import "./control.css"
import SetQuestion from "./SetQuestion"
import SetRound from "./SetRound"
import { Button } from "antd"

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
class NextOrPrevious extends React.Component {

    render() {
        const qind = this.props.questions?.indexOf(this.props.active_question);
        const rind = this.props.rounds?.indexOf(this.props.active_round);

        const prev_q = qind > 0 ? this.props.questions[qind - 1] : null
        const next_q = qind + 1 < this.props.questions?.length ? this.props.questions[qind + 1] : null

        const prev_r = rind > 0 ? this.props.rounds[rind - 1] : null
        const next_r = rind + 1 < this.props.rounds.length ? this.props.rounds[rind + 1] : null

        const show_pq = prev_q !== null //show 'Previous question' if not first q in round
        const show_pr = !show_pq && prev_r !== null //show 'Previous round' if not showing prev q and not in first round
        const show_nq = next_q !== null //show 'Next question' if not last q in round
        const show_nr = !show_nq && next_r !== null //show 'Next round' if not showing next q & not in last round
        const show_end = !show_nq && !show_nr //show end game if last q in round and last round in game

        const spacer = prev_q === null && prev_r === null ? <div></div> : null //left spacer to fix alignment in first round

        return (
            <div className="next-or-previous">
                {show_pq ? <SetQuestion target={prev_q} label="Previous Question" round_id={this.props.active_round}
                    session_id={this.props.session_id} player_id={this.props.player_id} /> : spacer}
                {show_pr ? <SetRound target={prev_r} label="Previous Round"
                    session_id={this.props.session_id} player_id={this.props.player_id} /> : spacer}

                {show_nq ? <SetQuestion target={next_q} label="Next Question" round_id={this.props.active_round}
                    session_id={this.props.session_id} player_id={this.props.player_id} /> : null}
                {show_nr ? <SetRound target={next_r} label="Next Round"
                    session_id={this.props.session_id} player_id={this.props.player_id} /> : null}

                {show_end ? <Button type="primary"> End game </Button>: null}
            </div>
        );
    }
}

export default NextOrPrevious;