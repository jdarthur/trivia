import React from 'react';
import "./AnswerQuestion.css"
import WagerManager from "./WagerManager"
import sendData from "../index"

class AnswerQuestion extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            answer: "",
            wager: null,
            dirty: false
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state &&
            this.props.question !== prevProps.question) {
            this.setState({ answer: "", wager: null, dirty: false })
        }
        if (this.props.question !== prevProps.question) {
            this.setState({ answer: "", wager: null, dirty: false })
        }
    }

    set_answer = (event) => {
        this.setState({ answer: event.target.value, dirty: true })
    }

    set_wager = (value) => {
        this.setState({ wager: value, dirty: true })
    }

    sendable = () => {
        return (
            this.state.wager !== null &&
            this.state.answer !== "" &&
            this.state.dirty &&
            !this.props.scored)
    }

    send = () => {
        if (this.sendable()) {
            console.log("send")
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
                .then((data) => {
                    this.setState({ dirty: false })
                })
        }
    }

    render() {

        const button_class = this.sendable() ? "" : "disabled"
        return (
            <div className="answer-question">
                <textarea rows={8} className="answer-box" value={this.state.answer}
                    onChange={this.set_answer} placeholder="Your answer" />

                <div className="answer-footer">
                    <WagerManager session_id={this.props.session_id} player_id={this.props.player_id}
                        round_id={this.props.round} wager={this.state.wager} select={this.set_wager}
                        question_id={this.props.question} />
                    <button className={button_class} onClick={this.send}> Answer </button>
                </div>
            </div>
        );
    }
}

export default AnswerQuestion;