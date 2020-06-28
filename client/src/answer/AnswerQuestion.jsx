import React from 'react';
import "./AnswerQuestion.css"
import SelectableWager from "./SelectableWager"
import sendData from "../index"

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

    componentDidMount() {
        this.get_available_wagers()
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.setState({ answer: "", wager: null, dirty: false }, () => this.get_available_wagers())
        }
    }

    get_available_wagers = () => {
        //get available wagers and truncate duplicates
        const available = []
        const resp = [1,2,3,1,2,3]
        for (let i = 0; i < resp.length; i++) {
            if (available.indexOf(resp[i]) === -1) {
                available.push(resp[i])
            }
        }
        this.setState({available_wagers : available})
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
            this.state.dirty)
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
                this.setState({dirty: false})
            })
        }


    }

    render() {
        const wagers = this.state.available_wagers.map(wager =>
             <SelectableWager key={wager} wager={wager}
                 select={this.set_wager} selected={this.state.wager === wager} />)
        
        const button_class = this.sendable() ? "" : "disabled"
        return (
            <div className="answer-question">
                <textarea rows={8} className="answer-box" value={this.state.answer}
                    onChange={this.set_answer} placeholder="Your answer" />

                <div className="answer-footer">

                    <div className="selectable-wagers"> Wager: {wagers} </div>
                    <button className={button_class} onClick={this.send}> Answer </button>
                </div>
            </div>
        );
    }
}

export default AnswerQuestion;