import React from 'react';
import "./AnswerQuestion.css"
import WagerManager from "./WagerManager"
import sendData from "../index"

import { Card, Input, Button } from 'antd';

const { TextArea } = Input;

class AnswerQuestion extends React.Component {

    state = {
        answer: "",
        wager: null,
        dirty: false,
        answered: false,
    }


    componentDidUpdate(prevProps) {
        if (this.props.question !== prevProps.question || this.props.round !== prevProps.round) {
            this.setState({ answer: "", wager: null, dirty: false, answered: false })
        }
    }

    set_answer = (event) => { this.setState({ answer: event.target.value, dirty: true }) }
    set_wager = (event) => { this.setState({ wager: event.target.value, dirty: true }) }

    sendable = () => {
        return (
            this.state.wager !== null &&
            this.state.answer !== "" &&
            this.state.dirty &&
            !this.props.scored)
    }

    handleKeyPress = (event) => {
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

    send = () => {
        if (this.sendable()) {
            const answer = {
                question_id: this.props.question,
                round_id: this.props.round,
                player_id: this.props.player_id,
                answer: this.state.answer,
                wager: this.state.wager,
            }

            const url = "/gameplay/session/" + this.props.session_id + "/answer"
            console.log(url)
            console.log(answer)
            sendData(url, "POST", answer)
                .then((data) => { this.setState({ dirty: false, answered: true }) })
        }
    }

    render() {

        const button_class = this.sendable() ? "" : "disabled"
        const send_text = this.state.answered ? "Update" : "Answer"
        return (
            this.props.player_id ?
            <Card style={{ width: 'min(400px, 100%)', marginTop: 15}} bodyStyle={{ padding: 15 }}  >
                <TextArea placeholder="Your answer" value={this.state.answer}
                    onChange={this.set_answer} autoSize={{ minRows: 3 }}
                    onPressEnter={this.handleKeyPress} style={{fontSize: 16}} />

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