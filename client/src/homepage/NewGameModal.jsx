import React from 'react';
import './Homepage.css';

import { Modal, Button } from 'antd';
import GameNames from "./GameNames"

class NewGameModal extends React.Component {

  state = {
    open: false,
    selected_game: "",
    name: ""
  }

  open = () => { this.setState({ open: true }) }
  close = () => { this.setState({ open: false }) }
  set_name = (event) => { this.setState({ name: event.target.value }) }

  select_game = (game_id) => {
    if (this.state.selected_game === game_id) {
      this.setState({ selected_game: "" })
    }
    else {
      this.setState({ selected_game: game_id })
    }
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

        <Modal
          title="New Game"
          visible={this.state.open}
          onOk={this.create_new_game}
          okText="Create"
          onCancel={this.close}
          width="65vw">

          <div>
            <input value={this.state.name} onChange={this.set_name} placeholder="Game name" />
            <GameNames select={this.select_game} selected={this.state.selected_game} token={this.props.token} />
          </div>
        </Modal>
      )
    }

    return (
      <Button type="primary" disabled={this.props.token === ""} onClick={this.open} style={{ margin: 50 }}>
        New Game
      </Button>
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