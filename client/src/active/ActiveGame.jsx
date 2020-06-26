import React from 'react';
import './ActiveGame.css';
// import InviteLink from "./InviteLink"
// import LobbyPlayer from "./LobbyPlayer"
import ActiveQuestion from "./ActiveQuestion"
import ActiveRound from "./ActiveRound"
import NextQuestion from "../control/NextQuestion"

class ActiveGame extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      question: "",
      answer: "",
      active_question: "",
      categories: [],
      wagers: []
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
        this.setState({ categories: r.categories, wagers: r.wagers })
      })
  }

  get_current_question = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/current-question"
    fetch(url).then(response => response.json())
      .then(q => {
        this.setState({ question: q.question, answer: q.answer, active_question: q.id })
      })
  }


  render() {
    let next_ind = this.state.categories.findIndex(category => category.question_id === this.state.active_question)
    const next_question_id = (next_ind !== -1 && (next_ind + 1 < this.state.categories.length)) ? this.state.categories[next_ind + 1].question_id : null
    
    //const next_round_id

    return (
      <div className="active-game">
        <ActiveRound name="insert round name here" categories={this.state.categories}
          active_question={this.state.active_question} />
        <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id}
          question={this.state.question} answer={this.state.answer} />

        {this.props.is_mod && next_question_id ?
          <NextQuestion next_question={next_question_id}
            session_id={this.props.session_id} player_id={this.props.player_id} /> : null}
        <div>
          {this.props.players}
        </div>
      </div>
    );
  }
}

export default ActiveGame;