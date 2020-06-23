import React from 'react';
import './Lobby.css';

import OtherPlayer from "./OtherPlayer"

class OtherPlayers extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      players: []
    }
  }

  componentDidMount() {
    this.get_players()
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
        this.setState({ players: state })
      })
  }

  render() {
    const players = this.state.players.map((player) => {
      if (player.id !== this.props.player_id) {
        return <OtherPlayer key={player.team_name} team_name={player.team_name}
          real_name={player.real_name} />
      }
      return null
    })

    return (
      <div>
        {players}
      </div>
    )
  }
}

export default OtherPlayers;