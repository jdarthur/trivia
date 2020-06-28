import React from 'react';
import './ActiveGame.css';
// import InviteLink from "./InviteLink"
// import LobbyPlayer from "./LobbyPlayer"
import ActiveQuestion from "./ActiveQuestion"
import ActiveRound from "./ActiveRound"
import NextOrPrevious from "../control/NextOrPrevious"
import AnswerQuestion from "../answer/AnswerQuestion"

class ActiveGame extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      question: "",
      answer: "",
      active_question: "",
      active_round: "",
      questions: [],
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
        console.log(r)
        this.setState({ questions: r.questions, wagers: r.wagers, active_round: r.id})
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
    const questions = this.state.questions.map((question, index) => index)
    const categories = this.state.questions.map(question => question.category)

    return (
      <div className="active-game">
        <ActiveRound name="insert round name here" categories={categories}
          active_question={this.state.active_question} />
        <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id}
          question={this.state.question} answer={this.state.answer} />

        {this.props.is_mod ?
          <NextOrPrevious questions={questions} rounds={this.props.rounds}
            active_question={this.state.active_question} active_round={this.state.active_round}
            session_id={this.props.session_id} player_id={this.props.player_id} /> : null}
        <AnswerQuestion question={this.state.active_question} round={this.state.active_round}
          session_id={this.props.session_id} player_id={this.props.player_id} 
          session_state={this.props.session_state} />
        <div>
          {this.props.players}
        </div>
      </div>
    );
  }
}

export default ActiveGame;