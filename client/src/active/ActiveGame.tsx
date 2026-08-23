import React from 'react';
import './ActiveGame.css';
import ActiveQuestion from "./ActiveQuestion"
import ActiveRound from "./ActiveRound"
import NextOrPrevious from "../control/NextOrPrevious"
import AnswerQuestion from "../answer/AnswerQuestion"
import PlayerScorer from "../admin-scorer/PlayerScorer"
import PlayerStatus from "../players/PlayerStatus"
import Scoreboard from '../scoreboard/Scoreboard';
import type {RoundInGame} from "../types/models"

interface Props {
    session_id: string
    player_id: string
    session_state: any
    is_mod: boolean
    rounds: number[]
    is_mobile?: boolean
    fullRounds: RoundInGame[]
}

interface State {
    question: string
    answer: string
    category: string
    active_question: number | string
    active_round: number | string
    categories: string[]
    wagers: number[]
    scored: boolean | unknown[]
    round_name: string
    scoring_note?: string
    scoring_note_id?: string
    question_type: string
    choices: string[]
    lefts: string[]
    rights: string[]
}

class ActiveGame extends React.Component<Props, State> {

    constructor(props: Props) {
        super(props)
        this.state = {
            question: "",
            answer: "",
            category: "",
            active_question: "",
            active_round: "",
            categories: [],
            wagers: [],
            scored: [],
            round_name: "",
            question_type: "",
            choices: [],
            lefts: [],
            rights: []
        }
    }

    componentDidMount() {
        this.get_current_question()
        this.get_round()
    }

    componentDidUpdate(prevProps: Props) {
        if (this.props.session_state !== prevProps.session_state) {
            this.get_current_question().then(() => this.get_round())
        }
    }

    get_round = () => {
        let url = "/gameplay/session/" + this.props.session_id + "/current-round"
        return fetch(url).then(response => response.json())
            .then((r: {id: number, name: string, categories: string[], wagers: number[]}) => {
                console.log(r)
                this.setState({
                    categories: r.categories,
                    wagers: r.wagers,
                    active_round: r.id,
                    round_name: r.name || ""
                })
            })
    }

    get_current_question = () => {
        let url = "/gameplay/session/" + this.props.session_id + "/current-question?player_id=" + this.props.player_id
        return fetch(url).then(response => response.json())
            .then((q: {
                question: string, answer: string, category: string, id: number,
                scored: boolean, scoring_note: string, scoring_note_id: string,
                question_type: string, choices: string[], lefts: string[], rights: string[]
            }) => {
                console.log(q)
                this.setState({
                    question: q.question,
                    answer: q.answer,
                    category: q.category,
                    active_question: q.id,
                    scored: q.scored === true,
                    scoring_note: q.scoring_note,
                    scoring_note_id: q.scoring_note_id,
                    question_type: q.question_type || "",
                    choices: q.choices || [],
                    lefts: q.lefts || [],
                    rights: q.rights || [],
                })
            })
    }


    render() {
        const question_indices = this.state.categories?.map((question, index) => index)

        return (
            <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', maxWidth: '100%', padding: 5}}>
                <div className="game-and-scoreboard">
                    <div className='active-game'>
                        <div className="round-and-question">
                            <ActiveRound categories={this.state.categories} active_question={this.state.active_question}
                                         name={this.state.round_name}/>
                            <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id}
                                            question={this.state.question} answer={this.state.answer}
                                            scored={this.state.scored as boolean}
                                            round_name={this.state.round_name} category={this.state.category}
                                            editable={this.props.is_mod}
                                            player_id={this.props.player_id} round_index={this.state.active_round}
                                            question_index={this.state.active_question}
                                            scoring_note={this.state.scoring_note}
                                            scoring_note_id={this.state.scoring_note_id}
                                            question_type={this.state.question_type}
                                            choices={this.state.choices}
                                            lefts={this.state.lefts}
                                            rights={this.state.rights}
                            />
                        </div>

                        {!this.props.is_mod ? <AnswerQuestion question={this.state.active_question}
                                                              round={this.state.active_round}
                                                              session_id={this.props.session_id}
                                                              player_id={this.props.player_id}
                                                              session_state={this.props.session_state}
                                                              scored={this.state.scored as boolean}
                                                              wagers={this.state.wagers}
                                                              question_type={this.state.question_type}
                                                              choices={this.state.choices}
                                                              lefts={this.state.lefts}
                                                              rights={this.state.rights}/> : null}

                        {this.props.is_mod ?
                            <NextOrPrevious questions={question_indices} rounds={this.props.rounds}
                                            active_question={this.state.active_question}
                                            active_round={this.state.active_round}
                                            session_id={this.props.session_id}
                                            player_id={this.props.player_id}
                                            fullRounds={this.props.fullRounds}
                            /> : null}

                    </div>
                    <Scoreboard round_id={this.state.active_round} session_id={this.props.session_id}
                                player_id={this.props.player_id} session_state={this.props.session_state}
                                is_mobile={this.props.is_mobile}/>

                </div>
                {this.props.is_mod ?
                    <PlayerScorer question_id={this.state.active_question}
                                  round_id={this.state.active_round} session_id={this.props.session_id}
                                  player_id={this.props.player_id} session_state={this.props.session_state}
                                  scored={this.state.scored as boolean}
                                  question_type={this.state.question_type}/> : null}

                {!this.props.is_mod ?
                    <PlayerStatus question_id={this.state.active_question}
                                  round_id={this.state.active_round} session_id={this.props.session_id}
                                  player_id={this.props.player_id} session_state={this.props.session_state}
                                  scored={this.state.scored as boolean} is_mobile={this.props.is_mobile}/> : null}
            </div>
        );
    }
}

export default ActiveGame;
