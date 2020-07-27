import React from 'react';
import './Homepage.css';

import Modal from "../modal/Modal"
import GameNames from "./GameNames"

class NewGameModal extends React.Component {

  constructor(props) {
    super(props)
    this.state = {
      open: false,
      selected_game: "",
      name: ""
    }
  }

  open = () => {
    this.setState({ open: true })
  }

  close = () => {
    this.setState({ open: false })
  }

  select_game = (game_id) => {
    if (this.state.selected_game === game_id) {
      this.setState({ selected_game: "" })
    }
    else {
      this.setState({ selected_game: game_id })
    }
  }

  set_name = (event) => {
    this.setState({ name: event.target.value })
  }

  create_new_game = () => {
    if (this.state.selected_game !== "") {
      console.log("new game:")
      const session = {
        name: this.state.name,
        game_id: this.state.selected_game
      }
      create_session(session)
        .then((data) => {
          console.log(data)
          const game_id = data.id
          const player_id = data.mod
          window.location.href = window.location.href.split("?")[0] + "?session_id=" + game_id + "&player_id=" + player_id
          this.props.start_game(game_id)
          //this.close()
        })
    }
  }

  render() {

    if (this.state.open) {
      return (
        <Modal is_open={this.state.open} title="New Game" save={this.create_new_game}
          save_label="Create" close={this.close}>
          <div className="new-game">
            <input value={this.state.name} onChange={this.set_name} placeholder="Name" />
            <GameNames select={this.select_game} selected={this.state.selected_game} />
          </div>
        </Modal>
      )
    }

    return (
      <button className="new-game-button" onClick={this.open}>New Game</button>
    );
  }
}

async function create_session(round_data) {
  const url = "/gameplay/session"
  const body = JSON.stringify(round_data)

  const response = await fetch(url, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: body
  })
  return response.json()
}

export default NewGameModal;