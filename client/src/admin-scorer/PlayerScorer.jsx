import React from 'react';
import sendData from "../index"
import PlayerAnswer from "./PlayerAnswers"
import "./Scorer.css"

import { Button } from "antd"

class PlayerScorer extends React.Component {

    state = {
        scores: {},
        answers: []
    }

    componentDidMount() {
        const answersStored = JSON.parse(sessionStorage.getItem("answers"))
        if (answersStored) {
            this.setState({answers: answersStored}, () => this.get_answers())
        } else {
            this.get_answers()
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.session_state !== prevProps.session_state && prevProps.session_state) {
            if (this.props.question_id === prevProps.question_id) {
                this.get_answers()
            }
        }
        else if (this.props.question_id !== prevProps.question_id) {
            this.setState({ scores: {} }, () => this.get_answers())
        }
        else if (this.props.round_id !== prevProps.round_id) {
            this.setState({ scores: {} }, () => this.get_answers())
        }
    }

    get_answers = () => {

        if (this.props.round_id !== "" && this.props.question_id !== "") {
            console.log(this.props)
            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)
            sendData(url, "GET")
                .then((data) => {
                    this.log_answer_lag(data)
                    sessionStorage.setItem("answers", JSON.stringify(data))
                    if (!data.errors) {
                        this.setState({ answers: data })
                    }
                })
        }
    }

    log_answer_lag = (data) => {
        let timestamp = 0;
        for (let i = 0; i < data.length; i++) {
            let answers = data[i]?.answers || []
            for (let j = 0; j < answers.length; j++) {
                let this_timestamp = answers[j]?.create_date
                if (this_timestamp > timestamp) {
                    timestamp = this_timestamp
                }
            }
        }
        let elapsed_time = ((Date.now() - (timestamp * 1000))/1000)
        if (elapsed_time < 15) {
            console.log("elapsed time: " + elapsed_time + "s")
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
        if (scores[player_id] === undefined) {
            scores[player_id] = {}
        }
        scores[player_id].correct = correct

        const wager = this.get_wager(player_id)
        if (correct) {
            scores[player_id].score_override = wager
        }
        if (!correct) {
            scores[player_id].score_override = 0
        }

        this.setState({ scores: scores })
    }

    get_wager = (player_id) => {
        for (let i = 0; i < this.state.answers.length; i++) {
            if (this.state.answers[i].player_id === player_id) {
                return this.state.answers?.length > 0 ?
                    this.state.answers[i].answers[this.state.answers[i].answers.length - 1].wager
                    : null
            }
        }
    }

    set_override = (player_id, value) => {
        const scores = this.state.scores
        if (scores[player_id] === undefined) {
            scores[player_id] = {}
        }
        scores[player_id].score_override = value
        this.setState({ scores: scores })
    }

    clear = (player_id) => {
        const scores = this.state.scores
        delete scores[player_id]
        this.setState({ scores: scores })
    }

    scorable = () => {
        if (this.state.scores.length === 0) {
            return false
        }
        for (let i = 0; i < this.state.answers.length; i++) {
            const player_id = this.state.answers[i].player_id
            if (this.state.scores[player_id] === undefined) {
                return false
            }
            if (this.state.scores[player_id].correct === undefined) {
                return false
            }
        }
        return true
    }

    render() {
        const answers = this.state.answers?.map(player => {
            const status = this.state.scores[player.player_id] || {}
            const override_value = status.score_override !== undefined ? status.score_override : 0
            return <PlayerAnswer key={player.player_id} player_id={player.player_id}
                answers={player.answers} clear={this.clear} set_correct={this.set_correct}
                player_name={player.team_name} correct={status.correct} session_id={this.props.session_id}
                set_override={this.set_override} override_value={override_value} />
        })

        return (
            <div className="player-scorer" >
                {answers}
                <Button type="primary" onClick={this.score} disabled={!this.scorable()} style={{ margin: 10 }}>
                    Score
                </Button>
            </div>
        );
    }
}

export default PlayerScorer;