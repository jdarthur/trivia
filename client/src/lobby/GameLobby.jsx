import React from 'react';
import './Lobby.css';
import InviteLink from "./InviteLink"
import LobbyPlayer from "./LobbyPlayer"
import OtherPlayers from "./OtherPlayers"

class GameLobby extends React.Component {

  start = () => {
    const url = "/gameplay/session/" + this.props.session_id + "/start"
    sendData(url, "POST", {player_id: this.props.player_id})
      .then((data) => {
        console.log(data)
        //this.setState({team_name: data.team_name, real_name: data.real_name})
      })
  }

  render() {
    return (
      <div className="lobby">
        {this.props.is_mod ? <InviteLink session_id={this.props.session_id} /> : null}
        {this.props.is_mod ? null : <LobbyPlayer session_id={this.props.session_id} player_id={this.props.player_id} />}
        <div>
          Other players:
          <OtherPlayers player_id={this.props.player_id} session_id={this.props.session_id}
          session_state={this.props.session_state} />
        </div>
        {this.props.is_mod ? <button onClick={this.start}> Start Game</button> : null }
      </div>
    );
  }
}

async function sendData(url, method, data) {
  let body
  if (data !== undefined) {
    const copy = Object.assign({}, data)
    delete copy.id
    delete copy.create_date
    body = JSON.stringify(copy)
  }

  const response = await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: body
  })
  return response.json()
}

export default GameLobby;