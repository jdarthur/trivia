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

    // Ticket #146: a slow response for a previous question/round must not
    // overwrite the current one (WagerManager pattern). This also keeps the
    // sessionStorage write in the same order as the state it accompanies.
    fetchCounter = 0

    // The id of each player's latest answer as of the last fetch. Used to
    // detect a player submitting a new answer, so the mod's prior judgment
    // for them can be dropped (ticket #8).
    latest_answer_ids: Record<string, string> = {}

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
        // Question/round change is checked first: when the mod advances
        // questions, session_state bumps in the same render, so the old
        // session_state-first chain never reached the question-change branch
        // and the scorer kept the previous question's answers (ticket #145/#7).
        if (this.props.question_id !== prevProps.question_id || this.props.round_id !== prevProps.round_id) {
            this.latest_answer_ids = {}
            this.setState({scores: {}}, () => this.get_answers())
        } else if (this.props.session_state !== prevProps.session_state && prevProps.session_state) {
            // Same question, state bumped (a player answered, or the question
            // was scored): refetch the answers.
            this.get_answers()
        }
    }

    get_answers = () => {

        if (this.props.round_id !== "" && this.props.question_id !== "") {
            console.log(this.props)
            this.fetchCounter += 1
            const currentFetch = this.fetchCounter
            let url = "/gameplay/session/" + this.props.session_id + "/answers"
            url += "?player_id=" + this.props.player_id
            url += "&round_id=" + this.props.round_id
            url += "&question_id=" + this.props.question_id
            console.log(url)
            sendData(url, "GET")
                .then((data: any) => {
                    // Only apply if this is still the latest request.
                    if (currentFetch !== this.fetchCounter) {
                        return
                    }
                    this.log_answer_lag(data)
                    console.log(data)
                    sessionStorage.setItem("answers", JSON.stringify(data.answers))
                    if (!data.errors) {
                        this.setState({answers: data.answers}, () => {
                            // A player may have submitted a new answer since
                            // the last fetch (e.g. a new wager); drop their
                            // stale correct/override so the mod re-judges
                            // against the new answer (ticket #8).
                            this.clear_stale_scores()
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

    // Players still in the game (active = true on the wire; inactive members are
    // greyed out and excluded from scoring — ticket #5).
    active_answers = () => {
        return (this.state.answers || []).filter((player: any) => player.active === true)
    }

    // Pre-populate scores so the Score button is ready and the backend's
    // auto-scoring decides correctness (the mod's correct flag is ignored for
    // structured types; ScoreOverride is still honored).
    auto_score = () => {
        const scores: Record<string, ScoreState> = {}
        for (const player of this.active_answers()) {
            scores[player.player_id] = {correct: true, score_override: this.get_wager(player.player_id) ?? null}
        }
        this.setState({scores: scores})
    }

    // Drop the mod's correct/override for any player whose latest answer
    // changed since the last fetch — their judgment applied to the old answer,
    // so the player is unscored until the mod re-judges (ticket #8).
    clear_stale_scores = () => {
        const scores = {...this.state.scores}
        for (const player of this.state.answers || []) {
            const playerAnswers = player.answers || []
            const latest = playerAnswers[playerAnswers.length - 1]
            if (latest && this.latest_answer_ids[player.player_id] !== latest.id) {
                delete scores[player.player_id]
            }
            if (latest) {
                this.latest_answer_ids[player.player_id] = latest.id
            }
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
            const players: Record<string, ScoreState> = {}
            for (const player of this.active_answers()) {
                players[player.player_id] = this.state.scores[player.player_id]
            }
            const body = {
                player_id: this.props.player_id,
                round_index: this.props.round_id,
                question_index: this.props.question_id,
                players
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

    // true when the player's latest answer opted into Moneyball (ticket #3).
    get_moneyball = (player_id: string): boolean => {
        for (let i = 0; i < this.state.answers.length; i++) {
            if (this.state.answers[i].player_id === player_id) {
                const answers = this.state.answers[i].answers || []
                return answers.length > 0 && answers[answers.length - 1].use_moneyball === true
            }
        }
        return false
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
        const active = this.active_answers()
        if (active.length === 0) {
            return false
        }
        for (const player of active) {
            const player_id = player.player_id
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
            const active = player.active === true
            const status = this.state.scores[player.player_id] || {}
            const override_value = status.score_override !== undefined ? status.score_override : 0
            const card = <PlayerAnswer key={player.player_id} player_id={player.player_id}
                                       answers={player.answers} clear={this.clear} set_correct={this.set_correct}
                                       player_name={player.team_name} correct={status.correct}
                                       session_id={this.props.session_id}
                                       set_override={this.set_override} override_value={override_value as number}
                                       auto_scored={this.auto_scored()}
                                       question_type={this.props.question_type}
                                       moneyball={this.get_moneyball(player.player_id)}
                                       scored={this.props.scored}/>
            if (!active) {
                return <div key={player.player_id} className="player-scorer-inactive"
                            style={{opacity: 0.5, filter: 'grayscale(1)'}}>{card}</div>
            }
            return card
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
