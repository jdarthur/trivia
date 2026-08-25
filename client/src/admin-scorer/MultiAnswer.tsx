import React from 'react';
import "../players/Players.css"

import {Empty} from "antd"
import ShortTextWithPopover from "../common/ShortTextWithPopover";
import ReactionControl from "../players/ReactionControl";

interface AnswerLike {
    id?: string
    answer_id?: string
    answer: string
    wager: number
    reactions?: Record<string, number>
    my_reaction?: string
}

interface Props {
    answers?: AnswerLike[]
    omitWager?: boolean
    // question_type lets the scorer render structured answers readably:
    // multiple_choice answers are already the chosen option text, but a
    // matching answer is a JSON map string like {"1":"A","2":"B"} that we
    // render as "1 → A · 2 → B".
    question_type?: string
    // Optional reaction wiring (ticket #156): when a viewer (session_id +
    // current_player) is passed and the question is scored, a reaction
    // control renders under the latest answer. Both the player scored view
    // (CorrectOrNot) and the moderator scorer (PlayerAnswers) go through this
    // component, so reactions work everywhere the answer text is shown.
    session_id?: string
    current_player?: string
    scored?: boolean
}

class PlayerAnswer extends React.Component<Props> {

    // renderMatchingAnswer parses a matching answer's JSON map (left -> right)
    // into a readable string; anything unparseable is shown verbatim. Used for
    // the compact "old answers" chips; the prominent latest answer uses
    // MatchingAnswerTable (ticket #162).
    renderMatchingAnswer = (answer: string): string => {
        try {
            const map = JSON.parse(answer)
            const pairs: string[] = []
            for (const left of Object.keys(map)) {
                pairs.push(`${left} → ${map[left]}`)
            }
            return pairs.join(' · ')
        } catch {
            return answer
        }
    }

    displayText = (answer: string): string => {
        return this.props.question_type === 'matching' ? this.renderMatchingAnswer(answer) : answer
    }

    render() {
        const answers = this.props.answers || []
        const last_answer = answers.length > 0 ? answers[answers.length - 1] : null
        const isMatching = this.props.question_type === 'matching'

        const realAnswerText = answers.length > 0 && !this.props.omitWager ?
            `${this.displayText(last_answer?.answer ?? '')} (wager: ${last_answer?.wager})`
            : `${this.displayText(last_answer?.answer ?? '')}`

        const real_answer = answers.length > 0 && last_answer ?
            <div key={last_answer.id} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 5}}>
                {/* Ticket #162: a matching answer is a JSON map of left -> right
                    texts; show the pairs side-by-side in a table instead of the
                    raw JSON (or a flat string), mirroring the question box. */}
                {isMatching
                    ? <MatchingAnswerTable answer={last_answer.answer}/>
                    : <ShortTextWithPopover text={realAnswerText} maxLength={50}/>}
                {isMatching && !this.props.omitWager ?
                    <div style={{fontSize: 12, marginTop: 2}}>(wager: {last_answer.wager})</div> : null}
            </div> :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                   style={{margin: 0}}/>

        // Reactions only exist once the admin has scored the question; the
        // control attaches to the latest answer (the one rendered prominently).
        const reactions = this.props.scored && this.props.session_id && this.props.current_player
        && last_answer && last_answer.answer_id ?
            <ReactionControl session_id={this.props.session_id} current_player={this.props.current_player}
                             answer_id={last_answer.answer_id} reactions={last_answer.reactions}
                             my_reaction={last_answer.my_reaction}/> : null

        const old_answers = <div className="multi-answer">
            {answers.map((answer, index) => {
                let show = (index !== (answers.length - 1) && index > answers.length - 4)
                const answerAndWager = `${this.displayText(answer.answer)} (wager: ${answer.wager})`
                return (show ? <span key={answer.answer_id} className="old-answer">
                    <ShortTextWithPopover text={answerAndWager} maxLength={20}/>
                 </span> : null)
            })}
        </div>

        return (
            <div>
                {old_answers}
                {real_answer}
                {reactions}
            </div>
        );
    }
}

// MatchingAnswerTable renders a matching answer — a JSON map of left -> right
// texts, e.g. {"a":"2","b":"1"} — as a compact two-column table of pairs,
// mirroring how the question box shows the matching pairs side-by-side
// (ticket #162). Anything unparseable is shown verbatim.
function MatchingAnswerTable({answer}: {answer: string}) {
    let pairs: {left: string, right: string}[] = []
    try {
        const map = JSON.parse(answer)
        pairs = Object.keys(map).map(left => ({left, right: String(map[left])}))
    } catch {
        return <span>{answer}</span>
    }
    if (pairs.length === 0) {
        return <span>{answer}</span>
    }
    return (
        <table style={{borderCollapse: "collapse"}}>
            <tbody>
            {pairs.map((pair, index) => (
                <tr key={index}>
                    <td style={{border: "1px solid #d9d9d9", padding: "2px 8px"}}>{pair.left}</td>
                    <td style={{border: "1px solid #d9d9d9", padding: "2px 8px"}}>{pair.right}</td>
                </tr>
            ))}
            </tbody>
        </table>
    )
}

export default PlayerAnswer;
