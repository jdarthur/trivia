import React from 'react';
import "./AnswerQuestion.css"
import WagerManager from "./WagerManager"
import sendData from "../index"

import { Card, Input, Button, Radio, Select } from 'antd';

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
    selected_choice: string | null
    matches: Record<string, string>
}

class AnswerQuestion extends React.Component<Props, State> {

    state: State = {
        answer: "",
        wager: null,
        dirty: false,
        answered: false,
        selected_choice: null,
        matches: {},
    }


    componentDidUpdate(prevProps: Props) {
        if (this.props.question !== prevProps.question || this.props.round !== prevProps.round) {
            this.setState({ answer: "", wager: null, dirty: false, answered: false, selected_choice: null, matches: {} })
        }
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
        if (this.sendable()) {
            const answer = {
                question_id: this.props.question,
                round_id: this.props.round,
                player_id: this.props.player_id,
                answer: this.build_answer(),
                wager: this.state.wager,
            }

            const url = "/gameplay/session/" + this.props.session_id + "/answer"
            console.log(url)
            console.log(answer)
            sendData(url, "POST", answer)
                .then((data: any) => { this.setState({ dirty: false, answered: true }) })
        }
    }

    render() {

        const type = this.question_type()
        const button_class = this.sendable() ? "" : "disabled"
        const send_text = this.state.answered ? "Update" : "Answer"

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

        return (
            this.props.player_id ?
            <Card style={{ width: 'min(400px, 100%)', marginTop: 15}} bodyStyle={{ padding: 15 }}  >
                {answer_input}

                <div className="answer-footer">
                    <WagerManager session_id={this.props.session_id} player_id={this.props.player_id}
                        round_id={this.props.round} wager={this.state.wager} select={this.set_wager}
                        question_id={this.props.question} all_wagers={this.props.wagers}/>
                    <Button type="primary" className={button_class}
                        onClick={this.send} disabled={!this.sendable()}> {send_text} </Button>
                </div>
            </Card>
            : null
        );
    }
}

export default AnswerQuestion;
