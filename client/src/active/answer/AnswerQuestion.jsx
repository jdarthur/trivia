import React from 'react';
import "./AnswerQuestion.css"
import SelectableWager from "./SelectableWager"

class AnswerQuestion extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            answer: "",
            available_wagers: [],
            wager: null,
            dirty: false
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.setState({ answer: "", wager: null, dirty: false }, () => this.get_available_wagers())
        }
    }

    get_available_wagers = () => {
        //get available wagers and truncate duplicates
        console.log("")
    }

    set_answer = (event) => {
        this.setState({ answer: event.target.value })
    }

    set_wager = (value) => {
        this.setState({ wager: value })
    }

    is_sendable = () => {
        //different than before
        //a wager is selected
        //question is not ""
    }

    send = () => {
        console.log("send")
        const answer = {
            question_id: this.props.question_id,
            answer: this.state.answer,
            wager: this.state.wager,
        }
        console.log(data)
    }

    render() {
        const wagers = this.state.available.map(wager =>
            <SelectableWager key={wager} wager={wager}
                select={this.set_wager} selected={this.state.wager === wager} />)

        return (
            <div className="answer-question">
                <textarea className="text-area" value={this.state.answer}
                    onChange={this.set_answer} placeholder="Your answer" />

                <div className="answer-footer">
                    {wagers}
                    <button onClick={this.send}> Answer </button>
                </div>


                {this.props.is_mod ?
                    <NextOrPrevious questions={questions} rounds={this.props.rounds}
                        active_question={this.state.active_question} active_round={this.state.active_round}
                        session_id={this.props.session_id} player_id={this.props.player_id} /> : null}
                <div>
                    {this.props.players}
                </div>
            </div>
        );
    }
}

export default AnswerQuestion;