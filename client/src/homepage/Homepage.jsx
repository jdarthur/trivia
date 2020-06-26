import React from 'react';
import './Homepage.css';
import NewGameModal from "./NewGameModal"
import GameLobby from "../lobby/GameLobby"
import ActiveGame from "../active/ActiveGame"

const SESSION_ID = "session_id"
const PLAYER_ID = "player_id"

class Homepage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      session_id: "",
      player_id: "",
      sess_state: "",
      players: [],
      is_mod: false,
      started: false,
      rounds: []
    }
  }

  componentDidMount() {
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let session_id = params.get(SESSION_ID);
    let player_id = params.get(PLAYER_ID);

    const state = {}
    if (session_id) {
      state[SESSION_ID] = session_id
    }
    if (player_id) {
      state[PLAYER_ID] = player_id
    }

    this.setState(state, () => this.get_session())
  }

  get_session_state = () => {
    if (this.state.session_id !== "") {
      let url = "/gameplay/session/" + this.state.session_id + "/state?current=" + this.state.sess_state
      fetch(url)
        .then(response => response.json())
        .then(state => {
          console.log(state.state)
          this.setState({ sess_state: state.state }, () => this.get_session())
        })
    }
    else {
      console.log(this.state)
    }
  }

  get_session = () => {
    if (this.state.session_id !== "") {
      let url = "/gameplay/session/" + this.state.session_id
      if (this.state.player_id) {
        url = url + "?player_id=" + this.state.player_id
      }
      fetch(url)
        .then(response => response.json())
        .then(state => {
          console.log(state)
          const rounds = state.rounds ? Object.keys(state.rounds) : []
          const update = {
            players: state.players ? state.players : [],
            is_mod: state.mod !== undefined,
            name: state.name,
            started: state.started ? true : false,
            rounds: rounds
          }
          this.setState(update, () => this.get_session_state())
        })
    }
  }


  render() {
    const main = (this.state.started ?
      <ActiveGame session_id={this.state.session_id} player_id={this.state.player_id}
        session_state={this.state.sess_state} is_mod={this.state.is_mod} rounds={this.state.rounds} /> :
      <GameLobby session_id={this.state.session_id} player_id={this.state.player_id}
        session_state={this.state.sess_state} is_mod={this.state.is_mod} />)
    return (
      <div className="homepage">
        {this.state.session_id === "" ? <NewGameModal /> : null}
        {this.state.session_id !== "" ? main : null}
      </div>
    );
  }
}

export default Homepage;