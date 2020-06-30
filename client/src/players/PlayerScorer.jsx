import React from 'react';
import sendData from "../index"
import PlayerAnswer from "./PlayerAnswer"
import "./Players.css"

class PlayerScorer extends React.Component {

    constructor(props) {
        super(props)
        this.state = {
            scores: {},
            answers: []
        }
    }

    componentDidMount() {
        this.get_answers()
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_answers()
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.get_answers()
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.get_answers()
        }
    }

    get_answers = () => {
        console.log(this.props)
        if (this.props.round_id !== "" && this.props.question_id !== "") {

            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)

            console.log(this.props)
            sendData(url, "GET")
                .then((data) => {
                    console.log(data)
                    this.setState({ answers: data })
                })
        }
    }


    score = () => {
        if (this.scorable()) {
            const url = "/gameplay/session/" + this.props.session_id + "/score"
            const body = {
                player_id: this.props.player_id,
                round_id: this.props.round_id,
                question_id: this.props.question_id,
                players: this.state.scores
            }
            console.log(url)
            console.log(body)

            sendData(url, "PUT", body)
                .then((data) => {
                    console.log(data)
                })
        }
    }

    set_correct = (player_id, correct) => {
        const scores = this.state.scores
        scores[player_id] = { correct: correct }
        this.setState({ scores: scores })
    }

    scorable = () => {
        for (let i = 0; i < this.state.answers.length; i++) {
            const player_id = this.state.answers[i].player_id
            if (this.state.scores[player_id] === undefined) {
                return false
            }
        }
        return true
    }

    render() {
        const answers = this.state.answers.map(player => {
            const status = this.state.scores[player.player_id] || {}
            return <PlayerAnswer key={player.player_id} player_id={player.player_id}
                answer={player.answer} wager={player.answer} set_correct={this.set_correct}
                player_name={player.team_name} correct={status.correct} /> })

        const score_class = this.scorable() ? "" : "disabled"

        return (
            <div className="player-scorer" >
                {answers}
                <button onClick={this.score} className={score_class}> Score </button>
            </div>
        );
    }
}

export default PlayerScorer;