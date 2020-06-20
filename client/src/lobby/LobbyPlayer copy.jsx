import React from 'react';
import './Lobby.css';

const TEAM_NAME = "team_name"
const REAL_NAME = "real_name"
const PLAYER_BASE = "/gameplay/player"
class LobbyPlayer extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      team_name: "",
      real_name: "",
      dirty: false
    }
  }

  componentDidMount() {
    if (this.props.player_id) {
      const url = PLAYER_BASE + "/" + this.props.player_id
      sendData(url, "GET")
      .then((data) => {
        console.log(data)
        this.setState({team_name: data.team_name, real_name: data.real_name})
      })
    }
  }

  set_team_name = (event) => {
    this.setState({ [TEAM_NAME]: event.target.value, dirty: true })
  }

  set_real_name = (event) => {
    this.setState({ [REAL_NAME]: event.target.value, dirty: true })
  }

  save = () => {
    if (this.saveable()) {
      if (!this.props.player_id) {
        this.create_player()
      }
      else {
        this.update_player()
      }
    }
  }

  get_player = () => {

  }

  create_player = () => {
    console.log("create player")
    //POST /gameplay/player -> POST /gameplay/session/:id/join
    const player = {
      team_name: this.state.team_name,
      real_name: this.state.real_name
    }

    const url = PLAYER_BASE
    sendData(url, "POST", player)
    .then((data) => {
      console.log(data)
      this.add_player_to_session(data)
    })
  }

  add_player_to_session = (player) => {
    //add player to 
    const player_id = player.id
    const session_id = this.props.session_id

    const url = "/gameplay/session/" + session_id + "/add"
    sendData(url, "POST", {player_id: player_id})
    .then((data) => {
      window.location.href = window.location.href + "&player_id=" + player_id
    })
  }

  update_player = () => {
    const player_id = this.state.player_id
    const session_id = this.props.session_id
    const player = {
      team_name: this.state.team_name,
      real_name: this.state.real_name
    }
  }

  saveable = () => {
    return (
      this.state.team_name !== "" &&
      this.state.real_name !== "" &&
      this.state.dirty)
  }

  invite_link = () => {
    return window.location.href.split("?")[0] + "?session_id=" + this.props.session_id
  }

  render() {
    const button_text = this.props.player_id ? "Update" : "Join game"
    const button_class = "button" + (this.saveable() ? "" : " disabled")
    return (
      <div className="lobby-player" >
        <input value={this.state.team_name} onChange={this.set_team_name} placeholder="Team name" />
        <input value={this.state.real_name} onChange={this.set_real_name} placeholder="Your real name" />
        <button onClick={this.save} className={button_class}> {button_text} </button>
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

export default LobbyPlayer;