import React from 'react';
import "./AnswerQuestion.css"
import WagerManager from "./WagerManager"
import LeaveGame from "../lobby/LeaveGame"
import sendData from "../index"

import { Card, Input, Button, Radio, Select, Checkbox, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const FREEFORM = "freeform"
const MULTIPLE_CHOICE = "multiple_choice"
const MATCHING = "matching"

interface Props {
    question: number | string
    round: number | string
    session_id: string
    player_id: string
    session_state: any
    scored: boolean
    wagers?: number[]
    question_type?: string
    choices?: string[]
    lefts?: string[]
    rights?: string[]
}

interface State {
    answer: string
    wager: number | string | null
    dirty: boolean
    answered: boolean
    sending: boolean
    selected_choice: string | null
    matches: Record<string, string>
    active: boolean
    moneyball: boolean
    // the player's own scored answer for this question, fetched once scored,
    // so the answer box can show the Moneyball outcome
    scored_result: any
}

class AnswerQuestion extends React.Component<Props, State> {

    state: State = {
        answer: "",
        wager: null,
        dirty: false,
        answered: false,
        sending: false,
        selected_choice: null,
        matches: {},
        active: true,
        moneyball: false,
        scored_result: null,
    }

    // Ticket #146: a slow response for a previous question/round must not
    // overwrite the current one (WagerManager pattern). Separate counters per
    // fetch: check_active fires on session_state changes and fetch_scored_result
    // on question/round/scored changes, so they must not invalidate each other.
    activeCounter = 0
    fetchCounter = 0

    componentDidMount() {
        this.check_active()
        if (this.props.scored) {
            this.fetch_scored_result()
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.session_state !== prevProps.session_state) {
            this.check_active()
        }
        if (this.props.question !== prevProps.question || this.props.round !== prevProps.round) {
            this.setState({ answer: "", wager: null, dirty: false, answered: false, selected_choice: null, matches: {}, moneyball: false, scored_result: null })
            if (this.props.scored) {
                this.fetch_scored_result()
            }
        }
        if (this.props.scored && !prevProps.scored) {
            this.fetch_scored_result()
        }
    }

    // An inactive (left/booted) player can no longer submit; learn the flag
    // from the roster, where the caller's own row carries their player_id.
    // Guarded so a slow response can't set the flag after a newer check.
    check_active = () => {
        this.activeCounter += 1
        const currentCheck = this.activeCounter
        const url = "/gameplay/session/" + this.props.session_id + "/players?player_id=" + this.props.player_id
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Request failed (${response.status} ${response.statusText})`)
                }
                return response.json()
            })
            .then((data: any) => {
                if (currentCheck !== this.activeCounter) {
                    return
                }
                const players = data.players || []
                const self = players.find((p: any) => p.player_id === this.props.player_id)
                if (self && self.active === false) {
                    this.setState({active: false})
                }
            })
            .catch((error) => {
                console.error("Failed to check player status:", error)
            })
    }

    set_answer = (event: any) => { this.setState({ answer: event.target.value, dirty: true }) }
    set_wager = (event: any) => { this.setState({ wager: event.target.value, dirty: true }) }
    set_choice = (value: string) => { this.setState({ selected_choice: value, dirty: true }) }
    set_match = (left: string, value: string) => {
        this.setState(prevState => ({
            matches: {...prevState.matches, [left]: value},
            dirty: true
        }))
    }
    set_moneyball = (checked: boolean) => { this.setState({ moneyball: checked, dirty: true }) }

    // fetch the player's own scored answer for this question; the Moneyball
    // outcome indicator is derived from it (the flag + points the backend
    // actually awarded). Guarded: two triggers (question/round change and the
    // scored flip) can leave two fetches for different questions in flight, and
    // a slow response for the previous question must not overwrite the current
    // one (ticket #146).
    fetch_scored_result = () => {
        this.fetchCounter += 1
        const currentFetch = this.fetchCounter
        const url = "/gameplay/session/" + this.props.session_id + "/answers"
            + "?player_id=" + this.props.player_id
            + "&round_id=" + this.props.round
            + "&question_id=" + this.props.question
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Request failed (${response.status} ${response.statusText})`)
                }
                return response.json()
            })
            .then((data: any) => {
                if (currentFetch !== this.fetchCounter) {
                    return
                }
                const team = (data.answers || []).find((t: any) => t.player_id === this.props.player_id)
                const answers = team?.answers || []
                this.setState({scored_result: answers.length > 0 ? answers[answers.length - 1] : null})
            })
            .catch((error) => {
                console.error("Failed to fetch scored answer:", error)
            })
    }

    // Moneyball outcome for the player's own scored answer, per ticket #3:
    // 2X lone correct, normal with one other correct, 0 with two+ others
    // correct, -1X incorrect. A correct answer that pays 0 is a busted bet
    // ("2+ others got it right"), not a missed answer.
    moneyball_status = (): {text: string, emoji: string, success: boolean} | null => {
        const result = this.state.scored_result
        if (!result || !result.use_moneyball) return null
        const wager = result.wager || 0
        // wager > 0 guards the 2X/normal checks: with a 0 wager every award is
        // 0 and would falsely match 2*wager. (The editor rejects wagers <= 0,
        // so this is purely defensive.)
        if (result.correct && wager > 0 && result.points_awarded === 2 * wager) {
            return {text: "Moneyball successful — 2X points!", emoji: "🤑", success: true}
        }
        if (result.correct && wager > 0 && result.points_awarded === wager) {
            return {text: "Moneyball — normal points, no bonus", emoji: "🤑", success: true}
        }
        if (result.correct) {
            return {text: "Moneyball busted — correct, but no payout", emoji: "😞", success: false}
        }
        return {text: "Missed Moneyball — get 'em next time!", emoji: "😞", success: false}
    }

    question_type = () => this.props.question_type || FREEFORM

    sendable = () => {
        if (this.props.scored) return false
        if (this.state.wager === null || !this.state.dirty) return false

        const type = this.question_type()
        if (type === MULTIPLE_CHOICE) {
            return !!this.state.selected_choice
        }
        if (type === MATCHING) {
            return (this.props.lefts || []).every(left => this.state.matches[left])
        }
        return this.state.answer !== ""
    }

    handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            if (event.altKey) {
                console.log("alt-enter")
            }
            else {
                event.preventDefault()
                this.send()
            }
        }
    }

    build_answer = () => {
        const type = this.question_type()
        if (type === MULTIPLE_CHOICE) {
            return this.state.selected_choice
        }
        if (type === MATCHING) {
            return JSON.stringify(this.state.matches)
        }
        return this.state.answer
    }

    send = () => {
        if (this.sendable() && !this.state.sending) {
            const answer = {
                question_id: this.props.question,
                round_id: this.props.round,
                player_id: this.props.player_id,
                answer: this.build_answer(),
                wager: this.state.wager,
                use_moneyball: this.state.moneyball,
            }

            const url = "/gameplay/session/" + this.props.session_id + "/answer"
            console.log(url)
            console.log(answer)
            // Guard against rapid double-clicks / double Enter: clear `dirty`
            // only on success so a failed send stays retryable (ticket #147).
            this.setState({sending: true})
            sendData(url, "POST", answer)
                .then((data: any) => {
                    this.setState({ dirty: false, answered: true })
                })
                .catch((error: any) => {
                    console.log(error)
                })
                .finally(() => {
                    this.setState({sending: false})
                })
        }
    }

    render() {

        const type = this.question_type()
        const button_class = this.sendable() ? "" : "disabled"
        const send_text = this.state.answered ? "Update" : "Answer"
        const moneyball_status = this.moneyball_status()

        const answer_input = type === MULTIPLE_CHOICE ? (
            <Radio.Group value={this.state.selected_choice}
                         onChange={(event) => this.set_choice(event.target.value)}
                         style={{display: "flex", flexDirection: "column", gap: 8}}>
                {(this.props.choices || []).map((choice, index) => (
                    <Radio key={index} value={choice}> {choice} </Radio>
                ))}
            </Radio.Group>
        ) : type === MATCHING ? (
            <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                {(this.props.lefts || []).map((left, index) => (
                    <div key={index} style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                        <span style={{flexGrow: 1, marginRight: 8}}>{left}</span>
                        <Select style={{width: 180}} placeholder="Match"
                                value={this.state.matches[left]}
                                onChange={(value) => this.set_match(left, value)}
                                options={(this.props.rights || []).map(right => ({value: right, label: right}))}/>
                    </div>
                ))}
            </div>
        ) : (
            <TextArea placeholder="Your answer" value={this.state.answer}
                onChange={this.set_answer} autoSize={{ minRows: 3 }}
                onPressEnter={this.handleKeyPress} style={{fontSize: 16}} />
        )

        // A player who left the game sees a disabled "You left the game" card.
        if (!this.props.player_id) {
            return null
        }
        if (!this.state.active) {
            return (
                <Card style={{ width: 'min(400px, 100%)', marginTop: 15}} bodyStyle={{ padding: 15 }}
                      title="You left the game">
                    <p>You are no longer in this game and cannot submit answers.</p>
                    <LeaveGame session_id={this.props.session_id} player_id={this.props.player_id}/>
                </Card>
            )
        }
        return (
            <Card style={{ width: 'min(400px, 100%)', marginTop: 15}} bodyStyle={{ padding: 15 }}  >
                {answer_input}

                {/* Moneyball opt-in (ticket #3): risk the wager for a 2X payout. */}
                {!this.props.scored ? (
                    <div className="moneyball-row" style={{marginTop: 10}}>
                        <Checkbox checked={this.state.moneyball}
                                  onChange={(event) => this.set_moneyball(event.target.checked)}>
                            🤑 Moneyball
                        </Checkbox>
                        <Tooltip title="Moneyball: risk your wager for a 2X payout. Correct and alone → 2X points. Correct with one other → normal points. Correct with two or more others → 0 points. Wrong → −1X points.">
                            <QuestionCircleOutlined style={{marginLeft: 4, color: "#999"}}/>
                        </Tooltip>
                    </div>
                ) : null}

                {/* Moneyball outcome, shown once the question is scored. */}
                {moneyball_status ? (
                    <div className={"moneyball-outcome " + (moneyball_status.success ? "success" : "missed")}
                         style={{marginTop: 10, fontWeight: "bold"}}>
                        <span style={{fontSize: "1.3em"}}>{moneyball_status.emoji}</span> {moneyball_status.text}
                    </div>
                ) : null}

                <div className="answer-footer">
                    <WagerManager session_id={this.props.session_id} player_id={this.props.player_id}
                        round_id={this.props.round} wager={this.state.wager} select={this.set_wager}
                        question_id={this.props.question} all_wagers={this.props.wagers}/>
                    <Button type="primary" className={button_class}
                        onClick={this.send} disabled={!this.sendable() || this.state.sending}> {send_text} </Button>
                </div>
            </Card>
        );
    }
}

export default AnswerQuestion;
