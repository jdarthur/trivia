import React from 'react';
import './Lobby.css';

import OtherPlayer from "./OtherPlayer"
import { Empty } from "antd"

class OtherPlayers extends React.Component {
  state = {
    players: []
  }

  componentDidMount() {
    this.get_players()
  }

  set_excluded_icons = (excluded_icons) => {
    this.props.set_excluded_icons(excluded_icons)
  }

  componentDidUpdate(prevProps) {
    if (this.props.session_state !== prevProps.session_state) {
      this.get_players()
    }
  }

  get_players = () => {
    let url = "/gameplay/session/" + this.props.session_id + "/players?player_id=" + this.props.player_id
    fetch(url)
      .then(response => response.json())
      .then(state => {
        console.log(state)
        const excluded_icons = []
        for (let i = 0; i < state.length; i++) {
          if (state[i].icon) {
            excluded_icons.push(state[i].icon)
          }
        }
        this.setState({ players: state }, () => { this.set_excluded_icons(excluded_icons) })
      })
  }

  render() {
    const players = this.state.players?.map((player) => {
      if (player.id !== this.props.player_id) {
        return <OtherPlayer key={player.team_name} team_name={player.team_name}
          real_name={player.real_name} create_date={player.create_date}
          icon_name={player.icon} player_id={player.id} session_id={this.props.session_id}
          admin_id={this.props.player_id} />
      }
      return null
    })

    const show_empty = players?.length === 0 || (players.length === 1 && players[0] === null)
    return (
      <div className="game-lobby">
        {show_empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No players" style={{margin: 50}} /> : players }
      </div>
    )
  }
}

export default OtherPlayers;