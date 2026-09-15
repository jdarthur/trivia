import React from 'react';
import "../players/Players.css"

import {Empty, Tag} from "antd"
import ShortTextWithPopover from "../common/ShortTextWithPopover";

interface AnswerLike {
    id?: string
    answer_id?: string
    answer: string
    wager: number
}

interface Props {
    answers?: AnswerLike[]
    omitWager?: boolean
    // question_type lets the scorer render structured answers readably:
    // multiple_choice answers are already the chosen option text, but a
    // matching answer is a JSON map string like {"1":"A","2":"B"} that we
    // render as "1 → A · 2 → B", and an ordering answer is a JSON array
    // string like ["a","b","c"] that we render as "1. a · 2. b · 3. c".
    question_type?: string
    // Ticket #285: the question's correct numeric answer, used to compute and
    // show how far every numeric answer is off (the mod judges correctness
    // from the off-by amount).
    correct_answer?: string
}

class PlayerAnswer extends React.Component<Props> {

    // renderMatchingAnswer parses a matching/bucketing answer's JSON map
    // (left -> right / item -> bucket) into a readable string; anything
    // unparseable is shown verbatim. Used for the compact "old answers"
    // chips; the prominent latest answer uses MappingAnswerTable (tickets
    // #162, #164).
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

    // renderOrderingAnswer parses an ordering answer's JSON array (the
    // player's chosen item order, ticket #214) into a readable numbered
    // list; anything unparseable is shown verbatim. Used for the compact
    // "old answers" chips; the prominent latest answer uses
    // OrderedAnswerTable (ticket #215).
    renderOrderingAnswer = (answer: string): string => {
        try {
            const items = JSON.parse(answer)
            if (!Array.isArray(items)) {
                return answer
            }
            return items.map((item: string, index: number) => `${index + 1}. ${item}`).join(' · ')
        } catch {
            return answer
        }
    }

    displayText = (answer: string): string => {
        if (this.isMapping()) return this.renderMatchingAnswer(answer)
        if (this.isOrdering()) return this.renderOrderingAnswer(answer)
        return answer
    }

    // matching and bucketing answers are both a JSON map string.
    isMapping = (): boolean => {
        return this.props.question_type === 'matching' || this.props.question_type === 'bucketing'
    }

    // an ordering answer is a JSON array string (ticket #214).
    isOrdering = (): boolean => {
        return this.props.question_type === 'ordering'
    }

    // a numeric answer is a plain number string (ticket #285).
    isNumeric = (): boolean => {
        return this.props.question_type === 'numeric'
    }

    // offBy returns the absolute distance between a player's numeric answer and
    // the question's correct answer, or null when either is not a number.
    offBy = (answer: string): number | null => {
        const correct = parseFloat(this.props.correct_answer || "")
        const value = parseFloat(answer)
        if (isNaN(correct) || isNaN(value)) {
            return null
        }
        return Math.abs(value - correct)
    }

    // numericOffBy renders the off-by amount for a numeric answer: a green
    // "exact" tag when the answer is the correct number, else an orange
    // "off by X" tag (rounded to 6 decimals to avoid float artifacts).
    numericOffBy = (answer: string): React.ReactNode => {
        const off = this.offBy(answer)
        if (off === null) {
            return null
        }
        const rounded = Number(off.toFixed(6))
        if (rounded === 0) {
            return <Tag color="green" style={{marginTop: 2}}>exact</Tag>
        }
        return <Tag color="orange" style={{marginTop: 2}}>off by {rounded}</Tag>
    }

    render() {
        const answers = this.props.answers || []
        const last_answer = answers.length > 0 ? answers[answers.length - 1] : null
        const isMapping = this.isMapping()
        const isOrdering = this.isOrdering()

        const realAnswerText = answers.length > 0 && !this.props.omitWager ?
            `${this.displayText(last_answer?.answer ?? '')} (wager: ${last_answer?.wager})`
            : `${this.displayText(last_answer?.answer ?? '')}`

        const real_answer = answers.length > 0 && last_answer ?
            <div key={last_answer.id} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 5}}>
                {/* Tickets #162/#164: a matching answer is a JSON map of
                    left -> right texts and a bucketing answer is a JSON map
                    of item -> bucket texts; ticket #215: an ordering answer
                    is a JSON array of the player's chosen item order. All
                    three render as readable structures (pairs side-by-side /
                    numbered list) instead of raw JSON, mirroring the
                    question box. */}
                {isMapping
                    ? <MappingAnswerTable answer={last_answer.answer}/>
                    : isOrdering
                        ? <OrderedAnswerTable answer={last_answer.answer}/>
                        : <ShortTextWithPopover text={realAnswerText} maxLength={50}/>}
                {(isMapping || isOrdering) && !this.props.omitWager ?
                    <div style={{fontSize: 12, marginTop: 2}}>(wager: {last_answer.wager})</div> : null}
                {/* Ticket #285: for a numeric answer, show how far the answer
                    is from the correct number so the mod can judge who is
                    closest / exactly right. */}
                {this.isNumeric() && last_answer ? this.numericOffBy(last_answer.answer) : null}
            </div> :
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No answer"
                   style={{margin: 0}}/>

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
            </div>
        );
    }
}

// MappingAnswerTable renders a matching or bucketing answer — a JSON map of
// left -> right / item -> bucket texts, e.g. {"a":"2","b":"1"} — as a compact
// two-column table of pairs, mirroring how the question box shows the pairs
// side-by-side (tickets #162, #164). Anything unparseable is shown verbatim.
function MappingAnswerTable({answer}: {answer: string}) {
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

// OrderedAnswerTable renders an ordering answer — a JSON array string of the
// player's chosen item order, e.g. ["b","a","c"] (ticket #214) — as a
// numbered list, mirroring how the question box shows the ordered items
// (ticket #215). Anything unparseable is shown verbatim.
function OrderedAnswerTable({answer}: {answer: string}) {
    let items: string[] = []
    try {
        const parsed = JSON.parse(answer)
        if (Array.isArray(parsed)) {
            items = parsed.map(String)
        }
    } catch {
        return <span>{answer}</span>
    }
    if (items.length === 0) {
        return <span>{answer}</span>
    }
    return (
        <ol style={{margin: 0, paddingLeft: 18, textAlign: "left"}}>
            {items.map((item, index) => <li key={index}>{item}</li>)}
        </ol>
    )
}

export default PlayerAnswer;
