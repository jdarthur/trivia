import React from 'react';
import './Lobby.css';

import OtherPlayer from "./OtherPlayer"
import { Empty } from "antd"

interface Props {
  player_id: string
  session_id: string
  session_state: any
  started: boolean
  set_excluded_icons: (excluded_icons: string[]) => void
}

interface State {
  players: any[]
}

class OtherPlayers extends React.Component<Props, State> {
  state: State = {
    players: []
  }

  // Ticket #146: a slow response for a previous session_state must not
  // overwrite the current one (WagerManager pattern).
  fetchCounter = 0

  componentDidMount() {
    this.get_players()
  }

  set_excluded_icons = (excluded_icons: string[]) => {
    this.props.set_excluded_icons(excluded_icons)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.session_state !== prevProps.session_state) {
      this.get_players()
    }
  }

  get_players = () => {
    this.fetchCounter += 1
    const currentFetch = this.fetchCounter
    let url = "/gameplay/session/" + this.props.session_id + "/players?player_id=" + this.props.player_id
    fetch(url)
      .then(response => response.json())
      .then(state => {
        // Only apply if this is still the latest request.
        if (currentFetch !== this.fetchCounter) {
          return
        }
        console.log(state)
        const excluded_icons: string[] = []
        for (let i = 0; i < state.length; i++) {
          if (state[i].icon) {
            excluded_icons.push(state[i].icon)
          }
        }
        this.setState({ players: state.players }, () => { this.set_excluded_icons(excluded_icons) })
      })
  }

  render() {
    const players = this.state.players.map((player) => {
      if (player.id !== this.props.player_id) {
        return <OtherPlayer key={player.team_name} team_name={player.team_name}
          real_name={player.real_name} create_date={player.create_date}
          icon_name={player.icon} player_id={player.id} session_id={this.props.session_id}
          admin_id={this.props.player_id} started={this.props.started} active={player.active} />
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
