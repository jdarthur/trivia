import React from 'react';
import './ActiveGame.css';
// import InviteLink from "./InviteLink"
// import LobbyPlayer from "./LobbyPlayer"
import ActiveQuestion from "./ActiveQuestion"
import ActiveRound from "./ActiveRound"

class ActiveGame extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      question: "",
      answer: "",
      active_category: "",
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
        this.setState({ categories: r.categories, wagers: r.wagers})
      })
  }

  get_current_question = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/current-question"
    fetch(url).then(response => response.json())
      .then(q => {
        this.setState({ question: q.question, answer: q.answer, active_category: q.category })
      })
  }


  render() {
    return (
      <div className="active-game">
        <ActiveQuestion session_state={this.props.session_state} session_id={this.props.session_id} />
        <ActiveRound categories={this.state.categories} active_category={this.state.active_category} />
        {/* {this.props.is_mod ? "youre the mod" : null} */}
        <div>
          {this.props.players}
        </div>
      </div>
    );
  }
}

export default ActiveGame;