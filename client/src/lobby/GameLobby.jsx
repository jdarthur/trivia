import React from 'react';
import './Lobby.css';
import InviteLink from "./InviteLink"
import LobbyPlayer from "./LobbyPlayer"
import OtherPlayers from "./OtherPlayers"


class GameLobby extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      players: [],
      is_mod: false,
      name: "",
      sess_state: ""
    }
  }

  componentDidMount() {
    this.get_session()
  }

  get_session_state = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/state?current=" + this.state.sess_state
    fetch(url)
      .then(response => response.json())
      .then(state => {
        console.log(state.state)
        this.setState({ sess_state: state.state }, this.get_session_state())
      })
  }

  get_session = () => {
    let url = "/gameplay/session/" + this.props.session_id
    if (this.props.player_id) {
      url = url + "?player_id=" + this.props.player_id
    }
    fetch(url)
      .then(response => response.json())
      .then(state => {
        console.log(state)
        const update = {
          players: state.players ? state.players : [],
          is_mod: state.mod !== undefined,
          name: state.name
        }
        this.setState(update, this.get_session_state())
      })

  }

  invite_link = () => {
    return window.location.href.split("?")[0] + "?session_id=" + this.props.session_id
  }

  join_game = () => {
    //POST /session/:id/join
  }

  render() {
    return (
      <div className="lobby">
        {this.state.is_mod ? <InviteLink session_id={this.props.session_id} /> : null}
        {this.state.is_mod ? null : <LobbyPlayer session_id={this.props.session_id} player_id={this.props.player_id} />}
        <div>
          Other players:
          <OtherPlayers player_id={this.props.player_id} session_id={this.props.session_id} 
          session_state={this.state.sess_state} />
        </div>
      </div>
    );
  }
}

export default GameLobby;