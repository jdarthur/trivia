import React from 'react';
import './ActiveGame.css';

import {Breadcrumb, Card, Tooltip} from 'antd';
import {EditOutlined, InfoCircleOutlined, PlaySquareOutlined} from '@ant-design/icons';
import FormattedQuestion, {MemoFormattedQuestion} from "../question/FormattedQuestion"
import BucketedItems from "../question/BucketedItems"
import HotEditQuestion from "./HotEditQuestion";
import HotEditRoundName from "./HotEditRoundName";

interface Props {
    session_state: any
    session_id: string
    question: string
    answer: string
    scored: boolean
    round_name: string
    category: string
    editable: boolean
    player_id: string
    round_index: number | string
    question_index: number | string
    scoring_note?: string
    scoring_note_id?: string
    question_type?: string
    choices?: string[]
    lefts?: string[]
    rights?: string[]
    buckets?: string[]
    items?: string[]
    // bucketing: item -> bucket mapping, parallel to `items` — the answer
    // key, served to the mod (and to everyone once the question is scored).
    item_buckets?: string[]
    ordered?: string[]
}

interface State {
    question_editor_open: boolean
    round_editor_open: boolean
}

// FNV-1a 32-bit over the question's identity — a stable, dependency-free seed
// for the mod's display shuffle below (not the server's FNV-128a/PCG, so the
// exact order may differ from a player's; both are stable permutations of the
// canonical order).
function hashSeed(...parts: (string | number)[]): number {
    let hash = 0x811c9dc5
    for (const part of parts) {
        const text = String(part)
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i)
            hash = Math.imul(hash, 0x01000193)
        }
    }
    return hash >>> 0
}

// mulberry32: a tiny seeded PRNG backing the deterministic display shuffle.
function mulberry32(seed: number): () => number {
    let state = seed
    return () => {
        state = (state + 0x6D2B79F5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// Fisher-Yates with the seeded PRNG. Display-only: the canonical order is
// never reordered anywhere (the server snapshot stays canonical).
function seededShuffle(items: string[], seed: number): string[] {
    const out = [...items]
    const rand = mulberry32(seed)
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
}

class ActiveQuestion extends React.Component<Props, State> {

    state: State = {
        question_editor_open: false,
        round_editor_open: false
    }

    open_question_editor = () => {
        this.setState({question_editor_open: true})
    }

    close_question_editor = () => {
        this.setState({question_editor_open: false})
    }

    open_round_editor = () => {
        if (this.props.editable) {
            this.setState({round_editor_open: true})
        }
    }

    close_round_editor = () => {
        this.setState({round_editor_open: false})
    }

    // Ticket #215: pre-score, the mod's question box mirrors the shuffled list
    // the players see — the server serves the mod the canonical order (it is
    // the answer key, ticket #211), so the client shuffles deterministically
    // per (session, round, question), keeping the mod's refetches stable. A
    // player's `ordered` is already shuffled by the server (ticket #211), so
    // it is shown as-is to keep the question box in sync with the answer
    // grid. Once scored everyone sees the canonical order.
    orderedItems = (): string[] => {
        const ordered = this.props.ordered || []
        if (!this.props.scored && this.props.editable && ordered.length > 1) {
            const seed = hashSeed(this.props.session_id, this.props.round_index, this.props.question_index)
            return seededShuffle(ordered, seed)
        }
        return ordered
    }


    render() {
        // const question_newlined = this.props.question?.split("^").map((part, index) => <div key={index} className="linebreak"> {part} </div>)

        const extra = this.props.editable ?
            <EditOutlined onClick={this.open_question_editor} style={{paddingBottom: 10}}/> : null
        const editQuestionModal = this.state.question_editor_open ?
            <HotEditQuestion category={this.props.category} question={this.props.question} answer={this.props.answer}
                             close={this.close_question_editor} session_id={this.props.session_id}
                             player_id={this.props.player_id}
                             round_index={this.props.round_index}
                             question_index={this.props.question_index}
                             question_type={this.props.question_type}
                             choices={this.props.choices}
                             pairs={(this.props.lefts || []).map((left, index) => ({left, right: (this.props.rights || [])[index] || ""}))}
                             buckets={(this.props.buckets || []).map(text => ({text}))}
                             items={(this.props.items || []).map(text => ({text, bucket: ""}))}
                             ordered={this.props.ordered}
            /> : null


        const roundName = this.state.round_editor_open ?
            <HotEditRoundName round_index={this.props.round_index} round_name={this.props.round_name}
                              close={this.close_round_editor} session_id={this.props.session_id}
                              player_id={this.props.player_id}/> :
            <span>
                {this.props.round_name}
                {this.props.editable ?
                    <EditOutlined onClick={this.open_round_editor}
                                  style={{fontSize: '0.9em', cursor: 'pointer', paddingLeft: '0.5em'}}/> : null}
            </span>

        const scoringNote = this.props.scoring_note !== "" ?
            <Tooltip title={this.props.scoring_note} placement={"bottom"}>
                <InfoCircleOutlined style={{marginLeft: "0.5em"}}/>
            </Tooltip> : null

        // Ticket #160: once a multiple-choice question is scored, the option
        // list below already shows the correct answer (✅ + bold), so the
        // standalone answer line is hidden to avoid duplicating it. The same
        // applies to a scored bucketing question: the item list below is the
        // answer key (each item tagged with its bucket), so the derived
        // answer text would duplicate it.
        const mcScored = this.props.scored && this.props.question_type === "multiple_choice"
        const bucketingScored = this.props.scored && this.props.question_type === "bucketing"
            && (this.props.items || []).length > 0
        const hideAnswerLine = mcScored || bucketingScored

        // The bucketing answer key once scored: items tagged with the bucket
        // they belong to (same rendering as the editor preview's Show answer).
        const bucketedItems = (this.props.items || []).map((text, index) => ({
            text,
            bucket: (this.props.item_buckets || [])[index] || ""
        }))

        return (
            <Card className="question-card" bodyStyle={{padding: 20}}>
                <span style={{display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%"}}>
                    <Breadcrumb style={{paddingBottom: 10}}>
                        <Breadcrumb.Item>
                            <PlaySquareOutlined/>
                        </Breadcrumb.Item>
                        <Breadcrumb.Item> {roundName} </Breadcrumb.Item>
                        <Breadcrumb.Item>
                            {this.props.category}
                            {scoringNote}
                        </Breadcrumb.Item>
                    </Breadcrumb>
                    {extra}
                </span>


                <div className="active-question-box">
                    <MemoFormattedQuestion question={this.props.question}
                                           answer={hideAnswerLine ? "" : this.props.answer} max_width={350}
                                           scored={hideAnswerLine ? false : this.props.scored}
                    />
                    {this.props.question_type === "multiple_choice" && (this.props.choices || []).length > 0 ?
                        <ol style={{marginTop: 10, paddingLeft: 20}}>
                            {(this.props.choices || []).map((choice, index) => {
                                // Ticket #160: once scored, mark the correct option
                                // (the one matching the answer text) with ✅ + bold
                                // and every other option with ❌.
                                const isCorrect = this.props.scored && choice === this.props.answer
                                return <li key={index} style={isCorrect ? {fontWeight: "bold"} : undefined}>
                                    {this.props.scored ? (isCorrect ? "✅ " : "❌ ") : null}{choice}
                                </li>
                            })}
                        </ol> : null}
                    {this.props.question_type === "matching" && (this.props.lefts || []).length > 0 ?
                        <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                            <tbody>
                                <tr>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.lefts || []).map((left, index) => <li key={index}>{left}</li>)}
                                        </ul>
                                    </td>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.rights || []).map((right, index) => <li key={index}>{right}</li>)}
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table> : null}
                    {this.props.question_type === "bucketing" && (this.props.items || []).length > 0 ?
                        this.props.scored ? (
                            <BucketedItems items={bucketedItems}/>
                        ) : (
                        <table style={{marginTop: 10, borderCollapse: "collapse", width: "100%"}}>
                            <tbody>
                                <tr>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.items || []).map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                    </td>
                                    <td style={{border: "1px solid #d9d9d9", padding: "4px 8px", verticalAlign: "top"}}>
                                        <ul style={{margin: 0, paddingLeft: 18}}>
                                            {(this.props.buckets || []).map((bucket, index) => <li key={index}>{bucket}</li>)}
                                        </ul>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        ) : null}
                    {this.props.question_type === "ordering" && (this.props.ordered || []).length > 0 ?
                        <ol style={{marginTop: 10, paddingLeft: 20}}>
                            {this.orderedItems().map((item, index) => <li key={index}>{item}</li>)}
                        </ol> : null}
                    {editQuestionModal}
                </div>
            </Card>
        );
    }
}

export default ActiveQuestion;
