import React from 'react';
import sendData from "../index"
import PlayerAnswer from "./PlayerAnswers"
import "./Scorer.css"

import {Button} from "antd"

interface ScoreState {
    correct?: boolean
    score_override?: number | string | null
}

interface Props {
    session_id: string
    player_id: string
    round_id: string | number
    question_id: string | number
    session_state: any
    scored: boolean
    question_type?: string
}

interface State {
    scores: Record<string, ScoreState>
    answers: any[]
}

class PlayerScorer extends React.Component<Props, State> {

    state: State = {
        scores: {},
        answers: []
    }

    componentDidMount() {
        const answers = sessionStorage.getItem("answers")
        if (answers && answers !== "undefined") {
            const answersStored = JSON.parse(answers)
            if (answersStored) {
                this.setState({answers: answersStored}, () => this.get_answers())
            } else {
                this.get_answers()
            }
        }

    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.session_state !== prevProps.session_state && prevProps.session_state) {
            if (this.props.question_id === prevProps.question_id) {
                this.get_answers()
            }
        } else if (this.props.question_id !== prevProps.question_id) {
            this.setState({scores: {}}, () => this.get_answers())
        } else if (this.props.round_id !== prevProps.round_id) {
            this.setState({scores: {}}, () => this.get_answers())
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
                .then((data: any) => {
                    this.log_answer_lag(data)
                    console.log(data)
                    sessionStorage.setItem("answers", JSON.stringify(data.answers))
                    if (!data.errors) {
                        this.setState({answers: data.answers}, () => {
                            // Structured question types are auto-scored by the
                            // backend against the snapshot answer key, so the
                            // mod does not judge correctness. Pre-mark every
                            // player correct (override = wager) so the backend
                            // awards the wager to right answers and zeroes
                            // wrong ones; the mod may still adjust an override.
                            if (this.auto_scored()) {
                                this.auto_score()
                            }
                        })
                    }
                })
        }
    }

    // true when the active question is auto-scored (multiple_choice / matching).
    auto_scored = () => {
        return this.props.question_type === "multiple_choice" || this.props.question_type === "matching"
    }

    // Pre-populate scores so the Score button is ready and the backend's
    // auto-scoring decides correctness (the mod's correct flag is ignored for
    // structured types; ScoreOverride is still honored).
    auto_score = () => {
        const scores: Record<string, ScoreState> = {}
        for (const player of this.state.answers) {
            scores[player.player_id] = {correct: true, score_override: this.get_wager(player.player_id) ?? null}
        }
        this.setState({scores: scores})
    }

    log_answer_lag = (data: any) => {
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
        let elapsed_time = ((Date.now() - (timestamp * 1000)) / 1000)
        if (elapsed_time < 15) {
            console.log("elapsed time: " + elapsed_time + "s")
        }
    }


    score = () => {

        if (this.scorable()) {

            const url = "/gameplay/session/" + this.props.session_id + "/score"
            const body = {
                player_id: this.props.player_id,
                round_index: this.props.round_id,
                question_index: this.props.question_id,
                players: this.state.scores
            }

            sendData(url, "PUT", body)
                .then((data: any) => {
                })
        }
    }

    set_correct = (player_id: string, correct: boolean) => {

        const scores = this.state.scores
        if (scores[player_id] === undefined) {
            scores[player_id] = {}
        }
        scores[player_id].correct = correct

        const wager = this.get_wager(player_id)
        if (correct) {
            scores[player_id].score_override = wager as number | null
        }
        if (!correct) {
            scores[player_id].score_override = 0
        }

        this.setState({scores: scores})
    }

    get_wager = (player_id: string): number | null | undefined => {
        for (let i = 0; i < this.state.answers.length; i++) {
            if (this.state.answers[i].player_id === player_id) {
                return this.state.answers?.length > 0 ?
                    this.state.answers[i].answers[this.state.answers[i].answers.length - 1]?.wager
                    : null
            }
        }
    }

    set_override = (player_id: string, value: number | string | null) => {
        const scores = this.state.scores
        if (scores[player_id] === undefined) {
            scores[player_id] = {}
        }
        scores[player_id].score_override = value
        this.setState({scores: scores})
    }

    clear = (player_id: string) => {
        const scores = this.state.scores
        delete scores[player_id]
        this.setState({scores: scores})
    }

    scorable = () => {
        if ((this.state.scores as any).length === 0) {
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
        const answers = this.state.answers?.map((player: any) => {
            const status = this.state.scores[player.player_id] || {}
            const override_value = status.score_override !== undefined ? status.score_override : 0
            return <PlayerAnswer key={player.player_id} player_id={player.player_id}
                                 answers={player.answers} clear={this.clear} set_correct={this.set_correct}
                                 player_name={player.team_name} correct={status.correct}
                                 session_id={this.props.session_id}
                                 set_override={this.set_override} override_value={override_value as number}
                                 auto_scored={this.auto_scored()}/>
        })

        return (
            <div className="player-scorer">
                {answers}
                <Button type="primary" onClick={this.score} disabled={!this.scorable()} style={{margin: 10}}>
                    Score
                </Button>
            </div>
        );
    }
}

export default PlayerScorer;
