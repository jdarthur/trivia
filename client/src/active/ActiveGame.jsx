import React from 'react';
import './ActiveGame.css';
import ActiveQuestion from "./ActiveQuestion"
import ActiveRound from "./ActiveRound"
import NextOrPrevious from "../control/NextOrPrevious"
import AnswerQuestion from "../answer/AnswerQuestion"
import PlayerScorer from "../admin-scorer/PlayerScorer"
import PlayerStatus from "../players/PlayerStatus"
import Scoreboard from '../scoreboard/Scoreboard';

class ActiveGame extends React.Component {

  constructor(props) {
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
      round_name: ""
    }
  }

  componentDidMount() {
    this.get_current_question()
    this.get_round()
  }

  componentDidUpdate(prevProps) {
    if (this.props.session_state !== prevProps.session_state) {
      this.get_current_question()
      this.get_round()
    }
  }

  get_round = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/current-round"
    fetch(url).then(response => response.json())
      .then(r => {
        console.log(r)
        this.setState({ categories: r.categories, wagers: r.wagers, active_round: r.id, round_name: r.name || "" })
      })
  }

  get_current_question = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/current-question?player_id=" + this.props.player_id
    fetch(url).then(response => response.json())
      .then(q => {
        this.setState({
          question: q.question,
          answer: q.answer,
          category: q.category,
          active_question: q.id,
          scored: q.scored === true
        })
      })
  }


  render() {
    const question_indices = this.state.categories?.map((question, index) => index)

    return (
      <div style={{flexGrow: 1, display: 'flex', flexDirection: 'column', maxWidth: '100%'}}>
        <div className="game-and-scoreboard">
          <div className='active-game'>
            <div className="round-and-question">
              <ActiveRound categories={this.state.categories} active_question={this.state.active_question}
                name={this.state.round_name} />
              <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id}
                question={this.state.question} answer={this.state.answer} scored={this.state.scored}
                round_name={this.state.round_name} category={this.state.category} editable={this.props.is_mod}/>
            </div>

            {!this.props.is_mod ? <AnswerQuestion question={this.state.active_question}
              round={this.state.active_round} session_id={this.props.session_id}
              player_id={this.props.player_id} session_state={this.props.session_state}
              scored={this.state.scored} wagers={this.state.wagers}/> : null}

            {this.props.is_mod ?
              <NextOrPrevious questions={question_indices} rounds={this.props.rounds}
                active_question={this.state.active_question} active_round={this.state.active_round}
                session_id={this.props.session_id} player_id={this.props.player_id} /> : null}

          </div>
          <Scoreboard round_id={this.state.active_round} session_id={this.props.session_id}
            player_id={this.props.player_id} session_state={this.props.session_state}
            is_mobile={this.props.is_mobile} />

        </div>
        {this.props.is_mod ?
          <PlayerScorer question_id={this.state.active_question}
            round_id={this.state.active_round} session_id={this.props.session_id}
            player_id={this.props.player_id} session_state={this.props.session_state}
            scored={this.state.scored}  /> : null}

        {!this.props.is_mod ?
          <PlayerStatus question_id={this.state.active_question}
            round_id={this.state.active_round} session_id={this.props.session_id}
            player_id={this.props.player_id} session_state={this.props.session_state}
            scored={this.state.scored} is_mobile={this.props.is_mobile} /> : null}
      </div>
    );
  }
}

export default ActiveGame;