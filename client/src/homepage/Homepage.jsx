import React from 'react';
import './Homepage.css';
import NewGameModal from "./NewGameModal"
import GameLobby from "../lobby/GameLobby"

const SESSION = "session_id"
const PLAYER_ID = "player_id"

class Homepage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      session_id: "",
      player_id: ""
    }
  }

  componentDidMount() {
    let search = window.location.search;
    let params = new URLSearchParams(search);
    let session_id = params.get(SESSION);
    let player_id = params.get(PLAYER_ID);

    const state = {}
    if (session_id) {
      state[SESSION] = session_id
    }
    if (player_id) {
      state[PLAYER_ID] = player_id
    }

    this.setState(state)
  }


  render() {
    return (
      <div className="homepage">
        {this.state.session_id === "" ? <NewGameModal /> : null}
        {this.state.session_id !== "" ?
          <GameLobby session_id={this.state.session_id} player_id={this.state.player_id} /> : null}
      </div>
    );
  }
}

export default Homepage;